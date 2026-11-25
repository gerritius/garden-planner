const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true, openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 60; const x = c.getContext('2d'); x.fillStyle = '#c5e1a5'; x.fillRect(0, 0, 60, 60); x.fillStyle = '#333'; x.fillText('白菜', 15, 35);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg')); await DB.putPhoto('ph1', blob);
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [] }, { id: 'b2', type: 'bed', name: 'Bed 3', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', variety: '無双', method: 'seed', layout: 'staggered', from: 0, to: 200, rowSp: 60, plantSp: 45, sowDate: '2026-09-01', harvestDate: '2026-12-05', spread: 50, status: 'active', thinned: true, photos: { front: 'ph1' }, series: [], harvests: [] });
    S.starts = [{ id: 'sp', cropId: 'snappea', variety: 'スナック753', kind: 'tray', tray: 1, count: 24, sowDate: '2026-11-05', status: 'growing', events: [], created: '1' }];
    syncStartTasks(S.starts[0]); await save();
  });
  await pg.goto(U + '#/plan'); await pg.waitForTimeout(400);
  console.log('gap chips', await pg.$$eval('li.gap .chip.mine', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  await pg.click('li.gap .chip.mine'); await pg.waitForTimeout(500);
  console.log('form', await pg.inputValue('#cropSel'), await pg.inputValue('#pf input[name=variety]'), await pg.inputValue('#pf input[name=sowDate]'), '|', (await pg.textContent('#pf')).match(/Using \d+ [^.]*\./)?.[0]);
  await pg.screenshot({ path: SP + '/usestart.png' });
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('plan', JSON.stringify(await pg.evaluate(() => { const p = S.plantings.find(p => p.cropId === 'snappea'); const s = S.starts[0]; return [p.status, p.method, p.raise, s.planId === p.id, S.tasks.filter(t => !t.done && (t.plantingId === p.id || t.startId === s.id)).map(t => t.kind + ' ' + t.due)]; })));
  // new hakusai planting in Bed 3 reusing the packet
  await pg.goto(U + '#/plant/new/b2'); await pg.waitForTimeout(400);
  console.log('chooser', await pg.$$eval('.usestart .chip', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim())));
  console.log('picker open', await pg.$eval('details.pktpick', d => d.open));
  await pg.click('button.pkt'); await pg.waitForTimeout(400);
  console.log('after packet', await pg.inputValue('#cropSel'), await pg.inputValue('#pf input[name=variety]'), await pg.$$eval('.phslot img', x => x.length));
  await pg.screenshot({ path: SP + '/packet.png', fullPage: false });
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('photos', JSON.stringify(await pg.evaluate(() => S.plantings.map(p => [p.id, p.cropId, p.photos]))));
  await pg.evaluate(async () => { await removePlanting(planting('hk')); await save(); });
  console.log('blob survives', await pg.evaluate(async () => !!(await DB.getPhoto('ph1'))));
  await pg.evaluate(async () => { const p = S.plantings.find(p => p.cropId === 'hakusai'); await removePlanting(p); await save(); });
  console.log('blob gone when unused', await pg.evaluate(async () => !(await DB.getPhoto('ph1'))));
  console.log('errs', errs); await b.close();
})();
