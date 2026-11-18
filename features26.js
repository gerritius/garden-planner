/* Your products: every fertiliser, lime, compost, soil improver, potting mix and spray is an entry you can add, edit
   or remove. Nothing is assumed: the app picks what to suggest by what a product is for (base fertiliser, side-dressing,
   lime, compost) and its N-P-K — not by name. The built-in list is only a catalogue (Japan) to add from.
   Your existing products (the ones you had ticked, plus the ones you made) become your library on first open. */
'use strict';

const PROD_KINDS = [['fert', '🌿', 'Fertiliser / feed'], ['lime', '🐚', 'Lime'], ['compost', '🪏', 'Compost'], ['amend', '🪨', 'Soil improver'],
  ['mix', '🪴', 'Potting mix'], ['spray', '💦', 'Spray (pesticide)'], ['homemade', '🧪', 'Home-made spray']];
const PROD_FORMS = [['quick', 'Granular, quick (chemical)'], ['slow', 'Organic / slow'], ['liquid', 'Liquid (mixed into water)']];
const kindOf = k => PROD_KINDS.find(x => x[0] === k) || PROD_KINDS[0];

// ---------- the catalogue: what the app knows about the built-in (Japan) products, as plain data ----------
const CAT_INFO = {   // form, uses, [start, release] days, lead days (to start working)
  kasei888: ['quick', ['base', 'side'], [0, 30], 0], bokashi: ['slow', ['base', 'side'], [3, 40], 7], toshoAburakasu: ['slow', ['base', 'side'], [3, 40], 7],
  chickenManure: ['slow', ['base', 'side'], [7, 55], 10], aburakasu: ['slow', ['base', 'side'], [14, 70], 21], neem: ['slow', ['base'], [14, 70], 14],
  oysterLime: [null, ['lime'], null, 0], woodAsh: [null, ['potash'], [0, 30], 0], kuntan: [null, ['improver'], null, 0],
  cowCompost: [null, ['compost'], [0, 180], 14], cowHuskCompost: [null, ['compost'], [0, 180], 14], barkCompost: [null, ['compost'], [0, 180], 7],
};
const CAT_MIXES = [   // potting mixes: built-in fertiliser N-P-K, g per litre (estimated), days it lasts
  { id: 'touikawa', en: 'Touikawa Peace Farm vegetable soil', ja: 'おいしい野菜を育てる土', npkv: [6, 36, 6], gPerL: 2, lasts: 365, what: 'slow-release 6-36-6 + magnesium (like Magamp K), feeding steadily for about a year' },
  { id: 'iris', en: 'Iris Ohyama Golden Granular Soil', ja: 'アイリスオーヤマ ゴールデン粒状培養土', npkv: [8, 8, 8], gPerL: 1, lasts: 30, what: 'starter fertiliser (about 1:1:1) that lasts about a month' },
  { id: 'other', en: 'Potting mix (with starter fertiliser)', ja: '培養土', npkv: [8, 8, 8], gPerL: 1, lasts: 30, what: 'starter fertiliser for about a month' },
];
const defStart = p => p.form === 'liquid' ? [0, 7] : p.kind === 'compost' ? [0, 180] : p.form === 'quick' ? [0, 30] : [7, 55];
const defAvail = p => p.form === 'liquid' || p.form === 'quick' ? 1 : p.kind === 'compost' ? 0.1 : p.kind === 'amend' || p.kind === 'lime' ? 0 : 0.7;
const defLead = p => p.form === 'quick' || p.form === 'liquid' ? 0 : p.kind === 'fert' ? 7 : 0;
function normProd(src) {
  const p = Object.assign({ notes: [], uses: [] }, JSON.parse(JSON.stringify(src)));
  const ci = CAT_INFO[p.id];
  if (p.kind === 'fert' && !p.form) p.form = ci && ci[0] || (/liquid|液/i.test(p.en) ? 'liquid' : 'slow');
  if (!p.npkv) { const n = NPK[p.id]; if (n) { p.npkv = [n[0], n[1], n[2]]; p.avail = n[3]; } else { const m = String(p.npk || p.en || '').match(/(\d{1,2}(?:\.\d)?)\s*-\s*(\d{1,2}(?:\.\d)?)\s*-\s*(\d{1,2}(?:\.\d)?)/); if (m) p.npkv = [+m[1], +m[2], +m[3]]; } }
  if (!p.uses.length) p.uses = ci ? ci[1].slice() : p.kind === 'fert' ? (p.form === 'liquid' ? ['side'] : ['base', 'side']) : p.kind === 'lime' ? ['lime'] : p.kind === 'compost' ? ['compost'] : [];
  if (p.start == null) { const r = ci && ci[2] || defStart(p); p.start = r[0]; p.release = r[1]; }
  if (p.lead == null) p.lead = ci ? ci[3] : defLead(p);
  if (p.avail == null) p.avail = defAvail(p);
  if (p.density == null) p.density = p.form === 'liquid' ? 1.2 : (DENS_ID[p.id] || DENS[p.kind] || 0.6);
  if (p.wait == null) p.wait = p.kind === 'spray' || p.kind === 'homemade' || p.kind === 'mix' ? null : 0;
  return p;
}
let _cat = null;
function catalogue() {
  if (!_cat) _cat = [...PRODUCTS.map(normProd), ...CAT_MIXES.map(m => normProd(Object.assign({ kind: 'mix', maker: '', organic: null }, m)))];
  return _cat;
}
const catGet = id => catalogue().find(p => p.id === id) || null;

