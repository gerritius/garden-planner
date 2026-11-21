const { newContext } = require('../lib');
// potting mix chosen in the planting form
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [
      { id: 'n1', type: 'round', name: 'Bag new', diameter: 40, depth: 35, margin: 2, history: [] },
      { id: 'h1', type: 'round', name: 'Bag hist', diameter: 40, depth: 35, margin: 2, history: [], mixLog: [{ id: 'm1', date: '2026-03-01', kind: 'touikawa', fresh: true }] },
      { id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }];
    S.plantings = []; S.tasks = []; delete S.prodLib; delete S.products; migrateProducts(); S.products.push(JSON.parse(JSON.stringify(catGet('iris')))); await save();
  });
  const mixUI = async () => (await pg.textContent('#pf fieldset:nth-of-type(2)')).replace(/\s+/g, ' ').match(/Potting mix.*?(?=More options|$)/)?.[0]?.slice(0, 220);
  const fert = () => pg.evaluate(() => JSON.stringify(draft && draft.fert.map(f => f.product + ' ' + f.amount + f.unit)));
  // 1) brand-new bag → defaults to fresh
  await pg.goto(U + '#/plant/new/n1?crop=lettuce'); await pg.waitForTimeout(500);
  console.log('new bag:', await mixUI(), '| fert', await fert());
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('  saved log:', JSON.stringify(await pg.evaluate(() => container('n1').mixLog.map(e => [e.date, e.kind, e.fresh, !!e.pid]))));
  // 2) second crop in same bag → re-used, from first
  await pg.goto(U + '#/plant/new/n1?crop=komatsuna&date=2026-12-20'); await pg.waitForTimeout(500);
  console.log('same bag later:', await mixUI(), '| fert', await fert(), await pg.evaluate(() => JSON.stringify([draft.cropId, draft.sowDate, draft.mixFresh, S.plantings.map(p => [p.containerId, p.sowDate, p.status])])));
  // 3) bag with hand-entered history → re-used Touikawa
  await pg.goto(U + '#/plant/new/h1?crop=garlic'); await pg.waitForTimeout(500);
  console.log('hist bag:', await mixUI(), '| fert', await fert());
  await pg.click('[data-act=mixF][data-v="1"]'); await pg.waitForTimeout(300);
  console.log('  → fresh:', await mixUI(), '| fert', await fert());
  await pg.click('[data-act=mixF][data-v="0"]'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${SP}/mixform.png`, fullPage: true });
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  const gid = await pg.evaluate(() => S.plantings.find(p => p.cropId === 'garlic').id);
  console.log('  saved log:', JSON.stringify(await pg.evaluate(() => container('h1').mixLog.map(e => [e.date, e.kind, e.fresh, !!e.pid]))));
  console.log('  ledger soil:', await pg.evaluate(id => feedLedger(planting(id)).lines.find(l => l.g === 'soil').label, gid));
  // 4) edit it: switch to fresh Iris → replaces its own event, history kept
  await pg.goto(U + '#/plant/' + gid + '/edit'); await pg.waitForTimeout(500);
  console.log('edit shows:', await mixUI());
  await pg.click('[data-act=mixF][data-v="1"]'); await pg.waitForTimeout(300); await pg.selectOption('#pf [name=mixKind]', 'iris'); await pg.waitForTimeout(300);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('  saved log:', JSON.stringify(await pg.evaluate(() => container('h1').mixLog.map(e => [e.date, e.kind, e.fresh, !!e.pid]))));
  console.log('  ledger soil:', await pg.evaluate(id => feedLedger(planting(id)).lines.find(l => l.g === 'soil').label, gid));
  // 5) delete planting → its event goes, history stays
  await pg.evaluate(async id => { await removePlanting(planting(id)); await save(); }, gid);
  console.log('after delete:', JSON.stringify(await pg.evaluate(() => container('h1').mixLog.map(e => [e.date, e.kind, e.fresh, !!e.pid]))));
  // bed form: no mix field; bed page has no Feeding section
  await pg.goto(U + '#/plant/new/b1?crop=lettuce'); await pg.waitForTimeout(400);
  console.log('bed form has mix?', !!(await pg.$('[data-act=mixF]')));
  await pg.evaluate(async () => { S.plantings.push({ id: 'bb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'staggered', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [] }); await save(); });
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(400);
  console.log('bed page feeding section?', !!(await pg.$('section.feeding')));
  await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(200); console.log('bed more:', (await pg.textContent('#modal .tiles')).replace(/\s+/g, ' '));
  await pg.goto(U + '#/container/h1'); await pg.waitForTimeout(400); await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(200); console.log('bag more:', (await pg.textContent('#modal .tiles')).replace(/\s+/g, ' '));
  // crop page buttons
  await pg.goto(U + '#/plant/bb'); await pg.waitForTimeout(400);
  const hs = await pg.$$eval('.btnrow:has([data-act=harvest]) .btn', x => x.map(e => Math.round(e.getBoundingClientRect().height)));
  console.log('crop page buttons all the same height:', hs.length > 1 && Math.max(...hs) - Math.min(...hs) <= 1);
  await pg.locator('.btnrow:has([data-act=harvest])').screenshot({ path: `${SP}/cropbtns.png` });
  console.log('errs', errs); await b.close();
})();
