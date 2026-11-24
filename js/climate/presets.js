// Climate types (Köppen–Geiger) for a garden without a location — or before its weather can be fetched: a typical
// year for each, from one representative city (approximate normals: monthly mean °C, rain in mm, and the usual first and
// last frost where frost comes most winters). Picked by the type and the hemisphere; once a location is set, its own
// 10-year records replace it. One type can cover very different gardens (Tokyo and Sydney are both "humid subtropical"),
// so the humid subtropical type comes in two: with a real winter, and mild.

import { A, render } from '../core/router.js';
import { S, save } from '../core/state.js';
import { esc, todayStr } from '../core/util.js';
import { applyClimate } from './climate.js';

// frost: days from the start of the winter (1 July up north) — [first, last]
export const CLIMATE_TYPES = [
  { id: 'Af', name: 'Tropical, wet all year', eg: 'Singapore, Kuala Lumpur', lat: 1.35,
    t: [26.5, 27.1, 27.5, 28.0, 28.3, 28.3, 27.9, 27.9, 27.6, 27.6, 27.0, 26.4], rain: [240, 160, 180, 170, 170, 140, 150, 150, 140, 160, 250, 290] },
  { id: 'Aw', name: 'Tropical, wet and dry seasons', eg: 'Bangkok, Darwin', lat: 13.7,
    t: [27.0, 28.3, 29.5, 30.4, 29.8, 29.3, 28.9, 28.7, 28.3, 28.1, 27.6, 26.4], rain: [15, 25, 45, 80, 200, 170, 180, 220, 330, 240, 50, 10] },
  { id: 'BWh', name: 'Hot desert', eg: 'Phoenix, Dubai, Alice Springs', lat: 33.4,
    t: [13.6, 15.3, 18.6, 22.5, 27.4, 32.8, 35.1, 34.4, 31.4, 24.8, 17.8, 12.9], rain: [23, 24, 25, 7, 3, 1, 26, 24, 16, 15, 18, 24] },
  { id: 'BSk', name: 'Cold semi-arid', eg: 'Denver, Madrid, Ankara', lat: 39.7, frost: [98, 307],
    t: [0.0, 0.9, 5.0, 9.0, 14.0, 19.6, 23.5, 22.4, 17.6, 10.8, 4.4, -0.4], rain: [10, 12, 25, 45, 60, 50, 55, 45, 30, 25, 15, 12] },
  { id: 'Csa', name: 'Mediterranean, hot summer', eg: 'Rome, Athens, Adelaide', lat: 41.9,
    t: [8.0, 8.8, 11.0, 13.7, 18.0, 22.0, 25.0, 25.0, 21.5, 17.0, 12.0, 8.9], rain: [80, 75, 70, 65, 50, 35, 20, 35, 75, 110, 110, 95] },
  { id: 'Csb', name: 'Mediterranean, mild summer', eg: 'San Francisco, Porto, Cape Town', lat: 37.8,
    t: [10.7, 12.1, 13.0, 13.6, 14.6, 15.7, 16.0, 16.6, 17.4, 16.6, 13.6, 10.8], rain: [110, 105, 75, 35, 15, 4, 0, 1, 4, 25, 80, 110] },
  { id: 'Cfa', name: 'Humid subtropical, cool winter', eg: 'Tokyo, Shanghai, Atlanta', lat: 35.75, builtIn: true,
    t: [5.2, 5.7, 8.7, 13.9, 18.2, 21.4, 25.0, 26.4, 22.8, 17.5, 12.1, 7.6], rain: [52, 56, 117, 125, 138, 168, 154, 168, 210, 198, 93, 51] },
  { id: 'Cfa-mild', name: 'Humid subtropical, mild winter', eg: 'Sydney, Brisbane, Durban', lat: -33.9,
    t: [22.8, 22.8, 21.6, 19.0, 16.1, 13.6, 12.8, 13.9, 16.2, 18.4, 20.0, 21.7], rain: [100, 120, 130, 125, 100, 130, 75, 80, 65, 75, 85, 75] },
  { id: 'Cfb', name: 'Oceanic', eg: 'London, Paris, Melbourne, Auckland', lat: 51.5, frost: [140, 266],
    t: [5.2, 5.3, 7.6, 9.9, 13.3, 16.5, 18.7, 18.5, 15.7, 12.0, 8.0, 5.5], rain: [55, 40, 40, 45, 50, 45, 45, 50, 50, 70, 60, 55] },
  { id: 'Dfa', name: 'Continental, hot summer', eg: 'Chicago, Bucharest, Almaty', lat: 41.9, frost: [111, 290],
    t: [-4.6, -2.5, 3.2, 9.6, 15.6, 21.1, 23.9, 23.1, 19.0, 12.4, 5.2, -1.3], rain: [45, 45, 65, 90, 105, 105, 100, 105, 85, 85, 75, 55] },
  { id: 'Dfb', name: 'Continental, warm summer', eg: 'Sapporo, Moscow, Toronto', lat: 43.1, frost: [112, 303],
    t: [-3.2, -2.7, 1.1, 7.3, 13.0, 17.0, 21.1, 22.3, 18.6, 12.1, 5.2, -0.9], rain: [110, 95, 80, 55, 55, 50, 90, 125, 140, 110, 110, 110] },
];
const flip = a => a.slice(6).concat(a.slice(0, 6));   // the same year, six months on (the other hemisphere)

