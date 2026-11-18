/* Feeding, reworked: one ledger per crop — starting soil, what the previous crop left, base fertiliser, and every feeding since.
   Every feeding is stored once in the log (kind 'fert'); tasks with a fertiliser ask what you actually used when ticked. */
'use strict';

// ---------- products & potting mixes ----------
if (!PRODUCTS.some(p => p.id === 'kasei888')) PRODUCTS.push({ id: 'kasei888', kind: 'fert', en: 'Chemical fertiliser 8-8-8', ja: '化成肥料 8-8-8', maker: 'generic', organic: false, wait: 0, top: true, npk: '8-8-8',
  what: 'Balanced quick-release granular fertiliser', notes: ['Fast-acting: plants can use nearly all of it this season.', 'Mix it well into the soil as base fertiliser; as a side-dressing keep it a few cm from stems.', 'Not allowed in organic (JAS) growing.'] });
function migrateFeed() { if (Array.isArray(S.myProducts) && !S.kaseiAdded) { if (!S.myProducts.includes('kasei888')) S.myProducts.push('kasei888'); S.kaseiAdded = true; } }
NPK.kasei888 = [8, 8, 8, 1]; NPK.woodAsh = [0, 3, 7, 0]; NPK.kuntan = [0, 0.2, 0.5, 0];
// how much of each nutrient plants can use this season
function availPK(npk) { return npk[3] >= 1 ? [0.8, 1] : npk[0] === 0 ? [0.6, 1] : npk[3] < 0.2 ? [0.3, 0.7] : [0.6, 0.8]; }
// typical P (as P₂O₅) and K (as K₂O) per m² over the season (Japanese 施肥基準, kg/10a = g/m²)
const P_NEED = { hakusai: 20, cabbage: 20, broccoli: 20, cauliflower: 20, daikon: 10, carrot: 12, komatsuna: 10, chingensai: 10, mizuna: 10, kabu: 10, hatsuka: 6, spinach: 12, lettuce: 12, shungiku: 12, celery: 30,
  tomato: 20, minitomato: 20, nasu: 25, piman: 25, shishito: 25, chilli: 20, kyuri: 25, zucchini: 20, potato: 15, satsumaimo: 8, satoimo: 20, edamame: 8, ingen: 10, snappea: 10, sayaendo: 10, soramame: 10,
  onion: 20, naganegi: 15, hatamanegi: 10, garlic: 15, corn: 20, strawberry: 20, nanohana: 15 };
const K_NEED = { hakusai: 25, cabbage: 25, broccoli: 20, cauliflower: 20, daikon: 12, carrot: 15, komatsuna: 10, chingensai: 10, mizuna: 10, kabu: 12, hatsuka: 6, spinach: 12, lettuce: 12, shungiku: 12, celery: 30,
  tomato: 25, minitomato: 25, nasu: 25, piman: 25, shishito: 25, chilli: 20, kyuri: 25, zucchini: 20, potato: 15, satsumaimo: 20, satoimo: 20, edamame: 10, ingen: 10, snappea: 10, sayaendo: 10, soramame: 12,
  onion: 20, naganegi: 20, hatamanegi: 12, garlic: 15, corn: 20, strawberry: 20, nanohana: 15 };
