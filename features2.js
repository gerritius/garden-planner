'use strict';
/* Bed jobs & notes, watering, germination, pick-by, pests, quick add, search, map, section drag, review, compare, crop-name language. */

// ---------- crop name language ----------
const _disp = {};
function dispCrop(c) {
  if (!S || S.lang !== 'ja' || !c || !c.ja) return c;
  const k = c.id + '|' + c.en + '|' + c.ja;
  return _disp[k] || (_disp[k] = Object.assign({}, c, { en: c.ja, ja: c.en }));
}

// ---------- task owners ----------
function taskOwner(t) {
  const p = t.plantingId ? planting(t.plantingId) : null;
  const c = p ? container(p.containerId) : (t.containerId ? container(t.containerId) : null);
  return { p, c };
}
const taskVisible = t => t.kind === 'water' || !!(t.plantingId ? planting(t.plantingId) : t.containerId && container(t.containerId));
const BED_ICON = s => `<svg class="cicon" width="${s}" height="${s}" viewBox="0 0 32 32"><rect x="9" y="3" width="14" height="26" rx="1.5" fill="#8a6a4b" stroke="#3a2a1c" stroke-width="1.3"/><path d="M12 9h8M12 15h8M12 21h8" stroke="#7fb069" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const CAN_ICON = s => `<svg class="cicon" width="${s}" height="${s}" viewBox="0 0 32 32"><path d="M8 13h13v13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#7aa7c7" stroke="#3a2a1c" stroke-width="1.3"/><path d="M21 16l7-6" stroke="#3a2a1c" stroke-width="2.4" stroke-linecap="round"/><path d="M11 13a4 4 0 0 1 7 0" fill="none" stroke="#3a2a1c" stroke-width="1.3"/><path d="M28 13v.1M29.5 15.5v.1M27 16.5v.1" stroke="#3d7fb8" stroke-width="1.8" stroke-linecap="round"/></svg>`;

// ---------- germination & pick-by ----------
function germWindow(p) {
  const cr = crop(p.cropId);
  if (p.method !== 'seed' || !cr.germ || !p.sowDate) return null;
  const m = pd(p.sowDate).getMonth() + 1;
  const f = [12, 1, 2].includes(m) ? 1.8 : [11, 3].includes(m) ? 1.4 : [10, 4].includes(m) ? 1.15 : 1;
  return [addDays(p.sowDate, Math.round(cr.germ[0] * f)), addDays(p.sowDate, Math.round(cr.germ[1] * f))];
}
function pickBy(p) {
  const cr = crop(p.cropId);
  if (!p.harvestDate || !cr.win) return null;
  return { date: addDays(p.harvestDate, cr.win), late: cr.late, cont: !!cr.cont };
}
function syncCareTasks(p) {
  const gw = germWindow(p);
  upsertAuto(p, 'germ', !!gw && !p.no_germ, gw && gw[1], gw ? `Check seedlings are up (expected ${shortDate(gw[0])}–${shortDate(gw[1])})` : '');
  const pb = pickBy(p);
  upsertAuto(p, 'pickby', !!pb && !pb.cont && !p.no_pickby, pb && pb.date, pb ? `Pick by now – after this ${pb.late}` : '');
}
function germDialog(p, when) {
  modal(`<h3>How did the ${esc(crop(p.cropId).en)} come up?</h3>
    <div class="btns col"><button class="btn" data-g="good">🌱 Good, even rows</button><button class="btn" data-g="patchy">🌿 Patchy</button><button class="btn" data-g="none">🚫 Nothing came up</button></div>`, (m, close) => {
    m.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
      const g = b.dataset.g;
      p.germ = { result: g, date: when || todayStr() };
      await save(); close();
      if (g === 'good') return render();
      modal(`<h3>${g === 'patchy' ? 'Patchy germination' : 'Nothing came up'}</h3>
        <p class="msg">${g === 'patchy' ? 'Re-sow the gaps today? This keeps the planting and just notes it.' : 'Re-sow today? Dates, thinning and harvest will be recalculated from today.'}</p>
        <div class="btns col">${g === 'patchy' ? '<button class="btn primary" data-r="gaps">Re-sowed the gaps today</button>' : ''}<button class="btn ${g === 'none' ? 'primary' : ''}" data-r="all">Re-sow ${g === 'patchy' ? 'everything' : ''} today (reset dates)</button><button class="btn" data-r="no">Leave it</button></div>`, (m2, close2) => {
        m2.querySelectorAll('[data-r]').forEach(bb => bb.onclick = async () => {
          const r = bb.dataset.r, td = todayStr();
          if (r === 'gaps') S.tasks.push({ id: uid(), plantingId: p.id, kind: 'custom', title: 'Re-sowed gaps (patchy germination)', due: td, done: true, doneOn: td });
          if (r === 'all') {
            const cr = crop(p.cropId);
            S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && ['germ', 'thin', 'harvest', 'pickby'].includes(t.kind)));
            S.tasks.push({ id: uid(), plantingId: p.id, kind: 'custom', title: `Re-sown (was sown ${shortDate(p.sowDate)})`, due: td, done: true, doneOn: td });
            p.sowDate = td; p.thinned = false; p.thinDoneOn = null; p.germ = null;
            if (cr.daysThin && p.thinSp) p.thinDate = addDays(td, cr.daysThin);
            if (cr.daysHarvest) p.harvestDate = addDays(td, cr.daysHarvest);
            syncTasks(p);
          }
          await save(); close2(); render();
        });
      });
    });
  });
}

// ---------- watering (pots & bags) ----------
function waterInterval(d = new Date()) {
  const m = d.getMonth() + 1;
  let iv = [6, 7, 8, 9].includes(m) ? 1 : [5, 10].includes(m) ? 2 : [4, 11].includes(m) ? 3 : m === 3 ? 4 : 5;
  const today = Weather.days()[0];
  if (today && today.max >= 30) iv = 1;
  return iv;
}
function rainNear() {
  const d = S.weather && S.weather.daily; if (!d) return 0;
  const td = todayStr(), y = addDays(td, -1);
  let r = 0;
  d.time.forEach((t, i) => { if (t === td || t === y) r = Math.max(r, d.precipitation_sum[i] || 0); });
  return r;
}
function syncWater() {
  const on = !S.water || S.water.on !== false;
  const pots = S.containers.filter(c => c.type !== 'bed' && activeIn(c.id).length);
  let open = S.tasks.find(t => t.kind === 'water' && !t.done);
  const td = todayStr();
  S.tasks = S.tasks.filter(t => !(t.kind === 'water' && t.done && daysBetween(t.doneOn, td) > 21));
  if (!on || !pots.length) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  const iv = waterInterval(), last = S.water && S.water.lastDone;
  let due = last ? addDays(last, iv) : td;
  if (due < td) due = td;
  let note = '';
  const rain = rainNear();
  if (due === td && rain >= 5) { due = addDays(td, 1); note = ` · skipped, ${Math.round(rain)} mm rain`; }
  if (!open) { open = { id: uid(), kind: 'water', plantingId: null, title: 'Water pots & bags', due, done: false }; S.tasks.push(open); }
  open.due = due;
  open.note = `${pots.length} pot${pots.length > 1 ? 's' : ''} · every ${iv === 1 ? 'day' : iv + ' days'} this time of year${note}`;
}

// ---------- bed jobs, notes, prep ----------
function bedTaskDialog(c, t) {
  const isNew = !t;
  modal(`<h3>${isNew ? 'Add bed job' : 'Edit job'}</h3><p class="muted small">${BED_ICON(20)} ${esc(c.name)}</p>
    <form id="btf" class="form">${isNew ? templatePicker() : ''}
      <label>Job<input name="title" value="${esc(t ? t.title : '')}" required></label>
      <label>${t && t.done ? 'Done on' : 'Date'}<input name="due" type="date" value="${t ? (t.done ? t.doneOn : effDue(t)) : todayStr()}"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
      ${!isNew ? `<a class="link" href="#/container/${c.id}" data-x="open">Open ${esc(c.name)} →</a>` : ''}</form>`, (m, close) => {
    const f = m.querySelector('#btf'); wireTemplates(m, f);
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const op = m.querySelector('[data-x=open]'); if (op) op.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { S.tasks = S.tasks.filter(x => x !== t); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      if (isNew) S.tasks.push({ id: uid(), containerId: c.id, plantingId: null, kind: 'bed', title: f.title.value.trim(), due: f.due.value || todayStr(), done: false });
      else if (t.done) { t.title = f.title.value.trim(); t.doneOn = f.due.value || t.doneOn; } else { t.title = f.title.value.trim(); t.due = f.due.value || t.due; }
      await save(); close(); render();
    };
  });
}
function waterTaskDialog(t) {
  modal(`<h3>${CAN_ICON(24)} Water pots &amp; bags</h3><p class="msg">${esc(t.note || '')}</p>
    <p class="hint">Watering is spaced by season (daily in summer, every few days in spring/autumn, about weekly in winter) and skipped when 5 mm+ of rain fell or is forecast. Turn it off in Tools.</p>
    <div class="btns"><button class="btn" data-x="skip">Skip today</button><button class="btn primary" data-x="ok">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=ok]').onclick = close;
    m.querySelector('[data-x=skip]').onclick = async () => { t.due = addDays(todayStr(), 1); await save(); close(); render(); };
  });
}
const bedArea = c => c.type === 'round' ? Math.PI * (c.diameter / 200) ** 2 : (c.width * c.length) / 1e4;
function prepDialog(c) {
  const a = bedArea(c), g = r => Math.round(a * r / 10) * 10 || Math.round(a * r);
  const items = [
    ['lime', `Spread lime (苦土石灰) ~${g(100)} g`, -14, true],
    ['compost', `Dig in compost (堆肥) ~${Math.max(1, Math.round(a * 2 * 2) / 2)} kg`, -14, true],
    ['base', `Base fertiliser (元肥) ~${g(100)} g`, -7, true],
    ['ridge', 'Dig & shape the bed (畝立て)', -7, c.type === 'bed'],
    ['mulch', 'Lay mulch film (マルチ)', -3, false],
  ];
  modal(`<h3>Prepare ${esc(c.name)}</h3><p class="muted small">${a.toFixed(2)} m² · amounts are typical per-area rates — adjust to your products.</p>
    <form id="pf2" class="form"><label>Planting date<input type="date" name="plant" value="${addDays(todayStr(), 14)}"></label>
      ${items.map(([k, l, off, on]) => `<label class="inl chkline"><input type="checkbox" name="${k}" ${on ? 'checked' : ''}> <span>${l} <small>(${-off} days before)</small></span></label>`).join('')}
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Add jobs</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#pf2').onsubmit = async e => {
      e.preventDefault(); const f = e.target, pl = f.plant.value || todayStr();
      for (const [k, l, off] of items) if (f[k].checked) S.tasks.push({ id: uid(), containerId: c.id, plantingId: null, kind: 'bed', title: l, due: addDays(pl, off) < todayStr() ? todayStr() : addDays(pl, off), done: false });
      await save(); close(); render();
    };
  });
}
function noteDialog(c, n) {
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
function bedSection(c) {
  const jobs = sortTasks(S.tasks.filter(t => t.containerId === c.id && !t.done));
  const done = S.tasks.filter(t => t.containerId === c.id && t.done).sort((a, b) => (a.doneOn < b.doneOn ? 1 : -1));
  const log = (c.log || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  A.bedJob = () => bedTaskDialog(c);
  A.prep = () => prepDialog(c);
  A.bedNote = () => noteDialog(c);
  A.editNote = el => noteDialog(c, (c.log || []).find(x => x.id === el.dataset.id));
  return `<section><h3>Bed jobs</h3>
      ${jobs.length ? `<ul class="tasks">${jobs.map(t => taskLi(t, false)).join('')}</ul>` : '<p class="muted">No jobs for the bed itself.</p>'}
      <div class="btnrow"><button class="btn small" data-act="bedJob">＋ Add job</button><button class="btn small" data-act="prep">🪏 Prepare bed…</button></div>
      ${done.length ? `<details class="donelog"><summary>Done (${done.length})</summary><ul class="tasks">${done.map(t => taskLi(t, false)).join('')}</ul></details>` : ''}</section>
    <section><h3>Bed notes</h3>
      ${log.length ? `<ul class="plist">${log.map(n => `<li data-act="editNote" data-id="${n.id}"><span class="grow"><small>${niceDate(n.date)}</small>${esc(n.text)}</span><span class="muted">✎</span></li>`).join('')}</ul>` : '<p class="muted">Soil, compost, lime, anything worth remembering.</p>'}
      <button class="btn small" data-act="bedNote">＋ Add note</button></section>`;
}

// ---------- job templates ----------
function templatePicker() {
  return `<details class="tpl"><summary>Pick a common job…</summary>${JOB_TEMPLATES.map(([g, l]) => `<div class="tplg"><small>${g}</small><div class="sowchips">${l.map(x => `<button type="button" class="chip big" data-tpl="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`).join('')}</details>`;
}
function wireTemplates(m, f) {
  m.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { f.title.value = b.dataset.tpl; m.querySelector('details.tpl').open = false; f.title.focus(); });
}

// ---------- pests (diary tags) ----------
const pestName = k => { const x = PESTS.find(p => p[0] === k); return x ? `${x[1]} ${x[2]}` : k; };
function pestPicker(sel = []) {
  return `<label>Problems spotted<div class="sowchips pests">${PESTS.map(([k, en, ja]) => `<label class="chip big tog"><input type="checkbox" name="pest" value="${k}"${sel.includes(k) ? ' checked' : ''}><span>${esc(en)} <small>${ja}</small></span></label>`).join('')}</div></label>`;
}
const readPests = f => [...f.querySelectorAll('input[name=pest]:checked')].map(i => i.value);

// diary entry (photo optional)
function diaryEntryDialog(p, blob, guess) {
  const url = blob ? URL.createObjectURL(blob) : null;
  modal(`<h3>${blob ? 'Add to photo diary' : 'Add a diary note'}</h3>${url ? `<img class="dprev" src="${url}" alt="">` : ''}
    <form id="df" class="form"><label>Date<input type="date" name="date" value="${guess && guess <= todayStr() ? guess : todayStr()}"></label>
    <label>Note<textarea name="note" rows="2" placeholder="e.g. first true leaves, holes in leaves…"></textarea></label>
    ${pestPicker()}
    <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#df').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      let photo = null;
      if (blob) { photo = uid(); await DB.putPhoto(photo, blob); }
      const note = f.note.value.trim(), tags = readPests(f);
      if (!photo && !note && !tags.length) return close();
      (p.diary = p.diary || []).push({ id: uid(), date: f.date.value || todayStr(), photo, note, tags });
      await save(); close(); render();
    };
  });
}
async function addDiaryFromFile(p, file) {
  if (!file) return;
  const blob = await compress(file);
  diaryEntryDialog(p, blob, file.lastModified ? iso(new Date(file.lastModified)) : null);
}
function pickPhotoFor(p) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => addDiaryFromFile(p, inp.files[0]);
  inp.click();
}

// ---------- quick add ----------
function quickAdd() {
  modal(`<h3>Quick add</h3><div class="qa">
    <button class="btn" data-q="harvest">🧺 Log a harvest</button><button class="btn" data-q="photo">📷 Diary photo</button>
    <button class="btn" data-q="note">🐛 Diary note / pest</button><button class="btn" data-q="job">✓ Add a job</button>
    <a class="btn primary" href="#/container/new" data-q="bed">＋ New bed or pot</a></div>`, (m, close) => {
    m.querySelector('[data-q=bed]').onclick = () => close();
    m.querySelectorAll('button[data-q]').forEach(b => b.onclick = () => pickPlanting(b.dataset.q));
  });
}
function pickPlanting(what) {
  const act = S.plantings.filter(p => p.status !== 'harvested');
  const label = { harvest: 'Log a harvest for…', photo: 'Diary photo for…', note: 'Diary note for…', job: 'Add a job for…' }[what];
  const beds = what === 'job' ? S.containers : [];
  modal(`<h3>${label}</h3>${act.length ? `<ul class="plist">${act.map(p => `<li data-p="${p.id}">${ic(p.cropId)}<span class="grow">${esc(cropName(p.cropId))}<small>${esc((container(p.containerId) || {}).name || '')}${p.variety ? ' · ' + esc(p.variety) : ''}</small></span>›</li>`).join('')}</ul>` : '<p class="muted">Nothing growing yet.</p>'}
    ${beds.length ? `<h3>…or a bed / pot</h3><ul class="plist">${beds.map(c => `<li data-c="${c.id}">${BED_ICON(22)}<span class="grow">${esc(c.name)}</span>›</li>`).join('')}</ul>` : ''}
    <div class="btns"><button class="btn" data-x="no">Cancel</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-p]').forEach(li => li.onclick = () => {
      const p = planting(li.dataset.p);
      if (what === 'photo') { close(); return pickPhotoFor(p); }
      if (what === 'harvest') return harvestDialog(p);
      if (what === 'note') return diaryEntryDialog(p, null);
      if (what === 'job') return taskDialog(null, p);
    });
    m.querySelectorAll('[data-c]').forEach(li => li.onclick = () => bedTaskDialog(container(li.dataset.c)));
  });
}

