// Plants in a planting: how many the space holds (the counter on the crop page), what thinning leaves, and picking a
// plant up on a drawing. The bed drawings are for planting: they show the ideal layout (rows and spacing, or plants
// placed by hand), and the number of plants growing is a count — the layout's, or once thinned the one you gave.

import { S } from '../core/state.js';
import { esc } from '../core/util.js';
import { Draw } from '../draw.js';

// n of these spots, spread evenly through them (the first and last included)
export function spreadPick(pts, n) {
  n = Math.max(0, Math.min(pts.length, Math.round(n)));
  if (n >= pts.length) return pts.map(q => q.slice());
  if (n === 1) return [pts[Math.floor((pts.length - 1) / 2)].slice()];
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.round(i * (pts.length - 1) / (n - 1))].slice());
  return out;
}
const r1 = q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10].concat(q[2] ? [q[2]] : []);
// fewer of your seedlings went in than the plan has room for: the layout holds just those, spread over its spots
export function plantedFewer(c, p, n) {
  let L; try { L = Draw.layout(c, p); } catch (e) { return; }
  if (L.many || L.drill || !(n > 0) || n >= L.pts.length) return;
  p.positions = spreadPick(L.pts, n).map(r1); p.layout = 'free';
}

// ---------- how many plants ----------
// the plants the layout holds — for a sowing not yet thinned, what thinning will leave
export function layoutCount(c, p) { try { return c ? Draw.count(c, p) : 0; } catch (e) { return 0; } }
// the plants growing: once thinned, the number you counted (if you gave one); otherwise what the layout holds
export const plantCount = (c, p) => p.thinned && +p.thinCount > 0 ? +p.thinCount : idealCount(c, p);
// how many the spacing allows: for a sowing to be thinned, what thinning to its distance leaves
export const idealCount = (c, p) => p.method === 'seed' && +p.thinSp > 0 && !p.thinned ? layoutCount(c, Object.assign({}, p, { thinned: true })) : layoutCount(c, p);
// the counter on the crop page: how many plants, and whether a count is more than the spacing allows
export function plantCounter(c, p) {
  const ideal = idealCount(c, p); if (!ideal) return '';
  const counted = p.thinned && +p.thinCount > 0 ? +p.thinCount : null, n = counted ?? ideal, over = counted != null && counted > ideal;
  const seed = p.method === 'seed' && +p.thinSp > 0;
  const what = counted != null ? 'counted after thinning' : seed && !p.thinned ? `once thinned to ${p.thinSp} cm` : seed ? `thinned to ${p.thinSp} cm` : 'the space holds';
  return `<div class="pcount${over ? ' over' : ''}"><b>${n.toLocaleString('en-AU')}</b><span>plant${n === 1 ? '' : 's'}<small>${esc(what)}</small></span>
    ${over ? `<p>The spacing allows about <b>${ideal}</b> here — ${counted - ideal} more than that. Check the thinning: plants this close compete for light, water and food.</p>` : counted != null && counted < ideal ? `<small class="muted">Room for about ${ideal}.</small>` : ''}</div>`;
}

// ---------- thinning ----------
// how thinning is recorded: 'count' (the number left, which you count), 'spacing' (the thinning distance works it out)
// or, until you choose, ask each time with both on offer
export const thinBy = () => S.thinBy === 'count' || S.thinBy === 'spacing' ? S.thinBy : '';
// the plants the thinning distance leaves, and the most you could keep (all those sown, at the sowing distance)
export function thinCounts(c, p) {
  const at = Object.assign({}, p, { thinned: true });
  const sown = Object.assign({}, p, { thinned: false, layout: p.layout === 'continuous' ? 'rows' : p.layout });
  let calc = 0, most = 0;
  try { calc = Draw.count(c, at); most = Math.max(calc, Draw.count(c, sown)); } catch (e) { /* (no drawing) */ }
  return { calc, most };
}
export const thinToCount = (p, n) => { p.thinCount = n; };
export const unthin = p => { delete p.thinCount; };

// ---------- picking a plant up on a drawing ----------
// the plant nearest the finger, within reach (px on screen) — dots are small, so a fingertip near one is enough
export function nearestPlant(svg, e, pts, reach = 28) {
  const m = svg.getScreenCTM(); if (!m) return -1;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(m.inverse()), k = reach / (m.a || 1);
  let best = -1, bd = Infinity;
  pts.forEach((p0, i) => { const d = Math.hypot(p0[0] - q.x, p0[1] - q.y); if (d < bd) { bd = d; best = i; } });
  return bd <= k ? best : -1;
}