// ---------- your library ----------
const libList = kind => (S.products || []).filter(p => !kind || [].concat(kind).includes(p.kind));
const libGet = id => (S.products || []).find(p => p.id === id) || catGet(id);
const nameKey = n => String(n || '').trim().toLowerCase();
function libByName(n) {
  if (!n) return undefined; const t = String(n).trim(), lo = t.toLowerCase();
  const mine = S.products || [];
  let p = mine.find(x => x.id === t || nameKey(x.en) === lo || (x.ja && x.ja === t));
  if (p) return p;
  const a = PROD_ALIASES.find(([, re]) => re.test(t));
  if (a) return mine.find(x => x.id === a[0] || x.tpl === a[0]) || catGet(a[0]);
  return catalogue().find(x => nameKey(x.en) === lo || (x.ja && x.ja === t)) || undefined;
}
// a product to suggest for a job: one that's for that use, the right kind of thing first, then ones you have plenty of
function pickRole(role, prefer) {
  const c = libList().filter(p => (p.uses || []).includes(role) && (role !== 'base' || (p.npkv && p.npkv[0] > 0 && p.form !== 'liquid')));
  return c.slice().sort((a, b) => ((prefer && b.form === prefer) - (prefer && a.form === prefer)) || (!!b.plenty - !!a.plenty))[0] || null;
}
function setPlenty(id, on) {
  const p = (S.products || []).find(x => x.id === id); if (p) p.plenty = on == null ? !p.plenty : !!on;
  S.plenty = libList().filter(x => x.plenty).map(x => x.id);
}
// potting mixes
const mixRow = k => { const p = libGet(k) || catGet('other'); return [p.id, p.en, p.ja || '']; };
const mixList = () => { const l = libList('mix'); return (l.length ? l : [catGet('other')]).map(p => [p.id, p.en, p.ja || '']); };
const mixFert = k => { const p = (k && libGet(k)) || catGet('other'); return { npk: p.npkv || [0, 0, 0], gPerL: p.gPerL || 0, days: p.lasts || 30, what: p.what || '' }; };

