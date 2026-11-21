// New versions: after an update the app says what's new (once); when a newer version is out it says so, with its notes.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const U = 'http://localhost:8765/';
const REL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'releases.json'), 'utf8'));
const shown = pg => pg.evaluate(() => { const n = document.querySelector('#notice'); return n.hidden ? '(none)' : n.textContent.replace('✕', '').replace(/\s+/g, ' ').trim(); });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async (seen, garden, releases) => {
    const ctx = await newContext(b); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    if (releases) await ctx.route(u => u.pathname.endsWith('/releases.json'), r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(releases) }));
    await pg.goto(U); await pg.waitForTimeout(300);
    await pg.evaluate(async ([seen, garden]) => {
      if (seen) localStorage.setItem('gp.seenVersion', seen); else localStorage.removeItem('gp.seenVersion');
      if (garden) { S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10 }); S.plantings.push({ id: 'p1', cropId: 'garlic', containerId: 'b1', from: 0, to: 100, layout: 'rows', rowSp: 20, plantSp: 15, method: 'seedling', sowDate: '2026-10-10', status: 'growing' }); await save(); }
    }, [seen, garden]);
    await pg.reload(); await pg.waitForTimeout(800);
    return { ctx, pg };
  };
  const v = REL[0].version, prev = REL[1].version;
  { // updated from the version before
    const { ctx, pg } = await open(prev, true);
    console.log('updated from the previous version:', (await shown(pg)).replace(v, 'NEW'));
    await pg.click('#notice [data-n=notes]'); await pg.waitForTimeout(200);
    console.log('  what’s new lists:', (await pg.$$eval('#modal .relnotes h4', x => x.map(h => h.firstChild.textContent.trim()))).map(x => x === v ? 'this version' : x).join(', '), '| notes:', await pg.$$eval('#modal .relnotes li', x => x.length) === REL[0].notes.length);
    await pg.click('#modal [data-x=no]'); await pg.waitForTimeout(400);   // closing a pop-up steps back in history: let that finish
    await pg.reload(); await pg.waitForTimeout(800);
    console.log('  next time:', await shown(pg));
    await ctx.close();
  }
  { const { ctx, pg } = await open(null, false); console.log('a new install:', await shown(pg)); await ctx.close(); }
  { const { ctx, pg } = await open(null, true); console.log('a garden from before these notes:', (await shown(pg)).replace(v, 'NEW')); await ctx.close(); }
  { // a newer version is out
    const next = { version: '99.0.0', date: '2099-01-01', notes: ['Something new', 'Something else'] };
    const { ctx, pg } = await open(v, true, [next, ...REL]);
    await pg.waitForTimeout(4000);
    console.log('a newer version out:', await shown(pg));
    await pg.click('#notice [data-n=notes]'); await pg.waitForTimeout(200);
    console.log('  its notes:', await pg.$$eval('#modal .relnotes li', x => x.map(li => li.textContent).join(' / ')));
    await ctx.close();
  }
  { // Tools → What's new
    const { ctx, pg } = await open(v, true);
    await pg.goto(U + '#/settings'); await pg.waitForTimeout(300); await pg.click('[data-act=relNotes]'); await pg.waitForTimeout(200);
    console.log('Tools → What’s new lists every release:', await pg.$$eval('#modal .relnotes h4', x => x.length) === REL.length);
    await ctx.close();
  }
  console.log('errs', errs); await b.close();
})();
