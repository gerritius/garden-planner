// Pages: reads the address (#/…), draws the matching page and the header, and holds the per-page action handlers (A).

import { snapshotDaily } from '../backup/backup.js';
import { failure, pageRecovery, showRecovery } from '../backup/recovery.js';
import { driveTick } from '../backup/drive.js';
import { applyClimate, ensureClimate } from '../climate/climate.js';
import { pageSow } from '../climate/sowing.js';
import { pageMyCrops, pageWelcome } from '../pages/welcome.js';
import { pageSprayDay, syncFrost, syncWx } from '../climate/weather.js';
import { syncFeedPlans } from '../feeding/plans.js';
import { container, planting } from '../garden/garden.js';
import { pageMap, pageSections } from '../garden/map.js';
import { pagePlan, pageShop } from '../garden/planning.js';
import { pageRotation } from '../garden/rotation.js';
import { syncMeterJobs, syncWater } from '../garden/watering.js';
import { pageCalendar } from '../pages/calendar.js';
import { pageContainer, pageContainerForm } from '../pages/container.js';
import { pageHome } from '../pages/home.js';
import { pagePlantForm } from '../pages/planting-form.js';
import { pageArrange, pagePlant } from '../pages/planting.js';
import { pageSearch } from '../pages/search.js';
import { groupTabs, pageSettings } from '../pages/tools.js';
import { syncHarvest, syncThin } from '../plants/growth.js';
import { pageDoctor } from '../plants/problems.js';
import { nurseryDialog, pageSeedlings } from '../plants/seedlings.js';
import { pageVarieties, pageVariety } from '../plants/varieties.js';
import { pageProductLib, pageProducts } from '../products/pages.js';
import { pagePickSafe } from '../products/sprays.js';
import { pageLog } from '../records/log.js';
import { pageDiary, pagePhotos, pageTimeline } from '../records/notes.js';
import { pageCompare, pageReview, pageSpend, pageTotals } from '../records/review.js';
import { hydrate } from './photos.js';
import { S, savingAllowed } from './state.js';
import { $, $$, esc } from './util.js';

// ---------- per-page state ----------
export let A = {};          // per-page action handlers
export let draft = null;    // form draft (planting / container)
export function setDraft(v) { draft = v; return v; }
let lastRoute = '';
export function setLastRoute(v) { lastRoute = v; return v; }
let bgStarted = false;   // the once-per-visit background jobs have been started

// ---------- drawing the page for the address ----------
export function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
const SEKKI = [[1, 5, '小寒', 'Minor cold'], [1, 20, '大寒', 'Major cold'], [2, 4, '立春', 'Start of spring'], [2, 19, '雨水', 'Rain water'],
  [3, 5, '啓蟄', 'Insects awaken'], [3, 20, '春分', 'Spring equinox'], [4, 4, '清明', 'Clear & bright'], [4, 20, '穀雨', 'Grain rain'],
  [5, 5, '立夏', 'Start of summer'], [5, 21, '小満', 'Grain buds'], [6, 5, '芒種', 'Grain in ear'], [6, 21, '夏至', 'Summer solstice'],
  [7, 7, '小暑', 'Minor heat'], [7, 22, '大暑', 'Major heat'], [8, 7, '立秋', 'Start of autumn'], [8, 23, '処暑', 'End of heat'],
  [9, 7, '白露', 'White dew'], [9, 22, '秋分', 'Autumn equinox'], [10, 8, '寒露', 'Cold dew'], [10, 23, '霜降', 'Frost descends'],
  [11, 7, '立冬', 'Start of winter'], [11, 22, '小雪', 'Minor snow'], [12, 7, '大雪', 'Major snow'], [12, 21, '冬至', 'Winter solstice']];
