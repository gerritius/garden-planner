/* Problem finder (pests, diseases & disorders), crop quality / bolting warnings, soil temperature for sowing,
   on-phone backup snapshots, shopping list for upcoming plans, and a purchases log (all spending, all up). */
'use strict';

// =====================================================================
// Problem finder
// =====================================================================
const SIGNS = [
  ['holes', 'Holes chewed in leaves'], ['skeleton', 'Leaves eaten to a lacy skeleton / see-through windows'], ['shot', 'Lots of tiny round pin-holes'],
  ['frass', 'Droppings (frass) on or between leaves'], ['tip', 'Growing tip eaten or webbed together'], ['cutoff', 'Seedlings cut off at soil level'],
  ['slime', 'Slime trails; ragged holes appear overnight'], ['clusters', 'Clusters of tiny insects; sticky or curled leaves'], ['fly', 'Tiny white insects fly up when disturbed'],
  ['silver', 'Silvery or bronze speckles / streaks'], ['stipple', 'Fine pale stippling, fine webbing underneath'], ['trails', 'Winding white trails inside leaves'],
  ['ladder', 'Leaves scraped in ladder patterns; spotty orange beetles'], ['orange', 'Orange beetles; round holes in cucurbit leaves'], ['shield', 'Shield-shaped bugs; spotted or deformed pods/fruit'],
  ['peck', 'Seedlings pulled up, leaves or fruit pecked'], ['powder', 'White powder on leaves'], ['fuzz', 'Yellow angular patches on top, grey-purple fuzz underneath'],
  ['spots', 'Brown or black spots or blotches on leaves'], ['softrot', 'Soft, smelly rot at the base or inside the head'], ['wilt', 'Wilting even though the soil is moist'],
  ['clubroot', 'Wilts on warm days; swollen, lumpy roots'], ['mosaic', 'Mottled yellow-green, puckered or curled leaves'], ['yellow', 'Older leaves yellowing evenly'],
  ['purple', 'Leaves tinged purple'], ['split', 'Fruit, heads or roots splitting'], ['bolt', 'Sending up a flower stalk early'], ['ber', 'Dark sunken patch on the bottom of the fruit'],
];
const BRAS = ['brassica'];
// [id, en, ja, crops/families ('all' = any), signs, active months, registration pest names, diary tag, how to confirm, what to do (no spray first)]
const PROBLEMS = [
  ['aphids', 'Aphids', 'アブラムシ', ['all'], ['clusters', 'mosaic'], [3, 4, 5, 6, 9, 10, 11], ['アブラムシ類'], 'aphids', 'Look under leaves and on new shoots for green/black soft insects; ants often run up and down.',
    ['Squash or hose them off; pick off badly infested leaves', 'Silver reflective mulch and insect netting keep them off young plants', 'Go easy on nitrogen — soft lush growth attracts them', 'Ladybirds and lacewing larvae eat them — don’t spray if they’re already at work']],
  ['aomushi', 'Cabbage white caterpillars', 'アオムシ', BRAS, ['holes', 'frass'], [4, 5, 6, 9, 10, 11], ['アオムシ'], 'caterpillars', 'Velvety green caterpillars along the leaf veins; white butterflies around; yellow eggs under leaves.',
    ['Insect netting from planting day is the best fix', 'Pick off caterpillars and rub off eggs on each check', 'BT (in Benica Natural) only harms caterpillars — good organic choice']],
  ['konaga', 'Diamondback moth', 'コナガ', BRAS, ['skeleton', 'holes', 'frass'], [4, 5, 6, 9, 10, 11], ['コナガ'], 'caterpillars', 'Small (1 cm) pale green caterpillars that wriggle and drop on a thread when touched; see-through “windows” in leaves.',
    ['Insect netting (fine mesh, 0.8 mm or less)', 'Pick off; check the heart of young plants', 'Alternate sprays — it builds resistance quickly']],
  ['yotou', 'Armyworms / cutworm moths', 'ヨトウムシ', ['all'], ['holes', 'frass', 'skeleton'], [5, 6, 9, 10, 11], ['ヨトウムシ', 'ヨトウムシ類', 'ハスモンヨトウ', 'シロイチモジヨトウ', 'オオタバコガ'], 'caterpillars', 'Big holes overnight, nothing visible by day: look at night with a torch, or dig gently around the base — fat grey-brown caterpillars hide in the soil.',
    ['Hunt at night and hand-pick', 'Look for egg patches (felty masses) under leaves and remove them', 'Netting stops the moths laying']],
  ['meiga', 'Cabbage webworm', 'ハイマダラノメイガ', ['daikon', 'kabu', 'hakusai', 'cabbage', 'broccoli', 'komatsuna', 'chingensai', 'cauliflower', 'hatsuka'], ['tip', 'frass'], [8, 9, 10], ['ハイマダラノメイガ'], 'caterpillars', 'The growing point of young brassicas is webbed together with a small caterpillar inside — the plant stops growing a heart.',
    ['Net seedlings from sowing in late summer', 'Pinch out affected tips with the caterpillar']],
  ['uwaba', 'Loopers', 'ウワバ', ['brassica', 'lettuce'], ['holes', 'frass'], [5, 6, 9, 10], ['ウワバ類'], 'caterpillars', 'Green caterpillars that walk with a “looping” arch.', ['Hand-pick; netting']],
  ['nomi', 'Flea beetles', 'キスジノミハムシ', ['daikon', 'kabu', 'komatsuna', 'chingensai', 'mizuna', 'hatsuka', 'hakusai', 'cabbage', 'nanohana'], ['shot'], [4, 5, 6, 7, 8, 9, 10], ['キスジノミハムシ'], 'fleabeetle', 'Tiny black beetles with yellow stripes that jump when disturbed; daikon roots get small dark tunnels.',
    ['Fine insect netting from sowing, edges buried', 'Avoid brassica after brassica — they overwinter in the soil', 'Keep seedlings growing fast (water in dry spells)']],
  ['habachi', 'Turnip sawfly', 'カブラハバチ', BRAS, ['holes', 'skeleton'], [5, 6, 9, 10, 11], ['カブラハバチ類'], 'caterpillars', 'Black velvety larvae that curl up and drop when touched.', ['Hand-pick; netting']],
  ['hamoguri', 'Leaf miners', 'ハモグリバエ', ['legume', 'nightshade', 'spinach', 'lettuce', 'brassica', 'celery', 'kyuri', 'zucchini', 'shungiku', 'carrot'], ['trails'], [3, 4, 5, 6, 9, 10, 11], ['ハモグリバエ類', 'アシグロハモグリバエ'], 'leafminer', 'Hold the leaf to the light — a tiny larva at the end of the trail.',
    ['Squash the larva in the leaf or pick off mined leaves', 'Yellow sticky traps catch the adult flies', 'Netting on young plants']],
  ['azami', 'Thrips', 'アザミウマ', ['allium', 'nightshade', 'cucurbit', 'spinach', 'strawberry', 'legume', 'lettuce'], ['silver'], [5, 6, 7, 8, 9, 10], ['アザミウマ類', 'ミカンキイロアザミウマ', 'ミナミキイロアザミウマ', 'ネギアザミウマ'], 'other', 'Tap a leaf over white paper: tiny thin yellow or black insects. Onions and negi get white flecked streaks.',
    ['Blue sticky traps', 'Silver reflective mulch', 'Remove weeds nearby — they shelter there']],
  ['konajirami', 'Whitefly', 'コナジラミ', ['nightshade', 'cucurbit', 'legume'], ['fly', 'clusters'], [6, 7, 8, 9, 10], ['オンシツコナジラミ', 'コナジラミ類', 'タバココナジラミ'], 'other', 'Clouds of tiny white flies from under the leaves; sticky honeydew and black mould.',
    ['Yellow sticky traps', 'Hose under leaves; remove the worst leaves']],
  ['hadani', 'Spider mites', 'ハダニ', ['nasu', 'kyuri', 'zucchini', 'edamame', 'ingen', 'strawberry', 'tomato', 'minitomato'], ['stipple'], [6, 7, 8, 9], ['ハダニ類'], 'other', 'Tiny moving dots under the leaf (use a magnifier); worst in hot, dry spells.',
    ['Spray water under the leaves regularly — they hate humidity', 'Remove badly affected leaves']],
  ['dashi', '28-spot ladybird', 'テントウムシダマシ', ['nasu', 'potato', 'tomato', 'minitomato', 'piman'], ['ladder'], [5, 6, 7, 8], ['テントウムシダマシ類', 'ニジュウヤホシテントウ'], 'ladybird28', 'Dull orange, hairy ladybirds with many spots (useful ladybirds are shiny).',
    ['Hand-pick adults into a tub; squash yellow egg clusters under leaves', 'Don’t grow eggplant next to potatoes']],
  ['urihamushi', 'Cucurbit leaf beetle', 'ウリハムシ', ['cucurbit'], ['orange', 'holes'], [4, 5, 6, 7], ['ウリハムシ'], 'other', 'Plain orange beetles chewing ring-shaped holes, worst on young plants.',
    ['Net young plants (行灯 / row cover) until they’re big', 'Silver mulch; catch them in the cool early morning when they’re sluggish']],
  ['kamemushi', 'Stink bugs', 'カメムシ', ['legume', 'nightshade', 'corn', 'kyuri'], ['shield'], [6, 7, 8, 9, 10], ['ホオズキカメムシ', 'カメムシ類', 'ホソヘリカメムシ'], 'stinkbug', 'Shield-shaped bugs that smell when squashed; beans with spotted, shrivelled seeds.',
    ['Knock them into a jar of soapy water', 'Netting while pods are forming']],
  ['nekiri', 'Cutworms', 'ネキリムシ', ['all'], ['cutoff'], [4, 5, 6, 9, 10], ['ネキリムシ類', 'カブラヤガ', 'タマナヤガ'], 'cutworm', 'Dig gently around the cut plant — a C-shaped grey caterpillar is usually within a few cm.',
    ['Find and remove the caterpillar (it will strike again)', 'Collars around transplants (cut paper cups)', 'Clear weeds before planting']],
  ['namekuji', 'Slugs & snails', 'ナメクジ', ['all'], ['slime', 'holes'], [3, 4, 5, 6, 9, 10, 11], ['ナメクジ類', 'カタツムリ類'], 'slugs', 'Check with a torch after dark or after rain.',
    ['Hand-pick at night; lay boards/plant pots as hiding traps and empty them each morning', 'Keep the bed edges tidy', 'Slug pellets are pesticides too — only use one registered for that crop']],
  ['tori', 'Birds', '鳥', ['legume', 'brassica', 'corn', 'strawberry', 'tomato', 'minitomato'], ['peck'], [1, 2, 3, 4, 5, 10, 11, 12], [], 'birds', 'Brown-eared bulbuls (ヒヨドリ) strip brassicas in winter; pigeons pull up bean and pea seedlings.',
    ['Net seedlings and winter brassicas', 'Netting or old CDs only help for a while — netting is the reliable fix']],
  ['udonko', 'Powdery mildew', 'うどんこ病', ['cucurbit', 'legume', 'nasu', 'strawberry', 'tomato', 'minitomato', 'piman'], ['powder'], [5, 6, 7, 8, 9, 10], ['うどんこ病'], 'powdery', 'White flour-like patches that rub off; worst in dry weather with humid nights.',
    ['Remove the worst leaves; keep air moving', 'Baking soda (重曹) is an approved 特定農薬 — about 1 g per litre, test a few leaves first', 'Don’t over-feed nitrogen']],
  ['beto', 'Downy mildew', 'べと病', ['kyuri', 'brassica', 'onion', 'naganegi', 'spinach', 'lettuce'], ['fuzz', 'spots'], [4, 5, 6, 9, 10, 11], ['べと病'], 'downy', 'Yellow patches limited by the veins; grey fuzz underneath in the morning.',
    ['Remove infected leaves; water the soil, not the leaves', 'Mulch to stop soil splashing; improve drainage']],
  ['nanpu', 'Soft rot', '軟腐病', ['hakusai', 'cabbage', 'daikon', 'potato', 'lettuce', 'celery', 'broccoli'], ['softrot'], [6, 7, 8, 9, 10], ['軟腐病'], 'rot', 'Slimy, very smelly rot — often after rain, insect damage or cuts.',
    ['Pull and bin the plant (not the compost)', 'Avoid wounding plants; good drainage; control caterpillars']],
  ['nekobu', 'Clubroot', '根こぶ病', BRAS, ['clubroot', 'wilt'], [5, 6, 9, 10, 11], ['根こぶ病'], 'rot', 'Pull a plant: knobbly, swollen roots.',
    ['Remove plants with all roots; don’t compost', 'Raise the pH with lime (oyster shell lime) and improve drainage', 'Leave 4+ years before brassicas there again; CR (根こぶ抵抗性) varieties help']],
  ['aogare', 'Wilt diseases', '青枯病・萎凋病', ['nightshade', 'cucurbit', 'strawberry'], ['wilt'], [6, 7, 8, 9], ['青枯病', '萎凋病', 'つる割病'], 'rot', 'Cut the stem and put it in water: milky ooze = bacterial wilt (青枯病); brown streaks inside = fungal wilt.',
    ['Remove the whole plant', 'Rotate away from the same family for several years; grafted seedlings (接ぎ木苗) resist it']],
  ['hanten', 'Leaf spot / blight', '斑点病・疫病・炭疽病', ['all'], ['spots'], [4, 5, 6, 7, 8, 9, 10], ['黒斑病', '白斑病', '斑点病', '疫病', '炭疽病', '黒腐病', 'さび病', '褐斑病'], 'other', 'Spots spread in wet weather; tomato/potato blight gives dark greasy blotches that spread fast.',
    ['Remove spotted leaves; mulch so soil doesn’t splash up', 'Water the soil not the leaves; give plants space for airflow']],
  ['mosaic', 'Mosaic virus', 'モザイク病', ['cucurbit', 'nightshade', 'brassica', 'legume', 'spinach'], ['mosaic'], [4, 5, 6, 7, 8, 9, 10], [], 'other', 'Mottled light/dark green, distorted new leaves; spread by aphids.',
    ['No cure — remove the plant', 'Control aphids early; silver mulch helps keep them off']],
  ['nitrogen', 'Hungry (low nitrogen)', '肥料切れ', ['all'], ['yellow'], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [], 'other', 'Starts on the oldest leaves and moves up; whole plant pale.',
    ['Top-dress: Bokashi or Tosho fermented aburakasu work quickly', 'Pots and bags run out fastest — feed little and often']],
  ['cold', 'Cold (normal in winter)', '低温', ['all'], ['purple'], [11, 12, 1, 2, 3], [], 'other', 'Purple tints in cold weather are usually just the plant protecting itself.',
    ['Nothing to do — it greens up in spring', 'If young plants stay purple in warm weather they may need phosphorus']],
  ['bolting', 'Bolting', '抽苔 (とう立ち)', ['brassica', 'lettuce', 'spinach', 'shungiku', 'allium', 'celery'], ['bolt'], [3, 4, 5, 6, 7], [], 'other', 'Heat, lengthening days or a cold spell on young plants trigger flowering.',
    ['Pick now — quality drops fast', 'Next time sow at the right time or choose a bolt-resistant (晩抽) variety']],
  ['split', 'Splitting', '裂果・裂球・裂根', ['tomato', 'minitomato', 'cabbage', 'hakusai', 'carrot', 'daikon', 'kabu'], ['split'], [5, 6, 7, 8, 9, 10, 11, 12, 1, 2], [], 'other', 'Usually heavy rain or watering after a dry spell, or leaving it too long.',
    ['Pick ready crops before heavy rain', 'Water evenly; mulch keeps soil moisture steady']],
  ['ber', 'Blossom-end rot', '尻腐れ', ['tomato', 'minitomato', 'piman', 'shishito'], ['ber'], [6, 7, 8, 9], [], 'other', 'A calcium uptake problem, mostly from uneven watering.',
    ['Water steadily (pots especially)', 'Oyster shell lime or a calcium foliar feed for the next fruits; remove affected fruit']],
];
const famOf = id => crop(id).family || 'other';
const probFits = (pr, cropId) => pr[3].includes('all') || pr[3].includes(cropId) || pr[3].includes(famOf(cropId));
function problemMatches(cropId, signs) {
  const m = new Date().getMonth() + 1;
  return PROBLEMS.filter(pr => probFits(pr, cropId)).map(pr => { const hit = pr[4].filter(s => signs.includes(s)).length; return { pr, hit, score: hit * 3 + (pr[5].includes(m) ? 1 : 0) - (pr[3].includes('all') ? 0.5 : 0) }; })
    .filter(x => x.hit).sort((a, b) => b.score - a.score);
}
function problemSprays(pr, p) {
  if (!pr[6].length) return null;
  const out = [];
  for (const prod of myProducts(['spray'])) {
    if (!prod.reg) continue;
    const rows = regRows(prod.reg, p.cropId, p.variety).filter(r => r[5] === '散布' && pr[6].includes(r[1]));
    if (rows.length) out.push({ prod, phi: Math.max(...rows.map(r => phiDays(r[3]))), uses: Math.min(...rows.map(r => maxUses(r[4]))), dils: [...new Set(rows.map(r => r[2]))] });
  }
  return out.sort((a, b) => (b.prod.organic - a.prod.organic));
}
function pageDoctor(q) {
  const ps = S.plantings.filter(isLive), p = planting(q.get('p')) || null;
  setChrome('What’s wrong?', { back: true, kicker: p ? cropName(p.cropId) : 'Problem finder' });
  if (!p) {
    const html = `<p class="hint">Pick the crop with the problem.</p><ul class="plist">${ps.map(x => `<li><a href="#/doctor?p=${x.id}">${ic(x.cropId)}<span class="grow"><b>${esc(cropName(x.cropId))}</b><small>${esc((container(x.containerId) || {}).name || '')}</small></span>›</a></li>`).join('') || '<li class="muted">Nothing growing.</li>'}</ul>`;
    return { html };
  }
  const sel = (q.get('s') || '').split(',').filter(Boolean);
  const signs = SIGNS.filter(([id]) => PROBLEMS.some(pr => probFits(pr, p.cropId) && pr[4].includes(id)));
  const res = sel.length ? problemMatches(p.cropId, sel) : [];
  A.sign = el => { const s = new Set(sel); s.has(el.dataset.s) ? s.delete(el.dataset.s) : s.add(el.dataset.s); location.replace(`#/doctor?p=${p.id}&s=${[...s].join(',')}`); };
  A.toDiary = async el => {
    const pr = PROBLEMS.find(x => x[0] === el.dataset.id);
    (p.diary = p.diary || []).push({ id: uid(), date: todayStr(), photo: null, note: `Possible ${pr[1]} (${pr[2]}): ${sel.map(s => (SIGNS.find(x => x[0] === s) || [, s])[1].toLowerCase()).join('; ')}`, tags: [pr[7]] });
    await save(); el.textContent = 'Saved to diary ✓'; el.disabled = true;
  };
  const card = ({ pr }, i) => {
    const sp = problemSprays(pr, p);
    return `<section class="dx${i === 0 ? ' top' : ''}"><h3>${i === 0 ? 'Best match: ' : ''}${esc(pr[1])} <small class="ja">${esc(pr[2])}</small></h3>
      <p class="small"><b>Check:</b> ${esc(pr[8])}</p>
      <ul class="bul small">${pr[9].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${sp === null ? '' : sp.length ? `<p class="small"><b>Your sprays registered for this on ${esc(crop(p.cropId).en)}:</b></p><ul class="bul small">${sp.map(s => `<li>${s.prod.organic ? '🌱' : '⚗️'} <a href="#/product/${s.prod.id}">${esc(s.prod.en)}</a> — ${dilsEn(s.dils)} · ${s.phi ? `wait ${s.phi === 1 ? '1 day' : s.phi + ' days'} before picking` : 'no wait'}${s.uses === Infinity ? '' : ` · max ${s.uses} uses`}</li>`).join('')}</ul>`
        : `<p class="small muted">None of your sprays is registered for this on ${esc(crop(p.cropId).en)} — stick to the steps above.</p>`}
      <button class="btn small" data-act="toDiary" data-id="${pr[0]}">📝 Save to diary</button></section>`;
  };
  const html = `<p class="hint">Tick what you see on the ${esc(crop(p.cropId).en)}. This narrows down the usual suspects for this crop and time of year — it can’t see your plant, so always check with the “Check” tip. If it isn’t clear, take a leaf to a garden centre or JA.</p>
    <div class="sowchips signs">${signs.map(([id, l]) => `<button class="chip${sel.includes(id) ? ' on' : ''}" data-act="sign" data-s="${id}">${esc(l)}</button>`).join('')}</div>
    ${sel.length ? (res.length ? res.slice(0, 4).map(card).join('') : '<p class="muted">Nothing in the list matches — try fewer signs.</p>') : ''}`;
  return { html };
}

