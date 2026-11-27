// The planting form: crop, place, layout, dates, potting mix and starting fertiliser; re-using seed packet photos.

import { DB } from '../core/db.js';
import { compress, dropPhoto } from '../core/photos.js';
import { A, draft, notFound, render, setChrome, setDraft } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, dragZone } from '../core/ui.js';
import { $, addDays, daysBetween, esc, num, shortDate, todayStr, uid, unitOpts } from '../core/util.js';
import { HANDFUL_G } from '../data/catalog.js';
import { Draw } from '../draw.js';
import { lastMixKind, mixDefaults, mixDraftC, mixFormBits, saveMixChoice } from '../feeding/mix.js';
import { baseFertNote, baseFertPlan, careJobStart, careJobs, FRUITING, jobAmount, jobAmountText } from '../feeding/plans.js';
import { activeIn, container, decorate, endOf, gaps, isPlanned, noteVacated, occupants, planRotation } from '../garden/garden.js';
import { gapAround, ideasDialog } from '../garden/ideas.js';
import { linkedStart, planFormBits } from '../garden/planning.js';
import { rotationNote } from '../garden/rotation.js';
import { soilAdvice, soilLine, soilReadingAdvice } from '../garden/soil.js';
import { syncTasks } from '../garden/tasks.js';
import { onionType } from '../climate/climate.js';
import { crop, cropOptions, kin, newCropDialog, varieties } from '../plants/crops.js';
import { rememberSeed, seedFor, seedList } from '../plants/seeds.js';
import { harvestEstimate, thinEstimate } from '../plants/growth.js';
import {
  applyStart, defaultStartCount, fewSpots, formStart, linkStartOnSave, perOf, planStartOnSave, plantsOf, prefillFromStart, setStartCount, start, startChooser,
  startCountField, startLeft, startPlanted, startReadyNote, startWhere, unitOf
} from '../plants/seedlings.js';
import { myProducts } from '../products/library.js';

// ---------- the form ----------
export const LAYOUTS = [['rows', 'Rows'], ['continuous', 'Continuous line (drill)'], ['staggered', 'Staggered rows (offset, e.g. 3–4–3)'],
  ['scatter', 'Scattered / broadcast'], ['center', 'Single plant in the centre'], ['diamond', 'Diamond (4 plants)'], ['free', 'Custom – place each plant by hand']];
