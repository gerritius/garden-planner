#!/usr/bin/env node
// Makes a backup file the way a given version of the app writes it, for the restore test (tests/scenarios/old-backups.js).
//
//   npm run fixture                    a backup from the current code (do this BEFORE changing the saved data's format)
//   node tests/tools/make-fixture.js <git ref>      a backup from an older version (e.g. a tag: v1.26.1)
//
// It opens that version in a browser, builds a small garden through the version's own planting form (so plantings
// have exactly the fields that version saves), adds the other kinds of records that version knows about (log, covers,
// meter readings, products, potting mix, seedlings, notes with a photo), opens every main page so the version's own
// jobs and checks run, then saves {app, format, exported, state, photos} — the same file "Export backup" makes — to
// tests/fixtures/backups/backup-v<version>.json. The garden is made up: no personal data goes into the repo.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { newContext } = require('../lib');
const REPO = path.resolve(__dirname, '..', '..'), OUT = path.join(REPO, 'tests', 'fixtures', 'backups'), PORT = 8765;
const ref = process.argv[2] || 'current';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const serve = root => http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});

(async () => {
  let root = REPO, tree = null;
  if (ref !== 'current') { tree = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-fixture-')); execFileSync('git', ['-C', REPO, 'worktree', 'add', '--detach', tree, ref], { stdio: 'ignore' }); root = tree; }
  const server = serve(root); await new Promise((res, rej) => server.once('error', rej).listen(PORT, '127.0.0.1', res));
  const b = await chromium.launch();
  const done = [], errs = [];
  try {
    const ctx = await newContext(b, { bridge: fs.existsSync(path.join(root, 'js', 'main.js')) });
    const pg = await ctx.newPage(); const U = `http://localhost:${PORT}/`;
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.goto(U); await pg.waitForTimeout(800);
    const version = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?');

    // beds and pots (these fields haven't changed since the first version)
    await pg.evaluate(async () => {
      S.containers.push(
        { id: 'bedA', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [], notes: 'North end of the community garden', created: '2026-03-01' },
        { id: 'bedB', type: 'bed', name: 'Plot B', width: 100, length: 200, margin: 10, history: [], created: '2026-03-01' },
        { id: 'g1', type: 'round', name: 'Bag 1', diameter: 40, depth: 35, margin: 2, history: [], created: '2026-03-01' },
        { id: 'g2', type: 'round', name: 'Bag 2', diameter: 40, depth: 35, margin: 2, history: [], created: '2026-03-01' },
        { id: 'g3', type: 'round', name: 'Bag 3', diameter: 40, depth: 35, margin: 2, history: [], created: '2026-03-01' },
        { id: 'r1', type: 'rect', name: 'Trough', width: 30, length: 65, depth: 25, margin: 2, history: [], created: '2026-03-01' });
      await save();
    });
    done.push('beds and pots');

    // plantings through this version's own planting form
    const plant = async (cid, cropId, sowDate, from, to, variety) => {
      await pg.goto(`${U}#/plant/new/${cid}${from != null ? `?from=${from}&to=${to}` : ''}`); await pg.waitForSelector('#pf', { timeout: 5000 });
      const before = await pg.evaluate(() => S.plantings.length);
      await pg.evaluate(id => { const s = document.querySelector('#pf [name=cropId]'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); s.dispatchEvent(new Event('input', { bubbles: true })); }, cropId);
      await pg.waitForTimeout(250);
      await pg.evaluate(([d, v]) => { const f = document.querySelector('#pf'); const set = (n, x) => { const el = f.querySelector(`[name="${n}"]`); if (el && x != null) { el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } }; set('sowDate', d); set('variety', v); }, [sowDate, variety || null]);
      await pg.waitForTimeout(150);
      await pg.click('#pf button[type=submit]'); await pg.waitForTimeout(400);
      if (await pg.isVisible('#modal .btn.primary').catch(() => false)) { await pg.click('#modal .btn.primary'); await pg.waitForTimeout(300); }   // "it overlaps a planned crop — go ahead?"
      const ok = await pg.evaluate(n => S.plantings.length > n, before);
      done.push(`${cropId} in ${cid}${ok ? '' : ' (FAILED)'}`);
    };
    await plant('bedA', 'garlic', '2026-10-10', 0, 80, 'Howaito Roppen');
    await plant('bedA', 'cabbage', '2026-09-25', 80, 200);
    await plant('bedB', 'daikon', '2026-09-15', 0, 100);
    await plant('bedB', 'tomato', '2027-05-03', 100, 200);   // planned for next season
    await plant('g1', 'lettuce', '2026-10-20');
    await plant('g2', 'potato', '2026-09-01', null, null, 'Dejima');
    await plant('r1', 'spinach', '2026-10-25');

    // a dialog of this version, filled in and saved: records get exactly the fields that version stores
    const dialog = async (what, open, fields) => {
      const has = await pg.evaluate(fn => { try { return typeof eval(fn) === 'function'; } catch (e) { return false; } }, open.split('(')[0]);
      if (!has) return false;
      const e0 = errs.length;
      await pg.evaluate(o => { (0, eval)(o); }, open);
      const f = await pg.waitForSelector('#modal form', { timeout: 3000 }).catch(() => null); if (!f) { done.push(`${what} (no form)`); return false; }
      await pg.evaluate(fields => {
        const f = document.querySelector('#modal form');
        for (const [n, v] of Object.entries(fields)) {
          const els = [...f.querySelectorAll(`[name="${n}"]`)]; if (!els.length) continue;
          for (const el of els) {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = [].concat(v).map(String).includes(el.value) || v === true;
            else if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) continue;
            else el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, fields);
      await pg.waitForTimeout(150);
      await pg.evaluate(() => { const f = document.querySelector('#modal form'); const b = f.querySelector('button.primary, button[type=submit]'); if (b) b.click(); else f.requestSubmit(); });
      await pg.waitForTimeout(400);
      if (await pg.isVisible('#modal [data-x=ok]').catch(() => false)) { await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(300); }
      done.push(what + (errs.length > e0 ? ` (that version's own error: ${errs.slice(e0).join('; ')})` : '')); return true;
    };
    const cab = await pg.evaluate(() => S.plantings.find(p => p.cropId === 'cabbage').id);
    await dialog('own crop', "newCropDialog(() => {})", { en: 'Okahijiki', ja: 'おかひじき', daysHarvest: 40 });
    await dialog('log: base fertiliser', "logDialog()", { kind: 'fert', product: 'Bokashi', amount: 300, unit: 'g', text: 'Dug in before planting garlic', cid: ['bedA'], date: '2026-10-08' });
    await dialog('log: liquid feed', "logDialog()", { kind: 'fert', product: 'Kincho Liquid 6-6-7', amount: 10, unit: 'mL', text: 'per 5 L can', cid: ['g1', 'g2'], date: '2026-11-12' });
    await dialog('log: spray', "logDialog()", { kind: 'spray', product: 'Pai Benica V spray', text: 'Aphids on cabbage', pid: [cab], phi: 1, date: '2026-11-05' });
    await dialog('cover', "coverDialog(container('bedA'))", { type: 'fleece', from: 80, to: 200, on: '2026-11-01' });
    await dialog('meter reading', "readingDialog(container('bedB'))", { ph: 6.1, temp: 14, date: '2026-11-14' });
    await dialog('seedlings in a tray', "startDialog()", { cropId: 'hakusai', count: 12, sowDate: '2026-11-01' });
    await dialog('own product (old list)', "ownProductDialog()", { en: 'Kincho Liquid 6-6-7', n: 6, p: 6, k: 7, form: 'liquid', per: 5, doses: '5, 10' });
    for (const id of ['g1', 'g3']) await dialog(`potting mix in ${id}`, `mixDialog(container('${id}'))`, { kind: id === 'g3' ? 'iris' : 'touikawa', fresh: true, date: '2026-08-30' });

    // records without a dialog of their own
    const extras = await pg.evaluate(async photoB64 => {
      const out = [], cab = S.plantings.find(p => p.cropId === 'cabbage');
      const has = n => { try { return typeof eval(n) !== 'undefined'; } catch (e) { return false; } };
      const bytes = Uint8Array.from(atob(photoB64), ch => ch.charCodeAt(0));   // a note with a photo, a harvest, a variety
      await DB.putPhoto('fixphoto1', new Blob([bytes], { type: 'image/png' }));
      (cab.diary = cab.diary || []).push({ id: 'fixdiary1', date: '2026-11-10', note: 'Hearts starting to form', photo: 'fixphoto1', tags: [] });
      const pot = S.plantings.find(p => p.cropId === 'potato'); (pot.harvests = pot.harvests || []).push({ date: '2026-11-15', count: 4, note: 'first dig' });
      if (Array.isArray(S.seeds)) { const s = S.seeds.find(x => x.cropId === 'garlic' && x.variety === 'Howaito Roppen'); if (s) Object.assign(s, { maker: 'Takii', front: 'fixphoto1' }); else S.seeds.push({ id: 'sd_fix1', cropId: 'garlic', variety: 'Howaito Roppen', maker: 'Takii', front: 'fixphoto1', back: null, notes: '', added: '2026-10-01' }); }   // the seed library (1.28+)
      else (S.customVarieties = S.customVarieties || {}).garlic = ['Howaito Roppen'];
      out.push('note with photo', 'harvest', 'variety');
      // germination: the spinach looked at once and nothing up yet; the lettuce came up patchy
      const sp = S.plantings.find(p => p.cropId === 'spinach'), le = S.plantings.find(p => p.cropId === 'lettuce');
      if (has('recordGermCheck')) { recordGermCheck(sp, { date: '2026-11-05', pct: 0 }); recordGermCheck(le, { date: '2026-10-28', pct: 40 }); out.push('germination checks'); }
      else if (has('germDialog')) {
        sp.germ = { result: 'none', date: '2026-11-05' }; le.germ = { result: 'patchy', date: '2026-10-28' };
        for (const [p, d] of [[sp, '2026-11-05'], [le, '2026-10-28']]) { const t = S.tasks.find(t => t.plantingId === p.id && t.kind === 'germ'); if (t) Object.assign(t, { done: true, doneOn: d }); }
        out.push('germination: nothing up / patchy');
      }
      if (has('PRODUCTS') && !S.prodLib && !Array.isArray(S.myProducts)) { S.myProducts = PRODUCTS.map(p => p.id).filter(id => ['bokashi', 'chickenManure', 'oysterLime', 'paiBenicaV', 'cowCompost'].includes(id)); out.push('ticked products'); }
      if (has('PRODUCTS') && !S.prodLib) { S.plenty = ['chickenManure']; out.push('plenty of chicken manure'); }
      if (has('COVER_TYPES') && COVER_TYPES.some(t => t[0] === 'fleece')) for (const c of S.containers) for (const x of c.covers || []) { x.type = 'fleece'; out.push('cover type fleece (renamed in later versions)'); }
      if (!S.weather) { S.weather = { lat: 35.75, lon: 139.42, name: 'Higashiyamato' }; out.push('weather location'); }
      if (has('driveSection')) { S.drive = { auto: true, clientId: 'fixture-client-id.apps.googleusercontent.com', connected: false }; out.push('Drive settings'); }
      await save();
      return out;
    }, fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'photo.png')).toString('base64'));
    done.push(...extras);
    done.push(`→ ${await pg.evaluate(() => `${(S.log || []).length} log, ${S.containers.reduce((n, c) => n + (c.covers || []).length, 0)} covers (${S.containers.flatMap(c => (c.covers || []).map(x => x.type)).join(',')}), ${S.containers.reduce((n, c) => n + (c.soil || []).length, 0)} readings, ${(S.starts || []).length} trays, ${S.containers.reduce((n, c) => n + (c.mixLog || []).length, 0)} mix records, ${(S.customProducts || []).length} old own products, ${(S.customCrops || []).length} own crops`)}`);

    // every main page once, so this version's own jobs, checks and conversions run; tick two jobs
    for (const h of ['#/', '#/cal', '#/log', '#/settings', '#/map', '#/sow', '#/plan', '#/products', '#/seedlings', '#/container/bedA', '#/container/bedB', '#/container/g1']) {
      await pg.goto(U + h); await pg.waitForTimeout(250);
    }
    await pg.goto(U + '#/'); await pg.waitForTimeout(400);
    for (let i = 0; i < 2; i++) {
      const box = await pg.$('input[data-task]:not(:checked)'); if (!box) break;
      await box.check().catch(() => {}); await pg.waitForTimeout(300);
      if (await pg.isVisible('#modal .btn.primary').catch(() => false)) { await pg.click('#modal .btn.primary'); await pg.waitForTimeout(300); }
    }
    if (!(await pg.evaluate(() => S.tasks.some(t => t.done)))) {   // jobs grouped on the home page: tick through the app instead
      for (const id of await pg.evaluate(() => S.tasks.filter(t => !t.done && t.due && t.due <= todayStr()).slice(0, 2).map(t => t.id))) {
        await pg.evaluate(i => toggleTask(i, true), id); await pg.waitForTimeout(300);
        if (await pg.isVisible('#modal .btn.primary').catch(() => false)) { await pg.click('#modal .btn.primary'); await pg.waitForTimeout(300); }
      }
    }
    done.push(`ticked jobs (${await pg.evaluate(() => S.tasks.filter(t => t.done).length)})`);
    await pg.goto(U + '#/'); await pg.waitForTimeout(300);

    // the backup, exactly as "Export backup" writes it
    const data = await pg.evaluate(async () => {
      const photos = {};
      for (const k of await DB.photoKeys()) { const blob = await DB.getPhoto(k); if (blob) photos[k] = await blobToDataURL(blob); }
      return JSON.stringify({ app: 'garden-planner', format: 1, exported: new Date().toISOString(), state: S, photos }, null, 1);
    });
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `backup-v${version}.json`);
    fs.writeFileSync(file, data + '\n');
    console.log(`v${version} (${ref}): ${path.relative(REPO, file)}\n  made: ${done.join(', ')}\n  page errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  } finally {
    await b.close(); server.close();
    if (tree) execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', tree], { stdio: 'ignore' });
  }
})().catch(e => { console.error(e); process.exit(1); });
