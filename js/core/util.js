// Small helpers used everywhere: DOM shortcuts, escaping, ids, dates, numbers, amounts, idle-time queue.

import { HANDFUL_G, UNITS } from '../data/catalog.js';

// ---------- helpers ----------
/* Garden Planner — single-page app. Data stays on this device (IndexedDB). */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const todayStr = () => iso(new Date());
export const pd = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return iso(d); };
export const addInterval = (s, every, per) => {
  const d = pd(s);
  if (per === 'day') d.setDate(d.getDate() + every);
  else if (per === 'week') d.setDate(d.getDate() + 7 * every);
  else d.setMonth(d.getMonth() + every);
  return iso(d);
};
export const daysBetween = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
export const niceDate = s => s ? pd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
export const shortDate = s => s ? pd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
export const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
export const go = h => { location.hash = h; };

// ---------- amounts with units ----------
export function fmtAmt(amount, unit) {
  if (amount == null || amount === '') return '';
  if (unit === 'handful') return `${amount} handful${+amount === 1 ? '' : 's'} (~${Math.round(amount * HANDFUL_G)} g)`;
  return `${amount} ${unit || 'g'}`;
}
export const unitOpts = sel => UNITS.map(u => `<option value="${u}"${sel === u ? ' selected' : ''}>${u === 'handful' ? 'handfuls' : u}</option>`).join('');

// ---------- one at a time, in idle moments ----------
export const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
// one at a time, in idle moments, so scrolling stays smooth
const _idleQ = [];
let _idleBusy = false;
export function queueIdle(fn) {
  _idleQ.push(fn); if (_idleBusy) return; _idleBusy = true;
  const step = () => { const f = _idleQ.shift(); if (!f) { _idleBusy = false; return; } try { f(); } catch (e) { console.warn(e); } (window.requestIdleCallback || (cb => setTimeout(cb, 16)))(step); };
  (window.requestIdleCallback || (cb => setTimeout(cb, 16)))(step);
}
