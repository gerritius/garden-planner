// Side-dressing stages: when (crop stages, not during winter dormancy, not right before harvest), what with (your
// products, their effect and how early they need to go on), and how much.

import { normalT } from '../climate/climate.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, shortDate, todayStr } from '../core/util.js';
import { container } from '../garden/garden.js';
import { crop, kin } from '../plants/crops.js';
import { growParams, harvestWindow, isWarmCrop } from '../plants/growth.js';
import { productByName } from '../products/library.js';
import { gN, leadText } from './nutrients.js';
import { BOLT_IF_BIG, FRUITING as FRUIT_EVERY, SIDE_STAGES } from '../data/catalog.js';

// usual side-dressing (追肥) stages. d: days after planting (or thinning for sown crops); f: fraction of the way to harvest;
// w: tied to this planting's own winter — 'start' (as it sets in), 'mid' (a third of the way through), 'restart' (growth picks up), off: days from there.
// w-stages only apply to plantings that actually go through a winter; last: the last feed (止め肥) — nothing after it.
// Each crop's stages are in its record (data/crops.js).
// how early a product needs to go on before plants can use it, and how fast it works
const LEAD = { kasei888: [0, 'fast — works within days'], bokashi: [7, 'fairly fast — about a week'], toshoAburakasu: [7, 'fairly fast — about a week'], chickenManure: [10, 'medium — 1–2 weeks'],
  aburakasu: [21, 'slow — 2–3 weeks, slower in cold soil'], neem: [14, 'slow — about 2 weeks'], woodAsh: [0, 'fast (potash only)'] };
export const leadOf = pr => { if (!pr) return [7, '']; const d = pr.lead != null ? pr.lead : (LEAD[pr.id] || [7])[0]; return [d, leadText(d)]; };
// growth restarts when the usual daily mean gets back above this
export const restartTemp = id => { const g = growParams(id); return g.plain ? 8 : g.warm ? Math.max(15, g.warm[0] + 7) : g.tb + 5; };   // hardy crops (garlic, onion, spinach…) keep growing slowly through winter
export function nextGrowing(id, d) { const thr = restartTemp(id); for (let i = 0; i < 200; i++) { if (normalT(addDays(d, i)) >= thr) return addDays(d, i); } return d; }
// Where this planting's season sits: does it go through a winter (growth stopped) before harvest?
// Overwintering crops are kept on the lean side going into winter (soft growth is frost-tender), and heading brassicas
// grown for spring (spring cabbage, overwintered broccoli/cauliflower) much more so: big plants in the cold bolt (トウ立ち)
// instead of heading. Their main feed is when growth restarts.
export const _season = {};
export function feedSeason(p) {
  if (!p || !p.sowDate) return null;
  const c = container(p.containerId); if (c && c.indoor) return null;
  const cr = crop(p.cropId), hv = p.harvestDate || addDays(p.sowDate, cr.daysHarvest || 60), k = [p.cropId, p.sowDate, hv].join('|');
  if (_season[k] !== undefined) return _season[k];
  // winter here = the usual daily mean below ~8 °C (15 °C for warm-season crops): growth all but stops
  const thr = isWarmCrop(p.cropId) ? 15 : 8;
  let ws = null; for (let d = p.sowDate; d < hv; d = addDays(d, 1)) if (normalT(d) < thr) { ws = d; break; }
  if (!ws) return (_season[k] = null);
  let we = ws; for (let i = 0; i < 200 && normalT(we) < thr; i++) we = addDays(we, 1);
  const bolt = BOLT_IF_BIG.includes(kin(p.cropId));
  // lean stretch: heading brassicas from ~5 weeks before winter, others the last 3 weeks before it
  return (_season[k] = { ws, we, bolt, leanFrom: addDays(ws, bolt ? -35 : -21), leanTo: ws, mainAt: we });
}
export const inLean = (se, d) => !!(se && d >= se.leanFrom && d < addDays(se.we, -7));
export const stageAnchor = (se, w) => w === 'start' ? se.ws : w === 'mid' ? addDays(se.ws, Math.round(daysBetween(se.ws, se.we) / 3)) : se.we;
// the day a dose put on `due` starts working (organic feeds take a while)
export const actsOn = (name, due) => addDays(due, leadOf(productByName(name || ''))[0] || 0);
export const leanWhy = (p, se) => se.bolt
  ? `an overwintering ${crop(p.cropId).en.toLowerCase()} is kept small going into the cold — a big plant bolts (トウ立ち) in spring instead of heading`
  : 'soft new growth going into winter is easily frost-damaged';
