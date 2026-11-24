// Sowing windows worked out from each crop's temperature needs: a month is a sowing/planting month if it's the right
// temperature to sow or plant, the crop can reach harvest in reasonable time, frost-tender crops finish before the cold,
// and heat-sensitive crops don't mature in the heat. Crops grown through winter are planted as it cools, if winters are
// mild enough. You can edit any crop's months. Also the sowing guide page.

import { A, render, sekki, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { addDays, esc, daysBetween } from '../core/util.js';
import { Draw } from '../draw.js';
import { gaps, sizeLabel } from '../garden/garden.js';
import { SOIL_T, soilBadge, soilTemps } from '../garden/soil.js';
import { allCrops, crop, cropName, ic, kin, myCrops } from '../plants/crops.js';
import { frostEnd, growParams, harvestModel, soonestHarvest } from '../plants/growth.js';
import { applyClimate, climateHere, climateNotice, firstFrostAfter, frostFree, growUnits, NORMAL_T, normalT, TOKYO_T } from './climate.js';
import { SOW_PROFILE } from '../data/catalog.js';

// ---------- sowing windows from temperature ----------
// per crop, where the general rules need a hand. heat: mean °C above which it bolts/spoils when maturing.
// rising / falling: sow or plant in that temperature range while it's warming / cooling (crops with set seasons).
// winter: grown through winter — planted as it cools within [low, high] °C if winters are mild (coldest month ≥ winterMin, else
// −2 °C; garlic takes hard winters under snow — winterCold: where the coldest month is below 0 °C, planted cooler, a few
// weeks before the ground freezes: Hokkaido's late September–October); spring: otherwise, as it warms.
// pick: days of picking after the first harvest that need frost-free weather (crops picked over a season).
// plant: [low, high] mean °C to sow / plant out, where the general rule doesn't fit. warmLo: when warming, wait for this much warmth (young plants
// that get cold bolt later, e.g. hakusai). Each crop's profile is in its record (data/crops.js).
const monthDays = (y, m) => [5, 15, 25].map(d => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
// days of growth to harvest, using the usual temperatures from a sowing date (null if it never gets there within a year)
// — the harvest estimate's own model (coming up first, then the packet's growth), so the months it offers and the dates it
// gives can't disagree
export function climGrow(cr, from) {
  const m = harvestModel({ cropId: cr.id, sowDate: from, method: cr.method === 'seed' ? 'seed' : 'seedling' }, true); if (!m) return null;
  let acc = 0, d = m.from;
  for (let i = 1; i <= 365; i++) { d = addDays(d, 1); acc += growUnits(cr.id, normalT(d)); if (acc >= m.need) { const e = soonestHarvest(m, d); return { days: daysBetween(from, e), end: e }; } }
  return null;
}
const meanT = (a, b) => { let s = 0, n = 0; for (let d = a; d <= b; d = addDays(d, 3)) { s += normalT(d); n++; } return n ? s / n : normalT(a); };
const minT = (a, b) => { let m = 99; for (let d = a; d <= b; d = addDays(d, 3)) m = Math.min(m, normalT(d)); return m; };
const coldDays = (a, b) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (normalT(d) < 8) n++; return n; };
const isWarming = d => normalT(addDays(d, 30)) > normalT(d);
// crops that bolt (or spoil) when they mature in the heat
export const boltsInHeat = id => !!(SOW_PROFILE[kin(id)] || {}).heat;
// Frost-tender (warm-season) crops by their own temperatures, not one figure for all: they need to keep growing — no
// spell below about 6 °C over the bottom of their growth curve (14 °C for tomatoes, corn and beans, 16 °C for eggplant,
// okra and melons) from when they're up until they're nearly done (dry beans ripen off in the cool) — and, planted as it cools, to crop (the last third of their growing) in weather warm
// enough to set and ripen (15–17 °C on average), like
// the picking season of crops picked over weeks. A fixed 12 °C let everything through where winters never go below it:
// tomatoes and corn sown all year in Sydney.
const tenderLo = id => { const g = growParams(id); return Math.max(12, (g.warm ? g.warm[0] : 8) + 6); };
const tenderGood = id => { const g = growParams(id); return Math.max(15, (g.warm ? g.warm[0] : 8) + 7); };
// Seasons set by the cold: crops planted to grow through winter as it cools (garlic, onions, peas) and crops planted as
// soon as spring warms (potatoes) have their temperatures for a winter that gets cold. Where the coldest month is milder
// than that, the band moves up to start from the coldest month — onions go in through May–June in Sydney and Nov–Dec
// in Okinawa, potatoes as Sydney starts warming in August.
// (never past a few degrees over the warmth it grows best in: no potatoes planted in Singapore's 26 °C)
const fromCold = (b, coldest, cap) => b && coldest > b[0] ? [coldest - 0.5, Math.min(cap, b[1] + (coldest - b[0]))] : b;
// does sowing / planting on this day work for this crop, in this climate?
export function sowDayOK(cr, d) {
  const pr = SOW_PROFILE[kin(cr.id)] || {}, T = normalT(d), warm = isWarming(d), coldest = Math.min(...NORMAL_T), hottest = Math.max(...NORMAL_T), cap = growParams(cr.id).tcap + 3;
  const tenderOK = (g, cooling) => !cr.tender || (minT(addDays(d, 20), addDays(g.end, -Math.round(g.days * 0.15))) >= tenderLo(cr.id) && minT(d, g.end) >= 12 && (!cooling || meanT(addDays(g.end, -Math.round(g.days * 0.3)), g.end) >= tenderGood(cr.id)));
  if (pr.winter) {   // grown through winter where winters are mild; sown in spring where they're hard (then it has to finish before the next winter)
    // (in the warm half of the year, as it really cools — not the flat top of a mild summer: January garlic in Sydney;
    // and it has to be ready within the year)
    if (coldest >= (pr.winterMin ?? -2)) {
      const w = coldest < 0 && pr.winterCold ? pr.winterCold : fromCold(pr.winter, coldest, cap);
      if (warm || T < w[0] || T > w[1] || (T > (coldest + hottest) / 2 && normalT(addDays(d, 30)) > T - 1)) return false;
      const g = climGrow(cr, d); return !!g && g.days <= 330;
    }
    if (!(pr.spring && warm && T >= pr.spring[0] && T <= pr.spring[1])) return false;
    const g = climGrow(cr, d); return !!g && g.days <= 240 && coldDays(d, g.end) <= 30;
  }
  if (pr.rising || pr.falling) {   // a set season — and then it still has to make it, like any other crop
    const rising = fromCold(pr.rising, coldest, cap);
    if (!((warm && rising && T >= rising[0] && T <= rising[1]) || (!warm && pr.falling && T >= pr.falling[0] && T <= pr.falling[1]))) return false;
    // planted as it warms, the cold is behind it; planted as it cools, it has to be done before the cold — except crops
    // dug when frost takes the tops (autumn potatoes), which only need the growing weeks before that
    if (warm) { const g = climGrow(cr, d); return !!g && g.days <= (cr.daysHarvest || 60) * 1.5 && !(cr.tender && normalT(g.end) < 12); }
    const fe = cr.frostEnd ? frostEnd({ cropId: cr.id, sowDate: d }) : null;
    if (fe) return daysBetween(d, fe) >= (cr.daysHarvest || 60) * 0.7;
    const g = climGrow(cr, d); if (!g || g.days > (cr.daysHarvest || 60) * 2) return false;
    if (cr.tender && minT(d, g.end) < 12) return false;
    return pr.hardy || coldDays(d, g.end) <= 20;
  }
  const seedT = SOIL_T[kin(cr.id)], seedling = cr.method !== 'seed';
  const lo = pr.plant ? pr.plant[0] : cr.tender ? (seedling ? 14 : (seedT ? seedT[0] : 14)) : Math.max(7, seedT && !seedling ? seedT[0] + 2 : 7);
  let hi = pr.plant ? pr.plant[1] : seedT && seedT[2] ? seedT[2] - 1 : cr.tender ? 29 : 26;
  // (where it never gets cool — the tropics — a warm-season crop's "not too late in summer" doesn't apply: there's no autumn)
  if (cr.tender && coldest >= 18) hi = Math.max(hi, seedT && seedT[2] ? seedT[2] - 1 : 32);
  if (warm && pr.warmLo && T < pr.warmLo) return false;
  if (T < lo || T > hi) return false;
  const g = climGrow(cr, d); if (!g || g.days > (cr.daysHarvest || 60) * 2) return false;              // too slow: it would crawl into winter
  if (!tenderOK(g, !warm)) return false;                                                             // frost-tender: warm enough all through
  if (cr.tender && (!frostFree(d) || (!pr.pick && firstFrostAfter(d) && g.end > firstFrostAfter(d)))) return false;   // …and between the frosts, where there are frost dates
  if (!cr.tender && !pr.hardy && !warm && coldDays(d, g.end) > 20) return false;                     // sown as it cools: should be ready before winter
  if (pr.heat && meanT(addDays(g.end, -Math.round(g.days * 0.3)), g.end) > pr.heat) return false;     // would mature in the heat: bolts / poor quality
  return pr.pick ? pickDays(g.end, pr.pick, cr.tender ? tenderGood(cr.id) : 12) : true;
}
// days of picking from the first harvest until it gets too cool for it to keep cropping, up to the crop's usual season
// (and the first frost ends it, where there are frost dates)
export const pickDays = (from, max, cool = 12) => { const ff = firstFrostAfter(from); let n = 0; for (let d = from; n < max && normalT(d) >= cool && (!ff || d < ff); d = addDays(d, 1)) n++; return n; };
export function sowWindow(cr) {
  const res = [];
  for (let m = 1; m <= 12; m++) res.push(monthDays(2026, m).map(d => sowDayOK(cr, d)));
  // crops picked over a season: the planting dates that give a good part of the longest picking season possible here
  const best = Math.max(0, ...res.flat().filter(v => typeof v === 'number'));
  const ok = v => v === true || (typeof v === 'number' && v >= Math.max(20, best * 0.6));
  // a month of the central-Japan chart counts if part of it works here; any other month only when most of it works (two
  // of its early, middle and late days) — not because of one good day at its edge (mid-August corn in Tokyo). (The chart
  // is only for weather like central Japan's: elsewhere — Sydney's July is no April — every month needs most of it.)
  const chart = NORMAL_T.every((t, i) => Math.abs(t - TOKYO_T[i]) <= 2.5) ? cr.sowRef || [] : [];
  const months = need => res.map((r, i) => r.filter(ok).length >= (chart.includes(i + 1) ? 1 : need) ? i + 1 : 0).filter(Boolean);
  // (a short season that straddles two months — tomatoes planted out late May to mid-June in London — still gets its months)
  const m2 = months(2); return m2.length ? m2 : months(1);
}
// every crop's months: yours if you've set them, otherwise worked out (the original chart is kept as sowRef)
const SOW_RULES_VER = 4;   // bump when the rules change, so stored windows are worked out again
export function applySowWindows() {
  const crops = allCrops(), key = [SOW_RULES_VER, NORMAL_T.join(','), JSON.stringify((climateHere() || {}).frost || null), crops.map(c => c.id + ':' + (c.like || '') + ':' + (c.daysHarvest || 0)).join(',')].join('|');
  const cache = S.sowCache && S.sowCache.key === key ? S.sowCache.m : null, worked = {};
  for (const c of crops) {
    if (c.sowRef === undefined) c.sowRef = (c.sow || []).slice();
    worked[c.id] = cache && cache[c.id] ? cache[c.id] : c.daysHarvest ? sowWindow(c) : c.sowRef.slice();
    const own = (S.sowOverride || {})[c.id];
    c.sow = own ? own.slice() : worked[c.id].slice();
    c.sowOwn = !!own;
  }
  if (!cache) S.sowCache = { key, m: worked };   // kept with your data so it isn't worked out again every time the app opens
}

// ---------- the sowing calendar page ----------
// sowing calendar: worked out for your climate, every crop's months editable
export function pageSow(q) {
  setChrome('Sowing calendar', { back: true, kicker: climateHere() ? `For ${climateHere().name || 'your location'}` : 'Western Tokyo (built-in climate)', sub: sekki() });
  const m = new Date().getMonth() + 1;
  const chosen = Array.isArray(S.myCrops), all = !chosen || (q && q.get('all') === '1');   // your crops, or all of them
  const list = (all ? allCrops() : myCrops()).filter(c => c.daysHarvest || (c.sow || []).length).slice().sort((a, b) => a.en.localeCompare(b.en));
  A.sowCrop = el => sowPick(el.dataset.id);
  A.sowEdit = el => sowMonthsDialog(crop(el.dataset.id));
  const st = soilTemps();
  const html = `<p class="hint">Months to sow or plant out, worked out from each crop’s temperature needs and the usual weather ${climateHere() ? `in ${esc(climateHere().name || 'your area')}` : 'in western Tokyo'}. ✎ marks months you’ve set yourself — tap ✎ on any crop to change them. Tap a crop to plant it.${st ? ` Soil this week ~${Math.round(st.week ?? st.now)}° at 6 cm: ✓ good for sowing · ◐ slow · ❄ too cold.` : ''}</p>
    <div class="sowtable"><div class="sowrow head"><span></span>${MONTHS.map((x, i) => `<i class="${i + 1 === m ? 'now' : ''}">${x[0]}</i>`).join('')}<b></b></div>
    ${list.map(c => `<div class="sowrow"><span data-act="sowCrop" data-id="${c.id}">${ic(c.id, 20)}${esc(c.en)}${c.method === 'seed' ? soilBadge(c.id) : ''}</span>${MONTHS.map((x, i) => `<i data-act="sowCrop" data-id="${c.id}" class="${(c.sow || []).includes(i + 1) ? 'on' : ''}${i + 1 === m ? ' now' : ''}"></i>`).join('')}<button type="button" class="link sowed${c.sowOwn ? ' own' : ''}" data-act="sowEdit" data-id="${c.id}" aria-label="Change months">✎</button></div>`).join('')}
    </div>${chosen ? `<p class="hint center">${all ? `Showing every crop. <a href="#/sow" onclick="location.replace(this.href);return false;">Just my crops</a>` : `Your crops. <a href="#/sow?all=1" onclick="location.replace(this.href);return false;">Show all crops</a> · <a href="#/mycrops">Change my crops</a>`}</p>` : ''}${climateNotice()}`;
  return { html };
}
function sowMonthsDialog(cr) {
  const own = (S.sowOverride || {})[cr.id], auto = c => c.daysHarvest ? sowWindow(c) : (c.sowRef || []);
  let sel = new Set(cr.sow || []);
  modal('<div></div>', (m, close) => {
    const draw = () => {
      m.querySelector('.sheet').innerHTML = `<h3>${ic(cr.id, 22)} ${esc(cr.en)} — months</h3>
        <p class="small muted">Tap the months you sow or plant it out. ${own ? 'You’ve set these yourself.' : 'These are worked out for your climate.'}</p>
        <div class="monthgrid">${MONTHS.map((x, i) => `<button type="button" class="chip${sel.has(i + 1) ? ' on' : ''}" data-mo="${i + 1}">${x}</button>`).join('')}</div>
        <p class="hint">Worked out: ${auto(cr).map(i => MONTHS[i - 1]).join(', ') || 'none — too cold or too hot here outdoors'}.</p>
        <div class="btns">${own ? '<button type="button" class="btn" data-x="reset">Use worked-out months</button>' : '<button type="button" class="btn" data-x="no">Cancel</button>'}<button type="button" class="btn primary" data-x="ok">Save</button></div>`;
      m.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => { const v = +b.dataset.mo; sel.has(v) ? sel.delete(v) : sel.add(v); draw(); });
      const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
      const rs = m.querySelector('[data-x=reset]'); if (rs) rs.onclick = async () => { delete S.sowOverride[cr.id]; applyClimate(); await save(); close(); render(); };
      m.querySelector('[data-x=ok]').onclick = async () => { const v = [...sel].sort((a, b) => a - b), a = auto(cr);
        S.sowOverride = S.sowOverride || {}; if (v.join() === a.join()) delete S.sowOverride[cr.id]; else S.sowOverride[cr.id] = v;
        applyClimate(); await save(); close(); render(); };
    };
    draw();
  });
}

