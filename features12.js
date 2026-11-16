/* Next season's rotation plan, variety notes, photo timeline per bed, and the pick-safe board. */
'use strict';

// =====================================================================
// Rotation plan
// =====================================================================
// years to leave before the same family goes back in the same spot (common Japanese 連作障害 guidance)
const REST = {
  tomato: 4, minitomato: 4, nasu: 4, piman: 3, shishito: 3, chilli: 3, potato: 3, kyuri: 2, zucchini: 2, snappea: 4, sayaendo: 4, soramame: 4,
  edamame: 2, ingen: 2, hakusai: 2, cabbage: 2, broccoli: 2, cauliflower: 2, daikon: 1, kabu: 1, komatsuna: 1, chingensai: 1, mizuna: 1, nanohana: 1,
  hatsuka: 0, onion: 1, naganegi: 1, garlic: 1, hatamanegi: 1, carrot: 1, celery: 2, lettuce: 1, shungiku: 1, spinach: 1, corn: 0, satsumaimo: 0, satoimo: 3, strawberry: 2,
};
const yearOfD = d => +String(d || '').slice(0, 4) || null;
function grownIn(c) {   // [{cropId, family, year, from, to}]
  const out = [];
  for (const h of c.history || []) { const y = yearOfD(h.harvestedOn || h.sowDate || (h.ym ? h.ym + '-01' : '')); if (y) out.push({ cropId: h.cropId, family: crop(h.cropId).family || 'other', year: y, from: h.from, to: h.to }); }
  for (const p of S.plantings) if (p.containerId === c.id && p.status !== 'harvested' && p.sowDate) out.push({ cropId: p.cropId, family: crop(p.cropId).family || 'other', year: yearOfD(isPlanned(p) ? p.sowDate : (p.harvestDate || p.sowDate)), from: p.from, to: p.to, planned: isPlanned(p) });
  return out.filter(x => x.family !== 'other');
}
// family → year it may come back
function rotationBlocks(c) {
  const b = {};
  for (const g of grownIn(c)) { const rest = REST[g.cropId] ?? 1, ok = g.year + rest + (rest > 0 ? 1 : 0); if (!b[g.family] || b[g.family].ok < ok) b[g.family] = { ok, last: g.year, cropId: g.cropId }; }
  return b;
}
function nextSeasonYear() { const d = new Date(); return d.getMonth() + 1 >= 7 ? d.getFullYear() + 1 : d.getFullYear(); }
const MAIN_FAMS = ['nightshade', 'cucurbit', 'legume', 'brassica', 'allium', 'umbellifer', 'aster', 'amaranth'];
function pageRotation() {
  setChrome('Rotation plan', { back: true, kicker: `Where each family can go in ${nextSeasonYear()}` });
  const yr = nextSeasonYear(), cs = S.containers.filter(c => c.type !== 'nursery');
  const myFams = [...new Set([...S.plantings.map(p => crop(p.cropId).family), ...S.containers.flatMap(c => (c.history || []).map(h => crop(h.cropId).family))].filter(f => MAIN_FAMS.includes(f)))];
  const fams = MAIN_FAMS.filter(f => myFams.includes(f)).concat(MAIN_FAMS.filter(f => !myFams.includes(f)));
  const blocks = Object.fromEntries(cs.map(c => [c.id, rotationBlocks(c)]));
  const famRow = f => {
    const ok = cs.filter(c => !(blocks[c.id][f] && blocks[c.id][f].ok > yr)), no = cs.filter(c => blocks[c.id][f] && blocks[c.id][f].ok > yr);
    const since = c => blocks[c.id][f] ? yr - blocks[c.id][f].last : 99;
    ok.sort((a, b) => since(b) - since(a));
    return `<li class="rot"><div><b>${esc(FAMILIES[f][0])}</b> <small class="ja">${esc(FAMILIES[f][1])}</small></div>
      <div class="sowchips">${ok.map(c => `<a class="chip ok" href="#/container/${c.id}">${esc(c.name)}${blocks[c.id][f] ? ` <small>last ${blocks[c.id][f].last}</small>` : ' <small>never</small>'}</a>`).join('') || '<span class="muted small">No free spot</span>'}</div>
      ${no.length ? `<small class="muted">Not: ${no.map(c => `${esc(c.name)} (${esc(crop(blocks[c.id][f].cropId).en)} ${blocks[c.id][f].last} → from ${blocks[c.id][f].ok})`).join(', ')}</small>` : ''}</li>`;
  };
  const bedRow = c => {
    const g = grownIn(c), by = {}; g.forEach(x => { (by[x.year] = by[x.year] || []).push(x); });
    const years = Object.keys(by).sort().reverse().slice(0, 4);
    const avoid = Object.entries(blocks[c.id]).filter(([, v]) => v.ok > yr);
    return `<li><a href="#/container/${c.id}"><span class="grow"><b>${esc(c.name)}</b>
      <small>${years.length ? years.map(y => `${y}: ${[...new Set(by[y].map(x => crop(x.cropId).en + (x.planned ? ' (planned)' : '')))].join(', ')}`).join(' · ') : 'no records yet'}</small>
      ${avoid.length ? `<small>⚠ Avoid in ${yr}: ${avoid.map(([f, v]) => `${esc(FAMILIES[f][0].split(' (')[0])} (until ${v.ok})`).join(', ')}</small>` : `<small>✓ Anything can go here in ${yr}</small>`}</span>›</a></li>`;
  };
  const html = `<p class="hint">Based on what grew in each bed and pot (including past crops you added). Wait times are common Japanese guidance for avoiding replant problems (連作障害) — e.g. tomatoes & eggplant 4 years, peas 4–5, brassicas 2, leafy greens 1. Within a bed it counts the whole bed, to be safe.</p>
    <section><h3>By family</h3><ul class="plist rotl">${fams.map(famRow).join('')}</ul></section>
    <section><h3>By bed</h3><ul class="plist">${cs.map(bedRow).join('')}</ul></section>`;
  return { html };
}

