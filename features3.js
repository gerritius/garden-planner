/* Running log (journal of everything done) and past crops (history from before the app). */
'use strict';

// ---------- running log ----------
const LOG_KINDS = [
  ['fert', '🌿', 'Fertilised'], ['spray', '💦', 'Sprayed'], ['water', '🚿', 'Watered'], ['weed', '🌾', 'Weeded'],
  ['soil', '🪏', 'Soil / compost'], ['cover', '🕸️', 'Net / cover'], ['pest', '🐛', 'Pest check'], ['other', '✎', 'Other'],
];
const LOG_FILTERS = [['all', 'All'], ['fert', 'Fertiliser'], ['spray', 'Sprays'], ['water', 'Watering'], ['job', 'Jobs'], ['harvest', 'Harvests'], ['sow', 'Sowing'], ['note', 'Notes & diary']];
const logKind = k => LOG_KINDS.find(x => x[0] === k) || LOG_KINDS[LOG_KINDS.length - 1];
const kindOfTitle = s => /fertil|feed|追肥|元肥|bokashi|ぼかし|manure|肥料|side-dress/i.test(s) ? 'fert' : /spray|農薬|insecticide|fungicide|散布|neem|bt\b/i.test(s) ? 'spray' : /lime|compost|石灰|堆肥|dig|畝/i.test(s) ? 'soil' : 'job';
const KIND_ICON = { fert: '🌿', spray: '💦', water: '🚿', soil: '🪏', job: '✓', harvest: '🧺', sow: '🌱', note: '📝', diary: '📷', weed: '🌾', cover: '🕸️', pest: '🐛', other: '✎', done: '🏁' };
const filterOf = k => ['diary', 'pest', 'note'].includes(k) ? 'note' : ['weed', 'cover', 'other', 'done', 'job'].includes(k) ? 'job' : k;

function logWhere(e) {
  const ps = (e.pids || []).map(planting).filter(Boolean), cs = (e.cids || []).map(container).filter(Boolean);
  if (!ps.length && !cs.length) return 'Whole garden';
  return [...cs.map(c => c.name), ...ps.map(p => crop(p.cropId).en + (container(p.containerId) && !cs.includes(container(p.containerId)) ? ` (${container(p.containerId).name})` : ''))].join(', ');
}

