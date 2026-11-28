// The plants really in the ground, next to the planned layout. A planting's layout (rows, spacing, or plants placed by
// hand) is the plan; once some come out — harvested whole, thinned to a number you counted, fewer seedlings than the
// plan had room for — the planting keeps where the rest are (p.real), and the drawings show those. The plan can still
// be shown instead (S.mapView 'plan'). Choosing plants on a drawing (to take out) and how thinning is recorded are here too.

import { A, render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { Draw } from '../draw.js';
import { ui } from '../data/ui-icons.js';

// can single plants of this planting be shown and taken out? (not a drill before thinning, nor a bed of thousands)
export function canMap(c, p) {
  if (!c) return false;
  try { const L = Draw.layout(c, p, true); return !L.many && !L.drill && L.pts.length <= Draw.MAX_ARRANGE; } catch (e) { return false; }
}
export const plantsHere = (c, p) => Draw.layout(c, p, true).pts;
export const hasReal = p => Array.isArray(p.real);
// n of these spots, spread evenly through them (the first and last included)
export function spreadPick(pts, n) {
  n = Math.max(0, Math.min(pts.length, Math.round(n)));
  if (n >= pts.length) return pts.map(q => q.slice());
  if (n === 1) return [pts[Math.floor((pts.length - 1) / 2)].slice()];
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.round(i * (pts.length - 1) / (n - 1))].slice());
  return out;
}
const near = (a, b) => Math.abs(a[0] - b[0]) < 0.06 && Math.abs(a[1] - b[1]) < 0.06;
// the plants really there are the plan again (none out, none moved): nothing to keep apart
function tidy(c, p) {
  if (!hasReal(p)) return;
  let plan; try { plan = Draw.layout(c, Object.assign({}, p, { real: null })).pts; } catch (e) { return; }
  if (plan.length === p.real.length && plan.every(q => p.real.some(r => near(q, r) && (r[2] || '') === (q[2] || '')))) delete p.real;
}
const r1 = q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10].concat(q[2] ? [q[2]] : []);
// take plants (by their number in the drawing) out of the ground; returns them, to put back if that's undone
export function takeOut(c, p, idx) {
  const pts = plantsHere(c, p), out = new Set(idx);
  const gone = pts.filter((q, i) => out.has(i)).map(r1);
  if (!gone.length) return [];
  p.real = pts.filter((q, i) => !out.has(i)).map(r1);
  return gone;
}
export function putBack(c, p, pts) {
  if (!hasReal(p) || !(pts || []).length) return;
  p.real = p.real.concat(pts.map(q => q.slice())); tidy(c, p);
}
// the plants that would come out first, if you don't choose: spread through the planting, so the drawing stays even
export function firstOut(c, p, k) {
  const pts = plantsHere(c, p); if (k <= 0) return [];
  const keep = new Set(spreadPick(pts.map((q, i) => [q[0], q[1], i]), pts.length - k).map(q => q[2]));
  return pts.map((q, i) => i).filter(i => !keep.has(i)).slice(0, k);
}
// fewer of your seedlings went in than the plan has room for: the ones in the ground, spread over the planned spots
export function plantedFewer(c, p, n) {
  if (!canMap(c, p)) return;
  const plan = Draw.layout(c, Object.assign({}, p, { real: null })).pts;
  if (n > 0 && n < plan.length) p.real = spreadPick(plan, n).map(r1); else delete p.real;
}