// =====================================================================
// Quality & bolting warnings
// =====================================================================
const HEAT_BOLT = ['lettuce', 'spinach', 'komatsuna', 'chingensai', 'mizuna', 'shungiku', 'celery'];
const DAY_BOLT = ['spinach', 'lettuce', 'chingensai', 'komatsuna', 'hakusai', 'cabbage', 'daikon', 'kabu', 'naganegi', 'mizuna', 'shungiku', 'nanohana', 'broccoli'];
const SPLITTERS = ['tomato', 'minitomato', 'cabbage', 'hakusai', 'carrot', 'daikon', 'kabu'];
const FROST_HEADS = ['lettuce', 'broccoli', 'cauliflower'];
function qualityWarnings(only) {
  const td = todayStr(), days = Weather.days().slice(0, 5), m = new Date().getMonth() + 1, out = [];
  const near = p => p.harvestDate && p.harvestDate <= addDays(td, 10);
  const live = S.plantings.filter(isLive).filter(p => !only || p.id === only.id);
  const outdoors = p => !(container(p.containerId) || {}).indoor;
  const hot = days.filter(d => d.max >= 28), cold = days.find(d => d.min <= -2);
  const rainy = days.find(d => d.rain >= 20), dryBefore = Object.entries(S.rainHist || {}).filter(([k]) => k >= addDays(td, -6) && k < td).every(([, v]) => v < 2);
  for (const p of live) {
    const n = crop(p.cropId).en;
    if (HEAT_BOLT.includes(p.cropId) && hot.length && (near(p) || normalT(td) >= 17))
      out.push([p, 'bolt', `${n}: ${hot.length > 1 ? 'warm days' : 'a warm day'} ahead (${Math.round(Math.max(...hot.map(d => d.max)))}°) — ${near(p) ? 'pick soon, it may bolt or turn bitter' : 'keep it watered; it may bolt early'}.`]);
    else if (DAY_BOLT.includes(p.cropId) && warming(td) && normalT(td) >= 8 && p.harvestDate && p.harvestDate <= td)
      out.push([p, 'bolt', `${n}: lengthening days make it flower now — pick ${p.cropId === 'naganegi' ? 'before the flower buds (ネギ坊主) open' : 'before it bolts'}.`]);
    if (SPLITTERS.includes(p.cropId) && rainy && dryBefore && near(p) && outdoors(p))
      out.push([p, 'split', `${n}: ${Math.round(rainy.rain)} mm of rain ${dayName(rainy.date) === 'Today' ? 'today' : 'on ' + dayName(rainy.date)} after a dry week — pick what’s ready first, it may split.`]);
    if (FROST_HEADS.includes(p.cropId) && cold && near(p) && outdoors(p))
      out.push([p, 'frost', `${n}: hard frost ${dayName(cold.date)} (${Math.round(cold.min)}°) can blacken the ${p.cropId === 'lettuce' ? 'outer leaves' : 'heads'} — pick or cover.`]);
  }
  return out;
}

