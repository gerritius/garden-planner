/* "What could go here?" — crops that can go into a free space now (or when it frees up), by direct sowing,
   bought seedlings, or seedlings you raise indoors first — with when each would be done, so stop-gaps that would
   still be there when the next crop is due are flagged. */
'use strict';

const monthOf = d => pd(d).getMonth() + 1;
const shiftM = (ms, k) => ms.map(m => ((m - 1 + k) % 12 + 12) % 12 + 1);
// months it can be sown / planted out (the catalogue's months are "sow or plant"; seedlings go out a little later)
const sowOK = (cr, m) => (cr.sow || []).includes(m);
function plantOK(cr, m) {
  if (!raisable(cr.id)) return sowOK(cr, m);
  const k = Math.min(2, Math.round(tpDays(cr.id) / 30));
  return sowOK(cr, m) || shiftM(cr.sow || [], k).includes(m);
}
// quick hardy leaves (komatsuna, spinach, mizuna…) can go a couple of months past their window under a tunnel or Fushokufu
const coverOK = (cr, m) => !cr.tender && ['brassica', 'amaranth', 'aster'].includes(cr.family) && cr.daysHarvest <= 70 && !sowOK(cr, m) && (shiftM(cr.sow || [], 1).includes(m) || shiftM(cr.sow || [], 2).includes(m));
const trayOK = (cr, m) => sowOK(cr, m) || shiftM(cr.sow || [], -1).includes(m);   // indoors you can start a month early
// default "needs to be clear by": the next crop planned here (less 2 weeks' prep); otherwise, over winter, Golden Week
function clearByFor(c, s, e) {
  if (e) return addDays(e, -13);
  if (c.clearBy && c.clearBy > s) return c.clearBy;
  if (normalT(s) >= 15) return null;   // warm season: nothing to clear for
  for (let d = addDays(s, 1), i = 0; i < 300; i++, d = addDays(d, 1)) if (normalT(d) >= 16) return d;   // the main spring planting (Golden Week around Tokyo)
  return null;
}
// when it would be done with: the harvest window's "most ready by" (for crops picked over a season, a month of picking)
function doneOf(hp) {
  const est = harvestEstimate(hp); if (!est) return null;
  const w = harvestWindow(Object.assign({}, hp, { harvestDate: est }));
  return { ready: est, done: w ? (w.cont ? addDays(est, 30) : w.mature) : addDays(est, 14) };
}
function cropIdeas(c, a, b, s, clearBy) {
  const td = todayStr(); s = s > td ? s : td;
  const before = S.plantings.filter(p => p.containerId === c.id && (isLive(p) || isPlanned(p)) && p.from < b - 0.5 && p.to > a + 0.5 && endOf(p) <= addDays(s, 1)).sort((x, y) => (endOf(x) < endOf(y) ? 1 : -1))[0];
  const out = [], prev = before || (typeof lastCropIn === 'function' ? lastCropIn(c, a, b, s) : null), prevFam = prev ? crop(prev.cropId).family : null;
  const width = c.type === 'bed' ? Math.max(b - a, Draw.dims(c).W) : Math.max(Draw.dims(c).W, Draw.dims(c).L);
  // dates to try: the start, then the 1st and 15th of the next couple of months
  // dates to try: the start, then the 1st and 15th of each month up to the clear-by date (or ~5 months)
  const lastTry = clearBy && daysBetween(s, clearBy) < 150 ? clearBy : addDays(s, 150);
  const dates = [s]; for (let i = 1; i <= 12; i++) { const x = pd(s); const ds = iso(new Date(x.getFullYear(), x.getMonth() + Math.ceil(i / 2), i % 2 ? 1 : 15)); if (ds > s && ds <= lastTry) dates.push(ds); }
  const outdoor = !c.indoor, warm = d => !outdoor || normalT(d) >= 13;
  for (const cr of allCrops()) {
    if (!(cr.sow || []).length || !cr.daysHarvest || cr.id === 'strawberry') continue;
    if ((cr.spread || 20) > width + 20) continue;
    const opts = [];
    const tryOpt = (kind, P, T, cover) => {
      if (cr.tender && !warm(P)) return;
      const hp = { id: 'idea', cropId: cr.id, sowDate: P, containerId: c.id, method: kind === 'sow' ? 'seed' : 'seedling', seededOn: kind === 'raise' ? T : undefined };
      const r = doneOf(hp); if (!r || daysBetween(P, r.ready) > 300) return;
      opts.push({ kind, P, T, cover: !!cover, ...r, fits: !clearBy || r.done <= clearBy });
    };
    for (const P of dates) {
      const m = monthOf(P);
      if (cr.method === 'seed' && sowOK(cr, m)) tryOpt('sow', P);
      else if (cr.method === 'seed' && outdoor && coverOK(cr, m)) tryOpt('sow', P, null, true);
      if ((cr.method === 'seedling' || raisable(cr.id)) && plantOK(cr, m)) {
        tryOpt('buy', P);
        if (raisable(cr.id)) { const T = traySowFor(cr.id, P); if (T >= td && trayOK(cr, monthOf(T))) tryOpt('raise', P, T); }
      }
      if (opts.filter(o => o.fits && !o.cover).length >= 2) break;
    }
    if (!opts.length) continue;
    // best: fits the deadline, then the soonest start, then the soonest done; buying is the fallback when raising works too
    opts.sort((x, y) => (y.fits - x.fits) || (x.P < y.P ? -1 : x.P > y.P ? 1 : 0) || (x.cover - y.cover) || (x.done < y.done ? -1 : 1) || (x.kind === 'buy') - (y.kind === 'buy'));
    const best = opts[0], alt = opts.find(o => o !== best && o.kind !== best.kind && o.fits === best.fits);
    const sameFam = prevFam && prevFam !== 'other' && cr.family === prevFam;
    const cold = outdoor && [best.P, addDays(best.P, 30), addDays(best.P, 60)].some(d => d < best.ready && normalT(d) < 8);
    out.push({ cr, best, alt, sameFam, prev, cold });
  }
  out.sort((x, y) => (y.best.fits - x.best.fits) || (x.sameFam - y.sameFam) || (x.best.done < y.best.done ? -1 : 1));
  return out;
}
const IDEA_KIND = { sow: ['🌱', 'Sow'], buy: ['🪴', 'Plant seedlings'], raise: ['🏠', 'Sow indoors'] };
function ideaText(o) {
  const td = todayStr(), when = d => d <= td ? 'now' : shortDate(d);
  const cov = o.cover ? ' under a tunnel or Fushokufu' : '';
  if (o.kind === 'sow') return `🌱 Sow ${o.P <= td ? 'now' : 'from ' + shortDate(o.P)}${cov}`;
  return o.kind === 'raise' ? `🏠 Sow indoors ${when(o.T)}, plant out ${when(o.P)}` : `${IDEA_KIND[o.kind][0]} ${IDEA_KIND[o.kind][1]} ${o.kind === 'buy' ? (o.P <= td ? 'now' : 'from ' + shortDate(o.P)) : when(o.P)}`;
}
function ideaUrl(c, a, b, o, id) {
  const td = todayStr();
  return `#/plant/new/${c.id}?crop=${id}&from=${a}&to=${b}&date=${o.P}${o.P > td ? '&plan=1' : ''}&method=${o.kind === 'sow' ? 'seed' : 'seedling'}${o.kind === 'raise' ? '&raise=tray' : o.kind === 'buy' && o.P > td ? '&raise=buy' : ''}`;
}
// the list, in a pop-up. onPick(cropId, option) instead of opening the planting form, when called from the form itself
function ideasDialog(c, a, b, s, e, onPick) {
  const td = todayStr(); s = s > td ? s : td;
  const L = Draw.dims(c).L, part = a > 0 || b < L ? `${a}–${b} cm` : c.type === 'bed' ? 'the whole bed' : 'the pot';
  let clearBy = clearByFor(c, s, e);
  const draw = m => {
    // "won't be done in time" only lists real stop-gaps — not the next season's main crops that start just before the date
    const list = cropIdeas(c, a, b, s, clearBy), fit = list.filter(x => x.best.fits), late = list.filter(x => !x.best.fits && (!clearBy || x.best.P < addDays(clearBy, -30)));
    const mine = startsGrowing().filter(st => list.some(x => x.cr.id === st.cropId));
    const li = x => `<li data-idea="${x.cr.id}">${ic(x.cr.id)}<span class="grow"><b>${esc(cropName(x.cr.id))}</b>
      <small>${ideaText(x.best)} → ready ~${shortDate(x.best.ready)}, done ~${shortDate(x.best.done)}${x.alt ? ` · or ${ideaText(x.alt).replace(/^\S+ (\S)/, (m0, ch) => ch.toLowerCase())}, done ~${shortDate(x.alt.done)}` : ''}</small>
      ${typeof ideaSoilNotes === 'function' ? ideaSoilNotes(c, a, b, x.cr.id) + ideaColdSoil(c, a, b, x.cr.id, x.best) : ''}${x.sameFam ? `<small class="warn">⚠ same family as the ${esc(crop(x.prev.cropId).en.toLowerCase())} before it</small>` : ''}${x.cold && !x.best.cover ? '<small>❄ slow in the cold — a tunnel or Fushokufu speeds it up</small>' : ''}</span>›</li>`;
    m.querySelector('.sheet').innerHTML = `<h3>💡 What could go in ${esc(part)}?</h3>
      <p class="muted small">${esc(c.name)} · free ${s <= td ? 'now' : 'from ' + shortDate(s)}${e ? ` until ${shortDate(e)}` : ''}</p>
      ${typeof ideaSoilBanner === 'function' ? ideaSoilBanner(c, a, b) : ''}
      <label class="inl">Needs to be clear by <input type="date" id="clrBy" value="${clearBy || ''}" min="${s}"></label>
      <small class="hint">${e ? 'Your next planned crop here, less two weeks to prepare.' : clearBy ? 'So it’s free for the next season’s planting — change it if you plan something else.' : 'No date — showing everything.'}</small>
      ${mine.length ? `<h4>Your seedlings</h4><ul class="plist">${mine.map(st => `<li data-start="${st.id}">${ic(st.cropId)}<span class="grow"><b>${esc(crop(st.cropId).en)}</b><small>${startLeft(st)} in ${esc(startWhere(st))} · sown ${shortDate(st.sowDate)}</small></span>›</li>`).join('')}</ul>` : ''}
      <h4>${clearBy ? `Done by ${shortDate(clearBy)}` : 'Can go in'} <small>(${fit.length})</small></h4>
      ${fit.length ? `<ul class="plist">${fit.map(li).join('')}</ul>` : '<p class="muted">Nothing fits before then — see below, or leave it to rest (or sow a green manure).</p>'}
      ${late.length ? `<details><summary class="muted">Would still be there after ${shortDate(clearBy)} (${late.length})</summary><ul class="plist">${late.map(li).join('')}</ul></details>` : ''}
      <p class="hint">Dates follow the usual temperatures here and the time of year. Seedlings from a shop are usually around from the start of each planting month.</p>
      <div class="btns"><button class="btn" data-x="no">Close</button></div>`;
    m.querySelector('[data-x=no]').onclick = () => m._close();
    m.querySelector('#clrBy').onchange = async ev => { clearBy = ev.target.value || null; if (!e) { c.clearBy = clearBy || ''; await save(); } draw(m); };
    m.querySelectorAll('[data-idea]').forEach(li => li.onclick = () => {
      const x = list.find(y => y.cr.id === li.dataset.idea), o = x.best;
      if (onPick) { m._close(); return onPick(x.cr.id, o); }
      m._close(); go(ideaUrl(c, a, b, o, x.cr.id));
    });
    m.querySelectorAll('[data-start]').forEach(li => li.onclick = () => { const st = start(li.dataset.start); m._close(); go(`#/plant/new/${c.id}?crop=${st.cropId}&from=${a}&to=${b}&start=${st.id}&n=${startLeft(st)}`); });
  };
  modal('<div></div>', m => draw(m));
}

