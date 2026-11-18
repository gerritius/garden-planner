/* Your own products: add or edit fertilisers the app doesn't know (N-P-K, how fast they release, and for liquids
   the dose you mix into the can). Stored in S.customProducts and used everywhere a built-in product is. */
'use strict';

const CUSTOM_FORMS = [['quick', 'Granular, quick (chemical, ~1 month)'], ['slow', 'Organic, slow (~2 months)'], ['liquid', 'Liquid feed (mixed into water)'], ['compost', 'Compost / soil improver']];
function customByName(n) {
  if (!n) return null; const t = String(n).trim(), lo = t.toLowerCase();
  return (S.customProducts || []).find(x => x.id === t || (x.en || '').toLowerCase() === lo || (x.ja && x.ja === t)) || null;
}
// litres of (diluted) feed a pot gets: your watering amount (per 40 L bag, Tools → Reminders) scaled to this pot's soil volume
const potLitres = c => ((S.water && +S.water.perBagL) || 4) * (c && c.type !== 'bed' ? (potVolume(c) || 40) / 40 : 1);
// liquid with a mixing measure: amounts in mL are "mL per <per> L of water", and each pot gets potLitres() of that
const liqMeasure = name => { const pr = customByName(name); return pr && pr.form === 'liquid' && +pr.per > 0 ? pr : null; };
function concentrateML(name, mL, c) { const pr = liqMeasure(name); return pr ? mL / pr.per * potLitres(c) : mL; }
// how an amount reads for this product (e.g. "5 mL per 5 L (weak)")
function amtFor(name, amount, unit) {
  const pr = liqMeasure(name);
  if (!pr || unit !== 'mL') return fmtAmt(amount, unit);
  const i = (pr.doses || []).indexOf(+amount), lbl = i < 0 ? '' : pr.doses.length === 1 ? '' : i === 0 ? ' (weak)' : i === pr.doses.length - 1 ? ' (strong)' : '';
  return `${amount} mL per ${pr.per} L${lbl}`;
}

// counted amounts
function feedGrams(amount, unit, name, c) {
  const a = +amount; if (!(a > 0)) return 0;
  const cp = customByName(name);
  if (cp) {
    if (unit === 'mL' || unit === 'L') { const mL = unit === 'L' ? a * 1000 : a; return (cp.form === 'liquid' ? concentrateML(name, mL, c) : mL) * (cp.form === 'liquid' ? 1.2 : cp.form === 'compost' ? 0.5 : 0.9); }
    return unit === 'kg' ? a * 1000 : unit === 'handful' ? a * HANDFUL_G : a;
  }
  const pr = productByName(name || ''), d = pr ? (DENS_ID[pr.id] || DENS[pr.kind] || 0.6) : isLiquid(name) ? 1.2 : 0.6;   // liquids: the concentrate
  return unit === 'kg' ? a * 1000 : unit === 'handful' ? a * HANDFUL_G : unit === 'L' ? a * 1000 * d : unit === 'mL' ? a * d : a;
}
function npkOf(name) {
  const cp = customByName(name);
  if (cp && cp.npkv) return [cp.npkv[0], cp.npkv[1], cp.npkv[2], cp.form === 'slow' ? 0.7 : cp.form === 'compost' ? 0.25 : 1];
  const pr = productByName(name || ''); if (pr && NPK[pr.id]) return NPK[pr.id];
  const m = String(name || '').match(/(\d{1,2})\s*[-‐–・]\s*(\d{1,2})\s*[-‐–・]\s*(\d{1,2})/);   // e.g. 化成肥料 8-8-8
  return m ? [+m[1], +m[2], +m[3], 1] : null;
}
// a normal dose: liquids snap to the strengths you mix (weak / strong)
function doseOf(name, nPerDose, bag, c) {
  const npk = npkOf(name); if (!npk || !npk[0]) return null;
  if (isLiquid(name)) {
    const conc = nPerDose / (1.2 * npk[0] / 100), pr = liqMeasure(name);
    if (pr) { const want = conc * pr.per / potLitres(c), ds = (pr.doses || []).slice().sort((a, b) => a - b); return { amount: ds.length ? ds.reduce((b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b), ds[0]) : Math.max(1, Math.round(want)), unit: 'mL' }; }
    return { amount: Math.max(1, Math.round(conc)), unit: 'mL' };
  }
  const g = nPerDose / (npk[0] / 100 * (npk[3] || 0.7));
  if (bag) return { amount: Math.max(2, Math.round(g)), unit: 'g' };
  return g >= 15 ? { amount: Math.max(0.5, Math.round(g / HANDFUL_G * 2) / 2), unit: 'handful' } : { amount: Math.max(5, Math.round(g / 5) * 5), unit: 'g' };
}

