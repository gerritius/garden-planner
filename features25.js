/* Speed: crop ideas are cached until something changes, and the season plan fills its idea chips in after it shows.
   Rotation plan: laid out by bed/pot first, and by family without a "never" chip for every pot. */
'use strict';

// ---------- a data version: anything saved bumps it, so cached results know when they're stale ----------
let dataVer = 0;
const _dbSet = DB.set.bind(DB);
DB.set = function (k, v) { if (k === 'state') dataVer++; return _dbSet(k, v); };
const _ideaCache = new Map();
const _cropIdeasOrig = cropIdeas;
cropIdeas = function (c, a, b, s, clearBy) {   // eslint-disable-line no-global-assign
  const k = [dataVer, todayStr(), c.id, a, b, s, clearBy || ''].join('|');
  if (_ideaCache.has(k)) return _ideaCache.get(k);
  if (_ideaCache.size > 200) _ideaCache.clear();
  const r = _cropIdeasOrig(c, a, b, s, clearBy); _ideaCache.set(k, r); return r;
};

// ---------- season plan / bed page free spaces: show at once, fill the idea chips in just after ----------
const _gapLiOrig = gapLi;
gapLi = function (c, g) {   // eslint-disable-line no-global-assign
  const k = [dataVer, todayStr(), c.id, g.a, g.b, g.s, g.e || ''].join('|');
  const clearBy = clearByFor(c, g.s, g.e), ck = [dataVer, todayStr(), c.id, g.a, g.b, g.s, clearBy || ''].join('|');
  if (_ideaCache.has(ck)) return _gapLiOrig(c, g);   // already worked out: draw it fully
  const id = 'gl' + Math.abs(hashStr(k));
  setTimeout(() => queueIdle(() => { const el = document.getElementById(id); if (el) el.outerHTML = _gapLiOrig(c, g); }), 0);
  // the same row without the suggestion chips for now
  const L = Draw.dims(c).L, part = g.a > 0 || g.b < L ? `${g.a}–${g.b} cm` : c.type === 'bed' ? 'Whole bed' : 'Whole pot', days = g.e ? daysBetween(g.s, g.e) + 1 : null;
  A.ideas = el => { const [cid, x, y, s, e] = el.dataset.ideas.split('|'); ideasDialog(container(cid), +x, +y, s, e || null); };
  return `<li class="gap" id="${id}"><div><b>${part}</b> free ${g.s <= todayStr() ? 'now' : 'from ' + shortDate(g.s)}${g.e ? ` until ${shortDate(g.e)} <small>(${days} days, before ${esc(crop(g.next.cropId).en)})</small>` : ''}${g.prev ? ` <small>· after ${esc(crop(g.prev.cropId).en)}</small>` : ''}</div>
    <div class="sowchips">${gapStartChips(c, g)}<span class="chip muted">…</span><button type="button" class="chip" data-act="ideas" data-ideas="${c.id}|${g.a}|${g.b}|${g.s}|${g.e || ''}">💡 More ideas…</button></div></li>`;
};
const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
// one at a time, in idle moments, so scrolling stays smooth
const _idleQ = []; let _idleBusy = false;
function queueIdle(fn) {
  _idleQ.push(fn); if (_idleBusy) return; _idleBusy = true;
  const step = () => { const f = _idleQ.shift(); if (!f) { _idleBusy = false; return; } try { f(); } catch (e) { console.warn(e); } (window.requestIdleCallback || (cb => setTimeout(cb, 16)))(step); };
  (window.requestIdleCallback || (cb => setTimeout(cb, 16)))(step);
}

