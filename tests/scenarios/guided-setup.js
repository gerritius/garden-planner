// The guided setup: from the first-run steps, a card on each page walks a new gardener through their first bed and crop,
// moving on by itself as each step is done — raising seedlings in a tray first, or planting straight in — and ends with
// what the app does for them. It can be skipped, and restarted from Tools.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { welcome: true });
  await ctx.route('**/open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const tour = async () => pg.evaluate(() => { const t = document.querySelector('.tour'); return t ? `${t.querySelector('.tour-n').textContent} — ${t.querySelector('h3').textContent} | buttons: ${[...t.querySelectorAll('.btnrow .btn')].map(x => x.textContent.trim()).join(' / ')}` : '(no guide)'; });
  await pg.goto(U + '#/welcome?s=4'); await pg.waitForTimeout(500);
  console.log('first-run step 4:', await pg.$$eval('.welcome .btncol .btn', x => x.map(e => e.textContent.trim()).join(' / ')));
  await pg.click('[data-act=wlGuide]'); await pg.waitForTimeout(500);
  console.log('1 (bed form):', await tour());
  await pg.screenshot({ path: SP + '/tour1.png' });
  // draw a bed through the form
  await pg.fill('#cf [name=name]', 'Back bed').catch(() => {}); await pg.evaluate(async () => { S.containers.push({ id: 'b1', type: 'bed', name: 'Back bed', width: 100, length: 200, margin: 10, history: [] }); await save(); });
  await pg.goto(U + '#/'); await pg.waitForTimeout(400);
  console.log('2 (home):', await tour());
  await pg.screenshot({ path: SP + '/tour2.png' });
  // path A: seedlings
  await pg.click('[data-act=tourPath][data-v=tray]'); await pg.waitForTimeout(300);
  console.log('3 tray:', await tour());
  await pg.click('[data-act=tourSow]'); await pg.waitForTimeout(500);
  console.log('   opens:', await pg.evaluate(() => location.hash + ' ' + (document.querySelector('#modal:not([hidden]) h3') || {}).textContent));
  await pg.evaluate(() => { const s = document.querySelector('#sdf [name=cropId]'); s.value = 'tomato'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.fill('#sdf [name=count]', '6'); await pg.click('#sdf button.primary'); await pg.waitForTimeout(500);
  console.log('4 grow:', await tour());
  await pg.screenshot({ path: SP + '/tour4.png' });
  await pg.click('[data-act=tourOut]'); await pg.waitForTimeout(300);
  await pg.click('#modal [data-c=b1]'); await pg.waitForTimeout(600);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  await pg.goto(U + '#/'); await pg.waitForTimeout(400);
  console.log('done:', await tour());
  await pg.click('[data-act=tourDone]'); await pg.waitForTimeout(300);
  console.log('after Finish:', await tour());
  // path B, restarted from Tools: an existing garden's plantings don't count
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(300); await pg.click('[data-act=tourStart]'); await pg.waitForTimeout(400);
  console.log('restarted:', await tour());
  await pg.click('[data-act=tourPath][data-v=direct]'); await pg.waitForTimeout(300);
  console.log('3 direct:', await tour());
  await pg.click('.tour .btn.primary'); await pg.waitForTimeout(600);
  console.log('3 (planting form):', await tour());
  await pg.evaluate(() => { const s = document.querySelector('#pf [name=cropId]'); s.value = 'carrot'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await pg.waitForTimeout(400);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  if (await pg.isVisible('#modal [data-x=ok]').catch(() => false)) { await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(400); }   // (the bed's full of tomatoes: plant here anyway)
  await pg.goto(U + '#/'); await pg.waitForTimeout(400);
  console.log('done:', await tour(), '| carrots planted', await pg.evaluate(() => S.plantings.some(p => p.cropId === 'carrot')));
  // skip
  await pg.click('[data-act=tourOff]'); await pg.waitForTimeout(300);
  console.log('skipped:', await tour());
  console.log('errs', errs); await b.close();
})();
