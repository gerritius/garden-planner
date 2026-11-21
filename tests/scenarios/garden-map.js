const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10 }, { id: 'b2', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10 });
    for (let i = 1; i <= 12; i++) S.containers.push({ id: 'g' + i, type: 'round', name: 'Bag ' + i, diameter: 40, depth: 35, margin: 2, pos: [ (i % 2) * 150, 250 + i * 70 ] }); S.containers[0].pos=[0,0]; S.containers[1].pos=[150,0];
    await save();
  });
  await pg.goto(U + '#/map?edit=1'); await pg.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(pg);
  const swipe = async (x, y0, y1) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * k / 10 }] }); await pg.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(400);
  };
  const H = await pg.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
  console.log('map is taller than the screen:', H[0] > H[1] * 1.5);
  // find empty point on map: right-bottom area of svg
  const sb = await (await pg.$('#mapbox svg')).boundingBox();
  console.log('map fills the width:', sb.width > 300);
  await swipe(sb.x + sb.width - 8, 600, 250);
  console.log('swipe on empty space scrolls the page:', (await pg.evaluate(() => scrollY)) > 100);
  // drag a bed via touch
  await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(200);
  const before = await pg.evaluate(() => container('b1').pos.slice());
  const bb = await (await pg.$('[data-cid=b1] .hit')).boundingBox();
  await swipe(bb.x + bb.width / 2, bb.y + 20, bb.y + 120);
  console.log('bed b1', before, '->', await pg.evaluate(() => container('b1').pos), '| page stayed put:', (await pg.evaluate(() => scrollY)) < 20);
  // auto-scroll: drag a bag to the bottom edge and hold
  await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(200);
  const gb = await (await pg.$('[data-cid=g1] .hit')).boundingBox(); const vh = await pg.evaluate(() => innerHeight);
  const b4 = await pg.evaluate(() => container('g1').pos.slice());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gb.x + 5, y: gb.y + 5 }] });
  for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gb.x + 5, y: gb.y + 5 + (vh - 20 - gb.y) * k / 10 }] }); await pg.waitForTimeout(16); }
  await pg.waitForTimeout(1200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(400);
  const after = await pg.evaluate(() => container('g1').pos);
  console.log('autoscroll: page scrolled', (await pg.evaluate(() => scrollY)) > 0, '| g1 stayed in its column:', after[0] === b4[0], '| moved well down:', after[1] - b4[1] > 300);
  await pg.screenshot({ path: require('path').join(process.argv[2] || '.', 'map11.png'), fullPage: true });
  console.log('errs', errs); await b.close();
})();
