# How Garden Planner works things out

A rough guide to the logic behind the app's dates, amounts and warnings, as the code stands in **v1.54.0** (live on
both the real site and the test site). It explains each calculation in outline and names the file where it lives. Each
crop's own numbers are in its record in `js/data/crops.js` (the header there lists every field), and this guide
doesn't repeat them.

Contents:

1. [The big picture](#1-the-big-picture)
2. [Location, climate and weather](#2-location-climate-and-weather)
3. [Growth: how temperature turns into dates](#3-growth-how-temperature-turns-into-dates)
4. [Sowing months](#4-sowing-months)
5. [Coming up (germination)](#5-coming-up-germination)
6. [Thinning, true leaves and plant-out](#6-thinning-true-leaves-and-plant-out)
7. [Harvest dates and the harvest window](#7-harvest-dates-and-the-harvest-window)
8. [Learning from your records](#8-learning-from-your-records)
9. [Watering and how wet each bed is](#9-watering-and-how-wet-each-bed-is)
10. [Soil: temperature, pH, lime and the last crop](#10-soil-temperature-ph-lime-and-the-last-crop)
11. [Feeding](#11-feeding)
12. [Weather jobs, alerts and warnings](#12-weather-jobs-alerts-and-warnings)
13. [Covers](#13-covers)
14. [Sprays](#14-sprays)
15. [Planning: rotation, free spaces and ideas](#15-planning-rotation-free-spaces-and-ideas)
16. [The Beds view](#16-the-beds-view)
17. [Jobs](#17-jobs)
18. [Data, backups and the test site](#18-data-backups-and-the-test-site)

---

## 1. The big picture

Almost every date in the app comes from one idea: **plants grow at a speed set by temperature**. A crop's catalogue
days (from seed packets, written for central Japan) are turned into an amount of growth. The app then counts forward
day by day, at the speed each day's temperature allows, until that much growth has happened. A cold spell stretches
the dates, and warmth shortens them.

The temperature for each day comes from your location's climate, the forecast, and what the weather actually did. It
is then adjusted for each bed or pot (sun, shade, pot size, indoors, covers). Your own records then correct the model
for each crop (section 8).

Nothing is calculated on a server. Everything runs on the phone from the saved garden (`S`), the climate tile for your
location, and the latest forecast.

---

## 2. Location, climate and weather

### Your location

Tools → Weather takes a location from the phone's GPS, or from a search by town name (Open-Meteo's geocoding service,
which also gives the place's height). Only latitude and longitude rounded to 2 decimal places (about 1 km) are kept,
and that rough position is the only thing sent to get weather.

With no location, the app runs on built-in western Tokyo values, or on a climate type you pick (Köppen–Geiger, one
typical city per type, `js/climate/presets.js`). A real location replaces both.

### The usual weather: climate from ERA5, 2016–2025

`js/climate/climate.js`, built by `tools/era5/build.py`

- **Source:** ERA5 hourly records (Copernicus Climate Change Service) for the **10 whole years 2016–2025**, on a 0.25°
  grid, with points about 28 km apart. They're packed into 5° tiles in `climate/` that ship with the app. No weather
  service is asked for history.
- **Each grid point holds:** the mean temperature and rainfall of each month, its height, its land fraction, and frost
  statistics at seven thresholds from −2 to +4 °C.
- **Fetching:** the app downloads the one tile your garden is in (about 20 kB), once, and saves the result with the
  garden. The offline copy keeps the tile too. A location at sea has no tile. Until the tile arrives, a banner says the
  app is still on Tokyo (or your climate type).
- **Your spot:** the 4 grid points around the garden are blended by distance, and land counts for more than sea.
- **Height:** temperatures are corrected by **6.5 °C per km** between the garden's height (from the forecast) and the
  grid points' average height.
- **Frost dates:** for each winter (July to June in the north, the calendar year in the south), the app finds the first
  and last night the low reached the threshold, then takes the median of each. A grid low of **+1 °C counts as frost**,
  because a 28 km average runs about 1 °C warm on clear, still nights (checked against station frost dates). The height
  correction shifts the threshold by up to 3 °C each way. Frost dates are only used where frost came in at least 40% of
  winters. Otherwise the app says frost is rare.
- **Daily normal:** the monthly means are blended smoothly into a value for each day.
- **Day length** comes from latitude and date with the standard sunrise equation. Nothing is fetched for it. It's used
  for bolting in long-day crops and for picking the onion type (short-day below 28°, intermediate below 38°, long-day
  beyond).
- **Southern hemisphere:** month-based things written for Japan, such as pest seasons, are shifted six months. The
  tropics (latitude within 15° of the equator) have no pest seasons at all.

### The forecast and recent weather: Open-Meteo

`js/climate/weather.js`

- One request returns 7 hourly values for yesterday plus the next 6 days: weather type, temperature, rain, chance of
  rain, wind, gusts, and soil temperature at 6 cm. The daily highs, lows and totals are made from the hours.
- **When:** at start, when the app comes back to the front, and checked hourly while it's on screen. It's only fetched
  when the last one is **3 hours** old, and only while online.
- **Kept:** each past day's mean temperature (for **120 days**) and its rainfall (for **45 days**).

### Which temperature a day gets

Every growth calculation asks for a day's temperature in this order:

1. the **recorded** temperature for that day,
2. the **forecast**, for today and the days ahead,
3. the **usual** temperature from the climate, for everything else.

The forecast only reaches back to yesterday, so a day is only recorded if the app was opened soon after it. Days the
app wasn't opened count at the usual temperature for the date.

### Microclimate of a bed or pot

The day's temperature is then adjusted for where the crop is:

| Spot | Adjustment to the daily mean |
|---|---|
| Indoors | +5 °C, kept within 14–26 °C |
| Part sun / shade | −0.7 °C / −1.5 °C |
| Pot under 15 L | +0.6 °C in full sun (+0.3 °C in part sun), and −0.8 °C more on days below 5 °C |
| Pot 15–60 L in full sun | +0.3 °C |
| Fleece (fushokufu) / insect net while on | +2.5 °C / +0.5 °C, full effect up to 15 °C, fading to nothing at 22 °C |

Seedlings in trays have their own spot: outside, under cover (+3 °C) or indoors (+8 °C, at least 18 °C). The app also
remembers when trays were moved between spots.

---

## 3. Growth: how temperature turns into dates

`js/climate/climate.js` (`growUnits`), `js/plants/growth.js`

Each crop has growth settings (`grow` in its record):

- **Cool-season crops** follow a straight line. They make no growth at or below a base temperature `tb`, grow at the
  packet's speed at `tref`, and go no faster above `tcap`. One day's growth is `min(T, tcap) − tb`.
- **Warm-season crops** follow a curve, `warm: [lo, opt]`. They make no growth at or below `lo`, then pick up quickly,
  and are close to full speed from `opt` (about a 21 °C daily mean). A straight line made cool-summer places look far
  too slow.
- **Heading crops** (cabbage and its kin) don't grow at all below 6 °C.
- **Crops of your own** use the growing temperatures from their packet if you enter them. Without them they count in
  plain calendar days.

**Packet days become growth.** Packet days are for central Japan at the crop's usual sowing time. The app works out
how much growth those days give with central-Japan temperatures, starting from the usual sowing month closest to your
sowing (closest temperature, warming or cooling the same way). Your own climate then decides how long that growth
takes. So the same packet days become longer in a cool place and shorter in a warm one.

**Counting forward:** from a start date, each day's growth is added until the amount needed is reached. That day is
the date the app shows.

---

## 4. Sowing months

`js/climate/sowing.js`

Every crop's sowing or planting months are worked out for your climate rather than copied from a chart. A day counts
as a good sowing day if all of these hold:

- the temperature is in the crop's sowing band, and warming or cooling the right way for crops with set seasons;
- it reaches harvest within a reasonable time (run through the harvest model above, so months and dates always agree);
- frost-tender crops stay above their own cold limit from coming up until they're nearly done, and, if planted as it
  cools, ripen in warm enough weather;
- heat-sensitive crops don't mature in the heat, and long-day bolters don't mature in very long days;
- crops grown through winter (garlic, onions, peas) are planted as it cools, if winters are mild enough;
- crops picked over a season get a good share of the longest picking season possible there.

A month qualifies when most of it works (two of its early, middle and late days). Where your climate is close to
central Japan's, a month on the original chart qualifies if any part of it works. You can override any crop's months.
The rules carry a version number so stored windows are worked out again when they change.

---

## 5. Coming up (germination)

`js/plants/growth.js` (`germWindow`), `js/plants/germination.js`

**The expected window** is the packet's days to come up in warm soil, stretched by cold soil:

- the soil's warmth is taken as the usual air mean plus 1 °C over the days they take, plus any cover's warmth;
- at or above the crop's comfortable soil temperature, there's no stretch. Between the minimum and comfortable it
  stretches up to 1.9×, and below the minimum it's 2.2×;
- for sowings within a week of today, the forecast's soil temperature (or your meter, if you've read it in the last 30
  days) replaces the usual values.

**Looks:** a job asks you to look at the end of the window. Each look records roughly what share is up. With nothing
up, you look again in 3 days, and with some up, in 4. Looking stops when 70% or more is up, when it stops changing over
3 or more days, or when you say so.

**When they came up** is taken as the day about half of the final count was up, interpolated between two looks.
Thinning and harvest are counted from that day. While nothing is up, nothing is counted as if it were.

---

## 6. Thinning, true leaves and plant-out

`js/plants/growth.js`, `js/plants/seedlings.js`

- **Thinning:** counted from when they came up. The packet's days to thinning, less the days to come up, are turned
  into growth at the crop's reference speed. The app then counts forward with the planting's own temperatures.
- **True-leaf counts:** if you've counted leaves, the date follows the pace the plant has actually shown. It's the
  growth so far per leaf, extended to the leaf count the thinning or plant-out stage asks for.
- **Plant-out for tray seedlings:** the same calculation, using the crop's days from sowing to planting out and the
  temperature wherever the tray was kept each day.
- **When to sow a tray for a planting day:** the app searches backwards for a sowing date whose plant-out date lands
  within 2 days of the day you want. It tries where you usually keep trays first, then warmer spots, if the seedlings
  would otherwise crawl along. One example is tomatoes for early May, which need to start indoors.

---

## 7. Harvest dates and the harvest window

`js/plants/growth.js`

**First harvest:**

- direct sowings: from when they came up, for the packet's days to harvest less the days to come up;
- seedlings raised from seed: the same, counted from when they came up in the tray;
- bought seedlings of a seed crop: from planting, for the packet days less the usual days in a tray (at least 14);
- crops planted as plants, tubers or cloves: from planting, for the full packet days.

The growth needed is counted forward with the bed's own temperatures, with three limits:

- never sooner than **65% of the days** (warmth only speeds things up so far);
- never under 14 days after sowing;
- for frost-tender crops planted for autumn, such as autumn potatoes, never after the usual first frost, which kills the
  tops.

Harvest dates update themselves as the weather comes in, until you set one by hand or start picking.

**The harvest window** has three points:

- **Harvest from:** the first harvest date.
- **Most ready by:** the extra packet days (the upper end of a range like "60–80 days", or 30% more by default), at the
  same growth speed. This is capped at 1.5× those days in calendar time.
- **Keeps until:** the crop's days of good condition after maturing (`win`). Cold slows ageing for hardy crops: below
  5 °C a day only uses up 0.3 of a day. For tender crops cold shortens it instead: below 10 °C a day uses up 4. Crops
  stopped by frost keep 3 weeks after it.

The "Pick by" job follows the last day of the window.

---

## 8. Learning from your records

`js/plants/learning.js`

The app compares what you record with what it predicted, and corrects future dates for that crop.

| Stage | Recorded when you… | Compared in |
|---|---|---|
| Coming up | record germination on a direct sowing | days from sowing |
| Thinning | mark a direct sowing thinned | growth from coming up |
| Plant-out | move tray seedlings out | growth from coming up in the tray |
| First harvest | log the first pick, or tick its harvest job | growth from the model's start |

- Thinning, plant-out and harvest are measured in **growth**, using the temperatures that planting actually had, with
  its sun, pot, cover and indoor adjustments. A cold spell or a shady bed isn't learned as a slow crop.
- Coming up is measured in plain **days**, against an estimate made from the usual temperatures. A sowing in an
  unusually cold week will teach the app the crop is slow to come up.
- Each record gives a ratio: what happened ÷ what the unadjusted model expected. Ratios below 0.2 or above 5 are
  ignored as mistakes.
- **The correction** is the median ratio, shrunk towards "no change" while there are few records, and kept between
  0.6× and 1.8×:

  `factor = 1 + (median − 1) × n ÷ (n + 2)`

  For example, one record 50% slower moves future dates 17% later, and three such records move them 30%.
- It's learned **per crop**, not per variety or bed, and applied to every future estimate of that stage.
- It's shown in Tools → Learned from your garden, for any crop and stage that's at least 3% faster or slower, and in
  the notes on a planting.
- Nothing extra is stored: it's recalculated from your records whenever they change.

---

## 9. Watering and how wet each bed is

`js/garden/watering.js`, `js/garden/insights.js`

There's one watering job for each group: outdoor pots and bags together, each bed in the ground, indoor pots, and
seedlings. Each group remembers when it was last watered.

**Rain** counts as what fell (recorded), plus forecast days with at least a 50% chance of rain.

**Pots and bags outside:** a water balance from 0 (dry) to 1 (full).

- A watering fills the pot. A "full watering" is your amount per 40 L bag (4 L by default, about 10% of the pot).
- Rain tops the pot up by its millimetres compared with that share of the pot's depth.
- Each day uses 1 ÷ interval. The interval depends on the usual temperature: daily at 21 °C or more, every 2 days at
  17 °C, 3 at 11.5 °C, 4 at 8 °C, and 5 when colder. It drops to daily when the forecast high is 30 °C or more.
- Watering is due when the balance hits 0. If enough rain is due the next day, the app waits for it.

**Beds in the ground:** a soil-water balance.

- The soil holds about **25 mm** the roots can use. Each day loses `max(0.4, 0.17 × daily mean °C)` mm, and rain puts
  water back. Past days with no record count the usual rain.
- Watering is due when **12 mm** is used, or **6 mm** for plantings in their first 3 weeks, whose roots are shallow.
  The app waits if a soak due the next day would cover most of it.
- The amount suggested is that deficit in litres per m² times the bed's area.
- A meter reading of DRY today makes it due now. A WET reading pushes it to tomorrow.

**Indoor pots** are watered every 3 days, or every 2 at 24 °C or more. **Seedlings** are watered daily, or every other
day below 12 °C. Trays outside skip a day after 3 mm or more of rain.

**How wet, on the Beds view:** the same sums are run up to today and give Dry, Drying, Moist or Wet. A meter reading
taken today wins.

---

## 10. Soil: temperature, pH, lime and the last crop

`js/garden/soil.js`, `js/garden/rotation.js`

- **Soil temperature for sowing:** the forecast's soil temperature at 6 cm, averaged per day. "Now" is today's average
  and "this week" is the coming days' average. Your meter readings from the last 30 days give each bed's difference from
  the forecast, and a reading from the last 3 days sets "now". Each crop has a minimum, a comfortable and a too-warm soil
  temperature, which give "too cold", "slow", "good" or "patchy in heat".
- **Lime** is set by the crop's usual rate (100 g/m² by default, 150 for brassicas and legumes), adjusted by pH:
  - no reading: the usual rate;
  - pH within 0.1 of the top of the crop's range or above: none;
  - more than 0.25 below the bottom of the range: enough to correct it (about 20 g/m² per 0.1 pH, up to 300 g/m²);
  - otherwise: half the usual rate.
- **Area:** a bed section's m². For a pot, its soil volume, at about 150 L of mix to 1 m² of dug bed.
- **What the last crop left:**
  - after a legume, cut the base fertiliser by a third (to 40% for light feeders and sweet potato);
  - after a heavy feeder, use 1.5× compost, with a warning if the next crop is hungry too;
  - light and medium feeders need no change.

---

## 11. Feeding

`js/feeding/`

### What a crop needs

Each crop has a seasonal need for nitrogen, phosphate (P₂O₅) and potash (K₂O) in g per m². The need is multiplied by
the planting's area: its section of a bed, or for a pot the larger of its surface and its soil volume ÷ 150 L.

### What a product gives

The grams of a dose come from your amount and its unit: mL of a solid through its density, handfuls, or liquids mixed
into the watering can. The usable share comes from the product's N-P-K and its availability this season:

- for N, the share the product says it releases this season;
- for P and K, from 30% to 100% depending on the product type;
- in later seasons, only about 5% of slow organic products.

### The feeding card (ledger)

`js/feeding/ledger.js` adds up everything the crop can draw on:

1. **Starting soil:** for pots, the fertiliser in fresh mix, released over its own period, of which the crop gets the
   part that overlaps its season.
2. **What earlier crops left:** compost from earlier crops keeps releasing for a couple of years.
3. **Base fertiliser** at planting.
4. **Every feeding since,** from the log. A feeding shared across a bed is split by area.
5. **Planned feedings** still to come.

### The day-by-day food model

`js/feeding/sim.js`

- Each input releases evenly over its own release time, starting after its lead time. Organic products take longer.
- The crop's daily demand follows its growth (section 3), so most of the need falls in warm weeks and almost none in
  midwinter.
- What isn't taken up is lost through drainage. In beds, the loss follows rain. In pots, it's 6% of the pool per
  watering, using your own watering pace from the last 4 weeks if you've been ticking jobs.
- This gives **"fed until about …"**: the first growing day when the crop gets less than 60% of what it wants. It also
  gives a **too-much-at-once** warning, when nitrogen sitting in the soil exceeds 35% of the season's need in beds, or
  40% in pots.

### Base fertiliser suggestion

`js/feeding/plans.js`

- **Target usable N:** per 40 L pot, 4 g / 3.2 g / 1.6 g / 0.8 g for heavy / medium / light feeders / legumes with a
  quick fertiliser (less with a slow one). Per m² of bed, 5.6 / 4.2 / 2.2 / 1.7 g.
- That target is multiplied by the last crop's adjustment and any salt reading, then converted into grams of your
  chosen product.
- For a first crop in fresh mix that still holds fertiliser, there's no base. It's halved while the mix is still
  feeding.

### Side-dressing and the planner

`js/feeding/stages.js`, `js/feeding/planner.js`

- Stages are set from the crop's record: days after planting or thinning, a fraction of the way to harvest, or tied to
  this planting's own winter.
- **Winter** for feeding is when the usual mean is below 8 °C, or 15 °C for warm-season crops.
- Crops going into winter are kept lean: from 3 weeks before, or 5 weeks for heading brassicas grown for spring, which
  bolt if big in the cold. Their main feed is when growth restarts.
- Garlic and onions have a **last feed**, and nothing goes on after it.
- The planner runs every planned dose in date order and leaves one out if it's more than 30% of the season's need in one
  go, or if the soil would hold more than the too-much limit then.
- Repeating feeds pause through cold dormancy, skip while the soil holds plenty, stop when nothing more is needed, and
  pause if the salt meter reads high. Liquid feeds for outdoor pots ride along with the watering job.

---

## 12. Weather jobs, alerts and warnings

`js/climate/weather.js`, `js/garden/insights.js`, `js/plants/problems.js`

**Jobs from the forecast:**

| Job | Triggered by |
|---|---|
| Frost | a low of 2 °C or less in the next 5 days, for tender crops outdoors. Half-hardy crops count from −1 °C. Fleece protects down to −2 °C. "Hard frost" from −2 °C. |
| Wind | gusts of 50 km/h or more ("storm-force" from 75) |
| Heavy rain | 40 mm or more with at least a 50% chance ("very heavy" from 80) |
| Heat | a high of 33 °C or more ("extreme" from 36) |

The day-by-day alerts on the home screen use the same limits (heavy rain from 30 mm). They name the beds hit: young or
nearly ready crops for rain, tall, netted or covered ones for wind, and pots and young plants for heat.

**Spray windows:** an hour is good if it's dry with under a 40% chance of rain, wasn't raining in the 2 hours before,
stays dry for 6 hours after, has wind under about 11 km/h with gusts under 25 km/h, and is between 5 and 28 °C. Windows
of 2 hours or more between 6:00 and 18:00 are shown.

**Weather on jobs:**

- Watering, feeds and sprays with 5 mm or more of rain due that day or the next offer to skip or move to the next dry
  day.
- Sowing jobs warn of frost in the next 3 days, or a high of 33 °C or more that day.

**Quality warnings** apply to crops near harvest:

- heat-bolting crops with highs of 28 °C or more;
- day-length bolters once spring days pass 12 hours;
- crops that split, when 20 mm of rain follows a dry week;
- frost-damaged heads, at −2 °C.

---

## 13. Covers

`js/plants/covers.js`

Covers (fleece, insect net, shade cloth) are recorded with when they went on and came off. While on, they warm the
crop's temperature (section 2) and its soil for coming up. Fleece also protects from frost down to −2 °C.

Reminders:

- open fleece on days of 25 °C or more;
- take fleece off once a 5-day forecast has no low under 3 °C as spring warms;
- lift nets in the mornings for bees once crops that need pollinating are 3 weeks from harvest;
- take off a cover with nothing under it.

---

## 14. Sprays

`js/products/sprays.js`

The app looks no rules up. Each spray's crops, waiting days before picking and the most uses a season are what you
enter from its label. From your spray log it works out:

- the waiting period on each planting ("OK to pick?");
- the uses left this season;
- warnings for ingredients known to harm bees.

---

## 15. Planning: rotation, free spaces and ideas

`js/garden/rotation.js`, `js/garden/planning.js`, `js/garden/ideas.js`

- **Rotation:** the app warns when a crop follows the same family in the same space. The rotation plan keeps each
  family out of a space for its rest years (each crop's `rest`). A season is the calendar year in the north, and July
  to June in the south. Crops that moved within a bed leave a trace where they were.
- **Planned crops** become jobs counted back from planting day, such as "sow tray" (section 6) and prep. When the crop
  goes in, the plan turns into a real planting and its dates shift to the real day.
- **Free spaces** are the gaps along each bed over the coming ~300 days.
- **"What could go here?"** tries each of your crops as a direct sowing, bought seedlings or seedlings you raise. For
  each, it tries today, then the 1st and 15th of each month up to the "clear by" date or about 5 months ahead.
  - The **clear-by** date is the next planned crop less 2 weeks' prep. Otherwise, in the cool season, it's when the
    usual mean reaches 16 °C (the main spring planting).
  - Each option runs the real harvest model and says when it would be done. Quick hardy leaves can go a couple of months
    past their window under fleece.
  - Ideas are ranked: fits the deadline first, then not the same family as the last crop, then soonest done.
- **Shopping list:** for crops planned in the coming weeks: seedlings to buy (with how many fit), seed to sow,
  insect netting sized to the bed plus 90 cm, supports for tall crops, and fertiliser, compost and lime totalled by
  product.

---

## 16. The Beds view

`js/pages/home.js`, `js/garden/insights.js`, `js/garden/areas.js`

This replaced the garden map in 1.54. Each bed or pot gets a card, and these are its parts:

- **How far along:** days since sowing ÷ days to the first harvest, from 0 to 100%. A bed shows its most advanced
  crop.
- **Dots** come in three colours:
  - terracotta: something is ready to pick;
  - amber: heat is coming, or the bed is probably dry;
  - slate blue: frost, heavy rain or wind is coming.

  They cover the next 5 days, or only the day picked in the forecast strip.
- **Sun & Moisture view:** each bed's sun setting and its estimated wetness (section 9).
- **Sorting:** name, needs attention first (the count of dots plus overdue jobs), driest first, closest to harvest, or
  newest sowing.
- **Filters:** all, needs attention, ready to pick, dry (Dry or Drying), or empty. Areas (Farm, Backyard…) show one at
  a time, and search matches bed names, crops and varieties.

---

## 17. Jobs

`js/garden/tasks.js`

Most jobs keep themselves up to date. These include thinning, harvest and "pick by", looks for seedlings coming up,
plant-out, watering, feeds, frost and weather jobs, and the care jobs from a crop's record. Care jobs are timed in days
of growth, so a cold spell pushes them back. Supports for crops that grow through winter wait for spring growth.

An overdue job shows as due today. Ticking off a job that was due before today asks when it was really done, so your
records stay right. A dismissed weather or frost job stays dismissed for that date.

---

## 18. Data, backups and the test site

- The garden is saved on the phone in IndexedDB. The saved format has a version, and older saves are brought up to
  date step by step, with a copy of the old one kept first (`js/core/migrate.js`).
- The app keeps a daily snapshot on the phone, exports backups, and can back up to Google Drive (`js/backup/`). Every
  restore can be undone.
- The test site has its own garden and can **time-travel** to another date. For a travelled-to week, the "forecast" is
  what the weather really did on those 14 days (from Open-Meteo's archive, from that year if it exists yet, otherwise
  the latest year that has it). The real site never moves.

See the README for how a change reaches the phone (the `test` → `main` release flow).
