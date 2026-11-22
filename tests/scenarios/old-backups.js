// Every backup in tests/fixtures/backups — made by older versions of the app — must restore into this version: nothing
// lost, old formats converted, every page working, and exporting it again keeps everything. Also: every change to the
// saved format (DATA_VERSION) must come with a backup made by the version before it.
const { newContext } = require('../lib');
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const U = 'http://localhost:8765/', DIR = path.join(__dirname, '..', 'fixtures', 'backups');
const ver = f => (f.match(/v([\d.]+)\.json$/) || [, '0'])[1].split('.').map(Number);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort((a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const versionsSeen = new Set();
  let dataVersion = null;
  for (const f of files) {
    const fixture = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), st = fixture.state;
    versionsSeen.add(st.dataVersion || 1);
    const ctx = await newContext(b); const pg = await ctx.newPage(); const said = [];
    pg.on('pageerror', e => errs.push(`${f}: ${e.message}`));
    pg.on('dialog', d => { said.push(d.message()); d.accept(); });
    await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
    dataVersion = await pg.evaluate(() => typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : null);
    await pg.setInputFiles('#impf', path.join(DIR, f)); await pg.waitForTimeout(400);
    if (await pg.isVisible('#modal [data-x=ok]')) await pg.click('#modal [data-x=ok]');   // "Restore the backup from …?"
    await pg.waitForFunction(() => location.hash === '#/' || location.hash === '', null, { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(600);
    const r = await pg.evaluate(async () => ({
      containers: S.containers.length, plantings: S.plantings.length, tasks: S.tasks.length, done: S.tasks.filter(t => t.done).length, log: (S.log || []).length,
      photos: (await DB.photoKeys()).length, crops: (S.customCrops || []).length, starts: (S.starts || []).length, dataVersion: S.dataVersion,
      products: (S.products || []).map(p => p.en).sort(), covers: S.containers.flatMap(c => (c.covers || []).map(x => x.type)),
      diaryPhoto: !!S.plantings.some(p => (p.diary || []).some(d => d.photo)), drive: !!(S.drive && S.drive.clientId),
      seeds: (S.seeds || []).map(s => `${s.cropId}${s.variety ? ' ' + s.variety : ''}${s.front || s.back ? ' (packet)' : ''}`).sort(), oldVarieties: 'customVarieties' in S,
      thin: [...new Set(S.plantings.map(p => p.thinStage).filter(Boolean))].sort(),
      germ: S.plantings.filter(p => p.germ).map(p => `${p.cropId}: ${germText(p)} [${germChecks(p).map(c => c.date + ' ' + c.pct + '%').join(', ')}]${S.tasks.some(t => t.plantingId === p.id && t.kind === 'germ' && !t.done) ? ' + a look to do' : ''}`).sort(),
    }));
    console.log(`== a backup saved by version ${ver(f).join('.')}`);   // (no "v" before it: the runner masks app versions written that way)
    console.log('  restore said:', said.join(' / ') || '(nothing)');
    console.log(`  kept: ${r.containers}/${st.containers.length} beds & pots, ${r.plantings}/${st.plantings.length} plantings, ${r.done}/${st.tasks.filter(t => t.done).length} jobs done, ${r.log}/${(st.log || []).length} log entries, ${r.photos}/${Object.keys(fixture.photos || {}).length} photos, ${r.crops}/${(st.customCrops || []).length} own crops, ${r.starts}/${(st.starts || []).length} seedling trays, note photo ${r.diaryPhoto}${st.drive ? `, Drive settings ${r.drive}` : ''}`);
    console.log(`  converted: data version ${r.dataVersion}, covers ${JSON.stringify(r.covers)}, products: ${r.products.join(', ')}`);
    if (r.germ.length) console.log(`  germination: ${r.germ.join(' | ')}`);
    console.log(`  seeds: ${r.seeds.join(', ') || 'none'}${r.oldVarieties ? ' (old variety list still there!)' : ''} | thinning: ${r.thin.join(' / ') || 'none'}`);
    // every page, every bed and pot, every planting and its form
    const routes = ['#/', '#/cal', '#/log', '#/settings', '#/products', '#/map', '#/sow', '#/plan', '#/rotation', '#/seedlings', '#/review', '#/totals', '#/spend', '#/shop', '#/picksafe', '#/varieties', '#/timeline', '#/doctor']
      .concat(await pg.evaluate(() => [...S.containers.map(c => '#/container/' + c.id), ...S.plantings.flatMap(p => ['#/plant/' + p.id, '#/plant/' + p.id + '/edit'])]));
    const broken = [];
    for (const h of routes) { await pg.goto(U + h); await pg.waitForTimeout(120); if (/Something went wrong/.test(await pg.textContent('#view'))) broken.push(h); }
    console.log(`  pages: ${routes.length} opened, broken: ${broken.length ? broken.join(' ') : 'none'}`);
    // export again, restore that: still the same
    const again = await pg.evaluate(async () => {
      const photos = {}; for (const k of await DB.photoKeys()) photos[k] = 1;
      const a = JSON.parse(JSON.stringify(S)); return { plantings: a.plantings.length, tasks: a.tasks.length, log: (a.log || []).length, photos: Object.keys(photos).length, products: (a.products || []).length };
    });
    console.log(`  exported again: ${again.plantings} plantings, ${again.tasks === r.tasks} same jobs, ${again.log} log, ${again.photos} photos, ${again.products} products`);
    await ctx.close();
  }
  if (dataVersion != null) {
    const need = []; for (let v = 6; v < dataVersion; v++)   // data versions started at 6 if (!versionsSeen.has(v)) need.push(v);
    console.log(`every change to the saved format has a backup from before it: ${need.length === 0}${need.length ? ' — missing data versions ' + need.join(', ') + ' (run npm run fixture on the version before the change)' : ''}`);
    console.log(`a backup from the current format (${dataVersion}) is ready for the next change: ${versionsSeen.has(dataVersion)}`);
  }
  console.log('errs', errs); await b.close();
})();
