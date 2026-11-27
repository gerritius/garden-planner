// Sprays: what you've entered from each spray's label — the crops it's for, how many days to wait before picking, and
// the most sprays allowed a season — and what follows from your spray log: waiting periods, sprays left, the "OK to
// pick?" board and bee warnings. The app looks nothing up: the rules are yours, from the label and your local law.

import { setChrome } from '../core/router.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, esc, shortDate, todayStr } from '../core/util.js';
import { container, isLive } from '../garden/garden.js';
import { crop, ic } from '../plants/crops.js';
import { myProducts, product } from './library.js';
import { ui } from '../data/ui-icons.js';

export const SPRAY_CAVEAT = 'The app doesn’t look up pesticide rules: crops, waiting times and limits are what you’ve entered from each label. Always follow the label and the rules where you live.';
// a spray's rule for a crop: { listed, phi, max } — listed false: you've entered crops for it, and this isn't one;
// null: you haven't entered any crops for it (the app can't say)
export function sprayRule(pr, cropId) {
  if (!pr) return null;
  const cs = pr.crops || {};
  if (!Object.keys(cs).length) return null;
  const r = cs[cropId]; if (!r) return { listed: false };
  return { listed: true, phi: +r.phi || 0, max: r.max == null || r.max === '' ? null : +r.max };
}
export const waitText = phi => phi ? (phi === 1 ? 'wait 1 day before picking' : `wait ${phi} days before picking`) : 'no wait before picking';
// how many times a product has been logged on this planting this season
export function usesSoFar(p, prodId) {
  const pr = product(prodId);
  return (S.log || []).filter(e => e.kind === 'spray' && (e.productId === prodId || (pr && e.product && (e.product === pr.en || e.product === pr.ja))) && (!p.sowDate || e.date >= p.sowDate) &&
    ((e.pids || []).includes(p.id) || (e.cids || []).includes(p.containerId) || (!(e.pids || []).length && !(e.cids || []).length))).length;
}
// your sprays listed for this crop (with uses left on this planting)
export function spraysFor(p) {
  return myProducts(['spray', 'homemade']).map(pr => ({ pr, r: sprayRule(pr, p.cropId) })).filter(x => x.r && x.r.listed)
    .map(x => Object.assign(x, { left: x.r.max == null ? null : Math.max(0, x.r.max - usesSoFar(p, x.pr.id)) }));
}

// ---------- crop page: your sprays and this crop ----------
export function spraySection(p) {
  const sprays = myProducts(['spray', 'homemade']);
  if (!sprays.length) return '';
  const n = crop(p.cropId).en;
  const cards = sprays.map(pr => {
    const r = sprayRule(pr, p.cropId), icon = pr.kind === 'homemade' ? '🧪' : pr.organic ? '🌱' : '⚗️';
    if (!r) return `<li><a href="#/product/${pr.id}"><span class="lic">${icon}</span><span class="grow"><b>${esc(pr.en)}</b><small>No crops entered for it — check its label for ${esc(n)}, the waiting time and the limit (or add them to the product).</small></span>›</a></li>`;
    if (!r.listed) return `<li class="no"><a href="#/product/${pr.id}"><span class="lic">🚫</span><span class="grow"><b>${esc(pr.en)}</b><small>${esc(n)} isn’t one of the crops you entered for it — check its label before using it on this crop.</small></span>›</a></li>`;
    const left = r.max == null ? null : r.max - usesSoFar(p, pr.id);
    return `<li class="${left === 0 ? 'no' : ''}"><a href="#/product/${pr.id}"><span class="lic">${icon}</span><span class="grow"><b>${esc(pr.en)}</b>${pr.organic ? ' <span class="orgchip">organic</span>' : ''}
      <small>${pr.what ? esc(pr.what) + ' · ' : ''}<b>${waitText(r.phi)}</b> · ${r.max == null ? 'no limit entered' : `<b>${left} of ${r.max} sprays left</b>`}</small></span>›</a></li>`;
  });
  return `<section><h3>Your sprays</h3><ul class="plist log sprays">${cards.join('')}</ul><p class="hint">${SPRAY_CAVEAT}</p></section>`;
}

// ---------- spray waiting period (pre-harvest interval) ----------
export function sprayHolds(p, today = todayStr()) {
  if (!p || p.status === 'harvested') return [];
  return (S.log || []).filter(e => e.kind === 'spray' && +e.phi > 0 && addDays(e.date, +e.phi) > today && e.date <= today &&
    (!p.sowDate || p.sowDate <= e.date) &&
    ((e.pids || []).includes(p.id) || (e.cids || []).includes(p.containerId) || (!(e.pids || []).length && !(e.cids || []).length)))
    .map(e => ({ until: addDays(e.date, +e.phi), e })).sort((a, b) => (a.until < b.until ? 1 : -1));
}
export function sprayBanner(p) {
  const h = sprayHolds(p)[0]; if (!h) return '';
  return `<div class="banner warn">${ui('spray', 18)} Sprayed <b>${esc(h.e.product || 'pesticide')}</b> on ${shortDate(h.e.date)} — <b>don’t pick until ${shortDate(h.until)}</b> (${h.e.phi}-day wait).</div>`;
}
export function sprayAlerts() {
  const act = S.plantings.filter(isLive), by = {};
  for (const p of act) { const h = sprayHolds(p)[0]; if (h) (by[h.until] = by[h.until] || []).push([p, h]); }
  const ks = Object.keys(by).sort(); if (!ks.length) return '';
  return `<a class="banner warn" href="#/picksafe">${ui('spray', 18)} <b>Spray waiting period</b> — don’t pick ${ks.map(u => `${by[u].map(([p]) => esc(crop(p.cropId).en)).join(', ')} until <b>${shortDate(u)}</b>`).join('; ')}.</a>`;
}

