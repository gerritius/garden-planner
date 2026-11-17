/* Your own products: add or edit fertilisers the app doesn't know (N-P-K, how fast they release, and for liquids
   the dose you mix into the can). Stored in S.customProducts and used everywhere a built-in product is. */
'use strict';

const CUSTOM_FORMS = [['quick', 'Granular, quick (chemical, ~1 month)'], ['slow', 'Organic, slow (~2 months)'], ['liquid', 'Liquid feed (mixed into water)'], ['compost', 'Compost / soil improver']];
function customByName(n) {
  if (!n) return null; const t = String(n).trim(), lo = t.toLowerCase();
  return (S.customProducts || []).find(x => x.id === t || (x.en || '').toLowerCase() === lo || (x.ja && x.ja === t)) || null;
}
const potLitres = () => (S.water && +S.water.perBagL) || 4;   // litres of (diluted) water each pot gets — set under Tools → Reminders → Watering
// liquid with a mixing measure: amounts in mL are "mL per <per> L of water", and each pot gets potLitres() of that
const liqMeasure = name => { const pr = customByName(name); return pr && pr.form === 'liquid' && +pr.per > 0 ? pr : null; };
function concentrateML(name, mL) { const pr = liqMeasure(name); return pr ? mL / pr.per * potLitres() : mL; }
// how an amount reads for this product (e.g. "5 mL per 5 L (weak)")
function amtFor(name, amount, unit) {
  const pr = liqMeasure(name);
  if (!pr || unit !== 'mL') return fmtAmt(amount, unit);
  const i = (pr.doses || []).indexOf(+amount), lbl = i < 0 ? '' : pr.doses.length === 1 ? '' : i === 0 ? ' (weak)' : i === pr.doses.length - 1 ? ' (strong)' : '';
  return `${amount} mL per ${pr.per} L${lbl}`;
}

// counted amounts
function feedGrams(amount, unit, name) {
  const a = +amount; if (!(a > 0)) return 0;
  const cp = customByName(name);
  if (cp) {
    if (unit === 'mL' || unit === 'L') { const mL = unit === 'L' ? a * 1000 : a; return (cp.form === 'liquid' ? concentrateML(name, mL) : mL) * (cp.form === 'liquid' ? 1.2 : cp.form === 'compost' ? 0.5 : 0.9); }
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
function doseOf(name, nPerDose, bag) {
  const npk = npkOf(name); if (!npk || !npk[0]) return null;
  if (isLiquid(name)) {
    const conc = nPerDose / (1.2 * npk[0] / 100), pr = liqMeasure(name);
    if (pr) { const want = conc * pr.per / potLitres(), ds = (pr.doses || []).slice().sort((a, b) => a - b); return { amount: ds.length ? ds.reduce((b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b), ds[0]) : Math.max(1, Math.round(want)), unit: 'mL' }; }
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
  const isNew = !x; x = x || { id: 'cust_' + uid(), en: '', ja: '', form: 'quick', npkv: ['', '', ''], per: 5, doses: [5, 10] };
  const used = n => (S.log || []).some(e => e.product === n) || S.plantings.some(p => (p.fert || []).some(f => f.product === n) || (p.feedPlan || []).some(s => s.product === n));
  modal(`<h3>${isNew ? 'Add a product' : 'Edit product'}</h3><form id="opf" class="form">
      <label>Name<input name="en" value="${esc(x.en)}" required placeholder="e.g. Kincho Liquid 6-6-7"></label>
      <label>Japanese name <small>(optional)</small><input name="ja" value="${esc(x.ja || '')}"></label>
      <label>Type<select name="form">${CUSTOM_FORMS.map(([k, l]) => `<option value="${k}"${x.form === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>N-P-K (from the label)<div class="fgrid3"><input name="n" type="number" step="any" inputmode="decimal" value="${x.npkv ? x.npkv[0] : ''}" placeholder="N"><input name="p" type="number" step="any" inputmode="decimal" value="${x.npkv ? x.npkv[1] : ''}" placeholder="P"><input name="k" type="number" step="any" inputmode="decimal" value="${x.npkv ? x.npkv[2] : ''}" placeholder="K"></div></label>
      <div id="liq"><label>Doses (mL of concentrate), comma-separated — weakest first<input name="doses" value="${esc((x.doses || []).join(', '))}" placeholder="e.g. 5, 10"></label>
        <label>…mixed into how many litres of water<input name="per" type="number" step="any" inputmode="decimal" value="${x.per || 5}"></label>
        <p class="hint">Each pot gets about ${potLitres()} L of the mixed feed (your watering amount, set under Tools → Reminders), so a dose of 5 mL per 5 L counts as ${(5 / 5 * potLitres()).toFixed(1)} mL of concentrate per pot.</p></div>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del">Delete</button>'}<button class="btn primary">Save</button></div></form>`, (m, close) => {
    const f = m.querySelector('#opf'), sh = () => { m.querySelector('#liq').hidden = f.form.value !== 'liquid'; };
    f.form.onchange = sh; sh();
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = close;
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      if (used(x.en) && !await confirmBox(`<b>${esc(x.en)}</b> is in your records. They stay, but without its N-P-K and doses the app may count them differently. Delete?`, 'Delete', true)) return;
      S.customProducts = (S.customProducts || []).filter(y => y.id !== x.id); if (S.myProducts) S.myProducts = S.myProducts.filter(id => id !== x.id); await save(); close(); render();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const n = [f.n.value, f.p.value, f.k.value].map(v => +v || 0), oldName = x.en;
      Object.assign(x, { en: f.en.value.trim(), ja: f.ja.value.trim(), form: f.form.value, kind: f.form.value === 'compost' ? 'compost' : 'fert', npkv: n.some(v => v > 0) ? n : null, npk: n.join('-'),
        per: +f.per.value || 5, doses: f.doses.value.split(/[,、\s]+/).map(Number).filter(v => v > 0).sort((a, b) => a - b), custom: true, organic: f.form.value === 'slow' || f.form.value === 'compost' });
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

// Kincho liquid feed was typed in by name; make it a proper product (6-6-7, 5 or 10 mL per 5 L of water)
function migrateOwnProducts() {
  if (S.ownMigrated) return; S.ownMigrated = true;
  const names = [...new Set([...S.plantings.flatMap(p => [...(p.feedPlan || []), ...(p.fert || [])].map(f => f.product)), ...(S.log || []).map(e => e.product), ...S.tasks.map(t => t.product)].filter(n => n && /kincho|キンチョ|金鳥/i.test(n)))];
  if (!names.length || (S.customProducts || []).some(x => /kincho/i.test(x.en))) return;
  const en = names.find(n => /6\s*-\s*6\s*-\s*7/.test(n)) || names[0];
  (S.customProducts = S.customProducts || []).push({ id: 'cust_kincho', en, ja: '', form: 'liquid', kind: 'fert', npkv: [6, 6, 7], npk: '6-6-7', per: 5, doses: [5, 10], custom: true });
  if (S.myProducts && !S.myProducts.includes('cust_kincho')) S.myProducts.push('cust_kincho');
  // other spellings of the same product become the one name
  const re = /kincho|キンチョ|金鳥/i, fix = o => { if (o && o.product && o.product !== en && re.test(o.product)) o.product = en; };
  (S.log || []).forEach(fix); S.tasks.forEach(t => { if (t.product && t.product !== en && re.test(t.product)) { t.title = (t.title || '').split(t.product).join(en); fix(t); } });
  S.plantings.forEach(p => { (p.fert || []).forEach(fix); (p.feedPlan || []).forEach(fix); });
}
