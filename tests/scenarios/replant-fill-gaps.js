// Back-up seedlings for a crop that's already growing: replanting them into its bag fills its gaps (no second planting).
// One planted out as a separate planting by mistake: placed by hand it's the one seedling chosen, it's drawn by its
// real age (smaller than the older peas), and it can be added to the first planting afterwards. Filled-in seedlings show
// in the drawing, at their own size. And seedlings two to a pot: 4 replanted into 9 cm pots, 2 each, are 2 pots.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'g1', type: 'round', name: 'Pea bag', diameter: 40, depth: 35, margin: 2, history: [] });
    const sp = { id: 'sp', containerId: 'g1', cropId: 'snappea', method: 'seed', layout: 'free', positions: [[13, 20], [27, 20]], from: 0, to: 40, rowSp: 30, plantSp: 10, sowDate: '2026-10-20', spread: 30, status: 'active', photos: {}, series: [], harvests: [] };
    sp.harvestDate = harvestEstimate(sp); S.plantings.push(sp);
    S.starts = [{ id: 'st', status: 'growing', created: '2026-11-05T09:00:00Z', events: [], cropId: 'snappea', variety: '', kind: 'tray', nid: 'nt_tray', tray: 1, count: 7, seeds: 1, sowDate: '2026-11-05', upOn: '2026-11-12', kept: 'out' }];
    syncTasks(sp); syncStartTasks(start('st')); await save();
  });
  const replant = async n => { await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300); await pg.click('[data-act=replant][data-id=st]'); await pg.waitForTimeout(200); await pg.fill('#pof input[name=n]', String(n)); };
  await replant(1);
  console.log('offers:', (await pg.$$eval('#modal .pick a', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
  await pg.click('#modal [data-fill=sp]'); await pg.waitForTimeout(500);
  console.log('filled:', await pg.evaluate(() => location.hash), JSON.stringify(await pg.evaluate(() => ({ plantings: S.plantings.length, fills: planting('sp').fills, left: startLeft(start('st')) }))));
  const drawn = () => pg.evaluate(() => { const g = document.querySelector('svg.plot g[data-pid="sp"]'); return g ? [...g.querySelectorAll('circle.plant')].map(c => (+c.getAttribute('r') * 2).toFixed(1)).join(' ') : 'none'; });
  await pg.waitForTimeout(300); console.log('drawn (cm across each):', await drawn());
  await pg.waitForTimeout(300); console.log('page:', await pg.evaluate(() => { const dt = [...document.querySelectorAll('dl.details dt')].find(x => x.textContent === 'Gaps filled'); return dt ? dt.nextElementSibling.textContent : 'no row: ' + location.hash + ' ' + (document.querySelector('dl.details') || {}).textContent?.slice(0, 120); }));
  // another one, as a new planting by mistake, placed by hand
  await replant(1); await pg.click('#modal [data-c=g1]'); await pg.waitForTimeout(500);
  console.log('form layout:', await pg.evaluate(() => draft.layout));
  await pg.selectOption('#pf select[name=layout]', 'free'); await pg.waitForTimeout(300);
  console.log('by hand: plants to place', await pg.evaluate(() => (draft.positions || []).length));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  const dup = await pg.evaluate(() => S.plantings.find(p => p.id !== 'sp').id);
  console.log('saved:', JSON.stringify(await pg.evaluate(id => { const p = planting(id); return [p.layout, (p.positions || []).length, p.seededOn, p.sowDate]; }, dup)));
  console.log('drawn size today (cm across): older peas', await pg.evaluate(() => Math.round(Draw.radius(planting('sp'), todayStr()) * 20) / 10), '| seedling', await pg.evaluate(id => Math.round(Draw.radius(planting(id), todayStr()) * 20) / 10, dup));
  console.log('banner:', await pg.textContent('#view .banner:has([data-act=mergeFill])').catch(() => 'none'));
  await pg.click('[data-act=mergeFill]'); await pg.waitForTimeout(200); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(600);
  await pg.waitForTimeout(300); console.log('drawn after adding them:', await drawn());
  console.log('merged:', await pg.evaluate(() => location.hash), JSON.stringify(await pg.evaluate(() => ({ plantings: S.plantings.map(p => p.id), fills: planting('sp').fills.map(f => f.n + ' ' + f.date), events: start('st').events.map(e => `${e.type} ${e.n} ${e.pid}${e.fill ? ' fill' : ''}`) }))));
  console.log('log:', JSON.stringify(await pg.evaluate(() => startLogItems().filter(x => /Fill|Planted/.test(x.title)).map(x => x.title + ' · ' + x.sub))));
  // a gap filled before it showed in the drawing: shown with one tap
  await pg.evaluate(async () => { const p = planting('sp'); p.fills.push({ date: '2026-11-17', n: 1, startId: 'st' }); await save(); render(); }); await pg.waitForTimeout(300);
  console.log('older fill:', await pg.evaluate(() => { const b = document.querySelector('[data-act=drawFill]'); return b ? b.parentElement.textContent.match(/1 seedling 17 Nov[^)]*\)\s*show it in the drawing/)?.[0] : 'no button'; }));
  await pg.evaluate(() => document.querySelector('[data-act=drawFill]').click()); await pg.waitForTimeout(300); console.log('  shown:', await drawn());
  // 4 into 9 cm pots, 2 to a pot
  await replant(4); await pg.fill('#poper input[name=per]', '2'); await pg.click('#modal [data-nt="p:nt_pot"]'); await pg.waitForTimeout(400);
  console.log('pots:', (await pg.$$eval('li.start', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 90)))).join(' || '));
  const pots = await pg.evaluate(() => S.starts.find(s => s.kind === 'pot').id);
  await pg.click(`[data-act=replant][data-id="${pots}"]`); await pg.waitForTimeout(200);
  console.log('replant from them asks:', await pg.textContent('#pof label'));
  await pg.fill('#pof input[name=n]', '1'); await pg.click('#modal [data-c=g1]'); await pg.waitForTimeout(500);
  console.log('form:', await pg.textContent('#view .banner'), '| placed:', await pg.evaluate(() => draft.layout + ' ' + (draft.positions || []).length));
  console.log('errs', errs); await b.close();
})();
