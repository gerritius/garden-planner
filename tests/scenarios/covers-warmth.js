// Covers count in growth: on the days a cover is on, over the section it covers, the plants grow a little warmer —
// fushokufu about 2.5 °C on the daily mean, an insect net a little, shade cloth not at all — less as it warms, none from
// 22 °C. Here: spinach and komatsuna side by side, sown 10 November, a cover over the spinach half only.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], covers: [] });
    const P = (id, cropId, from, to, sowDate, method = 'seed') => ({ id, cropId, containerId: 'b1', from, to, layout: 'rows', rowSp: 15, plantSp: 5, method, sowDate, status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push(P('sp', 'spinach', 0, 100, '2026-11-10'), P('ko', 'komatsuna', 100, 200, '2026-11-10'));
    await save();
  });
  const dates = () => pg.evaluate(() => ['sp', 'ko'].map(id => { const p = planting(id); return `${p.cropId}: up ${JSON.stringify(germWindow(p))} · thin ${thinEstimate(p)} · harvest ${harvestEstimate(p)}`; }).join(' | '));
  const cover = (type, on = '2026-11-10', off = null, from = 0, to = 100) => pg.evaluate(c => { container('b1').covers = c ? [Object.assign({ id: 'cv' }, c)] : []; }, type ? { type, on, off, from, to } : null);
  console.log('no cover:            ', await dates());
  await cover('fushokufu'); console.log('fushokufu on spinach:', await dates());
  await cover('insect'); console.log('insect net instead:  ', await dates());
  await cover('shade'); console.log('shade cloth instead: ', await dates());
  await cover('fushokufu', '2026-11-10', '2026-12-15'); console.log('fushokufu off 15 Dec:', await dates());
  await cover('fushokufu', '2026-11-10', null, 0, 200); console.log('fushokufu, whole bed:', await dates());
  // in mid-November the soil is still warm enough for them to come up in their usual days; sown mid-December it isn't,
  // and there the fushokufu brings them up sooner too
  console.log('sown 15 Dec, up:', await pg.evaluate(() => { const p = Object.assign({}, planting('sp'), { sowDate: '2026-12-15' });
    container('b1').covers = []; const bare = germWindow(p); container('b1').covers = [{ id: 'cv', type: 'fushokufu', on: '2026-12-15', from: 0, to: 100 }];
    return `bare ${JSON.stringify(bare)} · fushokufu ${JSON.stringify(germWindow(p))}`; }));
  // in summer a cover hardly matters (and it's usually off)
  console.log('tomato planted 1 May:', await pg.evaluate(() => { const p = { id: 'tm', cropId: 'tomato', containerId: 'b1', from: 0, to: 100, method: 'seedling', sowDate: '2027-05-01' };
    const with_ = harvestEstimate(p); container('b1').covers = []; return `with fushokufu ${with_} · without ${harvestEstimate(p)}`; }));
  // the planting's page follows the cover
  await cover('fushokufu'); await pg.evaluate(async () => { syncHarvest(); await save(); });
  await pg.goto(U + '#/plant/sp'); await pg.waitForTimeout(300);
  console.log('page:', (await pg.textContent('.datebar')).replace(/\s+/g, ' ').trim());
  console.log('errs', errs); await b.close();
})();
