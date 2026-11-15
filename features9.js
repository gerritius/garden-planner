/* Re-use: pick seedlings you've already started when adding/planning a crop, and re-use packet photos across plantings. */
'use strict';

// ---------- photos can be shared between plantings: only delete when nothing uses it ----------
function photoUsed(id) {
  return S.plantings.some(p => Object.values(p.photos || {}).includes(id) || (p.diary || []).some(d => d.photo === id));
}
async function dropPhoto(id) {
  if (!id || photoUsed(id)) return;
  await DB.delPhoto(id); delete photoURLs[id];
}

// ---------- packet photos already taken ----------
function packets(excludeKey) {
  const seen = new Map();
  for (const p of S.plantings) {
    const ph = p.photos || {}; if (!ph.front && !ph.back) continue;
    const key = (ph.front || '') + '|' + (ph.back || ''); if (key === excludeKey) continue;
    const e = seen.get(key) || { key, front: ph.front || null, back: ph.back || null, cropId: p.cropId, variety: p.variety || '', uses: [] };
    e.uses.push(p); seen.set(key, e);
  }
  return [...seen.values()];
}
function packetPicker(d) {
  const cur = ((d.photos || {}).front || '') + '|' + ((d.photos || {}).back || '');
  const list = packets(cur).sort((a, b) => ((b.cropId === d.cropId) - (a.cropId === d.cropId)) || ((b.variety === d.variety) - (a.variety === d.variety)));
  if (!list.length) return '';
  const mine = list.filter(x => !d.cropId || x.cropId === d.cropId), rest = list.filter(x => d.cropId && x.cropId !== d.cropId);
  const chip = x => `<button type="button" class="pkt" data-act="usePacket" data-k="${esc(x.key)}"><img data-photo="${x.front || x.back}" alt=""><span>${esc(crop(x.cropId).en)}${x.variety ? `<small>${esc(x.variety)}</small>` : ''}</span></button>`;
  return `<details class="pktpick"${mine.length && !(d.photos || {}).front && !(d.photos || {}).back ? ' open' : ''}><summary>Use a packet you’ve already photographed${mine.length ? ` (${mine.length})` : ''}</summary>
    <div class="pkts">${mine.map(chip).join('')}${rest.length ? `${mine.length ? '<small class="muted pktsep">Other crops</small>' : ''}${rest.slice(0, 12).map(chip).join('')}` : ''}</div></details>`;
}
function usePacket(d, key, c) {
  const x = packets().find(e => e.key === key); if (!x) return;
  d.photos = Object.assign({}, d.photos, { front: x.front || undefined, back: x.back || undefined });
  for (const s of ['front', 'back']) { if (!d.photos[s]) delete d.photos[s]; delete d.newPhotos[s]; delete d.removePhotos[s]; }
  if (!d.cropId) { applyCrop(d, crop(x.cropId), c); }
  if (!d.variety && x.cropId === d.cropId) d.variety = x.variety;
}

// ---------- seedlings already started ----------
const freeStarts = exceptPid => startsGrowing().filter(s => { const pp = s.planId && planting(s.planId); return !pp || !isPlanned(pp) || pp.id === exceptPid; });
function startChooser(d) {
  const list = freeStarts(); if (!list.length) return '';
  const td = todayStr();
  return `<div class="usestart"><small>Use seedlings you’ve started</small><div class="sowchips">${list.map(s => { const ready = addDays(s.sowDate, tpDays(s.cropId));
    return `<button type="button" class="chip${d.useStart === s.id ? ' on' : ''}" data-act="useStart" data-id="${s.id}">${ic(s.cropId, 20)}${esc(crop(s.cropId).en)}${s.variety ? ' · ' + esc(s.variety) : ''} <small>×${startLeft(s)} · ${esc(startWhere(s))} · ${ready <= td ? 'ready' : 'ready ~' + shortDate(ready)}</small></button>`; }).join('')}</div></div>`;
}
function applyStart(d, s, c) {
  if (d.useStart === s.id) { d.useStart = null; d.startId = null; d.startN = null; return; }
  const keepSow = d.sowDate, cr = crop(s.cropId);
  if (d.cropId !== s.cropId) applyCrop(d, cr, c);
  d.sowDate = keepSow; d.variety = s.variety || d.variety; d.method = 'seedling'; d.useStart = s.id; d.raise = s.kind;
  if (cr.method === 'seed' && cr.thinSp) d.plantSp = Math.max(+cr.sowSp || 0, +cr.thinSp);
  d.harvestManual = false; recalc(d);
  if (cr.method === 'seed' && cr.daysHarvest) { d.harvestDate = addDays(s.sowDate, +cr.daysHarvest); if (d.harvestDate < addDays(d.sowDate, 14)) d.harvestDate = addDays(d.sowDate, 14); d.harvestManual = true; }
  if (!d.notes) d.notes = `Raised in ${startWhere(s).toLowerCase()}, sown ${shortDate(s.sowDate)}`;
}
// on save of a new planting that uses started seedlings
function linkStartOnSave(d, p) {
  const s = d.useStart && start(d.useStart); if (!s) return;
  if (p.status === 'planned') { s.planId = p.id; p.raise = s.kind; syncStartTasks(s); }
  else { d.startId = s.id; d.startN = d.startN || startLeft(s); }
}
function startReadyNote(d) {
  const s = d.useStart && start(d.useStart); if (!s) return '';
  const ready = addDays(s.sowDate, tpDays(s.cropId));
  return `<p class="hint">🌱 Using ${startLeft(s)} ${esc(crop(s.cropId).en)} seedlings from ${esc(startWhere(s).toLowerCase())}, ready about ${shortDate(ready)}${d.sowDate && ready > d.sowDate ? ` — <b>after</b> this date; they may need longer` : ''}.</p>`;
}
// planned crop page: link seedlings started separately
function planStartLinks(p) {
  if (!isPlanned(p) || linkedStart(p)) return '';
  const m = freeStarts().filter(s => s.cropId === p.cropId); if (!m.length) return '';
  A.linkStart = async el => { const s = start(el.dataset.id); s.planId = p.id; p.method = 'seedling'; p.raise = s.kind; if (!p.variety) p.variety = s.variety; syncStartTasks(s); syncTasks(p); await save(); render(); };
  return `<div class="btnrow">${m.map(s => `<button class="btn small" data-act="linkStart" data-id="${s.id}">🌱 Use my ${esc(crop(s.cropId).en)} seedlings (${esc(startWhere(s))}, ×${startLeft(s)})</button>`).join('')}</div>`;
}
// season plan gaps: offer started seedlings first
function gapStartChips(c, g) {
  const prevFam = g.prev ? crop(g.prev.cropId).family : null;
  return freeStarts().filter(s => !(prevFam && prevFam !== 'other' && crop(s.cropId).family === prevFam))
    .map(s => `<a class="chip mine" href="#/plant/new/${c.id}?plan=1&from=${g.a}&to=${g.b}&date=${g.s}&usestart=${s.id}">🌱 ${esc(crop(s.cropId).en)} <small>your seedlings ×${startLeft(s)}</small></a>`).join('');
}
