// The Products page, a product's page, and adding or editing any product.

import { A, notFound, render, setChrome } from '../core/router.js';
import { S, save } from '../core/state.js';
import { confirmBox, modal } from '../core/ui.js';
import { esc, uid } from '../core/util.js';
import { isLive } from '../garden/garden.js';
import { crop, cropOptions, ic } from '../plants/crops.js';
import { seedsTab } from '../plants/seeds.js';
import { defLead, kindOf, libGet, libList, normProd, PROD_FORMS, PROD_KINDS, product, setPlenty } from './library.js';
import { SPRAY_CAVEAT, usesSoFar, waitText } from './sprays.js';

// ---------- the Products page ----------
// tabs: one for each kind of product, and your seeds & plants
const TABS = [['fert', '🌿', 'Fertiliser', 'Fertilisers & feeds', ['fert']], ['soil', '🪨', 'Soil', 'Lime, compost & soil improvers', ['lime', 'compost', 'amend']],
  ['mix', '🪴', 'Potting mix', 'Potting mixes', ['mix']], ['spray', '💦', 'Sprays', 'Sprays', ['spray', 'homemade']], ['seeds', '🌱', 'Seeds & plants', '', null]];
export function pageProducts(q) {
  const tab = TABS.find(t => t[0] === (q && q.get('t'))) || TABS[0];
  setChrome('Products & seeds', { back: true, kicker: 'What you use and grow' });
  A.pTab = el => location.replace('#/products?t=' + el.dataset.t);
  const tabs = `<div class="seg wrap tabs ptabs">${TABS.map(t => `<button type="button" data-act="pTab" data-t="${t[0]}" class="${t === tab ? 'on' : ''}">${t[1]} ${t[2]}</button>`).join('')}</div>`;
  if (!tab[4]) return { html: tabs + seedsTab() };
  const groups = [[tab[3], tab[4], tab[4][0] === 'lime' ? 'compost' : tab[4][0]]];
  const sum = p => [p.npkv && p.npkv.some(v => v > 0) ? p.npkv.join('-') : '', p.kind === 'fert' ? (PROD_FORMS.find(f => f[0] === p.form) || ['', ''])[1] : kindOf(p.kind)[2],
    p.kind === 'mix' && p.lasts ? `fertiliser for ~${p.lasts >= 60 ? Math.round(p.lasts / 30) + ' months' : p.lasts + ' days'}` : '', p.form === 'liquid' && p.per ? `${(p.doses || []).join(' or ')} mL per ${p.per} L` : '',
    p.kind === 'spray' || p.kind === 'homemade' ? (n => n ? `for ${n} crop${n === 1 ? '' : 's'}` : 'no crops entered')(Object.keys(p.crops || {}).length) : '', p.plenty ? '★ plenty' : ''].filter(Boolean).join(' · ');
  A.addProd = el => productDialog(null, el.dataset.k);
  const html = `${tabs}<p class="hint">The app comes with no products — add the ones you use. Plans and suggestions go by what each one is for and its N-P-K; tap one to change it.</p>
    ${groups.map(([t, ks, k0]) => { const l = libList(ks); return `<section><h3>${t}</h3>${l.length ? `<ul class="plist">${l.map(p => `<li><a href="#/product/${p.id}"><span class="lic">${kindOf(p.kind)[1]}</span><span class="grow"><b>${esc(p.en)}</b><small>${esc(sum(p))}</small></span>›</a></li>`).join('')}</ul>` : '<p class="muted small">None yet.</p>'}
      <button class="btn small" data-act="addProd" data-k="${k0}">＋ Add</button></section>`; }).join('')}
    ${tab[0] === 'spray' ? `<p class="hint">${SPRAY_CAVEAT}</p>` : ''}`;
  return { html };
}
// product page: its details, and Edit
export function pageProductLib(id) {
  const p = libGet(id); if (!p) return { html: notFound() };
  const r = pageProduct(id);
  A.editProd = () => productDialog(libGet(id));
  r.html += `<div class="btnrow"><button class="btn" data-act="editProd">✎ Edit product</button></div>`;
  return r;
}

