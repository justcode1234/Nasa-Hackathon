import {test,expect} from '@playwright/test';

// Iteration 74, §13.1 item 8's second half: "a stale reply landing after the farmer moved on, and any choice
// invalidated by a location change made outside the chat". No spec on this branch interleaved two chat replies
// before this file, so nothing would have noticed if the render guard at public/js/modules/chat.js:100
// (`if (version !== revision || serial !== messageSerial) return;`) were deleted, nor the composer-unlock gate at
// :159. These four cases run in all four projects over the same two transports.
//
// WHERE THE TURN IS HELD, AND WHY NOT AT /api/ask. A superseded ask can never reach :100: `public/js/lib/api.js:35`
// rejects the worker transport on abort as `fetch` rejects the http one, and `public/js/lib/api.js:50-52`
// stamps `error.cancelled = true`, so an aborted ask goes to the catch at `chat.js:149` and :154 keeps the
// farmer silent. On the static projects no `/api/ask` *request* exists to intercept (`public/js/lib/api.js:18-26`
// posts it to the worker), which would make such a stub a silent no-op on half the farmer base. The turns held here are
// the guided ones: `chat.js:94` → `workflow-assistant.js:500` (the point lookup) and :530 → :356 (the mapped-field
// lookup). Neither takes a signal, so an abort cannot reject them and they settle after the send's identity was
// captured. Both reads go on the network on both transports - node through the app's own `/api/…` contract, the
// static worker through OpenStreetMap's own hosts - and both carry the typed coordinates verbatim, so a hold is keyed
// on the point in the URL rather than on arrival order and each case asserts which read it held.
//
// HOW A SECOND TURN IS STARTED AT ALL. `#ask` is the form's only submit control (public/index.html:174) and
// `chat.js:87` disables it for the whole turn, so a typed message cannot overtake one: the newer turn in the two
// interleaving cases is a tap of a choice button from an earlier reply, which `chat.js:129` leaves enabled and submits
// through `requestSubmit()`. That the tap really submits while Send is disabled is what the field-read witness proves;
// if it did not, no second request would be recorded and the case fails naming its witness rather than passing empty.
//
// THREE LAYERS, AND WHAT THIS FILE CAN THEREFORE PROVE. A superseded guided turn is also stopped by
// `workflow-assistant.js:341`'s `guard()` (a second send bumps `generation` at :340; a location change made outside
// the chat bumps it at :285 through `chat.js:165`) *before* it can write state or reach `chat.js:100`. The controls in
// `artifacts/scratch/iter74/close74.sh` measure the rest rather than assume it: leg B deletes :100 and leg D replaces
// :159's condition with `true`. D reddening proves this harness really interleaved anything, so B staying green reads
// as ":100 is defensive, already front-run by :341 and public/js/lib/api.js:35" and not as "the test did nothing".
// The farmer-visible contract these cases pin, which no spec pinned before, is: the invalidation notice replaces the
// history, the late answer never lands, a turn that never rendered wrote no point, text typed after the invalidation
// survives, and only the newest turn may unlock the composer.

