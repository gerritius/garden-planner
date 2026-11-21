// Your products: every fertiliser, lime, compost, soil improver, potting mix and spray is an entry you can add, edit
// or remove. Nothing is assumed: the app picks what to suggest by what a product is for (base fertiliser, side-dressing,
// lime, compost) and its N-P-K — not by name. The built-in list is only a catalogue (Japan) to add from.
// Older lists (ticked products, your own products) are moved into the library once; nothing of yours is lost.

import { S } from '../core/state.js';
import { uid } from '../core/util.js';
import { NPK, PRODUCTS } from '../data/products.js';
import { customByName, DENS, DENS_ID, isLiquid } from '../feeding/nutrients.js';

export const PROD_KINDS = [['fert', '🌿', 'Fertiliser / feed'], ['lime', '🐚', 'Lime'], ['compost', '🪏', 'Compost'], ['amend', '🪨', 'Soil improver'],
  ['mix', '🪴', 'Potting mix'], ['spray', '💦', 'Spray (pesticide)'], ['homemade', '🧪', 'Home-made spray']];
export const PROD_FORMS = [['quick', 'Granular, quick (chemical)'], ['slow', 'Organic / slow'], ['liquid', 'Liquid (mixed into water)']];
export const kindOf = k => PROD_KINDS.find(x => x[0] === k) || PROD_KINDS[0];

// ---------- the catalogue (built-in Japan products, as plain data) ----------
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
export const defStart = p => p.form === 'liquid' ? [0, 7] : p.kind === 'compost' ? [0, 180] : p.form === 'quick' ? [0, 30] : [7, 55];
export const defAvail = p => p.form === 'liquid' || p.form === 'quick' ? 1 : p.kind === 'compost' ? 0.1 : p.kind === 'amend' || p.kind === 'lime' ? 0 : 0.7;
export const defLead = p => p.form === 'quick' || p.form === 'liquid' ? 0 : p.kind === 'fert' ? 7 : 0;
export function normProd(src) {
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
export function catalogue() {
  if (!_cat) _cat = [...PRODUCTS.map(normProd), ...CAT_MIXES.map(m => normProd(Object.assign({ kind: 'mix', maker: '', organic: null }, m)))];
  return _cat;
}
export const catGet = id => catalogue().find(p => p.id === id) || null;

// ---------- your library ----------
export const libList = kind => (S.products || []).filter(p => !kind || [].concat(kind).includes(p.kind));
export const libGet = id => (S.products || []).find(p => p.id === id) || catGet(id);
const nameKey = n => String(n || '').trim().toLowerCase();
export function libByName(n) {
  if (!n) return undefined; const t = String(n).trim(), lo = t.toLowerCase();
  const mine = S.products || [];
  let p = mine.find(x => x.id === t || nameKey(x.en) === lo || (x.ja && x.ja === t));
  if (p) return p;
  const a = PROD_ALIASES.find(([, re]) => re.test(t));
  if (a) return mine.find(x => x.id === a[0] || x.tpl === a[0]) || catGet(a[0]);
  return catalogue().find(x => nameKey(x.en) === lo || (x.ja && x.ja === t)) || undefined;
}
// a product to suggest for a job: one that's for that use, the right kind of thing first, then ones you have plenty of
export function pickRole(role, prefer) {
  const c = libList().filter(p => (p.uses || []).includes(role) && (role !== 'base' || (p.npkv && p.npkv[0] > 0 && p.form !== 'liquid')));
  return c.slice().sort((a, b) => ((prefer && b.form === prefer) - (prefer && a.form === prefer)) || (!!b.plenty - !!a.plenty))[0] || null;
}
export function setPlenty(id, on) {
  const p = (S.products || []).find(x => x.id === id); if (p) p.plenty = on == null ? !p.plenty : !!on;
  S.plenty = libList().filter(x => x.plenty).map(x => x.id);
}

// ---------- one-time move to the library (nothing of yours is lost; old lists are kept untouched) ----------
export function migrateProducts() {
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

// ---------- products by id ----------
// products come from your library; PRODUCTS (data/products.js) is only the catalogue to add from
export const product = id => libGet(id);
export const myProducts = kind => libList(kind);

// ---------- moving your own products into the library ----------
// Liquid feeds typed in by name with an N-P-K (e.g. "XYZ Liquid 6-6-7") become your own products, so they can be given
// a mixing measure (mL per so many litres). Names that only differ in spelling/case are merged into one.
export function migrateOwnProducts() {
  if (S.ownMigrated2) return; S.ownMigrated2 = true;
  const all = [...S.plantings.flatMap(p => [...(p.feedPlan || []), ...(p.fert || [])].map(f => f.product)), ...(S.log || []).map(e => e.product), ...S.tasks.map(t => t.product)].filter(Boolean);
  const key = n => n.toLowerCase().replace(/\s+/g, ' ').trim(), groups = {};
  for (const n of all) { if (!isLiquid(n) || !/\d{1,2}\s*-\s*\d{1,2}\s*-\s*\d{1,2}/.test(n) || (productByName(n) && !customByName(n))) continue; (groups[key(n)] = groups[key(n)] || []).push(n); }
  for (const names of Object.values(groups)) {
    const existing = names.map(customByName).find(Boolean);
    const en = existing ? existing.en : Object.entries(names.reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0][0];
    if (!existing) {
      const m = en.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})/), id = 'cust_' + uid();
      (S.customProducts = S.customProducts || []).push({ id, en, ja: '', form: 'liquid', kind: 'fert', npkv: [+m[1], +m[2], +m[3]], npk: `${m[1]}-${m[2]}-${m[3]}`, per: null, doses: [], custom: true });
      if (S.myProducts && !S.myProducts.includes(id)) S.myProducts.push(id);
    }
    const fix = o => { if (o && o.product && o.product !== en && key(o.product) === key(en)) o.product = en; };
    (S.log || []).forEach(fix); S.tasks.forEach(t => { if (t.product && t.product !== en && key(t.product) === key(en)) { t.title = (t.title || '').split(t.product).join(en); fix(t); } });
    S.plantings.forEach(p => { (p.fert || []).forEach(fix); (p.feedPlan || []).forEach(fix); });
  }
}

// ---------- finding a product by name; older lists ----------
// forgiving: exact names first, then the usual English/Japanese names however they're typed
const PROD_ALIASES = [
  ['toshoAburakasu', /tosho|東商|超醗酵|超発酵|発酵油|醗酵油|fermented\s*(abura|oil)/i], ['aburakasu', /abura\s*kasu|油\s*かす|油\s*粕|油カス|oil\s*-?\s*cake/i],
  ['chickenManure', /chicken|鶏\s*ふん|鶏\s*糞|鶏フン/i], ['bokashi', /bokashi|ぼかし|ボカシ/i], ['neem', /neem|ニーム/i],
  ['oysterLime', /oyster|かき殻|牡蠣|カキ殻|有機石灰/i], ['cowHuskCompost', /husk|もみ殻|籾殻/i], ['cowCompost', /cow|牛\s*ふん|牛\s*糞|牛フン/i],
  ['barkCompost', /bark|バーク/i], ['kasei888', /8\s*-\s*8\s*-\s*8|化成/i],
];
export const productByName = n => libByName(n);
export function migrateFeed() { if (Array.isArray(S.myProducts) && !S.kaseiAdded) { if (!S.myProducts.includes('kasei888')) S.myProducts.push('kasei888'); S.kaseiAdded = true; } }
