/* Feeding, reworked: one ledger per crop — starting soil, what the previous crop left, base fertiliser, and every feeding since.
   Every feeding is stored once in the log (kind 'fert'); tasks with a fertiliser ask what you actually used when ticked. */
'use strict';

// ---------- products & potting mixes ----------
if (!PRODUCTS.some(p => p.id === 'kasei888')) PRODUCTS.push({ id: 'kasei888', kind: 'fert', en: 'Chemical fertiliser 8-8-8', ja: '化成肥料 8-8-8', maker: 'generic', organic: false, wait: 0, top: true, npk: '8-8-8',
  what: 'Balanced quick-release granular fertiliser', notes: ['Fast-acting: plants can use nearly all of it this season.', 'Mix it well into the soil as base fertiliser; as a side-dressing keep it a few cm from stems.', 'Not allowed in organic (JAS) growing.'] });
function migrateFeed() { if (Array.isArray(S.myProducts) && !S.kaseiAdded) { if (!S.myProducts.includes('kasei888')) S.myProducts.push('kasei888'); S.kaseiAdded = true; } }
NPK.kasei888 = [8, 8, 8, 1];
const MIXES = [['iris', 'Iris Ohyama Golden Granular Soil', 'アイリスオーヤマ ゴールデン粒状培養土'], ['touikawa', 'Touikawa Peace Farm vegetable soil', 'おいしい野菜を育てる土'], ['other', 'Other potting mix', '培養土']];
const MIX_N = 0.12;          // g N per litre of fresh 元肥入り potting mix (typical; check the bag)
const DENS = { compost: 0.5, lime: 0.9, fert: 0.6 };   // g per mL for solids measured by volume

// ---------- amounts ----------
function feedGrams(amount, unit, name) {
  const a = +amount; if (!(a > 0)) return 0;
  const pr = productByName(name || ''), d = pr ? (DENS[pr.kind] || 0.6) : (/液|liquid/i.test(name || '') ? 0 : 0.6);
  return unit === 'kg' ? a * 1000 : unit === 'handful' ? a * HANDFUL_G : unit === 'L' ? a * 1000 * d : unit === 'mL' ? a * d : a;
}
// usable nitrogen (g) from an amount of a product this season
function usableN(g, name, seasons = 0) {
  const npk = npkOf(name); if (!npk) return null;
  const avail = seasons > 0 ? (npk[3] < 0.2 ? 0.05 : 0) : npk[3];   // compost keeps releasing slowly in later seasons
  return g * npk[0] / 100 * avail;
}
const NAME_N = 'nitrogen';
// space a crop occupies, in m² (bags: a "soil-volume" equivalent, since pots need more per area)
function feedArea(c, p) { if (c.type === 'bed') return Draw.dims(c).W * ((p ? p.to - p.from : Draw.dims(c).L)) / 1e4; return Math.max(areaOf(c), (potVolume(c) || 40) / 150); }
const gN = v => v >= 10 ? Math.round(v) + ' g' : (Math.round(v * 10) / 10) + ' g';

