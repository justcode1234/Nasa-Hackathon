import test from 'node:test';
import assert from 'node:assert/strict';
import { api, getTransport } from '../public/js/lib/api.js';

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