// =====================================================================
// Soil temperature for sowing
// =====================================================================
// [minimum for germination, comfortable from, too warm above] °C at ~6 cm
const SOIL_T = {
  ingen: [12, 18], edamame: [15, 20], corn: [12, 18], kyuri: [15, 20], zucchini: [15, 20], tomato: [13, 20], minitomato: [13, 20], nasu: [15, 22], piman: [15, 22], shishito: [15, 22], chilli: [15, 22],
  carrot: [7, 15, 30], daikon: [5, 15, 30], hatsuka: [5, 15, 30], komatsuna: [5, 15, 30], chingensai: [5, 15, 30], mizuna: [5, 15, 30], kabu: [5, 15, 30], hakusai: [5, 18, 30],
  cabbage: [5, 15, 30], broccoli: [5, 15, 30], cauliflower: [5, 15, 30], spinach: [4, 12, 25], lettuce: [4, 15, 25], shungiku: [10, 15, 25], celery: [10, 15, 25],
  onion: [5, 15, 25], naganegi: [7, 15, 30], snappea: [5, 12, 25], sayaendo: [5, 12, 25], soramame: [5, 15, 25], potato: [7, 12], satsumaimo: [15, 18], satoimo: [15, 20],
};
function soilTemps() {
  const h = S.weather && S.weather.hourly; if (!h || !h.soil_temperature_6cm) return null;
  const td = todayStr(), by = {};
  h.time.forEach((t, i) => { const d = t.slice(0, 10), v = h.soil_temperature_6cm[i]; if (v == null || d < addDays(td, -3) || d > addDays(td, 6)) return; (by[d] = by[d] || []).push(v); });
  const days = Object.keys(by).sort().map(d => ({ d, mean: by[d].reduce((a, b) => a + b, 0) / by[d].length }));
  const week = days.filter(x => x.d >= td);
  return days.length ? { days, now: (days.find(x => x.d === td) || days[days.length - 1]).mean, week: week.length ? week.reduce((a, b) => a + b.mean, 0) / week.length : null } : null;
}
function soilVerdict(cropId, t) {
  const r = SOIL_T[cropId]; if (!r || t == null) return null;
  const v = Math.round(t);
  if (t < r[0]) return { ok: 0, txt: `too cold to sow (soil ~${v}°, needs ${r[0]}°+)` };
  if (r[2] && t > r[2]) return { ok: 1, txt: `soil warm (~${v}°) — germination can be patchy above ${r[2]}°; sow in the cool of evening and keep moist` };
  if (t < r[1]) return { ok: 1, txt: `soil cool (~${v}°) — slow to come up (best ${r[1]}°+)` };
  return { ok: 2, txt: `soil ~${v}° — good for sowing` };
}
function soilBadge(cropId) {
  const st = soilTemps(); if (!st) return '';
  const v = soilVerdict(cropId, st.week ?? st.now); if (!v) return '';
  return `<small class="soilb s${v.ok}">${v.ok === 0 ? '❄' : v.ok === 1 ? '◐' : '✓'}</small>`;
}
function soilLine(cropId, method) {
  if (method && method !== 'seed') return '';
  const st = soilTemps(); if (!st) return '';
  const v = soilVerdict(cropId, st.week ?? st.now);
  return v ? `<p class="hint soil s${v.ok}">🌡 This week: ${esc(v.txt)}.</p>` : '';
}

