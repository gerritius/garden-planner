/* Covers on beds and pots (put on as tunnels over hoops): insect net, fushokufu (不織布), shade cloth — drawn on the plot, used by alerts. */
'use strict';

const COVER_TYPES = [
  ['insect', '🕸️', 'Insect net tunnel', '防虫ネット'], ['fushokufu', '🧣', 'Fushokufu tunnel', '不織布'], ['shade', '🕶️', 'Shade cloth', '寒冷紗・遮光'],
];
const COVER_OLD = { fleece: 'fushokufu', cloche: 'fushokufu', bird: 'insect' };
const coverType = t => COVER_TYPES.find(x => x[0] === (COVER_OLD[t] || t)) || COVER_TYPES[0];
function migrateCovers() { for (const c of S.containers) for (const x of c.covers || []) if (COVER_OLD[x.type]) x.type = COVER_OLD[x.type]; }
const drawType = t => t === 'insect' ? 'net' : t === 'fushokufu' ? 'fleece' : t;   // how it's drawn
function activeCovers(c) { return (c.covers || []).filter(x => !x.off).map(x => Object.assign({}, x, { type: drawType(x.type), kind: x.type })); }
const coversOn = c => (c.covers || []).filter(x => !x.off);
const coverWhere = (c, x) => { const L = Draw.dims(c).L; return x.from > 0 || x.to < L ? `${x.from}–${x.to} cm` : c.type === 'bed' ? 'whole bed' : 'whole pot'; };
// is this planting under a cover of these types?
function plantingCover(p, types) {
  const c = container(p.containerId); if (!c) return null;
  return coversOn(c).find(x => (!types || types.includes(x.type)) && x.from < p.to - 0.5 && x.to > p.from + 0.5) || null;
}
function coverChips(c) {
  const on = coversOn(c); if (!on.length) return '';
  return `<div class="covchips">${[...new Set(on.map(x => x.type))].map(t => `<span class="covchip">${coverType(t)[1]} ${esc(coverType(t)[2].toLowerCase())}</span>`).join('')}</div>`;
}

