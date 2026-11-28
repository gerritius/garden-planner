// A planting's page, removing a planting, arranging its plants, and the same planting in other pots.

import { dropPhoto } from '../core/photos.js';
import { A, draft, notFound, render, setChrome, setDraft } from '../core/router.js';
import { S, save } from '../core/state.js';
import { centreZoom, confirmBox, dragZone, modal, plotMaxH, plotSizeBtn, plotZoom, zoomBar } from '../core/ui.js';
import { $, $$, addDays, daysBetween, esc, go, niceDate, shortDate, todayStr, uid } from '../core/util.js';
import { Draw, plotSVG } from '../draw.js';
import { feedingSection } from '../feeding/ledger.js';
import { amtFor } from '../feeding/nutrients.js';
import { activeIn, container, decorate, isLive, isPlanned, occupants, planRotation, planting } from '../garden/garden.js';
import { planBanner, planNextButton } from '../garden/planning.js';
import { rotationNote } from '../garden/rotation.js';
import { readingDialog, readingText, soilAdvice, soilReadingAdvice } from '../garden/soil.js';
import { soilChips } from '../garden/insights.js';
import { ui } from '../data/ui-icons.js';
import { BED_ICON, seriesTitle, sortTasks, syncTasks, taskDialog, taskLi } from '../garden/tasks.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { emergenceBar, germChecks, germDialog, germText, pctText } from '../plants/germination.js';
import { germWindow, harvestNote, lastLeaves, leafDialog, lifecycleBar, thinNote } from '../plants/growth.js';
import { qualityWarnings } from '../plants/problems.js';
import { hasReal, mapViewBtn, nearestPlant, plantCountText } from '../plants/onmap.js';
import { drawFill, fillTarget, mergeAsFill, start, startLeft, startWhere, syncStartTasks } from '../plants/seedlings.js';
import { sprayBanner, spraySection, spraysFor } from '../products/sprays.js';
import { pastCropDialog } from '../records/history.js';
import { endPlanting, harvestDialog, harvestSection, logFeed, logSection } from '../records/log.js';
import { diaryAfter, diarySection } from '../records/notes.js';
import { LAYOUTS } from './planting-form.js';

