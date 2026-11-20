// Iteration 62, goal 6: can a tapped place button be made to reject its send at all?
//
// Run with `npm run test:tap-rejection` (or `node scripts/place-tap-rejection-probe.mjs static|node`) while the two
// Playwright preview servers are up - `node scripts/playwright-server.js` and the same with `--node`, or any pair via
// E2E_PORT/E2E_PORT_NODE. It needs no live service: every request the walk can make is answered from the shipped data.
//
// Why this exists: public/js/modules/chat.js:93 clears the armed `workflowChoice` before the await and its catch at
// :154-157 restores the composer text but not the choice, so a tap that rejects is retried as a typed sentence.
// scripts/place-choice-loss-census.mjs measures what that costs; this instrument measures whether the page can trigger
// it. Two sections, one per tap, each arming a refusal for the single tap only so the retry runs against a service that
// has recovered:
//   A town tap  - refuses the saved lists, the reverse lookup, the field lookup, the country crop and water reads.
//   B region tap - drives the flow iteration 61 documented (both readers refuse, the chat recovers, the form did not
//                  re-read) and then refuses the list read `chooseRegion` performs at public/js/modules/context.js:248.
// The verdict is the status line plus whether an assistant reply was rendered: a rejection leaves the farmer's sentence
// in the composer and no reply, an answered tap clears it and replies.
import { chromium } from '@playwright/test';

const mode = process.argv[2] ?? 'static';
const staticPort = Number(process.env.E2E_PORT ?? 4173);
const base = `http://127.0.0.1:${mode === 'node' ? Number(process.env.E2E_PORT_NODE ?? staticPort + 1) : staticPort}`;
const lists = /\/api\/locations\?|\/data\/locations\//;
const reads = /\/api\/locations\?|\/data\/locations\/|\/api\/places\?|\/api\/farms\?|\/api\/country-crops\?|\/api\/water-context\?|nominatim\.openstreetmap\.org|overpass/;
// The Bermuda parish/capital pair, because the town and a differently numbered region share its spelling.
const COUNTRY = 'Bermuda', REGION = 'Hamilton city', TOWN = 'Hamilton';

let armed = null;
const counts = {};
const seen = new Set();
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.context().route(reads, async route => {
  const path = route.request().url().replace(/^https?:\/\/[^/]+/, '');
  if (!armed) return route.continue();
  counts[armed] = (counts[armed] ?? 0) + 1;
  seen.add(`${armed} ${path}`);
  // A worker-side read fails as a transport failure; the API-boundary read answers with the shape server/index.js writes.
  if (!path.includes('/api/locations')) return route.abort('failed');
  return route.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'LOCATIONS_UNAVAILABLE', message: 'Place list is busy or unavailable.' } }) });
});
const settled = async () => { await page.waitForFunction(() =>
  /Answer ready|Step 4 is ready|Error|came back|unavailable|could not|not reachable|invalid source|Choose a region/i.test(document.getElementById('answer-status')?.textContent ?? ''), null, { timeout: 90_000 }); };
const offered = async type => (await page.locator('#chat-history article').last().locator(`button[data-choice-type="${type}"]`).allTextContents()).map(t => t.trim());
const send = async question => { await page.locator('#question').fill(question); await page.getByRole('button', { name: 'Send', exact: true }).click(); await settled(); };
const tap = async label => {
  const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]')
    .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  if (!await button.count()) { console.log(`ABORT no "${label}" button was offered`); await browser.close(); process.exit(2); }
  await button.click(); await settled();
};
const lastSpeaker = async target => (await target.locator('#chat-history article').last().locator('h3').first().textContent()).trim();
// The verdict is structural and not a sentence whitelist. A rejected send leaves the farmer's own message as the last
// article in the history and their sentence back in the composer; an answered one renders an assistant reply and empties
// the box. A wording test here read `region_tap_rejects=false` on 20 Nov after the sentence it matched was replaced by
// an honest one, while the tap was still failing.
const isRejected = async (target, question) => (await lastSpeaker(target)) !== 'Assistant' &&
  (await target.locator('#question').inputValue()) === question;
