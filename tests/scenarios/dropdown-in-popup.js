// A drop-down opened inside a pop-up (here: Record feeding) stays under its field when the pop-up scrolls, and closes
// once the field has scrolled out of the pop-up.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { viewport: { width: 412, height: 520 } }); const pg = await ctx.newPage(); const errs = [];   // a short screen (keyboard up), so the pop-up scrolls
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'hk', cropId: 'cabbage', containerId: 'b1', from: 0, to: 200, layout: 'staggered', rowSp: 45, plantSp: 40, method: 'seedling', sowDate: '2026-10-01', status: 'growing', photos: {}, series: [], harvests: [] });
    await save();
  });
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(400);
  await pg.evaluate(() => feedDialog({ pids: ['hk'] })); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('#modal .sheet').insertAdjacentHTML('beforeend', '<div style="height:900px"></div>'));   // a long pop-up, so it scrolls
  const field = await pg.$('#modal .dd-field'); await field.click(); await pg.waitForTimeout(200);
  const gap = () => pg.evaluate(() => { const p = document.querySelector('.dd-panel'), f = document.querySelector('#modal .dd-on'); if (!p || !f) return null; return Math.round(p.getBoundingClientRect().top - f.getBoundingClientRect().bottom); });
  const sheet = await pg.$('#modal .sheet');
  console.log('list opened under the field:', (await gap()) !== null && Math.abs(await gap()) <= 8, '| the pop-up scrolls:', await sheet.evaluate(e => e.scrollHeight > e.clientHeight));
  await sheet.evaluate(e => { e.scrollTop += 40; }); await pg.waitForTimeout(150);
  console.log('after scrolling the pop-up a little, still under the field:', Math.abs(await gap()) <= 8);
  await sheet.evaluate(e => { e.scrollTop += 2000; }); await pg.waitForTimeout(150);
  console.log('after scrolling the field out of view, the list closed:', !(await pg.$('.dd-panel')));
  console.log('errs', errs); await b.close();
})();
