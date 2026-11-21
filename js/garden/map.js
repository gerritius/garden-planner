// The garden map: areas, placing beds and pots, dragging them about, and adjusting sections by dragging.

import { A, draft, notFound, render, setChrome, setDraft } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, dragZone, modal } from '../core/ui.js';
import { $, esc, go, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { crop, ic } from '../plants/crops.js';
import { activeIn, container, decorate, noteVacated, planting } from './garden.js';

// ---------- garden map ----------
export function ensureAreas() {
  if (!S.areas || !S.areas.length) S.areas = [{ id: 'a_' + uid(), name: 'Garden' }];
  for (const c of S.containers) if (!S.areas.find(a => a.id === c.area)) c.area = S.areas[0].id;
}
function boxOf(c) { const { W, L } = Draw.dims(c); return c.rot ? [L, W] : [W, L]; }
function autoPlace(areaId) {
  const cs = S.containers.filter(c => c.area === areaId);
  const placed = cs.filter(c => c.pos);
  let x = 0, y = placed.length ? Math.max(...placed.map(o => o.pos[1] + boxOf(o)[1])) + 40 : 0, rowH = 0;
  const maxW = Math.max(300, ...placed.map(o => o.pos[0] + boxOf(o)[0]), ...cs.map(c => boxOf(c)[0]));
  for (const c of cs) {
    if (c.pos) continue;
    const [w, h] = boxOf(c);
    if (x > 0 && x + w > maxW) { x = 0; y += rowH + 40; rowH = 0; }
    c.pos = [x, y]; x += w + 30; rowH = Math.max(rowH, h);
  }
}
export function mapSVG(areaId, { edit = false, width = 360, sel = null } = {}) {
  const cs = S.containers.filter(c => c.area === areaId);
  if (!cs.length) return '<p class="muted center">No beds or pots in this area yet.</p>';
  autoPlace(areaId);
  let maxX = 0, maxY = 0;
  for (const c of cs) { const [w, h] = boxOf(c); maxX = Math.max(maxX, c.pos[0] + w); maxY = Math.max(maxY, c.pos[1] + h); }
  const pad = 30, W = maxX + pad * 2, H = maxY + pad * 2 + 20 + (edit ? 250 : 0), px = width / W;
  let s = `<svg class="map" viewBox="${-pad} ${-pad} ${W} ${H}" width="${width}" height="${(H * px).toFixed(0)}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<defs><pattern id="mg" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" class="mapgrid"/></pattern></defs><rect x="${-pad}" y="${-pad}" width="${W}" height="${H}" fill="url(#mg)" class="mapbg"/>`;
  for (const c of cs) {
    const { W: cw, L: cl } = Draw.dims(c), [bw, bh] = boxOf(c);
    let inner = Draw.svg(c, decorate(activeIn(c.id)), { px: 1, minPx: 1.6, today: todayStr() });
    const vb = inner.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const cx = c.pos[0] + bw / 2, cy = c.pos[1] + bh / 2;
    inner = inner.replace(/<svg [^>]*?viewBox="[^"]+"[^>]*>/, `<svg class="plot" x="${cx - vb[2] / 2}" y="${cy - vb[3] / 2}" width="${vb[2]}" height="${vb[3]}" viewBox="${vb.join(' ')}" overflow="visible">`);
    const g = c.rot ? `<g transform="rotate(90 ${cx} ${cy})">${inner}</g>` : inner;
    s += `<g class="mapc${sel === c.id ? ' sel' : ''}" data-cid="${c.id}">${g}<rect x="${c.pos[0]}" y="${c.pos[1]}" width="${bw}" height="${bh}" class="hit"/>
      <text x="${cx}" y="${c.pos[1] + bh + 13 / px}" font-size="${12 / px}" text-anchor="middle" class="mapl">${esc(c.name)}</text></g>`;
    void cw; void cl;
  }
  return s + '</svg>';
}
export function pageMap(q) {
  ensureAreas();
  const areaId = q.get('a') && S.areas.find(a => a.id === q.get('a')) ? q.get('a') : (S.mapArea && S.areas.find(a => a.id === S.mapArea) ? S.mapArea : S.areas[0].id);
  S.mapArea = areaId;
  const edit = q.get('edit') === '1';
  setChrome('Garden map', { back: true, kicker: edit ? 'Drag to arrange · tap to select' : S.areas.find(a => a.id === areaId).name });
  let sel = null;
  const vw = Math.min(window.innerWidth, 680) - 32;
  A.area = el => location.replace(`#/map?a=${el.dataset.id}${edit ? '&edit=1' : ''}`);
  A.newArea = () => { const n = prompt('Name of the new area (e.g. Community garden):'); if (!n) return; const a = { id: 'a_' + uid(), name: n.trim() }; S.areas.push(a); save().then(() => location.replace(`#/map?a=${a.id}&edit=1`)); };
  A.renameArea = () => { const a = S.areas.find(x => x.id === areaId); const n = prompt('Rename area:', a.name); if (n) { a.name = n.trim(); save().then(render); } };
  A.delArea = async () => {
    if (S.areas.length < 2) return alert('You need at least one area.');
    if (!await confirmBox('Delete this area? Its beds and pots move to the first area.', 'Delete', true)) return;
    S.areas = S.areas.filter(a => a.id !== areaId); for (const c of S.containers) if (c.area === areaId) { c.area = S.areas[0].id; c.pos = null; }
    await save(); location.replace('#/map?edit=1');
  };
  A.rot = async () => { const c = container(sel); if (!c) return; c.rot = c.rot ? 0 : 90; await save(); draw(); };
  A.moveTo = () => {
    const c = container(sel); if (!c) return;
    modal(`<h3>Move ${esc(c.name)} to…</h3><ul class="plist">${S.areas.filter(a => a.id !== areaId).map(a => `<li data-a="${a.id}"><span class="grow">${esc(a.name)}</span>›</li>`).join('') || '<li class="muted">Add another area first.</li>'}</ul>`, (m, close) => {
      m.querySelectorAll('[data-a]').forEach(li => li.onclick = async () => { c.area = li.dataset.a; c.pos = null; await save(); close(); sel = null; draw(); });
    });
  };
  const html = `<div class="seg wrap">${S.areas.map(a => `<button type="button" data-act="area" data-id="${a.id}" class="${a.id === areaId ? 'on' : ''}">${esc(a.name)}</button>`).join('')}</div>
    <div id="mapbox" class="mapbox"></div>
    <div id="selbar" class="btnrow" hidden><button class="btn small" data-act="rot">⟳ Rotate</button><button class="btn small" data-act="moveTo">Move to area…</button></div>
    ${edit ? `<div class="btnrow"><a class="btn primary" href="#/map?a=${areaId}" onclick="location.replace(this.href);return false;">Done</a></div>
      <div class="btnrow"><button class="btn small" data-act="newArea">＋ New area</button><button class="btn small" data-act="renameArea">Rename area</button><button class="btn small danger" data-act="delArea">Delete area</button></div>
      <p class="hint">Grid squares are 50 cm. Drag beds and pots roughly where they are; exact placement doesn’t matter.</p>`
      : `<div class="btnrow"><a class="btn" href="#/map?a=${areaId}&edit=1" onclick="location.replace(this.href);return false;">✥ Arrange map</a><button class="btn" data-act="newArea">＋ New area</button></div>`}`;
  function draw() {
    $('#mapbox').innerHTML = mapSVG(areaId, { edit, width: vw, sel });
    $('#selbar').hidden = !(edit && sel);
  }
  const after = () => {
    draw();
    const box = $('#mapbox');
    let drag = null;
    const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    box.addEventListener('click', e => { if (edit) return; const g = e.target.closest('[data-cid]'); if (g) go('#/container/' + g.dataset.cid); });
    if (!edit) return;
    const dz = dragZone(box, t => !!t.closest('[data-cid]'));
    box.addEventListener('pointerdown', e => {
      const g = e.target.closest('[data-cid]'); if (!g) { sel = null; draw(); return; }
      const c = container(g.dataset.cid); sel = c.id;
      const p = toCm(e); drag = { c, dx: p.x - c.pos[0], dy: p.y - c.pos[1], g, start: c.pos.slice() };
      box.setPointerCapture(e.pointerId); g.classList.add('sel'); $('#selbar').hidden = false;
    });
    const mv = e => {
      if (!drag) return;
      const p = toCm(e); drag.c.pos = [Math.max(0, Math.round((p.x - drag.dx) / 5) * 5), Math.max(0, Math.round((p.y - drag.dy) / 5) * 5)];
      drag.g.setAttribute('transform', `translate(${drag.c.pos[0] - drag.start[0]} ${drag.c.pos[1] - drag.start[1]})`);
      drag.moved = true;
    };
    box.addEventListener('pointermove', e => { if (!drag) return; mv(e); dz.move(e, mv); });
    const end = async () => { dz.stop(); if (!drag) return; const moved = drag.moved; drag = null; if (moved) await save(); draw(); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  };
  return { html, after };
}

// ---------- adjust sections by dragging ----------
export function pageSections(c) {
  if (!c) return { html: notFound() };
  setChrome('Adjust sections', { back: true, kicker: c.name });
  const L = Draw.dims(c).L;
  if (!draft) setDraft({ ps: activeIn(c.id).map(p => ({ id: p.id, from: p.from, to: p.to })) });
  const d = draft;
  const vw = Math.min(window.innerWidth, 640) - 32;
  const { W } = Draw.dims(c);
  const px = Math.min(vw / W, (window.innerHeight * 0.62) / L);
  const handles = () => {
    const hs = [];
    const add = (y, ref) => { let h = hs.find(x => Math.abs(x.y - y) < 0.01); if (!h) hs.push(h = { y, refs: [] }); h.refs.push(ref); };
    d.ps.forEach(p => { add(p.from, [p, 'from']); add(p.to, [p, 'to']); });
    return hs.sort((a, b) => a.y - b.y);
  };
  const limits = h => {
    let lo = 0, hi = L;
    for (const [p, k] of h.refs) {
      if (k === 'from') { hi = Math.min(hi, p.to - 5); const prev = d.ps.filter(q => q !== p && q.to <= p.from + 0.01 && !h.refs.some(r => r[0] === q)).map(q => q.to); lo = Math.max(lo, ...prev, 0); }
      else { lo = Math.max(lo, p.from + 5); const next = d.ps.filter(q => q !== p && q.from >= p.to - 0.01 && !h.refs.some(r => r[0] === q)).map(q => q.from); hi = Math.min(hi, ...next, L); }
    }
    return [lo, hi];
  };
  const draw = () => {
    const list = decorate(activeIn(c.id).map(p => Object.assign({}, p, d.ps.find(x => x.id === p.id))));
    let s = Draw.svg(c, list, { px, today: todayStr(), labels: true, grid: true, showMargin: true });
    const hs = handles();
    const hb = hs.map((h, i) => `<g class="handle" data-h="${i}"><rect x="-4" y="${h.y - 14 / px}" width="${W + 8}" height="${28 / px}" class="hhit"/><line x1="0" y1="${h.y}" x2="${W}" y2="${h.y}" class="hline" vector-effect="non-scaling-stroke"/>
      <rect x="${W / 2 - 22 / px}" y="${h.y - 9 / px}" width="${44 / px}" height="${18 / px}" rx="${4 / px}" class="hpill"/><text x="${W / 2}" y="${h.y + 4 / px}" font-size="${11 / px}" text-anchor="middle" class="htxt">${Math.round(h.y)}</text></g>`).join('');
    s = s.replace(/<\/svg>$/, hb + '</svg>');
    $('#secbox').innerHTML = s;
    $('#secinfo').innerHTML = list.map(p => `<li>${ic(p.cropId)}<span class="grow">${esc(crop(p.cropId).en)}</span><b>${Math.round(p.from)}–${Math.round(p.to)} cm</b></li>`).join('');
  };
  A.saveSec = async () => {
    for (const x of d.ps) { const p = planting(x.id), of = p.from, ot = p.to; p.from = Math.round(x.from); p.to = Math.round(x.to); noteVacated(p, of, ot); if (p.layout === 'free') p.positions = (p.positions || []).filter(q => q[1] >= p.from && q[1] <= p.to); }
    await save(); setDraft(null); history.back();
  };
  const html = `<p class="hint">Drag the orange tabs to move where a crop starts and ends — including the top and bottom of the bed, to free up space for another crop. Moves in 1 cm steps.</p>
    <div class="plotwrap" id="secbox"></div><ul class="plist" id="secinfo"></ul>
    <button class="btn primary wide" data-act="saveSec">Save sections</button>`;
  const after = () => {
    draw();
    const box = $('#secbox'); let drag = null;
    const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    box.addEventListener('pointerdown', e => { const g = e.target.closest('[data-h]'); if (!g) return; const h = handles()[+g.dataset.h]; drag = { h, lim: limits(h) }; box.setPointerCapture(e.pointerId); e.preventDefault(); });
    const dz = dragZone(box, t => !!t.closest('[data-h]'));
    const mv = e => {
      if (!drag) return;
      const y = Math.round(Math.max(drag.lim[0], Math.min(drag.lim[1], toCm(e).y)));
      for (const [p, k] of drag.h.refs) p[k] = y;
      drag.h.y = y; draw();
    };
    box.addEventListener('pointermove', e => { if (!drag) return; mv(e); dz.move(e, mv); });
    const end = () => { dz.stop(); drag = null; };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  };
  return { html, after };
}
