const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const d of ['Pixel 7', 'iPhone 14']) {
    const pg = await (await newContext(b, devices[d])).newPage(); pg.on('pageerror', e => errs.push(d + ': ' + e.message));
    await pg.goto('http://localhost:8765/#/settings'); await pg.waitForTimeout(600);
    console.log(d, await pg.textContent('#persist'), await pg.textContent('.hint.center'));
  }
  console.log('errs', errs); await b.close();
})();
