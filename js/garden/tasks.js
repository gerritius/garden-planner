// Jobs: the task list, repeating jobs, who does them, job templates, grouping, ticking off, and the job dialogs.

import { dayName, frostTaskDialog, wxAdvice, wxTaskDialog } from '../climate/weather.js';
import { A, render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal } from '../core/ui.js';
import { addDays, addInterval, daysBetween, esc, niceDate, num, shortDate, todayStr, uid, unitOpts } from '../core/util.js';
import { JOB_TEMPLATES } from '../data/catalog.js';
import { ui } from '../data/ui-icons.js';
import { amtFor } from '../feeding/nutrients.js';
import { completeWaterFeeds, feedTaskProduct, tickFeedTask } from '../feeding/plans.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { emergenceBar, germDialog, moveGermCheck, notUpYet, removeGermCheck } from '../plants/germination.js';
import { syncCareTasks } from '../plants/growth.js';
import { plantOutDialog, start, startDialog, startTaskMeta, startWhere } from '../plants/seedlings.js';
import { myProducts, productByName } from '../products/library.js';
import { activeIn, container, isLive, isPlanned, planting, sizeLabel } from './garden.js';
import { activatePlan, planTrayPreset, syncPlanTasks, undoActivate } from './planning.js';
import { jobWeather } from './insights.js';
import { moistureToday } from './soil.js';
import { bedLoss, bedPlan, groupOf, lastWatered, rainByDay, setLastWatered, skipWatering, syncWater, waterPlan, waterPots } from './watering.js';