// ---------- thinning to a number you counted ----------
// how thinning is recorded: 'count' (the number left, which you count), 'spacing' (the thinning distance works it out)
// or, until you choose, ask each time with both on offer
export const thinBy = () => S.thinBy === 'count' || S.thinBy === 'spacing' ? S.thinBy : '';
// the plants the thinning distance leaves, and the most you could keep (all those sown, at the sowing distance)
export function thinCounts(c, p) {
  const at = Object.assign({}, p, { thinned: true, real: null });
  const sown = Object.assign({}, p, { thinned: false, real: null, layout: p.layout === 'continuous' ? 'rows' : p.layout });
  let calc = 0, most = 0;
  try { calc = Draw.count(c, at); most = Math.max(calc, Draw.count(c, sown)); } catch (e) { /* (no drawing) */ }
  return { calc, most };
}
// after thinning: the n plants left — fewer than the thinning distance would leave are spread over its spots; more are
// spread over the sowing spots (closer together)
export function thinToCount(c, p, n) {
  const was = hasReal(p) ? p.real.map(q => q.slice()) : null;
  p.thinPrev = was; p.thinCount = n;
  const at = Object.assign({}, p, { thinned: true, real: null });
  let plan; try { plan = Draw.layout(c, at); } catch (e) { return; }
  if (plan.many || plan.drill) return;
  if (n === plan.pts.length) { delete p.real; return; }
  if (n < plan.pts.length) { p.real = spreadPick(plan.pts, n).map(r1); return; }
  const sown = Draw.layout(c, Object.assign({}, p, { thinned: false, real: null, layout: p.layout === 'continuous' ? 'rows' : p.layout })).pts;
  p.real = spreadPick(sown.length >= n ? sown : plan.pts, n).map(r1);
}
export function unthin(c, p) {
  if ('thinPrev' in p) { if (p.thinPrev) p.real = p.thinPrev; else delete p.real; }
  delete p.thinPrev; delete p.thinCount;
}

// ---------- the drawings: real plants or the plan ----------
// the switch, where it makes a difference (a planting drawn here has plants out, or fewer than planned)
export function mapViewBtn(list) {
  if (!list.some(hasReal)) return '';
  A.mapView = async () => { S.mapView = S.mapView === 'plan' ? 'real' : 'plan'; await save(); render(); };
  const plan = S.mapView === 'plan';
  return `<button type="button" class="plotsz mapview" data-act="mapView" aria-pressed="${plan}">${ui(plan ? 'grid' : 'sprout', 16)}${plan ? 'Showing the plan' : 'Showing what’s there'}</button>`;
}
// "8 plants (10 in the plan)"
export function plantCountText(c, p) {
  let now = 0, plan = 0; try { now = Draw.count(c, p, true); plan = Draw.count(c, p); } catch (e) { return ''; }
  return `${now.toLocaleString('en-AU')} plant${now === 1 ? '' : 's'}${hasReal(p) && plan !== now ? ` <small class="muted">(${plan.toLocaleString('en-AU')} in the plan)</small>` : ''}`;
}

// ---------- choosing plants on a drawing ----------
// a drawing of the bed in box `el` where tapping a plant of planting p marks it; returns { sel (a Set of plant numbers:
// replace it and call draw() to change the marks), draw }. onChange after each tap.
export function plantPicker(el, c, p, others, onChange) {
  const { W, L } = Draw.dims(c), vw = Math.min(window.innerWidth, 640) - 64, px = Math.min(vw / W, 220 / L);
  const st = { sel: new Set() };
  st.draw = () => { el.innerHTML = Draw.svg(c, [...others, p], { px, highlight: p.id, pick: { id: p.id, sel: st.sel } }); };
  el.addEventListener('click', e => {
    const svg = el.querySelector('svg'); if (!svg) return;
    const i = nearestPlant(svg, e, plantsHere(c, p)); if (i < 0) return;
    if (st.sel.has(i)) st.sel.delete(i); else st.sel.add(i);
    st.draw(); onChange && onChange();
  });
  st.draw();
  return st;
}
// the plant nearest the finger, within reach (px on screen) — dots are small, so a fingertip near one is enough
export function nearestPlant(svg, e, pts, reach = 28) {
  const m = svg.getScreenCTM(); if (!m) return -1;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(m.inverse()), k = reach / (m.a || 1);
  let best = -1, bd = Infinity;
  pts.forEach((p0, i) => { const d = Math.hypot(p0[0] - q.x, p0[1] - q.y); if (d < bd) { bd = d; best = i; } });
  return bd <= k ? best : -1;
}
