let worker, sequence = 0;
const pending = new Map();
export function getTransport() {
  return globalThis.document?.querySelector?.('meta[name="fieldshift-transport"]')?.content ?? 'worker';
}

async function httpApi(path, { method, body, signal }) {
  const response = await fetch(path, { method, signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The Node.js API returned an unreadable response. Check the local server.'); }
  if (!response.ok) throw new Error(data?.error?.message ?? `The Node.js API returned HTTP ${response.status}.`);
  return data;
}

export function api(path, { method = 'GET', body, signal } = {}) {
  if (getTransport() === 'http') return httpApi(path, { method, body, signal });
  if (!worker) {
    worker = new Worker('/js/lib/core-worker.bundle.js', { type: 'module' });
    worker.onmessage = event => {
      const task = pending.get(event.data.id);
      if (!task) return;
      pending.delete(event.data.id);
      if (event.data.error) task.reject(new Error(event.data.error)); else task.resolve(event.data.data);
    };
    worker.onerror = event => {
      event.preventDefault();
      pending.forEach(task => task.reject(new Error('The browser data worker could not start. Rebuild the static app and reload.')));
      pending.clear(); worker.terminate(); worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const cancel = () => { pending.delete(id); reject(new DOMException('Cancelled', 'AbortError')); };
    if (signal?.aborted) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    const cleanup = () => signal?.removeEventListener('abort', cancel);
    pending.set(id, { resolve: data => { cleanup(); resolve(data); }, reject: error => { cleanup(); reject(error); } });
    worker.postMessage({ id, path, method, body });
  });
}