// ---------- the planting page ----------
export function pagePlant(p) {
  if (!p) return { html: notFound() };
  const c = container(p.containerId), cr = crop(p.cropId), td = todayStr();
  setChrome(c ? c.name : 'Crop', { back: true, kicker: p.status === 'harvested' ? 'Grown in' : isPlanned(p) ? 'Planned for' : 'Growing in' });
  const open = sortTasks(S.tasks.filter(t => t.plantingId === p.id && !t.done));
  const done = S.tasks.filter(t => t.plantingId === p.id && t.done).sort((a, b) => (a.doneOn < b.doneOn ? 1 : -1));
  const sowN = p.sowDate ? daysBetween(p.sowDate, td) : null;
  const hvN = p.harvestDate ? daysBetween(td, p.harvestDate) : null;
  const harvested = p.status === 'harvested';
  const seed = p.method === 'seed';
  const L = c ? Draw.dims(c).L : 0;
  const rowish = ['rows', 'continuous', 'staggered'].includes(p.layout);
  const rowsUsed = c && rowish ? Draw.rowCount(c, p) : null;
  const plantsNow = c ? Draw.count(c, p) : 0;
  // a drill is sown thickly: what counts is how many plants it'll be once thinned
  const thinnedTo = c && p.layout === 'continuous' && seed && !p.thinned && +p.thinSp > 0 ? Draw.count(c, Object.assign({}, p, { thinned: true })) : 0;
  const dl = [
    ['Planting', seed ? 'From seed' : 'Seedlings / tubers'],
    p.startId || p.seededOn ? ['Raised from seed', `in ${p.raisedName ? (p.raisedIn === 'pot' ? '' : 'a ') + esc(p.raisedName) : p.raisedIn === 'pot' ? 'small pots' : 'a cell tray'}, sown ${shortDate(p.seededOn)}${p.sowDate ? ` (${daysBetween(p.seededOn, p.sowDate)} days before planting out)` : ''}`] : null,
    c && (p.from > 0 || p.to < L) ? ['Section', `${p.from}–${p.to} cm from top`] : null,
    ['Layout', (LAYOUTS.find(l => l[0] === p.layout) || [, p.layout])[1] + (rowish && p.dir === 'along' ? ' (lengthways)' : '') + (rowsUsed ? ` · ${rowsUsed} row${rowsUsed > 1 ? 's' : ''}` : '') + (plantsNow && (p.layout !== 'continuous' || p.thinned) ? ` · ${plantCountText(c, p)}` : '') + (thinnedTo ? ` · about ${thinnedTo.toLocaleString('en-AU')} plants once thinned to ${p.thinSp} cm` : '')],
    (p.fills || []).length ? ['Gaps filled', p.fills.map((f, i) => `${f.n} seedling${f.n === 1 ? '' : 's'} ${shortDate(f.date)}${start(f.startId) ? ` <small class="muted">(from ${esc(startWhere(start(f.startId)))})</small>` : ''}${!f.drawn && !harvested ? ` <button class="link" data-act="drawFill" data-i="${i}">show ${f.n === 1 ? 'it' : 'them'} in the drawing</button>` : ''}`).join('<br>')
      + (p.fills.some(f => f.drawn) && !harvested ? `<br><small class="muted">Move them to where they are — and take out any that didn’t make it — with <a href="#/plant/${p.id}/arrange">Arrange plants by hand</a>.</small>` : '')] : null,
    seed && p.depth != null ? ['Sowing depth', p.depth + ' cm'] : null,
    p.plantSp != null ? [seed ? 'Sowing distance' : 'Plant spacing', p.plantSp + ' cm'] : null,
    rowish && p.rowSp != null ? ['Between rows', p.rowSp + ' cm'] : null,
    (() => {
      const gw = germWindow(p); if (!gw) return null;
      const cs = germChecks(p), more = p.status === 'active' && !(p.germ && p.germ.over);
      return ['Germination', `expected ${shortDate(gw[0])}–${shortDate(gw[1])}${p.germ ? ` · <b>${esc(germText(p))}</b>` : ''}${cs.length ? `<br><small class="muted">${cs.map(c => `${shortDate(c.date)} ${esc(pctText(c))}`).join(' · ')}</small>` : ''}${more || cs.length ? ` <button class="link" data-act="germLook">${cs.length ? 'add a look' : 'record how many are up'}</button>` : ''}`];
    })(),
    seed && p.thinSp ? ['Thinning', `${p.thinStage ? p.thinStage + ' → ' : ''}${p.thinSp} cm${p.thinned ? ` ✓ done ${shortDate(p.thinDoneOn)}` : ` · around ${shortDate(p.thinDate)} <small class="muted">(${thinNote(p)})</small> <button class="link" data-act="leaves">🌿 ${lastLeaves(p) ? `${lastLeaves(p).n} true leaves on ${shortDate(lastLeaves(p).date)} — update` : 'Count true leaves'}</button>`}`] : null,
    p.harvestDate && !harvested ? ['Harvest estimate', `from ${shortDate(p.harvestDate)} <small class="muted">(${harvestNote(p)})</small>`] : null,
    p.spread ? ['Mature size', `~${p.spread} cm across`] : null,
    c && !harvested ? (() => { const sa = soilAdvice(c, p.from, p.to, p.cropId, p.sowDate || '9', p.id); return sa ? ['Soil', sa.text] : null; })() : null,
    c && !harvested && !isPlanned(p) ? ['Size in drawing', (() => { const now = Math.round(Draw.radius(p, td) * 2), full = Math.round(Math.max(1, +p.spread || Draw.spacingNow(p))); return `${now} cm across today (grows to ~${full} cm by ${p.harvestDate ? shortDate(p.harvestDate) : 'harvest'})${seed && +p.thinSp > 0 && !p.thinned ? ' · stays seedling-sized until thinning' : ''}`; })()] : null,
    c && !harvested ? (() => { const a = soilReadingAdvice(c, p.from, p.to, p.cropId); return a ? ['Soil test', `${esc(readingText(a.r))} <small class="muted">(${shortDate(a.r.date)})</small><br>${a.bits.map(esc).join(' ')}`] : null; })() : null,
    (p.fert || []).length ? ['Starting fertiliser', p.fert.map(f => `${esc(f.product || 'fertiliser')}${f.amount != null ? ' ' + amtFor(f.product, f.amount, f.unit) : ''}`).join('<br>')] : null,
    (p.series || []).length ? ['Extra fertiliser / jobs', p.series.map(s => `${esc(seriesTitle(s))} · ${+s.every > 0 ? `every ${s.every} ${s.per}${s.every > 1 ? 's' : ''}${s.stopped ? ' (stopped)' : ''}` : 'once'}`).join('<br>')] : null,
    c ? ['Previous crop here', (() => { const rn = isPlanned(p) ? planRotation(c, p.from, p.to, p.cropId, p.sowDate, p.id) : rotationNote(c, p.from, p.to, p.cropId, p.sowDate || '9', p.id); return rn ? esc(cropName(rn.prev.cropId)) + (rn.same ? ` <span class="warnchip">⚠ same family</span>` : '') : '— <button class="link" data-act="addPrev">add what grew here before</button>'; })()] : null,
  ].filter(Boolean);

  A.addTask = () => taskDialog(null, p);
  A.addReading = () => c && readingDialog(c);
  A.germPlus = el => germDialog(p, { task: germOpen, pct: +el.dataset.pct });
  const germOpen = !harvested && !isPlanned(p) && p.method === 'seed' ? S.tasks.find(t => t.plantingId === p.id && t.kind === 'germ' && !t.done) || null : null;
  A.drawFill = async el => { const f = p.fills[+el.dataset.i], s = start(f.startId); drawFill(p, f, s ? s.sowDate : f.date); await save(); render(); };
  A.mergeFill = async el => {
    const into = planting(el.dataset.id); if (!into) return;
    if (!await confirmBox(`Add these ${esc(cr.en.toLowerCase())} seedlings to the ${esc(cr.en.toLowerCase())} sown ${shortDate(into.sowDate)}, as filling its gaps? This separate planting goes.`, 'Add them')) return;
    mergeAsFill(p, into); syncTasks(into); await save(); location.replace('#/plant/' + into.id);
  };
  A.germLook = () => germDialog(p);
  A.addPrev = () => pastCropDialog(c, null, { from: p.from, to: p.to });
  A.leaves = () => leafDialog(p, cropName(p.cropId), () => { p.thinFixed = false; });
  A.logHarvest = () => harvestDialog(p);
  A.editHarvest = el => harvestDialog(p, (p.harvests || []).find(h => h.id === el.dataset.id));
  A.copyTo = () => copyPlantingDialog(p);
  A.harvest = async () => {
    if (!await confirmBox(`Mark <b>${esc(cr.en)}</b> as harvested and clear it from ${esc(c ? c.name : 'the bed')}?<br><small>It stays in the history.</small>`, 'Harvest finished')) return;
    endPlanting(p, td); await save(); go('#/container/' + c.id);
  };
  A.unharvest = async () => { p.status = 'active'; if (c) c.history = (c.history || []).filter(h => h.plantingId !== p.id); syncTasks(p); await save(); render(); };
  A.del = async () => {
    if (!await confirmBox(`Delete this ${esc(cr.en)} planting completely, including tasks and photos?`, 'Delete', true)) return;
    await removePlanting(p); await save(); location.replace('#/container/' + (c ? c.id : ''));
  };

  const html = `<div class="crophead" style="--c:${cr.color}">
      <div class="chtitle">${ic(p.cropId, 52)}<h2>${esc(cr.en)}</h2></div>
      <div class="datebar">
        <div><small>${isPlanned(p) ? (seed ? 'Sow on' : 'Plant on') : seed ? 'Sown' : 'Planted'}</small><b>${shortDate(p.sowDate)}</b><small>${sowN == null ? '' : sowN === 0 ? 'today' : sowN > 0 ? sowN + ' days ago' : 'in ' + -sowN + ' days'}</small></div>
        <div><small>${harvested ? 'Harvested' : 'Harvest from'}</small><b>${harvested ? shortDate(p.harvestedOn) : shortDate(p.harvestDate)}</b><small>${harvested ? '' : hvN == null ? '' : hvN > 0 ? 'in ' + hvN + ' days' : `${ui('basket', 16)} ready now`}</small></div>
      </div></div>
    ${c && !isPlanned(p) ? soilChips(c, p) : ''}
    ${harvested ? '' : lifecycleBar(p)}
    <div class="varrow"><div class="grow"><small>Variety</small><a class="variety" href="#/variety?c=${encodeURIComponent(p.cropId)}&v=${encodeURIComponent(p.variety || '')}">${esc(p.variety || '—')} <small>notes ›</small></a></div>
      <a class="packet ph" href="#/plant/${p.id}/photos">${p.photos && (p.photos.front || p.photos.back) ? `<img data-photo="${p.photos.front || p.photos.back}" alt="Seed packet">` : '<span>No packet photo<br><small>tap to view / add</small></span>'}</a></div>
    ${planBanner(p)}
    ${(() => { const t = isLive(p) && fillTarget(p); return t ? `<div class="banner">${ui('bandage', 18)} ${esc(cr.en)} sown ${shortDate(t.sowDate)} is already growing here. Were these seedlings to fill its gaps? <button class="link" data-act="mergeFill" data-id="${t.id}">Yes — add them to it</button></div>` : ''; })()}
    ${isLive(p) ? qualityWarnings(p).map(([, , t]) => `<div class="banner warn">${esc(t)}</div>`).join('') : ''}
    ${harvested || isPlanned(p) ? '' : sprayBanner(p)}
    ${harvested ? `<div class="banner">This crop was harvested on ${niceDate(p.harvestedOn)}. <button class="link" data-act="unharvest">Undo</button></div>` : ''}
    <section><h3>To do</h3>
      ${open.length ? `<ul class="tasks">${open.map(t => taskLi(t, false)).join('')}</ul>` : '<p class="muted">Nothing to do.</p>'}
      ${harvested ? '' : `<div class="actbar"><button class="btn small" data-act="addTask">＋ Task</button>${isLive(p) ? `<button class="btn small" data-act="logHarvest">${ui('basket', 18)} Harvest</button><a class="btn small" href="#/doctor?p=${p.id}">${ui('doctor', 18)} Problem?</a>${seed && p.thinSp && !p.thinned ? `<button class="btn small" data-act="leaves">${ui('feed', 18)} Leaves</button>` : ''}` : ''}</div>`}</section>
    ${done.length ? `<details class="donelog"><summary>Done log (${done.length})</summary><ul class="tasks">${done.map(t => taskLi(t, false)).join('')}</ul></details>` : ''}
    ${isPlanned(p) || !((p.harvests || []).length || harvested || (p.harvestDate && p.harvestDate <= addDays(td, 7))) ? '' : harvestSection(p)}
    ${diarySection(p)}
    ${harvested || isPlanned(p) ? '' : (() => { const sp = spraySection(p); if (!sp) return ''; const n = spraysFor(p).length; return `<details class="fold"><summary>${ui('spray')} Your sprays <small>${n ? `${n} for ${esc(crop(p.cropId).en)}` : 'none entered for this crop'}</small></summary>${sp}</details>`; })()}
    ${harvested || isPlanned(p) ? '' : `<details class="fold"><summary>${ui('note')} Running log <small>${logFeed().filter(x => (x.pids || []).includes(p.id)).length} entries</small></summary>${logSection(null, p)}</details>`}
    ${c ? (() => { const shown = harvested ? [p] : isPlanned(p) ? [p, ...occupants(c.id, 0, 1e9, p.sowDate, p.sowDate, p.id)] : activeIn(c.id);
      return `<section><h3>In ${esc(c.name)}${plotSizeBtn()}${mapViewBtn(shown)}</h3><a class="plotwrap small" href="#/container/${c.id}">${plotSVG(c, { width: Math.min(window.innerWidth, 640) - 32, maxH: plotMaxH(320), highlight: p.id, labels: true, grid: true, plantings: decorate(shown), today: isPlanned(p) ? p.sowDate : undefined })}</a>
      ${harvested || isPlanned(p) || (p.layout === 'continuous' && !p.thinned) || (p.layout !== 'free' && plantsNow > Draw.MAX_ARRANGE) ? '' : `<a class="btn small" href="#/plant/${p.id}/arrange">${ui('move', 18)} Arrange plants by hand</a>`}</section>`; })() : ''}
    ${(() => { const KEY = ['Germination', 'Thinning', 'Harvest estimate', 'Soil test', 'Fed so far', 'Soil'], key = dl.filter(r => KEY.includes(r[0])), rest = dl.filter(r => !KEY.includes(r[0]));
      const t = rows => `<dl class="details">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
      return `${!harvested && !isPlanned(p) ? feedingSection(p) : ''}<section class="going"><h3>How it’s going</h3>${germOpen ? emergenceBar(p, germOpen) : ''}${key.length ? t(key) : '<p class="muted">Nothing to report yet.</p>'}</section><details class="fold"><summary>${ui('sprout')} Planting details</summary><section>${t(rest)}`; })()}
      ${p.notes ? `<p class="pre">${esc(p.notes)}</p>` : ''}</section></details>
    ${S.plantings.filter(x => x.cropId === p.cropId).length > 1 ? `<a class="btn small" href="#/compare?crop=${p.cropId}">${ui('chart', 18)} Compare with other years</a>` : ''}
    <div class="btnrow"><a class="btn" href="#/plant/${p.id}/edit">Edit</a>${harvested || isPlanned(p) ? '' : `<button class="btn primary" data-act="harvest">${ui('basket', 18)} Harvest finished</button>`}${planNextButton(p)}</div>
    ${harvested ? '' : `<button class="btn small wide" data-act="copyTo">⧉ Same in other ${c && c.type === 'bed' ? 'beds' : 'pots'}…</button>`}
    <div class="btnrow"><button class="link danger" data-act="del">Delete planting</button></div>`;
  return { html, after: () => diaryAfter(p) };
}
export async function removePlanting(p) {
  S.tasks = S.tasks.filter(t => t.plantingId !== p.id);
  S.plantings = S.plantings.filter(x => x !== p);
  // seedlings planted out from a tray (or filled into gaps) go back there: deleting a planting undoes planting them out
  for (const st of S.starts || []) { const before = (st.events || []).length; st.events = (st.events || []).filter(e => e.pid !== p.id);
    if (st.events.length !== before) { if (startLeft(st) > 0) st.status = 'growing'; syncStartTasks(st); } }
  { const mc = container(p.containerId); if (mc && mc.mixLog) mc.mixLog = mc.mixLog.filter(e => e.pid !== p.id); }
  for (const id of [...Object.values(p.photos || {}), ...(p.diary || []).map(d => d.photo)]) if (id) await dropPhoto(id);
  const c = container(p.containerId);
  if (c) c.history = (c.history || []).filter(h => h.plantingId !== p.id);
}

// ---------- arranging the plants ----------
export function pageArrange(p) {
  if (!p) return { html: notFound() };
  const c = container(p.containerId);
  setChrome('Arrange plants', { back: true, kicker: crop(p.cropId).en + (c ? ' · ' + c.name : '') });
  if (!c) return { html: notFound() };
  if (p.layout === 'continuous' && !p.thinned) return { html: `<div class="empty-state">Sown in a continuous line: the line shows where you sowed, so there are no single plants to place yet.<br>Once they’re thinned, you can arrange the plants by hand.<br><a class="btn" href="#/plant/${p.id}">Back</a></div>` };
  const n = Draw.count(c, p, true), real = hasReal(p);
  if (n > Draw.MAX_ARRANGE) return { html: `<div class="empty-state">This planting has about ${n.toLocaleString('en-AU')} plants — too many to place one by one.<br>Its layout (rows, spacing) sets where they go.<br><a class="btn" href="#/plant/${p.id}">Back</a></div>` };
  // (the plants really there, once some have come out — else the planting's layout, which this then changes)
  if (!draft) setDraft({ pts: Draw.layout(c, p, true).pts.map(q => q.slice()), mode: 'move' });
  const d = draft;
  const vw = Math.min(window.innerWidth, 640) - 32;
  const { W, L } = Draw.dims(c);
  const px0 = Math.min(vw / W, (window.innerHeight * 0.6) / L);
  let px = px0 * plotZoom();
  const draw = () => {
    px = px0 * plotZoom();
    const tmp = decorate([Object.assign({}, p, { layout: 'free', positions: d.pts, real: null })])[0];
    const others = decorate(activeIn(c.id).filter(x => x.id !== p.id));
    $('#arr').innerHTML = Draw.svg(c, [...others, tmp], { px, today: todayStr(), highlight: p.id, edit: p.id, showMargin: true, grid: true });
    $('#cnt').textContent = `${d.pts.length} plant${d.pts.length === 1 ? '' : 's'}${real ? ` · ${Draw.count(c, p)} in the plan` : ''}`;
  };
  A.mode = el => { d.mode = el.dataset.v; $$('[data-act=mode]').forEach(b => b.classList.toggle('on', b.dataset.v === d.mode)); };
  A.reset = () => { d.pts = (real ? Draw.layout(c, p) : Draw.layout(c, Object.assign({}, p, { layout: p.layout === 'free' ? 'rows' : p.layout }))).pts.map(q => q.slice()); draw(); };
  A.clear = () => { d.pts = []; draw(); };
  A.save = async () => {
    const pts = d.pts.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10].concat(q[2] ? [q[2]] : []));
    if (real) p.real = pts; else { p.layout = 'free'; p.positions = pts; }
    await save(); setDraft(null); history.back();
  };
  const html = `<p class="hint">Drag plants to where they really are — touching near one is enough. Switch to “Add” and tap to add a plant, or “Remove” and tap one to remove it.${real ? ' This moves the plants that are there now; the plan stays as it was.' : ''}</p>
    <div class="seg">${[['move', '✥ Move'], ['add', '＋ Add'], ['remove', '✕ Remove']].map(([v, l]) => `<button type="button" data-act="mode" data-v="${v}" class="${d.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="zoomrow">${zoomBar(() => { draw(); centreZoom($('#arr')); })}</div>
    <div class="plotwrap zoombox" id="arr"></div><p class="center muted" id="cnt"></p>
    <div class="btnrow"><button class="btn" data-act="reset">${real ? 'Back to the plan' : 'Reset to pattern'}</button><button class="btn" data-act="clear">Clear all</button></div>
    <button class="btn primary wide" data-act="save">Save arrangement</button>`;
  const after = () => {
    draw();
    const box = $('#arr');
    let drag = null;
    const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const r = pt.matrixTransform(svg.getScreenCTM().inverse()); return [r.x, r.y]; };
    const clampIn = q => { q[0] = Math.max(0, Math.min(W, q[0])); q[1] = Math.max(0, Math.min(L, q[1])); return q; };
    // the plant under the finger: the nearest one within a fingertip (~28 px), so tiny dots are easy to catch
    const plantAt = e => { const svg = box.querySelector('svg'); return svg ? nearestPlant(svg, e, d.pts) : -1; };
    box.addEventListener('pointerdown', e => {
      const i = d.mode === 'add' ? -1 : plantAt(e);
      if (d.mode === 'move' && i >= 0) { drag = i; box.setPointerCapture(e.pointerId); e.preventDefault(); const el = box.querySelector(`circle[data-i="${i}"]`); if (el) el.classList.add('lifted'); }
      else if (d.mode === 'remove' && i >= 0) { d.pts.splice(i, 1); draw(); }
      else if (d.mode === 'add') { const q = clampIn(toCm(e)); if (Draw.inside(c, q[0], q[1])) { d.pts.push(q); draw(); } }
    });
    const dz = dragZone(box, (t, touch) => d.mode !== 'move' || (touch && plantAt(touch) >= 0));
    const mv = e => {
      if (drag == null) return;
      const q = clampIn(toCm(e)); if (d.pts[drag][2]) q[2] = d.pts[drag][2]; d.pts[drag] = q;   // (a later plant keeps its own sowing date)
      const el = box.querySelector(`circle[data-i="${drag}"]`); if (el) { el.setAttribute('cx', q[0]); el.setAttribute('cy', q[1]); }
    };
    box.addEventListener('pointermove', e => { if (drag == null) return; mv(e); dz.move(e, mv); });
    const end = () => { dz.stop(); if (drag != null) { drag = null; draw(); } };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  };
  return { html, after };
}

