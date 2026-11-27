// Garden at a glance: forecast alerts by day and by bed, how far along each crop is, an estimate of how wet each bed or
// pot is, weather tags on jobs, and the soil chips (family, pH, what's been dug in) for a bed or a crop.
// Everything here is worked out from what the app already keeps; nothing new is saved.

import { normalRain } from '../climate/climate.js';
import { dayName, frostRisk, NETTED, TALL, Weather } from '../climate/weather.js';
import { S } from '../core/state.js';
import { addDays, daysBetween, esc, shortDate, todayStr } from '../core/util.js';
import { FAMILIES } from '../data/catalog.js';
import { ui } from '../data/ui-icons.js';
import { feedTaskProduct } from '../feeding/plans.js';
import { crop, kin } from '../plants/crops.js';
import { logFeed } from '../records/log.js';
import { activeIn, container, isLive, planting } from './garden.js';
import { latestReading } from './soil.js';
import { bedLoss, bedPlan, groupOf, lastWatered, rainByDay, waterInterval, waterPots } from './watering.js';

// ---------- how far along ----------
// 0–100 from sowing / planting to the first harvest date; null when there's no estimate
export function maturity(p) {
  if (!p || !p.sowDate || !p.harvestDate || !isLive(p)) return null;
  const td = todayStr(), all = daysBetween(p.sowDate, p.harvestDate);
  if (all <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(daysBetween(p.sowDate, td) / all * 100)));
}
export const isReady = p => isLive(p) && !!p.harvestDate && p.harvestDate <= todayStr();

// ---------- forecast alerts, by day ----------
// tone: 'cold' (slate blue: frost, rain, wind), 'hot' (amber: heat, dry), 'ready' (terracotta: ready to pick)
const young = p => p.sowDate && p.sowDate <= todayStr() && daysBetween(p.sowDate, todayStr()) <= 21;
const outside = c => c && !c.indoor;
const cidsOf = ps => [...new Set(ps.map(p => p.containerId))].filter(id => outside(container(id)));
export function dayAlerts(date) {
  const d = Weather.days().find(x => x.date === date); if (!d) return [];
  const live = S.plantings.filter(isLive); if (!live.length) return [];
  const out = [], when = dayName(date);
  const fr = frostRisk().find(x => x.d.date === date);
  if (fr) {
    const names = [...new Set(fr.hit.map(p => crop(p.cropId).en))];
    out.push({ k: 'frost', tone: 'cold', date, icon: 'frost', cids: cidsOf(fr.hit), t: `<b>${fr.hard ? 'Hard frost' : 'Frost risk'}</b> ${when} ${Math.round(d.min)}°${names.length ? ` — cover ${esc(names.join(', '))}` : ' — nothing tender planted'}` });
  }
  if (d.rain >= 30) {
    const hit = live.filter(p => young(p) || isReady(p) || (p.harvestDate && p.harvestDate <= addDays(date, 7)));
    out.push({ k: 'rain', tone: 'cold', date, icon: 'rain', cids: cidsOf(hit), t: `<b>Heavy rain</b> ${when} ${Math.round(d.rain)} mm — check drainage${hit.length ? `, pick or cover ${esc([...new Set(hit.map(p => crop(p.cropId).en))].join(', '))}` : ''}` });
  }
  const gust = d.gust != null ? d.gust : d.wind * 1.6;
  if (gust >= 50) {
    const hit = live.filter(p => TALL.includes(kin(p.cropId)) || NETTED.includes(kin(p.cropId)) || (container(p.containerId) || {}).covers?.length);
    out.push({ k: 'wind', tone: 'cold', date, icon: 'wind', cids: cidsOf(hit), t: `<b>Strong wind</b> ${when} gusts ${Math.round(gust)} km/h — check supports &amp; covers` });
  }
  if (d.max >= 33) {
    const hit = live.filter(p => { const c = container(p.containerId); return outside(c) && (c.type !== 'bed' || young(p)); });
    out.push({ k: 'heat', tone: 'hot', date, icon: 'heat', cids: cidsOf(hit), t: `<b>Hot</b> ${when} ${Math.round(d.max)}° — water pots &amp; bags well${hit.some(young) ? ', shade young plants' : ''}` });
  }
  return out;
}
// every alert over the next five days
export const forecastAlerts = () => Weather.days().slice(0, 5).flatMap(d => dayAlerts(d.date));