const places = /nominatim\.openstreetmap\.org|\/api\/places\?/;
const lists = /\/api\/locations\?|\/data\/locations\//;
const fields = /overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
// The sentence a verified point produces (workflow-assistant.js:632) and the one a refused field lookup produces
// (:371). Four decimal places survive `locationInput`, so the URL key and the step 1 field carry them exactly.
const STALE = /The location is set\./;
const FIELDS = /field lookup did not complete|field services have not answered yet/;
const FIRST = {lat: '1.3521', lng: '103.8198'}, SECOND = {lat: '1.2905', lng: '103.8502'};
const firstSentence = `Use my point ${FIRST.lat}, ${FIRST.lng} to plan a rotation in Singapore`;
const secondSentence = `Use my point ${SECOND.lat}, ${SECOND.lng} to plan a rotation in Singapore`;
const showFields = 'Show mapped fields around this point';
// The retry button of the reply before the pending one: `last()` would be the farmer's own message once the newer
// turn is sent, and a message article carries no buttons. Chat-choice buttons are not among the controls :87-:88
// disable, which is what makes a tap the reachable way to start a second turn.
const fieldRetry = page => page.locator('#chat-history button[data-chat-choice]').filter({hasText: /^Show mapped fields$/}).last();
const planOpen = 'Help me plan a rotation in Singapore';
const last = page => page.locator('#chat-history article').last();
const assistantCount = async page => (await page.locator('#chat-history article h3').allTextContents()).filter(text => text.trim() === 'Assistant').length;
const historyText = page => page.locator('#chat-history').innerText();
// The verified-point sentence a superseded turn would add is word-for-word the one the setup turn already added, so
// "the stale reply never landed" cannot be a search for the words - it is a count that must not rise.
const staleCount = async page => (await historyText(page)).split('The location is set.').length - 1;
const replyText = async page => (await last(page).evaluate(node => [...node.querySelectorAll(':scope > p')].map(p => p.textContent).join(' '))).trim();
const offered = async page => (await last(page).locator('button[data-chat-choice]').allTextContents()).map(label => label.trim());
const status = page => page.locator('#answer-status').textContent();
const point = async page => [await page.locator('#latitude').inputValue(), await page.locator('#longitude').inputValue()];
const ready = async page => {await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|could not respond|came back|unavailable|Error/i, {timeout: 60_000});};
const send = async (page, text) => {await page.locator('#question').fill(text); await page.getByRole('button', {name: 'Send', exact: true}).click();};
const sendAndWait = async (page, text) => {await send(page, text); await ready(page);};

// The hold, keyed by the coordinate in the place-service URL and by a switchable delay on the field lookup, so the
// setup reads answer at once and only the turn a case is about is held. Every read is recorded with the instant the
// stub answered it: `held` is the witness list, and a case whose interception never fired fails naming it instead of
// quietly measuring a turn that completed on its own. The catch-all is registered first, which puts it last in
// Playwright's matching order (`context.route` unshifts), so it only ever sees traffic no stub claimed.
async function stubNet(context) {
  const held = [], escapes = [], delays = {places: {}, fields: 0};
  await context.route('**/*', route => {
    const url = route.request().url();
    if (/power\.larc|rest\.isric/.test(url)) {escapes.push(url); return route.abort('failed');}
    return route.continue();
  });
  await context.route(lists, route => {held.push({kind: 'list', url: route.request().url(), arrivedAt: Date.now(), ms: 0}); return route.continue();});
  await context.route(fields, async route => {
    const url = route.request().url(), ms = delays.fields, entry = {kind: 'fields', url, arrivedAt: Date.now(), ms, releasedAt: null};
    held.push(entry);
    if (ms) await new Promise(resolve => setTimeout(resolve, ms));
    entry.releasedAt = Date.now();
    // Refused, not fulfilled: the turn then takes the deterministic `fieldsFailed` sentence at workflow-assistant.js:371
    // rather than depending on what a mapped-field body would contain.
    return route.abort('failed');
  });
  await context.route(places, async route => {
    const url = route.request().url();
    // Attribution comes from the URL, never from the delay table: a read has to be counted even in the cases that let
    // it answer at once, or a witness would report "no read happened" for a turn that really made one.
    const at = [FIRST.lat, SECOND.lat].find(lat => url.includes(lat)) ?? 'unkeyed';
    // The stub answers with the point it was asked about, so a case cannot pass on a body that quietly contradicts the
    // sentence and then blame the app for a coordinate it never returned.
    const asked = at === SECOND.lat ? SECOND : FIRST;
    const ms = delays.places[at] ?? 0, entry = {kind: 'places', at, url, arrivedAt: Date.now(), ms, releasedAt: null};
    held.push(entry);
    if (ms) await new Promise(resolve => setTimeout(resolve, ms));
    entry.releasedAt = Date.now();
    if (url.includes('/api/places?')) return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({
      schemaVersion: 1, places: [{name: 'Singapore', latitude: Number(asked.lat), longitude: Number(asked.lng), countryCode: 'SG',
        country: 'Singapore', region: 'Central'}], source: {title: 'OpenStreetMap / Nominatim', url: 'https://www.openstreetmap.org/copyright'},
      retrievedAt: '2026-11-21T00:00:00.000Z'})});
    return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({
      address: {country_code: 'sg', country: 'Singapore', state: 'Central'}, display_name: 'Singapore', lat: asked.lat, lon: asked.lng})});
  });
  const hold = (kind, detail, ms) => {if (kind === 'fields') delays.fields = ms; else delays.places[detail] = ms;};
  // Wait for the stub itself to answer the turn a case is about, so no assertion below depends on a guessed clock.
  const released = async (kind, detail) => {await expect.poll(async () => held.find(entry => entry.kind === kind
    && (detail === undefined || entry.at === detail) && entry.releasedAt)?.releasedAt ?? 0,
    {timeout: 45_000, message: `no held ${kind} read${detail ? ` for ${detail}` : ''} was ever answered`}).toBeGreaterThan(0);};
  const seen = (kind, detail) => held.filter(entry => entry.kind === kind && (detail === undefined || entry.at === detail)).length;
  // Wait until the read a case is about has really reached the wire before starting the turn that supersedes it. On the
  // static projects the read goes page → worker → network, so a tap issued in the same tick as Send can overtake the
  // older turn before it sends anything, and the case would then measure two turns that never overlapped. Polling for
  // the arrival makes the interleaving a premise the harness enforces rather than one it hopes for.
  const arrived = async (kind, detail, count = 1) => {await expect.poll(async () => seen(kind, detail),
    {timeout: 45_000, message: `no ${kind} read${detail ? ` for ${detail}` : ''} ever reached the stub`}).toBeGreaterThanOrEqual(count);};
  return {held, escapes, hold, released, seen, arrived};
}