export function sideStages(p) {
  const td = todayStr(), cr = crop(p.cropId), hv = p.harvestDate || addDays(p.sowDate, cr.daysHarvest || 60), se = feedSeason(p), skipped = [];
  const start = p.method === 'seed' ? (p.thinDoneOn || p.thinDate || addDays(p.sowDate, 20)) : p.sowDate;
  let raw = [];
  if (FRUIT_EVERY.includes(kin(p.cropId))) { const keep = (harvestWindow(p) || {}).keep || addDays(hv, 60); for (let d = addDays(hv, -10), i = 1; d < keep && i <= 5; d = addDays(d, 18), i++) raw.push({ date: d, t: i === 1 ? 'as the first fruits swell' : 'every 2–3 weeks while picking' }); }
  else {
    let defs = (SIDE_STAGES[kin(p.cropId)] || []).filter(s => !s.w || se);   // winter-tied stages only when it goes through a winter
    if (!defs.length) defs = [{ d: 21, t: 'about 3 weeks in' }, { f: 0.6, t: 'mid-season' }];
    for (const s of defs) {
      const date = s.w ? addDays(stageAnchor(se, s.w), s.off || 0) : s.d != null ? addDays(start, s.d) : addDays(p.sowDate, Math.round(daysBetween(p.sowDate, hv) * s.f));
      raw.push({ date, t: s.t, w: s.w });
    }
  }
  if (se && !FRUIT_EVERY.includes(kin(p.cropId)) && se.we < addDays(hv, -14) && !raw.some(r => r.date && Math.abs(daysBetween(r.date, se.we)) <= 21))
    raw.push({ date: se.we, t: se.bolt ? 'as growth restarts — the main feed for spring heads' : 'as growth restarts in spring' });
  const out = [];
  for (const r of raw) {
    let { date, t } = r, why = '';
    const orig = date;
    if (!FRUIT_EVERY.includes(kin(p.cropId)) && orig > addDays(hv, -14)) continue;   // too close to harvest to help
    let light = false;
    if (date < td) {
      if (daysBetween(date, td) > 21) continue;
      // missed, and it's now the lean stretch before winter: for heading brassicas leave it out — the spring feed does the job
      if (se && se.bolt && inLean(se, td)) { skipped.push({ date: orig, t, why: `missed on ${shortDate(orig)}, and it’s now too close to winter: ${leanWhy(p, se)}. The main feed comes when growth restarts, around ${shortDate(se.we)}.` }); continue; }
      why = `was due around ${shortDate(date)} — still worth doing now`; date = td;
    }
    if (se && se.bolt && inLean(se, date)) { why = `moved from ${shortDate(date)}: ${leanWhy(p, se)} — so it waits for spring`; date = se.we; }
    else if (se && date >= se.leanFrom && date < se.ws) { light = true; why = (why ? why + '; ' : '') + `kept light: ${leanWhy(p, se)}`; }
    const g = r.w ? date : nextGrowing(p.cropId, date);
    if (g > date) { why = `moved from ${shortDate(date)}: too cold for roots to take feed up — growth restarts around ${shortDate(g)}${g > addDays(hv, -14) ? ` (after your harvest estimate of ${shortDate(hv)} — over winter the heads mostly wait for spring, so this still counts)` : ''}`; date = g; }
    const dup = out.find(o => Math.abs(daysBetween(o.date, date)) < 14); if (dup) { if (!dup.t.includes(t)) dup.t += ' / ' + t; continue; }
    out.push({ date, t, why, light });
  }
  out.skipped = skipped; out.season = se;
  return out;
}
export const isPlenty = id => { const p = (S.products || []).find(x => x.id === id); return p ? !!p.plenty : (S.plenty || []).includes(id); };
// N-P-K bars with what's already counted, planned, and what this plan would add
export function previewBars(L, add) {
  const row = (k, l, have, plan, extra, need) => { if (!need) return ''; const pc = x => Math.min(100, x / need * 100);
    return `<div class="npkrow"><span class="nl">${l}</span><div class="fbar"><i class="have${k === 'n' ? '' : ' ' + k}" style="width:${pc(have)}%"></i><i class="plan" style="left:${pc(have)}%;width:${Math.max(0, pc(have + plan) - pc(have))}%"></i><i class="add" style="left:${pc(have + plan)}%;width:${Math.max(0, pc(have + plan + extra) - pc(have + plan))}%"></i></div><span class="nv">${gN(have + plan + extra)} / ${gN(need)}${extra ? ` <b>+${gN(extra)}</b>` : ''}</span></div>`; };
  return `<div class="npk">${row('n', 'N', L.total, L.plannedN, add.n, L.need)}${row('p', 'P', L.totalP, L.plannedP, add.p, L.needP)}${row('k', 'K', L.totalK, L.plannedK, add.k, L.needK)}</div>
    <p class="hint">Solid: counted so far · striped: jobs already planned · bright: this plan.</p>`;
}
export { SIDE_STAGES };   // (from the crop records)