// ---------- search ----------
function pageSearch(q) {
  setChrome('Search', { tab: 'search', kicker: 'Crops, varieties, notes, pests' });
  const term = (q.get('q') || '').trim();
  const html = `<form id="sf" class="searchrow" onsubmit="return false"><input id="sq" type="search" value="${esc(term)}" placeholder="e.g. 夏楽天, aphids, compost…" enterkeyhint="search" autocomplete="off"></form><div id="sres"></div>`;
  const run = () => {
    const t = $('#sq').value.trim().toLowerCase(); const out = $('#sres');
    history.replaceState(null, '', '#/search' + (t ? '?q=' + encodeURIComponent(t) : ''));
    lastRoute = location.hash;
    if (t.length < 1) { out.innerHTML = '<p class="muted center">Type to search everything you’ve recorded.</p>'; return; }
    const has = s => String(s || '').toLowerCase().includes(t);
    const hl = s => esc(s).replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), x => `<mark>${x}</mark>`);
    const raw = id => CATALOG.concat(S.customCrops || []).find(c => c.id === id) || {};
    const pl = S.plantings.filter(p => { const c = raw(p.cropId); return has(c.en) || has(c.ja) || has(p.variety) || has(p.notes) || has(FAMILIES[c.family] && FAMILIES[c.family].join(' ')); });
    const di = []; S.plantings.forEach(p => (p.diary || []).forEach(d => { if (has(d.note) || (d.tags || []).some(k => has(pestName(k)))) di.push([p, d]); }));
    const bn = []; S.containers.forEach(c => { if (has(c.name) || has(c.notes)) bn.push([c, null]); (c.log || []).forEach(n => { if (has(n.text)) bn.push([c, n]); }); });
    const jb = S.tasks.filter(x => has(x.title) && taskVisible(x)).slice(0, 40);
    const sec = (h, body) => body ? `<h3>${h}</h3>${body}` : '';
    out.innerHTML = (pl.length + di.length + bn.length + jb.length) ? [
      sec('Plantings', pl.length && `<ul class="plist">${pl.map(p => `<li><a href="#/plant/${p.id}">${ic(p.cropId)}<span class="grow">${hl(cropName(p.cropId))}${p.variety ? ' · ' + hl(p.variety) : ''}<small>${esc((container(p.containerId) || {}).name || '')} · ${p.status === 'harvested' ? 'harvested ' + shortDate(p.harvestedOn) : 'sown ' + shortDate(p.sowDate)}</small></span>›</a></li>`).join('')}</ul>`),
      sec('Diary', di.length && `<ul class="plist">${di.map(([p, d]) => `<li><a href="#/plant/${p.id}/diary/${d.id}">${ic(p.cropId)}<span class="grow">${hl(d.note || '')}${(d.tags || []).length ? ` <small>${d.tags.map(k => hl(pestName(k))).join(', ')}</small>` : ''}<small>${esc(crop(p.cropId).en)} · ${shortDate(d.date)}</small></span>›</a></li>`).join('')}</ul>`),
      sec('Beds & notes', bn.length && `<ul class="plist">${bn.map(([c, n]) => `<li><a href="#/container/${c.id}">${BED_ICON(22)}<span class="grow">${n ? hl(n.text) : hl(c.name)}<small>${esc(c.name)}${n ? ' · ' + shortDate(n.date) : ''}</small></span>›</a></li>`).join('')}</ul>`),
      sec('Jobs', jb.length && `<ul class="tasks">${jb.map(x => taskLi(x)).join('')}</ul>`),
    ].join('') : '<p class="muted center">Nothing found.</p>';
  };
  return { html, after: () => { const i = $('#sq'); i.addEventListener('input', run); run(); if (!term) i.focus(); } };
}

