// A bed or pot's page (with its More… menu and bed jobs), the bed / pot form, and splitting a bed to add another crop.

import { climateDialog, climateLabel } from '../climate/climate.js';
import { A, draft, notFound, render, setChrome, setDraft } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal, plotMaxH, plotSizeBtn } from '../core/ui.js';
import { ui } from '../data/ui-icons.js';
import { soilChips } from '../garden/insights.js';
import { $, $$, esc, go, niceDate, num, shortDate, todayStr, uid } from '../core/util.js';
import { Draw, plotSVG } from '../draw.js';
import { mixDialog, mixList } from '../feeding/mix.js';
import { feedDialog } from '../feeding/plans.js';
import { activeIn, decorate, gaps, isPlanned, planting, prevCrop, sectionOf, sizeLabel, sizeProblem, typeLabel } from '../garden/garden.js';
import { ideasBtn } from '../garden/ideas.js';
import { ensureAreas } from '../garden/areas.js';
import { freeGaps, planSection } from '../garden/planning.js';
import { prepDialog, readingDialog, soilSection } from '../garden/soil.js';
import { bedTaskDialog, sortTasks, taskLi } from '../garden/tasks.js';
import { coverSection } from '../plants/covers.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { historySection } from '../records/history.js';
import { logSection } from '../records/log.js';
import { bedPhotos, noteDialog, noteEntryDialog } from '../records/notes.js';
import { mapViewBtn } from '../plants/onmap.js';
import { removePlanting } from './planting.js';

