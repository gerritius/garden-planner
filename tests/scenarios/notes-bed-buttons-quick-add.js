const { newContext } = require('../lib');
// unified note, bed buttons, quick add
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'hk', containerId: 'b1', cropId: 'hakusai', method: 'seed', layout: 'staggered', from: 0, to: 100, rowSp: 60, plantSp: 45, thinSp: 45, sowDate: '2026-09-05', status: 'active', photos: {}, series: [], harvests: [] });
    syncTasks(S.plantings[0]); await save();
  });
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(400);
  console.log('carebar:', (await pg.textContent('.carebar')).replace(/\s+/g, ' ').trim());
  await pg.locator('.carebar').screenshot({ path: `${SP}/carebar.png` });
  // bed note with photo
  await pg.click('[data-act=bedNote]'); await pg.waitForTimeout(200);
  await pg.setInputFiles('#neph input', require('path').join(__dirname, '..', 'fixtures', 'photo.png')); await pg.waitForTimeout(400);
  await pg.fill('#nef [name=note]', 'Added compost'); await pg.locator('#modal .sheet').screenshot({ path: `${SP}/note_dlg.png` });
  await pg.click('#nef button.primary'); await pg.waitForTimeout(400);
  console.log('bed log:', JSON.stringify(await pg.evaluate(() => container('b1').log.map(x => [x.text, !!x.photo]))));
  // More menu
  await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(200);
  console.log('more menu:', (await pg.textContent('#modal .tiles')).replace(/\s+/g, ' ').trim());
  await pg.click('[data-m=reading]'); await pg.waitForTimeout(200); console.log('reading dialog:', await pg.textContent('#modal h3'));
  await pg.goBack(); await pg.waitForTimeout(300);
  console.log('after Back modal open?', await pg.evaluate(() => !document.querySelector('#modal').hidden), pg.url().split('#')[1]);
  await pg.click('[data-act=bedMore]'); await pg.waitForTimeout(200); await pg.click('[data-m=rotation]'); await pg.waitForTimeout(300);
  console.log('rotation link →', pg.url().split('#')[1], 'modal open?', await pg.evaluate(() => !document.querySelector('#modal').hidden));
  // crop note
  await pg.goto(U + '#/plant/hk'); await pg.waitForTimeout(300);
  await pg.click('[data-act=diaryNote]'); await pg.waitForTimeout(200); await pg.fill('#nef [name=note]', 'first true leaves'); await pg.click('#nef button.primary'); await pg.waitForTimeout(300);
  console.log('crop diary:', JSON.stringify(await pg.evaluate(() => planting('hk').diary.map(x => [x.note, x.photo]))));
  // quick add
  await pg.evaluate(() => quickAdd()); await pg.waitForTimeout(200);
  console.log('quick add:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').trim());
  await pg.locator('#modal .sheet').screenshot({ path: `${SP}/qa.png` });
  await pg.click('[data-q=more]'); await pg.waitForTimeout(200); console.log('more:', (await pg.textContent('#modal .tiles')).replace(/\s+/g, ' ').trim());
  await pg.click('[data-q=seedlings]'); await pg.waitForTimeout(300); console.log('→', pg.url().split('#')[1]);
  await pg.evaluate(() => quickAdd()); await pg.waitForTimeout(200); await pg.click('[data-q=note]'); await pg.waitForTimeout(200);
  await pg.click('#modal [data-c=b1]'); await pg.waitForTimeout(200); console.log('note for bed dialog:', await pg.textContent('#modal .muted.small'));
  await pg.click('#nef [data-x=no]'); await pg.waitForTimeout(200);
  // log dialog: no Other for new entries
  await pg.evaluate(() => logDialog()); await pg.waitForTimeout(200);
  console.log('log kinds:', await pg.$$eval('#lf input[name=kind]', x => x.map(i => i.value).join(',')));
  console.log('errs', errs); await b.close();
})();