// ---------- garden map ----------
function ensureAreas() {
  if (!S.areas || !S.areas.length) S.areas = [{ id: 'a_' + uid(), name: 'Garden' }];
  for (const c of S.containers) if (!S.areas.find(a => a.id === c.area)) c.area = S.areas[0].id;
}
function boxOf(c) { const { W, L } = Draw.dims(c); return c.rot ? [L, W] : [W, L]; }
function autoPlace(areaId) {
  const cs = S.containers.filter(c => c.area === areaId);
  const placed = cs.filter(c => c.pos);
  let x = 0, y = placed.length ? Math.max(...placed.map(o => o.pos[1] + boxOf(o)[1])) + 40 : 0, rowH = 0;
  const maxW = Math.max(300, ...placed.map(o => o.pos[0] + boxOf(o)[0]), ...cs.map(c => boxOf(c)[0]));
  for (const c of cs) {
    if (c.pos) continue;
    const [w, h] = boxOf(c);
    if (x > 0 && x + w > maxW) { x = 0; y += rowH + 40; rowH = 0; }
    c.pos = [x, y]; x += w + 30; rowH = Math.max(rowH, h);
  }
}
function mapSVG(areaId, { edit = false, width = 360, sel = null } = {}) {
  const cs = S.containers.filter(c => c.area === areaId);
  if (!cs.length) return '<p class="muted center">No beds or pots in this area yet.</p>';
  autoPlace(areaId);
  let maxX = 0, maxY = 0;
  for (const c of cs) { const [w, h] = boxOf(c); maxX = Math.max(maxX, c.pos[0] + w); maxY = Math.max(maxY, c.pos[1] + h); }
  const pad = 30, W = maxX + pad * 2, H = maxY + pad * 2 + 20, px = width / W;
  let s = `<svg class="map" viewBox="${-pad} ${-pad} ${W} ${H}" width="${width}" height="${(H * px).toFixed(0)}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<defs><pattern id="mg" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" class="mapgrid"/></pattern></defs><rect x="${-pad}" y="${-pad}" width="${W}" height="${H}" fill="url(#mg)" class="mapbg"/>`;
  for (const c of cs) {
    const { W: cw, L: cl } = Draw.dims(c), [bw, bh] = boxOf(c);
    let inner = Draw.svg(c, decorate(activeIn(c.id)), { px: 1, minPx: 1.6, today: todayStr() });
    const vb = inner.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const cx = c.pos[0] + bw / 2, cy = c.pos[1] + bh / 2;
    inner = inner.replace(/<svg [^>]*?viewBox="[^"]+"[^>]*>/, `<svg class="plot" x="${cx - vb[2] / 2}" y="${cy - vb[3] / 2}" width="${vb[2]}" height="${vb[3]}" viewBox="${vb.join(' ')}" overflow="visible">`);
    const g = c.rot ? `<g transform="rotate(90 ${cx} ${cy})">${inner}</g>` : inner;
    s += `<g class="mapc${sel === c.id ? ' sel' : ''}" data-cid="${c.id}">${g}<rect x="${c.pos[0]}" y="${c.pos[1]}" width="${bw}" height="${bh}" class="hit"/>
      <text x="${cx}" y="${c.pos[1] + bh + 13 / px}" font-size="${12 / px}" text-anchor="middle" class="mapl">${esc(c.name)}</text></g>`;
    void cw; void cl;
  }
  return s + '</svg>';
}
function pageMap(q) {
  ensureAreas();
  const areaId = q.get('a') && S.areas.find(a => a.id === q.get('a')) ? q.get('a') : (S.mapArea && S.areas.find(a => a.id === S.mapArea) ? S.mapArea : S.areas[0].id);
  S.mapArea = areaId;
  const edit = q.get('edit') === '1';
  setChrome('Garden map', { back: true, kicker: edit ? 'Drag to arrange · tap to select' : S.areas.find(a => a.id === areaId).name });
  let sel = null;
  const vw = Math.min(window.innerWidth, 680) - 32;
  A.area = el => location.replace(`#/map?a=${el.dataset.id}${edit ? '&edit=1' : ''}`);
  A.newArea = () => { const n = prompt('Name of the new area (e.g. Community garden):'); if (!n) return; const a = { id: 'a_' + uid(), name: n.trim() }; S.areas.push(a); save().then(() => location.replace(`#/map?a=${a.id}&edit=1`)); };
  A.renameArea = () => { const a = S.areas.find(x => x.id === areaId); const n = prompt('Rename area:', a.name); if (n) { a.name = n.trim(); save().then(render); } };
  A.delArea = async () => {
    if (S.areas.length < 2) return alert('You need at least one area.');
    if (!await confirmBox('Delete this area? Its beds and pots move to the first area.', 'Delete', true)) return;
    S.areas = S.areas.filter(a => a.id !== areaId); for (const c of S.containers) if (c.area === areaId) { c.area = S.areas[0].id; c.pos = null; }
    await save(); location.replace('#/map?edit=1');
  };
  A.rot = async () => { const c = container(sel); if (!c) return; c.rot = c.rot ? 0 : 90; await save(); draw(); };
  A.moveTo = () => {
    const c = container(sel); if (!c) return;
    modal(`<h3>Move ${esc(c.name)} to…</h3><ul class="plist">${S.areas.filter(a => a.id !== areaId).map(a => `<li data-a="${a.id}"><span class="grow">${esc(a.name)}</span>›</li>`).join('') || '<li class="muted">Add another area first.</li>'}</ul>`, (m, close) => {
      m.querySelectorAll('[data-a]').forEach(li => li.onclick = async () => { c.area = li.dataset.a; c.pos = null; await save(); close(); sel = null; draw(); });
    });
  };
  const html = `<div class="seg wrap">${S.areas.map(a => `<button type="button" data-act="area" data-id="${a.id}" class="${a.id === areaId ? 'on' : ''}">${esc(a.name)}</button>`).join('')}</div>
    <div id="mapbox" class="mapbox"></div>
    <div id="selbar" class="btnrow" hidden><button class="btn small" data-act="rot">⟳ Rotate</button><button class="btn small" data-act="moveTo">Move to area…</button></div>
    ${edit ? `<div class="btnrow"><a class="btn primary" href="#/map?a=${areaId}" onclick="location.replace(this.href);return false;">Done</a></div>
      <div class="btnrow"><button class="btn small" data-act="newArea">＋ New area</button><button class="btn small" data-act="renameArea">Rename area</button><button class="btn small danger" data-act="delArea">Delete area</button></div>
      <p class="hint">Grid squares are 50 cm. Drag beds and pots roughly where they are; exact placement doesn’t matter.</p>`
      : `<div class="btnrow"><a class="btn" href="#/map?a=${areaId}&edit=1" onclick="location.replace(this.href);return false;">✥ Arrange map</a><button class="btn" data-act="newArea">＋ New area</button></div>`}`;
  function draw() {
    $('#mapbox').innerHTML = mapSVG(areaId, { edit, width: vw, sel });
    $('#selbar').hidden = !(edit && sel);
  }
  const after = () => {
    draw();
    const box = $('#mapbox');
    let drag = null;
    const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    box.addEventListener('click', e => { if (edit) return; const g = e.target.closest('[data-cid]'); if (g) go('#/container/' + g.dataset.cid); });
    if (!edit) return;
    box.style.touchAction = 'none';
    box.addEventListener('pointerdown', e => {
      const g = e.target.closest('[data-cid]'); if (!g) { sel = null; draw(); return; }
      const c = container(g.dataset.cid); sel = c.id;
      const p = toCm(e); drag = { c, dx: p.x - c.pos[0], dy: p.y - c.pos[1], g, start: c.pos.slice() };
      box.setPointerCapture(e.pointerId); g.classList.add('sel'); $('#selbar').hidden = false;
    });
    box.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = toCm(e); drag.c.pos = [Math.max(0, Math.round((p.x - drag.dx) / 5) * 5), Math.max(0, Math.round((p.y - drag.dy) / 5) * 5)];
      drag.g.setAttribute('transform', `translate(${drag.c.pos[0] - drag.start[0]} ${drag.c.pos[1] - drag.start[1]})`);
      drag.moved = true;
    });
    const end = async () => { if (!drag) return; const moved = drag.moved; drag = null; if (moved) await save(); draw(); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  };
  return { html, after };
}

