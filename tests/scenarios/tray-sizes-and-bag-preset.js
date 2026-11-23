// Your trays and pots: change the size of the usual tray, add another tray size and a pot size, and start seedlings in
// a new tray of the new size — both trays then work side by side. (And the grow-bag preset still fills in.)
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => { S.starts = []; delete S.nursery; await save(); });
  const sizes = () => pg.evaluate(() => nurseryTypes().map(t => t.name + (t.kind === 'tray' ? ` (${t.cols} across)` : '')).join(', '));
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(400);
  console.log('before:', (await pg.textContent('#view')).match(/Your trays & pots: [^.]*\./)[0]);
  await pg.click('[data-act=nursery]'); await pg.waitForTimeout(200);
  // change the usual tray to 72 cells, 12 across
  await pg.click('#modal [data-ed=nt_tray]'); await pg.waitForTimeout(100);
  await pg.fill('#nuf [name=cells]', '72'); await pg.fill('#nuf [name=cols]', '12'); await pg.click('#nuf button.primary'); await pg.waitForTimeout(300);
  // add a 9-cell tray and 12 cm pots
  await pg.fill('#nuf [name=cells]', '9'); await pg.fill('#nuf [name=cols]', '3'); await pg.click('#nuf button.primary'); await pg.waitForTimeout(300);
  await pg.click('#nuf [data-k=pot]'); await pg.fill('#nuf [name=cm]', '12'); await pg.click('#nuf button.primary'); await pg.waitForTimeout(300);
  console.log('sizes:', await sizes(), '| listed:', (await pg.$$eval('#modal .plist li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
  await pg.click('#modal [data-x=no]'); await pg.waitForTimeout(300);
  // lettuce in a new 72-cell tray, then komatsuna in a new 9-cell tray
  for (const [cropId, n, kind] of [['lettuce', 30, '72'], ['komatsuna', 9, '9']]) {
    await pg.evaluate(() => startDialog()); await pg.waitForTimeout(200);
    await pg.selectOption('#sdf select[name=cropId]', cropId);
    const v = await pg.$eval('#sdf select[name=where]', (s, k) => [...s.options].find(o => o.textContent.startsWith(`A new ${k}-cell`)).value, kind);
    await pg.selectOption('#sdf select[name=where]', v); await pg.fill('#sdf input[name=count]', String(n)); await pg.click('#sdf button.primary'); await pg.waitForTimeout(300);
  }
  console.log('trays:', (await pg.$$eval('#view section h3', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | '), '| free:', await pg.evaluate(() => [trayFree(1), trayFree(2)]));
  console.log('cells drawn:', await pg.$$eval('svg.tray', x => x.map(s => s.querySelectorAll('rect').length - 1).join(', ')));
  // a size that's in use can't be removed
  await pg.click('[data-act=nursery]'); await pg.waitForTimeout(200);
  console.log('removable:', await pg.$$eval('#modal [data-rm]', x => x.map(b => b.closest('li').querySelector('b').textContent).join(', ') || 'none'));
  await pg.click('#modal [data-x=no]');
  await pg.goto(U + '#/container/new'); await pg.waitForTimeout(300); await pg.click('[data-act=preset]'); await pg.waitForTimeout(200);
  console.log('preset count:', await pg.inputValue('[name=count]').catch(() => '?'));
  console.log('errs', errs); await b.close();
})();
