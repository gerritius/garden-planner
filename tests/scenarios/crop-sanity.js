// Every crop, sown in every month the app suggests for it, in four climates (Tokyo, Sapporo, Kagoshima, Naha): the
// timings must make sense — no summer crop taking over a year, harvest not wildly faster or slower than the packet,
// plant-out before harvest, every crop with the facts it needs. Lists anything that doesn't; "problems: none" is the goal.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
const CLIMATES = {
  Tokyo: null,   // the built-in one
  Sapporo: [-3.2, -2.7, 1.1, 7.3, 13.0, 17.0, 21.1, 22.3, 18.6, 12.1, 5.2, -0.9],
  Kagoshima: [8.7, 9.9, 12.8, 16.9, 20.8, 24.0, 28.1, 28.8, 26.5, 21.8, 16.2, 10.9],
  Naha: [17.3, 17.5, 19.1, 21.5, 24.2, 27.2, 29.1, 29.0, 27.9, 25.5, 22.5, 19.0],
};
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  for (const [name, t] of Object.entries(CLIMATES)) {
    const r = await pg.evaluate(({ name, t }) => {
      S.climate = t ? { lat: 0, lon: 0, name, t, rain: [52, 56, 117, 125, 138, 168, 154, 168, 210, 198, 93, 51], years: 'test', fetched: '2026-01-01' } : null;
      applyClimate(true);
      const probs = [], summary = [];
      const overwinter = id => { const pr = (typeof SOW_PROFILE_OF === 'function' ? SOW_PROFILE_OF(id) : null); return ['garlic', 'onion', 'hatamanegi', 'soramame', 'snappea', 'sayaendo', 'strawberry', 'nanohana'].includes(kin(id)) || (pr && pr.winter); };
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
          const max = overwinter(cr.id) ? 300 : Math.max(dh * 2.3, dh + 50), min = overwinter(cr.id) ? Math.min(60, dh * 0.35) : dh * 0.6;
          if (n > max) probs.push(`${cr.id} sown ${m}/${day}: ${n} days to harvest (packet ${dh}) — too slow`);
          if (n < min) probs.push(`${cr.id} sown ${m}/${day}: ${n} days to harvest (packet ${dh}) — too fast`);
          if (n > 330) probs.push(`${cr.id} sown ${m}/${day}: over a year (${n} days)`);
        }
        const tp = tpDays(cr.id); if (cr.method === 'seed' && tp && tp >= (cr.daysHarvest || 999)) probs.push(`${cr.id}: plant-out (${tp} d) not before harvest (${cr.daysHarvest} d)`);
        summary.push(`${cr.id} ${months.join(',')}:${days.join('/')}`);
      }
      if (name === 'Tokyo') for (const cr of CATALOG) {
        const miss = [['days to harvest', cr.daysHarvest], ['family', cr.family && cr.family !== 'other'], ['growth temperatures', GROW[cr.id]], ['time to planting out', TRANSPLANT[cr.id]], ['spread', cr.spread], ['keeps for', cr.win]].filter(x => !x[1]).map(x => x[0]);
        if (cr.method === 'seed' && !cr.germ && TRANSPLANT[cr.id] && TRANSPLANT[cr.id][0] !== 0) miss.push('germination days');
        if (miss.length) probs.push(`${cr.id}: missing ${miss.join(', ')}`);
      }
      return { probs, summary };
    }, { name, t });
    console.log(`== ${name}: ${r.probs.length ? r.probs.length + ' problems' : 'problems: none'}`);
    for (const p of r.probs) console.log('  ✗ ' + p);
    console.log('  sowing months:days ' + r.summary.join(' · '));
  }
  console.log('errs', errs); await b.close();
})();
