'use strict';
/* Kabutomushi Keeper — Japanese rhinoceros beetles (Trypoxylus dichotomus) from larva to adult.
   All data lives on the phone (IndexedDB). Plain script, no build step. */

// ---------- small helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => iso(new Date());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const daysSince = s => s ? Math.round((parseD(todayStr()) - parseD(s)) / 864e5) : null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const niceDate = (s, withYear) => {
  if (!s) return '—';
  const d = parseD(s), y = withYear || d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}) });
};
const ago = s => {
  const n = daysSince(s);
  if (n === null) return 'never';
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 0) return `in ${-n} days`;
  if (n < 60) return `${n} days ago`;
  return `${Math.round(n / 30.4)} months ago`;
};
const fmtW = w => `${(+w).toFixed(1).replace(/\.0$/, '')} g`;
const md = (d = new Date()) => (d.getMonth() + 1) * 100 + d.getDate();   // 1112 = 12 Nov
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- domain ----------
const STAGES = {
  egg:     { label: 'Egg', jp: '卵' },
  L1:      { label: 'L1 larva', long: '1st instar larva', jp: '初齢' },
  L2:      { label: 'L2 larva', long: '2nd instar larva', jp: '2齢' },
  L3:      { label: 'L3 larva', long: '3rd instar larva', jp: '3齢' },
  prepupa: { label: 'Prepupa', jp: '前蛹' },
  pupa:    { label: 'Pupa', jp: '蛹' },
  eclosed: { label: 'Adult (still underground)', jp: '羽化' },
  adult:   { label: 'Adult', jp: '成虫' },
  dead:    { label: 'Died', jp: '' },
};
const STAGE_ORDER = Object.keys(STAGES);
const SEX = { '?': 'Unknown', m: '♂ Male', f: '♀ Female' };
const sexMark = s => s === 'm' ? '<span class="sex m">♂</span>' : s === 'f' ? '<span class="sex f">♀</span>' : '';

const KINDS = {
  mat:   { label: 'Mat change', icon: '🪣', scope: 'tank' },
  top:   { label: 'Mat top-up', icon: '➕', scope: 'tank' },
  check: { label: 'Check / moisture', icon: '👀', scope: 'tank' },
  weigh: { label: 'Weight', icon: '⚖️', scope: 'beetle' },
  stage: { label: 'New stage', icon: '✨', scope: 'beetle' },
  move:  { label: 'Moved tank', icon: '↪️', scope: 'beetle' },
  feed:  { label: 'Fresh jelly', icon: '🍯', scope: 'tank' },
  note:  { label: 'Note / photo', icon: '📝', scope: 'any' },
};
const MOIST = { ok: 'Moisture fine', dry: 'Was dry — added water', wet: 'Too wet — aired / added dry mat' };
const COLORS = ['#c0663c', '#2f7fa8', '#5b8a2e', '#9b4fb0', '#c79a14', '#b0386a'];

// typical year for unheated rooms in central Japan; heated rooms run a few weeks earlier
const YEAR = [
  { from: 101, to: 301, label: 'Overwintering', jp: '越冬', color: '#8197b3',
    text: 'Big L3 larvae eat slowly in the cold. Keep the tank cool but frost-free and out of the sun. Check moisture every couple of weeks; change mat only when the surface is covered in frass (roughly every 2–3 months).' },
  { from: 301, to: 415, label: 'Last mat change', jp: '最後のマット交換', color: '#7ba05b',
    text: 'Larvae wake up and eat hard. Do the final full mat change now: at least 20 cm deep, the bottom 10 cm pressed down firmly. After mid-April, leave the tank alone.' },
  { from: 415, to: 601, label: 'Pupal chambers', jp: '蛹室', color: '#c9a03f',
    text: 'Larvae turn yellowish and wrinkly (prepupa) and build an upright oval chamber, usually near the bottom. Do not dig or tip the tank. Only mist the surface if it dries out.' },
  { from: 601, to: 625, label: 'Pupae', jp: '蛹', color: '#d0813b',
    text: 'Pupae for about 3 weeks. You may see one against the tank wall — cover that side to keep it dark. Still no digging.' },
  { from: 625, to: 720, label: 'Adults emerge', jp: '羽化', color: '#a5532c',
    text: 'New adults stay in the chamber 1–2 weeks while the shell hardens, then dig out at night. Put jelly and a climbing stick in once they appear.' },
  { from: 720, to: 901, label: 'Adults active', jp: '成虫', color: '#6b3a1e',
    text: 'Fresh jelly every 2–3 days, keep below 30 °C, out of sun. Males fight; give each its own space if possible. Adults live roughly 1–3 months.' },
  { from: 901, to: 1001, label: 'Eggs & young larvae', jp: '産卵・幼虫', color: '#b8a77d',
    text: 'If a pair was kept together, eggs and tiny larvae appear in the mat. Adults die off. Move larvae into fresh mat once they are a few cm long.' },
  { from: 1001, to: 1232, label: 'Big growth', jp: '3齢・成長期', color: '#8a6a3c',
    text: 'L3 larvae eat a lot and gain most of their weight now. Mat fills with frass fast — change it every 1–2 months, and weigh and sex them while they are out.' },
];
const phaseNow = (m = md()) => YEAR.find(p => m >= p.from && m < p.to) || YEAR[0];

// ---------- state ----------
let S;
const blank = () => ({ v: 1, tanks: [], beetles: [], log: [], snooze: {}, lastBackup: null, theme: 'auto', matName: '', welcome: true });
function seed() {
  S = blank();
  const a = { id: uid(), name: 'Tank A', liters: null, depth: null, place: '', matChanged: '', notes: '' };
  const b = { id: uid(), name: 'Tank B', liters: null, depth: null, place: '', matChanged: '', notes: '' };
  S.tanks = [a, b];
  S.beetles = [1, 2, 3].map(n => ({ id: uid(), name: `Larva ${n}`, tankId: n < 3 ? a.id : b.id, stage: 'L3', sex: '?', born: '', got: '', notes: '', color: COLORS[n - 1] }));
}
const save = () => DB.set('state', S);
const tankOf = id => S.tanks.find(t => t.id === id);
const beetleOf = id => S.beetles.find(b => b.id === id);
const alive = b => b.stage !== 'dead';
const isLarva = b => ['L1', 'L2', 'L3'].includes(b.stage);
const inChamber = b => ['prepupa', 'pupa', 'eclosed'].includes(b.stage);
const occupants = t => S.beetles.filter(b => b.tankId === t.id && alive(b));
const byDate = (a, b) => (b.date + (b.t || '')).localeCompare(a.date + (a.t || ''));
const sortedLog = () => [...S.log].sort(byDate);
function lastDate(pred) { let d = ''; for (const e of S.log) if (pred(e) && e.date > d) d = e.date; return d; }
const lastTank = (t, kinds) => {
  let d = lastDate(e => e.tankId === t.id && kinds.includes(e.kind));
  if (kinds.includes('mat') && t.matChanged > d) d = t.matChanged;
  return d;
};
const weightsOf = b => S.log.filter(e => e.beetleId === b.id && e.kind === 'weigh' && e.weight > 0).sort((x, y) => -byDate(x, y));
const stageSince = b => lastDate(e => e.beetleId === b.id && e.kind === 'stage' && e.stage === b.stage);
const colorOf = b => b.color || COLORS[S.beetles.indexOf(b) % COLORS.length];

// ---------- photos ----------
const photoURLs = new Map();
async function photoURL(id) {
  if (!photoURLs.has(id)) { const blob = await DB.getPhoto(id); photoURLs.set(id, blob ? URL.createObjectURL(blob) : ''); }
  return photoURLs.get(id);
}
function hydratePhotos(root = document) {
  $$('img[data-photo]', root).forEach(async img => { const u = await photoURL(img.dataset.photo); if (u) img.src = u; else img.remove(); });
}
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.82));
  } catch { return file; }
}
const latestPhoto = b => { const e = sortedLog().find(e => e.photoId && e.beetleId === b.id); return e ? e.photoId : null; };

