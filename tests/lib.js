// Shared set-up for the scenario tests: a phone-sized browser on Tokyo time, with the clock fixed so results
// don't change from day to day. Every scenario opens the app at http://localhost:8765/ (the runner serves it there).
const { devices } = require('playwright');
const FIXED_NOW = new Date('2026-11-18T10:00:00+09:00');
// options: anything Playwright's newContext takes, plus openFolds: keep the planting form's folded sections open
// (for scenarios that fill in fields under "More options").
async function newContext(browser, extra = {}) {
  const { openFolds, ...opts } = extra;
  const ctx = await browser.newContext(Object.assign({}, devices['Pixel 7'], { timezoneId: 'Asia/Tokyo' }, opts));
  await ctx.clock.setFixedTime(FIXED_NOW);   // Date.now / new Date() return this; timers still run normally
  // no outside network: weather and Google are simulated by the scenarios that need them (their own routes take priority)
  await ctx.route(u => !['localhost', '127.0.0.1'].includes(u.hostname), r => r.abort());
  if (openFolds) await ctx.addInitScript(() => setInterval(() => document.querySelectorAll('#pf details:not([open])').forEach(d => { d.open = true; }), 30));
  return ctx;
}
module.exports = { newContext, FIXED_NOW };
