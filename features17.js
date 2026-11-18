/* Side-dressing planner: when (crop stages, not during winter dormancy, not right before harvest), what with (your products,
   their effect and how early they need to go on), and how much — all as editable suggestions. */
'use strict';

// usual side-dressing (追肥) stages. d: days after planting (or thinning for sown crops); f: fraction of the way to harvest;
// w: tied to this planting's own winter — 'start' (as it sets in), 'mid' (a third of the way through), 'restart' (growth picks up), off: days from there.
// w-stages only apply to plantings that actually go through a winter; last: the last feed (止め肥) — nothing after it
const SIDE_STAGES = {
  hakusai: [{ d: 18, t: '2–3 weeks after planting / final thinning' }, { f: 0.5, t: 'as heads start to form (結球始め)' }],
  cabbage: [{ d: 25, t: '3–4 weeks after planting' }, { f: 0.55, t: 'as heads start to form (結球始め)' }],
  broccoli: [{ d: 21, t: '3 weeks after planting' }, { f: 0.65, t: 'when the buds appear' }], cauliflower: [{ d: 21, t: '3 weeks after planting' }, { f: 0.65, t: 'when the curd appears' }],
  daikon: [{ d: 5, t: 'at the last thinning (本葉5–6枚)' }, { d: 25, t: 'as roots start to thicken' }], kabu: [{ d: 5, t: 'after the last thinning' }], carrot: [{ d: 5, t: 'after thinning' }, { d: 30, t: 'as roots thicken' }],
  komatsuna: [{ d: 5, t: 'after thinning (only if leaves look pale)' }], chingensai: [{ d: 7, t: 'after thinning' }], mizuna: [{ d: 10, t: 'after thinning' }], spinach: [{ d: 7, t: 'after thinning' }],
  shungiku: [{ d: 10, t: 'after thinning, and after each cut' }], lettuce: [{ d: 18, t: '2–3 weeks after planting' }],
  onion: [{ w: 'mid', t: 'mid-winter — lightly' }, { w: 'restart', t: 'as growth restarts — the last feed (止め肥); none after it', last: true }],
  garlic: [{ w: 'start', t: 'as winter sets in' }, { w: 'restart', t: 'as growth restarts — the last feed (止め肥)', last: true }],
  naganegi: [{ d: 30, t: 'with the first earthing-up (土寄せ)' }, { d: 60, t: 'with the second earthing-up' }, { d: 90, t: 'with the third earthing-up' }],
  snappea: [{ w: 'restart', t: 'when growth restarts in spring' }, { f: 0.8, t: 'when flowering starts — lightly' }], sayaendo: [{ w: 'restart', t: 'when growth restarts in spring' }, { f: 0.8, t: 'at flowering — lightly' }],
  soramame: [{ w: 'restart', t: 'when growth restarts in spring' }], strawberry: [{ w: 'restart', t: 'as growth restarts' }],
  potato: [{ d: 25, t: 'when removing extra shoots (芽かき) and earthing up' }], corn: [{ d: 30, t: 'at 7–8 leaves' }, { d: 50, t: 'when tassels appear' }],
  edamame: [{ d: 30, t: 'at flowering — lightly, only if pale' }], ingen: [{ d: 30, t: 'at flowering' }],
};
const FRUIT_EVERY = ['tomato', 'minitomato', 'nasu', 'piman', 'shishito', 'chilli', 'kyuri', 'zucchini'];
// how early a product needs to go on before plants can use it, and how fast it works
const LEAD = { kasei888: [0, 'fast — works within days'], bokashi: [7, 'fairly fast — about a week'], toshoAburakasu: [7, 'fairly fast — about a week'], chickenManure: [10, 'medium — 1–2 weeks'],
  aburakasu: [21, 'slow — 2–3 weeks, slower in cold soil'], neem: [14, 'slow — about 2 weeks'], woodAsh: [0, 'fast (potash only)'] };
const leadOf = pr => { if (!pr) return [7, '']; const d = pr.lead != null ? pr.lead : (LEAD[pr.id] || [7])[0]; return [d, leadText(d)]; };

