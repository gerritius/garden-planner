// Counting nutrients: N-P-K of each product, how much of it plants can use this season, grams from a dose (including
// liquid feeds mixed into the can), and how much the crop needs for its space.

import { potVolume } from '../climate/climate.js';
import { S } from '../core/state.js';
import { fmtAmt } from '../core/util.js';
import { HANDFUL_G } from '../data/catalog.js';
import { Draw } from '../draw.js';
import { defAvail, defStart, libByName } from '../products/library.js';

// ---------- what crops need ----------
// typical nitrogen for the whole crop, g per m² (= kg/10a in Japanese 施肥基準), incl. side-dressing
export const N_NEED = {
  hakusai: 25, cabbage: 25, broccoli: 22, cauliflower: 22, daikon: 12, carrot: 12, komatsuna: 12, chingensai: 12, mizuna: 12, kabu: 12, hatsuka: 6,
  spinach: 15, lettuce: 12, shungiku: 15, celery: 35, tomato: 22, minitomato: 22, nasu: 30, piman: 28, shishito: 28, chilli: 25, kyuri: 28, zucchini: 20,
  potato: 10, satsumaimo: 3, satoimo: 20, edamame: 3, ingen: 8, snappea: 8, sayaendo: 8, soramame: 10, onion: 22, naganegi: 25, hatamanegi: 15, garlic: 20,
  corn: 22, strawberry: 20, nanohana: 18,
};
export const areaOf = (c, p) => c.type === 'bed' ? (p ? Draw.dims(c).W * (p.to - p.from) / 1e4 : Draw.dims(c).W * Draw.dims(c).L / 1e4) : (c.type === 'round' ? Math.PI * (c.diameter / 200) ** 2 : c.width * c.length / 1e4);

// ---------- how much of each nutrient plants can use ----------
// how much of each nutrient plants can use this season
function availPK(npk) { return npk[3] >= 1 ? [0.8, 1] : npk[0] === 0 ? [0.6, 1] : npk[3] < 0.2 ? [0.3, 0.7] : [0.6, 0.8]; }
// typical P (as P₂O₅) and K (as K₂O) per m² over the season (Japanese 施肥基準, kg/10a = g/m²)
export const P_NEED = { hakusai: 20, cabbage: 20, broccoli: 20, cauliflower: 20, daikon: 10, carrot: 12, komatsuna: 10, chingensai: 10, mizuna: 10, kabu: 10, hatsuka: 6, spinach: 12, lettuce: 12, shungiku: 12, celery: 30,
  tomato: 20, minitomato: 20, nasu: 25, piman: 25, shishito: 25, chilli: 20, kyuri: 25, zucchini: 20, potato: 15, satsumaimo: 8, satoimo: 20, edamame: 8, ingen: 10, snappea: 10, sayaendo: 10, soramame: 10,
  onion: 20, naganegi: 15, hatamanegi: 10, garlic: 15, corn: 20, strawberry: 20, nanohana: 15 };
export const K_NEED = { hakusai: 25, cabbage: 25, broccoli: 20, cauliflower: 20, daikon: 12, carrot: 15, komatsuna: 10, chingensai: 10, mizuna: 10, kabu: 12, hatsuka: 6, spinach: 12, lettuce: 12, shungiku: 12, celery: 30,
  tomato: 25, minitomato: 25, nasu: 25, piman: 25, shishito: 25, chilli: 20, kyuri: 25, zucchini: 20, potato: 15, satsumaimo: 20, satoimo: 20, edamame: 10, ingen: 10, snappea: 10, sayaendo: 10, soramame: 12,
  onion: 20, naganegi: 20, hatamanegi: 12, garlic: 15, corn: 20, strawberry: 20, nanohana: 15 };
export const DENS = { compost: 0.5, lime: 0.9, fert: 0.6, amend: 0.15 };   // g per mL for solids measured by volume
export const DENS_ID = { woodAsh: 0.5, kuntan: 0.15 };
export const isLiquid = n => { const p = libByName(n); return p ? p.form === 'liquid' : /液|liquid|hyponex|ハイポネックス|リキッド/i.test(n || ''); };

