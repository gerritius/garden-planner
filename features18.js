/* Feeding planner: the one place to schedule fertiliser — crop-stage doses, extra doses to close the gap, your own doses,
   and repeating feeds (e.g. weekly liquid). Nothing that would overfeed is scheduled. Liquid feeds for outdoor bags
   are folded into the watering job when they're due. */
'use strict';

const CEILING = 1.25;   // stop feeding once nitrogen would pass 125% of the crop's season need
const ceilingN = L => L.need ? L.need * CEILING : Infinity;
function doseOf(name, nPerDose, bag) {
  const npk = npkOf(name); if (!npk || !npk[0]) return null;
  if (isLiquid(name)) { const mL = nPerDose / (1.2 * npk[0] / 100); return { amount: Math.max(1, Math.round(mL)), unit: 'mL' }; }
  const g = nPerDose / (npk[0] / 100 * (npk[3] || 0.7));
  if (bag) return { amount: Math.max(2, Math.round(g)), unit: 'g' };
  return g >= 15 ? { amount: Math.max(0.5, Math.round(g / HANDFUL_G * 2) / 2), unit: 'handful' } : { amount: Math.max(5, Math.round(g / 5) * 5), unit: 'g' };
}
const effOf = (name, amount, unit) => usable3(feedGrams(amount, unit, name), name) || { n: 0, p: 0, k: 0 };
const isPotOutdoor = c => c && c.type !== 'bed' && !c.indoor;
function feedEnd(p) { const w = p.harvestDate ? harvestWindow(p) : null; return w ? (crop(p.cropId).cont ? w.keep : w.mature) : addDays(p.sowDate, 120); }