// ---------- drawings ----------
function glyph(stage, sex, size = 44) {
  const v = inner => `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
  if (stage === 'egg') return v(`<ellipse cx="15" cy="23" rx="6" ry="7" fill="#f6efdc" stroke="#cbbd98" stroke-width="1.5"/><ellipse cx="26" cy="18" rx="5.5" ry="6.5" fill="#f6efdc" stroke="#cbbd98" stroke-width="1.5"/>`);
  if (['L1', 'L2', 'L3'].includes(stage)) {
    const sw = { L1: 6, L2: 8, L3: 10 }[stage], p = 'M27 11 A11 11 0 1 0 28 28';
    return v(`<path d="${p}" fill="none" stroke="#c8b183" stroke-width="${sw + 2}" stroke-linecap="round"/>
      <path d="${p}" fill="none" stroke="#f7eed6" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="${p}" fill="none" stroke="#dcc89a" stroke-width="${sw - 1}" stroke-dasharray="0.9 3.1"/>
      <circle cx="28" cy="28" r="${sw / 2}" fill="#8f8170"/>
      <circle cx="27" cy="11" r="${sw / 2 - .3}" fill="#b0692a"/><path d="M24 14 l-3 2 M26 15 l-2 3" stroke="#b0692a" stroke-width="1" stroke-linecap="round"/>`);
  }
  if (stage === 'prepupa') {
    const p = 'M20 9 C 23 16, 23 26, 21 34';
    return v(`<path d="${p}" fill="none" stroke="#c9ad5f" stroke-width="12" stroke-linecap="round"/><path d="${p}" fill="none" stroke="#ecd68e" stroke-width="10" stroke-linecap="round"/>
      <path d="${p}" fill="none" stroke="#d2b768" stroke-width="9" stroke-dasharray="0.9 2.6"/><circle cx="20" cy="8" r="4.3" fill="#b0692a"/>`);
  }
  if (stage === 'pupa') {
    return v(`${sex === 'm' ? '<path d="M20 10 L20 2.5" stroke="#c99348" stroke-width="3.4" stroke-linecap="round"/>' : ''}
      <path d="M20 9 C 28 9, 29 22, 27 30 C 25 36, 15 36, 13 30 C 11 22, 12 9, 20 9Z" fill="#dba760" stroke="#a8743a" stroke-width="1.3"/>
      <path d="M14.5 25 H25.5 M15 28.5 H25 M16 32 H24" stroke="#a8743a" stroke-width="1"/><path d="M17 13 Q15 18 17 22 M23 13 Q25 18 23 22" stroke="#a8743a" fill="none" stroke-width="1.2"/>`);
  }
  const c = stage === 'dead' ? '#8a847c' : stage === 'eclosed' ? '#8a4b22' : '#4f2c13';
  return v(`<path d="M13 21 L7 17 M13 25 L6 26.5 M14 30 L8 35 M27 21 L33 17 M27 25 L34 26.5 M26 30 L32 35" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M20 17 C 30 17, 30.5 36, 20 37.5 C 9.5 36, 10 17, 20 17Z" fill="${c}"/>
    <path d="M20 18 V37" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <ellipse cx="20" cy="15" rx="7.4" ry="4.8" fill="${c}"/><ellipse cx="20" cy="15" rx="7.4" ry="4.8" fill="rgba(0,0,0,.12)"/>
    <ellipse cx="20" cy="10.3" rx="3.4" ry="2.6" fill="${c}"/>
    ${sex === 'm' ? `<path d="M20 10 L20 4.5 M20 5.5 L17.4 2 M20 5.5 L22.6 2" stroke="${c}" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M20 13 V11" stroke="${c}" stroke-width="2" stroke-linecap="round"/>` : ''}
    <ellipse cx="16.3" cy="25" rx="1.6" ry="5.5" fill="rgba(255,255,255,.2)"/>`);
}

function yearBar() {
  const W = 360, H = 52, x = m => { const mo = Math.floor(m / 100), d = m % 100; return ((mo - 1) * 30.44 + d - 1) / 365 * W; };
  const now = md(), nx = x(now);
  const bands = YEAR.map(p => `<rect x="${x(p.from).toFixed(1)}" y="8" width="${(Math.min(x(p.to), W) - x(p.from)).toFixed(1)}" height="20" fill="${p.color}"><title>${esc(p.label)}</title></rect>`).join('');
  const months = 'JFMAMJJASOND'.split('').map((l, i) => `<text x="${(i * W / 12 + W / 24).toFixed(0)}" y="44" text-anchor="middle">${l}</text>`).join('');
  return `<svg class="yearbar" viewBox="-6 0 ${W + 12} ${H}" role="img" aria-label="Typical year; today is in ${esc(phaseNow().label)}">
    <g>${bands}</g><rect x="0" y="8" width="${W}" height="20" fill="none" stroke="rgba(0,0,0,.15)" rx="2"/>${months}
    <path class="now" d="M${nx.toFixed(1)} 2 V32"/><circle cx="${nx.toFixed(1)}" cy="3" r="3.5" fill="currentColor" class="nowlbl"/></svg>`;
}

function chart(series) {
  const pts = series.flatMap(s => s.pts);
  if (!pts.length) return '<div class="nodata">No weights yet. Weigh at the next mat change — it’s the best time, since they’re out anyway.</div>';
  const W = 360, H = 200, L = 30, R = 44, T = 14, B = 28;
  const ts = pts.map(p => parseD(p.date).getTime());
  let t0 = Math.min(...ts), t1 = Math.max(...ts);
  if (t1 - t0 < 30 * 864e5) { t0 -= 15 * 864e5; t1 += 15 * 864e5; }
  const wmax = Math.max(...pts.map(p => p.weight));
  const step = wmax > 40 ? 10 : wmax > 12 ? 5 : wmax > 4 ? 2 : 1;
  const ymax = Math.ceil((wmax * 1.12) / step) * step || step;
  const X = t => L + (t - t0) / (t1 - t0) * (W - L - R), Y = w => T + (1 - w / ymax) * (H - T - B);
  let g = '';
  for (let w = 0; w <= ymax; w += step) g += `<path class="${w ? 'gl' : 'ax'}" d="M${L} ${Y(w).toFixed(1)} H${W - R}"/><text x="${L - 6}" y="${(Y(w) + 4).toFixed(1)}" text-anchor="end">${w}</text>`;
  const d0 = new Date(t0); d0.setDate(1); d0.setMonth(d0.getMonth() + 1);
  const months = []; for (const d = new Date(d0); d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) months.push(new Date(d));
  const every = Math.ceil(months.length / 8);
  months.forEach((d, i) => {
    if (i % every) return;
    const xx = X(d.getTime()).toFixed(1);
    g += `<path class="gl" d="M${xx} ${T} V${H - B}"/><text x="${xx}" y="${H - 9}" text-anchor="middle">${d.toLocaleDateString('en-GB', { month: 'short' })}${d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''}</text>`;
  });
  g += `<text x="${L - 6}" y="${T - 3}" text-anchor="end">g</text>`;
  for (const s of series) {
    if (!s.pts.length) continue;
    const xy = s.pts.map(p => [X(parseD(p.date).getTime()), Y(p.weight)]);
    g += `<polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    g += xy.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="1.5"/>`).join('');
    const last = xy[xy.length - 1];
    g += `<text class="vl" x="${(last[0] + 7).toFixed(1)}" y="${(last[1] + 4).toFixed(1)}">${fmtW(s.pts[s.pts.length - 1].weight)}</text>`;
  }
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart">${g}</svg>${legend}`;
}

