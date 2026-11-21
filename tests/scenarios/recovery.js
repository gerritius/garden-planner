// Data safety: when the saved garden can't be loaded, the recovery screen takes over and nothing is saved over it; you
// can keep a copy, go back to an earlier one, or carry on without saving. A restore can be undone, and an older format
// is kept before it's brought up to date.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const U = 'http://localhost:8765/';
const FIX = path.join(__dirname, '..', 'fixtures', 'backups', 'backup-v1.25.2.json');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async (ctxOpts = {}) => {
    const ctx = await newContext(b, ctxOpts); const pg = await ctx.newPage(); const said = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { said.push(d.message()); d.accept(); });
    return { ctx, pg, said };
  };
  const view = async pg => (await pg.textContent('#view')).replace(/\s+/g, ' ');
  const stored = pg => pg.evaluate(() => new Promise(res => { const r = indexedDB.open('garden-planner', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res(q.result); }; }));
  const putStored = (pg, v) => pg.evaluate(v => new Promise(res => { const r = indexedDB.open('garden-planner', 1); r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, 'state'); t.oncomplete = res; }; }), v);

  // 1. damaged data: recovery screen, nothing saved over it, a copy can be kept, a daily copy restored
  {
    const { ctx, pg, said } = await page();
    await pg.goto(U); await pg.waitForTimeout(400);
    await pg.evaluate(async () => { S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10 }); S.plantings.push({ id: 'p1', cropId: 'garlic', containerId: 'b1', from: 0, to: 100, layout: 'rows', rowSp: 20, plantSp: 15, method: 'seedling', sowDate: '2026-10-10', status: 'growing' }); await save(); await snapshotDaily(); });
    await putStored(pg, { containers: 'oops', plantings: [] });
    await pg.reload(); await pg.waitForTimeout(600);
    console.log('damaged:', await pg.textContent('#title'), '|', (await view(pg)).match(/Your saved garden couldn’t be loaded:[^.]*\./)[0]);
    await pg.goto(U + '#/cal'); await pg.waitForTimeout(300); await pg.goto(U + '#/settings'); await pg.waitForTimeout(300);
    console.log('other pages still show recovery:', await pg.textContent('#title') === 'Recovery', '| stored data untouched:', JSON.stringify(await stored(pg)));
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act=rcKeep]')]);
    const kept = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    console.log('copy saved:', dl.suggestedFilename().replace(/\d{4}-\d{2}-\d{2}/, 'DATE'), '| it holds the stored data:', JSON.stringify(kept.state));
    console.log('earlier copies offered:', (await pg.$$eval('#rcCopies li', x => x.map(li => li.querySelector('.grow').firstChild.textContent.trim()))).join(' | '));
    await pg.click('[data-act=rcSnap]'); await pg.waitForTimeout(300);
    if (await pg.isVisible('#modal [data-x=ok]')) await pg.click('#modal [data-x=ok]');
    await pg.waitForTimeout(1500);
    console.log('after restoring the daily copy:', said.slice(-1)[0], '|', await pg.textContent('#title'), '|', await pg.evaluate(() => `${S.containers.length} bed, ${S.plantings.length} planting, data version ${S.dataVersion}`));
    console.log('the damaged data was kept:', await pg.evaluate(async () => { for (const k of await DB.kvKeys()) if (/^state\.kept\./.test(k)) return JSON.stringify(await DB.get(k)); return 'no'; }));
    await ctx.close();
  }
  // 2. saved by a newer version of the app
  {
    const { ctx, pg } = await page();
    await pg.goto(U); await pg.waitForTimeout(300); await putStored(pg, { containers: [], plantings: [], tasks: [], dataVersion: 99 }); await pg.reload(); await pg.waitForTimeout(500);
    console.log('newer format:', (await view(pg)).match(/saved by a newer version[^—]*— reload to get the newest version/)[0]);
    await ctx.close();
  }
  // 3. storage that can't be opened: carry on without saving
  {
    const { ctx, pg } = await page();
    await ctx.addInitScript(() => { const open = indexedDB.open.bind(indexedDB); indexedDB.open = () => { const r = { result: null, error: new Error('blocked by the browser') }; setTimeout(() => r.onerror && r.onerror(), 0); void open; return r; }; });
    await pg.goto(U); await pg.waitForTimeout(600);
    console.log('no storage:', await pg.textContent('#title'), '|', (await view(pg)).match(/couldn’t open its storage[^)]*\)/)[0], '| offers:', (await pg.$$eval('#view section h3', x => x.map(h => h.textContent))).join(' · '));
    await pg.click('[data-act=rcNoSave]'); await pg.waitForTimeout(500);
    console.log('without saving:', await pg.textContent('#title'), '|', (await pg.textContent('.banner.warn')).trim());
    await ctx.close();
  }
  // 4. an old format is brought up to date at start, keeping the old one; a restore can be undone
  {
    const { ctx, pg, said } = await page();
    await pg.goto(U); await pg.waitForTimeout(300);
    const old = JSON.parse(fs.readFileSync(FIX, 'utf8')).state;
    await putStored(pg, old); await pg.reload(); await pg.waitForTimeout(800);
    console.log('old format at start:', await pg.evaluate(async () => `data version ${S.dataVersion}, ${S.plantings.length} plantings | old one kept: ${!!(await DB.get('state.v1'))}`), '| stored now:', (await stored(pg)).dataVersion);
    await pg.evaluate(async () => { S.containers[0].name = 'Renamed before the restore'; await save(); });
    await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
    await pg.setInputFiles('#impf', FIX); await pg.waitForTimeout(300); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(1200);
    console.log('restored:', said.slice(-1)[0], '|', await pg.evaluate(() => S.containers[0].name));
    await pg.goto(U + '#/settings'); await pg.waitForTimeout(800);
    await pg.click('[data-act=undoRestore]'); await pg.waitForTimeout(300); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(1000);
    console.log('undone:', said.slice(-1)[0], '|', await pg.evaluate(() => S.containers[0].name));
    await ctx.close();
  }
  console.log('errs', errs); await b.close();
})();
