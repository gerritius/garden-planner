// Built-in crop catalog. All sizes in cm, times in days.
// Values are typical starting points for Japanese home gardens — always check the packet.
// method: 'seed' | 'seedling'  (seedling = transplant / tuber / clove / set)
// layout: default layout in beds; pot: default layout in pots (optional); dir: 'along' = rows run down the long side
// depth: sowing depth · rowSp: between rows · sowSp: sowing distance (seed) or plant spacing (seedling)
// thinStage / thinSp / daysThin: thinning info (seed crops) · daysHarvest: sow/plant → earliest harvest
// spread: approx. mature plant diameter, used to "grow" the drawing
'use strict';
const C = (id, en, ja, color, method, layout, depth, rowSp, sowSp, thinStage, thinSp, daysThin, daysHarvest, spread, varieties, extra = {}) =>
  Object.assign({ id, en, ja, color, method, layout, depth, rowSp, sowSp, thinStage, thinSp, daysThin, daysHarvest, spread, varieties }, extra);

const CATALOG = [
  // ---- Your crops ----
  C('nasu', 'Eggplant', 'ナス', '#5b3a7a', 'seedling', 'rows', null, 70, 50, '', null, null, 60, 70,
    ['千両二号', '黒陽', '筑陽', '水ナス', '米ナス'], { pot: 'center' }),
  C('celery', 'Celery', 'セロリ', '#8fbf4f', 'seedling', 'staggered', null, 40, 30, '', null, null, 90, 30,
    ['コーネル619', 'トップセラー', 'ミニホワイト', 'スジなしセロリ', 'キンサイ（中国セロリ）']),
  C('potato', 'Potato', 'じゃがいも', '#b08850', 'seed', 'rows', 8, 60, 30, '芽かき – leave 2–3 stems at 10–15 cm tall', null, null, 95, 50,
    ['デジマ', '男爵薯', 'メークイン', 'キタアカリ', 'ニシユタカ'], { pot: 'diamond' }),
  C('minitomato', 'Mini tomato', 'ミニトマト', '#e0443e', 'seedling', 'rows', null, 60, 45, '', null, null, 60, 50,
    ['アイコ', '千果', 'ピンキー', 'イエローアイコ', 'CFプチぷよ'], { pot: 'center' }),
  C('tomato', 'Tomato (large)', '大玉トマト', '#c62828', 'seedling', 'rows', null, 60, 50, '', null, null, 70, 50,
    ['桃太郎', 'ホーム桃太郎', '麗夏', '桃太郎ファイト', 'りんか409'], { pot: 'center' }),
  C('naganegi', 'Long onion', '長ネギ', '#7cb36b', 'seedling', 'rows', null, 90, 5, '', null, null, 120, 5,
    ['石倉一本太', 'ホワイトタイガー', '夏扇4号', '下仁田ネギ', '九条ネギ']),
  C('hatamanegi', 'Leaf onion', '葉玉ねぎ', '#9ccc65', 'seedling', 'rows', null, 15, 12, '', null, null, 120, 12,
    ['ソニック', '泉州黄', 'ターザン', '湘南レッド', 'OK黄']),
  C('carrot', 'Carrot', '人参', '#f08a24', 'seed', 'continuous', 0.5, 20, 1, '本葉2–3枚 then 5–6枚', 10, 25, 110, 10,
    ['向陽二号', '時なし五寸', 'ベーターリッチ', '金時人参', 'ピッコロ']),
  C('komatsuna', 'Komatsuna', '小松菜', '#3f8f3a', 'seed', 'continuous', 0.5, 15, 1, '本葉3–4枚', 5, 14, 35, 15,
    ['楽天', '夏楽天', 'よかった菜', '浜美2号', 'きよすみ']),
  C('edamame', 'Edamame', '枝豆', '#6fae3f', 'seed', 'rows', 2, 40, 20, '初生葉が開いたら 2本立ち', 20, 10, 80, 40,
    ['湯あがり娘', '富貴', '天ヶ峰', 'だだちゃ豆', '丹波黒大豆']),
  C('hakusai', 'Hakusai', '白菜', '#c5e1a5', 'seed', 'staggered', 1, 60, 45, '本葉5–6枚で1本立ち', 45, 25, 80, 50,
    ['無双', '黄ごころ65', '黄ごころ85', 'タイニーシュシュ', '娃々菜'], { dir: 'along' }),
  C('daikon', 'Daikon', '大根', '#e8eef0', 'seed', 'rows', 1.5, 60, 30, '本葉5–6枚で1本立ち', 30, 25, 60, 35,
    ['耐病総太り', '三浦大根', '聖護院大根', '献夏37号', '紅芯大根']),
  C('hatsuka', 'Radish', '二十日大根', '#e84d6f', 'seed', 'continuous', 1, 10, 1, '本葉2–3枚', 3, 12, 30, 4,
    ['コメット', 'レッドチャイム', '紅白', 'フレンチブレックファスト', 'カラフルファイブ']),
  C('cabbage', 'Cabbage', 'キャベツ', '#88c057', 'seedling', 'staggered', null, 45, 45, '', null, null, 80, 45,
    ['金系201', '初秋', '富士早生', '四季穫', 'グリーンボール'], { dir: 'along' }),
  C('spinach', 'Spinach', 'ほうれん草', '#2e7d32', 'seed', 'continuous', 1, 15, 1, '本葉2–3枚', 5, 20, 40, 15,
    ['強力オーライ', 'ブレード10', 'ミストラル', '弁天丸', '日本ほうれん草']),
  C('kabu', 'Turnip', 'カブ', '#f3f0e6', 'seed', 'continuous', 1, 20, 1, '本葉2–3枚 then 5枚', 10, 15, 50, 12,
    ['耐病ひかり', 'スワン', '金町小かぶ', 'あやめ雪', '聖護院かぶ']),
  C('piman', 'Capsicum', 'ピーマン', '#43a047', 'seedling', 'rows', null, 60, 45, '', null, null, 60, 50,
    ['京波', '京みどり', 'エース', 'ニューエース', 'カリフォルニアワンダー'], { pot: 'center' }),
  C('chilli', 'Hot chilli', '唐辛子', '#d84315', 'seedling', 'rows', null, 60, 45, '', null, null, 70, 50,
    ['ハラペーニョ', '鷹の爪', '八房', 'ハバネロ', '島とうがらし'], { pot: 'center' }),
  C('snappea', 'Snap pea', 'スナップエンドウ', '#7cc576', 'seed', 'rows', 2, 60, 25, '本葉2–3枚で2本立ち', 25, 20, 160, 30,
    ['スナック753', 'グルメ', 'つるなしスナック', 'ホルンスナック']),
  // ---- Other common Japanese crops ----
  C('kyuri', 'Cucumber', 'きゅうり', '#33691e', 'seedling', 'rows', null, 90, 45, '', null, null, 35, 60,
    ['夏すずみ', '四葉', 'フリーダムハウス1号', '北進', '霜知らず地這'], { pot: 'center' }),
  C('onion', 'Onion', '玉ねぎ', '#d8a95b', 'seedling', 'rows', null, 15, 12, '', null, null, 200, 12,
    ['ソニック', '泉州黄', 'OK黄', 'ネオアース', '湘南レッド']),
  C('lettuce', 'Lettuce', 'レタス', '#a5d66f', 'seedling', 'staggered', null, 30, 30, '', null, null, 40, 25,
    ['シスコ', 'レッドファイヤー', 'グリーンウェーブ', 'コスレタス', 'サラダ菜']),
  C('broccoli', 'Broccoli', 'ブロッコリー', '#2f6b3a', 'seedling', 'staggered', null, 50, 40, '', null, null, 75, 50,
    ['緑嶺', 'ピクセル', 'おはよう', 'グランドーム', 'スティックセニョール'], { dir: 'along' }),
  C('satoimo', 'Taro', '里芋', '#8d6e63', 'seed', 'rows', 8, 90, 40, '', null, null, 180, 70,
    ['土垂', '石川早生', '八つ頭', '海老芋', 'セレベス']),
  C('satsumaimo', 'Sweet potato', 'さつまいも', '#ad3b6b', 'seedling', 'rows', null, 90, 35, '', null, null, 120, 60,
    ['紅あずま', '鳴門金時', '安納芋', 'シルクスイート', '紅はるか']),
  C('shungiku', 'Shungiku', '春菊', '#558b2f', 'seed', 'continuous', 0.3, 15, 1, '本葉3–4枚', 10, 20, 45, 15,
    ['中葉春菊', '大葉春菊', '株張り中葉', 'きわめ中葉']),
  C('mizuna', 'Mizuna', '水菜', '#9ccc65', 'seed', 'continuous', 0.5, 15, 1, '本葉3–4枚', 5, 15, 35, 15,
    ['京みぞれ', '千筋京水菜', '早生水菜', '京しぐれ', '紅法師']),
  C('zucchini', 'Zucchini', 'ズッキーニ', '#4e7d2b', 'seedling', 'rows', null, 100, 90, '', null, null, 45, 100,
    ['ダイナー', 'オーラム', 'ブラックトスカ', 'ゴールドラッシュ'], { pot: 'center' }),
  C('corn', 'Sweetcorn', 'とうもろこし', '#f2c230', 'seed', 'rows', 3, 60, 30, '本葉3–4枚で1本立ち', 30, 20, 90, 40,
    ['ゴールドラッシュ', '味来', 'ピーターコーン', 'おおもの', 'ドルチェドリーム']),
  C('ingen', 'Green beans', 'いんげん', '#689f38', 'seed', 'rows', 2, 50, 30, '初生葉が開いたら 2本立ち', 30, 12, 55, 35,
    ['ケンタッキーワンダー', 'モロッコ', 'つるなしモロッコ', '黒種衣笠', 'さつきみどり2号']),
  C('chingensai', 'Bok choy', 'チンゲン菜', '#7fb069', 'seed', 'continuous', 0.5, 20, 2, '本葉4–5枚', 15, 20, 45, 15,
    ['青帝', '長陽', '夏賞味', 'シャオパオ']),
  C('garlic', 'Garlic', 'にんにく', '#e9e2d0', 'seedling', 'staggered', null, 20, 15, '', null, null, 220, 15,
    ['ホワイト六片', '平戸', '上海早生', '嘉定', 'ジャンボニンニク']),
  C('shishito', 'Shishito', 'ししとう', '#66bb6a', 'seedling', 'rows', null, 60, 45, '', null, null, 50, 50,
    ['翠光', '葵ししとう', '伏見甘長', '万願寺とうがらし', '甘とう美人'], { pot: 'center' }),
  C('sayaendo', 'Snow pea', 'さやえんどう', '#8bc34a', 'seed', 'rows', 2, 60, 25, '本葉2–3枚で2本立ち', 25, 20, 160, 30,
    ['美笹', '仏国大莢', '赤花絹莢', '成駒三十日']),
  C('soramame', 'Broad bean', 'そら豆', '#5d8a3a', 'seed', 'rows', 2, 60, 40, '本葉2枚で1本立ち', 40, 20, 200, 50,
    ['打越一寸', '陵西一寸', '河内一寸', '仁徳一寸']),
  C('cauliflower', 'Cauliflower', 'カリフラワー', '#efe6c8', 'seedling', 'staggered', null, 50, 45, '', null, null, 80, 50,
    ['スノークラウン', 'バイオレットクイン', 'オレンジブーケ', 'ロマネスコ', '美星'], { dir: 'along' }),
  C('strawberry', 'Strawberry', 'いちご', '#e53950', 'seedling', 'staggered', null, 30, 30, '', null, null, 180, 30,
    ['とちおとめ', '章姫', '紅ほっぺ', '宝交早生', 'よつぼし']),
  C('nanohana', 'Nanohana', '菜の花', '#e6c619', 'seed', 'continuous', 0.5, 30, 2, '本葉3–4枚', 20, 20, 100, 35,
    ['早生菜花', 'のらぼう菜', '寒咲花菜', '花っこりー']),
];