// ---------- the same planting in other pots ----------
function copyPlantingDialog(p) {
  const c0 = container(p.containerId), td = todayStr();
  const targets = S.containers.filter(c => c.id !== p.containerId && (c.type === 'bed') === (c0.type === 'bed'));
  if (!targets.length) return alert(`No other ${c0.type === 'bed' ? 'beds' : 'pots'} to copy to.`);
  const busy = c => { const L = Draw.dims(c).L, f = Math.min(p.from, L), t = c0.type === 'bed' ? Math.min(p.to, L) : L;
    return (isPlanned(p) ? occupants(c.id, f, t, p.sowDate, p.sowDate) : activeIn(c.id).filter(x => x.from < t - 0.5 && x.to > f + 0.5)).map(x => crop(x.cropId).en); };
  modal(`<h3>⧉ Same in other ${c0.type === 'bed' ? 'beds' : 'pots'}</h3><p class="muted small">${esc(cropName(p.cropId))}${p.variety ? ' · ' + esc(p.variety) : ''} · ${p.method === 'seed' ? 'sown' : 'planted'} ${shortDate(p.sowDate)}</p>
    <form id="cpf" class="form"><div class="sowchips">${targets.map(c => { const b = busy(c); return `<label class="chip big tog${b.length ? ' off' : ''}"><input type="checkbox" name="t" value="${c.id}"${b.length ? ' disabled' : ''}><span>${BED_ICON(16)} ${esc(c.name)}${b.length ? ` <small>${esc(b.join(', '))}</small>` : ''}</span></label>`; }).join('')}</div>
      <button type="button" class="link" data-x="all">Select all empty ${c0.type === 'bed' ? 'beds' : 'pots'}</button>
      ${p.sowDate <= td ? `<label class="inl chkline"><input type="checkbox" name="hist" checked> <span>Also copy jobs ticked off and feedings recorded so far <small>(if you did them for all the pots)</small></span></label>` : ''}
      <p class="hint">Copies the crop, variety, date, layout and spacing, potting mix, starting fertiliser, repeating jobs and feeding plan. Photos, notes and harvests stay with this one.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Copy</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('[data-x=all]').onclick = () => m.querySelectorAll('#cpf input[name=t]:not(:disabled)').forEach(i => { i.checked = true; });
    m.querySelector('#cpf').onsubmit = async e => {
      e.preventDefault(); const f = e.target, ids = [...f.querySelectorAll('input[name=t]:checked')].map(i => i.value), hist = f.hist && f.hist.checked;
      if (!ids.length) return close();
      for (const cid of ids) copyPlanting(p, container(cid), hist);
      await save(); close(); render();
    };
  });
}
function copyPlanting(p, c, hist) {
  const c0 = container(p.containerId), L = Draw.dims(c).L, sameSize = Draw.dims(c0).L === L && Draw.dims(c0).W === Draw.dims(c).W;
  const q = JSON.parse(JSON.stringify(p));
  Object.assign(q, { id: uid(), containerId: c.id, created: todayStr(), photos: {}, diary: [], harvests: [], prevSpans: [], notes: '' });
  if (c.type === 'bed') { q.from = Math.min(p.from, L - 1); q.to = Math.min(p.to, L); } else { q.from = 0; q.to = L; }
  if (!sameSize) delete q.positions;
  delete q.real; delete q.thinPrev; delete q.thinCount;   // (a fresh copy: all its plants)
  const sMap = {};
  q.series = (q.series || []).map(s => { const id = uid(); sMap[s.id] = id; return Object.assign(s, { id }); });
  q.feedPlan = (q.feedPlan || []).map(s => { const id = uid(); sMap[s.id] = id; return Object.assign(s, { id }); });
  S.plantings.push(q);
  // potting mix: the same choice as the original
  const ev = (c0.mixLog || []).find(x => x.pid === p.id);
  if (ev && c.type !== 'bed') (c.mixLog = (c.mixLog || []).filter(x => x.pid !== q.id)).push(Object.assign({}, ev, { id: uid(), pid: q.id }));
  syncTasks(q);
  if (hist) {
    // jobs on the original (done and to-do) come across; built-in ones just take the original's ticks
    const mine = S.tasks.filter(t => t.plantingId === q.id), clones = [];
    for (const t of S.tasks.filter(t => t.plantingId === p.id)) {
      const twin = !t.seriesId && !t.schedId && mine.find(x => x.kind === t.kind && x.title === t.title);
      if (twin) { if (t.done) Object.assign(twin, { done: true, doneOn: t.doneOn, due: t.due }); continue; }
      clones.push(Object.assign(JSON.parse(JSON.stringify(t)), { id: uid(), plantingId: q.id, seriesId: t.seriesId ? sMap[t.seriesId] || t.seriesId : t.seriesId, schedId: t.schedId ? sMap[t.schedId] || t.schedId : t.schedId, logId: null }));
    }
    const cloned = new Set(clones.map(t => t.seriesId || t.schedId).filter(Boolean));
    S.tasks = S.tasks.filter(x => !(x.plantingId === q.id && (cloned.has(x.seriesId) || cloned.has(x.schedId))));   // the clones replace the fresh copies
    S.tasks.push(...clones);
    // feedings recorded for this crop alone count for the copy too
    for (const l of S.log || []) if ((l.pids || []).includes(p.id) && !(l.cids || []).length) l.pids.push(q.id);
    if (p.thinned) q.thinned = true;
  } else { q.thinned = false; q.thinDoneOn = null; }
  return q;
}
