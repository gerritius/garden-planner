'use strict';
// Tiny IndexedDB wrapper: 'kv' holds the app state, 'photos' holds image blobs.
const DB = (() => {
  let dbp;
  function open() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('garden-planner', 1);
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
    set: (k, v) => tx('kv', 'readwrite', s => s.put(v, k)),
    getPhoto: id => tx('photos', 'readonly', s => s.get(id)),
    putPhoto: (id, blob) => tx('photos', 'readwrite', s => s.put(blob, id)),
    delPhoto: id => tx('photos', 'readwrite', s => s.delete(id)),
    photoKeys: () => tx('photos', 'readonly', s => s.getAllKeys()),
    clearPhotos: () => tx('photos', 'readwrite', s => s.clear()),
  };
})();
