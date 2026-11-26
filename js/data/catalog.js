// The crop catalogue the app uses, built from the crop records (data/crops.js): linked entries (like) filled in from the
// crop they're like, and the per-crop tables the rest of the app reads (growth, plant-out, sowing rules, soil, feeding,
// flags…) put together from the records — so a crop's facts live in one place.

import { CROPS } from './crops.js';

// fields a linked entry never takes from the crop it's like: its own name, colour, varieties — and spray registrations,
// which are legal per crop
const OWN_ONLY = ['id', 'en', 'color', 'like', 'icon'];
const byIdRec = Object.fromEntries(CROPS.map(c => [c.id, c]));
function resolve(r, seen = []) {
  if (!r.like) return r;
  const base = byIdRec[r.like]; if (!base || seen.includes(r.id)) throw new Error(`crop ${r.id}: like '${r.like}' isn't a crop`);
  const b = resolve(base, seen.concat(r.id)), out = {};
  for (const [k, v] of Object.entries(b)) if (!OWN_ONLY.includes(k)) out[k] = JSON.parse(JSON.stringify(v));
  return Object.assign(out, r);
}
export const CATALOG = CROPS.map(r => resolve(r)).map(c => Object.assign({}, c, { sowRef: undefined }));
for (const c of CATALOG) { delete c.sowRef; c.tender = !!c.tender; }

// ---------- the per-crop tables, from the records ----------
const table = k => Object.fromEntries(CATALOG.filter(c => c[k] !== undefined && c[k] !== null).map(c => [c.id, c[k]]));
const flagged = f => CATALOG.filter(c => (c.flags || []).includes(f)).map(c => c.id);
export const GROW = table('grow'), TRANSPLANT = table('transplant'), SOW_PROFILE = table('profile'), SOIL_T = table('soilT');
export const PH_RANGE = table('ph'), FEED = table('feed'), LIME_M2 = table('lime'), N_NEED = table('n'), P_NEED = table('p'), K_NEED = table('k');
export const SIDE_STAGES = table('stages'), REST = table('rest');
export const FRUITING = flagged('fruiting'), HEADING = flagged('heading'), BOLT_IF_BIG = flagged('boltIfBig'), HEAT_BOLT = flagged('heatBolt');
export const DAY_BOLT = flagged('dayBolt'), SPLITTERS = flagged('splits'), FROST_HEADS = flagged('frostHeads'), HALF_HARDY = flagged('halfHardy');
export const TALL = flagged('tall'), NETTED = flagged('netted'), NEEDS_BEES = flagged('bees'), NO_FRESH_COMPOST = flagged('noFreshCompost');

// Plant families (for rotation warnings).
export const FAMILIES = {
  brassica: ['Brassica (cabbage family)'], nightshade: ['Nightshade (tomato family)'], legume: ['Legume (bean family)'],
  allium: ['Allium (onion family)'], cucurbit: ['Cucurbit (gourd family)'], umbellifer: ['Umbellifer (carrot family)'],
  aster: ['Aster (daisy family)'], amaranth: ['Amaranth (spinach family)'], grass: ['Grass family'],
  morningglory: ['Morning glory family'], aroid: ['Aroid (taro family)'], rose: ['Rose family'],
  mallow: ['Mallow family (okra)'], ginger: ['Ginger family'], mint: ['Mint family (shiso, basil)'],
  basella: ['Basella family (Malabar spinach)'], yam: ['Yam family'], valerian: ['Valerian family (corn salad)'], iceplant: ['Ice plant family (New Zealand spinach)'],
  other: ['Other'],
};
// How crops are grouped when you choose yours (what you'd look under, not botany).
export const GROUPS = {
  leaves: ['Leafy greens'], heads: ['Cabbages & broccoli'], roots: ['Roots'],
  fruit: ['Fruiting vegetables'], beans: ['Beans & peas'], onions: ['Onions & garlic'],
  tubers: ['Potatoes & other tubers'], herbs: ['Herbs'], berries: ['Fruit'],
};
// the crops most home gardens grow — a quick start when choosing yours
export const COMMON_CROPS = ['tomato', 'minitomato', 'lettuce', 'leaflettuce', 'carrot', 'beet', 'hatsuka', 'onion', 'garlic', 'potato', 'ingen', 'snappea',
  'zucchini', 'kyuri', 'piman', 'chilli', 'kabocha', 'corn', 'spinach', 'chard', 'kale', 'cabbage', 'broccoli', 'basil', 'parsley'];
// Fertiliser / amendment units. A handful of granular fertiliser is roughly 30 g.
export const UNITS = ['g', 'kg', 'handful', 'mL', 'L'];
export const HANDFUL_G = 30;
// Ready-made jobs for the "add job" picker.
export const JOB_TEMPLATES = [
  ['Protect', ['Cover with insect netting', 'Cover with fleece / row cover', 'Frost cover tonight', 'Bird netting', 'Remove covers']],
  ['Support', ['Put in stake / support', 'Tie stems to support', 'Put up net / trellis']],
  ['Soil', ['Earth up', 'Lay mulch film', 'Straw mulch', 'Weed', 'Loosen soil']],
  ['Water', ['Deep water']],
  ['Plant care', ['Remove side shoots', 'Pinch out tip', 'Remove lower / yellow leaves', 'Hand-pollinate', 'Remove flowers / runners', 'Thin seedlings']],
  ['Check', ['Check for pests', 'Check for disease', 'Check soil moisture']],
];
export const PESTS = [['aphids', 'Aphids'], ['caterpillars', 'Caterpillars'], ['slugs', 'Slugs / snails'], ['fleabeetle', 'Flea beetles'],
  ['leafminer', 'Leaf miners'], ['cutworm', 'Cutworms'], ['stinkbug', 'Stink bugs'], ['ladybird28', '28-spot ladybird'],
  ['powdery', 'Powdery mildew'], ['downy', 'Downy mildew'], ['rot', 'Rot / wilt'], ['birds', 'Birds'], ['other', 'Other problem']];
