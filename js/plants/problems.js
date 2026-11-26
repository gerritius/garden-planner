// Problem finder (pests, diseases & disorders), pests noted in the diary, and crop quality / bolting warnings.

import { dayLength, lengthening, normalT, seasonMonth, tropical } from '../climate/climate.js';
import { dayName, Weather } from '../climate/weather.js';
import { A, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { addDays, esc, todayStr, uid } from '../core/util.js';
import { CATALOG, DAY_BOLT, FROST_HEADS, HEAT_BOLT, PESTS, SPLITTERS } from '../data/catalog.js';
import { container, isLive, planting } from '../garden/garden.js';
import { spraysFor, waitText } from '../products/sprays.js';
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
// [id, name, (unused), crops/families ('all' = any), signs, active months, (unused), diary tag, how to confirm, what to do (no spray first)]
const PROBLEMS = [
  ['aphids', 'Aphids', '', ['all'], ['clusters', 'mosaic'], [3, 4, 5, 6, 9, 10, 11], [], 'aphids', 'Look under leaves and on new shoots for green/black soft insects; ants often run up and down.',
    ['Squash or hose them off; pick off badly infested leaves', 'Silver reflective mulch and insect netting keep them off young plants', 'Go easy on nitrogen — soft lush growth attracts them', 'Ladybirds and lacewing larvae eat them — don’t spray if they’re already at work']],
  ['aomushi', 'Cabbage white caterpillars', '', BRAS, ['holes', 'frass'], [4, 5, 6, 9, 10, 11], [], 'caterpillars', 'Velvety green caterpillars along the leaf veins; white butterflies around; yellow eggs under leaves.',
    ['Insect netting from planting day is the best fix', 'Pick off caterpillars and rub off eggs on each check', 'BT (Bacillus thuringiensis) sprays only harm caterpillars — a good organic choice']],
  ['konaga', 'Diamondback moth', '', BRAS, ['skeleton', 'holes', 'frass'], [4, 5, 6, 9, 10, 11], [], 'caterpillars', 'Small (1 cm) pale green caterpillars that wriggle and drop on a thread when touched; see-through “windows” in leaves.',
    ['Insect netting (fine mesh, 0.8 mm or less)', 'Pick off; check the heart of young plants', 'Alternate sprays — it builds resistance quickly']],
  ['yotou', 'Armyworms / cutworm moths', '', ['all'], ['holes', 'frass', 'skeleton'], [5, 6, 9, 10, 11], [], 'caterpillars', 'Big holes overnight, nothing visible by day: look at night with a torch, or dig gently around the base — fat grey-brown caterpillars hide in the soil.',
    ['Hunt at night and hand-pick', 'Look for egg patches (felty masses) under leaves and remove them', 'Netting stops the moths laying']],
  ['meiga', 'Cabbage webworm', '', ['daikon', 'kabu', 'hakusai', 'cabbage', 'broccoli', 'komatsuna', 'chingensai', 'cauliflower', 'hatsuka'], ['tip', 'frass'], [8, 9, 10], [], 'caterpillars', 'The growing point of young brassicas is webbed together with a small caterpillar inside — the plant stops growing a heart.',
    ['Net seedlings from sowing in late summer', 'Pinch out affected tips with the caterpillar']],
  ['uwaba', 'Loopers', '', ['brassica', 'lettuce'], ['holes', 'frass'], [5, 6, 9, 10], [], 'caterpillars', 'Green caterpillars that walk with a “looping” arch.', ['Hand-pick; netting']],
  ['nomi', 'Flea beetles', '', ['daikon', 'kabu', 'komatsuna', 'chingensai', 'mizuna', 'hatsuka', 'hakusai', 'cabbage', 'nanohana'], ['shot'], [4, 5, 6, 7, 8, 9, 10], [], 'fleabeetle', 'Tiny black beetles with yellow stripes that jump when disturbed; daikon roots get small dark tunnels.',
    ['Fine insect netting from sowing, edges buried', 'Avoid brassica after brassica — they overwinter in the soil', 'Keep seedlings growing fast (water in dry spells)']],
  ['habachi', 'Turnip sawfly', '', BRAS, ['holes', 'skeleton'], [5, 6, 9, 10, 11], [], 'caterpillars', 'Black velvety larvae that curl up and drop when touched.', ['Hand-pick; netting']],
  ['hamoguri', 'Leaf miners', '', ['legume', 'nightshade', 'spinach', 'lettuce', 'brassica', 'celery', 'kyuri', 'zucchini', 'shungiku', 'carrot'], ['trails'], [3, 4, 5, 6, 9, 10, 11], [], 'leafminer', 'Hold the leaf to the light — a tiny larva at the end of the trail.',
    ['Squash the larva in the leaf or pick off mined leaves', 'Yellow sticky traps catch the adult flies', 'Netting on young plants']],
  ['azami', 'Thrips', '', ['allium', 'nightshade', 'cucurbit', 'spinach', 'strawberry', 'legume', 'lettuce'], ['silver'], [5, 6, 7, 8, 9, 10], [], 'other', 'Tap a leaf over white paper: tiny thin yellow or black insects. Onions and negi get white flecked streaks.',
    ['Blue sticky traps', 'Silver reflective mulch', 'Remove weeds nearby — they shelter there']],
  ['konajirami', 'Whitefly', '', ['nightshade', 'cucurbit', 'legume'], ['fly', 'clusters'], [6, 7, 8, 9, 10], [], 'other', 'Clouds of tiny white flies from under the leaves; sticky honeydew and black mould.',
    ['Yellow sticky traps', 'Hose under leaves; remove the worst leaves']],
  ['hadani', 'Spider mites', '', ['nasu', 'kyuri', 'zucchini', 'edamame', 'ingen', 'strawberry', 'tomato', 'minitomato'], ['stipple'], [6, 7, 8, 9], [], 'other', 'Tiny moving dots under the leaf (use a magnifier); worst in hot, dry spells.',
    ['Spray water under the leaves regularly — they hate humidity', 'Remove badly affected leaves']],
  ['dashi', '28-spot ladybird', '', ['nasu', 'potato', 'tomato', 'minitomato', 'piman'], ['ladder'], [5, 6, 7, 8], [], 'ladybird28', 'Dull orange, hairy ladybirds with many spots (useful ladybirds are shiny).',
    ['Hand-pick adults into a tub; squash yellow egg clusters under leaves', 'Don’t grow eggplant next to potatoes']],
  ['urihamushi', 'Cucurbit leaf beetle', '', ['cucurbit'], ['orange', 'holes'], [4, 5, 6, 7], [], 'other', 'Plain orange beetles chewing ring-shaped holes, worst on young plants.',
    ['Net young plants (row cover) until they’re big', 'Silver mulch; catch them in the cool early morning when they’re sluggish']],
  ['kamemushi', 'Stink bugs', '', ['legume', 'nightshade', 'corn', 'kyuri'], ['shield'], [6, 7, 8, 9, 10], [], 'stinkbug', 'Shield-shaped bugs that smell when squashed; beans with spotted, shrivelled seeds.',
    ['Knock them into a jar of soapy water', 'Netting while pods are forming']],
  ['nekiri', 'Cutworms', '', ['all'], ['cutoff'], [4, 5, 6, 9, 10], [], 'cutworm', 'Dig gently around the cut plant — a C-shaped grey caterpillar is usually within a few cm.',
    ['Find and remove the caterpillar (it will strike again)', 'Collars around transplants (cut paper cups)', 'Clear weeds before planting']],
  ['namekuji', 'Slugs & snails', '', ['all'], ['slime', 'holes'], [3, 4, 5, 6, 9, 10, 11], [], 'slugs', 'Check with a torch after dark or after rain.',
    ['Hand-pick at night; lay boards/plant pots as hiding traps and empty them each morning', 'Keep the bed edges tidy', 'Slug pellets are pesticides too — only use one registered for that crop']],
  ['tori', 'Birds', '', ['legume', 'brassica', 'corn', 'strawberry', 'tomato', 'minitomato'], ['peck'], [1, 2, 3, 4, 5, 10, 11, 12], [], 'birds', 'Brown-eared bulbuls strip brassicas in winter; pigeons pull up bean and pea seedlings.',
    ['Net seedlings and winter brassicas', 'Netting or old CDs only help for a while — netting is the reliable fix']],
  ['udonko', 'Powdery mildew', '', ['cucurbit', 'legume', 'nasu', 'strawberry', 'tomato', 'minitomato', 'piman'], ['powder'], [5, 6, 7, 8, 9, 10], [], 'powdery', 'White flour-like patches that rub off; worst in dry weather with humid nights.',
    ['Remove the worst leaves; keep air moving', 'Baking soda — about 1 g per litre of water; test a few leaves first', 'Don’t over-feed nitrogen']],
  ['beto', 'Downy mildew', '', ['kyuri', 'brassica', 'onion', 'naganegi', 'spinach', 'lettuce'], ['fuzz', 'spots'], [4, 5, 6, 9, 10, 11], [], 'downy', 'Yellow patches limited by the veins; grey fuzz underneath in the morning.',
    ['Remove infected leaves; water the soil, not the leaves', 'Mulch to stop soil splashing; improve drainage']],
  ['nanpu', 'Soft rot', '', ['hakusai', 'cabbage', 'daikon', 'potato', 'lettuce', 'celery', 'broccoli'], ['softrot'], [6, 7, 8, 9, 10], [], 'rot', 'Slimy, very smelly rot — often after rain, insect damage or cuts.',
    ['Pull and bin the plant (not the compost)', 'Avoid wounding plants; good drainage; control caterpillars']],
  ['nekobu', 'Clubroot', '', BRAS, ['clubroot', 'wilt'], [5, 6, 9, 10, 11], [], 'rot', 'Pull a plant: knobbly, swollen roots.',
    ['Remove plants with all roots; don’t compost', 'Raise the pH with lime (oyster shell lime) and improve drainage', 'Leave 4+ years before brassicas there again; clubroot-resistant (CR) varieties help']],
  ['aogare', 'Wilt diseases', '', ['nightshade', 'cucurbit', 'strawberry'], ['wilt'], [6, 7, 8, 9], [], 'rot', 'Cut the stem and put it in water: milky ooze = bacterial wilt; brown streaks inside = fungal wilt.',
    ['Remove the whole plant', 'Rotate away from the same family for several years; grafted seedlings resist it']],
  ['hanten', 'Leaf spot / blight', '', ['all'], ['spots'], [4, 5, 6, 7, 8, 9, 10], [], 'other', 'Spots spread in wet weather; tomato/potato blight gives dark greasy blotches that spread fast.',
    ['Remove spotted leaves; mulch so soil doesn’t splash up', 'Water the soil not the leaves; give plants space for airflow']],
  ['mosaic', 'Mosaic virus', '', ['cucurbit', 'nightshade', 'brassica', 'legume', 'spinach'], ['mosaic'], [4, 5, 6, 7, 8, 9, 10], [], 'other', 'Mottled light/dark green, distorted new leaves; spread by aphids.',
    ['No cure — remove the plant', 'Control aphids early; silver mulch helps keep them off']],
  ['nitrogen', 'Hungry (low nitrogen)', '', ['all'], ['yellow'], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [], 'other', 'Starts on the oldest leaves and moves up; whole plant pale.',
    ['Top-dress: Bokashi or Tosho fermented aburakasu work quickly', 'Pots and bags run out fastest — feed little and often']],
  ['cold', 'Cold (normal in winter)', '', ['all'], ['purple'], [11, 12, 1, 2, 3], [], 'other', 'Purple tints in cold weather are usually just the plant protecting itself.',
    ['Nothing to do — it greens up in spring', 'If young plants stay purple in warm weather they may need phosphorus']],
  ['bolting', 'Bolting', '', ['brassica', 'lettuce', 'spinach', 'shungiku', 'allium', 'celery'], ['bolt'], [3, 4, 5, 6, 7], [], 'other', 'Heat, lengthening days or a cold spell on young plants trigger flowering.',
    ['Pick now — quality drops fast', 'Next time sow at the right time or choose a bolt-resistant variety']],
  ['split', 'Splitting', '', ['tomato', 'minitomato', 'cabbage', 'hakusai', 'carrot', 'daikon', 'kabu'], ['split'], [5, 6, 7, 8, 9, 10, 11, 12, 1, 2], [], 'other', 'Usually heavy rain or watering after a dry spell, or leaving it too long.',
    ['Pick ready crops before heavy rain', 'Water evenly; mulch keeps soil moisture steady']],
  ['ber', 'Blossom-end rot', '', ['tomato', 'minitomato', 'piman', 'shishito'], ['ber'], [6, 7, 8, 9], [], 'other', 'A calcium uptake problem, mostly from uneven watering.',
    ['Water steadily (pots especially)', 'Oyster shell lime or a calcium foliar feed for the next fruits; remove affected fruit']],
];
// crops join the problems their records name (pests), and a linked crop the ones of the crop it's like
for (const c of CATALOG) {
  for (const id of c.pests || []) { const pr = PROBLEMS.find(x => x[0] === id); if (!pr) throw new Error(`crop ${c.id}: no problem '${id}'`); if (!pr[3].includes(c.id)) pr[3].push(c.id); }
  if (c.like) for (const pr of PROBLEMS) if (pr[3].includes(c.like) && !pr[3].includes(c.id)) pr[3].push(c.id);
}
const famOf = id => crop(id).family || 'other';
const probFits = (pr, cropId) => pr[3].includes('all') || pr[3].includes(cropId) || pr[3].includes(kin(cropId)) || pr[3].includes(famOf(cropId));
function problemMatches(cropId, signs) {
  // (each problem's months are Japan's; south of the equator they're six months on, and in the tropics there's no season)
  const m = seasonMonth(new Date().getMonth() + 1), inSeason = pr => !tropical() && pr[5].includes(m);
  return PROBLEMS.filter(pr => probFits(pr, cropId)).map(pr => { const hit = pr[4].filter(s => signs.includes(s)).length; return { pr, hit, score: hit * 3 + (inSeason(pr) ? 1 : 0) - (pr[3].includes('all') ? 0.5 : 0) }; })
    .filter(x => x.hit).sort((a, b) => b.score - a.score);
}
// your sprays entered for this crop (whether one suits this problem is on its label)
const problemSprays = p => spraysFor(p).sort((a, b) => (b.pr.organic - a.pr.organic));
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
    (p.diary = p.diary || []).push({ id: uid(), date: todayStr(), photo: null, note: `Possible ${pr[1]}: ${sel.map(s => (SIGNS.find(x => x[0] === s) || [, s])[1].toLowerCase()).join('; ')}`, tags: [pr[7]] });
    await save(); el.textContent = 'Saved to diary ✓'; el.disabled = true;
  };
  const card = ({ pr }, i) => {
    const sp = problemSprays(p);
    return `<section class="dx${i === 0 ? ' top' : ''}"><h3>${i === 0 ? 'Best match: ' : ''}${esc(pr[1])}</h3>
      <p class="small"><b>Check:</b> ${esc(pr[8])}</p>
      <ul class="bul small">${pr[9].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${sp.length ? `<p class="small"><b>Your sprays for ${esc(crop(p.cropId).en)}</b> — check the label covers this problem:</p><ul class="bul small">${sp.map(s => `<li>${s.pr.organic ? '🌱' : '⚗️'} <a href="#/product/${s.pr.id}">${esc(s.pr.en)}</a> — ${waitText(s.r.phi)}${s.r.max == null ? '' : ` · ${s.left} of ${s.r.max} sprays left`}</li>`).join('')}</ul>`
        : ''}
      <button class="btn small" data-act="toDiary" data-id="${pr[0]}">📝 Save to diary</button></section>`;
  };
  const html = `<p class="hint">Tick what you see on the ${esc(crop(p.cropId).en)}. This narrows down the usual suspects for this crop and time of year — it can’t see your plant, so always check with the “Check” tip. If it isn’t clear, take a leaf to a garden centre or your local plant clinic.</p>
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
    else if (DAY_BOLT.includes(kin(p.cropId)) && lengthening(td) && dayLength(td) >= 12 && normalT(td) >= 8 && p.harvestDate && p.harvestDate <= td)   // (spring: days past 12 h and lengthening)
      out.push([p, 'bolt', `${n}: lengthening days make it flower now — pick ${p.cropId === 'naganegi' ? 'before the flower buds open' : 'before it bolts'}.`]);
    if (SPLITTERS.includes(kin(p.cropId)) && rainy && dryBefore && near(p) && outdoors(p))
      out.push([p, 'split', `${n}: ${Math.round(rainy.rain)} mm of rain ${dayName(rainy.date) === 'Today' ? 'today' : 'on ' + dayName(rainy.date)} after a dry week — pick what’s ready first, it may split.`]);
    if (FROST_HEADS.includes(kin(p.cropId)) && cold && near(p) && outdoors(p))
      out.push([p, 'frost', `${n}: hard frost ${dayName(cold.date)} (${Math.round(cold.min)}°) can blacken the ${p.cropId === 'lettuce' ? 'outer leaves' : 'heads'} — pick or cover.`]);
  }
  return out;
}

// ---------- pests (diary tags) ----------
export const pestName = k => { const x = PESTS.find(p => p[0] === k); return x ? x[1] : k; };
export function pestPicker(sel = []) {
  return `<label>Problems spotted<div class="sowchips pests">${PESTS.map(([k, en]) => `<label class="chip big tog"><input type="checkbox" name="pest" value="${k}"${sel.includes(k) ? ' checked' : ''}><span>${esc(en)}</span></label>`).join('')}</div></label>`;
}
export const readPests = f => [...f.querySelectorAll('input[name=pest]:checked')].map(i => i.value);