// ---------- grams from an amount ----------
// usable N, P, K (g) this season — null if the analysis is unknown
export function usable3(g, name, seasons = 0) {
  const npk = npkOf(name); if (!npk) return null;
  const [ap, ak] = availPK(npk), later = seasons > 0;
  return { n: g * npk[0] / 100 * (later ? (npk[3] < 0.2 ? 0.05 : 0) : npk[3]), p: g * npk[1] / 100 * (later ? 0.05 : ap), k: g * npk[2] / 100 * (later ? 0.05 : ak) };
}
export const NAME_N = 'nitrogen';
// space a crop occupies, in m² (bags: a "soil-volume" equivalent, since pots need more per area)
export function feedArea(c, p) { if (c.type === 'bed') return Draw.dims(c).W * ((p ? p.to - p.from : Draw.dims(c).L)) / 1e4; return Math.max(areaOf(c), (potVolume(c) || 40) / 150); }
export const gN = v => v >= 10 ? Math.round(v) + ' g' : (Math.round(v * 10) / 10) + ' g';

// litres of (diluted) feed a pot gets: your watering amount (per 40 L bag, Tools → Reminders) scaled to this pot's soil volume
export const potLitres = c => ((S.water && +S.water.perBagL) || 4) * (c && c.type !== 'bed' ? (potVolume(c) || 40) / 40 : 1);
// liquid with a mixing measure: amounts in mL are "mL per <per> L of water", and each pot gets potLitres() of that
export const liqMeasure = name => { const pr = customByName(name); return pr && pr.form === 'liquid' && +pr.per > 0 ? pr : null; };
// how an amount reads for this product (e.g. "5 mL per 5 L (weak)")
export function amtFor(name, amount, unit) {
  const pr = liqMeasure(name);
  if (!pr || unit !== 'mL') return fmtAmt(amount, unit);
  const i = (pr.doses || []).indexOf(+amount), lbl = i < 0 ? '' : pr.doses.length === 1 ? '' : i === 0 ? ' (weak)' : i === pr.doses.length - 1 ? ' (strong)' : '';
  return `${amount} mL per ${pr.per} L${lbl}`;
}
// a normal dose: liquids snap to the strengths you mix (weak / strong)
export function doseOf(name, nPerDose, bag, c) {
  const npk = npkOf(name); if (!npk || !npk[0]) return null;
  if (isLiquid(name)) {
    const conc = nPerDose / (1.2 * npk[0] / 100), pr = liqMeasure(name);
    if (pr) { const want = conc * pr.per / potLitres(c), ds = (pr.doses || []).slice().sort((a, b) => a - b); return { amount: ds.length ? ds.reduce((b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b), ds[0]) : Math.max(1, Math.round(want)), unit: 'mL' }; }
    return { amount: Math.max(1, Math.round(conc)), unit: 'mL' };
  }
  const g = nPerDose / (npk[0] / 100 * (npk[3] || 0.7));
  if (bag) return { amount: Math.max(2, Math.round(g)), unit: 'g' };
  return g >= 15 ? { amount: Math.max(0.5, Math.round(g / HANDFUL_G * 2) / 2), unit: 'handful' } : { amount: Math.max(5, Math.round(g / 5) * 5), unit: 'g' };
}

// ---------- how products are counted (from your library) ----------
export function customByName(n) { const p = libByName(n); return p && (S.products || []).includes(p) ? p : null; }
export function npkOf(name) {
  const p = libByName(name);
  if (p && p.npkv && p.npkv.some(v => v > 0)) return [p.npkv[0], p.npkv[1], p.npkv[2], p.avail ?? defAvail(p)];
  if (p && p.kind !== 'fert' && p.kind !== 'mix') return [0, 0, 0, 0];   // a known lime / compost / improver with nothing listed: no feed value
  const m = String(name || '').match(/(\d{1,2})\s*[-‐–・]\s*(\d{1,2})\s*[-‐–・]\s*(\d{1,2})/);
  return m ? [+m[1], +m[2], +m[3], 1] : null;
}
export function feedGrams(amount, unit, name, c) {
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
export function relOf(name) {
  if (name === 'mix:starter') return [0, 30];
  if (name === 'mix:reused' || name === 'prev') return [0, 60];
  const p = libByName(name || '');
  if (p) return p.form === 'liquid' ? [0, 7] : [p.start ?? defStart(p)[0], p.release ?? defStart(p)[1]];
  if (isLiquid(name)) return [0, 7];
  const npk = npkOf(name); return npk && npk[3] >= 1 ? [0, 30] : [7, 55];
}
export const leadText = d => d <= 0 ? 'fast — works within days' : d <= 7 ? 'fairly fast — about a week' : d <= 14 ? 'medium — 1–2 weeks' : 'slow — 2–3 weeks, slower in cold soil';
