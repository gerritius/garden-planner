// Season planning: planned crops, prep jobs counted back from planting day, free spaces, the season timeline and the
// shopping list for upcoming plans.

import { NETTED, TALL } from '../climate/weather.js';
import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { addDays, daysBetween, esc, niceDate, pd, shortDate, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { amtFor } from '../feeding/nutrients.js';
import { crop, cropName, ic, kin } from '../plants/crops.js';
import { harvestEstimate, KEPT } from '../plants/growth.js';
import {
  planStartLinks, startLeft, startPlanted, startWhere, syncStartTasks, tpDays, traySowFor, traySowPlan
} from '../plants/seedlings.js';
import { productByName } from '../products/library.js';
import { fmtTot, purchaseDialog, unitBase } from '../records/review.js';
import { container, endOf, isLive, isPlanned, sectionOf, sizeLabel } from './garden.js';
import { gapLi } from './ideas.js';
import { syncTasks, toggleTask } from './tasks.js';

// ---------- planned plantings → jobs counted back from planting day ----------
export const raisable = id => tpDays(id) > 0;
export const linkedStart = p => (S.starts || []).find(s => s.planId === p.id && s.status === 'growing');
function planItems(p) {
  const c = container(p.containerId), cr = crop(p.cropId), sd = p.sowDate, td = todayStr(), items = [], dayOf = [];
  const where = c ? c.name + (sectionOf(p) ? ' ' + sectionOf(p) : '') : '';
  for (const f of p.fert || []) {
    if (!f.product) continue;
    const pr = productByName(f.product), wait = pr ? +pr.wait || 0 : 14, amt = amtFor(f.product, f.amount, f.unit), due = addDays(sd, -wait);
    if (wait > 0) items.push({ key: 'prep:' + f.product, kind: 'plan_prep', due, title: `Dig in ${f.product}${amt ? ' ' + amt : ''} — for ${cr.en} (${where})${due < td ? ` · short notice: best ${wait} days before planting` : ''}` });
    else dayOf.push(`${f.product}${amt ? ' ' + amt : ''}`);
  }
  if ((p.raise === 'tray' || p.raise === 'pot') && raisable(p.cropId) && !linkedStart(p))
    items.push({ key: 'tray', kind: 'plan_tray', due: traySowFor(p.cropId, sd), title: `Sow ${cr.en}${p.variety ? ' · ' + p.variety : ''} seeds in a tray or small pots (to plant out ${shortDate(sd)})` });
  items.push({ key: 'sow', kind: 'plan_sow', due: sd, title: `${p.method === 'seed' ? 'Sow' : 'Plant out'} ${cr.en}${p.variety ? ' · ' + p.variety : ''}${dayOf.length ? ` — mix in ${dayOf.join(' + ')} first` : ''}` });
  return items;
}
export function syncPlanTasks(p) {
  const td = todayStr(), skip = p.planSkip || [], items = planItems(p).filter(i => !skip.includes(i.key));
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && t.plan && !t.done && !items.some(i => i.key === t.key)));
  for (const i of items) {
    const ex = S.tasks.find(t => t.plantingId === p.id && t.plan && t.key === i.key);
    const due = i.kind !== 'plan_sow' && i.due < td ? td : i.due;
    if (ex) { if (ex.done) continue; ex.title = i.title; ex.kind = i.kind; if (!ex.manualDue) ex.due = due; }
    else S.tasks.push({ id: uid(), plantingId: p.id, plan: true, kind: i.kind, key: i.key, title: i.title, due, done: false });
  }
}
// the planned crop goes in: becomes a normal planting, dates shift to the real day
export function activatePlan(p, date, n) {
  const delta = daysBetween(p.sowDate, date);
  p.status = 'active'; p.plannedFor = p.sowDate;
  if (delta) {
    p.sowDate = date;
    if (p.harvestDate) p.harvestDate = p.harvestFixed ? addDays(p.harvestDate, delta) : harvestEstimate(p);
    if (p.thinDate) p.thinDate = addDays(p.thinDate, delta);
    for (const s of p.series || []) if (s.start) s.start = addDays(s.start, delta);
  }
  const s = linkedStart(p);
  if (s && startLeft(s) > 0) startPlanted({ startId: s.id, startN: Math.min(startLeft(s), n || startLeft(s)) }, p);
  syncTasks(p);
}
export function undoActivate(p) {
  p.status = 'planned';
  if (p.plannedFor && p.plannedFor !== p.sowDate) { const back = daysBetween(p.sowDate, p.plannedFor); p.sowDate = p.plannedFor; if (p.harvestDate) p.harvestDate = addDays(p.harvestDate, back); if (p.thinDate) p.thinDate = addDays(p.thinDate, back); for (const s of p.series || []) if (s.start) s.start = addDays(s.start, back); }
  for (const s of S.starts || []) { const i = (s.events || []).findIndex(e => e.pid === p.id); if (i >= 0) { s.events.splice(i, 1); s.status = 'growing'; s.planId = p.id; syncStartTasks(s); } }
  S.tasks = S.tasks.filter(t => !(t.plantingId === p.id && !t.done && !t.plan));
  syncPlanTasks(p);
}
export function planTrayPreset(p) {
  const c = container(p.containerId); let n = 0;
  try { n = c ? Draw.count(c, p) : 0; } catch (e) { /* ignore */ }
  return { cropId: p.cropId, variety: p.variety || '', kind: p.raise === 'pot' ? 'pot' : 'tray', count: n ? Math.ceil(n * 1.25) : '', planId: p.id };
}

