// Your seeds & plants: the varieties you grow, each with its seed packet (front and back photos) to use again for every
// planting of it — most varieties belong to one seed company, so the packet says how to grow it — and crops of your
// own. Adding a variety of a crop the app doesn't know makes that crop too.

import { DB } from '../core/db.js';
import { compress, dropPhoto, hydrate } from '../core/photos.js';
import { A, render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal } from '../core/ui.js';
import { esc, todayStr, uid } from '../core/util.js';
import { CATALOG } from '../data/catalog.js';
import { crop, cropOptions, ic, likeSelect, newCropDialog, ownCropFields, readOwnCropFields } from './crops.js';

export const seedList = () => S.seeds || [];
export const seedFor = (cropId, variety) => seedList().find(s => s.cropId === cropId && (s.variety || '') === (variety || ''));
const usedBy = s => S.plantings.filter(p => p.cropId === s.cropId && (p.variety || '') === (s.variety || ''));

// data version 7: the varieties you'd typed in (customVarieties) and the packet photos taken for plantings become your
// seed library (a new garden starts without S.seeds, so this makes it)
export function migrateSeeds() {
  if (Array.isArray(S.seeds)) return;
  const list = [];
  const add = (cropId, variety) => {
    let e = list.find(s => s.cropId === cropId && s.variety === (variety || ''));
    if (!e) { e = { id: 'sd_' + uid(), cropId, variety: variety || '', maker: '', front: null, back: null, notes: '', added: S.created || todayStr() }; list.push(e); }
    return e;
  };
  for (const [cropId, names] of Object.entries(S.customVarieties || {})) for (const v of names || []) if (v) add(cropId, v);
  for (const p of S.plantings || []) {
    const ph = p.photos || {}; if (!p.cropId || (!ph.front && !ph.back)) continue;
    const e = add(p.cropId, p.variety); if (!e.front && !e.back) { e.front = ph.front || null; e.back = ph.back || null; }
  }
  S.seeds = list; delete S.customVarieties;
}
// a planting with a variety you hadn't listed: it joins your seeds (with its packet photos, if it has them)
export function rememberSeed(p) {
  if (!p.cropId) return;
  const ph = p.photos || {}, has = seedFor(p.cropId, p.variety);
  if (has) { if (!has.front && !has.back && (ph.front || ph.back)) { has.front = ph.front || null; has.back = ph.back || null; } return; }
  if (!p.variety && !ph.front && !ph.back) return;
  (S.seeds = S.seeds || []).push({ id: 'sd_' + uid(), cropId: p.cropId, variety: p.variety || '', maker: '', front: ph.front || null, back: ph.back || null, notes: '', added: todayStr() });
}

