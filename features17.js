/* Side-dressing planner: when (crop stages, not during winter dormancy, not right before harvest), what with (your products,
   their effect and how early they need to go on), and how much — all as editable suggestions. */
'use strict';

// usual side-dressing (追肥) stages. d: days after planting (or thinning for sown crops); f: fraction of the way to harvest; md: a calendar date (MM-DD)
const SIDE_STAGES = {
  hakusai: [{ d: 18, t: '2–3 weeks after planting / final thinning' }, { f: 0.5, t: 'as heads start to form (結球始め)' }],
  cabbage: [{ d: 25, t: '3–4 weeks after planting' }, { f: 0.55, t: 'as heads start to form (結球始め)' }],
  broccoli: [{ d: 21, t: '3 weeks after planting' }, { f: 0.65, t: 'when the buds appear' }], cauliflower: [{ d: 21, t: '3 weeks after planting' }, { f: 0.65, t: 'when the curd appears' }],
  daikon: [{ d: 5, t: 'at the last thinning (本葉5–6枚)' }, { d: 25, t: 'as roots start to thicken' }], kabu: [{ d: 5, t: 'after the last thinning' }], carrot: [{ d: 5, t: 'after thinning' }, { d: 30, t: 'as roots thicken' }],
  komatsuna: [{ d: 5, t: 'after thinning (only if leaves look pale)' }], chingensai: [{ d: 7, t: 'after thinning' }], mizuna: [{ d: 10, t: 'after thinning' }], spinach: [{ d: 7, t: 'after thinning' }],
  shungiku: [{ d: 10, t: 'after thinning, and after each cut' }], lettuce: [{ d: 18, t: '2–3 weeks after planting' }],
  onion: [{ md: '01-05', t: 'early January' }, { md: '02-25', t: 'late February — the last feed (止め肥); none after March' }],
  garlic: [{ md: '12-15', t: 'mid December' }, { md: '02-25', t: 'late February — the last feed (止め肥)' }],
  naganegi: [{ d: 30, t: 'with the first earthing-up (土寄せ)' }, { d: 60, t: 'with the second earthing-up' }, { d: 90, t: 'with the third earthing-up' }],
  snappea: [{ md: '02-25', t: 'when growth restarts in spring' }, { f: 0.8, t: 'when flowering starts — lightly' }], sayaendo: [{ md: '02-25', t: 'when growth restarts in spring' }, { f: 0.8, t: 'at flowering — lightly' }],
  soramame: [{ md: '02-25', t: 'when growth restarts in spring' }], strawberry: [{ md: '02-20', t: 'late February, as growth restarts' }],
  potato: [{ d: 25, t: 'when removing extra shoots (芽かき) and earthing up' }], corn: [{ d: 30, t: 'at 7–8 leaves' }, { d: 50, t: 'when tassels appear' }],
  edamame: [{ d: 30, t: 'at flowering — lightly, only if pale' }], ingen: [{ d: 30, t: 'at flowering' }],
};
const FRUIT_EVERY = ['tomato', 'minitomato', 'nasu', 'piman', 'shishito', 'chilli', 'kyuri', 'zucchini'];
// how early a product needs to go on before plants can use it, and how fast it works
const LEAD = { kasei888: [0, 'fast — works within days'], bokashi: [7, 'fairly fast — about a week'], toshoAburakasu: [7, 'fairly fast — about a week'], chickenManure: [10, 'medium — 1–2 weeks'],
  aburakasu: [21, 'slow — 2–3 weeks, slower in cold soil'], neem: [14, 'slow — about 2 weeks'], woodAsh: [0, 'fast (potash only)'] };
const leadOf = pr => pr ? (LEAD[pr.id] || [7, 'about a week']) : [7, ''];