// Step 1's country is left empty on purpose: chat-refused-ask-keeps-question.spec.js proves this sequence reaches
// the reverse read at workflow-assistant.js:500 on all four projects, and every case here starts from it.
async function openPlan(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button', {name: 'Open FieldShift assistant', exact: true}).click();
  await sendAndWait(page, planOpen);
}

// The state a superseded turn races against: a point the app really took, and a field lookup that failed and left its
// own retry button on screen - the button the interleaving cases tap as their newer turn.
async function withPointAndFieldButton(page, net) {
  await openPlan(page);
  await sendAndWait(page, firstSentence);
  expect(await replyText(page), 'the setup turn is answered').toMatch(STALE);
  expect(await point(page), 'the setup point reaches step 1').toEqual([FIRST.lat, FIRST.lng]);
  await sendAndWait(page, showFields);
  expect(await replyText(page), 'the setup field lookup is refused and says so').toMatch(FIELDS);
  expect(await offered(page), 'the refusal leaves its own retry on screen').toContain('Show mapped fields');
  expect(net.seen('places', FIRST.lat), 'the setup read of the typed point happened on the network').toBe(1);
}

test('a location change made outside the chat while a guided turn waits replaces the history and the late answer never lands', async ({page}, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const net = await stubNet(page.context());
  await openPlan(page);
  net.hold('places', SECOND.lat, 4_000);
  await send(page, secondSentence);
  await net.arrived('places', SECOND.lat);
  // In-flight witness before the invalidation: if the turn had already completed there would be nothing to supersede,
  // and the case would be testing an empty window.
  await expect(page.locator('#ask'), 'the turn the invalidation races is in flight').toBeDisabled();
  expect(net.seen('places', SECOND.lat), 'the guided turn asked the place service about the typed point').toBe(1);
  // The farmer changes the year in step 1, which is `app.js:200` → `invalidate(true)` → `chat.js:161`. On a phone the
  // open assistant drawer sits over that form, so it is put away first and the clicks are never forced through it.
  await page.locator('#chat-toggle').click();
  await expect(page.locator('#chat-panel')).toBeHidden();
  await page.locator('#reference-year').fill('2023');
  await expect(page.locator('#chat-history')).toContainText('Location or planning context changed');
  await page.locator('#chat-toggle').click();
  const draft = 'Ignore the plan and look at the lower field';
  await page.locator('#question').fill(draft);
  await net.released('places', SECOND.lat);
  await page.waitForTimeout(750);
  const spoken = await historyText(page);
  expect(spoken, 'the invalidated turn must not render once its data arrives').not.toMatch(STALE);
  expect(await status(page), 'the status line is not a stale Answer ready').not.toMatch(/Answer ready/);
  expect(await point(page), 'a turn that never rendered must not have written its point').toEqual(['', '']);
  expect(await page.locator('#question').inputValue(), 'text typed after the invalidation belongs to the farmer').toBe(draft);
  await expect(page.locator('#ask'), 'the composer recovers from the invalidation').toBeEnabled();
  // The suppressed turn had real content: asked again with nothing invalidated it renders the sentence the case above
  // refused. Without this half, "nothing appeared" would be indistinguishable from "nothing was ever going to appear".
  net.hold('places', SECOND.lat, 0);
  await sendAndWait(page, secondSentence);
  expect(await replyText(page), 'the same sentence asked with no turn outstanding does render').toMatch(STALE);
  expect(await point(page), 'and that point is the one step 1 then holds').toEqual([SECOND.lat, SECOND.lng]);
  expect(errors, 'page errors while a location change invalidated an in-flight guided turn').toEqual([]);
  expect(net.escapes, `${net.escapes.join(' ')} reached an evidence service this case never stubbed`).toEqual([]);
  await info.attach('Invalidation over an in-flight guided turn', {body: Buffer.from(JSON.stringify({
    held: net.held, spoken, status: await status(page), point: await point(page)}, null, 2)), contentType: 'application/json'});
});