// ---------- the task list ----------
export const effDue = t => (!t.done && t.due < todayStr()) ? todayStr() : t.due;
export const sortTasks = l => l.sort((a, b) => (effDue(a) < effDue(b) ? -1 : effDue(a) > effDue(b) ? 1 : 0));
export function seriesTitle(s) {
  if (s.customTitle) return s.customTitle;
  const amt = s.amount ? ' ' + amtFor(s.product, s.amount, s.unit) : '';
  if (s.title) return s.title + (s.product ? ` – ${s.product}` : '') + amt;
  return 'Fertilise' + (s.product ? `: ${s.product}` : '') + amt;
}
function dueText(t) {
  const d = effDue(t), n = daysBetween(todayStr(), d);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${niceDate(d)} · in ${n} days`;
}
// a job the forecast gets in the way of: the tag, and Skip (watering: until after the rain; feeds and sprays: to the next dry day)
function wxTag(t) {
  const w = jobWeather(t); if (!w) return '';
  A.wxSkip = async el => {
    const j = S.tasks.find(x => x.id === el.dataset.id), v = j && jobWeather(j); if (!v || !v.act) return;
    if (v.act === 'skipWater') { skipWatering(groupOf(j), v.to); syncWater(); }
    else { j.due = v.to; j.movedFor = 'rain'; }
    await save(); render();
  };
  return `<span class="wxtag ${w.tone}">${ui(w.icon, 14)}${esc(w.text)}</span>${w.act ? `<button type="button" class="wxskip" data-act="wxSkip" data-id="${t.id}" title="${w.act === 'skipWater' ? 'Skip watering until after the rain' : `Move to ${niceDate(w.to)} — ${w.why}`}">${ui('skip', 14)}Skip${w.act === 'moveJob' ? ` to ${dayName(w.to) === 'Tmrw' ? 'tmrw' : dayName(w.to)}` : ''}</button>` : ''}`;
}
export function taskLi(t, showCrop = true) {
  const { p, c } = taskOwner(t);
  const meta = [];
  A.germPlus = el => { const q = planting(el.dataset.p); if (q) germDialog(q, { task: el.dataset.t ? S.tasks.find(x => x.id === el.dataset.t) : null, pct: +el.dataset.pct }); };
  if (t.kind === 'water') meta.push(`${CAN_ICON(22)}<span>${esc(t.note || '')}</span>`);
  else if (t.startId) meta.push(startTaskMeta(t));
  else if (t.kind === 'wx') meta.push(`<span>${ui({ wind: 'wind', rain: 'rain', heat: 'heat' }[t.wx] || 'warn', 16)} ${esc(wxAdvice(t)[0] || '')}</span>`);
  else if (t.plan && p && showCrop) meta.push(`${ui('calendar', 16)} ${ic(p.cropId)}<b>${esc(crop(p.cropId).en)}</b>${c ? ' · ' + esc(c.name) : ''} <span class="planchip">planned</span>`);
  else if (t.kind === 'frost') meta.push(`<span>${ui('frost', 16)} ${esc((t.cids || []).map(id => (container(id) || {}).name).filter(Boolean).join(', '))}</span>`);
  else if (showCrop && p) meta.push(`${ic(p.cropId)}<b>${esc(crop(p.cropId).en)}</b>${c ? ' · ' + esc(c.name) : ''}`);
  else if (showCrop && c) meta.push(`${BED_ICON(20)}<b>${esc(c.name)}</b>`);
  if (!showCrop && !t.done) meta.push(dueText(t));
  if (t.done) meta.push('Done ' + shortDate(t.doneOn));
  return `<li class="task${t.done ? ' done' : ''}"><label class="chk"><input type="checkbox" data-task="${t.id}"${t.done ? ' checked' : ''}><span></span></label>
    <div class="tbody" data-act="editTask" data-id="${t.id}"><div class="tt">${esc(t.title)}${t.seriesId && !t.done ? ' <span class="rep">↻</span>' : ''}</div>
    ${meta.length ? `<div class="tm">${meta.join(' · ')}</div>` : ''}${t.done ? '' : (() => { const g = wxTag(t); return g ? `<div class="tw">${g}</div>` : ''; })()}
    ${t.kind === 'germ' && !t.done && p ? emergenceBar(p, t) : ''}</div>
    <button class="tmore" data-act="editTask" data-id="${t.id}" aria-label="Edit or delete">⋯</button></li>`;
}
export function upsertAuto(p, kind, want, due, title) {
  const open = S.tasks.find(t => t.plantingId === p.id && t.kind === kind && !t.done);
  const anyDone = S.tasks.some(t => t.plantingId === p.id && t.kind === kind && t.done);
  if (!want) { if (open) S.tasks = S.tasks.filter(x => x !== open); return; }
  if (open) { open.due = due; open.title = title; }
  else if (!anyDone) S.tasks.push({ id: uid(), plantingId: p.id, kind, title, due, done: false });
}
export function syncTasks(p) {
  if (p.status === 'harvested') { S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && !t.done)); return; }
  if (p.status === 'planned') { S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && !t.done && !t.plan)); syncPlanTasks(p); return; }
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && t.plan && !t.done));
  upsertAuto(p, 'thin', !p.no_thin && p.method === 'seed' && p.thinSp > 0 && !!p.thinDate && !p.thinned && !notUpYet(p), p.thinDate,   // nothing to thin until they're up
    `Thin${p.thinStage ? ' (' + p.thinStage + ')' : ''} to ${p.thinSp} cm`);
  upsertAuto(p, 'harvest', !p.no_harvest && !!p.harvestDate, p.harvestDate, 'Earliest harvest – check crop');
  syncCareTasks(p);
  const ids = new Set((p.series || []).map(s => s.id));
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && t.seriesId && !t.done && !ids.has(t.seriesId)));
  for (const s of p.series || []) {
    const open = S.tasks.find(t => t.seriesId === s.id && !t.done);
    const doneAny = S.tasks.some(t => t.seriesId === s.id && t.done);
    if (s.stopped) { if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
    if (open) { open.title = seriesTitle(s); if (!doneAny && s.start) open.due = s.start; }
    else if (!doneAny && s.start) S.tasks.push({ id: uid(), plantingId: p.id, kind: 'series', seriesId: s.id, title: seriesTitle(s), due: s.start, done: false });
  }
}
function redate(t, p, d) {
  if (t.kind === 'thin' && p) p.thinDoneOn = d;
  if (t.kind === 'germ' && p && t.look) { moveGermCheck(p, t.look, d); t.look = d; }
  if (t.kind === 'sgerm' && t.startId && start(t.startId)) { const s = start(t.startId); if (t.look) { moveGermCheck(s, t.look, d); t.look = d; } else s.upOn = d; }
  if (t.spawned && p) {
    const nt = S.tasks.find(x => x.id === t.spawned && !x.done), s = (p.series || []).find(x => x.id === t.seriesId);
    if (nt && s && +s.every > 0) nt.due = addInterval(d, +s.every, s.per);
  }
}
export function toggleTask(id, done) {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const td = todayStr(), due = t.due;
  // ticking something that was due before today: ask when it was really done (handy for back-filling records)
  if (done && t.kind === 'transplant' && t.startId && start(t.startId)) { render(); return plantOutDialog(start(t.startId)); }
  if (done && feedTaskProduct(t)) { render(); return tickFeedTask(t); }
  if (done && t.kind === 'plan_tray' && planting(t.plantingId)) { render(); return startDialog(null, planTrayPreset(planting(t.plantingId))); }
  if (done && t.kind === 'sgerm' && start(t.startId)) { render(); return germDialog(start(t.startId), { task: t }); }
  if (done && t.kind === 'germ' && planting(t.plantingId)) { render(); return germDialog(planting(t.plantingId), { task: t }); }   // how many are up, and when you looked
  if (done && due && due < td && t.kind !== 'water') return whenDone(t, due, td);
  finishToggle(t, done, td);
}
function whenDone(t, due, td) {
  let picked = false;
  const close = modal(`<h3>When did you do this?</h3><p class="muted small">${esc(t.title)}</p>
    <div class="btns col"><button class="btn primary" data-w="${due}">On the planned day · ${shortDate(due)}</button><button class="btn" data-w="${td}">Today · ${shortDate(td)}</button></div>
    <form id="wdf" class="form"><label>Another day<input name="d" type="date" value="${due}" max="${td}"></label><div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn">Use this date</button></div></form>`, (m, cl) => {
    const done = d => { picked = true; cl(); finishToggle(t, true, d && d <= td ? d : td); };
    m.querySelectorAll('[data-w]').forEach(b => b.onclick = () => done(b.dataset.w));
    m.querySelector('#wdf').onsubmit = e => { e.preventDefault(); done(m.querySelector('#wdf').d.value); };
    m.querySelector('[data-x=no]').onclick = () => { cl(); render(); };
    m.onclick = e => { if (e.target === m) { cl(); if (!picked) render(); } };
  });
  return close;
}
export function finishToggle(t, done, td) {
  const p = t.plantingId ? planting(t.plantingId) : null;
  if (done) {
    t.done = true; t.doneOn = td;
    if (t.kind === 'water') { const g = groupOf(t); t.prevLast = lastWatered(g); setLastWatered(g, td); if (t.feeds && t.feeds.length) completeWaterFeeds(t, td); }
    if (t.kind === 'germ' && p && !t.look) setTimeout(() => germDialog(p, { task: t }), 320);
    if (t.kind === 'thin' && p) { p.thinned = true; p.thinDoneOn = td; }
    if (t.kind === 'sgerm' && t.startId && start(t.startId)) start(t.startId).upOn = td;
    if (t.kind === 'plan_sow' && p && isPlanned(p)) activatePlan(p, td);
    if (t.seriesId && p) {
      const s = (p.series || []).find(x => x.id === t.seriesId);
      if (s && !s.stopped && +s.every > 0) {
        const nd = addInterval(td, +s.every, s.per);   // next one counts from the day it was actually done
        if (!s.end || nd <= s.end) {
          const nt = { id: uid(), plantingId: p.id, kind: 'series', seriesId: s.id, title: seriesTitle(s), due: nd, done: false };
          S.tasks.push(nt); t.spawned = nt.id;
        }
      }
    }
  } else {
    t.done = false; t.doneOn = null;
    if (t.kind === 'water') { const g = groupOf(t); S.tasks = S.tasks.filter(x => !(x.kind === 'water' && !x.done && x !== t && groupOf(x) === g)); setLastWatered(g, t.prevLast || null); }
    if (t.kind === 'germ' && p) { if (t.look) removeGermCheck(p, t.look); t.look = null; S.tasks = S.tasks.filter(x => !(x !== t && x.plantingId === p.id && x.kind === 'germ' && !x.done)); }
    if (t.kind === 'thin' && p) { p.thinned = false; p.thinDoneOn = null; }
    if (t.kind === 'sgerm' && t.startId && start(t.startId)) { const s = start(t.startId); if (t.look) removeGermCheck(s, t.look); else s.upOn = null; t.look = null; S.tasks = S.tasks.filter(x => !(x !== t && x.startId === s.id && x.kind === 'sgerm' && !x.done)); }
    if (t.kind === 'plan_sow' && p && isLive(p)) undoActivate(p);
    if (t.spawned) { S.tasks = S.tasks.filter(x => !(x.id === t.spawned && !x.done)); t.spawned = null; }
  }
  save();
  setTimeout(render, 280);
}

