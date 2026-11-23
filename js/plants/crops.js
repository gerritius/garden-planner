// Crops: the built-in catalog plus your own crops and varieties, names in your language, crop icons.

import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { esc, num, uid } from '../core/util.js';
import { CATALOG, FAMILIES } from '../data/catalog.js';
import { Icons } from '../data/icons.js';

// ---------- crops and varieties ----------
// A crop of your own is linked to the catalogue crop it's most like (c.like): whatever you haven't given — spacing, sowing
// months, growth, feeding, care, pests — comes from that crop (read through, never copied into your data); what you
// gave from the packet wins. Spray registrations are the exception: they're legal per crop, so they never carry over.
const byId = id => CATALOG.find(c => c.id === id);
export const kin = id => { const o = (S && S.customCrops || []).find(c => c.id === id); return o && o.like && byId(o.like) ? o.like : id; };
function linked(c) {
  const base = c.like && byId(c.like);
  if (base && Object.getPrototypeOf(c) !== base) Object.setPrototypeOf(c, base);
  else if (!base && Object.getPrototypeOf(c) !== Object.prototype) Object.setPrototypeOf(c, Object.prototype);
  return c;
}
export const allCrops = () => CATALOG.concat((S.customCrops || []).map(linked)).map(dispCrop);
export const crop = id => allCrops().find(c => c.id === id) || (String(id).startsWith('x:') ? { id, en: String(id).slice(2), ja: '', color: '#8a9a7b', family: 'other' } : { id, en: 'Unknown crop', ja: '', color: '#6a9' });
// your crops (chosen when you start, or in Tools): shown first in crop lists, and what ideas and the sowing calendar are
// about. Crops of your own, and anything you're growing or have seeds of, always count. No choice made: every crop.
export const inUse = id => (S.plantings || []).some(p => p.cropId === id) || (S.starts || []).some(s => s.cropId === id && s.status === 'growing') || (S.seeds || []).some(s => s.cropId === id);
export const isMine = id => !Array.isArray(S.myCrops) || S.myCrops.includes(id) || (S.customCrops || []).some(c => c.id === id) || inUse(id);
export const myCrops = () => allCrops().filter(c => isMine(c.id));
// a crop drop-down's options: yours, then the rest under "Other crops" (all of them in one list until you've chosen)
export function cropOptions(selected, sort) {
  const opt = c => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.en)}${c.ja ? ' ' + esc(c.ja) : ''}</option>`;
  let all = allCrops(); if (sort) all = all.slice().sort((a, b) => a.en.localeCompare(b.en));
  if (!Array.isArray(S.myCrops)) return all.map(opt).join('');
  const mine = all.filter(c => isMine(c.id)), rest = all.filter(c => !isMine(c.id));
  return `<optgroup label="Your crops">${mine.map(opt).join('')}</optgroup>${rest.length ? `<optgroup label="Other crops">${rest.map(opt).join('')}</optgroup>` : ''}`;
}
export const cropName = id => { const c = crop(id); return c.ja ? `${c.en} (${c.ja})` : c.en; };
export const varieties = id => [...new Set([...(crop(id).varieties || []), ...(S.seeds || []).filter(s => s.cropId === id && s.variety).map(s => s.variety)])];
// its own icon, or one shaped like the crop named in its record (icon), or the crop it's like
export const ic = (id, size = 22) => { const c = crop(id); return Icons.crop(id, size, c.color, c.icon || c.like || kin(id)); };
// the fields every crop of your own needs: the crop it's most like (required — everything else comes from it unless you
// give it), and from its packet: growing temperatures (生育適温) and days to planting out
export const likeSelect = like => `<label>Most like <small>(it’s grown the same way: spacing, sowing months, feeding, care and pests come from it unless you give your own)</small><select name="like" required><option value="">Choose the closest crop…</option>${Object.entries(FAMILIES).map(([k, v]) => { const cs = CATALOG.filter(c => c.family === k); return cs.length ? `<optgroup label="${esc(v[0])}">${cs.map(c => `<option value="${c.id}"${c.id === like ? ' selected' : ''}>${esc(c.en)} ${esc(c.ja)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>`;
export const ownCropFields = (c = {}) => `<div class="two"><label>Grows best from (°C)<input name="tempLo" type="number" inputmode="decimal" step="0.5" value="${c.tempLo ?? ''}" placeholder="e.g. 15"></label><label>to (°C)<input name="tempHi" type="number" inputmode="decimal" step="0.5" value="${c.tempHi ?? ''}" placeholder="e.g. 25"></label></div>
  <small class="hint">The growing temperatures on the packet (生育適温). Without them, its dates count plain days — not slowed by the cold or sped up by warmth.</small>
  <label>Days from sowing to planting out <small>(if you raise it in trays; from the packet)</small><input name="tpDays" type="number" inputmode="numeric" min="1" max="200" value="${c.tpDays || ''}"></label>`;
export function readOwnCropFields(f, cr) {
  if (f.like) {
    if (!f.like.value) { alert('Choose the crop it’s most like — it’s grown the same way, so the app knows how to plan it.'); return false; }
    if (cr.like !== f.like.value) {   // (re)linked: what it was given as stand-ins before now comes from the crop it's like
      for (const k of ['method', 'layout', 'depth', 'rowSp', 'sowSp', 'thinStage', 'thinSp', 'daysThin', 'family', 'sow', 'sowRef', 'sowOwn']) delete cr[k];
      cr.like = f.like.value;
    }
  }
  const lo = num(f.tempLo.value), hi = num(f.tempHi.value);
  if ((lo != null || hi != null) && !(lo > 0 && hi > lo && hi <= 40)) { alert('Growing temperatures: from a lower to a higher number of °C, as on the packet (e.g. 15 to 25).'); return false; }
  cr.tempLo = lo; cr.tempHi = hi; cr.tpDays = num(f.tpDays.value) > 0 ? Math.round(num(f.tpDays.value)) : null;
  return true;
}
// a new crop of your own — or, given one, change it
export function newCropDialog(cb, edit) {
  const c = edit || {}, own = k => Object.prototype.hasOwnProperty.call(c, k) ? c[k] : '';
  modal(`<h3>${edit ? 'Edit ' + esc(c.en) : 'New crop'}</h3><form id="ncf" class="form">
    <div class="two"><label>English name<input name="en" required value="${esc(c.en || '')}"></label><label>Japanese name<input name="ja" value="${esc(c.ja || '')}"></label></div>
    ${likeSelect(c.like)}
    <div class="two"><label>Days to earliest harvest <small>(packet)</small><input name="daysHarvest" type="number" inputmode="numeric" value="${own('daysHarvest') || ''}" placeholder="as the crop it’s like"></label><label>Mature size (cm)<input name="spread" type="number" inputmode="numeric" value="${own('spread') || ''}" placeholder="as the crop it’s like"></label></div>
    ${ownCropFields(c)}
    <label>Colour <small>(optional)</small><input name="color" type="color" value="${own('color') || '#5c9e48'}"></label>
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">${edit ? 'Save' : 'Add crop'}</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    let colour = !!own('color'); m.querySelector('#ncf').color.oninput = () => { colour = true; };
    m.querySelector('#ncf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const cr = edit || { id: 'c_' + uid(), varieties: [], custom: true };
      if (!readOwnCropFields(f, cr)) return;
      cr.en = f.en.value.trim(); cr.ja = f.ja.value.trim();
      for (const k of ['daysHarvest', 'spread']) { const v = num(f[k].value); if (v > 0) cr[k] = v; else delete cr[k]; }   // blank: as the crop it's like
      if (colour) cr.color = f.color.value;
      if (!edit) S.customCrops.push(cr);
      await save(); close(); cb(cr.id);
    };
  });
}

// ---------- crop name language ----------
/* Bed jobs & notes, watering, germination, pick-by, pests, quick add, search, map, section drag, review, compare, crop-name language. */
const _disp = {};
function dispCrop(c) {
  if (!S || S.lang !== 'ja' || !c || !c.ja) return c;
  const k = c.id + '|' + c.en + '|' + c.ja;
  return _disp[k] || (_disp[k] = Object.assign(Object.create(Object.getPrototypeOf(c)), c, { en: c.ja, ja: c.en }));
}