// ---------- care tasks ----------
function tasks() {
  const out = [], m = md(), today = todayStr(), y = new Date().getFullYear();
  for (const t of S.tanks) {
    const occ = occupants(t);
    if (!occ.length) continue;
    const larvae = occ.filter(isLarva), chamber = occ.filter(inChamber), adults = occ.filter(b => b.stage === 'adult');
    const hasL3 = larvae.some(b => b.stage === 'L3');
    const quiet = chamber.length > 0 || (hasL3 && m >= 415 && m < 801);
    const warm = m >= 401 && m < 1101;
    const lastCheck = lastTank(t, ['check', 'mat', 'top']);
    const lastMat = lastTank(t, ['mat']);
    const frass = S.log.some(e => e.tankId === t.id && e.kind === 'check' && e.frass && e.date >= (lastMat || '0'));

    if (larvae.length || chamber.length) {
      const every = quiet ? 10 : warm ? 7 : 14, n = daysSince(lastCheck);
      if (n === null || n >= every) out.push({
        key: `check:${t.id}`, level: 'due', icon: '👀', act: 'check', tankId: t.id,
        title: `${t.name}: check the mat`,
        text: quiet ? `Look from outside and at the surface only. Mist the top lightly if it has dried out — don’t dig. Last check ${ago(lastCheck)}.`
                    : `Squeeze a handful: it should hold its shape without dripping. Look for frass on the surface. Last check ${ago(lastCheck)}.`,
      });
    }
    if (larvae.length && !quiet) {
      const n = daysSince(lastMat);
      if (hasL3 && m >= 301 && m < 415) {
        if (!lastMat || lastMat < `${y}-02-15`) out.push({
          key: `final:${t.id}:${y}`, level: 'due', icon: '🪣', act: 'mat', tankId: t.id,
          title: `${t.name}: final mat change before pupation`,
          text: 'Do it before mid-April. Fill at least 20 cm deep and press the bottom 10 cm down hard so they can build pupal chambers. Weigh and sex them while they’re out. After this, leave the tank alone until the adults come up.',
        });
      } else {
        const every = larvae.every(b => b.stage !== 'L3') ? 60 : (m >= 1201 || m < 301) ? 75 : 45;
        if (n === null || n >= every || frass) out.push({
          key: `mat:${t.id}`, level: 'due', icon: '🪣', act: 'mat', tankId: t.id,
          title: `${t.name}: mat change`,
          text: `${frass ? 'You noted frass covering the surface. ' : ''}Last change ${lastMat ? ago(lastMat) : 'not recorded'}. Weigh${larvae.some(b => b.sex === '?' && b.stage === 'L3') ? ' and sex' : ''} the larvae while they’re out.`,
        });
      }
    }
    if (quiet && (larvae.length || chamber.length)) out.push({
      key: `quiet:${t.id}`, level: 'info', icon: '🤫', tankId: t.id,
      title: `${t.name}: do not disturb`,
      text: chamber.length ? 'Something is in a pupal chamber. Don’t dig, tip or move the tank. If you break a chamber by accident, see “Artificial pupal chamber” in the Guide.'
                           : 'Larvae are getting ready to build pupal chambers. No more mat changes until the adults are out.',
    });

    const nCount = larvae.length + chamber.length;
    if (t.liters && nCount && t.liters / nCount < 3) out.push({
      key: `crowd:${t.id}`, level: 'warn', icon: '📦', tankId: t.id,
      title: `${t.name} is crowded`,
      text: `${(t.liters / nCount).toFixed(1)} L of mat per larva. Aim for 3–5 L each (more for big males), or split them up.`,
    });
    if (hasL3 && m >= 101 && m < 415 && t.depth && t.depth < 20) out.push({
      key: `depth:${t.id}:${y}`, level: 'warn', icon: '📏', tankId: t.id,
      title: `${t.name}: mat only ${t.depth} cm deep`,
      text: 'For pupation give at least 20 cm of mat (males build upright chambers ~10 cm tall). Use a deeper container if needed before mid-April.',
    });
    if (larvae.filter(b => b.stage === 'L3').length >= 2 && m >= 115 && m < 415) out.push({
      key: `split:${t.id}:${y}`, level: 'info', icon: '✂️', tankId: t.id,
      title: `${t.name}: think about splitting before pupation`,
      text: 'Larvae that pupate close together can break into each other’s chambers. Many keepers give each larva its own container (2 L+, 20 cm deep) at the final mat change. A big, deep tank works too.',
    });
    if (adults.length) {
      const lf = lastTank(t, ['feed']), n = daysSince(lf);
      if (n === null || n >= 3) out.push({
        key: `feed:${t.id}`, level: 'due', icon: '🍯', act: 'feed', tankId: t.id,
        title: `${t.name}: fresh jelly`, text: `Last jelly ${ago(lf)}. Replace every 2–3 days, sooner if empty or mouldy. Keep the mat damp.`,
      });
      if (m >= 701 && m < 901) out.push({ key: `heat:${t.id}:${y}`, level: 'info', icon: '🌡️', title: `${t.name}: keep it below 30 °C`, text: 'Shade, no direct sun, not in a closed hot room or car.' });
    }
    if (!t.liters || !t.depth) out.push({
      key: `size:${t.id}`, level: 'info', icon: '📐', act: 'tankedit', tankId: t.id,
      title: `${t.name}: add its size`, text: 'Litres of mat and depth let the app warn about crowding and pupation depth.',
    });
  }
  for (const b of S.beetles.filter(alive)) {
    const since = stageSince(b);
    if (b.stage === 'L3' && b.sex === '?' && !out.some(o => o.act === 'mat' && o.tankId === b.tankId) && !(m >= 415 && m < 801)) out.push({
      key: `sex:${b.id}`, level: 'info', icon: '🔍', beetleId: b.id, act: 'sexguide',
      title: `${b.name}: male or female?`, text: 'Check at the next mat change: females have a small V-shaped mark on the underside near the tail end.',
    });
    if (b.stage === 'pupa' && since) out.push({
      key: `pupa:${b.id}`, level: 'info', icon: '⏳', beetleId: b.id,
      title: `${b.name} is a pupa`, text: `Adults usually eclose about 3 weeks after pupating — around ${niceDate(addDays(since, 21))}.`,
    });
    if (b.stage === 'eclosed') {
      const n = daysSince(since);
      out.push({
        key: `ecl:${b.id}`, level: n !== null && n > 21 ? 'warn' : 'info', icon: '🪲', beetleId: b.id, act: 'stage',
        title: `${b.name}: let it come up by itself`,
        text: since ? (n > 21 ? `Eclosed ${ago(since)} and still not up — have a gentle look near the chamber.` : `Eclosed ${ago(since)}. Expect it at the surface around ${niceDate(addDays(since, 10))}–${niceDate(addDays(since, 14))}. Mark it as “Adult” when it appears.`)
                    : 'New adults stay underground 1–2 weeks while the shell hardens. Mark it as “Adult” when it appears.',
      });
    }
  }
  return out.filter(o => !(S.snooze[o.key] && S.snooze[o.key] > today));
}

// ---------- header / routing ----------
function setHead({ kicker = '', title = '', sub = '', stats = '', back = false }) {
  $('#kicker').textContent = kicker; $('#title').textContent = title; $('#sub').textContent = sub;
  $('#hstats').innerHTML = stats; $('#back').hidden = !back;
  document.title = title === 'Kabutomushi' ? 'Kabutomushi Keeper' : `${title} · Kabutomushi`;
}
let lastRoute = '';
function route() {
  const h = location.hash.slice(1) || '/';
  const [, a, id] = h.split('/');
  let tab = 'home';
  if (a === 'b' && beetleOf(id)) renderBeetle(beetleOf(id));
  else if (a === 't' && tankOf(id)) renderTank(tankOf(id));
  else if (a === 'log') { tab = 'log'; renderLog(); }
  else if (a === 'guide') { tab = 'guide'; renderGuide(id); }
  else if (a === 'tools') { tab = 'tools'; renderTools(); }
  else renderHome();
  $$('#tabs a').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
  $('#fab').hidden = tab === 'guide' || tab === 'tools';
  hydratePhotos($('#view'));
  if (h !== lastRoute) { window.scrollTo(0, 0); lastRoute = h; }
}
const refresh = () => route();

// ---------- pages ----------
function taskList(list) {
  return `<ul class="tasks">${list.map(o => `<li class="task ${o.level}">
    <div class="ti">${o.icon}</div>
    <div class="tb"><div class="tt">${esc(o.title)}</div><div class="tx">${esc(o.text)}</div>
    ${o.level !== 'info' || o.act ? `<div class="tbtns">
      ${o.act ? `<button class="btn small ${o.level === 'due' ? 'primary' : ''}" data-act="task" data-k="${esc(o.act)}" data-tank="${o.tankId || ''}" data-beetle="${o.beetleId || ''}">${{ mat: 'Log mat change', check: 'Log check', feed: 'Log jelly', tankedit: 'Set size', sexguide: 'How?', stage: 'Change stage' }[o.act]}</button>` : ''}
      ${o.level !== 'info' ? `<button class="btn small" data-act="snooze" data-key="${esc(o.key)}">Later</button>` : ''}</div>` : ''}
    </div></li>`).join('')}</ul>`;
}