// free spaces on the bed page and the plan list: the top few ideas as chips, plus the full list
function gapLi(c, g) {
  const L = Draw.dims(c).L, part = g.a > 0 || g.b < L ? `${g.a}–${g.b} cm` : c.type === 'bed' ? 'Whole bed' : 'Whole pot';
  const days = g.e ? daysBetween(g.s, g.e) + 1 : null, clearBy = clearByFor(c, g.s, g.e);
  const top = cropIdeas(c, g.a, g.b, g.s, clearBy).filter(x => x.best.fits && !x.sameFam).slice(0, 4);
  A.ideas = el => { const [cid, a, b, s, e] = el.dataset.ideas.split('|'); ideasDialog(container(cid), +a, +b, s, e || null); };
  return `<li class="gap"><div><b>${part}</b> free ${g.s <= todayStr() ? 'now' : 'from ' + shortDate(g.s)}${g.e ? ` until ${shortDate(g.e)} <small>(${days} days, before ${esc(crop(g.next.cropId).en)})</small>` : ''}${g.prev ? ` <small>· after ${esc(crop(g.prev.cropId).en)}</small>` : ''}</div>
    <div class="sowchips">${gapStartChips(c, g)}${top.map(x => `<a class="chip" href="${ideaUrl(c, g.a, g.b, x.best, x.cr.id)}">${ic(x.cr.id, 18)}${esc(x.cr.en)} <small>${IDEA_KIND[x.best.kind][0]} done ~${shortDate(x.best.done)}</small></a>`).join('')}<button type="button" class="chip" data-act="ideas" data-ideas="${c.id}|${g.a}|${g.b}|${g.s}|${g.e || ''}">💡 More ideas…</button></div></li>`;
}
// button for a free space (bed page, planting form)
function gapAround(c, a, b, d) {
  d = d || todayStr();
  return freeGaps(c).find(g => g.a <= a + 0.5 && g.b >= b - 0.5 && (!g.e || g.e >= d) && g.s <= addDays(d, 1)) || freeGaps(c).find(g => g.a <= a + 0.5 && g.b >= b - 0.5 && g.s >= d) || null;
}
function ideasBtn(c, a, b, cls = 'btn wide') {
  A.ideas = el => { const [cid, x, y, s, e] = el.dataset.ideas.split('|'); ideasDialog(container(cid), +x, +y, s, e || null); };
  const g = gapAround(c, a, b);
  return `<button type="button" class="${cls}" data-act="ideas" data-ideas="${c.id}|${a}|${b}|${g ? g.s : todayStr()}|${g && g.e ? g.e : ''}">💡 What could go here?</button>`;
}