const MIXES = [['iris', 'Iris Ohyama Golden Granular Soil', 'アイリスオーヤマ ゴールデン粒状培養土'], ['touikawa', 'Touikawa Peace Farm vegetable soil', 'おいしい野菜を育てる土'], ['other', 'Other potting mix', '培養土']];
const MIX_N = 0.12;          // g N per litre of fresh 元肥入り potting mix (typical; check the bag)
// fertiliser built into the potting mixes you use: N-P-K, grams per litre of mix (estimated — the bags don't say), and how long it releases for
const MIX_FERT = {
  touikawa: { npk: [6, 36, 6], gPerL: 2, days: 365, what: 'slow-release 6-36-6 + magnesium (like Magamp K), feeding steadily for about a year' },
  iris: { npk: [8, 8, 8], gPerL: 1, days: 30, what: 'starter fertiliser (about 1:1:1) that lasts about a month' },
  other: { npk: [8, 8, 8], gPerL: 1, days: 30, what: 'starter fertiliser for about a month' },
};
const DENS = { compost: 0.5, lime: 0.9, fert: 0.6, amend: 0.15 };   // g per mL for solids measured by volume
const DENS_ID = { woodAsh: 0.5, kuntan: 0.15 };
const isLiquid = n => /液|liquid|hyponex|ハイポネックス|リキッド/i.test(n || '') || !!(typeof customByName === 'function' && (customByName(n) || {}).form === 'liquid');
if (!PRODUCTS.some(p => p.id === 'woodAsh')) PRODUCTS.push({ id: 'woodAsh', kind: 'lime', en: 'Wood ash', ja: '草木灰', maker: 'generic', organic: true, wait: 7, top: true, npk: 'about 0-3-7',
  what: 'Potash (K) and a little phosphate; alkaline like lime', notes: ['Mostly potash — good before fruiting crops, potatoes and onions.', 'Alkaline: it raises pH like lime, so count it as part of your liming.', 'Don’t mix it with nitrogen manures (chicken manure, aburakasu) at the same time — it drives off ammonia. Keep a week apart.'] });
if (!PRODUCTS.some(p => p.id === 'kuntan')) PRODUCTS.push({ id: 'kuntan', kind: 'amend', en: 'Kuntan (smoked rice husk charcoal)', ja: 'もみ殻くん炭', maker: 'generic', organic: true, wait: 0, top: true, npk: 'about 0-0.2-0.5',
  what: 'Soil conditioner — drainage, air and microbes; tiny amount of potash', notes: ['Mainly improves soil structure and drainage; its nutrient value is small.', 'Slightly alkaline.', 'Good mixed into seed and potting mixes, or around seedlings.'] });

// ---------- amounts ----------
function feedGrams(amount, unit, name) {
  const a = +amount; if (!(a > 0)) return 0;
  const pr = productByName(name || ''), d = pr ? (DENS_ID[pr.id] || DENS[pr.kind] || 0.6) : isLiquid(name) ? 1.2 : 0.6;   // liquids: the concentrate
  return unit === 'kg' ? a * 1000 : unit === 'handful' ? a * HANDFUL_G : unit === 'L' ? a * 1000 * d : unit === 'mL' ? a * d : a;
}
// usable nitrogen (g) from an amount of a product this season
function usableN(g, name, seasons = 0) {
  const npk = npkOf(name); if (!npk) return null;
  const avail = seasons > 0 ? (npk[3] < 0.2 ? 0.05 : 0) : npk[3];   // compost keeps releasing slowly in later seasons
  return g * npk[0] / 100 * avail;
}
// usable N, P, K (g) this season — null if the analysis is unknown
function usable3(g, name, seasons = 0) {
  const npk = npkOf(name); if (!npk) return null;
  const [ap, ak] = availPK(npk), later = seasons > 0;
  return { n: g * npk[0] / 100 * (later ? (npk[3] < 0.2 ? 0.05 : 0) : npk[3]), p: g * npk[1] / 100 * (later ? 0.05 : ap), k: g * npk[2] / 100 * (later ? 0.05 : ak) };
}
const NAME_N = 'nitrogen';
// space a crop occupies, in m² (bags: a "soil-volume" equivalent, since pots need more per area)
function feedArea(c, p) { if (c.type === 'bed') return Draw.dims(c).W * ((p ? p.to - p.from : Draw.dims(c).L)) / 1e4; return Math.max(areaOf(c), (potVolume(c) || 40) / 150); }
const gN = v => v >= 10 ? Math.round(v) + ' g' : (Math.round(v * 10) / 10) + ' g';

