// The guided setup: a card at the top of the page that walks a new gardener through their first bed or pot and their
// first crop — raised as seedlings in a tray first, or planted straight in — and then what the app does for them. It
// isn't a separate demo: every step is done in the real app, and the card moves on by itself once a step is done (a bed
// exists, seedlings are sown, something is planted). Started from the first-run steps, or any time from Tools.

import { A, render, route } from '../core/router.js';
import { S, save } from '../core/state.js';
import { esc, go, shortDate, todayStr } from '../core/util.js';
import { crop } from '../plants/crops.js';
import { startReady } from '../plants/growth.js';
import { replantDialog, startDialog, startLeft } from '../plants/seedlings.js';

export const tourOn = () => !!(S.tour && !S.tour.done);
export async function startTour() { S.tour = { t0: new Date().toISOString(), path: null }; await save(); }
const STEPS = 4;
const card = (n, title, body, buttons = '') => `<section class="tour"><div class="tour-h"><span class="tour-n">${n ? `Step ${n} of ${STEPS}` : 'Guided setup'}</span><button type="button" class="link" data-act="tourOff">Skip the guide</button></div>
  <h3>${title}</h3>${body}${buttons ? `<div class="btnrow">${buttons}</div>` : ''}</section>`;

// where the guide is, from what's in the garden (made since the guide started, for the crop steps)
function stage() {
  const t = S.tour, isNew = x => !(t.had || []).includes(x.id);   // (made since the path was chosen: a garden you already have doesn't count)
  const beds = S.containers.filter(c => c.type !== 'nursery');
  if (!beds.length) return { k: 'bed' };
  if (!t.path) return { k: 'choose', bed: beds[beds.length - 1] };
  if (t.path === 'tray') {
    const st = (S.starts || []).filter(isNew).slice(-1)[0];
    if (!st) return { k: 'sow' };
    const out = S.plantings.find(p => p.startId === st.id);
    return out ? { k: 'jobs', p: out } : { k: 'grow', st, bed: beds[beds.length - 1] };
  }
  const p = S.plantings.filter(x => isNew(x) && x.status !== 'harvested').slice(-1)[0];
  return p ? { k: 'jobs', p } : { k: 'plant', bed: beds[beds.length - 1] };
}