function bugCard(b) {
  const ws = weightsOf(b), w = ws[ws.length - 1], prev = ws[ws.length - 2];
  const delta = w && prev ? w.weight - prev.weight : null;
  return `<a class="bug" href="#/b/${b.id}">${glyph(b.stage, b.sex)}
    <span><b>${esc(b.name)} ${sexMark(b.sex)}</b>
    <small>${esc(STAGES[b.stage].label)}</small>
    <small>${w ? `<span class="w">${fmtW(w.weight)}</span>${delta !== null ? ` <span class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}</span>` : ''} · ${niceDate(w.date)}` : 'not weighed yet'}</small></span></a>`;
}

function renderHome() {
  const live = S.beetles.filter(alive);
  const nl = live.filter(isLarva).length, na = live.filter(b => !isLarva(b)).length;
  setHead({ kicker: niceDate(todayStr(), true), title: 'Kabutomushi', sub: phaseNow().label,
    stats: `${nl ? `<div><b>${nl}</b><span>${nl === 1 ? 'larva' : 'larvae'}</span></div>` : ''}${na ? `<div><b>${na}</b><span>${na === 1 ? 'other' : 'others'}</span></div>` : ''}<div><b>${S.tanks.length}</b><span>${S.tanks.length === 1 ? 'tank' : 'tanks'}</span></div>` });
  const ts = tasks(), act = ts.filter(o => o.level !== 'info'), info = ts.filter(o => o.level === 'info');
  const ph = phaseNow();
  const nb = S.lastBackup ? daysSince(S.lastBackup) : null;
  const backup = S.log.length >= 5 && (nb === null || nb >= 30) ? `<a class="banner" href="#/tools">💾 ${nb === null ? 'No backup yet' : `Last backup ${nb} days ago`} — tap to back up</a>` : '';
  const loose = S.beetles.filter(b => alive(b) && !tankOf(b.tankId));
  const dead = S.beetles.filter(b => !alive(b));
  $('#view').innerHTML = `${backup}
  ${S.welcome ? `<section class="paper welcome"><h2>Welcome!</h2>
    <p>I’ve set up <b>two tanks</b> and <b>three L3 larvae</b> (two in Tank A, one in Tank B) to start with.</p>
    <ul class="small"><li>Tap a tank to rename it, set its size and when the mat was last changed.</li><li>Tap a larva to rename it, move it to the other tank or set its sex.</li><li>Use <b>+</b> to log mat changes, weights, checks, notes and photos.</li></ul>
    <button class="btn small primary" data-act="welcome">Got it</button></section>` : ''}
  <section class="paper season"><div class="ph">${esc(ph.label)} <span class="jp">${ph.jp}</span></div><p>${esc(ph.text)}</p>${yearBar()}<a class="small" href="#/guide">Year guide →</a></section>
  <h3>To do</h3>
  ${act.length ? taskList(act) : '<div class="alldone">All looked after ✓</div>'}
  ${info.length ? `<h3>Notes</h3>${taskList(info)}` : ''}
  <h3>Tanks <button class="link act" data-act="tanknew">+ tank</button></h3>
  ${S.tanks.map(t => {
    const occ = occupants(t), lm = lastTank(t, ['mat']);
    const per = t.liters && occ.length ? ` · ${(t.liters / occ.length).toFixed(1)} L each` : '';
    return `<section class="tank"><a class="th" href="#/t/${t.id}"><span class="grow"><b>${esc(t.name)}</b>
      <small>${[t.liters ? `${t.liters} L` : '', t.depth ? `${t.depth} cm deep` : '', t.place].filter(Boolean).map(esc).join(' · ') || 'Tap to set size & place'}${per}</small>
      <small>Mat changed ${lm ? ago(lm) : '— not recorded'}</small></span><span aria-hidden="true">›</span></a>
      <div class="soilbox">${occ.map(bugCard).join('') || '<div class="empty">Empty</div>'}</div></section>`;
  }).join('')}
  ${loose.length ? `<h3>Not in a tank</h3><div class="soilbox" style="border-radius:10px">${loose.map(bugCard).join('')}</div>` : ''}
  <div class="btnrow"><button class="btn" data-act="beetlenew">+ Add a beetle</button></div>
  ${dead.length ? `<details class="small"><summary class="muted">Remembered (${dead.length})</summary><div class="soilbox" style="border-radius:10px;margin-top:6px">${dead.map(bugCard).join('')}</div></details>` : ''}`;
}

