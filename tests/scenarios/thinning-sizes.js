const { newContext } = require('../lib');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b)).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => {
    const P = o => Object.assign({ method: 'seed', thinSp: 45, plantSp: 45, spread: 50, layout: 'staggered', from: 0, to: 200, thinned: false }, o);
    const r = p => Math.round(Draw.radius(P(p), '2026-11-11') * 2);
    return {
      pastHarvest_unthinned: r({ sowDate: '2026-09-01', thinDate: '2026-09-26', harvestDate: '2026-11-10' }),
      thinAfterHarvest: r({ sowDate: '2026-09-01', thinDate: '2026-11-20', harvestDate: '2026-11-25' }),
      thinDateMissing: r({ sowDate: '2026-09-01', harvestDate: '2026-11-25' }),
      nearHarvest_thinned: r({ sowDate: '2026-09-01', thinDate: '2026-09-26', thinned: true, thinDoneOn: '2026-09-28', harvestDate: '2026-11-20' }),
      beforeThin: r({ sowDate: '2026-11-01', thinDate: '2026-11-25', harvestDate: '2027-01-20' }),
      seedling: Math.round(Draw.radius(P({ method: 'seedling', sowDate: '2026-09-10', harvestDate: '2026-11-25', spread: 45 }), '2026-11-11') * 2),
    };
  }));
  console.log('errs', errs); await b.close();
})();
