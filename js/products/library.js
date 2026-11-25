// Your products: every fertiliser, lime, compost, soil improver, potting mix and spray is an entry you add, edit or
// remove. The app comes with none — there are far too many in the world — and looks nothing up: it picks what to suggest
// by what a product is for (base fertiliser, side-dressing, lime, compost) and its N-P-K, and a spray's crops, waiting
// time and spray limit are what you enter from its label. Products from older versions become your own entries.

import { S } from '../core/state.js';
import { uid } from '../core/util.js';
import { OLD_ALIASES, OLD_CAT_INFO, OLD_MIXES, OLD_NPK, OLD_PRODUCTS, OLD_SPRAY_RULES } from '../data/legacy-products.js';
import { customByName, DENS, DENS_ID, isLiquid } from '../feeding/nutrients.js';

export const PROD_KINDS = [['fert', '🌿', 'Fertiliser / feed'], ['lime', '🐚', 'Lime'], ['compost', '🪏', 'Compost'], ['amend', '🪨', 'Soil improver'],
  ['mix', '🪴', 'Potting mix'], ['spray', '💦', 'Spray (pesticide)'], ['homemade', '🧪', 'Home-made spray']];
export const PROD_FORMS = [['quick', 'Granular, quick (chemical)'], ['slow', 'Organic / slow'], ['liquid', 'Liquid (mixed into water)']];
export const kindOf = k => PROD_KINDS.find(x => x[0] === k) || PROD_KINDS[0];

export const defStart = p => p.form === 'liquid' ? [0, 7] : p.kind === 'compost' ? [0, 180] : p.form === 'quick' ? [0, 30] : [7, 55];
export const defAvail = p => p.form === 'liquid' || p.form === 'quick' ? 1 : p.kind === 'compost' ? 0.1 : p.kind === 'amend' || p.kind === 'lime' ? 0 : 0.7;
export const defLead = p => p.form === 'quick' || p.form === 'liquid' ? 0 : p.kind === 'fert' ? 7 : 0;
export function normProd(src) {
  const p = Object.assign({ notes: [], uses: [] }, JSON.parse(JSON.stringify(src)));
  const ci = OLD_CAT_INFO[p.tpl || p.id];
  if (p.kind === 'fert' && !p.form) p.form = ci && ci[0] || (/liquid|液/i.test(p.en) ? 'liquid' : 'slow');
  if (!p.npkv) { const n = OLD_NPK[p.tpl || p.id]; if (n) { p.npkv = [n[0], n[1], n[2]]; p.avail = n[3]; } else { const m = String(p.npk || p.en || '').match(/(\d{1,2}(?:\.\d)?)\s*-\s*(\d{1,2}(?:\.\d)?)\s*-\s*(\d{1,2}(?:\.\d)?)/); if (m) p.npkv = [+m[1], +m[2], +m[3]]; } }
  if (!p.uses.length) p.uses = ci ? ci[1].slice() : p.kind === 'fert' ? (p.form === 'liquid' ? ['side'] : ['base', 'side']) : p.kind === 'lime' ? ['lime'] : p.kind === 'compost' ? ['compost'] : [];
  if (p.start == null) { const r = ci && ci[2] || defStart(p); p.start = r[0]; p.release = r[1]; }
  if (p.lead == null) p.lead = ci ? ci[3] : defLead(p);
  if (p.avail == null) p.avail = defAvail(p);
  if (p.density == null) p.density = p.form === 'liquid' ? 1.2 : (DENS_ID[p.id] || DENS[p.kind] || 0.6);
  if (p.wait == null) p.wait = p.kind === 'spray' || p.kind === 'homemade' || p.kind === 'mix' ? null : 0;
  return p;
}
// ---------- your library ----------
// (a product you removed that your records mention is kept, hidden — so those records still count — but never offered)
export const libList = kind => (S.products || []).filter(p => !p.hidden && (!kind || [].concat(kind).includes(p.kind)));
export const libGet = id => (S.products || []).find(p => p.id === id) || null;
const nameKey = n => String(n || '').trim().toLowerCase();
export function libByName(n) {
  if (!n) return undefined; const t = String(n).trim(), lo = t.toLowerCase();
  const mine = (S.products || []).slice().sort((a, b) => !!a.hidden - !!b.hidden);   // (yours first, then ones you removed)
  const p = mine.find(x => x.id === t || nameKey(x.en) === lo || (x.ja && x.ja === t));
  if (p) return p;
  // (records from older versions may name an old product another way: it's one of yours by now)
  const a = OLD_ALIASES.find(([, re]) => re.test(t));
  return (a && mine.find(x => x.id === a[0] || x.tpl === a[0])) || undefined;
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
    S.products = OLD_PRODUCTS.filter(p => !own || own.includes(p.id)).sort((a, b) => rank(a) - rank(b)).map(p => Object.assign(normProd(p), { tpl: p.id, plenty: plenty.includes(p.id) }));
    const used = new Set(S.containers.flatMap(c => (c.mixLog || []).map(e => e.kind)));
    for (const m of OLD_MIXES) if (used.has(m.id) || m.id === 'other') S.products.push(Object.assign(normProd(Object.assign({ kind: 'mix', maker: '' }, m)), { tpl: m.id }));
    S.prodLib = 1;
  }
  // products made in the old editor (or converted from records) join the library
  const gone = new Set(S.productsRemoved || []);
  for (const x of S.customProducts || []) if (!gone.has(x.id) && !S.products.some(p => p.id === x.id)) S.products.push(normProd(Object.assign({}, x, { per: x.per || null, doses: x.doses || [] })));
}

