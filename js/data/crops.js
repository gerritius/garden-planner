// The crop catalogue: one record per crop, with everything the app knows about growing it. Values are typical for
// Japanese home gardens in central Japan (中間地) — the packet is always the final word. Adding a crop means adding a record
// here (and its pests in plants/problems.js); the tables the rest of the app reads are built from these (data/catalog.js).
//
// Sizes in cm, times in days, temperatures °C (daily mean unless noted).
//   group: where you'd look for it (catalog GROUPS) · family: botanical, for rotation (catalog FAMILIES)
//   method: 'seed' sown where it grows (or tubers/cloves/sets planted where they grow) | 'seedling' planted out as plants
//   layout: default layout in beds · pot: in pots · dir 'along': rows down the long side
//   depth · rowSp: between rows · sowSp: sowing distance (seed) / plant spacing (seedling) · spread: mature width
//   thinStage / thinSp / daysThin: thinning · daysHarvest: sow / plant → earliest harvest, in its usual season in central Japan
//   sow: months to sow / plant in central Japan · tender: frost kills it · frostEnd: dug when frost takes the tops
//   germ: days to come up in warm soil [min, max] · soilT: soil °C for coming up [lowest, best, highest]
//   grow: growth speed from temperature — none at tb, the packet's speed at tref, no faster above tcap; warm: [lo, opt]
//         curve for warm-season crops (see growUnits) · profile: sowing-season rules (climate/sowing.js)
//   transplant: [days sowing → planting out when raised in trays, the sign it's ready] — 0: not raised in trays, and why
//   win: days it stays good after the first harvest · cont: picked over a season · late: what happens if left
//   jobs: suggested jobs [title, days after sowing/planting, repeat every N (0 = once), per]
//   feed: heavy / medium / light / legume feeder · n, p, k: g per m² over the season · stages: when side-dressing helps
//   ph: [low, high] · lime: g/m² of lime when liming · rest: years before the same family goes back in
//   flags: fruiting (picked over a long season), heading (heads stop in midwinter), boltIfBig (big plants bolt after
//          cold), heatBolt / dayBolt (bolts in heat / lengthening days), splits, frostHeads (heads damaged by frost),
//          halfHardy, tall (needs support), netted (insect net), bees (needs pollinators), noFreshCompost (roots fork)
//   reg: names in the pesticide register (legal per crop: never carried over to a linked crop)
//   like: a linked entry — everything it doesn't give comes from that crop (not reg, varieties or names)

const NET = ['Cover with insect netting (防虫ネット)', 0];

