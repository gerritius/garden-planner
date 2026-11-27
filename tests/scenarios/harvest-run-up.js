// The run-up to harvest: potatoes 4 days from digging get no feed suggestion and no watering job (the skins firm up);
// a feed planned that late says "too close to harvest" with Skip; lettuce in the next bag still gets watered.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr();
    S.containers.push({ id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] }, { id: 'g2', type: 'round', name: 'Bag 2', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push({ id: 'po', containerId: 'g1', cropId: 'potato', method: 'plant', layout: 'free', positions: [[20, 20]], from: 0, to: 40, sowDate: addDays(td, -91), harvestDate: addDays(td, 4), status: 'active', photos: {}, series: [], harvests: [], fert: [] },
      { id: 'le', containerId: 'g2', cropId: 'lettuce', method: 'plant', layout: 'free', positions: [[20, 20]], from: 0, to: 40, sowDate: addDays(td, -10), status: 'active', photos: {}, series: [], harvests: [], fert: [] });
    for (const p of S.plantings) syncTasks(p);
    S.tasks.push({ id: 'f1', plantingId: 'po', kind: 'feed', title: 'Feed: chicken manure pellets 30 g', product: 'chicken manure pellets', amount: 30, unit: 'g', due: addDays(td, 1), done: false });
    await save();
  });
  await pg.goto(U + '#/plant/po'); await pg.waitForTimeout(600);
  console.log('run-up note:', await pg.evaluate(() => (document.querySelector('.lc-run') || {}).textContent));
  console.log('feeding card:', await pg.evaluate(() => [...document.querySelectorAll('#view p, #view div')].map(e => e.textContent).find(t => /No more feeding|plan a feed|Fed /.test(t) && t.length < 400)));
  console.log('last feed by:', await pg.evaluate(() => daysBetween(todayStr(), lastFeedBy(planting('po')))), 'days | lettuce:', await pg.evaluate(() => daysBetween(todayStr(), lastFeedBy(planting('le')))), 'days');
  console.log('feed job tag:', await pg.evaluate(() => JSON.stringify(jobWeather(S.tasks.find(t => t.id === 'f1')))));
  console.log('watered pots:', await pg.evaluate(() => waterPots().map(c => c.name).join(', ')), '| Bag 1 moisture:', await pg.evaluate(() => JSON.stringify(moistureOf(container('g1')))));
  await pg.click('[data-act=wxSkip][data-id=f1]'); await pg.waitForTimeout(300);
  console.log('after Skip, feed job gone:', await pg.evaluate(() => !S.tasks.some(t => t.id === 'f1')));
  console.log('errs', errs); await b.close();
})();
