import { AppError } from '../errors.js';
import { readCached, writeCached } from '../persistence.js';

export const USER_AGENT = 'FieldShift/0.2 (NASA Space Apps educational crop-rotation prototype)';
export function createCachedJson({ fetchImpl = fetch, ttlMs = 86_400_000, maxEntries = 16 } = {}) {
  const cache = new Map(), pending = new Map();
  return async function request(url, { headers = {}, timeoutMs = 15_000 } = {}) {
    const key = String(url);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.time < ttlMs) return hit.data;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const saved = await readCached(key, ttlMs);
      if (saved) {
        Object.defineProperty(saved.data, '_fieldshiftRetrievedAt', { value: saved.retrievedAt });
        cache.set(key, { data: saved.data, time: saved.storedAt });
        return saved.data;
      }
      let response;
      try {
        const identityHeaders = globalThis.process?.versions?.node ? { 'User-Agent': USER_AGENT } : {};
        response = await fetchImpl(url, { headers: { Accept: 'application/json', ...identityHeaders, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const retrievedAt = new Date().toISOString();
        if (data && typeof data === 'object') Object.defineProperty(data, '_fieldshiftRetrievedAt', { value: retrievedAt });
        await writeCached(key, data, retrievedAt);
        cache.set(key, { data, time: Date.now() });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        return data;
      } catch (error) {
        throw new AppError(`The external context service could not respond (${error.message}). No records were invented. Try again later.`, 502, 'CONTEXT_UNAVAILABLE');
      }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
