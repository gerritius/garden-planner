// Seedling trays started indoors and moved outside part-way: the card says where they are and since when, and the
// plant-out date counts the indoor days as indoor days (between "indoors all along" and "outside all along").
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
    const st = (id, cropId, tray) => ({ id, status: 'growing', created: '2026-11-10T00:00:00Z', events: [], cropId, kind: 'tray', nid: 'nt_tray', tray, count: 20, seeds: 3, sowDate: '2026-11-10', upOn: '2026-11-13', kept: 'in', notes: '' });
    S.starts = [st('ko', 'komatsuna', 1), st('sp', 'spinach', 2)]; S.starts.forEach(syncStartTasks); await save();
  });
  const info = id => pg.evaluate(id => { const s = start(id), all = k => startReady({ cropId: s.cropId, sowDate: s.sowDate, upOn: s.upOn, kept: k });
    return `ready ${startReady(s)} (indoors all along ${all('in')}, outside all along ${all('out')}) · plant-out job ${S.tasks.find(t => t.startId === id && t.kind === 'transplant' && !t.done)?.due} · ${keptText(s)} · log ${JSON.stringify(s.keptLog || null)}`; }, id);
  const card = id => pg.$eval(`li.start:has([data-id="${id}"])`, e => e.querySelector('small').textContent.replace(/\s+/g, ' '));
  await pg.goto(U + '#/seedlings'); await pg.waitForTimeout(300);
  console.log('komatsuna before:', await card('ko'), '|', await info('ko'));
  const move = async (id, kept, date) => {
    await pg.click(`[data-act=editStart][data-id="${id}"]`); await pg.waitForTimeout(200);
    await pg.click(`#sdf [data-kept=${kept}]`); await pg.waitForTimeout(100);
    if (date) { await pg.fill('#sdf input[name=moved]', date); await pg.dispatchEvent('#sdf input[name=moved]', 'change'); }
    console.log(`  ${id} → ${kept}${date ? ' on ' + date : ' today'}: dialog says "${await pg.textContent('#tpHint')}"`);
    await pg.click('#sdf button.primary'); await pg.waitForTimeout(400);
  };
  await move('ko', 'out');
  console.log('komatsuna moved out today:', await card('ko'), '|', await info('ko'));
  await move('sp', 'out', '2026-11-14');
  console.log('spinach moved out 14 Nov:', await card('sp'), '|', await info('sp'));
  await move('sp', 'cover', '2026-11-17');
  console.log('spinach under cover 17 Nov:', await card('sp'), '|', await info('sp'));
  await move('ko', 'in', '2026-11-10');
  console.log('komatsuna "moved" on the day sown (indoors all along):', await card('ko'), '|', await info('ko'));
  console.log('errs', errs); await b.close();
})();
