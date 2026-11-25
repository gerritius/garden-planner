// The first time the app opens with no garden: what it is, a backup to restore (or the real garden, on the test site),
// where the garden is (weather, frost, sowing times), which crops you grow, your first bed or pot, and how to keep a
// backup. Every step can be skipped and changed later in Tools. "My crops" (Tools) is the same crop picker on its own.

import { importBackup, copyFromMainSite } from '../backup/backup.js';
import { climatePending, ensureClimate } from '../climate/climate.js';
import { climateTypePicker } from '../climate/presets.js';
import { weatherSettings } from '../climate/weather.js';
import { A, render, setChrome } from '../core/router.js';
import { IS_TEST } from '../core/site.js';
import { S, save } from '../core/state.js';
import { $, esc, go } from '../core/util.js';
import { CATALOG, COMMON_CROPS, GROUPS } from '../data/catalog.js';
import { allCrops, ic } from '../plants/crops.js';

const STEPS = ['Welcome', 'Where', 'Your crops', 'First bed', 'Done'];
let pickQuery = '';

// ---------- choosing your crops (here and in Tools → My crops) ----------
function chosen() { return new Set(Array.isArray(S.myCrops) ? S.myCrops : []); }
function cropPicker() {
  const sel = chosen(), q = pickQuery.trim().toLowerCase();
  const hit = c => !q || `${c.en} ${c.id}`.toLowerCase().includes(q);
  const chip = c => `<button type="button" class="chip big pick${sel.has(c.id) ? ' on' : ''}" data-act="pickCrop" data-id="${c.id}" aria-pressed="${sel.has(c.id)}">${ic(c.id, 20)}${esc(c.en)}</button>`;
  const own = (S.customCrops || []).map(c => allCrops().find(x => x.id === c.id)).filter(Boolean).filter(hit);
  const groups = Object.entries(GROUPS).map(([g, [en]]) => { const cs = CATALOG.filter(c => (c.group || 'leaves') === g && hit(c)); return cs.length ? `<section class="pickgrp"><h4>${esc(en)}</h4><div class="sowchips">${cs.map(chip).join('')}</div></section>` : ''; }).join('');
  A.pickCrop = async el => {
    const s = chosen(); s.has(el.dataset.id) ? s.delete(el.dataset.id) : s.add(el.dataset.id);
    S.myCrops = [...s]; await save();
    el.classList.toggle('on', s.has(el.dataset.id)); el.setAttribute('aria-pressed', s.has(el.dataset.id));
    const n = $('#pickN'); if (n) n.textContent = countText();
  };
  A.pickCommon = async () => { S.myCrops = [...new Set([...chosen(), ...COMMON_CROPS])]; await save(); render(); };
  A.pickNone = async () => { S.myCrops = []; await save(); render(); };
  return `<div class="searchrow"><input id="pickq" type="search" placeholder="Find a crop…" value="${esc(pickQuery)}"></div>
    <div class="btnrow"><button type="button" class="btn small" data-act="pickCommon">＋ The usual home-garden crops</button><button type="button" class="btn small" data-act="pickNone">Clear</button></div>
    <p class="muted small" id="pickN">${countText()}</p>
    ${groups}${own.length ? `<section class="pickgrp"><h4>Your own crops</h4><div class="sowchips">${own.map(chip).join('')}</div></section>` : ''}
    ${!groups && !own.length ? '<p class="muted">No crop by that name — you can add your own when planting.</p>' : ''}`;
}
const countText = () => { const n = chosen().size; return n ? `${n} crop${n === 1 ? '' : 's'} chosen — they come first in crop lists, and the sowing calendar and ideas are about them. The rest are still there under “Other crops”.` : 'None chosen yet: every crop is shown.'; };
function pickerAfter() {
  const qi = $('#pickq'); if (!qi) return;
  qi.oninput = () => { pickQuery = qi.value; const pos = qi.selectionStart; render(); const q2 = $('#pickq'); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } };
}

