// How many plants: seedlings from two batches go in together; the number of seedlings you choose is kept when you pick
// part of the bed or another layout, and if they won't all fit there the form says so; a plan with room for 10 that only
// got 8 lays out 8; the crop page's plant counter, and thinning to a count more than the spacing allows; the form in
// seedling mode, layouts recommended for the crop, a starting fertiliser's amount following the product; explanations
// as tips; a fingertip near a small dot is enough to drag it.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
const shot = (pg, name) => pg.screenshot({ path: require('path').join(process.argv[2] || '.', name + '.png') });
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true, products: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const bed = (id, name) => ({ id, type: 'bed', name, width: 100, length: 200, margin: 10, history: [] });
    S.containers.push(bed('ba', 'Bed A'), bed('bb', 'Bed B'), bed('bc', 'Bed C'), bed('bd', 'Bed D'));
    const pot = (id, cropId, count, extra) => Object.assign({ id, cropId, kind: 'pot', nid: 'nt_pot', count, sowDate: '2026-10-20', kept: 'out', status: 'growing', events: [], created: id, upOn: '2026-10-28' }, extra);
    S.starts = [pot('p8', 'snappea', 8), pot('p2', 'snappea', 2, { from: 'p0', movedOn: '2026-11-05' }), pot('q8', 'cabbage', 8, { sowDate: '2026-09-20', upOn: '2026-09-27' }),
      pot('k6', 'kale', 6, { sowDate: '2026-09-20', upOn: '2026-09-27' })];
    // a plan with room for 10 cabbages, taking the 8 seedlings
    S.plantings.push({ id: 'cab', containerId: 'bb', cropId: 'cabbage', method: 'seedling', layout: 'free', positions: [[25, 20], [50, 20], [75, 20], [25, 50], [50, 50], [75, 50], [25, 80], [50, 80], [75, 80], [50, 95]], from: 0, to: 100, rowSp: 40, plantSp: 25, sowDate: '2026-11-18', status: 'planned', planStart: 'q8', planN: 8, raise: 'pot', photos: {}, series: [], harvests: [] });
    // carrots to thin
    S.plantings.push({ id: 'car', containerId: 'bc', cropId: 'carrot', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 20, plantSp: 2, thinSp: 8, sowDate: '2026-10-10', thinDate: '2026-11-10', harvestDate: '2027-01-20', status: 'active', germ: { result: 'good', date: '2026-10-25' }, photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'let', containerId: 'bc', cropId: 'lettuce', method: 'seedling', layout: 'rows', from: 0, to: 100, rowSp: 30, plantSp: 30, sowDate: '2026-09-20', harvestDate: '2026-11-10', status: 'active', photos: {}, series: [], harvests: [] });
    await save();
  });
  const formLine = cid => pg.evaluate(cid => `count box ${document.querySelector('#pf').startCount.value} · drawn ${(draft.positions || []).length || Draw.count(container(cid), draft)} · layout shown ${document.querySelector('#pf').layout.value}${document.querySelector('#startShort:not([hidden])') ? ' · ' + document.querySelector('#startShort').textContent.trim() : ''}`, cid);

  // ---- 1. two batches into one planting ----
  await pg.goto(U + '#/plant/new/ba?usestart=p8'); await pg.waitForTimeout(500);
  console.log('seedling mode: no From seed', await pg.evaluate(() => !document.querySelector('[data-act=method]')), '· count box in the Crop part', await pg.evaluate(() => !!document.querySelector('fieldset .startcount')));
  console.log('one batch:', await formLine('ba'));
  await pg.click('[data-act=moreStart]'); await pg.waitForTimeout(300);
  console.log('both batches:', await formLine('ba'));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  console.log('planted:', await pg.evaluate(() => { const p = S.plantings.find(x => x.containerId === 'ba'); return `${p.status}, ${Draw.count(container('ba'), p)} plants · ` + ['p8', 'p2'].map(id => `${id}: left ${startLeft(start(id))} ${start(id).status}`).join(' · '); }));

  // ---- 2. the number you choose is kept ----
  await pg.goto(U + '#/plant/new/bd?usestart=k6'); await pg.waitForTimeout(500);
  console.log('kale, whole bed:', await formLine('bd'));
  console.log('layouts:', await pg.evaluate(() => [...document.querySelectorAll('#pf select[name=layout] optgroup')].map(g => g.label + ': ' + [...g.children].map(o => o.value).join(', ')).join(' | ')));
  await pg.fill('#pf input[name=startCount]', '2'); await pg.dispatchEvent('#pf input[name=startCount]', 'input'); await pg.waitForTimeout(200);
  console.log('chose 2:', await formLine('bd'));
  await pg.check('[data-multi]'); await pg.waitForTimeout(300);
  await pg.selectOption('[data-part=v]', '0/2'); await pg.waitForTimeout(300);
  console.log('top ½:', await formLine('bd'));
  await pg.selectOption('#pf select[name=layout]', 'staggered'); await pg.waitForTimeout(300);
  console.log('staggered:', await formLine('bd'));
  await pg.fill('#pf input[name=startCount]', '6'); await pg.dispatchEvent('#pf input[name=startCount]', 'input'); await pg.waitForTimeout(200);
  await pg.selectOption('[data-part=v]', '0/3'); await pg.waitForTimeout(300);
  console.log('6 in the top ⅓:', await formLine('bd')); await shot(pg, '2-wont-fit');
  await pg.selectOption('[data-part=v]', 'all'); await pg.waitForTimeout(300);
  console.log('back to the full length:', await formLine('bd'));
  await pg.uncheck('[data-multi]'); await pg.waitForTimeout(300);
  console.log('unticked: whole bed', await pg.evaluate(() => `${draft.from}–${draft.to}`), '· part hidden', await pg.evaluate(() => !document.querySelector('[data-part]')));
  // a starting fertiliser: another product takes its own amount
  const fert = () => pg.evaluate(() => draft.fert.map(f => `${f.product} ${f.amount} ${f.unit}`).join(', '));
  console.log('fertiliser:', await fert());
  const other = await pg.evaluate(() => { const base = draft.fert.find(f => (productByName(f.product).uses || []).includes('base')); const alt = myProducts(['fert']).find(p => (p.uses || []).includes('base') && p.npkv && p.npkv[0] > 0 && p.form !== 'liquid' && p.en !== base.product); return [draft.fert.indexOf(base), alt && alt.en]; });
  if (other[1]) { await pg.fill(`#pf input[name="fert.${other[0]}.product"]`, other[1]); await pg.dispatchEvent(`#pf input[name="fert.${other[0]}.product"]`, 'change'); await pg.waitForTimeout(300); }
  console.log('another base fertiliser:', await fert(), '· suggestion names it', await pg.evaluate(n => document.querySelector('#pf fieldset .hint') && [...document.querySelectorAll('#pf .hint')].some(h => h.textContent.includes(n) && h.textContent.startsWith('Suggested')), other[1]));

  // ---- 3. a plan with room for 10 that got 8 ----
  await pg.evaluate(async () => { activatePlan(planting('cab'), '2026-11-18'); await save(); });
  console.log('cabbage: laid out', await pg.evaluate(() => Draw.count(container('bb'), planting('cab'))), '· seedlings left', await pg.evaluate(() => startLeft(start('q8'))));
  await pg.goto(U + '#/plant/cab'); await pg.waitForTimeout(400);
  console.log('cabbage counter:', await pg.evaluate(() => document.querySelector('.pcount').textContent.replace(/\s+/g, ' ').trim()));

  // ---- 4. thinning: the counter takes the count, and warns when it's more than the spacing allows ----
  const thinTask = () => pg.evaluate(() => (S.tasks.find(t => t.plantingId === 'car' && t.kind === 'thin') || {}).id);
  await pg.goto(U + '#/plant/car'); await pg.waitForTimeout(400);
  console.log('carrot counter before thinning:', await pg.evaluate(() => document.querySelector('.pcount').textContent.replace(/\s+/g, ' ').trim()));
  await pg.evaluate(id => toggleTask(id, true), await thinTask()); await pg.waitForTimeout(400);
  console.log('thin dialog:', await pg.evaluate(() => document.querySelector('#thf').textContent.replace(/\s+/g, ' ').trim()));
  const ideal = await pg.evaluate(() => layoutCount(container('bc'), Object.assign({}, planting('car'), { thinned: true })));
  await pg.fill('#thf input[name=n]', String(ideal + 9)); await pg.check('#thf input[name=keep]');
  await pg.click('#thf button.primary'); await pg.waitForTimeout(600);
  await pg.goto(U + '#/plant/car'); await pg.waitForTimeout(400);
  console.log('counted 9 over:', await pg.evaluate(() => `${document.querySelector('.pcount').className} · ` + document.querySelector('.pcount').textContent.replace(/\s+/g, ' ').trim()), '· remembered', await pg.evaluate(() => S.thinBy)); await shot(pg, '4-counter-over');
  await pg.evaluate(id => finishToggle(S.tasks.find(t => t.id === id), false, todayStr()), await thinTask()); await pg.waitForTimeout(400);
  console.log('unticked:', await pg.evaluate(() => { const p = planting('car'); return `thinned=${p.thinned} count kept=${'thinCount' in p}`; }));
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('[data-act=thinSet][data-v=spacing]').click()); await pg.waitForTimeout(300);
  await pg.evaluate(id => toggleTask(id, true), await thinTask()); await pg.waitForTimeout(500);
  await pg.click('#modal [data-w]'); await pg.waitForTimeout(500);   // (overdue: when was it done?)
  await pg.goto(U + '#/plant/car'); await pg.waitForTimeout(400);
  console.log('by the spacing:', await pg.evaluate(() => document.querySelector('.pcount').textContent.replace(/\s+/g, ' ').trim()));

  // ---- 5. explanations: tips by default, or all shown ----
  await pg.goto(U + '#/plant/new/bd?crop=carrot'); await pg.waitForTimeout(500);
  const tips = () => pg.evaluate(() => { const h = [...document.querySelectorAll('.hint.tipped')]; return `${h.length} tips, ${h.filter(x => getComputedStyle(x).display !== 'none').length} showing`; });
  console.log('tips:', await tips());
  await pg.click('.tipb'); await pg.waitForTimeout(100);
  console.log('tapped one:', await tips());
  await pg.evaluate(async () => { S.explain = true; applyTheme(); await save(); }); await pg.waitForTimeout(100);
  console.log('explain mode:', await tips());
  await pg.evaluate(async () => { S.explain = false; applyTheme(); await save(); });

  // ---- 6. dragging a small dot: a fingertip beside it is enough, and zoom ----
  await pg.goto(U + '#/plant/let/arrange'); await pg.waitForTimeout(400);
  await pg.click('[data-act=zoom][data-z="2"]'); await pg.waitForTimeout(200);
  console.log('zoomed: drawing wider than its box', await pg.evaluate(() => { const b = document.querySelector('#arr'); return b.scrollWidth > b.clientWidth; }));
  const mid = await pg.evaluate(() => Math.floor(draft.pts.length / 2));
  const p0 = await pg.$eval(`#arr circle[data-i="${mid}"]`, c => { const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const was = await pg.evaluate(i => draft.pts[i].map(Math.round), mid);
  await pg.mouse.move(p0[0] + 18, p0[1] + 10); await pg.mouse.down(); await pg.mouse.move(p0[0] + 40, p0[1] + 30, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  console.log('dragged from beside it:', JSON.stringify(was), '→', JSON.stringify(await pg.evaluate(i => draft.pts[i].map(Math.round), mid)));
  console.log('errs', errs); await b.close();
})();