// the typical climate of a type, for this hemisphere
export function presetClimate(id, south) {
  const p = CLIMATE_TYPES.find(x => x.id === id); if (!p) return null;
  const native = p.lat < 0, turn = native !== !!south, lat = Math.abs(p.lat) * (south ? -1 : 1);
  return { preset: id, name: `${p.name} (${south ? 'southern' : 'northern'} hemisphere)`, lat, lon: 0, t: turn ? flip(p.t) : p.t.slice(), rain: turn ? flip(p.rain) : p.rain.slice(),
    years: 'a typical year', fetched: todayStr(), frost: p.frost ? { winters: 10, frosty: 10, first: p.frost[0], last: p.frost[1], south: !!south } : null };
}
// the picker: Tools → Weather & climate, and the first-run "Where" step, while no location's weather is in
let pickSouth = null;   // the hemisphere tapped before a type is picked (it only takes effect with the type)
export function climateTypePicker() {
  const cur = S.climate && S.climate.preset, south = cur ? S.climate.lat < 0 : pickSouth ?? (S.weather && S.weather.lat != null ? S.weather.lat < 0 : false);
  A.climType = async el => { S.climate = presetClimate(el.dataset.id, south); applyClimate(true); await save(); render(); };
  A.climHemi = async el => { const s = el.dataset.v === 's'; pickSouth = s; if (cur) { S.climate = presetClimate(cur, s); applyClimate(true); await save(); } render(); };
  A.climBuiltIn = async () => { S.climate = null; applyClimate(true); await save(); render(); };
  return `<details class="climtypes"${cur ? ' open' : ''}><summary>No location? Pick your climate type</summary>
    <p class="small muted">A typical year for each type (Köppen–Geiger). Setting your location gives your own garden’s weather instead.</p>
    <div class="seg">${[['n', 'Northern hemisphere'], ['s', 'Southern hemisphere']].map(([v, l]) => `<button type="button" data-act="climHemi" data-v="${v}" class="${(v === 's') === south ? 'on' : ''}">${l}</button>`).join('')}</div>
    <ul class="plist">${CLIMATE_TYPES.map(p => `<li data-act="climType" data-id="${p.id}"${cur === p.id || (!cur && !S.climate && p.builtIn) ? ' class="on"' : ''}><span class="grow"><b>${esc(p.name)}</b> <small class="muted">${esc(p.id.replace('-mild', ''))}</small><small>${esc(p.eg)}</small></span>${cur === p.id || (!cur && !S.climate && p.builtIn) ? '✓' : '›'}</li>`).join('')}</ul>
    ${cur ? '<button type="button" class="btn small" data-act="climBuiltIn">Back to the built-in (western Tokyo)</button>' : ''}</details>`;
}
