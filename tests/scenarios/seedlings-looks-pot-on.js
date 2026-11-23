// Seedlings in a 49-cell tray: looks at how many cells are up (as for seeds in a bed), then some potted on into 9 cm pots
// as their own group, a couple planted out into a grow bag, one thrown away — each kept track of separately.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Grow bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.starts = [{ id: 'st', status: 'growing', created: '2026-11-04T09:00:00Z', events: [], cropId: 'hakusai', variety: '', kind: 'tray', tray: 1, count: 20, seeds: 2, sowDate: '2026-11-04', kept: 'out' }];
    syncStartTasks(start('st')); await save();
  });
  const st = () => pg.evaluate(() => { const s = start('st'); return JSON.stringify({ up: s.upOn, germ: s.germ && [s.germ.result, s.germ.pct, s.germ.over], left: startLeft(s), ready: startReady(s), jobs: S.tasks.filter(t => t.startId === 'st' && !t.done).map(t => [t.kind, t.due, t.title]) }); });
  console.log('sown 4 Nov:', await st());
  const look = async (how, date, pick) => {
    await pg.goto(U + '#/'); await pg.waitForTimeout(300);
    const id = await pg.evaluate(() => S.tasks.find(t => t.startId === 'st' && t.kind === 'sgerm' && !t.done).id);
    await pg.evaluate(id => toggleTask(id, true), id); await pg.waitForTimeout(300);
    console.log('  asks:', (await pg.textContent('#gcf')).replace(/\s+/g, ' ').slice(0, 220));
    if (how.cells != null) await pg.fill('#gcf input[name=cnt]', String(how.cells)); else await pg.click(`#gcf [data-pct="${how.pct}"]`);
    await pg.fill('#gcf input[name=date]', date); await pg.click('#gcf button.primary'); await pg.waitForTimeout(700);
    console.log('  then:', (await pg.textContent('#modal .sheet').catch(() => '')).replace(/\s+/g, ' ').slice(0, 260));
    if (pick) { await pg.click(`#modal [data-r=${pick}]`); await pg.waitForTimeout(400); }
    console.log('  →', await st());
  };
  console.log('look 11 Nov: none'); await look({ pct: 0 }, '2026-11-11', 'keep');
  console.log('look 14 Nov: 9 of 20 cells'); await look({ cells: 9 }, '2026-11-14', 'keep');
  console.log('look 18 Nov: 17 of 20 cells'); await look({ cells: 17 }, '2026-11-18');
  // pot on 5 into 9 cm pots
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  await pg.click('[data-act=potOn]'); await pg.waitForTimeout(200);
  await pg.fill('#ptf input[name=n]', '5'); await pg.click('#ptf button.primary'); await pg.waitForTimeout(400);
  // 2 into the grow bag
  await pg.click('[data-act=plantOut][data-id=st]'); await pg.waitForTimeout(200);
  console.log('plant out says:', await pg.textContent('#modal .hint'));
  await pg.fill('#pof input[name=n]', '2'); await pg.click('#modal [data-c=g1]'); await pg.waitForTimeout(600);
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  if (await pg.$('#modal [data-x=ok]')) { await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(400); }
  // 1 thrown away
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  await pg.click('[data-act=binStart][data-id=st]'); await pg.waitForTimeout(200);
  await pg.fill('#dsf input[name=n]', '1'); await pg.click('#dsf label.chip:nth-of-type(2)'); await pg.click('#dsf button.danger'); await pg.waitForTimeout(400);
  console.log('groups:', JSON.stringify(await pg.evaluate(() => S.starts.map(s => [s.kind, s.count, startLeft(s), s.status, s.upOn, s.from || '', (s.events || []).map(e => e.type + ' ' + e.n)]))));
  console.log('grow bag:', JSON.stringify(await pg.evaluate(() => S.plantings.map(p => [p.cropId, p.containerId, p.startId, p.method, p.seededOn]))));
  console.log('page:', (await pg.$$eval('li.start', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' || '));
  console.log('log:', JSON.stringify(await pg.evaluate(() => startLogItems().sort((a, b) => a.date < b.date ? -1 : 1).map(x => [x.date, x.title, x.sub]))));
  // tray drawing still adds up: 20 − 5 potted − 2 planted − 1 thrown = 12 cells
  console.log('tray 1 free cells:', await pg.evaluate(() => trayFree(1)));
  console.log('errs', errs); await b.close();
})();