// Plant families (for rotation warnings).
const FAMILIES = {
  brassica: ['Brassica (cabbage family)', 'アブラナ科'], nightshade: ['Nightshade (tomato family)', 'ナス科'], legume: ['Legume (bean family)', 'マメ科'],
  allium: ['Allium (onion family)', 'ヒガンバナ科'], cucurbit: ['Cucurbit (gourd family)', 'ウリ科'], umbellifer: ['Umbellifer (carrot family)', 'セリ科'],
  aster: ['Aster (daisy family)', 'キク科'], amaranth: ['Amaranth (spinach family)', 'ヒユ科'], grass: ['Grass family', 'イネ科'],
  morningglory: ['Morning glory family', 'ヒルガオ科'], aroid: ['Aroid (taro family)', 'サトイモ科'], rose: ['Rose family', 'バラ科'], other: ['Other', 'その他'],
};
// [family, months to sow/plant in central Japan (中間地), frost-tender]
const CROP_EXTRA = {
  nasu: ['nightshade', [4, 5], 1], celery: ['umbellifer', [4, 5, 8, 9]], potato: ['nightshade', [2, 3, 8, 9], 1], minitomato: ['nightshade', [4, 5], 1],
  tomato: ['nightshade', [4, 5], 1], naganegi: ['allium', [4, 5, 6, 7]], hatamanegi: ['allium', [10, 11]], carrot: ['umbellifer', [3, 4, 7, 8]],
  komatsuna: ['brassica', [3, 4, 5, 6, 9, 10]], edamame: ['legume', [4, 5, 6], 1], hakusai: ['brassica', [8, 9]], daikon: ['brassica', [3, 4, 8, 9]],
  hatsuka: ['brassica', [3, 4, 5, 6, 9, 10]], cabbage: ['brassica', [3, 4, 8, 9]], spinach: ['amaranth', [3, 4, 9, 10, 11]], kabu: ['brassica', [3, 4, 9, 10]],
  piman: ['nightshade', [4, 5], 1], chilli: ['nightshade', [4, 5], 1], snappea: ['legume', [10, 11]], kyuri: ['cucurbit', [4, 5, 6, 7], 1],
  onion: ['allium', [11]], lettuce: ['aster', [3, 4, 9, 10]], broccoli: ['brassica', [3, 4, 8, 9]], satoimo: ['aroid', [4, 5], 1],
  satsumaimo: ['morningglory', [5, 6], 1], shungiku: ['aster', [3, 4, 9, 10]], mizuna: ['brassica', [3, 4, 9, 10]], zucchini: ['cucurbit', [4, 5], 1],
  corn: ['grass', [4, 5, 6], 1], ingen: ['legume', [4, 5, 6, 7], 1], chingensai: ['brassica', [3, 4, 5, 9, 10]], garlic: ['allium', [9, 10]],
  shishito: ['nightshade', [4, 5], 1], sayaendo: ['legume', [10, 11]], soramame: ['legume', [10, 11]], cauliflower: ['brassica', [3, 4, 8, 9]],
  strawberry: ['rose', [10]], nanohana: ['brassica', [9, 10]],
};
for (const c of CATALOG) { const x = CROP_EXTRA[c.id] || ['other', []]; c.family = x[0]; c.sow = x[1]; c.tender = !!x[2]; }

// Fertiliser / amendment units. A handful (一握り) of granular fertiliser is roughly 30 g.
const UNITS = ['g', 'handful', 'mL', 'L'];
const HANDFUL_G = 30;
