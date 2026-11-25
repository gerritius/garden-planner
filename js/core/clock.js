// Time travel, on the test site only: the app can be moved to another date to see how plantings, jobs, feeding and
// harvests play out. The browser's clock is shifted by whole days before anything else runs (this module is the first
// thing the app loads), so every part of the app sees the same "today". The weather then comes from records (see
// weather.js): the real forecast is for the real today. The real site never moves.

import { IS_TEST, lsKey } from './site.js';

const RealDate = Date, KEY = lsKey('timeShift');
let shift = 0;   // days
if (IS_TEST) { try { shift = Math.round(+localStorage.getItem(KEY) || 0); } catch (e) { shift = 0; } }
if (shift) {
  const off = shift * 864e5;
  class TravelDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); }
    static now() { return RealDate.now() + off; }
  }
  globalThis.Date = TravelDate;
}
export const timeShift = () => shift;
// the real date, for things that must not move: which years of records exist, the real forecast
export const realNow = () => new RealDate(RealDate.now());
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const realToday = () => iso(realNow());
// move to a date (YYYY-MM-DD) or back to today (null); the app starts again there
export function travelTo(date) {
  if (!IS_TEST) return;
  const days = date ? Math.round((new RealDate(date + 'T12:00:00') - new RealDate(realToday() + 'T12:00:00')) / 864e5) : 0;
  try { if (days) localStorage.setItem(KEY, String(days)); else localStorage.removeItem(KEY); } catch (e) { return; }
  location.reload();
}
