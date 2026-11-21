// Looking back: season review and comparison, harvest totals, product totals and purchases (all spending, all up).

import { A, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { modal } from '../core/ui.js';
import { $, daysBetween, esc, shortDate, todayStr, uid } from '../core/util.js';
import { HANDFUL_G } from '../data/catalog.js';
import { container, planting } from '../garden/garden.js';
import { crop, cropName, ic } from '../plants/crops.js';
import { pestName } from '../plants/problems.js';
import { libList, productByName } from '../products/library.js';
import { harvestTotal, KIND_ICON } from './log.js';

// ---------- season review & comparison ----------
function plantingStats(p) {
  const hs = (p.harvests || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = hs[0] ? hs[0].date : null;
  const pests = [...new Set((p.diary || []).flatMap(d => d.tags || []))];
  return { total: harvestTotal(p), first, toFirst: first && p.sowDate ? daysBetween(p.sowDate, first) : null, pests };
}
const yearOf = p => (p.sowDate || p.created || '').slice(0, 4);
export function pageReview(q) {
  const years = [...new Set(S.plantings.map(yearOf).filter(Boolean))].sort().reverse();
  const y = q.get('y') || years[0] || String(new Date().getFullYear());
  setChrome('Season review', { back: true, kicker: y });
  const html = `<div class="seg wrap">${(years.length ? years : [y]).map(x => `<a href="#/review?y=${x}" onclick="location.replace(this.href);return false;" class="${x === y ? 'on' : ''}">${x}</a>`).join('')}</div>
    ${S.containers.map(c => {
      const ps = S.plantings.filter(p => p.containerId === c.id && yearOf(p) === y).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
      const notes = (c.log || []).filter(n => n.date.startsWith(y));
      if (!ps.length && !notes.length) return '';
      return `<section><h3>${esc(c.name)}</h3>${ps.map(p => { const st = plantingStats(p); return `<a class="rvcard" href="#/plant/${p.id}">
        <div class="rvh">${ic(p.cropId, 30)}<b>${esc(crop(p.cropId).en)}</b>${p.variety ? `<span>${esc(p.variety)}</span>` : ''}</div>
        <div class="rvg"><div><small>${p.method === 'seed' ? 'Sown' : 'Planted'}</small>${shortDate(p.sowDate)}</div><div><small>First pick</small>${st.first ? `${shortDate(st.first)} <small>(${st.toFirst} d)</small>` : '—'}</div>
        <div><small>Picked</small>${st.total || '—'}</div><div><small>Status</small>${p.status === 'harvested' ? 'done ' + shortDate(p.harvestedOn) : 'growing'}</div></div>
        ${p.germ ? `<div class="rvx">Germination: ${p.germ.result}</div>` : ''}${st.pests.length ? `<div class="rvx">Problems: ${st.pests.map(pestName).join(', ')}</div>` : ''}${p.notes ? `<div class="rvx">${esc(p.notes)}</div>` : ''}</a>`; }).join('')}
        ${notes.length ? `<ul class="plist">${notes.map(n => `<li><span class="grow"><small>${shortDate(n.date)}</small>${esc(n.text)}</span></li>`).join('')}</ul>` : ''}</section>`;
    }).join('') || '<p class="muted center">Nothing recorded for this year.</p>'}
    <a class="btn wide" href="#/compare">Compare a crop across years →</a>`;
  return { html };
}
export function pageCompare(q) {
  const used = [...new Set(S.plantings.map(p => p.cropId))];
  const id = q.get('crop') || used[0];
  setChrome('Compare years', { back: true, kicker: id ? crop(id).en : '' });
  if (!id) return { html: '<p class="muted center">Nothing planted yet.</p>' };
  const ps = S.plantings.filter(p => p.cropId === id).sort((a, b) => (a.sowDate < b.sowDate ? -1 : 1));
  const maxT = Math.max(1, ...ps.map(harvestTotal));
  const html = `<label class="form"><select id="cmpSel">${used.map(x => `<option value="${x}"${x === id ? ' selected' : ''}>${esc(cropName(x))}</option>`).join('')}</select></label>
    ${ps.map(p => { const st = plantingStats(p), c = container(p.containerId); return `<a class="rvcard" href="#/plant/${p.id}">
      <div class="rvh"><b>${yearOf(p)}</b><span>${esc(p.variety || 'no variety')}</span><span class="muted">${esc(c ? c.name : '')}</span></div>
      <div class="rvg"><div><small>Sown</small>${shortDate(p.sowDate)}</div><div><small>To first pick</small>${st.toFirst != null ? st.toFirst + ' days' : '—'}</div>${p.method === 'seed' ? `<div><small>Germination</small>${p.germ ? p.germ.result : '—'}</div>` : ''}</div>
      <div class="cbar"><span style="width:${(st.total / maxT) * 100}%"></span><b>${st.total} picked</b></div>
      ${st.pests.length ? `<div class="rvx">Problems: ${st.pests.map(pestName).join(', ')}</div>` : ''}</a>`; }).join('')}`;
  return { html, after: () => $('#cmpSel').addEventListener('change', e => location.replace('#/compare?crop=' + e.target.value)) };
}

// ---------- harvest totals ----------
export function harvestTotalsSection() {
  const y = String(new Date().getFullYear());
  const tot = {};
  for (const p of S.plantings) for (const h of p.harvests || []) if ((h.date || '').startsWith(y)) tot[p.cropId] = (tot[p.cropId] || 0) + (+h.count || 0);
  const rows = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  return `<section><h3>Harvests in ${y}</h3>${rows.length ? `<ul class="plist">${rows.map(([id, n]) => `<li>${ic(id)}<span class="grow">${esc(cropName(id))}</span><b>${n}</b></li>`).join('')}</ul>` : '<p class="muted">Nothing logged yet. Use “Log a harvest” on a crop’s page.</p>'}</section>`;
}

// ---------- product totals ----------
export const unitBase = u => u === 'handful' ? ['g', HANDFUL_G] : u === 'kg' ? ['g', 1000] : u === 'L' ? ['mL', 1000] : u === 'mL' ? ['mL', 1] : ['g', 1];
export const fmtTot = (v, b) => b === 'g' ? (v >= 1000 ? `${+(v / 1000).toFixed(2)} kg` : `${Math.round(v)} g`) : (v >= 1000 ? `${+(v / 1000).toFixed(2)} L` : `${Math.round(v)} mL`);
function productUses(year) {
  const uses = [];
  for (const e of S.log || []) {
    if (!e.product || e.amount == null || !['fert', 'spray', 'soil', 'pest', 'other', 'water'].includes(e.kind) || (year && e.date.slice(0, 4) !== year)) continue;
    const targets = [...new Set([...(e.cids || []), ...(e.pids || []).map(id => (planting(id) || {}).containerId).filter(Boolean)])];
    const [b, mul] = unitBase(e.unit), amt = +e.amount * mul;
    if (!targets.length) uses.push({ product: e.product, kind: e.kind, date: e.date, base: b, amt, cid: '' });
    else targets.forEach(cid => uses.push({ product: e.product, kind: e.kind, date: e.date, base: b, amt: e.per === 'total' ? amt / targets.length : amt, cid }));
  }
  for (const p of S.plantings) for (const s of p.series || []) {
    if (!s.product || s.amount == null) continue;
    for (const t of S.tasks) if (t.seriesId === s.id && t.done && t.doneOn && (!year || t.doneOn.slice(0, 4) === year)) {
      const [b, mul] = unitBase(s.unit); uses.push({ product: s.product, kind: 'fert', date: t.doneOn, base: b, amt: +s.amount * mul, cid: p.containerId });
    }
  }
  return uses;
}
export function pageTotals(q) {
  const years = [...new Set([...(S.log || []).map(e => e.date.slice(0, 4)), ...S.tasks.filter(t => t.doneOn).map(t => t.doneOn.slice(0, 4)), todayStr().slice(0, 4)])].sort().reverse();
  const y = q.get('y') || years[0], kf = q.get('k') || 'all', cid = q.get('c') || '';
  setChrome('Product totals', { back: true, kicker: y === 'all' ? 'All years' : y });
  let uses = productUses(y === 'all' ? '' : y);
  if (kf !== 'all') uses = uses.filter(u => (kf === 'fert' ? ['fert', 'soil'].includes(u.kind) : u.kind === kf));
  if (cid) uses = uses.filter(u => u.cid === cid || !u.cid);
  const by = {};
  for (const u of uses) { const k = u.product.trim().toLowerCase() + '|' + u.base; (by[k] = by[k] || { name: u.product.trim(), base: u.base, kind: u.kind, total: 0, n: 0, last: '', beds: {} }); const r = by[k]; r.total += u.amt; r.n++; if (u.date > r.last) r.last = u.date; r.beds[u.cid] = (r.beds[u.cid] || 0) + u.amt; }
  const rows = Object.values(by).sort((a, b) => b.n - a.n);
  const url = o => { const u = new URLSearchParams({ y, k: kf, c: cid }); for (const k in o) u.set(k, o[k]); [...u.keys()].forEach(k => { if (!u.get(k) || u.get(k) === 'all' && k !== 'y') u.delete(k); }); return '#/totals?' + u; };
  const chip = (k, l, cur, key) => `<a class="chip big${k === cur ? ' on' : ''}" href="${url({ [key]: k })}" onclick="location.replace(this.href);return false;">${l}</a>`;
  const html = `<div class="sowchips filt">${years.map(v => chip(v, v, y, 'y')).join('')}${chip('all', 'All years', y, 'y')}</div>
    <div class="sowchips filt">${[['all', 'Everything'], ['fert', 'Fertiliser & soil'], ['spray', 'Sprays']].map(([k, l]) => chip(k, l, kf, 'k')).join('')}</div>
    <label class="inline">Bed / pot <select id="totc"><option value="">All</option>${S.containers.map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${rows.length ? rows.map(r => `<section class="tot"><h3>${KIND_ICON[r.kind] || '•'} ${esc(r.name)}</h3>
      <p class="big">${fmtTot(cid ? (r.beds[cid] || 0) : r.total, r.base)}<small> · used ${r.n}× · last ${shortDate(r.last)}</small></p>
      ${!cid ? `<ul class="plist tight">${Object.entries(r.beds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span class="grow">${k ? esc((container(k) || {}).name || '?') : 'Whole garden'}</span><b>${fmtTot(v, r.base)}</b></li>`).join('')}</ul>` : ''}
      ${cid && r.beds[''] ? `<p class="hint">Plus ${fmtTot(r.beds[''], r.base)} logged for the whole garden.</p>` : ''}</section>`).join('')
      : '<div class="empty-state">No amounts logged yet.<br><small>Log fertiliser or sprays with an amount (Log tab → Log something), or add a product and amount to a repeating fertiliser job.</small></div>'}
    <p class="hint">Handfuls count as ~${HANDFUL_G} g. When one entry covers several beds, the amount is counted per bed unless you chose “in total”.</p>`;
  return { html, after: () => { $('#totc').onchange = e => location.replace(url({ c: e.target.value })); } };
}

// ---------- purchases (all spending, all up) ----------
const BUY_CATS = [['spray', '💦 Sprays'], ['fert', '🌿 Fertiliser & lime'], ['compost', '🪏 Compost & soil'], ['seeds', '🫘 Seeds'], ['seedlings', '🌱 Seedlings'],
  ['net', '🕸️ Netting & covers'], ['mulch', '⬛ Mulch & sheeting'], ['support', '🪵 Supports & ties'], ['pots', '🪴 Bags, pots & trays'], ['tools', '🧰 Tools & equipment'], ['fees', '🏷️ Plot fees'], ['other', '✎ Other']];
const catOfProduct = pr => !pr ? 'other' : pr.kind === 'spray' ? 'spray' : pr.kind === 'compost' ? 'compost' : pr.kind === 'homemade' ? 'other' : 'fert';
const yen = n => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
export function purchaseDialog(e, preset) {
  const isNew = !e, td = todayStr();
  e = e || Object.assign({ id: uid(), date: td, item: '', cat: 'other', cost: '', qty: '', note: '' }, preset || {});
  const known = [...new Set([...libList().map(p => p.en), ...(S.purchases || []).map(x => x.item)])];
  modal(`<h3>${isNew ? 'Record a purchase' : 'Edit purchase'}</h3><form id="buyf" class="form">
      <label>What<input name="item" list="buyl" value="${esc(e.item)}" required placeholder="e.g. Insect netting 1.8 × 5 m"><datalist id="buyl">${known.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <div class="two"><label>Cost (¥)<input name="cost" type="number" inputmode="numeric" min="0" value="${e.cost ?? ''}" required></label><label>Quantity / size<input name="qty" value="${esc(e.qty || '')}" placeholder="e.g. 2 bags, 5 kg"></label></div>
      <label>Category<select name="cat">${BUY_CATS.map(([k, l]) => `<option value="${k}"${k === e.cat ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="two"><label>Date<input name="date" type="date" value="${e.date || ''}" max="${td}"></label><label class="inl chkline"><input type="checkbox" name="nodate"${e.date ? '' : ' checked'}> <span>Don’t remember when</span></label></div>
      <label>Note<input name="note" value="${esc(e.note || '')}" placeholder="shop, brand…"></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#buyf');
    f.item.addEventListener('change', () => { const pr = productByName(f.item.value.trim()); if (pr) f.cat.value = catOfProduct(pr); });
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]'); if (del) del.onclick = async () => { S.purchases = S.purchases.filter(x => x.id !== e.id); await save(); close(); render(); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      const pr = productByName(f.item.value.trim());
      Object.assign(e, { item: f.item.value.trim(), cost: Math.round(+f.cost.value || 0), qty: f.qty.value.trim(), cat: f.cat.value, date: f.nodate.checked ? '' : (f.date.value || td), note: f.note.value.trim(), productId: pr ? pr.id : null });
      if (isNew) (S.purchases = S.purchases || []).push(e);
      await save(); close(); render();
    };
  });
}
export function pageSpend(q) {
  setChrome('Spending', { back: true, kicker: 'Everything bought for the garden' });
  const all = (S.purchases || []).slice(), yr = q.get('y') || 'all';
  const years = [...new Set(all.map(x => x.date ? x.date.slice(0, 4) : 'earlier'))].sort().reverse();
  const list = yr === 'all' ? all : all.filter(x => (x.date ? x.date.slice(0, 4) : 'earlier') === yr);
  const total = list.reduce((a, b) => a + (+b.cost || 0), 0), grand = all.reduce((a, b) => a + (+b.cost || 0), 0);
  const byCat = BUY_CATS.map(([k, l]) => [k, l, list.filter(x => x.cat === k).reduce((a, b) => a + (+b.cost || 0), 0)]).filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]);
  const max = Math.max(1, ...byCat.map(x => x[2]));
  A.newBuy = () => purchaseDialog();
  A.editBuy = el => purchaseDialog(all.find(x => x.id === el.dataset.id));
  const groups = {}; for (const x of list.sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1))) { const k = x.date ? new Date(x.date + 'T00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) : 'Earlier (no date)'; (groups[k] = groups[k] || []).push(x); }
  const html = `<div class="spendtot"><b>${yen(total)}</b><span>${yr === 'all' ? 'spent all up' : yr === 'earlier' ? 'with no date' : 'in ' + yr}${yr !== 'all' ? ` · ${yen(grand)} all up` : ''}</span></div>
    ${years.length > 1 ? `<div class="filt"><a class="chip ${yr === 'all' ? 'on' : ''}" href="#/spend">All</a>${years.map(y => `<a class="chip ${y === yr ? 'on' : ''}" href="#/spend?y=${y}">${y === 'earlier' ? 'No date' : y}</a>`).join('')}</div>` : ''}
    <button class="btn primary wide" data-act="newBuy">＋ Record a purchase</button>
    ${byCat.length ? `<section><h3>By category</h3><div class="sbars">${byCat.map(([, l, v]) => `<div class="sbar"><span>${l}</span><i style="width:${v / max * 100}%"></i><b>${yen(v)}</b></div>`).join('')}</div></section>` : ''}
    ${Object.entries(groups).map(([k, xs]) => `<section><h3>${k} <small class="muted">${yen(xs.reduce((a, b) => a + (+b.cost || 0), 0))}</small></h3><ul class="plist">${xs.map(x => `<li data-act="editBuy" data-id="${x.id}"><span class="lic">${(BUY_CATS.find(c => c[0] === x.cat) || ['', '✎'])[1].split(' ')[0]}</span><span class="grow"><b>${esc(x.item)}</b><small>${[x.qty, x.date ? shortDate(x.date) : '', x.note].filter(Boolean).map(esc).join(' · ')}</small></span><b>${yen(x.cost)}</b></li>`).join('')}</ul></section>`).join('')}
    ${!all.length ? '<p class="hint">Add what you’ve already bought too — tick “Don’t remember when” for older things. Products, seeds, seedlings, netting, mulch, supports, bags, tools, plot fees…</p>' : ''}`;
  return { html };
}
