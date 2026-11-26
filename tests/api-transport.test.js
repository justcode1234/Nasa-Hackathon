import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { api, getTransport, NO_ANSWER } from '../public/js/lib/api.js';

// public/js/lib/api.js keeps its worker in a module-level variable, so every worker-mode case in this file
// shares one fake and reads the reply from the variable below at the moment its request is posted.
let workerReply = {};
function workerMode(t) {
  const originalDocument = globalThis.document, originalWorker = globalThis.Worker;
  globalThis.document = { querySelector: () => ({ content: 'worker' }) };
  globalThis.Worker = class {
    postMessage(message) { queueMicrotask(() => this.onmessage({ data: { id: message.id, ...workerReply } })); }
    terminate() {}
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker;
  });
}

function captureWarnings(t) {
  const lines = [];
  t.mock.method(console, 'warn', (...args) => { lines.push(args.join(' ')); });
  return lines;
}

const rejected = async promise => promise.then(() => { throw new Error('expected the request to fail'); }, error => error);

function nodeMode(t) {
  const original = globalThis.document;
  globalThis.document = { querySelector: () => ({ content: 'http' }) };
  t.after(() => { if (original === undefined) delete globalThis.document; else globalThis.document = original; });
}

test('explicit Node transport sends form inputs as JSON and preserves abort signals', async t => {
  nodeMode(t);
  const controller = new AbortController();
  let received;
  t.mock.method(globalThis, 'fetch', async (path, init) => { received = { path, init }; return { ok: true, json: async () => ({ result: 'TEST contract' }) }; });
  const body = { baseline: ['TEST'] };
  assert.deepEqual(await api('/api/compare', { method: 'POST', body, signal: controller.signal }), { result: 'TEST contract' });
  assert.equal(received.path, '/api/compare');
  assert.equal(received.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(received.init.body), body);
  assert.equal(received.init.signal, controller.signal);
});

test('Node transport exposes provider errors and never treats unreadable responses as successful evidence', async t => {
  nodeMode(t);
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 502, json: async () => ({ error: { message: 'TEST NASA unavailable' } }) }));
  await assert.rejects(api('/api/observations'), /TEST NASA unavailable/);
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => { throw new Error('TEST invalid JSON'); } }));
  await assert.rejects(api('/api/observations'), /unreadable response/);
});

test('browser showcase defaults to worker transport without probing an absent backend', () => {
  assert.equal(getTransport(), 'worker');
});

test("a worker failure with no status behind it never carries the runtime's own words to the page", async t => {
  const warnings = captureWarnings(t);
  workerMode(t);
  workerReply = { error: "Cannot read properties of undefined (reading 'mean')" };
  const error = await rejected(api('/api/soil'));
  assert.equal(error.message, NO_ANSWER);
  assert.ok(!/reading 'mean'|undefined/.test(error.message), `a runtime sentence reached farmer-facing text: ${error.message}`);
  assert.equal(error.cause.message, "Cannot read properties of undefined (reading 'mean')", 'the reason must stay diagnosable');
  assert.match(warnings.join('\n'), /request ended with no status/);
});

test('a worker failure that does carry a status keeps the sentence the server wrote', async t => {
  workerMode(t);
  workerReply = { error: 'The field lookup services are busy or unavailable (3 attempts across 3 services). No fields were invented. Retry the field search.',
    status: 502, code: 'FIELDS_UNAVAILABLE' };
  assert.equal((await rejected(api('/api/farms?country=KE'))).message,
    'The field lookup services are busy or unavailable (3 attempts across 3 services). No fields were invented. Retry the field search.');
});

test('a dropped request reads the same sentence the worker transport reads for the same class', async t => {
  nodeMode(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  assert.equal((await rejected(api('/api/farms?country=KE'))).message, NO_ANSWER);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError("Failed to execute 'fetch' on 'Window': Failed to parse URL from https://["); });
  assert.equal((await rejected(api('https://['))).message, NO_ANSWER);
});

test('a cancellation the page asked for carries that fact and not only the runtime name', async t => {
  nodeMode(t);
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('The user aborted a request.', 'AbortError'); });
  const error = await rejected(api('/api/ask', { method: 'POST', body: {}, signal: controller.signal }));
  assert.equal(error.cancelled, true, 'a cancel this app requested has to be identifiable without reading a name');
  assert.equal(error.name, 'AbortError', 'the runtime name is kept for anything that inspects it, never used to decide');
});

