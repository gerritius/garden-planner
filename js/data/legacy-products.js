// Products the app used to come with (versions before 1.44). Nothing here is offered to anyone: the app has no built-in
// products. It's kept only to bring gardens saved by older versions forward — products they had ticked, or used in their
// records, become their own entries (with the spray rules they showed then, below) — and to recognise old records.

export const OLD_PRODUCTS = [
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
  { id: 'kasei888', kind: 'fert', en: 'Chemical fertiliser 8-8-8', ja: '化成肥料 8-8-8', maker: 'generic', organic: false, wait: 0, top: true, npk: '8-8-8',
    what: 'Balanced quick-release granular fertiliser', notes: ['Fast-acting: plants can use nearly all of it this season.', 'Mix it well into the soil as base fertiliser; as a side-dressing keep it a few cm from stems.', 'Not allowed in organic (JAS) growing.'] },
  { id: 'woodAsh', kind: 'lime', en: 'Wood ash', ja: '草木灰', maker: 'generic', organic: true, wait: 7, top: true, npk: 'about 0-3-7',
    what: 'Potash (K) and a little phosphate; alkaline like lime', notes: ['Mostly potash — good before fruiting crops, potatoes and onions.', 'Alkaline: it raises pH like lime, so count it as part of your liming.', 'Don’t mix it with nitrogen manures (chicken manure, aburakasu) at the same time — it drives off ammonia. Keep a week apart.'] },
  { id: 'kuntan', kind: 'amend', en: 'Kuntan (smoked rice husk charcoal)', ja: 'もみ殻くん炭', maker: 'generic', organic: true, wait: 0, top: true, npk: 'about 0-0.2-0.5',
    what: 'Soil conditioner — drainage, air and microbes; tiny amount of potash', notes: ['Mainly improves soil structure and drainage; its nutrient value is small.', 'Slightly alkaline.', 'Good mixed into seed and potting mixes, or around seedlings.'] },
];
// % N-P-K (approx.) and the share of N plants can use this season. Composts release most N slowly.
export const OLD_NPK = {
  bokashi: [4, 4, 2, 0.7], toshoAburakasu: [3, 3, 2, 0.75], aburakasu: [5, 2, 1, 0.7], chickenManure: [3, 5, 3, 0.6], neem: [4, 1, 1, 0.5],
  cowCompost: [0.7, 0.7, 0.7, 0.1], cowHuskCompost: [0.6, 0.7, 0.8, 0.1], barkCompost: [0.5, 0.3, 0.3, 0.05], oysterLime: [0, 0, 0, 0],
  kasei888: [8, 8, 8, 1], woodAsh: [0, 3, 7, 0], kuntan: [0, 0.2, 0.5, 0],
};

export const OLD_CAT_INFO = {   // form, uses, [start, release] days, lead days (to start working)
  kasei888: ['quick', ['base', 'side'], [0, 30], 0], bokashi: ['slow', ['base', 'side'], [3, 40], 7], toshoAburakasu: ['slow', ['base', 'side'], [3, 40], 7],
  chickenManure: ['slow', ['base', 'side'], [7, 55], 10], aburakasu: ['slow', ['base', 'side'], [14, 70], 21], neem: ['slow', ['base'], [14, 70], 14],
  oysterLime: [null, ['lime'], null, 0], woodAsh: [null, ['potash'], [0, 30], 0], kuntan: [null, ['improver'], null, 0],
  cowCompost: [null, ['compost'], [0, 180], 14], cowHuskCompost: [null, ['compost'], [0, 180], 14], barkCompost: [null, ['compost'], [0, 180], 7],
};
export const OLD_MIXES = [   // potting mixes: built-in fertiliser N-P-K, g per litre (estimated), days it lasts
  { id: 'touikawa', en: 'Touikawa Peace Farm vegetable soil', ja: 'おいしい野菜を育てる土', npkv: [6, 36, 6], gPerL: 2, lasts: 365, what: 'slow-release 6-36-6 + magnesium (like Magamp K), feeding steadily for about a year' },
  { id: 'iris', en: 'Iris Ohyama Golden Granular Soil', ja: 'アイリスオーヤマ ゴールデン粒状培養土', npkv: [8, 8, 8], gPerL: 1, lasts: 30, what: 'starter fertiliser (about 1:1:1) that lasts about a month' },
  { id: 'other', en: 'Potting mix (with starter fertiliser)', ja: '培養土', npkv: [8, 8, 8], gPerL: 1, lasts: 30, what: 'starter fertiliser for about a month' },
];
export const OLD_ALIASES = [
  ['toshoAburakasu', /tosho|東商|超醗酵|超発酵|発酵油|醗酵油|fermented\s*(abura|oil)/i], ['aburakasu', /abura\s*kasu|油\s*かす|油\s*粕|油カス|oil\s*-?\s*cake/i],
  ['chickenManure', /chicken|鶏\s*ふん|鶏\s*糞|鶏フン/i], ['bokashi', /bokashi|ぼかし|ボカシ/i], ['neem', /neem|ニーム/i],
  ['oysterLime', /oyster|かき殻|牡蠣|カキ殻|有機石灰/i], ['cowHuskCompost', /husk|もみ殻|籾殻/i], ['cowCompost', /cow|牛\s*ふん|牛\s*糞|牛フン/i],
  ['barkCompost', /bark|バーク/i], ['kasei888', /8\s*-\s*8\s*-\s*8|化成/i],
];