// ---------- products by id ----------
// products come from your library only
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

// ---------- finding a product by name ----------
export const productByName = n => libByName(n);
export function migrateFeed() { if (Array.isArray(S.myProducts) && !S.kaseiAdded) { if (!S.myProducts.includes('kasei888')) S.myProducts.push('kasei888'); S.kaseiAdded = true; } }

// ---------- data version 10: no built-in products; sprays carry their own rules ----------
// Products older versions had built in that your records use become your own entries; sprays that took their rules
// from Japan's register get those rules as their own (per crop: days to wait before picking, most sprays a season), and
// the stochu recipe goes into that product's notes. Nothing of yours is lost; you can edit or remove any of it.
export function migrateOwnRules() {
  S.products = S.products || [];
  const have = id => S.products.some(p => p.id === id || p.tpl === id), add = src => { if (!have(src.id)) S.products.push(Object.assign(normProd(src), { tpl: src.id })); };
  const byName = n => { if (!n) return null; const t = String(n).trim(), lo = t.toLowerCase(), a = OLD_ALIASES.find(([, re]) => re.test(t));
    return OLD_PRODUCTS.find(x => x.id === t || x.en.toLowerCase() === lo || x.ja === t) || (a && OLD_PRODUCTS.find(x => x.id === a[0])) || null; };
  const names = [...(S.log || []).map(e => e.product), ...(S.log || []).map(e => e.productId), ...S.tasks.map(t => t.product),
    ...S.plantings.flatMap(p => [...(p.fert || []), ...(p.feedPlan || [])].map(g => g.product))];
  for (const n of names) { const o = byName(n); if (o) add(o); }
  for (const c of S.containers) for (const e of c.mixLog || []) { const m = OLD_MIXES.find(x => x.id === e.kind); if (m) add(Object.assign({ kind: 'mix', maker: '' }, m)); }
  for (const p of S.products) {
    if (p.reg) {
      const rules = OLD_SPRAY_RULES[p.reg] || {};
      p.crops = Object.fromEntries(Object.entries(rules).map(([cid, [phi, max]]) => [cid, { phi, max }]));
      delete p.reg;
    }
    if (p.kind === 'spray' && !p.crops) p.crops = {};
    delete p.mix;
    if ((p.id === 'stochu' || p.tpl === 'stochu') && S.stochu) {
      const r = S.stochu, bits = [['vinegar', 'mL vinegar'], ['wood', 'mL wood vinegar'], ['shochu', 'mL shōchū']].filter(([k]) => r[k]).map(([k, l]) => `${r[k]} ${l}`);
      const line = `My recipe: ${[...bits, r.tabasco ? `${r.tabasco} Tabasco` : ''].filter(Boolean).join(' + ')}${r.water ? ` in ${r.water} L of water` : ''}${r.note ? ` — ${r.note}` : ''}`;
      if (!(p.notes || []).includes(line)) p.notes = [...(p.notes || []), line];
    }
  }
}