function logList(entries, ctx = {}) {
  if (!entries.length) return '<div class="nodata">Nothing logged yet.</div>';
  let html = '', mon = '';
  for (const e of entries) {
    const mo = parseD(e.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (ctx.months && mo !== mon) { if (mon) html += '</ul>'; html += `<div class="mon">${mo}</div><ul class="log">`; mon = mo; }
    else if (!html) html = '<ul class="log">';
    html += entryRow(e, ctx);
  }
  return html + '</ul>';
}
function entryTitle(e) {
  const b = beetleOf(e.beetleId), t = tankOf(e.tankId);
  switch (e.kind) {
    case 'weigh': return `${b ? esc(b.name) : '?'} — ${fmtW(e.weight)}`;
    case 'stage': return `${b ? esc(b.name) : '?'} → ${esc(STAGES[e.stage]?.label || e.stage)}`;
    case 'move': return `${b ? esc(b.name) : '?'} moved to ${t ? esc(t.name) : '?'}`;
    case 'note': return b ? esc(b.name) : t ? esc(t.name) : 'Note';
    default: return `${KINDS[e.kind].label}${t ? ` — ${esc(t.name)}` : ''}`;
  }
}
function entryRow(e) {
  const bits = [];
  if (e.moist) bits.push(MOIST[e.moist]);
  if (e.frass) bits.push('frass on surface');
  if (e.temp !== undefined && e.temp !== null && e.temp !== '') bits.push(`${e.temp} °C`);
  if (e.product) bits.push(e.product);
  if (e.sexed) bits.push(`sexed ${e.sexed === 'm' ? '♂' : '♀'}`);
  return `<li data-act="editentry" data-id="${e.id}"><div class="li">${KINDS[e.kind].icon}</div>
    <div class="lb"><div class="lt">${entryTitle(e)}</div><div class="lm">${niceDate(e.date)}${bits.length ? ' · ' + esc(bits.join(' · ')) : ''}</div>
    ${e.text ? `<div class="lx">${esc(e.text)}</div>` : ''}</div>
    ${e.photoId ? `<img data-photo="${e.photoId}" alt="">` : ''}</li>`;
}

function renderBeetle(b) {
  const t = tankOf(b.tankId), ws = weightsOf(b), since = stageSince(b);
  const age = b.born ? daysSince(b.born) : null;
  const pid = latestPhoto(b);
  const photos = sortedLog().filter(e => e.photoId && e.beetleId === b.id);
  setHead({ kicker: t ? t.name : 'Not in a tank', title: b.name, sub: `${STAGES[b.stage].long || STAGES[b.stage].label}${b.sex !== '?' ? ' · ' + SEX[b.sex] : ''}`, back: true });
  $('#view').innerHTML = `
  <section class="paper profile">
    <div class="pic">${pid ? `<img data-photo="${pid}" alt="">` : glyph(b.stage, b.sex, 84)}</div>
    <dl class="facts">
      <dt>Stage</dt><dd>${esc(STAGES[b.stage].label)} <span class="jp">${STAGES[b.stage].jp}</span>${since ? `<br><small class="muted">since ${niceDate(since)}</small>` : ''}</dd>
      <dt>Sex</dt><dd>${SEX[b.sex]}</dd>
      <dt>Tank</dt><dd>${t ? `<a href="#/t/${t.id}">${esc(t.name)}</a>` : '—'}</dd>
      ${b.born ? `<dt>Hatched</dt><dd>${niceDate(b.born, true)}${age !== null && age >= 0 ? ` <small class="muted">(${age < 60 ? plural(age, 'day') : plural(Math.round(age / 30.4), 'month')})</small>` : ''}</dd>` : ''}
      ${b.got ? `<dt>Got</dt><dd>${niceDate(b.got, true)}</dd>` : ''}
      ${ws.length ? `<dt>Heaviest</dt><dd>${fmtW(Math.max(...ws.map(w => w.weight)))}</dd>` : ''}
    </dl>
  </section>
  ${b.notes ? `<p class="pre small">${esc(b.notes)}</p>` : ''}
  <div class="btnrow">
    ${alive(b) ? `<button class="btn primary" data-act="new" data-k="weigh" data-beetle="${b.id}">⚖️ Weight</button>
    <button class="btn" data-act="new" data-k="stage" data-beetle="${b.id}">✨ Stage</button>
    <button class="btn" data-act="new" data-k="note" data-beetle="${b.id}">📷 Note</button>` : ''}
    <button class="btn" data-act="beetleedit" data-id="${b.id}">Edit</button>
  </div>
  <h3>Weight</h3>
  <div class="paper">${chart([{ name: b.name, color: colorOf(b), pts: ws }])}</div>
  ${photos.length ? `<h3>Photos</h3><div class="photos">${photos.map(e => `<img data-photo="${e.photoId}" data-act="viewphoto" data-id="${e.photoId}" alt="${esc(niceDate(e.date))}">`).join('')}</div>` : ''}
  <h3>History</h3>
  ${logList(sortedLog().filter(e => e.beetleId === b.id))}`;
}

function renderTank(t) {
  const occ = occupants(t), lm = lastTank(t, ['mat']), lc = lastTank(t, ['check', 'mat', 'top']);
  const ts = tasks().filter(o => o.tankId === t.id || occ.some(b => b.id === o.beetleId));
  setHead({ kicker: 'Tank', title: t.name, sub: [t.liters ? `${t.liters} L` : '', t.depth ? `${t.depth} cm deep` : '', t.place].filter(Boolean).join(' · '), back: true });
  $('#view').innerHTML = `
  <section class="tank"><div class="soilbox">${occ.map(bugCard).join('') || '<div class="empty">Empty</div>'}</div></section>
  <section class="paper"><dl class="facts">
    <dt>Size</dt><dd>${t.liters ? `${t.liters} L` : '—'}${t.liters && occ.length ? ` <small class="muted">(${(t.liters / occ.length).toFixed(1)} L per beetle)</small>` : ''}</dd>
    <dt>Mat depth</dt><dd>${t.depth ? `${t.depth} cm` : '—'}</dd>
    ${t.place ? `<dt>Place</dt><dd>${esc(t.place)}</dd>` : ''}
    <dt>Mat changed</dt><dd>${lm ? `${niceDate(lm)} <small class="muted">(${ago(lm)})</small>` : '—'}</dd>
    <dt>Last check</dt><dd>${lc ? `${niceDate(lc)} <small class="muted">(${ago(lc)})</small>` : '—'}</dd>
  </dl>${t.notes ? `<p class="pre small">${esc(t.notes)}</p>` : ''}</section>
  <div class="btnrow">
    <button class="btn primary" data-act="mat" data-tank="${t.id}">🪣 Mat change</button>
    <button class="btn" data-act="new" data-k="check" data-tank="${t.id}">👀 Check</button>
    <button class="btn" data-act="tankedit" data-id="${t.id}">Edit</button>
  </div>
  ${ts.length ? `<h3>To do</h3>${taskList(ts)}` : ''}
  ${occ.length ? `<h3>Weights</h3><div class="paper">${chart(occ.map(b => ({ name: b.name, color: colorOf(b), pts: weightsOf(b) })))}</div>` : ''}
  <h3>History</h3>
  ${logList(sortedLog().filter(e => e.tankId === t.id || (e.beetleId && occ.some(b => b.id === e.beetleId))))}`;
}

let logFilter = 'all';
function renderLog() {
  setHead({ kicker: 'Everything you’ve done', title: 'Log', sub: plural(S.log.length, 'entry').replace('entrys', 'entries') });
  const filters = [['all', 'All'], ...S.tanks.map(t => ['t:' + t.id, t.name]), ...S.beetles.map(b => ['b:' + b.id, b.name]), ['k:weigh', '⚖️ Weights'], ['k:mat', '🪣 Mat'], ['p', '📷 Photos']];
  if (!filters.some(f => f[0] === logFilter)) logFilter = 'all';
  const [fk, fv] = logFilter.split(':');
  const list = sortedLog().filter(e => fk === 'all' || (fk === 't' && e.tankId === fv) || (fk === 'b' && e.beetleId === fv) || (fk === 'k' && e.kind === fv) || (fk === 'p' && e.photoId));
  $('#view').innerHTML = `<div class="filters">${filters.map(([k, l]) => `<button class="${k === logFilter ? 'on' : ''}" data-act="filter" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>
    ${list.length ? logList(list, { months: true }) : `<div class="nodata">Nothing here yet. Tap <b>+</b> to log a check, mat change, weight or photo.</div>`}`;
}

function renderGuide(open) {
  const ph = phaseNow();
  setHead({ kicker: 'Japanese rhinoceros beetle', title: 'Care guide', sub: 'カブトムシの飼い方' });
  const sec = (id, title, body) => `<details id="g-${id}" ${open === id ? 'open' : ''}><summary>${title}</summary><div>${body}</div></details>`;
  $('#view').innerHTML = `<div class="guide">
  <section class="paper"><h2>The year</h2>${yearBar()}
    <ul class="phases">${YEAR.map(p => `<li class="${p === ph ? 'cur' : ''}"><span class="sw" style="background:${p.color}"></span><div>
      <b>${esc(p.label)}</b> <span class="jp">${p.jp}</span> <small>${fmtMD(p.from)} – ${fmtMD(p.to)}</small><div class="small">${esc(p.text)}</div></div></li>`).join('')}</ul>
    <p class="hint">Typical timing for an unheated room in central Japan. A warm room shifts everything a few weeks earlier.</p></section>
  <h3>Care</h3>
  ${sec('mat', 'Mat <span class="jp">発酵マット</span>', `<ul>
    <li>Use fermented beetle mat (カブトムシ用発酵マット / 腐葉土). Larvae eat it — it is their food, not just bedding.</li>
    <li><b>Moisture:</b> squeeze a handful. It should hold together like a rice ball but no water should drip out. Too dry → spray water and mix; too wet → leave the lid ajar for a day or mix in dry mat.</li>
    <li><b>New mat can still be fermenting.</b> If it feels warm or smells sour/ammonia, spread it out and air it for a few days before putting larvae in. Larvae lying on the surface often means gas, heat or wrong moisture.</li>
    <li><b>When to change:</b> when the surface is covered with frass pellets (糞), roughly every 1–2 months in autumn, 2–3 months in winter. You can sieve out frass and keep some old mat mixed with new.</li>
    <li>Put a sheet of newspaper or tissue under the lid (or use a コバエシャッター-type lid) to keep fungus gnats out.</li></ul>`)}
  ${sec('space', 'Space, temperature & place', `<ul>
    <li>About <b>3–5 L of mat per larva</b>; a big male eats the most.</li>
    <li>Before pupation the mat must be <b>at least 20 cm deep</b>, the bottom 10 cm pressed firmly.</li>
    <li>Shade, out of direct sun. 10–25 °C is comfortable. Winter cold is fine (they overwinter in the ground) but avoid freezing solid; avoid above 30 °C in summer.</li></ul>`)}
  ${sec('weigh', 'Weighing & handling', `<ul>
    <li>Weigh only when you’re changing the mat anyway — every dig is a disturbance.</li>
    <li>Tare a small cup on a kitchen scale (0.1 g is ideal), put the larva in, note the weight.</li>
    <li>Handle gently with clean hands or a spoon; put it back on top of the mat and it will dig in by itself.</li>
    <li>Weight usually peaks in winter. Males tend to be heavier than females.</li></ul>`)}
  ${sec('sex', 'Male or female? <span class="jp">雌雄判別</span>', `<ul>
    <li>Best on big L3 larvae (autumn–winter).</li>
    <li>Turn the larva over and look at the underside near the tail end, around the 3rd segment from the tip. <b>Females</b> have a small V-shaped mark there; <b>males</b> don’t.</li>
    <li>Not 100% reliable — the pupa settles it (males have the horn).</li></ul>`)}
  ${sec('trouble', 'Signs of trouble', `<ul>
    <li><b>Larva on the surface:</b> mat too wet, too dry, fermenting (gas/heat), crowded or too warm. Check and fix the mat.</li>
    <li><b>Mites (ダニ):</b> a few are harmless. Masses on the larva or mat → change the mat.</li>
    <li><b>Dark, soft or shrinking larva:</b> usually sick; separate it into fresh mat.</li>
    <li><b>Mould on the surface:</b> normal on new mat in small amounts; scoop it off.</li></ul>`)}
  <h3>Pupation & adults</h3>
  ${sec('pupation', 'Pupal chambers <span class="jp">蛹室</span>', `<ul>
    <li>Final mat change in March / early April. Then leave the tank alone.</li>
    <li>Prepupa (前蛹): the larva turns yellowish and wrinkly and lies still in an upright oval chamber. Pupa after ~2 weeks, adult ~3 weeks later.</li>
    <li>If a chamber is visible against the wall, cover that side with paper to keep it dark. Don’t tap or move the tank.</li></ul>`)}
  ${sec('artificial', 'Artificial pupal chamber <span class="jp">人工蛹室</span>', `<ul>
    <li>Only if a chamber gets broken. A prepupa or pupa left lying flat often can’t form properly (males especially need to hang upright for the horn).</li>
    <li>Take a cup of damp, firmly packed mat or a block of damp floral foam (オアシス) and make an <b>upright hole a bit larger than the pupa</b> — for a male long enough for the horn. A toilet-paper tube stood in packed mat also works.</li>
    <li>Lay the pupa in head-up, keep it dark and humid (mist the edges, not the pupa), don’t touch it again until it ecloses.</li></ul>`)}
  ${sec('adults', 'Adults <span class="jp">成虫</span>', `<ul>
    <li>After eclosion they stay underground 1–2 weeks while the shell hardens. Don’t dig them out; they come up at night.</li>
    <li>Beetle jelly (昆虫ゼリー), replaced every 2–3 days or when empty/mouldy. No watermelon — too watery.</li>
    <li>Add bark or a stick so they can climb and turn themselves over when they flip on their back.</li>
    <li>Males fight; one male per tank is safest. A male and female together will usually give eggs in the mat in August–September.</li>
    <li>Adults live roughly 1–3 months. Don’t release shop-bought or non-local beetles outside.</li></ul>`)}
  </div>`;
  if (open) setTimeout(() => $(`#g-${open}`)?.scrollIntoView({ behavior: 'smooth' }), 50);
}
const fmtMD = n => n >= 1232 ? 'end Dec' : new Date(2001, Math.floor(n / 100) - 1, n % 100).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function renderTools() {
  setHead({ kicker: 'Settings & backup', title: 'Tools' });
  $('#view').innerHTML = `
  <h3>Backup</h3>
  <section class="paper"><p class="small">Everything is stored only on this phone. Export a backup now and then (it includes photos) and keep it in your cloud drive.</p>
    <p class="muted small">Last backup: ${S.lastBackup ? niceDate(S.lastBackup, true) : 'never'}</p>
    <div class="btnrow"><button class="btn primary" data-act="export">💾 Export backup</button><button class="btn" data-act="import">Restore…</button></div>
    <p class="hint" id="persist"></p></section>
  <h3>Beetles & tanks</h3>
  <div class="btnrow"><button class="btn" data-act="beetlenew">+ Add a beetle</button><button class="btn" data-act="tanknew">+ Add a tank</button></div>
  <h3>Look</h3>
  <section class="paper"><div class="seg">${[['auto', 'Follow phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${S.theme === v ? 'checked' : ''} data-act="theme"><span>${l}</span></label>`).join('')}</div></section>
  <p class="hint" style="margin-top:20px">Kabutomushi Keeper · works offline. Add it to your Home Screen to use it like an app.</p>`;
  storageNote();
}
async function storageNote() {
  const el = $('#persist'); if (!el) return;
  const ok = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  el.textContent = ok ? '🔒 Storage is protected on this device.' : installed ? 'ℹ️ Installed. Keep exporting backups — they’re the real safety net.' : 'ℹ️ Opened in the browser. Add to Home Screen for the safest storage, and keep exporting backups.';
}

// ---------- modal ----------
function sheet(html, cls = '') {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  return m.firstElementChild;
}
const closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; };
function confirmBox(msg, ok = 'OK', danger = false) {
  return new Promise(res => {
    const s = sheet(`<p>${msg}</p><div class="btns"><button class="btn" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${ok}</button></div>`);
    s.addEventListener('click', e => { const r = e.target.closest('[data-r]'); if (r) { closeModal(); res(r.dataset.r === '1'); } });
  });
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }

const tankOptions = (sel, none) => `${none ? `<option value="">${none}</option>` : ''}${S.tanks.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}`;
const beetleOptions = sel => S.beetles.filter(b => alive(b) || b.id === sel).map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.name)}${tankOf(b.tankId) ? ` (${esc(tankOf(b.tankId).name)})` : ''}</option>`).join('');
const stageOptions = sel => STAGE_ORDER.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(STAGES[k].label)} ${STAGES[k].jp}</option>`).join('');
const photoField = id => `<div class="photoin">${id ? `<img data-photo="${id}" alt="">` : ''}<label class="btn small">📷 ${id ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/*" name="photo" hidden></label>${id ? '<button type="button" class="link" data-rmphoto>Remove</button>' : ''}</div>`;

async function storePhoto(form, oldId, removed) {
  const f = form.photo && form.photo.files[0];
  if (f) { const id = uid(); await DB.putPhoto(id, await shrink(f)); if (oldId) await DB.delPhoto(oldId).catch(() => {}); return id; }
  if (removed && oldId) { await DB.delPhoto(oldId).catch(() => {}); return null; }
  return oldId || null;
}
function wirePhoto(s, onRemove) {
  const inp = $('input[name=photo]', s);
  inp?.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; let img = $('.photoin img', s); if (!img) { img = document.createElement('img'); $('.photoin', s).prepend(img); } img.removeAttribute('data-photo'); img.src = URL.createObjectURL(f); });
  $('[data-rmphoto]', s)?.addEventListener('click', e => { onRemove(); $('.photoin img', s)?.remove(); e.target.remove(); });
  hydratePhotos(s);
}

// generic entry form (everything except a new mat change, which has its own form)
function openEntry(o = {}) {
  const e = o.entry ? { ...o.entry } : { id: null, date: todayStr(), kind: o.kind || 'note', tankId: o.tankId || null, beetleId: o.beetleId || null, ...(o.carry || {}) };
  if (!e.id && e.kind === 'mat') return openMat(e.tankId);
  if (!e.id && KINDS[e.kind].scope === 'beetle' && !e.beetleId) e.beetleId = (S.beetles.find(alive) || {}).id;
  if (!e.id && KINDS[e.kind].scope === 'tank' && !e.tankId) e.tankId = (S.tanks[0] || {}).id;
  if (!e.id && e.kind === 'stage' && !e.stage) { const b = beetleOf(e.beetleId); e.stage = b ? STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(b.stage) + 1, STAGE_ORDER.length - 2)] : 'L3'; }
  let removed = false;
  const collect = f => {
    const fd = new FormData(f);
    for (const k of ['date', 'tankId', 'beetleId', 'stage', 'moist', 'product', 'text', 'toTank']) if (fd.has(k)) e[k] = fd.get(k);
    if (fd.has('weight')) e.weight = fd.get('weight') === '' ? '' : +fd.get('weight');
    if (fd.has('temp')) e.temp = fd.get('temp') === '' ? '' : +fd.get('temp');
    if (f.frass) e.frass = f.frass.checked;
  };
  const draw = () => {
    const k = KINDS[e.kind], b = beetleOf(e.beetleId);
    const target = e.kind === 'note'
      ? `<div class="row2"><label class="f">Larva / beetle<select name="beetleId"><option value="">—</option>${beetleOptions(e.beetleId)}</select></label><label class="f">Tank<select name="tankId">${tankOptions(e.tankId, '—')}</select></label></div>`
      : k.scope === 'tank' ? `<label class="f">Tank<select name="tankId">${tankOptions(e.tankId)}</select></label>`
      : `<label class="f">Larva / beetle<select name="beetleId">${beetleOptions(e.beetleId)}</select></label>`;
    const s = sheet(`<form>
      <h2>${e.id ? 'Edit' : 'Log'}: ${k.icon} ${k.label}</h2>
      ${e.id ? '' : `<div class="kinds">${Object.entries(KINDS).map(([key, v]) => `<button type="button" data-kind="${key}" class="${key === e.kind ? 'on' : ''}">${v.icon} ${v.label}</button>`).join('')}</div>`}
      <div class="row2"><label class="f">Date<input type="date" name="date" value="${e.date}" max="${todayStr()}" required></label>
      ${e.kind === 'weigh' ? `<label class="f">Weight (g)<input type="number" name="weight" step="0.1" min="0" inputmode="decimal" value="${e.weight ?? ''}" required></label>` : ''}
      ${e.kind === 'check' ? `<label class="f">Temperature °C<input type="number" name="temp" step="0.5" inputmode="decimal" value="${e.temp ?? ''}" placeholder="optional"></label>` : ''}
      ${e.kind === 'stage' ? `<label class="f">New stage<select name="stage">${stageOptions(e.stage)}</select></label>` : ''}
      ${e.kind === 'move' ? `<label class="f">To tank<select name="tankId">${tankOptions(e.id ? e.tankId : (S.tanks.find(t => b && t.id !== b.tankId)?.id || e.tankId))}</select></label>` : ''}
      </div>
      ${e.kind === 'move' ? `<label class="f">Larva / beetle<select name="beetleId">${beetleOptions(e.beetleId)}</select></label>` : target}
      ${e.kind === 'check' ? `<div class="seg">${Object.entries(MOIST).map(([v, l]) => `<label><input type="radio" name="moist" value="${v}" ${(e.moist || 'ok') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <label class="check"><input type="checkbox" name="frass" ${e.frass ? 'checked' : ''}> Surface mostly covered with frass (time for new mat)</label>` : ''}
      ${e.kind === 'mat' || e.kind === 'top' ? `<label class="f">Mat used<input name="product" value="${esc(e.product ?? S.matName)}" placeholder="e.g. brand / 発酵マット"></label>` : ''}
      <label class="f">Note<textarea name="text" placeholder="${e.kind === 'note' ? 'What did you see?' : 'optional'}">${esc(e.text || '')}</textarea></label>
      ${photoField(e.photoId)}
      <div class="btns">${e.id ? '<button type="button" class="btn danger" data-del>Delete</button>' : ''}<button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div>
    </form>`);
    const f = $('form', s);
    wirePhoto(s, () => removed = true);
    $$('[data-kind]', s).forEach(x => x.onclick = () => { collect(f); openEntry({ kind: x.dataset.kind, tankId: e.tankId, beetleId: e.beetleId, carry: { date: e.date, text: e.text } }); });
    $('[data-cancel]', s).onclick = closeModal;
    $('[data-del]', s)?.addEventListener('click', async () => {
      if (!await confirmBox('Delete this entry?', 'Delete', true)) return;
      if (e.photoId) await DB.delPhoto(e.photoId).catch(() => {});
      S.log = S.log.filter(x => x.id !== e.id); await save(); refresh(); toast('Deleted');
    });
    f.onsubmit = async ev => {
      ev.preventDefault(); collect(f);
      const isNew = !e.id;
      if (isNew) { e.id = uid(); e.t = new Date().toISOString(); }
      if (e.kind === 'move') { /* tankId = destination */ }
      else if (KINDS[e.kind].scope === 'beetle' && !e.tankId) e.tankId = beetleOf(e.beetleId)?.tankId || null;
      if (e.kind === 'note' && !e.tankId && e.beetleId) e.tankId = beetleOf(e.beetleId)?.tankId || null;
      if (e.kind !== 'check') { delete e.moist; delete e.frass; delete e.temp; }
      e.photoId = await storePhoto(f, e.photoId, removed);
      if (e.product) S.matName = e.product;
      S.log = S.log.filter(x => x.id !== e.id).concat(e);
      const b = beetleOf(e.beetleId);
      // keep the beetle's current stage/tank in step with its latest entry
      if (b && e.kind === 'stage' && e.date >= lastDate(x => x.beetleId === b.id && x.kind === 'stage')) b.stage = e.stage;
      if (b && e.kind === 'move' && e.date >= lastDate(x => x.beetleId === b.id && x.kind === 'move')) b.tankId = e.tankId;
      if (e.kind === 'mat') { const t = tankOf(e.tankId); if (t && e.date > (t.matChanged || '')) t.matChanged = e.date; }
      await save(); closeModal(); refresh(); toast(isNew ? 'Logged' : 'Saved');
    };
  };
  draw();
}

