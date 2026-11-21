// Search, and Quick add.

import { setChrome, setLastRoute } from '../core/router.js';
import { S } from '../core/state.js';
import { modal } from '../core/ui.js';
import { $, esc, go, shortDate } from '../core/util.js';
import { CATALOG, FAMILIES } from '../data/catalog.js';
import { feedDialog } from '../feeding/plans.js';
import { container, isLive, planting } from '../garden/garden.js';
import { BED_ICON, bedTaskDialog, taskDialog, taskLi, taskVisible } from '../garden/tasks.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { pestName } from '../plants/problems.js';
import { startDialog } from '../plants/seedlings.js';
import { harvestDialog, logDialog, logKind, logWhere } from '../records/log.js';
import { noteEntryDialog } from '../records/notes.js';
import { purchaseDialog } from '../records/review.js';

// ---------- search ----------
export function pageSearch(q) {
  setChrome('Search', { tab: 'search', kicker: 'Crops, varieties, notes, pests' });
  const term = (q.get('q') || '').trim();
  const html = `<form id="sf" class="searchrow" onsubmit="return false"><input id="sq" type="search" value="${esc(term)}" placeholder="e.g. 夏楽天, aphids, compost…" enterkeyhint="search" autocomplete="off"></form><div id="sres"></div>`;
  const run = () => {
    const t = $('#sq').value.trim().toLowerCase(); const out = $('#sres');
    history.replaceState(null, '', '#/search' + (t ? '?q=' + encodeURIComponent(t) : ''));
    setLastRoute(location.hash);
    if (t.length < 1) { out.innerHTML = '<p class="muted center">Type to search everything you’ve recorded.</p>'; return; }
    const has = s => String(s || '').toLowerCase().includes(t);
    const hl = s => esc(s).replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), x => `<mark>${x}</mark>`);
    const raw = id => CATALOG.concat(S.customCrops || []).find(c => c.id === id) || {};
    const pl = S.plantings.filter(p => { const c = raw(p.cropId); return has(c.en) || has(c.ja) || has(p.variety) || has(p.notes) || has(FAMILIES[c.family] && FAMILIES[c.family].join(' ')); });
    const di = []; S.plantings.forEach(p => (p.diary || []).forEach(d => { if (has(d.note) || (d.tags || []).some(k => has(pestName(k)))) di.push([p, d]); }));
    const bn = []; S.containers.forEach(c => { if (has(c.name) || has(c.notes)) bn.push([c, null]); (c.log || []).forEach(n => { if (has(n.text)) bn.push([c, n]); }); });
    const jb = S.tasks.filter(x => has(x.title) && taskVisible(x)).slice(0, 40);
    const lg = (S.log || []).filter(e => has(e.product) || has(e.text) || has(logKind(e.kind)[2])).sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 40);
    S.containers.forEach(c => (c.history || []).forEach(h => { if (h.manual && (has(cropName(h.cropId)) || has(h.variety) || has(h.note))) bn.push([c, { text: `Past crop: ${cropName(h.cropId)}${h.variety ? ' · ' + h.variety : ''}${h.note ? ' — ' + h.note : ''}`, date: h.harvestedOn }]); }));
    const sec = (h, body) => body ? `<h3>${h}</h3>${body}` : '';
    out.innerHTML = (pl.length + di.length + bn.length + jb.length + lg.length) ? [
      sec('Plantings', pl.length && `<ul class="plist">${pl.map(p => `<li><a href="#/plant/${p.id}">${ic(p.cropId)}<span class="grow">${hl(cropName(p.cropId))}${p.variety ? ' · ' + hl(p.variety) : ''}<small>${esc((container(p.containerId) || {}).name || '')} · ${p.status === 'harvested' ? 'harvested ' + shortDate(p.harvestedOn) : 'sown ' + shortDate(p.sowDate)}</small></span>›</a></li>`).join('')}</ul>`),
      sec('Diary', di.length && `<ul class="plist">${di.map(([p, d]) => `<li><a href="#/plant/${p.id}/diary/${d.id}">${ic(p.cropId)}<span class="grow">${hl(d.note || '')}${(d.tags || []).length ? ` <small>${d.tags.map(k => hl(pestName(k))).join(', ')}</small>` : ''}<small>${esc(crop(p.cropId).en)} · ${shortDate(d.date)}</small></span>›</a></li>`).join('')}</ul>`),
      sec('Beds & notes', bn.length && `<ul class="plist">${bn.map(([c, n]) => `<li><a href="#/container/${c.id}">${BED_ICON(22)}<span class="grow">${n ? hl(n.text) : hl(c.name)}<small>${esc(c.name)}${n ? ' · ' + shortDate(n.date) : ''}</small></span>›</a></li>`).join('')}</ul>`),
      sec('Jobs', jb.length && `<ul class="tasks">${jb.map(x => taskLi(x)).join('')}</ul>`),
      sec('Running log', lg.length && `<ul class="plist log">${lg.map(e => { const k = logKind(e.kind); return `<li><a href="#/log"><span class="lic">${k[1]}</span><span class="grow">${hl(k[2] + (e.product ? ': ' + e.product : ''))}${e.text ? `<small>${hl(e.text)}</small>` : ''}<small>${shortDate(e.date)} · ${esc(logWhere(e))}</small></span>›</a></li>`; }).join('')}</ul>`),
    ].join('') : '<p class="muted center">Nothing found.</p>';
  };
  return { html, after: () => { const i = $('#sq'); i.addEventListener('input', run); run(); if (!term) i.focus(); } };
}