test('a newer turn taken from a reply button supersedes the typed one and the superseded turn adds no reply', async ({page}, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const net = await stubNet(page.context());
  await withPointAndFieldButton(page, net);
  const before = await assistantCount(page), staleBefore = await staleCount(page);
  expect(staleBefore, 'the setup turn left exactly one verified-point sentence for this case to hold at').toBe(1);
  net.hold('places', SECOND.lat, 1_500);
  net.hold('fields', undefined, 8_000);
  const fieldsBefore = net.seen('fields');
  await send(page, secondSentence);
  await net.arrived('places', SECOND.lat);
  await fieldRetry(page).click();
  await net.arrived('fields', undefined, fieldsBefore + 1);
  expect(net.seen('places', SECOND.lat), 'the typed turn asked the place service about its point').toBe(1);
  // A delta, not a count: a refused farmland read is retried across the mapped-field hosts, so one turn puts several
  // requests on the wire. What this case needs to know is that the tapped turn reached the service at all.
  expect(net.seen('fields'), 'the tapped turn asked the field service - a tap submits while Send is disabled').toBeGreaterThan(fieldsBefore);
  await net.released('places', SECOND.lat);
  await page.waitForTimeout(750);
  const mid = await historyText(page);
  expect(await staleCount(page), `the superseded answer must not land while the newer turn is still waiting: ${mid}`).toBe(staleBefore);
  expect(await assistantCount(page), 'and it must not append an article of its own').toBe(before);
  await ready(page);
  expect(await replyText(page), 'the tapped turn is the one that answers').toMatch(FIELDS);
  expect(await staleCount(page), 'even after the newer turn the superseded sentence never appears').toBe(staleBefore);
  expect(await assistantCount(page), `exactly one reply was added: ${await historyText(page)}`).toBe(before + 1);
  expect(await point(page), 'the superseded point never reached step 1, so the setup point still stands').toEqual([FIRST.lat, FIRST.lng]);
  expect(mid, 'the superseded message the farmer sent stays readable even though its answer was dropped').toContain(secondSentence);
  expect(errors, 'page errors while a tapped turn superseded a typed one').toEqual([]);
  expect(net.escapes, `${net.escapes.join(' ')} reached an evidence service this case never stubbed`).toEqual([]);
  await info.attach('Two turns in flight, one answer', {body: Buffer.from(JSON.stringify({
    held: net.held, before, after: await assistantCount(page), point: await point(page)}, null, 2)), contentType: 'application/json'});
});

