const { newContext } = require('../lib');
// calibrate: worked-out windows for Tokyo vs the central-Japan chart; plus a few other climates
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => {
    const CLIM = { tokyo: TOKYO_T, melbourne: [21.3, 21.4, 19.4, 16.6, 13.9, 11.6, 11.0, 11.9, 13.6, 15.6, 17.8, 19.8], london: [5.2, 5.3, 7.6, 10.2, 13.6, 16.6, 18.7, 18.5, 15.7, 12.0, 8.0, 5.5], sapporo: [-3.2, -2.7, 1.1, 7.3, 13.0, 17.0, 21.1, 22.3, 18.6, 12.1, 5.2, -0.9], brisbane: [25.8, 25.6, 24.4, 22.0, 18.9, 16.4, 15.6, 16.6, 19.3, 21.5, 23.5, 25.0] };
    const out = [];
    for (const [name, t] of Object.entries(CLIM)) {
      for (let i = 0; i < 12; i++) NORMAL_T[i] = t[i]; clearSeasonCaches();
      if (name === 'tokyo') {
        let agree = 0, tot = 0;
        const rows = allCrops().filter(c => c.daysHarvest && (c.sowRef || c.sow || []).length).map(c => {
          const ref = c.sowRef || c.sow, got = sowWindow(c), ok = ref.filter(m => got.includes(m)).length, extra = got.filter(m => !ref.includes(m));
          agree += ok; tot += ref.length;
          return `${c.id.padEnd(12)} chart ${JSON.stringify(ref).padEnd(18)} worked out ${JSON.stringify(got).padEnd(22)}${ok < ref.length ? ' MISSING ' + JSON.stringify(ref.filter(m => !got.includes(m))) : ''}${extra.length ? ' EXTRA ' + JSON.stringify(extra) : ''}`;
        });
        out.push(`== Tokyo: ${agree}/${tot} chart months reproduced`, ...rows);
      } else {
        out.push(`== ${name}: ` + ['tomato', 'kyuri', 'zucchini', 'ingen', 'lettuce', 'spinach', 'daikon', 'cabbage', 'garlic', 'onion', 'snappea', 'potato', 'carrot', 'corn'].map(id => `${id} ${JSON.stringify(sowWindow(crop(id)))}`).join(' · '));
      }
    }
    for (let i = 0; i < 12; i++) NORMAL_T[i] = TOKYO_T[i]; clearSeasonCaches();
    return out.join('\n');
  }));
  console.log('errs', errs); await b.close();
})();