// ---------- adjust sections by dragging ----------
function pageSections(c) {
  if (!c) return { html: notFound() };
  setChrome('Adjust sections', { back: true, kicker: c.name });
  const L = Draw.dims(c).L;
  if (!draft) draft = { ps: activeIn(c.id).map(p => ({ id: p.id, from: p.from, to: p.to })) };
  const d = draft;
  const vw = Math.min(window.innerWidth, 640) - 32;
  const { W } = Draw.dims(c);
  const px = Math.min(vw / W, (window.innerHeight * 0.62) / L);
  const handles = () => {
    const hs = [];
    const add = (y, ref) => { let h = hs.find(x => Math.abs(x.y - y) < 0.01); if (!h) hs.push(h = { y, refs: [] }); h.refs.push(ref); };
    d.ps.forEach(p => { add(p.from, [p, 'from']); add(p.to, [p, 'to']); });
    return hs.sort((a, b) => a.y - b.y);
  };
  const limits = h => {
    let lo = 0, hi = L;
    for (const [p, k] of h.refs) {
      if (k === 'from') { hi = Math.min(hi, p.to - 5); const prev = d.ps.filter(q => q !== p && q.to <= p.from + 0.01 && !h.refs.some(r => r[0] === q)).map(q => q.to); lo = Math.max(lo, ...prev, 0); }
      else { lo = Math.max(lo, p.from + 5); const next = d.ps.filter(q => q !== p && q.from >= p.to - 0.01 && !h.refs.some(r => r[0] === q)).map(q => q.from); hi = Math.min(hi, ...next, L); }
    }
    return [lo, hi];
  };
  const draw = () => {
    const list = decorate(activeIn(c.id).map(p => Object.assign({}, p, d.ps.find(x => x.id === p.id))));
    let s = Draw.svg(c, list, { px, today: todayStr(), labels: true, grid: true, showMargin: true });
    const hs = handles();
    const hb = hs.map((h, i) => `<g class="handle" data-h="${i}"><rect x="-4" y="${h.y - 14 / px}" width="${W + 8}" height="${28 / px}" class="hhit"/><line x1="0" y1="${h.y}" x2="${W}" y2="${h.y}" class="hline" vector-effect="non-scaling-stroke"/>
      <rect x="${W / 2 - 22 / px}" y="${h.y - 9 / px}" width="${44 / px}" height="${18 / px}" rx="${4 / px}" class="hpill"/><text x="${W / 2}" y="${h.y + 4 / px}" font-size="${11 / px}" text-anchor="middle" class="htxt">${Math.round(h.y)}</text></g>`).join('');
    s = s.replace(/<\/svg>$/, hb + '</svg>');
    $('#secbox').innerHTML = s;
    $('#secinfo').innerHTML = list.map(p => `<li>${ic(p.cropId)}<span class="grow">${esc(crop(p.cropId).en)}</span><b>${Math.round(p.from)}–${Math.round(p.to)} cm</b></li>`).join('');
  };
  A.saveSec = async () => {
    for (const x of d.ps) { const p = planting(x.id); p.from = Math.round(x.from); p.to = Math.round(x.to); if (p.layout === 'free') p.positions = (p.positions || []).filter(q => q[1] >= p.from && q[1] <= p.to); }
    await save(); draft = null; history.back();
  };
  const html = `<p class="hint">Drag the orange tabs to move where a crop starts and ends — including the top and bottom of the bed, to free up space for another crop. Moves in 1 cm steps.</p>
    <div class="plotwrap" id="secbox" style="touch-action:none"></div><ul class="plist" id="secinfo"></ul>
    <button class="btn primary wide" data-act="saveSec">Save sections</button>`;
  const after = () => {
    draw();
    const box = $('#secbox'); let drag = null;
    const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    box.addEventListener('pointerdown', e => { const g = e.target.closest('[data-h]'); if (!g) return; const h = handles()[+g.dataset.h]; drag = { h, lim: limits(h) }; box.setPointerCapture(e.pointerId); e.preventDefault(); });
    box.addEventListener('pointermove', e => {
      if (!drag) return;
      const y = Math.round(Math.max(drag.lim[0], Math.min(drag.lim[1], toCm(e).y)));
      for (const [p, k] of drag.h.refs) p[k] = y;
      drag.h.y = y; draw();
    });
    const end = () => { drag = null; };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  };
  return { html, after };
}

