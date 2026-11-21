const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U); await pg.waitForTimeout(400);
  const r = await pg.evaluate(() => {
    const row = (label, p, old) => [label, harvestEstimate(p), old];
    const cd = (id) => crop(id).daysHarvest;
    return [
      row('Hakusai direct, bed, 25 Aug', { cropId: 'hakusai', method: 'seed', sowDate: '2026-08-25' }, addDays('2026-08-25', cd('hakusai'))),
      row('Hakusai direct, 15 Sep (late)', { cropId: 'hakusai', method: 'seed', sowDate: '2026-09-15' }, addDays('2026-09-15', cd('hakusai'))),
      row('Komatsuna in bag, 10 Sep', { cropId: 'komatsuna', method: 'seed', sowDate: '2026-09-10' }, addDays('2026-09-10', cd('komatsuna'))),
      row('Komatsuna in bag, 10 Nov', { cropId: 'komatsuna', method: 'seed', sowDate: '2026-11-10' }, addDays('2026-11-10', cd('komatsuna'))),
      row('Komatsuna, 15 Mar (spring)', { cropId: 'komatsuna', method: 'seed', sowDate: '2027-03-15' }, addDays('2027-03-15', cd('komatsuna'))),
      row('Cabbage bought seedlings, 10 Sep', { cropId: 'cabbage', method: 'seedling', sowDate: '2026-09-10' }, addDays('2026-09-10', cd('cabbage') - 30)),
      row('Cabbage from own tray (sown 10 Aug), out 10 Sep', { cropId: 'cabbage', method: 'seedling', sowDate: '2026-09-10', seededOn: '2026-08-10' }, addDays('2026-08-10', cd('cabbage'))),
      row('Tomato seedlings, 5 May', { cropId: 'tomato', method: 'seedling', sowDate: '2027-05-05' }, addDays('2027-05-05', cd('tomato'))),
      row('Tomato seedlings, 10 Apr (early)', { cropId: 'tomato', method: 'seedling', sowDate: '2027-04-10' }, addDays('2027-04-10', cd('tomato'))),
      row('Snap pea direct, 25 Oct', { cropId: 'snappea', method: 'seed', sowDate: '2026-10-25' }, addDays('2026-10-25', cd('snappea'))),
      row('Snap pea direct, 1 Nov (up 16 Nov)', { cropId: 'snappea', method: 'seed', sowDate: '2026-11-01', germ: { result: 'good', date: '2026-11-16' } }, addDays('2026-11-01', cd('snappea'))),
      row('Garlic cloves, 1 Oct', { cropId: 'garlic', method: 'seedling', sowDate: '2026-10-01' }, addDays('2026-10-01', cd('garlic'))),
      row('Potato, 1 Mar', { cropId: 'potato', method: 'seed', sowDate: '2027-03-01' }, addDays('2027-03-01', cd('potato'))),
      row('Daikon, 5 Sep', { cropId: 'daikon', method: 'seed', sowDate: '2026-09-05' }, addDays('2026-09-05', cd('daikon'))),
      ['Tray: hakusai sown 1 Sep → ready', startReady({ cropId: 'hakusai', sowDate: '2026-09-01' }), addDays('2026-09-01', tpDays('hakusai'))],
      ['Tray: lettuce sown 15 Nov, outside', startReady({ cropId: 'lettuce', sowDate: '2026-11-15' }), addDays('2026-11-15', tpDays('lettuce'))],
      ['Tray: lettuce sown 15 Nov, under cover', startReady({ cropId: 'lettuce', sowDate: '2026-11-15', kept: 'cover' }), addDays('2026-11-15', tpDays('lettuce'))],
      ['Tray: lettuce sown 15 Nov, indoors', startReady({ cropId: 'lettuce', sowDate: '2026-11-15', kept: 'in' }), addDays('2026-11-15', tpDays('lettuce'))],
      ['Thin: snap pea up 16 Nov', thinEstimate({ cropId: 'snappea', method: 'seed', sowDate: '2026-11-01', germ: { result: 'good', date: '2026-11-16' } }), '(was 10 Dec)'],
      ['Tray: to plant cabbage 20 Dec, sow by', traySowFor('cabbage', '2026-12-20'), addDays('2026-12-20', -tpDays('cabbage'))],
    ];
  });
  for (const x of r) console.log(x[0].padEnd(48), 'new', x[1], ' old', x[2]);
  console.log('errs', errs); await b.close();
})();
