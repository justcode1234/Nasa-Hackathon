import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { modelFailureStatus, speechFailureStatus } from '../public/js/lib/model-failure.js';

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
  assert.match(lines[5], /^import \{ modelFailureStatus \} from '\.\.\/lib\/model-failure\.js';$/);
  assert.ok(!lines.join('\n').includes('Model could not start on this device'), 'the device sentence is still in chat.js');
});

// Iteration 73 (F16): the same two defects on the other panel that loads a model. These four texts are copied out of
// `artifacts/scratch/iter73/speech-error-capture.mjs`, archived as `docs/evidence/iter73-capture-node-pre-2026-11-21.log.gz`
// and its static twin; byte-identical except that the leaked origin names its own port (static 127.0.0.1:4173, node 4174).
// `public/js/modules/stt-worker.js:46` posts `error?.message ?? String(error)`, so these are what a farmer was shown.
const HUB_MISSING = 'Failed to fetch';
const WASM_RUNTIME = "no available backend found. ERR: [wasm] RuntimeError: Aborted(NetworkError: Failed to execute 'send' on 'XMLHttpRequest': Failed to load 'http://127.0.0.1:4173/vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm'.). Build with -sASSERTIONS for more info.";
const CONFIG_JSON = `Unexpected token '<', "<html>defi"... is not valid JSON`;
const ONNX_PROTOBUF = "Can't create a session. ERROR_CODE: 7, ERROR_MESSAGE: Failed to load model because protobuf parsing failed.";
const SPEECH_RECOVERY = 'Typing works as usual. Press the microphone button to try again.';
const speech = texts => texts.map(text => speechFailureStatus(text));

test('the dictation panel classifies the same texts without echoing any of them', () => {
  assert.deepEqual(speech([HUB_MISSING, WASM_RUNTIME, CONFIG_JSON, ONNX_PROTOBUF]), [
    `Voice input unavailable because a model file did not arrive. ${SPEECH_RECOVERY}`,
    `Voice input unavailable because its runtime did not arrive. ${SPEECH_RECOVERY}`,
    `Voice input unavailable because a model file arrived unreadable. ${SPEECH_RECOVERY}`,
    `Voice input unavailable because a model file arrived unreadable. ${SPEECH_RECOVERY}`,
  ]);
});

test('a corrupt model binary is not called a missing runtime', () => {
  // The ordering case. ONNX phrases an unreadable model file as `Failed to load model because protobuf parsing failed`,
  // whose `Failed to load` matches the runtime pattern too; read in the wrong order it would tell the farmer the engine
  // never arrived when the engine is what reported the bad file.
  assert.match(speechFailureStatus(ONNX_PROTOBUF), /arrived unreadable/);
  assert.doesNotMatch(speechFailureStatus(ONNX_PROTOBUF), /runtime/);
});

test('the dictation arms that report nothing claim no cause and stop blaming the device', () => {
  // Measured: blocking the worker script or the vendored runtime leaves `event.message`, `event.filename` and
  // `event.lineno` all null, which is the only case where the panel knows nothing beyond the load having failed.
  for (const message of [null, undefined, '', '   ']) {
    assert.equal(speechFailureStatus(message), `Voice input unavailable. ${SPEECH_RECOVERY}`);
  }
  assert.ok(!/on this device/.test(speechFailureStatus(null)));
});

test('no dictation branch leaks an origin, a path, a response body or an engine code', () => {
  const leaks = ['http', '127.0.0.1', '/vendor/', '.wasm', '.json', '.onnx', 'onnxruntime', 'xmlhttprequest', 'assertions', 'error_code', 'protobuf', 'html', '<', 'runtimeerror'];
  for (const message of [HUB_MISSING, WASM_RUNTIME, CONFIG_JSON, ONNX_PROTOBUF, 'NetworkError when attempting to fetch resource.', null]) {
    const status = speechFailureStatus(message);
    for (const leak of leaks) {
      assert.ok(!status.toLowerCase().includes(leak), `${JSON.stringify(message)} leaked ${JSON.stringify(leak)} into ${JSON.stringify(status)}`);
    }
    assert.ok(!/\.\.\s/.test(status), `a period was doubled by interpolation in ${status}`);
  }
});

test('the microphone button the recovery clause names is the control the page shows', async () => {
  const html = await readFile('public/index.html', 'utf8');
  assert.match(html, /<button id="mic" class="mic" type="button" aria-pressed="false" aria-label="Dictate a message in English">/);
});

test('speech.js routes both failure paths through the classifier and echoes nothing', async () => {
  const lines = (await readFile('public/js/modules/speech.js', 'utf8')).split('\n');
  // Line-number pins, and the file is 154 lines both before and after this repair: the import replaced the blank line
  // under it rather than being inserted, so `:72` and `:74` still land on the statements the ledger quotes.
  assert.match(lines[6], /^import \{ speechFailureStatus \} from '\.\.\/lib\/model-failure\.js';$/);
  assert.match(lines[71], /unload\(speechFailureStatus\(data\.message\)\)/);
  assert.match(lines[73], /unload\(speechFailureStatus\(event\.message\)\)/);
  const source = lines.join('\n');
  assert.ok(!source.includes('The speech model could not start on this device'), 'the device sentence is still in speech.js');
  assert.ok(!/Voice input unavailable: \$\{/.test(source), 'speech.js still interpolates the worker text');
});
