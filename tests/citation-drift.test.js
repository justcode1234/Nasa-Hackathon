import test from 'node:test';
import assert from 'node:assert/strict';
import { citationsFromLine, comparePair } from '../scripts/citation-drift.mjs';

test('the drift scout ignores clock times, URL ports and file:line:column triples', () => {
  const line = 'see public/js/modules/chat.js:96 at 16:14:59Z and :99; ' +
    'tests/e2e/place-list-refused.spec.js:224:3 and http://127.0.0.1:4173/x';
  assert.deepEqual(citationsFromLine(line), [
    { file: 'public/js/modules/chat.js', from: 96, to: 96 },
    { file: 'public/js/modules/chat.js', from: 99, to: 99 },
  ]);
});

test('a bare continuation cannot cross a sentence or inherit past a bare filename citation', () => {
  const line = 'see public/js/lib/api.js:8 over HTTP, workflow-assistant.js:341 on the guided turn. :328 reports; :35 stays unrelated';
  assert.deepEqual(citationsFromLine(line), [
    { file: 'public/js/lib/api.js', from: 8, to: 8 },
  ]);
});

test('the drift scout keeps a real citation range as one band', () => {
  assert.deepEqual(citationsFromLine('public/js/modules/chat.js:96-99'), [
    { file: 'public/js/modules/chat.js', from: 96, to: 99 },
  ]);
});

test('a blank or missing pair is unreadable, never a clean comparison', () => {
  assert.equal(comparePair('', '').kind, 'unreadable');
  assert.equal(comparePair(undefined, 'statement').kind, 'unreadable');
  assert.equal(comparePair('statement', undefined).kind, 'unreadable');
  assert.equal(comparePair('  statement  ', 'statement').kind, 'same');
  assert.equal(comparePair('statement', 'neighbour').kind, 'drift');
});
