'use strict';
// Hand-drawn style crop icons (inline SVG, 32×32). Icons.crop(id, size) → svg string.
const Icons = (() => {
  const K = '#3a2a1c';
  const st = `stroke="${K}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"`;
  const G = '#5f9a3c', GD = '#3f7a2e', GL = '#8fbf5a';
  const leaf = (ang, len = 1, col = G, cx = 16, cy = 29, vein = true) =>
    `<g transform="rotate(${ang} ${cx} ${cy})"><path d="M${cx} ${cy} C ${cx - 6 * len} ${cy - 7 * len}, ${cx - 5 * len} ${cy - 18 * len}, ${cx} ${cy - 23 * len} C ${cx + 5 * len} ${cy - 18 * len}, ${cx + 6 * len} ${cy - 7 * len}, ${cx} ${cy}Z" fill="${col}" ${st}/>${vein ? `<path d="M${cx} ${cy - 2} L${cx} ${cy - 19 * len}" stroke="${K}" stroke-width=".7" opacity=".55"/>` : ''}</g>`;
  const tops = (col = G) => leaf(-28, .42, col, 16, 12, false) + leaf(0, .48, col, 16, 12, false) + leaf(28, .42, col, 16, 12, false);
  const dots = (pts, col = K, r = .7) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`).join('');

  const draw = {
    rootLong: (col, top = G) => tops(top) + `<path d="M10 12 Q16 9.5 22 12 Q21.5 20 16 30.5 Q10.5 20 10 12Z" fill="${col}" ${st}/>` +
      `<path d="M12 16 h3 M17.5 19 h3 M13 22 h2.5 M15 26 h2" stroke="${K}" stroke-width=".8" opacity=".6"/>`,
    rootRound: (col, top = G, shoulder) => tops(top) + `<path d="M16 26 L16 31" ${st}/>` + `<circle cx="16" cy="19.5" r="7.5" fill="${col}" ${st}/>` +
      (shoulder ? `<path d="M9.2 17 Q16 12 22.8 17 Q16 14.5 9.2 17Z" fill="${shoulder}" opacity=".9"/>` : '') + `<path d="M12.5 17.5 Q13.5 15.5 15.5 15" stroke="#fff" stroke-width="1.1" fill="none" opacity=".6"/>`,
    rosette: (col, opts = {}) => {
      let s = '';
      const angs = opts.angs || [-42, -16, 16, 42, 0];
      angs.forEach((a, i) => { s += leaf(a, i === angs.length - 1 ? .95 : .85, opts.alt && i % 2 ? opts.alt : col); });
      if (opts.stems) s += `<path d="M13 29 Q12 23 13.5 19 M19 29 Q20 23 18.5 19 M16 29 L16 18" stroke="#eef3df" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      if (opts.flowers) s += dots([[9, 7], [12, 5], [16, 3.5], [20, 5], [23, 7], [14, 7], [18, 7]], '#f2cf1d', 1.6);
      return s;
    },
    mizuna: col => {
      let s = '';
      [-35, -18, 0, 18, 35].forEach(a => {
        s += `<g transform="rotate(${a} 16 29)"><path d="M16 29 L16 5" stroke="#eef3df" stroke-width="1.6"/>` +
          [9, 13, 17, 21].map(y => `<path d="M16 ${y} q-3 -1 -4 -3 M16 ${y} q3 -1 4 -3" stroke="${col}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`).join('') + `</g>`;
      });
      return s;
    },
    celery: () => `<path d="M11 30 Q10 20 8 11 M16 30 L16 9 M21 30 Q22 20 24 11" stroke="${GL}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M11 30 Q10 20 8 11 M16 30 L16 9 M21 30 Q22 20 24 11" stroke="${K}" stroke-width=".7" fill="none" opacity=".5"/>` +
      dots([[8, 9], [6, 8], [9, 6.5], [16, 7], [14, 5], [18, 5], [24, 9], [26, 8], [23, 6.5]], G, 2.1),
    cabbage: (col, light) => leaf(-62, .62, light) + leaf(62, .62, light) +
      `<circle cx="16" cy="18" r="9.5" fill="${col}" ${st}/><path d="M16 9 Q12 16 16 27.5 M10 13 Q14 17 13 25 M22 13 Q18 17 19 25" stroke="${K}" stroke-width=".7" fill="none" opacity=".5"/>`,
    hakusai: () => `<path d="M9 28 Q7 14 12 6 Q16 3 20 6 Q25 14 23 28 Z" fill="#eef1d8" ${st}/>` +
      `<path d="M9.4 18 Q8 9 12 6 Q16 3 20 6 Q24 9 22.6 18 Q19 15 16 17 Q13 15 9.4 18Z" fill="#9cc45f" ${st}/><path d="M16 9 L16 28" stroke="${K}" stroke-width=".7" opacity=".5"/>`,
    broccoli: (col, crown) => `<path d="M13.5 30 L14.5 18 L17.5 18 L18.5 30Z" fill="${GL}" ${st}/>` +
      [[10, 15, 5], [22, 15, 5], [16, 10, 6], [16, 17, 4.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${crown || col}" ${st}/>`).join('') +
      dots([[9, 14], [11, 16], [15, 9], [17, 11], [21, 14], [23, 16], [16, 17]], K, .5),
    cauli: () => leaf(-55, .7, G) + leaf(55, .7, G) + [[11, 17, 5], [21, 17, 5], [16, 13, 6], [16, 19, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f4ecd0" ${st}/>`).join('') +
      dots([[10, 16], [12, 18], [15, 12], [17, 14], [20, 16], [22, 18]], '#b9a77a', .6),
    tomato: col => `<circle cx="16" cy="18" r="10.5" fill="${col}" ${st}/><path d="M10 13 Q11.5 10.5 14 10" stroke="#fff" stroke-width="1.4" fill="none" opacity=".55"/>` +
      `<path d="M16 9 L13 6.5 L15 9.5 L10.5 9.5 L14.5 11 L12 14 L16 11.5 L20 14 L17.5 11 L21.5 9.5 L17 9.5 L19 6.5 Z" fill="${G}" ${st} stroke-width="1"/><path d="M16 9 L16 4" ${st}/>`,
    mini: col => `<path d="M16 3 Q16 8 11 13 M16 8 Q19 10 21 14 M16 8 L16 10" stroke="${GD}" stroke-width="1.4" fill="none"/>` +
      [[11, 16], [21, 17], [15.5, 25]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${col}" ${st}/><path d="M${x - 2} ${y - 4} l2 1.5 l2 -1.5" stroke="${G}" stroke-width="1.3" fill="none"/>`).join(''),
    eggplant: col => `<path d="M13 11 Q5 19 9 26 Q14 32 22 27 Q27 22 21 12 Z" fill="${col}" ${st}/><path d="M10.5 20 Q11 24 14 26" stroke="#fff" stroke-width="1.3" fill="none" opacity=".45"/>` +
      `<path d="M11.5 11.5 L22.5 11 L20.5 15 L17 13 L13.5 15.5 Z" fill="${GD}" ${st}/><path d="M17 11 L18 5" ${st}/>`,
    pepper: col => `<path d="M9 13 Q7.5 26 12.5 28.5 Q16 30 19.5 28.5 Q24.5 26 23 13 Q16 10 9 13Z" fill="${col}" ${st}/><path d="M16 12 L16 28" stroke="${K}" stroke-width=".7" opacity=".45"/>` +
      `<path d="M12 13 Q16 9.5 20 13" fill="${GD}" ${st}/><path d="M16 11 Q16 7 18.5 5" ${st} fill="none"/>`,
    chilli: (col, thin) => `<path d="M19 7 Q${thin ? 23 : 25} 11 21 18 Q16 27 6 29.5 Q${thin ? 12 : 11} 23 14 15 Q15.5 9.5 19 7Z" fill="${col}" ${st}/>` +
      `<path d="M17 7.5 Q19.5 5.5 22 7.5 L21 9.5 Q19 8.5 17.5 9.5Z" fill="${GD}" ${st}/><path d="M19.5 6.5 Q20 4 23 3" ${st} fill="none"/>`,
    cucumber: (col, dark) => `<g transform="rotate(35 16 16)"><rect x="11.5" y="2.5" width="9" height="27" rx="4.5" fill="${col}" ${st}/>` +
      (dark ? `<path d="M14 6 L14 26 M18 6 L18 26" stroke="${K}" stroke-width=".6" opacity=".4"/>` : dots([[14, 8], [18, 11], [14, 15], [18, 19], [14, 23]], '#d9e8c0', .8)) +
      `<path d="M16 2.5 L16 0.5" ${st}/></g>`,
    strawberry: () => `<path d="M16 30 C 5 22, 5.5 11, 16 11.5 C 26.5 11, 27 22, 16 30Z" fill="#e0384c" ${st}/>` +
      dots([[12, 16], [16, 15], [20, 16], [11, 20], [15, 19.5], [19.5, 20], [13.5, 24], [18, 24], [16, 27]], '#f6e27a', .7) +
      `<path d="M16 12 L10 9 L13 13 L8.5 14 L13.5 14 M16 12 L22 9 L19 13 L23.5 14 L18.5 14 M16 12 L16 6" fill="${G}" ${st} stroke-width="1"/>`,
    corn: () => `<ellipse cx="16" cy="15" rx="6" ry="11" fill="#f2c230" ${st}/>` +
      `<path d="M10.5 11 h11 M10.2 15 h11.6 M10.5 19 h11 M12 7.5 h8 M12 22.5 h8 M13.5 5 v20 M16 4 v22 M18.5 5 v20" stroke="#b88a14" stroke-width=".7"/>` +
      `<path d="M16 30 Q8 26 7 12 Q11 22 16 25Z M16 30 Q24 26 25 12 Q21 22 16 25Z" fill="${G}" ${st}/>`,
    pod: (col, beans = 4, fat) => {
      const h = fat ? 4 : 2.6;
      let s = `<path d="M4 23 Q15 ${30 + h} 28 9 Q${20 - h} ${17 - h} 4 23Z" fill="${col}" ${st}/>`;
      const pts = [[9, 22.5], [13.5, 21], [18, 18.5], [22, 15], [25, 11.5]].slice(0, beans);
      s += pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${fat ? 2.6 : 2}" fill="${fat ? '#a7cf7c' : '#9ed06a'}" stroke="${K}" stroke-width=".8"/>`).join('');
      return s + `<path d="M28 9 Q29.5 6 28.5 4" ${st} fill="none"/>`;
    },
    edamame: () => `<path d="M5 25 Q4 20 8.5 19 Q10.5 14 15 15 Q17.5 10 22 11 Q27 11 27.5 7 Q30 13 25 16 Q23 21 18 20.5 Q15.5 25 11 24.5 Q8 28 5 25Z" fill="#7cb342" ${st}/>` +
      `<path d="M8 22 l-1.5 -1 M12 20 l-1 -1.5 M15 18.5 l.5 -1.5 M19 16 l.5 -1.5 M23 14 l1 -1.2" stroke="${K}" stroke-width=".6"/>` + dots([[9, 22], [15, 18.5], [21.5, 15]], '#c5e1a5', 1.6),
    bulb: (col, leaves = G, garlic) => `<path d="M14 15 L12.5 3 M16 15 L16 2 M18 15 L19.5 3" stroke="${leaves}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M16 30 C 6 29, 6 19, 13.5 15 L18.5 15 C 26 19, 26 29, 16 30Z" fill="${col}" ${st}/>` +
      (garlic ? `<path d="M16 15 Q12 22 13 29.5 M16 15 Q20 22 19 29.5" stroke="${K}" stroke-width=".7" fill="none" opacity=".5"/>` : `<path d="M11 21 Q12 26 15 28" stroke="${K}" stroke-width=".7" fill="none" opacity=".4"/>`) +
      `<path d="M14 30 L13 31.5 M16 30 L16 31.8 M18 30 L19 31.5" stroke="${K}" stroke-width=".8"/>`,
    smallBulb: () => `<path d="M14.5 21 L10 2 M16 21 L16 1.5 M17.5 21 L22 2" stroke="${G}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M16 30 C 10 29.5, 9.5 23, 14 20.5 L18 20.5 C 22.5 23, 22 29.5, 16 30Z" fill="#f2ecd8" ${st}/>`,
    negi: () => `<path d="M14.5 15 L11 2 M16 15 L16 1.5 M17.5 15 L21 2" stroke="${G}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="13.5" y="14" width="5" height="15" rx="1.5" fill="#f4f1e2" ${st}/><path d="M13.5 18 h5" stroke="${GL}" stroke-width="1.2"/>` +
      `<path d="M14 29 L13 31.5 M16 29 L16 31.8 M18 29 L19 31.5" stroke="${K}" stroke-width=".8"/>`,
    potato: () => `<path d="M6 18 Q5 10 13 9 Q19 7 24 11 Q28 15 26 21 Q24 27 16 26.5 Q7 26 6 18Z" fill="#c9a26b" ${st}/>` + dots([[11, 14], [18, 12], [21, 19], [13, 21], [24, 15]], '#7a5b33', .8),
    satsuma: () => `<path d="M3 21 Q9 9 21 9 Q29 9 29 12 Q28 17 19 21 Q10 25 3 21Z" fill="#a8335f" ${st}/><path d="M8 18 Q14 16 22 12" stroke="#fff" stroke-width="1" fill="none" opacity=".35"/>` +
      `<path d="M29 12 L31 11 M3 21 L1 22.5" stroke="${K}" stroke-width=".9"/>`,
    taro: () => `<ellipse cx="16" cy="19" rx="8" ry="10" fill="#8d6e63" ${st}/><path d="M9 15 Q16 17 23 15 M8.5 20 Q16 22 23.5 20 M9.5 25 Q16 27 22.5 25" stroke="#5d4037" stroke-width=".9" fill="none"/><path d="M16 9 L16 4" ${st}/>`,
    generic: col => leaf(-30, .8, col) + leaf(30, .8, col) + leaf(0, 1, col),
  };
  const MAP = {
    nasu: ['eggplant', '#5b3a7a'], celery: ['celery'], potato: ['potato'], minitomato: ['mini', '#e0443e'], tomato: ['tomato', '#d6362f'],
    naganegi: ['negi'], hatamanegi: ['smallBulb'], carrot: ['rootLong', '#f08a24'], komatsuna: ['rosette', '#3f8f3a'],
    edamame: ['edamame'], hakusai: ['hakusai'], daikon: ['rootLong', '#f4f1e6', G], hatsuka: ['rootRound', '#e84d6f'], cabbage: ['cabbage', '#9cc965', '#6fa743'],
    spinach: ['rosette', '#2e7d32', { angs: [-50, -25, 25, 50, 0] }], kabu: ['rootRound', '#f6f3ea', G, '#e7ecd2'], piman: ['pepper', '#3f9a3f'], chilli: ['chilli', '#d84315'],
    snappea: ['pod', '#7cc576', 4], kyuri: ['cucumber', '#3d7a2a'], onion: ['bulb', '#d8a95b'], lettuce: ['rosette', '#a5d66f', { alt: '#8bc34a', angs: [-60, -30, 30, 60, -10, 10] }],
    broccoli: ['broccoli', '#2f6b3a'], satoimo: ['taro'], satsumaimo: ['satsuma'], shungiku: ['rosette', '#558b2f', { angs: [-35, -12, 12, 35, 0] }], mizuna: ['mizuna', '#7cb342'],
    zucchini: ['cucumber', '#2e5a1f', true], corn: ['corn'], ingen: ['pod', '#689f38', 5], chingensai: ['rosette', '#7fb069', { stems: true, angs: [-30, 30, 0] }],
    garlic: ['bulb', '#efe9da', G, true], shishito: ['chilli', '#5aa845', true], sayaendo: ['pod', '#8bc34a', 3], soramame: ['pod', '#5d8a3a', 3, true],
    cauliflower: ['cauli'], strawberry: ['strawberry'], nanohana: ['rosette', '#5c8f2e', { flowers: true, angs: [-40, 40, -15, 15] }],
  };
  function crop(id, size = 22, color) {
    const m = MAP[id] || ['generic', color || G];
    const body = draw[m[0]](...m.slice(1));
    return `<svg class="cicon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
  }
  // Weather icons for WMO weather codes (Open-Meteo).
  function weather(code, size = 28) {
    const sun = (cx = 16, cy = 14, r = 6) => `<g stroke="#c98a12" stroke-width="1.6" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const t = a * Math.PI / 180; return `<line x1="${cx + Math.cos(t) * (r + 2.5)}" y1="${cy + Math.sin(t) * (r + 2.5)}" x2="${cx + Math.cos(t) * (r + 5)}" y2="${cy + Math.sin(t) * (r + 5)}"/>`; }).join('')}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#f2b632" ${st}/>`;
    const cloud = (dy = 0, col = '#eef0ee') => `<path d="M8 ${25 + dy} h15 a5 5 0 0 0 0.5 -10 a7.5 7.5 0 0 0 -14 -1.5 a5.8 5.8 0 0 0 -1.5 11.5Z" fill="${col}" ${st}/>`;
    const drops = n => `<g stroke="#3d7fb8" stroke-width="1.8" stroke-linecap="round">${[10, 15, 20, 25].slice(0, n).map((x, i) => `<line x1="${x}" y1="${26 + (i % 2) * 1.5}" x2="${x - 1.5}" y2="${30 + (i % 2) * 1.5}"/>`).join('')}</g>`;
    let b;
    if (code === 0) b = sun(16, 16, 7);
    else if (code <= 2) b = sun(11, 11, 5) + cloud(2);
    else if (code === 3) b = cloud(-1, '#dfe3df');
    else if (code === 45 || code === 48) b = cloud(-4, '#e4e6e2') + `<path d="M6 26 h20 M9 30 h15" stroke="#8a8f88" stroke-width="1.8" stroke-linecap="round"/>`;
    else if ((code >= 51 && code <= 57)) b = cloud(-3) + drops(2);
    else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) b = cloud(-3, '#d6dbd8') + drops(4);
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) b = cloud(-3) + `<g fill="#9cc0de" ${st} stroke-width=".8">${[[10, 28], [16, 30], [22, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g>`;
    else if (code >= 95) b = cloud(-3, '#c9cfcc') + `<path d="M17 21 L13 27 L16.5 27 L14 32 L20 25 L16.5 25 L18.5 21Z" fill="#f2c230" ${st} stroke-width="1"/>`;
    else b = cloud();
    return `<svg class="wicon" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">${b}</svg>`;
  }
  return { crop, weather };
})();
