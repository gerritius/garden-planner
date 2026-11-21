// Feeding jobs: starting fertiliser for any product, care jobs with amounts, repeating feeds (e.g. weekly liquid) — folded
// into the watering job when they're due — and recording what you actually used when a feeding job is ticked.

import { applyClimate, normalT, potVolume } from '../climate/climate.js';
import { render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { addDays, esc, num, todayStr, uid, unitOpts } from '../core/util.js';
import { HANDFUL_G } from '../data/catalog.js';
import { Draw } from '../draw.js';
import { container, isLive, planting } from '../garden/garden.js';
import { feedOf, gramsFor, limeRate, soilAdvice, soilM2, soilReadingAdvice } from '../garden/soil.js';
import { finishToggle } from '../garden/tasks.js';
import { waterPots } from '../garden/watering.js';
import { crop } from '../plants/crops.js';
import { growthDate, harvestWindow } from '../plants/growth.js';
import { libList, myProducts, pickRole, productByName } from '../products/library.js';
import { pestEn, regSummary } from '../products/sprays.js';
import { feedLedger } from './ledger.js';
import { mixFert, mixRow, mixState } from './mix.js';
import { amtFor, feedGrams, gN, isLiquid, liqMeasure, npkOf, potLitres, usable3 } from './nutrients.js';
import { feedSim, poolOn } from './sim.js';
import { feedSeason, inLean, nextGrowing, restartTemp } from './stages.js';

export const effOf = (name, amount, unit, c) => usable3(feedGrams(amount, unit, name, c), name) || { n: 0, p: 0, k: 0 };
export const isPotOutdoor = c => c && c.type !== 'bed' && !c.indoor;
export function feedEnd(p) { const w = p.harvestDate ? harvestWindow(p) : null; return w ? (crop(p.cropId).cont ? w.keep : w.mature) : addDays(p.sowDate, 120); }

// ---------- repeating feeds ----------
// outdoors, no feeding while it's too cold for roots to take it up — the schedule picks up again when growth restarts
const dormant = (p, d) => { const c = container(p.containerId); if (c && c.indoor) return false; if (normalT(d) < restartTemp(p.cropId)) return true; const se = feedSeason(p); return !!(se && se.bolt && inLean(se, d)); };   // + heading brassicas' lean stretch before winter
export function schedOccurrences(p, s, fromDate) {
  const out = [], end = s.end || feedEnd(p);
  for (let d = fromDate || (s.last ? addDays(s.last, s.every) : s.start), i = 0; d <= end && i < 80; d = addDays(d, s.every), i++) if (!dormant(p, d)) out.push(d);
  return out;
}
// planned (future) doses from repeating feeds, beyond the one already waiting as a job — for the ledger
export function schedPlanned(p) {
  const out = [];
  for (const s of p.feedPlan || []) {
    if (s.stopped || s.paused) continue;
    const open = S.tasks.find(t => t.schedId === s.id && !t.done), e = effOf(s.product, s.amount, s.unit, container(p.containerId));
    const ds = schedOccurrences(p, s).filter(d => !open || d > open.due);
    for (const d of ds) out.push({ t: { due: d, schedId: s.id }, sid: s.id, name: s.product, n: e.n, p: e.p, k: e.k, text: `${s.product} ${amtFor(s.product, s.amount, s.unit)} (every ${s.every} days)` });
  }
  return out;
}
// keep one job waiting for each repeating feed; stop when the crop has enough or the meter shows salt DANGER
export function syncFeedPlans() {
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
      const L = feedLedger(p), c = container(p.containerId), e = effOf(s.product, s.amount, s.unit, c), sr = c && soilReadingAdvice(c, p.from, p.to, p.cropId);
      if (sr && sr.feed < 1) { s.paused = 'salt'; if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
      // skip feeds while the soil still holds plenty; stop for good if nothing more is needed this season
      const sim = L && L.need ? feedSim(p, L, [], x => x.sid === s.id || x.t.schedId === s.id || (open && x.t === open)) : null;
      if (sim) {
        let tries = 0; while (next <= end && poolOn(sim, next) + e.n > sim.maxPool && tries++ < 30) next = addDays(next, s.every);
        if (next > end || (!sim.shortFrom && poolOn(sim, next) + e.n > sim.maxPool * 0.5 && sim.left > sim.maxPool * 0.2)) { s.paused = 'enough'; if (open) S.tasks = S.tasks.filter(x => x !== open); continue; }
      }
      s.paused = null;
      const title = `${isLiquid(s.product) ? 'Liquid feed' : 'Feed'}: ${s.product} ${amtFor(s.product, s.amount, s.unit)}`;
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
export function waterFeedsDue(waterDue) {
  const pots = new Set(waterPots().map(c => c.id));
  return S.tasks.filter(t => !t.done && t.withWater && t.kind === 'feed' && planting(t.plantingId) && pots.has(planting(t.plantingId).containerId) && t.due <= waterDue);
}
export function earliestWaterFeed() {
  const pots = new Set(waterPots().map(c => c.id));
  return S.tasks.filter(t => !t.done && t.withWater && planting(t.plantingId) && pots.has(planting(t.plantingId).containerId)).map(t => t.due).sort()[0] || null;
}
// ticking the combined job records each liquid feed as given that day
export function completeWaterFeeds(wt, date) {
  for (const id of wt.feeds || []) {
    const t = S.tasks.find(x => x.id === id && !x.done); if (!t) continue;
    const pr = productByName(t.product), e = { id: uid(), date, kind: 'fert', product: t.product, productId: pr ? pr.id : null, amount: t.amount, unit: t.unit, pids: [t.plantingId], cids: [], text: 'with watering' };
    (S.log = S.log || []).push(e); t.done = true; t.doneOn = date; t.logId = e.id; afterFeedTick(t, e);
  }
}

// ---------- care jobs ----------
// recommended starting (base) fertiliser for a crop in this bed section or bag
// planting the first crop into fresh mix while its own fertiliser is still working (Touikawa ~a year, others ~2 months)
const freshMixFed = (ms, sowDate) => !!(ms && ms.fresh && ms.firstCrop && (sowDate || todayStr()) < addDays(ms.date, Math.max(60, mixFert(ms.kind).days)));
// suggested jobs = catalogue jobs + top-dressing with my products + weekly pest check
export const FRUITING = ['tomato', 'minitomato', 'nasu', 'piman', 'chilli', 'shishito', 'kyuri', 'zucchini'];
export function careJobs(cropId) {
  const cr = crop(cropId);
  // feeding is planned from the Feeding card, so side-dressing isn't a plain job any more (earthing up stays)
  const jobs = (cr.jobs || []).map(j => j.slice()).filter(j => !/追肥|side-dress|止め肥/i.test(j[0]) || /earth up|土寄せ/i.test(j[0])).map(j => /追肥|side-dress/i.test(j[0]) ? ['Earth up (土寄せ)', ...j.slice(1)] : j);
  if (FRUITING.includes(cropId) || cr.family === 'brassica' || ['strawberry', 'soramame', 'edamame', 'lettuce'].includes(cropId))
    jobs.push(['Pest check (害虫チェック) – undersides & new growth', 7, 1, 'week']);
  return jobs;
}
// When a care job starts. Its days after sowing / planting are days of growth, at the pace the temperature allows, so
// a cold spell pushes it back. Supports — nets, trellises, stakes, canes, tying in — for a crop that goes through winter
// go up when it grows again in spring, not before: autumn-sown peas stay low until then and only climb in spring, and a
// net up all winter is only something to be blown about or to crush them. Insect netting is a cover, not a support: it goes on at planting.
const SUPPORT = /trellis|\bnet\b|stake|support|cane|tie (in|stems)|支柱|誘引|ネット\)/i, NOT_SUPPORT = /insect|防虫/i;
export function careJobStart(p, j) {
  const from = p.sowDate || todayStr(), days = +j[1] || 0;
  if (!days) return from;
  let d = growthDate(p.cropId, from, days, p.containerId);
  if (SUPPORT.test(j[0]) && !NOT_SUPPORT.test(j[0])) { const s = feedSeason(Object.assign({}, p, { sowDate: from })); if (s && d < s.we) d = s.we; }   // it overwinters: supports in spring
  return d;
}
// data version 7: care jobs that haven't come up yet (not done, still ahead) move to the dates growth gives them
export function migrateCareJobTimes() {
  applyClimate();   // your location's temperatures, not the defaults
  const td = todayStr();
  for (const p of S.plantings || []) {
    if (!p.sowDate || p.status === 'harvested') continue;
    const jobs = careJobs(p.cropId);
    for (const s of p.series || []) {
      const j = jobs.find(x => x[0] === s.title && +x[1] > 0);
      if (!j || !s.start || s.start <= td || (S.tasks || []).some(t => t.seriesId === s.id && t.done)) continue;
      const nd = careJobStart(p, j); if (nd === s.start) continue;
      s.start = nd; const t = (S.tasks || []).find(x => x.seriesId === s.id && !x.done); if (t) t.due = nd;
    }
  }
}
// resolve a job's product amount for a planting at save time
export function jobAmount(j, c, p) {
  const f = j[4]; if (!f) return { product: '', amount: null, unit: '' };
  if (f.perPlant) { const n = c ? Draw.count(c, p) || 1 : 1; return { product: f.product, amount: f.perPlant * n, unit: 'handful' }; }
  const area = c ? soilM2(c, p.from, p.to) : 0.12;
  return { product: f.product, amount: Math.max(10, Math.round(f.perM2 * area / 5) * 5), unit: 'g' };
}
export const jobAmountText = j => !j[4] ? '' : j[4].perPlant ? ` · ${j[4].product}, 1 handful per plant` : ` · ${j[4].product}, ~${j[4].perM2} g/m²`;

// ---------- record a feeding ----------
export function feedDialog(e, onSave, onCancel) {
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
      const dd = m.querySelector('#fdd'), key = lm ? lm.id + ':' + (lm.doses || []).join(',') + '/' + lm.per : '';
      if (dd.dataset.for !== key) {   // only redraw when the product changes — a redraw mid-tap would swallow the tap
        dd.dataset.for = key;
        dd.innerHTML = lm && (lm.doses || []).length ? `<div class="sowchips">${lm.doses.map((v, i) => `<button type="button" class="chip${+f.amount.value === v && f.unit.value === 'mL' ? ' on' : ''}" data-dose="${v}">${lm.doses.length > 1 ? (i === 0 ? 'Weak' : i === lm.doses.length - 1 ? 'Strong' : 'Medium') + ': ' : ''}${v} mL per ${lm.per} L</button>`).join('')}</div>` : '';
        dd.querySelectorAll('[data-dose]').forEach(b => b.onclick = () => { f.amount.value = b.dataset.dose; f.unit.value = 'mL'; calc(); });
      }
      dd.querySelectorAll('[data-dose]').forEach(b => b.classList.toggle('on', +f.amount.value === +b.dataset.dose && f.unit.value === 'mL'));
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
export function feedTaskProduct(t) {
  if (t.product) return { product: t.product, amount: t.amount, unit: t.unit };
  const p = t.plantingId && planting(t.plantingId), s = p && t.seriesId && (p.series || []).find(x => x.id === t.seriesId);
  return s && s.product ? { product: s.product, amount: s.amount, unit: s.unit } : null;
}
export function tickFeedTask(t) {
  const f = feedTaskProduct(t), td = todayStr();
  const preset = Object.assign({ date: t.due && t.due < td ? t.due : td }, f, t.plantingId ? { pids: [t.plantingId] } : { cids: [t.containerId] });
  feedDialog(preset, entry => { finishToggle(t, true, entry.date); t.logId = entry.id; afterFeedTick(t, entry); }, () => render());
}

// ---------- starting fertiliser: by use and N content, for any product ----------
// usable nitrogen to aim for at planting: per 40 L pot (quick or organic) or per m² of bed
const BASE_N = { bagQuick: { heavy: 4, medium: 3.2, light: 1.6, legume: 0.8 }, bagSlow: { heavy: 2.8, medium: 2, light: 1.1, legume: 0.85 }, bedM2: { heavy: 5.6, medium: 4.2, light: 2.2, legume: 1.7 } };
function gramsForN(pr, n) { const npk = npkOf(pr.en); return npk && npk[0] > 0 ? n / (npk[0] / 100 * (npk[3] || 0.7)) : 0; }
export function baseFertPlan(cropId, c, from, to, sowDate) {
  if (!c) return [];
  const feed = feedOf(cropId) || 'medium', bag = c.type !== 'bed';
  const sa = soilAdvice(c, from, to, cropId), bm = sa ? sa.base : 1, cm = sa ? sa.compost : 1;
  const sr = soilReadingAdvice(c, from, to, cropId), lf = sr ? sr.lime : 1, ff = sr ? sr.feed : 1;
  const comp = pickRole('compost'), lime = pickRole('lime'), lg = gramsFor(limeRate(cropId, sr && sr.r ? sr.r.ph : null), c, from, to), out = [];
  const noN = cropId === 'satsumaimo';
  if (bag) {
    const ms = mixState(c, sowDate || todayStr());
    if (freshMixFed(ms, sowDate)) return [];   // first crop in fresh mix: its fertiliser is already in it
    const slowMix = ms && ms.fresh && (sowDate || todayStr()) < addDays(ms.date, mixFert(ms.kind).days);   // fresh mix still feeding: half the base
    const k = ((potVolume(c)) || 40) / 40;
    if (comp && !slowMix) out.push({ product: comp.en, amount: Math.round(4 * cm * k), unit: 'L' });
    const fert = pickRole('base', 'quick');
    if (fert && !noN) out.push({ product: fert.en, amount: Math.round(gramsForN(fert, BASE_N[fert.form === 'quick' ? 'bagQuick' : 'bagSlow'][feed] * k * bm * ff * (slowMix ? 0.5 : 1)) / 5) * 5, unit: 'g' });
    if (lime && lg > 0 && lf > 0 && !slowMix) out.push({ product: lime.en, amount: lg, unit: 'g' });
    return out.filter(x => x.amount > 0);
  }
  const area = soilM2(c, from, to);
  if (comp) out.push({ product: comp.en, amount: Math.round(area * 2 * cm * 10) / 10, unit: 'kg' });
  if (lime && lg > 0 && lf > 0) out.push({ product: lime.en, amount: lg, unit: 'g' });
  const fert = pickRole('base', 'slow');
  if (fert && !noN) { const g = gramsForN(fert, BASE_N.bedM2[feed] * area * bm * ff);
    out.push(fert.form === 'quick' || g < 15 ? { product: fert.en, amount: Math.max(5, Math.round(g / 5) * 5), unit: 'g' } : { product: fert.en, amount: Math.max(0.5, Math.round(g / HANDFUL_G * 2) / 2), unit: 'handful' }); }
  return out.filter(x => x.amount > 0);
}
const whenIn = p => !p.wait ? 'can go in on planting day' : `dig in ${p.wait >= 14 ? `${Math.round(p.wait / 7)}–${Math.round(p.wait / 7) + 1} weeks` : 'about a week'} before planting`;
export function baseFertNote(cropId, c, sowDate) {
  const base = pickRole('base', c && c.type !== 'bed' ? 'quick' : 'slow'), bn = base ? base.en : 'a base fertiliser';
  if (c && c.type !== 'bed') {
    const ms = mixState(c, sowDate || todayStr()), mf = ms ? mixFert(ms.kind) : null;
    if (freshMixFed(ms, sowDate)) return 'fresh potting mix: no fertiliser needed — it’s already in the mix';
    if (ms && ms.fresh && todayStr() < addDays(ms.date, mf.days)) return mf.days > 60 ? `fresh ${mixRow(ms.kind)[1]}: its built-in fertiliser keeps feeding for about ${Math.round(mf.days / 30)} months — add half the usual ${bn} for nitrogen; no lime needed` : `fresh potting mix: its starter fertiliser only lasts about a month — half the usual ${bn} mixed through; no lime needed`;
    const comp = pickRole('compost');
    return `re-used potting mix: ${comp ? comp.en : 'compost'} plus ${bn} mixed through before planting`;
  }
  const bits = [], comp = pickRole('compost'), lime = pickRole('lime');
  if (comp) bits.push(`${comp.en}: ${whenIn(comp)}`);
  if (lime) bits.push(`${lime.en}: ${whenIn(lime)}`);
  if (base) bits.push(`${base.en}: ${whenIn(base)}`);
  if (cropId === 'potato') bits.push('no lime for potatoes (scab)');
  if (cropId === 'satsumaimo') bits.push('no nitrogen fertiliser for sweet potato — rich soil gives leaves, not tubers (つるぼけ)');
  if (['carrot', 'daikon', 'hatsuka', 'kabu'].includes(cropId)) bits.push('keep compost well mixed and at least 3 weeks old for root crops');
  return bits.join(' · ');
}
// pests: organic sprays allowed on this crop first, others as a last resort — from your sprays, not fixed names
export function pestPlan(p) {
  const steps = [crop(p.cropId).family === 'brassica' ? 'Net at planting; check leaf undersides weekly for eggs and caterpillars.' : 'Check weekly, especially leaf undersides and new growth.'];
  const ok = libList('spray').map(pr => ({ pr, s: pr.reg ? regSummary(pr.id, p.cropId, p.variety) : null })).filter(x => x.s && x.s.ok);
  const org = ok.filter(x => x.pr.organic), syn = ok.filter(x => !x.pr.organic);
  if (org.length) steps.push('First: ' + org.map(x => `${x.pr.en} (${x.s.pests.slice(0, 3).map(pestEn).join(', ')})`).join('; ') + '.');
  if (syn.length) steps.push('Last resort: ' + syn.map(x => x.pr.en).join(', ') + '.');
  return steps.join(' ');
}
