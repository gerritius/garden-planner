// Areas (Farm, Backyard…) and adjusting a bed's sections by dragging. (The garden map was retired in 1.54: the Beds view
// does its job with sorting, filters and the Sun & Moisture view.)

import { A, draft, notFound, render, setChrome, setDraft } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, dragZone, modal } from '../core/ui.js';
import { $, esc, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { crop, ic } from '../plants/crops.js';
import { activeIn, decorate, noteVacated, planting } from './garden.js';

// ---------- areas ----------
export function ensureAreas() {
  if (!S.areas || !S.areas.length) S.areas = [{ id: 'a_' + uid(), name: 'Garden' }];
  for (const c of S.containers) if (!S.areas.find(a => a.id === c.area)) c.area = S.areas[0].id;
}
// Areas, such as Farm and Backyard: the Beds view can show one at a time. Managed from a sheet on the Beds view.
export const areaOf = c => (S.areas || []).find(a => a.id === c.area) || (S.areas || [])[0] || null;
export function areasDialog() {
  ensureAreas();
  const count = id => S.containers.filter(c => c.area === id).length;
  modal(`<h3>Areas</h3><p class="hint">Group beds and pots by where they are, such as Farm and Backyard. The Beds view can then show one area at a time.</p>
    <ul class="plist">${S.areas.map(a => `<li><span class="grow">${esc(a.name)} <small class="muted">· ${count(a.id)} bed${count(a.id) === 1 ? '' : 's'} or pots</small></span>
      <button type="button" class="btn small" data-ren="${a.id}">Rename</button>${S.areas.length > 1 ? `<button type="button" class="btn small danger" data-del="${a.id}">Delete</button>` : ''}</li>`).join('')}</ul>
    <div class="btnrow"><button type="button" class="btn" data-new>＋ New area</button><button type="button" class="btn primary" data-x="ok">Done</button></div>
    <p class="hint">To move a bed or pot to another area, edit it and choose the area.</p>`, (m, close) => {
    const again = () => { close(); render(); areasDialog(); };
    m.querySelector('[data-x=ok]').onclick = () => { close(); render(); };
    m.querySelector('[data-new]').onclick = async () => { const n = prompt('Name of the new area (e.g. Community garden):'); if (!n || !n.trim()) return; S.areas.push({ id: 'a_' + uid(), name: n.trim() }); await save(); again(); };
    m.querySelectorAll('[data-ren]').forEach(b => b.onclick = async () => { const a = S.areas.find(x => x.id === b.dataset.ren); const n = prompt('Rename area:', a.name); if (!n || !n.trim()) return; a.name = n.trim(); await save(); again(); });
    m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const id = b.dataset.del; close();
      if (!await confirmBox('Delete this area? Its beds and pots move to the first remaining area.', 'Delete', true)) return areasDialog();
      S.areas = S.areas.filter(a => a.id !== id);
      for (const c of S.containers) if (c.area === id) c.area = S.areas[0].id;
      if (S.bedArea === id) S.bedArea = null;
      await save(); render(); areasDialog();
    });
  });
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