// =====================================================================
// Backup snapshots (on this phone)
// =====================================================================
const SNAP_KEEP = 7;
async function snapshotDaily() {
  try {
    const td = todayStr(), list = (await DB.get('snaps')) || [];
    if (list.some(s => s.date === td) || !S.plantings.length) return;
    await DB.set('snap:' + td, JSON.parse(JSON.stringify(S)));
    list.push({ date: td, plantings: S.plantings.length, tasks: S.tasks.length });
    while (list.length > SNAP_KEEP) { const old = list.shift(); await DB.set('snap:' + old.date, null); }
    await DB.set('snaps', list);
  } catch (e) { console.warn('snapshot', e); }
}
async function snapshotSection() {
  const el = $('#snaps'); if (!el) return;
  const list = ((await DB.get('snaps')) || []).slice().reverse();
  el.innerHTML = list.length ? `<p class="small">The app also keeps a copy of your records from each of the last ${SNAP_KEEP} days you used it, on this phone — handy if something gets deleted by mistake. (They don’t help if the phone is lost — that’s what the exported backup is for.)</p>
    <ul class="plist">${list.map(s => `<li><span class="grow">${niceDate(s.date)}<small>${s.plantings} plantings · ${s.tasks} job${s.tasks === 1 ? "" : "s"}</small></span><button class="btn small" data-act="restoreSnap" data-d="${s.date}">Restore</button></li>`).join('')}</ul>` : '';
  A.restoreSnap = async b => {
    const snap = await DB.get('snap:' + b.dataset.d); if (!snap) return alert('That copy is no longer available.');
    if (!await confirmBox(`Go back to your records as they were on <b>${niceDate(b.dataset.d)}</b>?<br>Anything added since is lost (photos are kept).`, 'Restore', true)) return;
    const keep = { lastBackup: S.lastBackup };
    S = Object.assign(blank(), snap, keep); await save(); alert('Restored.'); go('#/');
  };
}

