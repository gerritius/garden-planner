// Arranging plants by hand in a bed with a net over it: the net is drawn on top of the plants, but tapping a plant
// still moves or removes it (taps go through covers), and a tap near a plant counts.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], covers: [{ id: 'cv', type: 'insect', from: 0, to: 200, on: '2026-10-01', off: null }] });
    const P = (id, cropId, from, to) => ({ id, cropId, containerId: 'b1', from, to, layout: 'rows', rowSp: 40, plantSp: 30, method: 'seed', sowDate: '2026-09-10', status: 'growing', photos: {}, series: [], harvests: [] });
    S.plantings.push(P('hk', 'hakusai', 0, 100), P('dk', 'daikon', 100, 200)); await save();
  });
  for (const id of ['hk', 'dk']) {
    await pg.goto(U + `#/plant/${id}/arrange`); await pg.waitForTimeout(400);
    console.log(id, '| net drawn over the plants:', await pg.$$eval('#arr .cover', x => x.length > 0), '|', await pg.textContent('#cnt'));
    const pt = async i => pg.$eval(`#arr circle[data-i="${i}"]`, c => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    // move plant 0 by touch-dragging
    await pg.click('[data-act=mode][data-v=move]');
    const before = await pg.evaluate(() => draft.pts[0].map(Math.round)); let [x, y] = await pt(0);
    await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + 25, y + 10, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(200);
    console.log('  moved:', JSON.stringify(before), '→', JSON.stringify(await pg.evaluate(() => draft.pts[0].map(Math.round))));
    // remove plant 1 with a tap just beside it
    await pg.click('[data-act=mode][data-v=remove]'); [x, y] = await pt(1);
    await pg.mouse.click(x + 6, y + 4); await pg.waitForTimeout(200);
    console.log('  removed one:', await pg.textContent('#cnt'));
    await pg.click('[data-act=mode][data-v=add]'); await pg.mouse.click(x, y + 30); await pg.waitForTimeout(200);
    console.log('  added one:', await pg.textContent('#cnt'));
    await pg.click('[data-act=save]'); await pg.waitForTimeout(400);
    console.log('  saved:', await pg.evaluate(i => `${planting(i).layout}, ${planting(i).positions.length} plants`, id));
  }
  console.log('errs', errs); await b.close();
})();