function openMat(tankId) {
  tankId = tankId || (S.tanks[0] || {}).id;
  let removed = false;
  const draw = () => {
    const t = tankOf(tankId), occ = t ? occupants(t) : [];
    const s = sheet(`<form>
      <h2>🪣 Mat change</h2>
      <div class="row2"><label class="f">Tank<select name="tankId">${tankOptions(tankId)}</select></label><label class="f">Date<input type="date" name="date" value="${todayStr()}" max="${todayStr()}" required></label></div>
      <div class="seg"><label><input type="radio" name="kind" value="mat" checked><span>Full change</span></label><label><input type="radio" name="kind" value="top"><span>Top-up / partial</span></label></div>
      <label class="f">Mat used<input name="product" value="${esc(S.matName)}" placeholder="e.g. brand / 発酵マット"></label>
      ${occ.length ? `<p class="small muted" style="margin-top:12px">While they’re out (all optional):</p>` : ''}
      ${occ.map(b => `<div class="occ"><div class="on">${glyph(b.stage, b.sex, 30)} ${esc(b.name)}</div>
        <div class="f2"><label>Weight g<input type="number" name="w_${b.id}" step="0.1" min="0" inputmode="decimal" placeholder="${(weightsOf(b).slice(-1)[0] || {}).weight ?? ''}"></label>
        <label>Sex<select name="s_${b.id}">${Object.entries(SEX).map(([k, l]) => `<option value="${k}" ${k === b.sex ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Stage<select name="g_${b.id}">${STAGE_ORDER.filter(k => k !== 'dead').map(k => `<option value="${k}" ${k === b.stage ? 'selected' : ''}>${esc(STAGES[k].label.replace(' (still underground)', ' (under)'))}</option>`).join('')}</select></label></div></div>`).join('')}
      <label class="f">Note<textarea name="text" placeholder="How did it look? Mites, mould, larvae on the surface…"></textarea></label>
      ${photoField(null)}
      <div class="btns"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`);
    const f = $('form', s);
    wirePhoto(s, () => removed = true);
    f.tankId.onchange = () => { tankId = f.tankId.value; draw(); };
    $('[data-cancel]', s).onclick = closeModal;
    f.onsubmit = async ev => {
      ev.preventDefault();
      const fd = new FormData(f), date = fd.get('date'), now = new Date().toISOString();
      const main = { id: uid(), t: now, date, kind: fd.get('kind'), tankId, product: fd.get('product').trim(), text: fd.get('text').trim() };
      main.photoId = await storePhoto(f, null, removed);
      if (main.product) S.matName = main.product;
      S.log.push(main);
      if (main.kind === 'mat' && t && date > (t.matChanged || '')) t.matChanged = date;
      for (const b of occ) {
        const w = fd.get('w_' + b.id), sx = fd.get('s_' + b.id), st = fd.get('g_' + b.id);
        const sexed = sx !== b.sex && sx !== '?' ? sx : null;
        if (sx !== b.sex) b.sex = sx;
        if (w !== '' && +w > 0) S.log.push({ id: uid(), t: now, date, kind: 'weigh', beetleId: b.id, tankId, weight: +w, ...(sexed ? { sexed } : {}) });
        else if (sexed) S.log.push({ id: uid(), t: now, date, kind: 'note', beetleId: b.id, tankId, text: `Sexed: ${SEX[sexed]}` });
        if (st !== b.stage) { S.log.push({ id: uid(), t: now, date, kind: 'stage', beetleId: b.id, tankId, stage: st }); b.stage = st; }
      }
      await save(); closeModal(); refresh(); toast('Mat change logged');
    };
  };
  draw();
}

function openBeetle(b) {
  const isNew = !b;
  b = b ? { ...b } : { id: uid(), name: '', tankId: (S.tanks[0] || {}).id || '', stage: 'L3', sex: '?', born: '', got: '', notes: '', color: COLORS[S.beetles.length % COLORS.length] };
  const s = sheet(`<form><h2>${isNew ? 'Add a beetle' : 'Edit ' + esc(b.name)}</h2>
    <label class="f">Name<input name="name" value="${esc(b.name)}" required placeholder="e.g. Taro"></label>
    <div class="row2"><label class="f">Tank<select name="tankId">${tankOptions(b.tankId, '— none —')}</select></label>
    <label class="f">Sex<select name="sex">${Object.entries(SEX).map(([k, l]) => `<option value="${k}" ${k === b.sex ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <label class="f">Stage<select name="stage">${stageOptions(b.stage)}</select></label>
    <div class="row2"><label class="f">Hatched<input type="date" name="born" value="${b.born}"></label><label class="f">Got it on<input type="date" name="got" value="${b.got}"></label></div>
    <label class="f">Chart colour<input type="color" name="color" value="${colorOf(b)}" style="height:42px;padding:4px"></label>
    <label class="f">Notes<textarea name="notes" placeholder="Where it came from, anything special…">${esc(b.notes)}</textarea></label>
    <p class="hint">Changing the stage or tank here also adds it to the log (dated today).</p>
    <div class="btns">${isNew ? '' : '<button type="button" class="btn danger" data-del>Delete</button>'}<button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`);
  const f = $('form', s);
  $('[data-cancel]', s).onclick = closeModal;
  $('[data-del]', s)?.addEventListener('click', async () => {
    if (!await confirmBox(`Delete <b>${esc(b.name)}</b> and all its log entries?<br><small>If it died, it’s nicer to set its stage to “Died” — it’ll be kept under “Remembered”.</small>`, 'Delete', true)) return;
    S.beetles = S.beetles.filter(x => x.id !== b.id); S.log = S.log.filter(e => e.beetleId !== b.id);
    await save(); closeModal(); location.hash = '#/';
  });
  f.onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(f), old = beetleOf(b.id), today = todayStr(), now = new Date().toISOString();
    Object.assign(b, { name: fd.get('name').trim(), tankId: fd.get('tankId') || null, sex: fd.get('sex'), stage: fd.get('stage'), born: fd.get('born'), got: fd.get('got'), notes: fd.get('notes').trim(), color: fd.get('color') });
    if (old) {
      if (old.stage !== b.stage) S.log.push({ id: uid(), t: now, date: today, kind: 'stage', beetleId: b.id, tankId: b.tankId, stage: b.stage });
      if (old.tankId !== b.tankId && b.tankId) S.log.push({ id: uid(), t: now, date: today, kind: 'move', beetleId: b.id, tankId: b.tankId });
      Object.assign(old, b);
    } else S.beetles.push(b);
    await save(); closeModal(); refresh(); toast('Saved');
  };
}

function openTank(t) {
  const isNew = !t;
  t = t ? { ...t } : { id: uid(), name: `Tank ${String.fromCharCode(65 + S.tanks.length)}`, liters: null, depth: null, place: '', matChanged: '', notes: '' };
  const s = sheet(`<form><h2>${isNew ? 'Add a tank' : 'Edit ' + esc(t.name)}</h2>
    <label class="f">Name<input name="name" value="${esc(t.name)}" required></label>
    <div class="row2"><label class="f">Mat volume (litres)<input type="number" name="liters" step="0.5" min="0" inputmode="decimal" value="${t.liters ?? ''}"></label>
    <label class="f">Mat depth (cm)<input type="number" name="depth" step="1" min="0" inputmode="numeric" value="${t.depth ?? ''}"></label></div>
    <label class="f">Where is it?<input name="place" value="${esc(t.place)}" placeholder="e.g. genkan, shelf by the window"></label>
    <label class="f">Mat last changed<input type="date" name="matChanged" value="${t.matChanged}" max="${todayStr()}"><span class="hint">Only needed for changes before you started logging.</span></label>
    <label class="f">Notes<textarea name="notes" placeholder="Container type, lid, size in cm…">${esc(t.notes)}</textarea></label>
    <p class="hint">Not sure of the litres? Width × length × mat depth in cm ÷ 1000. A 30 × 20 cm case filled 20 cm deep ≈ 12 L.</p>
    <div class="btns">${isNew ? '' : '<button type="button" class="btn danger" data-del>Delete</button>'}<button type="button" class="btn" data-cancel>Cancel</button><button class="btn primary">Save</button></div></form>`);
  const f = $('form', s);
  $('[data-cancel]', s).onclick = closeModal;
  $('[data-del]', s)?.addEventListener('click', async () => {
    if (occupants(t).length) { closeModal(); return confirmBox('Move the beetles out of this tank first (edit each one and pick another tank).', 'OK'); }
    if (!await confirmBox(`Delete <b>${esc(t.name)}</b>? Its log entries are kept.`, 'Delete', true)) return;
    S.tanks = S.tanks.filter(x => x.id !== t.id); await save(); closeModal(); location.hash = '#/';
  });
  f.onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(f), num = k => fd.get(k) === '' ? null : +fd.get(k);
    Object.assign(t, { name: fd.get('name').trim(), liters: num('liters'), depth: num('depth'), place: fd.get('place').trim(), matChanged: fd.get('matChanged'), notes: fd.get('notes').trim() });
    const old = tankOf(t.id); if (old) Object.assign(old, t); else S.tanks.push(t);
    await save(); closeModal(); refresh(); toast('Saved');
  };
}

// ---------- backup ----------
const blobToData = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function exportBackup() {
  const photos = {};
  for (const id of await DB.photoKeys()) { const b = await DB.getPhoto(id); if (b) photos[id] = await blobToData(b); }
  S.lastBackup = todayStr();
  const name = `kabutomushi-backup-${todayStr()}.json`;
  const file = new File([JSON.stringify({ app: 'kabutomushi', format: 1, exported: new Date().toISOString(), state: S, photos })], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name === 'AbortError') return; }
  } else {
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  await save(); refresh(); toast('Backup exported');
}
function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    let data; try { data = JSON.parse(await file.text()); } catch { return confirmBox('That file is not a Kabutomushi backup.'); }
    if (!data || data.app !== 'kabutomushi' || !data.state) return confirmBox('That file is not a Kabutomushi backup.');
    if (!await confirmBox(`Restore the backup from <b>${new Date(data.exported).toLocaleString('en-GB')}</b>?<br>This replaces everything currently in the app.`, 'Restore', true)) return;
    await DB.clearPhotos(); photoURLs.clear();
    for (const [id, url] of Object.entries(data.photos || {})) await DB.putPhoto(id, await (await fetch(url)).blob());
    S = Object.assign(blank(), data.state, { welcome: false }); await save(); applyTheme(); location.hash = '#/'; refresh(); toast('Restored');
  };
  inp.click();
}

