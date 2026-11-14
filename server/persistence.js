// Optional device-local IndexedDB cache. Node tests and privacy-restricted browsers
// simply use the in-memory adapter cache. Original retrieval timestamps are retained.
let database;
async function open() {
  if (!globalThis.indexedDB) return null;
  database ??= new Promise(resolve => {
    const request = indexedDB.open('fieldshift-evidence-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('responses', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return database;
}
export async function readCached(key, ttlMs) {
  try {
    const db = await open(); if (!db) return null;
    return await new Promise(resolve => {
      const request = db.transaction('responses').objectStore('responses').get(key);
      request.onsuccess = () => resolve(request.result && Date.now() - request.result.storedAt < ttlMs ? request.result : null);
      request.onerror = () => resolve(null);
    });
  } catch { return null; }
}
export async function writeCached(key, data, retrievedAt) {
  try {
    const db = await open(); if (!db) return;
    const transaction = db.transaction('responses', 'readwrite'), store = transaction.objectStore('responses');
    store.put({ key, data, retrievedAt, storedAt: Date.now() });
    const count = store.count();
    count.onsuccess = () => {
      let extra = count.result - 80;
      if (extra <= 0) return;
      const cursor = store.openCursor();
      cursor.onsuccess = () => { const entry = cursor.result; if (entry && extra-- > 0) { entry.delete(); entry.continue(); } };
    };
  } catch { /* Caching is optional; source retrieval can still succeed. */ }
}
