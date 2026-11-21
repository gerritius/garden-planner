// Past crops: what grew where before you used the app.

import { A, render } from '../core/router.js';
import { save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { esc, iso, shortDate, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { planting } from '../garden/garden.js';
import { FEED_LABEL, feedOf } from '../garden/soil.js';
import { allCrops, cropName, ic } from '../plants/crops.js';
import { harvestTotal } from './log.js';

const ymLabel = d => d ? new Date(d.slice(0, 7) + '-01T00:00').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : '?';
export const histWhen = h => h.manual ? `finished ${ymLabel(h.harvestedOn)}` : `harvested ${shortDate(h.harvestedOn)}`;
const histSpan = h => h.manual ? `${h.sowDate ? ymLabel(h.sowDate) + ' → ' : ''}${ymLabel(h.harvestedOn)}` : `${shortDate(h.sowDate)} → ${shortDate(h.harvestedOn)}`;
function lastDayOf(ym) { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m, 0)); }
export function pastCropDialog(c, h, preset) {
  const isNew = !h, L = Draw.dims(c).L, bed = c.type === 'bed';
  h = h || Object.assign({ id: 'h_' + uid(), manual: true, cropId: '', variety: '', from: 0, to: L, sowDate: '', harvestedOn: '', note: '' }, preset || {});
  const other = h.cropId && h.cropId.startsWith('x:');
  const opts = allCrops().slice().sort((a, b) => a.en.localeCompare(b.en));
  const thisM = todayStr().slice(0, 7);
  modal(`<h3>${isNew ? 'Add a past crop' : 'Edit past crop'}</h3>
    <p class="muted small">For crops grown in ${esc(c.name)} before you used this app. Used for the rotation check.</p>
    <form id="pcf" class="form">
      <label>Crop<select name="crop" required><option value="">Choose…</option>${opts.map(o => `<option value="${o.id}"${o.id === h.cropId ? ' selected' : ''}>${esc(o.en)}${o.ja ? ' ' + esc(o.ja) : ''}</option>`).join('')}<option value="__other"${other ? ' selected' : ''}>Something else…</option></select></label>
      <div id="pco"${other ? '' : ' hidden'}><label>Name<input name="oname" value="${other ? esc(h.cropId.slice(2)) : ''}" placeholder="e.g. Okra"></label>
        <label>How hungry is it?<select name="feed">${[['', 'Not sure'], ['heavy', 'Heavy feeder'], ['medium', 'Medium feeder'], ['light', 'Light feeder'], ['legume', 'Legume (beans, peas)']].map(([v, l]) => `<option value="${v}"${(h.feed || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label>Variety <small class="muted">(optional)</small><input name="variety" value="${esc(h.variety || '')}"></label>
      <div class="two"><label>Planted <small class="muted">(optional)</small><input name="start" type="month" max="${thisM}" value="${h.sowDate ? h.sowDate.slice(0, 7) : ''}"></label>
        <label>Finished<input name="end" type="month" max="${thisM}" required value="${h.harvestedOn ? h.harvestedOn.slice(0, 7) : ''}"></label></div>
      ${bed ? `<div class="two"><label>From (cm)<input name="from" type="number" inputmode="numeric" value="${h.from}"></label><label>To (cm)<input name="to" type="number" inputmode="numeric" value="${h.to}"></label></div><small class="hint">Leave 0–${L} if it filled the whole bed.</small>` : ''}
      <label>Notes <small class="muted">(optional)</small><textarea name="note" rows="2" placeholder="e.g. good crop, blossom end rot late in the season">${esc(h.note || '')}</textarea></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('#pcf');
    f.crop.onchange = () => { m.querySelector('#pco').hidden = f.crop.value !== '__other'; };
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { c.history = (c.history || []).filter(x => x !== h); await save(); close(); render(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      let id = f.crop.value;
      if (id === '__other') { const n = f.oname.value.trim(); if (!n) return alert('Type the crop’s name.'); id = 'x:' + n; }
      if (f.start.value && f.start.value > f.end.value) return alert('“Planted” should be before “Finished”.');
      const from = bed ? Math.max(0, Math.min(L, +f.from.value || 0)) : 0, to = bed ? Math.max(from + 1, Math.min(L, +f.to.value || L)) : L;
      h.feed = id.startsWith('x:') ? f.feed.value : '';
      Object.assign(h, { cropId: id, variety: f.variety.value.trim(), sowDate: f.start.value ? f.start.value + '-01' : '', harvestedOn: lastDayOf(f.end.value), from, to, note: f.note.value.trim() });
      if (isNew) (c.history = c.history || []).push(h);
      await save(); close(); render();
    };
  });
}
export function historySection(c) {
  const hist = (c.history || []).slice().sort((a, b) => ((a.harvestedOn || '') < (b.harvestedOn || '') ? 1 : -1));
  A.addPast = () => pastCropDialog(c);
  A.editPast = el => pastCropDialog(c, (c.history || []).find(x => x.id === el.dataset.id));
  return `<section><h3>History</h3>${hist.length ? `<ul class="plist">${hist.map(h => {
    const body = `${ic(h.cropId)}<span class="grow">${esc(cropName(h.cropId))}${h.variety ? ' · ' + esc(h.variety) : ''}<small>${histSpan(h)}${(() => { const hp = !h.manual && planting(h.plantingId); const n = hp ? harvestTotal(hp) : 0; return n ? ` · ${n} picked` : ''; })()}${c.type === 'bed' ? ` · ${h.from}–${h.to} cm` : ''}${h.manual ? ' · before the app' : ''}${feedOf(h.cropId, h) ? ' · ' + FEED_LABEL[feedOf(h.cropId, h)] : ''}</small>${h.note ? `<small>${esc(h.note)}</small>` : ''}</span>`;
    return h.manual ? `<li data-act="editPast" data-id="${h.id}">${body}<span class="muted">✎</span></li>` : `<li><a href="#/plant/${h.plantingId}">${body}›</a></li>`;
  }).join('')}</ul>` : '<p class="muted">Nothing recorded yet.</p>'}
    <button class="btn small" data-act="addPast">＋ Add a past crop</button></section>`;
}
