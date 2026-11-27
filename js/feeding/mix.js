// Potting mix in pots and bags: fresh or re-used, what fertiliser it already holds, and choosing it when planting.

import { render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { esc, shortDate, todayStr, uid } from '../core/util.js';
import { planting } from '../garden/garden.js';
import { yearOfD } from '../garden/rotation.js';
import { crop } from '../plants/crops.js';
import { libGet, libList } from '../products/library.js';

// ---------- potting mix in bags ----------
export function mixState(c, beforeDate) {
  if (c.type === 'bed') return null;
  const ev = (c.mixLog || []).filter(e => !beforeDate || e.date <= beforeDate).sort(mixSort).pop();
  if (!ev) return null;
  const cropsSince = [...S.plantings.filter(p => p.containerId === c.id && p.sowDate && p.sowDate >= ev.date && (!beforeDate || p.sowDate < beforeDate)), ...(c.history || []).filter(h => h.sowDate && h.sowDate >= ev.date && (!beforeDate || h.sowDate < beforeDate) && !S.plantings.some(p => p.id === h.plantingId))];
  return Object.assign({}, ev, { firstCrop: ev.fresh && !cropsSince.length, mix: mixRow(ev.kind) });
}
export function mixDialog(c) {
  const td = todayStr(), cur = mixState(c);
  modal(`<h3>Potting mix — ${esc(c.name)}</h3><form id="mxf" class="form">
      <label>Mix<select name="kind">${mixList().map(([k, en, ja]) => `<option value="${k}"${(cur ? cur.kind : 'iris') === k ? ' selected' : ''}>${esc(en)} ${esc(ja)}</option>`).join('')}</select></label>
      <div class="seg"><button type="button" data-f="1" class="on">Fresh mix</button><button type="button" data-f="0">Re-used (roots sieved out)</button></div>
      <p class="hint">For fills before you started using the app. New plantings record this themselves — choose Fresh mix or Re-used in the planting form.</p>
      <label>Filled on<input name="date" type="date" value="${td}" max="${td}"></label>
      <p class="hint">Fertiliser built into the mix is counted from the fill date, using what you’ve set for that mix under Tools → Products (N-P-K, how much, how long it lasts). Amounts are estimates — the bags don’t print them. Any fertiliser you mix in when refreshing is counted separately (record it as the crop’s starting fertiliser).</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>
    ${(c.mixLog || []).length ? `<ul class="plist">${c.mixLog.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(e => `<li><span class="grow">${shortDate(e.date)} ${yearOfD(e.date)} · ${e.fresh ? 'fresh' : 're-used'} ${esc(mixRow(e.kind)[1])}${e.pid && planting(e.pid) ? ` <small>with ${esc(crop(planting(e.pid).cropId).en)}</small>` : ''}</span><button class="link danger" data-delmix="${e.id}">remove</button></li>`).join('')}</ul>` : ''}`, (m, close) => {
    const f = m.querySelector('#mxf'); let fresh = true;
    m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { fresh = b.dataset.f === '1'; m.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelectorAll('[data-delmix]').forEach(b => b.onclick = async () => { c.mixLog = c.mixLog.filter(e => e.id !== b.dataset.delmix); await save(); close(); render(); });
    f.onsubmit = async e => { e.preventDefault(); (c.mixLog = c.mixLog || []).push({ id: uid(), date: f.date.value || td, kind: f.kind.value, fresh }); await save(); close(); render(); };
  });
}

// The fill recorded when a pot is added to the app is dated that day (or the day you gave). A crop that was already
// growing in the pot then was planted into that mix, so the fill can't be later than it: move the fill back to the
// earliest such crop's planting date. (Adding a bag on 17 Nov with potatoes planted 30 Aug said "filled fresh 17 Nov".)
export function settleAddedFill(c) {
  if (!c || c.type === 'bed' || !(c.mixLog || []).length) return false;
  const e = c.mixLog.filter(x => !x.pid).sort(mixSort)[0];
  if (!e || !(e.added || e.date === c.created)) return false;
  const there = (sow, end) => sow && sow < e.date && (!end || end >= e.date);
  const dates = [...S.plantings.filter(p => p.containerId === c.id && p.status !== 'planned' && there(p.sowDate, p.status === 'harvested' ? p.harvestedOn || p.harvestDate : '')).map(p => p.sowDate),
    ...(c.history || []).filter(h => !S.plantings.some(p => p.id === h.plantingId) && there(h.sowDate, h.harvestedOn)).map(h => h.sowDate)].sort();
  if (!dates.length) return false;
  e.date = dates[0]; e.added = true;
  return true;
}

// ---------- potting mix, chosen when planting a pot or bag ----------
// Each planting can carry its own mix event (pid = the planting) — fresh fill or re-used — dated on its sow/plant date.
// Older entries you added by hand (no pid) stay as the pot's history and are still counted.
export const mixSort = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.pid ? 1 : 0) - (b.pid ? 1 : 0));
function mixBefore(c, date, pid, freshOnly) { return (c.mixLog || []).filter(e => e.pid !== (pid || '__new') && e.date <= date && (!freshOnly || e.fresh)).sort(mixSort).pop() || null; }
export function lastMixKind() { const all = S.containers.flatMap(x => x.mixLog || []).sort(mixSort); return all.length ? all[all.length - 1].kind : 'other'; }
export function mixDefaults(d, c) {
  if (!c || c.type === 'bed' || d.mixFresh !== undefined) return;
  const own = (c.mixLog || []).find(e => e.pid && e.pid === d._pid);
  if (own) { d.mixFresh = own.fresh; d.mixKind = own.kind; return; }
  const date = d.sowDate || todayStr(), prior = mixBefore(c, date, d._pid);
  if (prior && prior.date === date) { d.mixFresh = !!prior.fresh; d.mixKind = prior.kind; return; }   // already recorded for that day
  const hadCrop = (c.history || []).length || S.plantings.some(q => q.id !== d._pid && q.containerId === c.id && q.sowDate && q.sowDate < date);
  d.mixFresh = !(prior || hadCrop);
  d.mixKind = prior ? prior.kind : d.mixFresh ? lastMixKind() : '';
}
// the event this planting would add (null = nothing new to record)
function mixEventFor(d, c) {
  if (!c || c.type === 'bed' || d.mixFresh === undefined) return null;
  const date = d.sowDate || todayStr(), prior = mixBefore(c, date, d._pid);
  if (prior && prior.date === date && !!prior.fresh === !!d.mixFresh && (!d.mixFresh || prior.kind === d.mixKind)) return null;
  return { date, kind: d.mixFresh ? (d.mixKind || 'other') : (prior ? prior.kind : d.mixKind || 'other'), fresh: !!d.mixFresh };
}
// the pot as it would be with this choice — for the starting-fertiliser suggestion
export function mixDraftC(c, d) {
  if (!c || c.type === 'bed') return c;
  mixDefaults(d, c);
  const ev = mixEventFor(d, c), log = (c.mixLog || []).filter(e => e.pid !== d._pid);
  return Object.assign({}, c, { mixLog: ev ? [...log, Object.assign({ id: 'draft', pid: d._pid || '__new' }, ev)] : log });
}
export function saveMixChoice(p, d, c) {
  if (!c || c.type === 'bed') return;
  settleAddedFill(c);
  const ev = mixEventFor(Object.assign({}, d, { _pid: p.id }), c);
  c.mixLog = (c.mixLog || []).filter(e => e.pid !== p.id);
  if (ev) c.mixLog.push(Object.assign({ id: uid(), pid: p.id }, ev));
}
export function mixFormBits(d, c) {
  if (!c || c.type === 'bed') return '';
  mixDefaults(d, c);
  const prior = mixBefore(c, d.sowDate || todayStr(), d._pid), fresh = prior && (prior.fresh ? prior : mixBefore(c, d.sowDate || todayStr(), d._pid, true));
  const nm = k => esc(mixRow(k)[1]);
  const opts = (sel, unsure) => `${unsure ? `<option value=""${!sel ? ' selected' : ''}>Not sure</option>` : ''}${mixList().map(([k, en, ja]) => `<option value="${k}"${sel === k ? ' selected' : ''}>${esc(en)} ${esc(ja)}</option>`).join('')}`;
  return `<label>Potting mix<div class="seg"><button type="button" data-act="mixF" data-v="0" class="${d.mixFresh ? '' : 'on'}">Re-used</button><button type="button" data-act="mixF" data-v="1" class="${d.mixFresh ? 'on' : ''}">Fresh mix</button></div></label>
    ${d.mixFresh ? `<label>Which mix<select name="mixKind">${opts(d.mixKind)}</select></label>`
      : prior ? `<small class="hint">${nm(prior.kind)}${fresh ? `, filled fresh ${shortDate(fresh.date)} ${yearOfD(fresh.date)}` : ''}. Sieve out the old roots; the compost and fertiliser you mix in go under Starting fertiliser.</small>`
      : `<label>Which mix is in it?<select name="mixKind">${opts(d.mixKind, true)}</select></label>`}`;
}

// ---------- potting mixes in your library ----------
// potting mixes
// a potting mix you haven't entered: most come with a little starter fertiliser, about a month's worth (an assumption,
// not a product — enter yours under Products → Potting mix to have it counted properly)
const ANY_MIX = { id: 'other', en: 'Potting mix', npkv: [8, 8, 8], gPerL: 1, lasts: 30, what: 'starter fertiliser for about a month (assumed)' };
export const mixRow = k => { const p = libGet(k) || ANY_MIX; return [p.id, p.en, '']; };
export const mixList = () => { const l = libList('mix'); return (l.length ? l : [ANY_MIX]).map(p => [p.id, p.en, '']); };
export const mixFert = k => { const p = (k && libGet(k)) || ANY_MIX; return { npk: p.npkv || [0, 0, 0], gPerL: p.gPerL || 0, days: p.lasts || 30, what: p.what || '' }; };
