const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b)).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }, { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'gar', containerId: 'g1', cropId: 'garlic', method: 'seedling', layout: 'center', from: 0, to: 40, plantSp: 15, sowDate: '2026-10-10', harvestDate: '2027-05-30', spread: 15, status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, thinSp: 45, sowDate: '2026-08-30', thinDate: '2026-09-24', harvestDate: '2026-11-20', spread: 50, status: 'active', photos: {}, series: [], harvests: [{ id: 'h1', date: '2026-11-09', count: 2 }], diary: [{ id: 'd1', date: '2026-10-02', note: 'Holes in leaves', tags: ['fleabeetle'] }] });
    syncTasks(planting('hk')); syncTasks(planting('gar'));
    S.tasks.push({ id: 't1', plantingId: 'hk', kind: 'custom', title: 'Side-dress & earth up (追肥・土寄せ)', due: '2026-10-01', done: true, doneOn: '2026-10-01' });
    container('b1').log = [{ id: 'n1', date: '2026-08-25', text: 'Added 2 kg compost + lime' }];
    await save();
  });
  // past crop on Bag 1: tomato
  await pg.goto(U + '#/container/g1'); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await pg.click('[data-act=addPast]'); await pg.waitForTimeout(200);
  await pg.selectOption('#pcf select[name=crop]', 'minitomato'); await pg.fill('#pcf input[name=variety]', 'アイコ');
  await pg.fill('#pcf input[name=start]', '2026-04'); await pg.fill('#pcf input[name=end]', '2026-09'); await pg.click('#pcf button.primary'); await pg.waitForTimeout(300);
  // something else on Plot A
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await pg.click('[data-act=addPast]'); await pg.waitForTimeout(200);
  await pg.selectOption('#pcf select[name=crop]', '__other'); await pg.fill('#pcf input[name=oname]', 'Okra'); await pg.fill('#pcf input[name=end]', '2026-08'); await pg.fill('#pcf input[name=to]', '100'); await pg.click('#pcf button.primary'); await pg.waitForTimeout(300);
  console.log('hist', JSON.stringify(await pg.evaluate(() => [container('g1').history, container('b1').history])));
  await pg.screenshot({ path: SP + '/bed13.png', fullPage: true });
  // garlic page shows previous crop
  await pg.goto(U + '#/plant/gar'); await pg.waitForTimeout(300);
  console.log('prev', (await pg.textContent('main')).match(/Previous crop here[^\n]{0,60}/)?.[0]);
  // log something: fertilise both
  await pg.goto(U + '#/log'); await pg.waitForTimeout(300);
  await pg.click('button.btn[data-act=newLog]'); await pg.waitForTimeout(200);
  await pg.fill('#lf input[name=product]', '化成肥料 8-8-8'); await pg.fill('#lf input[name=amount]', '2'); await pg.selectOption('#lf select[name=unit]', 'handful');
  await pg.click('#lf label.chip.tog:has(input[value=b1])'); await pg.click('#lf button.primary'); await pg.waitForTimeout(300);
  await pg.click('button.btn[data-act=newLog]'); await pg.waitForTimeout(200);
  await pg.selectOption('#lf select[name=kind]', 'spray'); await pg.fill('#lf input[name=product]', 'BT spray'); await pg.fill('#lf textarea', '1000× dilution'); await pg.fill('#lf input[name=date]', '2026-11-08'); await pg.click('#lf button.primary'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: SP + '/log13.png', fullPage: true });
  console.log('log items', await pg.$$eval('.plist.log li', l => l.length));
  await pg.goto(U + '#/log?f=fert'); await pg.waitForTimeout(300); console.log('fert', await pg.$$eval('.plist.log li b', l => l.map(x => x.textContent)));
  await pg.goto(U + '#/log?c=g1'); await pg.waitForTimeout(300); console.log('bag1', await pg.$$eval('.plist.log li b', l => l.map(x => x.textContent)));
  // edit entry
  await pg.goto(U + '#/log?f=spray'); await pg.waitForTimeout(300); await pg.click('li[data-act=editLog]'); await pg.waitForTimeout(200); console.log('edit dlg', await pg.inputValue('#lf input[name=product]'));
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300); await pg.screenshot({ path: SP + '/plant13.png', fullPage: true });
  await pg.goto(U + '#/search'); await pg.fill('#sq', 'okra'); await pg.waitForTimeout(300); console.log('search okra', (await pg.textContent('#sres')).slice(0, 120));
  await pg.fill('#sq', 'BT'); await pg.waitForTimeout(300); console.log('search BT', (await pg.textContent('#sres')).slice(0, 120));
  await pg.goto(U); await pg.waitForTimeout(300); await pg.click('.fab'); await pg.waitForTimeout(200); await pg.click('[data-q=more]'); await pg.waitForTimeout(150); await pg.click('[data-q=log]'); await pg.waitForTimeout(200); console.log('qa log', !!(await pg.$('#lf')));
  console.log('errs', errs); await b.close();
})();