// ---------- potting mix in bags ----------
function mixState(c, beforeDate) {
  if (c.type === 'bed') return null;
  const ev = (c.mixLog || []).filter(e => !beforeDate || e.date <= beforeDate).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  if (!ev) return null;
  const cropsSince = [...S.plantings.filter(p => p.containerId === c.id && p.sowDate && p.sowDate >= ev.date && (!beforeDate || p.sowDate < beforeDate)), ...(c.history || []).filter(h => h.sowDate && h.sowDate >= ev.date && (!beforeDate || h.sowDate < beforeDate) && !S.plantings.some(p => p.id === h.plantingId))];
  return Object.assign({}, ev, { firstCrop: ev.fresh && !cropsSince.length, mix: MIXES.find(m => m[0] === ev.kind) || MIXES[2] });
}
function mixDialog(c) {
  const td = todayStr(), cur = mixState(c);
  modal(`<h3>Potting mix — ${esc(c.name)}</h3><form id="mxf" class="form">
      <label>Mix<select name="kind">${MIXES.map(([k, en, ja]) => `<option value="${k}"${(cur ? cur.kind : 'iris') === k ? ' selected' : ''}>${esc(en)} ${esc(ja)}</option>`).join('')}</select></label>
      <div class="seg"><button type="button" data-f="1" class="on">Fresh mix</button><button type="button" data-f="0">Re-used (roots sieved out)</button></div>
      <label>Filled on<input name="date" type="date" value="${td}" max="${td}"></label>
      <p class="hint">Fresh 元肥入り potting mix carries starter fertiliser for roughly the first month of the first crop — the app counts it then, and suggests no extra base fertiliser. Re-used mix gets compost + 8-8-8 suggested.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>
    ${(c.mixLog || []).length ? `<ul class="plist">${c.mixLog.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(e => `<li><span class="grow">${shortDate(e.date)} ${yearOfD(e.date)} · ${e.fresh ? 'fresh' : 're-used'} ${esc((MIXES.find(m => m[0] === e.kind) || MIXES[2])[1])}</span><button class="link danger" data-delmix="${e.id}">remove</button></li>`).join('')}</ul>` : ''}`, (m, close) => {
    const f = m.querySelector('#mxf'); let fresh = true;
    m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { fresh = b.dataset.f === '1'; m.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-delmix]').forEach(b => b.onclick = async () => { c.mixLog = c.mixLog.filter(e => e.id !== b.dataset.delmix); await save(); close(); render(); });
    f.onsubmit = async e => { e.preventDefault(); (c.mixLog = c.mixLog || []).push({ id: uid(), date: f.date.value || td, kind: f.kind.value, fresh }); await save(); close(); render(); };
  });
}

// ---------- previous crops in the same space (incl. crops that have since been moved to another part of the bed) ----------
function spanTraces(c) {
  return S.plantings.filter(p => p.containerId === c.id).flatMap(p => (p.prevSpans || []).map(s => ({ plantingId: p.id + ':' + s.until, cropId: p.cropId, from: s.from, to: s.to, sowDate: p.sowDate, harvestedOn: s.until, trace: true })));
}
function noteVacated(p, oldFrom, oldTo) {
  if (oldFrom == null || oldTo == null || (p.from <= oldFrom && p.to >= oldTo)) return;
  const td = todayStr(), parts = [];
  if (oldFrom < p.from) parts.push([oldFrom, Math.min(oldTo, p.from)]);
  if (oldTo > p.to) parts.push([Math.max(oldFrom, p.to), oldTo]);
  for (const [a, b] of parts) if (b - a >= 1) (p.prevSpans = p.prevSpans || []).push({ from: a, to: b, until: td });
}

