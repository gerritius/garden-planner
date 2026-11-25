const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
const openAll = async pg => { for (let i = 0; i < 20; i++) { const b = await pg.$('.frow.line [data-open]'); if (!b) break; await b.click(); await pg.waitForTimeout(80); } };
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { products: true }); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Bag 5', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm', date: '2026-09-10', kind: 'touikawa', fresh: true }] });
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'ce', containerId: 'g1', cropId: 'celery', method: 'seedling', layout: 'staggered', from: 0, to: 40, rowSp: 20, plantSp: 20, sowDate: '2026-09-15', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: '化成肥料 8-8-8', amount: 120, unit: 'g' }] });
    S.plantings.push({ id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [], fert: [{ product: 'chicken manure', amount: 4, unit: 'handful' }] });
    for (const p of S.plantings) syncTasks(p); await save();
  });
  for (const id of ['ce', 'cb']) {
    await pg.goto(U + '#/plant/' + id); await pg.waitForTimeout(400);
    console.log(id, 'card:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 420));
    await pg.click('[data-act=addSideDress]'); await pg.waitForTimeout(500);
    console.log(id, 'plan:', (await pg.textContent('#fpSum')).replace(/\s+/g, ' '));
    await openAll(pg); console.log(id, 'rows:', await pg.$$eval('.frow', x => x.map(e => { const d = e.querySelector('[data-f=due],[data-f=date]'); return (d ? d.value : '') + ' ' + e.querySelector('[data-f=amount]').value + ' ' + e.querySelector('[data-f=unit]').value + ' ' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 70); })));
    if (id === 'ce') {
      await pg.click('[data-x=addEvery]'); await pg.waitForTimeout(500);
      await openAll(pg); const rows = await pg.$$('.frow'); const er = rows[rows.length - 1];
      await (await er.$('[data-f=product]')).fill('Kincho Liquid 6-6-7'); await (await er.$('[data-f=amount]')).fill('5'); await pg.waitForTimeout(900);
      console.log('weekly row:', (await pg.$$eval('.frow', x => x[x.length - 1].textContent.replace(/\s+/g, ' ').trim())).slice(-160));
      console.log('plan now:', (await pg.textContent('#fpSum')).replace(/\s+/g, ' '));
      await pg.screenshot({ path: SP + '/celery_plan.png', fullPage: true });
      await pg.click('#fpf button.primary'); await pg.waitForTimeout(500);
      console.log('saved:', JSON.stringify(await pg.evaluate(() => [planting('ce').feedPlan, S.tasks.filter(t => t.plantingId === 'ce' && t.kind === 'feed' && !t.done).map(t => [t.due, t.title])])));
      await pg.goto(U + '#/plant/ce'); await pg.waitForTimeout(400);
      console.log('card after:', (await pg.textContent('section.feeding')).replace(/\s+/g, ' ').slice(0, 260));
      await pg.locator('section.feeding').screenshot({ path: SP + '/celery_card.png' });
    } else { await pg.click('[data-x=no]'); }
  }
  console.log('errs', errs); await b.close();
})();