// ---------- the "OK to pick?" board ----------
export function pagePickSafe() {
  setChrome('OK to pick?', { back: true, kicker: 'Spray waiting periods' });
  const td = todayStr(), act = S.plantings.filter(isLive);
  const rows = act.map(p => ({ p, h: sprayHolds(p)[0] || null })).sort((a, b) => (!!b.h - !!a.h) || ((a.h && a.h.until) < (b.h && b.h.until) ? -1 : 1));
  const html = `${rows.length ? `<ul class="plist pick">${rows.map(({ p, h }) => { const c = container(p.containerId), n = h ? daysBetween(td, h.until) : 0, ready = p.harvestDate && p.harvestDate <= td;
    return `<li class="${h ? 'hold' : 'okp'}"><a href="#/plant/${p.id}"><span class="lic">${h ? '⛔' : '✅'}</span>${ic(p.cropId)}<span class="grow"><b>${esc(crop(p.cropId).en)}</b> · ${esc(c ? c.name : '')}
      <small>${h ? `Wait <b>${n} day${n === 1 ? '' : 's'}</b> — until ${shortDate(h.until)} (${esc(h.e.product || 'spray')} on ${shortDate(h.e.date)})` : 'OK to pick — no spray waiting period'}${ready ? ' · 🧺 ready' : p.harvestDate ? ` · ready from ${shortDate(p.harvestDate)}` : ''}</small></span>›</a></li>`; }).join('')}</ul>` : '<div class="empty-state">Nothing growing.</div>'}
    <p class="hint">From the sprays in your log and the waiting time entered with each one. Log every spray so this stays right.</p>`;
  return { html };
}

// ---------- bees ----------
// Insecticide ingredients that harm bees, by kind, so any product can be checked from what you've entered for it.
const BEE_HARM = [
  ['neonicotinoid', 'very harmful to bees, and lasts in the plant (and its flowers) for weeks', ['imidacloprid', 'clothianidin', 'thiamethoxam', 'dinotefuran', 'acetamiprid', 'thiacloprid', 'nitenpyram', 'sulfoxaflor']],
  ['pyrethroid', 'harmful to bees on contact', ['permethrin', 'cypermethrin', 'deltamethrin', 'cyhalothrin', 'bifenthrin', 'etofenprox', 'fenpropathrin', 'fenvalerate', 'tralomethrin', 'acrinathrin', 'cyfluthrin', 'silafluofen']],
  ['pyrethrin', 'harmful to bees while wet, but breaks down within a day', ['pyrethrin', 'pyrethrum']],
  ['organophosphate', 'very harmful to bees', ['malathion', 'fenitrothion', 'diazinon', 'chlorpyrifos', 'acephate', 'dimethoate', 'fenthion', 'dichlorvos', 'prothiofos']],
  ['carbamate', 'very harmful to bees', ['carbaryl', 'methomyl', 'benfuracarb', 'carbosulfan']],
  ['spinosyn', 'harmful to bees while wet; safe once dry', ['spinosad', 'spinetoram']],
  ['other', 'harmful to bees', ['fipronil', 'abamectin', 'emamectin', 'chlorfenapyr']],
];
// the bee-harmful ingredients in a product: [{ name, kind, why }]
export function beeHarm(p) {
  if (!p) return [];
  const text = [p.en, p.what, p.organicNote, ...(p.notes || [])].filter(Boolean).join(' ').toLowerCase(), out = [];
  const has = w => new RegExp(`(^|[^a-z])${w}($|[^a-z])`).test(text);   // (whole words)
  for (const [kind, why, list] of BEE_HARM) for (const en of list) if (has(en)) out.push({ name: en, kind, why });
  return out.filter(m => !out.some(o => o !== m && o.name.includes(m.name)));   // permethrin is part of cypermethrin
}
// for the spray days page: the general rule, and which of your sprays it applies to
export function beeNote() {
  const mine = myProducts('spray').map(p => ({ p, h: beeHarm(p) })).filter(x => x.h.length);
  return `<li>Many insecticides harm bees: neonicotinoids (e.g. imidacloprid, clothianidin, dinotefuran), pyrethroids and pyrethrins, organophosphates, carbamates, spinosad and fipronil among them. Spray early in the morning or late in the afternoon, never onto open flowers, and not when bees are about.${mine.length ? `<br>Of your sprays: ${mine.map(x => `<b>${esc(x.p.en)}</b> (${[...new Set(x.h.map(h => h.name))].join(', ')} — ${esc(x.h[0].why)})`).join('; ')}.` : ''}</li>`;
}
