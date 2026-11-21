# Tests

These are **scenario tests**: each one opens the app in an invisible, phone-sized Chrome browser, sets up a garden
(beds, pots, plantings, products, records), uses a feature the way you would — tapping buttons, filling forms — and
prints what the app shows or works out (dates, amounts, messages). It also records any errors the page throws.

The first time a scenario runs, what it prints is saved in `tests/expected/`. After that, every run compares the new
output with the saved one, so any change in behaviour shows up — wanted or not.

## Running them

You need [Node.js](https://nodejs.org) (version 22 or later).

```
npm install                          # once: installs Playwright, the browser driver
npx playwright install chromium      # once: downloads the browser it drives
npm test                             # run all scenarios (about 5 minutes)
npm run lint                         # check the code: names used without importing them, unused code
npm test -- feeding                  # only scenarios with "feeding" in the name
```

They also run automatically on GitHub for every push (see `.github/workflows/tests.yml`); the result shows as a ✓ or
✗ next to each commit.

## Backups from older versions

`tests/fixtures/backups/` holds backups made by older versions of the app (a made-up garden, no personal data). Make one
from the current code with `npm run fixture`, or from an older version with `node tests/tools/make-fixture.js v1.26.1`
(any git tag or commit). Do this before changing what the app saves — see "Data safety" in the main README.

## When a test fails

- **"crashed"** or **"errors in the page"**: something is broken — the message shows where.
- **"output changed"**: the app now prints something different. The runner shows the first line that differs; the full
  new output is in `tests/output/<name>.actual.txt` to compare with `tests/expected/<name>.txt`.
  - If the change is a bug, fix the app.
  - If the change is intended (say, a better harvest estimate), accept it with `npm run test:update` and commit the
    updated files in `tests/expected/`, so the change is visible in the history.

## Things to know

- **The date is fixed** at 18 November 2026, 10:00 Tokyo time (see `tests/lib.js`), so results don't change from day
  to day. Scenarios that need another date set their plantings' dates explicitly.
- **No internet**: weather, the climate archive and Google Drive are simulated inside the scenarios that need them; any
  other outside request is blocked.
- **Screenshots** some scenarios take go to `tests/output/<name>/` (not kept in git) — handy for checking layouts by eye.
- Each scenario starts with an empty app in a fresh browser, so they don't affect each other.
- **Reaching into the app**: the app is made of ES modules, so its functions aren't globals. `tests/lib.js` adds a small
  generated script to the page that makes every module's exports available by name, so a scenario can still write
  `pg.evaluate(() => crop('tomato'))` or change `S` and call `save()`.

## What each scenario covers

| Scenario | What it checks |
|---|---|
| `autumn-potatoes` | Potatoes planted for autumn finish with the first frosts; crowded plants drawn to their share of the pot |
| `back-button-and-popups` | The phone's Back button closes pop-ups instead of leaving the page |
| `bee-warning` | Bee-harmful ingredients recognised in any product (names, brands, registry); the spray days page lists your sprays that have them |
| `climate-from-location` | Fetching the climate for a location (simulated), the sowing calendar following it, editing a crop's months |
| `copy-planting-to-pots` | "Same in other pots": copying a planting, its jobs and feedings to other pots |
| `crop-ideas` | "What could go here?": stop-gap crops for empty space, clear-by dates, same-family warnings |
| `dialog-field-alignment` | Date fields line up with the fields next to them in every dialog |
| `drive-backup` | Google Drive backup end to end against a simulated Google: connect, daily backup, photos once, tidy-up, restore |
| `dropdown-in-popup` | A drop-down inside a scrolling pop-up stays under its field, and closes when the field scrolls away |
| `dropdowns-deletes-pot-sizes` | The in-page drop-downs, "delete — are you sure?", fertiliser amounts scaling with pot size |
| `feeding-by-season` | Feeding stages for many crops and planting dates: lean before winter, spring restart feeds |
| `feeding-ledger-covers-meter` | What the feeding card counts (mix, soil, previous crop, feeds), covers, meter levels |
| `feeding-plan-liquid-with-watering` | Feeding plan doses; weekly liquid feeds merged into the watering job |
| `feeding-plan-suggestions` | Feeding plan suggestions for celery and cabbage; overfeeding guard |
| `frost-covers-and-wind` | Frost warnings and covers, wind advice |
| `garden-map` | The garden map: dragging beds, scrolling |
| `garlic-feeding-model` | The day-by-day nitrogen model for garlic in a bag (drainage, uptake, "fed until") |
| `garlic-feeding-plan` | Garlic's feeding card and plan, including the last feed (止め肥) |
| `germination-and-thinning-dates` | When seedlings come up and when to thin, from temperatures |
| `harvest-estimates` | Harvest dates for crops sown at different times of year |
| `history-past-crops-and-log` | Adding past crops, bed history, logging feeds and sprays |
| `large-beds-and-ruler` | A 100 m bed never freezes the app (plants counted, drawn as a pattern); size limits in the bed form; map zoom; the ruler |
| `lime-amounts` | Lime from a pH reading, sized to the bed section or pot, the same everywhere |
| `liquid-feed-doses` | A liquid feed with doses mixed into the can (e.g. 5 or 10 mL per 5 L) and how it's counted |
| `log-sprays-frost-alerts` | Logging sprays (days to wait before picking), frost jobs, weather alerts |
| `microclimate-and-learning` | Sun/shade/indoors changing estimates; learning from your own records |
| `modules-loaded` | Every module is loaded by the app itself (not just by the test bridge); drop-downs work without the bridge |
| `notes-bed-buttons-quick-add` | The note dialog (with photo), bed page buttons, Quick add |
| `offline-files` | Every file the app loads is on the service worker's offline list, and every file on it exists |
| `plant-size-in-drawing` | How big plants are drawn as they grow |
| `old-backups` | Backups made by older versions (1.3.3 onwards) restore with nothing lost, formats converted, every page working; each format change has a backup from before it |
| `planting-form-more-options` | The short planting form and its "More options" |
| `potato-harvest-dates` | Potato harvest dates for different planting dates |
| `potting-mix-fertiliser` | Fertiliser in fresh and re-used potting mix |
| `potting-mix-in-planting-form` | Choosing fresh or re-used mix when planting; defaults from the pot's history |
| `products-library` | Adding, editing, renaming and removing products; the catalogue; sprays without registry data |
| `quality-alerts-doctor-shopping` | Harvest-quality warnings, the problem finder, the shopping list |
| `realistic-garden-numbers` | A garden like a real one: products, nutrient counts, starting fertiliser, "fed until" |
| `recovery` | A garden that can't be loaded: recovery screen, nothing saved over it, keep a copy, restore a daily copy; no storage; undoing a restore; old formats kept |
| `release-versions` | The version is the same in `js/version.js`, `sw.js` and `releases.json`; the release notes are in order |
| `rotation-varieties-photos-picksafe` | Rotation plan, variety notes, photo timeline, "OK to pick?" board |
| `seed-library` | Products & seeds → Seeds & plants: varieties with packet photos, new crops, packets coming with a chosen variety |
| `season-plan-and-seed-packets` | The season plan's free spaces; re-using seed packets |
| `season-plan-speed` | The season plan opens quickly and fills in its ideas |
| `seasons-from-temperature` | Watering spacing, clear-by dates, sprouting times worked out from temperature |
| `seedling-tray-sowing-dates` | When to sow trays for a planting date, and where to keep them (outside / cover / indoors) |
| `soil-meter-readings` | Soil temperature, moisture, pH and salt readings and everything they change |
| `soil-readings-and-feeding` | Soil readings feeding into the feeding advice |
| `sowing-windows` | Sowing months worked out from temperature: matches the Japanese chart for Tokyo; other climates |
| `split-bed-sections` | Splitting a bed into sections for several crops |
| `spray-days` | Good spraying days from the forecast |
| `spray-mixing-and-legality` | Spray dilution helper and the registered-crop legality check |
| `spray-registry-table` | What the pesticide registry allows for each crop |
| `spring-cabbage-plan` | Saving a feeding plan for overwintering cabbage |
| `storage-note-by-device` | The storage-safety note on different phones |
| `test-site` | The test site (`/test/`) has its own garden, settings and offline copy, no Drive backup, and copies the real garden without changing it |
| `thinning-done-date` | Ticking off thinning, and the date it was done |
| `thinning-sizes` | Plant sizes around thinning |
| `tools-tabs` | Tools page tiles and the tabs between related pages |
| `tray-seedlings-to-planting` | Seedlings in trays through to planting out |
| `tray-sizes-and-bag-preset` | Seed tray / small pot sizes; the grow-bag preset |
| `updates` | "What's new" once after an update; the notice when a newer version is out; Tools → What's new |
| `warm-crops-cool-summers` | Warm-season crops in a cool-summer climate (e.g. London tomatoes) |
| `watering-all-crops` | Watering jobs for pots, each bed, indoor pots and seedlings; they follow the latest forecast when it changes |
| `watering-and-rain` | The watering job's timing from rain and your ticks |
| `watering-skip-frost-thin` | Skipping a watering, removing frost and thinning jobs |
| `weather-jobs-and-planning` | Weather-based jobs; planning a crop with tray-raised seedlings |
