// Strips side by side down a bed: peas along both long edges and spinach down the middle, each using part of the width.
// Plants stay in their strip, strips don't count as sharing space, and the drawing shows each strip.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b, { openFolds: true });
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    S.containers.push({ id: 'bd', type: 'bed', name: 'Bed D', width: 100, length: 200, margin: 10, history: [] });
    const peas = (id, xFrom, xTo, sowDate) => ({ id, containerId: 'bd', cropId: 'snappea', method: 'seed', layout: 'rows', dir: 'along', from: 0, to: 200, xFrom, xTo, rowSp: 30, plantSp: 10, sowDate, status: 'planned', photos: {}, series: [], harvests: [] });
    S.plantings.push(peas('pa', 0, 25, '2026-12-01'), peas('pb', 75, 100, '2026-12-15'));
    await save();
  });
  // spinach down the middle, on the form
  await pg.goto(U + '#/plant/new/bd?plan=1&crop=spinach&date=2026-12-05&from=0&to=200'); await pg.waitForTimeout(500);
  // the bed is whole until you say you're planting more than one crop here
  console.log('part of the bed hidden at first:', await pg.evaluate(() => !document.querySelector('[data-part]')));
  await pg.check('[data-multi]'); await pg.waitForTimeout(300);
  console.log('choices:', await pg.evaluate(() => [...document.querySelectorAll('[data-part]')].map(s => s.closest('label').firstChild.textContent.trim() + ': ' + [...s.options].map(o => o.textContent).join(', ')).join(' | ')));
  // the middle third across, the bottom third down
  await pg.selectOption('[data-part=h]', '1/3'); await pg.waitForTimeout(300);
  await pg.selectOption('[data-part=v]', '2/3'); await pg.waitForTimeout(300);
  console.log('quick thirds:', await pg.evaluate(() => `from ${draft.from} to ${draft.to}, across ${draft.xFrom}–${draft.xTo}`));
  // back to the full length; your own numbers across
  await pg.selectOption('[data-part=v]', 'all'); await pg.waitForTimeout(300);
  await pg.selectOption('[data-part=h]', 'custom'); await pg.waitForTimeout(300);
  console.log('units in the boxes:', await pg.evaluate(() => [...document.querySelectorAll('#pf .unitin')].slice(0, 2).map(u => u.querySelector('input').name + ' ' + u.querySelector('i').textContent).join(', ')));
  await pg.fill('#pf input[name=xFrom]', '25'); await pg.fill('#pf input[name=xTo]', '75'); await pg.dispatchEvent('#pf input[name=xTo]', 'change'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: require('path').join(process.argv[2] || '.', 'form.png') });
  await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(600);
  console.log('saved without a clash question:', await pg.evaluate(() => !document.querySelector('#modal:not([hidden]) .msg')), await pg.evaluate(() => location.hash.startsWith('#/plant/')));
  console.log(await pg.evaluate(() => {
    const c = container('bd');
    return S.plantings.filter(p => p.containerId === 'bd').map(p => { const L = Draw.layout(c, p), xs = L.pts.length ? L.pts.map(q => q[0]) : L.lines.flatMap(l => [l[0], l[2]]);
      return `${p.cropId} ${sectionOf(p)}: ${L.pts.length ? L.pts.length + ' plants' : L.lines.length + ' drill lines'}, x ${Math.min(...xs)}–${Math.max(...xs)}`; }).join('\n');
  }));
  console.log('peas a vs spinach share space:', await pg.evaluate(() => (sp => occupants('bd', 0, 200, '2026-12-01', '2027-06-01', sp.id, sp))(S.plantings.find(p => p.cropId === 'spinach')).map(p => p.id).join(',') || 'none'));
  console.log('whole width shares with all:', await pg.evaluate(() => occupants('bd', 0, 200, '2026-12-01', '2027-06-01').length));
  await pg.goto(U + '#/plant/pa'); await pg.waitForTimeout(400);
  await pg.goto(U + '#/plan'); await pg.waitForTimeout(600);
  // the bed drawing in plan mode for December
  const html = await pg.evaluate(() => Draw.svg(container('bd'), decorate(S.plantings.filter(p => p.containerId === 'bd')), { px: 2, labels: true, today: '2026-12-20' }));
  console.log('strip dividers:', (html.match(/class="cut"/g) || []).length, 'labels:', (html.match(/class="lbl"/g) || []).length);
  await pg.evaluate(h => { document.querySelector('main').innerHTML = `<div class="plotwrap">${h}</div>`; window.scrollTo(0, 0); }, html); await pg.screenshot({ path: require('path').join(process.argv[2] || '.', 'strips.png') });
  console.log('errs', errs); await b.close();
})();
