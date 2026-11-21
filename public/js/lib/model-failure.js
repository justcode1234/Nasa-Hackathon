// Iteration 72: the sentence the chat panel shows when the optional local model fails to start, chosen from what the
// worker actually reported.
//
// `public/js/modules/chat.js:63` used one sentence for every failure it was told about - "Model could not start on this
// device" - which is a claim about the farmer's hardware. Measured on both transports with
// `artifacts/scratch/iter72/model-error-capture.mjs`, `public/js/modules/mini-lm-worker.js:59` posts four distinct texts
// and one absence: a runtime script that did not arrive from the CDN, the bare `Failed to fetch` for a model file this
// app serves itself, tf's `Failed to parse model JSON of response from /models/fieldshift-mini/model.json...`, a
// tokenizer `Unexpected token '<', ... is not valid JSON`, and - when the worker script cannot load at all - an
// ErrorEvent whose `message`, `filename` and `lineno` are all null. Two of the four name this server, so the device
// sentence was wrong as well as unhelpful, and the null case is the only one where nothing at all was reported.
//
// Iteration 50 removed the raw text from this line because it put a CDN URL, an internal API name and a server-facing
// instruction in front of a farmer (`docs/validation.md` subsection 50), so the message is classified here and never
// quoted: no branch returns any part of its argument, which is what keeps a host or a path out of the panel. The
// generic sentence is the fallback for a text this table does not know, and it asserts nothing about where the fault is.
// `scripts/firefox-validation.js:63` and `scripts/browser-validation.js:287` both wait on the substring `could not`, so
// every branch keeps that phrase.
const FRAME = 'Model could not start';
const RECOVERY = 'Evidence chat still works. Press Enable compact local model to try again.';
// Ordered: the runtime text also ends in `failed to load`, so it is tested before the file-shape texts.
const CAUSES = [
  [/importScripts|failed to load/i, 'because its runtime did not arrive'],
  [/not valid JSON|Unexpected token|Failed to parse/i, 'because a model file arrived unreadable'],
  [/Failed to fetch/i, 'because a model file did not arrive'],
];

export function modelFailureStatus(message) {
  const text = typeof message === 'string' ? message : '';
  const cause = CAUSES.find(([pattern]) => pattern.test(text))?.[1];
  return cause ? `${FRAME} ${cause}. ${RECOVERY}` : `${FRAME}. ${RECOVERY}`;
}
