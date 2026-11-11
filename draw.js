'use strict';
// Top-down drawing of beds and pots. Coordinates are in cm.
// x = across the short side (width), y = down the long side (length). Long side is drawn vertically.
const Draw = (() => {
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
  function countFit(a, b, s) { return s > 0 && b > a ? Math.min(400, Math.floor((b - a) / s + 1e-6) + 1) : 1; }
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
  function rowCount(c, p) { return +p.rows > 0 ? Math.round(+p.rows) : (fitRows(c, p) || 1); }
  function spacingNow(p) {
    if (p.method === 'seed' && p.thinned && +p.thinSp > 0) return +p.thinSp;
    return +p.plantSp || +p.thinSp || 10;
  }
  function rng(str) {
    let h = 1779033703;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }

  // Returns plant centres and drill lines for a planting.
  // dir 'across' (default): rows run across the short side, stacked down the long side.
  // dir 'along': rows run down the long side, side by side across the width.
  function layout(c, p) {
    const { W } = dims(c), m = +c.margin || 0;
    const s = Math.max(0.5, spacingNow(p));
    const lines = [];
    if (p.layout === 'free') return { pts: (p.positions || []).map(q => [q[0], q[1]]), lines };
    const midY = (+p.from + +p.to) / 2;
    if (p.layout === 'center') return { pts: [[W / 2, midY]], lines };
    if (p.layout === 'diamond') {
      const d = Math.min(s * 0.7, W * 0.3, (p.to - p.from) * 0.3);
      return { pts: [[W / 2, midY - d], [W / 2 + d, midY], [W / 2, midY + d], [W / 2 - d, midY]], lines };
    }
    if (p.layout === 'scatter') {
      const { top, h } = band(c, p);
      const rnd = rng(p.id || 'x');
      const n = Math.min(300, Math.max(1, Math.round((W * h) / (s * s))));
      const pts = []; let tries = 0;
      while (pts.length < n && tries < n * 30) {
        tries++;
        const x = rnd() * W, y = top + rnd() * h;
        if (inside(c, x, y, Math.max(m, 1))) pts.push([x, y]);
      }
      return { pts, lines };
    }
    const [ra, rb] = rowAxis(c, p);
    const rowsPos = even(ra, rb, rowCount(c, p));
    const along = p.dir === 'along';
    const drill = p.layout === 'continuous' && !(p.thinned && p.method === 'seed');
    const pts = [];
    rowsPos.forEach((r, i) => {
      let a, b;
      if (along) {
        [a, b] = yRange(c, p, s);
        if (c.type === 'round') { const [ca, cb] = rowRange(c, r); a = Math.max(a, ca + m); b = Math.min(b, cb - m); }
      } else {
        const [ca, cb] = rowRange(c, r); a = ca + m; b = cb - m;
      }
      if (b < a) { if (c.type === 'round') return; a = b = (a + b) / 2; }
      let pos = even(a, b, countFit(a, b, s));
      if (p.layout === 'staggered' && i % 2 === 1 && pos.length > 1) pos = pos.slice(1).map((v, k) => (v + pos[k]) / 2);
      if (drill) lines.push(along ? [r, a, r, b] : [a, r, b, r]);
      pos.forEach(v => pts.push(along ? [r, v] : [v, r]));
    });
    return { pts, lines };
  }

  // Plant radius (cm) for "today": seed-sized → thinned → mature spread at harvest.
  function radius(p, todayS) {
    const t = pd(todayS), sow = pd(p.sowDate) || t;
    const R = Math.max(0.5, (+p.spread || spacingNow(p)) / 2);
    const hv = pd(p.harvestDate) || new Date(sow.getTime() + 60 * DAY);
    if (p.method === 'seed' && +p.thinSp > 0 && !p.thinned) {
      const th = pd(p.thinDate) || new Date(sow.getTime() + 20 * DAY);
      const f = clamp01((t - sow) / ((th - sow) || 1));
      return 0.3 + f * (Math.min(R, 2) - 0.3);
    }
    const st = p.method === 'seed' ? (pd(p.thinDoneOn) || pd(p.thinDate) || sow) : sow;
    const r0 = p.method === 'seed' ? Math.min(R, +p.thinSp > 0 ? 2 : 0.3) : Math.max(0.5, R * 0.2);
    const f = clamp01((t - st) / ((hv - st) || 1));
    return r0 + f * (R - r0);
  }

  function shape(c, attrs = '') {
    const { W, L } = dims(c);
    if (c.type === 'round') return `<circle cx="${W / 2}" cy="${L / 2}" r="${W / 2}" ${attrs}/>`;
    const rx = c.type === 'bed' ? Math.min(W, L) * 0.02 : Math.min(W, L) * 0.06;
    return `<rect x="0" y="0" width="${W}" height="${L}" rx="${rx}" ${attrs}/>`;
  }
  const escT = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // o: { px (screen px per cm), today, highlight (planting id), labels, gaps:[[from,to]], showMargin, edit (planting id) , cls }
  function svg(c, plantings, o = {}) {
    const { W, L } = dims(c);
    if (!(W > 0 && L > 0)) return '<svg viewBox="0 0 10 10"></svg>';
    const px = o.px || 2;
    const pad = Math.max(W, L) * 0.025;
    const padL = o.grid ? Math.max(pad, 24 / px) : pad, padT = o.grid ? Math.max(pad, 14 / px) : pad;
    const minR = (o.minPx || 1.4) / px;
    const key = 'k' + Math.random().toString(36).slice(2, 8);
    const ns = 'vector-effect="non-scaling-stroke"';
    let s = `<svg viewBox="${-padL} ${-padT} ${W + padL + pad} ${L + padT + pad}" width="${((W + padL + pad) * px).toFixed(1)}" height="${((L + padT + pad) * px).toFixed(1)}" class="plot ${o.cls || ''}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;
    const cs = Math.max(W, L) / 40;
    s += `<defs><clipPath id="${key}">${shape(c)}</clipPath><pattern id="${key}s" width="${cs * 3}" height="${cs * 3}" patternUnits="userSpaceOnUse"><circle cx="${cs * .6}" cy="${cs * .8}" r="${cs * .18}" class="crumb"/><circle cx="${cs * 2.1}" cy="${cs * 1.9}" r="${cs * .13}" class="crumb"/><circle cx="${cs * 1.4}" cy="${cs * 2.7}" r="${cs * .1}" class="crumb lt"/><circle cx="${cs * 2.6}" cy="${cs * .5}" r="${cs * .1}" class="crumb lt"/></pattern></defs>`;
    s += shape(c, 'class="soil"');
    s += `<g clip-path="url(#${key})">`;
    s += shape(c, `fill="url(#${key}s)" class="crumbs"`);
    if (o.grid) {
      for (let x = 10; x < W; x += 10) s += `<line x1="${x}" y1="0" x2="${x}" y2="${L}" class="grid${x % 50 ? '' : ' g50'}" ${ns}/>`;
      for (let y = 10; y < L; y += 10) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="grid${y % 50 ? '' : ' g50'}" ${ns}/>`;
    }
    const m = +c.margin || 0;
    if (o.showMargin && m > 0 && c.type !== 'round') s += `<rect x="${m}" y="${m}" width="${Math.max(0, W - 2 * m)}" height="${Math.max(0, L - 2 * m)}" class="margin" ${ns}/>`;
    for (const g of o.gaps || []) s += `<rect x="0" y="${g[0]}" width="${W}" height="${g[1] - g[0]}" class="gap" data-gap="${g[0]},${g[1]}"/>`;
    for (const p of plantings) {
      const dim = o.highlight && o.highlight !== p.id;
      s += `<g class="pl${dim ? ' dim' : ''}" data-pid="${p.id}" style="--c:${p._color}">`;
      s += `<rect x="0" y="${p.from}" width="${W}" height="${p.to - p.from}" class="sec"/>`;
      const { pts, lines } = layout(c, p);
      const r = Math.max(minR, radius(p, o.today));
      for (const ln of lines) s += `<line x1="${ln[0]}" y1="${ln[1]}" x2="${ln[2]}" y2="${ln[3]}" class="drill" ${ns}/>`;
      const editing = o.edit === p.id;
      pts.forEach((q, i) => {
        s += `<circle cx="${q[0].toFixed(2)}" cy="${q[1].toFixed(2)}" r="${editing ? Math.max(r, 6 / px) : r}" class="plant${editing ? ' drag' : ''}" ${editing ? `data-i="${i}"` : ''} ${ns}/>`;
      });
      s += `</g>`;
    }
    // section dividers
    const cuts = new Set();
    for (const p of plantings) { if (p.from > 0.5) cuts.add(+p.from); if (p.to < L - 0.5) cuts.add(+p.to); }
    for (const y of cuts) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="cut" ${ns}/>`;
    s += `</g>`;
    s += shape(c, `class="rim" ${ns}`);
    if (o.grid) {
      const gf = 9.5 / px;
      for (let x = 0; x <= W + 0.01; x += 50) s += `<text x="${x}" y="${-4 / px}" font-size="${gf}" class="tick" text-anchor="middle">${x}</text>`;
      for (let y = 0; y <= L + 0.01; y += 50) s += `<text x="${-4 / px}" y="${y + gf * 0.35}" font-size="${gf}" class="tick" text-anchor="end">${y}</text>`;
    }
    if (o.labels) {
      const fs = 12 / px;
      for (const p of plantings) {
        if (o.highlight && o.highlight !== p.id) continue;
        const y = Math.min(p.to - fs * 0.3, +p.from + fs * 1.15);
        s += `<text x="${W / 2}" y="${y}" font-size="${fs}" class="lbl" text-anchor="middle">${escT(p._label)}</text>`;
      }
      for (const g of o.gaps || []) {
        const fs2 = 11 / px;
        if (g[1] - g[0] > fs2 * 1.4) s += `<text x="${W / 2}" y="${(g[0] + g[1]) / 2 + fs2 * 0.35}" font-size="${fs2}" class="lbl empty" text-anchor="middle">${escT(g[2] || '+ empty')}</text>`;
      }
    }
    s += `</svg>`;
    return s;
  }

  return { dims, svg, layout, radius, rowCount, fitRows, band, spacingNow, inside };
})();
