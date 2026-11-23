// Products & seeds → Seeds & plants: add a variety with its seed packet (front/back photos); adding a variety of a
// crop the app doesn't know makes the crop. Choosing that variety when planting brings the packet with it; a new
// variety typed into a planting joins the library; deleting from the library keeps photos plantings still use.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const path = require('path');
const U = 'http://localhost:8765/', PHOTO = path.join(__dirname, '..', 'fixtures', 'photo.png');
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }); await save(); });
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
  console.log('Tools tile:', await pg.$eval('a.tile[href="#/products"]', a => a.textContent), '| crops section gone from Tools:', !(await pg.textContent('#view')).includes('Custom crops'));
  await pg.goto(U + '#/products?t=seeds'); await pg.waitForTimeout(300);
  console.log('tab:', await pg.$eval('.ptabs .on', x => x.textContent), '|', (await pg.textContent('#view .hint')).slice(0, 80));
  // a variety of a crop the app knows, with the packet front
  await pg.click('[data-act=addSeed]'); await pg.waitForTimeout(200);
  await pg.selectOption('#sdf [name=cropId]', 'cabbage'); await pg.waitForTimeout(200);
  await pg.fill('#sdf [name=variety]', 'Shikidori'); await pg.fill('#sdf [name=maker]', 'Takii');
  await pg.setInputFiles('#sdf input[data-slot=front]', PHOTO); await pg.waitForTimeout(500);
  await pg.click('#sdf button.primary'); await pg.waitForTimeout(400);
  // a variety of a crop the app doesn't know: the crop is made too
  await pg.click('[data-act=addSeed]'); await pg.waitForTimeout(200);
  await pg.selectOption('#sdf [name=cropId]', '__new'); await pg.waitForTimeout(200);
  await pg.fill('#sdf [name=cen]', 'Okahijiki'); await pg.fill('#sdf [name=cja]', 'おかひじき'); await pg.selectOption('#sdf [name=like]', 'spinach'); await pg.fill('#sdf [name=cdays]', '40'); await pg.fill('#sdf [name=variety]', 'Midori');
  await pg.click('#sdf button.primary'); await pg.waitForTimeout(400);
  console.log('library:', await pg.evaluate(() => S.seeds.map(s => `${crop(s.cropId).en} · ${s.variety} · ${s.maker || '-'} · packet ${!!s.front}`).join(' | ')));
  console.log('new crop:', await pg.evaluate(() => { const c = S.customCrops.find(x => x.en === 'Okahijiki'); return c && `${c.en} ${c.ja} ${c.daysHarvest} days, in the crop list: ${allCrops().some(x => x.id === c.id)}`; }));
  console.log('listed:', (await pg.$$eval('#view section h3', x => x.map(h => h.textContent.trim()))).join(' | '), '| rows', await pg.$$eval('#view [data-act=editSeed]', x => x.length));
  // planting: choosing the variety brings its packet
  await pg.goto(U + '#/plant/new/b1?from=0&to=100'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const s = document.querySelector('#pf [name=cropId]'); s.value = 'cabbage'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await pg.waitForTimeout(300);
  console.log('varieties offered:', await pg.$$eval('#vars option', x => x.map(o => o.value).includes('Shikidori')));
  await pg.fill('#pf [name=variety]', 'Shikidori'); await pg.dispatchEvent('#pf [name=variety]', 'change'); await pg.waitForTimeout(400);
  console.log('packet came with it:', await pg.$$eval('.phslot img[data-photo]', x => x.length));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('planting uses the same photo:', await pg.evaluate(() => { const p = S.plantings[0], s = seedFor('cabbage', 'Shikidori'); return !!p.photos.front && p.photos.front === s.front; }));
  // a new variety typed into a planting joins the library
  await pg.goto(U + '#/plant/new/b1?from=100&to=200'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const s = document.querySelector('#pf [name=cropId]'); s.value = 'lettuce'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await pg.waitForTimeout(300);
  await pg.fill('#pf [name=variety]', 'Red Rookie'); await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('typed variety in the library:', await pg.evaluate(() => !!seedFor('lettuce', 'Red Rookie')));
  // deleting from the library: the planting keeps its photo
  await pg.goto(U + '#/products?t=seeds'); await pg.waitForTimeout(300);
  await pg.click('[data-act=editSeed]:has-text("Shikidori")'); await pg.waitForTimeout(200);
  await pg.click('#sdf [data-x=del]'); await pg.waitForTimeout(200);
  console.log('asks:', (await pg.textContent('#modal .msg')).replace(/\s+/g, ' '));
  await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(400);
  console.log('gone from the library:', await pg.evaluate(() => !seedFor('cabbage', 'Shikidori')), '| photo still stored for the planting:', await pg.evaluate(async () => !!(await DB.getPhoto(S.plantings[0].photos.front))));
  console.log('errs', errs); await b.close();
})();
