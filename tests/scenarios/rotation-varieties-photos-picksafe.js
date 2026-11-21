const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d');
    for (const [k, col] of [['p1', '#9c6'], ['p2', '#7a4'], ['p3', '#583']]) { x.fillStyle = col; x.fillRect(0, 0, 80, 80); await DB.putPhoto(k, await new Promise(r => c.toBlob(r, 'image/jpeg'))); }
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 1', width: 100, length: 200, margin: 10, history: [{ id: 'h1', manual: true, cropId: 'tomato', from: 0, to: 200, sowDate: '2025-05-01', harvestedOn: '2025-09-30' }] },
      { id: 'b2', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [{ id: 'h2', manual: true, cropId: 'snappea', from: 0, to: 200, sowDate: '2025-11-01', harvestedOn: '2026-05-20' }] },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b2', cropId: 'hakusai', variety: '無双', method: 'seed', layout: 'staggered', from: 0, to: 200, rowSp: 60, plantSp: 45, sowDate: '2026-09-01', harvestDate: '2026-12-05', status: 'active', thinned: true, photos: {}, series: [], harvests: [{ id: 'q', date: '2026-11-10', count: 2 }],
      germ: { result: 'good', date: '2026-09-04' }, diary: [{ id: 'd1', date: '2026-09-15', photo: 'p1', note: 'Seedlings', tags: [] }, { id: 'd2', date: '2026-10-10', photo: 'p2', note: 'Holes', tags: ['caterpillars'] }, { id: 'd3', date: '2026-11-05', photo: 'p3', note: 'Heading', tags: [] }] });
    S.plantings.push({ id: 'kom', containerId: 'g1', cropId: 'komatsuna', method: 'seed', layout: 'continuous', from: 0, to: 40, rowSp: 15, plantSp: 3, sowDate: '2026-10-20', harvestDate: '2026-11-25', status: 'active', photos: {}, series: [], harvests: [] });
    S.log = [{ id: 'l1', date: addDays(todayStr(), -2), kind: 'spray', product: 'Spino Ace water granules', productId: 'spinoace', phi: 14, cids: ['g1'], pids: [] }];
    await save();
  });
  await pg.goto(U + '#/rotation'); await pg.waitForTimeout(300);
  console.log('fam', (await pg.$$eval('li.rot', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).slice(0, 4));
  console.log('beds', await pg.$$eval('.plist:not(.rotl) li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  await pg.screenshot({ path: SP + '/rotation.png', fullPage: true });
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300); await pg.click('a.variety'); await pg.waitForTimeout(300);
  await pg.click('[data-r=yes]'); await pg.waitForTimeout(200); await pg.fill('#vnote', 'Solid heads, slow in cold'); await pg.click('[data-act=saveVarNote]'); await pg.waitForTimeout(200);
  console.log('variety', (await pg.textContent('#view')).replace(/\s+/g, ' ').slice(0, 300));
  await pg.goto(U + '#/varieties'); await pg.waitForTimeout(300); console.log('varieties', await pg.$$eval('.plist li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  await pg.goto(U + '#/container/b2'); await pg.waitForTimeout(300); await pg.goto(U + '#/timeline?c=b2'); await pg.waitForTimeout(400);
  await pg.screenshot({ path: SP + '/timeline.png' }); await pg.click('.tlgrid a'); await pg.waitForTimeout(300);
  console.log('photo view', (await pg.textContent('#view')).replace(/\s+/g, ' ').slice(0, 100));
  await pg.goto(U); await pg.waitForTimeout(300); await pg.click('section.heads a[href="#/picksafe"]'); await pg.waitForTimeout(300);
  console.log('picksafe', await pg.$$eval('.plist.pick li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  console.log('errs', errs); await b.close();
})();