// growth restarts when the usual daily mean gets back above this
const restartTemp = id => WARM_LEAF.includes(id) ? 15 : 8;
function nextGrowing(id, d) { const thr = restartTemp(id); for (let i = 0; i < 200; i++) { if (normalT(addDays(d, i)) >= thr) return addDays(d, i); } return d; }
function sideStages(p) {
  const td = todayStr(), cr = crop(p.cropId), hv = p.harvestDate || addDays(p.sowDate, cr.daysHarvest || 60);
  const start = p.method === 'seed' ? (p.thinDoneOn || p.thinDate || addDays(p.sowDate, 20)) : p.sowDate;
  let raw = [];
  if (FRUIT_EVERY.includes(p.cropId)) { const keep = (harvestWindow(p) || {}).keep || addDays(hv, 60); for (let d = addDays(hv, -10), i = 1; d < keep && i <= 5; d = addDays(d, 18), i++) raw.push({ date: d, t: i === 1 ? 'as the first fruits swell' : 'every 2–3 weeks while picking' }); }
  else for (const s of SIDE_STAGES[p.cropId] || [{ d: 21, t: 'about 3 weeks in' }, { f: 0.6, t: 'mid-season' }]) {
    let date = s.d != null ? addDays(start, s.d) : s.f != null ? addDays(p.sowDate, Math.round(daysBetween(p.sowDate, hv) * s.f)) : null;
    if (s.md) { const y = +p.sowDate.slice(0, 4); date = `${y}-${s.md}`; if (date <= p.sowDate) date = `${y + 1}-${s.md}`; }
    raw.push({ date, t: s.t });
  }
  const out = [];
  for (const r of raw) {
    let { date, t } = r, why = '';
    const orig = date;
    if (!FRUIT_EVERY.includes(p.cropId) && orig > addDays(hv, -14)) continue;   // too close to harvest to help
    if (date < td) { if (daysBetween(date, td) > 21) continue; why = `was due around ${shortDate(date)} — still worth doing now`; date = td; }
    const g = nextGrowing(p.cropId, date);
    if (g > date) { why = `moved from ${shortDate(date)}: too cold for roots to take feed up — growth restarts around ${shortDate(g)}${g > addDays(hv, -14) ? ` (after your harvest estimate of ${shortDate(hv)} — over winter the heads mostly wait for spring, so this still counts)` : ''}`; date = g; }
    const dup = out.find(o => Math.abs(daysBetween(o.date, date)) < 14); if (dup) { if (!dup.t.includes(t)) dup.t += ' / ' + t; continue; }
    out.push({ date, t, why });
  }
  return out;
}
const isPlenty = id => (S.plenty || []).includes(id);
function doseFor(pr, nPerDose, bag) {
  const npk = NPK[pr.id] || [4, 4, 2, 0.7];
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
  const prods = myProducts(['fert']).filter(x => (NPK[x.id] || [0])[0] > 0).sort((a, b) => (isPlenty(b.id) - isPlenty(a.id)) || (leadOf(a)[0] - leadOf(b)[0]));
  let sel = prods[0] ? prods[0].id : null;
  const dueFor = (s, pr) => { const lead = leadOf(pr)[0]; return lead && addDays(s.date, -lead) > todayStr() ? addDays(s.date, -lead) : s.date; };
  modal(`<h3>Plan side-dressing — ${esc(crop(p.cropId).en)}</h3>
    <p class="small">${L.need ? (short > 0.05 ? `Short by about <b>${gN(short)}</b> nitrogen over the season — suggesting <b>${nDoses} dose${nDoses > 1 ? 's' : ''}</b> of about ${gN(perDose)} nitrogen each${covers < short * 0.9 ? `. Doses are kept to a normal size — one big feed scorches roots and gives soft, pest-prone growth; the soil supplies more as it warms up` : ''}.` : 'Already about right — these are light top-ups only if leaves look pale.') : ''}</p>
    <div id="sdBars"></div>
    <form id="sdf" class="form"><p class="small"><b>When</b></p><div id="sdWhen">${stages.length ? stages.map((s, i) => `<label class="sdwhen"><input type="checkbox" name="w${i}" checked><span class="grow"><b>${esc(s.t)}</b>
        <small>Feed on <input type="date" name="d${i}" value="${dueFor(s, PRODUCTS.find(x => x.id === sel))}"> <span class="leadnote" data-i="${i}"></span></small>${s.why ? `<small>⏸ ${esc(s.why)}</small>` : ''}</span></label>`).join('')
      : `<p class="muted">No side-dressing stage left before harvest${p.harvestDate ? ` (${shortDate(p.harvestDate)})` : ''} — feeding now won’t make much difference.</p>`}</div>
      <p class="small"><b>With</b> <span class="muted">— tap ☆ for what you have plenty of, so it’s suggested first</span></p><div id="sdOpts"></div>
      <p class="msg small" id="sdSum"></p>
      <p class="hint">Suggestions from usual practice for ${esc(crop(p.cropId).en)} — your bag’s instructions win. Scatter it along the row or around the plant, a few cm from the stems, work it into the surface and water it in.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary"${stages.length ? '' : ' disabled'}>Add these jobs</button></div></form>`, (m, close) => {
    const f = m.querySelector('#sdf'), edited = new Set();
    stages.forEach((s, i) => { f['d' + i].addEventListener('input', () => edited.add(i)); f['w' + i].addEventListener('change', () => update()); });
    const update = () => {
      const pr = PRODUCTS.find(x => x.id === sel), dose = pr && doseFor(pr, perDose, L.bag), lead = leadOf(pr);
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
      m.querySelectorAll('[data-star]').forEach(b => b.onclick = async e => { e.preventDefault(); const id = b.dataset.star; S.plenty = isPlenty(id) ? S.plenty.filter(x => x !== id) : [...(S.plenty || []), id]; await save(); drawOpts(); update(); });
    };
    drawOpts(); update();
    m.querySelector('[data-x=no]').onclick = close;
    f.onsubmit = async e => {
      e.preventDefault(); const pr = PRODUCTS.find(x => x.id === sel); if (!pr) return;
      const dose = doseFor(pr, perDose, L.bag);
      stages.forEach((s, i) => { if (!f['w' + i].checked) return;
        S.tasks.push({ id: uid(), plantingId: p.id, kind: 'feed', title: `Side-dress (追肥): ${pr.en} ${fmtAmt(dose.amount, dose.unit)} — ${s.t}`, product: pr.en, amount: dose.amount, unit: dose.unit, due: f['d' + i].value || s.date, done: false }); });
      await save(); close(); render();
    };
  });
}
