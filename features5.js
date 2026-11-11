/* Products: the gardener's own sprays, fertilisers and soil improvers, with legal spray rules from the
   MAFF pesticide registry (registrations.js), feeding plans, bed prep, Spino Ace mixing and the stochu recipe. */
'use strict';

// ---------- the product library ----------
// kind: spray | fert | lime | compost | homemade
// wait: days to leave between digging it in and sowing/planting (0 = can go in on planting day)
// top: can be used as a top-dressing (追肥) straight away
const PRODUCTS = [
  { id: 'paiBenicaV', kind: 'spray', en: 'Pai Benica V spray', ja: 'パイベニカVスプレー', maker: 'KINCHO園芸', reg: 'paiBenicaV', organic: true,
    what: 'Pyrethrin (除虫菊 extract, 0.006%) — ready to use (原液)',
    organicNote: 'Pyrethrin without piperonyl butoxide — allowed under organic JAS (別表2 ピレトリン乳剤).',
    notes: ['Contact spray: kills what it hits and breaks down within a day or so in sunlight — good for aphids, stink bugs and beetles when you see them.', 'Spray the insects directly, including leaf undersides.'] },
  { id: 'benicaNatural', kind: 'spray', en: 'Benica Natural spray', ja: 'ベニカナチュラルスプレー', maker: 'KINCHO園芸', reg: 'benicaNatural', organic: true,
    what: 'BT (Bacillus thuringiensis) + vegetable oil + starch syrup (還元澱粉糖化物) — ready to use (原液)',
    organicNote: 'All three ingredients are on the organic JAS permitted list (別表2: BT剤, 調合油, 還元澱粉糖化物).',
    notes: ['BT only kills caterpillars that eat sprayed leaves — spray at the first sign of caterpillars, or before in butterfly season (Apr–Jun, Sep–Nov).', 'The oil and syrup smother aphids, mites and whitefly — they must be hit directly.', 'No limit on the number of uses and no waiting period before harvest on the registered crops.'] },
  { id: 'spinoace', kind: 'spray', en: 'Spino Ace water granules', ja: 'スピノエース顆粒水和剤', maker: 'Corteva (コルテバ)', reg: 'spinoace', organic: true, mix: true,
    what: 'Spinosad 25% — granules to dilute in water',
    organicNote: 'Spinosad (from a soil bacterium) — allowed under organic JAS (別表2 スピノサド水和剤).',
    notes: ['Strong on caterpillars (diamondback moth, cabbage white, armyworms), thrips and leafminers.', 'Toxic to bees while wet — spray in the evening and not onto open flowers.', 'Make up only what you need and use it the same day.'] },
  { id: 'benicaXnext', kind: 'spray', en: 'Benica X Next spray', ja: 'ベニカXネクストスプレー', maker: 'KINCHO園芸', reg: 'benicaXnext', organic: false,
    what: 'Clothianidin + pyridalyl + permethrin + mandestrobin + starch syrup — ready to use (原液)',
    organicNote: 'Synthetic insecticides and fungicide — not organic. Clothianidin (a neonicotinoid) and permethrin are harmful to bees.',
    notes: ['Insecticide + fungicide in one, systemic — keep it as a last resort.', 'Registered for only a few vegetables (see below). Bought seedlings may already have had clothianidin — check the tag, as it counts towards the same limit.', 'Don’t spray onto open flowers.'] },
  { id: 'neem', kind: 'fert', en: 'Pure Neem pellets', ja: 'ピュアニーム ペレット', maker: 'ダイコー (Daiko)', organic: true, wait: 7, top: true, npk: 'neem seed cake',
    what: 'Neem seed cake — organic fertiliser / soil improver',
    notes: ['Sold as a fertiliser, not a registered pesticide — so the app treats it as a soil improver only.', 'Like other oil cakes: fine as a top-dressing; if you dig it in, leave about a week before sowing. Check the bag for its own rate.'] },
  { id: 'toshoAburakasu', kind: 'fert', en: 'Tosho Super Fermented aburakasu', ja: '東商 超醗酵油かす', maker: '東商', organic: true, wait: 0, top: true, npk: 'about 3-3-2',
    what: 'Fermented oil cake — slow, gentle organic fertiliser',
    notes: ['Already fermented, so it can go in on planting day as base fertiliser or be used as a top-dressing.'] },
  { id: 'oysterLime', kind: 'lime', en: 'Oyster shell lime', ja: '有機石灰 (かき殻)', maker: 'サンアンドホープ (Sun & Hope)', organic: true, wait: 0, top: false,
    what: 'Ground oyster shell — gentle, slow lime with trace minerals',
    notes: ['Unlike 苦土石灰 or 消石灰, it can go in with compost and fertiliser and you can plant the same day.', 'Skip it for potatoes (raises scab risk) and go light for sweet potato and strawberries.'] },
  { id: 'bokashi', kind: 'fert', en: 'Bokashi', ja: 'ぼかし肥料', maker: 'サンアンドホープ (Sun & Hope)', organic: true, wait: 0, top: true,
    what: 'Fermented organic fertiliser',
    notes: ['Fermented, so it can go in on planting day as base fertiliser, or as a top-dressing.'] },
  { id: 'aburakasu', kind: 'fert', en: 'Aburakasu (oil cake)', ja: '油かす', maker: 'generic', organic: true, wait: 21, top: true, npk: 'about 5-2-1',
    what: 'Unfermented rapeseed oil cake — slow nitrogen',
    notes: ['As a top-dressing: use straight away, a little away from the stems.', 'Dug in: it ferments in the soil, giving off gas and heat and attracting seed-corn maggots (タネバエ) — leave 2–3 weeks before sowing or planting.'] },
  { id: 'chickenManure', kind: 'fert', en: 'Chicken manure', ja: '鶏ふん', maker: 'generic', organic: true, wait: 14, top: true, npk: 'about 3-5-3 (fermented)',
    what: 'Quick-acting manure, rich in phosphate and calcium',
    notes: ['As a top-dressing: use straight away, away from stems and leaves.', 'Dug in: leave about 2 weeks for fermented (発酵) pellets, 3–4 weeks for raw. It is strong — use less than compost.'] },
  { id: 'barkCompost', kind: 'compost', en: 'Bark compost', ja: 'バーク堆肥', maker: 'generic', organic: true, wait: 7, top: false,
    what: 'Soil improver — lightens soil, little feeding value',
    notes: ['If it’s fully matured (完熟), plant straight away; otherwise dig in a week or so before.'] },
  { id: 'cowCompost', kind: 'compost', en: 'Cow manure compost', ja: '牛ふん堆肥', maker: 'generic', organic: true, wait: 14, top: false,
    what: 'Soil improver with mild feeding value',
    notes: ['Dig in 2–3 weeks before planting (1 week if fully matured, 完熟).'] },
  { id: 'cowHuskCompost', kind: 'compost', en: 'Cow manure + rice husk compost', ja: 'もみ殻入り牛ふん堆肥', maker: 'generic', organic: true, wait: 14, top: false,
    what: 'Soil improver — the husks open up heavy or wet soil',
    notes: ['Dig in 2–3 weeks before planting.'] },
  { id: 'stochu', kind: 'homemade', en: 'Stochu (home-made)', ja: 'ストチュウ', maker: 'home-made', organic: true,
    what: 'Vinegar + wood vinegar + shōchū + a little Tabasco, diluted in water',
    organicNote: 'Natural ingredients only.',
    notes: [] },
];
const product = id => PRODUCTS.find(x => x.id === id) || (S.customProducts || []).find(x => x.id === id);
const myProducts = kind => PRODUCTS.concat(S.customProducts || []).filter(x => (!S.myProducts || S.myProducts.includes(x.id)) && (!kind || [].concat(kind).includes(x.kind)));
const prodName = p => p ? `${p.en}${p.ja && p.ja !== p.en ? ' ' + p.ja : ''}` : '';

