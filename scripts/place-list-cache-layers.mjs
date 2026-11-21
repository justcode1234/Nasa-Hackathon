// Iteration 71, goal F2: which of the three place-list caches answers which read, on each transport?
//
// The app holds three country-keyed caches in front of the same saved place list:
//   1. public/js/modules/location-picker.js:6   - step 1's list body, filled only on a successful read;
//   2. public/js/modules/workflow-assistant.js:284 - the chat's own copy, same rule;
//   3. server/context/locations.js:9             - the location client, which runs twice over: inside the Node process,
//      and bundled into the static service worker, where it is in front of the worker's own file reads.
// A page-side route can refuse 1 and 2's transport on Node because every one of those calls is an HTTP request. On the
// static transport the page's `/api/locations` never becomes a network request the route can see, so the only refusables
// are the worker's `/data/locations/...` reads - and once the worker has resolved a country, its own Map answers from
// memory and no page-side route can make a later read fail for that country.
//
// This instrument walks the one sequence where that difference changes what a test can arm: a first read that is refused,
// a chat-level retry that succeeds, then a tapped region whose reply depends on whether a list read is still reachable.
// It logs every list-shaped request with the step that made it, plus the step-1 dropdown state on both sides of the tap,
// so the reading names the layer instead of inferring it from a reply.
//
// Run with the two preview servers up - `node scripts/playwright-server.js` and the same with `--node`:
//   node scripts/place-list-cache-layers.mjs static|node
import { chromium } from '@playwright/test';
import { createLocationClient } from '../server/context/locations.js';

const mode = process.argv[2] ?? 'static';
const staticPort = Number(process.env.E2E_PORT ?? 4173);
const base = `http://127.0.0.1:${mode === 'node' ? Number(process.env.E2E_PORT_NODE ?? staticPort + 1) : staticPort}`;
const lists = /\/api\/locations\?|\/data\/locations\//;
const COUNTRY = 'Bermuda', REGION = 'Hamilton city';

// The refusal is taken from the adapter that writes it, the way scripts/place-tap-rejection-probe.mjs and
// tests/e2e/place-list-refused.spec.js do, so a page-side failure here reads the same on both transports as the sentence
// the shipped server sends. A typed body made the two columns incomparable.
const authored = await (async () => {
  const error = await createLocationClient({ readJson: async () => { throw new Error('probe: armed refusal'); } })({ country: 'BM' })
    .then(() => null, reason => reason);
  if (!error || error.status !== 503 || error.code !== 'LOCATIONS_UNAVAILABLE') {
    throw new Error(`cannot arm a saved-list failure (${error ? `${error.status}/${error.code}` : 'the reader was expected to fail and did not'})`);
  }
  return { status: error.status, body: { error: { code: error.code, message: error.message } } };
})();

let step = 'boot';
const observed = [];
const armed = () => step !== 'retry';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.route(lists, async route => {
  const path = route.request().url().replace(/^https?:\/\/[^/]+/, '');
  observed.push(`${step} ${path}`);
  if (!armed()) return route.continue();
  // The two transports fail differently where they are reachable: the API boundary answers with the shape
  // server/index.js writes, a worker-side file read has no status to give and fails as a transport failure.
  if (path.includes('/api/locations')) return route.fulfill({ ...authored, contentType: 'application/json', body: JSON.stringify(authored.body) });
  return route.abort('failed');
});
const settled = async () => { await page.waitForFunction(() =>
  /Answer ready|Step 4 is ready|Error|came back|unavailable|could not|not reachable|invalid source|Choose a region/i.test(document.getElementById('answer-status')?.textContent ?? ''), null, { timeout: 90_000 }); };
const tap = async label => { const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]')
  .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  if (!await button.count()) { console.log(`ABORT no "${label}" button was offered`); await browser.close(); process.exit(2); }
  await button.click(); await settled(); };
const reply = async () => (await page.locator('#chat-history article').last().evaluate(node =>
  [...node.querySelectorAll(':scope > p')].map(p => p.textContent).join(' '))).trim().slice(0, 120);
const mark = section => { console.log(`${section}_OBSERVED ${observed.length} [${observed.join(' , ')}]`); observed.length = 0; };
const form = async () => `value="${await page.locator('#place-region').evaluate(node => node.value)}" ` +
  `options="${(await page.locator('#place-region').evaluate(node => [...node.options].map(option => option.textContent).join('/'))).slice(0, 90)}" ` +
  `towns=${await page.locator('#place-town option').count()} status="${(await page.locator('#location-list-status').textContent()).trim().slice(0, 70)}"`;

console.log(`MODE ${mode} BASE ${base} STEP1_PICKER_CACHE=location-picker.js:6 CHAT_CACHE=workflow-assistant.js:284 TRANSPORT_CACHE=locations.js:9`);
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Open FieldShift assistant', exact: true }).click();
step = 'sentence';
await page.locator('#question').fill(`Help me plan a rotation in ${COUNTRY}`);
await page.getByRole('button', { name: 'Send', exact: true }).click(); await settled();
await tap('A specific area');
mark('SENTENCE');
console.log(`SENTENCE_REPLY ${await reply()}`);
console.log(`SENTENCE_FORM ${await form()}`);

step = 'retry';
await tap('Try the place list again');
mark('RETRY');
console.log(`RETRY_BUTTONS ${(await page.locator('#chat-history article').last().locator('button[data-choice-type="region"]').allTextContents()).map(t => t.trim()).join(' | ')}`);
console.log(`RETRY_FORM ${await form()}`);

step = 'tap';
await tap(REGION);
const tapReads = observed.length;
mark('TAP');
console.log(`TAP_STATUS ${(await page.locator('#answer-status').textContent()).trim()}`);
console.log(`TAP_REPLY ${await reply()}`);
console.log(`TAP_FORM ${await form()}`);
console.log(`TAP_LAT "${await page.locator('#latitude').inputValue()}"`);
console.log(`LAYER_VERDICT ${mode} tap_answered=${(await page.locator('#chat-history article').last().locator('h3').first().textContent()).trim() === 'Assistant'} tap_reads=${tapReads}`);
console.log(`PAGEERRORS ${errors.length} ${errors.slice(0, 2).join(' | ')}`);
console.log('PLACE_LIST_CACHE_LAYERS_DONE');
await browser.close();
