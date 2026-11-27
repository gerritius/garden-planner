// A very large bed must never freeze the app: plants are counted, not all drawn; sizes beyond what the app is for are
// refused in the form; the map can zoom in. And the ruler: no 0, numbers that never crowd, none on round pots.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('crash', () => errs.push('the page crashed'));
  const within = (ms, fn) => Promise.race([fn().then(() => true), new Promise(r => setTimeout(() => r(false), ms))]);
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10 }, { id: 'lb', type: 'bed', name: 'Long bed', width: 120, length: 1200, margin: 10 });
    for (let i = 1; i <= 3; i++) S.containers.push({ id: 'g' + i, type: 'round', name: 'Bag ' + i, diameter: 40, depth: 35, margin: 2 });
    // a bed saved before there were size limits
    S.containers.push({ id: 'hu', type: 'bed', name: 'Huge', width: 10000, length: 10000, margin: 10 });
    await save();
  });

  // planting the whole huge bed through the form
  console.log('form opened:', await within(10000, async () => { await pg.goto(U + '#/plant/new/hu'); await pg.waitForSelector('#pf'); }));
  console.log('crop chosen, preview drawn:', await within(10000, () => pg.evaluate(() => { const s = document.querySelector('select[name=cropId]'); s.value = 'lettuce'; s.dispatchEvent(new Event('change', { bubbles: true })); })));
  await pg.waitForTimeout(300);
  console.log('saved:', await within(10000, async () => { await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(500); }));
  const pid = await pg.evaluate(() => S.plantings.find(p => p.containerId === 'hu').id);
  console.log('counted:', await pg.evaluate(id => { const p = planting(id), c = container('hu'), l = Draw.layout(c, p); return `${Draw.count(c, p)} plants, ${l.pts.length} placed one by one, many=${l.many}`; }, pid));
  console.log('bed page:', await within(10000, async () => { await pg.goto(U + '#/container/hu'); await pg.waitForSelector('.plotwrap svg'); }), '| drawn as a pattern:', await pg.$$eval('.plotwrap pattern circle.plant', x => x.length > 0), '| plants drawn one by one:', await pg.$$eval('.plotwrap circle.plant', x => x.filter(c => !c.closest('pattern')).length));
  console.log('size note on the bed page:', await pg.textContent('.banner.warn'));
  console.log('planting page:', await within(10000, async () => { await pg.goto(U + '#/plant/' + pid); await pg.waitForTimeout(300); }), '|', (await pg.textContent('#view')).match(/[\d,]+ plants/)[0], '| arrange offered:', !!(await pg.$('a[href$="/arrange"]')));
  await pg.goto(U + '#/plant/' + pid + '/arrange'); await pg.waitForTimeout(300);
  console.log('arrange page:', (await pg.textContent('#view')).trim().split('.')[0]);
  console.log('home:', await within(10000, async () => { await pg.goto(U + '#/'); await pg.waitForTimeout(400); }));

  // the map: zoom appears because the bags are tiny next to the huge bed
  await pg.goto(U + '#/map'); await pg.waitForSelector('#mapbox svg');
  console.log('map zoom offered:', !!(await pg.$('.mapzoom')), '|', await pg.textContent('#zoomTxt'), '| move/rotate bar hidden:', !(await pg.isVisible('#selbar')));
  for (let i = 0; i < 10; i++) { const t = await pg.textContent('#zoomTxt'); await pg.click('[data-act=zoomIn]'); if (await pg.textContent('#zoomTxt') === t) break; }
  console.log('zoomed to', await pg.textContent('#zoomTxt'), '| scrolls sideways:', await pg.$eval('#mapbox', x => x.scrollWidth > x.clientWidth), '| a bag is at least 60 px:', await pg.$eval('[data-cid=g1] .hit', x => x.getBoundingClientRect().width >= 60));
  await pg.click('[data-cid=g1] .hit'); await pg.waitForTimeout(300); console.log('tapping a bag opens it:', pg.url().endsWith('#/container/g1'));
  await pg.goto(U + '#/map?edit=1'); await pg.waitForSelector('#mapbox svg'); console.log('grid note:', await pg.textContent('#gridTxt'));

  // the form refuses sizes the app isn't made for, and says why as you type
  await pg.goto(U + '#/container/hu/edit'); await pg.waitForSelector('#cf'); await pg.waitForTimeout(200);
  console.log('edit form says:', await pg.$eval('#sizeWarn', e => e.hidden ? '(nothing)' : e.textContent));
  let said = null; pg.on('dialog', d => { said = d.message(); d.accept(); });
  await pg.click('#cf button[type=submit]'); await pg.waitForTimeout(300);
  console.log('save refused:', said, '| still', await pg.evaluate(() => container('hu').width));
  await pg.fill('#cf input[name=width]', '5000'); await pg.fill('#cf input[name=length]', '5000'); await pg.waitForTimeout(100);
  console.log('5000 × 5000:', await pg.$eval('#sizeWarn', e => e.hidden ? '(nothing)' : e.textContent));
  await pg.fill('#cf input[name=margin]', '2600'); await pg.waitForTimeout(100);
  console.log('margin 2600:', await pg.$eval('#sizeWarn', e => e.hidden ? '(nothing)' : e.textContent));
  await pg.goto(U + '#/container/new'); await pg.waitForSelector('#cf'); await pg.waitForTimeout(200);
  await pg.click('[data-act=type][data-v=round]'); await pg.waitForTimeout(200);
  await pg.fill('#cf input[name=diameter]', '450'); await pg.waitForTimeout(100);
  console.log('pot 450 cm:', await pg.$eval('#sizeWarn', e => e.hidden ? '(nothing)' : e.textContent));

  // the ruler
  const ticks = async id => { await pg.goto(U + '#/container/' + id); await pg.waitForSelector('.plotwrap svg'); await pg.waitForTimeout(300);
    if (await pg.$('.plotsz[aria-pressed=false]')) { await pg.click('.plotsz'); await pg.waitForTimeout(300); }   // (the full-size drawing)
    return pg.$$eval('.plotwrap svg text.tick', x => x.map(t => t.textContent).join(' ')); };
  console.log('ruler 1 × 2 m bed:', await ticks('b1'));
  console.log('ruler 1.2 × 12 m bed:', await ticks('lb'));
  console.log('ruler round bag:', JSON.stringify(await ticks('g1')));
  console.log('ruler 100 m bed:', await ticks('hu'));
  console.log('errs', errs); await b.close();
})();