// the spray rules older versions showed for the sprays above, per crop: [days to wait before picking, most sprays a
// season (null: no limit)] — what those products become as your own entries
export const OLD_SPRAY_RULES = {"spinoace":{"nasu":[1,2],"celery":[3,3],"minitomato":[1,2],"tomato":[1,2],"naganegi":[3,3],"carrot":[3,3],"komatsuna":[14,2],"hakusai":[3,3],"daikon":[7,3],"hatsuka":[14,2],"cabbage":[3,3],"spinach":[1,2],"kabu":[1,3],"piman":[1,2],"snappea":[1,3],"kyuri":[1,2],"lettuce":[7,2],"broccoli":[3,3],"mizuna":[3,1],"zucchini":[1,3],"ingen":[1,3],"chingensai":[14,2],"garlic":[1,3],"shishito":[1,2],"sayaendo":[1,3],"cauliflower":[3,3],"strawberry":[1,2],"nanohana":[14,2],"kale":[14,2],"rucola":[14,2],"redcabbage":[3,3],"stickbroc":[3,3],"minihakusai":[3,3],"leaflettuce":[7,2],"sunnylettuce":[7,2],"hanegi":[3,3]},"paiBenicaV":{"nasu":[1,5],"minitomato":[1,6],"tomato":[1,6],"komatsuna":[7,2],"cabbage":[7,5],"kyuri":[1,5],"strawberry":[1,5],"redcabbage":[7,5]},"benicaXnext":{"nasu":[1,3],"minitomato":[1,2],"tomato":[1,2],"hakusai":[7,2],"cabbage":[7,2],"kyuri":[1,2],"lettuce":[14,2],"redcabbage":[7,2],"minihakusai":[7,2],"leaflettuce":[14,2],"sunnylettuce":[14,2]},"benicaNatural":{"nasu":[0,null],"celery":[0,null],"potato":[0,null],"minitomato":[0,null],"tomato":[0,null],"naganegi":[0,null],"hatamanegi":[0,null],"carrot":[0,null],"komatsuna":[0,null],"edamame":[0,null],"hakusai":[0,null],"daikon":[0,null],"hatsuka":[0,null],"cabbage":[0,null],"spinach":[0,null],"kabu":[0,null],"piman":[0,null],"chilli":[0,null],"snappea":[0,null],"kyuri":[0,null],"onion":[0,null],"lettuce":[0,null],"broccoli":[0,null],"satoimo":[0,null],"satsumaimo":[0,null],"shungiku":[0,null],"mizuna":[0,null],"zucchini":[0,null],"corn":[0,null],"ingen":[0,null],"chingensai":[0,null],"garlic":[0,null],"shishito":[0,null],"sayaendo":[0,null],"soramame":[0,null],"cauliflower":[0,null],"strawberry":[0,null],"nanohana":[0,null],"okra":[0,null],"goya":[0,null],"kabocha":[0,null],"suika":[0,null],"melon":[0,null],"rakkasei":[0,null],"gobo":[0,null],"shoga":[0,null],"shiso":[0,null],"basil":[0,null],"kale":[0,null],"beet":[0,null],"rucola":[0,null],"pakuchi":[0,null],"molokhia":[0,null],"kushinsai":[0,null],"mitsuba":[0,null],"parsley":[0,null],"rakkyo":[0,null],"chard":[0,null],"redcabbage":[0,null],"stickbroc":[0,null],"minihakusai":[0,null],"leaflettuce":[0,null],"sunnylettuce":[0,null],"hanegi":[0,null],"eshalot":[0,null],"kuromame":[0,null]}};
