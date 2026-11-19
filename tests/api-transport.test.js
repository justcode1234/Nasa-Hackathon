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