// ---------- add or edit ----------
export function seedDialog(entry, opts = {}) {
  const isNew = !entry;
  const d = entry ? Object.assign({}, entry) : { id: 'sd_' + uid(), cropId: opts.cropId || '', variety: '', maker: '', front: null, back: null, notes: '', added: todayStr() };
  const fresh = {}, gone = {};
  let newCrop = false;
  const slot = k => {
    const img = fresh[k] ? `<img src="${URL.createObjectURL(fresh[k])}" alt="">` : d[k] && !gone[k] ? `<img data-photo="${d[k]}" alt="">` : `<span>＋ ${k === 'front' ? 'Front' : 'Back'}</span>`;
    return `<label class="phslot ph">${img}<input type="file" accept="image/*" data-slot="${k}" hidden></label>${fresh[k] || (d[k] && !gone[k]) ? `<button type="button" class="link" data-rm="${k}">remove</button>` : ''}`;
  };
  modal('<div></div>', (m, close) => {
    const read = () => { const f = m.querySelector('#sdf'); if (!f) return; for (const n of ['variety', 'maker', 'notes']) d[n] = f[n].value.trim(); if (f.cropId.value !== '__new') d.cropId = f.cropId.value; d.cen = f.cen ? f.cen.value.trim() : ''; d.clike = f.like ? f.like.value : d.clike; d.cdays = f.cdays ? f.cdays.value : ''; if (f.tempLo) { d.tempLo = f.tempLo.value; d.tempHi = f.tempHi.value; d.tpDays = f.tpDays.value; } };
    const draw = () => {
      m.querySelector('.sheet').innerHTML = `<h3>${isNew ? 'Add seeds or plants' : 'Edit ' + esc(crop(d.cropId).en + (d.variety ? ' · ' + d.variety : ''))}</h3><form id="sdf" class="form">
        <label>Crop<select name="cropId"><option value="">Choose a crop…</option>${cropOptions(newCrop ? '' : d.cropId, true)}<option value="__new"${newCrop ? ' selected' : ''}>＋ A crop that isn’t listed…</option></select></label>
        ${newCrop ? `<label>Crop name<input name="cen" value="${esc(d.cen || '')}" placeholder="e.g. Salsify"></label>
          ${likeSelect(d.clike)}
          <label>Days to first harvest <small>(packet)</small><input name="cdays" type="number" inputmode="numeric" value="${esc(d.cdays || '')}" placeholder="as the crop it’s like"></label>${ownCropFields({ tempLo: d.tempLo, tempHi: d.tempHi, tpDays: d.tpDays })}` : ''}
        <div class="two"><label>Variety<input name="variety" value="${esc(d.variety)}" placeholder="as on the packet"></label><label>Seed company <small>(optional)</small><input name="maker" value="${esc(d.maker)}" placeholder="as on the packet"></label></div>
        <label>Seed packet<div class="phrow">${slot('front')}${slot('back')}</div><small>Front and back: used again for every planting of this variety.</small></label>
        <label>Notes <small>(optional)</small><textarea name="notes" rows="2">${esc(d.notes)}</textarea></label>
        <div class="btns">${isNew ? '' : '<button type="button" class="btn danger" data-x="del" data-own-confirm>Delete</button>'}<button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`;
      hydrate(m);
      const f = m.querySelector('#sdf');
      f.cropId.onchange = () => { read(); newCrop = f.cropId.value === '__new'; draw(); };
      f.onchange = async e => { const k = e.target.dataset && e.target.dataset.slot; if (!k || !e.target.files[0]) return; read(); fresh[k] = await compress(e.target.files[0]); delete gone[k]; draw(); };
      m.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { read(); const k = b.dataset.rm; if (fresh[k]) delete fresh[k]; else gone[k] = true; draw(); });
      m.querySelector('[data-x=no]').onclick = close;
      const del = m.querySelector('[data-x=del]');
      if (del) del.onclick = async () => {
        const n = usedBy(d).length;
        if (!await confirmBox(`Delete <b>${esc(crop(d.cropId).en)}${d.variety ? ' · ' + esc(d.variety) : ''}</b> from your seeds?${n ? `<br>${n === 1 ? 'The planting that uses it keeps' : `The ${n} plantings that use it keep`} the variety and packet photos.` : ''}`, 'Delete', true)) return;
        S.seeds = seedList().filter(s => s.id !== d.id); for (const k of ['front', 'back']) await dropPhoto(entry[k]);
        await save(); close(); render();
      };
      f.onsubmit = async e => {
        e.preventDefault(); read();
        if (newCrop) {
          if (!d.cen) return alert('Give the crop a name.');
          const cr = { id: 'c_' + uid(), en: d.cen, varieties: [], custom: true };   // the rest comes from the crop it's most like
          if (+d.cdays > 0) cr.daysHarvest = +d.cdays;
          if (!readOwnCropFields(m.querySelector('#sdf'), cr)) return;
          (S.customCrops = S.customCrops || []).push(cr); d.cropId = cr.id;
        }
        if (!d.cropId) return alert('Choose the crop.');
        const same = seedFor(d.cropId, d.variety);
        if (same && same.id !== d.id) return alert(`${crop(d.cropId).en}${d.variety ? ' · ' + d.variety : ''} is already in your seeds.`);
        for (const k of ['front', 'back']) {
          const old = entry && entry[k];
          if (fresh[k]) { d[k] = 'ph_' + uid(); await DB.putPhoto(d[k], fresh[k]); } else if (gone[k]) d[k] = null;
          if (old && old !== d[k]) setTimeout(() => dropPhoto(old), 0);   // after saving, if nothing else uses it
        }
        const rec = { id: d.id, cropId: d.cropId, variety: d.variety, maker: d.maker, front: d.front || null, back: d.back || null, notes: d.notes, added: d.added || todayStr() };
        S.seeds = seedList().filter(s => s.id !== d.id).concat(rec);
        await save(); close(); render();
        if (opts.onSave) opts.onSave(rec);
      };
    };
    draw();
  });
}