// ---------- repeating feeds ----------
// outdoors, no feeding while it's too cold for roots to take it up — the schedule picks up again when growth restarts
const dormant = (p, d) => { const c = container(p.containerId); return !(c && c.indoor) && normalT(d) < restartTemp(p.cropId); };
function schedOccurrences(p, s, fromDate) {
  const out = [], end = s.end || feedEnd(p);
  for (let d = fromDate || (s.last ? addDays(s.last, s.every) : s.start), i = 0; d <= end && i < 80; d = addDays(d, s.every), i++) if (!dormant(p, d)) out.push(d);
  return out;
}
// planned (future) doses from repeating feeds, beyond the one already waiting as a job — for the ledger
function schedPlanned(p) {
  const out = [];
  for (const s of p.feedPlan || []) {
    if (s.stopped || s.paused) continue;
    const open = S.tasks.find(t => t.schedId === s.id && !t.done), e = effOf(s.product, s.amount, s.unit);
    const ds = schedOccurrences(p, s).filter(d => !open || d > open.due);
    for (const d of ds) out.push({ t: { due: d }, n: e.n, p: e.p, k: e.k, text: `${s.product} ${fmtAmt(s.amount, s.unit)} (every ${s.every} days)` });
  }
  return out;
}
// keep one job waiting for each repeating feed; stop when the crop has enough or the meter shows salt DANGER
function syncFeedPlans() {
  const td = todayStr();
  for (const p of S.plantings) {
    if (!(p.feedPlan || []).length) continue;
    const live = isLive(p);
    for (const s of p.feedPlan) {
      let open = S.tasks.find(t => t.schedId === s.id && !t.done);
      if (!live || s.stopped) { if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
      let next = s.last ? addDays(s.last, s.every) : s.start; const end = s.end || feedEnd(p);
      if (dormant(p, next < td ? td : next)) next = nextGrowing(p.cropId, next < td ? td : next);
      if (next > end) { if (open) S.tasks = S.tasks.filter(x => x !== open); s.done = true; continue; }
      const L = feedLedger(p), c = container(p.containerId), e = effOf(s.product, s.amount, s.unit), sr = c && soilReadingAdvice(c, p.from, p.to, p.cropId);
      if ((L && L.need && L.total + e.n > ceilingN(L)) || (sr && sr.feed < 1)) { s.paused = sr && sr.feed < 1 ? 'salt' : 'enough'; if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
      s.paused = null;
      const title = `${isLiquid(s.product) ? 'Liquid feed' : 'Feed'}: ${s.product} ${fmtAmt(s.amount, s.unit)}`;
      const withWater = isLiquid(s.product) && isPotOutdoor(c);
      if (open) Object.assign(open, { due: next, title, withWater });
      else S.tasks.push({ id: uid(), plantingId: p.id, kind: 'feed', schedId: s.id, title, product: s.product, amount: s.amount, unit: s.unit, due: next, withWater, done: false });
    }
  }
}
function afterFeedTick(t, entry) {
  if (!t.schedId) return;
  const p = planting(t.plantingId), s = p && (p.feedPlan || []).find(x => x.id === t.schedId);
  if (s) s.last = entry.date;
}

// ---------- liquid feed + watering as one job ----------
function waterFeedsDue(waterDue) {
  const pots = new Set(waterPots().map(c => c.id));
  return S.tasks.filter(t => !t.done && t.withWater && t.kind === 'feed' && planting(t.plantingId) && pots.has(planting(t.plantingId).containerId) && t.due <= waterDue);
}
function earliestWaterFeed() {
  const pots = new Set(waterPots().map(c => c.id));
  return S.tasks.filter(t => !t.done && t.withWater && planting(t.plantingId) && pots.has(planting(t.plantingId).containerId)).map(t => t.due).sort()[0] || null;
}
// ticking the combined job records each liquid feed as given that day
function completeWaterFeeds(wt, date) {
  for (const id of wt.feeds || []) {
    const t = S.tasks.find(x => x.id === id && !x.done); if (!t) continue;
    const pr = productByName(t.product), e = { id: uid(), date, kind: 'fert', product: t.product, productId: pr ? pr.id : null, amount: t.amount, unit: t.unit, pids: [t.plantingId], cids: [], text: 'with watering' };
    (S.log = S.log || []).push(e); t.done = true; t.doneOn = date; t.logId = e.id; afterFeedTick(t, e);
  }
}

// ---------- the planner ----------
function feedPlanner(p) {
  const L = feedLedger(p); if (!L) return;
  const c = L.c, td = todayStr(), end = feedEnd(p), stages = sideStages(p);
  const short = Math.max(0, (L.need || 0) - L.total - L.plannedN);
  const perDose = Math.min((L.need || 4) * 0.15, Math.max(short / Math.max(1, stages.length), (L.need || 4) * 0.06));
  const prods = myProducts(['fert']).filter(x => (NPK[x.id] || [0])[0] > 0).sort((a, b) => (isPlenty(b.id) - isPlenty(a.id)) || (leadOf(a)[0] - leadOf(b)[0]));
  const used = [...new Set((S.log || []).filter(e => e.kind === 'fert' && npkOf(e.product) && !productByName(e.product)).map(e => e.product))];
  const names = [...prods.map(x => x.en), ...used];
  let main = prods[0] ? prods[0].en : names[0] || '';
  // rows: stage doses, then extra doses to close the gap
  const mkRow = (o) => Object.assign({ id: uid(), on: true, type: 'once', product: main }, o);
  const rows = stages.map(s => mkRow({ date: s.date, t: s.t, why: s.why, src: 'stage' }));
  const fill = () => {   // extra doses every ~3 weeks in growing weather until the gap is closed
    rows.splice(0, rows.length, ...rows.filter(r => r.src !== 'extra'));
    const dose = doseOf(main, perDose, L.bag); if (!dose || !L.need) return;
    const e = effOf(main, dose.amount, dose.unit); if (!e.n) return;
    let have = L.total + L.plannedN + rows.filter(r => r.on && r.type === 'once').reduce((a, r) => a + effOf(r.product, r.amount, r.unit).n, 0);
    const taken = rows.map(r => r.date);
    for (let d = addDays(td, 21), i = 0; d < addDays(end, -14) && have + e.n <= L.need * 1.02 && i < 8; d = addDays(d, 21), i++) {
      const g = nextGrowing(p.cropId, d); if (g >= addDays(end, -14)) break;
      if (taken.some(x => Math.abs(daysBetween(x, g)) < 14)) continue;
      rows.push(mkRow({ date: g, t: 'extra dose to cover the season', src: 'extra', product: main, ...dose })); taken.push(g); have += e.n;
    }
    rows.sort((a, b) => (a.type === 'every') - (b.type === 'every') || (a.date < b.date ? -1 : 1));
  };
  const setDoses = () => { for (const r of rows) if (r.type === 'once' && !r.manual) { r.product = main; Object.assign(r, doseOf(main, perDose, L.bag) || { amount: '', unit: 'g' }); const lead = leadOf(productByName(main))[0]; r.due = r.src === 'stage' && lead && addDays(r.date, -lead) > td ? addDays(r.date, -lead) : r.date; } };
  setDoses(); fill(); setDoses();
  // what's already planned (editable here)
  const existing = () => [
    ...S.tasks.filter(t => t.plantingId === p.id && !t.done && !t.schedId && feedTaskProduct(t)).map(t => ({ kind: 'task', id: t.id, text: `${shortDate(t.due)} · ${t.title}` })),
    ...(p.feedPlan || []).filter(s => !s.stopped && !s.done).map(s => ({ kind: 'sched', id: s.id, text: `Every ${s.every} days: ${s.product} ${fmtAmt(s.amount, s.unit)} (until ${shortDate(s.end || end)})${s.paused ? ` — paused: ${s.paused === 'salt' ? 'salt DANGER' : 'enough nitrogen for the season'}` : ''}` })),
  ];
  // run the plan forward in date order; anything that would pass the ceiling is left out
  const evaluate = () => {
    const ceil = ceilingN(L); let have = L.total + L.plannedN; const add = { n: 0, p: 0, k: 0 }, notes = {};
    const occ = [];
    for (const r of rows) { if (!r.on) continue; if (r.type === 'once') occ.push([r.due || r.date, r]); else for (const d of schedOccurrences(p, { start: r.date, every: +r.every || 7, end: r.until || end })) occ.push([d, r]); }
    occ.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    for (const r of rows) { r.count = 0; r.over = 0; r.big = false; r.lastOk = null; }
    const maxDose = L.need ? L.need * 0.3 : Infinity;   // more than this at once scorches roots, however short the crop is
    for (const [d, r] of occ) { const e = effOf(r.product, r.amount, r.unit); if (e.n > maxDose) { r.big = true; r.over++; continue; } if (have + e.n > ceil) { r.over++; continue; } have += e.n; add.n += e.n; add.p += e.p; add.k += e.k; r.count++; r.lastOk = d; }
    return { add, have, notes };
  };
  const rowHTML = r => {
    const e = effOf(r.product, r.amount, r.unit), lead = leadOf(productByName(r.product));
    return `<div class="frow${r.on ? '' : ' off'}${r.over && !r.count ? ' over' : ''}" data-r="${r.id}">
      <label class="inl"><input type="checkbox" data-f="on"${r.on ? ' checked' : ''}> <b>${r.type === 'every' ? `Every <input type="number" class="sm" data-f="every" value="${r.every || 7}" min="1"> days` : esc(r.t || 'Extra dose')}</b></label>
      <div class="fgrid"><input list="fpn" data-f="product" value="${esc(r.product || '')}"><input type="number" step="any" class="sm" data-f="amount" value="${r.amount ?? ''}"><select data-f="unit">${unitOpts(r.unit || 'g')}</select></div>
      <div class="fgrid2">${r.type === 'every' ? `from <input type="date" data-f="date" value="${r.date}"> until <input type="date" data-f="until" value="${r.until || end}">` : `on <input type="date" data-f="due" value="${r.due || r.date}">`}</div>
      <small>${r.amount ? `each → N ${gN(e.n)} · P ${gN(e.p)} · K ${gN(e.k)}` : ''}${r.big ? ' · <b>left out — too much in one go; split it into smaller doses</b>' : r.type === 'every' && r.on ? ` · ${r.count} dose${r.count === 1 ? '' : 's'}${r.over ? ` — stops after ${r.lastOk ? shortDate(r.lastOk) : 'the start'}: more would overfeed` : ''}` : r.over ? ' · <b>left out — this would overfeed</b>' : ''}${lead[0] && r.type === 'once' && !isLiquid(r.product) ? ` · ${esc(lead[1])}` : ''}</small>
      ${r.why ? `<small>⏸ ${esc(r.why)}</small>` : ''}${r.type === 'every' && isLiquid(r.product) && isPotOutdoor(c) ? '<small>💧 Given with the watering — on feed days the watering job becomes “Water + liquid feed”.</small>' : ''}
      ${r.src === 'custom' || r.type === 'every' ? `<button type="button" class="link danger" data-del="${r.id}">remove</button>` : ''}</div>`;
  };
  modal(`<h3>Feeding plan — ${esc(crop(p.cropId).en)}</h3>
    <div id="fpBars"></div><p class="small" id="fpSum"></p>
    <div id="fpExist"></div>
    <p class="small"><b>Main fertiliser</b> <span class="muted">— ☆ = you have plenty</span></p><div id="fpMain" class="sowchips"></div>
    <datalist id="fpn">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <form id="fpf" class="form"><div id="fpRows"></div>
      <div class="btnrow"><button type="button" class="btn small" data-x="addOnce">＋ One-off dose</button><button type="button" class="btn small" data-x="addEvery">＋ Repeating feed</button><button type="button" class="btn small" data-x="fill">↻ Re-suggest</button></div>
      <p class="hint">Suggestions from usual practice for ${esc(crop(p.cropId).en)} and its stage — your bag’s instructions win. Doses are kept to a normal size, and nothing is scheduled that would take nitrogen past about ${Math.round(CEILING * 100)}% of the crop’s need${L.need ? ` (${gN(ceilingN(L))})` : ''}. Liquid feeds: amounts are the concentrate you measure out.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save plan</button></div></form>`, (m, close) => {
    const f = m.querySelector('#fpf');
    const drawMain = () => { m.querySelector('#fpMain').innerHTML = names.map(n => { const pr = productByName(n);
      return `<span class="chip${n === main ? ' on' : ''}" data-main="${esc(n)}">${esc(n)} ${pr ? `<button type="button" class="link" data-star="${pr.id}">${isPlenty(pr.id) ? '★' : '☆'}</button>` : ''}</span>`; }).join('');
      m.querySelectorAll('[data-main]').forEach(ch => ch.onclick = e => { if (e.target.dataset.star) return; main = ch.dataset.main; setDoses(); fill(); setDoses(); draw(); drawMain(); });
      m.querySelectorAll('[data-star]').forEach(b => b.onclick = async e => { e.stopPropagation(); const id = b.dataset.star; S.plenty = isPlenty(id) ? S.plenty.filter(x => x !== id) : [...(S.plenty || []), id]; await save(); drawMain(); }); };
    const draw = () => {
      const ev = evaluate();
      m.querySelector('#fpBars').innerHTML = previewBars(L, ev.add);
      const total = ev.have, need = L.need;
      m.querySelector('#fpSum').innerHTML = need ? `With this plan: <b>${gN(total)}</b> of ~${gN(need)} nitrogen for the season${total < need * 0.9 ? ` — still ${gN(need - total)} short; add a dose or a repeating feed` : total > need * 1.1 ? ' — on the generous side' : ' — about right'}.` : '';
      const ex = existing();
      m.querySelector('#fpExist').innerHTML = ex.length ? `<p class="small"><b>Already planned</b></p><ul class="plist">${ex.map(x => `<li><span class="grow small">${esc(x.text)}</span><button type="button" class="link danger" data-rmx="${x.kind}:${x.id}">remove</button></li>`).join('')}</ul>` : '';
      m.querySelector('#fpRows').innerHTML = rows.map(rowHTML).join('') || '<p class="muted">No doses — add one below.</p>';
      m.querySelectorAll('[data-rmx]').forEach(b => b.onclick = async () => {
        const [k, id] = b.dataset.rmx.split(':');
        if (k === 'task') { const t = S.tasks.find(x => x.id === id); if (t && t.seriesId) { const s = (p.series || []).find(x => x.id === t.seriesId); if (s) s.stopped = true; } S.tasks = S.tasks.filter(x => x.id !== id); }
        else { const s = p.feedPlan.find(x => x.id === id); s.stopped = true; S.tasks = S.tasks.filter(x => !(x.schedId === id && !x.done)); }
        await save(); const L2 = feedLedger(p); Object.assign(L, L2); draw();
      });
    };
    m.querySelector('#fpRows').addEventListener('input', e => {
      const el = e.target, r = rows.find(x => x.id === (el.closest('[data-r]') || {}).dataset?.r); if (!r || !el.dataset.f) return;
      const k = el.dataset.f; r[k] = el.type === 'checkbox' ? el.checked : el.value; if (['product', 'amount', 'unit', 'due'].includes(k)) r.manual = true;
      if (k === 'every' || k === 'amount') r[k] = num(el.value);
      clearTimeout(m._t); m._t = setTimeout(() => { const pos = el.selectionStart; draw(); const again = m.querySelector(`[data-r="${r.id}"] [data-f="${k}"]`); if (again && el.type !== 'checkbox') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (er) { /* */ } } }, el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date' ? 0 : 500);
    });
    m.querySelector('#fpRows').addEventListener('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT' || e.target.type === 'date') { const r = rows.find(x => x.id === e.target.closest('[data-r]').dataset.r); r[e.target.dataset.f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; draw(); } });
    m.querySelector('#fpRows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; rows.splice(rows.findIndex(r => r.id === b.dataset.del), 1); draw(); });
    m.querySelector('[data-x=addOnce]').onclick = () => { rows.push(mkRow({ date: td, due: td, t: 'Extra dose', src: 'custom', manual: true, ...(doseOf(main, perDose, L.bag) || {}) })); draw(); };
    m.querySelector('[data-x=addEvery]').onclick = () => {
      const liq = names.find(n => isLiquid(n)) || main, nPer = Math.max(0.05, (L.need || 4) * 0.04);
      rows.push(mkRow({ type: 'every', every: 7, date: td, until: end, product: liq, src: 'custom', manual: true, ...(doseOf(liq, nPer, L.bag) || { amount: 5, unit: 'mL' }) })); draw();
    };
    m.querySelector('[data-x=fill]').onclick = () => { fill(); setDoses(); draw(); };
    m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault(); evaluate();
      for (const r of rows) {
        if (!r.on || !r.product || !r.amount) continue;
        if (r.type === 'once') { if (r.big || (r.over && !r.count)) continue;
          S.tasks.push({ id: uid(), plantingId: p.id, kind: 'feed', title: `Side-dress (追肥): ${r.product} ${fmtAmt(+r.amount, r.unit)}${r.t && r.src !== 'custom' ? ' — ' + r.t : ''}`, product: r.product, amount: +r.amount, unit: r.unit, due: r.due || r.date, done: false }); }
        else if (r.count && !r.big) (p.feedPlan = p.feedPlan || []).push({ id: uid(), product: r.product, amount: +r.amount, unit: r.unit, every: +r.every || 7, start: r.date, end: r.over ? r.lastOk : (r.until || end) });
      }
      syncFeedPlans(); await save(); close(); render();
    };
    drawMain(); draw();
  });
}