// ---------- the editor ----------
function myOwnSection() {
  const list = S.customProducts || [];
  A.newOwn = () => ownProductDialog();
  A.editOwn = el => ownProductDialog(list.find(x => x.id === el.dataset.id));
  return `<section><h3>Your own products</h3>
    ${list.length ? `<ul class="plist">${list.map(x => `<li data-act="editOwn" data-id="${x.id}"><span class="grow"><b>${esc(x.en)}</b>${x.ja ? ` ${esc(x.ja)}` : ''}<small>${x.npkv ? x.npkv.join('-') + ' · ' : ''}${esc((CUSTOM_FORMS.find(f => f[0] === x.form) || ['', ''])[1])}${x.form === 'liquid' && x.per ? ` · ${(x.doses || []).join(' or ')} mL per ${x.per} L` : ''}</small></span><span class="muted">✎</span></li>`).join('')}</ul>` : '<p class="muted">Anything the app doesn’t know — add its N-P-K and how you use it.</p>'}
    <button class="btn small" data-act="newOwn">＋ Add a product</button></section>`;
}
function ownProductDialog(x) {
  const isNew = !x; x = x || { id: 'cust_' + uid(), en: '', ja: '', form: 'quick', npkv: ['', '', ''], per: '', doses: [] };
  const used = n => (S.log || []).some(e => e.product === n) || S.plantings.some(p => (p.fert || []).some(f => f.product === n) || (p.feedPlan || []).some(s => s.product === n));
  modal(`<h3>${isNew ? 'Add a product' : 'Edit product'}</h3><form id="opf" class="form">
      <label>Name<input name="en" value="${esc(x.en)}" required placeholder="e.g. Hyponex 6-10-5"></label>
      <label>Japanese name <small>(optional)</small><input name="ja" value="${esc(x.ja || '')}"></label>
      <label>Type<select name="form">${CUSTOM_FORMS.map(([k, l]) => `<option value="${k}"${x.form === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>N-P-K (from the label)<div class="fgrid3"><input name="n" type="number" step="any" inputmode="decimal" value="${x.npkv ? x.npkv[0] : ''}" placeholder="N"><input name="p" type="number" step="any" inputmode="decimal" value="${x.npkv ? x.npkv[1] : ''}" placeholder="P"><input name="k" type="number" step="any" inputmode="decimal" value="${x.npkv ? x.npkv[2] : ''}" placeholder="K"></div></label>
      <div id="liq"><label>Doses (mL of concentrate), comma-separated — weakest first<input name="doses" value="${esc((x.doses || []).join(', '))}" placeholder="from the label, e.g. 5, 10"></label>
        <label>…mixed into how many litres of water<input name="per" type="number" step="any" inputmode="decimal" value="${x.per || ''}" placeholder="e.g. 5"></label>
        <p class="hint">Each pot gets about ${potLitres()} L of the mixed feed per 40 L of soil (your watering amount, set under Tools → Reminders) — more for bigger pots, less for smaller ones.</p></div>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del" data-own-confirm>Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#opf'), sh = () => { m.querySelector('#liq').hidden = f.form.value !== 'liquid'; };
    f.form.onchange = sh; sh();
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      if (!await confirmBox(used(x.en) ? `<b>${esc(x.en)}</b> is in your records. They stay, but without its N-P-K and doses the app may count them differently. Delete it?` : `Delete <b>${esc(x.en)}</b>? This can’t be undone.`, 'Delete', true)) return;
      S.customProducts = (S.customProducts || []).filter(y => y.id !== x.id); if (S.myProducts) S.myProducts = S.myProducts.filter(id => id !== x.id); await save(); close(); render();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const n = [f.n.value, f.p.value, f.k.value].map(v => +v || 0), oldName = x.en;
      Object.assign(x, { en: f.en.value.trim(), ja: f.ja.value.trim(), form: f.form.value, kind: f.form.value === 'compost' ? 'compost' : 'fert', npkv: n.some(v => v > 0) ? n : null, npk: n.join('-'),
        per: +f.per.value || null, doses: f.doses.value.split(/[,、\s]+/).map(Number).filter(v => v > 0).sort((a, b) => a - b), custom: true, organic: f.form.value === 'slow' || f.form.value === 'compost' });
      if (!x.en) return;
      if (isNew) { (S.customProducts = S.customProducts || []).push(x); if (S.myProducts) S.myProducts.push(x.id); }
      // a rename carries through to records and plans
      if (!isNew && oldName && oldName !== x.en) {
        for (const l of S.log || []) if (l.product === oldName) l.product = x.en;
        for (const p of S.plantings) { for (const g of p.fert || []) if (g.product === oldName) g.product = x.en; for (const s of p.feedPlan || []) if (s.product === oldName) s.product = x.en; }
      }
      await save(); close(); render();
    };
  });
}

