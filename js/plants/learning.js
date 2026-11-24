// Learning from your records: how much faster or slower your crops are than the model, used to adjust the estimates.

import { dayTemp, growUnits, tempFor } from '../climate/climate.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, esc, shortDate } from '../core/util.js';
import { container } from '../garden/garden.js';
import { crop, ic } from './crops.js';
import { emergeDate, germAvg, germWindow, growParams, harvestModel, keptTemp, startEmerge } from './growth.js';
import { tpDays } from './seedlings.js';

export function ddBetween(from, to, id, tempFn) {
  const daily = S.weather && S.weather.daily, f = tempFn || (x => dayTemp(x, daily));
  let acc = 0; for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) acc += growUnits(id, f(d));
  return acc;
}
let _learn = null, _learnKey = '', _learnBusy = false;
// actual ÷ predicted, per crop and stage: germ (days), thin, out (plant-out), harvest (degree-days)
function learnSamples() {
  if (_learnBusy) return {};   // estimates used while learning are the plain model
  const key = JSON.stringify([S.plantings.map(p => [p.cropId, p.sowDate, p.germ && p.germ.date, p.thinDoneOn, (p.harvests || []).length, p.containerId]), (S.starts || []).map(s => [s.sowDate, (s.events || []).length, s.kept]),
    S.tasks.filter(t => t.kind === 'harvest' && t.done).length, Object.keys(S.tempHist || {}).length, S.containers.map(c => [c.sun, c.indoor])]);
  if (_learn && _learnKey === key) return _learn;
  _learnBusy = true;
  try { _learn = learnCompute(); _learnKey = key; } finally { _learnBusy = false; }
  return _learn;
}
function learnCompute() {
  const out = {}, add = (id, k, r, what) => { if (!(r > 0.2 && r < 5)) return; ((out[id] = out[id] || {})[k] = out[id][k] || []).push({ r, what }); };
  for (const p of S.plantings) {
    if (!p.sowDate) continue;
    const cr = crop(p.cropId), tf = tempFor(p.containerId, p), lbl = `${shortDate(p.sowDate)}${container(p.containerId) ? ' · ' + container(p.containerId).name : ''}`;
    if (p.method === 'seed' && p.germ && p.germ.date && p.germ.result !== 'none') {
      const gw = germWindow(Object.assign({}, p, { method: 'seed' }));
      if (gw) { const exp = daysBetween(p.sowDate, gw[0]) + daysBetween(gw[0], gw[1]) / 2, act = daysBetween(p.sowDate, p.germ.date); if (exp > 0) add(p.cropId, 'germ', act / exp, lbl); }
    }
    if (p.method === 'seed' && p.thinned && p.thinDoneOn && cr.daysThin) {
      const e = emergeDate(p).d, g = growParams(p.cropId), need = Math.max(5, cr.daysThin - germAvg(p.cropId)) * (g.tref - g.tb);
      add(p.cropId, 'thin', ddBetween(e, p.thinDoneOn, p.cropId, tf) / need, lbl);
    }
    const firstPick = [...(p.harvests || []).map(h => h.date), ...S.tasks.filter(t => t.plantingId === p.id && t.kind === 'harvest' && t.done).map(t => t.doneOn)].filter(Boolean).sort()[0];
    if (firstPick && cr.daysHarvest) { const h = harvestModel(p, true); if (h && h.need > 0) add(p.cropId, 'harvest', ddBetween(h.from, firstPick, p.cropId, tf) / h.need, lbl); }
  }
  for (const s of S.starts || []) {
    const outEv = (s.events || []).filter(e => e.type === 'out').map(e => e.date).sort()[0];
    if (!outEv || !tpDays(s.cropId)) continue;
    const g = growParams(s.cropId), need = Math.max(5, tpDays(s.cropId) - germAvg(s.cropId)) * (g.tref - g.tb), daily = S.weather && S.weather.daily;
    add(s.cropId, 'out', ddBetween(startEmerge(s), outEv, s.cropId, keptTemp(s) || (x => dayTemp(x, daily))) / need, `tray sown ${shortDate(s.sowDate)}`);
  }
  return out;
}
export function learnedFactor(id, kind) {
  const xs = ((learnSamples()[id] || {})[kind] || []).map(x => x.r).sort((a, b) => a - b);
  if (!xs.length) return 1;
  const med = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  return Math.max(0.6, Math.min(1.8, 1 + (med - 1) * xs.length / (xs.length + 2)));   // one record only nudges it
}
const KIND_EN = { germ: 'coming up', thin: 'thinning', out: 'plant-out', harvest: 'first harvest' };
export function learnedText(id, kind) {
  const n = ((learnSamples()[id] || {})[kind] || []).length, f = learnedFactor(id, kind);
  if (!n || Math.abs(f - 1) < 0.03) return '';
  return `${Math.round(Math.abs(f - 1) * 100)}% ${f > 1 ? 'slower' : 'faster'} than the model (${n} record${n > 1 ? 's' : ''})`;
}
export function learnSection() {
  const L = learnSamples(), rows = [];
  for (const id of Object.keys(L)) for (const k of Object.keys(L[id])) { const t = learnedText(id, k); if (t) rows.push(`<li>${ic(id)}<span class="grow"><b>${esc(crop(id).en)}</b> · ${KIND_EN[k]}<small>${t}</small></span></li>`); }
  return `<section><h3>Learned from your garden</h3>${rows.length ? `<ul class="plist">${rows.join('')}</ul>` : ''}
    <p class="hint">Each time you record germination, thinning, planting out or a first harvest, the app compares it with its estimate and adjusts future dates for that crop. One record only nudges it; several move it properly.${rows.length ? '' : ' Nothing to adjust yet.'}</p></section>`;
}
