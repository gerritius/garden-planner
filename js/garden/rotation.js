// Crop rotation: same-family warnings and the next-season rotation plan.

import { setChrome } from '../core/router.js';
import { southern } from '../climate/climate.js';
import { S } from '../core/state.js';
import { esc, shortDate } from '../core/util.js';
import { FAMILIES, REST } from '../data/catalog.js';
import { crop, cropName } from '../plants/crops.js';
import { histWhen } from '../records/history.js';
import { isPlanned, spanTraces } from './garden.js';

// ---------- same-family warnings ----------
export function lastCropIn(c, from, to, beforeDate, excludeId) {
  const h = [...(c.history || []), ...(spanTraces(c))].filter(x => (!excludeId || x.plantingId !== excludeId) && x.from < to - 0.5 && x.to > from + 0.5 && (!beforeDate || (x.harvestedOn || '') <= beforeDate));
  h.sort((a, b) => ((a.harvestedOn || '') < (b.harvestedOn || '') ? -1 : 1));
  return h.length ? h[h.length - 1] : null;
}
export function rotationNote(c, from, to, cropId, beforeDate, excludeId) {
  const prev = lastCropIn(c, from, to, beforeDate, excludeId);
  if (!prev) return null;
  const a = crop(prev.cropId), b = cropId ? crop(cropId) : null;
  const same = !!(b && a.family && a.family !== 'other' && a.family === b.family);
  const fam = same ? FAMILIES[a.family] : null;
  return {
    prev, same,
    html: same
      ? `<b>Same family as the last crop here.</b> ${esc(a.en)} was here before (${prev.trace ? 'until ' + shortDate(prev.harvestedOn) : histWhen(prev)}) — both are ${esc(fam[0])}. Consider extra compost or a different spot.`
      : `Last crop here: ${esc(cropName(prev.cropId))} (${prev.trace ? 'grew here until ' + shortDate(prev.harvestedOn) : histWhen(prev)}).`,
  };
}

// ---------- rotation plan: blocks and families ----------
// years to leave before the same family goes back in the same spot (common Japanese 連作障害 guidance): each crop's rest, in its record (data/crops.js)
export const yearOfD = d => +String(d || '').slice(0, 4) || null;
// the growing season a date belongs to: the calendar year up north; south of the equator the season runs July to June
// (spring planting to autumn harvest), named by the year it starts — "2026–27" — and a crop belongs to the season it
// was planted in (autumn-planted cabbage lifted in August is still last season's)
const seasonOf = (harvest, sown) => { const d = southern() ? sown || harvest : harvest || sown, y = yearOfD(d); return y && southern() && +String(d).slice(5, 7) < 7 ? y - 1 : y; };
const SY = y => southern() ? `${y}–${String((y + 1) % 100).padStart(2, '0')}` : String(y);
function grownIn(c) {   // [{cropId, family, year, from, to}]
  const out = [];
  for (const h of c.history || []) { const y = seasonOf(h.harvestedOn || (h.ym ? h.ym + '-01' : ''), h.sowDate); if (y) out.push({ cropId: h.cropId, family: crop(h.cropId).family || 'other', year: y, from: h.from, to: h.to }); }
  for (const p of S.plantings) if (p.containerId === c.id && p.status !== 'harvested' && p.sowDate) out.push({ cropId: p.cropId, family: crop(p.cropId).family || 'other', year: seasonOf(isPlanned(p) ? p.sowDate : p.harvestDate, p.sowDate), from: p.from, to: p.to, planned: isPlanned(p) });
  return out.filter(x => x.family !== 'other');
}
// family → year it may come back
function rotationBlocks(c) {
  const b = {};
  for (const g of grownIn(c)) { const rest = REST[g.cropId] ?? 1, ok = g.year + rest + (rest > 0 ? 1 : 0); if (!b[g.family] || b[g.family].ok < ok) b[g.family] = { ok, last: g.year, cropId: g.cropId }; }
  return b;
}
// the season being planned: up north, this year until midsummer and next year after; down south, the season that starts
// (or has started) this July
function nextSeasonYear() { const d = new Date(); return southern() ? d.getFullYear() : d.getMonth() + 1 >= 7 ? d.getFullYear() + 1 : d.getFullYear(); }
const MAIN_FAMS = ['nightshade', 'cucurbit', 'legume', 'brassica', 'allium', 'umbellifer', 'aster', 'amaranth'];

// ---------- the rotation plan page ----------
export function pageRotation() {
  const yr = nextSeasonYear();
  setChrome('Rotation plan', { back: true, kicker: `What can go where in ${SY(yr)}` });
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
      ${years.length ? `<span class="rothist">${years.map(y => `<span><i>${SY(+y)}</i> ${[...by[y]].map(esc).join(', ')}</span>`).join('')}</span>` : '<small class="muted">Nothing recorded yet</small>'}
      ${avoid.length ? `<span class="rotavoid">${avoid.map(([f, v]) => `<span class="chip no">✕ ${esc(famName(f))} <small>until ${SY(v.ok)}</small></span>`).join('')}</span>` : `<small class="okline">✓ Anything can go here in ${SY(yr)}</small>`}
      </span>›</a></li>`;
  };
  // by family: where it mustn't go, and the best places for it (longest since, or never)
  const famCard = f => {
    const no = cs.filter(c => blocks[c.id][f] && blocks[c.id][f].ok > yr).sort((a, b) => blocks[b.id][f].ok - blocks[a.id][f].ok);
    const before = cs.filter(c => blocks[c.id][f] && blocks[c.id][f].ok <= yr).sort((a, b) => blocks[a.id][f].last - blocks[b.id][f].last);
    const never = cs.filter(c => !blocks[c.id][f]);
    return `<li class="rotfam"><div class="rfh"><b>${esc(famName(f))}</b> <small class="muted">${cs.length - no.length} of ${cs.length} OK</small></div>
      ${no.length ? `<div class="rotavoid">${no.map(c => `<span class="chip no">✕ ${esc(c.name)} · ${esc(crop(blocks[c.id][f].cropId).en)} ${SY(blocks[c.id][f].last)} · free ${SY(blocks[c.id][f].ok)}</span>`).join('')}</div>` : ''}
      ${before.length ? `<p class="small">✓ Grown before, fine again: ${before.map(c => `${esc(c.name)} (${SY(blocks[c.id][f].last)})`).join(', ')}</p>` : ''}
      ${never.length ? `<p class="small muted">✓ Not grown there yet: ${never.length === cs.length ? 'any bed or pot' : names(never)}</p>` : ''}</li>`;
  };
  const html = `<p class="hint">From what grew in each bed and pot (including past crops you added). Wait times follow common guidance for avoiding replant problems (soil sickness) — e.g. tomatoes & eggplant 4 years, peas 4–5, brassicas 2. A section of a bed counts as the whole bed.</p>
    <section><h3>By bed &amp; pot</h3><ul class="plist rotl">${cs.map(bedCard).join('')}</ul></section>
    <section><h3>By family</h3>${fams.length ? `<ul class="plist rotl">${fams.map(famCard).join('')}</ul>` : '<p class="muted">Nothing recorded yet.</p>'}
      ${MAIN_FAMS.filter(f => !grownFams.has(f)).length ? `<p class="hint">Not grown anywhere yet, so free everywhere: ${MAIN_FAMS.filter(f => !grownFams.has(f)).map(famName).join(', ')}.</p>` : ''}</section>`;
  return { html };
}