test('a failure the runtime calls AbortError that the page did not ask for is announced', async t => {
  nodeMode(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('The user aborted a request.', 'AbortError'); });
  const error = await rejected(api('/api/ask', { method: 'POST', body: {}, signal: new AbortController().signal }));
  assert.equal(error.cancelled, undefined, 'nothing cancelled this request, so no caller may treat it as cancelled');
  assert.equal(error.message, NO_ANSWER, 'the farmer reads a sentence here; the old name check reached four silences');
});

test('the worker path marks its own cancellation the way the HTTP path does', async t => {
  workerMode(t);
  const controller = new AbortController();
  controller.abort();
  const error = await rejected(api('/api/soil', { signal: controller.signal }));
  assert.equal(error.cancelled, true, 'the cancel this module issues is the one fact its callers can act on');
});

test('no page module decides farmer-visible silence from an error name', async () => {
  const files = ['public/js/lib/api.js', 'public/js/modules/chat.js', 'public/js/app.js', 'public/js/modules/workflow-assistant.js'];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.ok(!/name\s*[!=]==\s*'AbortError'/.test(source), `${file} still branches on the runtime's error name`);
  }
  for (const file of files.slice(1)) {
    assert.match(await readFile(file, 'utf8'), /\.cancelled\b/, `${file} must branch on the fact the transport sets`);
  }
});

test('the worker forwards the status that lets the page tell authored text from runtime text', async () => {
  assert.match(await readFile('public/js/lib/core-worker-entry.js', 'utf8'), /status: error\.status/,
    'without the status field every worker failure looks unlabelled');
});

// Measured 20 Nov: `if (!response.ok) throw new Error(data?.error?.message ?? …)` kept the sentence and threw the two
// facts that say what to do next away with it. The server ships `{ error: { code, message } }` (server/index.js:71)
// and the worker posts `{ error, code, status }` (public/js/lib/core-worker-entry.js:9), so both halves of the
// identity are already on the wire — a page that cannot see them has to guess between "the list could not be read"
// and "the list arrived unreadable", which is the difference between offering a retry and offering a dead end.
test('an authored HTTP failure keeps the status and code the server sent beside its sentence', async t => {
  nodeMode(t);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503,
    json: async () => ({ error: { code: 'LOCATIONS_UNAVAILABLE', message: 'The saved town list could not load. Retry the country selection, search a place or use the map.' } }) }));
  const error = await rejected(api('/api/locations?country=PH'));
  assert.equal(error.message, 'The saved town list could not load. Retry the country selection, search a place or use the map.');
  assert.equal(error.status, 503, 'the page has to be able to tell a refusal from a success');
  assert.equal(error.code, 'LOCATIONS_UNAVAILABLE', 'and which authored refusal it was');
});

test('an authored worker failure keeps the same two facts the HTTP transport carries', async t => {
  workerMode(t);
  workerReply = { error: 'The saved town list has an invalid source format. Use place search or coordinates.',
    status: 503, code: 'LOCATIONS_SCHEMA' };
  const error = await rejected(api('/api/locations?country=PH'));
  assert.equal(error.message, 'The saved town list has an invalid source format. Use place search or coordinates.');
  assert.equal(error.status, 503);
  assert.equal(error.code, 'LOCATIONS_SCHEMA', 'a code the page may branch on has to arrive on both transports or neither');
});

test('a failure with no status behind it borrows no authored identity', async t => {
  const warnings = captureWarnings(t);
  workerMode(t);
  // This is what a throw that is not an AppError looks like out of the worker: the entry labels it CLIENT_ERROR and
  // there is no status, so accepting the code would dress a runtime exception in an app-authored case name.
  workerReply = { error: "Cannot read properties of undefined (reading 'places')", code: 'CLIENT_ERROR' };
  const error = await rejected(api('/api/locations?country=PH'));
  assert.equal(error.message, NO_ANSWER);
  assert.equal(error.status, undefined, 'no status was observed, so none may be claimed');
  assert.equal(error.code, undefined, 'an unlabelled failure must not read as a coded one');
  assert.match(warnings.join('\n'), /request ended with no status/);
});

test('caller cancellation while the HTTP response body is being read stays cancellation', async t => {
  nodeMode(t);
  const controller = new AbortController();
  let markReading;
  const reading = new Promise(resolve => { markReading = resolve; });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    json: () => {
      markReading();
      return new Promise((resolve, reject) => controller.signal.addEventListener('abort',
        () => reject(new DOMException('The user aborted a request.', 'AbortError')), { once: true }));
    } }));
  const pending = rejected(api('/api/ask', { method: 'POST', body: { question: 'Where is the rain?' }, signal: controller.signal }));
  await reading;
  controller.abort();
  const error = await pending;
  assert.equal(error.cancelled, true, 'the caller cancelled while the body was in flight');
  assert.equal(error.name, 'AbortError');
});