// ---------- season review & comparison ----------
function plantingStats(p) {
  const hs = (p.harvests || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = hs[0] ? hs[0].date : null;
  const pests = [...new Set((p.diary || []).flatMap(d => d.tags || []))];
  return { total: harvestTotal(p), first, toFirst: first && p.sowDate ? daysBetween(p.sowDate, first) : null, pests };
}
const yearOf = p => (p.sowDate || p.created || '').slice(0, 4);
function pageReview(q) {
  const years = [...new Set(S.plantings.map(yearOf).filter(Boolean))].sort().reverse();
  const y = q.get('y') || years[0] || String(new Date().getFullYear());
  setChrome('Season review', { back: true, kicker: y });
  const html = `<div class="seg wrap">${(years.length ? years : [y]).map(x => `<a href="#/review?y=${x}" onclick="location.replace(this.href);return false;" class="${x === y ? 'on' : ''}">${x}</a>`).join('')}</div>
    ${S.containers.map(c => {
      const ps = S.plantings.filter(p => p.containerId === c.id && yearOf(p) === y).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
      const notes = (c.log || []).filter(n => n.date.startsWith(y));
      if (!ps.length && !notes.length) return '';
      return `<section><h3>${esc(c.name)}</h3>${ps.map(p => { const st = plantingStats(p); return `<a class="rvcard" href="#/plant/${p.id}">
        <div class="rvh">${ic(p.cropId, 30)}<b>${esc(crop(p.cropId).en)}</b>${p.variety ? `<span>${esc(p.variety)}</span>` : ''}</div>
        <div class="rvg"><div><small>${p.method === 'seed' ? 'Sown' : 'Planted'}</small>${shortDate(p.sowDate)}</div><div><small>First pick</small>${st.first ? `${shortDate(st.first)} <small>(${st.toFirst} d)</small>` : '—'}</div>
        <div><small>Picked</small>${st.total || '—'}</div><div><small>Status</small>${p.status === 'harvested' ? 'done ' + shortDate(p.harvestedOn) : 'growing'}</div></div>
        ${p.germ ? `<div class="rvx">Germination: ${p.germ.result}</div>` : ''}${st.pests.length ? `<div class="rvx">Problems: ${st.pests.map(pestName).join(', ')}</div>` : ''}${p.notes ? `<div class="rvx">${esc(p.notes)}</div>` : ''}</a>`; }).join('')}
        ${notes.length ? `<ul class="plist">${notes.map(n => `<li><span class="grow"><small>${shortDate(n.date)}</small>${esc(n.text)}</span></li>`).join('')}</ul>` : ''}</section>`;
    }).join('') || '<p class="muted center">Nothing recorded for this year.</p>'}
    <a class="btn wide" href="#/compare">Compare a crop across years →</a>`;
  return { html };
}
function pageCompare(q) {
  const used = [...new Set(S.plantings.map(p => p.cropId))];
  const id = q.get('crop') || used[0];
  setChrome('Compare years', { back: true, kicker: id ? crop(id).en : '' });
  if (!id) return { html: '<p class="muted center">Nothing planted yet.</p>' };
  const ps = S.plantings.filter(p => p.cropId === id).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
  const maxT = Math.max(1, ...ps.map(harvestTotal));
  const html = `<label class="form"><select id="cmpSel">${used.map(x => `<option value="${x}"${x === id ? ' selected' : ''}>${esc(cropName(x))}</option>`).join('')}</select></label>
    ${ps.map(p => { const st = plantingStats(p), c = container(p.containerId); return `<a class="rvcard" href="#/plant/${p.id}">
      <div class="rvh"><b>${yearOf(p)}</b><span>${esc(p.variety || 'no variety')}</span><span class="muted">${esc(c ? c.name : '')}</span></div>
      <div class="rvg"><div><small>Sown</small>${shortDate(p.sowDate)}</div><div><small>To first pick</small>${st.toFirst != null ? st.toFirst + ' days' : '—'}</div>${p.method === 'seed' ? `<div><small>Germination</small>${p.germ ? p.germ.result : '—'}</div>` : ''}</div>
      <div class="cbar"><span style="width:${(st.total / maxT) * 100}%"></span><b>${st.total} picked</b></div>
      ${st.pests.length ? `<div class="rvx">Problems: ${st.pests.map(pestName).join(', ')}</div>` : ''}</a>`; }).join('')}`;
  return { html, after: () => $('#cmpSel').addEventListener('change', e => location.replace('#/compare?crop=' + e.target.value)) };
}

// ---------- split a bed to add another crop ----------
function splitDialog(c) {
  const L = Draw.dims(c).L, ps = activeIn(c.id), gs = gaps(c);
  // crop to shrink: the one with the longest section
  const big = ps.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
  const half = Math.round((big.from + big.to) / 2);
  modal(`<h3>Add another crop</h3>
    ${gs.length ? `<p class="msg">There’s already free space: ${gs.map(g => `<b>${g[0]}–${g[1]} cm</b>`).join(', ')}.</p><div class="btns col">${gs.map(g => `<a class="btn primary" href="#/plant/new/${c.id}?from=${g[0]}&to=${g[1]}" data-x="go">Plant in ${g[0]}–${g[1]} cm</a>`).join('')}</div><p class="hint">…or make more room by shrinking a crop:</p>` : ''}
    <form id="spf" class="form">
      ${ps.length > 1 ? `<label>Make room by shrinking<select name="pid">${ps.map(p => `<option value="${p.id}"${p === big ? ' selected' : ''}>${esc(crop(p.cropId).en)} (${p.from}–${p.to} cm)</option>`).join('')}</select></label>` : `<p class="msg">${ic(big.cropId)} <b>${esc(crop(big.cropId).en)}</b> uses ${big.from}–${big.to} cm.</p>`}
      <label>Split at (cm from top)<input name="at" type="number" inputmode="numeric" value="${half}"></label>
      <div class="seg"><button type="button" data-side="bottom" class="on">New crop below</button><button type="button" data-side="top">New crop above</button></div>
      <div id="spprev" class="preview"></div>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Next: choose crop</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('#spf');
    let side = 'bottom';
    const cur = () => planting(f.pid ? f.pid.value : big.id);
    const preview = () => {
      const p = cur(), at = Math.round(+f.at.value);
      const ok = at > p.from + 4 && at < p.to - 4;
      const shrunk = Object.assign({}, p, side === 'bottom' ? { to: at } : { from: at });
      const list = decorate(ps.map(x => x.id === p.id ? shrunk : x));
      m.querySelector('#spprev').innerHTML = ok ? Draw.svg(c, list, { px: Math.min(200 / L, 220 / Draw.dims(c).W), today: todayStr(), labels: false, gaps: [side === 'bottom' ? [at, p.to] : [p.from, at]].map(g => [g[0], g[1], 'new crop']), grid: true }).replace(/class="gap"/g, 'class="gap newsec"') : `<p class="muted">Pick a point between ${p.from + 5} and ${p.to - 5} cm.</p>`;
      if (f.at.max != p.to - 5) { f.at.min = p.from + 5; f.at.max = p.to - 5; }
    };
    m.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { side = b.dataset.side; m.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('on', x === b)); preview(); });
    f.addEventListener('input', preview); if (f.pid) f.pid.addEventListener('change', () => { const p = cur(); f.at.value = Math.round((p.from + p.to) / 2); preview(); });
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-x=go]').forEach(x => x.onclick = () => close());
    preview();
    f.onsubmit = async e => {
      e.preventDefault();
      const p = cur(), at = Math.round(+f.at.value);
      if (!(at > p.from + 4 && at < p.to - 4)) return alert(`Pick a split point between ${p.from + 5} and ${p.to - 5} cm.`);
      let nf, nt;
      if (side === 'bottom') { nf = at; nt = p.to; p.to = at; } else { nf = p.from; nt = at; p.from = at; }
      if (p.layout === 'free') p.positions = (p.positions || []).filter(q => q[1] >= p.from && q[1] <= p.to);
      await save(); close();
      go(`#/plant/new/${c.id}?from=${nf}&to=${nt}`);
    };
  });
}