// =====================================================================
// Shopping list for upcoming plans
// =====================================================================
function shopItems(weeks) {
  const td = todayStr(), until = addDays(td, weeks * 7), items = [];
  const plans = S.plantings.filter(p => isPlanned(p) && p.sowDate <= until).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
  const count = p => { try { const c = container(p.containerId); return c ? Draw.layout(c, p).pts.length : 0; } catch (e) { return 0; } };
  for (const p of plans) {
    const c = container(p.containerId), cr = crop(p.cropId), where = (c ? c.name : '') + (sectionOf(p) ? ' ' + sectionOf(p) : ''), n = count(p);
    if (p.method === 'seedling' && (p.raise || 'buy') === 'buy') items.push({ key: 'sl:' + p.id, cat: 'seedlings', title: `${cr.en}${p.variety ? ' · ' + p.variety : ''} seedlings${n ? ' × ' + n : ''}`, sub: `for ${where} · plant ${shortDate(p.sowDate)}`, by: addDays(p.sowDate, -1) });
    else { const sowBy = p.raise === 'tray' || p.raise === 'pot' ? traySowFor(p.cropId, p.sowDate) : p.sowDate; items.push({ key: 'sd:' + p.id, cat: 'seeds', title: `${cr.en}${p.variety ? ' · ' + p.variety : ''} seed`, sub: `have enough? sow ${shortDate(sowBy)} · ${where}`, by: sowBy }); }
    if (NETTED.includes(p.cropId) && c) { const w = c.type === 'bed' ? c.width : c.diameter || c.width, l = c.type === 'bed' ? p.to - p.from : c.diameter || c.length;
      items.push({ key: 'net:' + p.id, cat: 'netting', title: `Insect netting for ${cr.en}`, sub: `${where} · about ${((w + 90) / 100).toFixed(1)} × ${((l + 90) / 100).toFixed(1)} m with hoops (0.8 mm mesh or finer)`, by: p.sowDate }); }
    if (TALL.includes(p.cropId)) items.push({ key: 'sup:' + p.id, cat: 'supports', title: `Supports for ${cr.en}`, sub: `${where} · ${['snappea', 'sayaendo', 'kyuri', 'ingen'].includes(p.cropId) ? 'poles + climbing net (きゅうりネット)' : 'stakes (支柱) and ties'}`, by: p.sowDate });
  }
  // fertiliser / compost / lime needed for planned crops, totalled by product
  const tot = {};
  for (const p of plans) for (const f of p.fert || []) { if (!f.product || f.amount == null) continue; const [base, mul] = unitBase(f.unit || 'g'); const k = f.product + '|' + base; tot[k] = (tot[k] || 0) + f.amount * mul; }
  for (const [k, v] of Object.entries(tot)) { const [prod, base] = k.split('|'); items.push({ key: 'f:' + prod, cat: 'feed', title: prod, sub: `${fmtTot(v, base)} for the planned crops — check what’s left in the bag`, by: null }); }
  return items;
}
const SHOP_CATS = [['seedlings', '🌱 Seedlings to buy'], ['seeds', '🫘 Seed to sow'], ['feed', '🌿 Fertiliser, compost & lime'], ['netting', '🕸️ Netting'], ['supports', '🪵 Supports']];
function pageShop(q) {
  const weeks = +q.get('w') || 6;
  setChrome('What to buy', { back: true, kicker: `For crops planned in the next ${weeks} weeks` });
  const items = shopItems(weeks), done = S.shopDone || {};
  A.shopTick = async el => { S.shopDone = Object.assign({}, S.shopDone); if (S.shopDone[el.dataset.k]) delete S.shopDone[el.dataset.k]; else S.shopDone[el.dataset.k] = todayStr(); await save(); render(); };
  A.shopBuy = el => purchaseDialog(null, { item: el.dataset.t, cat: el.dataset.c === 'feed' ? 'fert' : el.dataset.c === 'seedlings' ? 'seedlings' : el.dataset.c === 'seeds' ? 'seeds' : el.dataset.c === 'netting' ? 'net' : 'support' });
  const html = `<div class="filt">${[2, 4, 6, 10].map(w => `<a class="chip ${w === weeks ? 'on' : ''}" href="#/shop?w=${w}">${w} wks</a>`).join('')}</div>
    ${items.length ? SHOP_CATS.map(([k, l]) => { const its = items.filter(i => i.cat === k); return its.length ? `<section><h3>${l}</h3><ul class="plist shop">${its.map(i => `<li class="${done[i.key] ? 'got' : ''}"><label class="chk"><input type="checkbox" data-act="shopTick" data-k="${esc(i.key)}"${done[i.key] ? ' checked' : ''}><span></span></label>
      <span class="grow"><b>${esc(i.title)}</b><small>${esc(i.sub)}${i.by ? ` · by ${shortDate(i.by < todayStr() ? todayStr() : i.by)}` : ''}</small></span><button class="btn small" data-act="shopBuy" data-t="${esc(i.title)}" data-c="${k}">💴</button></li>`).join('')}</ul></section>` : ''; }).join('')
    : `<div class="empty-state">Nothing planned in the next ${weeks} weeks.<br><a class="btn" href="#/plan">📅 Season plan</a></div>`}
    <p class="hint">From your planned crops (Season plan). Tick things off as you get them; 💴 records the purchase in Spending.</p>`;
  return { html };
}

