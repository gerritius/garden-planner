// Every crop in a sweep of made-up climates — winters from −10 °C to tropical, summers from cool to hot, both
// hemispheres, with frost where winters are cold — checked against rules that hold anywhere (no place-by-place list):
// in every month the app offers a crop, it must reach harvest within the year (garlic planted in September where
// winters reach −10 °C is lifted the next August: ~320 days),
// frost-tender crops must go in after the usual last frost and be done (or picking) before the first, nothing that
// bolts in the heat may mature in it, and long-day bolters mustn't mature in very long days. "problems: none" is the goal.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
// a year of monthly means from a winter and a summer mean (coldest month in January up north, July down south)
const year = (winter, summer, south) => Array.from({ length: 12 }, (_, m) => +((winter + summer) / 2 - (summer - winter) / 2 * Math.cos(2 * Math.PI * (m - (south ? 6 : 0)) / 12)).toFixed(1));
const CLIMATES = [];
for (const winter of [-10, -5, 0, 3, 6, 9, 12, 15, 18, 22, 25]) for (const summer of [16, 20, 24, 28, 32]) for (const south of [false, true]) {
  if (summer < winter + 4 || (winter >= 22 && summer < 26)) continue;
  const lat = winter >= 18 ? 12 : winter >= 9 ? 30 : winter >= 0 ? 40 : 50;
  CLIMATES.push({ name: `${south ? 'S' : 'N'} winter ${winter}° summer ${summer}°`, lat: south ? -lat : lat, t: year(winter, summer, south) });
}
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  const all = [], offered = {};
  for (const c of CLIMATES) {
    const r = await pg.evaluate(({ name, lat, t }) => {
      // frost: nights about 7 °C under the daily mean, so frost where the mean is ≤ 7 °C (most winters, if any month is)
      const day = d => normalT(d), south = lat < 0;
      S.weather = { lat, lon: 0, name };
      S.climate = { lat, lon: 0, name, t, rain: Array(12).fill(80), years: 'test', fetched: '2026-01-01', frost: null };
      applyClimate(true);
      if (Math.min(...t) <= 7) {   // usual first and last frost, as days from the winter's start (1 July / 1 January)
        const start = south ? '2026-01-01' : '2026-07-01', offs = []; for (let i = 0; i < 365; i++) if (day(addDays(start, i)) <= 7) offs.push(i);
        if (offs.length) S.climate.frost = { winters: 10, frosty: 10, first: offs[0], last: offs[offs.length - 1], south };
      }
      applyClimate(true);
      const probs = [], n = [];
      const hp = id => (SOW_PROFILE[id] || {}).heat, ld = id => (SOW_PROFILE[id] || {}).longDay, ow = id => !!(SOW_PROFILE[id] || {}).winter;
      for (const cr of CATALOG) {
        const months = cr.sow || []; if (months.length) n.push(cr.id);
        for (const m of months) for (const dd of [5, 15, 25]) {
          const sd = `2026-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
          if (!sowDayOK(cr, sd)) continue;
          const p = { cropId: cr.id, sowDate: sd, method: cr.method === 'seed' ? 'seed' : 'seedling' }, h = harvestEstimate(p);
          if (!h) { probs.push(`${cr.id} ${sd}: no harvest`); continue; }
          const days = daysBetween(sd, h), kid = kin(cr.id);
          if (days > 335) probs.push(`${cr.id} ${sd}: ${days} days to harvest`);
          if (cr.tender && hasFrostDates()) {
            const up = addDays(sd, cr.method === 'seed' ? (cr.germ || [7, 7])[1] : 0);
            if (!frostFree(up)) probs.push(`${cr.id} ${sd}: up on ${up}, in the frost season`);
            const ff = firstFrostAfter(sd), fe = frostEnd(p);
            if (ff && h > ff && !fe) probs.push(`${cr.id} ${sd}: harvest ${h} after the first frost ${ff}`);
          }
          if (hp(kid)) { let s = 0, k = 0; for (let i = Math.round(days * 0.7); i <= days; i += 3) { s += normalT(addDays(sd, i)); k++; } if (s / k > hp(kid) + 0.5) probs.push(`${cr.id} ${sd}: matures at ${(s / k).toFixed(1)}° (bolts above ${hp(kid)}°)`); }
          if (ld(kid) && dayLength(h) >= ld(kid) + 0.1) probs.push(`${cr.id} ${sd}: matures in ${dayLength(h).toFixed(1)} h days (bolts from ${ld(kid)} h)`);
        }
      }
      return { probs, n };
    }, c);
    offered[c.name] = r.n.length;
    for (const p of r.probs) all.push(`${c.name}: ${p}`);
  }
  console.log(`${CLIMATES.length} climates, every crop × every month offered × early/mid/late: ${all.length ? all.length + ' problems' : 'problems: none'}`);
  for (const p of all.slice(0, 60)) console.log('  ✗ ' + p);
  // and the app still offers a sensible number of crops everywhere (not nothing in the cold or the tropics)
  const few = Object.entries(offered).filter(([, n]) => n < 15);
  console.log('crops offered: least', Math.min(...Object.values(offered)), '| most', Math.max(...Object.values(offered)), '| climates with fewer than 15:', few.map(([k, n]) => `${k} (${n})`).join(', ') || 'none');
  console.log('errs', errs); await b.close();
})();
