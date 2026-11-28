// Colour themes (light, dark, follow the phone), and whether explanations show in full or as tap-to-read tips.

import { A, render } from './router.js';
import { S, save } from './state.js';

const THEMES = [['cream', 'Cream'], ['kraft', 'Kraft'], ['dark', 'Dark'], ['auto', 'Match phone']];
const THEME_BAR = { cream: '#6b8a55', kraft: '#34492b', dark: '#23301d' };
export function applyTheme() {
  const t = (S && S.theme) || 'cream';
  const r = t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'cream') : t;
  document.documentElement.dataset.theme = r;
  document.documentElement.classList.toggle('explain', !!(S && S.explain));   // (explanations shown in full, not as tips)
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = THEME_BAR[r];
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
export function themeSettings() {
  A.theme = async el => { S.theme = el.dataset.v; applyTheme(); await save(); render(); };
  const cur = S.theme || 'cream';
  A.explain = async el => { S.explain = el.dataset.v === '1'; applyTheme(); await save(); render(); };
  return `<section><h3>Appearance</h3><div class="seg">${THEMES.map(([v, l]) => `<button type="button" data-act="theme" data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <h3>Explanations</h3><p>Longer explanations are tucked behind a <b>ⓘ</b> — tap it to read one. Or show them all in full.</p>
    <div class="seg"><button type="button" data-act="explain" data-v="0" class="${S.explain ? '' : 'on'}">ⓘ Tips</button><button type="button" data-act="explain" data-v="1" class="${S.explain ? 'on' : ''}">Show them all</button></div></section>`;
}
