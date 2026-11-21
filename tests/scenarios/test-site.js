// The test site (…/test/) shares the web address with the real site but nothing else: its own garden, offline copy and
// settings, no Google Drive backup — and it can start from a copy of the real garden without changing it.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/', T = U + 'test/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  // the real site with a garden
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10 }); S.plantings.push({ id: 'p1', cropId: 'garlic', containerId: 'b1', from: 0, to: 100, layout: 'rows', rowSp: 20, plantSp: 15, method: 'seedling', sowDate: '2026-10-10', status: 'growing' }); S.drive = { auto: false, clientId: 'x.apps.googleusercontent.com', connected: false }; await save(); });
  await pg.reload(); await pg.waitForTimeout(800);   // let the real site settle (its jobs etc.), then remember exactly what it has stored
  const storedMain = () => pg.evaluate(() => new Promise(res => { const r = indexedDB.open('garden-planner', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => { r.result.close(); res(JSON.stringify(q.result)); }; }; }));
  const mainBefore = await storedMain();
  // the test site
  await pg.goto(T); await pg.waitForTimeout(800);
  console.log('test site:', await pg.textContent('.sitebadge'), '|', await pg.title(), '| starts empty:', await pg.evaluate(() => S.plantings.length === 0), '| site', await pg.evaluate(() => SITE + ' / ' + DB_NAME));
  await pg.goto(T + '#/settings'); await pg.waitForTimeout(400);
  console.log('Drive on the test site:', (await pg.textContent('#view')).match(/Backing up to Google Drive is off on the test site[^.]*\./)[0]);
  await pg.click('[data-act=copyMain]'); await pg.waitForTimeout(300); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(1000);
  console.log('copied the real garden:', await pg.evaluate(() => `${S.containers.length} bed, ${S.plantings.length} planting, Drive settings dropped: ${!S.drive}`));
  await pg.evaluate(async () => { S.containers[0].name = 'Changed on the test site'; S.plantings.push({ id: 'p2', cropId: 'lettuce', containerId: 'b1', from: 100, to: 200, layout: 'rows', rowSp: 25, plantSp: 25, method: 'seedling', sowDate: '2026-11-01', status: 'growing' }); await save(); localStorage.setItem(lsKey('seenVersion'), 'x'); });
  console.log('the real site’s stored garden is exactly as before:', await storedMain() === mainBefore);
  // back to the real site
  await pg.goto(U); await pg.waitForTimeout(800);
  console.log('real site:', await pg.evaluate(() => `${S.containers[0].name}, ${S.plantings.length} planting`), '| no test badge:', !(await pg.$('.sitebadge')));
  console.log('settings kept apart:', await pg.evaluate(() => `${localStorage.getItem('gp.test.seenVersion')} / ${localStorage.getItem('gp.seenVersion') !== 'x'}`));
  console.log('databases:', await pg.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort().join(', ')));
  // each site has its own offline copy
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.goto(T); await pg.waitForTimeout(500); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.waitForTimeout(1500);
  console.log('offline copies:', await pg.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('garden-planner')).map(k => k.replace(/\d+\.\d+\.\d+$/, 'VERSION')).sort().join(', ')));
  console.log('errs', errs); await b.close();
})();