// ---------- the bed / pot page and form ----------
export function pageContainer(c) {
  if (!c) return { html: notFound() };
  setChrome(c.name, { back: true, kicker: typeLabel(c), sub: sizeLabel(c) });
  const ps = activeIn(c.id), gs = gaps(c);
  const vw = Math.min(window.innerWidth, 640) - 32;
  A.split = () => splitDialog(c);
  A.climate = () => climateDialog(c);
  A.gap = el => { const [f, t] = el.dataset.gap.split(','); go(`#/plant/new/${c.id}?from=${f}&to=${t}`); };
  A.del = async () => {
    if (!await confirmBox(`Delete <b>${esc(c.name)}</b> and everything planted in it (including history)?`, 'Delete', true)) return;
    for (const p of S.plantings.filter(p => p.containerId === c.id)) await removePlanting(p, true);
    S.tasks = S.tasks.filter(t => t.containerId !== c.id);
    S.containers = S.containers.filter(x => x !== c); await save(); go('#/');
  };
  A.addReading = () => readingDialog(c);
  const html = `${soilChips(c)}<div class="plotwrap">${plotSizeBtn()}${mapViewBtn(ps)}${plotSVG(c, { width: vw, maxH: plotMaxH(window.innerHeight * 0.62), labels: true, gaps: true, showMargin: true, grid: true })}</div>
    ${sizeProblem(c) ? `<p class="banner warn">${esc(sizeProblem(c))} <a href="#/container/${c.id}/edit">Edit size</a></p>` : ''}
    <p class="hint center">${typeLabel(c)} · ${sizeLabel(c)}${c.margin ? ` · ${c.margin} cm edge margin` : ''}${c.type !== 'round' ? ' · top → bottom = long side' : ''}</p>
    <div class="center"><button class="chip big" data-act="climate">${climateLabel(c)} ${ui('edit', 15)}</button></div>
    <section><h3>Growing now</h3>
      ${ps.length ? `<ul class="plist">${ps.map(p => `<li><a href="#/plant/${p.id}">${ic(p.cropId)}
        <span class="grow"><b>${esc(cropName(p.cropId))}</b>${p.variety ? ` · ${esc(p.variety)}` : ''}<small>${sectionOf(p) ? `${esc(sectionOf(p))} · ` : ''}${p.method === 'seed' ? 'sown' : 'planted'} ${shortDate(p.sowDate)}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted">Nothing planted.</p>'}
      ${ps.length ? `<button class="btn wide primary" data-act="split">＋ Add another crop to this ${c.type === 'bed' ? 'bed' : 'pot'}</button>` : ''}
      ${gs.map(g => { const pc = prevCrop(c, g[0], g[1]); return `<button class="btn wide" data-act="gap" data-gap="${g[0]},${g[1]}">＋ Plant ${ps.length ? `in ${g[0]}–${g[1]} cm` : 'here'}${pc ? ` <small>(previously ${esc(crop(pc.cropId).en)})</small>` : ''}</button>`; }).join('')}
      ${gs.length ? ideasBtn(c, gs[0][0], gs[0][1]) : ''}
    </section>
    ${(() => {
      const cov = coverSection(c), soil = soilSection(c), bed = bedSection(c), plan = planSection(c);
      const hasCov = (c.covers || []).length, hasSoil = (c.soil || []).length, hasBed = S.tasks.some(t => t.containerId === c.id) || (c.log || []).length;
      const hasPlan = S.plantings.some(p => p.containerId === c.id && isPlanned(p)) || freeGaps(c).some(g => g.s > todayStr());
      A.feedBed = () => feedDialog({ cids: [c.id] }); A.bedMore = () => bedMoreMenu(c); A.bedNote = () => noteEntryDialog({ c });
      return `<div class="carebar four"><a class="btn small" href="#/plant/new/${c.id}?plan=1">${ui('calendar', 18)} Plan</a><button class="btn small" data-act="feedBed">${ui('feed', 18)} Feed</button><button class="btn small" data-act="addCover">${ui('net', 18)} Cover</button><button class="btn small" data-act="bedNote">${ui('note', 18)} Note</button><button class="btn small" data-act="bedMore">${ui('more', 18)} More</button></div>
        ${hasCov ? cov : ''}${hasSoil ? soil : ''}${hasPlan ? plan : ''}${hasBed ? bed : ''}
        <details class="fold"><summary>${ui('clock')} History <small>${(c.history || []).length} past crop${(c.history || []).length === 1 ? '' : 's'}</small></summary>${historySection(c)}</details>
        <details class="fold"><summary>${ui('note')} Running log</summary>${logSection(c)}</details>`;
    })()}
    ${c.notes ? `<section><h3>About this ${c.type === 'bed' ? 'bed' : 'pot'}</h3><p class="pre">${esc(c.notes)}</p></section>` : ''}
    <div class="btnrow"><a class="btn" href="#/container/${c.id}/edit">Edit ${typeLabel(c).toLowerCase()}</a><button class="btn danger" data-act="del">Delete</button></div>`;
  return { html, after: () => $$('.plotwrap [data-gap]').forEach(r => r.addEventListener('click', () => A.gap(r))) };
}
export function pageContainerForm(c) {
  const isNew = !c;
  setChrome(isNew ? 'Add bed or pot' : 'Edit ' + c.name, { back: true, kicker: isNew ? 'New' : typeLabel(c) });
  if (!draft) setDraft(isNew ? { type: 'bed', name: '', width: 100, length: 200, diameter: 40, depth: 35, margin: 10, count: 1, notes: '' } : Object.assign({}, c));
  const d = draft;
  const html = `<form id="cf" class="form">
    ${isNew ? `<button type="button" class="btn wide preset" data-act="preset">${ui('bag', 18)} Fabric grow bag preset (40 L · ⌀40 × 35 cm)</button>` : ''}
    <label>Type<div class="seg">${[['bed', 'Bed'], ['round', 'Round pot / bag'], ['rect', 'Square / rect pot']].map(([v, l]) => `<button type="button" data-act="type" data-v="${v}" class="${d.type === v ? 'on' : ''}">${l}</button>`).join('')}</div></label>
    <label>Name<input name="name" value="${esc(d.name)}" placeholder="${d.type === 'bed' ? 'e.g. Plot A – north' : 'e.g. Bag'}" required></label>
    ${d.type === 'round' ? `<div class="two"><label>Diameter (cm)<input name="diameter" type="number" inputmode="decimal" value="${esc(d.diameter)}"></label><label>Depth (cm)<input name="depth" type="number" inputmode="decimal" value="${esc(d.depth)}"></label></div>` :
      `<div class="two"><label>Short side (cm)<input name="width" type="number" inputmode="decimal" value="${esc(d.width)}"></label><label>Long side (cm)<input name="length" type="number" inputmode="decimal" value="${esc(d.length)}"></label></div>
       ${d.type === 'rect' ? `<label>Depth (cm)<input name="depth" type="number" inputmode="decimal" value="${esc(d.depth)}"></label>` : ''}`}
    <label>Margin from edges (cm)<input name="margin" type="number" inputmode="decimal" value="${esc(d.margin)}"><small>First and last rows start this far in from the edge.</small></label>
    ${isNew ? `<label>How many?<input name="count" type="number" min="1" max="50" value="${esc(d.count)}"><small>More than 1 numbers them, e.g. “Bag 1”, “Bag 2”…</small></label>` : ''}
    ${(ensureAreas(), S.areas.length > 1) ? `<label>Area<select name="area">${S.areas.map(x => `<option value="${x.id}"${(d.area || S.areas[0].id) === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : ''}
    <label>Where<div class="seg wrap">${[['full', `${ui('sun', 18)} Full sun`], ['part', `${ui('partsun', 18)} Part sun`], ['shade', `${ui('shade', 18)} Shade`], ['in', `${ui('home', 18)} Indoors`]].map(([v, l]) => `<button type="button" data-act="where" data-v="${v}" class="${(d.indoor ? 'in' : d.sun || 'full') === v ? 'on' : ''}">${l}</button>`).join('')}</div><small>Used for growth estimates. You can switch it any time from the ${d.type === 'bed' ? 'bed' : 'pot'}’s page.</small></label>
    ${isNew && d.type !== 'bed' ? `<label>Potting mix<select name="mixKind"><option value="">— not recorded —</option>${mixList().map(([k, en, ja]) => `<option value="${k}"${d.mixKind === k ? ' selected' : ''}>${esc(en)} ${esc(ja)}</option>`).join('')}</select></label>
      <label class="inl chkline"><input type="checkbox" name="mixFresh"${d.mixFresh === false ? '' : ' checked'}> <span>Fresh mix (not re-used)</span></label>
      <label>Filled on<input name="mixDate" type="date" value="${esc(d.mixDate || todayStr())}" max="${todayStr()}"><small>When this mix went in. If you then add a crop that was planted earlier, the fill moves back to that crop’s planting date.</small></label>` : ''}
    <label>Notes<textarea name="notes" rows="2">${esc(d.notes || '')}</textarea></label>
    <div class="preview" id="cprev"></div><p class="banner warn" id="sizeWarn" hidden></p>
    <button class="btn primary wide" type="submit">${isNew ? 'Add' : 'Save'}</button></form>`;
  const read = () => { const f = $('#cf'); for (const el of f.elements) if (el.name) d[el.name] = el.type === 'checkbox' ? el.checked : el.value; };
  const prev = () => { read(); const t = { id: 'prev', type: d.type, width: num(d.width) || 1, length: num(d.length) || 1, diameter: num(d.diameter) || 1, margin: num(d.margin) || 0 };
    if (t.type !== 'round' && t.width > t.length) [t.width, t.length] = [t.length, t.width];
    $('#cprev').innerHTML = Draw.svg(t, [], { px: Math.min(220 / Draw.dims(t).L, 260 / Draw.dims(t).W), showMargin: true, grid: true });
    const filled = d.type === 'round' ? num(d.diameter) > 0 : num(d.width) > 0 && num(d.length) > 0;   // nothing to say while a size is still being typed
    const why = filled ? sizeProblem(Object.assign(t, { depth: num(d.depth) })) : '', w = $('#sizeWarn'); w.textContent = why; w.hidden = !why; };
  A.type = el => { read(); d.type = el.dataset.v; if (d.type !== 'bed' && +d.margin === 10) d.margin = 2; if (d.type === 'bed' && +d.margin === 2) d.margin = 10; render(); };
  A.where = el => { read(); if (el.dataset.v === 'in') d.indoor = true; else { d.indoor = false; d.sun = el.dataset.v; } render(); };
  A.preset = () => { Object.assign(d, { type: 'round', name: d.name || 'Bag', diameter: 40, depth: 35, margin: 2, count: d.count || 1 }); render(); };
  const after = () => {
    prev();
    $('#cf').addEventListener('input', prev);
    $('#cf').addEventListener('submit', async e => {
      e.preventDefault(); read();
      const base = { type: d.type, margin: num(d.margin) ?? 0, notes: d.notes || '', sun: d.sun || 'full', indoor: !!d.indoor, area: d.area || (S.areas && S.areas[0] ? S.areas[0].id : null) };
      if (!isNew && c.area !== base.area) c.pos = null;
      if (d.type === 'round') { if (!(num(d.diameter) > 0)) return alert('Enter a diameter.'); Object.assign(base, { diameter: num(d.diameter), depth: num(d.depth) }); }
      else {
        let w = num(d.width), l = num(d.length);
        if (!(w > 0 && l > 0)) return alert('Enter both sides.');
        if (w > l) [w, l] = [l, w];
        Object.assign(base, { width: w, length: l, depth: d.type === 'rect' ? num(d.depth) : null });
      }
      const why = sizeProblem(base); if (why) return alert(why);
      const name = (d.name || '').trim() || (d.type === 'bed' ? 'Bed' : 'Pot');
      if (isNew) {
        const n = Math.max(1, Math.min(50, parseInt(d.count) || 1));
        for (let i = 0; i < n; i++) S.containers.push(Object.assign({ id: uid(), name: n > 1 ? `${name} ${i + 1}` : name, history: [], created: todayStr() }, base,
          d.type !== 'bed' && d.mixKind ? { mixLog: [{ id: uid(), date: d.mixDate && d.mixDate <= todayStr() ? d.mixDate : todayStr(), kind: d.mixKind, fresh: d.mixFresh !== false, added: true }] } : {}));
        await save(); setDraft(null); go(n > 1 ? '#/' : '#/container/' + S.containers[S.containers.length - 1].id);
      } else {
        const L = base.type === 'round' ? base.diameter : base.length;
        Object.assign(c, base, { name });
        for (const p of activeIn(c.id)) { if (p.to > L) p.to = L; if (p.from >= L) { p.from = 0; p.to = L; } }
        await save(); setDraft(null); history.back();
      }
    });
  };
  return { html, after };
}

// ---------- bed jobs, notes, prep ----------
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
      <div class="btnrow"><button class="btn small" data-act="bedJob">＋ Add job</button><button class="btn small" data-act="prep">${ui('trowel', 18)} Prepare bed…</button></div>
      ${done.length ? `<details class="donelog"><summary>Done (${done.length})</summary><ul class="tasks">${done.map(t => taskLi(t, false)).join('')}</ul></details>` : ''}</section>
    <section><h3>Bed notes</h3>
      ${log.length ? `<ul class="plist">${log.map(n => `<li data-act="editNote" data-id="${n.id}">${n.photo ? `<img class="nthumb" data-photo="${n.photo}" alt="">` : ''}<span class="grow"><small>${niceDate(n.date)}</small>${esc(n.text)}</span><span class="muted">✎</span></li>`).join('')}</ul>` : '<p class="muted">Soil, compost, lime, anything worth remembering.</p>'}
      <button class="btn small" data-act="bedNote">＋ Add note</button></section>`;
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

// ---------- the More… menu ----------
// bed page: everything that isn't Plan / Feed / Cover / Note
function bedMoreMenu(c) {
  const nPh = bedPhotos(c.id).length, ps = activeIn(c.id).length;
  const items = [
    ['reading', 'flask', 'Soil reading', () => readingDialog(c)],
    ['prep', 'trowel', `Prepare the ${c.type === 'bed' ? 'bed' : 'pot'}`, () => prepDialog(c)],
    ['job', 'check', 'Add a job', () => bedTaskDialog(c)],
    nPh && ['photos', 'camera', `Photos (${nPh})`, `#/timeline?c=${c.id}`],
    ps && ['sections', 'ruler', 'Sections', `#/container/${c.id}/sections`],
    ['rotation', 'rotate', 'Rotation', '#/rotation'],
    c.type !== 'bed' && ['mix', 'pot', 'Potting mix history', () => mixDialog(c)],
  ].filter(Boolean);
  modal(`<h3>${esc(c.name)}</h3><div class="tiles qa3">${items.map(([k, i, l]) => `<button class="tile" data-m="${k}"><span>${ui(i, 26)}</span>${l}</button>`).join('')}</div>
    <div class="btns"><button class="btn" data-x="no">Close</button></div>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    items.forEach(([k, , , act]) => { m.querySelector(`[data-m=${k}]`).onclick = () => { if (typeof act === 'string') { close(); go(act); } else act(); }; });
  });
}