// ---------- the first-run steps ----------
export function pageWelcome(q) {
  const step = Math.min(STEPS.length, Math.max(1, +(q && q.get('s')) || 1));
  setChrome(step === 1 ? 'Welcome' : STEPS[step - 1], { back: step > 1, kicker: `Setting up · step ${step} of ${STEPS.length}` });
  const next = `#/welcome?s=${step + 1}`;
  const dots = `<div class="wl-dots">${STEPS.map((s, i) => `<span class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}" title="${esc(s)}"></span>`).join('')}</div>`;
  A.wlFinish = async el => { S.firstRun = false; pickQuery = ''; await save(); go(el.dataset.to || '#/'); };
  let body = '', after = null;
  if (step === 1) {
    A.wlCopy = () => copyFromMainSite();
    body = `<div class="wl-hero">${ic('tomato', 64)}${ic('komatsuna', 64)}${ic('daikon', 64)}</div>
      <h2 class="center">Welcome to Garden Planner</h2>
      <p>Draw your beds, pots and grow bags and what’s in them, and the app works out the rest for <b>your</b> climate: when to sow and plant, thinning, feeding, watering with the weather, frost and pest warnings, and when to harvest — as jobs for each day.</p>
      <ul class="wl-points"><li>🔒 <b>Your garden stays on this phone.</b> Nothing is uploaded; only a rough location (about 1 km) is used for the weather.</li><li>📴 <b>Works offline</b> once it’s been opened.</li><li>↩️ <b>Everything here can be changed later</b> in Tools.</li></ul>
      <div class="btncol"><a class="btn primary wide" href="${next}">Start my garden</a>
        <label class="btn wide">Restore a backup file<input type="file" id="wlimp" accept=".json,application/json" hidden></label>
        ${IS_TEST ? '<button type="button" class="btn wide" data-act="wlCopy">Copy my real garden into the test site</button>' : ''}</div>`;
    after = () => { const f = $('#wlimp'); if (f) f.onchange = () => importBackup(f.files[0]); };
  } else if (step === 2) {
    const w = S.weather;
    if (climatePending()) ensureClimate().then(ok => { if (ok) render(); });   // the usual weather there, for sowing times
    body = `<p>Where your garden is sets the weather and frost alerts, and — from the last ten years’ weather there — when each crop can be sown and how fast it grows.</p>
      ${weatherSettings()}${!w || w.lat == null ? climateTypePicker() : ''}
      <div class="btncol"><a class="btn primary wide" href="${next}">${w && w.lat != null || (S.climate && S.climate.preset) ? 'Next' : 'Skip — use central Japan (Tokyo)'}</a></div>`;
  } else if (step === 3) {
    body = `<p>Which crops do you grow, or want to? Tap to choose — you can change this any time in Tools → My crops.</p>
      ${cropPicker()}<div class="btncol"><a class="btn primary wide" href="${next}">Next</a></div>`;
    after = pickerAfter;
  } else if (step === 4) {
    body = `<p>Now add where things grow: a bed in the ground, or a pot, trough or grow bag. You draw what’s in it, and the jobs follow from that.</p>
      <div class="btncol"><button type="button" class="btn primary wide" data-act="wlFinish" data-to="#/container/new">＋ Add my first bed or pot</button>
        <a class="btn wide" href="${next}">Later</a></div>`;
  } else {
    body = `<h2 class="center">You’re set up 🌱</h2>
      <ul class="wl-points"><li>📋 <b>Jobs for each day</b> are on the home screen — tick them off as you go.</li>
        <li>💾 <b>Keep a backup.</b> Your garden is only on this phone: Tools → Backup saves a copy as a file${IS_TEST ? '' : ', or to Google Drive every day'}.</li>
        <li>📱 <b>Add it to your home screen</b> to open it like an app: in Chrome’s ⋮ menu, “Add to Home screen” (or “Install app”).</li>
        <li>🧺 <b>Your crops, location and everything else</b> can be changed in Tools.</li></ul>
      <div class="btncol"><button type="button" class="btn primary wide" data-act="wlFinish" data-to="#/">Go to my garden</button></div>`;
  }
  return { html: `<div class="welcome">${dots}${body}</div>`, after };
}

// ---------- Tools → My crops ----------
export function pageMyCrops() {
  setChrome('My crops', { back: true, kicker: 'Shown first in crop lists' });
  return { html: `<p class="hint">The crops you grow come first in crop lists, and the sowing calendar and crop ideas are about them. Crops you’re growing or have seeds of always count.</p>${cropPicker()}`, after: pickerAfter };
}
