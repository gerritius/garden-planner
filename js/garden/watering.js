// Watering pots and bags: spacing from the temperature, rain and your ticks; drainage; DRY meter readings in beds.

import { normalT } from '../climate/climate.js';
import { dayName, Weather } from '../climate/weather.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, iso, todayStr, uid } from '../core/util.js';
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
export const waterPots = () => S.containers.filter(c => c.type !== 'bed' && c.type !== 'nursery' && !c.indoor && activeIn(c.id).length);
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
export function syncWater() {
  const on = !S.water || S.water.on !== false;
  const pots = waterPots();
  let open = S.tasks.find(t => t.kind === 'water' && !t.done);
  const td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.kind === 'water' && t.done && daysBetween(t.doneOn, td) > 21));
  if (!on || !pots.length) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  const w = waterPlan(pots);
  let due = w.due, note = '';
  const skipTo = S.water && S.water.skipTo;
  if (skipTo && skipTo > due) { due = skipTo; note = ' · skipped'; }
  else if (due > w.noRain && w.rainy.length) note = ` · rain counts: ${w.rainy.map(([d, mm]) => `${dayName(d)} ${Math.round(mm)} mm`).join(', ')}`;
  else if (w.held.length) note = ' · held off: rain due the next day';
  const mt = bagMoistureToday(pots);
  if (mt.dry) { due = td; note = ` · meter: ${mt.dry} pot${mt.dry > 1 ? 's' : ''} DRY today`; }
  else if (mt.any && mt.wet === mt.any && mt.all && due <= td) { due = addDays(td, 1); note = ' · meter says still wet'; }
  // liquid feeds for the bags ride along with the watering: a feed day is a watering day
  const ef = earliestWaterFeed();
  if (ef) { const d = ef < td ? td : ef; if (d < due) { due = d; note = ' · liquid feed due'; } }
  const feeds = waterFeedsDue(due < td ? td : due);
  if (!open) { open = { id: uid(), kind: 'water', plantingId: null, title: 'Water pots & bags', due, done: false }; S.tasks.push(open); }
  open.due = due; open.feeds = feeds.map(t => t.id);
  open.title = feeds.length ? `Water + liquid feed: ${[...new Set(feeds.map(t => (container((planting(t.plantingId) || {}).containerId) || {}).name))].join(', ')}` : 'Water pots & bags';
  open.note = `${pots.length} pot${pots.length > 1 ? 's' : ''} · every ${w.iv === 1 ? 'day' : w.iv + ' days'} this time of year${note}`;
}

// ---------- beds: a DRY reading becomes a watering job (unless good rain is due) ----------
export function syncMeterJobs() {
  const td = todayStr(), rain = rainByDay();
  const rainSoon = (rain[td] || 0) + (rain[addDays(td, 1)] || 0) >= 5;
  for (const c of S.containers) {
    if (c.type !== 'bed' || c.indoor) continue;
    const r = (c.soil || []).filter(x => x.date === td && x.moistLvl).pop();
    const open = S.tasks.find(t => t.meterWater && t.containerId === c.id && !t.done);
    const want = r && /^DRY/.test(r.moistLvl) && !rainSoon;
    if (want && !open) S.tasks.push({ id: uid(), kind: 'bed', containerId: c.id, plantingId: null, title: `Water ${c.name} — meter reads ${r.moistLvl}`, due: td, done: false, meterWater: true });
    else if (!want && open && open.due <= td) S.tasks = S.tasks.filter(t => t !== open);   // rain coming, or a newer reading says it's fine
  }
}