export function tourCard() {
  if (!tourOn()) return '';
  const [a, b, c] = route().parts;
  if (a === 'welcome' || a === 'recovery') return '';
  const s = stage(), formOpen = (a === 'container' && (b === 'new' || c === 'edit')) || (a === 'plant' && (b === 'new' || c === 'edit'));
  A.tourOff = async () => { S.tour = { done: true, skipped: true }; await save(); render(); };
  A.tourPath = async el => { S.tour.path = el.dataset.v; S.tour.had = [...(S.starts || []), ...S.plantings].map(x => x.id); await save(); render(); };
  A.tourDone = async () => { S.tour = { done: true }; await save(); if (location.hash && location.hash !== '#/') go('#/'); else render(); };
  if (s.k === 'bed') {
    if (a === 'container' && b === 'new') return card(1, 'Draw your bed or pot',
      `<p>Choose what it is — a bed in the ground, a round pot or grow bag, or a rectangular trough — then its name and inside size in centimetres. The size lets the app work out spacing and how many plants fit. Sun and where it is (outdoors, or indoors on a sill) change how fast things grow. Tap <b>Save</b> when you’re done.</p>`);
    return card(1, 'Add a bed or pot',
      `<p>Start with where things grow: a bed in the ground, a pot, a trough or a grow bag. You draw it once, and everything you plant goes into it.</p>`,
      `<a class="btn primary" href="#/container/new">＋ Add a bed or pot</a>`);
  }
  if (s.k === 'choose') return card(2, 'How do you want to start?',
    `<ul class="tour-pick"><li><b>🌱 Raise seedlings first.</b> Sow in a seedling tray or small pots, and plant them out once they’re big enough. Best for tomatoes, peppers, eggplant, cabbages, broccoli, lettuce and the like — and for a head start while it’s still cold.</li>
      <li><b>🥕 Straight into ${esc(s.bed.name)}.</b> Sow seeds where they’ll grow — carrots, radish, beans, peas, spinach, salad leaves… — or plant seedlings you’ve bought.</li></ul>`,
    `<button type="button" class="btn primary" data-act="tourPath" data-v="tray">🌱 Raise seedlings</button><button type="button" class="btn" data-act="tourPath" data-v="direct">🥕 Plant straight in</button>`);
  if (s.k === 'sow') {
    A.tourSow = () => { if (route().parts[0] !== 'seedlings') go('#/seedlings'); setTimeout(() => startDialog(), 50); };
    return card(3, 'Sow your seedlings',
      `<p>Choose the crop, the tray or pots you sowed in, how many cells (or pots) and the day you sowed. Kept indoors or outside? It changes how fast they grow. From then on the app reminds you to check they’ve come up, and works out when they’re ready to plant out.</p>`,
      `<button type="button" class="btn primary" data-act="tourSow">＋ Start seedlings</button>`);
  }
  if (s.k === 'grow') {
    const ready = startReady(s.st), n = crop(s.st.cropId).en.toLowerCase();
    A.tourOut = () => replantDialog(s.st);
    return card(4, `While your ${esc(n)} grows`,
      `<p>Your jobs on the home screen say when to look whether they’ve come up and how many, and when they’re ready to plant out — about <b>${shortDate(ready)}</b>${ready <= todayStr() ? ' (now)' : ''}. Then the <b>Plant out</b> job (or <b>Replant</b> on the Seedlings page) moves them: choose the bed and how many go in — any you don’t plant stay in the tray.</p>
       <p class="small muted">${startLeft(s.st)} ${s.st.kind === 'pot' ? 'pot' : 'cell'}${startLeft(s.st) === 1 ? '' : 's'} waiting. You can plant them out now to see how it works, and the guide finishes once you do.</p>`,
      `<a class="btn" href="#/seedlings">See my seedlings</a><button type="button" class="btn primary" data-act="tourOut">Plant them out</button>`);
  }
  if (s.k === 'plant') {
    if (formOpen && a === 'plant') return card(3, 'What you’re planting',
      `<p><b>Crop</b> first. Then <b>From seed</b> if you’re sowing seed, or <b>Seedlings / tubers</b> for plants (bought or your own), potatoes or garlic. <b>Where & when</b>: which part of the bed (cm from the top — or all of it) and the day. The drawing shows the plants at that spacing, so you can see what fits. The rest is filled in for the crop — tap <b>Save</b>.</p>`);
    return card(3, `Plant something in ${esc(s.bed.name)}`,
      `<p>Choose the crop and whether you’re sowing seed or planting seedlings; the app fills in spacing, thinning, feeding and harvest for it — for your weather.</p>`,
      `<a class="btn primary" href="#/plant/new/${s.bed.id}">＋ Plant in ${esc(s.bed.name)}</a>`);
  }
  // done: what happens now
  return card(0, 'You’re set up 🌱',
    `<ul class="tour-pick"><li>📋 <b>Home</b> lists today’s jobs — water, check, thin, feed, harvest — for everything you’ve planted. Tick them off as you go; tap one to change its date.</li>
      <li>🌡 <b>Dates follow your weather.</b> Harvest, thinning and plant-out dates move with the temperatures where you are.</li>
      <li>🗓 <b>Sowing calendar</b> (Tools) shows what to sow or plant this month; <b>💡 What could go here?</b> on a bed suggests crops for a gap.</li>
      <li>🧺 Tap a crop in a bed to see its dates, feeding and history, and to record a harvest.</li>
      <li>💾 <b>Back up</b> now and then (Tools → Backup): your garden lives only on this phone.</li></ul>`,
    `<button type="button" class="btn primary" data-act="tourDone">Finish</button>`);
}