export function applyCrop(d, cr, c) {
  d.cropId = cr.id; d.method = cr.method || 'seed';
  let lay = cr.layout || 'rows';
  if (c && c.type !== 'bed') lay = cr.pot || ((cr.spread || 0) >= 35 ? 'center' : lay);
  d.layout = lay;
  d.depth = cr.depth ?? ''; d.rowSp = cr.rowSp ?? ''; d.plantSp = cr.sowSp ?? '';
  d.thinStage = cr.thinStage || ''; d.thinSp = cr.thinSp ?? ''; d.spread = cr.spread ?? '';
  d.daysThin = cr.daysThin; d.daysHarvest = cr.daysHarvest; d.harvestManual = false; d.thinManual = false;
  d.daysFrom = cr.daysHarvest || ''; d.daysTo = cr.daysHarvest ? Math.round(cr.daysHarvest * 1.3) : ''; d.keepUntil = '';
  d.dir = cr.dir || 'across'; d.rows = ''; d.variety = ''; d.sj = {};
  if (!(d.fert || []).length || d.fertAuto) { try { d.fert = baseFertPlan(cr.id, mixDraftC(c, d), d.from, d.to, d.sowDate); d.fertAuto = true; } catch (e) { console.warn(e); } }
  recalc(d);
}
export function recalc(d) {
  if (!d.sowDate) return;
  if (!d.harvestManual && d.daysHarvest) d.harvestDate = harvestEstimate({ id: d.id, cropId: d.cropId, sowDate: d.sowDate, method: d.method, germ: d.germ, daysFrom: num(d.daysFrom), containerId: d.containerId, seededOn: d.seededOn || (d.useStart && start(d.useStart) ? start(d.useStart).sowDate : null) });
  if (!d.thinManual && d.daysThin && d.method === 'seed' && d.thinSp) d.thinDate = thinEstimate({ cropId: d.cropId, sowDate: d.sowDate, method: 'seed', germ: d.germ });
}
function setPath(o, path, v) {
  const ks = path.split('.'); let cur = o;
  for (let i = 0; i < ks.length - 1; i++) cur = cur[ks[i]];
  cur[ks[ks.length - 1]] = v;
}
export function pagePlantForm(p, c, q) {
  const isNew = !p;
  if (!isNew) c = container(p.containerId);
  if (!c) return { html: notFound() };
  const L = Draw.dims(c).L;
  if (!draft) {
    if (isNew) {
      const g = gaps(c)[0] || [0, L];
      setDraft({ containerId: c.id, from: num(q.get('from')) ?? g[0], to: num(q.get('to')) ?? g[1], sowDate: todayStr(), fert: [], series: [], notes: '', photos: {}, newPhotos: {}, removePhotos: {} });
      Object.assign(draft, { cropId: '', method: 'seed', layout: c.type === 'bed' ? 'rows' : 'center', depth: '', rowSp: '', plantSp: '', rows: '', thinStage: '', thinSp: '', spread: '', variety: '' });
      if (q.get('crop')) applyCrop(draft, crop(q.get('crop')), c);
      if (q.get('date')) { draft.sowDate = q.get('date'); recalc(draft); }
      else if (q.get('plan') && !q.get('start')) { draft.sowDate = addDays(todayStr(), 30); recalc(draft); }
      if (q.get('method') && ['seed', 'seedling'].includes(q.get('method'))) { draft.method = q.get('method'); recalc(draft); }
      if (q.get('raise')) draft.raise = q.get('raise');
      if (q.get('start')) prefillFromStart(draft, q);
      if (q.get('usestart') && start(q.get('usestart'))) applyStart(draft, start(q.get('usestart')), c);
    } else {
      setDraft(JSON.parse(JSON.stringify(p))); draft.newPhotos = {}; draft.removePhotos = {};
      draft.fert = draft.fert || []; draft.series = draft.series || []; draft.photos = draft.photos || {};
      draft.harvestManual = true; draft.thinManual = true; draft._pid = p.id;
      const fs = isPlanned(p) && formStart(draft); if (fs) draft.startCount = Math.min(fs.have, p.planN || fs.have);   // a plan using your seedlings: how many
    }
    if (c.type !== 'bed') { if (isNew) delete draft.mixFresh; mixDefaults(draft, c); if (draft.fertAuto && draft.cropId) try { draft.fert = baseFertPlan(draft.cropId, mixDraftC(c, draft), draft.from, draft.to, draft.sowDate); } catch (e) { console.warn(e); } }
  }
  const d = draft;
  setChrome(isNew ? 'New planting' : 'Edit planting', { back: true, kicker: c.name });
  const cr = d.cropId ? crop(d.cropId) : null;
  const seed = d.method === 'seed';
  const rowish = ['rows', 'continuous', 'staggered'].includes(d.layout);
  const cropOpts = `<option value="">Choose a crop…</option>` + cropOptions(d.cropId) + `<option value="__new">＋ Add a new crop…</option>`;
  const ph = slot => {
    const nb = d.newPhotos[slot], id = d.photos[slot];
    const img = nb ? `<img src="${URL.createObjectURL(nb)}">` : id && !d.removePhotos[slot] ? `<img data-photo="${id}">` : `<span>＋ ${slot === 'front' ? 'Front' : 'Back'}</span>`;
    return `<label class="phslot ph">${img}<input type="file" accept="image/*" data-slot="${slot}" hidden></label>${(nb || (id && !d.removePhotos[slot])) ? `<button type="button" class="link" data-act="rmPhoto" data-slot="${slot}">remove</button>` : ''}`;
  };
  const moreSummary = () => {
    const lay = (LAYOUTS.find(x => x[0] === d.layout) || [, ''])[1].replace(/\s*[–(].*$/, '');
    const bits = [lay && `${lay}${d.plantSp ? ` ${d.plantSp} cm` : ''}`];
    if (seed && d.thinDate) bits.push(`thin ~${shortDate(d.thinDate)}`);
    if (d.harvestDate) bits.push(`harvest ~${shortDate(d.harvestDate)}`);
    if (d.fert.length) bits.push(d.fert.length === 1 ? '1 fertiliser' : `${d.fert.length} fertilisers`);
    const nj = (isNew && cr ? careJobs(cr.id).filter((j, i) => !(d.sj && d.sj[i] === false)).length : 0) + d.series.length;
    if (nj) bits.push(`${nj} job${nj > 1 ? 's' : ''}`);
    return bits.filter(Boolean).join(' · ');
  };
  const html = `${d.startId && start(d.startId) ? `<div class="banner" id="startBanner"></div>` : ''}<form id="pf" class="form">
    <div class="preview big" id="pprev"></div>${startCountField(d)}
    <fieldset><legend>Crop</legend>
      ${isNew && !d.startId ? startChooser(d, c, (gapAround(c, d.from, d.to, d.sowDate || todayStr()) || {}).e) : ''}
      <label>Crop<select name="cropId" id="cropSel">${cropOpts}</select></label>
      ${isNew && !d.startId ? `<button type="button" class="link" data-act="formIdeas">💡 What could go here${d.sowDate > todayStr() ? ' then' : ' now'}?</button>` : ''}
      <label>Variety<input name="variety" list="vars" value="${esc(d.variety || '')}" placeholder="${esc(cr && varieties(cr.id)[0] ? 'e.g. ' + varieties(cr.id)[0] : 'from the seed packet or plant label')}" autocomplete="off">
        <datalist id="vars">${d.cropId ? varieties(d.cropId).map(v => `<option value="${esc(v)}">`).join('') : ''}</datalist>
        ${d.cropId ? `<button type="button" class="link" data-act="searchVar">🔎 Search this variety online</button>` : ''}
        ${d.cropId && kin(d.cropId) === 'onion' ? `<small class="hint">🌗 For here: ${esc(onionType()[1])}.</small>` : ''}</label>
      <label>Planting type<div class="seg">${[['seed', 'From seed'], ['seedling', 'Seedlings / tubers']].map(([v, l]) => `<button type="button" data-act="method" data-v="${v}" class="${d.method === v ? 'on' : ''}">${l}</button>`).join('')}</div></label>
    </fieldset>
    <fieldset><legend>Where &amp; when</legend>
      <div id="rotWarn"></div>
      ${c.type === 'round' && !gaps(c, p && p.id).some(g => g[0] > 0 || g[1] < L) && d.from <= 0 && d.to >= L ? '' :
        `<div class="two"><label>From (cm from top)<input name="from" type="number" inputmode="decimal" value="${esc(d.from)}"></label><label>To (cm)<input name="to" type="number" inputmode="decimal" value="${esc(d.to)}"></label></div><small class="hint">Long side is ${L} cm. To share the bed with another crop, use only part of it — e.g. 0 to 90 — and plant the rest later.</small>`}
      <label>${d.sowDate > todayStr() ? (seed ? 'Sow on' : 'Plant on') : seed ? 'Sown on' : 'Planted on'}<input name="sowDate" type="date" value="${esc(d.sowDate)}"></label>
      <div id="planBits">${planFormBits(d, c)}</div>${startReadyNote(d).replace('<p class="hint">', '<p class="hint" id="startNote">')}
      <div id="mixBits">${mixFormBits(d, c)}</div>
      ${d.cropId && (!d.sowDate || daysBetween(todayStr(), d.sowDate) <= 7) ? soilLine(d.cropId, d.method, c, d.from, d.to) : ''}
    </fieldset>
    <details class="fold more" id="pfMore"${d._more ? ' open' : ''}><summary>More options <small>${esc(moreSummary())}</small></summary>
    <fieldset><legend>Layout &amp; spacing</legend>
      <label>Layout<select name="layout">${LAYOUTS.map(([v, l]) => `<option value="${v}"${v === d.layout ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      ${d.layout === 'free' ? `<small class="hint">After saving, use “Arrange plants” on the crop page to drag plants into place.</small>` : ''}
      ${seed ? `<label>Sowing depth (cm)<input name="depth" type="number" step="0.1" inputmode="decimal" value="${esc(d.depth)}"></label>` : ''}
      <div class="two">
        <label>${seed ? 'Sowing distance' : 'Spacing between plants'} (cm)<input name="plantSp" type="number" step="0.5" inputmode="decimal" value="${esc(d.plantSp)}"></label>
        ${rowish ? `<label>Between rows (cm)<input name="rowSp" type="number" step="0.5" inputmode="decimal" value="${esc(d.rowSp)}"></label>` : ''}
      </div>
      ${rowish ? `<label>Row direction<select name="dir"><option value="across"${d.dir !== 'along' ? ' selected' : ''}>Across – rows stacked down the long side</option><option value="along"${d.dir === 'along' ? ' selected' : ''}>Lengthways – rows run down the long side</option></select></label>` : ''}
      ${rowish ? `<label>Number of rows<input name="rows" type="number" min="1" inputmode="numeric" value="${esc(d.rows)}" placeholder="auto">
        <small><span id="fitTxt"></span>If you enter a number, the rows are spread evenly between the margins.</small></label>` : ''}
      <small class="hint">Rows and plants start at the edge margin and are spread evenly, so actual spacing is never less than what you enter.</small>
    </fieldset>
    ${seed ? `<fieldset><legend>Thinning</legend>
      <label>When to thin<input name="thinStage" value="${esc(d.thinStage)}" placeholder="e.g. at 3 true leaves"></label>
      <div class="two"><label>Thin to (cm)<input name="thinSp" type="number" step="0.5" inputmode="decimal" value="${esc(d.thinSp)}"></label>
      <label>Approx. date<input name="thinDate" type="date" value="${esc(d.thinDate || '')}" data-manual="thinManual"></label></div>
      <small class="hint">The date is estimated from when they come up and the temperatures, and updates by itself — unless you change it here. Ticking the thinning task redraws the plot at the thinned spacing.</small></fieldset>` : ''}
    ${isNew && cr && careJobs(cr.id).length ? `<fieldset><legend>Suggested jobs</legend>
      ${careJobs(cr.id).map((j, i) => `<label class="inl chkline"><input type="checkbox" name="sj.${i}"${d.sj && d.sj[i] === false ? '' : ' checked'}> <span>${esc(j[0])} <small>${j[1] ? `around ${shortDate(careJobStart({ cropId: cr.id, sowDate: d.sowDate || todayStr(), containerId: c && c.id, harvestDate: d.harvestDate }, j))}` : 'at planting'}${j[2] ? ` · then every ${j[2]} ${j[3]}${j[2] > 1 ? 's' : ''}` : ''}${esc(jobAmountText(j))}</small></span></label>`).join('')}
      <small class="hint">Untick any you don’t do. They become jobs on this crop’s page and the calendar.</small></fieldset>` : ''}
    <fieldset><legend>Harvest</legend>
      <div class="two"><label>Earliest harvest<input name="harvestDate" type="date" value="${esc(d.harvestDate || '')}" data-manual="harvestManual"></label>
      <label>Mature size (cm across)<input name="spread" type="number" inputmode="decimal" value="${esc(d.spread)}"></label></div>
      <div class="two"><label>Packet: days to harvest, from<input name="daysFrom" type="number" inputmode="numeric" value="${esc(d.daysFrom ?? (cr ? cr.daysHarvest : ''))}"></label><label>to<input name="daysTo" type="number" inputmode="numeric" value="${esc(d.daysTo ?? (cr && cr.daysHarvest ? Math.round(cr.daysHarvest * 1.3) : ''))}"></label></div>
      <label>Keeps until (optional)<input name="keepUntil" type="date" value="${esc(d.keepUntil || '')}"><small>Leave empty and the app works it out from the crop and the temperatures — cold weather lets roots and brassicas hold much longer.</small></label>
      ${cr && cr.daysHarvest ? `<small class="hint">Estimated from the catalogue (about ${cr.daysHarvest} days from ${seed || (cr.method === 'seed' && (d.startId || d.useStart)) ? 'sowing' : 'planting'} at the usual time of year${cr.method === 'seed' && (d.startId || d.useStart) ? ', counted from the tray sowing' : ''}) and the temperatures — colder weather pushes it later. It updates by itself unless you change it here to match the packet.</small>` : ''}
    </fieldset>
    <fieldset><legend>Starting fertiliser</legend>
      ${cr && c ? `<p class="hint">Suggested from your products${(soilAdvice(c, d.from, d.to, cr.id) || {}).base !== undefined && soilAdvice(c, d.from, d.to, cr.id).base !== 1 ? ' (adjusted for the last crop)' : ''}: ${esc(baseFertNote(cr.id, mixDraftC(c, d), d.sowDate))}.</p>` : ''}
      ${d.fert.map((f, i) => `<div class="fert"><input name="fert.${i}.product" list="fertNames" value="${esc(f.product)}" placeholder="Product (e.g. NPK 8-8-8)"><input name="fert.${i}.amount" type="number" inputmode="decimal" value="${esc(f.amount)}" placeholder="Amount">
        <select name="fert.${i}.unit">${unitOpts(f.unit)}</select><button type="button" class="x" data-act="rmFert" data-i="${i}">✕</button></div>`).join('')}
      <datalist id="fertNames">${myProducts(['fert', 'compost', 'lime', 'amend']).map(x => `<option value="${esc(x.en)}">`).join('')}</datalist>
      <button type="button" class="btn small" data-act="addFert">＋ Add fertiliser</button>
      <small class="hint">Units: g, handfuls (1 handful ≈ ${HANDFUL_G} g of granular fertiliser), mL or L.</small>
    </fieldset>
    <fieldset><legend>Repeating jobs</legend>
      ${d.series.map((s, i) => `<div class="series">
        <div class="fert">${!s.product ? `<input name="series.${i}.title" value="${esc(s.title || '')}" placeholder="Job (e.g. Earth up)">` : `<input name="series.${i}.product" value="${esc(s.product)}"><input name="series.${i}.amount" type="number" inputmode="decimal" value="${esc(s.amount)}" placeholder="Amount">
        <select name="series.${i}.unit">${unitOpts(s.unit)}</select>`}<button type="button" class="x" data-act="rmSeries" data-i="${i}">✕</button></div>
        <div class="rep-row"><select name="series.${i}.every">${[0, 1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => `<option value="${n}"${+s.every === n ? ' selected' : ''}>${n === 0 ? 'Once' : 'Every ' + n}</option>`).join('')}</select>
        ${+s.every > 0 ? `<select name="series.${i}.per">${['day', 'week', 'month'].map(u => `<option value="${u}"${s.per === u ? ' selected' : ''}>${u}${+s.every > 1 ? 's' : ''}</option>`).join('')}</select>` : ''}
        <label class="inl">${+s.every > 0 ? 'from' : 'on'} <input type="date" name="series.${i}.start" value="${esc(s.start || '')}"></label>
        ${+s.every > 0 ? `<label class="inl">until <input type="date" name="series.${i}.end" value="${esc(s.end || '')}"></label>` : ''}</div></div>`).join('')}
      <button type="button" class="btn small" data-act="addSeries">＋ Add repeating job</button>
      <small class="hint">Fertiliser and liquid feeds are planned from the crop’s Feeding card (📅 Feeding plan), so they’re counted and can’t overfeed.</small>
      <small class="hint">Repeating jobs: the next one is due counted from the day you actually tick it off.</small>
    </fieldset>
    <fieldset><legend>Packet &amp; notes</legend>
      <label>Packet photos<div class="phrow">${ph('front')}${ph('back')}</div></label>
      ${packetPicker(d)}
      <label>Notes<textarea name="notes" rows="3">${esc(d.notes || '')}</textarea></label>
    </fieldset>
    </details>
    <button class="btn primary wide" type="submit">${isNew ? 'Save planting' : 'Save changes'}</button>
  </form>`;

  const read = () => {
    d.sj = d.sj || {};
    for (const el of $('#pf').elements) if (el.name) setPath(d, el.name, el.type === 'checkbox' ? el.checked : el.value);
    d.from = num(d.from) ?? 0; d.to = num(d.to) ?? L;
    if (document.activeElement && /^fert\./.test(document.activeElement.name || '')) d.fertAuto = false;
  };
  let shown = null;   // the planting as last drawn
  const preview = () => {
    const tmp = Object.assign({}, d, { id: p ? p.id : 'new', _color: cr ? cr.color : '#888', _label: cr ? cr.en : 'New', rows: num(d.rows), rowSp: num(d.rowSp), plantSp: num(d.plantSp), thinSp: num(d.thinSp), spread: num(d.spread) });
    tmp.thinned = p ? p.thinned : false;
    if (tmp.layout === 'free' && !(tmp.positions || []).length) {
      // placing by hand: start from the seedlings you're planting out (that many), or else from rows at this spacing
      const n = d.startCount || 0, rows = Draw.layout(c, Object.assign({}, tmp, { layout: 'rows' })).pts;
      tmp.positions = n ? fewSpots(c, d, n) || rows.slice(0, n) : rows;
      if (n) d.positions = tmp.positions.map(q => q.slice());
    }
    const planMode = d.sowDate > todayStr();
    const others = decorate(planMode ? occupants(c.id, 0, 1e9, d.sowDate, d.sowDate, p && p.id) : activeIn(c.id).filter(x => !p || x.id !== p.id));
    const vw = Math.min(window.innerWidth, 640) - 48;
    const ft = $('#fitTxt'); if (ft) { const n = Draw.fitRows(c, tmp); ft.textContent = n ? `${n} row${n > 1 ? 's' : ''} fit at ${tmp.rowSp} cm. ` : ''; $('#pf').rows.placeholder = n ? 'auto: ' + n : 'auto'; }
    const rw = $('#rotWarn');
    if (rw) { const rn = planMode ? planRotation(c, d.from, d.to, d.cropId, d.sowDate, p && p.id) : rotationNote(c, d.from, d.to, d.cropId, p ? p.sowDate : null, p && p.id); rw.className = rn ? (rn.same ? 'warn' : 'note') : ''; rw.innerHTML = rn ? rn.html : ''; const sr = d.cropId ? soilReadingAdvice(c, d.from, d.to, d.cropId) : null; if (sr) { rw.innerHTML += `<p class="soiln">🧪 ${sr.bits.map(esc).join(' ')}</p>`; if (!rw.className) rw.className = 'note'; }
    const sa = soilAdvice(c, d.from, d.to, d.cropId, p ? p.sowDate : null, p && p.id); if (sa) { rw.innerHTML += `<p class="soiln">🪱 ${sa.text}</p>`; if (!rn || !rn.same) rw.className = sa.level === 'warn' ? 'warn' : 'note'; } }
    // planting out from a tray: the plants going in are the ones the drawing holds — the rest stay in the tray
    const sb = $('#startBanner'), st = d.startId && start(d.startId);
    if (sb && st) {
      const have = plantsOf(st, startLeft(st)), fit = Draw.count(c, tmp), per = perOf(st), use = Math.min(have, fit, d.startCount || fit);
      const cells = Math.min(startLeft(st), Math.ceil(use / per)), restCells = startLeft(st) - cells, unit = unitOf(st), n = crop(st.cropId).en;
      d.startUse = use;
      sb.innerHTML = `🌱 Planting out <b>${use}</b> of the ${have} ${esc(n)} seedling${have === 1 ? '' : 's'} from ${esc(startWhere(st))}${per > 1 ? ` (${cells} ${unit}${cells === 1 ? '' : 's'})` : ''}${use < have
        ? `. The other ${restCells > 0 ? `${restCells} ${unit}${restCells === 1 ? '' : 's'}` : have - use} ${(restCells > 0 ? restCells : have - use) === 1 ? 'stays' : 'stay'} in ${esc(startWhere(st).toLowerCase())} until you plant them out somewhere else or discard them.`
        : fit > have ? ` — the layout has room for ${fit}, so the drawing would show ${fit - have} more than you have. <button type="button" class="link" data-act="fitStart">Place just these ${have} by hand</button> or make the section smaller.` : '.'}`;
      A.fitStart = () => { d.layout = 'free'; d.positions = null; setStartCount(c, d, have); render(); };
    }
    shown = tmp;
    $('#pprev').innerHTML = Draw.svg(c, [...others, tmp], { px: Math.min(vw / Draw.dims(c).W, 300 / L), today: tmp.sowDate || todayStr(), highlight: tmp.id, labels: true, showMargin: true, grid: true });
    // also show a "grown" preview at harvest
  };
  A.searchVar = () => { read(); const q = `${cr ? cr.en : ''} ${d.variety || ''} growing from seed`.trim(); window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener'); };
  A.method = el => { read(); d.method = el.dataset.v; recalc(d); render(); };
  A.raise = el => { read(); d.raise = el.dataset.v; render(); };
  A.useStart = el => { read(); applyStart(d, start(el.dataset.id), c); render(); };
  A.usePacket = el => { read(); usePacket(d, el.dataset.k, c); render(); };
  A.addFert = () => { read(); d.fertAuto = false; d.fert.push({ product: '', amount: '', unit: 'g' }); render(); };
  A.rmFert = el => { read(); d.fertAuto = false; d.fert.splice(+el.dataset.i, 1); render(); };
  A.addSeries = () => { read(); d.series.push({ id: uid(), title: '', every: 1, per: 'week', start: addDays(d.sowDate || todayStr(), 14), end: '' }); render(); };
  A.rmSeries = el => { read(); d.series.splice(+el.dataset.i, 1); render(); };
  A.formIdeas = () => {
    read(); const g = gapAround(c, d.from, d.to, d.sowDate || todayStr());
    ideasDialog(c, d.from, d.to, g && g.s > (d.sowDate || '') ? g.s : (d.sowDate || todayStr()), g ? g.e : null, (id, o) => {
      applyCrop(d, crop(id), c); d.sowDate = o.P; d.method = o.kind === 'sow' ? 'seed' : 'seedling';
      if (o.P > todayStr() && o.kind !== 'sow') d.raise = o.kind === 'raise' ? 'tray' : 'buy';
      if (c.type !== 'bed') { delete d.mixFresh; mixDefaults(d, c); }
      recalc(d); render();
    });
  };
  A.mixF = el => { read(); d.mixUser = true; d.mixFresh = el.dataset.v === '1'; if (d.mixFresh && !d.mixKind) d.mixKind = lastMixKind(); if (d.fertAuto && d.cropId) d.fert = baseFertPlan(d.cropId, mixDraftC(c, d), d.from, d.to, d.sowDate); render(); };
  A.rmPhoto = el => { read(); const s = el.dataset.slot; if (d.newPhotos[s]) delete d.newPhotos[s]; else d.removePhotos[s] = true; render(); };

  const after = () => {
    const f = $('#pf');
    const more = $('#pfMore'); if (more) more.addEventListener('toggle', () => { d._more = more.open; });
    preview();
    // seedlings going in: drag them in the picture to where they'll go (the layout becomes "placed by hand")
    if (formStart(d)) {
      const box = $('#pprev'), { W, L: LL } = Draw.dims(c); let drag = null, raf = 0;
      const toCm = e => { const svg = box.querySelector('svg'); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const r = pt.matrixTransform(svg.getScreenCTM().inverse()); return [r.x, r.y]; };
      const pts = () => (shown ? Draw.layout(c, shown).pts : []);
      const near = e => { const q = toCm(e), px = box.querySelector('svg').getScreenCTM().a || 1, reach = 22 / px; let best = -1, bd = Infinity; pts().forEach((p0, i) => { const dd = Math.hypot(p0[0] - q[0], p0[1] - q[1]); if (dd < bd) { bd = dd; best = i; } }); return bd <= reach ? best : -1; };
      const dz = dragZone(box, t => !!t.closest('.plant, .picon'));
      box.addEventListener('pointerdown', e => {
        if (!box.querySelector('svg')) return; const i = near(e); if (i < 0) return;
        if (d.layout !== 'free' || !(d.positions || []).length) { d.positions = pts().map(q => q.slice()); d.layout = 'free'; if (f.layout) f.layout.value = 'free'; }
        drag = i; box.setPointerCapture(e.pointerId); e.preventDefault();
      });
      const mv = e => {
        if (drag == null) return;
        const q = toCm(e); q[0] = Math.round(Math.max(0, Math.min(W, q[0])) * 10) / 10; q[1] = Math.round(Math.max(0, Math.min(LL, q[1])) * 10) / 10;
        if (!Draw.inside(c, q[0], q[1])) return;
        d.positions[drag] = q.concat(d.positions[drag][2] ? [d.positions[drag][2]] : []);
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; preview(); });
      };
      box.addEventListener('pointermove', e => { if (drag == null) return; mv(e); dz.move(e, mv); });
      const end = () => { dz.stop(); drag = null; };
      box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    }
    f.addEventListener('input', e => {
      const n = e.target.name || '';
      if (e.target.dataset.manual) d[e.target.dataset.manual] = true;
      if (n === 'thinDate') d.thinUser = true;
      if (n === 'harvestDate') d.hvUser = true;
      read();
      if (n === 'startCount') {   // how many seedlings go in: that many in the drawing
        const fs = formStart(d), v = Math.round(+e.target.value);
        if (fs && v >= 1) { setStartCount(c, d, Math.min(fs.have, v)); if (f.layout) f.layout.value = d.layout; const rn = $('#startNote'); if (rn) rn.outerHTML = startReadyNote(d).replace('<p class="hint">', '<p class="hint" id="startNote">'); }
        d.startCount = d.startCount || null;
      }
      if (n === 'sowDate' || n === 'thinSp' || n === 'daysFrom') { recalc(d); if (f.harvestDate) f.harvestDate.value = d.harvestDate || ''; if (f.thinDate) f.thinDate.value = d.thinDate || ''; }
      if (n === 'sowDate') { const pb = $('#planBits'); if (pb) pb.innerHTML = planFormBits(d, c); const mb = $('#mixBits'); if (mb && !d.mixUser) { delete d.mixFresh; mb.innerHTML = mixFormBits(d, c); } }
      preview();
    });
    f.addEventListener('change', async e => {
      const n = e.target.name || '';
      if (n === 'variety') { read(); if (packetForVariety(d)) render(); return; }   // a variety from your seeds brings its packet
      if (n === 'cropId') {
        read();
        if (e.target.value === '__new') { e.target.value = d.cropId; return newCropDialog(id => { applyCrop(d, crop(id), c); d.method = 'seed'; render(); }); }
        const keepSow = d.sowDate; applyCrop(d, crop(e.target.value), c); d.sowDate = keepSow; recalc(d); return render();
      }
      if (n === 'layout' || n === 'dir' || /\.every$/.test(n)) {
        read();
        // seedlings going in: as many as the new layout takes (a diamond: 4 — or 4 pairs of peas)
        const fs = n === 'layout' && formStart(d); if (fs) { if (d.layout !== 'free') d.positions = null; setStartCount(c, d, d.layout === 'free' && d.startCount ? d.startCount : defaultStartCount(c, d, fs.asked || fs.have)); }
        return render();
      }
      if (n === 'mixKind') { read(); d.mixUser = true; if (d.fertAuto && d.cropId) d.fert = baseFertPlan(d.cropId, mixDraftC(c, d), d.from, d.to, d.sowDate); return render(); }
      if (e.target.dataset.slot) {
        const file = e.target.files[0]; if (!file) return;
        read(); d.newPhotos[e.target.dataset.slot] = await compress(file); delete d.removePhotos[e.target.dataset.slot]; render();
      }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault(); read();
      if (!d.cropId) return alert('Choose a crop first.');
      if (!(d.to > d.from)) return alert('“To” must be more than “From”.');
      if (d.from < 0 || d.to > L + 0.01) return alert(`Section must be within 0–${L} cm.`);
      if (d.layout === 'free' && !(d.positions || []).length) {
        const n = Draw.count(c, Object.assign({}, d, { layout: 'rows', rows: num(d.rows), rowSp: num(d.rowSp), plantSp: num(d.plantSp), thinSp: num(d.thinSp) }));
        if (n > Draw.MAX_ARRANGE) return alert(`That's about ${n.toLocaleString('en-AU')} plants — too many to place one by one. Choose rows or another layout.`);
      }
      if (d.sowDate > todayStr()) {
        const hd = d.harvestDate && d.harvestDate > d.sowDate ? d.harvestDate : addDays(d.sowDate, 60);
        const occ = occupants(c.id, d.from, d.to, d.sowDate, hd, p && p.id);
        if (occ.length && !await confirmBox(`${occ.map(x => `<b>${esc(crop(x.cropId).en)}</b> (${x.from}–${x.to} cm) ${isPlanned(x) ? `is planned there from ${shortDate(x.sowDate)}` : `will probably be there until about ${shortDate(endOf(x))}`}`).join('<br>')}.<br>Save the plan anyway?`, 'Save plan')) return;
      } else {
        // sharing space is up to you: seedlings you're planting out go where you put them; anything else asks once
        const clash = activeIn(c.id).find(x => (!p || x.id !== p.id) && x.from < d.to - 0.01 && x.to > d.from + 0.01);
        if (clash && !d.startId && !d.useStart && !await confirmBox(`<b>${esc(crop(clash.cropId).en)}</b> is already growing there (${clash.from}–${clash.to} cm).<br>Plant here too?`, 'Plant here too')) return;
      }
      await savePlanting(p, d, c);
    });
  };
  return { html, after };
}
async function savePlanting(p, d, c) {
  const isNew = !p;
  if (isNew) { p = { id: uid(), containerId: c.id, status: 'active', created: todayStr(), thinned: false, photos: {} }; S.plantings.push(p); }
  const fields = ['cropId', 'variety', 'method', 'layout', 'dir', 'sowDate', 'thinStage', 'thinDate', 'harvestDate', 'notes'];
  for (const k of fields) p[k] = d[k] || '';
  if (d.thinUser) p.thinFixed = !!d.thinDate;
  if (d.hvUser) p.harvestFixed = !!d.harvestDate;
  p.daysFrom = num(d.daysFrom); p.daysTo = num(d.daysTo); p.keepUntil = d.keepUntil || '';
  saveMixChoice(p, d, c);
  if (isNew || p.status === 'planned') p.status = p.sowDate > todayStr() ? 'planned' : 'active';
  p.raise = p.status === 'planned' && p.method === 'seedling' ? (linkedStart(p) ? 'tray' : d.raise === 'pot' ? 'tray' : d.raise || 'buy') : (p.raise || '');   // linked to seedlings you started: sown from seed
  const oldFrom = isNew ? null : p.from, oldTo = isNew ? null : p.to;
  for (const k of ['from', 'to', 'depth', 'rowSp', 'plantSp', 'rows', 'thinSp', 'spread']) p[k] = num(d[k]);
  if (!isNew && p.status === 'active') noteVacated(p, oldFrom, oldTo);
  if (p.method !== 'seed') { p.depth = null; p.thinSp = null; p.thinDate = ''; p.thinStage = ''; }
  p.fert = (d.fert || []).filter(f => f.product || f.amount).map(f => ({ product: f.product, amount: num(f.amount), unit: f.unit || 'g' }));
  const oldSeries = p.series || [];
  p.series = (d.series || []).filter(s => s.product || s.amount || s.title).map(s => {
    const o = oldSeries.find(x => x.id === s.id) || {};
    return Object.assign(o, { id: s.id || uid(), title: s.title || '', product: s.product, amount: num(s.amount), unit: s.unit || 'mL', every: +s.every || 0, per: s.per || 'week', start: s.start || p.sowDate, end: s.end || '', customTitle: o.customTitle && s.product === o.product ? o.customTitle : '' });
  });
  if (isNew) {
    const cj = careJobs(p.cropId);
    cj.forEach((j, i) => { if (d.sj && d.sj[i] === false) return; const am = jobAmount(j, c, p); p.series.push({ id: uid(), title: j[0], product: am.product, amount: am.amount, unit: am.unit, every: j[2] || 0, per: j[3] || 'week', start: careJobStart(p, j), end: /Pest check|^Side-dress$/.test(j[0]) && p.harvestDate && FRUITING.includes(p.cropId) === false ? p.harvestDate : '' }); });
  }
  if ((isNew || d.startCount) && p.layout === 'free' && (d.positions || []).length) p.positions = d.positions.map(q => q.slice());   // placed for you (e.g. seedlings planted out), or dragged on the form
  if (p.layout === 'free' && !(p.positions || []).length) p.positions = Draw.layout(c, Object.assign({}, p, { layout: 'rows' })).pts;
  // photos
  p.photos = p.photos || {};
  for (const slot of ['front', 'back']) {
    const old = p.photos[slot];
    let want = d.removePhotos[slot] ? null : (d.photos || {})[slot] || null;
    if (d.newPhotos[slot]) { want = uid(); await DB.putPhoto(want, d.newPhotos[slot]); }
    if (want) p.photos[slot] = want; else delete p.photos[slot];
    if (old && old !== want) await dropPhoto(old);
  }
  rememberSeed(p);   // a variety (or packet) you hadn't listed joins your seeds
  if (isNew) linkStartOnSave(d, p); else planStartOnSave(d, p);
  if (isNew && d.startId) startPlanted(d, p);
  syncTasks(p);
  await save();
  setDraft(null);
  if (isNew) location.replace('#/plant/' + p.id); else history.back();
}

// ---------- re-using seed packet photos ----------
function packets(excludeKey) {
  const seen = new Map();
  for (const s of seedList()) {   // your seed library first
    if (!s.front && !s.back) continue;
    const key = (s.front || '') + '|' + (s.back || ''); if (key === excludeKey) continue;
    seen.set(key, { key, front: s.front, back: s.back, cropId: s.cropId, variety: s.variety || '', uses: [] });
  }
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

// choosing a variety from your seeds brings its packet photos (unless this planting has its own)
export function packetForVariety(d) {
  const s = d.cropId && seedFor(d.cropId, d.variety), ph = d.photos || {};
  if (!s || (!s.front && !s.back) || ph.front || ph.back || Object.keys(d.newPhotos || {}).length) return false;
  d.photos = Object.assign({}, ph, s.front ? { front: s.front } : {}, s.back ? { back: s.back } : {});
  return true;
}
