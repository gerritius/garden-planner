// Variety notes: how each variety you grew did, across seasons.

import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { $, daysBetween, esc, shortDate } from '../core/util.js';
import { container, isPlanned } from '../garden/garden.js';
import { yearOfD } from '../garden/rotation.js';
import { harvestTotal } from '../records/log.js';
import { crop, ic } from './crops.js';
import { germText } from './germination.js';
import { pestName } from './problems.js';

const varKey = (c, v) => c + '|' + (v || '');
function varietyRuns(cropId, v) {
  return S.plantings.filter(p => p.cropId === cropId && (p.variety || '') === (v || '')).sort((a, b) => (a.sowDate < b.sowDate ? 1 : -1));
}
export function pageVariety(q) {
  const cid = q.get('c'), v = q.get('v') || '', cr = crop(cid);
  setChrome(v || 'No variety', { back: true, kicker: cr.en });
  const runs = varietyRuns(cid, v), k = varKey(cid, v), note = (S.varNotes || {})[k] || { rating: '', note: '' };
  A.rate = async el => { S.varNotes = Object.assign({}, S.varNotes, { [k]: Object.assign({}, note, { rating: note.rating === el.dataset.r ? '' : el.dataset.r }) }); await save(); render(); };
  A.saveVarNote = async () => { S.varNotes = Object.assign({}, S.varNotes, { [k]: Object.assign({}, note, { note: $('#vnote').value.trim() }) }); await save(); $('#vsaved').textContent = 'Saved ✓'; };
  const first = p => [...(p.harvests || []).map(h => h.date)].sort()[0];
  const row = p => {
    const c = container(p.containerId), fh = first(p), pests = [...new Set((p.diary || []).flatMap(d => d.tags || []))].map(pestName);
    return `<li><a href="#/plant/${p.id}"><span class="grow"><b>${shortDate(p.sowDate)} ${yearOfD(p.sowDate)}</b> · ${esc(c ? c.name : '')}${isPlanned(p) ? ' · planned' : ''}
      <small>${p.method === 'seed' ? 'sown' : 'planted'}${p.germ ? ` · ${esc(germText(p, true))}` : ''}${fh ? ` · first pick after ${daysBetween(p.sowDate, fh)} days` : ''}${harvestTotal(p) ? ` · ${harvestTotal(p)} picked` : ''}</small>
      ${pests.length ? `<small>Problems: ${esc(pests.join(', '))}</small>` : ''}</span>›</a></li>`;
  };
  const html = `<section><h3>Grow again?</h3><div class="seg">${[['yes', '👍 Yes'], ['maybe', '🤔 Maybe'], ['no', '👎 No']].map(([r, l]) => `<button type="button" data-act="rate" data-r="${r}" class="${note.rating === r ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="form">Notes<textarea id="vnote" rows="3" placeholder="Taste, vigour, bolting, how it handled the heat or cold…">${esc(note.note || '')}</textarea></label>
      <div class="btns"><span id="vsaved" class="muted"></span><button class="btn small primary" data-act="saveVarNote">Save note</button></div></section>
    <section><h3>Every time you’ve grown it (${runs.length})</h3><ul class="plist">${runs.map(row).join('') || '<li class="muted">Not grown yet.</li>'}</ul></section>`;
  return { html };
}
export function pageVarieties() {
  setChrome('Varieties', { back: true, kicker: 'Everything you’ve grown' });
  const seen = new Map();
  for (const p of S.plantings) { const k = varKey(p.cropId, p.variety); if (!seen.has(k)) seen.set(k, { cropId: p.cropId, v: p.variety || '', n: 0, last: '' }); const e = seen.get(k); e.n++; if ((p.sowDate || '') > e.last) e.last = p.sowDate; }
  const list = [...seen.values()].sort((a, b) => crop(a.cropId).en.localeCompare(crop(b.cropId).en) || a.v.localeCompare(b.v));
  const icon = r => r === 'yes' ? '👍' : r === 'no' ? '👎' : r === 'maybe' ? '🤔' : '';
  const html = `<ul class="plist">${list.map(e => { const nt = (S.varNotes || {})[varKey(e.cropId, e.v)] || {}; return `<li><a href="#/variety?c=${encodeURIComponent(e.cropId)}&v=${encodeURIComponent(e.v)}">${ic(e.cropId)}<span class="grow"><b>${esc(crop(e.cropId).en)}</b> · ${esc(e.v || 'no variety')} ${icon(nt.rating)}<small>grown ${e.n}× · last ${shortDate(e.last)} ${yearOfD(e.last) || ''}${nt.note ? ' · ' + esc(nt.note.slice(0, 60)) : ''}</small></span>›</a></li>`; }).join('') || '<li class="muted">Nothing grown yet.</li>'}</ul>`;
  return { html };
}