// ---------- rotation plan ----------
function pageRotation() {
  const yr = nextSeasonYear();
  setChrome('Rotation plan', { back: true, kicker: `What can go where in ${yr}` });
  const cs = S.containers.filter(c => c.type !== 'nursery'), blocks = Object.fromEntries(cs.map(c => [c.id, rotationBlocks(c)]));
  const famName = f => FAMILIES[f][0].replace(/\s*\(.*\)$/, '');
  const grownFams = new Set(cs.flatMap(c => grownIn(c).map(x => x.family)).concat(S.plantings.map(p => crop(p.cropId).family)));
  const fams = MAIN_FAMS.filter(f => grownFams.has(f));
  const names = list => list.map(c => esc(c.name)).join(', ');
  // by bed / pot: what grew, and what to keep out of it next season
  const bedCard = c => {
    const g = grownIn(c), by = {}; g.forEach(x => { (by[x.year] = by[x.year] || new Set()).add(crop(x.cropId).en + (x.planned ? ' (planned)' : '')); });
    const years = Object.keys(by).sort().reverse().slice(0, 3);
    const avoid = Object.entries(blocks[c.id]).filter(([, v]) => v.ok > yr).sort((x, y) => y[1].ok - x[1].ok);
    return `<li class="rotbed"><a href="#/container/${c.id}"><span class="grow"><b>${esc(c.name)}</b>
      ${years.length ? `<span class="rothist">${years.map(y => `<span><i>${y}</i> ${[...by[y]].map(esc).join(', ')}</span>`).join('')}</span>` : '<small class="muted">Nothing recorded yet</small>'}
      ${avoid.length ? `<span class="rotavoid">${avoid.map(([f, v]) => `<span class="chip no">✕ ${esc(famName(f))} <small>until ${v.ok}</small></span>`).join('')}</span>` : `<small class="okline">✓ Anything can go here in ${yr}</small>`}
      </span>›</a></li>`;
  };
  // by family: where it mustn't go, and the best places for it (longest since, or never)
  const famCard = f => {
    const no = cs.filter(c => blocks[c.id][f] && blocks[c.id][f].ok > yr).sort((a, b) => blocks[b.id][f].ok - blocks[a.id][f].ok);
    const before = cs.filter(c => blocks[c.id][f] && blocks[c.id][f].ok <= yr).sort((a, b) => blocks[a.id][f].last - blocks[b.id][f].last);
    const never = cs.filter(c => !blocks[c.id][f]);
    return `<li class="rotfam"><div class="rfh"><b>${esc(famName(f))}</b> <small class="ja">${esc(FAMILIES[f][1])}</small><small class="muted">${cs.length - no.length} of ${cs.length} OK</small></div>
      ${no.length ? `<div class="rotavoid">${no.map(c => `<span class="chip no">✕ ${esc(c.name)} · ${esc(crop(blocks[c.id][f].cropId).en)} ${blocks[c.id][f].last} · free ${blocks[c.id][f].ok}</span>`).join('')}</div>` : ''}
      ${before.length ? `<p class="small">✓ Grown before, fine again: ${before.map(c => `${esc(c.name)} (${blocks[c.id][f].last})`).join(', ')}</p>` : ''}
      ${never.length ? `<p class="small muted">✓ Not grown there yet: ${never.length === cs.length ? 'any bed or pot' : names(never)}</p>` : ''}</li>`;
  };
  const html = `<p class="hint">From what grew in each bed and pot (including past crops you added). Wait times follow common guidance for avoiding replant problems (連作障害) — e.g. tomatoes & eggplant 4 years, peas 4–5, brassicas 2. A section of a bed counts as the whole bed.</p>
    <section><h3>By bed &amp; pot</h3><ul class="plist rotl">${cs.map(bedCard).join('')}</ul></section>
    <section><h3>By family</h3>${fams.length ? `<ul class="plist rotl">${fams.map(famCard).join('')}</ul>` : '<p class="muted">Nothing recorded yet.</p>'}
      ${MAIN_FAMS.filter(f => !grownFams.has(f)).length ? `<p class="hint">Not grown anywhere yet, so free everywhere: ${MAIN_FAMS.filter(f => !grownFams.has(f)).map(famName).join(', ')}.</p>` : ''}</section>`;
  return { html };
}
