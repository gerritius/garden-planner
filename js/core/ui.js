// Shared pieces of the interface: pop-up dialogs, confirm boxes and drag areas that still let the page scroll.

import { $, esc } from './util.js';
import { A, render } from './router.js';
import { ui } from '../data/ui-icons.js';

// ---------- pop-up dialogs ----------
// each pop-up gets its own step in the back history, so the phone's Back button closes it instead of leaving the page
// Closing one with its own buttons takes that step back again, which the browser does a moment later. If the app moves
// to another page in that moment (Save → the new planting), the step back would land after it and undo the move —
// so the page the app went to is noted, and gone to again once the step back has landed.
let stepBack = null;   // { hash: where the step back lands, wanted: a page the app went to meanwhile }
window.addEventListener('popstate', () => {
  if (!stepBack) return;
  if (location.hash === stepBack.hash && !(history.state && history.state.gpModal)) {
    const w = stepBack.wanted; stepBack = null;
    if (w && w !== location.hash) location.replace(w);
  } else stepBack.wanted = location.hash;
});
window.addEventListener('hashchange', () => { if (stepBack && location.hash !== stepBack.hash) stepBack.wanted = location.hash; });
function takeStepBack(hash) {
  const mine = stepBack = { hash, wanted: null };
  history.back();
  setTimeout(() => { if (stepBack === mine) stepBack = null; }, 3000);   // in case it never lands
}
export function modal(html, mount) {
  const m = $('#modal'), openedHash = location.hash;
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.hidden = false;
  if (!(history.state && history.state.gpModal)) history.pushState(Object.assign({}, history.state, { gpModal: true }), '');   // (keeping the page visit's mark: see router)
  const close = arg => {
    const fromBack = arg === true;   // buttons pass their click event here — only the Back button passes true
    m.hidden = true; m.innerHTML = ''; m._close = null;
    // closed with its own buttons: drop the extra history step — unless another pop-up opened or the page changed meanwhile
    if (!fromBack) setTimeout(() => { if (m.hidden && history.state && history.state.gpModal && location.hash === openedHash) takeStepBack(openedHash); }, 0);
  };
  m._close = close;
  m.onclick = e => { if (e.target === m) close(); };
  mount && mount(m, close);
  return close;
}
export function confirmBox(msg, okLabel = 'OK', danger = false) {
  return new Promise(res => {
    modal(`<p class="msg">${msg}</p><div class="btns"><button class="btn" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="ok">${esc(okLabel)}</button></div>`,
      (m, close) => { m.querySelector('[data-x=no]').onclick = () => { close(); res(false); }; m.querySelector('[data-x=ok]').onclick = () => { close(); res(true); }; });
  });
}

// ---------- drag areas that still let the page scroll ----------
// Touching something draggable (grab(target, touch) true) blocks scrolling for that touch only — and the browser's
// pull-down-to-refresh with it; touching empty space scrolls as normal. While dragging near the top/bottom edge the
// page auto-scrolls, and a zoomed drawing that scrolls in its own box scrolls that box near its edges.
export function dragZone(box, grab) {
  box.style.touchAction = 'auto';
  const root = document.documentElement;
  box.addEventListener('touchstart', e => { if (grab(e.target, e.touches[0])) { e.preventDefault(); root.classList.add('dragging'); } }, { passive: false });
  const letGo = () => root.classList.remove('dragging');
  box.addEventListener('touchend', letGo); box.addEventListener('touchcancel', letGo);
  let last = null, raf = 0, onMove = null;
  const tick = () => {
    raf = 0; if (!last || !onMove) return;
    const H = window.innerHeight, top = 90, bot = H - 70;
    const step = (v, lo, hi) => v > hi ? Math.min(18, (v - hi) / 3 + 4) : v < lo ? -Math.min(18, (lo - v) / 3 + 4) : 0;
    let moved = false;
    if (box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1) {   // a zoomed drawing in its own scrolling box
      const r = box.getBoundingClientRect(), dx = step(last.clientX, r.left + 30, r.right - 30), dy = step(last.clientY, r.top + 30, r.bottom - 30);
      const x0 = box.scrollLeft, y0 = box.scrollTop; box.scrollLeft += dx; box.scrollTop += dy;
      moved = box.scrollLeft !== x0 || box.scrollTop !== y0;
    }
    const dy = step(last.clientY, top, bot);
    if (dy) { const y0 = window.scrollY; window.scrollBy(0, dy); if (window.scrollY !== y0) moved = true; }
    if (moved) { onMove(last); raf = requestAnimationFrame(tick); } else if (dy) raf = requestAnimationFrame(tick);
  };
  return {
    move(e, fn) { last = { clientX: e.clientX, clientY: e.clientY }; onMove = fn; if (!raf) raf = requestAnimationFrame(tick); },
    stop() { last = null; onMove = null; if (raf) cancelAnimationFrame(raf); raf = 0; letGo(); },
  };
}
// zooming a drawing you drag plants on: 1×, 2×, 3× (for this visit); the drawing then scrolls in its box
let zoomLv = 1;
export const plotZoom = () => zoomLv;
export function zoomBar(redraw) {
  A.zoom = el => { zoomLv = +el.dataset.z || 1; document.querySelectorAll('[data-act=zoom]').forEach(b => b.classList.toggle('on', +b.dataset.z === zoomLv)); redraw(); };
  return `<span class="muted small">${ui('search', 15)} Zoom</span><div class="seg zoom">${[1, 2, 3].map(z => `<button type="button" data-act="zoom" data-z="${z}" class="${z === zoomLv ? 'on' : ''}">${z}×</button>`).join('')}</div>`;
}
// after zooming: keep the middle of the drawing in view
export function centreZoom(box) {
  if (!box) return;
  box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2; box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
}

// ---------- bed drawings: compact first, so what's under them shows without scrolling; a toggle makes them full size ----------
let tallPlot = false;   // (for this visit)
export const plotMaxH = full => tallPlot ? full : Math.min(full, Math.max(140, Math.round(window.innerHeight * 0.28)));
export function plotSizeBtn() {
  A.plotSize = () => { tallPlot = !tallPlot; render(); };
  return `<button type="button" class="plotsz" data-act="plotSize" aria-pressed="${tallPlot}">${ui(tallPlot ? 'collapse' : 'expand', 16)}${tallPlot ? 'Smaller' : 'Bigger'}</button>`;
}