// ---------- one-time move to the library (nothing of yours is lost; old lists are kept untouched) ----------
function migrateProducts() {
  if (!S.prodLib) {
    const own = Array.isArray(S.myProducts) ? S.myProducts : null, plenty = S.plenty || [];
    // keep the order the app used to prefer them in, so suggestions don't change underneath you
    const PREF = ['kasei888', 'bokashi', 'toshoAburakasu', 'chickenManure', 'neem', 'aburakasu', 'cowCompost', 'cowHuskCompost', 'barkCompost'], rank = p => { const i = PREF.indexOf(p.id); return i < 0 ? 99 : i; };
    S.products = PRODUCTS.filter(p => !own || own.includes(p.id)).sort((a, b) => rank(a) - rank(b)).map(p => Object.assign(normProd(p), { tpl: p.id, plenty: plenty.includes(p.id) }));
    const used = new Set(S.containers.flatMap(c => (c.mixLog || []).map(e => e.kind)));
    for (const m of CAT_MIXES) if (used.has(m.id) || m.id === 'other') S.products.push(Object.assign(normProd(Object.assign({ kind: 'mix', maker: '' }, m)), { tpl: m.id }));
    S.prodLib = 1;
  }
  // products made in the old editor (or converted from records) join the library
  const gone = new Set(S.productsRemoved || []);
  for (const x of S.customProducts || []) if (!gone.has(x.id) && !S.products.some(p => p.id === x.id)) S.products.push(normProd(Object.assign({}, x, { per: x.per || null, doses: x.doses || [] })));
}

// ---------- how products are counted (same names as before, now from the library) ----------
function customByName(n) { const p = libByName(n); return p && (S.products || []).includes(p) ? p : null; }
function npkOf(name) {
  const p = libByName(name);
  if (p && p.npkv && p.npkv.some(v => v > 0)) return [p.npkv[0], p.npkv[1], p.npkv[2], p.avail ?? defAvail(p)];
  if (p && p.kind !== 'fert' && p.kind !== 'mix') return [0, 0, 0, 0];   // a known lime / compost / improver with nothing listed: no feed value
  const m = String(name || '').match(/(\d{1,2})\s*[-‐–・]\s*(\d{1,2})\s*[-‐–・]\s*(\d{1,2})/);
  return m ? [+m[1], +m[2], +m[3], 1] : null;
}
function feedGrams(amount, unit, name, c) {
  const a = +amount; if (!(a > 0)) return 0;
  const p = libByName(name), liquid = p ? p.form === 'liquid' : isLiquid(name);
  if (unit === 'kg') return a * 1000;
  if (unit === 'handful') return a * HANDFUL_G;
  if (unit === 'mL' || unit === 'L') {
    const mL = unit === 'L' ? a * 1000 : a;
    if (liquid) return (p && +p.per > 0 ? mL / p.per * potLitres(c) : mL) * 1.2;   // liquids: the concentrate
    return mL * (p ? p.density : 0.6);
  }
  return a;
}
function relOf(name) {
  if (name === 'mix:starter') return [0, 30];
  if (name === 'mix:reused' || name === 'prev') return [0, 60];
  const p = libByName(name || '');
  if (p) return p.form === 'liquid' ? [0, 7] : [p.start ?? defStart(p)[0], p.release ?? defStart(p)[1]];
  if (isLiquid(name)) return [0, 7];
  const npk = npkOf(name); return npk && npk[3] >= 1 ? [0, 30] : [7, 55];
}
const leadText = d => d <= 0 ? 'fast — works within days' : d <= 7 ? 'fairly fast — about a week' : d <= 14 ? 'medium — 1–2 weeks' : 'slow — 2–3 weeks, slower in cold soil';