// ---------- quick add ----------
// quick add: six tiles; the rest under More
export function quickAdd() {
  const q = (k, i, l) => `<button class="tile" data-q="${k}"><span>${i}</span>${l}</button>`;
  const main = `<h3>Quick add</h3><div class="tiles qa3">${q('note', '📝', 'Note / photo')}${q('harvest', '🧺', 'Harvest')}${q('feed', '🌿', 'Feed')}${q('job', '✓', 'Job')}${q('start', '🌱', 'Seedlings')}${q('more', '⋯', 'More')}</div>`;
  const more = `<h3>Quick add — more</h3><div class="tiles qa3">${q('log', '📋', 'Log something')}${q('buy', '💴', 'Purchase')}${q('doctor', '🩺', 'Something wrong?')}${q('bed', '＋', 'New bed or pot')}${q('seedlings', '🪴', 'My seedlings')}</div>`;
  const links = { doctor: '#/doctor', bed: '#/container/new', seedlings: '#/seedlings' };
  const wire = (m, close) => {
    m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const k = b.dataset.q;
      if (k === 'more') { m.querySelector('.sheet').innerHTML = more; return wire(m, close); }
      if (links[k]) { close(); return go(links[k]); }
      if (k === 'log') return logDialog();
      if (k === 'start') return startDialog();
      if (k === 'buy') return purchaseDialog();
      pickPlanting(k);
    });
  };
  modal(main, wire);
}
function pickPlanting(what) {
  const act = S.plantings.filter(isLive);
  const label = { harvest: 'Log a harvest for…', photo: 'Note / photo for…', note: 'Note / photo for…', job: 'Add a job for…', feed: 'Record feeding for…' }[what];
  const beds = what === 'job' || what === 'feed' || what === 'note' || what === 'photo' ? S.containers : [];
  modal(`<h3>${label}</h3>${act.length ? `<ul class="plist">${act.map(p => `<li data-p="${p.id}">${ic(p.cropId)}<span class="grow">${esc(cropName(p.cropId))}<small>${esc((container(p.containerId) || {}).name || '')}${p.variety ? ' · ' + esc(p.variety) : ''}</small></span>›</li>`).join('')}</ul>` : '<p class="muted">Nothing growing yet.</p>'}
    ${beds.length ? `<h3>…or a bed / pot</h3><ul class="plist">${beds.map(c => `<li data-c="${c.id}">${BED_ICON(22)}<span class="grow">${esc(c.name)}</span>›</li>`).join('')}</ul>` : ''}
    <div class="btns"><button class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-p]').forEach(li => li.onclick = () => {
      const p = planting(li.dataset.p);
      if (what === 'harvest') return harvestDialog(p);
      if (what === 'note' || what === 'photo') return noteEntryDialog({ p });
      if (what === 'job') return taskDialog(null, p);
      if (what === 'feed') return feedDialog({ pids: [p.id] });
    });
    m.querySelectorAll('[data-c]').forEach(li => li.onclick = () => {
      const c = container(li.dataset.c);
      if (what === 'feed') return feedDialog({ cids: [c.id] });
      if (what === 'note' || what === 'photo') return noteEntryDialog({ c });
      bedTaskDialog(c);
    });
  });
}