// ---------- legal registration lookup ----------
// which registered crop names / crop groups cover each crop in the app (most specific first)
const VEG = ['野菜類'];
const CROP_REG = {
  nasu: [['なす'], VEG], celery: [['セルリー'], VEG], potato: [['ばれいしょ'], VEG], minitomato: [['ミニトマト'], VEG], tomato: [['トマト'], VEG],
  naganegi: [['ねぎ'], VEG], hatamanegi: [['葉たまねぎ'], VEG], carrot: [['にんじん'], VEG],
  komatsuna: [['こまつな'], ['非結球あぶらな科葉菜類', ...VEG]], edamame: [['えだまめ'], VEG], hakusai: [['はくさい'], ['結球あぶらな科葉菜類', ...VEG]],
  daikon: [['だいこん'], VEG], hatsuka: [['はつかだいこん'], VEG], cabbage: [['キャベツ'], ['結球あぶらな科葉菜類', ...VEG]], spinach: [['ほうれんそう'], VEG],
  kabu: [['かぶ'], VEG], piman: [['ピーマン'], VEG], chilli: [['とうがらし'], ['とうがらし類', ...VEG]], snappea: [['さやえんどう'], VEG],
  kyuri: [['きゅうり'], VEG], onion: [['たまねぎ'], VEG], broccoli: [['ブロッコリー'], ['あぶらな科野菜(花蕾及び茎)', ...VEG]],
  satoimo: [['さといも'], VEG], satsumaimo: [['かんしょ'], VEG], shungiku: [['しゅんぎく'], VEG], mizuna: [['みずな'], ['非結球あぶらな科葉菜類', ...VEG]],
  zucchini: [['ズッキーニ'], VEG], corn: [['とうもろこし'], VEG], ingen: [['さやいんげん', 'いんげんまめ'], VEG],
  chingensai: [['チンゲンサイ'], ['非結球あぶらな科葉菜類', ...VEG]], garlic: [['にんにく'], VEG], shishito: [['ししとう'], ['とうがらし類', ...VEG]],
  sayaendo: [['さやえんどう'], VEG], soramame: [['そらまめ'], VEG], cauliflower: [['カリフラワー'], ['あぶらな科野菜(花蕾及び茎)', ...VEG]],
  strawberry: [['いちご'], VEG], nanohana: [['なばな類', 'なばな'], ['非結球あぶらな科葉菜類', ...VEG]],
};
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
const dilEn = d => d === '原液' ? 'ready to use' : d.replace(/(\d+)/g, n => (+n).toLocaleString('en')).replace('~', '–').replace('倍', '×');
const dilsEn = ds => ds.every(d => d === '原液') ? 'Ready to use' : 'Dilute ' + [...new Set(ds.map(dilEn))].join(' or ');
const pestEn = j => PEST_EN[j] ? `${PEST_EN[j]} (${j})` : j;
const baseName = s => s.replace(/\([^()]*(\([^()]*\))?[^()]*を除く\)$/, '');
const exclusions = s => { const m = s.match(/\((.*)を除く\)$/); return m ? m[1].split('、') : []; };
// registration rows of one product that apply to this crop (specific crop rows win over group rows, per MAFF rules)
function regRows(regKey, cropId, variety) {
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
const phiDays = when => /収穫前日まで/.test(when) ? 1 : (+((when || '').match(/収穫(\d+)日前まで/) || [])[1] || 0);
const maxUses = t => /^-$|^$/.test(t || '') ? Infinity : +((t || '').match(/\d+/) || [Infinity])[0];
const whenEn = w => w === '収穫前日まで' ? 'up to the day before harvest' : /収穫(\d+)日前まで/.test(w) ? `up to ${w.match(/(\d+)/)[1]} days before harvest` : w === '発生初期' ? 'when pests first appear (no harvest limit)' : w === '発生前~発生初期' ? 'before or as pests appear (no harvest limit)' : w === '定植前まで' ? 'before transplanting only' : w;
// summary of what a spray product allows on a crop
function regSummary(prodId, cropId, variety) {
  const p = product(prodId); if (!p || !p.reg) return null;
  const rows = regRows(p.reg, cropId, variety).filter(r => r[5] === '散布');
  if (!rows.length) return { ok: false, rows: [] };
  return { ok: true, rows, phi: Math.max(...rows.map(r => phiDays(r[3]))), uses: Math.min(...rows.map(r => maxUses(r[4]))),
    pests: [...new Set(rows.map(r => r[1]))], dils: [...new Set(rows.map(r => r[2]))], when: [...new Set(rows.map(r => r[3]))], totals: rows[0][6] || {}, crop: rows[0][0] };
}
// how many times a product has been logged on this planting this season
function usesSoFar(p, prodId) {
  const pr = product(prodId);
  return (S.log || []).filter(e => e.kind === 'spray' && (e.productId === prodId || (pr && e.product && (e.product === pr.en || e.product === pr.ja))) && (!p.sowDate || e.date >= p.sowDate) &&
    ((e.pids || []).includes(p.id) || (e.cids || []).includes(p.containerId) || (!(e.pids || []).length && !(e.cids || []).length))).length;
}

// ---------- crop page: which of my sprays are allowed ----------
function spraySection(p) {
  const sprays = myProducts(['spray', 'homemade']);
  if (!sprays.length || !regNames(p.cropId, p.variety)) return '';
  const cards = sprays.map(pr => {
    if (pr.kind === 'homemade') return `<li><a href="#/product/${pr.id}"><span class="lic">🧪</span><span class="grow"><b>${esc(pr.en)}</b><small>Home-made — not a registered pesticide. Vinegar is an approved “特定農薬”; shōchū, wood vinegar and chilli are tolerated for your own use. See notes.</small></span>›</a></li>`;
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
// a simple, organic-first plan for what to reach for
function pestPlan(p) {
  const fam = crop(p.cropId).family, ok = id => myProducts().some(x => x.id === id) && (regSummary(id, p.cropId, p.variety) || {}).ok;
  const steps = [];
  if (fam === 'brassica') steps.push('Net at planting; check leaf undersides weekly for eggs and caterpillars.');
  else steps.push('Check weekly, especially leaf undersides and new growth.');
  const first = [ok('benicaNatural') && 'Benica Natural at the first caterpillars/aphids', ok('paiBenicaV') && 'Pai Benica V for aphids and beetles'].filter(Boolean);
  if (first.length) steps.push('First: ' + first.join('; ') + '.');
  if (ok('spinoace')) steps.push('If caterpillars/thrips keep coming: Spino Ace (organic).');
  if (ok('benicaXnext')) steps.push('Last resort: Benica X Next.');
  return steps.join(' ');
}

// ---------- log dialog: pick a product, check it’s legal ----------
function libChips(e) {
  const ps = myProducts(['spray', 'homemade', 'fert', 'lime', 'compost']);
  return `<div class="sowchips libchips">${ps.map(p => `<button type="button" class="chip big${e.productId === p.id ? ' on' : ''}" data-lib="${p.id}">${p.kind === 'spray' ? (p.organic ? '🌱' : '⚗️') : p.kind === 'homemade' ? '🧪' : p.kind === 'lime' ? '🐚' : p.kind === 'compost' ? '🪏' : '🌿'} ${esc(p.en)}</button>`).join('')}</div><input type="hidden" name="productId" value="${esc(e.productId || '')}">`;
}
function wireLogLibrary(m, f, e) {
  const box = m.querySelector('#legal');
  const targets = () => {
    const cids = [...f.querySelectorAll('input[name=cid]:checked')].map(i => i.value), pids = [...f.querySelectorAll('input[name=pid]:checked')].map(i => i.value);
    const d = f.date.value || todayStr();
    const act = S.plantings.filter(p => p.status !== 'harvested' && (!p.sowDate || p.sowDate <= d));
    return pids.length || cids.length ? act.filter(p => pids.includes(p.id) || cids.includes(p.containerId)) : act;
  };
  const check = () => {
    const pr = product(f.productId.value); box.innerHTML = '';
    if (!pr || pr.kind !== 'spray') { if (pr && pr.kind === 'homemade') box.innerHTML = `<p class="msg small">🧪 Home-made spray — no registration. ${esc(stochuLegal())}</p>`; return; }
    const ts = targets(); if (!ts.length) { box.innerHTML = '<p class="hint">Tick the beds or crops you sprayed to check the rules.</p>'; return; }
    let phi = 0, bad = [];
    const lines = ts.map(p => {
      const s = regSummary(pr.id, p.cropId, p.variety), n = crop(p.cropId).en;
      if (!s || !s.ok) { bad.push(n); return `<li class="no">🚫 <b>${esc(n)}</b> — not registered: not allowed on this crop</li>`; }
      phi = Math.max(phi, s.phi);
      const used = usesSoFar(p, pr.id) - (e.productId === pr.id && (S.log || []).includes(e) ? 1 : 0), left = s.uses === Infinity ? Infinity : s.uses - used;
      if (left <= 0) bad.push(n);
      return `<li class="${left <= 0 ? 'no' : ''}">${left <= 0 ? '🚫' : '✓'} <b>${esc(n)}</b> — ${dilsEn(s.dils).toLowerCase()} · ${s.phi ? `wait ${s.phi} day${s.phi > 1 ? 's' : ''}` : 'no wait'} · ${left === Infinity ? 'no limit' : left <= 0 ? `<b>limit of ${s.uses} reached</b>` : `use ${used + 1} of ${s.uses}`}</li>`;
    });
    box.innerHTML = `<ul class="legal">${lines.join('')}</ul>${bad.length ? `<p class="banner warn small">Under the Agricultural Chemicals Regulation Act (農薬取締法) you may only use a pesticide on its registered crops, within its use limit. Untick: ${esc(bad.join(', '))}.</p>` : ''}`;
    if (phi && (f.phi.value === '' || f.phi.dataset.auto)) { f.phi.value = phi; f.phi.dataset.auto = '1'; }
  };
  m.querySelectorAll('[data-lib]').forEach(b => b.onclick = () => {
    const pr = product(b.dataset.lib), on = f.productId.value !== pr.id;
    m.querySelectorAll('[data-lib]').forEach(x => x.classList.toggle('on', on && x === b));
    f.productId.value = on ? pr.id : '';
    if (on) {
      f.product.value = pr.en;
      const kind = pr.kind === 'spray' || pr.kind === 'homemade' ? 'spray' : pr.kind === 'fert' ? 'fert' : 'soil';
      const r = f.querySelector(`input[name=kind][value=${kind}]`); if (r) r.checked = true;
      if (pr.kind === 'spray' && /原液/.test(pr.what)) { f.amount.value = ''; }
      if (pr.id === 'spinoace' && !f.unit.value) f.unit.value = 'L';
      f.phi.value = ''; delete f.phi.dataset.auto;
      f.dispatchEvent(new Event('change'));
    }
    check();
  });
  f.product.addEventListener('input', () => { if (f.productId.value && f.product.value !== product(f.productId.value).en) { f.productId.value = ''; m.querySelectorAll('[data-lib]').forEach(x => x.classList.remove('on')); check(); } });
  f.phi.addEventListener('input', () => delete f.phi.dataset.auto);
  f.addEventListener('change', e2 => { if (e2.target.name === 'cid' || e2.target.name === 'pid' || e2.target.name === 'date') check(); });
  check();
}

// ---------- feeding plans ----------
const FEED_BASE_M2 = { heavy: 200, medium: 150, light: 80, legume: 60 };   // g/m² of fermented organic fertiliser
const FEED_BAG = { heavy: 100, medium: 70, light: 40, legume: 30 };         // g per 40 L bag
const LIME_M2 = { potato: 0, satsumaimo: 50, strawberry: 50, spinach: 200, garlic: 150, onion: 150, hatamanegi: 150, naganegi: 150 };
const sectionArea = (c, from, to) => c.type === 'bed' ? Draw.dims(c).W * (to - from) / 1e4 : null;
const pick = ids => ids.map(product).find(p => p && myProducts().includes(p));
// recommended starting (base) fertiliser for a crop in this bed section or bag
function baseFertPlan(cropId, c, from, to) {
  if (!c) return [];
  const feed = feedOf(cropId) || 'medium', area = sectionArea(c, from, to), bag = c.type !== 'bed';
  const sa = soilAdvice(c, from, to, cropId), bm = sa ? sa.base : 1, cm = sa ? sa.compost : 1;
  const out = [];
  const comp = pick(['cowCompost', 'cowHuskCompost', 'barkCompost']);
  if (comp) out.push({ product: comp.en, amount: bag ? Math.round(4 * cm) : Math.round(area * 2 * cm * 10) / 10, unit: bag ? 'L' : 'kg' });
  const lime = pick(['oysterLime']), lr = LIME_M2[cropId] ?? (crop(cropId).family === 'brassica' || crop(cropId).family === 'legume' ? 150 : 100);
  if (lime && lr) out.push({ product: lime.en, amount: bag ? Math.round(lr * 0.3 / 5) * 5 : Math.round(area * lr / 10) * 10, unit: 'g' });
  const fert = pick(['bokashi', 'toshoAburakasu', 'neem']);
  const g = cropId === 'satsumaimo' ? 0 : (bag ? FEED_BAG[feed] : FEED_BASE_M2[feed] * area) * bm;
  if (fert && g) out.push({ product: fert.en, amount: Math.round(g / 10) * 10, unit: 'g' });
  return out.filter(x => x.amount > 0);
}
function baseFertNote(cropId, c) {
  const comp = pick(['cowCompost', 'cowHuskCompost', 'barkCompost']);
  const bits = [];
  if (comp) bits.push(`${comp.en}: dig in ${comp.wait >= 14 ? '2–3 weeks' : 'about a week'} before planting`);
  const lime = pick(['oysterLime']); if (lime) bits.push(`${lime.en}${pick(['bokashi', 'toshoAburakasu']) ? ' and ' + pick(['bokashi', 'toshoAburakasu']).en : ''}: can go in on planting day`);
  if (cropId === 'potato') bits.push('no lime for potatoes (scab)');
  if (cropId === 'satsumaimo') bits.push('no nitrogen fertiliser for sweet potato — rich soil gives leaves, not tubers (つるぼけ)');
  if (['carrot', 'daikon', 'hatsuka', 'kabu'].includes(cropId)) bits.push('keep compost well mixed and at least 3 weeks old for root crops');
  return bits.join(' · ');
}
// suggested jobs = catalogue jobs + top-dressing with my products + weekly pest check
const FRUITING = ['tomato', 'minitomato', 'nasu', 'piman', 'chilli', 'shishito', 'kyuri', 'zucchini'];
function careJobs(cropId) {
  const cr = crop(cropId), jobs = (cr.jobs || []).map(j => j.slice());
  const top = pick(['bokashi', 'toshoAburakasu', 'chickenManure', 'aburakasu']);
  const feed = feedOf(cropId);
  for (const j of jobs) if (/追肥|side-dress|止め肥/i.test(j[0]) && top) j[4] = { product: top.en, perM2: feed === 'heavy' ? 40 : 30, perPlant: null };
  if (FRUITING.includes(cropId) && top && !jobs.some(j => /追肥|side-dress/i.test(j[0])))
    jobs.push(['Side-dress (追肥)', ['kyuri', 'zucchini'].includes(cropId) ? 21 : 30, 2, 'week', { product: top.en, perPlant: 1 }]);
  if (FRUITING.includes(cropId) || cr.family === 'brassica' || ['strawberry', 'soramame', 'edamame', 'lettuce'].includes(cropId))
    jobs.push(['Pest check (害虫チェック) – undersides & new growth', 7, 1, 'week']);
  return jobs;
}
// resolve a job's product amount for a planting at save time
function jobAmount(j, c, p) {
  const f = j[4]; if (!f) return { product: '', amount: null, unit: '' };
  if (f.perPlant) { const n = c ? Draw.layout(c, p).pts.length || 1 : 1; return { product: f.product, amount: f.perPlant * n, unit: 'handful' }; }
  const area = c ? (sectionArea(c, p.from, p.to) ?? 0.12) : 0.12;
  return { product: f.product, amount: Math.max(10, Math.round(f.perM2 * area / 5) * 5), unit: 'g' };
}
const jobAmountText = j => !j[4] ? '' : j[4].perPlant ? ` · ${j[4].product}, 1 handful per plant` : ` · ${j[4].product}, ~${j[4].perM2} g/m²`;

// ---------- pages ----------
function pageProducts() {
  setChrome('Products & sprays', { back: true, kicker: 'What you use' });
  const own = S.myProducts || PRODUCTS.map(p => p.id);
  A.toggleOwn = el => { const id = el.dataset.id; let l = S.myProducts || PRODUCTS.map(p => p.id); l = l.includes(id) ? l.filter(x => x !== id) : [...l, id]; S.myProducts = l; save().then(render); };
  const group = (title, kinds) => `<section><h3>${title}</h3><ul class="plist log">${PRODUCTS.filter(p => kinds.includes(p.kind)).map(p => `<li${own.includes(p.id) ? '' : ' class="off"'}><a href="#/product/${p.id}"><span class="lic">${p.kind === 'spray' ? (p.organic ? '🌱' : '⚗️') : p.kind === 'homemade' ? '🧪' : p.kind === 'lime' ? '🐚' : p.kind === 'compost' ? '🪏' : '🌿'}</span><span class="grow"><b>${esc(p.en)}</b> <small>${esc(p.ja)} · ${esc(p.maker)}</small><small>${esc(p.what)}</small>${p.kind !== 'spray' && p.kind !== 'homemade' ? `<small>${p.wait ? `Dig in ${p.wait >= 14 ? Math.round(p.wait / 7) + '–' + (Math.round(p.wait / 7) + 1) + ' weeks' : 'about a week'} before planting` : 'Can go in on planting day'}${p.top ? ' · fine as a top-dressing straight away' : ''}</small>` : ''}</span>›</a></li>`).join('')}</ul></section>`;
  const html = `<p class="hint">These are used for feeding plans, bed prep and the spray checks. Untick anything you no longer have on the product’s page.</p>
    ${group('Sprays', ['spray', 'homemade'])}${group('Fertilisers', ['fert'])}${group('Lime & compost', ['lime', 'compost'])}
    <p class="hint">Spray rules come from Japan’s official pesticide registry (農林水産省 農薬登録情報提供システム), checked ${REG_DATE}. Labels can change — the label on your bottle always wins.</p>`;
  void own;
  return { html };
}
function pageProduct(id) {
  const p = product(id); if (!p) return { html: notFound() };
  setChrome(p.en, { back: true, kicker: p.ja });
  const own = !S.myProducts || S.myProducts.includes(p.id);
  A.toggleOwn = () => { let l = S.myProducts || PRODUCTS.map(x => x.id); l = own ? l.filter(x => x !== id) : [...l, id]; S.myProducts = l; save().then(render); };
  const crops = [...new Set(S.plantings.filter(x => x.status !== 'harvested').map(x => x.cropId))];
  const allCropIds = Object.keys(CROP_REG).concat('lettuce');
  let body = '';
  if (p.reg) {
    const R = REGISTRATIONS[p.reg];
    const mine = crops.map(cid => [cid, regSummary(id, cid, (S.plantings.find(x => x.cropId === cid && x.status !== 'harvested') || {}).variety)]);
    const others = allCropIds.filter(cid => !crops.includes(cid)).map(cid => [cid, regSummary(id, cid)]).filter(([, s]) => s && s.ok);
    const row = ([cid, s]) => s && s.ok ? `<tr><td>${ic(cid, 18)} ${esc(crop(cid).en)}<small>${esc(s.crop)}</small></td><td>${s.pests.map(pestEn).join(', ')}</td><td>${[...new Set(s.dils.map(dilEn))].join(' or ')}</td><td>${s.when.map(whenEn).join('; ')}</td><td>${s.uses === Infinity ? 'no limit' : s.uses + '×'}</td></tr>`
      : `<tr class="no"><td>${ic(cid, 18)} ${esc(crop(cid).en)}</td><td colspan="4">Not registered — not allowed</td></tr>`;
    const tot = Object.entries((R.rows[0] || [])[6] || {});
    body += `<section><h3>Where it’s allowed</h3>
      ${crops.length ? `<h4>Your crops now</h4><div class="tscroll"><table class="reg"><tr><th>Crop</th><th>Pests</th><th>Dilution</th><th>When</th><th>Max uses</th></tr>${mine.map(row).join('')}</table></div>` : ''}
      ${others.length ? `<details${crops.length ? '' : ' open'}><summary>Other crops in the app (${others.length})</summary><div class="tscroll"><table class="reg"><tr><th>Crop</th><th>Pests</th><th>Dilution</th><th>When</th><th>Max uses</th></tr>${others.map(row).join('')}</table></div></details>` : ''}
      ${tot.length ? `<p class="hint">Some limits also count other products with the same ingredient (${tot.map(([k]) => esc(k)).join(', ')}) — e.g. treated seedlings.</p>` : ''}
      <p class="hint">Registration no. ${R.reg} · ${esc(R.name)} · from the MAFF pesticide registry, ${REG_DATE}.</p></section>`;
  }
  if (p.mix) body += spinoMixer(p);
  if (p.id === 'stochu') body += stochuCard();
  const html = `<section><p><b>${esc(p.what)}</b></p><p class="muted">${esc(p.ja)} · ${esc(p.maker)}${p.npk ? ' · N-P-K ' + esc(p.npk) : ''}</p>
      ${p.organic != null ? `<p>${p.organic ? '🌱 <b>Organic</b>' : '⚗️ <b>Not organic</b>'}${p.organicNote ? ' — ' + esc(p.organicNote) : ''}</p>` : ''}
      ${p.kind !== 'spray' && p.kind !== 'homemade' ? `<p>${p.wait ? `⏳ Dig in ${p.wait >= 14 ? `${Math.round(p.wait / 7)}–${Math.round(p.wait / 7) + 1} weeks` : 'about a week'} before sowing/planting.` : '✅ Can go in on planting day.'}${p.top ? ' ✅ Fine as a top-dressing straight away.' : ''}</p>` : ''}
      ${(p.notes || []).length ? `<ul class="bul">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</section>
    ${body}
    <label class="inl chkline"><input type="checkbox" data-act="toggleOwn"${own ? ' checked' : ''}> <span>I have this — use it in plans and suggestions</span></label>`;
  return { html };
}
function spinoMixer(p) {
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
function stochuLegal() { return 'Vinegar (食酢) is an approved special pesticide (特定農薬). Shōchū and wood vinegar are still under review by the ministry: using them yourself on your own judgement is not enforced against, but they must not be sold or advertised as pesticides.'; }
function stochuCard() {
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