function coverDialog(c, x) {
  const isNew = !x, td = todayStr(), L = Draw.dims(c).L;
  x = x || { id: uid(), type: 'insect', from: 0, to: L, on: td, off: null };
  const secs = activeIn(c.id).map(p => [p.from, p.to, crop(p.cropId).en]);
  modal(`<h3>${isNew ? 'Add a cover' : 'Edit cover'} — ${esc(c.name)}</h3><form id="cvf" class="form">
      <label>Type<div class="seg wrap">${COVER_TYPES.map(([k, i, l]) => `<button type="button" data-t="${k}" class="${x.type === k ? 'on' : ''}">${i} ${l}</button>`).join('')}</div></label>
      ${c.type === 'round' ? '' : `${secs.length ? `<div class="sowchips">${[[0, L, c.type === 'bed' ? 'Whole bed' : 'Whole pot'], ...secs].map(([a, b, l]) => `<button type="button" class="chip" data-sec="${a},${b}">${esc(l)}</button>`).join('')}</div>` : ''}
      <div class="two"><label>From (cm)<input name="from" type="number" inputmode="decimal" value="${x.from}"></label><label>To (cm)<input name="to" type="number" inputmode="decimal" value="${x.to}"></label></div>`}
      <div class="two"><label>Put on<input name="on" type="date" value="${x.on || td}" max="${td}"></label>${x.off ? `<label>Taken off<input name="off" type="date" value="${x.off}" max="${td}"></label>` : ''}</div>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#cvf');
    m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { x.type = b.dataset.t; m.querySelectorAll('[data-t]').forEach(y => y.classList.toggle('on', y === b)); });
    m.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { const [a, z] = b.dataset.sec.split(','); f.from.value = a; f.to.value = z; });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { c.covers = c.covers.filter(y => y.id !== x.id); await save(); close(); render(); };
    f.onsubmit = async e => {
      e.preventDefault();
      x.from = c.type === 'round' ? 0 : Math.max(0, num(f.from.value) ?? 0); x.to = c.type === 'round' ? L : Math.min(L, num(f.to.value) ?? L);
      if (!(x.to > x.from)) return alert('“To” must be more than “From”.');
      x.on = f.on.value || td; if (f.off) x.off = f.off.value || x.off;
      if (isNew) (c.covers = c.covers || []).push(x);
      await save(); close(); render();
    };
  });
}
function coverSection(c) {
  const on = coversOn(c), past = (c.covers || []).filter(x => x.off).sort((a, b) => (a.off < b.off ? 1 : -1)).slice(0, 5);
  A.addCover = () => coverDialog(c);
  A.editCover = el => coverDialog(c, (c.covers || []).find(x => x.id === el.dataset.id));
  A.liftCover = async el => { const x = (c.covers || []).find(y => y.id === el.dataset.id); x.off = todayStr(); await save(); render(); };
  const notes = coverNotes().filter(n => n.c === c);
  return `<section><h3>Covers</h3>
    ${notes.map(n => `<div class="banner warn">${esc(n.text)}</div>`).join('')}
    ${on.length ? `<ul class="plist covers">${on.map(x => `<li><span class="lic">${coverType(x.type)[1]}</span><span class="grow" data-act="editCover" data-id="${x.id}"><b>${coverType(x.type)[2]}</b> <small class="ja">${coverType(x.type)[3]}</small><small>${coverWhere(c, x)} · on since ${shortDate(x.on)}</small></span><button class="btn small" data-act="liftCover" data-id="${x.id}">Take off</button></li>`).join('')}</ul>` : '<p class="muted">Nothing covered.</p>'}
    <button class="btn small" data-act="addCover">＋ Add insect net / fushokufu</button>
    ${past.length ? `<details class="donelog"><summary>Taken off (${past.length})</summary><ul class="plist">${past.map(x => `<li data-act="editCover" data-id="${x.id}"><span class="lic">${coverType(x.type)[1]}</span><span class="grow">${coverType(x.type)[2]}<small>${coverWhere(c, x)} · ${shortDate(x.on)} – ${shortDate(x.off)}</small></span></li>`).join('')}</ul></details>` : ''}</section>`;
}

// reminders: lift fushokufu when frosts are over or it's warm, nets on crops that need pollinating, covers over nothing
const NEEDS_BEES = ['kyuri', 'zucchini', 'strawberry', 'nasu', 'piman', 'shishito', 'chilli', 'tomato', 'minitomato', 'ingen', 'snappea', 'sayaendo', 'soramame', 'edamame'];
function coverNotes() {
  const td = todayStr(), days = Weather.days().slice(0, 7), out = [];
  const noFrost = days.length >= 5 && days.every(d => d.min > 3), warm = days.slice(0, 3).find(d => d.max >= 25);
  for (const c of S.containers) for (const x of coversOn(c)) {
    const under = activeIn(c.id).filter(p => p.from < x.to - 0.5 && p.to > x.from + 0.5), names = [...new Set(under.map(p => crop(p.cropId).en))].join(', '), where = `${c.name} (${coverWhere(c, x)})`;
    if (!under.length && daysBetween(x.on, td) > 1) { out.push({ c, x, text: `${coverType(x.type)[2]} still on ${where} — nothing is growing under it.` }); continue; }
    if (x.type === 'fushokufu' && warm) out.push({ c, x, text: `${dayName(warm.date) === 'Today' ? 'Today' : dayName(warm.date)} reaches ${Math.round(warm.max)}° — open up the ends of the ${coverType(x.type)[2].toLowerCase()} on ${where} so ${names || 'the crop'} doesn’t cook.` });
    else if (x.type === 'fushokufu' && noFrost && warming(td) && normalT(td) >= 10) out.push({ c, x, text: `No frost in the forecast — the fushokufu on ${where} can probably come off.` });
    const flowering = under.filter(p => NEEDS_BEES.includes(p.cropId) && p.harvestDate && td >= addDays(p.harvestDate, -21));
    if (x.type === 'insect' && flowering.length) out.push({ c, x, text: `${[...new Set(flowering.map(p => crop(p.cropId).en))].join(', ')} under the net on ${where} should be flowering — lift it in the mornings for bees, or hand-pollinate.` });
  }
  return out;
}
// covers in the cover log feed
function coverLogItems() {
  const out = [];
  for (const c of S.containers) for (const x of c.covers || []) {
    const t = coverType(x.type), where = coverWhere(c, x);
    if (x.on) out.push({ date: x.on, kind: 'cover', title: `${t[2]} on`, sub: `${c.name} · ${where}`, href: '#/container/' + c.id, cids: [c.id], pids: [] });
    if (x.off) out.push({ date: x.off, kind: 'cover', title: `${t[2]} off`, sub: `${c.name} · ${where}`, href: '#/container/' + c.id, cids: [c.id], pids: [] });
  }
  return out;
}
// wind advice: name what is covered
function coveredText(types) {
  return S.containers.flatMap(c => coversOn(c).filter(x => !types || types.includes(x.type)).map(x => `${c.name}${coverWhere(c, x).startsWith('whole') ? '' : ' ' + coverWhere(c, x)} (${coverType(x.type)[2].toLowerCase()})`)).join(', ');
}
