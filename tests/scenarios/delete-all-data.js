// Tools → Delete all my data: first a reminder to back up (with the last backup date, or "never"), then the Delete
// button only works once DELETE is typed. Cancelling keeps everything; deleting wipes the garden, its daily copies, the
// photos and this site's settings on this phone, and the app starts again as new.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], covers: [] }];
    S.plantings = [{ id: 'p1', cropId: 'spinach', containerId: 'b1', from: 0, to: 100, method: 'seed', sowDate: '2026-11-08', status: 'active', photos: {}, series: [], harvests: [] }];
    S.lastBackup = null; await save();
    await DB.putPhoto('ph1', new Blob(['x'], { type: 'image/jpeg' })); await DB.set('snap:2026-11-17', { containers: [] });
    localStorage.setItem(lsKey('seenVersion'), '1.0.0'); localStorage.setItem('someone-else', 'keep');
  });
  const store = () => pg.evaluate(async () => `kv ${(await DB.kvKeys()).length} · photos ${(await DB.photoKeys()).length} · gp keys ${Object.keys(localStorage).filter(k => k.startsWith(lsKey(''))).length} · other keys ${Object.keys(localStorage).filter(k => !k.startsWith('gp.')).join(',')}`);
  const open = async () => { await pg.goto(U + '#/settings'); await pg.waitForTimeout(300); await pg.evaluate(() => { document.querySelector('details.erase').open = true; }); await pg.click('[data-act=eraseAll]'); await pg.waitForTimeout(200); };
  const sheet = async () => (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').trim();
  console.log('before:', await store());
  // cancel at step 1
  await open(); console.log('step 1 (never backed up):', await sheet());
  await pg.click('#modal [data-x=no]'); await pg.waitForTimeout(200); console.log('  cancelled:', await store());
  // with a backup date; cancel at step 2
  await pg.evaluate(async () => { S.lastBackup = '2026-11-20'; await save(); });
  await open(); console.log('step 1 (backed up):', await sheet());
  await pg.click('#modal [data-x=next]'); await pg.waitForTimeout(300);
  console.log('step 2:', await sheet());
  const ok = () => pg.evaluate(() => !document.querySelector('#modal [data-x=ok]').disabled);
  console.log('  enabled — empty', await ok());
  await pg.fill('#eraseWord', 'dele'); console.log('  "dele"', await ok());
  await pg.fill('#eraseWord', 'delete'); console.log('  "delete"', await ok());
  await pg.click('#modal [data-x=no]'); await pg.waitForTimeout(200); console.log('  cancelled:', await store(), '| plantings', await pg.evaluate(() => S.plantings.length));
  // delete
  await open(); await pg.click('#modal [data-x=next]'); await pg.waitForTimeout(300);
  await pg.fill('#eraseWord', 'DELETE'); await pg.click('#modal [data-x=ok]');
  await pg.waitForLoadState('load'); await pg.waitForTimeout(800);
  console.log('deleted:', await store(), '| beds', await pg.evaluate(() => S.containers.length), '| plantings', await pg.evaluate(() => S.plantings.length), '| page', await pg.evaluate(() => location.hash));
  console.log('errs', errs); await b.close();
})();
