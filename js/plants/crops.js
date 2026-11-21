// Crops: the built-in catalog plus your own crops and varieties, names in your language, crop icons.

import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { num, uid } from '../core/util.js';
import { CATALOG, FAMILIES } from '../data/catalog.js';
import { Icons } from '../data/icons.js';

// ---------- crops and varieties ----------
export const allCrops = () => CATALOG.concat(S.customCrops || []).map(dispCrop);
export const crop = id => allCrops().find(c => c.id === id) || (String(id).startsWith('x:') ? { id, en: String(id).slice(2), ja: '', color: '#8a9a7b', family: 'other' } : { id, en: 'Unknown crop', ja: '', color: '#6a9' });
export const cropName = id => { const c = crop(id); return c.ja ? `${c.en} (${c.ja})` : c.en; };
export const varieties = id => [...new Set([...(crop(id).varieties || []), ...(S.seeds || []).filter(s => s.cropId === id && s.variety).map(s => s.variety)])];
export const ic = (id, size = 22) => Icons.crop(id, size, crop(id).color);
export function newCropDialog(cb) {
  modal(`<h3>New crop</h3><form id="ncf" class="form">
    <label>English name<input name="en" required></label><label>Japanese name<input name="ja"></label>
    <label>Colour<input name="color" type="color" value="#5c9e48"></label>
    <label>Plant family<select name="family">${Object.entries(FAMILIES).map(([k, v]) => `<option value="${k}"${k === 'other' ? ' selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>
    <div class="two"><label>Days to earliest harvest<input name="daysHarvest" type="number" value="60"></label><label>Mature size (cm)<input name="spread" type="number" value="20"></label></div>
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Add crop</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#ncf').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const cr = { id: 'c_' + uid(), en: f.en.value.trim(), ja: f.ja.value.trim(), color: f.color.value, method: 'seed', layout: 'rows', depth: 1, rowSp: 20, sowSp: 5, thinStage: '', thinSp: null, daysThin: null, daysHarvest: num(f.daysHarvest), spread: num(f.spread), varieties: [], custom: true, family: f.family.value, sow: [] };
      S.customCrops.push(cr); await save(); close(); cb(cr.id);
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