// ---------- what to sow now ----------
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function sowNowSection() {
  const m = new Date().getMonth() + 1;
  const list = myCrops().filter(c => (c.sow || []).includes(m));
  const mn = new Date().toLocaleDateString('en-GB', { month: 'long' });
  return `<section><h3>Sow &amp; plant in ${mn}</h3>
    ${list.length ? `<div class="sowchips">${list.map(c => `<button class="chip big" data-act="sowCrop" data-id="${c.id}">${ic(c.id, 26)}${esc(c.en)}${c.method === 'seed' ? soilBadge(c.id) : ''}</button>`).join('')}</div>` : '<p class="muted">Nothing in the catalogue for this month.</p>'}
    <a class="more" href="#/sow">Full sowing calendar →</a></section>`;
}
export function sowPick(id) {
  const opts = S.containers.filter(c => gaps(c).length);
  const free = c => { const g = gaps(c), L = Draw.dims(c).L; return g.length === 1 && g[0][0] === 0 && g[0][1] >= L ? 'empty' : g.map(x => `${x[0]}–${x[1]} cm`).join(', ') + ' free'; };
  modal(`<h3>Plant ${esc(cropName(id))} in…</h3>
    ${opts.length ? `<ul class="plist">${opts.map(c => `<li><a href="#/plant/new/${c.id}?crop=${id}" data-x="go"><span class="grow"><b>${esc(c.name)}</b><small>${sizeLabel(c)} · ${free(c)}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted">No free space — harvest something or add a bed or pot first.</p>'}
    <div class="btns"><button class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelectorAll('[data-x=go]').forEach(a => a.onclick = () => close());
    m.querySelector('[data-x=no]').onclick = close;
  });
}
