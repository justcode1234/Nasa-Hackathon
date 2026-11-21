import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { modelFailureStatus } from '../public/js/lib/model-failure.js';

// Iteration 72. Every string below is copied out of the capture run recorded in docs/evidence/, not written by hand:
// `public/js/modules/mini-lm-worker.js:59` posts `error.message`, so these are the texts a farmer's panel really receives.
// The sentence this function returns is the product, so the cases assert the whole string rather than a fragment - a
// reworded cause clause has to be an intentional edit with the page case moved beside it.
const RUNTIME = "Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js' failed to load.";
const MISSING = 'Failed to fetch';
const MODEL_JSON = 'Failed to parse model JSON of response from /models/fieldshift-mini/model.json. Please make sure the server is serving valid JSON for this request.';
const TOKENIZER_JSON = `Unexpected token '<', "<html>not "... is not valid JSON`;
// The two validation harnesses (scripts/firefox-validation.js:63, scripts/browser-validation.js:287) wait on this
// substring, so no branch may drop it.
const HARNESS_PHRASE = 'could not';
const RECOVERY = 'Evidence chat still works. Press Enable compact local model to try again.';

test('a runtime that never arrives is named as a runtime, not as the farmer hardware', () => {
  assert.equal(modelFailureStatus(RUNTIME), `Model could not start because its runtime did not arrive. ${RECOVERY}`);
});

test('a model file that never arrives is named as a file, and says nothing about the device', () => {
  assert.equal(modelFailureStatus(MISSING), `Model could not start because a model file did not arrive. ${RECOVERY}`);
});

test('a model file that arrives unreadable is separated from one that never arrives', () => {
  assert.equal(modelFailureStatus(MODEL_JSON), `Model could not start because a model file arrived unreadable. ${RECOVERY}`);
  assert.equal(modelFailureStatus(TOKENIZER_JSON), `Model could not start because a model file arrived unreadable. ${RECOVERY}`);
});

test('the null error event gets the sentence that claims no cause', () => {
  // Measured: blocking /js/modules/mini-lm-worker.js leaves event.message, event.filename and event.lineno all null, so
  // the panel knows a load failed and nothing about why.
  assert.equal(modelFailureStatus(null), `Model could not start. ${RECOVERY}`);
  assert.equal(modelFailureStatus(undefined), `Model could not start. ${RECOVERY}`);
  assert.equal(modelFailureStatus(''), `Model could not start. ${RECOVERY}`);
  assert.equal(modelFailureStatus('   '), `Model could not start. ${RECOVERY}`);
});

test('an unmapped wording falls back instead of inventing a cause', () => {
  // Firefox phrases the same abort as `NetworkError when attempting to fetch resource.`; this branch maps no text it has
  // not measured on this branch, so that engine's phrasing lands on the cause-free sentence.
  assert.equal(modelFailureStatus('NetworkError when attempting to fetch resource.'), `Model could not start. ${RECOVERY}`);
});

test('no branch repeats any part of the worker text, so no host or path reaches the panel', () => {
  const leaks = ['jsdelivr', 'cdn', 'http', 'importScripts', 'WorkerGlobalScope', '/models/', 'model.json', 'tokenizer',
    'html', 'tensorflow'];
  for (const message of [RUNTIME, MISSING, MODEL_JSON, TOKENIZER_JSON, 'NetworkError when attempting to fetch resource.', null]) {
    const status = modelFailureStatus(message);
    for (const leak of leaks) {
      assert.ok(!status.toLowerCase().includes(leak), `${JSON.stringify(message)} leaked ${JSON.stringify(leak)} into ${JSON.stringify(status)}`);
    }
  }
});

test('every branch keeps the phrase the browser harnesses wait on and offers the retry', () => {
  for (const message of [RUNTIME, MISSING, MODEL_JSON, TOKENIZER_JSON, null, 42, {}, ['a']]) {
    const status = modelFailureStatus(message);
    assert.ok(status.includes(HARNESS_PHRASE), `${JSON.stringify(message)} dropped "${HARNESS_PHRASE}"`);
    assert.ok(status.endsWith(RECOVERY), `${JSON.stringify(message)} dropped the recovery clause`);
    assert.ok(!/on this device/.test(status), `${JSON.stringify(message)} still blamed the device: ${status}`);
  }
});

test('the button this sentence names is the button the panel actually shows', async () => {
  // The recovery clause is only honest if the control exists with that label and is pressable after a failure; the page
  // case pins the enabled state, this pins the wording the sentence depends on.
  const html = await readFile('public/index.html', 'utf8');
  assert.match(html, /<button id="load-model" type="button">Enable compact local model<\/button>/);
});

test('chat.js routes both failure paths through the classifier and the device sentence is gone', async () => {
  const lines = (await readFile('public/js/modules/chat.js', 'utf8')).split('\n');
  // Line-number pins: these two lines moved once already (iteration 50 shipped its repair one-for-one to avoid moving 40
  // citations), so the sentences this pass quotes have to stay where the ledger says they are.
  assert.match(lines[62], /else \{ unload\(\); setStatus\(modelFailureStatus\(data\.message\)\); \}/);
  assert.match(lines[65], /worker\.onerror = event => \{ event\.preventDefault\(\); unload\(\); setStatus\(modelFailureStatus\(event\.message\)\); \}/);
  assert.match(lines[4], /import \{ modelFailureStatus \} from '\.\.\/lib\/model-failure\.js';/);
  assert.ok(!lines.join('\n').includes('Model could not start on this device'), 'the device sentence is still in chat.js');
});
