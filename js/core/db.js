// Tiny IndexedDB wrapper: 'kv' holds the app state, 'photos' holds image blobs.

import { DB_NAME } from './site.js';

export let dataVer = 0;   // bumped on every save of the state, so cached results know when they're stale
export const DB = (() => {
  let dbp;
  function open() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('photos'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    get: k => tx('kv', 'readonly', s => s.get(k)),
    set: (k, v) => { if (k === 'state') dataVer++; return tx('kv', 'readwrite', s => s.put(v, k)); },
    getPhoto: id => tx('photos', 'readonly', s => s.get(id)),
    putPhoto: (id, blob) => tx('photos', 'readwrite', s => s.put(blob, id)),
    delPhoto: id => tx('photos', 'readwrite', s => s.delete(id)),
    photoKeys: () => tx('photos', 'readonly', s => s.getAllKeys()),
    kvKeys: () => tx('kv', 'readonly', s => s.getAllKeys()),
    clearPhotos: () => tx('photos', 'readwrite', s => s.clear()),
  };
})();
