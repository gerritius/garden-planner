// The home page: the garden at a glance, today's jobs and one compact heads-up card.

import { driveBanner, driveOn } from '../backup/drive.js';
import { sowNowSection, sowPick } from '../climate/sowing.js';
import { climateNotice } from '../climate/climate.js';
import { dayName, sprayDays, Weather } from '../climate/weather.js';
import { ui } from '../data/ui-icons.js';
import { bedDots, dayAlerts, dotsHTML, isReady, maturity, moistureOf, MOIST, SUN, sunOf } from '../garden/insights.js';
import { A, render, route, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { $, daysBetween, esc, pd, shortDate, todayStr } from '../core/util.js';
import { Draw, plotSVG } from '../draw.js';
import { activeIn, container, isLive, sizeLabel } from '../garden/garden.js';
import { areasDialog, ensureAreas } from '../garden/areas.js';
import { effDue, jobsList, sortTasks, taskVisible } from '../garden/tasks.js';
import { coverChips, coverNotes, coverType } from '../plants/covers.js';
import { crop, ic } from '../plants/crops.js';
import { qualityWarnings } from '../plants/problems.js';
import { seedlingsHomeSection } from '../plants/seedlings.js';
import { sprayHolds } from '../products/sprays.js';
import { quickAdd } from './search.js';

// ---------- the home page: Today | Beds ----------
// the forecast day picked in the strip (null: everything); it isn't saved — a new visit starts on all of them
let wxSel = null;
const VIEWS = [['today', 'today', 'Today'], ['beds', 'grid', 'Beds']];
const homeViewNow = () => { const v = S.homeView === 'cards' || S.homeView === 'map' ? 'beds' : S.homeView; return VIEWS.some(x => x[0] === v) ? v : 'today'; };
// ---------- Beds: every bed and pot, sorted and filtered ----------
let bedQ = '';   // what's typed in the search box (not saved)
const SORTS = [['name', 'Name'], ['attention', 'Needs attention first'], ['dry', 'Driest first'], ['ready', 'Closest to harvest'], ['sown', 'Newest sowing']];
const FILTERS = [['all', 'All'], ['attention', 'Needs attention'], ['ready', 'Ready to pick'], ['dry', 'Dry'], ['empty', 'Empty']];
const DOT_KEY = { ready: 'Ready to pick', hot: 'Heat or dry', cold: 'Rain, frost or wind' };
// everything worth a look on a bed: its dots plus any overdue job
function overdueOf(c) {
  const ids = new Set(activeIn(c.id).map(p => p.id)), td = todayStr();
  return S.tasks.filter(t => !t.done && taskVisible(t) && t.kind !== 'water' && (ids.has(t.plantingId) || t.containerId === c.id) && effDue(t) < td);
}
function bedInfo(c) {
  const ps = activeIn(c.id), ms = ps.map(maturity).filter(x => x != null), dots = bedDots(c), over = overdueOf(c);
  const reasons = dots.concat(over.length ? [{ tone: 'late', t: over.length === 1 ? '1 job overdue' : `${over.length} jobs overdue` }] : []);
  return { c, ps, m: ms.length ? Math.max(...ms) : null, dots, reasons, moist: moistureOf(c), sown: ps.map(p => p.sowDate || '').sort().pop() || '',
    q: [c.name, ...ps.map(p => crop(p.cropId).en), ...ps.map(p => p.variety || '')].join(' ').toLowerCase() };
}
const why = x => x.reasons.length ? `<div class="why">${x.reasons.map(r => `<span class="t-${r.tone}"><i class="adot ${r.tone}"></i>${esc(r.t)}</span>`).join('')}</div>` : '';
function sunMoist(x) {
  const [sl, si] = SUN[sunOf(x.c)], lv = x.moist.level;
  return `<div class="sunm"><span>${ui(si, 16)}${sl}</span><span>${lv == null ? '<i class="mdrop none"></i>No estimate' : `<i class="mdrop m${lv}"></i>${MOIST[lv]}${x.moist.src === 'meter' ? ' (meter)' : ''}`}</span></div>`;
}
// a bed or pot card: drawing, crops with how far along they are, what needs attention and the next job
function nextJob(c) {
  const ids = new Set(activeIn(c.id).map(p => p.id));
  const t = sortTasks(S.tasks.filter(t => !t.done && taskVisible(t) && t.kind !== 'water' && (ids.has(t.plantingId) || t.containerId === c.id)))[0];
  if (!t) return '';
  const n = daysBetween(todayStr(), effDue(t));
  return `<div class="nextjob">${ui('check', 14)}<span>${esc(t.title)}</span><small>${n < 0 ? 'overdue' : n === 0 ? 'today' : n === 1 ? 'tmrw' : shortDate(effDue(t))}</small></div>`;
}
function bedCard(x, sun) {
  const { c, ps, m } = x, { W, L } = Draw.dims(c);
  const chips = ps.map(p => { const mm = maturity(p); return `<span class="chip">${ic(p.cropId)}${esc(crop(p.cropId).en)}${mm != null ? `<small class="pct">${isReady(p) ? 'ready' : mm + '%'}</small>` : ''}</span>`; }).join('') || '<span class="chip muted">empty</span>';
  return `<a class="card bedcard" href="#/container/${c.id}" data-q="${esc(x.q)}"><span class="dots">${dotsHTML(x.dots)}</span><div class="thumb">${plotSVG(c, { px: Math.min(150 / L, 150 / W), minPx: 1.2 })}</div>
    <div class="cname">${esc(c.name)}</div><div class="csize">${sizeLabel(c)}</div>${sun ? sunMoist(x) : ''}<div class="chips">${chips}</div>
    ${m != null ? `<div class="mbar" title="How far along: ${m}%"><i style="width:${m}%"></i></div>` : ''}${why(x)}${nextJob(c)}${coverChips(c)}</a>`;
}
function potTile(x, sun) {
  const { c, ps, m } = x, { W, L } = Draw.dims(c);
  return `<a class="ptile" href="#/container/${c.id}" data-q="${esc(x.q)}"><span class="dots">${dotsHTML(x.dots)}</span><div class="thumb">${plotSVG(c, { px: Math.min(84 / L, 84 / W), minPx: 1.2 })}</div><b>${esc(c.name)}</b><small>${ps.map(p => esc(crop(p.cropId).en)).join(', ') || 'empty'}</small>${m != null ? `<div class="mbar"><i style="width:${m}%"></i></div>` : ''}${sun ? sunMoist(x) : ''}${coverChips(c)}</a>`;
}
const byName = (a, b) => a.c.name.localeCompare(b.c.name, undefined, { numeric: true });
const SORT_FN = {
  name: byName,
  attention: (a, b) => b.reasons.length - a.reasons.length || byName(a, b),
  dry: (a, b) => (a.moist.level ?? 9) - (b.moist.level ?? 9) || byName(a, b),
  ready: (a, b) => (b.m ?? -1) - (a.m ?? -1) || byName(a, b),
  sown: (a, b) => (b.sown).localeCompare(a.sown) || byName(a, b),
};
const FILTER_FN = { all: () => true, attention: x => x.reasons.length > 0, ready: x => x.ps.some(isReady), dry: x => x.moist.level != null && x.moist.level <= 1, empty: x => !x.ps.length };
function bedsView() {
  ensureAreas();
  const sort = SORT_FN[S.bedSort] ? S.bedSort : 'name', filt = FILTER_FN[S.bedFilter] ? S.bedFilter : 'all', sun = S.bedsShow === 'sun';
  const area = S.areas.length > 1 && S.areas.some(a => a.id === S.bedArea) ? S.bedArea : null;
  A.bedFilt = async el => { S.bedFilter = el.dataset.v; await save(); render(); };
  A.bedArea = async el => { S.bedArea = el.dataset.id || null; await save(); render(); };
  A.bedsShow = async el => { S.bedsShow = el.dataset.v; await save(); render(); };
  A.areas = () => areasDialog();
  const all = S.containers.filter(c => !area || c.area === area).map(bedInfo), counts = Object.fromEntries(FILTERS.map(([k]) => [k, all.filter(FILTER_FN[k]).length]));
  const list = all.filter(FILTER_FN[filt]).sort(SORT_FN[sort]);
  const beds = list.filter(x => x.c.type === 'bed'), pots = list.filter(x => x.c.type !== 'bed');
  setTimeout(() => { const so = $('#bedsort'); if (so) so.onchange = async () => { S.bedSort = so.value; await save(); render(); };
    const i = $('#bedq'); if (i) { i.addEventListener('input', () => { bedQ = i.value; findBeds(); }); findBeds(); } });
  return `<div class="bedtools">
      <label class="bedsearch">${ui('search', 18)}<input id="bedq" type="search" placeholder="Find a bed or crop" value="${esc(bedQ)}" aria-label="Find a bed or crop"></label>
      <select id="bedsort" aria-label="Sort beds">${SORTS.map(([v, l]) => `<option value="${v}"${v === sort ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="bedfilt">${FILTERS.map(([v, l]) => `<button type="button" data-act="bedFilt" data-v="${v}" class="fchip${v === filt ? ' on' : ''}" aria-pressed="${v === filt}">${l}${v !== 'all' ? ` <small>${counts[v]}</small>` : ''}</button>`).join('')}</div>
    <div class="mapsub">${S.areas.length > 1 ? `<div class="seg small wrap">${[[null, 'All areas']].concat(S.areas.map(a => [a.id, a.name])).map(([id, n]) => `<button type="button" data-act="bedArea"${id ? ` data-id="${id}"` : ''} class="${id === area ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>` : '<span></span>'}
      <div class="pilltog" role="group" aria-label="What the cards show">${[['crops', 'Crops'], ['sun', 'Sun &amp; Moisture']].map(([v, l]) => `<button type="button" data-act="bedsShow" data-v="${v}" class="${(v === 'sun') === sun ? 'on' : ''}" aria-pressed="${(v === 'sun') === sun}">${l}</button>`).join('')}</div></div>
    <p class="mapkey dotkey">${Object.entries(DOT_KEY).map(([t, l]) => `<span><i class="adot ${t}"></i>${l}</span>`).join('')}</p>
    ${sun ? `<p class="mapkey">${MOIST.map((l, i) => `<span><i class="mdrop m${i}"></i>${l}</span>`).join('')}</p><p class="hint">Sun is each bed’s own setting. Moisture is estimated from the rain and your watering, unless the meter was read today.</p>` : ''}
    ${!list.length ? `<p class="muted nobeds">No beds or pots match. <button type="button" class="link" data-act="bedFilt" data-v="all">Show all</button></p>` : ''}
    <div class="bgrp" data-g="beds"${beds.length ? '' : ' hidden'}><h3 class="grp">Beds</h3><div class="grid">${beds.map(x => bedCard(x, sun)).join('')}</div></div>
    <div class="bgrp" data-g="pots"${pots.length ? '' : ' hidden'}><h3 class="grp">Pots &amp; bags</h3>${pots.length > 4 ? `<div class="grid3">${pots.map(x => potTile(x, sun)).join('')}</div>` : `<div class="grid">${pots.map(x => bedCard(x, sun)).join('')}</div>`}</div>
    <p class="muted nobeds" id="noq" hidden>Nothing called that. <button type="button" class="link" id="clrq">Clear the search</button></p>
    ${filt === 'all' && !area ? seedlingsHomeSection() : ''}
    <div class="btnrow"><a class="btn small" href="#/container/new">${ui('plus', 18)} Add a bed or pot</a><button type="button" class="btn small" data-act="areas">${ui('map', 18)} Areas</button></div>`;
}
// the search box hides cards as you type, without redrawing the page (so the keyboard stays up)
function findBeds() {
  const q = bedQ.trim().toLowerCase(); let shown = 0;
  document.querySelectorAll('.bgrp').forEach(g => {
    let n = 0; g.querySelectorAll('[data-q]').forEach(a => { const ok = !q || a.dataset.q.includes(q); a.hidden = !ok; n += ok; });
    g.hidden = !n; shown += n;
  });
  const nq = $('#noq'); if (nq) { nq.hidden = !(q && !shown); const b = $('#clrq'); if (b) b.onclick = () => { bedQ = ''; $('#bedq').value = ''; findBeds(); }; }
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
    ${view === 'beds' ? bedsView() : todayView(td, today)}
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