// ---------- task owners ----------
export function taskOwner(t) {
  const p = t.plantingId ? planting(t.plantingId) : null;
  const c = p ? container(p.containerId) : (t.containerId ? container(t.containerId) : null);
  return { p, c };
}
export const taskVisible = t => (t.withWater && !t.done && (!S.water || S.water.on !== false)) ? false : t.kind === 'water' || t.kind === 'frost' || t.kind === 'wx' || (t.startId ? !!start(t.startId) : false) || !!(t.plantingId ? planting(t.plantingId) : t.containerId && container(t.containerId));
export const BED_ICON = s => `<svg class="cicon" width="${s}" height="${s}" viewBox="0 0 32 32"><rect x="9" y="3" width="14" height="26" rx="1.5" fill="#8a6a4b" stroke="#3a2a1c" stroke-width="1.3"/><path d="M12 9h8M12 15h8M12 21h8" stroke="#7fb069" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const CAN_ICON = s => `<svg class="cicon" width="${s}" height="${s}" viewBox="0 0 32 32"><path d="M8 13h13v13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#7aa7c7" stroke="#3a2a1c" stroke-width="1.3"/><path d="M21 16l7-6" stroke="#3a2a1c" stroke-width="2.4" stroke-linecap="round"/><path d="M11 13a4 4 0 0 1 7 0" fill="none" stroke="#3a2a1c" stroke-width="1.3"/><path d="M28 13v.1M29.5 15.5v.1M27 16.5v.1" stroke="#3d7fb8" stroke-width="1.8" stroke-linecap="round"/></svg>`;

// ---------- job templates ----------
function templatePicker() {
  return `<details class="tpl"><summary>Pick a common job…</summary>${JOB_TEMPLATES.map(([g, l]) => `<div class="tplg"><small>${g}</small><div class="sowchips">${l.map(x => `<button type="button" class="chip big" data-tpl="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`).join('')}</details>`;
}
function wireTemplates(m, f) {
  m.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { f.title.value = b.dataset.tpl; m.querySelector('details.tpl').open = false; f.title.focus(); });
}

