// Crops: the built-in catalog plus your own crops and varieties, names in your language, crop icons.

import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { esc, num, uid } from '../core/util.js';
import { CATALOG, FAMILIES } from '../data/catalog.js';
import { Icons } from '../data/icons.js';

// ---------- crops and varieties ----------
export const allCrops = () => CATALOG.concat(S.customCrops || []).map(dispCrop);
export const crop = id => allCrops().find(c => c.id === id) || (String(id).startsWith('x:') ? { id, en: String(id).slice(2), ja: '', color: '#8a9a7b', family: 'other' } : { id, en: 'Unknown crop', ja: '', color: '#6a9' });
export const cropName = id => { const c = crop(id); return c.ja ? `${c.en} (${c.ja})` : c.en; };
export const varieties = id => [...new Set([...(crop(id).varieties || []), ...(S.seeds || []).filter(s => s.cropId === id && s.variety).map(s => s.variety)])];
export const ic = (id, size = 22) => Icons.crop(id, size, crop(id).color);
// the fields every crop of your own needs, from its packet: growing temperatures (生育適温) and days to planting out
export const ownCropFields = (c = {}) => `<div class="two"><label>Grows best from (°C)<input name="tempLo" type="number" inputmode="decimal" step="0.5" value="${c.tempLo ?? ''}" placeholder="e.g. 15"></label><label>to (°C)<input name="tempHi" type="number" inputmode="decimal" step="0.5" value="${c.tempHi ?? ''}" placeholder="e.g. 25"></label></div>
  <small class="hint">The growing temperatures on the packet (生育適温). Without them, its dates count plain days — not slowed by the cold or sped up by warmth.</small>
  <label>Days from sowing to planting out <small>(if you raise it in trays; from the packet)</small><input name="tpDays" type="number" inputmode="numeric" min="1" max="200" value="${c.tpDays || ''}"></label>`;
export function readOwnCropFields(f, cr) {
  const lo = num(f.tempLo.value), hi = num(f.tempHi.value);
  if ((lo != null || hi != null) && !(lo > 0 && hi > lo && hi <= 40)) { alert('Growing temperatures: from a lower to a higher number of °C, as on the packet (e.g. 15 to 25).'); return false; }
  cr.tempLo = lo; cr.tempHi = hi; cr.tpDays = num(f.tpDays.value) > 0 ? Math.round(num(f.tpDays.value)) : null;
  return true;
}
// a new crop of your own — or, given one, change it
export function newCropDialog(cb, edit) {
  const c = edit || {};
  modal(`<h3>${edit ? 'Edit ' + esc(c.en) : 'New crop'}</h3><form id="ncf" class="form">
    <label>English name<input name="en" required value="${esc(c.en || '')}"></label><label>Japanese name<input name="ja" value="${esc(c.ja || '')}"></label>
    <label>Colour<input name="color" type="color" value="${c.color || '#5c9e48'}"></label>
    <label>Plant family<select name="family">${Object.entries(FAMILIES).map(([k, v]) => `<option value="${k}"${k === (c.family || 'other') ? ' selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>
    <div class="two"><label>Days to earliest harvest<input name="daysHarvest" type="number" value="${c.daysHarvest || 60}"></label><label>Mature size (cm)<input name="spread" type="number" value="${c.spread || 20}"></label></div>
    ${ownCropFields(c)}
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">${edit ? 'Save' : 'Add crop'}</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#ncf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const cr = edit || { id: 'c_' + uid(), method: 'seed', layout: 'rows', depth: 1, rowSp: 20, sowSp: 5, thinStage: '', thinSp: null, daysThin: null, varieties: [], custom: true };
      Object.assign(cr, { en: f.en.value.trim(), ja: f.ja.value.trim(), color: f.color.value, family: f.family.value, daysHarvest: num(f.daysHarvest), spread: num(f.spread) });
      if (!readOwnCropFields(f, cr)) return;
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
  return _disp[k] || (_disp[k] = Object.assign({}, c, { en: c.ja, ja: c.en }));
}