// ---------- how wet: an estimate from the watering sums, unless the meter was read today ----------
// level: 0 dry · 1 drying · 2 moist · 3 wet; src: 'meter' | 'estimate' | null (nothing growing to estimate for)
export function moistureOf(c) {
  const td = todayStr();
  const r = (c.soil || []).filter(x => x.date === td && x.moistLvl).pop();
  if (r) { const l = /^DRY/.test(r.moistLvl) ? 0 : /^WET/.test(r.moistLvl) ? 3 : 2; return { level: l, src: 'meter' }; }
  if (!activeIn(c.id).length) return { level: null, src: null };
  let frac;   // share of the usable water left
  if (c.indoor) { const iv = 3, last = lastWatered('indoor'); frac = last ? 1 - daysBetween(last, td) / iv : 0.5; }
  else if (c.type === 'bed') {
    const w = bedPlan(c), rain = rainByDay(), last = lastWatered('bed:' + c.id);
    let d = last && daysBetween(last, td) <= 45 ? last : addDays(td, -21), used = 0;
    while (d < td) { d = addDays(d, 1); const mm = rain[d] != null ? rain[d] : normalRain(d); used = Math.min(25, Math.max(0, used + bedLoss(d) - mm)); }   // (days with no record: the usual rain, as the watering job counts them)
    frac = 1 - used / w.allow;
  } else {
    const pots = waterPots(); if (!pots.includes(c)) return { level: null, src: null };
    const iv = waterInterval(), last = S.water && S.water.lastDone, rain = rainByDay();
    let d = last && daysBetween(last, td) <= 30 ? last : addDays(td, -iv), b = last ? 1 : 0.5;
    while (d < td) { d = addDays(d, 1); b = Math.max(0, Math.min(1, b - 1 / iv + (rain[d] || 0) / 12)); }
    frac = b;
  }
  const level = frac <= 0.05 ? 0 : frac < 0.4 ? 1 : frac < 0.85 ? 2 : 3;
  return { level, src: 'estimate' };
}
export const MOIST = ['Dry', 'Drying', 'Moist', 'Wet'];
export const sunOf = c => c.indoor ? 'in' : (c.sun || 'full');
export const SUN = { full: ['Full sun', 'sun'], part: ['Part sun', 'partsun'], shade: ['Shade', 'shade'], in: ['Indoors', 'home'] };

// ---------- the dot on a bed: its most pressing alert ----------
// date: only that forecast day's alerts (the day picked in the forecast strip); otherwise the next five days
export function bedDots(c, date) {
  const al = (date ? dayAlerts(date) : forecastAlerts()).filter(a => a.cids.includes(c.id));
  const out = [];
  if (activeIn(c.id).some(isReady)) out.push({ tone: 'ready', t: 'Ready to harvest' });
  const hot = al.find(a => a.tone === 'hot'), cold = al.find(a => a.tone === 'cold');
  const m = !date || date === todayStr() ? moistureOf(c) : { level: null };
  if (hot) out.push({ tone: 'hot', t: hot.k === 'heat' ? 'Hot day coming' : 'Dry' });
  else if (m.level === 0) out.push({ tone: 'hot', t: m.src === 'meter' ? 'Meter reads dry' : 'Probably dry' });
  if (cold) out.push({ tone: 'cold', t: { frost: 'Frost', rain: 'Heavy rain', wind: 'Strong wind' }[cold.k] });
  return out;
}
export const dotsHTML = dots => dots.map(d => `<i class="adot ${d.tone}" title="${esc(d.t)}" aria-label="${esc(d.t)}"></i>`).join('');

