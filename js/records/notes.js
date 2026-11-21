// Notes and photos: one note for crops and beds (photo optional), the photo diary, and photo timelines.

import { DB } from '../core/db.js';
import { compress, dropPhoto } from '../core/photos.js';
import { A, notFound, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal } from '../core/ui.js';
import { $, $$, daysBetween, esc, iso, niceDate, shortDate, todayStr, uid } from '../core/util.js';
import { container } from '../garden/garden.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { pestName, pestPicker, readPests } from '../plants/problems.js';

// ---------- photo diary ----------
const dayN = (p, date) => p.sowDate ? daysBetween(p.sowDate, date) : null;
export function pageDiary(p, eid) {
  if (!p) return { html: notFound() };
  const list = (p.diary || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const i = list.findIndex(d => d.id === eid), d = list[i];
  if (!d) return { html: notFound() };
  setChrome('Photo diary', { back: true, kicker: crop(p.cropId).en + (p.variety ? ' · ' + p.variety : '') });
  const n = dayN(p, d.date);
  A.saveDiary = async () => { const f = $('#def'); d.date = f.date.value || d.date; d.note = f.note.value.trim(); d.tags = readPests(f); await save(); history.back(); };
  A.delDiary = async () => {
    if (!await confirmBox('Delete this diary photo?', 'Delete', true)) return;
    if (d.photo) { const ph = d.photo; d.photo = null; await dropPhoto(ph); }
    p.diary = p.diary.filter(x => x.id !== d.id); await save(); history.back();
  };
  const nav = (j, l) => list[j] ? `<a class="btn small" href="#/plant/${p.id}/diary/${list[j].id}" onclick="location.replace(this.href);return false;">${l}</a>` : '<span></span>';
  const html = `${d.photo ? `<figure class="bigphoto ph"><img data-photo="${d.photo}" alt=""></figure>` : ''}
    <div class="dnav">${nav(i - 1, '‹ Older')}<span class="muted">${i + 1} / ${list.length}</span>${nav(i + 1, 'Newer ›')}</div>
    <p class="center dday">${niceDate(d.date)}${n != null && n >= 0 ? ` · day ${n} since ${p.method === 'seed' ? 'sowing' : 'planting'}` : ''}</p>
    <form id="def" class="form" onsubmit="return false"><label>Date<input type="date" name="date" value="${d.date}"></label>
      <label>Note<textarea name="note" rows="3">${esc(d.note || '')}</textarea></label>${pestPicker(d.tags || [])}</form>
    <div class="btnrow"><button class="btn danger" data-act="delDiary">Delete</button><button class="btn primary" data-act="saveDiary">Save</button></div>`;
  return { html };
}

// ---------- photo timeline per bed (or the whole garden) ----------
export function bedPhotos(cid) {
  const out = [];
  for (const p of S.plantings) if (!cid || p.containerId === cid) for (const d of p.diary || []) if (d.photo) out.push({ p, d });
  return out.sort((a, b) => (a.d.date < b.d.date ? -1 : a.d.date > b.d.date ? 1 : 0));
}
export function pageTimeline(q) {
  const c = container(q.get('c')), list = bedPhotos(c && c.id), i = q.get('i');
  setChrome(c ? c.name : 'All photos', { back: true, kicker: 'Photo timeline' });
  if (i != null && list[+i]) {
    const n = +i, { p, d } = list[n], url = j => `#/timeline?${c ? 'c=' + c.id + '&' : ''}i=${j}`;
    setTimeout(() => {
      const fig = $('#tlimg'); if (!fig) return; let x0 = null;
      fig.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      fig.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { const j = n + (dx < 0 ? 1 : -1); if (list[j]) location.replace(url(j)); } x0 = null; });
    });
    return { html: `<figure class="bigphoto ph" id="tlimg"><img data-photo="${d.photo}" alt=""></figure>
      <p class="center"><b>${niceDate(d.date)}</b> · ${ic(p.cropId)} ${esc(crop(p.cropId).en)}${!c ? ' · ' + esc((container(p.containerId) || {}).name || '') : ''} <small class="muted">day ${daysBetween(p.sowDate, d.date)}</small></p>
      ${d.note ? `<p class="center">${esc(d.note)}</p>` : ''}
      <div class="dnav">${list[n - 1] ? `<a class="btn small" href="${url(n - 1)}" onclick="location.replace(this.href);return false;">‹ Older</a>` : '<span></span>'}<span class="muted">${n + 1} / ${list.length}</span>${list[n + 1] ? `<a class="btn small" href="${url(n + 1)}" onclick="location.replace(this.href);return false;">Newer ›</a>` : '<span></span>'}</div>
      <p class="hint center">Swipe left or right.</p>` };
  }
  const groups = {}; list.forEach((x, j) => { const m = new Date(x.d.date + 'T00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }); (groups[m] = groups[m] || []).push([x, j]); });
  const html = list.length ? Object.entries(groups).map(([m, xs]) => `<h3 class="grp">${m}</h3><div class="tlgrid">${xs.map(([x, j]) => `<a href="#/timeline?${c ? 'c=' + c.id + '&' : ''}i=${j}"><img data-photo="${x.d.photo}" alt=""><small>${shortDate(x.d.date)} · ${esc(crop(x.p.cropId).en)}</small></a>`).join('')}</div>`).join('')
    : '<div class="empty-state">No diary photos yet.<br><small>Add them from a crop’s Photo diary.</small></div>';
  return { html };
}

// ---------- notes ----------
export function noteDialog(c, n) {
  if (!n) return noteEntryDialog({ c });
  const isNew = !n; n = n || { id: uid(), date: todayStr(), text: '' };
  modal(`<h3>${isNew ? 'Add bed note' : 'Edit note'}</h3><form id="nf" class="form"><label>Date<input type="date" name="date" value="${n.date}"></label>
    <label>Note<textarea name="text" rows="3" placeholder="e.g. Added 2 L compost and a handful of bokashi">${esc(n.text)}</textarea></label>
    <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { c.log = (c.log || []).filter(x => x.id !== n.id); await save(); close(); render(); };
    m.querySelector('#nf').onsubmit = async e => {
      e.preventDefault(); n.date = e.target.date.value || todayStr(); n.text = e.target.text.value.trim();
      if (!n.text) return close();
      if (isNew) (c.log = c.log || []).push(n);
      await save(); close(); render();
    };
  });
}
// t = { p } for a crop, { c } for a bed / pot
export function noteEntryDialog(t, blob, guess) {
  let photo = blob || null;
  const p = t.p, c = t.c || (p && container(p.containerId));
  const where = p ? `${crop(p.cropId).en}${c ? ' · ' + c.name : ''}` : c ? c.name : '';
  modal(`<h3>📝 Note</h3><p class="muted small">${esc(where)}</p>
    <form id="nef" class="form">
      <div class="notephoto"><label class="phslot ph" id="neph">${photo ? `<img src="${URL.createObjectURL(photo)}" alt="">` : '<span>📷 ＋ Photo<br><small>optional</small></span>'}<input type="file" accept="image/*" hidden></label></div>
      <label>Date<input type="date" name="date" value="${guess && guess <= todayStr() ? guess : todayStr()}" max="${todayStr()}"></label>
      <label>Note<textarea name="note" rows="3" placeholder="${p ? 'e.g. first true leaves, holes in leaves…' : 'e.g. added 2 L compost, soil very wet…'}"></textarea></label>
      ${p ? `<details><summary class="muted">🐛 Spotted a problem?</summary>${pestPicker()}</details>` : ''}
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#nef'), inp = m.querySelector('#neph input');
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      photo = await compress(file);
      m.querySelector('#neph').firstChild.replaceWith(Object.assign(document.createElement('img'), { src: URL.createObjectURL(photo), alt: '' }));
      if (file.lastModified) { const d = iso(new Date(file.lastModified)); if (d <= todayStr() && f.date.value === todayStr()) f.date.value = d; }
    };
    m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault();
      const note = f.note.value.trim(), tags = p ? readPests(f) : [], date = f.date.value || todayStr();
      if (!photo && !note && !tags.length) return close();
      let pid = null; if (photo) { pid = uid(); await DB.putPhoto(pid, photo); }
      if (p) (p.diary = p.diary || []).push({ id: uid(), date, photo: pid, note, tags });
      else (c.log = c.log || []).push({ id: uid(), date, text: note, photo: pid });
      await save(); close(); render();
    };
  });
}
// crop page photo diary: one add tile
export function diarySection(p) {
  const ds = (p.diary || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section><h3>Photo diary</h3><div class="diary">
    <button type="button" class="dthumb add" data-act="diaryNote"><span>＋<br>Note / photo</span></button>
    ${ds.map(d => { const n = dayN(p, d.date); return `<a class="dthumb ph${d.photo ? '' : ' txt'}" href="#/plant/${p.id}/diary/${d.id}">${d.photo ? `<img data-photo="${d.photo}" alt="">` : `<em>${esc(d.note || (d.tags || []).map(pestName).join(', '))}</em>`}${(d.tags || []).length ? '<i class="pestdot">🐛</i>' : ''}<span>${shortDate(d.date)}${n != null && n >= 0 ? ` · day ${n}` : ''}</span></a>`; }).join('')}
  </div></section>`;
}
export function diaryAfter(p) { A.diaryNote = () => noteEntryDialog({ p }); }
export function pagePhotos(p) {
  if (!p) return { html: notFound() };
  setChrome('Seed packet', { back: true, kicker: cropName(p.cropId) });
  const ph = p.photos || {};
  const slot = (k, l) => `<figure class="bigphoto ph">${ph[k] ? `<img data-photo="${ph[k]}" alt="${l}">` : `<label class="phslot big"><span>＋ Add ${l.toLowerCase()}</span><input type="file" accept="image/*" data-slot="${k}" hidden></label>`}<figcaption>${l}${ph[k] ? ` · <label class="link">replace<input type="file" accept="image/*" data-slot="${k}" hidden></label>` : ''}</figcaption></figure>`;
  const html = `<h2 class="ptitle">${esc(cropName(p.cropId))}</h2>${p.variety ? `<p class="center">${esc(p.variety)}</p>` : ''}${slot('front', 'Front')}${slot('back', 'Back')}<p class="hint center">Pinch to zoom.</p>`;
  const after = () => $$('input[data-slot]').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    const blob = await compress(f), k = inp.dataset.slot;
    p.photos = p.photos || {};
    const old = p.photos[k];
    const id = uid(); await DB.putPhoto(id, blob); p.photos[k] = id; if (old) await dropPhoto(old); await save(); render();
  }));
  return { html, after };
}