// ---------- planning bits on the planting form ----------
export function planFormBits(d, c) {
  if (!d.sowDate || d.sowDate <= todayStr()) return '';
  const cr = d.cropId ? crop(d.cropId) : null;
  // seedlings: bought, or sown from seed by you (in a tray or small pots — which, you say when you sow them). Already
  // linked to seedlings you've started: those are shown instead of the choice.
  const linked = d.useStart ? null : d.id && linkedStart(d);
  const raise = cr && d.method === 'seedling' && raisable(cr.id) && !d.useStart && !linked;
  const own = d.raise === 'tray' || d.raise === 'pot';
  return `<div class="plannote">📅 <b>Planned</b> — saved as a plan. Prep jobs are counted back from this date${raise ? ', plus a reminder to sow seedlings' : ''}; it goes into the bed when you tick “${d.method === 'seed' ? 'Sow' : 'Plant out'}”.</div>
    ${linked ? `<p class="hint">🌱 Seedlings: yours, sown ${shortDate(linked.sowDate)} in ${esc(startWhere(linked).toLowerCase())}.</p>` : ''}
    ${raise ? `<label>Seedlings<div class="seg">${[['buy', 'Buy them', !own], ['tray', 'Sow from seed', own]].map(([v, l, on]) => `<button type="button" data-act="raise" data-v="${v}" class="${on ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${own ? `<small class="hint">${(() => { const tp = traySowPlan(cr.id, d.sowDate), where = (KEPT.find(k => k[0] === tp.kept) || KEPT[0])[1].toLowerCase(); return `Sow them around <b>${shortDate(tp.sow)}</b> (about ${daysBetween(tp.sow, d.sowDate)} days before at that time of year)${tp.kept !== 'out' ? `, kept <b>${esc(where)}</b> — outside it’s too cold for them to be ready in time` : ''}${tp.late ? '. Even then they may be a little small — buying seedlings is the easy option' : ''}.`; })()}</small>` : ''}</label>` : ''}`;
}

// ---------- gaps & suggestions ----------
export function freeGaps(c, horizon = 300) {
  const td = todayStr(), end = addDays(td, horizon), L = Draw.dims(c).L;
  const ps = S.plantings.filter(p => p.containerId === c.id && (isLive(p) || isPlanned(p)));
  const cuts = [...new Set([0, L, ...ps.flatMap(p => [p.from, p.to])])].filter(x => x >= 0 && x <= L).sort((a, b) => a - b);
  const raw = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1]; if (b - a < 5) continue;
    const occ = ps.filter(p => p.from < b - 0.5 && p.to > a + 0.5).map(p => ({ p, s: isLive(p) ? td : p.sowDate, e: endOf(p) })).sort((x, y) => (x.s < y.s ? -1 : 1));
    let cur = td, prev = null;
    for (const o of occ) {
      if (o.e < cur) { prev = o.p; continue; }
      if (daysBetween(cur, o.s) >= 21) raw.push({ a, b, s: cur, e: addDays(o.s, -1), prev, next: o.p });
      if (o.e >= cur) { cur = addDays(o.e, 1); prev = o.p; }
    }
    if (daysBetween(cur, end) >= 21) raw.push({ a, b, s: cur, e: null, prev, next: null });
  }
  const out = [];
  for (const g of raw.sort((x, y) => (x.s < y.s ? -1 : x.s > y.s ? 1 : x.a - y.a))) {
    const m = out.find(o => o.s === g.s && o.e === g.e && o.b === g.a);
    if (m) { m.b = g.b; m.prev = m.prev || g.prev; m.next = m.next || g.next; } else out.push(Object.assign({}, g));
  }
  return out.sort((x, y) => (x.s < y.s ? -1 : 1));
}

// ---------- timeline ----------
function planTimeline(c, t0, t1) {
  const span = daysBetween(t0, t1), pct = d => Math.max(0, Math.min(100, daysBetween(t0, d) / span * 100));
  const ps = S.plantings.filter(p => p.containerId === c.id && (isLive(p) || isPlanned(p) || (p.status === 'harvested' && (p.harvestedOn || '') >= t0)));
  const rows = [];
  for (const p of ps.sort((a, b) => a.from - b.from || (a.sowDate < b.sowDate ? -1 : 1))) {
    const k = sectionOf(p) || 'all', r = rows.find(x => x.k === k) || (rows.push({ k, ps: [] }), rows[rows.length - 1]); r.ps.push(p);
  }
  const td = todayStr();
  return `<div class="tl">${rows.map(r => `<div class="tlrow"><span class="tll">${r.k === 'all' ? '' : esc(r.k)}</span><div class="tlbar">${r.ps.map(p => {
    const s = p.sowDate || td, e = endOf(p); if (e < t0 || s > t1) return '';
    const l = pct(s), w = Math.max(2, pct(e) - l);
    return `<a href="#/plant/${p.id}" class="tlb${isPlanned(p) ? ' planned' : ''}${p.status === 'harvested' ? ' done' : ''}" style="left:${l}%;width:${w}%;--c:${crop(p.cropId).color}" title="${esc(crop(p.cropId).en)}">${esc(crop(p.cropId).en)}</a>`; }).join('')}<i class="tlnow" style="left:${pct(td)}%"></i></div></div>`).join('') || '<p class="muted small">Nothing growing or planned.</p>'}</div>`;
}
function monthTicks(t0, t1) {
  const span = daysBetween(t0, t1), out = [];
  for (let d = pd(t0); d < pd(t1); d.setMonth(d.getMonth() + 1)) { out.push(`<span style="left:${daysBetween(t0, ymd(d)) / span * 100}%">${d.toLocaleDateString('en-AU', { month: 'short' })}</span>`); }
  return `<div class="tlmonths"><span class="tll"></span><div class="tlbar">${out.join('')}</div></div>`;
}
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function planRange() { const now = new Date(); const t0 = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), t1 = ymd(new Date(now.getFullYear(), now.getMonth() + 9, 1)); return [t0, t1]; }
export function pagePlan() {
  setChrome('Season plan', { back: true, kicker: 'What’s growing when — and what could go in the gaps' });
  const [t0, t1] = planRange(), cs = S.containers.filter(c => c.type !== 'nursery').sort((a, b) => (a.type === 'bed') === (b.type === 'bed') ? 0 : a.type === 'bed' ? -1 : 1);
  const html = `<div class="btnrow"><a class="btn small" href="#/rotation">🔄 Rotation for next year</a><a class="btn small" href="#/shop">🛒 What to buy</a></div><p class="hint">Bars run from sowing/planting to the end of picking. <span class="tlkey planned">Striped</span> = planned. Tap a free gap’s crop to plan it — prep jobs are added counting back from the planting date.</p>
    ${cs.map(c => { const gs = freeGaps(c).slice(0, 4); return `<section class="plan"><h3><a href="#/container/${c.id}">${esc(c.name)}</a> <small class="muted">${esc(sizeLabel(c))}</small></h3>
      ${monthTicks(t0, t1)}${planTimeline(c, t0, t1)}
      ${gs.length ? `<ul class="gaps">${gs.map(g => gapLi(c, g)).join('')}</ul>` : '<p class="muted small">No gaps longer than 3 weeks.</p>'}</section>`; }).join('') || '<div class="empty-state">Add a bed or pot first.</div>'}`;
  return { html };
}
// on the bed page
export function planSection(c) {
  const planned = S.plantings.filter(p => p.containerId === c.id && isPlanned(p)).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
  const gs = freeGaps(c).filter(g => g.s > todayStr()).slice(0, 3);
  return `<section><h3>${planned.length ? 'Planned' : 'Free space coming up'}</h3>
    ${planned.length ? `<ul class="plist">${planned.map(p => `<li><a href="#/plant/${p.id}">${ic(p.cropId)}<span class="grow"><b>${esc(cropName(p.cropId))}</b>${p.variety ? ` · ${esc(p.variety)}` : ''}<small>${sectionOf(p) ? sectionOf(p) + ' · ' : ''}${p.method === 'seed' ? 'sow' : 'plant'} ${shortDate(p.sowDate)}${p.raise === 'tray' || p.raise === 'pot' ? ` · raise seedlings from ${shortDate(traySowFor(p.cropId, p.sowDate))}` : ''}</small></span>›</a></li>`).join('')}</ul>` : (gs.length ? '' : '<p class="muted">Nothing planned yet.</p>')}
    ${gs.length ? `<ul class="gaps">${gs.map(g => gapLi(c, g)).join('')}</ul>` : ''}
    <div class="btnrow"><a class="btn small" href="#/plant/new/${c.id}?plan=1">📅 Plan a crop</a><a class="btn small" href="#/plan">Season plan →</a></div></section>`;
}
// on the plant page
export function planBanner(p) {
  const c = container(p.containerId);
  if (isPlanned(p)) {
    A.doPlant = () => { const t = S.tasks.find(t => t.plantingId === p.id && t.kind === 'plan_sow' && !t.done); if (t) toggleTask(t.id, true); else { activatePlan(p, todayStr()); save().then(render); } };
    const ls = linkedStart(p);
    return `<div class="banner plan">📅 Planned for <b>${niceDate(p.sowDate)}</b>${p.raise === 'tray' || p.raise === 'pot' ? ` · seedlings ${ls ? `growing in ${esc(startWhere(ls).toLowerCase())} (sown ${shortDate(ls.sowDate)})` : `to sow ${shortDate(traySowFor(p.cropId, p.sowDate))}`}` : ''}
      ${planStartLinks(p)}<div class="btnrow"><button class="btn small primary" data-act="doPlant">${p.method === 'seed' ? '🌱 Sown it' : '🌱 Planted it'}</button></div></div>`;
  }
  if (!isLive(p) || !c) return '';
  return '';
}
export function planNextButton(p) {
  const c = container(p.containerId); if (!c || !isLive(p)) return '';
  const next = S.plantings.find(x => isPlanned(x) && x.containerId === c.id && x.from < p.to - 0.5 && x.to > p.from + 0.5);
  return next ? `<a class="btn" href="#/plant/${next.id}">📅 Next: ${esc(crop(next.cropId).en)} ${shortDate(next.sowDate)}</a>`
    : `<a class="btn" href="#/plant/new/${c.id}?plan=1&from=${p.from}&to=${p.to}&date=${addDays(endOf(p), 1)}">📅 Plan next here</a>`;
}

// ---------- shopping list for upcoming plans ----------
function shopItems(weeks) {
  const td = todayStr(), until = addDays(td, weeks * 7), items = [];
  const plans = S.plantings.filter(p => isPlanned(p) && p.sowDate <= until).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
  const count = p => { try { const c = container(p.containerId); return c ? Draw.count(c, p) : 0; } catch (e) { return 0; } };
  for (const p of plans) {
    const c = container(p.containerId), cr = crop(p.cropId), where = (c ? c.name : '') + (sectionOf(p) ? ' ' + sectionOf(p) : ''), n = count(p);
    if (p.method === 'seedling' && (p.raise || 'buy') === 'buy' && !linkedStart(p)) items.push({ key: 'sl:' + p.id, cat: 'seedlings', title: `${cr.en}${p.variety ? ' · ' + p.variety : ''} seedlings${n ? ' × ' + n : ''}`, sub: `for ${where} · plant ${shortDate(p.sowDate)}`, by: addDays(p.sowDate, -1) });
    else { const sowBy = p.raise === 'tray' || p.raise === 'pot' ? traySowFor(p.cropId, p.sowDate) : p.sowDate; items.push({ key: 'sd:' + p.id, cat: 'seeds', title: `${cr.en}${p.variety ? ' · ' + p.variety : ''} seed`, sub: `have enough? sow ${shortDate(sowBy)} · ${where}`, by: sowBy }); }
    if (NETTED.includes(kin(p.cropId)) && c) { const w = c.type === 'bed' ? c.width : c.diameter || c.width, l = c.type === 'bed' ? p.to - p.from : c.diameter || c.length;
      items.push({ key: 'net:' + p.id, cat: 'netting', title: `Insect netting for ${cr.en}`, sub: `${where} · about ${((w + 90) / 100).toFixed(1)} × ${((l + 90) / 100).toFixed(1)} m with hoops (0.8 mm mesh or finer)`, by: p.sowDate }); }
    if (TALL.includes(kin(p.cropId))) items.push({ key: 'sup:' + p.id, cat: 'supports', title: `Supports for ${cr.en}`, sub: `${where} · ${['snappea', 'sayaendo', 'kyuri', 'ingen'].includes(kin(p.cropId)) ? 'poles + climbing net (きゅうりネット)' : 'stakes (支柱) and ties'}`, by: p.sowDate });
  }
  // fertiliser / compost / lime needed for planned crops, totalled by product
  const tot = {};
  for (const p of plans) for (const f of p.fert || []) { if (!f.product || f.amount == null) continue; const [base, mul] = unitBase(f.unit || 'g'); const k = f.product + '|' + base; tot[k] = (tot[k] || 0) + f.amount * mul; }
  for (const [k, v] of Object.entries(tot)) { const [prod, base] = k.split('|'); items.push({ key: 'f:' + prod, cat: 'feed', title: prod, sub: `${fmtTot(v, base)} for the planned crops — check what’s left in the bag`, by: null }); }
  return items;
}
const SHOP_CATS = [['seedlings', '🌱 Seedlings to buy'], ['seeds', '🫘 Seed to sow'], ['feed', '🌿 Fertiliser, compost & lime'], ['netting', '🕸️ Netting'], ['supports', '🪵 Supports']];
export function pageShop(q) {
  const weeks = +q.get('w') || 6;
  setChrome('What to buy', { back: true, kicker: `For crops planned in the next ${weeks} weeks` });
  const items = shopItems(weeks), done = S.shopDone || {};
  A.shopTick = async el => { S.shopDone = Object.assign({}, S.shopDone); if (S.shopDone[el.dataset.k]) delete S.shopDone[el.dataset.k]; else S.shopDone[el.dataset.k] = todayStr(); await save(); render(); };
  A.shopBuy = el => purchaseDialog(null, { item: el.dataset.t, cat: el.dataset.c === 'feed' ? 'fert' : el.dataset.c === 'seedlings' ? 'seedlings' : el.dataset.c === 'seeds' ? 'seeds' : el.dataset.c === 'netting' ? 'net' : 'support' });
  const html = `<div class="filt">${[2, 4, 6, 10].map(w => `<a class="chip ${w === weeks ? 'on' : ''}" href="#/shop?w=${w}">${w} wks</a>`).join('')}</div>
    ${items.length ? SHOP_CATS.map(([k, l]) => { const its = items.filter(i => i.cat === k); return its.length ? `<section><h3>${l}</h3><ul class="plist shop">${its.map(i => `<li class="${done[i.key] ? 'got' : ''}"><label class="chk"><input type="checkbox" data-act="shopTick" data-k="${esc(i.key)}"${done[i.key] ? ' checked' : ''}><span></span></label>
      <span class="grow"><b>${esc(i.title)}</b><small>${esc(i.sub)}${i.by ? ` · by ${shortDate(i.by < todayStr() ? todayStr() : i.by)}` : ''}</small></span><button class="btn small" data-act="shopBuy" data-t="${esc(i.title)}" data-c="${k}">💴</button></li>`).join('')}</ul></section>` : ''; }).join('')
    : `<div class="empty-state">Nothing planned in the next ${weeks} weeks.<br><a class="btn" href="#/plan">📅 Season plan</a></div>`}
    <p class="hint">From your planned crops (Season plan). Tick things off as you get them; 💴 records the purchase in Spending.</p>`;
  return { html };
}
