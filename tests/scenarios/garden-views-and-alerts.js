// The Garden tab and what hangs off it: Today | Beds, picking a forecast day, weather tags and Skip on jobs, the Beds
// view's sort / filters / search / Sun & Moisture and its alert dots with what they mean, areas, soil chips, the harvest
// lifecycle bar, the "Pick by" job keeping to its date, the emergence bar, the quick log sheet and (test site) the
// made-up garden.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  pg.on('dialog', d => { errs.push('dialog: ' + d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    const td = todayStr(), days = [-2, -1, 0, 1, 2, 3, 4, 5].map(n => addDays(td, n));
    // tomorrow: 23 mm of rain and a frost; in three days: 35 °C
    const rain = { [addDays(td, 1)]: 23 }, low = { [addDays(td, 1)]: -1 }, high = { [addDays(td, 3)]: 35 };
    S.weather = { lat: 35.6, lon: 139.4, name: 'Test', fetched: Date.now(), daily: { time: days, weather_code: days.map(d => rain[d] ? 61 : 2), temperature_2m_max: days.map(d => high[d] || 16),
      temperature_2m_min: days.map(d => low[d] ?? 7), precipitation_sum: days.map(d => rain[d] || 0), precipitation_probability_max: days.map(d => rain[d] ? 90 : 10), wind_speed_10m_max: days.map(() => 8), wind_gusts_10m_max: days.map(() => 20) },
      hourly: { time: [], soil_temperature_6cm: [] } };
    S.containers.push({ id: 'b1', type: 'bed', name: 'Bed 1', width: 100, length: 200, margin: 10, history: [], sun: 'full', area: null },
      { id: 'b2', type: 'bed', name: 'Bed 2', width: 100, length: 200, margin: 10, history: [], sun: 'shade', area: null },
      { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [] });
    S.plantings.push(
      { id: 'dk', containerId: 'b1', cropId: 'daikon', method: 'seed', layout: 'rows', from: 0, to: 100, rowSp: 30, plantSp: 30, sowDate: '2026-09-05', harvestDate: '2026-10-30', status: 'active', photos: {}, series: [], harvests: [] },
      { id: 'sp', containerId: 'b2', cropId: 'spinach', method: 'seed', layout: 'rows', from: 0, to: 200, rowSp: 15, plantSp: 5, sowDate: addDays(td, -6), status: 'active', photos: {}, series: [], harvests: [] },
      { id: 'tm', containerId: 'g1', cropId: 'lettuce', method: 'plant', layout: 'free', from: 0, to: 40, sowDate: addDays(td, -10), status: 'active', photos: {}, series: [], harvests: [] });
    S.soil = undefined;
    S.containers[0].soil = [{ id: 'r1', date: addDays(td, -20), from: 0, to: 200, ph: 6.4 }];
    S.log = [{ id: 'l1', date: addDays(td, -30), kind: 'soil', product: 'Garden lime', amount: 150, unit: 'g', text: '', cids: ['b1'], pids: [] }];
    for (const p of S.plantings) { if (crop(p.cropId).daysHarvest && !p.harvestDate) p.harvestDate = harvestEstimate(p); syncTasks(p); }
    S.tasks.push({ id: 'feed1', containerId: 'b2', plantingId: null, kind: 'bed', title: 'Fertilise Bed 2 – liquid feed', due: td, done: false });
    S.firstRun = false; S.lastBackup = td; await save();
  });
  const txt = s => pg.evaluate(q => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, ' ').trim() : '(none)'; }, s);

  // the Garden tab opens on Today
  await pg.goto(U + '#/'); await pg.reload(); await pg.waitForTimeout(500);
  console.log('views:', await txt('.seg.gview'), '| on:', await txt('.seg.gview .on'));
  console.log('forecast days:', await pg.$$eval('.wxd', x => x.map(e => `${e.querySelector('.wn').textContent}${e.classList.contains('sel') ? '*' : ''}${e.querySelector('.wxmark') ? '!' : ''}`).join(' ')));
  console.log('heads (all days):', JSON.stringify(await pg.$$eval('section.heads li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))));
  console.log('jobs today:', JSON.stringify(await pg.$$eval('.today .task', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))));
  await pg.screenshot({ path: SP + '/today.png', fullPage: true });

  // pick tomorrow: its risks and its jobs; tap again to go back
  await pg.click('.wxd:nth-child(2)'); await pg.waitForTimeout(300);
  console.log('picked:', await txt('.wxd.sel .wn'), '| heads:', JSON.stringify(await pg.$$eval('section.heads li', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))));
  console.log('jobs heading:', await txt('.today h2'));
  await pg.screenshot({ path: SP + '/today_tmrw.png', fullPage: true });
  await pg.click('.wxd:nth-child(2)'); await pg.waitForTimeout(300);
  console.log('tapped again → all days:', await txt('.today h2'), '| picked:', await txt('.wxd.sel .wn'));

  // weather on jobs: the feed moves to the next dry day; watering skips until after the rain
  const tag = id => pg.evaluate(id => { const t = S.tasks.find(x => x.id === id); return JSON.stringify(jobWeather(t)); }, id);
  console.log('feed tag:', await tag('feed1'));
  await pg.click('[data-act=wxSkip][data-id=feed1]'); await pg.waitForTimeout(300);
  console.log('feed moved to:', await pg.evaluate(() => { const t = S.tasks.find(x => x.id === 'feed1'); return daysBetween(todayStr(), t.due) + ' days on, movedFor ' + t.movedFor; }));
  const wt = await pg.evaluate(() => { const t = S.tasks.find(x => x.kind === 'water' && !x.done && jobWeather(x)); return t ? t.id : null; });
  console.log('a watering job with a rain tag:', !!wt);
  if (wt) {
    console.log('water tag:', await tag(wt));
    await pg.evaluate(async id => { const t = S.tasks.find(x => x.id === id); const w = jobWeather(t); skipWatering(groupOf(t), w.to); syncWater(); await save(); }, wt);
    console.log('after skip, due in days:', await pg.evaluate(() => S.tasks.filter(x => x.kind === 'water' && !x.done).map(t => groupOf(t) + ' ' + daysBetween(todayStr(), t.due)).join(', ')));
  }

  // Beds: maturity on the chips, alert dots with what they mean, next job
  await pg.click('[data-act=hv][data-v=beds]'); await pg.waitForTimeout(400);
  const cards = () => pg.$$eval('.bedcard, .ptile', x => x.filter(e => !e.hidden).map(e => (e.querySelector('.cname, b') || {}).textContent));
  console.log('bed cards:', JSON.stringify(await pg.$$eval('.bedcard', x => x.map(e => ({ name: e.querySelector('.cname').textContent, chips: e.querySelector('.chips').textContent.replace(/\s+/g, ' ').trim(),
    dots: [...e.querySelectorAll('.dots .adot')].map(d => d.className.replace('adot ', '') + ':' + d.title), why: (e.querySelector('.why') || {}).textContent, next: (e.querySelector('.nextjob') || {}).textContent }))), null, 0));
  console.log('dot key:', await txt('.dotkey'));
  console.log('filters:', await txt('.bedfilt'));
  await pg.screenshot({ path: SP + '/beds.png', fullPage: true });
  // sort, filter, search
  await pg.evaluate(() => { const s = document.querySelector('#bedsort'); s.value = 'ready'; s.dispatchEvent(new Event('change')); }); await pg.waitForTimeout(300);
  console.log('closest to harvest first:', JSON.stringify(await cards()));
  await pg.click('[data-act=bedFilt][data-v=ready]'); await pg.waitForTimeout(300);
  console.log('ready to pick:', JSON.stringify(await cards()));
  await pg.click('[data-act=bedFilt][data-v=all]'); await pg.waitForTimeout(300);
  await pg.fill('#bedq', 'spin'); await pg.waitForTimeout(200);
  console.log('search "spin":', JSON.stringify(await cards()), '| pots heading hidden:', await pg.$eval('.bgrp[data-g=pots]', e => e.hidden));
  await pg.fill('#bedq', 'zzz'); await pg.waitForTimeout(200);
  console.log('search "zzz":', await txt('#noq'));
  await pg.click('#clrq'); await pg.waitForTimeout(200);
  console.log('cleared:', (await cards()).length, 'cards');
  // Sun & Moisture on the cards
  await pg.click('[data-act=bedsShow][data-v=sun]'); await pg.waitForTimeout(400);
  console.log('sun & moisture:', JSON.stringify(await pg.$$eval('.sunm', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))));
  console.log('moisture:', JSON.stringify(await pg.evaluate(() => S.containers.map(c => c.name + ' ' + JSON.stringify(moistureOf(c))))));
  await pg.screenshot({ path: SP + '/beds_sun.png', fullPage: true });
  console.log('view remembered:', await pg.evaluate(() => [S.homeView, S.bedsShow, S.bedSort, S.bedFilter].join(' / ')));
  // the old map address goes to the Beds view
  await pg.evaluate(async () => { S.homeView = 'today'; await save(); });
  await pg.goto(U + '#/map'); await pg.waitForTimeout(400);
  console.log('old map link →', await pg.evaluate(() => location.hash), '| view:', await txt('.seg.gview .on'));
  // areas: managed from the Beds view
  await pg.click('[data-act=areas]'); await pg.waitForTimeout(200);
  console.log('areas sheet:', await txt('#modal .plist'));
  await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(200);
  await pg.evaluate(async () => { S.homeView = 'today'; S.bedsShow = 'crops'; S.bedSort = 'name'; await save(); });

  // bed page: soil chips, compact drawing with a Bigger toggle
  await pg.goto(U + '#/container/b1'); await pg.waitForTimeout(400);
  console.log('bed chips:', await txt('.schips'));
  const h1 = await pg.$eval('.plotwrap > svg', s => Math.round(s.getBoundingClientRect().height));
  await pg.click('.plotsz'); await pg.waitForTimeout(300);
  const h2 = await pg.$eval('.plotwrap > svg', s => Math.round(s.getBoundingClientRect().height));
  console.log('drawing compact, then bigger:', h1 < h2, '|', await txt('.plotsz'));
  await pg.click('.plotsz'); await pg.waitForTimeout(200);

  // crop page: lifecycle bar; the Pick by job follows keeps-until, and says when it's overdue
  await pg.goto(U + '#/plant/dk'); await pg.waitForTimeout(400);
  console.log('lifecycle:', await txt('.lifecycle .lc-stops'), '| today pin:', !!(await pg.$('.lifecycle .lc-today')));
  console.log('pick by job = keeps until:', await pg.evaluate(() => { const t = S.tasks.find(x => x.plantingId === 'dk' && x.kind === 'pickby' && !x.done); return t.due === harvestWindow(planting('dk')).keep; }));
  await pg.evaluate(async () => { const t = S.tasks.find(x => x.plantingId === 'dk' && x.kind === 'pickby' && !x.done); t.due = '2026-12-31'; await save(); });
  await pg.goto(U + '#/plant/sp'); await pg.goto(U + '#/plant/dk'); await pg.waitForTimeout(400);
  console.log('drifted date put back:', await pg.evaluate(() => { const t = S.tasks.find(x => x.plantingId === 'dk' && x.kind === 'pickby' && !x.done); return t.due === harvestWindow(planting('dk')).keep; }));
  await pg.evaluate(async () => { planting('dk').keepUntil = addDays(todayStr(), -3); await save(); });
  await pg.goto(U + '#/plant/sp'); await pg.goto(U + '#/plant/dk'); await pg.waitForTimeout(400);
  console.log('overdue pick-by:', JSON.stringify(await pg.$$eval('.task', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(t => /Pick by/.test(t)))));
  await pg.screenshot({ path: SP + '/crop.png', fullPage: true });

  // emergence: the bar on the crop page, + opens the count with 10% more filled in
  await pg.goto(U + '#/plant/sp'); await pg.waitForTimeout(400);
  console.log('emergence (going):', await txt('section.going .emerge'));
  await pg.click('section.going .estep'); await pg.waitForTimeout(300);
  console.log('dialog pct:', await pg.inputValue('#gcf input[name=pct]'));
  await pg.click('#gcf button.primary'); await pg.waitForTimeout(500);
  if (await pg.isVisible('#modal [data-r=keep]')) { await pg.click('#modal [data-r=keep]'); await pg.waitForTimeout(300); }
  console.log('recorded:', await pg.evaluate(() => JSON.stringify(germChecks(planting('sp')))));

  // the quick log
  await pg.goto(U + '#/'); await pg.waitForTimeout(300);
  await pg.click('.fab'); await pg.waitForTimeout(200);
  console.log('quick log:', JSON.stringify(await pg.$$eval('#modal .qbig b', x => x.map(e => e.textContent))), '| small:', await txt('#modal .qsmall'));
  await pg.click('[data-q=germ]'); await pg.waitForTimeout(200);
  console.log('emergence for:', await txt('#modal .plist'));
  await pg.click('#modal [data-x=no]'); await pg.waitForTimeout(200);
  await pg.click('.fab'); await pg.waitForTimeout(200); await pg.click('[data-q=feedspray]'); await pg.waitForTimeout(200);
  console.log('feed / spray:', await txt('#modal .tiles'));

  // test site: fill with a made-up garden
  await pg.goto(U + '#/'); await pg.waitForTimeout(300);
  pg.evaluate(() => import('/js/backup/sample-garden.js').then(m => m.fillSampleGarden()));
  await pg.waitForSelector('#modal .btn.danger, #modal button.primary'); await pg.click('#modal .btn.danger, #modal button.primary'); await pg.waitForTimeout(800);
  console.log('made-up garden:', await pg.evaluate(() => JSON.stringify({ areas: S.areas.map(a => a.name), beds: S.containers.filter(c => c.type === 'bed').length, pots: S.containers.filter(c => c.type !== 'bed').length,
    plantings: S.plantings.length, planned: S.plantings.filter(p => p.status === 'planned').length, ready: S.plantings.filter(isReady).length, starts: S.starts.length, jobs: S.tasks.filter(t => !t.done).length > 10 })));
  await pg.evaluate(async () => { S.homeView = 'beds'; await save(); }); await pg.reload(); await pg.waitForTimeout(600);
  console.log('area switch:', await txt('.mapsub .seg'));
  await pg.click('[data-act=bedArea]:nth-child(3)'); await pg.waitForTimeout(300);
  console.log('Backyard only:', (await cards()).length, 'cards');
  await pg.click('[data-act=bedFilt][data-v=empty]'); await pg.waitForTimeout(300);
  console.log('Backyard, empty:', JSON.stringify(await cards()));
  console.log('errs', errs); await b.close();
})();
