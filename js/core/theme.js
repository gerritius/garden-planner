// Colour themes (light, dark, follow the phone).

import { A, render } from './router.js';
import { S, save } from './state.js';

const THEMES = [['cream', 'Cream'], ['kraft', 'Kraft'], ['dark', 'Dark'], ['auto', 'Match phone']];
const THEME_BAR = { cream: '#6b8a55', kraft: '#34492b', dark: '#23301d' };
export function applyTheme() {
  const t = (S && S.theme) || 'cream';
  const r = t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'cream') : t;
  document.documentElement.dataset.theme = r;
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = THEME_BAR[r];
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
export function themeSettings() {
  A.theme = async el => { S.theme = el.dataset.v; applyTheme(); await save(); render(); };
  const cur = S.theme || 'cream';
  return `<section><h3>Appearance</h3><div class="seg">${THEMES.map(([v, l]) => `<button type="button" data-act="theme" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div></section>`;
}