// Liquid feeds typed in by name with an N-P-K (e.g. "XYZ Liquid 6-6-7") become your own products, so they can be given
// a mixing measure (mL per so many litres). Names that only differ in spelling/case are merged into one.
function migrateOwnProducts() {
  if (S.ownMigrated2) return; S.ownMigrated2 = true;
  const all = [...S.plantings.flatMap(p => [...(p.feedPlan || []), ...(p.fert || [])].map(f => f.product)), ...(S.log || []).map(e => e.product), ...S.tasks.map(t => t.product)].filter(Boolean);
  const key = n => n.toLowerCase().replace(/\s+/g, ' ').trim(), groups = {};
  for (const n of all) { if (!isLiquid(n) || !/\d{1,2}\s*-\s*\d{1,2}\s*-\s*\d{1,2}/.test(n) || (productByName(n) && !customByName(n))) continue; (groups[key(n)] = groups[key(n)] || []).push(n); }
  for (const names of Object.values(groups)) {
    const existing = names.map(customByName).find(Boolean);
    const en = existing ? existing.en : Object.entries(names.reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0][0];
    if (!existing) {
      const m = en.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})/), id = 'cust_' + uid();
      (S.customProducts = S.customProducts || []).push({ id, en, ja: '', form: 'liquid', kind: 'fert', npkv: [+m[1], +m[2], +m[3]], npk: `${m[1]}-${m[2]}-${m[3]}`, per: null, doses: [], custom: true });
      if (S.myProducts && !S.myProducts.includes(id)) S.myProducts.push(id);
    }
    const fix = o => { if (o && o.product && o.product !== en && key(o.product) === key(en)) o.product = en; };
    (S.log || []).forEach(fix); S.tasks.forEach(t => { if (t.product && t.product !== en && key(t.product) === key(en)) { t.title = (t.title || '').split(t.product).join(en); fix(t); } });
    S.plantings.forEach(p => { (p.fert || []).forEach(fix); (p.feedPlan || []).forEach(fix); });
  }
}