const verdict = async (section, requests, target = page, question = TOWN) => {
  const line = (await target.locator('#answer-status').textContent()).trim();
  const rejected = await isRejected(target, question);
  console.log(`${section}_REQUESTS_DURING_TAP ${requests} [${[...seen].filter(key => key.startsWith(section))}]`);
  console.log(`${section}_STATUS ${line}`);
  console.log(`${section}_COMPOSER "${await target.locator('#question').inputValue()}"`);
  console.log(`${section}_LAST_SPEAKER ${await lastSpeaker(target)}`);
  console.log(`${section}_REPLY ${(await target.locator('#chat-history article').last().evaluate(node => [...node.querySelectorAll(':scope > p')].map(p => p.textContent).join(' '))).trim().slice(0, 170)}`);
  console.log(`${section}_LAT ${await target.locator('#latitude').inputValue()} REGION_FIELD "${await target.locator('#place-region').inputValue()}"`);
  console.log(`${section}_REJECTED ${rejected}`);
  return rejected;
};

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
console.log(`MODE ${mode} BASE ${base}`);
await page.getByRole('button', { name: 'Open FieldShift assistant', exact: true }).click();
await send(`Help me plan a rotation in ${COUNTRY}`);
await tap('A specific area');
await tap(REGION);
console.log(`REGION_TAP_OK towns offered: ${(await offered('town')).join(' | ')}`);
armed = 'A'; counts.A = 0;
await tap(TOWN);
armed = null;
const a = await verdict('A', counts.A);

// Section B: refuse both readers until the chat has recovered its own copy, then refuse the form's re-read on the tap.
// Only the saved-list paths are cut here: on the Node transport the country crop and water reads are app-side URLs, so
// cutting them with the lists would stop the guided plan at its opening (which is a different question, and section A
// already shows the town tap surviving them).
const contextB = await browser.newContext();
const fresh = await contextB.newPage();
await contextB.route(lists, route => (armed === 'B' ? (counts.B = (counts.B ?? 0) + 1,
  route.request().url().includes('/api/locations')
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'LOCATIONS_UNAVAILABLE', message: 'Place list is busy or unavailable.' } }) })
    : route.abort('failed')) : route.continue()));
armed = 'B';
await fresh.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await fresh.getByRole('button', { name: 'Open FieldShift assistant', exact: true }).click();
const freshStatus = async () => { await fresh.waitForFunction(() =>
  /Answer ready|Step 4 is ready|Error|came back|unavailable|could not|not reachable|invalid source|Choose a region/i.test(document.getElementById('answer-status')?.textContent ?? ''), null, { timeout: 90_000 }); };
const freshTap = async label => { await fresh.locator('#chat-history article').last().locator('button[data-chat-choice]')
  .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click(); await freshStatus(); };
await fresh.locator('#question').fill(`Help me plan a rotation in ${COUNTRY}`);
await fresh.getByRole('button', { name: 'Send', exact: true }).click(); await freshStatus();
await freshTap('A specific area');
console.log(`B_REFUSED_REPLY ${(await fresh.locator('#chat-history article').last().evaluate(node => [...node.querySelectorAll(':scope > p')].map(p => p.textContent).join(' '))).slice(0, 90)}`);
console.log(`B_REGION_FIELD_PLACEHOLDER "${await fresh.locator('#place-region').evaluate(node => node.options[0]?.textContent)}"`);
armed = null;
await freshTap('Try the place list again');
console.log(`B_RECOVERED_BUTTONS ${(await fresh.locator('#chat-history article').last().locator('button[data-choice-type="region"]').allTextContents()).map(t => t.trim()).join(' | ')}`);
armed = 'B'; counts.B = 0;
await freshTap(REGION);
armed = null;
const b = await verdict('B', counts.B ?? 0, fresh, REGION);
console.log(`VERDICT_${mode.toUpperCase()} town_tap_rejects=${a} region_tap_rejects=${b}`);
console.log(`COUNTS ${JSON.stringify(counts)} PAGEERRORS ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
console.log('TAP_REJECTION_PROBE_DONE');
await browser.close();