// growth restarts when the usual daily mean gets back above this
const restartTemp = id => WARM_LEAF.includes(id) ? 15 : growParams(id).tb === 0 ? 5 : 8;   // hardy crops (garlic, onion, spinach…) keep growing slowly through winter
function nextGrowing(id, d) { const thr = restartTemp(id); for (let i = 0; i < 200; i++) { if (normalT(addDays(d, i)) >= thr) return addDays(d, i); } return d; }
// Where this planting's season sits: does it go through a winter (growth stopped) before harvest?
// Overwintering crops are kept on the lean side going into winter (soft growth is frost-tender), and heading brassicas
// grown for spring (spring cabbage, overwintered broccoli/cauliflower) much more so: big plants in the cold bolt (トウ立ち)
// instead of heading. Their main feed is when growth restarts.
const BOLT_IF_BIG = ['cabbage', 'broccoli', 'cauliflower', 'hakusai'];
const _season = {};
function feedSeason(p) {
  if (!p || !p.sowDate) return null;
  const c = container(p.containerId); if (c && c.indoor) return null;
  const cr = crop(p.cropId), hv = p.harvestDate || addDays(p.sowDate, cr.daysHarvest || 60), k = [p.cropId, p.sowDate, hv].join('|');
  if (_season[k] !== undefined) return _season[k];
  // winter here = the usual daily mean below ~8 °C (15 °C for warm-season crops): growth all but stops
  const thr = WARM_LEAF.includes(p.cropId) ? 15 : 8;
  let ws = null; for (let d = p.sowDate; d < hv; d = addDays(d, 1)) if (normalT(d) < thr) { ws = d; break; }
  if (!ws) return (_season[k] = null);
  let we = ws; for (let i = 0; i < 200 && normalT(we) < thr; i++) we = addDays(we, 1);
  const bolt = BOLT_IF_BIG.includes(p.cropId);
  // lean stretch: heading brassicas from ~5 weeks before winter, others the last 3 weeks before it
  return (_season[k] = { ws, we, bolt, leanFrom: addDays(ws, bolt ? -35 : -21), leanTo: ws, mainAt: we });
}
const inLean = (se, d) => !!(se && d >= se.leanFrom && d < addDays(se.we, -7));
const stageAnchor = (se, w) => w === 'start' ? se.ws : w === 'mid' ? addDays(se.ws, Math.round(daysBetween(se.ws, se.we) / 3)) : se.we;
// the day a dose put on `due` starts working (organic feeds take a while)
const actsOn = (name, due) => addDays(due, leadOf(productByName(name || ''))[0] || 0);
const leanWhy = (p, se) => se.bolt
  ? `an overwintering ${crop(p.cropId).en.toLowerCase()} is kept small going into the cold — a big plant bolts (トウ立ち) in spring instead of heading`
  : 'soft new growth going into winter is easily frost-damaged';