// ---------- actions ----------
const A = {
  add: () => {
    const [, a, id] = (location.hash.slice(1) || '/').split('/');
    if (a === 'b' && beetleOf(id)) return openEntry({ kind: 'weigh', beetleId: id });
    if (a === 't' && tankOf(id)) return openEntry({ kind: 'check', tankId: id });
    openEntry({ kind: 'check' });
  },
  new: el => openEntry({ kind: el.dataset.k, tankId: el.dataset.tank, beetleId: el.dataset.beetle }),
  mat: el => openMat(el.dataset.tank),
  task: el => {
    const k = el.dataset.k, t = el.dataset.tank, b = el.dataset.beetle;
    if (k === 'mat') return openMat(t);
    if (k === 'tankedit') return openTank(tankOf(t));
    if (k === 'sexguide') { location.hash = '#/guide/sex'; return; }
    openEntry({ kind: k, tankId: t, beetleId: b });
  },
  snooze: async el => { S.snooze[el.dataset.key] = addDays(todayStr(), 3); await save(); refresh(); toast('Hidden for 3 days'); },
  welcome: async () => { S.welcome = false; await save(); refresh(); },
  beetlenew: () => openBeetle(null),
  beetleedit: el => openBeetle(beetleOf(el.dataset.id)),
  tanknew: () => openTank(null),
  tankedit: el => openTank(tankOf(el.dataset.id)),
  editentry: el => { const e = S.log.find(x => x.id === el.dataset.id); if (e) openEntry({ entry: e }); },
  filter: el => { logFilter = el.dataset.f; refresh(); },
  viewphoto: async el => { const s = sheet(`<img src="${await photoURL(el.dataset.id)}" alt="">`, 'photo'); s.onclick = closeModal; },
  export: exportBackup,
  import: importBackup,
  theme: async el => { S.theme = el.value; await save(); applyTheme(); },
};
document.addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el || (el.tagName === 'INPUT' && el.type !== 'radio')) return;
  if (el.tagName === 'INPUT' && e.type === 'click' && el.type === 'radio') return A[el.dataset.act](el);
  if (A[el.dataset.act]) { e.preventDefault(); A[el.dataset.act](el); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
$('#back').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/');
window.addEventListener('hashchange', () => { closeModal(); route(); });
function applyTheme() { if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = S.theme; }

(async function start() {
  try { S = await DB.get('state'); } catch { S = null; }
  if (!S) { seed(); await save(); } else S = Object.assign(blank(), S);
  applyTheme(); route();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