// ---------- grouping repetitive jobs ----------
const JOB_GROUPS = { germ: 'Check seedlings are up', sgerm: 'Check seedlings are up', harvest: 'Earliest harvest — check crops', pickby: 'Pick soon', thin: 'Thinning', plan_prep: 'Bed prep for planned crops' };
export function jobsList(tasks, max = 7) {
  const groups = {}, rows = [];
  for (const t of tasks) { const g = JOB_GROUPS[t.kind]; if (g) (groups[g] = groups[g] || []).push(t); }
  const done = new Set();
  for (const t of tasks) {
    if (done.has(t)) continue;
    const g = JOB_GROUPS[t.kind], list = g && groups[g];
    if (list && list.length >= 3) {
      list.forEach(x => done.add(x));
      const names = list.map(x => { const o = taskOwner(x); return o.p ? crop(o.p.cropId).en : x.startId && start(x.startId) ? crop(start(x.startId).cropId).en : ''; }).filter(Boolean);
      rows.push(`<li class="task tgrp"><details><summary><span class="gcount">${list.length}</span><span class="grow"><b>${g}</b><small>${esc([...new Set(names)].join(', '))}</small></span></summary><ul class="tasks">${list.map(x => taskLi(x)).join('')}</ul></details></li>`);
    } else { done.add(t); rows.push(taskLi(t)); }
  }
  return rows.length > max ? `${rows.slice(0, max).join('')}<li class="morejobs"><details><summary>Show ${rows.length - max} more</summary><ul class="tasks">${rows.slice(max).join('')}</ul></details></li>` : rows.join('');
}