// ---------- potting mix in bags ----------
function mixState(c, beforeDate) {
  if (c.type === 'bed') return null;
  const ev = (c.mixLog || []).filter(e => !beforeDate || e.date <= beforeDate).sort(mixSort).pop();
  if (!ev) return null;
  const cropsSince = [...S.plantings.filter(p => p.containerId === c.id && p.sowDate && p.sowDate >= ev.date && (!beforeDate || p.sowDate < beforeDate)), ...(c.history || []).filter(h => h.sowDate && h.sowDate >= ev.date && (!beforeDate || h.sowDate < beforeDate) && !S.plantings.some(p => p.id === h.plantingId))];
  return Object.assign({}, ev, { firstCrop: ev.fresh && !cropsSince.length, mix: MIXES.find(m => m[0] === ev.kind) || MIXES[2] });
}
function mixDialog(c) {
  const td = todayStr(), cur = mixState(c);
  modal(`<h3>Potting mix — ${esc(c.name)}</h3><form id="mxf" class="form">
      <label>Mix<select name="kind">${MIXES.map(([k, en, ja]) => `<option value="${k}"${(cur ? cur.kind : 'iris') === k ? ' selected' : ''}>${esc(en)} ${esc(ja)}</option>`).join('')}</select></label>
      <div class="seg"><button type="button" data-f="1" class="on">Fresh mix</button><button type="button" data-f="0">Re-used (roots sieved out)</button></div>
      <p class="hint">For fills before you started using the app. New plantings record this themselves — choose Fresh mix or Re-used in the planting form.</p>
      <label>Filled on<input name="date" type="date" value="${td}" max="${td}"></label>
      <p class="hint">Fertiliser built into the mix is counted from the fill date: Touikawa as slow-release 6-36-6 + magnesium for about a year, Iris Ohyama as about a month of starter feed. Amounts are estimates — the bags don’t print them. Any 8-8-8 you mix in when refreshing is counted separately (record it as the crop’s starting fertiliser).</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>
    ${(c.mixLog || []).length ? `<ul class="plist">${c.mixLog.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(e => `<li><span class="grow">${shortDate(e.date)} ${yearOfD(e.date)} · ${e.fresh ? 'fresh' : 're-used'} ${esc((MIXES.find(m => m[0] === e.kind) || MIXES[2])[1])}${e.pid && planting(e.pid) ? ` <small>with ${esc(crop(planting(e.pid).cropId).en)}</small>` : ''}</span><button class="link danger" data-delmix="${e.id}">remove</button></li>`).join('')}</ul>` : ''}`, (m, close) => {
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
  const need = N_NEED[p.cropId] ? N_NEED[p.cropId] * A2 : null, needP = P_NEED[p.cropId] ? P_NEED[p.cropId] * A2 : null, needK = K_NEED[p.cropId] ? K_NEED[p.cropId] * A2 : null;
  const L3 = (o, u) => Object.assign(o, u ? { n: u.n, p: u.p, k: u.k } : { n: null, p: null, k: null });
  // 1. starting soil
  if (bag) {
    const ms = mixState(c, p.sowDate), v = potVolume(c) || 40;
    // the fertiliser in fresh mix releases from the fill date for its own period; this crop gets the part that overlaps its season
    // fertiliser built into the last FRESH fill keeps releasing for its period — sieving out roots and re-using the mix doesn't remove it
    const fresh = (c.mixLog || []).filter(e => e.fresh && e.date <= p.sowDate).sort(mixSort).pop();
    const mf = fresh ? (MIX_FERT[fresh.kind] || MIX_FERT.other) : null, fmix = fresh ? (MIXES.find(m => m[0] === fresh.kind) || MIXES[2]) : null;
    const reworked = ms && !ms.fresh && fresh && ms.date > fresh.date;
    let mixed = false;
    if (mf) {
      const endD = feedEnd(p), a = p.sowDate > fresh.date ? p.sowDate : fresh.date, rEnd = addDays(fresh.date, mf.days), z = rEnd < endD ? rEnd : endD;
      const share = Math.max(0, daysBetween(a, z)) / mf.days * (reworked ? 0.85 : 1), g = mf.gPerL * v;
      if (share > 0.02) { mixed = true; lines.push({ g: 'soil', name: 'mix:slow', from: a, to: z, label: `Fertiliser in the potting mix (${fmix[1]}, filled fresh ${shortDate(fresh.date)}${reworked ? `, re-used ${shortDate(ms.date)}` : ''})`,
        n: g * mf.npk[0] / 100 * share, p: g * mf.npk[1] / 100 * share, k: g * mf.npk[2] / 100 * share, note: `${mf.what} — ${Math.round(share * 100)}% of it falls in this crop’s time${reworked ? ' (a little lost when the mix was reworked)' : ''} (amount estimated)` }); }
    }
    if (!mixed) lines.push({ g: 'soil', name: 'mix:reused', label: ms ? (ms.fresh ? `Potting mix (${ms.mix[1]}) — its built-in fertiliser is used up` : `Re-used potting mix (${ms.mix[1]})`) : 'Potting mix (no fill date recorded)', n: 0.3, p: 0.3, k: 0.3, note: ms ? 'little left' : 'tap “Set potting mix” on the Feeding card' });
  } else lines.push({ g: 'soil', name: 'soil', label: 'The bed’s own soil', n: 6 * A2, p: 4 * A2, k: 8 * A2, note: 'slow release from the soil’s reserves over a season (rough)' });
  // 2. what the previous crop left
  const prev = lastCropIn(c, p.from, p.to, p.sowDate, p.id);
  if (prev) {
    const pf = feedOf(prev.cropId, prev), pp = prev.plantingId && planting(String(prev.plantingId).split(':')[0]);
    const o = { g: 'prev', name: 'prev', label: `Previous crop: ${crop(prev.cropId).en}`, n: 0, p: 0, k: 0, note: '' };
    if (pf === 'legume') { o.n = 2 * A2; o.note = 'legumes leave nitrogen in their roots'; }
    else if (pp && pp.id !== p.id) {
      const L = feedLedger(Object.assign({}, pp, { status: 'active' })), sh = A2 / feedArea(c, pp);
      if (L) { o.n = L.need && L.applied > L.need ? (L.applied - L.need) * 0.3 * sh : 0; o.p = L.needP && L.appliedP > L.needP ? (L.appliedP - L.needP) * 0.5 * sh : 0; o.k = L.needK && L.appliedK > L.needK ? (L.appliedK - L.needK) * 0.3 * sh : 0; }
      o.note = o.n + o.p + o.k > 0.05 ? 'some of what it was fed but didn’t use' : pf === 'heavy' ? 'a heavy feeder — little left' : 'used what it was given';
    } else o.note = pf === 'heavy' ? 'a heavy feeder — little left' : pf === 'light' ? 'a light feeder' : 'no feeding records for it';
    lines.push(o);
  }
  // compost from earlier crops in the same space (keeps releasing for a couple of years)
  const oc = { n: 0, p: 0, k: 0 };
  for (const q of S.plantings) if (q.id !== p.id && q.containerId === c.id && q.sowDate && q.sowDate < p.sowDate && q.sowDate >= addDays(p.sowDate, -730) && q.from < p.to - 0.5 && q.to > p.from + 0.5)
    for (const f of q.fert || []) { const pr = productByName(f.product); if (pr && pr.kind === 'compost') { const u = usable3(feedGrams(f.amount, f.unit, f.product), f.product, 1); if (u) { const sh = A2 / feedArea(c, q); oc.n += u.n * sh; oc.p += u.p * sh; oc.k += u.k * sh; } } }
  if (oc.n + oc.p + oc.k > 0.05) lines.push(Object.assign({ g: 'prev', name: 'compost-old', label: 'Compost dug in for earlier crops', note: 'still releasing slowly' }, oc));
  // 3. base fertiliser at planting
  for (const f of p.fert || []) {
    if (!f.product) continue; const pr = productByName(f.product), u = usable3(feedGrams(f.amount, f.unit, f.product, c), f.product);
    lines.push(L3({ g: 'base', name: f.product, label: `${f.product} ${amtFor(f.product, f.amount, f.unit)}`, date: p.sowDate, note: !u ? 'unknown analysis — not counted' : pr && pr.kind === 'compost' ? 'compost: only ~10% of its nitrogen this season' : '' }, u));
  }
  // 4. every feeding since (log), shared feedings split by area
  const from = addDays(p.sowDate, -21), end = p.status === 'harvested' ? (p.harvestedOn || td) : td;
  for (const e of S.log || []) {
    if (!['fert', 'soil'].includes(e.kind) || !e.product || e.date < from || e.date > end) continue;
    const pids = e.pids || [], cids = e.cids || [], n = pids.length + cids.length || 1, g = feedGrams(e.amount, e.unit, e.product, c) / (e.per === 'total' ? n : 1);
    let share = 0;
    if (pids.includes(p.id)) share = 1; else if (cids.includes(c.id)) share = A2 / bedA; else if (!pids.length && !cids.length) share = A2 / bedA;
    if (!share) continue;
    const u = usable3(g * share, e.product);
    lines.push(L3({ g: 'fed', name: e.product, label: `${e.product} ${amtFor(e.product, e.amount, e.unit)}${share < 0.999 ? ` (whole ${bag ? 'pot' : 'bed'} — ${Math.round(share * 100)}% here)` : ''}`, date: e.date, logId: e.id, note: u ? '' : 'unknown analysis — not counted' }, u));
  }
  // older records: ticked fertiliser jobs that weren't logged separately
  for (const s of p.series || []) {
    if (!s.product || s.amount == null) continue;
    for (const t of S.tasks) if (t.seriesId === s.id && t.done && t.doneOn && !t.logId) lines.push(L3({ g: 'fed', name: s.product, label: `${s.product} ${amtFor(s.product, s.amount, s.unit)}`, date: t.doneOn }, usable3(feedGrams(s.amount, s.unit, s.product, c), s.product)));
  }
  const sum = (gs, k) => lines.filter(l => gs.includes(l.g)).reduce((a, l) => a + (l[k] || 0), 0), ALL = ['soil', 'prev', 'base', 'fed'];
  // planned feedings still to come
  const planned = S.tasks.filter(t => t.plantingId === p.id && !t.done && (t.product || (t.seriesId && ((p.series || []).find(s => s.id === t.seriesId) || {}).product))).map(t => {
    const s = (p.series || []).find(x => x.id === t.seriesId) || t, u = usable3(feedGrams(s.amount, s.unit, s.product, c), s.product) || { n: 0, p: 0, k: 0 };
    return { t, n: u.n, p: u.p, k: u.k, name: s.product, text: `${s.product} ${amtFor(s.product, s.amount, s.unit)}` };
  });
  if (typeof schedPlanned === 'function') planned.push(...schedPlanned(p));
  return { c, bag, area: A2, need, needP, needK, lines, planned,
    applied: sum(['base', 'fed'], 'n'), appliedP: sum(['base', 'fed'], 'p'), appliedK: sum(['base', 'fed'], 'k'),
    total: sum(ALL, 'n'), totalP: sum(ALL, 'p'), totalK: sum(ALL, 'k'),
    plannedN: planned.reduce((a, x) => a + x.n, 0), plannedP: planned.reduce((a, x) => a + x.p, 0), plannedK: planned.reduce((a, x) => a + x.k, 0) };
}
function pkNote(L, p) {
  const late = p.harvestDate && p.sowDate && todayStr() > addDays(p.sowDate, Math.round(daysBetween(p.sowDate, p.harvestDate) * 0.75));
  const bits = [], chk = (have, plan, need, nm, why) => { if (!need) return; const r = (have + plan) / need; if (r < 0.6 && !late) bits.push(`Low on ${nm} — ${why}.`); else if (r > 2.5) bits.push(`Plenty of ${nm}.`); };
  chk(L.totalP, L.plannedP, L.needP, 'phosphate (P)', 'a fertiliser like bokashi, chicken manure or 8-8-8 adds some');
  chk(L.totalK, L.plannedK, L.needK, 'potash (K)', 'wood ash, chicken manure or 8-8-8 add some');
  return bits.join(' ');
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
function feedBar(L, k = 'n') {
  const need = { n: L.need, p: L.needP, k: L.needK }[k], have = { n: L.total, p: L.totalP, k: L.totalK }[k], plan = { n: L.plannedN, p: L.plannedP, k: L.plannedK }[k];
  if (!need) return '';
  const pc = x => Math.min(100, x / need * 100);
  return `<div class="fbar"><i class="have${k === 'n' ? '' : ' ' + k}" style="width:${pc(have)}%"></i><i class="plan" style="left:${pc(have)}%;width:${Math.max(0, pc(have + plan) - pc(have))}%"></i></div>`;
}
function npkBars(L) {
  const row = (k, l, have, need, plan) => need ? `<div class="npkrow"><span class="nl">${l}</span>${feedBar(L, k)}<span class="nv">${gN(have)}${plan ? `+${gN(plan)}` : ''} / ${gN(need)}</span></div>` : '';
  return `<div class="npk">${row('n', 'N', L.total, L.need, L.plannedN)}${row('p', 'P', L.totalP, L.needP, L.plannedP)}${row('k', 'K', L.totalK, L.needK, L.plannedK)}</div>`;
}
function feedingSection(p) {
  const L = feedLedger(p); if (!L) return '';
  A.feedNow = () => feedDialog({ pids: [p.id] });
  A.editFeed = el => feedDialog((S.log || []).find(e => e.id === el.dataset.id));
  A.addSideDress = () => feedPlanner(p);
  A.setMix = () => mixDialog(L.c);
  const grp = { soil: 'Starting soil', prev: 'Left from before', base: 'At planting', fed: 'Fed since' };
  const cell = v => `<td>${v == null ? '—' : v < 0.05 ? '·' : gN(v)}</td>`;
  const rows = `<tr class="hd"><th></th><th>N</th><th>P</th><th>K</th></tr>` + Object.keys(grp).map(k => { const ls = L.lines.filter(l => l.g === k); return ls.length ? `<tr class="fg"><th colspan="4">${grp[k]}</th></tr>${ls.map(l => `<tr${l.logId ? ` data-act="editFeed" data-id="${l.logId}"` : ''}><td>${l.date ? `<small>${shortDate(l.date)}</small> ` : ''}${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</td>${cell(l.n)}${cell(l.p)}${cell(l.k)}</tr>`).join('')}` : ''; }).join('');
  const nextUp = L.planned.slice().sort((a, b) => (a.t.due < b.t.due ? -1 : 1))[0];
  const scheds = (p.feedPlan || []).filter(s => !s.stopped && !s.done).map(s => `🔁 Every ${s.every} days: ${esc(s.product)} ${amtFor(s.product, s.amount, s.unit)}${s.paused ? ` — <b>paused</b>: ${s.paused === 'salt' ? 'meter shows salt DANGER' : 'enough nitrogen for the season'}` : ''}`).join('<br>');
  const sim = feedSim(p, L);
  const salt = L.c && soilReadingAdvice(L.c, p.from, p.to, p.cropId);
  return `<section class="feeding"><h3>Feeding</h3>
    ${salt && salt.feed < 1 ? `<div class="banner warn">🧪 Your meter read salt <b>DANGER</b> on ${shortDate(salt.r.date)} — too much fertiliser in the soil. Hold off feeding (repeating feeds are paused) and water through well; take another reading in a week or so.</div>` : ''}
    ${sim ? `${coverBar(sim)}<p class="small">${simVerdict(sim, L, p)}</p>` : `<p class="small">${feedVerdict(L, p)}</p>`}
    ${(() => { const se = feedSeason(p), bad = se && se.bolt ? L.planned.filter(x => !x.t.schedId && inLean(se, actsOn(x.name, x.t.due))) : []; return bad.length ? `<div class="banner warn">📅 ${bad.map(x => `${esc(x.text)} (${shortDate(x.t.due)})`).join(', ')} ${bad.length > 1 ? 'are' : 'is'} planned in the lean stretch before winter — ${esc(leanWhy(p, se))}. Better to skip ${bad.length > 1 ? 'them' : 'it'} (tap the job → Delete) and feed around ${shortDate(se.we)}; open 📅 Feeding plan to re-plan.</div>` : ''; })()}
    ${nextUp || scheds ? `<p class="small">${nextUp ? `Next: <b>${esc(nextUp.text)}</b> ${shortDate(nextUp.t.due)}.` : ''}${scheds ? `<br>${scheds}` : ''}</p>` : ''}
    ${L.bag && !mixState(L.c) ? `<div class="banner warn">🪴 This pot’s potting mix isn’t recorded, so the fertiliser in the mix isn’t counted. <a class="btn small" href="#/plant/${p.id}/edit">Set it in Edit planting</a></div>` : ''}
    <div class="btnrow"><button class="btn small primary" data-act="feedNow">🌿 Record feeding</button>${isLive(p) ? '<button class="btn small" data-act="addSideDress">📅 Feeding plan…</button>' : ''}</div>
    <details class="fold inner"><summary>What’s been counted</summary>
      ${L.need ? `<p class="small">${esc(crop(p.cropId).en)} needs about <b>${gN(L.need)}</b> of ${NAME_N} over the season ${L.bag ? 'in this pot' : `in this ${L.area.toFixed(1)} m² section`}. Counted: <b>${gN(L.total)}</b>${L.plannedN ? ` + ${gN(L.plannedN)} planned` : ''}.</p>` : ''}
      ${sim && L.need ? `<p class="small">${fateLine(sim, L, p)}</p>` : ''}
      ${npkBars(L)}${pkNote(L, p) ? `<p class="small">${pkNote(L, p)}</p>` : ''}
      <table class="ledger">${rows}</table>
      <p class="hint"><b>N</b> nitrogen — leaves and growth, the one that most often runs short. <b>P</b> phosphate — roots, flowering and fruit set. <b>K</b> potash — fruit, roots and toughness. Grams plants can use, worked out from each product’s N-P-K analysis (as on Japanese labels: N, P₂O₅, K₂O). “Fed until” follows when each feed releases, what the crop takes as it grows, and what washes out with watering and rain. All rough — trust how the plants look.</p></details></section>`;
}
function bedFeedingSection(c) {
  const ps = activeIn(c.id); if (!ps.length) return '';
  A.feedBed = () => feedDialog({ cids: [c.id] });
  A.mix = () => mixDialog(c);
  const ms = c.type !== 'bed' ? mixState(c) : null;
  return `<section class="feeding"><h3>Feeding</h3>
    ${c.type !== 'bed' ? `<p class="small">🪴 ${ms ? `${ms.fresh ? 'Fresh' : 'Re-used'} ${esc(ms.mix[1])} since ${shortDate(ms.date)}` : 'Potting mix not recorded'} <button class="btn small" data-act="mix">🪴 ${ms ? 'Refilled / re-used? Update mix' : 'Set potting mix'}</button></p>` : ''}
    ${ps.map(p => { const L = feedLedger(p); return L ? `<a class="feedrow" href="#/plant/${p.id}">${ic(p.cropId)}<span class="grow"><b>${esc(crop(p.cropId).en)}</b>${feedBar(L)}<small>${(() => { const sim = feedSim(p, L); return sim ? (sim.shortFrom ? `fed until ~${shortDate(sim.shortFrom)}` : `fed to ${shortDate(sim.end)}`) + ' · ' : ''; })()}${gN(L.total)}${L.need ? ` of ~${gN(L.need)}` : ''} ${NAME_N} this season</small></span>›</a>` : ''; }).join('')}
    <div class="btnrow"><button class="btn small primary" data-act="feedBed">🌿 Record feeding (whole ${c.type === 'bed' ? 'bed' : 'pot'})</button></div></section>`;
}

// ---------- record a feeding ----------
function feedDialog(e, onSave, onCancel) {
  const isNew = !e || !e.id, td = todayStr();
  e = Object.assign({ date: td, kind: 'fert', product: '', amount: '', unit: 'handful', per: 'each', cids: [], pids: [] }, e || {});
  const prods = myProducts(['fert', 'compost', 'lime', 'amend']), names = [...new Set([...prods.map(x => x.en), ...(S.log || []).filter(x => x.kind === 'fert').map(x => x.product).filter(Boolean)])];
  const targets = [...(e.cids || []).map(id => (container(id) || {}).name), ...(e.pids || []).map(id => { const p = planting(id); return p ? crop(p.cropId).en + ' · ' + ((container(p.containerId) || {}).name || '') : ''; })].filter(Boolean).join(', ') || 'Whole garden';
  modal(`<h3>🌿 ${isNew ? 'Record feeding' : 'Edit feeding'}</h3><p class="muted small">${esc(targets)}</p><form id="fdf" class="form">
      <label>Product<input name="product" list="fdl" value="${esc(e.product || '')}" required placeholder="e.g. Bokashi, 化成肥料 8-8-8"><datalist id="fdl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <div id="fdd"></div>
      <div class="two"><label>Amount<input name="amount" type="number" inputmode="decimal" step="any" value="${e.amount ?? ''}" required></label><label>Unit<select name="unit">${unitOpts(e.unit || 'handful')}</select></label></div>
      <label>Date<input name="date" type="date" value="${e.date}" max="${td}"></label>
      <p class="hint" id="fdn"></p>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#fdf');
    const tc = container((e.cids || [])[0]) || container((planting((e.pids || [])[0]) || {}).containerId);
    const calc = () => { const g = feedGrams(f.amount.value, f.unit.value, f.product.value, tc), u = usable3(g, f.product.value), liq = isLiquid(f.product.value), lm = liqMeasure(f.product.value);
      const dd = m.querySelector('#fdd'); dd.innerHTML = lm && (lm.doses || []).length ? `<div class="sowchips">${lm.doses.map((v, i) => `<button type="button" class="chip${+f.amount.value === v && f.unit.value === 'mL' ? ' on' : ''}" data-dose="${v}">${lm.doses.length > 1 ? (i === 0 ? 'Weak' : i === lm.doses.length - 1 ? 'Strong' : 'Medium') + ': ' : ''}${v} mL per ${lm.per} L</button>`).join('')}</div>` : '';
      dd.querySelectorAll('[data-dose]').forEach(b => b.onclick = () => { f.amount.value = b.dataset.dose; f.unit.value = 'mL'; calc(); });
      if (lm && g && u) { m.querySelector('#fdn').innerHTML = `Amount = mL mixed into ${lm.per} L of water. ${tc && tc.type !== 'bed' ? `${esc(tc.name)} (~${Math.round(potVolume(tc) || 40)} L of soil) gets about ${potLitres(tc).toFixed(1)} L of it` : 'Each pot gets its watering amount of it'} ≈ ${(g / 1.2).toFixed(1)} mL of concentrate → <b>N ${gN(u.n)}</b> · P ${gN(u.p)} · K ${gN(u.k)} per pot.`; return; }
      m.querySelector('#fdn').innerHTML = !g ? (liq ? 'For liquid feeds, enter the amount of concentrate you measured out (not the diluted water).' : '') : !u ? `≈ ${Math.round(g)} g — analysis unknown, so it isn’t counted (put the N-P-K in the name, e.g. “Hyponex 6-10-5”).`
        : `≈ ${g < 10 ? g.toFixed(1) : Math.round(g)} g${liq ? ' of concentrate' : ''} → usable this season: <b>N ${gN(u.n)}</b> · P ${gN(u.p)} · K ${gN(u.k)}.${liq ? ' (Liquid: enter the concentrate measured out, not the diluted water.)' : ''}`; };
    f.product.addEventListener('change', () => { const pr = productByName(f.product.value); if (pr && pr.kind === 'compost' && f.unit.value === 'handful') f.unit.value = 'L'; if (isLiquid(f.product.value) && !['mL', 'L'].includes(f.unit.value)) f.unit.value = 'mL'; calc(); });
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
  feedDialog(preset, entry => { finishToggle(t, true, entry.date); t.logId = entry.id; if (typeof afterFeedTick === 'function') afterFeedTick(t, entry); }, () => render());
}
