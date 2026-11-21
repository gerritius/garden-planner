const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => {
    const lon = [5.2, 5.3, 7.6, 10.2, 13.6, 16.6, 18.7, 18.5, 15.7, 12.0, 8.0, 5.5], out = [];
    const tom = crop('tomato'), g = growParams('tomato');
    out.push(`tomato: daysHarvest ${tom.daysHarvest} (from planting), base ${g.tb}°, full speed at ${g.tref}° (capped ${g.tcap}°)`);
    for (const [name, t] of [['Tokyo', TOKYO_T], ['London', lon]]) {
      for (let i = 0; i < 12; i++) NORMAL_T[i] = t[i]; clearSeasonCaches();
      const d = name === 'Tokyo' ? '2026-05-01' : '2026-06-01', r = climGrow(tom, d);
      out.push(`${name}: plant ${d} → first ripe ${r && r.end} (${r && r.days} days) · picking days before mean <12°: ${r ? pickDays(r.end, 90) : '-'} · speed in July ${(growUnits('tomato', normalT('2026-07-15')) / (g.tref - g.tb) * 100).toFixed(0)}% · window ${JSON.stringify(sowWindow(tom))}`);
    }
    for (let i = 0; i < 12; i++) NORMAL_T[i] = TOKYO_T[i]; clearSeasonCaches();
    return out.join('\n');
  }));
  console.log('errs', errs); await b.close();
})();
