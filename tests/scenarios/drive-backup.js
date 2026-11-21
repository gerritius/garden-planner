const { newContext } = require('../lib');
// Google Drive backup end to end, against a simulated Google sign-in and a fake Drive
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/', SP = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await newContext(b);
  await ctx.route('**/api.open-meteo.com/**', r => r.abort()); await ctx.route('**/archive-api.open-meteo.com/**', r => r.abort());
  // --- fake Google sign-in: 'mode' decides what happens ---
  let mode = 'grant', authCalls = [];
  await ctx.route('https://accounts.google.com/o/oauth2/v2/auth**', r => {
    const u = new URL(r.request().url()), p = u.searchParams; authCalls.push({ prompt: p.get('prompt'), redirect: p.get('redirect_uri'), scope: p.get('scope') });
    const frag = mode === 'grant' ? `access_token=TOK${authCalls.length}&token_type=Bearer&expires_in=3599&state=${p.get('state')}` : `error=interaction_required&state=${p.get('state')}`;
    r.fulfill({ status: 302, headers: { location: p.get('redirect_uri') + '#' + frag } });
  });
  // --- fake Drive ---
  const files = {}; let nid = 1; const calls = [];
  const matches = (f, q) => {   // enough of Drive's query language for the app
    if (/trashed=false/.test(q) && f.trashed) return false;
    let m;
    if ((m = q.match(/name='([^']*)'/)) && f.name !== m[1]) return false;
    if ((m = q.match(/mimeType='([^']*)'/)) && f.mimeType !== m[1]) return false;
    if ((m = q.match(/'([^']+)' in parents/)) && !(f.parents || []).includes(m[1])) return false;
    if ((m = q.match(/name contains '([^']*)'/)) && !f.name.includes(m[1])) return false;
    return true;
  };
  await ctx.route('https://www.googleapis.com/**', async r => {
    const req = r.request(), u = new URL(req.url()), meth = req.method(), auth = req.headers()['authorization'];
    calls.push(meth + ' ' + u.pathname + (u.searchParams.get('uploadType') ? '?' + u.searchParams.get('uploadType') : ''));
    if (!/^Bearer TOK/.test(auth || '')) return r.fulfill({ status: 401, body: 'no' });
    const json = o => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/drive/v3/about') return json({ user: { emailAddress: 'me@example.com', displayName: 'Me' } });
    if (u.pathname === '/drive/v3/files' && meth === 'GET') { const q = u.searchParams.get('q'); return json({ files: Object.values(files).filter(f => matches(f, q)).sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1)).map(f => ({ id: f.id, name: f.name, size: String((f.body || '').length), createdTime: f.createdTime, appProperties: f.appProperties })) }); }
    if (u.pathname === '/drive/v3/files' && meth === 'POST') { const m = JSON.parse(req.postData()); const id = 'f' + nid++; files[id] = Object.assign({ id, createdTime: new Date(Date.parse('2026-11-18T01:00:00Z') + nid * 1000).toISOString() }, m); return json({ id }); }
    let m;
    if ((m = u.pathname.match(/^\/upload\/drive\/v3\/files(?:\/(.+))?$/))) {
      const raw = req.postDataBuffer().toString('latin1'), parts = raw.split(/--gp[^\r\n]*/);
      const meta = JSON.parse(parts[1].split('\r\n\r\n')[1].trim()), content = parts[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      if (m[1]) { Object.assign(files[m[1]], meta, { body: content }); return json({ id: m[1] }); }
      const id = 'f' + nid++; files[id] = Object.assign({ id, createdTime: new Date(Date.parse('2026-11-18T01:00:00Z') + nid * 1000).toISOString(), body: content }, meta); return json({ id, name: meta.name });
    }
    if ((m = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
      if (meth === 'DELETE') { delete files[m[1]]; return r.fulfill({ status: 204 }); }
      if (u.searchParams.get('alt') === 'media') return r.fulfill({ status: 200, body: Buffer.from(files[m[1]].body, 'latin1') });
    }
    r.fulfill({ status: 404, body: 'unknown ' + meth + ' ' + u.pathname });
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { console.log('  [alert]', d.message()); d.accept(); });
  await pg.goto(U); await pg.waitForTimeout(500);
  await pg.evaluate(async () => {
    delete S.drive; S.containers = [{ id: 'b1', type: 'bed', name: 'Plot A', width: 100, length: 200, margin: 10, history: [] }];
    S.plantings = [{ id: 'cb', containerId: 'b1', cropId: 'cabbage', method: 'seedling', layout: 'rows', from: 0, to: 200, rowSp: 45, plantSp: 45, sowDate: '2026-10-18', status: 'active', photos: {}, series: [], harvests: [], diary: [{ id: 'd1', date: '2026-11-01', photo: 'ph1', note: 'first leaves' }] }];
    await DB.putPhoto('ph1', new Blob(['JPEGDATA-1'], { type: 'image/jpeg' })); S.tasks = []; await save();
  });
  // 1) set up: paste client ID, connect (consent), first backup happens on return
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelectorAll('details.set').forEach(d => d.open = true));
  console.log('address shown:', await pg.textContent('.mono'));
  await pg.fill('#gcid', '1234-abc.apps.googleusercontent.com'); await pg.click('[data-act=driveSetId]'); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelectorAll('details.set').forEach(d => d.open = true));
  await pg.click('[data-act=driveConnect]'); await pg.waitForURL(/settings/); await pg.waitForTimeout(1500);
  console.log('after connect: url', pg.url().split('#')[1], '| auth', JSON.stringify(authCalls[0]), '| drive', JSON.stringify(await pg.evaluate(() => ({ c: S.drive.connected, e: S.drive.email, d: S.drive.lastDate, p: S.drive.photos, lb: S.lastBackup }))));
  console.log('drive files:', Object.values(files).map(f => f.name + (f.parents ? ' in ' + files[f.parents[0]]?.name : '')).join(' | '));
  // 2) next day: app opens → hops to Google silently → backs up; the photo isn't sent again
  await pg.evaluate(async () => { S.drive.lastDate = '2026-11-01'; S.drive.lastTry = null; await save(); localStorage.removeItem('gp.driveTok'); });
  calls.length = 0; await pg.goto(U + '#/'); await pg.reload(); await pg.waitForTimeout(2500);
  console.log('next day: auth prompt', authCalls[authCalls.length - 1].prompt, '| uploads', calls.filter(c => c.includes('upload')).length, '| lastDate', await pg.evaluate(() => S.drive.lastDate), '| url', pg.url().split('#')[1]);
  // 3) same day again: nothing happens
  const n0 = authCalls.length; calls.length = 0; await pg.reload(); await pg.waitForTimeout(1200);
  console.log('same day: auth calls', authCalls.length - n0, '| drive calls', calls.length);
  // 4) Google wants a tap: banner on home, tap → backs up
  mode = 'deny'; await pg.evaluate(async () => { S.drive.lastDate = '2026-11-02'; S.drive.lastTry = null; await save(); localStorage.removeItem('gp.driveTok'); });
  await pg.goto(U + '#/'); await pg.reload(); await pg.waitForTimeout(2500);
  console.log('needs tap: banner', await pg.textContent('button.banner').catch(() => 'NONE'));
  mode = 'grant'; await pg.click('button.banner'); await pg.waitForTimeout(2500);
  console.log('after tap: prompt', authCalls[authCalls.length - 1].prompt, '| lastDate', await pg.evaluate(() => S.drive.lastDate), '| banner', !!(await pg.$('button.banner')));
  // 5) a new photo → only that one goes up; tidy keeps 14 + monthly
  await pg.evaluate(async () => { await DB.putPhoto('ph2', new Blob(['JPEGDATA-2'], { type: 'image/jpeg' })); planting('cb').diary.push({ id: 'd2', date: '2026-11-15', photo: 'ph2', note: 'heads' }); await save(); });
  const root = Object.values(files).find(f => f.name === 'Garden Planner backups').id;
  for (let i = 1; i <= 25; i++) { const d = `2026-${String(Math.ceil(i / 10) + 7).padStart(2, '0')}-${String(i % 28 + 1).padStart(2, '0')}`; const id = 'old' + i; files[id] = { id, name: `garden-backup-${d}.json`, parents: [root], createdTime: d + 'T08:00:00Z', body: '{}' }; }
  calls.length = 0; await pg.evaluate(() => driveNow()); await pg.waitForTimeout(2500);
  console.log('photo uploads this time:', calls.filter(c => c.includes('upload')).length - 1, '| backups kept', Object.values(files).filter(f => /garden-backup/.test(f.name)).length, '| deleted', calls.filter(c => c.startsWith('DELETE')).length);
  // 6) restore from Drive (into an emptied app)
  await pg.evaluate(async () => { S.plantings = []; await DB.clearPhotos(); await save(); });
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400); await pg.evaluate(() => document.querySelectorAll('details.set').forEach(d => d.open = true));
  await pg.click('[data-act=driveRestore]'); await pg.waitForTimeout(800);
  console.log('restore list:', (await pg.$$eval('#modal [data-f]', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).slice(0, 2));
  await pg.click('#modal [data-f]'); await pg.waitForTimeout(300); await pg.click('#modal [data-x=ok]'); await pg.waitForTimeout(2000);
  console.log('restored:', JSON.stringify(await pg.evaluate(async () => ({ plantings: S.plantings.length, photos: (await DB.photoKeys()).sort(), ph2: await (await DB.getPhoto('ph2')).text(), drive: S.drive.connected }))));
  await pg.goto(U + '#/settings'); await pg.waitForTimeout(400); await pg.evaluate(() => document.querySelectorAll('details.set').forEach(d => d.open = true));
  await pg.locator('section:has(> h3:has-text("Google Drive"))').screenshot({ path: `${SP}/drive_settings.png` });
  console.log('errs', errs); await b.close();
})();
