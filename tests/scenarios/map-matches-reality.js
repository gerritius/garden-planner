// The map shows what's really in the ground: seedlings from two batches planted out together (8 + 2 pots of snap
// peas → 10 plants, both batches used); a plan with room for 10 that only got 8 shows 8 (the plan view still 10);
// harvesting whole plants takes them off the map (and deleting the harvest puts them back), picking pods doesn't;
// thinning asks how many are left, and can remember that; a fingertip near a small dot is enough to drag it.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
const shot = (pg, name) => pg.screenshot({ path: require('path').join(process.argv[2] || '.', name + '.png') });
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const bed = (id, name) => ({ id, type: 'bed', name, width: 100, length: 200, margin: 10, history: [] });
    S.containers.push(bed('ba', 'Bed A'), bed('bb', 'Bed B'), bed('bc', 'Bed C'));
    S.starts = [
      { id: 'p8', cropId: 'snappea', kind: 'pot', nid: 'nt_pot', count: 8, sowDate: '2026-10-20', kept: 'out', status: 'growing', events: [], created: '1', upOn: '2026-10-28' },
      { id: 'p2', cropId: 'snappea', kind: 'pot', nid: 'nt_pot', count: 2, sowDate: '2026-10-20', kept: 'out', status: 'growing', events: [], created: '2', upOn: '2026-10-28', from: 'p0', movedOn: '2026-11-05' },
      { id: 'q8', cropId: 'cabbage', kind: 'pot', nid: 'nt_pot', count: 8, sowDate: '2026-09-20', kept: 'out', status: 'growing', events: [], created: '3', upOn: '2026-09-27' },
    ];
    // a plan with room for 10 cabbages, taking the 8 seedlings
    S.plantings.push({ id: 'cab', containerId: 'bb', cropId: 'cabbage', method: 'seedling', layout: 'free', positions: [[25, 20], [50, 20], [75, 20], [25, 50], [50, 50], [75, 50], [25, 80], [50, 80], [75, 80], [50, 95]], from: 0, to: 100, rowSp: 40, plantSp: 25, sowDate: '2026-11-18', status: 'planned', planStart: 'q8', planN: 8, raise: 'pot', photos: {}, series: [], harvests: [] });
    // lettuce to harvest (whole heads), and carrots to thin
    S.plantings.push({ id: 'let', containerId: 'bc', cropId: 'lettuce', method: 'seedling', layout: 'rows', from: 0, to: 100, rowSp: 30, plantSp: 30, sowDate: '2026-09-20', harvestDate: '2026-11-10', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'car', containerId: 'bc', cropId: 'carrot', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 20, plantSp: 2, thinSp: 8, sowDate: '2026-10-10', thinDate: '2026-11-10', harvestDate: '2027-01-20', status: 'active', germ: { result: 'good', date: '2026-10-25' }, photos: {}, series: [], harvests: [] });
    await save();
  });
  const plantsDrawn = (pid, sel = '.plotwrap svg.plot') => pg.evaluate(([pid, sel]) => document.querySelector(sel).querySelectorAll(`[data-pid="${pid}"] circle.plant`).length, [pid, sel]);

  // ---- 1. two batches into one planting ----
  await pg.goto(U + '#/plant/new/ba?usestart=p8'); await pg.waitForTimeout(500);
  const form = () => pg.evaluate(() => `count=${document.querySelector('#pf').startCount.value} plants=${(draft.positions || []).length || Draw.count(container('ba'), draft)} · ${document.querySelector('.startcount small').textContent} · chips: ${[...document.querySelectorAll('[data-act=moreStart]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' / ')}`);
  console.log('one batch:', await form());
  await pg.click('[data-act=moreStart]'); await pg.waitForTimeout(300); await shot(pg, '1-two-batches');
  console.log('both batches:', await form());
  console.log('note:', await pg.evaluate(() => document.querySelector('#startNote').textContent.replace(/\s+/g, ' ').trim()));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  console.log('planted:', await pg.evaluate(() => { const p = S.plantings.find(x => x.containerId === 'ba'); return `${p.status}, ${Draw.count(container('ba'), p, true)} plants on the map · ` + ['p8', 'p2'].map(id => `${id}: ${start(id).events.map(e => e.type + ' ' + e.n).join(',')} left ${startLeft(start(id))} ${start(id).status}`).join(' · '); }));

  // ---- 2. a plan with room for 10 that got 8 ----
  await pg.evaluate(async () => { activatePlan(planting('cab'), '2026-11-18'); await save(); });
  await pg.goto(U + '#/container/bb'); await pg.waitForTimeout(500);
  console.log('cabbage: drawn', await plantsDrawn('cab'), '·', await pg.textContent('[data-act=mapView]'), '· seedlings left', await pg.evaluate(() => startLeft(start('q8')))); await shot(pg, '2-whats-there');
  await pg.click('[data-act=mapView]'); await pg.waitForTimeout(400);
  console.log('cabbage plan view: drawn', await plantsDrawn('cab'), '·', await pg.textContent('[data-act=mapView]'));
  await pg.click('[data-act=mapView]'); await pg.waitForTimeout(400);
  await pg.goto(U + '#/plant/cab'); await pg.waitForTimeout(400);
  console.log('crop page layout line:', await pg.evaluate(() => [...document.querySelectorAll('dl.details dt')].map(dt => dt.textContent === 'Layout' ? dt.nextElementSibling.textContent : null).filter(Boolean).join('')));

  // ---- 3. harvest: whole heads come off the map, and back if the harvest is deleted ----
  await pg.goto(U + '#/plant/let'); await pg.waitForTimeout(400);
  const before = await pg.evaluate(() => Draw.count(container('bc'), planting('let'), true));
  await pg.click('[data-act=logHarvest]'); await pg.waitForTimeout(300);
  await pg.fill('#hf input[name=count]', '3'); await pg.dispatchEvent('#hf input[name=count]', 'input'); await pg.waitForTimeout(100);
  console.log('harvest dialog: out', await pg.inputValue('#hf input[name=out]'), 'marked', await pg.$$eval('#hvmap circle.out', x => x.length));
  // change which: tap the first marked plant to keep it, then a fourth isn't added (2 out now)
  const first = await pg.$eval('#hvmap circle.out', c => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.click(first[0] + 5, first[1] + 3); await pg.waitForTimeout(200);
  console.log('after a tap: out', await pg.inputValue('#hf input[name=out]')); await shot(pg, '3-harvest');
  await pg.click('#hf button.primary'); await pg.waitForTimeout(500);
  console.log('lettuce:', before, '→', await pg.evaluate(() => `${Draw.count(container('bc'), planting('let'), true)} on the map (${Draw.count(container('bc'), planting('let'))} in the plan), harvest took ${planting('let').harvests[0].removed.length}`));
  await pg.evaluate(() => harvestDialog(planting('let'), planting('let').harvests[0])); await pg.waitForTimeout(300);
  console.log('edit says:', await pg.evaluate(() => document.querySelector('#hf .hint').textContent));
  await pg.click('#hf [data-x=del]'); await pg.click('.delask [data-k=yes]'); await pg.waitForTimeout(400);
  console.log('harvest deleted:', await pg.evaluate(() => `${Draw.count(container('bc'), planting('let'), true)} on the map, real kept: ${'real' in planting('let')}`));
  // snap peas: pods are picked, plants stay
  await pg.evaluate(() => harvestDialog(S.plantings.find(x => x.containerId === 'ba'))); await pg.waitForTimeout(300);
  await pg.fill('#hf input[name=count]', '20'); await pg.dispatchEvent('#hf input[name=count]', 'input');
  console.log('snap pea harvest: out', await pg.inputValue('#hf input[name=out]'));
  await pg.click('#hf [data-x=no]'); await pg.waitForTimeout(200);

  // ---- 4. thinning: how many are left ----
  const thinTask = () => pg.evaluate(() => (S.tasks.find(t => t.plantingId === 'car' && t.kind === 'thin') || {}).id);
  await pg.goto(U + '#/plant/car'); await pg.waitForTimeout(400);
  console.log('thin task', !!(await thinTask()));
  await pg.evaluate(id => toggleTask(id, true), await thinTask()); await pg.waitForTimeout(400);
  console.log('thin dialog:', await pg.evaluate(() => document.querySelector('#thf').textContent.replace(/\s+/g, ' ').trim())); await shot(pg, '4-thin');
  await pg.fill('#thf input[name=n]', '30'); await pg.check('#thf input[name=keep]');
  await pg.click('#thf button.primary'); await pg.waitForTimeout(600);
  console.log('thinned:', await pg.evaluate(() => { const p = planting('car'), c = container('bc'); return `thinned=${p.thinned} on ${p.thinDoneOn} · ${Draw.count(c, p, true)} on the map, ${Draw.count(c, p)} in the plan · remembered ${S.thinBy}`; }));
  await pg.evaluate(id => finishToggle(S.tasks.find(t => t.id === id), false, todayStr()), await thinTask()); await pg.waitForTimeout(400);
  console.log('unticked:', await pg.evaluate(() => { const p = planting('car'); return `thinned=${p.thinned} real=${'real' in p}`; }));
  await pg.evaluate(id => toggleTask(id, true), await thinTask()); await pg.waitForTimeout(400);
  console.log('asked again (remembered: count):', await pg.evaluate(() => !!document.querySelector('#thf') && !document.querySelector('#thf [data-h]')));
  await pg.click('#thf [data-x=no]'); await pg.waitForTimeout(400);
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('[data-act=thinSet][data-v=spacing]').click()); await pg.waitForTimeout(300);
  console.log('settings:', await pg.evaluate(() => S.thinBy), await pg.evaluate(() => [...document.querySelectorAll('[data-act=thinSet].on, [data-act=mapSet].on')].map(b => b.textContent).join(' / ')));
  await pg.evaluate(id => toggleTask(id, true), await thinTask()); await pg.waitForTimeout(500);
  await pg.click('#modal [data-w]'); await pg.waitForTimeout(500);   // (overdue: when was it done?)
  console.log('spacing: no dialog', await pg.evaluate(() => !document.querySelector('#thf')), '·', await pg.evaluate(() => { const p = planting('car'), c = container('bc'); return `thinned=${p.thinned} · ${Draw.count(c, p, true)} on the map`; }));

  // ---- 5. dragging a small dot: a fingertip beside it is enough, and zoom ----
  await pg.goto(U + '#/plant/let/arrange'); await pg.waitForTimeout(400);
  await pg.click('[data-act=zoom][data-z="2"]'); await pg.waitForTimeout(200);
  console.log('zoomed: drawing wider than its box', await pg.evaluate(() => { const b = document.querySelector('#arr'); return b.scrollWidth > b.clientWidth; })); await shot(pg, '5-zoom');
  const mid = await pg.evaluate(() => Math.floor(draft.pts.length / 2));
  const p0 = await pg.$eval(`#arr circle[data-i="${mid}"]`, c => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const was = await pg.evaluate(i => draft.pts[i].map(Math.round), mid);
  await pg.mouse.move(p0[0] + 18, p0[1] + 10); await pg.mouse.down(); await pg.mouse.move(p0[0] + 40, p0[1] + 30, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  console.log('dragged from beside it:', JSON.stringify(was), '→', JSON.stringify(await pg.evaluate(i => draft.pts[i].map(Math.round), mid)));
  await pg.click('[data-act=zoom][data-z="1"]');
  console.log('errs', errs); await b.close();
})();