// ---------- job dialogs ----------
export function bedTaskDialog(c, t) {
  const isNew = !t, td = todayStr(), log = t && t.logId ? (S.log || []).find(e => e.id === t.logId) : null;
  const fp = log ? { product: log.product, amount: log.amount, unit: log.unit } : t ? { product: t.product || '', amount: t.amount ?? '', unit: t.unit || 'handful' } : { product: '', amount: '', unit: 'handful' };
  const date0 = t ? (t.done ? t.doneOn : t.due) : td;
  modal(`<h3>${isNew ? 'Add bed job' : 'Edit job'}</h3><p class="muted small">${BED_ICON(20)} ${esc(c.name)}</p>
    <form id="btf" class="form">${isNew ? templatePicker() : ''}
      <label>Job<input name="title" value="${esc(t ? t.title : '')}" required placeholder="e.g. Side-dress"></label>
      <div class="two"><label>Date<input name="due" type="date" value="${date0}"></label><label class="inl chkline"><input type="checkbox" name="done"${t ? (t.done ? ' checked' : '') : ''}> <span>Already done</span></label></div>
      <details class="pktpick"${fp.product ? ' open' : ''}><summary>Fertiliser / compost used (counts towards feeding)</summary>
        <label>Product<input name="product" list="bfl" value="${esc(fp.product || '')}" placeholder="e.g. Bokashi"><datalist id="bfl">${myProducts(['fert', 'compost', 'lime', 'amend']).map(x => `<option value="${esc(x.en)}">`).join('')}</datalist></label>
        <div class="two"><label>Amount<input name="amount" type="number" inputmode="decimal" step="any" value="${fp.amount ?? ''}"></label><label>Unit<select name="unit">${unitOpts(fp.unit || 'handful')}</select></label></div></details>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div>
      ${!isNew ? `<a class="link" href="#/container/${c.id}" data-x="open">Open ${esc(c.name)} →</a>` : ''}</form>`, (m, close) => {
    const f = m.querySelector('#btf'); wireTemplates(m, f);
    const sync = () => { if (f.due.value && f.due.value < td && isNew) f.done.checked = true; }; f.due.addEventListener('change', sync);
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const op = m.querySelector('[data-x=open]'); if (op) op.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { S.tasks = S.tasks.filter(x => x !== t); if (t.logId) S.log = (S.log || []).filter(e => e.id !== t.logId); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const date = f.due.value || td, done = f.done.checked, product = f.product.value.trim(), amount = num(f.amount.value), unit = f.unit.value;
      if (isNew) { t = { id: uid(), containerId: c.id, plantingId: null, kind: 'bed', title: f.title.value.trim(), due: date, done: false }; S.tasks.push(t); }
      t.title = f.title.value.trim();
      if (done) { t.done = true; t.doneOn = date; if (!t.due) t.due = date; } else { t.done = false; t.doneOn = null; t.due = date; }
      t.product = product || null; t.amount = product ? amount : null; t.unit = product ? unit : null;
      // the fertiliser goes into the feeding record once the job is done
      let lg = t.logId && (S.log || []).find(x => x.id === t.logId);
      if (done && product && amount) {
        const pr = productByName(product);
        if (!lg) { lg = { id: uid(), kind: 'fert', cids: [c.id], pids: [], per: 'each' }; (S.log = S.log || []).push(lg); t.logId = lg.id; }
        Object.assign(lg, { date, product, productId: pr ? pr.id : null, amount, unit, text: t.title });
      } else if (lg && (!done || !product)) { S.log = S.log.filter(x => x !== lg); t.logId = null; }
      await save(); close(); render();
    };
  });
}
function waterTaskDialog(t) {
  const pots = waterPots(), w = pots.length ? waterPlan(pots) : null, perL = (S.water && +S.water.perBagL) || 4;
  const L = mm => (mm * w.pw.area).toFixed(1);
  const rows = w ? Object.keys(w.rain).filter(d => d >= addDays(todayStr(), -3) && d <= addDays(todayStr(), 6)).sort().map(d => `<tr${d === todayStr() ? ' class="on"' : ''}><td>${dayName(d)}</td><td>${Math.round(w.rain[d] || 0)} mm</td><td>${(w.rain[d] || 0) >= 1 ? '≈ ' + L(w.rain[d]) + ' L' : '—'}</td></tr>`).join('') : '';
  modal(`<h3>${CAN_ICON(24)} Water pots &amp; bags</h3><p class="msg">${esc(t.note || '')}</p>
    ${w ? `<p class="small">Next watering: <b>${niceDate(t.due)}</b>${w.noRain < t.due ? ` (would be ${niceDate(w.noRain)} without rain)` : ''}.</p>
    <p class="hint">A full watering is about <b>${perL} L per 40 L bag</b> — the same as ~${Math.round(w.pw.fullMM)} mm of rain. Rain tops the bags up in proportion (e.g. 10 mm ≈ ${L(10)} L into a ${esc(sizeLabel(w.pw.rep))} bag), each day uses about a ${w.iv === 1 ? 'full watering' : `1/${w.iv} of one`}, and if rain is due the next day the watering waits for it. Forecast rain only counts when the chance is 50% or more.</p>
    ${rows ? `<div class="tscroll"><table class="reg rain"><tr><th>Day</th><th>Rain</th><th>Per bag</th></tr>${rows}</table></div>` : ''}` : ''}
    ${!S.weather || S.weather.lat == null ? '<p class="hint">Set your garden’s location in Tools so rain can be counted.</p>' : ''}
    ${moistureToday().length ? `<p class="hint">${ui('flask', 16)} Meter today: ${esc(moistureToday().join(', '))}. Trust the meter (and your finger) over the schedule.</p>` : ''}
    ${S.containers.some(c => c.indoor && activeIn(c.id).length) ? `<p class="hint">${ui('home', 16)} Indoor pots aren’t included — rain doesn’t reach them, so water them as they need it.</p>` : ''}
    ${S.starts && S.starts.some(x => x.status === 'growing') ? `<p class="hint">${ui('sprout', 16)} Seedling trays and small pots aren’t included — they dry out fast, so check them daily.</p>` : ''}
    <form id="wpf" class="form"><label>Water per 40 L bag (L)<input name="perL" type="number" inputmode="decimal" step="0.5" min="0.5" value="${perL}"></label></form>
    <div class="btns"><button class="btn" data-x="skip">Skip today</button><button class="btn primary" data-x="ok">Close</button></div>`, (m, close) => {
    const f = m.querySelector('#wpf');
    const keep = async () => { const v = +f.perL.value; if (v > 0 && v !== perL) { S.water = Object.assign({}, S.water, { perBagL: v }); await save(); render(); } };
    m.querySelector('[data-x=ok]').onclick = async () => { await keep(); close(); };
    f.onsubmit = async e => { e.preventDefault(); await keep(); close(); };
    m.querySelector('[data-x=skip]').onclick = async () => { S.water = Object.assign({}, S.water, { skipTo: addDays(todayStr(), 1) }); syncWater(); await save(); close(); render(); };
  });
}
// watering a bed, the indoor pots or the seedlings: what the job is based on, and skip today
function otherWaterDialog(t) {
  const g = groupOf(t), c = g.startsWith('bed:') ? container(g.slice(4)) : null, w = c ? bedPlan(c) : null;
  const rows = w ? Object.entries(rainByDay()).filter(([d]) => d >= addDays(todayStr(), -3) && d <= addDays(todayStr(), 6)).sort().map(([d, mm]) => `<tr${d === todayStr() ? ' class="on"' : ''}><td>${dayName(d)}</td><td>${Math.round(mm || 0)} mm</td><td>${bedLoss(d).toFixed(1)} mm</td></tr>`).join('') : '';
  modal(`<h3>${CAN_ICON(24)} ${esc(t.title)}</h3><p class="msg">${esc(t.note || '')}</p>
    <p class="small">Next watering: <b>${niceDate(t.due)}</b>.</p>
    ${c ? `<p class="hint">Soil in the ground holds far more water than a pot — about ${25} mm the roots can use in 30 cm of ordinary soil. Each day it loses some through the plants and the surface (more when it’s warm), and rain puts it back. It’s time to water when about ${w.allow} mm is used${w.young ? ' (less, while the plants are young and their roots shallow)' : ''}: give about ${w.litres} L to this ${w.m2.toFixed(1)} m² bed, slowly so it soaks in.</p>
      ${rows ? `<div class="tscroll"><table class="reg rain"><tr><th>Day</th><th>Rain</th><th>Soil loses</th></tr>${rows}</table></div>` : ''}` : g === 'seedlings' ? '<p class="hint">Seedlings in trays and small pots dry out fast — check them every day in warm weather, and water when the top of the mix is dry.</p>' : '<p class="hint">Indoors no rain reaches them: water when the top 2 cm of the mix is dry.</p>'}
    ${!S.weather || S.weather.lat == null ? '<p class="hint">Set your garden’s location in Tools so rain can be counted.</p>' : ''}
    <div class="btns"><button class="btn" data-x="skip">Skip today</button><button class="btn primary" data-x="ok">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=ok]').onclick = close;
    m.querySelector('[data-x=skip]').onclick = async () => { skipWatering(g, addDays(todayStr(), 1)); syncWater(); await save(); close(); render(); };
  });
}
function startTaskDialog(t) {
  const s = start(t.startId); if (!s) return orphanTaskDialog(t);
  modal(`<h3>${esc(t.title)}</h3><p class="muted small">${ic(s.cropId)} ${esc(crop(s.cropId).en)} · ${esc(startWhere(s))} · sown ${shortDate(s.sowDate)}</p>
    ${t.done ? `<p class="small">Done ${shortDate(t.doneOn)}</p>` : `<label class="form">Date<input id="std" type="date" value="${t.due}"></label>`}
    <div class="btns"><button class="btn danger" data-x="del">Delete</button>${t.done ? '' : '<button class="btn" data-x="save">Save date</button>'}<a class="btn primary" href="#/seedlings" data-x="go">Seedlings →</a></div>`, (m, close) => {
    m.querySelector('[data-x=go]').onclick = () => close();
    const sv = m.querySelector('[data-x=save]'); if (sv) sv.onclick = async () => { t.due = m.querySelector('#std').value || t.due; await save(); close(); render(); };
    m.querySelector('[data-x=del]').onclick = async () => { S.tasks = S.tasks.filter(x => x !== t); s['no_' + t.kind] = true; await save(); close(); render(); };
  });
}
function orphanTaskDialog(t) {
  modal(`<h3>Task</h3><p class="msg">${esc(t.title)}</p><div class="btns"><button class="btn danger" data-x="del">Delete</button><button class="btn primary" data-x="ok">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=ok]').onclick = close;
    m.querySelector('[data-x=del]').onclick = async () => { S.tasks = S.tasks.filter(x => x !== t); await save(); close(); render(); };
  });
}
// Task add/edit dialog
export function taskDialog(t, p) {
  if (t && t.kind === 'water') return groupOf(t) === 'pots' ? waterTaskDialog(t) : otherWaterDialog(t);
  if (t && t.kind === 'frost') return frostTaskDialog(t);
  if (t && t.startId) return startTaskDialog(t);
  if (t && t.kind === 'wx') return wxTaskDialog(t);
  if (t && !t.plantingId && !t.containerId) return orphanTaskDialog(t);
  if (t && !t.plantingId && t.containerId) return container(t.containerId) && bedTaskDialog(container(t.containerId), t);
  const isNew = !t;
  p = p || planting(t.plantingId);
  const s = t && t.seriesId ? (p.series || []).find(x => x.id === t.seriesId) : null;
  const every = s ? +s.every : 0;
  modal(`<h3>${isNew ? 'Add task' : 'Edit task'}</h3>
    <p class="muted small">${ic(p.cropId)} ${esc(cropName(p.cropId))}${container(p.containerId) ? ' · ' + esc(container(p.containerId).name) : ''}</p>
    <form id="tf" class="form">${isNew ? templatePicker() : ''}
      <label>Task<input name="title" value="${esc(t ? t.title : '')}" placeholder="e.g. Add support netting" required></label>
      <label>${t && t.done ? 'Done on' : 'Date'}<input name="due" type="date" value="${esc(t ? (t.done ? t.doneOn : effDue(t)) : todayStr())}"></label>
      ${(isNew || s) && !(t && t.done) ? `<div class="rep-row"><select name="every">${[0, 1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => `<option value="${n}"${every === n ? ' selected' : ''}>${n === 0 ? 'Does not repeat' : 'Repeat every ' + n}</option>`).join('')}</select>
        <select name="per">${['day', 'week', 'month'].map(u => `<option value="${u}"${s && s.per === u ? ' selected' : ''}>${u}(s)</option>`).join('')}</select></div>
        <small class="hint">The next one is scheduled from the day you tick it off.</small>` : ''}
      <div class="btns">${isNew ? '' : `<button type="button" class="btn danger" data-x="del" data-own-confirm>Delete</button>`}${s && !t.done ? `<button type="button" class="btn" data-x="skip">Skip this one</button>` : ''}<button class="btn primary">Save</button></div>
      ${!isNew ? `<a class="link" href="#/plant/${p.id}" data-x="open">Open crop page →</a>` : ''}
    </form>`, (m, close) => {
    const f = m.querySelector('#tf'); wireTemplates(m, f);
    const op = m.querySelector('[data-x=open]'); if (op) op.onclick = () => close();
    f.onsubmit = async e => {
      e.preventDefault();
      const title = f.title.value.trim(), due = f.due.value || todayStr();
      const ev = f.every ? +f.every.value : 0, per = f.per ? f.per.value : 'week';
      if (isNew) {
        if (ev > 0) { const ns = { id: uid(), title, product: '', amount: null, unit: '', every: ev, per, start: due, end: '' }; (p.series = p.series || []).push(ns); syncTasks(p); }
        else S.tasks.push({ id: uid(), plantingId: p.id, kind: 'custom', title, due, done: false });
      } else {
        if (t.done) { t.doneOn = due; t.title = title; redate(t, p, due); }
        else { t.title = title; t.due = due; if (t.plan) t.manualDue = true; }
        if (s) {
          if (title !== seriesTitle(s)) s.customTitle = title;
          if (ev === 0) { s.every = 0; } else { s.every = ev; s.per = per; }
        }
      }
      await save(); close(); render();
    };
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      close();
      if (s && !t.done) {
        if (!await confirmBox('Delete this repeating job? No more reminders will be created for it.', 'Delete', true)) return;
        s.stopped = true; S.tasks = S.tasks.filter(x => x !== t);
      } else {
        if (!await confirmBox('Delete this task?', 'Delete', true)) return;
        if (t.kind === 'thin' && t.done) { p.thinned = false; }
        S.tasks = S.tasks.filter(x => x !== t);
        if (t.kind === 'thin' || t.kind === 'harvest') p['no_' + t.kind] = true;
        if (t.plan && t.key) p.planSkip = [...(p.planSkip || []), t.key];
      }
      await save(); render();
    };
    const skip = m.querySelector('[data-x=skip]');
    if (skip) skip.onclick = async () => { t.due = addInterval(todayStr(), +s.every, s.per); await save(); close(); render(); };
  });
}
