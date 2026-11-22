// Seeds that are slow to come up (spinach in cold soil): each look records roughly how many are up. Nothing yet → look
// again in a few days, and thinning waits; some → keep looking until most are up or it stops changing. When they came
// up is worked out from the looks.
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
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] });
    S.plantings.push({ id: 'sp', containerId: 'b1', cropId: 'spinach', method: 'seed', layout: 'rows', from: 0, to: 100, rowSp: 20, plantSp: 5, thinSp: 10, sowDate: '2026-11-08', status: 'active', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'rd', containerId: 'b1', cropId: 'hatsuka', method: 'seed', layout: 'rows', from: 100, to: 200, rowSp: 20, plantSp: 5, thinSp: 5, sowDate: '2026-10-01', status: 'active', photos: {}, series: [], harvests: [] });
    const sp = planting('sp'); sp.thinDate = thinEstimate(sp); sp.harvestDate = harvestEstimate(sp);
    syncTasks(sp); syncTasks(planting('rd')); await save();
  });
  const state = (id = 'sp') => pg.evaluate(id => { const p = planting(id), ts = S.tasks.filter(t => t.plantingId === id && !t.done && ['germ', 'thin'].includes(t.kind));
    return JSON.stringify({ germ: p.germ && { result: p.germ.result, pct: p.germ.pct, cameUp: p.germ.date, over: p.germ.over }, thinDate: p.thinDate, harvestDate: p.harvestDate, jobs: ts.map(t => [t.kind, t.due, t.title]) }); }, id);
  console.log('sown, not looked at yet:', await state());
  // look 1, via the job: nothing up
  const look = async (pct, date, pick) => {
    await pg.goto(U + '#/'); await pg.waitForTimeout(300);
    const id = await pg.evaluate(() => S.tasks.find(t => t.plantingId === 'sp' && t.kind === 'germ' && !t.done).id);
    await pg.evaluate(id => toggleTask(id, true), id); await pg.waitForTimeout(300);
    console.log('  asks:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 170));
    if (pct === 'chip') await pg.click('#gcf [data-pct="0"]'); else await pg.fill('#gcf input[name=pct]', String(pct));
    await pg.fill('#gcf input[name=date]', date); await pg.click('#gcf button.primary'); await pg.waitForTimeout(700);
    console.log('  then:', (await pg.textContent('#modal .sheet').catch(() => '')).replace(/\s+/g, ' ').slice(0, 330));
    if (pick) { await pg.click(`#modal [data-r=${pick}]`); await pg.waitForTimeout(400); }
    console.log('  →', await state());
  };
  console.log('look on 14 Nov: none yet'); await look('chip', '2026-11-14', 'keep');
  console.log('look on 17 Nov: about 4%'); await look(4, '2026-11-17', 'keep');
  // look 3, from the planting page: counting them instead
  await pg.goto(U + '#/plant/sp'); await pg.waitForTimeout(300);
  console.log('page:', (await pg.textContent('dl.details')).match(/Germination.*?(add a look|record how many are up)/)?.[0]);
  await pg.click('[data-act=germLook]'); await pg.waitForTimeout(300);
  console.log('count hint:', await pg.textContent('#gcf label:nth-of-type(2) small'));
  const spots = await pg.evaluate(() => Draw.count(container('b1'), planting('sp')));
  await pg.fill('#gcf input[name=cnt]', String(Math.round(spots * 0.18))); await pg.waitForTimeout(100);
  console.log('count → share:', await pg.inputValue('#gcf input[name=pct]'));
  await pg.click('#gcf button.primary'); await pg.waitForTimeout(700); await pg.click('#modal [data-r=keep]'); await pg.waitForTimeout(400);
  console.log('look on 18 Nov: about 18% →', await state());
  console.log('page:', (await pg.textContent('dl.details')).match(/Germination.*?add a look/)?.[0]);
  console.log('thinning:', (await pg.textContent('dl.details')).match(/Thinning.*?\)/)?.[0]);
  console.log('log:', JSON.stringify(await pg.evaluate(() => logFeed().filter(x => (x.pids || []).includes('sp') && x.kind === 'note').map(x => [x.date, x.title]))));
  // that's all: stop looking
  await pg.evaluate(() => germDialog(planting('sp'))); await pg.waitForTimeout(300);
  await pg.fill('#gcf input[name=pct]', '18'); await pg.click('#gcf button.primary'); await pg.waitForTimeout(700);
  console.log('that’s all:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 160));
  await pg.click('#modal [data-r=leave]'); await pg.waitForTimeout(400);
  console.log('  →', await state());
  // untick the first look's job: that look goes
  const first = await pg.evaluate(() => S.tasks.find(t => t.plantingId === 'sp' && t.kind === 'germ' && t.look === '2026-11-14').id);
  await pg.evaluate(id => toggleTask(id, false), first); await pg.waitForTimeout(400);
  console.log('untick the 14 Nov look:', await pg.evaluate(() => germChecks(planting('sp')).map(c => c.date + ' ' + c.pct).join(', ')));
  // a sowing long ago with nothing up: re-sowing is suggested first
  await pg.evaluate(() => germDialog(planting('rd'))); await pg.waitForTimeout(300);
  await pg.click('#gcf [data-pct="0"]'); await pg.click('#gcf button.primary'); await pg.waitForTimeout(700);
  console.log('radish sown 1 Oct, nothing:', (await pg.textContent('#modal .sheet')).replace(/\s+/g, ' ').slice(0, 200), '| first choice:', await pg.textContent('#modal .btn.primary'));
  await pg.click('#modal [data-r=all]'); await pg.waitForTimeout(400);
  console.log('  re-sown →', await state('rd'));
  // a drill (spinach sown a seed every cm or so) in a 160 × 100 cm bed: count a short stretch of row, not "700 spots"
  await pg.evaluate(async () => {
    const cr = crop('spinach');
    S.containers.push({ id: 'b2', type: 'bed', name: 'Plot B', width: 100, length: 160, margin: 10, history: [] });
    S.plantings.push({ id: 'dr', containerId: 'b2', cropId: 'spinach', method: 'seed', layout: 'continuous', from: 0, to: 160, rowSp: cr.rowSp, plantSp: cr.sowSp, thinSp: cr.thinSp, sowDate: '2026-11-08', status: 'active', photos: {}, series: [], harvests: [] });
    syncTasks(planting('dr')); await save();
  });
  await pg.goto(U + '#/plant/dr'); await pg.waitForTimeout(300);
  console.log('drill page:', await pg.evaluate(() => { const dt = [...document.querySelectorAll('dl.details dt')].find(x => x.textContent === 'Layout'); return dt ? dt.nextElementSibling.textContent : 'no Layout row: ' + document.querySelector('dl.details')?.textContent.slice(0, 200); }));
  await pg.click('[data-act=germLook]'); await pg.waitForTimeout(300);
  console.log('drill count:', (await pg.textContent('#gcf label:nth-of-type(2)')).replace(/\s+/g, ' ').trim());
  await pg.fill('#gcf input[name=cnt]', '2'); console.log('2 seedlings there → share:', await pg.inputValue('#gcf input[name=pct]'));
  console.log('errs', errs); await b.close();
})();
