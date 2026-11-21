// One way to pick things everywhere: a drop-down list that opens right under the field (like on a website), for every
// select and every typed-with-suggestions field — instead of Android's full-screen picker or suggestions above the keyboard.
// And every delete asks first.

import { esc } from './util.js';

// ---------- the drop-down panel ----------
let ddOpen = null;
function ddClose() { if (ddOpen) { ddOpen.panel.remove(); ddOpen.anchor.classList.remove('dd-on'); ddOpen = null; } }
// items: [{ v, l, sub? }]; pick(v) when chosen; filter: show a search box (long lists)
function ddShow(anchor, items, current, pick, opts = {}) {
  ddClose();
  const panel = document.createElement('div'); panel.className = 'dd-panel';
  const list = document.createElement('div'); list.className = 'dd-list';
  const draw = q => {
    const ql = (q || '').trim().toLowerCase();
    const shown = items.filter(it => !ql || (it.l + ' ' + (it.sub || '') + ' ' + it.v).toLowerCase().includes(ql));
    list.innerHTML = shown.length ? shown.map(it => `<button type="button" class="dd-item${String(it.v) === String(current) ? ' on' : ''}" data-v="${esc(String(it.v))}">${esc(it.l)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')
      : `<p class="muted small dd-none">${opts.typed ? 'No matches — keep typing to use your own.' : 'No matches.'}</p>`;
    list.querySelectorAll('.dd-item').forEach(b => b.addEventListener('pointerdown', e => e.preventDefault()));   // keep focus in a typed field
    list.querySelectorAll('.dd-item').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const v = b.dataset.v; ddClose(); pick(v); });
  };
  let search = null;
  if (opts.filter) { search = document.createElement('input'); search.type = 'search'; search.className = 'dd-search'; search.placeholder = 'Search…'; search.oninput = () => draw(search.value); panel.appendChild(search); }
  panel.appendChild(list); document.body.appendChild(panel);
  // the box it scrolls with (a pop-up's sheet, or the page): if the field leaves it, the list closes
  let box = anchor.parentElement; while (box && box !== document.body && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
  // under the field (screen position, so it follows the field however it scrolls); above it if the keyboard or the
  // bottom of the screen leaves too little room — decided once, so it doesn't jump about while scrolling
  let up = null;
  const place = () => {
    const r = anchor.getBoundingClientRect(), vv = window.visualViewport, vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
    const clip = box && box !== document.body ? box.getBoundingClientRect() : { top: 0, bottom: vh };
    if (r.bottom < clip.top + 4 || r.top > clip.bottom - 4 || r.bottom < 0 || r.top > vh) return ddClose();
    const below = vh - r.bottom - 8, above = r.top - 8;
    if (up === null) up = below < 180 && above > below;
    const room = Math.max(140, Math.min(360, up ? above : below));
    panel.style.left = `${Math.max(8, r.left)}px`; panel.style.width = `${Math.min(r.width, window.innerWidth - 16)}px`; panel.style.maxHeight = `${room}px`;
    panel.style.top = up ? `${r.top - Math.min(panel.offsetHeight, room) - 4}px` : `${r.bottom + 4}px`;
  };
  ddOpen = { panel, anchor, draw, place }; anchor.classList.add('dd-on');
  draw(opts.query); place();
  const on = list.querySelector('.dd-item.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  return ddOpen;
}
// keep the list with its field when anything scrolls (the page, or a pop-up), but not when the list itself does
document.addEventListener('scroll', e => { if (ddOpen && !ddOpen.panel.contains(e.target)) ddOpen.place(); }, { capture: true, passive: true });
if (window.visualViewport) window.visualViewport.addEventListener('scroll', () => { if (ddOpen) ddOpen.place(); });
document.addEventListener('pointerdown', e => { if (ddOpen && !ddOpen.panel.contains(e.target) && e.target !== ddOpen.anchor && !ddOpen.anchor.contains(e.target)) ddClose(); }, true);
window.addEventListener('resize', () => { if (ddOpen && !(ddOpen.anchor.tagName === 'INPUT' && document.activeElement === ddOpen.anchor)) ddClose(); });
window.addEventListener('popstate', ddClose);

// ---------- selects become a field + drop-down ----------
const SEL_VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const SEL_INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
function enhanceSelect(sel) {
  if (sel.dataset.dd || sel.dataset.native != null || sel.multiple) return; sel.dataset.dd = '1';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-field' + (sel.classList.contains('sm') ? ' sm' : '');
  const label = () => { const o = sel.options[sel.selectedIndex]; btn.innerHTML = `<span>${esc(o ? o.textContent : '')}</span>`; btn.disabled = sel.disabled; };
  // code that sets .value / .selectedIndex directly keeps the field in step
  Object.defineProperty(sel, 'value', { configurable: true, get() { return SEL_VALUE.get.call(this); }, set(v) { SEL_VALUE.set.call(this, v); label(); } });
  Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return SEL_INDEX.get.call(this); }, set(v) { SEL_INDEX.set.call(this, v); label(); } });
  sel.classList.add('dd-hidden'); sel.tabIndex = -1; sel.after(btn); label();
  sel.addEventListener('change', label);
  btn.onclick = e => {
    e.preventDefault();
    if (ddOpen && ddOpen.anchor === btn) return ddClose();
    const items = [...sel.options].filter(o => !o.disabled && !o.hidden).map(o => ({ v: o.value, l: o.textContent }));
    ddShow(btn, items, sel.value, v => { SEL_VALUE.set.call(sel, v); label(); sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }, { filter: items.length > 12 });
  };
}

// ---------- typed fields with suggestions ----------
function enhanceList(inp) {
  const id = inp.getAttribute('list'); if (!id || inp.dataset.dd) return; inp.dataset.dd = '1'; inp.dataset.ddList = id; inp.removeAttribute('list'); inp.autocomplete = 'off';
  const items = () => { const dl = document.getElementById(inp.dataset.ddList); return dl ? [...dl.options].map(o => o.value).filter(Boolean).map(v => ({ v, l: v })) : []; };
  const open = all => {
    const its = items(); if (!its.length) return ddClose();
    const set = v => { inp.value = v; inp._ddMute = true; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp._ddMute = false; };
    if (ddOpen && ddOpen.anchor === inp) { ddOpen.draw(all ? '' : inp.value); ddOpen.place(); return; }
    ddShow(inp, its, inp.value, set, { query: all ? '' : inp.value, typed: true });
  };
  inp.classList.add('dd-typed');
  inp.addEventListener('focus', () => open(true));
  inp.addEventListener('click', () => { if (!ddOpen || ddOpen.anchor !== inp) open(true); });
  inp.addEventListener('input', () => { if (!inp._ddMute) open(false); });
  inp.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Tab') ddClose(); });
  inp.addEventListener('blur', () => setTimeout(() => { if (ddOpen && ddOpen.anchor === inp && document.activeElement !== inp) ddClose(); }, 150));
}
function enhanceAll(root = document) {
  root.querySelectorAll('select').forEach(enhanceSelect);
  root.querySelectorAll('input[list]').forEach(enhanceList);
}
new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && (n.matches('select') || n.matches('input[list]'))) enhanceAll(n.parentNode || document); else if (n.querySelector && n.querySelector('select, input[list]')) enhanceAll(n); } })
  .observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => enhanceAll());

// ---------- every delete asks first ----------
// Delete buttons whose own code already asks (with a more specific message) carry data-own-confirm or are listed here.
const OWN_CONFIRM = '[data-own-confirm], [data-act=del], [data-act=delCrop], [data-act=delDiary], [data-act=delArea]';
const DELETE_BTN = '[data-x=del], [data-delmix], [data-act^=del], [data-act^=rm], [data-del], [data-rmx]';
function deleteWhat(b) {
  const sheet = b.closest('.sheet'), h = sheet && sheet.querySelector('h3');
  if (b.dataset.what) return b.dataset.what;
  if (b.matches('[data-del]')) return 'this dose from the plan';
  if (b.matches('[data-rmx]')) return 'this planned feed';
  if (b.matches('[data-act=rmFert]')) return 'this fertiliser line';
  if (b.matches('[data-act=rmSeries]')) return 'this repeating job';
  if (b.matches('[data-act=rmPhoto]')) return 'this packet photo';
  if (b.matches('[data-delmix]')) return 'this potting-mix entry';
  if (b.matches('[data-act=delVar]')) return 'this variety';
  const t = h ? h.textContent.replace(/^[^\p{L}]+/u, '').replace(/^(Edit|Add|Record)\s+/i, '').replace(/\s*[—–-].*$/, '').trim() : '';
  return t ? `this ${t.toLowerCase()}` : 'this';
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest(DELETE_BTN);
  if (!b || b._delOK || b.matches(OWN_CONFIRM)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const host = b.closest('.btns, .btnrow, li, .frow, p, div') || b.parentNode;
  const old = host.parentNode && host.parentNode.querySelector(':scope > .delask'); if (old) old.remove();
  const ask = document.createElement('div'); ask.className = 'delask';
  ask.innerHTML = `<span>Delete ${esc(deleteWhat(b))}? This can’t be undone.</span><button type="button" class="btn small" data-k="no">Cancel</button><button type="button" class="btn small danger" data-k="yes">Delete</button>`;
  host.after(ask);
  ask.querySelector('[data-k=no]').onclick = ev => { ev.stopPropagation(); ask.remove(); };
  ask.querySelector('[data-k=yes]').onclick = ev => { ev.stopPropagation(); ask.remove(); b._delOK = true; try { b.click(); } finally { b._delOK = false; } };
  ask.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}, true);
