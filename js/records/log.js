// The running log: a journal of everything done (feeds, sprays, harvests, jobs), and the log dialog.

import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { $, daysBetween, esc, niceDate, shortDate, todayStr, uid, unitOpts } from '../core/util.js';
import { amtFor } from '../feeding/nutrients.js';
import { container, isLive, planting } from '../garden/garden.js';
import { BED_ICON, taskOwner } from '../garden/tasks.js';
import { coverLogItems } from '../plants/covers.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { germChecks, pctText } from '../plants/germination.js';
import { pestName } from '../plants/problems.js';
import { startLogItems } from '../plants/seedlings.js';
import { myProducts, product } from '../products/library.js';
import { sprayBanner, sprayRule, usesSoFar, waitText } from '../products/sprays.js';
import { ui } from '../data/ui-icons.js';

// ---------- running log ----------
const LOG_KINDS = [
  ['fert', ui('feed'), 'Fertilised'], ['spray', ui('spray'), 'Sprayed'], ['water', ui('water'), 'Watered'], ['weed', ui('weed'), 'Weeded'],
  ['soil', ui('trowel'), 'Soil / compost'], ['cover', ui('net'), 'Net / cover'], ['pest', ui('bug'), 'Pest check'], ['other', ui('edit'), 'Other'],
];
const LOG_FILTERS = [['all', 'All'], ['fert', 'Fertiliser'], ['spray', 'Sprays'], ['water', 'Watering'], ['job', 'Jobs'], ['harvest', 'Harvests'], ['sow', 'Sowing'], ['note', 'Notes & diary']];
export const logKind = k => LOG_KINDS.find(x => x[0] === k) || LOG_KINDS[LOG_KINDS.length - 1];
const kindOfTitle = s => /fertil|feed|bokashi|manure|side-dress/i.test(s) ? 'fert' : /spray|insecticide|fungicide|neem|bt\b/i.test(s) ? 'spray' : /lime|compost|dig/i.test(s) ? 'soil' : 'job';
export const KIND_ICON = { fert: ui('feed'), spray: ui('spray'), water: ui('water'), soil: ui('trowel'), job: ui('check'), harvest: ui('basket'), sow: ui('sprout'), note: ui('note'), diary: ui('camera'), weed: ui('weed'), cover: ui('net'), pest: ui('bug'), other: ui('edit'), done: ui('flag') };
const filterOf = k => ['diary', 'pest', 'note'].includes(k) ? 'note' : ['weed', 'cover', 'other', 'done', 'job'].includes(k) ? 'job' : k;
export function logWhere(e) {
  const ps = (e.pids || []).map(planting).filter(Boolean), cs = (e.cids || []).map(container).filter(Boolean);
  if (!ps.length && !cs.length) return 'Whole garden';
  return [...cs.map(c => c.name), ...ps.map(p => crop(p.cropId).en + (container(p.containerId) && !cs.includes(container(p.containerId)) ? ` (${container(p.containerId).name})` : ''))].join(', ');
}
// every record that says "something was done on this day"
export function logFeed() {
  const td = todayStr(), out = [];
  for (const e of S.log || []) {
    const k = logKind(e.kind), amt = amtFor(e.product, e.amount, e.unit);
    out.push({ date: e.date, kind: e.kind, icon: k[1], title: `${k[2]}${e.product ? ': ' + e.product : ''}${amt ? ' · ' + amt : ''}${e.per === 'total' && amt ? ' in total' : ''}${+e.phi > 0 ? ` · ${e.phi}-day wait` : ''}`, sub: logWhere(e), text: e.text, act: 'editLog', id: e.id,
      cids: [...(e.cids || []), ...(e.pids || []).map(id => (planting(id) || {}).containerId)], pids: e.pids || [], all: !(e.cids || []).length && !(e.pids || []).length });
  }
  for (const t of S.tasks) {
    if (!t.done || !t.doneOn || t.startId) continue;
    const { p, c } = taskOwner(t);
    if (t.kind === 'germ' && p && t.look && germChecks(p).length) continue;   // the look itself is listed with the planting
    if (t.kind === 'frost') { out.push({ date: t.doneOn, kind: 'cover', title: t.title, sub: (t.cids || []).map(id => (container(id) || {}).name).filter(Boolean).join(', '), cids: t.cids || [], pids: [] }); continue; }
    if (t.kind === 'wx') { out.push({ date: t.doneOn, kind: t.wx === 'wind' ? 'cover' : 'job', title: t.title, sub: 'Weather', all: true, cids: [], pids: [] }); continue; }
    if (t.kind === 'water') { out.push({ date: t.doneOn, kind: 'water', title: t.title || 'Watered pots & bags', sub: t.note || '', all: !t.containerId, cids: t.containerId ? [t.containerId] : [] }); continue; }
    const k = t.kind === 'series' || t.kind === 'custom' || t.containerId ? kindOfTitle(t.title) : t.kind === 'germ' ? 'note' : 'job';
    out.push({ date: t.doneOn, kind: k, title: t.title, sub: p ? crop(p.cropId).en + (c ? ' · ' + c.name : '') : c ? c.name : '', href: p ? '#/plant/' + p.id : c ? '#/container/' + c.id : null, cids: c ? [c.id] : [], pids: p ? [p.id] : [] });
  }
  for (const p of S.plantings) {
    const c = container(p.containerId), where = c ? c.name : '', cids = c ? [c.id] : [], pids = [p.id], href = '#/plant/' + p.id, n = crop(p.cropId).en;
    if (p.sowDate && p.sowDate <= td && !p.startId) out.push({ date: p.sowDate, kind: 'sow', title: `${p.method === 'seed' ? 'Sowed' : 'Planted'} ${n}${p.variety ? ' · ' + p.variety : ''}`, sub: where + (c && c.type === 'bed' ? ` · ${p.from}–${p.to} cm` : ''), href, cids, pids });
    for (const k of germChecks(p)) out.push({ date: k.date, kind: 'note', title: `${n}: ${pctText(k).replace(/^patchy$/, 'came up patchy')}`, sub: where, href, cids, pids });
    for (const h of p.harvests || []) out.push({ date: h.date, kind: 'harvest', title: `Picked ${h.count} ${n}`, sub: where + (h.note ? ' · ' + h.note : ''), href, cids, pids });
    for (const d of p.diary || []) out.push({ date: d.date, kind: (d.tags || []).length ? 'pest' : d.photo ? 'diary' : 'note', title: d.note || (d.tags || []).map(pestName).join(', ') || 'Photo', sub: n + (where ? ' · ' + where : '') + ((d.tags || []).length && d.note ? ' · ' + d.tags.map(pestName).join(', ') : ''), href: `#/plant/${p.id}/diary/${d.id}`, photo: d.photo, cids, pids });
    if (p.status === 'harvested' && p.harvestedOn) out.push({ date: p.harvestedOn, kind: 'done', title: `Finished ${n}`, sub: where, href, cids, pids });
  }
  try { out.push(...startLogItems()); } catch (e) { console.warn(e); }
  try { out.push(...coverLogItems()); } catch (e) { console.warn(e); }
  for (const c of S.containers) for (const nt of c.log || []) out.push({ date: nt.date, kind: 'note', title: nt.text, sub: c.name, href: '#/container/' + c.id, cids: [c.id], pids: [] });
  return out.filter(x => x.date).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
const logLi = x => `<li class="logi"${x.act ? ` data-act="${x.act}" data-id="${x.id}"` : ''}>${x.href ? `<a href="${x.href}">` : '<div class="lrow">'}<span class="lic">${x.icon || KIND_ICON[x.kind] || '•'}</span>
  <span class="grow"><b>${esc(x.title)}</b>${x.text ? `<span class="ltext">${esc(x.text)}</span>` : ''}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>${x.photo ? `<img class="lph" data-photo="${x.photo}" alt="">` : ''}${x.href ? '</a>' : x.act ? '<span class="muted">✎</span></div>' : '</div>'}</li>`;
function logDays(items) {
  const td = todayStr(); let lastM = '', html = '';
  const by = {}; items.forEach(x => (by[x.date] = by[x.date] || []).push(x));
  for (const d of Object.keys(by).sort().reverse()) {
    const m = new Date(d + 'T00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    if (m !== lastM) { html += `<h2 class="month">${m}</h2>`; lastM = m; }
    const n = daysBetween(d, td);
    html += `<section class="day${d === td ? ' is-today' : ''}"><h3>${new Date(d + 'T00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}${n === 0 ? ' · today' : n === 1 ? ' · yesterday' : ''}</h3><ul class="plist log">${by[d].map(logLi).join('')}</ul></section>`;
  }
  return html;
}
export function pageLog(q) {
  const f = q.get('f') || 'all', cid = q.get('c') || '', lim = +q.get('n') || 120;
  setChrome('Running log', { back: true, tab: 'cal', kicker: 'Everything done in the garden' });
  let items = logFeed().filter(x => x.date <= todayStr());
  if (f !== 'all') items = items.filter(x => filterOf(x.kind) === f);
  if (cid) items = items.filter(x => x.all || (x.cids || []).includes(cid));
  const shown = items.slice(0, lim);
  const url = o => { const u = new URLSearchParams({ f, c: cid }); for (const k in o) u.set(k, o[k]); [...u.keys()].forEach(k => { if (!u.get(k) || u.get(k) === 'all') u.delete(k); }); return '#/log' + (u.toString() ? '?' + u : ''); };
  A.newLog = () => logDialog(null, cid ? { cids: [cid] } : {});
  A.editLog = el => logDialog((S.log || []).find(e => e.id === el.dataset.id));
  A.more = () => location.replace(url({ n: lim + 200 }));
  const html = `<div class="btnrow"><button class="btn primary grow" data-act="newLog">${ui('note', 18)} Log something</button><a class="btn" href="#/totals">${ui('chart', 18)} Totals</a></div>
    <div class="sowchips filt">${LOG_FILTERS.map(([k, l]) => `<a class="chip big${k === f ? ' on' : ''}" href="${url({ f: k, n: '' })}" onclick="location.replace(this.href);return false;">${l}</a>`).join('')}</div>
    <label class="inline">Bed / pot <select id="logc"><option value="">All</option>${S.containers.map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${shown.length ? logDays(shown) : '<div class="empty-state">Nothing logged yet.<br><small>Ticked jobs, harvests, sowings, notes and anything you log here all show up by day.</small></div>'}
    ${items.length > lim ? '<button class="btn wide" data-act="more">Show older</button>' : ''}
    <button class="fab" data-act="newLog" aria-label="Log something">＋</button>`;
  return { html, after: () => { $('#logc').onchange = e => location.replace(url({ c: e.target.value, n: '' })); } };
}
// short list for a bed or crop page
export function logSection(c, p) {
  const items = logFeed().filter(x => x.date <= todayStr() && (p ? (x.pids || []).includes(p.id) || (x.act && (x.all || (!(x.pids || []).length && (x.cids || []).includes(p.containerId)))) : x.all && x.act || (x.cids || []).includes(c.id))).slice(0, 6);
  A.newLog = () => logDialog(null, p ? { pids: [p.id] } : { cids: [c.id] });
  A.editLog = el => logDialog((S.log || []).find(e => e.id === el.dataset.id));
  return `<section><h3>Running log</h3>${items.length ? `<ul class="plist log">${items.map(x => logLi(Object.assign({}, x, { sub: shortDate(x.date) + (x.sub ? ' · ' + x.sub : '') }))).join('')}</ul>` : '<p class="muted">Nothing logged yet.</p>'}
    <div class="btnrow"><button class="btn small" data-act="newLog">${ui('note', 18)} Log something</button>${c ? `<a class="btn small" href="#/log?c=${c.id}">See all</a>` : ''}</div></section>`;
}
export function logDialog(e, preset = {}) {
  const isNew = !e;
  e = e || Object.assign({ id: uid(), date: todayStr(), kind: 'fert', product: '', amount: null, unit: 'g', text: '', cids: [], pids: [] }, preset);
  const prods = [...new Set((S.log || []).map(x => x.product).filter(Boolean))];
  const act = S.plantings.filter(p => isLive(p) || (e.pids || []).includes(p.id));
  modal(`<h3>${isNew ? 'Log something' : 'Edit log entry'}</h3>
    <form id="lf" class="form">
      <label>Date<input type="date" name="date" value="${e.date}" max="${todayStr()}"></label>
      <label>What did you do?<select name="kind">${LOG_KINDS.filter(([k]) => k !== 'other' || !isNew || e.kind === 'other').map(([k, i, l]) => `<option value="${k}"${k === e.kind ? ' selected' : ''}>${i} ${l}</option>`).join('')}</select></label>
      <div id="prodrow">${libChips(e)}<label>What did you use?<input name="product" list="prodl" value="${esc(e.product || '')}" placeholder="e.g. NPK 8-8-8, bokashi, BT spray"><datalist id="prodl">${[...new Set([...libNames(), ...prods])].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <div class="two"><label>Amount<input name="amount" type="number" inputmode="decimal" step="any" value="${e.amount ?? ''}"></label><label>Unit<select name="unit">${unitOpts(e.unit)}</select></label></div>
        <label id="perrow" hidden>The amount is<select name="per"><option value="each"${e.per !== 'total' ? ' selected' : ''}>for each bed / pot</option><option value="total"${e.per === 'total' ? ' selected' : ''}>in total, shared between them</option></select></label>
        <label id="phirow">Wait before harvest<div class="two"><input name="phi" type="number" inputmode="numeric" min="0" value="${e.phi ?? ''}" placeholder="days, from the label"><span class="hint">Leave empty if none. Remembered for this product.</span></div></label></div>
      <label>Notes<textarea name="text" rows="2" placeholder="e.g. 1000× dilution, both sides of leaves">${esc(e.text || '')}</textarea></label>
      <label>Where <small class="muted">(nothing ticked = whole garden)</small></label>
      <div class="sowchips">${S.containers.map(c => `<label class="chip big tog"><input type="checkbox" name="cid" value="${c.id}"${(e.cids || []).includes(c.id) ? ' checked' : ''}><span>${BED_ICON(16)} ${esc(c.name)}</span></label>`).join('')}</div>
      ${act.length ? `<details${(e.pids || []).length ? ' open' : ''}><summary class="muted">…or pick crops</summary><div class="sowchips">${act.map(p => `<label class="chip big tog"><input type="checkbox" name="pid" value="${p.id}"${(e.pids || []).includes(p.id) ? ' checked' : ''}><span>${ic(p.cropId, 18)} ${esc(crop(p.cropId).en)} <small>${esc((container(p.containerId) || {}).name || '')}</small></span></label>`).join('')}</div></details>` : ''}
      <div id="legal"></div>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('#lf');
    const showProd = () => {
      const k = f.kind.value;
      m.querySelector('#prodrow').hidden = !['fert', 'spray', 'soil', 'water', 'pest', 'other'].includes(k);
      m.querySelector('#phirow').hidden = k !== 'spray';
      const n = new Set([...[...f.querySelectorAll('input[name=cid]:checked')].map(i => i.value), ...[...f.querySelectorAll('input[name=pid]:checked')].map(i => (planting(i.value) || {}).containerId)]).size;
      m.querySelector('#perrow').hidden = n < 2;
    };
    f.product.addEventListener('change', () => { const v = (S.phi || {})[f.product.value.trim()]; if (v != null && f.phi.value === '') f.phi.value = v; });
    f.addEventListener('change', showProd); showProd();
    wireLogLibrary(m, f, e);
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { S.log = (S.log || []).filter(x => x.id !== e.id); await save(); close(); render(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      Object.assign(e, {
        date: f.date.value || todayStr(), kind: f.kind.value, product: f.product.value.trim(),
        amount: f.amount.value === '' ? null : +f.amount.value, unit: f.unit.value, text: f.text.value.trim(),
        cids: [...f.querySelectorAll('input[name=cid]:checked')].map(i => i.value), pids: [...f.querySelectorAll('input[name=pid]:checked')].map(i => i.value),
        productId: f.productId.value || null, per: f.per.value, phi: f.kind.value === 'spray' && f.phi.value !== '' ? +f.phi.value : null,
      });
      if (e.phi != null && e.product) (S.phi = S.phi || {})[e.product] = e.phi;
      if (isNew) (S.log = S.log || []).push(e);
      await save(); close(); render();
    };
  });
}

// ---------- log dialog: pick a product, check it’s legal ----------
function libChips(e) {   // your products are offered in the product field's drop-down; this keeps which one was picked
  return `<input type="hidden" name="productId" value="${esc(e.productId || '')}">`;
}
const libNames = () => myProducts(['spray', 'homemade', 'fert', 'lime', 'compost']).map(p => p.en);
function wireLogLibrary(m, f, e) {
  const box = m.querySelector('#legal');
  const targets = () => {
    const cids = [...f.querySelectorAll('input[name=cid]:checked')].map(i => i.value), pids = [...f.querySelectorAll('input[name=pid]:checked')].map(i => i.value);
    const d = f.date.value || todayStr();
    const act = S.plantings.filter(p => isLive(p) && (!p.sowDate || p.sowDate <= d));
    return pids.length || cids.length ? act.filter(p => pids.includes(p.id) || cids.includes(p.containerId)) : act;
  };
  const check = () => {
    const pr = product(f.productId.value); box.innerHTML = '';
    if (!pr || (pr.kind !== 'spray' && pr.kind !== 'homemade')) return;
    if (!Object.keys(pr.crops || {}).length) { box.innerHTML = '<p class="hint">You haven’t entered crops for this product — follow its label for which crops, how many sprays and the days before picking (put that below). You can add them to the product so the app keeps count.</p>'; if (pr.phi != null && f.phi.value === '') f.phi.value = pr.phi; return; }
    const ts = targets(); if (!ts.length) { box.innerHTML = '<p class="hint">Tick the beds or crops you sprayed to check them against what you entered from the label.</p>'; return; }
    let phi = 0; const bad = [];
    const lines = ts.map(p => {
      const r = sprayRule(pr, p.cropId), n = crop(p.cropId).en;
      if (!r || !r.listed) { bad.push(n); return `<li class="no">🚫 <b>${esc(n)}</b> — not one of the crops you entered for it</li>`; }
      phi = Math.max(phi, r.phi);
      const used = usesSoFar(p, pr.id) - (e.productId === pr.id && (S.log || []).includes(e) ? 1 : 0), left = r.max == null ? Infinity : r.max - used;
      if (left <= 0) bad.push(n);
      return `<li class="${left <= 0 ? 'no' : ''}">${left <= 0 ? '🚫' : '✓'} <b>${esc(n)}</b> — ${waitText(r.phi)} · ${left === Infinity ? 'no limit entered' : left <= 0 ? `<b>limit of ${r.max} reached</b>` : `spray ${used + 1} of ${r.max}`}</li>`;
    });
    box.innerHTML = `<ul class="legal">${lines.join('')}</ul>${bad.length ? `<p class="banner warn small">By what you entered from the label, it isn’t for (or has reached its limit on): ${esc(bad.join(', '))}. Check the label before spraying them.</p>` : ''}`;
    if (phi && (f.phi.value === '' || f.phi.dataset.auto)) { f.phi.value = phi; f.phi.dataset.auto = '1'; }
  };
  const pickLib = pr => {
    const on = !!pr && f.productId.value !== pr.id;
    f.productId.value = pr ? pr.id : '';
    if (on) {
      f.product.value = pr.en;
      const kind = pr.kind === 'spray' || pr.kind === 'homemade' ? 'spray' : pr.kind === 'fert' ? 'fert' : 'soil';
      if ([...f.kind.options].some(o => o.value === kind)) f.kind.value = kind;
      f.phi.value = ''; delete f.phi.dataset.auto;
      f.dispatchEvent(new Event('change'));
    }
    check();
  };
  // choosing (or typing) one of your products fills in its details; anything else is just a name
  f.product.addEventListener('change', () => { const pr = myProducts().find(p => p.en === f.product.value.trim()); if (pr) { if (f.productId.value !== pr.id) pickLib(pr); } else if (f.productId.value) { f.productId.value = ''; check(); } });
  f.product.addEventListener('input', () => { if (f.productId.value && f.product.value !== product(f.productId.value).en) { f.productId.value = ''; check(); } });
  f.phi.addEventListener('input', () => delete f.phi.dataset.auto);
  f.addEventListener('change', e2 => { if (e2.target.name === 'cid' || e2.target.name === 'pid' || e2.target.name === 'date') check(); });
  check();
}

// ---------- harvest log ----------
export const harvestTotal = p => (p.harvests || []).reduce((s, h) => s + (+h.count || 0), 0);
export function harvestSection(p) {
  const hs = (p.harvests || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section><h3>Harvest log</h3>
    <div class="hvbar"><div class="hvtotal"><b>${harvestTotal(p)}</b><span>picked so far</span></div><button class="btn primary" data-act="logHarvest">${ui('basket', 18)} Log a harvest</button></div>
    ${hs.length ? `<ul class="plist hvlist">${hs.map(h => `<li data-act="editHarvest" data-id="${h.id}"><span class="hvn">+${h.count}</span><span class="grow">${niceDate(h.date)}${h.note ? `<small>${esc(h.note)}</small>` : ''}</span><span class="muted">✎</span></li>`).join('')}</ul>` : ''}
  </section>`;
}
export function harvestDialog(p, h) {
  const isNew = !h;
  h = h || { id: uid(), date: todayStr(), count: 1, note: '' };
  modal(`<h3>${isNew ? 'Log a harvest' : 'Edit harvest'}</h3>
    <p class="muted small">${ic(p.cropId)} ${esc(cropName(p.cropId))}${p.variety ? ' · ' + esc(p.variety) : ''}</p>
    ${isNew ? sprayBanner(p) : ''}
    <form id="hf" class="form">
      <label>How many?<div class="stepper"><button type="button" data-s="-1">−</button><input name="count" type="number" inputmode="numeric" min="0" value="${h.count}"><button type="button" data-s="1">＋</button></div></label>
      <label>Date<input name="date" type="date" value="${h.date}"></label>
      <label>Note<input name="note" value="${esc(h.note)}" placeholder="optional, e.g. outer leaves only"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('#hf');
    m.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { f.count.value = Math.max(0, (+f.count.value || 0) + +b.dataset.s); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => { p.harvests = (p.harvests || []).filter(x => x.id !== h.id); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const n = Math.max(0, parseInt(f.count.value) || 0);
      if (!n) return alert('Enter how many you picked.');
      Object.assign(h, { count: n, date: f.date.value || todayStr(), note: f.note.value.trim() });
      if (isNew) (p.harvests = p.harvests || []).push(h);
      await save(); close(); render();
    };
  });
}