// =====================================================================
// Variety notes
// =====================================================================
const varKey = (c, v) => c + '|' + (v || '');
function varietyRuns(cropId, v) {
  return S.plantings.filter(p => p.cropId === cropId && (p.variety || '') === (v || '')).sort((a, b) => (a.sowDate < b.sowDate ? 1 : -1));
}
function pageVariety(q) {
  const cid = q.get('c'), v = q.get('v') || '', cr = crop(cid);
  setChrome(v || 'No variety', { back: true, kicker: cr.en + (cr.ja ? ' ' + cr.ja : '') });
  const runs = varietyRuns(cid, v), k = varKey(cid, v), note = (S.varNotes || {})[k] || { rating: '', note: '' };
  A.rate = async el => { S.varNotes = Object.assign({}, S.varNotes, { [k]: Object.assign({}, note, { rating: note.rating === el.dataset.r ? '' : el.dataset.r }) }); await save(); render(); };
  A.saveVarNote = async () => { S.varNotes = Object.assign({}, S.varNotes, { [k]: Object.assign({}, note, { note: $('#vnote').value.trim() }) }); await save(); $('#vsaved').textContent = 'Saved ✓'; };
  const first = p => [...(p.harvests || []).map(h => h.date)].sort()[0];
  const row = p => {
    const c = container(p.containerId), fh = first(p), pests = [...new Set((p.diary || []).flatMap(d => d.tags || []))].map(pestName);
    return `<li><a href="#/plant/${p.id}"><span class="grow"><b>${shortDate(p.sowDate)} ${yearOfD(p.sowDate)}</b> · ${esc(c ? c.name : '')}${isPlanned(p) ? ' · planned' : ''}
      <small>${p.method === 'seed' ? 'sown' : 'planted'}${p.germ ? ` · came up ${p.germ.result}${p.germ.date ? ` in ${daysBetween(p.sowDate, p.germ.date)} days` : ''}` : ''}${fh ? ` · first pick after ${daysBetween(p.sowDate, fh)} days` : ''}${harvestTotal(p) ? ` · ${harvestTotal(p)} picked` : ''}</small>
      ${pests.length ? `<small>Problems: ${esc(pests.join(', '))}</small>` : ''}</span>›</a></li>`;
  };
  const html = `<section><h3>Grow again?</h3><div class="seg">${[['yes', '👍 Yes'], ['maybe', '🤔 Maybe'], ['no', '👎 No']].map(([r, l]) => `<button type="button" data-act="rate" data-r="${r}" class="${note.rating === r ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="form">Notes<textarea id="vnote" rows="3" placeholder="Taste, vigour, bolting, how it handled the heat or cold…">${esc(note.note || '')}</textarea></label>
      <div class="btns"><span id="vsaved" class="muted"></span><button class="btn small primary" data-act="saveVarNote">Save note</button></div></section>
    <section><h3>Every time you’ve grown it (${runs.length})</h3><ul class="plist">${runs.map(row).join('') || '<li class="muted">Not grown yet.</li>'}</ul></section>`;
  return { html };
}
function pageVarieties() {
  setChrome('Varieties', { back: true, kicker: 'Everything you’ve grown' });
  const seen = new Map();
  for (const p of S.plantings) { const k = varKey(p.cropId, p.variety); if (!seen.has(k)) seen.set(k, { cropId: p.cropId, v: p.variety || '', n: 0, last: '' }); const e = seen.get(k); e.n++; if ((p.sowDate || '') > e.last) e.last = p.sowDate; }
  const list = [...seen.values()].sort((a, b) => crop(a.cropId).en.localeCompare(crop(b.cropId).en) || a.v.localeCompare(b.v));
  const icon = r => r === 'yes' ? '👍' : r === 'no' ? '👎' : r === 'maybe' ? '🤔' : '';
  const html = `<ul class="plist">${list.map(e => { const nt = (S.varNotes || {})[varKey(e.cropId, e.v)] || {}; return `<li><a href="#/variety?c=${encodeURIComponent(e.cropId)}&v=${encodeURIComponent(e.v)}">${ic(e.cropId)}<span class="grow"><b>${esc(crop(e.cropId).en)}</b> · ${esc(e.v || 'no variety')} ${icon(nt.rating)}<small>grown ${e.n}× · last ${shortDate(e.last)} ${yearOfD(e.last) || ''}${nt.note ? ' · ' + esc(nt.note.slice(0, 60)) : ''}</small></span>›</a></li>`; }).join('') || '<li class="muted">Nothing grown yet.</li>'}</ul>`;
  return { html };
}

// =====================================================================
// Photo timeline per bed (or the whole garden)
// =====================================================================
function bedPhotos(cid) {
  const out = [];
  for (const p of S.plantings) if (!cid || p.containerId === cid) for (const d of p.diary || []) if (d.photo) out.push({ p, d });
  return out.sort((a, b) => (a.d.date < b.d.date ? -1 : a.d.date > b.d.date ? 1 : 0));
}
function pageTimeline(q) {
  const c = container(q.get('c')), list = bedPhotos(c && c.id), i = q.get('i');
  setChrome(c ? c.name : 'All photos', { back: true, kicker: 'Photo timeline' });
  if (i != null && list[+i]) {
    const n = +i, { p, d } = list[n], url = j => `#/timeline?${c ? 'c=' + c.id + '&' : ''}i=${j}`;
    setTimeout(() => {
      const fig = $('#tlimg'); if (!fig) return; let x0 = null;
      fig.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      fig.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { const j = n + (dx < 0 ? 1 : -1); if (list[j]) location.replace(url(j)); } x0 = null; });
    });
    return { html: `<figure class="bigphoto ph" id="tlimg"><img data-photo="${d.photo}" alt=""></figure>
      <p class="center"><b>${niceDate(d.date)}</b> · ${ic(p.cropId)} ${esc(crop(p.cropId).en)}${!c ? ' · ' + esc((container(p.containerId) || {}).name || '') : ''} <small class="muted">day ${daysBetween(p.sowDate, d.date)}</small></p>
      ${d.note ? `<p class="center">${esc(d.note)}</p>` : ''}
      <div class="dnav">${list[n - 1] ? `<a class="btn small" href="${url(n - 1)}" onclick="location.replace(this.href);return false;">‹ Older</a>` : '<span></span>'}<span class="muted">${n + 1} / ${list.length}</span>${list[n + 1] ? `<a class="btn small" href="${url(n + 1)}" onclick="location.replace(this.href);return false;">Newer ›</a>` : '<span></span>'}</div>
      <p class="hint center">Swipe left or right.</p>` };
  }
  const groups = {}; list.forEach((x, j) => { const m = new Date(x.d.date + 'T00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }); (groups[m] = groups[m] || []).push([x, j]); });
  const html = list.length ? Object.entries(groups).map(([m, xs]) => `<h3 class="grp">${m}</h3><div class="tlgrid">${xs.map(([x, j]) => `<a href="#/timeline?${c ? 'c=' + c.id + '&' : ''}i=${j}"><img data-photo="${x.d.photo}" alt=""><small>${shortDate(x.d.date)} · ${esc(crop(x.p.cropId).en)}</small></a>`).join('')}</div>`).join('')
    : '<div class="empty-state">No diary photos yet.<br><small>Add them from a crop’s Photo diary.</small></div>';
  return { html };
}

// =====================================================================
// Pick-safe board
// =====================================================================
function pagePickSafe() {
  setChrome('OK to pick?', { back: true, kicker: 'Spray waiting periods' });
  const td = todayStr(), act = S.plantings.filter(isLive);
  const rows = act.map(p => ({ p, h: sprayHolds(p)[0] || null })).sort((a, b) => (!!b.h - !!a.h) || ((a.h && a.h.until) < (b.h && b.h.until) ? -1 : 1));
  const html = `${rows.length ? `<ul class="plist pick">${rows.map(({ p, h }) => { const c = container(p.containerId), n = h ? daysBetween(td, h.until) : 0, ready = p.harvestDate && p.harvestDate <= td;
    return `<li class="${h ? 'hold' : 'okp'}"><a href="#/plant/${p.id}"><span class="lic">${h ? '⛔' : '✅'}</span>${ic(p.cropId)}<span class="grow"><b>${esc(crop(p.cropId).en)}</b> · ${esc(c ? c.name : '')}
      <small>${h ? `Wait <b>${n} day${n === 1 ? '' : 's'}</b> — until ${shortDate(h.until)} (${esc(h.e.product || 'spray')} on ${shortDate(h.e.date)})` : 'OK to pick — no spray waiting period'}${ready ? ' · 🧺 ready' : p.harvestDate ? ` · ready from ${shortDate(p.harvestDate)}` : ''}</small></span>›</a></li>`; }).join('')}</ul>` : '<div class="empty-state">Nothing growing.</div>'}
    <p class="hint">From the sprays in your log and each product’s legal waiting period (使用時期). Log every spray so this stays right.</p>`;
  return { html };
}
