// Problem finder (pests, diseases & disorders), pests noted in the diary, and crop quality / bolting warnings.

import { normalT, warming } from '../climate/climate.js';
import { dayName, Weather } from '../climate/weather.js';
import { A, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { addDays, esc, todayStr, uid } from '../core/util.js';
import { DAY_BOLT, FROST_HEADS, HEAT_BOLT, PESTS, SPLITTERS } from '../data/catalog.js';
import { container, isLive, planting } from '../garden/garden.js';
import { myProducts } from '../products/library.js';
import { dilsEn, maxUses, phiDays, regRows } from '../products/sprays.js';
import { crop, cropName, ic, kin } from './crops.js';

// ---------- problem finder ----------
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
const probFits = (pr, cropId) => pr[3].includes('all') || pr[3].includes(cropId) || pr[3].includes(kin(cropId)) || pr[3].includes(famOf(cropId));
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
export function pageDoctor(q) {
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

// ---------- quality & bolting warnings ----------
export function qualityWarnings(only) {
  const td = todayStr(), days = Weather.days().slice(0, 5), out = [];
  const near = p => p.harvestDate && p.harvestDate <= addDays(td, 10);
  const live = S.plantings.filter(isLive).filter(p => !only || p.id === only.id);
  const outdoors = p => !(container(p.containerId) || {}).indoor;
  const hot = days.filter(d => d.max >= 28), cold = days.find(d => d.min <= -2);
  const rainy = days.find(d => d.rain >= 20), dryBefore = Object.entries(S.rainHist || {}).filter(([k]) => k >= addDays(td, -6) && k < td).every(([, v]) => v < 2);
  for (const p of live) {
    const n = crop(p.cropId).en;
    if (HEAT_BOLT.includes(kin(p.cropId)) && hot.length && (near(p) || normalT(td) >= 17))
      out.push([p, 'bolt', `${n}: ${hot.length > 1 ? 'warm days' : 'a warm day'} ahead (${Math.round(Math.max(...hot.map(d => d.max)))}°) — ${near(p) ? 'pick soon, it may bolt or turn bitter' : 'keep it watered; it may bolt early'}.`]);
    else if (DAY_BOLT.includes(kin(p.cropId)) && warming(td) && normalT(td) >= 8 && p.harvestDate && p.harvestDate <= td)
      out.push([p, 'bolt', `${n}: lengthening days make it flower now — pick ${p.cropId === 'naganegi' ? 'before the flower buds (ネギ坊主) open' : 'before it bolts'}.`]);
    if (SPLITTERS.includes(kin(p.cropId)) && rainy && dryBefore && near(p) && outdoors(p))
      out.push([p, 'split', `${n}: ${Math.round(rainy.rain)} mm of rain ${dayName(rainy.date) === 'Today' ? 'today' : 'on ' + dayName(rainy.date)} after a dry week — pick what’s ready first, it may split.`]);
    if (FROST_HEADS.includes(kin(p.cropId)) && cold && near(p) && outdoors(p))
      out.push([p, 'frost', `${n}: hard frost ${dayName(cold.date)} (${Math.round(cold.min)}°) can blacken the ${p.cropId === 'lettuce' ? 'outer leaves' : 'heads'} — pick or cover.`]);
  }
  return out;
}

// ---------- pests (diary tags) ----------
export const pestName = k => { const x = PESTS.find(p => p[0] === k); return x ? `${x[1]} ${x[2]}` : k; };
export function pestPicker(sel = []) {
  return `<label>Problems spotted<div class="sowchips pests">${PESTS.map(([k, en, ja]) => `<label class="chip big tog"><input type="checkbox" name="pest" value="${k}"${sel.includes(k) ? ' checked' : ''}><span>${esc(en)} <small>${ja}</small></span></label>`).join('')}</div></label>`;
}
export const readPests = f => [...f.querySelectorAll('input[name=pest]:checked')].map(i => i.value);
