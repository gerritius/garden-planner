// Seedlings from a tray into a plan or a planting: you choose how many go in (a diamond takes 4 — peas go in pairs, so
// 8), they show in the drawing and can be dragged; the rest stay in the tray (set aside only as many as a plan uses).
// Seedling suggestions for a free space only offer trays that would crop before the space is needed.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const bag = (id, name) => ({ id, type: 'round', name, diameter: 40, depth: 35, margin: 2, history: [] });
    S.containers.push(bag('g4', 'Bag 4'), bag('g5', 'Bag 5'), bag('g6', 'Bag 6'));
    S.plantings.push({ id: 'egg', containerId: 'g4', cropId: 'nasu', method: 'seedling', layout: 'center', from: 0, to: 40, sowDate: '2027-05-01', status: 'planned', raise: 'buy', photos: {}, series: [], harvests: [] });
    S.plantings.push({ id: 'pot', containerId: 'g5', cropId: 'potato', method: 'seed', layout: 'center', from: 0, to: 40, sowDate: '2027-03-12', status: 'planned', photos: {}, series: [], harvests: [] });
    S.starts = [
      { id: 'pea', cropId: 'sayaendo', kind: 'tray', tray: 4, count: 49, sowDate: '2026-11-16', kept: 'out', status: 'growing', events: [], created: '1' },
      { id: 'kom', cropId: 'komatsuna', kind: 'tray', tray: 1, count: 49, sowDate: '2026-11-14', kept: 'out', status: 'growing', events: [], created: '1' },
    ];
    await save();
  });
  const chips = async () => pg.evaluate(() => [...document.querySelectorAll('li.gap')].map(li => li.querySelector('div').textContent.replace(/\s+/g, ' ').trim().slice(0, 40) + ' → ' + [...li.querySelectorAll('.chip.mine')].map(a => a.textContent.replace(/\s+/g, ' ').trim()).join(' / ')));
  await pg.goto(U + '#/plan'); await pg.waitForTimeout(1200);
  console.log('season plan seedling chips:'); for (const l of await chips()) console.log('  ' + l);
  console.log('tab on', await pg.evaluate(() => document.querySelector('#tabs a.on') && document.querySelector('#tabs a.on').dataset.tab));
  // the form for Bag 6 in mid-December with the snow peas
  await pg.goto(U + '#/plant/new/g6?plan=1&from=0&to=40&date=2026-12-14&usestart=pea'); await pg.waitForTimeout(500);
  const state = async () => pg.evaluate(() => { const f = document.querySelector('#pf'); return `count=${f.startCount.value} layout=${f.layout.value} plants=${(draft.positions || []).length || Draw.count(container('g6'), draft)} · ${(document.querySelector('#startNote') || {}).textContent || ''}`.replace(/\s+/g, ' '); });
  console.log('peas default:', await state());
  await pg.selectOption('#pf select[name=layout]', 'center'); await pg.waitForTimeout(300);
  console.log('peas centre:', await state());
  await pg.selectOption('#pf select[name=layout]', 'diamond'); await pg.waitForTimeout(300);
  console.log('peas diamond:', await state());
  await pg.fill('#pf input[name=startCount]', '6'); await pg.dispatchEvent('#pf input[name=startCount]', 'input'); await pg.waitForTimeout(300);
  console.log('peas 6:', await state());
  // drag the first plant towards the edge
  const before = await pg.evaluate(() => draft.positions[0].join(','));
  const at = await pg.evaluate(() => { const svg = document.querySelector('#pprev svg'), m = svg.getScreenCTM(), q = draft.positions[0]; return [m.a * q[0] + m.e, m.d * q[1] + m.f, m.a]; });
  await pg.mouse.move(at[0], at[1]); await pg.mouse.down(); await pg.mouse.move(at[0] + 3 * at[2], at[1] + 5 * at[2], { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  console.log('dragged', before, '→', await pg.evaluate(() => draft.positions[0].join(',')));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  const tray = () => pg.evaluate(() => { const s = start('pea'); return `tray: left ${startLeft(s)}, free ${startFree(s)}, plant-out job ${S.tasks.some(t => t.startId === 'pea' && t.kind === 'transplant' && !t.done) ? 'yes' : 'no'}`; });
  console.log('saved plan', await pg.evaluate(() => { const p = S.plantings.find(x => x.containerId === 'g6'); return `${p.status} ${p.cropId} planN=${p.planN} planStart=${p.planStart} layout=${p.layout} positions=${p.positions.length}`; }), await tray());
  // another planting can still use the rest
  await pg.goto(U + '#/plant/new/g5?plan=1&from=0&to=40&date=2026-12-14'); await pg.waitForTimeout(500);
  console.log('chooser (bag 5, until Mar):', await pg.evaluate(() => [...document.querySelectorAll('.usestart .chip')].map(b => (b.closest('details') ? '[folded] ' : '') + b.textContent.replace(/\s+/g, ' ').trim()).join(' / ')));
  // plant the plan: 6 go in, 43 stay in the tray
  await pg.evaluate(async () => { const p = S.plantings.find(x => x.containerId === 'g6'); activatePlan(p, '2026-12-14'); await save(); });
  console.log('planted', await pg.evaluate(() => (start('pea').events || []).map(e => `${e.type} ${e.n}`).join(', ')), await tray());
  // the replant dialog → a bag now: the form asks how many (pairs of peas)
  await pg.goto(U + '#/plant/new/g4?crop=sayaendo&start=pea&n=' + 43); await pg.waitForTimeout(500);
  console.log('plant out now (bag 4):', await pg.evaluate(() => `count=${document.querySelector('#pf').startCount.value} · ${document.querySelector('#startBanner').textContent.replace(/\s+/g, ' ')}`));
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500);
  console.log('after planting out', await tray());
  await pg.goto(U + '#/cal'); await pg.waitForTimeout(300);
  console.log('calendar links', await pg.evaluate(() => [...document.querySelectorAll('.btnrow a')].slice(0, 2).map(a => a.textContent.trim()).join(' | ')));
  await pg.goto(U + '#/log'); await pg.waitForTimeout(300);
  console.log('log tab on', await pg.evaluate(() => document.querySelector('#tabs a.on') && document.querySelector('#tabs a.on').dataset.tab), 'tabs', await pg.evaluate(() => [...document.querySelectorAll('#tabs a span')].map(s => s.textContent).join(',')));
  console.log('errs', errs); await b.close();
})();