// ---------- weather on a job ----------
// a job the forecast gets in the way of: { tone, text, act: 'skipWater' | 'moveJob', to } or null
const isFeed = t => !!feedTaskProduct(t) || /fertil|feed|side-dress|top-dress/i.test(t.title || '');
const isSpray = t => /spray/i.test(t.title || '');
const isSowing = t => ['plan_sow', 'sow'].includes(t.kind) || /^(sow|plant out|plant)\b/i.test(t.title || '');
export function jobWeather(t) {
  if (t.done || t.kind === 'wx' || t.kind === 'frost') return null;
  const days = Weather.days(); if (!days.length) return null;
  const td = todayStr(), due = t.due < td ? td : t.due, at = d => days.find(x => x.date === d);
  const word = d => { const n = dayName(d); return n === 'Today' ? 'today' : n === 'Tmrw' ? 'tmrw' : n; };
  const wet = d => { const x = at(d); return x && x.rain >= 5 && (x.pop == null || x.pop >= 50) ? x : null; };
  const rainDay = [due, addDays(due, 1)].map(wet).find(Boolean);
  if (t.kind === 'water' && rainDay) {
    const g = groupOf(t); if (g === 'indoor') return null;
    return { tone: 'cold', icon: 'rain', text: `${Math.round(rainDay.rain)}mm rain ${word(rainDay.date)}`, act: 'skipWater', to: addDays(rainDay.date, 1) };
  }
  if ((isFeed(t) || isSpray(t)) && rainDay) {
    let to = addDays(rainDay.date, 1); for (let i = 0; i < 5 && wet(to); i++) to = addDays(to, 1);
    return { tone: 'cold', icon: 'rain', text: `${Math.round(rainDay.rain)}mm rain ${word(rainDay.date)}`, act: 'moveJob', to, why: isSpray(t) ? 'it would wash the spray off' : 'it would wash the feed through' };
  }
  if (isSowing(t)) {
    const fr = [due, addDays(due, 1), addDays(due, 2)].map(at).find(x => x && x.min <= 0);
    if (fr) return { tone: 'cold', icon: 'frost', text: `frost ${word(fr.date)} ${Math.round(fr.min)}°` };
    const hot = at(due); if (hot && hot.max >= 33) return { tone: 'hot', icon: 'heat', text: `${Math.round(hot.max)}° ${word(due)}` };
  }
  return null;
}

// ---------- soil chips: family (for rotation), pH, what's been dug in ----------
export const familyName = f => f && f !== 'other' ? (FAMILIES[f] || [f[0].toUpperCase() + f.slice(1) + ' family'])[0] : '';
// what was dug in or spread over the last year: compost, lime, base fertiliser, other soil improvers
export function amendments(c, since = addDays(todayStr(), -365)) {
  const ids = new Set(S.plantings.filter(p => p.containerId === c.id).map(p => p.id));
  const out = [];
  for (const e of logFeed()) {
    if (e.date < since || e.date > todayStr()) continue;
    if (!(e.cids || []).includes(c.id) && !(e.pids || []).some(id => ids.has(id))) continue;
    const s = `${e.title || ''}`;
    const k = /lime|ash|calcium/i.test(s) ? 'Lime' : /compost|manure|bokashi|leaf mould|humus/i.test(s) ? 'Compost' : /base fert|base feed|starting fert/i.test(s) ? 'Base feed' : e.kind === 'soil' ? 'Soil improver' : null;
    if (k) out.push({ k, date: e.date });
  }
  const by = {}; for (const a of out) if (!by[a.k] || by[a.k] < a.date) by[a.k] = a.date;
  return Object.entries(by).sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([k, date]) => ({ k, date }));
}
// the chip row under a bed's or crop's header
export function soilChips(c, p) {
  if (!c) return '';
  const ps = p ? [p] : activeIn(c.id);
  const fams = [...new Set(ps.map(x => crop(x.cropId).family).filter(Boolean))];
  const r = latestReading(c, p ? p.from : undefined, p ? p.to : undefined, 365);
  const am = amendments(c);
  const chips = [];
  if (fams.length) chips.push(`<a class="schip" href="#/rotation">${ui('family', 16)}${esc(fams.map(familyName).filter(Boolean).join(' · ') || 'Family not set')}</a>`);
  chips.push(r && r.ph != null ? `<span class="schip">${ui('ph', 16)}pH ${r.ph} <small>${shortDate(r.date)}</small></span>` : `<button type="button" class="schip add" data-act="addReading">${ui('ph', 16)}pH: add reading</button>`);
  chips.push(am.length ? `<span class="schip">${ui('soil', 16)}${am.slice(0, 3).map(a => `${esc(a.k)} <small>${shortDate(a.date)}</small>`).join(' · ')}</span>` : `<span class="schip muted">${ui('soil', 16)}No compost or lime this year</span>`);
  return `<div class="schips">${chips.join('')}</div>`;
}
export const plantingOf = t => t && t.plantingId ? planting(t.plantingId) : null;
