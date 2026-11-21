// Photos: stored as blobs in IndexedDB, shown through object URLs, shrunk before saving, shared between plantings.

import { DB } from './db.js';
import { S } from './state.js';
import { $$ } from './util.js';

export const photoURLs = {};

// ---------- photos ----------
async function photoURL(id) {
  if (!id) return null;
  if (photoURLs[id]) return photoURLs[id];
  const b = await DB.getPhoto(id);
  return b ? (photoURLs[id] = URL.createObjectURL(b)) : null;
}
export function hydrate(root = document) {
  $$('img[data-photo]', root).forEach(async img => { const u = await photoURL(img.dataset.photo); if (u) img.src = u; else img.closest('.ph')?.classList.add('missing'); });
}
export async function compress(file) {
  let img;
  try { img = await createImageBitmap(file); } catch { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const max = 1800, sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
}
export const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

// ---------- shared photos: only deleted when nothing uses them ----------
function photoUsed(id) {
  return S.plantings.some(p => Object.values(p.photos || {}).includes(id) || (p.diary || []).some(d => d.photo === id));
}
export async function dropPhoto(id) {
  if (!id || photoUsed(id)) return;
  await DB.delPhoto(id); delete photoURLs[id];
}
