// Every crop, sown in every month the app suggests for it, in Japanese and world climates (both hemispheres): the
// timings must make sense — no summer crop taking over a year, harvest not wildly faster or slower than the packet,
// plant-out before harvest, every crop with the facts it needs. Lists anything that doesn't; "problems: none" is the goal.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
// [latitude, monthly mean °C, frost] (approximate normals; frost: usual first and last frost, days from 1 July — where
// frost comes most winters)
const CLIMATES = {
  Tokyo: null,   // the built-in one
  Sapporo: [43.1, [-3.2, -2.7, 1.1, 7.3, 13.0, 17.0, 21.1, 22.3, 18.6, 12.1, 5.2, -0.9], { first: 112, last: 303 }],   // ~21 Oct – ~30 Apr
  Kagoshima: [31.6, [8.7, 9.9, 12.8, 16.9, 20.8, 24.0, 28.1, 28.8, 26.5, 21.8, 16.2, 10.9]],
  Naha: [26.2, [17.3, 17.5, 19.1, 21.5, 24.2, 27.2, 29.1, 29.0, 27.9, 25.5, 22.5, 19.0]],
  Sydney: [-33.9, [22.8, 22.8, 21.6, 19.0, 16.1, 13.6, 12.8, 13.9, 16.2, 18.4, 20.0, 21.7]],
  Melbourne: [-37.8, [21.3, 21.4, 19.4, 16.6, 13.9, 11.6, 11.0, 11.9, 13.6, 15.6, 17.8, 19.8]],
  London: [51.5, [5.2, 5.3, 7.6, 9.9, 13.3, 16.5, 18.7, 18.5, 15.7, 12.0, 8.0, 5.5], { first: 140, last: 266 }],   // ~18 Nov – ~24 Mar
  Singapore: [1.35, [26.5, 27.1, 27.5, 28.0, 28.3, 28.3, 27.9, 27.9, 27.6, 27.6, 27.0, 26.4]],
  Denver: [39.7, [0.0, 0.9, 5.0, 9.0, 14.0, 19.6, 23.5, 22.4, 17.6, 10.8, 4.4, -0.4], { first: 98, last: 307 }],   // ~7 Oct – ~4 May
};
// What local growing guides say, for a few crops away from Japan: months that must be offered (+) and must not (−).
// (Checks the rules give each place its own seasons — not Japan's months, and not "all year" where winters are mild.)
const KNOWN = {
  Sydney: { tomato: ['+9,10,11', '-4,5,6,7'], corn: ['+10,11', '-4,5,6,7'], ingen: ['+10,11', '-5,6,7'], garlic: ['+3,4', '-11,12,1'], onion: ['+5', '-10,11,12,1'], snappea: ['+4,5', '-10,11,12,1'], potato: ['+8', '-5,6'], satsumaimo: ['+10,11', '-4,5,6,7,8'] },
  Melbourne: { tomato: ['+10,11', '-3,4,5,6,7,8'], garlic: ['+3,4', '-10,11,12,1'], kyuri: ['+11,12', '-4,5,6,7,8'] },
  London: { tomato: ['+5', '-8,9,10,11,12,1,2,3'], potato: ['+3,4', '-10,11,12,1'], corn: ['+5', '-9,10,11,12,1,2,3'], spinach: ['+3,4,8'],
    hakusai: ['+7', '-3,4'], daikon: ['+7', '-3,4'], komatsuna: ['+8', '-3,4'], chingensai: ['+7', '-3,4'] },   // (RHS: oriental greens from midsummer — earlier bolt)
  Singapore: { garlic: ['-1,2,3,4,5,6,7,8,9,10,11,12'], potato: ['-1,2,3,4,5,6,7,8,9,10,11,12'], okra: ['+1,4,7,10'] },
  Denver: { tomato: ['+5', '-9,10,11,12,1,2,3'], garlic: ['+10', '-1,2,3,12'] },
  Naha: { tomato: ['+10,11', '-7'], garlic: ['-5,6,7,8'] },
};
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  // the records themselves: every crop complete and every number in a sensible range
  console.log('records:', await pg.evaluate(() => {
    const probs = [], ids = new Set(), FLAGS = ['fruiting', 'heading', 'boltIfBig', 'heatBolt', 'dayBolt', 'splits', 'frostHeads', 'halfHardy', 'tall', 'netted', 'bees', 'noFreshCompost'];
    const KEYS = ['id', 'en', 'ja', 'color', 'group', 'family', 'method', 'layout', 'pot', 'dir', 'depth', 'rowSp', 'sowSp', 'thinStage', 'thinSp', 'daysThin', 'daysHarvest', 'spread', 'sow', 'tender', 'frostEnd', 'germ', 'soilT', 'grow', 'profile', 'transplant', 'win', 'cont', 'late', 'jobs', 'feed', 'n', 'p', 'k', 'stages', 'ph', 'lime', 'rest', 'flags', 'reg', 'regAs', 'varieties', 'like', 'icon', 'pests'];
    for (const r of CROPS) {
      const bad = m => probs.push(`${r.id}: ${m}`);
      if (ids.has(r.id)) bad('duplicate id'); ids.add(r.id);
      for (const k of Object.keys(r)) if (!KEYS.includes(k)) bad(`unknown field ${k}`);
      if (r.like && !CROPS.some(x => x.id === r.like)) bad(`like '${r.like}' isn't a crop`);
      if (!r.en || !r.ja) bad('needs English and Japanese names');
    }
    const num = (c, k, lo, hi) => { const v = c[k]; if (v == null || !(v >= lo && v <= hi)) probs.push(`${c.id}: ${k} ${JSON.stringify(v)} not in ${lo}–${hi}`); };
    for (const c of CATALOG) {
      const bad = m => probs.push(`${c.id}: ${m}`);
      if (!GROUPS[c.group]) bad(`group ${c.group}`); if (!FAMILIES[c.family] || c.family === 'other') bad(`family ${c.family}`);
      if (!['seed', 'seedling'].includes(c.method)) bad(`method ${c.method}`);
      num(c, 'daysHarvest', 15, 400); num(c, 'rowSp', 5, 300); num(c, 'sowSp', 0.5, 300); num(c, 'spread', 3, 400); num(c, 'win', 2, 400);
      if (c.method === 'seed' && c.depth != null) num(c, 'depth', 0, 20);
      if (!Array.isArray(c.sow) || !c.sow.length || c.sow.some(m => !(m >= 1 && m <= 12))) bad(`sow ${JSON.stringify(c.sow)}`);
      const g = c.grow; if (!g || !(g.tb < g.tref && g.tref <= g.tcap) || g.tb < -2 || g.tcap > 35 || (g.warm && !(g.warm[0] < g.warm[1]))) bad(`grow ${JSON.stringify(g)}`);
      if (c.germ && !(c.germ[0] >= 1 && c.germ[0] <= c.germ[1] && c.germ[1] <= 60)) bad(`germ ${JSON.stringify(c.germ)}`);
      if (c.soilT && !(c.soilT[0] < c.soilT[1] && (c.soilT[2] == null || c.soilT[1] < c.soilT[2]))) bad(`soilT ${JSON.stringify(c.soilT)}`);
      const tp = c.transplant; if (!Array.isArray(tp) || !(tp[0] >= 0) || !tp[1]) bad(`transplant ${JSON.stringify(tp)}`);
      else if (c.method === 'seed' && tp[0] && tp[0] >= c.daysHarvest) bad(`plant-out ${tp[0]} d not before harvest ${c.daysHarvest} d`);
      if (c.thinSp != null && c.thinSp > 0 && !(c.daysThin > 0 && c.daysThin < c.daysHarvest)) bad(`daysThin ${c.daysThin}`);
      for (const f of c.flags || []) if (!FLAGS.includes(f)) bad(`flag ${f}`);
      if (!['heavy', 'medium', 'light', 'legume'].includes(c.feed)) bad(`feed ${c.feed}`);
      for (const k of ['n', 'p', 'k']) if (c[k] != null) num(c, k, 0, 60);
      if (c.ph && !(c.ph[0] >= 4.5 && c.ph[0] < c.ph[1] && c.ph[1] <= 8)) bad(`ph ${JSON.stringify(c.ph)}`);
      if (c.rest == null || !(c.rest >= 0 && c.rest <= 7)) bad(`rest ${c.rest}`);
      if ((c.jobs || []).some(j => !Array.isArray(j) || typeof j[0] !== 'string' || !(j[1] >= 0))) bad('jobs');
    }
    return probs.length ? `${probs.length} problems\n  ✗ ` + probs.join('\n  ✗ ') : `${CATALOG.length} crops, problems: none`;
  }));
  for (const [name, lt] of Object.entries(CLIMATES)) {
    const [lat, t, fr] = lt || [35.75, null];
    const frost = fr ? { winters: 10, frosty: 10, south: false, ...fr } : null;
    const r = await pg.evaluate(({ name, lat, t, known, frost }) => {
      S.weather = t ? { lat, lon: 0, name } : null;
      S.climate = t ? { lat, lon: 0, name, t, rain: [52, 56, 117, 125, 138, 168, 154, 168, 210, 198, 93, 51], years: 'test', fetched: '2026-01-01', frost } : null;
      applyClimate(true);
      const probs = [], summary = [];
      const overwinter = id => !!(SOW_PROFILE[id] || {}).winter;   // grown through winter (garlic, onions, peas, broad beans…)
      for (const cr of CATALOG) {
        const months = cr.sow || [];
        if (!months.length) { if (name === 'Tokyo') probs.push(`${cr.id}: no sowing months`); summary.push(`${cr.id} —`); continue; }
        const days = [];
        for (const m of months) for (const day of [5, 15, 25]) {
          const sd = `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          if (!sowDayOK(cr, sd)) continue;   // the days in the month the app counts as good
          const h = harvestEstimate({ cropId: cr.id, sowDate: sd, method: cr.method === 'seed' ? 'seed' : 'seedling' });
          if (!h) { probs.push(`${cr.id} sown ${m}/${day}: no harvest date`); continue; }
          const n = daysBetween(sd, h), dh = cr.daysHarvest || 60; days.push(n);
          // (a crop usually grown through winter, sown in spring where winters are hard, skips the winter its packet days include)
          // (overwintered crops: up to ~10 months — garlic planted in October in Hokkaido is lifted in early August)
          // (long crops have less room: a 140-day crop at 240+ days has gone through a winter it shouldn't — winter-sown carrots in Kagoshima, ~1.7×, are real)
          const max = overwinter(cr.id) ? 310 : dh > 100 ? Math.max(dh * 1.7, dh + 60) : Math.max(dh * 2.3, dh + 50), min = overwinter(cr.id) ? Math.min(60, dh * 0.35) : dh * 0.6;
          if (n > max) probs.push(`${cr.id} sown ${m}/${day}: ${n} days to harvest (packet ${dh}) — too slow`);
          if (n < min) probs.push(`${cr.id} sown ${m}/${day}: ${n} days to harvest (packet ${dh}) — too fast`);
          if (n > 330) probs.push(`${cr.id} sown ${m}/${day}: over a year (${n} days)`);
        }
        const tp = tpDays(cr.id); if (cr.method === 'seed' && tp && tp >= (cr.daysHarvest || 999)) probs.push(`${cr.id}: plant-out (${tp} d) not before harvest (${cr.daysHarvest} d)`);
        summary.push(`${cr.id} ${months.join(',')}:${days.join('/')}`);
      }
      for (const [id, rules] of Object.entries(known || {})) for (const r of rules) {
        const ms = r.slice(1).split(',').map(Number), have = crop(id).sow || [];
        const bad = ms.filter(m => (r[0] === '+') !== have.includes(m));
        if (bad.length) probs.push(`${id}: ${r[0] === '+' ? 'should be sown' : 'shouldn’t be sown'} in month ${bad.join(',')} here (local guides) — offered ${have.join(',') || 'never'}`);
      }
      if (name === 'Tokyo') for (const cr of CATALOG) {
        const miss = [['days to harvest', cr.daysHarvest], ['family', cr.family && cr.family !== 'other'], ['growth temperatures', GROW[cr.id]], ['time to planting out', TRANSPLANT[cr.id]], ['spread', cr.spread], ['keeps for', cr.win]].filter(x => !x[1]).map(x => x[0]);
        if (cr.method === 'seed' && !cr.germ && TRANSPLANT[cr.id] && TRANSPLANT[cr.id][0] !== 0) miss.push('germination days');
        if (miss.length) probs.push(`${cr.id}: missing ${miss.join(', ')}`);
      }
      return { probs, summary };
    }, { name, lat, t, known: KNOWN[name], frost });
    console.log(`== ${name}: ${r.probs.length ? r.probs.length + ' problems' : 'problems: none'}`);
    for (const p of r.probs) console.log('  ✗ ' + p);
    console.log('  sowing months:days ' + r.summary.join(' · '));
  }
  console.log('errs', errs); await b.close();
})();