// =====================================================================
// Purchases (all spending, all up)
// =====================================================================
const BUY_CATS = [['spray', '💦 Sprays'], ['fert', '🌿 Fertiliser & lime'], ['compost', '🪏 Compost & soil'], ['seeds', '🫘 Seeds'], ['seedlings', '🌱 Seedlings'],
  ['net', '🕸️ Netting & covers'], ['mulch', '⬛ Mulch & sheeting'], ['support', '🪵 Supports & ties'], ['pots', '🪴 Bags, pots & trays'], ['tools', '🧰 Tools & equipment'], ['fees', '🏷️ Plot fees'], ['other', '✎ Other']];
const catOfProduct = pr => !pr ? 'other' : pr.kind === 'spray' ? 'spray' : pr.kind === 'compost' ? 'compost' : pr.kind === 'homemade' ? 'other' : 'fert';
const yen = n => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
function purchaseDialog(e, preset) {
  const isNew = !e, td = todayStr();
  e = e || Object.assign({ id: uid(), date: td, item: '', cat: 'other', cost: '', qty: '', note: '' }, preset || {});
  const known = [...new Set([...PRODUCTS.map(p => p.en), ...(S.purchases || []).map(x => x.item)])];
  modal(`<h3>${isNew ? 'Record a purchase' : 'Edit purchase'}</h3><form id="buyf" class="form">
      <label>What<input name="item" list="buyl" value="${esc(e.item)}" required placeholder="e.g. Insect netting 1.8 × 5 m"><datalist id="buyl">${known.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <div class="two"><label>Cost (¥)<input name="cost" type="number" inputmode="numeric" min="0" value="${e.cost ?? ''}" required></label><label>Quantity / size<input name="qty" value="${esc(e.qty || '')}" placeholder="e.g. 2 bags, 5 kg"></label></div>
      <label>Category<select name="cat">${BUY_CATS.map(([k, l]) => `<option value="${k}"${k === e.cat ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="two"><label>Date<input name="date" type="date" value="${e.date || ''}" max="${td}"></label><label class="inl chkline"><input type="checkbox" name="nodate"${e.date ? '' : ' checked'}> <span>Don’t remember when</span></label></div>
      <label>Note<input name="note" value="${esc(e.note || '')}" placeholder="shop, brand…"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#buyf');
    f.item.addEventListener('change', () => { const pr = productByName(f.item.value.trim()); if (pr) f.cat.value = catOfProduct(pr); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { S.purchases = S.purchases.filter(x => x.id !== e.id); await save(); close(); render(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const pr = productByName(f.item.value.trim());
      Object.assign(e, { item: f.item.value.trim(), cost: Math.round(+f.cost.value || 0), qty: f.qty.value.trim(), cat: f.cat.value, date: f.nodate.checked ? '' : (f.date.value || td), note: f.note.value.trim(), productId: pr ? pr.id : null });
      if (isNew) (S.purchases = S.purchases || []).push(e);
      await save(); close(); render();
    };
  });
}
function pageSpend(q) {
  setChrome('Spending', { back: true, kicker: 'Everything bought for the garden' });
  const all = (S.purchases || []).slice(), yr = q.get('y') || 'all';
  const years = [...new Set(all.map(x => x.date ? x.date.slice(0, 4) : 'earlier'))].sort().reverse();
  const list = yr === 'all' ? all : all.filter(x => (x.date ? x.date.slice(0, 4) : 'earlier') === yr);
  const total = list.reduce((a, b) => a + (+b.cost || 0), 0), grand = all.reduce((a, b) => a + (+b.cost || 0), 0);
  const byCat = BUY_CATS.map(([k, l]) => [k, l, list.filter(x => x.cat === k).reduce((a, b) => a + (+b.cost || 0), 0)]).filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]);
  const max = Math.max(1, ...byCat.map(x => x[2]));
  A.newBuy = () => purchaseDialog();
  A.editBuy = el => purchaseDialog(all.find(x => x.id === el.dataset.id));
  const groups = {}; for (const x of list.sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1))) { const k = x.date ? new Date(x.date + 'T00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) : 'Earlier (no date)'; (groups[k] = groups[k] || []).push(x); }
  const html = `<div class="spendtot"><b>${yen(total)}</b><span>${yr === 'all' ? 'spent all up' : yr === 'earlier' ? 'with no date' : 'in ' + yr}${yr !== 'all' ? ` · ${yen(grand)} all up` : ''}</span></div>
    ${years.length > 1 ? `<div class="filt"><a class="chip ${yr === 'all' ? 'on' : ''}" href="#/spend">All</a>${years.map(y => `<a class="chip ${y === yr ? 'on' : ''}" href="#/spend?y=${y}">${y === 'earlier' ? 'No date' : y}</a>`).join('')}</div>` : ''}
    <button class="btn primary wide" data-act="newBuy">＋ Record a purchase</button>
    ${byCat.length ? `<section><h3>By category</h3><div class="sbars">${byCat.map(([, l, v]) => `<div class="sbar"><span>${l}</span><i style="width:${v / max * 100}%"></i><b>${yen(v)}</b></div>`).join('')}</div></section>` : ''}
    ${Object.entries(groups).map(([k, xs]) => `<section><h3>${k} <small class="muted">${yen(xs.reduce((a, b) => a + (+b.cost || 0), 0))}</small></h3><ul class="plist">${xs.map(x => `<li data-act="editBuy" data-id="${x.id}"><span class="lic">${(BUY_CATS.find(c => c[0] === x.cat) || ['', '✎'])[1].split(' ')[0]}</span><span class="grow"><b>${esc(x.item)}</b><small>${[x.qty, x.date ? shortDate(x.date) : '', x.note].filter(Boolean).map(esc).join(' · ')}</small></span><b>${yen(x.cost)}</b></li>`).join('')}</ul></section>`).join('')}
    ${!all.length ? '<p class="hint">Add what you’ve already bought too — tick “Don’t remember when” for older things. Products, seeds, seedlings, netting, mulch, supports, bags, tools, plot fees…</p>' : ''}`;
  return { html };
}
