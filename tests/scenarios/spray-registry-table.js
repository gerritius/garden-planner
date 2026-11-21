const { newContext } = require('../lib');
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const pg = await (await newContext(b)).newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto(U); await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => {
    const ids = ['cabbage', 'hakusai', 'komatsuna', 'mizuna', 'chingensai', 'daikon', 'kabu', 'tomato', 'minitomato', 'nasu', 'kyuri', 'naganegi', 'garlic', 'onion', 'carrot', 'spinach', 'broccoli', 'snappea', 'strawberry', 'corn', 'shishito', 'piman', 'edamame', 'satsumaimo', 'nanohana'];
    const out = {};
    for (const id of ids) out[id] = ['paiBenicaV', 'benicaNatural', 'spinoace', 'benicaXnext'].map(k => { const s = regSummary(k, id); return s && s.ok ? `${k}:${s.crop}|phi${s.phi}|${s.uses === Infinity ? '∞' : s.uses}|${s.dils.join('/')}` : `${k}:—`; }).join('  ');
    out.lettuce_leaf = ['spinoace', 'benicaXnext'].map(k => { const s = regSummary(k, 'lettuce', 'レッドファイヤー'); return s && s.ok ? `${k}:${s.crop}|phi${s.phi}|${s.uses}` : k + ':—'; }).join('  ');
    out.lettuce_head = ['spinoace', 'benicaXnext'].map(k => { const s = regSummary(k, 'lettuce', 'シスコ'); return s && s.ok ? `${k}:${s.crop}|phi${s.phi}|${s.uses}` : k + ':—'; }).join('  ');
    return out;
  });
  for (const k in r) console.log(k.padEnd(12), r[k]);
  console.log('errs', errs); await b.close();
})();
