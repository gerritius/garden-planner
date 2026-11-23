// Seedlings in a 49-cell tray: looks at how many cells are up (as for seeds in a bed), then replanted a few at a time —
// some into 9 cm pots, some into a new 9-cell tray (a size added there and then), two into a grow bag where snap peas
// are already growing — and one thrown away, each kept track of separately.
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
    S.plantings.push({ id: 'sn', containerId: 'g1', cropId: 'snappea', method: 'seed', layout: 'center', from: 0, to: 40, sowDate: '2026-10-20', status: 'active', photos: {}, series: [], harvests: [] });
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
  const replant = async n => { await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300); await pg.click('[data-act=replant][data-id=st]'); await pg.waitForTimeout(200); await pg.fill('#pof input[name=n]', String(n)); };
  // 5 into 9 cm pots
  await replant(5);
  console.log('replant offers:', (await pg.$$eval('#modal .pick a', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
  await pg.click('#modal [data-nt="p:nt_pot"]'); await pg.waitForTimeout(400);
  // 3 into a new 9-cell tray, a size typed in there and then
  await replant(3); await pg.click('#modal [data-nt=add]'); await pg.waitForTimeout(100);
  await pg.fill('#pon input[name=ncells]', '9'); await pg.fill('#pon input[name=ncols]', '3'); await pg.click('#pon button.primary'); await pg.waitForTimeout(400);
  // 2 into the grow bag where snap peas grow: planting out goes where you say
  await replant(2); await pg.click('#modal [data-c=g1]'); await pg.waitForTimeout(600);
  console.log('form banner:', await pg.textContent('#view .banner'), '| layout:', await pg.evaluate(() => draft.layout + ' ' + (draft.positions || []).length));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  console.log('after saving:', await pg.evaluate(() => location.hash.replace(/plant\/.+/, 'plant/…')), '| asked:', await pg.evaluate(() => !document.querySelector('#modal').hidden && document.querySelector('#modal').textContent.slice(0, 100)));
  // 1 thrown away
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  await pg.click('[data-act=binStart][data-id=st]'); await pg.waitForTimeout(200);
  await pg.fill('#dsf input[name=n]', '1'); await pg.click('#dsf label.chip:nth-of-type(2)'); await pg.click('#dsf button.danger'); await pg.waitForTimeout(400);
  console.log('groups:', JSON.stringify(await pg.evaluate(() => S.starts.map(s => [s.kind, s.count, startLeft(s), s.status, s.upOn, s.from || '', (s.events || []).map(e => e.type + ' ' + e.n)]))));
  console.log('grow bag:', JSON.stringify(await pg.evaluate(() => S.plantings.map(p => [p.cropId, p.containerId, p.startId || '', p.method, p.from + '–' + p.to, p.layout, (p.positions || []).length, p.raisedName || '']))));
  console.log('tray & pot sizes:', JSON.stringify(await pg.evaluate(() => nurseryTypes().map(t => t.name))));
  console.log('page:', (await pg.$$eval('li.start', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' || '));
  console.log('log:', JSON.stringify(await pg.evaluate(() => startLogItems().sort((a, b) => a.date < b.date ? -1 : 1).map(x => [x.date, x.title, x.sub]))));
  // the trays still add up: tray 1 has 20 − 5 − 3 − 2 − 1 = 9 cells used; tray 2 (9 cells) has 3
  console.log('free cells:', await pg.evaluate(() => [trayFree(1), trayFree(2)]));
  // starting more: every tray on the go, a new tray of each size, each pot size — or a size you don't have yet
  await pg.evaluate(() => startDialog()); await pg.waitForTimeout(200);
  console.log('start in:', await pg.$$eval('#sdf select[name=where] option', x => x.map(o => o.textContent).join(' | ')));
  console.log('errs', errs); await b.close();
})();
