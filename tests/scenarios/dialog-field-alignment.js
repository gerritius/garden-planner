const { newContext } = require('../lib');
// screenshots of dialogs with date inputs next to other fields
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 100, rowSp: 60, plantSp: 45, thinSp: 45, sowDate: '2026-09-05', status: 'active', photos: {}, series: [], harvests: [] });
    S.starts = [{ id: 'st', cropId: 'lettuce', kind: 'tray', tray: 1, count: 5, sowDate: '2026-10-20', status: 'growing', events: [], created: '1' }];
    syncTasks(S.plantings[0]); await save();
  });
  const shots = [
    ['bedjob', () => bedTaskDialog(container('b1'))], ['purchase', () => purchaseDialog()], ['discard', () => discardDialog(start('st'))],
    ['reading', () => readingDialog(container('b1'))], ['startdlg', () => startDialog()], ['feed', () => feedDialog({ pids: ['hk'] })],
    ['leaves', () => leafDialog(planting('hk'), 'Hakusai')], ['pastcrop', () => pastCropDialog(container('b1'))], ['cover', () => coverDialog(container('b1'))],
    ['harvestdlg', () => harvestDialog(planting('hk'))], ['task', () => taskDialog(null, planting('hk'))],
  ];
  for (const [n, fn] of shots) {
    await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(250);
    try { await pg.evaluate(`(${fn.toString()})()`); } catch (e) { console.log(n, 'ERR', e.message.slice(0, 80)); continue; }
    await pg.waitForTimeout(250);
    // report rows where a date input sits next to another control with a different top
    const mis = await pg.evaluate(() => [...document.querySelectorAll('#modal .two, #modal .fgrid2, #modal .rep-row')].map(row => {
      const ins = [...row.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select')].filter(x => x.offsetParent);
      if (ins.length < 2 || !ins.some(x => x.type === 'date')) return null;
      const tops = ins.map(x => Math.round(x.getBoundingClientRect().top)), hs = ins.map(x => Math.round(x.getBoundingClientRect().height));
      return Math.max(...tops) - Math.min(...tops) > 3 || Math.max(...hs) - Math.min(...hs) > 3 ? { tops, hs, names: ins.map(x => x.name || x.type) } : null; }).filter(Boolean));
    console.log(n, mis.length ? JSON.stringify(mis) : 'ok');
    await pg.locator('#modal .sheet').screenshot({ path: `${SP}/dlg_${n}.png` });
  }
  await pg.goto(U + '#/plant/new/b1?crop=hakusai'); await pg.waitForTimeout(400);
  const misForm = await pg.evaluate(() => [...document.querySelectorAll('#pf .two')].map(row => { const ins = [...row.querySelectorAll('input,select')].filter(x => x.offsetParent && x.type !== 'checkbox');
    const tops = ins.map(x => Math.round(x.getBoundingClientRect().top)); return ins.length > 1 && Math.max(...tops) - Math.min(...tops) > 3 ? ins.map(x => x.name).join('+') + ' tops ' + tops.join(',') : null; }).filter(Boolean));
  console.log('planting form', JSON.stringify(misForm));
  console.log('errs', errs); await b.close();
})();
