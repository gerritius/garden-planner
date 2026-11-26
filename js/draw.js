// Top-down drawing of beds and pots. Coordinates are in cm.

import { todayStr } from './core/util.js';
import { activeIn, decorate, gaps, prevCrop } from './garden/garden.js';
import { activeCovers } from './plants/covers.js';
import { crop, icBody } from './plants/crops.js';

// Top-down drawing of beds and pots. Coordinates are in cm.
// x = across the short side (width), y = down the long side (length). Long side is drawn vertically.
export const Draw = (() => {
  const DAY = 864e5;
  const pd = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function dims(c) {
    return c.type === 'round' ? { W: +c.diameter, L: +c.diameter } : { W: +c.width, L: +c.length };
  }
  function rowRange(c, y) {
    const { W } = dims(c);
    if (c.type !== 'round') return [0, W];
    const R = W / 2, dy = y - R, h = Math.sqrt(Math.max(0, R * R - dy * dy));
    return [R - h, R + h];
  }
  function inside(c, x, y, pad = 0) {
    const { W, L } = dims(c);
    if (c.type === 'round') { const R = W / 2; return Math.hypot(x - R, y - R) <= R - pad; }
    return x >= pad && x <= W - pad && y >= pad && y <= L - pad;
  }
  // n positions spread evenly from a to b (endpoints included); 1 → middle.
  function even(a, b, n) {
    if (n <= 1 || b <= a) return [(a + b) / 2];
    const out = [];
    for (let i = 0; i < n; i++) out.push(a + i * (b - a) / (n - 1));
    return out;
  }
  // How many fit between a and b at spacing s (endpoints included).
  function countFit(a, b, s) { return s > 0 && b > a ? Math.floor((b - a) / s + 1e-6) + 1 : 1; }
  // Plants are drawn one by one up to this many; a planting with more (a big bed at close spacing) is drawn as a
  // pattern at the same spacing instead, so the phone never has to draw or compare thousands of circles.
  const MAX_DRAWN = 1500;
  const MAX_ROWS = 2000;
  // Arranging plants by hand only makes sense for a few hundred.
  const MAX_ARRANGE = 300;
  // Section range down the long side. Outer bed edges use the margin; edges shared with another section use half the spacing.
  function yRange(c, p, sp) {
    const { L } = dims(c), m = +c.margin || 0;
    return [+p.from + (+p.from <= 0.5 ? m : sp / 2), +p.to - (+p.to >= L - 0.5 ? m : sp / 2)];
  }
  function band(c, p) { const [top, bot] = yRange(c, p, 0); return { top, bot, h: Math.max(1, bot - top) }; }
  function rowAxis(c, p) {
    const { W } = dims(c), m = +c.margin || 0;
    return p.dir === 'along' ? [m, W - m] : yRange(c, p, +p.rowSp || 0);
  }
  function fitRows(c, p) { if (!(+p.rowSp > 0)) return null; const [a, b] = rowAxis(c, p); return countFit(a, b, +p.rowSp); }
  function rowCount(c, p) { return Math.min(MAX_ROWS, +p.rows > 0 ? Math.round(+p.rows) : (fitRows(c, p) || 1)); }
  function spacingNow(p) {
    if (p.method === 'seed' && p.thinned && +p.thinSp > 0) return +p.thinSp;
    return +p.plantSp || +p.thinSp || 10;
  }
  function rng(str) {
    let h = 1779033703;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }

  // The rows of a row layout (rows, staggered, continuous): where each row is across, where it starts and ends along,
  // and how many plants it holds — worked out without placing every plant.
  // dir 'across' (default): rows run across the short side, stacked down the long side.
  // dir 'along': rows run down the long side, side by side across the width.
  function rowsOf(c, p) {
    const m = +c.margin || 0, s = Math.max(0.5, spacingNow(p));
    const [ra, rb] = rowAxis(c, p);
    const along = p.dir === 'along', out = [];
    even(ra, rb, rowCount(c, p)).forEach((r, i) => {
      let a, b;
      if (along) {
        [a, b] = yRange(c, p, s);
        if (c.type === 'round') { const [ca, cb] = rowRange(c, r); a = Math.max(a, ca + m); b = Math.min(b, cb - m); }
      } else {
        const [ca, cb] = rowRange(c, r); a = ca + m; b = cb - m;
      }
      if (b < a) { if (c.type === 'round') return; a = b = (a + b) / 2; }
      const n = countFit(a, b, s), stag = p.layout === 'staggered' && i % 2 === 1 && n > 1;
      out.push({ r, a, b, n: stag ? n - 1 : n, full: n, stag });
    });
    return out;
  }
  function scatterCount(c, p) {
    const { W } = dims(c), s = Math.max(0.5, spacingNow(p));
    return Math.max(1, Math.round((W * band(c, p).h) / (s * s)));
  }
  // A drill (sown in a continuous line) that hasn't been thinned: the line is the sowing — how many seeds went in isn't
  // known, so it has no single plants to draw or place.
  const unthinnedDrill = p => p.layout === 'continuous' && !(p.thinned && p.method === 'seed');
  // How many plants a planting has, by its layout (cheap, even for a huge bed). For a drill not yet thinned: how many
  // it'll be once thinned (at the sowing spacing when there's no thinning distance).
  function count(c, p) {
    if (unthinnedDrill(p) && p.method === 'seed' && +p.thinSp > 0) return count(c, Object.assign({}, p, { thinned: true }));
    if (p.layout === 'free') return (p.positions || []).length;
    if (p.layout === 'center') return 1;
    if (p.layout === 'diamond') return 4;
    if (p.layout === 'scatter') return scatterCount(c, p);
    let n = 0; for (const r of rowsOf(c, p)) n += r.n;
    return n;
  }

  // Returns plant centres and drill lines for a planting. With more than MAX_DRAWN plants it returns no centres and
  // `many` (the count) instead: draw those as a pattern (see svg), and don't offer to arrange them by hand.
  function layout(c, p) {
    const { W } = dims(c), m = +c.margin || 0;
    const s = Math.max(0.5, spacingNow(p));
    const lines = [];
    if (p.layout === 'free') return { pts: (p.positions || []).map(q => q.slice(0, 3)), lines };   // [x, y] — or [x, y, sown] for a plant younger than the rest (a gap filled later)
    const midY = (+p.from + +p.to) / 2;
    if (p.layout === 'center') return { pts: [[W / 2, midY]], lines };
    if (p.layout === 'diamond') {
      const d = Math.min(s * 0.7, W * 0.3, (p.to - p.from) * 0.3);
      return { pts: [[W / 2, midY - d], [W / 2 + d, midY], [W / 2, midY + d], [W / 2 - d, midY]], lines };
    }
    const along = p.dir === 'along';
    if (unthinnedDrill(p)) {   // just the lines
      for (const { r, a, b } of rowsOf(c, p)) lines.push(along ? [r, a, r, b] : [a, r, b, r]);
      return { pts: [], lines, drill: true };
    }
    const n = count(c, p);
    if (n > MAX_DRAWN) return { pts: [], lines, many: n };
    if (p.layout === 'scatter') {
      const { top, h } = band(c, p);
      const rnd = rng(p.id || 'x');
      const pts = []; let tries = 0;
      while (pts.length < n && tries < n * 30) {
        tries++;
        const x = rnd() * W, y = top + rnd() * h;
        if (inside(c, x, y, Math.max(m, 1))) pts.push([x, y]);
      }
      return { pts, lines };
    }
    const pts = [];
    for (const { r, a, b, full, stag } of rowsOf(c, p)) {
      let pos = even(a, b, full);
      if (stag) pos = pos.slice(1).map((v, k) => (v + pos[k]) / 2);
      pos.forEach(v => pts.push(along ? [r, v] : [v, r]));
    }
    return { pts, lines };
  }
  // Too many plants to draw one by one: a pattern of plants at the planting's spacing over the area it covers.
  function manyPlants(c, p, id, r) {
    const { W } = dims(c), m = +c.margin || 0, s = Math.max(0.5, spacingNow(p)), along = p.dir === 'along';
    let x0, y0, x1, y1, sx = s, sy = s;
    if (p.layout === 'scatter') { const { top, bot } = band(c, p); [x0, y0, x1, y1] = [m, top, W - m, bot]; }
    else {
      const rows = rowsOf(c, p); if (!rows.length) return '';
      const gap = rows.length > 1 ? Math.abs(rows[1].r - rows[0].r) : s;
      const lo = Math.min(...rows.map(q => q.a)), hi = Math.max(...rows.map(q => q.b)), r0 = rows[0].r, r1 = rows[rows.length - 1].r;
      if (along) { [x0, x1, y0, y1] = [r0, r1, lo, hi]; sx = gap; } else { [x0, x1, y0, y1] = [lo, hi, r0, r1]; sy = gap; }
    }
    const rr = Math.max(0.2, Math.min(r, 0.5 * Math.min(sx, sy)));
    return `<pattern id="${id}" x="${x0 - sx / 2}" y="${y0 - sy / 2}" width="${sx}" height="${sy}" patternUnits="userSpaceOnUse"><circle cx="${sx / 2}" cy="${sy / 2}" r="${rr}" class="plant" stroke-width="0"/></pattern>`
      + `<rect x="${x0 - sx / 2}" y="${y0 - sy / 2}" width="${x1 - x0 + sx}" height="${y1 - y0 + sy}" fill="url(#${id})"/>`;
  }

  // Plant radius (cm) for "today": seed-sized → thinned → mature spread at harvest.
  function radius(p, todayS) {
    // seedlings you raised from seed are as old as their sowing in the tray: drawn from then, like a sowing
    if (p.method !== 'seed' && p.seededOn && p.seededOn < (p.sowDate || '')) return radius(Object.assign({}, p, { method: 'seed', sowDate: p.seededOn, thinSp: null }), todayS);
    const t = pd(todayS) || new Date(), sow = pd(p.sowDate) || t;
    const R = Math.max(0.5, (+p.spread || spacingNow(p)) / 2);
    let hv = pd(p.harvestDate);
    if (!hv || hv <= sow) hv = new Date(sow.getTime() + 60 * DAY);
    if (t >= hv) return R;                       // at or past harvest: full size
    if (t <= sow) return p.method === 'seed' ? Math.min(R, 0.3) : Math.max(0.5, R * 0.2);
    const seed = p.method === 'seed', thinning = seed && +p.thinSp > 0;
    if (thinning && !p.thinned) {
      const th = pd(p.thinDate);
      // tiny seedlings until the thinning date — only if that date sensibly falls before harvest
      const capEnd = th && th > sow ? Math.min(+th, +sow + 0.4 * (hv - sow)) : 0;  // thinning happens early in a crop's life
      if (capEnd && t < capEnd) { const f = clamp01((t - sow) / (capEnd - sow)); return 0.3 + f * (Math.min(R, 2) - 0.3); }
    }
    let st = sow, r0 = seed ? 0.3 : Math.max(0.5, R * 0.2);
    if (thinning) {
      const th = pd(p.thinDoneOn) || pd(p.thinDate);
      if (th && th > sow && th < hv && th <= t && (th - sow) <= 0.5 * (hv - sow)) { st = th; r0 = Math.min(R, 2); }
    }
    const f = clamp01((t - st) / (hv - st));
    return r0 + f * (R - r0);
  }

  function shape(c, attrs = '') {
    const { W, L } = dims(c);
    if (c.type === 'round') return `<circle cx="${W / 2}" cy="${L / 2}" r="${W / 2}" ${attrs}/>`;
    const rx = c.type === 'bed' ? Math.min(W, L) * 0.02 : Math.min(W, L) * 0.06;
    return `<rect x="0" y="0" width="${W}" height="${L}" rx="${rx}" ${attrs}/>`;
  }
  // Ruler and grid: numbers along the top and left every 50 cm — or every 1 m, 2 m, 5 m… on a big bed, so they never
  // crowd — starting from the first step (no 0), and none on round pots. Faint grid lines every 10 cm, or wider when
  // they'd be too close together.
  const NUM_STEPS = [50, 100, 200, 500, 1000, 2000, 5000, 10000], GRID_STEPS = [10, 20, 50, ...NUM_STEPS.slice(1)];
  function ruler(c, W, L, px) {
    const step = NUM_STEPS.find(st => st * px >= 40) || 10000, minor = Math.min(step, GRID_STEPS.find(st => st * px >= 7) || 10000);
    const nums = c.type !== 'round';
    return { step, minor, digits: String(Math.floor(Math.max(W, L) / step) * step).length, top: nums && W >= step, left: nums && L >= step };
  }
  const escT = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // o: { px (screen px per cm), today, highlight (planting id), labels, gaps:[[from,to]], showMargin, edit (planting id) , cls }
  function svg(c, plantings, o = {}) {
    const { W, L } = dims(c);
    if (!(W > 0 && L > 0)) return '<svg viewBox="0 0 10 10"></svg>';
    const px = o.px || 2;
    const pad = Math.max(W, L) * 0.025, ru = o.grid ? ruler(c, W, L, px) : null;
    const padL = ru && ru.left ? Math.max(pad, (ru.digits * 5.6 + 8) / px) : pad, padT = ru && ru.top ? Math.max(pad, 14 / px) : pad;
    const padR = ru && ru.top ? Math.max(pad, (ru.digits * 2.8 + 2) / px) : pad;   // room for half of the last number on top
    const minR = (o.minPx || 1.4) / px;
    const key = 'k' + Math.random().toString(36).slice(2, 8);
    const ns = 'vector-effect="non-scaling-stroke"';
    let s = `<svg viewBox="${-padL} ${-padT} ${W + padL + padR} ${L + padT + pad}" width="${((W + padL + padR) * px).toFixed(1)}" height="${((L + padT + pad) * px).toFixed(1)}" class="plot ${o.cls || ''}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;
    const cs = Math.max(W, L) / 40;
    s += `<defs><clipPath id="${key}">${shape(c)}</clipPath><pattern id="${key}s" width="${cs * 3}" height="${cs * 3}" patternUnits="userSpaceOnUse"><circle cx="${cs * .6}" cy="${cs * .8}" r="${cs * .18}" class="crumb"/><circle cx="${cs * 2.1}" cy="${cs * 1.9}" r="${cs * .13}" class="crumb"/><circle cx="${cs * 1.4}" cy="${cs * 2.7}" r="${cs * .1}" class="crumb lt"/><circle cx="${cs * 2.6}" cy="${cs * .5}" r="${cs * .1}" class="crumb lt"/></pattern></defs>`;
    s += shape(c, 'class="soil"');
    s += `<g clip-path="url(#${key})">`;
    s += shape(c, `fill="url(#${key}s)" class="crumbs"`);
    if (ru) {
      const line = (x1, y1, x2, y2, major) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="grid${major ? ' g50' : ''}" ${ns}/>`;
      for (let x = ru.minor; x < W; x += ru.minor) if (x % ru.step) s += line(x, 0, x, L);
      for (let y = ru.minor; y < L; y += ru.minor) if (y % ru.step) s += line(0, y, W, y);
      for (let x = ru.step; x < W; x += ru.step) s += line(x, 0, x, L, true);
      for (let y = ru.step; y < L; y += ru.step) s += line(0, y, W, y, true);
    }
    const m = +c.margin || 0;
    if (o.showMargin && m > 0 && c.type !== 'round') s += `<rect x="${m}" y="${m}" width="${Math.max(0, W - 2 * m)}" height="${Math.max(0, L - 2 * m)}" class="margin" ${ns}/>`;
    for (const g of o.gaps || []) s += `<rect x="0" y="${g[0]}" width="${W}" height="${g[1] - g[0]}" class="gap" data-gap="${g[0]},${g[1]}"/>`;
    plantings.forEach((p, pi) => {
      const dim = o.highlight && o.highlight !== p.id;
      s += `<g class="pl${dim ? ' dim' : ''}" data-pid="${p.id}" style="--c:${p._color}">`;
      s += `<rect x="0" y="${p.from}" width="${W}" height="${p.to - p.from}" class="sec"/>`;
      const { pts, lines, many, drill } = layout(c, p);
      let r = Math.max(minR, radius(p, o.today)), cap = Infinity;
      if (many) { s += manyPlants(c, p, `${key}m${pi}`, r) + `</g>`; return; }
      if (pts.length > 1) {   // crowded plants: draw each no wider than its share, so they don't swallow the pot
        let nn = Infinity; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) nn = Math.min(nn, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
        if (nn < Infinity) { cap = nn * 0.5; r = Math.max(minR, Math.min(r, cap)); }
      }
      // a plant put in later (filling a gap) grows from its own sowing
      const rOf = q => q[2] ? Math.max(minR, Math.min(cap, radius(Object.assign({}, p, { method: 'seed', sowDate: q[2], seededOn: null, thinSp: null }), o.today))) : r;
      // a drill: the sowing line, widening into a band as the crop grows (no wider than its rows allow)
      const band = drill ? Math.min(2 * r, (+p.rowSp || 2 * r) * 0.9) : 0;
      for (const ln of lines) s += (band > 1.5 / px ? `<line x1="${ln[0]}" y1="${ln[1]}" x2="${ln[2]}" y2="${ln[3]}" class="drillband" stroke-width="${band.toFixed(2)}"/>` : '') + `<line x1="${ln[0]}" y1="${ln[1]}" x2="${ln[2]}" y2="${ln[3]}" class="drill" ${ns}/>`;
      const editing = o.edit === p.id;
      // a plant big enough to see is drawn as its crop's icon, once it's a plant of its own: planted out, thinned, or
      // (a sowing never thinned) come up — a dot before that, when there are too many to draw, and while arranging
      const own = p.method !== 'seed' || p.thinned || !(+p.thinSp > 0), body = own && !editing && pts.length <= 80 && p.cropId ? icBody(p.cropId) : null;
      pts.forEach((q, i) => {
        const rq = rOf(q);
        if (body && rq * px >= 6 && (!q[2] || q[2] <= (o.today || todayStr()))) { const d = rq * 2.1; s += `<circle cx="${q[0].toFixed(2)}" cy="${q[1].toFixed(2)}" r="${rq}" class="plant iconbg" ${ns}/><svg x="${(q[0] - d / 2).toFixed(2)}" y="${(q[1] - d / 2).toFixed(2)}" width="${d.toFixed(2)}" height="${d.toFixed(2)}" viewBox="0 0 32 32" class="picon">${body}</svg>`; return; }
        s += `<circle cx="${q[0].toFixed(2)}" cy="${q[1].toFixed(2)}" r="${editing ? Math.max(rq, 6 / px) : rq}" class="plant${editing ? ' drag' : ''}" ${editing ? `data-i="${i}"` : ''} ${ns}/>`;
      });
      s += `</g>`;
    });
    // section dividers
    const cuts = new Set();
    for (const p of plantings) { if (p.from > 0.5) cuts.add(+p.from); if (p.to < L - 0.5) cuts.add(+p.to); }
    for (const y of cuts) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="cut" ${ns}/>`;
    // covers: nets, fleece, cloches, shade cloth over a section
    const covs = o.covers || (activeCovers(c));
    if (covs.length) {
      const mc = Math.max(W, L) / 30;
      s += `<defs><pattern id="${key}net" width="${mc}" height="${mc}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H${mc}M0 0V${mc}" stroke="#f4f7fb" stroke-width="${mc * 0.09}" opacity=".85"/></pattern>
        <pattern id="${key}sh" width="${mc * .6}" height="${mc * .6}" patternUnits="userSpaceOnUse"><rect width="${mc * .6}" height="${mc * .6}" fill="rgba(25,30,25,.28)"/><circle cx="${mc * .3}" cy="${mc * .3}" r="${mc * .12}" fill="rgba(25,30,25,.35)"/></pattern></defs>`;
      for (const cv of covs) {
        const y = Math.max(0, cv.from), h = Math.min(L, cv.to) - y; if (h <= 0) continue;
        const fill = cv.type === 'fleece' ? 'rgba(255,255,255,.55)' : cv.type === 'cloche' ? 'rgba(220,240,255,.45)' : cv.type === 'shade' ? `url(#${key}sh)` : `url(#${key}net)`;
        s += `<g class="cover ${cv.type}"><rect x="0" y="${y}" width="${W}" height="${h}" fill="${fill}"/><rect x="0" y="${y}" width="${W}" height="${h}" class="coveredge" ${ns}/></g>`;
      }
    }
    s += `</g>`;
    s += shape(c, `class="rim" ${ns}`);
    if (ru) {
      const gf = 9.5 / px;
      if (ru.top) for (let x = ru.step; x <= W + 0.01; x += ru.step) s += `<text x="${x}" y="${-4 / px}" font-size="${gf}" class="tick" text-anchor="middle">${x}</text>`;
      if (ru.left) for (let y = ru.step; y <= L + 0.01; y += ru.step) s += `<text x="${-4 / px}" y="${y + gf * 0.35}" font-size="${gf}" class="tick" text-anchor="end">${y}</text>`;
    }
    if (o.labels) {
      // (the outline is in the drawing's units — centimetres — like the font size, so it's ~3 px on screen however big the
      // bed is drawn; a fixed 3 made fat blobs round each letter on a zoomed-in bed or a small pot)
      const fs = 12 / px, sw = `stroke-width="${+(3 / px).toFixed(3)}"`;
      for (const p of plantings) {
        if (o.highlight && o.highlight !== p.id) continue;
        const y = Math.min(p.to - fs * 0.3, +p.from + fs * 1.15);
        s += `<text x="${W / 2}" y="${y}" font-size="${fs}" ${sw} class="lbl" text-anchor="middle">${escT(p._label)}</text>`;
      }
      for (const g of o.gaps || []) {
        const fs2 = 11 / px;
        if (g[1] - g[0] > fs2 * 1.4) s += `<text x="${W / 2}" y="${(g[0] + g[1]) / 2 + fs2 * 0.35}" font-size="${fs2}" ${sw} class="lbl empty" text-anchor="middle">${escT(g[2] || '+ empty')}</text>`;
      }
    }
    s += `</svg>`;
    return s;
  }

  return { dims, svg, layout, count, radius, rowCount, fitRows, band, spacingNow, inside, MAX_ARRANGE };
})();

// ---------- a bed or pot as a picture ----------
export function plotSVG(c, o = {}) {
  const { W, L } = Draw.dims(c);
  const px = o.width ? Math.min(o.width / W, (o.maxH || 1e9) / L) : (o.px || 2);
  const gs = o.gaps ? gaps(c).map(g => { const pc = prevCrop(c, g[0], g[1]); return [g[0], g[1], pc ? `empty · was ${crop(pc.cropId).en}` : '+ empty']; }) : [];
  const list = o.plantings || decorate(activeIn(c.id));
  return Draw.svg(c, list, Object.assign({}, o, { px, today: o.today || todayStr(), gaps: gs }));
}
