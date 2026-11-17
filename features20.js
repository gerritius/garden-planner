/* One Note for crops and beds (photo optional), the bed page's short button row with a More… menu,
   and the shorter Quick add. */
'use strict';

// t = { p } for a crop, { c } for a bed / pot
function noteEntryDialog(t, blob, guess) {
  let photo = blob || null;
  const p = t.p, c = t.c || (p && container(p.containerId));
  const where = p ? `${crop(p.cropId).en}${c ? ' · ' + c.name : ''}` : c ? c.name : '';
  modal(`<h3>📝 Note</h3><p class="muted small">${esc(where)}</p>
    <form id="nef" class="form">
      <div class="notephoto"><label class="phslot ph" id="neph">${photo ? `<img src="${URL.createObjectURL(photo)}" alt="">` : '<span>📷 ＋ Photo<br><small>optional</small></span>'}<input type="file" accept="image/*" hidden></label></div>
      <label>Date<input type="date" name="date" value="${guess && guess <= todayStr() ? guess : todayStr()}" max="${todayStr()}"></label>
      <label>Note<textarea name="note" rows="3" placeholder="${p ? 'e.g. first true leaves, holes in leaves…' : 'e.g. added 2 L compost, soil very wet…'}"></textarea></label>
      ${p ? `<details><summary class="muted">🐛 Spotted a problem?</summary>${pestPicker()}</details>` : ''}
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#nef'), inp = m.querySelector('#neph input');
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      photo = await compress(file);
      m.querySelector('#neph').firstChild.replaceWith(Object.assign(document.createElement('img'), { src: URL.createObjectURL(photo), alt: '' }));
      if (file.lastModified) { const d = iso(new Date(file.lastModified)); if (d <= todayStr() && f.date.value === todayStr()) f.date.value = d; }
    };
    m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault();
      const note = f.note.value.trim(), tags = p ? readPests(f) : [], date = f.date.value || todayStr();
      if (!photo && !note && !tags.length) return close();
      let pid = null; if (photo) { pid = uid(); await DB.putPhoto(pid, photo); }
      if (p) (p.diary = p.diary || []).push({ id: uid(), date, photo: pid, note, tags });
      else (c.log = c.log || []).push({ id: uid(), date, text: note, photo: pid });
      await save(); close(); render();
    };
  });
}
// the old entry points all open the one Note
function diaryEntryDialog(p, blob, guess) { return noteEntryDialog({ p }, blob, guess); }

// crop page photo diary: one add tile
function diarySection(p) {
  const ds = (p.diary || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<section><h3>Photo diary</h3><div class="diary">
    <button type="button" class="dthumb add" data-act="diaryNote"><span>＋<br>Note / photo</span></button>
    ${ds.map(d => { const n = dayN(p, d.date); return `<a class="dthumb ph${d.photo ? '' : ' txt'}" href="#/plant/${p.id}/diary/${d.id}">${d.photo ? `<img data-photo="${d.photo}" alt="">` : `<em>${esc(d.note || (d.tags || []).map(pestName).join(', '))}</em>`}${(d.tags || []).length ? '<i class="pestdot">🐛</i>' : ''}<span>${shortDate(d.date)}${n != null && n >= 0 ? ` · day ${n}` : ''}</span></a>`; }).join('')}
  </div></section>`;
}
function diaryAfter(p) { A.diaryNote = () => noteEntryDialog({ p }); }

// bed page: everything that isn't Plan / Feed / Cover / Note
function bedMoreMenu(c) {
  const nPh = bedPhotos(c.id).length, ps = activeIn(c.id).length;
  const items = [
    ['reading', '🧪', 'Soil reading', () => readingDialog(c)],
    ['prep', '🪏', `Prepare the ${c.type === 'bed' ? 'bed' : 'pot'}`, () => prepDialog(c)],
    ['job', '✓', 'Add a job', () => bedTaskDialog(c)],
    nPh && ['photos', '📷', `Photos (${nPh})`, `#/timeline?c=${c.id}`],
    ps && ['sections', '↕', 'Sections', `#/container/${c.id}/sections`],
    ['rotation', '🔄', 'Rotation', '#/rotation'],
    ['climate', '☀️', 'Where it sits (sun, indoors…)', () => climateDialog(c)],
  ].filter(Boolean);
  modal(`<h3>${esc(c.name)}</h3><div class="tiles qa3">${items.map(([k, i, l]) => `<button class="tile" data-m="${k}"><span>${i}</span>${l}</button>`).join('')}</div>
    <div class="btns"><button class="btn" data-x="no">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    items.forEach(([k, , , act]) => { m.querySelector(`[data-m=${k}]`).onclick = () => { if (typeof act === 'string') { close(); go(act); } else act(); }; });
  });
}

// quick add: six tiles; the rest under More
function quickAdd() {
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

// related Tools pages share one tile and switch with tabs (tabs replace the history entry, so Back goes to Tools)
const TOOL_GROUPS = [
  [['sprayday', '💦 Spray days'], ['picksafe', '✅ OK to pick?'], ['products', '🧴 Products']],
  [['spend', '💴 Spending'], ['totals', '🧮 Product use']],
  [['review', '📒 Season review'], ['compare', '📊 Compare years']],
];
function groupTabs(route) {
  const g = TOOL_GROUPS.find(x => x.some(([r]) => r === route)); if (!g) return '';
  A.tabGo = el => location.replace('#/' + el.dataset.r);
  return `<div class="seg tabs">${g.map(([r, l]) => `<button type="button" data-act="tabGo" data-r="${r}" class="${r === route ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
