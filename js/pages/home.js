// The home page: the garden at a glance, today's jobs and one compact heads-up card.

import { driveBanner, driveOn } from '../backup/drive.js';
import { sowNowSection, sowPick } from '../climate/sowing.js';
import { climateNotice } from '../climate/climate.js';
import { dayName, sprayDays, Weather } from '../climate/weather.js';
import { A, render, route, sekki, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { $, daysBetween, esc, go, pd, shortDate, todayStr } from '../core/util.js';
import { Draw, plotSVG } from '../draw.js';
import { activeIn, isLive, sizeLabel } from '../garden/garden.js';
import { ensureAreas, mapSVG } from '../garden/map.js';
import { effDue, jobsList, sortTasks, taskVisible } from '../garden/tasks.js';
import { coverChips, coverNotes, coverType } from '../plants/covers.js';
import { crop, ic } from '../plants/crops.js';
import { qualityWarnings } from '../plants/problems.js';
import { seedlingsHomeSection } from '../plants/seedlings.js';
import { sprayHolds } from '../products/sprays.js';
import { quickAdd } from './search.js';

// ---------- the home page ----------
function homeMap() {
  ensureAreas();
  const aid = S.mapArea && S.areas.find(x => x.id === S.mapArea) ? S.mapArea : S.areas[0].id;
  A.harea = async el => { S.mapArea = el.dataset.id; await save(); render(); };
  setTimeout(() => { const b = $('#homemap'); if (b) b.addEventListener('click', e => { const g = e.target.closest('[data-cid]'); if (g) go('#/container/' + g.dataset.cid); }); });
  return `${S.areas.length > 1 ? `<div class="seg wrap">${S.areas.map(x => `<button type="button" data-act="harea" data-id="${x.id}" class="${x.id === aid ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    <div class="mapbox" id="homemap">${mapSVG(aid, { width: Math.min(window.innerWidth, 680) - 32 })}</div>
    <div class="btnrow"><a class="btn small" href="#/map?a=${aid}&edit=1">✥ Arrange map &amp; areas</a></div>`;
}
export function pageHome() {
  const td = todayStr();
  const open = S.tasks.filter(t => !t.done && taskVisible(t));
  const today = sortTasks(open.filter(t => effDue(t) === td));
  const soon = open.filter(t => { const n = daysBetween(td, effDue(t)); return n > 0 && n <= 7; }).length;
  const card = c => {
    const ps = activeIn(c.id);
    const chips = ps.map(p => `<span class="chip">${ic(p.cropId)}${esc(crop(p.cropId).en)}</span>`).join('') || '<span class="chip muted">empty</span>';
    const { W, L } = Draw.dims(c);
    return `<a class="card" href="#/container/${c.id}"><div class="thumb">${plotSVG(c, { px: Math.min(150 / L, 150 / W), minPx: 1.2 })}</div>
      <div class="cname">${esc(c.name)}</div><div class="csize">${sizeLabel(c)}</div><div class="chips">${chips}</div>${coverChips(c)}</a>`;
  };
  const potTile = c => { const ps = activeIn(c.id), { W, L } = Draw.dims(c);
    return `<a class="ptile" href="#/container/${c.id}"><div class="thumb">${plotSVG(c, { px: Math.min(84 / L, 84 / W), minPx: 1.2 })}</div><b>${esc(c.name)}</b><small>${ps.map(p => esc(crop(p.cropId).en)).join(', ') || 'empty'}</small>${coverChips(c)}</a>`; };
  const growing = S.plantings.filter(isLive).length;
  setChrome('My Garden', { tab: 'home', big: true, kicker: pd(td).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), sub: sekki(),
    stats: `<div><b>${today.length}</b><span>job${today.length === 1 ? '' : 's'} today</span></div><div><b>${growing}</b><span>growing</span></div>` });
  const beds = S.containers.filter(c => c.type === 'bed'), pots = S.containers.filter(c => c.type !== 'bed');
  let backupNote = '';
  if (S.plantings.length) {
    const n = S.lastBackup ? daysBetween(S.lastBackup, td) : null;
    if (n === null || (n >= 7 && (S.lastEdit || '9') > S.lastBackup)) backupNote = `<a class="banner" href="#/settings">💾 ${n === null ? 'No backup yet' : `Last backup ${n} days ago`} — tap to back up</a>`;
  }
  A.sowCrop = el => sowPick(el.dataset.id);
  if (driveOn() && S.drive.lastDate && daysBetween(S.drive.lastDate, td) < 7) backupNote = '';   // Drive has it covered
  const html = `${driveBanner()}${backupNote}
    ${climateNotice()}${Weather.section()}
    ${headsCard()}
    <section class="today"><h2>Today’s jobs</h2>
      ${today.length ? `<ul class="tasks">${jobsList(today)}</ul>` : '<p class="muted">Nothing to do today 🌤️</p>'}
      ${soon ? `<a class="more" href="#/cal">${soon} more in the next 7 days →</a>` : ''}</section>
    ${S.firstRun ? `<a class="banner" href="#/welcome?s=2">🌱 <b>Finish setting up</b> — where your garden is and which crops you grow ›</a>` : ''}
    ${!S.containers.length ? `<div class="empty-state"><p>No beds or pots yet.</p><a class="btn primary" href="#/container/new">＋ Add a bed or pot</a></div>` : ''}
    ${S.containers.length ? `<div class="viewtog seg"><button type="button" data-act="hv" data-v="cards" class="${S.homeView !== 'map' ? 'on' : ''}">▦ Cards</button><button type="button" data-act="hv" data-v="map" class="${S.homeView === 'map' ? 'on' : ''}">🗺 Map</button></div>` : ''}
    ${S.homeView === 'map' && S.containers.length ? homeMap() : `
    ${beds.length ? `<h3 class="grp">Beds</h3><div class="grid">${beds.map(card).join('')}</div>` : ''}
    ${pots.length ? `<h3 class="grp">Pots &amp; bags</h3>${pots.length > 4 ? `<div class="grid3">${pots.map(potTile).join('')}</div>` : `<div class="grid">${pots.map(card).join('')}</div>`}` : ''}
    ${seedlingsHomeSection()}`}
    ${sowNowSection()}
    <button class="fab" data-act="quick" aria-label="Quick add">＋</button>`;
  A.quick = () => quickAdd();
  A.hv = async el => { S.homeView = el.dataset.v; await save(); render(); };
  return { html, after: () => Weather.refresh().then(ch => { if (ch && !route().parts.length) render(); }) };
}

// ---------- the heads-up card ----------
function headsItems() {
  const out = [];
  try {   // spray waiting periods
    const by = {}; for (const p of S.plantings.filter(isLive)) { const h = sprayHolds(p)[0]; if (h) (by[h.until] = by[h.until] || []).push(crop(p.cropId).en); }
    for (const u of Object.keys(by).sort()) out.push({ k: 'spray', i: '⛔', t: `Don’t pick <b>${esc(by[u].join(', '))}</b> until ${shortDate(u)} (spray wait)`, h: '#/picksafe' });
  } catch (e) { console.warn(e); }
  if (S.weather && S.weather.lat != null) {
    const ico = { frost: '❄️', rain: '🌧️', wind: '💨', heat: '🥵' };
    for (const [k, t] of Weather.alerts()) out.push({ k, i: ico[k] || '⚠️', t, h: null });
    try { const ds = sprayDays(), best = ds.find(x => x.wins.length); if (ds.length) out.push({ k: 'sprayday', i: '💦', t: best ? `Best spray window: ${dayName(best.d) === 'Today' ? 'today' : dayName(best.d)} ${best.wins.map(w => `${w[0]}:00–${w[1]}:00`).join(', ')}` : 'No good spray window in the next few days', h: '#/sprayday', low: true }); } catch (e) { console.warn(e); }
    try { for (const [p, k, t] of qualityWarnings()) out.push({ k, i: k === 'bolt' ? '🌼' : k === 'split' ? '💧' : '❄️', t: esc(t), h: '#/plant/' + p.id }); } catch (e) { console.warn(e); }
  }
  try { for (const n of coverNotes()) out.push({ k: 'cover', i: coverType(n.x.type)[1], t: esc(n.text), h: '#/container/' + n.c.id }); } catch (e) { console.warn(e); }
  return out.sort((a, b) => !!a.low - !!b.low);
}
function headsCard() {
  const items = headsItems(); if (!items.length) return '';
  const li = x => `<li>${x.h ? `<a href="${x.h}">` : '<div>'}<span class="hi">${x.i}</span><span class="grow">${x.t}</span>${x.h ? '<span class="muted">›</span></a>' : '</div>'}</li>`;
  const top = items.slice(0, 3), rest = items.slice(3);
  return `<section class="heads"><ul>${top.map(li).join('')}</ul>${rest.length ? `<details><summary>${rest.length} more</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}</section>`;
}
