let worker, sequence = 0;
const pending = new Map();
export function getTransport() {
  return globalThis.document?.querySelector?.('meta[name="fieldshift-transport"]')?.content ?? 'worker';
}

async function httpApi(path, { method, body, signal }) {
  const response = await fetch(path, { method, signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }).catch(reason => { throw unlabelled(reason, signal); });
  let data;
  try { data = await response.json(); }
  catch (reason) { if (signal?.aborted === true) throw cancellation(); throw new Error('The Node.js API returned an unreadable response. Check the local server.', { cause: reason instanceof Error ? reason : new Error(String(reason?.message ?? reason)) }); }
  if (!response.ok) throw identified(new Error(data?.error?.message ?? `The Node.js API returned HTTP ${response.status}.`), response.status, data?.error?.code);
  return data;
}

export function api(path, { method = 'GET', body, signal } = {}) {
  if (getTransport() === 'http') return httpApi(path, { method, body, signal });
  if (!worker) {
    try { worker = new Worker('/js/lib/core-worker.bundle.js', { type: 'module' }); } catch (reason) { return Promise.reject(signal?.aborted === true ? cancellation() : unlabelled(reason)); }
    worker.onmessage = event => {
      const task = pending.get(event.data.id);
      if (!task) return;
      pending.delete(event.data.id);
      if (event.data.error) task.reject(workerFailure(event.data)); else task.resolve(event.data.data);
    };
    worker.onerror = event => {
      event.preventDefault();
      pending.forEach(task => task.reject(new Error('The browser data worker could not start. Rebuild the static app and reload.')));
      pending.clear(); worker.terminate(); worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const cancel = () => { pending.delete(id); reject(cancellation()); };
    if (signal?.aborted) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    const cleanup = () => signal?.removeEventListener('abort', cancel);
    pending.set(id, { resolve: data => { cleanup(); resolve(data); }, reject: error => { cleanup(); reject(error); } });
    try { worker.postMessage({ id, path, method, body }); } catch (reason) { pending.delete(id); cleanup(); reject(unlabelled(reason)); worker.terminate(); worker = null; }
  });
}

// A failure with no HTTP status behind it has no authored sentence, so neither transport may forward the
// runtime's own words: server/index.js:71 replaces a 500 the same way, and tests/context.test.js:164 already
// bans a transport detail one layer down. The reason stays on `cause` and in the console, and every AppError
// sentence (a 400 validation, a 502/503 upstream) carries a status and passes through untouched.
export const NO_ANSWER = 'No answer came back for this request. Nothing was invented in its place. Try again.';
export function cancellation(message = 'Cancelled') {
  // Consumers go silent on `cancelled`, so only the code that asked for the stop may set it. The runtime name
  // rides along: this is what a browser throws by itself, and tests/workflow-assistant.test.js:331 asserts it.
  const error = new DOMException(message, 'AbortError'); error.cancelled = true; return error;
}
function unlabelled(reason, signal) {
  // The caller's own signal decides, not the error name: an AbortError nobody asked for is a failure to report.
  if (signal?.aborted === true) return cancellation();
  console.warn('[fieldshift] request ended with no status:', reason?.message ?? reason);
  return new Error(NO_ANSWER, { cause: reason instanceof Error ? reason : new Error(String(reason?.message ?? reason)) });
}
function identified(error, status, code) {
  // Both halves travel together or not at all. A status is what says the sentence came from this app rather than
  // from a runtime, and the code says which authored case it was — a 503 whose list could not be read is retried,
  // a 503 whose format is unreadable is not. A failure with no status is unlabelled, so it borrows no code.
  if (typeof status !== 'number') return error;
  error.status = status;
  if (typeof code === 'string') error.code = code;
  return error;
}
function workerFailure(data) {
  return typeof data.status === 'number' ? identified(new Error(data.error), data.status, data.code) : unlabelled(new Error(data.error));
}
