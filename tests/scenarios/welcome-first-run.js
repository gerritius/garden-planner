// A new garden opens on the welcome steps: start (or restore a backup), where the garden is, which crops, a first bed
// or pot, and how to keep a backup. Your crops then come first in crop lists, and the sowing calendar and ideas are about
// them. A garden that already exists never sees the welcome steps.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { welcome: true });
  await ctx.route('**/archive-api.open-meteo.com/**', r => r.abort());
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  await ctx.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Setagaya', admin1: 'Tokyo', country: 'Japan', latitude: 35.6464, longitude: 139.6532 }] }) }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(600);
  const view = () => pg.evaluate(() => document.querySelector('#view').textContent.replace(/\s+/g, ' ').trim());
  console.log('opens on:', await pg.evaluate(() => location.hash), '| first run:', await pg.evaluate(() => S.firstRun));
  console.log('step 1:', (await view()).slice(0, 330));
  await pg.screenshot({ path: SP + '/welcome1.png', fullPage: true });
  await pg.click('text=Start my garden'); await pg.waitForTimeout(300);
  console.log('step 2:', (await view()).slice(0, 160));
  await pg.fill('#wxq', 'Setagaya'); await pg.click('[data-act=wxSearch]'); await pg.waitForTimeout(300);
  await pg.click('[data-act=wxPick]'); await pg.waitForTimeout(400);
  console.log('  location:', JSON.stringify(await pg.evaluate(() => S.weather && [S.weather.name, S.weather.lat, S.weather.lon])), '| button:', await pg.textContent('.welcome .btncol .btn.primary'));
  await pg.click('.welcome .btncol .btn.primary'); await pg.waitForTimeout(300);
  console.log('step 3:', (await pg.$$eval('.pickgrp h4', x => x.map(e => e.textContent.trim()))).join(' | '));
  await pg.screenshot({ path: SP + '/welcome3.png', fullPage: true });
  await pg.click('[data-act=pickCommon]'); await pg.waitForTimeout(300);
  console.log('  the usual crops:', await pg.textContent('#pickN'));
  await pg.fill('#pickq', 'komat'); await pg.waitForTimeout(300);
  console.log('  search "komat":', await pg.$$eval('[data-act=pickCrop]', x => x.map(e => e.dataset.id + (e.classList.contains('on') ? ' ✓' : '')).join(', ')));
  await pg.click('[data-act=pickCrop][data-id=komatsuna]'); await pg.waitForTimeout(200);
  await pg.fill('#pickq', 'shungiku'); await pg.waitForTimeout(300); await pg.click('[data-act=pickCrop][data-id=shungiku]'); await pg.waitForTimeout(200);
  console.log('  chosen:', await pg.evaluate(() => S.myCrops.length), 'komatsuna', await pg.evaluate(() => S.myCrops.includes('komatsuna')), 'shungiku', await pg.evaluate(() => S.myCrops.includes('shungiku')));
  await pg.click('.welcome .btncol .btn.primary'); await pg.waitForTimeout(300);
  console.log('step 4:', (await view()).slice(0, 200));
  await pg.click('text=Later'); await pg.waitForTimeout(300);
  console.log('step 5:', (await view()).slice(0, 420));
  await pg.click('[data-act=wlFinish]'); await pg.waitForTimeout(400);
  console.log('finished:', await pg.evaluate(() => location.hash), '| first run:', await pg.evaluate(() => S.firstRun), '| home says finish setting up:', (await view()).includes('Finish setting up'));
  // your crops first in crop lists
  await pg.evaluate(async () => { S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }); await save(); });
  await pg.goto(U + '#/plant/new/b1'); await pg.waitForTimeout(400);
  await pg.click('#pf select[name=cropId] + .dd-field'); await pg.waitForTimeout(200);
  console.log('crop list:', await pg.evaluate(() => { const heads = [...document.querySelectorAll('.dd-panel .dd-head')].map(h => h.textContent); const items = [...document.querySelectorAll('.dd-panel .dd-item')].length; return heads.join(' / ') + ` · ${items} crops`; }));
  await pg.keyboard.press('Escape');
  // the sowing calendar: your crops, or all
  await pg.goto(U + '#/sow'); await pg.waitForTimeout(300);
  const rows = () => pg.$$eval('.sowrow:not(.head)', x => x.length);
  console.log('sowing calendar:', await rows(), 'crops (of', await pg.evaluate(() => allCrops().length) + ') ·', await pg.textContent('.sowtable + p.hint, p.hint.center').catch(() => ''));
  await pg.click('text=Show all crops'); await pg.waitForTimeout(300); console.log('  show all:', await rows());
  // Tools → My crops
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
  console.log('Tools has My crops:', !!(await pg.$('a.tile[href="#/mycrops"]')));
  await pg.goto(U + '#/mycrops'); await pg.waitForTimeout(300); console.log('my crops page:', await pg.textContent('#pickN'));
  // an existing garden: no welcome
  await pg.goto(U); await pg.waitForTimeout(400); console.log('existing garden opens on:', await pg.evaluate(() => location.hash || '(home)'));
  console.log('errs', errs); await b.close();
})();