// ---------- starting fertiliser: by use and N content, for any product ----------
// usable nitrogen to aim for at planting: per 40 L pot (quick or organic) or per m² of bed
const BASE_N = { bagQuick: { heavy: 4, medium: 3.2, light: 1.6, legume: 0.8 }, bagSlow: { heavy: 2.8, medium: 2, light: 1.1, legume: 0.85 }, bedM2: { heavy: 5.6, medium: 4.2, light: 2.2, legume: 1.7 } };
function gramsForN(pr, n) { const npk = npkOf(pr.en); return npk && npk[0] > 0 ? n / (npk[0] / 100 * (npk[3] || 0.7)) : 0; }
function baseFertPlan(cropId, c, from, to, sowDate) {
  if (!c) return [];
  const feed = feedOf(cropId) || 'medium', bag = c.type !== 'bed';
  const sa = soilAdvice(c, from, to, cropId), bm = sa ? sa.base : 1, cm = sa ? sa.compost : 1;
  const sr = soilReadingAdvice(c, from, to, cropId), lf = sr ? sr.lime : 1, ff = sr ? sr.feed : 1;
  const comp = pickRole('compost'), lime = pickRole('lime'), lg = gramsFor(limeRate(cropId, sr && sr.r ? sr.r.ph : null), c, from, to), out = [];
  const noN = cropId === 'satsumaimo';
  if (bag) {
    const ms = typeof mixState === 'function' ? mixState(c, sowDate || todayStr()) : null;
    if (freshMixFed(ms, sowDate)) return [];   // first crop in fresh mix: its fertiliser is already in it
    const slowMix = ms && ms.fresh && (sowDate || todayStr()) < addDays(ms.date, mixFert(ms.kind).days);   // fresh mix still feeding: half the base
    const k = ((typeof potVolume === 'function' && potVolume(c)) || 40) / 40;
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
function baseFertNote(cropId, c, sowDate) {
  const base = pickRole('base', c && c.type !== 'bed' ? 'quick' : 'slow'), bn = base ? base.en : 'a base fertiliser';
  if (c && c.type !== 'bed') {
    const ms = typeof mixState === 'function' ? mixState(c, sowDate || todayStr()) : null, mf = ms ? mixFert(ms.kind) : null;
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
function pestPlan(p) {
  const steps = [crop(p.cropId).family === 'brassica' ? 'Net at planting; check leaf undersides weekly for eggs and caterpillars.' : 'Check weekly, especially leaf undersides and new growth.'];
  const ok = libList('spray').map(pr => ({ pr, s: pr.reg ? regSummary(pr.id, p.cropId, p.variety) : null })).filter(x => x.s && x.s.ok);
  const org = ok.filter(x => x.pr.organic), syn = ok.filter(x => !x.pr.organic);
  if (org.length) steps.push('First: ' + org.map(x => `${x.pr.en} (${x.s.pests.slice(0, 3).map(pestEn).join(', ')})`).join('; ') + '.');
  if (syn.length) steps.push('Last resort: ' + syn.map(x => x.pr.en).join(', ') + '.');
  return steps.join(' ');
}

// ---------- the Products page ----------
function pageProducts() {
  setChrome('Products', { back: true, kicker: 'What you use' });
  const groups = [['Fertilisers & feeds', ['fert'], 'fert'], ['Lime, compost & soil improvers', ['lime', 'compost', 'amend'], 'compost'], ['Potting mixes', ['mix'], 'mix'], ['Sprays', ['spray', 'homemade'], 'spray']];
  const sum = p => [p.npkv && p.npkv.some(v => v > 0) ? p.npkv.join('-') : '', p.kind === 'fert' ? (PROD_FORMS.find(f => f[0] === p.form) || ['', ''])[1] : kindOf(p.kind)[2],
    p.kind === 'mix' && p.lasts ? `fertiliser for ~${p.lasts >= 60 ? Math.round(p.lasts / 30) + ' months' : p.lasts + ' days'}` : '', p.form === 'liquid' && p.per ? `${(p.doses || []).join(' or ')} mL per ${p.per} L` : '',
    p.reg ? 'registration data ✓' : '', p.plenty ? '★ plenty' : ''].filter(Boolean).join(' · ');
  A.addProd = el => productDialog(null, el.dataset.k);
  A.addCat = async el => { const c = catGet(el.dataset.id); if (!c || libGet(el.dataset.id) && (S.products || []).some(p => p.id === c.id)) return; (S.products = S.products || []).push(Object.assign(JSON.parse(JSON.stringify(c)), { tpl: c.id })); S.productsRemoved = (S.productsRemoved || []).filter(x => x !== c.id); await save(); render(); };
  const missing = catalogue().filter(c => !(S.products || []).some(p => p.id === c.id));
  const html = `<p class="hint">Everything here is yours to edit. Plans and suggestions use what each product is for and its N-P-K — tap one to change it, or add your own.</p>
    ${groups.map(([t, ks, k0]) => { const l = libList(ks); return `<section><h3>${t}</h3>${l.length ? `<ul class="plist">${l.map(p => `<li><a href="#/product/${p.id}"><span class="lic">${kindOf(p.kind)[1]}</span><span class="grow"><b>${esc(p.en)}</b>${p.ja && p.ja !== p.en ? ` <small class="ja">${esc(p.ja)}</small>` : ''}<small>${esc(sum(p))}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted small">None yet.</p>'}
      <button class="btn small" data-act="addProd" data-k="${k0}">＋ Add</button></section>`; }).join('')}
    ${missing.length ? `<details class="fold"><summary>📚 Add from the catalogue <small>${missing.length} common Japanese products</small></summary><ul class="plist">${missing.map(c => `<li><span class="lic">${kindOf(c.kind)[1]}</span><span class="grow"><b>${esc(c.en)}</b>${c.ja ? ` <small class="ja">${esc(c.ja)}</small>` : ''}<small>${esc(c.what || '')}</small></span><button class="btn small" data-act="addCat" data-id="${c.id}">＋ Add</button></li>`).join('')}</ul></details>` : ''}
    <p class="hint">Spray rules come from Japan’s official pesticide registry (農林水産省), checked ${REG_DATE}, for the sprays that have registration data. For any other spray, follow its label.</p>`;
  return { html };
}
// product page: the existing details, with Edit instead of the old "I have this" tick
function pageProductLib(id) {
  const p = libGet(id); if (!p) return { html: notFound() };
  const mine = (S.products || []).some(x => x.id === id);
  const r = pageProduct(id);
  A.editProd = () => productDialog(libGet(id));
  A.addCatHere = async () => { (S.products = S.products || []).push(Object.assign(JSON.parse(JSON.stringify(p)), { tpl: p.id })); await save(); render(); };
  r.html = r.html.replace(/<label class="inl chkline"><input type="checkbox" data-act="toggleOwn"[\s\S]*?<\/label>/, '')
    + (mine ? `<div class="btnrow"><button class="btn" data-act="editProd">✎ Edit product</button></div>` : `<div class="btnrow"><button class="btn primary" data-act="addCatHere">＋ Add to my products</button></div><p class="hint">This is from the catalogue — it isn’t in your products, so plans won’t suggest it.</p>`);
  return r;
}

// ---------- add / edit any product ----------
function productDialog(x, kind) {
  const isNew = !x;
  x = x ? JSON.parse(JSON.stringify(x)) : { id: 'p_' + uid(), en: '', ja: '', maker: '', kind: kind || 'fert', form: 'quick', npkv: null, uses: [], notes: [], organic: false };
  const orig = isNew ? null : libGet(x.id);
  const used = n => (S.log || []).some(e => e.product === n) || S.plantings.some(p => (p.fert || []).some(f => f.product === n) || (p.feedPlan || []).some(s => s.product === n)) || S.containers.some(c => (c.mixLog || []).some(e => e.kind === x.id));
  const num = v => v == null || v === '' ? '' : v;
  const draw = m => {
    const k = x.kind, liquid = k === 'fert' && x.form === 'liquid';
    m.querySelector('.sheet').innerHTML = `<h3>${isNew ? 'Add a product' : 'Edit product'}</h3><form id="pdf" class="form">
      <label>Name<input name="en" value="${esc(x.en)}" required placeholder="As on the bag or bottle"></label>
      <div class="two"><label>Japanese name <small>(optional)</small><input name="ja" value="${esc(x.ja || '')}"></label><label>Maker <small>(optional)</small><input name="maker" value="${esc(x.maker || '')}"></label></div>
      <label>Type<select name="kind">${PROD_KINDS.map(([v, i, l]) => `<option value="${v}"${v === k ? ' selected' : ''}>${i} ${l}</option>`).join('')}</select></label>
      ${k === 'fert' ? `<label>Kind of fertiliser<select name="form">${PROD_FORMS.map(([v, l]) => `<option value="${v}"${v === x.form ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      ${['fert', 'lime', 'compost', 'amend', 'mix'].includes(k) ? `<label>${k === 'mix' ? 'Fertiliser in the mix: N-P-K' : 'N-P-K (from the label)'}<div class="fgrid3"><input name="n" type="number" step="any" inputmode="decimal" value="${x.npkv ? num(x.npkv[0]) : ''}" placeholder="N"><input name="p" type="number" step="any" inputmode="decimal" value="${x.npkv ? num(x.npkv[1]) : ''}" placeholder="P"><input name="k" type="number" step="any" inputmode="decimal" value="${x.npkv ? num(x.npkv[2]) : ''}" placeholder="K"></div></label>` : ''}
      ${k === 'mix' ? `<div class="two"><label>Grams of it per litre of mix <small>(estimate)</small><input name="gPerL" type="number" step="any" inputmode="decimal" value="${num(x.gPerL)}" placeholder="e.g. 1"></label><label>Lasts about (days)<input name="lasts" type="number" inputmode="numeric" value="${num(x.lasts)}" placeholder="e.g. 30"></label></div>` : ''}
      ${liquid ? `<div class="two"><label>Doses (mL), weakest first<input name="doses" value="${esc((x.doses || []).join(', '))}" placeholder="from the label, e.g. 5, 10"></label><label>…mixed into (litres)<input name="per" type="number" step="any" inputmode="decimal" value="${num(x.per)}" placeholder="e.g. 5"></label></div>` : ''}
      ${['fert', 'lime', 'compost', 'amend'].includes(k) && !liquid ? `<div class="two"><label>If dug in, how many days before planting?<input name="wait" type="number" inputmode="numeric" value="${num(x.wait)}" placeholder="0 = same day"></label>${k === 'fert' ? `<label>Days until it starts working<input name="lead" type="number" inputmode="numeric" value="${num(x.lead)}" placeholder="0 = within days"></label>` : '<span></span>'}</div>` : ''}
      ${['fert', 'lime', 'compost', 'amend'].includes(k) ? `<label>Suggest it for</label><div class="sowchips">${[['base', 'Starting fertiliser'], ['side', 'Side-dressing / feeding'], ['lime', 'Liming'], ['compost', 'Compost / soil']].filter(([u]) => k === 'fert' ? ['base', 'side'].includes(u) : k === 'lime' ? u === 'lime' : u === 'compost').map(([u, l]) => `<label class="chip big tog"><input type="checkbox" name="use" value="${u}"${(x.uses || []).includes(u) ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>` : ''}
      ${k === 'spray' || k === 'homemade' ? `<label>What’s in it<input name="what" value="${esc(x.what || '')}" placeholder="e.g. spinosad 25%"></label>
        ${x.reg ? `<p class="hint">Crops, dilutions, uses and waiting times come from the registry for this product.</p>` : `<label>Days to wait before picking <small>(from the label)</small><input name="phi" type="number" inputmode="numeric" value="${num(x.phi)}"></label>`}` : `<label>What it is <small>(optional)</small><input name="what" value="${esc(x.what || '')}"></label>`}
      <label class="inl chkline"><input type="checkbox" name="organic"${x.organic ? ' checked' : ''}> <span>Organic</span></label>
      ${['fert', 'lime', 'compost', 'amend'].includes(k) ? `<label class="inl chkline"><input type="checkbox" name="plenty"${x.plenty ? ' checked' : ''}> <span>I have plenty of this <small>(suggested first)</small></span></label>` : ''}
      <label>Notes <small>(one per line)</small><textarea name="notes" rows="3">${esc((x.notes || []).join('\n'))}</textarea></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del" data-own-confirm>Remove</button>'}<button class="btn primary">Save</button></div></form>`;
    const f = m.querySelector('#pdf');
    const keep = () => { x.en = f.en.value; x.ja = f.ja.value; x.maker = f.maker.value; };
    f.kind.onchange = () => { keep(); x.kind = f.kind.value; if (x.kind !== 'fert') x.form = null; else x.form = x.form || 'quick'; x.uses = normProd({ id: '', kind: x.kind, form: x.form, en: '' }).uses; draw(m); };
    if (f.form) f.form.onchange = () => { keep(); x.form = f.form.value; draw(m); };
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = () => m._close();
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      if (!await confirmBox(used(x.en) ? `Remove <b>${esc(x.en)}</b> from your products? Your records that mention it stay as they are.` : `Remove <b>${esc(x.en)}</b> from your products?`, 'Remove', true)) return productDialog(orig);
      S.products = S.products.filter(p => p.id !== x.id); (S.productsRemoved = S.productsRemoved || []).push(x.id); setPlenty('');
      await save(); render();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const n = f.n ? [f.n.value, f.p.value, f.k.value].map(v => v === '' ? 0 : +v) : null, oldName = orig ? orig.en : null;
      Object.assign(x, { en: f.en.value.trim(), ja: f.ja.value.trim(), maker: f.maker.value.trim(), kind: f.kind.value, what: f.what ? f.what.value.trim() : x.what,
        npkv: n && n.some(v => v > 0) ? n : (x.kind === 'mix' ? n : null), organic: f.organic.checked, notes: f.notes.value.split('\n').map(s => s.trim()).filter(Boolean),
        uses: f.querySelectorAll('input[name=use]').length ? [...f.querySelectorAll('input[name=use]:checked')].map(i => i.value) : x.uses, plenty: f.plenty ? f.plenty.checked : x.plenty });
      if (f.form) x.form = f.form.value;
      if (f.wait) x.wait = f.wait.value === '' ? 0 : +f.wait.value;
      if (f.lead) x.lead = f.lead.value === '' ? defLead(x) : +f.lead.value;
      if (f.gPerL) { x.gPerL = +f.gPerL.value || 0; x.lasts = +f.lasts.value || 30; }
      if (f.per) { x.per = +f.per.value || null; x.doses = f.doses.value.split(/[,、\s]+/).map(Number).filter(v => v > 0).sort((a, b) => a - b); }
      if (f.phi) x.phi = f.phi.value === '' ? null : +f.phi.value;
      if (!x.en) return;
      // what the app needs to count it (release time, how much is usable) follows the kind unless set
      const d = normProd(Object.assign({}, x, { start: null, release: null, avail: null, density: null, lead: x.lead }));
      if (!orig || orig.form !== x.form || orig.kind !== x.kind) Object.assign(x, { start: d.start, release: d.release, avail: d.avail, density: d.density });
      x = normProd(x);
      S.products = S.products || [];
      const i = S.products.findIndex(p => p.id === x.id); if (i >= 0) S.products[i] = x; else S.products.push(x);
      setPlenty(x.id, x.plenty);
      if (oldName && oldName !== x.en) {   // a rename carries through to records and plans
        for (const l of S.log || []) if (l.product === oldName) l.product = x.en;
        for (const p of S.plantings) { for (const g of p.fert || []) if (g.product === oldName) g.product = x.en; for (const s of p.feedPlan || []) if (s.product === oldName) s.product = x.en; }
        for (const t of S.tasks) if (t.product === oldName) { t.product = x.en; t.title = (t.title || '').split(oldName).join(x.en); }
      }
      m._close(); await save(); render();
    };
  };
  modal('<div></div>', m => draw(m));
}