export function sekki(d = new Date()) {
  // (the Japanese solar terms are only right for Japan — south of the equator 立冬 "start of winter" falls in late spring)
  const w = S.weather; if (w && w.lat != null ? !(w.lat > 24 && w.lat < 46 && w.lon > 122 && w.lon < 154) : S.climate && S.climate.preset && S.climate.preset !== 'Cfa') return '';
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  let cur = SEKKI[SEKKI.length - 1];
  for (const s of SEKKI) if (s[0] * 100 + s[1] <= md) cur = s;
  return `${cur[2]} · ${cur[3]}`;
}
export function setChrome(title, { back = false, tab = null, kicker = '', sub = '', stats = '', big = false } = {}) {
  $('#title').textContent = title;
  $('#kicker').textContent = kicker;
  $('#sub').textContent = sub;
  $('#hstats').innerHTML = stats;
  $('#top').classList.toggle('big', big);
  $('#back').hidden = !back;
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
export function render() {
  if (failure) return showRecovery();   // the garden couldn't be loaded: nothing else until that's sorted
  const { parts, q } = route();
  const key = location.hash, same = key === lastRoute;
  // redrawing the page you're on (a button that changes something): keep the sections you had open or shut, and your place
  const kept = same ? keptDetails() : null, y = window.scrollY;
  if (key !== lastRoute) { draft = null; lastRoute = key; window.scrollTo(0, 0); const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  A = {};
  try { syncWater(); } catch (e) { console.warn(e); }
  try { syncFrost(); } catch (e) { console.warn(e); }
  try { syncWx(); } catch (e) { console.warn(e); }
  try { applyClimate(); } catch (e) { console.warn(e); }
  if (!bgStarted && savingAllowed()) {   // once per visit: check the Drive backup, fetch the climate, take the daily snapshot (never while not saving)
    bgStarted = true;
    setTimeout(() => driveTick().catch(e => console.warn('drive', e)), 300);
    setTimeout(() => ensureClimate(), 1500);
    setTimeout(snapshotDaily, 3000);
  }
  A.nursery = () => nurseryDialog();
  try { syncThin(); } catch (e) { console.warn(e); }
  try { syncHarvest(); } catch (e) { console.warn(e); }
  try { syncFeedPlans(); syncWater(); syncMeterJobs(); } catch (e) { console.warn(e); }
  let html = '', after = null;
  try {
    const [a, b, c] = parts;
    if (!a) ({ html, after } = pageHome());
    else if (a === 'cal') ({ html, after } = pageCalendar());
    else if (a === 'log') ({ html, after } = pageLog(q));
    else if (a === 'totals') ({ html, after } = pageTotals(q));
    else if (a === 'products') ({ html, after } = pageProducts(q));
    else if (a === 'product') ({ html, after } = pageProductLib(b));
    else if (a === 'search') ({ html, after } = pageSearch(q));
    else if (a === 'map') ({ html, after } = pageMap(q));
    else if (a === 'review') ({ html, after } = pageReview(q));
    else if (a === 'compare') ({ html, after } = pageCompare(q));
    else if (a === 'container' && c === 'sections') ({ html, after } = pageSections(container(b)));
    else if (a === 'settings') ({ html, after } = pageSettings());
    else if (a === 'container' && b === 'new') ({ html, after } = pageContainerForm(null));
    else if (a === 'container' && c === 'edit') ({ html, after } = pageContainerForm(container(b)));
    else if (a === 'container') ({ html, after } = pageContainer(container(b)));
    else if (a === 'plant' && b === 'new') ({ html, after } = pagePlantForm(null, container(c), q));
    else if (a === 'plant' && c === 'edit') ({ html, after } = pagePlantForm(planting(b)));
    else if (a === 'sow') ({ html, after } = pageSow(q));
    else if (a === 'seedlings') ({ html, after } = pageSeedlings());
    else if (a === 'plan') ({ html, after } = pagePlan());
    else if (a === 'doctor') ({ html, after } = pageDoctor(q));
    else if (a === 'rotation') ({ html, after } = pageRotation());
    else if (a === 'variety') ({ html, after } = pageVariety(q));
    else if (a === 'varieties') ({ html, after } = pageVarieties());
    else if (a === 'timeline') ({ html, after } = pageTimeline(q));
    else if (a === 'picksafe') ({ html, after } = pagePickSafe());
    else if (a === 'shop') ({ html, after } = pageShop(q));
    else if (a === 'spend') ({ html, after } = pageSpend(q));
    else if (a === 'sprayday') ({ html, after } = pageSprayDay());
    else if (a === 'plant' && c === 'diary') ({ html, after } = pageDiary(planting(b), parts[3]));
    else if (a === 'plant' && c === 'photos') ({ html, after } = pagePhotos(planting(b)));
    else if (a === 'plant' && c === 'arrange') ({ html, after } = pageArrange(planting(b)));
    else if (a === 'plant') ({ html, after } = pagePlant(planting(b)));
    else if (a === 'recovery') ({ html, after } = pageRecovery());
    else if (a === 'welcome') ({ html, after } = pageWelcome(q));
    else if (a === 'mycrops') ({ html, after } = pageMyCrops());
    else html = notFound();
  } catch (e) { console.error(e); html = `<div class="empty-state">Something went wrong: ${esc(e.message)}<br><a href="#/">Home</a> · <a href="#/recovery">Recovery</a></div>`; }
  if (!savingAllowed()) html = `<p class="banner warn">Changes aren’t being saved: this phone’s storage couldn’t be opened. <a href="#/recovery">Recovery</a></p>` + html;
  html = groupTabs(location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]) + html;
  $('#view').innerHTML = html;
  hydrate();
  after && after();
  if (kept) { restoreDetails(kept); if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); }
}
// <details> sections on the page, by their heading (its own text — not counts or names in its <small>) and order
function detailsKeys() {
  const seen = {};
  return [...$('#view').querySelectorAll('details')].map(d => {
    const sm = d.querySelector(':scope > summary'), t = sm ? [...sm.childNodes].filter(n => n.nodeType === 3 || n.tagName === 'B').map(n => n.textContent).join('').trim() : '';
    const k = `${d.className}|${t}`; seen[k] = (seen[k] || 0) + 1; return [`${k}|${seen[k]}`, d];
  });
}
const keptDetails = () => new Map(detailsKeys().map(([k, d]) => [k, d.open]));
function restoreDetails(kept) { for (const [k, d] of detailsKeys()) if (kept.has(k) && d.open !== kept.get(k)) d.open = kept.get(k); }
export const notFound = () => { setChrome('Not found', { back: true }); return `<div class="empty-state">That item no longer exists.<br><a class="btn" href="#/">Go home</a></div>`; };