test('an unexpected AbortError while reading the HTTP body is still an unreadable response', async t => {
  nodeMode(t);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    json: async () => { throw new DOMException('runtime abort nobody asked for', 'AbortError'); } }));
  const error = await rejected(api('/api/ask', { signal: new AbortController().signal }));
  assert.equal(error.cancelled, undefined, 'the runtime name must not borrow the caller cancellation fact');
  assert.match(error.message, /unreadable response/);
});

test('a cancelled worker request ignores its late reply and leaves the next request usable', async t => {
  const originalDocument = globalThis.document, originalWorker = globalThis.Worker;
  let instance;
  globalThis.document = { querySelector: () => ({ content: 'worker' }) };
  globalThis.Worker = class {
    constructor() { instance = this; this.messages = []; }
    postMessage(message) { this.messages.push(message); }
    terminate() {}
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker;
  });
  const { api } = await import('../public/js/lib/api.js?item12-late-reply');
  const controller = new AbortController();
  const first = api('/api/first', { signal: controller.signal });
  const firstId = instance.messages[0].id;
  controller.abort();
  const error = await rejected(first);
  assert.equal(error.cancelled, true);
  instance.onmessage({ data: { id: firstId, data: { late: true } } });
  const second = api('/api/second');
  const secondId = instance.messages[1].id;
  instance.onmessage({ data: { id: secondId, data: { fresh: true } } });
  assert.deepEqual(await second, { fresh: true });
  assert.equal(instance.messages.length, 2, 'the late reply must not create or resolve another request');
});

test('a worker constructor failure rejects with the authored sentence and the next call can retry', async t => {
  const warnings = captureWarnings(t);
  const originalDocument = globalThis.document, originalWorker = globalThis.Worker;
  let created = 0;
  globalThis.document = { querySelector: () => ({ content: 'worker' }) };
  globalThis.Worker = class {
    constructor() { created++; if (created === 1) throw new Error('synthetic worker start failure'); }
    postMessage(message) { queueMicrotask(() => this.onmessage({ data: { id: message.id, data: { ok: true } } })); }
    terminate() {}
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker;
  });
  const { api } = await import('../public/js/lib/api.js?item14-constructor');
  const error = await rejected(api('/api/first'));
  assert.equal(error.message, NO_ANSWER);
  assert.equal(error.cause.message, 'synthetic worker start failure');
  assert.deepEqual(await api('/api/second'), { ok: true });
  assert.equal(created, 2, 'the failed constructor must not poison the next request');
  assert.match(warnings.join('\n'), /request ended with no status/);
});

test('a synchronous worker postMessage failure clears pending work and the next call gets a fresh worker', async t => {
  const warnings = captureWarnings(t);
  const originalDocument = globalThis.document, originalWorker = globalThis.Worker;
  let created = 0;
  globalThis.document = { querySelector: () => ({ content: 'worker' }) };
  globalThis.Worker = class {
    constructor() { created++; }
    postMessage(message) {
      if (created === 1) throw new Error('synthetic postMessage failure');
      queueMicrotask(() => this.onmessage({ data: { id: message.id, data: { ok: true } } }));
    }
    terminate() {}
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker;
  });
  const { api } = await import('../public/js/lib/api.js?item14-post-message');
  const error = await rejected(api('/api/first'));
  assert.equal(error.message, NO_ANSWER);
  assert.equal(error.cause.message, 'synthetic postMessage failure');
  assert.deepEqual(await api('/api/second'), { ok: true });
  assert.equal(created, 2, 'the worker that could not accept a message must be terminated and replaced');
  assert.match(warnings.join('\n'), /request ended with no status/);
});

test('a worker crash rejects pending work, resets the worker, and lets the next request recover', async t => {
  const originalDocument = globalThis.document, originalWorker = globalThis.Worker;
  const instances = [];
  globalThis.document = { querySelector: () => ({ content: 'worker' }) };
  globalThis.Worker = class {
    constructor() { instances.push(this); }
    postMessage(message) { this.message = message; }
    terminate() { this.terminated = true; }
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker;
  });
  const { api } = await import('../public/js/lib/api.js?item15-worker-crash');
  const first = api('/api/first');
  let prevented = false;
  instances[0].onerror({ preventDefault() { prevented = true; } });
  const error = await rejected(first);
  assert.match(error.message, /worker could not start/);
  assert.equal(prevented, true);
  assert.equal(instances[0].terminated, true);
  const second = api('/api/second');
  instances[1].onmessage({ data: { id: instances[1].message.id, data: { fresh: true } } });
  assert.deepEqual(await second, { fresh: true });
  assert.equal(instances.length, 2);
});
