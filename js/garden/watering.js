// Watering: one job each for pots & bags outside, every bed in the ground, indoor pots, and seedlings — spaced by the
// temperature, the rain (observed and the latest forecast) and when you last watered; DRY meter readings in beds.

import { dayTemp, normalRain, normalT } from '../climate/climate.js';
import { dayName, Weather } from '../climate/weather.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, iso, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { dryingOff } from '../plants/growth.js';
import { startsGrowing } from '../plants/seedlings.js';
import { earliestWaterFeed, waterFeedsDue } from '../feeding/plans.js';
import { activeIn, container, planting } from './garden.js';
import { bagMoistureToday } from './soil.js';

// ---------- watering (pots & bags) ----------
export function waterInterval(d = new Date()) {
  const t = normalT(iso(d));   // usual daily mean here: hotter → pots dry faster
  let iv = t >= 21 ? 1 : t >= 17 ? 2 : t >= 11.5 ? 3 : t >= 8 ? 4 : 5;
  const today = Weather.days()[0];
  if (today && today.max >= 30) iv = 1;
  return iv;
}
// rain per day in mm: observed history + this week's forecast (forecast days need ≥50% chance to count)
export function rainByDay() {
  const out = Object.assign({}, S.rainHist || {}), d = S.weather && S.weather.daily, td = todayStr();
  if (!d) return out;
  d.time.forEach((t, i) => { const mm = d.precipitation_sum[i] || 0, pop = (d.precipitation_probability_max || [])[i]; out[t] = t < td || pop == null || pop >= 50 ? mm : 0; });
  return out;
}
// beds and pots that want water: something growing in them that isn't drying off before harvest (potatoes, onions…)
export const thirsty = c => activeIn(c.id).some(p => !dryingOff(p));
export const waterPots = () => S.containers.filter(c => c.type !== 'bed' && c.type !== 'nursery' && !c.indoor && thirsty(c));
// a full watering = water per 40 L bag (default 4 L ≈ 10% of the pot), so rain fills a pot when mm ≥ that share of its depth
export function potWater(pots) {
  const perL = (S.water && +S.water.perBagL) || 4, frac = perL / 40;
  const depths = pots.map(c => +c.depth || 30), depth = depths.reduce((a, b) => a + b, 0) / (depths.length || 1);
  const sizes = {}; pots.forEach(c => { const k = c.type === 'round' ? c.diameter + '⌀' : c.width + '×' + c.length; sizes[k] = (sizes[k] || 0) + 1; });
  const rep = pots.find(c => (c.type === 'round' ? c.diameter + '⌀' : c.width + '×' + c.length) === Object.entries(sizes).sort((a, b) => b[1] - a[1])[0][0]) || pots[0];
  const area = rep.type === 'round' ? Math.PI * (rep.diameter / 200) ** 2 : (rep.width * rep.length) / 1e4;
  const vol = area * (+rep.depth || 30) * 10;   // litres
  return { fullMM: frac * depth * 10, perPot: frac * vol, area, rep };
}
// simulate how wet the pots are, day by day: watering fills them, rain tops them up, each day uses 1/interval of a watering
export function waterPlan(pots) {
  const td = todayStr(), iv = waterInterval(), use = 1 / iv, rain = rainByDay(), pw = potWater(pots);
  const last = S.water && S.water.lastDone;
  let d = last && daysBetween(last, td) <= 30 ? last : addDays(td, -1), b = last && d === last ? 1 : 0;
  const start = d, rainy = [], held = [];
  let due = null, skipped = false;
  for (let i = 0; i < 60 && !due; i++) {
    d = addDays(d, 1);
    const r = (rain[d] || 0) / pw.fullMM;
    b = Math.min(1, b - use + r);
    if ((rain[d] || 0) >= 2) rainy.push([d, rain[d]]);
    if (b > 0.001) { skipped = false; continue; }
    if (d < td) { b = 0; continue; }
    const rNext = (rain[addDays(d, 1)] || 0) / pw.fullMM;
    if (!skipped && rNext >= use) { b = 0; skipped = true; held.push(d); continue; }   // rain due tomorrow — don't water the day before
    due = d;
  }
  if (!due) due = addDays(td, 60);
  const noRain = addDays(start, last ? iv : 1) < td ? td : addDays(start, last ? iv : 1);
  return { due, iv, pw, rainy: rainy.filter(([x]) => x <= due), held, noRain, rain };
}
// ---------- watering groups ----------
// Each group has one watering job and remembers when it was last watered: 'pots' (outside), 'bed:<id>', 'indoor', 'seedlings'.
export const groupOf = t => t.group || 'pots';
export const lastWatered = g => S.water ? (g === 'pots' ? S.water.lastDone : (S.water.last || {})[g]) || null : null;
export function setLastWatered(g, d) {
  S.water = Object.assign({}, S.water);
  if (g === 'pots') S.water.lastDone = d; else S.water.last = Object.assign({}, S.water.last, { [g]: d });
}
const skippedTo = g => S.water ? (g === 'pots' ? S.water.skipTo : (S.water.skip || {})[g]) || null : null;
export function skipWatering(g, to) {
  S.water = Object.assign({}, S.water);
  if (g === 'pots') S.water.skipTo = to; else S.water.skip = Object.assign({}, S.water.skip, { [g]: to });
}
// the forecast is old (the app was offline): say so, so nobody trusts rain that may not come
function forecastAge() {
  const f = S.weather && S.weather.fetched; if (!f || Date.now() - f < 6 * 3600e3) return '';
  return ` · forecast from ${new Date(f).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
}
const rainNote = rainy => rainy.length ? ` · rain counts: ${rainy.map(([d, mm]) => `${dayName(d)} ${Math.round(mm)} mm`).join(', ')}${forecastAge()}` : '';
function openJob(g, fields) {
  let t = S.tasks.find(x => x.kind === 'water' && !x.done && groupOf(x) === g);
  if (!t) { t = Object.assign({ id: uid(), kind: 'water', plantingId: null, done: false }, g === 'pots' ? {} : { group: g }); S.tasks.push(t); }
  return Object.assign(t, fields);
}
const dropJob = g => { S.tasks = S.tasks.filter(x => !(x.kind === 'water' && !x.done && groupOf(x) === g)); };

export function syncWater() {
  const td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.kind === 'water' && t.done && daysBetween(t.doneOn, td) > 21));
  const on = !S.water || S.water.on !== false;
  syncPotsWater(on); syncBedsWater(on); syncIndoorWater(on); syncSeedlingWater(on);
}
// ---------- pots & bags outside ----------
function syncPotsWater(on) {
  const pots = waterPots(), td = todayStr();
  if (!on || !pots.length) return dropJob('pots');
  const w = waterPlan(pots);
  let due = w.due, note = '';
  const skipTo = skippedTo('pots');
  if (skipTo && skipTo > due) { due = skipTo; note = ' · skipped'; }
  else if (due > w.noRain && w.rainy.length) note = rainNote(w.rainy);
  else if (w.held.length) note = ' · held off: rain due the next day';
  const mt = bagMoistureToday(pots);
  if (mt.dry) { due = td; note = ` · meter: ${mt.dry} pot${mt.dry > 1 ? 's' : ''} DRY today`; }
  else if (mt.any && mt.wet === mt.any && mt.all && due <= td) { due = addDays(td, 1); note = ' · meter says still wet'; }
  // liquid feeds for the bags ride along with the watering: a feed day is a watering day
  const ef = earliestWaterFeed();
  if (ef) { const d = ef < td ? td : ef; if (d < due) { due = d; note = ' · liquid feed due'; } }
  const feeds = waterFeedsDue(due < td ? td : due);
  openJob('pots', {
    due, feeds: feeds.map(t => t.id),
    title: feeds.length ? `Water + liquid feed: ${[...new Set(feeds.map(t => (container((planting(t.plantingId) || {}).containerId) || {}).name))].join(', ')}` : 'Water pots & bags',
    note: `${pots.length} pot${pots.length > 1 ? 's' : ''} · every ${w.iv === 1 ? 'day' : w.iv + ' days'} this time of year${note}`,
  });
}

// ---------- beds in the ground ----------
// The ground holds far more water than a pot: about 25 mm the roots can use in ~30 cm of ordinary soil. Each day the
// soil loses some through the plants and the surface — more when it's warm — and rain puts it back. Watering is due
// when about half is used (12 mm); young plantings (first three weeks) only reach the top few cm, so sooner (6 mm).
const BED_STORE = 25;
export const bedLoss = d => Math.max(0.4, 0.17 * dayTemp(d, S.weather && S.weather.daily));   // mm a day
export const bedBeds = () => S.containers.filter(c => c.type === 'bed' && !c.indoor && thirsty(c));
export function bedPlan(c) {
  const td = todayStr(), rain = rainByDay(), g = 'bed:' + c.id;
  const mm = d => rain[d] != null ? rain[d] : d < td ? normalRain(d) : 0;   // past days we have no record of: usual rain; beyond the forecast: none
  const young = activeIn(c.id).some(p => p.sowDate && p.sowDate <= td && daysBetween(p.sowDate, td) < 21);
  const allow = young ? 6 : 12, last = lastWatered(g);
  let d = last && daysBetween(last, td) <= 45 ? last : addDays(td, -21), used = 0, due = null, held = false;
  const rainy = [];
  for (let i = 0; i < 120 && !due; i++) {
    d = addDays(d, 1);
    const r = mm(d); used = Math.min(BED_STORE, Math.max(0, used + bedLoss(d) - r));
    if (r >= 2 && d >= addDays(td, -3)) rainy.push([d, r]);
    if (used < allow || d < td) continue;   // still enough — or dry already before today: then it's due today
    if (!held && mm(addDays(d, 1)) >= used * 0.8) { held = true; continue; }   // a good soak due the next day: wait for it
    due = d;
  }
  const { W, L } = Draw.dims(c), m2 = (W * L) / 1e4;
  return { due, allow, young, rainy: rainy.filter(([x]) => !due || x <= due), every: Math.max(1, Math.round(allow / bedLoss(td))), litres: Math.round(allow * m2), m2 };
}
function syncBedsWater(on) {
  const td = todayStr(), beds = on ? bedBeds() : [];
  for (const t of S.tasks.filter(x => x.kind === 'water' && !x.done && groupOf(x).startsWith('bed:') && !beds.some(c => 'bed:' + c.id === groupOf(x)))) dropJob(groupOf(t));
  for (const c of beds) {
    const g = 'bed:' + c.id, w = bedPlan(c);
    let due = w.due, note = rainNote(w.rainy);
    const skipTo = skippedTo(g); if (skipTo && (!due || skipTo > due)) { due = skipTo; note = ' · skipped'; }
    const r = (c.soil || []).filter(x => x.date === td && x.moistLvl).pop();   // the meter beats the sums
    if (r && /^DRY/.test(r.moistLvl)) { due = td; note = ' · meter reads DRY'; }
    else if (r && /^WET/.test(r.moistLvl) && due && due <= td) { due = addDays(td, 1); note = ' · meter says still wet'; }
    if (!due || daysBetween(td, due) > 60) { dropJob(g); continue; }   // cool and wet: nothing to do for a long while
    openJob(g, {
      due, containerId: c.id, title: `Water ${c.name}`,
      note: `in the ground · about ${w.litres} L (${w.allow} L per m²) · every ~${w.every} day${w.every === 1 ? '' : 's'} without rain this time of year${w.young ? ', young plants' : ''}${note}`,
    });
  }
}

// ---------- indoor pots, and seedlings ----------
// Indoors no rain reaches them: every 3 days, every 2 in summer warmth.
function syncIndoorWater(on) {
  const cs = on ? S.containers.filter(c => c.indoor && thirsty(c)) : [];
  if (!cs.length) return dropJob('indoor');
  const td = todayStr(), iv = normalT(td) >= 24 ? 2 : 3, last = lastWatered('indoor');
  let due = last ? addDays(last, iv) : td, note = '';
  const skipTo = skippedTo('indoor'); if (skipTo && skipTo > due) { due = skipTo; note = ' · skipped'; }
  openJob('indoor', { due, title: 'Water indoor pots', note: `${cs.map(c => c.name).join(', ')} · every ${iv} days — no rain reaches them${note}` });
}
// Seedlings in trays and small pots dry out fast: every day, every other day when it's cool; rain counts for ones outside.
function syncSeedlingWater(on) {
  const ss = on ? startsGrowing() : [];
  if (!ss.length) return dropJob('seedlings');
  const td = todayStr(), iv = normalT(td) >= 12 ? 1 : 2, last = lastWatered('seedlings'), rain = rainByDay();
  let due = last ? addDays(last, iv) : td, note = '';
  if (ss.every(s => (s.kept || 'out') === 'out') && due <= td && (rain[td] || 0) >= 3) { due = addDays(td, 1); note = ` · rain today (${Math.round(rain[td])} mm)`; }
  const skipTo = skippedTo('seedlings'); if (skipTo && skipTo > due) { due = skipTo; note = ' · skipped'; }
  openJob('seedlings', { due, title: 'Water seedlings', note: `${ss.length} lot${ss.length > 1 ? 's' : ''} of seedlings · ${iv === 1 ? 'every day' : 'every other day'} this time of year${note}` });
}

// ---------- beds: a DRY reading becomes a watering job (unless good rain is due) ----------
export function syncMeterJobs() {
  const td = todayStr(), rain = rainByDay();
  const rainSoon = (rain[td] || 0) + (rain[addDays(td, 1)] || 0) >= 5;
  for (const c of S.containers) {
    if (c.type !== 'bed' || c.indoor) continue;
    const r = (c.soil || []).filter(x => x.date === td && x.moistLvl).pop();
    const open = S.tasks.find(t => t.meterWater && t.containerId === c.id && !t.done);
    const bedJob = S.tasks.some(t => t.kind === 'water' && !t.done && t.group === 'bed:' + c.id);   // the bed's own watering job already follows the meter
    const want = r && /^DRY/.test(r.moistLvl) && !rainSoon && !bedJob;
    if (want && !open) S.tasks.push({ id: uid(), kind: 'bed', containerId: c.id, plantingId: null, title: `Water ${c.name} — meter reads ${r.moistLvl}`, due: td, done: false, meterWater: true });
    else if (!want && open && (open.due <= td || bedJob)) S.tasks = S.tasks.filter(t => t !== open);   // rain coming, a newer reading says it's fine, or the bed job has it
  }
}
