const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.containers = [{ id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] }]; S.plantings = []; S.tasks = []; S.starts = []; await save(); });
  console.log(await pg.evaluate(() => [['tomato', '2027-05-01'], ['nasu', '2027-05-01'], ['piman', '2027-05-01'], ['kyuri', '2027-05-01'], ['cabbage', '2027-03-15'], ['lettuce', '2027-03-01'], ['onion', '2026-11-20'], ['celery', '2027-05-20'], ['tomato', '2026-05-01']]
    .map(([id, d]) => { const t = traySowPlan(id, d); return `${id} out ${d}: sow ${t.sow} (${daysBetween(t.sow, d)} d) kept ${t.kept}${t.late ? ' LATE' : ''}`; }).join('\n')));
  await pg.goto(U + '#/plant/new/g1?plan=1&crop=tomato&date=2027-05-01&method=seedling&raise=tray'); await pg.waitForTimeout(500);
  console.log('form:', (await pg.textContent('#planBits')).replace(/\s+/g, ' '));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('tasks:', JSON.stringify(await pg.evaluate(() => S.tasks.map(t => [t.title, t.due]))));
  console.log('errs', errs); await b.close();
})();
