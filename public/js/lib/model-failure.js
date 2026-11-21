// Iterations 72 and 73: the sentence a panel shows when an optional local model fails to start, chosen from what the
// worker actually reported. Both panels that load a model on this app's own origin use this file - the chat's compact
// model (`public/js/modules/chat.js:63`) and dictation (`public/js/modules/speech.js:72`) - because both received the
// same two defects and both were repaired the same way.
//
// The defect, measured rather than assumed:
// - `artifacts/scratch/iter72/model-error-capture.mjs` found `mini-lm-worker.js:59` posting four distinct texts and one
//   absence, while chat.js answered all of them with "Model could not start on this device" - a claim about the farmer's
//   hardware, two of whose causes name this server.
// - `artifacts/scratch/iter73/speech-error-capture.mjs` found speech.js doing the opposite with the same texts: it
//   interpolated them (`Voice input unavailable: ${data.message}`), which put this server's own origin, an
//   `XMLHttpRequest` internals sentence, a JSON parse error quoting the HTML body it received, and an ONNX error code in
//   front of a farmer, and produced a doubled period ("...more info.. Typing works as usual."). Its two worker-level arms
//   (the vendored runtime blocked, the worker script blocked) then fell to `speech.js:74`, which quoted nothing and said
//   "on this device" with `event.message`, `event.filename` and `event.lineno` all null.
//
// Iteration 50 removed raw text from the chat line for the same reason (`docs/validation.md` subsection 50), so the
// message is classified here and never quoted: no branch returns any part of its argument, which is what keeps a host, a
// path or a response body out of the panel. Sentences are assembled from fixed clauses, so interpolation cannot produce
// a doubled period either. The frame-free sentence is the fallback for a text this table does not know, and it asserts
// nothing about where the fault is.
//
// `scripts/firefox-validation.js:63` and `scripts/browser-validation.js:287` wait on the substring `could not` in the
// chat panel, so every chat branch keeps that phrase; the dictation panel's own substrings are pinned by
// `tests/e2e/speech-microphone.spec.js`.
const CHAT_FRAME = 'Model could not start';
const CHAT_RECOVERY = 'Evidence chat still works. Press Enable compact local model to try again.';
const SPEECH_FRAME = 'Voice input unavailable';
const SPEECH_RECOVERY = 'Typing works as usual. Press the microphone button to try again.';
// Ordered most specific first, and the order is load-bearing. `onnx-community/whisper-tiny.en` answers a corrupt model
// binary with `Failed to load model because protobuf parsing failed`, whose `Failed to load` would otherwise be read as
// the runtime being missing when the file arrived and was unreadable - a different observed fact and a different repair.
const CAUSES = [
  [/not valid JSON|Unexpected token|Failed to parse|parsing failed|protobuf/i, 'because a model file arrived unreadable'],
  [/importScripts|no available backend found|dynamically imported module|failed to load/i, 'because its runtime did not arrive'],
  [/Failed to fetch/i, 'because a model file did not arrive'],
];

function classify(message, frame, recovery) {
  const text = typeof message === 'string' ? message : '';
  const cause = CAUSES.find(([pattern]) => pattern.test(text))?.[1];
  return cause ? `${frame} ${cause}. ${recovery}` : `${frame}. ${recovery}`;
}

export function modelFailureStatus(message) {
  return classify(message, CHAT_FRAME, CHAT_RECOVERY);
}

export function speechFailureStatus(message) {
  return classify(message, SPEECH_FRAME, SPEECH_RECOVERY);
}