function sideStages(p) {
  const td = todayStr(), cr = crop(p.cropId), hv = p.harvestDate || addDays(p.sowDate, cr.daysHarvest || 60), se = feedSeason(p), skipped = [];
  const start = p.method === 'seed' ? (p.thinDoneOn || p.thinDate || addDays(p.sowDate, 20)) : p.sowDate;
  let raw = [];
  if (FRUIT_EVERY.includes(p.cropId)) { const keep = (harvestWindow(p) || {}).keep || addDays(hv, 60); for (let d = addDays(hv, -10), i = 1; d < keep && i <= 5; d = addDays(d, 18), i++) raw.push({ date: d, t: i === 1 ? 'as the first fruits swell' : 'every 2–3 weeks while picking' }); }
  else {
    let defs = (SIDE_STAGES[p.cropId] || []).filter(s => !s.w || se);   // winter-tied stages only when it goes through a winter
    if (!defs.length) defs = [{ d: 21, t: 'about 3 weeks in' }, { f: 0.6, t: 'mid-season' }];
    for (const s of defs) {
      const date = s.w ? addDays(stageAnchor(se, s.w), s.off || 0) : s.d != null ? addDays(start, s.d) : addDays(p.sowDate, Math.round(daysBetween(p.sowDate, hv) * s.f));
      raw.push({ date, t: s.t, w: s.w });
    }
  }
  if (se && !FRUIT_EVERY.includes(p.cropId) && se.we < addDays(hv, -14) && !raw.some(r => r.date && Math.abs(daysBetween(r.date, se.we)) <= 21))
    raw.push({ date: se.we, t: se.bolt ? 'as growth restarts — the main feed for spring heads' : 'as growth restarts in spring' });
  const out = [];
  for (const r of raw) {
    let { date, t } = r, why = '';
    const orig = date;
    if (!FRUIT_EVERY.includes(p.cropId) && orig > addDays(hv, -14)) continue;   // too close to harvest to help
    let light = false;
    if (date < td) {
      if (daysBetween(date, td) > 21) continue;
      // missed, and it's now the lean stretch before winter: for heading brassicas leave it out — the spring feed does the job
      if (se && se.bolt && inLean(se, td)) { skipped.push({ date: orig, t, why: `missed on ${shortDate(orig)}, and it’s now too close to winter: ${leanWhy(p, se)}. The main feed comes when growth restarts, around ${shortDate(se.we)}.` }); continue; }
      why = `was due around ${shortDate(date)} — still worth doing now`; date = td;
    }
    if (se && se.bolt && inLean(se, date)) { why = `moved from ${shortDate(date)}: ${leanWhy(p, se)} — so it waits for spring`; date = se.we; }
    else if (se && date >= se.leanFrom && date < se.ws) { light = true; why = (why ? why + '; ' : '') + `kept light: ${leanWhy(p, se)}`; }
    const g = r.w ? date : nextGrowing(p.cropId, date);
    if (g > date) { why = `moved from ${shortDate(date)}: too cold for roots to take feed up — growth restarts around ${shortDate(g)}${g > addDays(hv, -14) ? ` (after your harvest estimate of ${shortDate(hv)} — over winter the heads mostly wait for spring, so this still counts)` : ''}`; date = g; }
    const dup = out.find(o => Math.abs(daysBetween(o.date, date)) < 14); if (dup) { if (!dup.t.includes(t)) dup.t += ' / ' + t; continue; }
    out.push({ date, t, why, light });
  }
  out.skipped = skipped; out.season = se;
  return out;
}
const isPlenty = id => { const p = (S.products || []).find(x => x.id === id); return p ? !!p.plenty : (S.plenty || []).includes(id); };
function doseFor(pr, nPerDose, bag) {
  const npk = npkOf(pr.en) || [4, 4, 2, 0.7];
  if (!npk[0]) return null;
  const g = nPerDose / (npk[0] / 100 * (npk[3] || 0.7));
  if (bag) return { amount: Math.max(2, Math.round(g)), unit: 'g', g };
  return g >= 15 ? { amount: Math.max(0.5, Math.round(g / HANDFUL_G * 2) / 2), unit: 'handful', g } : { amount: Math.max(5, Math.round(g / 5) * 5), unit: 'g', g };
}
// N-P-K bars with what's already counted, planned, and what this plan would add
function previewBars(L, add) {
  const row = (k, l, have, plan, extra, need) => { if (!need) return ''; const pc = x => Math.min(100, x / need * 100);
    return `<div class="npkrow"><span class="nl">${l}</span><div class="fbar"><i class="have${k === 'n' ? '' : ' ' + k}" style="width:${pc(have)}%"></i><i class="plan" style="left:${pc(have)}%;width:${Math.max(0, pc(have + plan) - pc(have))}%"></i><i class="add" style="left:${pc(have + plan)}%;width:${Math.max(0, pc(have + plan + extra) - pc(have + plan))}%"></i></div><span class="nv">${gN(have + plan + extra)} / ${gN(need)}${extra ? ` <b>+${gN(extra)}</b>` : ''}</span></div>`; };
  return `<div class="npk">${row('n', 'N', L.total, L.plannedN, add.n, L.need)}${row('p', 'P', L.totalP, L.plannedP, add.p, L.needP)}${row('k', 'K', L.totalK, L.plannedK, add.k, L.needK)}</div>
    <p class="hint">Solid: counted so far · striped: jobs already planned · bright: this plan.</p>`;
}
function sideDressDialog(p) {
  const L = feedLedger(p); if (!L) return;
  const stages = sideStages(p), short = Math.max(0, (L.need || 0) - L.total - L.plannedN), nDoses = Math.max(1, stages.length);
  // a normal side-dressing is ~10–15% of the season's nitrogen — enough to keep growth going without scorching or soft growth
  const perDose = Math.min((L.need || 4) * 0.15, Math.max(short / nDoses, (L.need || 4) * 0.06)), covers = perDose * nDoses;
  const prods = myProducts(['fert']).filter(x => (npkOf(x.en) || [0])[0] > 0).sort((a, b) => (isPlenty(b.id) - isPlenty(a.id)) || (leadOf(a)[0] - leadOf(b)[0]));
  let sel = prods[0] ? prods[0].id : null;
  const dueFor = (s, pr) => { const lead = leadOf(pr)[0]; return lead && addDays(s.date, -lead) > todayStr() ? addDays(s.date, -lead) : s.date; };
  modal(`<h3>Plan side-dressing — ${esc(crop(p.cropId).en)}</h3>
    <p class="small">${L.need ? (short > 0.05 ? `Short by about <b>${gN(short)}</b> nitrogen over the season — suggesting <b>${nDoses} dose${nDoses > 1 ? 's' : ''}</b> of about ${gN(perDose)} nitrogen each${covers < short * 0.9 ? `. Doses are kept to a normal size — one big feed scorches roots and gives soft, pest-prone growth; the soil supplies more as it warms up` : ''}.` : 'Already about right — these are light top-ups only if leaves look pale.') : ''}</p>
    <div id="sdBars"></div>
    <form id="sdf" class="form"><p class="small"><b>When</b></p><div id="sdWhen">${stages.length ? stages.map((s, i) => `<label class="sdwhen"><input type="checkbox" name="w${i}" checked><span class="grow"><b>${esc(s.t)}</b>
        <small>Feed on <input type="date" name="d${i}" value="${dueFor(s, product(sel))}"> <span class="leadnote" data-i="${i}"></span></small>${s.why ? `<small>⏸ ${esc(s.why)}</small>` : ''}</span></label>`).join('')
      : `<p class="muted">No side-dressing stage left before harvest${p.harvestDate ? ` (${shortDate(p.harvestDate)})` : ''} — feeding now won’t make much difference.</p>`}</div>
      <p class="small"><b>With</b> <span class="muted">— tap ☆ for what you have plenty of, so it’s suggested first</span></p><div id="sdOpts"></div>
      <p class="msg small" id="sdSum"></p>
      <p class="hint">Suggestions from usual practice for ${esc(crop(p.cropId).en)} — your bag’s instructions win. Scatter it along the row or around the plant, a few cm from the stems, work it into the surface and water it in.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary"${stages.length ? '' : ' disabled'}>Add these jobs</button></div></form>`, (m, close) => {
    const f = m.querySelector('#sdf'), edited = new Set();
    stages.forEach((s, i) => { f['d' + i].addEventListener('input', () => edited.add(i)); f['w' + i].addEventListener('change', () => update()); });
    const update = () => {
      const pr = product(sel), dose = pr && doseFor(pr, perDose, L.bag), lead = leadOf(pr);
      const eff = dose ? usable3(feedGrams(dose.amount, dose.unit, pr.en), pr.en) : { n: 0, p: 0, k: 0 }, k = stages.filter((s, i) => f['w' + i].checked).length;
      stages.forEach((s, i) => { if (!edited.has(i)) f['d' + i].value = dueFor(s, pr); m.querySelector(`.leadnote[data-i="${i}"]`).textContent = lead[0] && f['d' + i].value !== s.date && !edited.has(i) ? `(${lead[0]} days early — ${pr.en} is slow to work)` : ''; });
      m.querySelector('#sdBars').innerHTML = previewBars(L, { n: eff.n * k, p: eff.p * k, k: eff.k * k });
      m.querySelector('#sdSum').innerHTML = dose ? `${k} × <b>${fmtAmt(dose.amount, dose.unit)} ${esc(pr.en)}</b> → adds N ${gN(eff.n * k)} · P ${gN(eff.p * k)} · K ${gN(eff.k * k)} in total.` : '';
      m.querySelectorAll('.sdopt').forEach(o => o.classList.toggle('on', o.dataset.id === sel));
    };
    const drawOpts = () => {
      m.querySelector('#sdOpts').innerHTML = prods.map(x => { const d = doseFor(x, perDose, L.bag), u = d && usable3(feedGrams(d.amount, d.unit, x.en), x.en);
        return `<label class="sdopt" data-id="${x.id}"><input type="radio" name="sdp" value="${x.id}"${x.id === sel ? ' checked' : ''}><span class="grow"><b>${esc(x.en)}</b>${isPlenty(x.id) ? ' <span class="orgchip">plenty</span>' : ''}${x.organic ? '' : ' <span class="warnchip">not organic</span>'}
          <small>${d ? `${fmtAmt(d.amount, d.unit)} per dose → N ${gN(u.n)} · P ${gN(u.p)} · K ${gN(u.k)}` : ''}</small><small>${esc(leadOf(x)[1])}</small></span>
          <button type="button" class="link" data-star="${x.id}">${isPlenty(x.id) ? '★' : '☆'}</button></label>`; }).join('') || '<p class="muted">No fertilisers in your products — add one under Products.</p>';
      m.querySelectorAll('input[name=sdp]').forEach(r => r.onchange = () => { sel = r.value; update(); });
      m.querySelectorAll('[data-star]').forEach(b => b.onclick = async e => { e.preventDefault(); const id = b.dataset.star; setPlenty(id); await save(); drawOpts(); update(); });
    };
    drawOpts(); update();
    m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault(); const pr = product(sel); if (!pr) return;
      const dose = doseFor(pr, perDose, L.bag);
      stages.forEach((s, i) => { if (!f['w' + i].checked) return;
        S.tasks.push({ id: uid(), plantingId: p.id, kind: 'feed', title: `Side-dress (追肥): ${pr.en} ${fmtAmt(dose.amount, dose.unit)} — ${s.t}`, product: pr.en, amount: dose.amount, unit: dose.unit, due: f['d' + i].value || s.date, done: false }); });
      await save(); close(); render();
    };
  });
}
