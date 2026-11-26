// Shared pieces of the interface: pop-up dialogs, confirm boxes and drag areas that still let the page scroll.

import { $, esc } from './util.js';

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
// Touching something draggable (grab(target) true) blocks scrolling for that touch only;
// touching empty space scrolls as normal. While dragging near the top/bottom edge the page auto-scrolls.
export function dragZone(box, grab) {
  box.style.touchAction = 'auto';
  box.addEventListener('touchstart', e => { if (grab(e.target)) e.preventDefault(); }, { passive: false });
  let last = null, raf = 0, onMove = null;
  const tick = () => {
    raf = 0; if (!last || !onMove) return;
    const H = window.innerHeight, top = 90, bot = H - 70;
    const dy = last.clientY > bot ? Math.min(18, (last.clientY - bot) / 3 + 4) : last.clientY < top ? -Math.min(18, (top - last.clientY) / 3 + 4) : 0;
    if (dy) { const y0 = window.scrollY; window.scrollBy(0, dy); if (window.scrollY !== y0) onMove(last); raf = requestAnimationFrame(tick); }
  };
  return {
    move(e, fn) { last = { clientX: e.clientX, clientY: e.clientY }; onMove = fn; if (!raf) raf = requestAnimationFrame(tick); },
    stop() { last = null; onMove = null; if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
}