// ---------- the same planting in other pots ----------
function copyPlantingDialog(p) {
  const c0 = container(p.containerId), td = todayStr();
  const targets = S.containers.filter(c => c.id !== p.containerId && (c.type === 'bed') === (c0.type === 'bed'));
  if (!targets.length) return alert(`No other ${c0.type === 'bed' ? 'beds' : 'pots'} to copy to.`);
  const busy = c => { const L = Draw.dims(c).L, f = Math.min(p.from, L), t = c0.type === 'bed' ? Math.min(p.to, L) : L;
    return (isPlanned(p) ? occupants(c.id, f, t, p.sowDate, p.sowDate) : activeIn(c.id).filter(x => x.from < t - 0.5 && x.to > f + 0.5)).map(x => crop(x.cropId).en); };
  modal(`<h3>⧉ Same in other ${c0.type === 'bed' ? 'beds' : 'pots'}</h3><p class="muted small">${esc(cropName(p.cropId))}${p.variety ? ' · ' + esc(p.variety) : ''} · ${p.method === 'seed' ? 'sown' : 'planted'} ${shortDate(p.sowDate)}</p>
    <form id="cpf" class="form"><div class="sowchips">${targets.map(c => { const b = busy(c); return `<label class="chip big tog${b.length ? ' off' : ''}"><input type="checkbox" name="t" value="${c.id}"${b.length ? ' disabled' : ''}><span>${BED_ICON(16)} ${esc(c.name)}${b.length ? ` <small>${esc(b.join(', '))}</small>` : ''}</span></label>`; }).join('')}</div>
      <button type="button" class="link" data-x="all">Select all empty ${c0.type === 'bed' ? 'beds' : 'pots'}</button>
      ${p.sowDate <= td ? `<label class="inl chkline"><input type="checkbox" name="hist" checked> <span>Also copy jobs ticked off and feedings recorded so far <small>(if you did them for all the pots)</small></span></label>` : ''}
      <p class="hint">Copies the crop, variety, date, layout and spacing, potting mix, starting fertiliser, repeating jobs and feeding plan. Photos, notes and harvests stay with this one.</p>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Copy</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('[data-x=all]').onclick = () => m.querySelectorAll('#cpf input[name=t]:not(:disabled)').forEach(i => { i.checked = true; });
    m.querySelector('#cpf').onsubmit = async e => {
      e.preventDefault(); const f = e.target, ids = [...f.querySelectorAll('input[name=t]:checked')].map(i => i.value), hist = f.hist && f.hist.checked;
      if (!ids.length) return close();
      for (const cid of ids) copyPlanting(p, container(cid), hist);
      await save(); close(); render();
    };
  });
}
function copyPlanting(p, c, hist) {
  const c0 = container(p.containerId), L = Draw.dims(c).L, sameSize = Draw.dims(c0).L === L && Draw.dims(c0).W === Draw.dims(c).W;
  const q = JSON.parse(JSON.stringify(p));
  Object.assign(q, { id: uid(), containerId: c.id, created: todayStr(), photos: {}, diary: [], harvests: [], prevSpans: [], notes: '' });
  if (c.type === 'bed') { q.from = Math.min(p.from, L - 1); q.to = Math.min(p.to, L); } else { q.from = 0; q.to = L; }
  if (!sameSize) delete q.positions;
  const sMap = {};
  q.series = (q.series || []).map(s => { const id = uid(); sMap[s.id] = id; return Object.assign(s, { id }); });
  q.feedPlan = (q.feedPlan || []).map(s => { const id = uid(); sMap[s.id] = id; return Object.assign(s, { id }); });
  S.plantings.push(q);
  // potting mix: the same choice as the original
  const ev = (c0.mixLog || []).find(x => x.pid === p.id);
  if (ev && c.type !== 'bed') (c.mixLog = (c.mixLog || []).filter(x => x.pid !== q.id)).push(Object.assign({}, ev, { id: uid(), pid: q.id }));
  syncTasks(q);
  if (hist) {
    // jobs on the original (done and to-do) come across; built-in ones just take the original's ticks
    const mine = S.tasks.filter(t => t.plantingId === q.id), clones = [];
    for (const t of S.tasks.filter(t => t.plantingId === p.id)) {
      const twin = !t.seriesId && !t.schedId && mine.find(x => x.kind === t.kind && x.title === t.title);
      if (twin) { if (t.done) Object.assign(twin, { done: true, doneOn: t.doneOn, due: t.due }); continue; }
      clones.push(Object.assign(JSON.parse(JSON.stringify(t)), { id: uid(), plantingId: q.id, seriesId: t.seriesId ? sMap[t.seriesId] || t.seriesId : t.seriesId, schedId: t.schedId ? sMap[t.schedId] || t.schedId : t.schedId, logId: null }));
    }
    const cloned = new Set(clones.map(t => t.seriesId || t.schedId).filter(Boolean));
    S.tasks = S.tasks.filter(x => !(x.plantingId === q.id && (cloned.has(x.seriesId) || cloned.has(x.schedId))));   // the clones replace the fresh copies
    S.tasks.push(...clones);
    // feedings recorded for this crop alone count for the copy too
    for (const l of S.log || []) if ((l.pids || []).includes(p.id) && !(l.cids || []).length) l.pids.push(q.id);
    if (p.thinned) q.thinned = true;
  } else { q.thinned = false; q.thinDoneOn = null; }
  return q;
}

// ---------- your seed trays and small pots (sizes are yours to set) ----------
function applyNursery() {
  const n = S.nursery; if (!n) return;
  if (+n.cells > 0) { NURSERY.tray.cells = +n.cells; NURSERY.tray.cols = +n.cols > 0 ? +n.cols : Math.round(Math.sqrt(+n.cells)); NURSERY.tray.en = `${n.cells}-cell tray`; }
  if (n.traySize) NURSERY.tray.size = n.traySize;
  if (+n.potCm > 0) { NURSERY.pot.en = `${n.potCm} cm pots`; NURSERY.pot.size = `⌀${n.potCm} cm`; }
}
function nurseryDialog() {
  const t = NURSERY.tray, potCm = (S.nursery && S.nursery.potCm) || 9;
  modal(`<h3>Your trays & pots</h3><form id="nuf" class="form">
      <div class="two"><label>Cells per tray<input name="cells" type="number" min="1" inputmode="numeric" value="${t.cells}"></label><label>Cells across<input name="cols" type="number" min="1" inputmode="numeric" value="${t.cols}"></label></div>
      <label>Tray size <small>(optional, for your notes)</small><input name="traySize" value="${esc(t.size || '')}"></label>
      <label>Small pot size (cm across)<input name="potCm" type="number" min="1" step="0.5" inputmode="decimal" value="${potCm}"></label>
      <div class="btns"><button type="button" class="btn" data-x="no">Cancel</button><button class="btn primary">Save</button></div></form>`, (m, close) => {
    m.querySelector('[data-x=no]').onclick = close;
    m.querySelector('#nuf').onsubmit = async e => { e.preventDefault(); const f = e.target; S.nursery = { cells: +f.cells.value || t.cells, cols: +f.cols.value || null, traySize: f.traySize.value.trim(), potCm: +f.potCm.value || 9 }; applyNursery(); await save(); close(); render(); };
  });
}
