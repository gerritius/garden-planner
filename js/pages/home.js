// The home page: the garden at a glance, today's jobs and one compact heads-up card.

import { driveBanner, driveOn } from '../backup/drive.js';
import { sowNowSection, sowPick } from '../climate/sowing.js';
import { climateNotice } from '../climate/climate.js';
import { dayName, sprayDays, Weather } from '../climate/weather.js';
import { ui } from '../data/ui-icons.js';
import { bedDots, dayAlerts, dotsHTML, isReady, maturity, MOIST, SUN } from '../garden/insights.js';
import { A, render, route, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { $, daysBetween, esc, go, pd, shortDate, todayStr } from '../core/util.js';
import { Draw, plotSVG } from '../draw.js';
import { activeIn, container, isLive, sizeLabel } from '../garden/garden.js';
import { ensureAreas, mapSVG } from '../garden/map.js';
import { effDue, jobsList, sortTasks, taskVisible } from '../garden/tasks.js';
import { coverChips, coverNotes, coverType } from '../plants/covers.js';
import { crop, ic } from '../plants/crops.js';
import { qualityWarnings } from '../plants/problems.js';
import { seedlingsHomeSection } from '../plants/seedlings.js';
import { sprayHolds } from '../products/sprays.js';
import { quickAdd } from './search.js';

// ---------- the home page: Today | Beds | Map ----------
// the forecast day picked in the strip (null: everything); it isn't saved — a new visit starts on all of them
let wxSel = null;
const VIEWS = [['today', 'today', 'Today'], ['beds', 'grid', 'Beds'], ['map', 'map', 'Map']];
const homeViewNow = () => { const v = S.homeView === 'cards' ? 'beds' : S.homeView; return VIEWS.some(x => x[0] === v) ? v : 'today'; };
function homeMap() {
  ensureAreas();
  const aid = S.mapArea && S.areas.find(x => x.id === S.mapArea) ? S.mapArea : S.areas[0].id, ov = S.mapOverlay === 'sun' ? 'sun' : 'layout';
  A.harea = async el => { S.mapArea = el.dataset.id; await save(); render(); };
  A.mapOv = async el => { S.mapOverlay = el.dataset.v; await save(); render(); };
  setTimeout(() => { const b = $('#homemap'); if (b) b.addEventListener('click', e => { const g = e.target.closest('[data-cid]'); if (g) go('#/container/' + g.dataset.cid); }); });
  return `<div class="mapsub">${S.areas.length > 1 ? `<div class="seg small wrap">${S.areas.map(x => `<button type="button" data-act="harea" data-id="${x.id}" class="${x.id === aid ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : '<span></span>'}
      <div class="pilltog" role="group" aria-label="Map overlay">${[['layout', 'Layout'], ['sun', 'Sun &amp; Moisture']].map(([v, l]) => `<button type="button" data-act="mapOv" data-v="${v}" class="${v === ov ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="mapbox" id="homemap">${mapSVG(aid, { width: Math.min(window.innerWidth, 680) - 32, pills: true, overlay: ov === 'sun' })}</div>
    ${ov === 'sun' ? mapKey() : `<p class="mapkey">${['ready', 'hot', 'cold'].map(t => `<span><i class="adot ${t}"></i>${{ ready: 'Ready to pick', hot: 'Heat or dry', cold: 'Rain, frost or wind' }[t]}</span>`).join('')}</p>`}
    <div class="btnrow"><a class="btn small" href="#/map?a=${aid}&edit=1">${ui('move', 18)} Arrange map &amp; areas</a></div>`;
}
function mapKey() {
  return `<p class="mapkey">${Object.entries(SUN).map(([, [l, i]]) => `<span>${ui(i, 16)}${l}</span>`).join('')}</p>
    <p class="mapkey">${MOIST.map((l, i) => `<span><i class="mdrop m${i}"></i>${l}</span>`).join('')}</p>
    <p class="hint">Sun is each bed’s own setting. Moisture is estimated from the rain and your watering, unless the meter was read today.</p>`;
}
// a bed or pot card for the Beds view: drawing, crops with how far along they are, alert dots and the next job
function nextJob(c) {
  const ids = new Set(activeIn(c.id).map(p => p.id));
  const t = sortTasks(S.tasks.filter(t => !t.done && taskVisible(t) && t.kind !== 'water' && (ids.has(t.plantingId) || t.containerId === c.id)))[0];
  if (!t) return '';
  const n = daysBetween(todayStr(), effDue(t));
  return `<div class="nextjob">${ui('check', 14)}<span>${esc(t.title)}</span><small>${n <= 0 ? 'today' : n === 1 ? 'tmrw' : shortDate(effDue(t))}</small></div>`;
}
function bedCard(c) {
  const ps = activeIn(c.id), { W, L } = Draw.dims(c);
  const chips = ps.map(p => { const m = maturity(p); return `<span class="chip">${ic(p.cropId)}${esc(crop(p.cropId).en)}${m != null ? `<small class="pct">${isReady(p) ? 'ready' : m + '%'}</small>` : ''}</span>`; }).join('') || '<span class="chip muted">empty</span>';
  const ms = ps.map(maturity).filter(x => x != null), m = ms.length ? Math.max(...ms) : null;
  return `<a class="card bedcard" href="#/container/${c.id}"><span class="dots">${dotsHTML(bedDots(c))}</span><div class="thumb">${plotSVG(c, { px: Math.min(150 / L, 150 / W), minPx: 1.2 })}</div>
    <div class="cname">${esc(c.name)}</div><div class="csize">${sizeLabel(c)}</div><div class="chips">${chips}</div>
    ${m != null ? `<div class="mbar" title="How far along: ${m}%"><i style="width:${m}%"></i></div>` : ''}${nextJob(c)}${coverChips(c)}</a>`;
}
function potTile(c) {
  const ps = activeIn(c.id), { W, L } = Draw.dims(c), ms = ps.map(maturity).filter(x => x != null), m = ms.length ? Math.max(...ms) : null;
  return `<a class="ptile" href="#/container/${c.id}"><span class="dots">${dotsHTML(bedDots(c))}</span><div class="thumb">${plotSVG(c, { px: Math.min(84 / L, 84 / W), minPx: 1.2 })}</div><b>${esc(c.name)}</b><small>${ps.map(p => esc(crop(p.cropId).en)).join(', ') || 'empty'}</small>${m != null ? `<div class="mbar"><i style="width:${m}%"></i></div>` : ''}${coverChips(c)}</a>`;
}
function bedsView() {
  const beds = S.containers.filter(c => c.type === 'bed'), pots = S.containers.filter(c => c.type !== 'bed');
  return `${beds.length ? `<h3 class="grp">Beds</h3><div class="grid">${beds.map(bedCard).join('')}</div>` : ''}
    ${pots.length ? `<h3 class="grp">Pots &amp; bags</h3>${pots.length > 4 ? `<div class="grid3">${pots.map(potTile).join('')}</div>` : `<div class="grid">${pots.map(bedCard).join('')}</div>`}` : ''}
    ${seedlingsHomeSection()}
    <div class="btnrow"><a class="btn small" href="#/container/new">${ui('plus', 18)} Add a bed or pot</a></div>`;
}
function todayView(td, today) {
  const days = Weather.days(), sel = wxSel && wxSel !== td && days.some(d => d.date === wxSel) ? wxSel : null;
  const marks = new Set(days.filter(d => dayAlerts(d.date).length).map(d => d.date));
  A.wxDay = el => { const d = el.dataset.d; wxSel = d === td || d === wxSel ? null : d; render(); };
  const open = S.tasks.filter(t => !t.done && taskVisible(t));
  const list = sel ? sortTasks(open.filter(t => effDue(t) === sel || (t.wxDate || t.frostDate) === sel)) : today;
  const soon = open.filter(t => { const n = daysBetween(td, effDue(t)); return n > 0 && n <= 7; }).length;
  return `${climateNotice()}${Weather.section(sel, marks)}
    ${headsCard(sel)}
    <section class="today"><h2>${sel ? `Jobs for ${dayName(sel) === 'Tmrw' ? 'tomorrow' : pd(sel).toLocaleDateString('en-GB', { weekday: 'long' })}` : 'Today’s jobs'}</h2>
      ${list.length ? `<ul class="tasks">${jobsList(list)}</ul>` : `<p class="muted">${sel ? 'Nothing planned for that day.' : 'Nothing to do today.'}</p>`}
      ${sel ? `<button type="button" class="more link" data-act="wxDay" data-d="${td}">Back to today</button>` : soon ? `<a class="more" href="#/cal">${soon} more in the next 7 days →</a>` : ''}</section>
    ${sowNowSection()}`;
}
export function pageHome() {
  const td = todayStr();
  const open = S.tasks.filter(t => !t.done && taskVisible(t));
  const today = sortTasks(open.filter(t => effDue(t) === td));
  const growing = S.plantings.filter(isLive).length;
  setChrome('My Garden', { tab: 'home', big: true, kicker: pd(td).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    stats: `<div><b>${today.length}</b><span>job${today.length === 1 ? '' : 's'} today</span></div><div><b>${growing}</b><span>growing</span></div>` });
  let backupNote = '';
  if (S.plantings.length) {
    const n = S.lastBackup ? daysBetween(S.lastBackup, td) : null;
    if (n === null || (n >= 7 && (S.lastEdit || '9') > S.lastBackup)) backupNote = `<a class="banner" href="#/settings">${ui('save', 18)} ${n === null ? 'No backup yet' : `Last backup ${n} days ago`} — tap to back up</a>`;
  }
  A.sowCrop = el => sowPick(el.dataset.id);
  if (driveOn() && S.drive.lastDate && daysBetween(S.drive.lastDate, td) < 7) backupNote = '';   // Drive has it covered
  const view = S.containers.length ? homeViewNow() : 'today';
  const html = `${S.containers.length ? `<div class="seg gview" role="tablist">${VIEWS.map(([v, i, l]) => `<button type="button" role="tab" aria-selected="${v === view}" data-act="hv" data-v="${v}" class="${v === view ? 'on' : ''}">${ui(i, 18)}${l}</button>`).join('')}</div>` : ''}
    ${driveBanner()}${backupNote}
    ${S.firstRun ? `<a class="banner" href="#/welcome?s=2">${ui('sprout', 18)} <b>Finish setting up</b> — where your garden is and which crops you grow ›</a>` : ''}
    ${!S.containers.length ? `<div class="empty-state"><p>No beds or pots yet.</p><a class="btn primary" href="#/container/new">＋ Add a bed or pot</a></div>` : ''}
    ${view === 'map' ? homeMap() : view === 'beds' ? bedsView() : todayView(td, today)}
    <button class="fab" data-act="quick" aria-label="Quick log">＋</button>`;
  A.quick = () => quickAdd();
  A.hv = async el => { S.homeView = el.dataset.v; await save(); render(); };
  return { html, after: () => Weather.refresh().then(ch => { if (ch && !route().parts.length) render(); }) };
}

// ---------- the heads-up card ----------
function headsItems(sel) {
  const out = [];
  try {   // spray waiting periods
    const by = {}; for (const p of S.plantings.filter(isLive)) { const h = sprayHolds(p)[0]; if (h) (by[h.until] = by[h.until] || []).push(crop(p.cropId).en); }
    for (const u of Object.keys(by).sort()) out.push({ k: 'spray', i: ui('stop'), t: `Don’t pick <b>${esc(by[u].join(', '))}</b> until ${shortDate(u)} (spray wait)`, h: '#/picksafe' });
  } catch (e) { console.warn(e); }
  if (sel) {   // one forecast day picked: that day's crop risks and spray window
    for (const a of dayAlerts(sel)) out.push({ k: a.k, i: ui(a.icon), t: a.t + (a.cids.length ? ` <small class="muted">· ${esc(a.cids.map(id => (container(id) || {}).name).filter(Boolean).join(', '))}</small>` : ''), h: null, tone: a.tone });
    try { const x = sprayDays().find(d => d.d === sel); if (x) out.push({ k: 'sprayday', i: ui('spray'), t: x.wins.length ? `Spray window ${dayName(sel)} ${x.wins.map(w => `${w[0]}:00–${w[1]}:00`).join(', ')}` : `No good spray window ${dayName(sel)}`, h: '#/sprayday', low: true }); } catch (e) { console.warn(e); }
    if (!out.length) out.push({ k: 'calm', i: ui('ok'), t: `Nothing in ${dayName(sel) === 'Tmrw' ? 'tomorrow' : dayName(sel)}’s forecast needs action`, h: null, low: true });
    return out.sort((a, b) => !!a.low - !!b.low);
  }
  if (S.weather && S.weather.lat != null) {
    const ico = { frost: 'frost', rain: 'rain', wind: 'wind', heat: 'heat' }, tone = { frost: 'cold', rain: 'cold', wind: 'cold', heat: 'hot' };
    for (const [k, t] of Weather.alerts()) out.push({ k, i: ui(ico[k] || 'warn'), t, h: null, tone: tone[k] });
    try { const ds = sprayDays(), best = ds.find(x => x.wins.length); if (ds.length) out.push({ k: 'sprayday', i: ui('spray'), t: best ? `Best spray window: ${dayName(best.d) === 'Today' ? 'today' : dayName(best.d)} ${best.wins.map(w => `${w[0]}:00–${w[1]}:00`).join(', ')}` : 'No good spray window in the next few days', h: '#/sprayday', low: true }); } catch (e) { console.warn(e); }
    try { for (const [p, k, t] of qualityWarnings()) out.push({ k, i: ui(k === 'bolt' ? 'bolt' : k === 'split' ? 'drop' : 'frost'), t: esc(t), h: '#/plant/' + p.id }); } catch (e) { console.warn(e); }
  }
  try { for (const n of coverNotes()) out.push({ k: 'cover', i: coverType(n.x.type)[1], t: esc(n.text), h: '#/container/' + n.c.id }); } catch (e) { console.warn(e); }
  return out.sort((a, b) => !!a.low - !!b.low);
}
function headsCard(sel) {
  const items = headsItems(sel); if (!items.length) return '';
  const li = x => `<li${x.tone ? ` class="t-${x.tone}"` : ''}>${x.h ? `<a href="${x.h}">` : '<div>'}<span class="hi">${x.i}</span><span class="grow">${x.t}</span>${x.h ? '<span class="muted">›</span></a>' : '</div>'}</li>`;
  const top = items.slice(0, 3), rest = items.slice(3);
  return `<section class="heads${sel ? ' picked' : ''}">${sel ? `<p class="headsday">${ui('calendar', 16)} ${pd(sel).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>` : ''}<ul>${top.map(li).join('')}</ul>${rest.length ? `<details><summary>${rest.length} more</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}</section>`;
}