// The composer belongs to the newest turn. A superseded turn's `finally` at chat.js:159 always runs after its
// rejection is caught at :149, and only that line's condition stops it unlocking the form while a newer ask is still
// waiting - which is why this is also the case control leg D (`:159` replaced by `if (true)`) must redden.
test('only the newest turn may re-enable the composer after an older one settles', async ({page}, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const net = await stubNet(page.context());
  await withPointAndFieldButton(page, net);
  net.hold('places', SECOND.lat, 1_500);
  net.hold('fields', undefined, 9_000);
  const fieldsBefore = net.seen('fields');
  await send(page, secondSentence);
  await net.arrived('places', SECOND.lat);
  await fieldRetry(page).click();
  await net.arrived('fields', undefined, fieldsBefore + 1);
  expect(net.seen('fields'), 'the tapped turn reached the field service, so two turns really were in flight').toBeGreaterThan(fieldsBefore);
  await expect(page.locator('#ask'), 'the composer is held while the tapped turn is in flight').toBeDisabled();
  await net.released('places', SECOND.lat);
  // Sampled across the whole window in which the older turn has settled and the newer one has not, so an unlock that
  // happens and is over before one point-in-time check runs still fails here.
  const unlocked = [];
  for (let sample = 0; sample < 20; sample++) {
    if (await page.locator('#ask').isEnabled()) unlocked.push(Date.now());
    await page.waitForTimeout(150);
  }
  expect(unlocked, `the superseded turn unlocked the composer ${unlocked.length} time(s) while the newer one was still waiting`).toEqual([]);
  await ready(page);
  await expect(page.locator('#ask'), 'the newest turn does unlock it when it answers').toBeEnabled();
  expect(await replyText(page), 'the newest turn is what the farmer is answered with').toMatch(FIELDS);
  expect(errors, 'page errors while the composer was held across two turns').toEqual([]);
  expect(net.escapes, `${net.escapes.join(' ')} reached an evidence service this case never stubbed`).toEqual([]);
  await info.attach('Composer ownership across two turns', {body: Buffer.from(JSON.stringify({
    held: net.held, unlocked}, null, 2)), contentType: 'application/json'});
});

// The positive control for the hold itself: with nothing invalidated and nothing superseded, the turn this file waits
// on answers normally. If this case is red, the stub is the suspect for every reading above, not the guard.
test('the same guided turn, unheld by any second message or context change, renders its answer', async ({page}, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const net = await stubNet(page.context());
  await openPlan(page);
  net.hold('places', SECOND.lat, 3_000);
  const started = Date.now();
  await sendAndWait(page, secondSentence);
  expect(Date.now() - started, 'the turn really waited on the held place read').toBeGreaterThanOrEqual(3_000);
  expect(net.seen('places', SECOND.lat), 'the guided turn asked the place service about the typed point').toBe(1);
  expect(await replyText(page), 'a turn nothing superseded renders').toMatch(STALE);
  expect(await point(page), 'and its point reaches step 1').toEqual([SECOND.lat, SECOND.lng]);
  await expect(page.locator('#ask')).toBeEnabled();
  expect(errors, 'page errors while the same turn was answered without any interleaving').toEqual([]);
  expect(net.escapes, `${net.escapes.join(' ')} reached an evidence service this case never stubbed`).toEqual([]);
  await info.attach('Unheld guided turn', {body: Buffer.from(JSON.stringify({held: net.held, reply: await replyText(page)}, null, 2)), contentType: 'application/json'});
});