// ---------- add / edit any product ----------
function productDialog(x, kind) {
  const isNew = !x;
  x = x ? JSON.parse(JSON.stringify(x)) : { id: 'p_' + uid(), en: '', maker: '', kind: kind || 'fert', form: 'quick', npkv: null, uses: [], notes: [], organic: false };
  const orig = isNew ? null : libGet(x.id);
  const used = n => (S.log || []).some(e => e.product === n) || S.plantings.some(p => (p.fert || []).some(f => f.product === n) || (p.feedPlan || []).some(s => s.product === n)) || S.containers.some(c => (c.mixLog || []).some(e => e.kind === x.id));
  const num = v => v == null || v === '' ? '' : v;
  const draw = m => {
    const k = x.kind, liquid = k === 'fert' && x.form === 'liquid';
    m.querySelector('.sheet').innerHTML = `<h3>${isNew ? 'Add a product' : 'Edit product'}</h3><form id="pdf" class="form">
      <label>Name<input name="en" value="${esc(x.en)}" required placeholder="As on the bag or bottle"></label>
      <label>Maker <small>(optional)</small><input name="maker" value="${esc(x.maker || '')}"></label>
      <label>Type<select name="kind">${PROD_KINDS.map(([v, i, l]) => `<option value="${v}"${v === k ? ' selected' : ''}>${i} ${l}</option>`).join('')}</select></label>
      ${k === 'fert' ? `<label>Kind of fertiliser<select name="form">${PROD_FORMS.map(([v, l]) => `<option value="${v}"${v === x.form ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      ${['fert', 'lime', 'compost', 'amend', 'mix'].includes(k) ? `<label>${k === 'mix' ? 'Fertiliser in the mix: N-P-K' : 'N-P-K (from the label)'}<div class="fgrid3"><input name="n" type="number" step="any" inputmode="decimal" value="${x.npkv ? num(x.npkv[0]) : ''}" placeholder="N"><input name="p" type="number" step="any" inputmode="decimal" value="${x.npkv ? num(x.npkv[1]) : ''}" placeholder="P"><input name="k" type="number" step="any" inputmode="decimal" value="${x.npkv ? num(x.npkv[2]) : ''}" placeholder="K"></div></label>` : ''}
      ${k === 'mix' ? `<div class="two"><label>Grams of it per litre of mix <small>(estimate)</small><input name="gPerL" type="number" step="any" inputmode="decimal" value="${num(x.gPerL)}" placeholder="e.g. 1"></label><label>Lasts about (days)<input name="lasts" type="number" inputmode="numeric" value="${num(x.lasts)}" placeholder="e.g. 30"></label></div>` : ''}
      ${liquid ? `<div class="two"><label>Doses (mL), weakest first<input name="doses" value="${esc((x.doses || []).join(', '))}" placeholder="from the label, e.g. 5, 10"></label><label>…mixed into (litres)<input name="per" type="number" step="any" inputmode="decimal" value="${num(x.per)}" placeholder="e.g. 5"></label></div>` : ''}
      ${['fert', 'lime', 'compost', 'amend'].includes(k) && !liquid ? `<div class="two"><label>If dug in, how many days before planting?<input name="wait" type="number" inputmode="numeric" value="${num(x.wait)}" placeholder="0 = same day"></label>${k === 'fert' ? `<label>Days until it starts working<input name="lead" type="number" inputmode="numeric" value="${num(x.lead)}" placeholder="0 = within days"></label>` : '<span></span>'}</div>` : ''}
      ${['fert', 'lime', 'compost', 'amend'].includes(k) ? `<label>Suggest it for</label><div class="sowchips">${[['base', 'Starting fertiliser'], ['side', 'Side-dressing / feeding'], ['lime', 'Liming'], ['compost', 'Compost / soil']].filter(([u]) => k === 'fert' ? ['base', 'side'].includes(u) : k === 'lime' ? u === 'lime' : u === 'compost').map(([u, l]) => `<label class="chip big tog"><input type="checkbox" name="use" value="${u}"${(x.uses || []).includes(u) ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>` : ''}
      ${k === 'spray' || k === 'homemade' ? `<label>What’s in it <small>(from the label — also used to warn about bees)</small><input name="what" value="${esc(x.what || '')}" placeholder="e.g. spinosad 25%"></label>
        <fieldset class="spraycrops"><legend>Crops it’s for</legend>
          <p class="hint small">From the label: the crops it may be used on, how many days to wait after spraying before picking, and the most sprays allowed a season (leave empty if the label gives no limit). ${SPRAY_CAVEAT}</p>
          <div class="two"><label>Days before picking <small>(for crops you add)</small><input name="phi0" type="number" inputmode="numeric" min="0" value="${num(x.phi)}" placeholder="e.g. 1"></label><label>Most sprays <small>(for crops you add)</small><input name="max0" type="number" inputmode="numeric" min="1" value="${num(x.max)}" placeholder="no limit"></label></div>
          ${Object.keys(x.crops || {}).length ? `<div class="tscroll"><table class="reg cropsrules"><tr><th>Crop</th><th>Days before picking</th><th>Most sprays</th><th></th></tr>${Object.entries(x.crops).sort((a, b) => crop(a[0]).en.localeCompare(crop(b[0]).en)).map(([cid, r]) => `<tr data-c="${cid}"><td>${ic(cid, 18)} ${esc(crop(cid).en)}</td><td><input name="phi_${cid}" type="number" inputmode="numeric" min="0" value="${num(r.phi)}"></td><td><input name="max_${cid}" type="number" inputmode="numeric" min="1" value="${num(r.max)}" placeholder="no limit"></td><td><button type="button" class="link danger" data-rm="${cid}">✕</button></td></tr>`).join('')}</table></div>` : '<p class="muted small">No crops yet.</p>'}
          <label>Add a crop<select name="addCrop"><option value="">Choose a crop…</option>${cropOptions('', true)}</select></label></fieldset>` : `<label>What it is <small>(optional)</small><input name="what" value="${esc(x.what || '')}"></label>`}
      <label class="inl chkline"><input type="checkbox" name="organic"${x.organic ? ' checked' : ''}> <span>Organic</span></label>
      ${['fert', 'lime', 'compost', 'amend'].includes(k) ? `<label class="inl chkline"><input type="checkbox" name="plenty"${x.plenty ? ' checked' : ''}> <span>I have plenty of this <small>(suggested first)</small></span></label>` : ''}
      <label>Notes <small>(one per line)</small><textarea name="notes" rows="3">${esc((x.notes || []).join('\n'))}</textarea></label>
      <div class="btns">${isNew ? '<button type="button" class="btn" data-x="no">Cancel</button>' : '<button type="button" class="btn danger" data-x="del" data-own-confirm>Remove</button>'}<button class="btn primary">Save</button></div></form>`;
    const f = m.querySelector('#pdf');
    const keep = () => {   // what's been typed so far, before the form is drawn again
      x.en = f.en.value; x.maker = f.maker.value; if (f.what) x.what = f.what.value; x.organic = f.organic.checked; x.notes = f.notes.value.split('\n').map(t => t.trim()).filter(Boolean);
      if (f.querySelector('.spraycrops')) readCrops();
    };
    f.kind.onchange = () => { keep(); x.kind = f.kind.value; if (x.kind !== 'fert') x.form = null; else x.form = x.form || 'quick'; x.uses = normProd({ id: '', kind: x.kind, form: x.form, en: '' }).uses; draw(m); };
    if (f.form) f.form.onchange = () => { keep(); x.form = f.form.value; draw(m); };
    function readCrops() {   // the crops table as it stands (and the defaults for crops added next)
      for (const tr of f.querySelectorAll('.cropsrules tr[data-c]')) { const c = tr.dataset.c, ph = f[`phi_${c}`].value, mx = f[`max_${c}`].value; x.crops[c] = { phi: ph === '' ? 0 : +ph, max: mx === '' ? null : +mx }; }
      if (f.phi0) { x.phi = f.phi0.value === '' ? null : +f.phi0.value; x.max = f.max0.value === '' ? null : +f.max0.value; }
    }
    if (f.addCrop) f.addCrop.onchange = () => { const c = f.addCrop.value; if (!c) return; keep(); x.crops = x.crops || {}; if (!x.crops[c]) x.crops[c] = { phi: x.phi ?? 0, max: x.max ?? null }; draw(m); };
    for (const b of f.querySelectorAll('[data-rm]')) b.onclick = () => { keep(); delete x.crops[b.dataset.rm]; draw(m); };
    const no = m.querySelector('[data-x=no]'); if (no) no.onclick = () => m._close();
    const del = m.querySelector('[data-x=del]');
    if (del) del.onclick = async () => {
      if (!await confirmBox(used(x.en) ? `Remove <b>${esc(x.en)}</b> from your products? Your records that mention it stay as they are.` : `Remove <b>${esc(x.en)}</b> from your products?`, 'Remove', true)) return productDialog(orig);
      if (used(x.en)) { const k = S.products.find(p => p.id === x.id); if (k) { k.hidden = true; k.plenty = false; } }   // (kept out of sight: your records still count it)
      else S.products = S.products.filter(p => p.id !== x.id);
      (S.productsRemoved = S.productsRemoved || []).push(x.id); setPlenty('');
      await save(); render();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const n = f.n ? [f.n.value, f.p.value, f.k.value].map(v => v === '' ? 0 : +v) : null, oldName = orig ? orig.en : null;
      Object.assign(x, { en: f.en.value.trim(), maker: f.maker.value.trim(), kind: f.kind.value, what: f.what ? f.what.value.trim() : x.what,
        npkv: n && n.some(v => v > 0) ? n : (x.kind === 'mix' ? n : null), organic: f.organic.checked, notes: f.notes.value.split('\n').map(s => s.trim()).filter(Boolean),
        uses: f.querySelectorAll('input[name=use]').length ? [...f.querySelectorAll('input[name=use]:checked')].map(i => i.value) : x.uses, plenty: f.plenty ? f.plenty.checked : x.plenty });
      if (f.form) x.form = f.form.value;
      if (f.wait) x.wait = f.wait.value === '' ? 0 : +f.wait.value;
      if (f.lead) x.lead = f.lead.value === '' ? defLead(x) : +f.lead.value;
      if (f.gPerL) { x.gPerL = +f.gPerL.value || 0; x.lasts = +f.lasts.value || 30; }
      if (f.per) { x.per = +f.per.value || null; x.doses = f.doses.value.split(/[,、\s]+/).map(Number).filter(v => v > 0).sort((a, b) => a - b); }
      if (f.querySelector('.spraycrops')) { readCrops(); x.phi = f.phi0.value === '' ? null : +f.phi0.value; x.max = f.max0.value === '' ? null : +f.max0.value; }
      if (!x.en) return;
      // what the app needs to count it (release time, how much is usable) follows the kind unless set
      const d = normProd(Object.assign({}, x, { start: null, release: null, avail: null, density: null, lead: x.lead }));
      if (!orig || orig.form !== x.form || orig.kind !== x.kind) Object.assign(x, { start: d.start, release: d.release, avail: d.avail, density: d.density });
      x = normProd(x);
      S.products = S.products || [];
      const i = S.products.findIndex(p => p.id === x.id); if (i >= 0) S.products[i] = x; else S.products.push(x);
      setPlenty(x.id, x.plenty);
      if (oldName && oldName !== x.en) {   // a rename carries through to records and plans
        for (const l of S.log || []) if (l.product === oldName) l.product = x.en;
        for (const p of S.plantings) { for (const g of p.fert || []) if (g.product === oldName) g.product = x.en; for (const s of p.feedPlan || []) if (s.product === oldName) s.product = x.en; }
        for (const t of S.tasks) if (t.product === oldName) { t.product = x.en; t.title = (t.title || '').split(oldName).join(x.en); }
      }
      m._close(); await save(); render();
    };
  };
  modal('<div></div>', m => draw(m));
}

function pageProduct(id) {
  const p = product(id); if (!p) return { html: notFound() };
  setChrome(p.en, { back: true, kicker: p.maker || kindOf(p.kind)[2] });
  let body = '';
  if (p.kind === 'spray' || p.kind === 'homemade') {
    const cs = Object.entries(p.crops || {}), live = S.plantings.filter(isLive);
    const row = ([cid, r]) => { const ps = live.filter(x => x.cropId === cid), used = ps.length ? Math.max(...ps.map(x => usesSoFar(x, id))) : null;
      return `<tr><td>${ic(cid, 18)} ${esc(crop(cid).en)}</td><td>${waitText(+r.phi || 0).replace(/^w/, 'W').replace(/^n/, 'N')}</td><td>${r.max == null || r.max === '' ? '—' : r.max + '×'}${used != null && r.max != null && r.max !== '' ? ` <small>(${used} used)</small>` : ''}</td></tr>`; };
    body += `<section><h3>Crops it’s for</h3>${cs.length ? `<div class="tscroll"><table class="reg"><tr><th>Crop</th><th>Before picking</th><th>Most sprays a season</th></tr>${cs.sort((a, b) => crop(a[0]).en.localeCompare(crop(b[0]).en)).map(row).join('')}</table></div>`
      : '<p class="muted">No crops entered yet — add the crops on its label, with the days to wait before picking and the most sprays allowed (✎ Edit product).</p>'}
      <p class="hint">${SPRAY_CAVEAT}</p></section>`;
  }
  const html = `<section>${p.what ? `<p><b>${esc(p.what)}</b></p>` : ''}${p.maker || p.npk ? `<p class="muted">${[p.maker ? esc(p.maker) : '', p.npk ? 'N-P-K ' + esc(p.npk) : ''].filter(Boolean).join(' · ')}</p>` : ''}
      ${p.organic != null ? `<p>${p.organic ? '🌱 <b>Organic</b>' : '⚗️ <b>Not organic</b>'}${p.organicNote ? ' — ' + esc(p.organicNote) : ''}</p>` : ''}
      ${p.kind !== 'spray' && p.kind !== 'homemade' ? `<p>${p.wait ? `⏳ Dig in ${p.wait >= 14 ? `${Math.round(p.wait / 7)}–${Math.round(p.wait / 7) + 1} weeks` : 'about a week'} before sowing/planting.` : '✅ Can go in on planting day.'}${p.top ? ' ✅ Fine as a top-dressing straight away.' : ''}</p>` : ''}
      ${(p.notes || []).length ? `<ul class="bul">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</section>
    ${body}`;
  return { html };
}
