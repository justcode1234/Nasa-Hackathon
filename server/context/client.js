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
      let response, signal, answered = false, responseStatus;
      try {
        const identityHeaders = globalThis.process?.versions?.node ? { 'User-Agent': USER_AGENT } : {};
        signal = AbortSignal.timeout(timeoutMs); response = await fetchImpl(url, { headers: { Accept: 'application/json', ...identityHeaders, ...headers }, signal });
        answered = true; responseStatus = response.status; if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const retrievedAt = new Date().toISOString();
        if (data && typeof data === 'object') Object.defineProperty(data, '_fieldshiftRetrievedAt', { value: retrievedAt });
        await writeCached(key, data, retrievedAt);
        cache.set(key, { data, time: Date.now() });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        return data;
      } catch (error) {
        // Three facts a caller can act on, each taken from what this client observed instead of from the words a failure
        // arrives in: `answered` means a response arrived whatever it held, `responseStatus` is the status line it
        // carried and `slow` means the deadline on this request's own AbortSignal expired. The farmland hedge
        // (context/farms.js) retries an answer and a deadline and drops a host that never received the request.
        // The sentence a farmer reads cannot carry the reason: the reason is whatever the runtime calls its own
        // transport failure, so one condition read "(fetch failed)" in Node, "(signal timed out)" in a Chromium
        // worker and "(Failed to fetch)" on 18 Nov, and server/index.js:71 forwards this text verbatim. The reason
        // stays on the error for the log instead, where a reader can act on it.
        const wrapped = new AppError('The external context service could not respond. No records were invented. Try again later.', 502, 'CONTEXT_UNAVAILABLE');
        wrapped.cause = error;
        wrapped.answered = answered; wrapped.responseStatus = responseStatus;
        wrapped.slow = signal?.aborted === true; // this request's own timer is the only witness to its deadline
        throw error instanceof AppError ? error : wrapped; // a refusal this app authored already names its cause and carries the status the page acts on; wrapping it blamed a service 0 requests were sent to
      }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
