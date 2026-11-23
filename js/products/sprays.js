// Sprays: the legal registration lookup (MAFF registry), which of your sprays are allowed on a crop, waiting periods
// before picking (収穫前日数), the "OK to pick?" board, Spino Ace mixing and the stochu recipe.

import { A, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { $, addDays, daysBetween, esc, num, shortDate, todayStr } from '../core/util.js';
import { REG_DATE, REGISTRATIONS } from '../data/registrations.js';
import { pestPlan } from '../feeding/plans.js';
import { container, isLive } from '../garden/garden.js';
import { crop, ic } from '../plants/crops.js';
import { myProducts, product } from './library.js';
import { CROP_REG } from '../data/catalog.js';

// ---------- legal registration lookup ----------
// which registered crop names / crop groups cover each crop in the app (most specific first): each crop's reg, in its record (data/crops.js)
const VEG = ['野菜類'];
const HEAD_LETTUCE = /シスコ|結球|玉レタス|head|iceberg/i;
function regNames(cropId, variety) {
  if (cropId === 'lettuce') return HEAD_LETTUCE.test(variety || '') ? [['レタス'], VEG] : [['リーフレタス', '非結球レタス'], VEG];
  return CROP_REG[cropId] || null;
}
const PEST_EN = {
  'アブラムシ類': 'aphids', 'アオムシ': 'cabbage white caterpillars', 'コナガ': 'diamondback moth', 'ヨトウムシ': 'cabbage armyworm', 'ヨトウムシ類': 'armyworms',
  'ハスモンヨトウ': 'common cutworm', 'シロイチモジヨトウ': 'beet armyworm', 'オオタバコガ': 'cotton bollworm', 'ウワバ類': 'loopers', 'ハイマダラノメイガ': 'cabbage webworm',
  'アザミウマ類': 'thrips', 'ハモグリバエ類': 'leafminers', 'アシグロハモグリバエ': 'pea leafminer', 'カブラハバチ類': 'turnip sawfly', 'キスジノミハムシ': 'flea beetle',
  'ウリノメイガ': 'cucumber moth', 'シロオビノメイガ': 'beet webworm', 'ホオズキカメムシ': 'stink bug (ホオズキカメムシ)', 'コガネムシ類成虫': 'chafer beetles',
  'オンシツコナジラミ': 'greenhouse whitefly', 'コナジラミ類': 'whitefly', 'ウリハムシ': 'cucurbit leaf beetle', 'テントウムシダマシ類': '28-spot ladybird',
  'ハダニ類': 'spider mites', 'トマトサビダニ': 'tomato russet mite', 'チャノホコリダニ': 'broad mite', 'アワノメイガ': 'corn borer', 'うどんこ病': 'powdery mildew', '菌核病': 'sclerotinia rot',
};
export const dilEn = d => d === '原液' ? 'ready to use' : d.replace(/(\d+)/g, n => (+n).toLocaleString('en')).replace('~', '–').replace('倍', '×');
export const dilsEn = ds => ds.every(d => d === '原液') ? 'Ready to use' : 'Dilute ' + [...new Set(ds.map(dilEn))].join(' or ');
export const pestEn = j => PEST_EN[j] ? `${PEST_EN[j]} (${j})` : j;
const baseName = s => s.replace(/\([^()]*(\([^()]*\))?[^()]*を除く\)$/, '');
const exclusions = s => { const m = s.match(/\((.*)を除く\)$/); return m ? m[1].split('、') : []; };
// registration rows of one product that apply to this crop (specific crop rows win over group rows, per MAFF rules)
export function regRows(regKey, cropId, variety) {
  const R = (REGISTRATIONS[regKey] || {}).rows || [], map = regNames(cropId, variety);
  if (!map) return [];
  const [names, groups] = map, all = [...names, ...groups];
  for (const n of names) { const rows = R.filter(r => r[0] === n || baseName(r[0]) === n); if (rows.length) return rows; }
  for (const g of groups) {
    const rows = R.filter(r => (r[0] === g || baseName(r[0]) === g) && !exclusions(r[0]).some(x => all.includes(x) || x === names[0]));
    if (rows.length) return rows;
  }
  return [];
}
export const phiDays = when => /収穫前日まで/.test(when) ? 1 : (+((when || '').match(/収穫(\d+)日前まで/) || [])[1] || 0);
export const maxUses = t => /^-$|^$/.test(t || '') ? Infinity : +((t || '').match(/\d+/) || [Infinity])[0];
export const whenEn = w => w === '収穫前日まで' ? 'up to the day before harvest' : /収穫(\d+)日前まで/.test(w) ? `up to ${w.match(/(\d+)/)[1]} days before harvest` : w === '発生初期' ? 'when pests first appear (no harvest limit)' : w === '発生前~発生初期' ? 'before or as pests appear (no harvest limit)' : w === '定植前まで' ? 'before transplanting only' : w;
// summary of what a spray product allows on a crop
export function regSummary(prodId, cropId, variety) {
  const p = product(prodId); if (!p || !p.reg) return null;
  const rows = regRows(p.reg, cropId, variety).filter(r => r[5] === '散布');
  if (!rows.length) return { ok: false, rows: [] };
  return { ok: true, rows, phi: Math.max(...rows.map(r => phiDays(r[3]))), uses: Math.min(...rows.map(r => maxUses(r[4]))),
    pests: [...new Set(rows.map(r => r[1]))], dils: [...new Set(rows.map(r => r[2]))], when: [...new Set(rows.map(r => r[3]))], totals: rows[0][6] || {}, crop: rows[0][0] };
}
// how many times a product has been logged on this planting this season
export function usesSoFar(p, prodId) {
  const pr = product(prodId);
  return (S.log || []).filter(e => e.kind === 'spray' && (e.productId === prodId || (pr && e.product && (e.product === pr.en || e.product === pr.ja))) && (!p.sowDate || e.date >= p.sowDate) &&
    ((e.pids || []).includes(p.id) || (e.cids || []).includes(p.containerId) || (!(e.pids || []).length && !(e.cids || []).length))).length;
}

// ---------- crop page: which of my sprays are allowed ----------
export function spraySection(p) {
  const sprays = myProducts(['spray', 'homemade']);
  if (!sprays.length || !regNames(p.cropId, p.variety)) return '';
  const cards = sprays.map(pr => {
    if (pr.kind === 'homemade') return `<li><a href="#/product/${pr.id}"><span class="lic">🧪</span><span class="grow"><b>${esc(pr.en)}</b><small>Home-made — not a registered pesticide. Vinegar is an approved “特定農薬”; shōchū, wood vinegar and chilli are tolerated for your own use. See notes.</small></span>›</a></li>`;
    if (!pr.reg) return `<li><a href="#/product/${pr.id}"><span class="lic">${pr.organic ? '🌱' : '⚗️'}</span><span class="grow"><b>${esc(pr.en)}</b><small>No registration data in the app — check its label for this crop, the dilution and the days to wait before picking${pr.phi != null ? ` (you noted ${pr.phi} day${pr.phi === 1 ? '' : 's'})` : ''}.</small></span>›</a></li>`;
    const s = regSummary(pr.id, p.cropId, p.variety);
    if (!s || !s.ok) return `<li class="no"><a href="#/product/${pr.id}"><span class="lic">🚫</span><span class="grow"><b>${esc(pr.en)}</b><small>Not registered for ${esc(crop(p.cropId).en)} — using it on this crop is not allowed (農薬取締法).</small></span>›</a></li>`;
    const used = usesSoFar(p, pr.id), left = s.uses === Infinity ? null : s.uses - used;
    return `<li class="${left === 0 ? 'no' : ''}"><a href="#/product/${pr.id}"><span class="lic">${pr.organic ? '🌱' : '⚗️'}</span><span class="grow"><b>${esc(pr.en)}</b>${pr.organic ? ' <span class="orgchip">organic</span>' : ''}
      <small>For: ${s.pests.map(pestEn).join(', ')}</small>
      <small>${dilsEn(s.dils)} · ${s.phi ? `<b>${s.phi === 1 ? 'pick from the next day' : `wait ${s.phi} days before picking`}</b>` : 'no wait before picking'} · ${s.uses === Infinity ? 'no limit on uses' : `<b>${left} of ${s.uses} uses left</b>`}</small></span>›</a></li>`;
  });
  return `<section><h3>Sprays you can use</h3><ul class="plist log sprays">${cards.join('')}</ul>
    <p class="hint">From the official pesticide registrations (農薬登録, ${REG_DATE}). Only registered crops, dilutions and limits are legal. ${pestPlan(p)}</p></section>`;
}

// ---------- Spino Ace mixing and the stochu recipe ----------
export function spinoMixer(p) {
  const R = REGISTRATIONS[p.reg].rows.filter(r => r[5] === '散布');
  const dils = [...new Set(R.map(r => r[2]).flatMap(d => d.replace('倍', '').split('~')).map(Number))].sort((a, b) => a - b);
  setTimeout(() => {
    const f = $('#mixf'); if (!f) return;
    const calc = () => { const L = +f.L.value || 0, d = +f.d.value; const g = L * 1000 / d; $('#mixout').innerHTML = `<b>${g < 1 ? g.toFixed(2) : g.toFixed(1)} g</b> of granules in <b>${L} L</b> of water (${d.toLocaleString()}×) — covers about ${Math.round(L / 0.3)}–${Math.round(L / 0.1)} m².`; };
    f.addEventListener('input', calc); calc();
  });
  return `<section><h3>Mixing</h3><form id="mixf" class="form" onsubmit="return false"><div class="two">
      <label>Water (L)<input name="L" type="number" inputmode="decimal" step="0.5" value="1"></label>
      <label>Dilution<select name="d">${dils.map(d => `<option value="${d}"${d === 5000 ? ' selected' : ''}>${d.toLocaleString()}×</option>`).join('')}</select></label></div></form>
    <p class="msg" id="mixout"></p>
    <ul class="bul"><li><b>5,000×</b> (most crops) = <b>0.2 g per litre</b> · 2,500× = 0.4 g/L · 10,000× = 0.1 g/L · 20,000× (shishito) = 0.05 g/L.</li>
      <li>Use the dilution shown for your crop above — weaker is allowed (but may work less well); stronger is not.</li>
      <li>Small amounts are hard to weigh: a 0.01 g scale helps, or dissolve 1 g in 5 L (5,000×) and use what you need the same day.</li>
      <li>Rate on the label: 100–300 L per 10 a, i.e. about 0.1–0.3 L per m². 1 L covers a 1 × 2 m bed comfortably.</li>
      <li>Add the granules to a little water first, stir, then top up. On waxy leaves (cabbage, onion) the spray beads up — cover them well.</li></ul></section>`;
}
export function stochuLegal() { return 'Vinegar (食酢) is an approved special pesticide (特定農薬). Shōchū and wood vinegar are still under review by the ministry: using them yourself on your own judgement is not enforced against, but they must not be sold or advertised as pesticides.'; }
export function stochuCard() {
  const r = Object.assign({ vinegar: 15, wood: 15, shochu: 15, tabasco: 'a few drops', water: 1, note: '' }, S.stochu || {});
  if (!r.water) r.water = 1;
  A.saveStochu = () => { const f = $('#stf'); S.stochu = { vinegar: num(f.vinegar.value), wood: num(f.wood.value), shochu: num(f.shochu.value), tabasco: f.tabasco.value.trim(), water: num(f.water.value), note: f.note.value.trim() }; save().then(() => { $('#stsaved').textContent = 'Saved ✓'; }); };
  const tot = (r.vinegar || 0) + (r.wood || 0) + (r.shochu || 0);
  return `<section><h3>Your recipe</h3>
    <form id="stf" class="form" onsubmit="return false">
      <div class="two"><label>Vinegar 食酢 (mL)<input name="vinegar" type="number" inputmode="decimal" value="${r.vinegar ?? ''}"></label><label>Wood vinegar 木酢液 (mL)<input name="wood" type="number" inputmode="decimal" value="${r.wood ?? ''}"></label></div>
      <div class="two"><label>Shōchū 焼酎 (mL)<input name="shochu" type="number" inputmode="decimal" value="${r.shochu ?? ''}"></label><label>Tabasco<input name="tabasco" value="${esc(r.tabasco || '')}"></label></div>
      <label>Water (L)<input name="water" type="number" inputmode="decimal" step="0.1" value="${r.water ?? ''}" placeholder="how much water you mix it into"></label>
      ${r.water ? `<p class="msg small">That’s about <b>${Math.round(r.water * 1000 / (tot || 1))}×</b> dilution (${tot} mL concentrate in ${r.water} L)${r.vinegar ? ` — the vinegar alone is about ${Math.round(r.water * 1000 / r.vinegar)}×` : ''}.</p>` : ''}
      <label>Notes<textarea name="note" rows="2" placeholder="e.g. spray every 7–10 days, evening">${esc(r.note || '')}</textarea></label>
      <div class="btns"><span id="stsaved" class="muted"></span><button class="btn primary" data-act="saveStochu">Save recipe</button></div></form>
    <ul class="bul"><li>1 tablespoon = 15 mL.</li><li>Typical stochu strength is 300–1,000× in water. Stronger mixes can scorch leaves — try a few leaves first and spray in the evening.</li>
      <li>Mix fresh and don’t combine with other sprays.</li><li>Use a proper food-grade or clearly labelled wood vinegar: 木酢タール (wood-vinegar tar) is a banned material.</li>
      <li>It works mainly as a deterrent/tonic — keep netting and checks going.</li></ul>
    <h4>Legal status</h4><p class="hint">${esc(stochuLegal())} The ministry’s notices also say not to use vinegar that has had inedible things soaked in it.</p></section>`;
}

// ---------- spray waiting period (pre-harvest interval) ----------
export function sprayHolds(p, today = todayStr()) {
  if (!p || p.status === 'harvested') return [];
  return (S.log || []).filter(e => e.kind === 'spray' && +e.phi > 0 && addDays(e.date, +e.phi) > today && e.date <= today &&
    (!p.sowDate || p.sowDate <= e.date) &&
    ((e.pids || []).includes(p.id) || (e.cids || []).includes(p.containerId) || (!(e.pids || []).length && !(e.cids || []).length)))
    .map(e => ({ until: addDays(e.date, +e.phi), e })).sort((a, b) => (a.until < b.until ? 1 : -1));
}
export function sprayBanner(p) {
  const h = sprayHolds(p)[0]; if (!h) return '';
  return `<div class="banner warn">💦 Sprayed <b>${esc(h.e.product || 'pesticide')}</b> on ${shortDate(h.e.date)} — <b>don’t pick until ${shortDate(h.until)}</b> (${h.e.phi}-day wait).</div>`;
}
export function sprayAlerts() {
  const act = S.plantings.filter(isLive), by = {};
  for (const p of act) { const h = sprayHolds(p)[0]; if (h) (by[h.until] = by[h.until] || []).push([p, h]); }
  const ks = Object.keys(by).sort(); if (!ks.length) return '';
  return `<a class="banner warn" href="#/picksafe">💦 <b>Spray waiting period</b> — don’t pick ${ks.map(u => `${by[u].map(([p]) => esc(crop(p.cropId).en)).join(', ')} until <b>${shortDate(u)}</b>`).join('; ')}.</a>`;
}

// ---------- the "OK to pick?" board ----------
export function pagePickSafe() {
  setChrome('OK to pick?', { back: true, kicker: 'Spray waiting periods' });
  const td = todayStr(), act = S.plantings.filter(isLive);
  const rows = act.map(p => ({ p, h: sprayHolds(p)[0] || null })).sort((a, b) => (!!b.h - !!a.h) || ((a.h && a.h.until) < (b.h && b.h.until) ? -1 : 1));
  const html = `${rows.length ? `<ul class="plist pick">${rows.map(({ p, h }) => { const c = container(p.containerId), n = h ? daysBetween(td, h.until) : 0, ready = p.harvestDate && p.harvestDate <= td;
    return `<li class="${h ? 'hold' : 'okp'}"><a href="#/plant/${p.id}"><span class="lic">${h ? '⛔' : '✅'}</span>${ic(p.cropId)}<span class="grow"><b>${esc(crop(p.cropId).en)}</b> · ${esc(c ? c.name : '')}
      <small>${h ? `Wait <b>${n} day${n === 1 ? '' : 's'}</b> — until ${shortDate(h.until)} (${esc(h.e.product || 'spray')} on ${shortDate(h.e.date)})` : 'OK to pick — no spray waiting period'}${ready ? ' · 🧺 ready' : p.harvestDate ? ` · ready from ${shortDate(p.harvestDate)}` : ''}</small></span>›</a></li>`; }).join('')}</ul>` : '<div class="empty-state">Nothing growing.</div>'}
    <p class="hint">From the sprays in your log and each product’s legal waiting period (使用時期). Log every spray so this stays right.</p>`;
  return { html };
}

// ---------- bees ----------
// Insecticide ingredients that harm bees, by kind — in English and Japanese, with common Japanese brand names — so any
// product can be checked from its name, its details or its registry entry, including your own products.
const BEE_HARM = [
  ['neonicotinoid', 'very harmful to bees, and lasts in the plant (and its flowers) for weeks', [
    ['imidacloprid', 'イミダクロプリド', 'アドマイヤー'], ['clothianidin', 'クロチアニジン', 'ダントツ'], ['thiamethoxam', 'チアメトキサム', 'アクタラ'],
    ['dinotefuran', 'ジノテフラン', 'スタークル|アルバリン'], ['acetamiprid', 'アセタミプリド', 'モスピラン'], ['thiacloprid', 'チアクロプリド', 'バリアード'],
    ['nitenpyram', 'ニテンピラム', 'ベストガード'], ['sulfoxaflor', 'スルホキサフロル', 'トランスフォーム']]],
  ['pyrethroid', 'harmful to bees on contact', [
    ['permethrin', 'ペルメトリン', 'アディオン'], ['cypermethrin', 'シペルメトリン', 'アグロスリン'], ['deltamethrin', 'デルタメトリン', ''], ['cyhalothrin', 'シハロトリン', 'サイハロン'],
    ['bifenthrin', 'ビフェントリン', 'テルスター'], ['etofenprox', 'エトフェンプロックス', 'トレボン'], ['fenpropathrin', 'フェンプロパトリン', 'ロディー'], ['fenvalerate', 'フェンバレレート', ''],
    ['tralomethrin', 'トラロメトリン', 'スカウト'], ['acrinathrin', 'アクリナトリン', 'アーデント'], ['cyfluthrin', 'シフルトリン', 'バイスロイド'], ['silafluofen', 'シラフルオフェン', 'MR.ジョーカー']]],
  ['pyrethrin', 'harmful to bees while wet, but breaks down within a day', [['pyrethrin', 'ピレトリン|除虫菊', '']]],
  ['organophosphate', 'very harmful to bees', [
    ['malathion', 'マラソン|マラチオン', ''], ['fenitrothion', 'フェニトロチオン|MEP', 'スミチオン'], ['diazinon', 'ダイアジノン', ''], ['chlorpyrifos', 'クロルピリホス', 'ダーズバン'],
    ['acephate', 'アセフェート', 'オルトラン'], ['dimethoate', 'ジメトエート', ''], ['fenthion', 'フェンチオン|MPP', 'バイジット'], ['dichlorvos', 'ジクロルボス|DDVP', ''], ['prothiofos', 'プロチオホス', 'トクチオン']]],
  ['carbamate', 'very harmful to bees', [['carbaryl', 'カルバリル|NAC', 'デナポン'], ['methomyl', 'メソミル', 'ランネート'], ['benfuracarb', 'ベンフラカルブ', 'オンコル'], ['carbosulfan', 'カルボスルファン', 'ガゼット']]],
  ['spinosyn', 'harmful to bees while wet; safe once dry', [['spinosad', 'スピノサド', 'スピノエース'], ['spinetoram', 'スピネトラム', 'ディアナ']]],
  ['other', 'harmful to bees', [['fipronil', 'フィプロニル', 'プリンス'], ['abamectin', 'アバメクチン', 'アグリメック'], ['emamectin', 'エマメクチン', 'アファーム'], ['chlorfenapyr', 'クロルフェナピル', 'コテツ']]],
];
// the bee-harmful ingredients in a product: [{ name, kind, why }]
export function beeHarm(p) {
  if (!p) return [];
  const reg = p.reg && REGISTRATIONS[p.reg] ? REGISTRATIONS[p.reg].rows.flatMap(r => r.filter(x => x && typeof x === 'object' && !Array.isArray(x)).flatMap(o => Object.keys(o))) : [];
  const text = [p.en, p.ja, p.what, p.organicNote, ...(p.notes || []), ...reg].filter(Boolean).join(' ').toLowerCase(), out = [];
  // whole words for names in Latin letters (so NAC isn't found in "spinach"), anywhere for Japanese
  const has = w => /^[\x20-\x7e]+$/.test(w) ? new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(text) : text.includes(w.toLowerCase());
  for (const [kind, why, list] of BEE_HARM) for (const [en, ja, brands] of list) {
    if ([en, ...ja.split('|'), ...brands.split('|')].filter(Boolean).some(has)) out.push({ name: en, kind, why });
  }
  return out.filter(m => !out.some(o => o !== m && o.name.includes(m.name)));   // permethrin is part of cypermethrin
}
// for the spray days page: the general rule, and which of your sprays it applies to
export function beeNote() {
  const mine = myProducts('spray').map(p => ({ p, h: beeHarm(p) })).filter(x => x.h.length);
  return `<li>Many insecticides harm bees: neonicotinoids (e.g. imidacloprid, clothianidin, dinotefuran), pyrethroids and pyrethrins, organophosphates, carbamates, spinosad and fipronil among them. Spray early in the morning or late in the afternoon, never onto open flowers, and not when bees are about.${mine.length ? `<br>Of your sprays: ${mine.map(x => `<b>${esc(x.p.en)}</b> (${[...new Set(x.h.map(h => h.name))].join(', ')} — ${esc(x.h[0].why)})`).join('; ')}.` : ''}</li>`;
}
export { CROP_REG };   // (from the crop records)