// every record that says "something was done on this day"
function logFeed() {
  const td = todayStr(), out = [];
  for (const e of S.log || []) {
    const k = logKind(e.kind), amt = fmtAmt(e.amount, e.unit);
    out.push({ date: e.date, kind: e.kind, icon: k[1], title: `${k[2]}${e.product ? ': ' + e.product : ''}${amt ? ' · ' + amt : ''}${e.per === 'total' && amt ? ' in total' : ''}${+e.phi > 0 ? ` · ${e.phi}-day wait` : ''}`, sub: logWhere(e), text: e.text, act: 'editLog', id: e.id,
      cids: [...(e.cids || []), ...(e.pids || []).map(id => (planting(id) || {}).containerId)], pids: e.pids || [], all: !(e.cids || []).length && !(e.pids || []).length });
  }
  for (const t of S.tasks) {
    if (!t.done || !t.doneOn) continue;
    const { p, c } = taskOwner(t);
    if (t.kind === 'frost') { out.push({ date: t.doneOn, kind: 'cover', title: t.title, sub: (t.cids || []).map(id => (container(id) || {}).name).filter(Boolean).join(', '), cids: t.cids || [], pids: [] }); continue; }
    if (t.kind === 'water') { out.push({ date: t.doneOn, kind: 'water', title: t.title || 'Watered pots & bags', sub: t.note || '', all: true, cids: [] }); continue; }
    const k = t.kind === 'series' || t.kind === 'custom' || t.containerId ? kindOfTitle(t.title) : t.kind === 'germ' ? 'note' : 'job';
    out.push({ date: t.doneOn, kind: k, title: t.title, sub: p ? crop(p.cropId).en + (c ? ' · ' + c.name : '') : c ? c.name : '', href: p ? '#/plant/' + p.id : c ? '#/container/' + c.id : null, cids: c ? [c.id] : [], pids: p ? [p.id] : [] });
  }
  for (const p of S.plantings) {
    const c = container(p.containerId), where = c ? c.name : '', cids = c ? [c.id] : [], pids = [p.id], href = '#/plant/' + p.id, n = crop(p.cropId).en;
    if (p.sowDate && p.sowDate <= td) out.push({ date: p.sowDate, kind: 'sow', title: `${p.method === 'seed' ? 'Sowed' : 'Planted'} ${n}${p.variety ? ' · ' + p.variety : ''}`, sub: where + (c && c.type === 'bed' ? ` · ${p.from}–${p.to} cm` : ''), href, cids, pids });
    if (p.germ && p.germ.date) out.push({ date: p.germ.date, kind: 'note', title: `${n} came up: ${p.germ.result}`, sub: where, href, cids, pids });
    for (const h of p.harvests || []) out.push({ date: h.date, kind: 'harvest', title: `Picked ${h.count} ${n}`, sub: where + (h.note ? ' · ' + h.note : ''), href, cids, pids });
    for (const d of p.diary || []) out.push({ date: d.date, kind: (d.tags || []).length ? 'pest' : d.photo ? 'diary' : 'note', title: d.note || (d.tags || []).map(pestName).join(', ') || 'Photo', sub: n + (where ? ' · ' + where : '') + ((d.tags || []).length && d.note ? ' · ' + d.tags.map(pestName).join(', ') : ''), href: `#/plant/${p.id}/diary/${d.id}`, photo: d.photo, cids, pids });
    if (p.status === 'harvested' && p.harvestedOn) out.push({ date: p.harvestedOn, kind: 'done', title: `Finished ${n}`, sub: where, href, cids, pids });
  }
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
function pageLog(q) {
  const f = q.get('f') || 'all', cid = q.get('c') || '', lim = +q.get('n') || 120;
  setChrome('Running log', { tab: 'log', kicker: 'Everything done in the garden' });
  let items = logFeed().filter(x => x.date <= todayStr());
  if (f !== 'all') items = items.filter(x => filterOf(x.kind) === f);
  if (cid) items = items.filter(x => x.all || (x.cids || []).includes(cid));
  const shown = items.slice(0, lim);
  const url = o => { const u = new URLSearchParams({ f, c: cid }); for (const k in o) u.set(k, o[k]); [...u.keys()].forEach(k => { if (!u.get(k) || u.get(k) === 'all') u.delete(k); }); return '#/log' + (u.toString() ? '?' + u : ''); };
  A.newLog = () => logDialog(null, cid ? { cids: [cid] } : {});
  A.editLog = el => logDialog((S.log || []).find(e => e.id === el.dataset.id));
  A.more = () => location.replace(url({ n: lim + 200 }));
  const html = `<div class="btnrow"><button class="btn primary grow" data-act="newLog">📝 Log something</button><a class="btn" href="#/totals">📊 Totals</a></div>
    <div class="sowchips filt">${LOG_FILTERS.map(([k, l]) => `<a class="chip big${k === f ? ' on' : ''}" href="${url({ f: k, n: '' })}" onclick="location.replace(this.href);return false;">${l}</a>`).join('')}</div>
    <label class="inline">Bed / pot <select id="logc"><option value="">All</option>${S.containers.map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${shown.length ? logDays(shown) : '<div class="empty-state">Nothing logged yet.<br><small>Ticked jobs, harvests, sowings, notes and anything you log here all show up by day.</small></div>'}
    ${items.length > lim ? '<button class="btn wide" data-act="more">Show older</button>' : ''}
    <button class="fab" data-act="newLog" aria-label="Log something">＋</button>`;
  return { html, after: () => { $('#logc').onchange = e => location.replace(url({ c: e.target.value, n: '' })); } };
}
// short list for a bed or crop page
function logSection(c, p) {
  const items = logFeed().filter(x => x.date <= todayStr() && (p ? (x.pids || []).includes(p.id) || (x.act && (x.all || (!(x.pids || []).length && (x.cids || []).includes(p.containerId)))) : x.all && x.act || (x.cids || []).includes(c.id))).slice(0, 6);
  A.newLog = () => logDialog(null, p ? { pids: [p.id] } : { cids: [c.id] });
  A.editLog = el => logDialog((S.log || []).find(e => e.id === el.dataset.id));
  return `<section><h3>Running log</h3>${items.length ? `<ul class="plist log">${items.map(x => logLi(Object.assign({}, x, { sub: shortDate(x.date) + (x.sub ? ' · ' + x.sub : '') }))).join('')}</ul>` : '<p class="muted">Nothing logged yet.</p>'}
    <div class="btnrow"><button class="btn small" data-act="newLog">📝 Log something</button>${c ? `<a class="btn small" href="#/log?c=${c.id}">See all</a>` : ''}</div></section>`;
}
function logDialog(e, preset = {}) {
  const isNew = !e;
  e = e || Object.assign({ id: uid(), date: todayStr(), kind: 'fert', product: '', amount: null, unit: 'g', text: '', cids: [], pids: [] }, preset);
  const prods = [...new Set((S.log || []).map(x => x.product).filter(Boolean))];
  const act = S.plantings.filter(p => p.status !== 'harvested' || (e.pids || []).includes(p.id));
  modal(`<h3>${isNew ? 'Log something' : 'Edit log entry'}</h3>
    <form id="lf" class="form">
      <label>Date<input type="date" name="date" value="${e.date}" max="${todayStr()}"></label>
      <div class="sowchips kinds">${LOG_KINDS.map(([k, i, l]) => `<label class="chip big tog"><input type="radio" name="kind" value="${k}"${k === e.kind ? ' checked' : ''}><span>${i} ${l}</span></label>`).join('')}</div>
      <div id="prodrow">${libChips(e)}<label>What did you use?<input name="product" list="prodl" value="${esc(e.product || '')}" placeholder="e.g. 化成肥料 8-8-8, bokashi, BT spray"><datalist id="prodl">${prods.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <div class="two"><label>Amount<input name="amount" type="number" inputmode="decimal" step="any" value="${e.amount ?? ''}"></label><label>Unit<select name="unit">${unitOpts(e.unit)}</select></label></div>
        <label id="perrow" hidden>The amount is<select name="per"><option value="each"${e.per !== 'total' ? ' selected' : ''}>for each bed / pot</option><option value="total"${e.per === 'total' ? ' selected' : ''}>in total, shared between them</option></select></label>
        <label id="phirow">Wait before harvest (収穫前日数)<div class="two"><input name="phi" type="number" inputmode="numeric" min="0" value="${e.phi ?? ''}" placeholder="days, from the label"><span class="hint">Leave empty if none. Remembered for this product.</span></div></label></div>
      <label>Notes<textarea name="text" rows="2" placeholder="e.g. 1000× dilution, both sides of leaves">${esc(e.text || '')}</textarea></label>
      <label>Where <small class="muted">(nothing ticked = whole garden)</small></label>
      <div class="sowchips">${S.containers.map(c => `<label class="chip big tog"><input type="checkbox" name="cid" value="${c.id}"${(e.cids || []).includes(c.id) ? ' checked' : ''}><span>${BED_ICON(16)} ${esc(c.name)}</span></label>`).join('')}</div>
      ${act.length ? `<details${(e.pids || []).length ? ' open' : ''}><summary class="muted">…or pick crops</summary><div class="sowchips">${act.map(p => `<label class="chip big tog"><input type="checkbox" name="pid" value="${p.id}"${(e.pids || []).includes(p.id) ? ' checked' : ''}><span>${ic(p.cropId, 18)} ${esc(crop(p.cropId).en)} <small>${esc((container(p.containerId) || {}).name || '')}</small></span></label>`).join('')}</div></details>` : ''}
      <div id="legal"></div>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('#lf');
    const showProd = () => {
      const k = f.querySelector('input[name=kind]:checked').value;
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
        date: f.date.value || todayStr(), kind: f.querySelector('input[name=kind]:checked').value, product: f.product.value.trim(),
        amount: f.amount.value === '' ? null : +f.amount.value, unit: f.unit.value, text: f.text.value.trim(),
        cids: [...f.querySelectorAll('input[name=cid]:checked')].map(i => i.value), pids: [...f.querySelectorAll('input[name=pid]:checked')].map(i => i.value),
        productId: f.productId.value || null, per: f.per.value, phi: f.querySelector('input[name=kind]:checked').value === 'spray' && f.phi.value !== '' ? +f.phi.value : null,
      });
      if (e.phi != null && e.product) (S.phi = S.phi || {})[e.product] = e.phi;
      if (isNew) (S.log = S.log || []).push(e);
      await save(); close(); render();
    };
  });
}

// ---------- past crops (from before the app) ----------
const ymLabel = d => d ? new Date(d.slice(0, 7) + '-01T00:00').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : '?';
const histWhen = h => h.manual ? `finished ${ymLabel(h.harvestedOn)}` : `harvested ${shortDate(h.harvestedOn)}`;
const histSpan = h => h.manual ? `${h.sowDate ? ymLabel(h.sowDate) + ' → ' : ''}${ymLabel(h.harvestedOn)}` : `${shortDate(h.sowDate)} → ${shortDate(h.harvestedOn)}`;
function lastDayOf(ym) { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m, 0)); }
function pastCropDialog(c, h) {
  const isNew = !h, L = Draw.dims(c).L, bed = c.type === 'bed';
  h = h || { id: 'h_' + uid(), manual: true, cropId: '', variety: '', from: 0, to: L, sowDate: '', harvestedOn: '', note: '' };
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
function historySection(c) {
  const hist = (c.history || []).slice().sort((a, b) => ((a.harvestedOn || '') < (b.harvestedOn || '') ? 1 : -1));
  A.addPast = () => pastCropDialog(c);
  A.editPast = el => pastCropDialog(c, (c.history || []).find(x => x.id === el.dataset.id));
  return `<section><h3>History</h3>${hist.length ? `<ul class="plist">${hist.map(h => {
    const body = `${ic(h.cropId)}<span class="grow">${esc(cropName(h.cropId))}${h.variety ? ' · ' + esc(h.variety) : ''}<small>${histSpan(h)}${(() => { const hp = !h.manual && planting(h.plantingId); const n = hp ? harvestTotal(hp) : 0; return n ? ` · ${n} picked` : ''; })()}${c.type === 'bed' ? ` · ${h.from}–${h.to} cm` : ''}${h.manual ? ' · before the app' : ''}${feedOf(h.cropId, h) ? ' · ' + FEED_LABEL[feedOf(h.cropId, h)] : ''}</small>${h.note ? `<small>${esc(h.note)}</small>` : ''}</span>`;
    return h.manual ? `<li data-act="editPast" data-id="${h.id}">${body}<span class="muted">✎</span></li>` : `<li><a href="#/plant/${h.plantingId}">${body}›</a></li>`;
  }).join('')}</ul>` : '<p class="muted">Nothing recorded yet.</p>'}
    <button class="btn small" data-act="addPast">＋ Add a past crop</button></section>`;
}
