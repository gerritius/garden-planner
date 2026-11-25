// Beds, pots and what's in them: looking things up, labels, free space, and when a crop occupies its space
// (including crops since moved to another part of the bed).

import { S } from '../core/state.js';
import { addDays, esc, shortDate, todayStr } from '../core/util.js';
import { FAMILIES } from '../data/catalog.js';
import { Draw } from '../draw.js';
import { crop, cropName } from '../plants/crops.js';
import { harvestWindow } from '../plants/growth.js';

// ---------- looking things up ----------
export const container = id => S.containers.find(c => c.id === id);
export const planting = id => S.plantings.find(p => p.id === id);
export const activeIn = cid => S.plantings.filter(p => p.containerId === cid && isLive(p)).sort((a, b) => a.from - b.from);
export const typeLabel = c => c.type === 'bed' ? 'Bed' : c.type === 'round' ? 'Round pot' : 'Rectangular pot';
export const sizeLabel = c => c.type === 'round' ? `⌀${c.diameter} × ${c.depth || '?'} cm deep` :
  c.type === 'bed' ? `${c.width} × ${c.length} cm` : `${c.width} × ${c.length} × ${c.depth || '?'} cm`;
// Sizes the app is made for: a bed up to 50 m on each side, a pot up to 3 m across. Returns what's wrong, or ''.
export const SIZE_MAX = { bed: 5000, pot: 300, depth: 200 };
export function sizeProblem(c) {
  const { W, L } = Draw.dims(c), big = Math.max(W, L), small = Math.min(W, L), m = +c.margin || 0;
  if (c.type === 'bed' && big > SIZE_MAX.bed) return `A bed can be up to ${SIZE_MAX.bed / 100} m (${SIZE_MAX.bed} cm) on each side. For a bigger area, add it as several beds.`;
  if (c.type !== 'bed' && big > SIZE_MAX.pot) return `A pot can be up to ${SIZE_MAX.pot / 100} m (${SIZE_MAX.pot} cm) across. For anything bigger, choose Bed.`;
  if (c.type !== 'bed' && +c.depth > SIZE_MAX.depth) return `A pot can be up to ${SIZE_MAX.depth} cm deep.`;
  if (m < 0) return 'The margin from the edges can’t be less than 0.';
  if (m * 2 >= small) return `A ${m} cm margin from each edge leaves no room to plant — make it less than ${Math.floor(small / 2)} cm.`;
  return '';
}
export function decorate(list) { return list.map(p => Object.assign({}, p, { _color: crop(p.cropId).color, _label: crop(p.cropId).en })); }
export function gaps(c, excludeId) {
  const L = Draw.dims(c).L, out = [];
  let y = 0;
  for (const p of activeIn(c.id).filter(p => p.id !== excludeId)) { if (p.from - y >= 1) out.push([y, p.from]); y = Math.max(y, p.to); }
  if (L - y >= 1) out.push([y, L]);
  return out;
}
export function prevCrop(c, from, to) {
  const h = (c.history || []).filter(x => x.from < to - 0.5 && x.to > from + 0.5).sort((x, y) => ((x.harvestedOn || '') < (y.harvestedOn || '') ? -1 : 1));
  return h.length ? h[h.length - 1] : null;
}

export const isLive = p => p.status !== 'harvested' && p.status !== 'planned';
export const isPlanned = p => p.status === 'planned';

// ---------- when a crop occupies its space ----------
export function endOf(p) {
  if (p.status === 'harvested') return p.harvestedOn || p.harvestDate || p.sowDate;
  const w = p.harvestDate ? harvestWindow(p) : null;
  let e = w ? (w.cont ? w.keep : (addDays(w.mature, 14) < w.keep ? addDays(w.mature, 14) : w.keep)) : addDays(p.sowDate || todayStr(), 120);
  if (isLive(p) && e < todayStr()) e = todayStr();
  return e;
}
export const sectionOf = p => { const c = container(p.containerId); return c && (c.type === 'bed' || p.from > 0 || p.to < Draw.dims(c).L) ? `${p.from}–${p.to} cm` : ''; };
// plantings (growing or planned) that share this space at some point in [d1, d2]
export function occupants(cid, from, to, d1, d2, excludeId) {
  return S.plantings.filter(p => p.containerId === cid && p.id !== excludeId && (isLive(p) || isPlanned(p)) && p.from < to - 0.5 && p.to > from + 0.5 &&
    (p.sowDate || todayStr()) <= d2 && endOf(p) >= d1);
}
// previous crop in this space before a planned date — includes crops still growing or planned
export function planRotation(c, from, to, cropId, date, excludeId) {
  const cands = [];
  for (const h of c.history || []) if (h.plantingId !== excludeId && h.from < to - 0.5 && h.to > from + 0.5 && (h.harvestedOn || '') <= date) cands.push({ cropId: h.cropId, end: h.harvestedOn || '' });
  for (const p of S.plantings) if (p.containerId === c.id && p.id !== excludeId && (isLive(p) || isPlanned(p)) && p.from < to - 0.5 && p.to > from + 0.5 && (p.sowDate || '') < date) cands.push({ cropId: p.cropId, end: endOf(p), p });
  if (!cands.length) return null;
  const prev = cands.sort((a, b) => (a.end < b.end ? -1 : 1)).pop(), a = crop(prev.cropId), b = cropId ? crop(cropId) : null;
  const same = !!(b && a.family && a.family !== 'other' && a.family === b.family), fam = same ? FAMILIES[a.family] : null;
  return { prev, same, html: same ? `<b>Same family as the crop before it.</b> ${esc(a.en)} ${prev.p ? `will be here until about ${shortDate(prev.end)}` : `was here (${shortDate(prev.end)})`} — both are ${esc(fam[0])}. Consider a different spot or extra compost.`
    : `Follows ${esc(cropName(prev.cropId))}${prev.p ? ` (here until about ${shortDate(prev.end)})` : ''}.` };
}

// ---------- previous crops in the same space (including crops since moved within the bed) ----------
export function spanTraces(c) {
  return S.plantings.filter(p => p.containerId === c.id).flatMap(p => (p.prevSpans || []).map(s => ({ plantingId: p.id + ':' + s.until, cropId: p.cropId, from: s.from, to: s.to, sowDate: p.sowDate, harvestedOn: s.until, trace: true })));
}
export function noteVacated(p, oldFrom, oldTo) {
  if (oldFrom == null || oldTo == null || (p.from <= oldFrom && p.to >= oldTo)) return;
  const td = todayStr(), parts = [];
  if (oldFrom < p.from) parts.push([oldFrom, Math.min(oldTo, p.from)]);
  if (oldTo > p.to) parts.push([Math.max(oldFrom, p.to), oldTo]);
  for (const [a, b] of parts) if (b - a >= 1) (p.prevSpans = p.prevSpans || []).push({ from: a, to: b, until: td });
}