// ---------- the ledger ----------
function feedLedger(p) {
  const c = container(p.containerId); if (!c || !p.sowDate) return null;
  const td = todayStr(), bag = c.type !== 'bed', A2 = feedArea(c, p), bedA = feedArea(c), lines = [];
  const need = N_NEED[p.cropId] ? N_NEED[p.cropId] * A2 : null;
  // 1. starting soil
  if (bag) {
    const ms = mixState(c, p.sowDate);
    if (ms && ms.firstCrop) lines.push({ g: 'soil', label: `Fresh potting mix (${ms.mix[1]}, filled ${shortDate(ms.date)})`, n: MIX_N * (potVolume(c) || 40) * 0.5, note: 'starter fertiliser in the mix — lasts about a month' });
    else lines.push({ g: 'soil', label: ms ? `Re-used potting mix (${ms.mix[1]})` : 'Potting mix (no fill date recorded)', n: 0.3, note: ms ? 'little left after the last crop' : 'add the mix and fill date for a better estimate' });
  } else lines.push({ g: 'soil', label: 'The bed’s own soil', n: 6 * A2, note: 'slow release from soil organic matter over a season (rough)' });
  // 2. what the previous crop left
  const prev = lastCropIn(c, p.from, p.to, p.sowDate, p.id);
  if (prev) {
    const pf = feedOf(prev.cropId, prev), pp = prev.plantingId && planting(String(prev.plantingId).split(':')[0]);
    let n = 0, note = '';
    if (pf === 'legume') { n = 2 * A2; note = 'legumes leave nitrogen in their roots'; }
    else if (pp && pp.id !== p.id) { const L = feedLedger(Object.assign({}, pp, { status: 'active' })); if (L && L.need && L.applied > L.need) { n = (L.applied - L.need) * 0.3 * (A2 / feedArea(c, pp)); note = 'some of what it was fed but didn’t use'; } else note = pf === 'heavy' ? 'a heavy feeder — little left' : 'used what it was given'; }
    else note = pf === 'heavy' ? 'a heavy feeder — little left' : pf === 'light' ? 'a light feeder' : 'no feeding records for it';
    lines.push({ g: 'prev', label: `Previous crop: ${crop(prev.cropId).en}`, n, note });
  }
  // compost from earlier crops in the same space (keeps releasing for a couple of years)
  let oldComp = 0;
  for (const q of S.plantings) if (q.id !== p.id && q.containerId === c.id && q.sowDate && q.sowDate < p.sowDate && q.sowDate >= addDays(p.sowDate, -730) && q.from < p.to - 0.5 && q.to > p.from + 0.5)
    for (const f of q.fert || []) { const pr = productByName(f.product); if (pr && pr.kind === 'compost') oldComp += (usableN(feedGrams(f.amount, f.unit, f.product), f.product, 1) || 0) * (A2 / feedArea(c, q)); }
  if (oldComp > 0.05) lines.push({ g: 'prev', label: 'Compost dug in for earlier crops', n: oldComp, note: 'still releasing slowly' });
  // 3. base fertiliser at planting
  for (const f of p.fert || []) { if (!f.product) continue; const n = usableN(feedGrams(f.amount, f.unit, f.product), f.product); lines.push({ g: 'base', label: `${f.product} ${fmtAmt(f.amount, f.unit)}`, n, date: p.sowDate, note: n == null ? 'unknown analysis — not counted' : productByName(f.product) && productByName(f.product).kind === 'compost' ? 'compost: only ~10% of its nitrogen this season' : '' }); }
  // 4. every feeding since (log), shared feedings split by area
  const from = addDays(p.sowDate, -21), end = p.status === 'harvested' ? (p.harvestedOn || td) : td;
  for (const e of S.log || []) {
    if (e.kind !== 'fert' || !e.product || e.date < from || e.date > end) continue;
    const pids = e.pids || [], cids = e.cids || [], n = pids.length + cids.length || 1, g = feedGrams(e.amount, e.unit, e.product) / (e.per === 'total' ? n : 1);
    let share = 0;
    if (pids.includes(p.id)) share = 1; else if (cids.includes(c.id)) share = A2 / bedA; else if (!pids.length && !cids.length) share = A2 / bedA;
    if (!share) continue;
    const un = usableN(g * share, e.product);
    lines.push({ g: 'fed', label: `${e.product} ${fmtAmt(e.amount, e.unit)}${share < 0.999 ? ` (whole ${bag ? 'pot' : 'bed'} — ${Math.round(share * 100)}% here)` : ''}`, n: un, date: e.date, logId: e.id, note: un == null ? 'unknown analysis — not counted' : '' });
  }
  // older records: ticked fertiliser jobs that weren't logged separately
  for (const s of p.series || []) {
    if (!s.product || s.amount == null) continue;
    for (const t of S.tasks) if (t.seriesId === s.id && t.done && t.doneOn && !t.logId) lines.push({ g: 'fed', label: `${s.product} ${fmtAmt(s.amount, s.unit)}`, n: usableN(feedGrams(s.amount, s.unit, s.product), s.product), date: t.doneOn });
  }
  const sum = gs => lines.filter(l => gs.includes(l.g)).reduce((a, l) => a + (l.n || 0), 0);
  const applied = sum(['base', 'fed']), total = sum(['soil', 'prev', 'base', 'fed']);
  // planned feedings still to come
  const planned = S.tasks.filter(t => t.plantingId === p.id && !t.done && (t.product || (t.seriesId && ((p.series || []).find(s => s.id === t.seriesId) || {}).product))).map(t => {
    const s = (p.series || []).find(x => x.id === t.seriesId) || t; return { t, n: usableN(feedGrams(s.amount, s.unit, s.product), s.product) || 0, text: `${s.product} ${fmtAmt(s.amount, s.unit)}` };
  });
  return { c, bag, area: A2, need, lines, applied, total, planned, plannedN: planned.reduce((a, x) => a + x.n, 0) };
}
function feedVerdict(L, p) {
  if (!L.need) return '';
  const sr = soilReadingAdvice(L.c, p.from, p.to, p.cropId);
  if (sr && sr.feed < 1) return 'Your meter shows <b>salt DANGER</b> — hold off feeding and water through well.';
  const r = L.total / L.need, rp = (L.total + L.plannedN) / L.need;
  if (r > 1.6) return 'That’s <b>plenty</b> — skip further feeding (too much gives soft, pest-prone growth).';
  if (r >= 0.9) return 'About right for the whole season.';
  if (rp >= 0.9) return 'Short for now, but your planned side-dressings should cover it.';
  const late = p.harvestDate && p.sowDate && todayStr() > addDays(p.sowDate, Math.round(daysBetween(p.sowDate, p.harvestDate) * 0.75));
  if (late) return `On the light side (about ${gN(L.need - L.total - L.plannedN)} short), but it’s late in the season — extra feeding now won’t change much. Worth feeding the next crop here a bit more.`;
  return `<b>Short</b> by about ${gN(L.need - L.total - L.plannedN)} ${NAME_N} over the season — plan a side-dressing.`;
}
function feedBar(L) {
  if (!L.need) return '';
  const pc = x => Math.min(100, x / L.need * 100);
  return `<div class="fbar"><i class="have" style="width:${pc(L.total)}%"></i><i class="plan" style="left:${pc(L.total)}%;width:${Math.max(0, pc(L.total + L.plannedN) - pc(L.total))}%"></i></div>`;
}
function feedingSection(p) {
  const L = feedLedger(p); if (!L) return '';
  A.feedNow = () => feedDialog({ pids: [p.id] });
  A.editFeed = el => feedDialog((S.log || []).find(e => e.id === el.dataset.id));
  A.addSideDress = async () => {
    const top = pick(L.bag ? ['kasei888', 'bokashi', 'toshoAburakasu'] : ['bokashi', 'toshoAburakasu', 'chickenManure', 'aburakasu']) || PRODUCTS.find(x => x.id === 'bokashi');
    const short = Math.min(L.need * 0.3, Math.max(0.3, L.need - L.total - L.plannedN)), g = short / ((NPK[top.id] || [4])[0] / 100 * ((NPK[top.id] || [0, 0, 0, 0.7])[3] || 0.7));
    const amt = L.bag ? Math.max(5, Math.round(g / 5) * 5) : Math.max(0.5, Math.round(g / HANDFUL_G * 2) / 2), unit = L.bag ? 'g' : 'handful';
    S.tasks.push({ id: uid(), plantingId: p.id, kind: 'feed', title: `Side-dress (追肥): ${top.en} ${fmtAmt(amt, unit)}`, product: top.en, amount: amt, unit, due: addDays(todayStr(), 3), done: false });
    await save(); render();
  };
  const grp = { soil: 'Starting soil', prev: 'Left from before', base: 'At planting', fed: 'Fed since' };
  const rows = Object.keys(grp).map(k => { const ls = L.lines.filter(l => l.g === k); return ls.length ? `<tr class="fg"><th colspan="2">${grp[k]}</th></tr>${ls.map(l => `<tr${l.logId ? ` data-act="editFeed" data-id="${l.logId}"` : ''}><td>${l.date ? `<small>${shortDate(l.date)}</small> ` : ''}${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</td><td>${l.n == null ? '—' : gN(l.n)}</td></tr>`).join('')}` : ''; }).join('');
  const nextUp = L.planned.sort((a, b) => (a.t.due < b.t.due ? -1 : 1))[0];
  return `<section class="feeding"><h3>Feeding</h3>
    <p class="small">${L.need ? `${esc(crop(p.cropId).en)} needs about <b>${gN(L.need)}</b> of ${NAME_N} over the season ${L.bag ? 'in this pot' : `in this ${L.area.toFixed(1)} m² section`}. Counted so far: <b>${gN(L.total)}</b>${L.plannedN ? ` + ${gN(L.plannedN)} planned` : ''}.` : `Counted so far: <b>${gN(L.total)}</b> of ${NAME_N}.`}</p>
    ${feedBar(L)}<p class="small">${feedVerdict(L, p)}${nextUp ? ` Next: <b>${esc(nextUp.text)}</b> ${shortDate(nextUp.t.due)}.` : ''}</p>
    <details class="fold inner"><summary>What’s been counted</summary><table class="ledger">${rows}</table>
      <p class="hint">Nitrogen (N) is the nutrient leafy growth uses most; these are grams plants can actually use this season, worked out from each product’s analysis. Compost and manure release most of theirs over later seasons, so only part counts now. All rough — trust how the plants look.</p></details>
    <div class="btnrow"><button class="btn small primary" data-act="feedNow">🌿 Record feeding</button>${L.need && L.total + L.plannedN < L.need * 0.9 && isLive(p) && !(p.harvestDate && todayStr() > addDays(p.sowDate, Math.round(daysBetween(p.sowDate, p.harvestDate) * 0.75))) ? '<button class="btn small" data-act="addSideDress">＋ Plan a side-dressing</button>' : ''}</div></section>`;
}
function bedFeedingSection(c) {
  const ps = activeIn(c.id); if (!ps.length) return '';
  A.feedBed = () => feedDialog({ cids: [c.id] });
  A.mix = () => mixDialog(c);
  const ms = c.type !== 'bed' ? mixState(c) : null;
  return `<section class="feeding"><h3>Feeding</h3>
    ${c.type !== 'bed' ? `<p class="small">🪴 ${ms ? `${ms.fresh ? 'Fresh' : 'Re-used'} ${esc(ms.mix[1])} since ${shortDate(ms.date)}` : 'Potting mix not recorded'} <button class="link" data-act="mix">${ms ? 'refilled?' : 'add'}</button></p>` : ''}
    ${ps.map(p => { const L = feedLedger(p); return L ? `<a class="feedrow" href="#/plant/${p.id}">${ic(p.cropId)}<span class="grow"><b>${esc(crop(p.cropId).en)}</b>${feedBar(L)}<small>${gN(L.total)}${L.need ? ` of ~${gN(L.need)}` : ''} ${NAME_N}${L.plannedN ? ` · ${gN(L.plannedN)} planned` : ''}</small></span>›</a>` : ''; }).join('')}
    <div class="btnrow"><button class="btn small primary" data-act="feedBed">🌿 Record feeding (whole ${c.type === 'bed' ? 'bed' : 'pot'})</button></div></section>`;
}

// ---------- record a feeding ----------
function feedDialog(e, onSave, onCancel) {
  const isNew = !e || !e.id, td = todayStr();
  e = Object.assign({ date: td, kind: 'fert', product: '', amount: '', unit: 'handful', per: 'each', cids: [], pids: [] }, e || {});
  const prods = myProducts(['fert', 'compost', 'lime']), names = [...new Set([...prods.map(x => x.en), ...(S.log || []).filter(x => x.kind === 'fert').map(x => x.product).filter(Boolean)])];
  const targets = [...(e.cids || []).map(id => (container(id) || {}).name), ...(e.pids || []).map(id => { const p = planting(id); return p ? crop(p.cropId).en + ' · ' + ((container(p.containerId) || {}).name || '') : ''; })].filter(Boolean).join(', ') || 'Whole garden';
  modal(`<h3>🌿 ${isNew ? 'Record feeding' : 'Edit feeding'}</h3><p class="muted small">${esc(targets)}</p><form id="fdf" class="form">
      <div class="sowchips">${prods.map(x => `<button type="button" class="chip${e.product === x.en ? ' on' : ''}" data-p="${esc(x.en)}">${esc(x.en)}</button>`).join('')}</div>
      <label>Product<input name="product" list="fdl" value="${esc(e.product || '')}" required placeholder="e.g. Bokashi, 化成肥料 8-8-8"><datalist id="fdl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <div class="two"><label>Amount<input name="amount" type="number" inputmode="decimal" step="any" value="${e.amount ?? ''}" required></label><label>Unit<select name="unit">${unitOpts(e.unit || 'handful')}</select></label></div>
      <label>Date<input name="date" type="date" value="${e.date}" max="${td}"></label>
      <p class="hint" id="fdn"></p>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#fdf');
    const calc = () => { const g = feedGrams(f.amount.value, f.unit.value, f.product.value), n = usableN(g, f.product.value);
      m.querySelector('#fdn').innerHTML = !g ? (f.unit.value === 'mL' || f.unit.value === 'L') && /液|liquid/i.test(f.product.value) ? 'Liquid feeds are too dilute to count here.' : '' : n == null ? `≈ ${Math.round(g)} g — analysis unknown, so it isn’t counted (put the N-P-K in the name, e.g. “Hyponex 6-10-5”).` : `≈ ${Math.round(g)} g → about <b>${gN(n)}</b> usable ${NAME_N} this season.`; };
    m.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { f.product.value = b.dataset.p; m.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b)); const pr = productByName(b.dataset.p); if (pr && pr.kind === 'compost' && f.unit.value === 'handful') f.unit.value = 'L'; calc(); });
    f.addEventListener('input', calc); calc();
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = () => { close(); onCancel && onCancel(); };
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { S.log = S.log.filter(x => x.id !== e.id); for (const t of S.tasks) if (t.logId === e.id) t.logId = null; await save(); close(); render(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const pr = productByName(f.product.value.trim());
      Object.assign(e, { product: f.product.value.trim(), productId: pr ? pr.id : null, amount: num(f.amount.value), unit: f.unit.value, date: f.date.value || td });
      if (isNew) { e.id = uid(); (S.log = S.log || []).push(e); }
      onSave && onSave(e);
      await save(); close(); render();
    };
  });
}
// ticking a job that has a fertiliser: ask what was actually used (it becomes the record)
function feedTaskProduct(t) {
  if (t.product) return { product: t.product, amount: t.amount, unit: t.unit };
  const p = t.plantingId && planting(t.plantingId), s = p && t.seriesId && (p.series || []).find(x => x.id === t.seriesId);
  return s && s.product ? { product: s.product, amount: s.amount, unit: s.unit } : null;
}
function tickFeedTask(t) {
  const f = feedTaskProduct(t), td = todayStr();
  const preset = Object.assign({ date: t.due && t.due < td ? t.due : td }, f, t.plantingId ? { pids: [t.plantingId] } : { cids: [t.containerId] });
  feedDialog(preset, entry => { finishToggle(t, true, entry.date); t.logId = entry.id; }, () => render());
}