export const CROPS = [
  // ---- Eggplant ナス ----
  { id: 'nasu', en: 'Eggplant', ja: 'ナス', color: '#5b3a7a', group: 'fruit', family: 'nightshade', method: 'seedling', layout: 'rows', pot: 'center',
    depth: null, rowSp: 70, sowSp: 50, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 60, spread: 70, sow: [4, 5], tender: true,
    soilT: [15, 22], grow: { tb: 10, tref: 24, tcap: 28, warm: [10, 23] }, profile: { pick: 100 },
    transplant: [70, 'At 7–8 true leaves, first flower bud showing'], win: 90, cont: 1, late: 'fruit goes seedy and dull',
    jobs: [['Put in stake / support (支柱)', 0], ['Remove side shoots below first flower (わき芽かき)', 14], ['Tie stems to support (誘引)', 14, 2, 'week'], ['Summer prune for autumn crop (更新剪定)', 90]],
    feed: 'heavy', n: 30, p: 25, k: 25, rest: 4, flags: ['fruiting', 'tall', 'bees'], reg: [['なす'], ['野菜類']],
    varieties: ['千両二号', '黒陽', '筑陽', '水ナス', '米ナス'] },
  // ---- Celery セロリ ----
  { id: 'celery', en: 'Celery', ja: 'セロリ', color: '#8fbf4f', group: 'leaves', family: 'umbellifer', method: 'seedling', layout: 'staggered',
    depth: null, rowSp: 40, sowSp: 30, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 90, spread: 30, sow: [4, 5, 8, 9],
    soilT: [10, 15, 25], grow: { tb: 5, tref: 20, tcap: 24 }, profile: { rising: [12, 19], falling: [21, 27] },
    transplant: [70, 'At 6–8 true leaves'], win: 30, late: 'stalks get stringy and hollow', jobs: [['Side-dress (追肥)', 21, 3, 'week']],
    feed: 'heavy', n: 35, p: 30, k: 30, rest: 2, flags: ['heatBolt', 'halfHardy'], reg: [['セルリー'], ['野菜類']],
    varieties: ['コーネル619', 'トップセラー', 'ミニホワイト', 'スジなしセロリ', 'キンサイ（中国セロリ）'] },
  // ---- Potato じゃがいも ----
  { id: 'potato', en: 'Potato', ja: 'じゃがいも', color: '#b08850', group: 'tubers', family: 'nightshade', method: 'seed', layout: 'rows', pot: 'center',
    depth: 8, rowSp: 60, sowSp: 30, thinStage: 'Remove extra shoots: keep 2–3 stems when they\'re 10–15 cm tall', thinSp: null, daysThin: null,
    daysHarvest: 95, spread: 50, sow: [2, 3, 8, 9], tender: true, frostEnd: true, germ: [20, 30], soilT: [7, 12],
    grow: { tb: 5, tref: 18, tcap: 22 }, profile: { rising: [6, 10], falling: [21, 25.5] },
    transplant: [0, 'grown from seed potatoes, planted where they grow'], win: 21, late: 'skins split, pests get in',
    jobs: [['Remove extra stems, keep 2–3 (芽かき)', 25], ['Earth up (土寄せ)', 30], ['Earth up again (土寄せ)', 50]], feed: 'medium', n: 10, p: 15, k: 15,
    stages: [{ d: 25, t: 'when removing extra shoots (芽かき) and earthing up' }], ph: [5, 6], lime: 0, rest: 3, reg: [['ばれいしょ'], ['野菜類']],
    varieties: ['デジマ', '男爵薯', 'メークイン', 'キタアカリ', 'ニシユタカ'] },
  // ---- Mini tomato ミニトマト ----
  { id: 'minitomato', en: 'Mini tomato', ja: 'ミニトマト', color: '#e0443e', group: 'fruit', family: 'nightshade', method: 'seedling', layout: 'rows',
    pot: 'center', depth: null, rowSp: 60, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 60, spread: 50, sow: [4, 5],
    tender: true, soilT: [13, 20], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, profile: { pick: 90 },
    transplant: [55, 'When the first flower truss is opening'], win: 90, cont: 1, late: 'fruit splits after rain',
    jobs: [['Put in stake / support (支柱)', 0], ['Remove side shoots (わき芽かき)', 14, 1, 'week'], ['Tie stems to support (誘引)', 14, 1, 'week']],
    feed: 'heavy', n: 22, p: 20, k: 25, rest: 4, flags: ['fruiting', 'splits', 'tall', 'bees'], reg: [['ミニトマト'], ['野菜類']],
    varieties: ['アイコ', '千果', 'ピンキー', 'イエローアイコ', 'CFプチぷよ'] },
  // ---- Tomato (large) 大玉トマト ----
  { id: 'tomato', en: 'Tomato (large)', ja: '大玉トマト', color: '#c62828', group: 'fruit', family: 'nightshade', method: 'seedling', layout: 'rows',
    pot: 'center', depth: null, rowSp: 60, sowSp: 50, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 70, spread: 50, sow: [4, 5],
    tender: true, soilT: [13, 20], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, profile: { pick: 90 },
    transplant: [55, 'When the first flower truss is opening'], win: 90, cont: 1, late: 'fruit splits after rain',
    jobs: [['Put in stake / support (支柱)', 0], ['Remove side shoots (わき芽かき)', 14, 1, 'week'], ['Tie stems to support (誘引)', 14, 1, 'week']],
    feed: 'heavy', n: 22, p: 20, k: 25, rest: 4, flags: ['fruiting', 'splits', 'tall', 'bees'], reg: [['トマト'], ['野菜類']],
    varieties: ['桃太郎', 'ホーム桃太郎', '麗夏', '桃太郎ファイト', 'りんか409'] },
  // ---- Long onion 長ネギ ----
  { id: 'naganegi', en: 'Long onion', ja: '長ネギ', color: '#7cb36b', group: 'onions', family: 'allium', method: 'seedling', layout: 'rows',
    depth: null, rowSp: 90, sowSp: 5, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 120, spread: 5, sow: [4, 5, 6, 7],
    soilT: [7, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { rising: [12, 26] }, transplant: [55, 'About 20 cm tall'], win: 60,
    late: 'flower stalks form (ねぎ坊主)', jobs: [['Earth up (土寄せ)', 30, 4, 'week']], feed: 'heavy', n: 25, p: 15, k: 20,
    stages: [{ d: 30, t: 'with the first earthing-up (土寄せ)' }, { d: 60, t: 'with the second earthing-up' }, { d: 90, t: 'with the third earthing-up' }],
    ph: [6, 6.8], lime: 150, rest: 1, flags: ['dayBolt'], reg: [['ねぎ'], ['野菜類']], varieties: ['石倉一本太', 'ホワイトタイガー', '夏扇4号', '下仁田ネギ', '九条ネギ'] },
  // ---- Leaf onion 葉玉ねぎ ----
  { id: 'hatamanegi', en: 'Leaf onion', ja: '葉玉ねぎ', color: '#9ccc65', group: 'onions', family: 'allium', method: 'seedling', layout: 'rows',
    depth: null, rowSp: 15, sowSp: 12, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 120, spread: 12, sow: [10, 11],
    grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [11, 18] }, transplant: [55, 'About 20 cm tall'], win: 30,
    late: 'bulbs swell and leaves fall over', jobs: [['Side-dress (追肥)', 60]], feed: 'medium', n: 15, p: 10, k: 12, ph: [6, 6.8], lime: 150, rest: 1,
    reg: [['葉たまねぎ'], ['野菜類']], varieties: ['ソニック', '泉州黄', 'ターザン', '湘南レッド', 'OK黄'] },
  // ---- Carrot 人参 ----
  { id: 'carrot', en: 'Carrot', ja: '人参', color: '#f08a24', group: 'roots', family: 'umbellifer', method: 'seed', layout: 'continuous', depth: 0.5,
    rowSp: 20, sowSp: 1, thinStage: 'At 2–3 true leaves, then again at 5–6', thinSp: 10, daysThin: 25, daysHarvest: 110, spread: 10,
    sow: [3, 4, 7, 8], germ: [7, 14], soilT: [7, 15, 30], grow: { tb: 3, tref: 18, tcap: 22 }, profile: { heat: 25 },
    transplant: [0, 'roots resent moving — sow it where it grows'], win: 30, late: 'roots crack and go woody',
    jobs: [['Keep soil moist until seedlings are up', 0, 1, 'day'], ['Earth up around shoulders (土寄せ)', 40]], feed: 'light', n: 12, p: 12, k: 15,
    stages: [{ d: 5, t: 'after thinning' }, { d: 30, t: 'as roots thicken' }], ph: [5.5, 6.5], rest: 1, flags: ['splits', 'noFreshCompost'],
    reg: [['にんじん'], ['野菜類']], varieties: ['向陽二号', '時なし五寸', 'ベーターリッチ', '金時人参', 'ピッコロ'] },
  // ---- Komatsuna 小松菜 ----
  { id: 'komatsuna', en: 'Komatsuna', ja: '小松菜', color: '#3f8f3a', group: 'leaves', family: 'brassica', method: 'seed', layout: 'continuous',
    depth: 0.5, rowSp: 15, sowSp: 1, thinStage: 'At 3–4 true leaves', thinSp: 5, daysThin: 14, daysHarvest: 35, spread: 15, sow: [3, 4, 5, 6, 9, 10],
    germ: [2, 4], soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 25 }, transplant: [18, 'At 3 true leaves'], win: 12,
    late: 'leaves get tough and it bolts', jobs: [NET], feed: 'medium', n: 12, p: 10, k: 10,
    stages: [{ d: 5, t: 'after thinning (only if leaves look pale)' }], rest: 1, flags: ['heatBolt', 'dayBolt', 'netted'],
    reg: [['こまつな'], ['非結球あぶらな科葉菜類', '野菜類']], varieties: ['楽天', '夏楽天', 'よかった菜', '浜美2号', 'きよすみ'] },
  // ---- Edamame 枝豆 ----
  { id: 'edamame', en: 'Edamame', ja: '枝豆', color: '#6fae3f', group: 'beans', family: 'legume', method: 'seed', layout: 'rows', depth: 2, rowSp: 40,
    sowSp: 20, thinStage: 'Down to 2 plants once the first leaves open', thinSp: 20, daysThin: 10, daysHarvest: 80, spread: 40, sow: [4, 5, 6],
    tender: true, germ: [5, 8], soilT: [15, 20], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] },
    transplant: [14, 'When the first pair of leaves has opened'], win: 5, late: 'beans harden and lose sweetness',
    jobs: [['Net against birds until up', 0], ['Earth up (土寄せ)', 20]], feed: 'legume', n: 3, p: 8, k: 10,
    stages: [{ d: 30, t: 'at flowering — lightly, only if pale' }], rest: 2, flags: ['tall', 'bees'], reg: [['えだまめ'], ['野菜類']],
    varieties: ['湯あがり娘', '富貴', '天ヶ峰', 'だだちゃ豆', '丹波黒大豆'] },
  // ---- Hakusai 白菜 ----
  { id: 'hakusai', en: 'Hakusai', ja: '白菜', color: '#c5e1a5', group: 'heads', family: 'brassica', method: 'seed', layout: 'staggered', dir: 'along',
    depth: 1, rowSp: 60, sowSp: 45, thinStage: 'Down to 1 plant at 5–6 true leaves', thinSp: 45, daysThin: 25, daysHarvest: 80, spread: 50,
    sow: [8, 9], germ: [2, 4], soilT: [5, 18, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 21, warmLo: 14 },
    transplant: [22, 'At 4–5 true leaves'], win: 40, late: 'heads crack or bolt in spring',
    jobs: [NET, ['Side-dress & earth up (追肥・土寄せ)', 30], ['Tie up outer leaves for frost (頭を縛る)', 75]], feed: 'heavy', n: 25, p: 20, k: 25,
    stages: [{ d: 18, t: '2–3 weeks after planting / final thinning' }, { f: 0.5, t: 'as heads start to form (結球始め)' }], rest: 2,
    flags: ['boltIfBig', 'heading', 'dayBolt', 'splits', 'netted'], reg: [['はくさい'], ['結球あぶらな科葉菜類', '野菜類']],
    varieties: ['無双', '黄ごころ65', '黄ごころ85', 'タイニーシュシュ', '娃々菜'] },
  // ---- Daikon 大根 ----
  { id: 'daikon', en: 'Daikon', ja: '大根', color: '#e8eef0', group: 'roots', family: 'brassica', method: 'seed', layout: 'rows', depth: 1.5,
    rowSp: 60, sowSp: 30, thinStage: 'Down to 1 plant at 5–6 true leaves', thinSp: 30, daysThin: 25, daysHarvest: 60, spread: 35, sow: [3, 4, 8, 9],
    germ: [2, 4], soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 22 },
    transplant: [0, 'roots resent moving — sow it where it grows'], win: 20, late: 'roots go pithy (す入り)',
    jobs: [NET, ['Earth up after thinning (土寄せ)', 28]], feed: 'medium', n: 12, p: 10, k: 12,
    stages: [{ d: 5, t: 'at the last thinning (本葉5–6枚)' }, { d: 25, t: 'as roots start to thicken' }], ph: [5.5, 6.5], rest: 1,
    flags: ['dayBolt', 'splits', 'netted', 'noFreshCompost'], reg: [['だいこん'], ['野菜類']], varieties: ['耐病総太り', '三浦大根', '聖護院大根', '献夏37号', '紅芯大根'] },
  // ---- Radish 二十日大根 ----
  { id: 'hatsuka', en: 'Radish', ja: '二十日大根', color: '#e84d6f', group: 'roots', family: 'brassica', method: 'seed', layout: 'continuous', depth: 1,
    rowSp: 10, sowSp: 1, thinStage: 'At 2–3 true leaves', thinSp: 3, daysThin: 12, daysHarvest: 30, spread: 4, sow: [3, 4, 5, 6, 9, 10],
    germ: [2, 4], soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 24 },
    transplant: [0, 'roots resent moving — sow it where it grows'], win: 7, late: 'roots go pithy and split', jobs: [NET], feed: 'light', n: 6, p: 6,
    k: 6, rest: 0, flags: ['netted', 'noFreshCompost'], reg: [['はつかだいこん'], ['野菜類']],
    varieties: ['コメット', 'レッドチャイム', '紅白', 'フレンチブレックファスト', 'カラフルファイブ'] },
  // ---- Cabbage キャベツ ----
  { id: 'cabbage', en: 'Cabbage', ja: 'キャベツ', color: '#88c057', group: 'heads', family: 'brassica', method: 'seedling', layout: 'staggered',
    dir: 'along', depth: null, rowSp: 45, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 80, spread: 45, sow: [3, 4, 8, 9],
    soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 23 }, transplant: [30, 'At 5–6 true leaves'], win: 21,
    late: 'heads split open', jobs: [NET, ['Side-dress & earth up (追肥・土寄せ)', 21], ['Side-dress again (追肥)', 45]], feed: 'heavy', n: 25, p: 20, k: 25,
    stages: [{ d: 25, t: '3–4 weeks after planting' }, { f: 0.55, t: 'as heads start to form (結球始め)' }], rest: 2,
    flags: ['boltIfBig', 'heading', 'dayBolt', 'splits', 'netted'], reg: [['キャベツ'], ['結球あぶらな科葉菜類', '野菜類']],
    varieties: ['金系201', '初秋', '富士早生', '四季穫', 'グリーンボール'] },
  // ---- Spinach ほうれん草 ----
  { id: 'spinach', en: 'Spinach', ja: 'ほうれん草', color: '#2e7d32', group: 'leaves', family: 'amaranth', method: 'seed', layout: 'continuous', depth: 1,
    rowSp: 15, sowSp: 1, thinStage: 'At 2–3 true leaves', thinSp: 5, daysThin: 20, daysHarvest: 40, spread: 15, sow: [3, 4, 9, 10, 11],
    germ: [5, 10], soilT: [4, 12, 25], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 21, hardy: true },
    transplant: [21, 'At 2–3 true leaves — plant out young: its roots resent disturbance'], win: 14, late: 'bolts as days lengthen', jobs: [],
    feed: 'medium', n: 15, p: 12, k: 12, stages: [{ d: 7, t: 'after thinning' }], ph: [6.5, 7.2], lime: 200, rest: 1, flags: ['heatBolt', 'dayBolt'],
    reg: [['ほうれんそう'], ['野菜類']], varieties: ['強力オーライ', 'ブレード10', 'ミストラル', '弁天丸', '日本ほうれん草'] },
  // ---- Turnip カブ ----
  { id: 'kabu', en: 'Turnip', ja: 'カブ', color: '#f3f0e6', group: 'roots', family: 'brassica', method: 'seed', layout: 'continuous', depth: 1,
    rowSp: 20, sowSp: 1, thinStage: 'At 2–3 true leaves, then again at 5', thinSp: 10, daysThin: 15, daysHarvest: 50, spread: 12, sow: [3, 4, 9, 10],
    germ: [2, 4], soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 23 },
    transplant: [0, 'roots resent moving — sow it where it grows'], win: 10, late: 'roots crack and go pithy', jobs: [NET], feed: 'medium', n: 12,
    p: 10, k: 12, stages: [{ d: 5, t: 'after the last thinning' }], rest: 1, flags: ['dayBolt', 'splits', 'netted', 'noFreshCompost'],
    reg: [['かぶ'], ['野菜類']], varieties: ['耐病ひかり', 'スワン', '金町小かぶ', 'あやめ雪', '聖護院かぶ'] },
  // ---- Capsicum ピーマン ----
  { id: 'piman', en: 'Capsicum', ja: 'ピーマン', color: '#43a047', group: 'fruit', family: 'nightshade', method: 'seedling', layout: 'rows',
    pot: 'center', depth: null, rowSp: 60, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 60, spread: 50, sow: [4, 5],
    tender: true, soilT: [15, 22], grow: { tb: 10, tref: 24, tcap: 28, warm: [10, 23] }, profile: { pick: 100 },
    transplant: [70, 'Around 10 true leaves, first flower bud showing'], win: 100, cont: 1, late: 'fruit turns red and plant slows',
    jobs: [['Put in stake / support (支柱)', 0], ['Remove side shoots below first flower (わき芽かき)', 14]], feed: 'heavy', n: 28, p: 25, k: 25, rest: 3,
    flags: ['fruiting', 'tall', 'bees'], reg: [['ピーマン'], ['野菜類']], varieties: ['京波', '京みどり', 'エース', 'ニューエース', 'カリフォルニアワンダー'] },
  // ---- Hot chilli 唐辛子 ----
  { id: 'chilli', en: 'Hot chilli', ja: '唐辛子', color: '#d84315', group: 'fruit', family: 'nightshade', method: 'seedling', layout: 'rows',
    pot: 'center', depth: null, rowSp: 60, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 70, spread: 50, sow: [4, 5],
    tender: true, soilT: [15, 22], grow: { tb: 10, tref: 24, tcap: 28, warm: [10, 23] }, profile: { pick: 90 },
    transplant: [70, 'Around 10 true leaves'], win: 100, cont: 1, late: 'pods shrivel on the plant',
    jobs: [['Put in stake / support (支柱)', 0], ['Remove side shoots below first flower (わき芽かき)', 14]], feed: 'heavy', n: 25, p: 20, k: 20, rest: 3,
    flags: ['fruiting', 'tall', 'bees'], reg: [['とうがらし'], ['とうがらし類', '野菜類']], varieties: ['ハラペーニョ', '鷹の爪', '八房', 'ハバネロ', '島とうがらし'] },
  // ---- Snap pea スナップエンドウ ----
  { id: 'snappea', en: 'Snap pea', ja: 'スナップエンドウ', color: '#7cc576', group: 'beans', family: 'legume', method: 'seed', layout: 'rows', depth: 2,
    rowSp: 60, sowSp: 25, thinStage: 'Down to 2 plants at 2–3 true leaves', thinSp: 25, daysThin: 20, daysHarvest: 160, spread: 30, sow: [10, 11],
    germ: [7, 12], soilT: [5, 12, 25], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [11, 18], spring: [6, 12] },
    transplant: [21, 'At 3–4 true leaves'], win: 30, cont: 1, late: 'pods get stringy',
    jobs: [['Put up net / trellis (ネット)', 25], ['Side-dress in spring (追肥)', 120]], feed: 'legume', n: 8, p: 10, k: 10,
    stages: [{ w: 'restart', t: 'when growth restarts in spring' }, { f: 0.8, t: 'when flowering starts — lightly' }], ph: [6.2, 7], rest: 4,
    flags: ['tall', 'bees'], reg: [['さやえんどう'], ['野菜類']], varieties: ['スナック753', 'グルメ', 'つるなしスナック', 'ホルンスナック'] },
  // ---- Cucumber きゅうり ----
  { id: 'kyuri', en: 'Cucumber', ja: 'きゅうり', color: '#33691e', group: 'fruit', family: 'cucurbit', method: 'seedling', layout: 'rows', pot: 'center',
    depth: null, rowSp: 90, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 35, spread: 60, sow: [4, 5, 6, 7], tender: true,
    soilT: [15, 20], grow: { tb: 10, tref: 24, tcap: 28, warm: [9, 22] }, profile: { pick: 50 }, transplant: [28, 'At 3–4 true leaves'], win: 50,
    cont: 1, late: 'fruit gets huge and seedy',
    jobs: [['Put up net / trellis (ネット)', 0], ['Remove side shoots up to 5th leaf (わき芽かき)', 14], ['Tie in vines (誘引)', 14, 1, 'week']],
    feed: 'heavy', n: 28, p: 25, k: 25, ph: [5.5, 6.5], rest: 2, flags: ['fruiting', 'tall', 'bees'], reg: [['きゅうり'], ['野菜類']],
    varieties: ['夏すずみ', '四葉', 'フリーダムハウス1号', '北進', '霜知らず地這'] },
  // ---- Onion 玉ねぎ ----
  { id: 'onion', en: 'Onion', ja: '玉ねぎ', color: '#d8a95b', group: 'onions', family: 'allium', method: 'seedling', layout: 'rows', depth: null,
    rowSp: 15, sowSp: 12, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 200, spread: 12, sow: [11], soilT: [5, 15, 25],
    grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [10, 15], spring: [6, 12] },
    transplant: [55, '20–25 cm tall, about as thick as a pencil'], win: 21, late: 'bulbs rot if left in wet soil',
    jobs: [['Side-dress (追肥)', 60], ['Final side-dress (止め肥)', 110]], feed: 'heavy', n: 22, p: 20, k: 20,
    stages: [{ w: 'mid', t: 'mid-winter — lightly' }, { w: 'restart', t: 'as growth restarts — the last feed (止め肥); none after it', last: true }],
    ph: [6, 6.8], lime: 150, rest: 1, reg: [['たまねぎ'], ['野菜類']], varieties: ['ソニック', '泉州黄', 'OK黄', 'ネオアース', '湘南レッド'] },
  // ---- Lettuce レタス ----
  { id: 'lettuce', en: 'Lettuce', ja: 'レタス', color: '#a5d66f', group: 'leaves', family: 'aster', method: 'seedling', layout: 'staggered',
    depth: null, rowSp: 30, sowSp: 30, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 40, spread: 25, sow: [3, 4, 9, 10],
    soilT: [4, 15, 25], grow: { tb: 3, tref: 18, tcap: 22 }, profile: { heat: 22 }, transplant: [28, 'At 4–5 true leaves'], win: 14,
    late: 'bolts and turns bitter', jobs: [], feed: 'medium', n: 12, p: 12, k: 12, stages: [{ d: 18, t: '2–3 weeks after planting' }], rest: 1,
    flags: ['heatBolt', 'dayBolt', 'frostHeads', 'halfHardy'], varieties: ['シスコ', 'レッドファイヤー', 'グリーンウェーブ', 'コスレタス', 'サラダ菜'] },
  // ---- Broccoli ブロッコリー ----
  { id: 'broccoli', en: 'Broccoli', ja: 'ブロッコリー', color: '#2f6b3a', group: 'heads', family: 'brassica', method: 'seedling', layout: 'staggered',
    dir: 'along', depth: null, rowSp: 50, sowSp: 40, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 75, spread: 50, sow: [3, 4, 8, 9],
    soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 22 }, transplant: [30, 'At 5–6 true leaves'], win: 7,
    late: 'heads flower (yellow buds)', jobs: [NET, ['Side-dress & earth up (追肥・土寄せ)', 21], ['Pick side shoots after main head', 80]], feed: 'heavy',
    n: 22, p: 20, k: 20, stages: [{ d: 21, t: '3 weeks after planting' }, { f: 0.65, t: 'when the buds appear' }], rest: 2,
    flags: ['boltIfBig', 'heading', 'dayBolt', 'frostHeads', 'netted'], reg: [['ブロッコリー'], ['あぶらな科野菜(花蕾及び茎)', '野菜類']],
    varieties: ['緑嶺', 'ピクセル', 'おはよう', 'グランドーム', 'スティックセニョール'] },
  // ---- Taro 里芋 ----
  { id: 'satoimo', en: 'Taro', ja: '里芋', color: '#8d6e63', group: 'tubers', family: 'aroid', method: 'seed', layout: 'rows', depth: 8, rowSp: 90,
    sowSp: 40, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 180, spread: 70, sow: [4, 5], tender: true, germ: [30, 45], soilT: [15, 20],
    grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, profile: { rising: [13, 19] },
    transplant: [0, 'grown from seed tubers, planted where they grow'], win: 30, late: 'tubers damaged by frost',
    jobs: [['Earth up (土寄せ)', 60], ['Mulch with straw for summer (敷きわら)', 70]], feed: 'heavy', n: 20, p: 20, k: 20, ph: [5.5, 6.5], rest: 3,
    reg: [['さといも'], ['野菜類']], varieties: ['土垂', '石川早生', '八つ頭', '海老芋', 'セレベス'] },
  // ---- Sweet potato さつまいも ----
  { id: 'satsumaimo', en: 'Sweet potato', ja: 'さつまいも', color: '#ad3b6b', group: 'tubers', family: 'morningglory', method: 'seedling', layout: 'rows',
    depth: null, rowSp: 90, sowSp: 35, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 120, spread: 60, sow: [5, 6], tender: true,
    soilT: [15, 18], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, profile: { plant: [17, 28] },
    transplant: [0, 'grown from slips (rooted cuttings), planted where they grow'], win: 30, late: 'tubers damaged by cold below 10°',
    jobs: [['Lift vines to stop rooting (つる返し)', 60]], feed: 'light', n: 3, p: 8, k: 20, ph: [5.5, 6.2], lime: 50, rest: 0,
    flags: ['noFreshCompost'], reg: [['かんしょ'], ['野菜類']], varieties: ['紅あずま', '鳴門金時', '安納芋', 'シルクスイート', '紅はるか'] },
  // ---- Shungiku 春菊 ----
  { id: 'shungiku', en: 'Shungiku', ja: '春菊', color: '#558b2f', group: 'leaves', family: 'aster', method: 'seed', layout: 'continuous', depth: 0.3,
    rowSp: 15, sowSp: 1, thinStage: 'At 3–4 true leaves', thinSp: 10, daysThin: 20, daysHarvest: 45, spread: 15, sow: [3, 4, 9, 10], germ: [4, 7],
    soilT: [10, 15, 25], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 22, plant: [9, 24] }, transplant: [25, 'At 4–5 true leaves'], win: 21,
    cont: 1, late: 'flowers form and leaves toughen', jobs: [['Pinch out tip for side shoots (摘心)', 40]], feed: 'medium', n: 15, p: 12, k: 12,
    stages: [{ d: 10, t: 'after thinning, and after each cut' }], rest: 1, flags: ['heatBolt', 'dayBolt', 'halfHardy'], reg: [['しゅんぎく'], ['野菜類']],
    varieties: ['中葉春菊', '大葉春菊', '株張り中葉', 'きわめ中葉'] },
  // ---- Mizuna 水菜 ----
  { id: 'mizuna', en: 'Mizuna', ja: '水菜', color: '#9ccc65', group: 'leaves', family: 'brassica', method: 'seed', layout: 'continuous', depth: 0.5,
    rowSp: 15, sowSp: 1, thinStage: 'At 3–4 true leaves', thinSp: 5, daysThin: 15, daysHarvest: 35, spread: 15, sow: [3, 4, 9, 10], germ: [2, 4],
    soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 23 }, transplant: [20, 'At 3–4 true leaves'], win: 14,
    late: 'stems get tough', jobs: [NET], feed: 'medium', n: 12, p: 10, k: 10, stages: [{ d: 10, t: 'after thinning' }], rest: 1,
    flags: ['heatBolt', 'dayBolt', 'netted'], reg: [['みずな'], ['非結球あぶらな科葉菜類', '野菜類']], varieties: ['京みぞれ', '千筋京水菜', '早生水菜', '京しぐれ', '紅法師'] },
  // ---- Zucchini ズッキーニ ----
  { id: 'zucchini', en: 'Zucchini', ja: 'ズッキーニ', color: '#4e7d2b', group: 'fruit', family: 'cucurbit', method: 'seedling', layout: 'rows',
    pot: 'center', depth: null, rowSp: 100, sowSp: 90, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 45, spread: 100, sow: [4, 5],
    tender: true, soilT: [15, 20], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, profile: { pick: 60 },
    transplant: [28, 'At 3–4 true leaves'], win: 60, cont: 1, late: 'fruit becomes marrows',
    jobs: [['Start hand-pollinating female flowers (人工授粉)', 30]], feed: 'heavy', n: 20, p: 20, k: 20, rest: 2, flags: ['fruiting', 'tall', 'bees'],
    reg: [['ズッキーニ'], ['野菜類']], varieties: ['ダイナー', 'オーラム', 'ブラックトスカ', 'ゴールドラッシュ'] },
  // ---- Sweetcorn とうもろこし ----
  { id: 'corn', en: 'Sweetcorn', ja: 'とうもろこし', color: '#f2c230', group: 'fruit', family: 'grass', method: 'seed', layout: 'rows', depth: 3,
    rowSp: 60, sowSp: 30, thinStage: 'Down to 1 plant at 3–4 true leaves', thinSp: 30, daysThin: 20, daysHarvest: 90, spread: 40, sow: [4, 5, 6],
    tender: true, germ: [5, 8], soilT: [12, 18], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, transplant: [20, 'At 3 true leaves'], win: 4,
    late: 'kernels turn starchy',
    jobs: [['Net against birds until up', 0], ['Side-dress & earth up (追肥・土寄せ)', 30], ['Remove extra cobs, keep the top one (除房)', 60]],
    feed: 'heavy', n: 22, p: 20, k: 20, stages: [{ d: 30, t: 'at 7–8 leaves' }, { d: 50, t: 'when tassels appear' }], ph: [5.5, 6.5], rest: 0,
    flags: ['tall'], reg: [['とうもろこし'], ['野菜類']], varieties: ['ゴールドラッシュ', '味来', 'ピーターコーン', 'おおもの', 'ドルチェドリーム'] },
  // ---- Green beans いんげん ----
  { id: 'ingen', en: 'Green beans', ja: 'いんげん', color: '#689f38', group: 'beans', family: 'legume', method: 'seed', layout: 'rows', depth: 2,
    rowSp: 50, sowSp: 30, thinStage: 'Down to 2 plants once the first leaves open', thinSp: 30, daysThin: 12, daysHarvest: 55, spread: 35,
    sow: [4, 5, 6, 7], tender: true, germ: [5, 8], soilT: [12, 18], grow: { tb: 10, tref: 24, tcap: 28, warm: [8, 21] }, profile: { pick: 30 },
    transplant: [14, 'When the first pair of leaves has opened'], win: 30, cont: 1, late: 'pods get stringy and lumpy',
    jobs: [['Earth up (土寄せ)', 20]], feed: 'legume', n: 8, p: 10, k: 10, stages: [{ d: 30, t: 'at flowering' }], ph: [5.5, 6.5], rest: 2,
    flags: ['tall', 'bees'], reg: [['さやいんげん', 'いんげんまめ'], ['野菜類']], varieties: ['ケンタッキーワンダー', 'モロッコ', 'つるなしモロッコ', '黒種衣笠', 'さつきみどり2号'] },
  // ---- Bok choy チンゲン菜 ----
  { id: 'chingensai', en: 'Bok choy', ja: 'チンゲン菜', color: '#7fb069', group: 'leaves', family: 'brassica', method: 'seed', layout: 'continuous',
    depth: 0.5, rowSp: 20, sowSp: 2, thinStage: 'At 4–5 true leaves', thinSp: 15, daysThin: 20, daysHarvest: 45, spread: 15, sow: [3, 4, 5, 9, 10],
    germ: [2, 4], soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 24 }, transplant: [20, 'At 3–4 true leaves'], win: 10,
    late: 'bolts and base gets tough', jobs: [NET], feed: 'medium', n: 12, p: 10, k: 10, stages: [{ d: 7, t: 'after thinning' }], rest: 1,
    flags: ['heatBolt', 'dayBolt', 'netted'], reg: [['チンゲンサイ'], ['非結球あぶらな科葉菜類', '野菜類']], varieties: ['青帝', '長陽', '夏賞味', 'シャオパオ'] },
  // ---- Garlic にんにく ----
  { id: 'garlic', en: 'Garlic', ja: 'にんにく', color: '#e9e2d0', group: 'onions', family: 'allium', method: 'seedling', layout: 'staggered',
    depth: null, rowSp: 20, sowSp: 15, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 220, spread: 15, sow: [9, 10],
    grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [15, 23] }, transplant: [0, 'grown from cloves, planted where they grow'], win: 14,
    late: 'bulbs split and skins rot', jobs: [['Side-dress (追肥)', 90], ['Remove flower stalk (芽摘み)', 180]], feed: 'medium', n: 20, p: 15, k: 15,
    stages: [{ w: 'start', t: 'as winter sets in' }, { w: 'restart', t: 'as growth restarts — the last feed (止め肥)', last: true }], ph: [6, 6.8],
    lime: 150, rest: 1, reg: [['にんにく'], ['野菜類']], varieties: ['ホワイト六片', '平戸', '上海早生', '嘉定', 'ジャンボニンニク'] },
  // ---- Shishito ししとう ----
  { id: 'shishito', en: 'Shishito', ja: 'ししとう', color: '#66bb6a', group: 'fruit', family: 'nightshade', method: 'seedling', layout: 'rows',
    pot: 'center', depth: null, rowSp: 60, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 50, spread: 50, sow: [4, 5],
    tender: true, soilT: [15, 22], grow: { tb: 10, tref: 24, tcap: 28, warm: [10, 23] }, profile: { pick: 100 },
    transplant: [70, 'Around 10 true leaves'], win: 100, cont: 1, late: 'fruit turns hot and red',
    jobs: [['Put in stake / support (支柱)', 0], ['Remove side shoots below first flower (わき芽かき)', 14]], feed: 'heavy', n: 28, p: 25, k: 25, rest: 3,
    flags: ['fruiting', 'tall', 'bees'], reg: [['ししとう'], ['とうがらし類', '野菜類']], varieties: ['翠光', '葵ししとう', '伏見甘長', '万願寺とうがらし', '甘とう美人'] },
  // ---- Snow pea さやえんどう ----
  { id: 'sayaendo', en: 'Snow pea', ja: 'さやえんどう', color: '#8bc34a', group: 'beans', family: 'legume', method: 'seed', layout: 'rows', depth: 2,
    rowSp: 60, sowSp: 25, thinStage: 'Down to 2 plants at 2–3 true leaves', thinSp: 25, daysThin: 20, daysHarvest: 160, spread: 30, sow: [10, 11],
    germ: [7, 12], soilT: [5, 12, 25], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [11, 18], spring: [6, 12] },
    transplant: [21, 'At 3–4 true leaves'], win: 30, cont: 1, late: 'pods get stringy',
    jobs: [['Put up net / trellis (ネット)', 25], ['Side-dress in spring (追肥)', 120]], feed: 'legume', n: 8, p: 10, k: 10,
    stages: [{ w: 'restart', t: 'when growth restarts in spring' }, { f: 0.8, t: 'at flowering — lightly' }], ph: [6.2, 7], rest: 4,
    flags: ['tall', 'bees'], reg: [['さやえんどう'], ['野菜類']], varieties: ['美笹', '仏国大莢', '赤花絹莢', '成駒三十日'] },
  // ---- Broad bean そら豆 ----
  { id: 'soramame', en: 'Broad bean', ja: 'そら豆', color: '#5d8a3a', group: 'beans', family: 'legume', method: 'seed', layout: 'rows', depth: 2,
    rowSp: 60, sowSp: 40, thinStage: 'Down to 1 plant at 2 true leaves', thinSp: 40, daysThin: 20, daysHarvest: 200, spread: 50, sow: [10, 11],
    germ: [10, 14], soilT: [5, 15, 25], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [11, 18], spring: [5, 10] },
    transplant: [25, 'At 2–3 true leaves'], win: 10, late: 'beans turn hard and black-eyed',
    jobs: [['Pinch out tips once pods set (摘心)', 150], ['Check for aphids (アブラムシ)', 140]], feed: 'legume', n: 10, p: 10, k: 12,
    stages: [{ w: 'restart', t: 'when growth restarts in spring' }], rest: 4, flags: ['tall', 'bees'], reg: [['そらまめ'], ['野菜類']],
    varieties: ['打越一寸', '陵西一寸', '河内一寸', '仁徳一寸'] },
  // ---- Cauliflower カリフラワー ----
  { id: 'cauliflower', en: 'Cauliflower', ja: 'カリフラワー', color: '#efe6c8', group: 'heads', family: 'brassica', method: 'seedling',
    layout: 'staggered', dir: 'along', depth: null, rowSp: 50, sowSp: 45, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 80, spread: 50,
    sow: [3, 4, 8, 9], soilT: [5, 15, 30], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { heat: 22 }, transplant: [30, 'At 5–6 true leaves'],
    win: 7, late: 'curds loosen and discolour', jobs: [NET, ['Side-dress & earth up (追肥・土寄せ)', 21], ['Fold leaves over curd (軟白)', 70]],
    feed: 'heavy', n: 22, p: 20, k: 20, stages: [{ d: 21, t: '3 weeks after planting' }, { f: 0.65, t: 'when the curd appears' }], rest: 2,
    flags: ['boltIfBig', 'heading', 'frostHeads', 'netted'], reg: [['カリフラワー'], ['あぶらな科野菜(花蕾及び茎)', '野菜類']],
    varieties: ['スノークラウン', 'バイオレットクイン', 'オレンジブーケ', 'ロマネスコ', '美星'] },
  // ---- Strawberry いちご ----
  { id: 'strawberry', en: 'Strawberry', ja: 'いちご', color: '#e53950', group: 'berries', family: 'rose', method: 'seedling', layout: 'staggered',
    depth: null, rowSp: 30, sowSp: 30, thinStage: '', thinSp: null, daysThin: null, daysHarvest: 180, spread: 30, sow: [10],
    grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [14, 20] }, transplant: [40, 'At 3 true leaves'], win: 30, cont: 1,
    late: 'fruit rots on the plant', jobs: [['Remove runners (ランナー)', 14, 2, 'week'], ['Lay straw / mulch (敷きわら)', 150]], feed: 'medium', n: 20,
    p: 20, k: 20, stages: [{ w: 'restart', t: 'as growth restarts' }], ph: [5.5, 6.5], lime: 50, rest: 2, flags: ['halfHardy', 'bees'],
    reg: [['いちご'], ['野菜類']], varieties: ['とちおとめ', '章姫', '紅ほっぺ', '宝交早生', 'よつぼし'] },
  // ---- Nanohana 菜の花 ----
  { id: 'nanohana', en: 'Nanohana', ja: '菜の花', color: '#e6c619', group: 'leaves', family: 'brassica', method: 'seed', layout: 'continuous',
    depth: 0.5, rowSp: 30, sowSp: 2, thinStage: 'At 3–4 true leaves', thinSp: 20, daysThin: 20, daysHarvest: 100, spread: 35, sow: [9, 10],
    germ: [3, 5], grow: { tb: 0, tref: 16, tcap: 20 }, profile: { winter: [15, 23] }, transplant: [25, 'At 4–5 true leaves'], win: 21, cont: 1,
    late: 'buds open into flowers', jobs: [['Pick tips to encourage side shoots', 100]], feed: 'medium', n: 18, p: 15, k: 15, rest: 1,
    flags: ['dayBolt', 'netted'], reg: [['なばな類', 'なばな'], ['非結球あぶらな科葉菜類', '野菜類']], varieties: ['早生菜花', 'のらぼう菜', '寒咲花菜', '花っこりー'] },
];
