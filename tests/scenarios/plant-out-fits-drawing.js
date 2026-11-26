// Planting out from a tray: the plants that go in are the ones the drawing holds, and only their cells leave the tray.
// (A 20-cell tray, 19 cells sown with 2 plants kept in each — 38 plants — planted out into a grow bag as a diamond, which
// holds 4: that's 2 cells; the other 17 stay in the tray to replant.) A layout with room for more than you have offers
// to place just yours.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [{ id: 'g1', type: 'round', name: 'Grow bag', diameter: 40, depth: 35, margin: 2, history: [] }, { id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }];
    S.plantings = []; S.tasks = [];
    S.starts = [{ id: 'st', cropId: 'lettuce', kind: 'tray', tray: 1, count: 19, per: 2, sowDate: '2026-10-01', upOn: '2026-10-07', status: 'growing', events: [], created: '1' }];
    await save();
  });
  const banner = () => pg.evaluate(() => (document.querySelector('#startBanner') || {}).textContent || '—');
  // into the grow bag, all 19 cells asked for
  await pg.goto(U + '#/plant/new/g1?crop=lettuce&start=st&n=19'); await pg.waitForTimeout(600);
  console.log('bag, as opened:', await banner());
  await pg.selectOption('#pf select[name=layout]', 'diamond'); await pg.waitForTimeout(400);
  console.log('bag, diamond:', await banner(), '| drawn', await pg.evaluate(() => document.querySelectorAll('#pprev circle.plant').length));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('saved: planting plants', await pg.evaluate(() => { const p = S.plantings[0]; return Draw.count(container(p.containerId), p); }), '| cells left in the tray', await pg.evaluate(() => startLeft(start('st'))), '| tray still growing', await pg.evaluate(() => start('st').status));
  // 3 more cells (6 plants) into the bed, in rows: more room than seedlings → offer to place just these
  await pg.goto(U + '#/plant/new/b1?crop=lettuce&start=st&n=3'); await pg.waitForTimeout(600);
  console.log('bed, rows:', await banner());
  await pg.click('[data-act=fitStart]'); await pg.waitForTimeout(500);
  console.log('after "place just these":', await banner(), '| layout', await pg.inputValue('#pf select[name=layout]'), '| positions', await pg.evaluate(() => (draft.positions || []).length));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('saved: cells left', await pg.evaluate(() => startLeft(start('st'))), '| tray', await pg.evaluate(() => start('st').status), '| plants in the bed', await pg.evaluate(() => { const p = S.plantings.find(x => x.containerId === 'b1'); return Draw.count(container('b1'), p); }));
  console.log('errs', errs); await b.close();
})();