// ---------- the Seeds & plants tab ----------
export function seedsTab() {
  A.addSeed = () => seedDialog(null);
  A.editSeed = el => seedDialog(seedList().find(s => s.id === el.dataset.id));
  A.editCrop = el => newCropDialog(() => render(), (S.customCrops || []).find(c => c.id === el.dataset.id));
  A.delCrop = async el => {
    const id = el.dataset.id, n = S.plantings.filter(p => p.cropId === id).length;
    if (n) return alert(`${crop(id).en} is used in ${n} planting${n > 1 ? 's' : ''} — remove those first.`);
    if (!await confirmBox(`Delete the crop <b>${esc(crop(id).en)}</b> and its varieties?`, 'Delete', true)) return;
    S.customCrops = S.customCrops.filter(c => c.id !== id); S.seeds = seedList().filter(s => s.cropId !== id); await save(); render();
  };
  const crops = [...new Set([...seedList().map(s => s.cropId), ...(S.customCrops || []).map(c => c.id)])].map(crop).sort((a, b) => a.en.localeCompare(b.en));
  const thumb = s => s.front || s.back ? `<span class="ph seedph"><img data-photo="${s.front || s.back}" alt=""></span>` : '<span class="seedph none">🌱</span>';
  const own = id => (S.customCrops || []).some(c => c.id === id);
  return `<p class="hint">The varieties you grow, with their seed packets — choose one when planting and its packet comes with it. Add a crop the app doesn’t know the same way.</p>
    <button class="btn primary wide" data-act="addSeed">＋ Add seeds or plants</button>
    ${crops.length ? crops.map(c => { const ss = seedList().filter(s => s.cropId === c.id); return `<section><h3>${ic(c.id)} ${esc(c.en)}${own(c.id) ? ` <small class="muted">· your crop${c.like ? ', grown like ' + esc(crop(c.like).en.toLowerCase()) : ''}</small>` : ''}</h3>
      ${ss.length ? `<ul class="plist">${ss.map(s => { const n = usedBy(s).length; return `<li data-act="editSeed" data-id="${s.id}">${thumb(s)}<span class="grow"><b>${esc(s.variety || 'No variety named')}</b><small>${[s.maker, n ? `${n} planting${n > 1 ? 's' : ''}` : '', s.front || s.back ? 'packet ✓' : 'no packet photo yet'].filter(Boolean).map(esc).join(' · ')}</small></span>›</li>`; }).join('')}</ul>` : ''}
      ${own(c.id) ? `<button class="link" data-act="editCrop" data-id="${c.id}">edit this crop</button>${!c.like ? ' <small class="warn">· not linked to a crop it’s like yet: edit it to choose one</small>' : ''} <button class="link danger" data-act="delCrop" data-id="${c.id}" data-own-confirm>delete this crop</button>` : ''}</section>`; }).join('') : '<p class="muted">Nothing yet — add the seeds you have, or they’re added as you plant them.</p>'}
    <details class="fold"><summary>📚 Built-in crops <small>${CATALOG.length}</small></summary><ul class="plist">${CATALOG.map(c => `<li>${ic(c.id)}<span class="grow">${esc(c.en)}</span></li>`).join('')}</ul><p class="hint">Values are typical starting points — always check the packet.</p></details>`;
}
