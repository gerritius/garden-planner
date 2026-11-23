// The crop catalogue the app uses, built from the crop records (data/crops.js): linked entries (like) filled in from the
// crop they're like, and the per-crop tables the rest of the app reads (growth, plant-out, sowing rules, soil, feeding,
// flags…) put together from the records — so a crop's facts live in one place.

import { CROPS } from './crops.js';

// fields a linked entry never takes from the crop it's like: its own name, colour, varieties — and spray registrations,
// which are legal per crop
const OWN_ONLY = ['id', 'en', 'ja', 'color', 'varieties', 'reg', 'like', 'icon'];
const byIdRec = Object.fromEntries(CROPS.map(c => [c.id, c]));
function resolve(r, seen = []) {
  if (!r.like) return r;
  const base = byIdRec[r.like]; if (!base || seen.includes(r.id)) throw new Error(`crop ${r.id}: like '${r.like}' isn't a crop`);
  const b = resolve(base, seen.concat(r.id)), out = {};
  for (const [k, v] of Object.entries(b)) if (!OWN_ONLY.includes(k)) out[k] = JSON.parse(JSON.stringify(v));
  return Object.assign(out, r);
}
export const CATALOG = CROPS.map(r => resolve(r)).map(c => Object.assign({}, c, { varieties: c.varieties || [], sowRef: undefined }));
for (const c of CATALOG) { delete c.sowRef; c.tender = !!c.tender; }

// ---------- the per-crop tables, from the records ----------
const table = k => Object.fromEntries(CATALOG.filter(c => c[k] !== undefined && c[k] !== null).map(c => [c.id, c[k]]));
const flagged = f => CATALOG.filter(c => (c.flags || []).includes(f)).map(c => c.id);
export const GROW = table('grow'), TRANSPLANT = table('transplant'), SOW_PROFILE = table('profile'), SOIL_T = table('soilT');
export const PH_RANGE = table('ph'), FEED = table('feed'), LIME_M2 = table('lime'), N_NEED = table('n'), P_NEED = table('p'), K_NEED = table('k');
export const SIDE_STAGES = table('stages'), REST = table('rest');
export const CROP_REG = Object.fromEntries(CROPS.filter(c => c.reg).map(c => [c.id, c.reg]));   // (only a crop's own)
export const FRUITING = flagged('fruiting'), HEADING = flagged('heading'), BOLT_IF_BIG = flagged('boltIfBig'), HEAT_BOLT = flagged('heatBolt');
export const DAY_BOLT = flagged('dayBolt'), SPLITTERS = flagged('splits'), FROST_HEADS = flagged('frostHeads'), HALF_HARDY = flagged('halfHardy');
export const TALL = flagged('tall'), NETTED = flagged('netted'), NEEDS_BEES = flagged('bees'), NO_FRESH_COMPOST = flagged('noFreshCompost');

// Plant families (for rotation warnings).
export const FAMILIES = {
  brassica: ['Brassica (cabbage family)', 'アブラナ科'], nightshade: ['Nightshade (tomato family)', 'ナス科'], legume: ['Legume (bean family)', 'マメ科'],
  allium: ['Allium (onion family)', 'ヒガンバナ科'], cucurbit: ['Cucurbit (gourd family)', 'ウリ科'], umbellifer: ['Umbellifer (carrot family)', 'セリ科'],
  aster: ['Aster (daisy family)', 'キク科'], amaranth: ['Amaranth (spinach family)', 'ヒユ科'], grass: ['Grass family', 'イネ科'],
  morningglory: ['Morning glory family', 'ヒルガオ科'], aroid: ['Aroid (taro family)', 'サトイモ科'], rose: ['Rose family', 'バラ科'], other: ['Other', 'その他'],
};
// How crops are grouped when you choose yours (what you'd look under, not botany).
export const GROUPS = {
  leaves: ['Leafy greens', '葉物野菜'], heads: ['Cabbages & broccoli', 'キャベツ・ブロッコリー類'], roots: ['Roots', '根菜'],
  fruit: ['Fruiting vegetables', '果菜'], beans: ['Beans & peas', '豆類'], onions: ['Onions & garlic', 'ネギ類'],
  tubers: ['Potatoes & other tubers', 'イモ類'], herbs: ['Herbs', 'ハーブ・香味野菜'], berries: ['Fruit', '果物'],
};
// the crops most home gardens grow — a quick start when choosing yours
export const COMMON_CROPS = ['tomato', 'minitomato', 'kyuri', 'nasu', 'piman', 'edamame', 'komatsuna', 'spinach', 'lettuce', 'daikon', 'hatsuka', 'carrot', 'potato', 'naganegi', 'cabbage', 'broccoli', 'snappea', 'ingen'];
// Fertiliser / amendment units. A handful (一握り) of granular fertiliser is roughly 30 g.
export const UNITS = ['g', 'kg', 'handful', 'mL', 'L'];
export const HANDFUL_G = 30;
// Ready-made jobs for the "add job" picker.
export const JOB_TEMPLATES = [
  ['Protect', ['Cover with insect netting (防虫ネット)', 'Cover with fleece / row cover (不織布)', 'Frost cover tonight', 'Bird netting', 'Remove covers']],
  ['Support', ['Put in stake / support (支柱)', 'Tie stems to support (誘引)', 'Put up net / trellis (ネット)']],
  ['Soil', ['Earth up (土寄せ)', 'Lay mulch film (マルチ)', 'Straw mulch (敷きわら)', 'Weed', 'Loosen soil (中耕)']],
  ['Water', ['Deep water']],
  ['Plant care', ['Remove side shoots (わき芽かき)', 'Pinch out tip (摘心)', 'Remove lower / yellow leaves', 'Hand-pollinate (人工授粉)', 'Remove flowers / runners', 'Thin seedlings (間引き)']],
  ['Check', ['Check for pests', 'Check for disease', 'Check soil moisture']],
];
export const PESTS = [['aphids', 'Aphids', 'アブラムシ'], ['caterpillars', 'Caterpillars', '青虫・ヨトウムシ'], ['slugs', 'Slugs / snails', 'ナメクジ'], ['fleabeetle', 'Flea beetles', 'キスジノミハムシ'],
  ['leafminer', 'Leaf miners', 'ハモグリバエ'], ['cutworm', 'Cutworms', 'ネキリムシ'], ['stinkbug', 'Stink bugs', 'カメムシ'], ['ladybird28', '28-spot ladybird', 'テントウムシダマシ'],
  ['powdery', 'Powdery mildew', 'うどんこ病'], ['downy', 'Downy mildew', 'べと病'], ['rot', 'Rot / wilt', '軟腐病・萎凋'], ['birds', 'Birds', '鳥'], ['other', 'Other problem', 'その他']];
