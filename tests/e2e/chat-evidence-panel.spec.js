import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createApiHandler} from '../../server/api.js';
import {createPowerClient} from '../../server/nasa/power.js';
import {createSoilClient} from '../../server/context/soil.js';

// The evidence the farmer loads is the services' own bytes: tests/e2e/fixtures/raw/*.json were captured on
// 19 Nov 2026 by calling this repository's production `createPowerClient` and `createSoilClient` with a recording
// fetch for -31.89, 116.77 and the 2024 season, and every value they still carry was compared against the
// 18 Nov recordings (URL byte-for-byte, the whole monthly block, all five daily series and all three soil
// properties each printed `true`). Nothing here is retyped or hand-trimmed, and no number in this file is a
// claim about any farm: the readings are what POWER and SoilGrids published for that point, they are the input
// to a rendering test, and no assertion mentions a yield, a saving or a confidence.
//
// METHOD: the live chat panel in all four projects, driven with the app's own controls over frozen evidence, so
// one sentence set has to be read out of both transports. Before iteration 57 the three cases below ran on the
// node projects only and were skipped on the two static ones, which is half the farmer base; the reason recorded
// at the time was that a page-level route cannot reach a dedicated worker. It can - the worker puts its POWER and
// SoilGrids calls on the network itself, and a route sees them. Measured 19 Nov (UTC) 22:34 on the shipped
// `dist/client` with a stub answering 9.99 mm/day where the service says 0.06, the rendered paragraph read 9.99:
// the interception is load-bearing, not decoration.
//
// Each transport is therefore intercepted at the deepest layer available to it, and both layers carry the same
// bytes. server/index.js:62-64 rewrites the transport marker to http when it serves, so a node-project page
// issues real /api/* requests; a page-level route answers them from `createApiHandler` imported from
// server/api.js and run in the Playwright process, with `createPowerClient`/`createSoilClient` fed the raw
// captures. The static projects never ask for /api at all - public/js/lib/api.js:20 posts those paths to the
// bundled copy of the same handler in a dedicated worker, so there the raw captures are served where they are
// actually fetched (the egress census for that page - 51 outbound requests, none of them an /api path - was
// measured on the shipped dist/client on 19 Nov and is archived at
// docs/evidence/iter55-egress-measure-2026-11-19.log.gz). What the two halves share is
// the shipped agronomy: the node reply is composed by server code executing in Node, the static reply by the
// identical source executing in a worker, and every assertion below applies to both, which is what makes a
// divergence between the two compositions fail here instead of only on a farmer's device.
//
// Two honest limits of that arrangement, both measured rather than assumed. (1) On the node projects the HTTP
// wire itself is bypassed by the route, deliberately: replaying the handler is what keeps a rendering test from
// depending on live NASA, and the wire, the status codes and the error envelope stay covered by
// tests/e2e/api-exit-parity.spec.js. (2) The panel quotes a retrieval instant - "retrieved
// 2026-11-19T22:48:38.539Z" - which is this run's clock on both transports and cannot be frozen in the browser.
// `frozen()` replaces that one token and every other character of every sentence is still compared exactly.
//
// A third limit is a product finding, not a test choice. Asked before any comparison, "How much rain fell here
// last year?" reaches server/api.js:55 with a body that carries no `baseline`, so the handler returns the
// no-source clarification at server/agronomy/answers.js:85 - measured offline on 19 Nov through that exact branch:
// mode `deterministic clarification`, topic `production`, one block of kind `clarification`, no sources - and the
// sentences a farmer reads are instead composed in the browser by contextBlocks in public/js/lib/chat.js:99 from
// the evidence step 2 already loaded. The clarification then disappears on the way: public/js/lib/chat-context.js:139
// treats a mapped estimate as answering the question itself, and line 147 keeps no reply paragraph once it does,
// which drops a `clarification` because only `limitation` counts as a caveat. Both transports agree because that
// composition is shared, so case 1 pins the evidence table, cases 2 and 3 pin the paragraphs really shown at that
// point and case 5 pins the same question after a real comparison - where the handler answers for its own (mode
// `deterministic evidence templates — no language model`, server/agronomy/rotation.js:219) and the reply gains the
// irrigation limitation. A clarification silently replaced by client-composed evidence is a P4 finding this file
// now makes visible; it is queued in docs/handoff-2026-11-18.md rather than fixed here, because the smallest
// honest change needs a decision about which side owns the sentence.
//
// Where each stub answers: server/index.js:62-64, public/js/lib/api.js:20, public/js/lib/core-worker-entry.js.
// And no stub is trusted on its own word: a catch-all route is registered before them, which makes it last in
// Playwright's matching order, and it records and refuses any POWER, SoilGrids, field-lookup or pinned /api
// request none of them claimed - so a stub pattern that stops matching fails the case naming a URL instead of
// quietly testing whatever the live services happen to publish today.
const raw = name => JSON.parse(readFileSync(new URL(`./fixtures/raw/${name}`, import.meta.url), 'utf8'));
const rawPower = raw('chat-evidence-raw-power-2024.json'), rawSoil = raw('chat-evidence-raw-soilgrids.json');
const POWER_DOCS = 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/';
const POWER_REQUEST = 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M%2CT2M_MAX%2CT2M_MIN%2CPRECTOTCORR%2CALLSKY_SFC_SW_DWN&community=AG&latitude=-31.89&longitude=116.77&start=20240101&end=20241231&format=JSON&time-standard=LST';
const SOIL_DOCS = 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html';
const fields = /overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
// The endpoints this spec answers from the shipped handler, named once so the catch-all below cannot drift out of
// step with the stub that uses them, and everything the file intercepts expressed from that same list.
const pinnedApi = 'observations|soil|country-crops|compare|ask';
const apiStubs = new RegExp(`/api/(${pinnedApi})`);
const unpinned = new RegExp(`power\\.larc|rest\\.isric|overpass|maps\\.mail|/api/(farms\\?|${pinnedApi})`);
const last = page => page.locator('#chat-history article').last();
const paragraphs = async page => {const reply = last(page); await expect(reply.locator('h3')).toHaveText('Assistant');
  return (await reply.locator(':scope > p').allTextContents()).map(text => text.trim());};
const links = page => last(page).locator('details a').evaluateAll(nodes => nodes.map(node => node.href));
const summary = page => last(page).locator('details summary').innerText();
// The printed count and the rendered chips can disagree silently: chat.js:108 prints the unique ids the
// surviving reply blocks cite, while dom.js:16 resolves each id against the merged source list and drops
// an id no entry carries, and dom.js:18 keys the separator off the loop index. The pest spec guards the
// same panel with these two rules; pinning the pairing beside the pinned counts means a first-id shadow
// (count printed over a chip that never rendered) or a separator regression fails here, not just offline.
const sourcePanel = async page => {const printed = Number((await summary(page)).match(/(\d+)/)[1]);
  return {printed, ...await last(page).locator('details p').first().evaluate(node => ({
    entries: [...node.querySelectorAll('a,span')].length,
    separators: [...node.childNodes].filter(child => child.nodeType === 3 && child.textContent === ' · ').length,
  }))};};
const paired = panel => {
  expect(panel.entries, `Sources (${panel.printed}) was printed over ${panel.entries} rendered citations`).toBe(panel.printed);
  expect(panel.separators, `${panel.entries} rendered citations carried ${panel.separators} separators`).toBe(panel.entries - 1);
};
const sealed = (escaped, project) => expect(escaped,
  `${project} reached ${escaped.length} request(s) no stub pinned: ${escaped.join(' ')}`).toEqual([]);
// One token per paragraph can only be this run's clock; everything else is a recorded byte string.
const frozen = text => text.replace(/retrieved \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'retrieved <run clock>');
const freezeAll = async page => (await paragraphs(page)).map(frozen);

// Step 2 with both services answered from the captures: the evidence table and the mapped soil context are on
// screen, and no comparison has been run yet, which is where a farmer who types a question first actually is.
async function prepared(page, context, testInfo) {
  const httpTransport = testInfo.project.name.startsWith('node');
  const upstream = [], errors = [], escaped = [];
  // Registered before every stub, which puts it last in Playwright's matching order (`context.route` unshifts, so
  // the most recently added handler wins): each stub stays in charge of the traffic it claims and this route only
  // ever sees what none of them matched. That is the failure it exists to catch - a stub pattern that stops
  // matching would otherwise send the page to live POWER or SoilGrids and could still render a plausible sentence
  // - so the request is recorded, refused at the network layer and named by the sealed() assertion in each case.
  // Both wrong orderings were measured on 19 Nov UTC: at 23:39 a bare /api/ pattern outranked the stubs and seized
  // the unstubbed /api/crops reply the node server answers itself, failing ten node cases with "Crop catalog
  // unavailable: No answer came back for this request" (public/js/lib/api.js:48) while the ten static ones passed,
  // and at 23:42 the pinned pattern in that same position aborted seven static cases before the run was stopped.
  await context.route('**/*', route => {const url = route.request().url();
    if (unpinned.test(url)) {escaped.push(url); return route.abort('failed');}
    return route.continue();});
  // The journey is meant to touch each service exactly once; every later call must come from the caches in
  // server/nasa/power.js:96 and server/context/client.js:6, so this array doubles as the caching assertion.
  const fetchImpl = async url => {upstream.push(new URL(String(url)).host);
    return {ok: true, status: 200, json: async () => structuredClone(String(url).includes('isric') ? rawSoil : rawPower)};};
  page.on('pageerror', error => errors.push(error.message));
  if (httpTransport) {
    const handler = createApiHandler({getObservations: createPowerClient({fetchImpl}), getSoil: createSoilClient({fetchImpl})});
    await context.route(apiStubs, async route => {
      const request = route.request(), url = new URL(request.url());
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      try {
        const result = await handler({method: request.method(), url, readJson: async () => body});
        await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(result)});
      } catch (error) {
        const status = error.status ?? 500;
        await route.fulfill({status, contentType: 'application/json',
          body: JSON.stringify({error: {code: error.code ?? 'SERVER_ERROR', message: error.message}})});
      }
    });
  } else {
    await context.route(/power\.larc\.nasa\.gov\/api\//, async route => {upstream.push('power.larc.nasa.gov');
      void route.fulfill({json: rawPower});});
    await context.route(/rest\.isric\.org/, async route => {upstream.push('rest.isric.org'); void route.fulfill({json: rawSoil});});
  }
  await context.route(fields, route => route.abort('failed'));
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  // The baseline and alternative pickers list the screened crops of a chosen country, so a comparison needs one;
  // coordinates still fix the point the evidence is read for, exactly as workflow.spec.js drives it.
  await page.locator('#location-method').selectOption('places');
  await page.locator('#pest-country').selectOption('AU');
  await expect(page.locator('#catalog-status')).toContainText('Australia');
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill('-31.89');
  await page.locator('#longitude').fill('116.77');
  await page.locator('#reference-year').fill('2024');
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded', {timeout: 60_000});
  // Step 2 loads the mapped soil context by itself (public/js/app.js:233), which is what makes a soil
  // question able to answer at all.
  await expect(page.locator('#soil-context-status')).toContainText('Regional soil context loaded', {timeout: 60_000});
  await page.locator('#chat-toggle').click();
  return {errors, upstream, escaped, httpTransport};
}

// The farmer's own Next-driven comparison: three screened baselines and two allowed crops, through the same
// `#flow-next` control the plan uses, until the strategy tab shows its three rotations.
async function compared(page) {
  // On a phone viewport the open assistant drawer sits over the plan form, which is what a farmer sees too, so it
  // is put away before the form is worked on and brought back after. The clicks are never forced through it.
  await page.locator('#chat-toggle').click();
  await expect(page.locator('#chat-panel')).toBeHidden();
  await page.locator('#flow-next').click();
  await expect(page.locator('#si')).toBeVisible({timeout: 60_000});
  for (const [i, value] of ['sweet-corn', 'pea', 'bush-bean'].entries()) await page.locator('#baseline-' + (i + 1)).selectOption(value);
  for (const choice of await page.locator('[name=allowedCrops]').all()) await choice.uncheck();
  await page.locator('[name=allowedCrops]').nth(0).check();
  await page.locator('[name=allowedCrops]').nth(1).check();
  await page.locator('#flow-next').click();
  await expect(page.locator('#strategy')).toBeVisible({timeout: 90_000});
  await expect(page.locator('.scenario')).toHaveCount(3);
  await page.locator('#chat-toggle').click();
  await expect(page.locator('#chat-panel')).toBeVisible();
}
async function ask(page, text) {await page.locator('#question').fill(text); await page.locator('#ask').click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready', {timeout: 60_000});}

test('all four projects read the same evidence panel, services touched once each', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped, httpTransport} = await prepared(page, context, testInfo);
  // The two interceptions sit at different layers, so the same host list is the proof that each transport was
  // really answered from the captures rather than from a live service or a cache left over from an earlier page.
  expect(upstream.sort(), `${testInfo.project.name} reached ${upstream.join(', ')} instead of one POWER and one SoilGrids call`).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(httpTransport).toBe(testInfo.project.name.startsWith('node'));
  expect(await page.locator('#evidence-output table').first().locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('#soil-context-status')).toContainText('Regional soil context loaded');
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

test('a bare-rain question renders the measured rainfall paragraph with its own citation', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped} = await prepared(page, context, testInfo);
  await ask(page, 'How much rain fell here last year?');
  // Before this change this sentence added nothing: TOPIC.weather accepted "rainfall" and "precipitation" but not
  // "rain", although the series picker behind that gate lists rain|rains|rainy. The reply then quoted the
  // answer's own generic scope sentence and no measurement. The label is the payload's own (server/nasa/power.js
  // names PRECTOTCORR "Precipitation Corrected"), so the paragraph is pinned to the recorded series, not to a
  // name invented for a test.
  expect(await freezeAll(page), 'the panel at step 2 renders exactly the measured rainfall sentence').toEqual([
    'Precipitation Corrected: latest non-missing value inside 2024-01-01 to 2024-12-31 is 0.06 mm/day on 2024-12-31. '
    + 'Regional estimated gridded observation at -31.89°, 116.77°; retrieved <run clock>. '
    + 'It is not current weather, a forecast or a field measurement.',
  ]);
  expect(upstream.sort()).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(await summary(page)).toBe('Sources (2)');
  paired(await sourcePanel(page));
  // Required behaviour, replacing what iteration 34 pinned as today's: the weather paragraph used to cite the
  // registry id `nasa-power` for its own request URL, public/js/modules/chat.js:99 appended that entry after the
  // reply's own, and public/js/lib/dom.js:16 keeps the first source for an id - so the chip opened the POWER
  // documentation page and the query that reproduces the quoted number never reached the DOM. The paragraph now
  // cites two ids and pushes both, so the documentation page the panel already offers keeps linking *and* the
  // assembled request travels beside it. The old assertion is gone rather than relaxed: this case fails if either
  // link disappears, which is the half that a distinct id alone could not fix (measured 18 Nov (UTC): citing only
  // `nasa-power-request` rendered one chip, because the answer paragraph that cites the docs page can be cut by
  // the three-paragraph cap while the sources list cannot).
  expect(await links(page), 'both the documentation entry and the exact request must be linked').toEqual([POWER_DOCS, POWER_REQUEST]);
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

test('the SoilGrids advisory travels beside the estimate it qualifies in a mixed question', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped} = await prepared(page, context, testInfo);
  await ask(page, 'How much rain fell here last year, and is the soil pH acidic?');
  expect(await freezeAll(page), 'a mixed reply renders the two estimates and the advisory that qualifies the second').toEqual([
    'Precipitation Corrected: latest non-missing value inside 2024-01-01 to 2024-12-31 is 0.06 mm/day on 2024-12-31. '
    + 'Regional estimated gridded observation at -31.89°, 116.77°; retrieved <run clock>. '
    + 'It is not current weather, a forecast or a field measurement.',
    'pH in water: mean 7.2 pH; source 5th–95th prediction quantiles 5.6–8.8 pH. SoilGrids 250 m grid, 0–5 cm, '
    + 'retrieved <run clock>; no single observation date. This is not a farm measurement.',
    'ISRIC advises against local/farm-level use of SoilGrids. These estimates are regional context only; '
    + 'no measured pH, drainage or soil-water capacity is inferred for this field.',
  ]);
  // The ISRIC sentence used to be the first thing a busy reply dropped, because the old shared budget of two
  // counted caveats beside estimates. The three-paragraph array above is what "it rides with the estimate it
  // qualifies" means: the advisory is the third sentence and the pH estimate the second, in that order, in all
  // four projects.
  expect(upstream.sort()).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(await summary(page)).toBe('Sources (3)');
  paired(await sourcePanel(page));
  // Three ids survive a mixed reply: the POWER documentation entry, the exact request beside it, and SoilGrids for
  // both the estimate and the advisory that qualifies it. The request URL is asserted here as well as in the bare
  // case because a busy reply is where the citation used to be lost - the context entries are appended after the
  // answer's own, so a shared id is the one that disappears.
  expect(await links(page)).toEqual([POWER_DOCS, POWER_REQUEST, SOIL_DOCS]);
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

test('a compound modifier is not read as a weather topic and the answer keeps its own paragraphs', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped} = await prepared(page, context, testInfo);
  await ask(page, 'Is rain-fed maize viable here?');
  const seen = await freezeAll(page);
  // "rain-fed" is a way of farming, not a request about rainfall, so the gate must stay shut and the answer's
  // own sentences must survive. The guard is the weather paragraph's own sentence shape, so it holds whichever
  // series the picker would choose, and the sentences below are what the handler really returns for this body:
  // national FAOSTAT production for maize and the screening limit that keeps sweet-corn rules off other corn.
  expect(seen.filter(text => /latest non-missing value inside/.test(text)), 'a hyphenated modifier added weather evidence').toEqual([]);
  expect(seen, 'the answer keeps its own two paragraphs in front of anything client-composed').toEqual([
    'Australia: FAOSTAT records 447,027 t of Maize (corn) nationally in 2024 (Official figure). Source snapshot '
    + 'retrieved 2026-11-14. This is national production, not field yield or a planting recommendation.',
    'Only explicitly identified sweet corn has sourced starter rules here. Other or unspecified corn/maize types '
    + 'remain unassessed; sweet-corn maturity and suitability rules are not applied to them.',
  ]);
  expect(upstream.sort()).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(await summary(page)).toBe('Sources (1)');
  // This case pins no link hrefs, so the pairing above is the only structural check the panel gets here.
  paired(await sourcePanel(page));
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

test('a question after a real comparison gains the limitation the comparison knows', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped} = await prepared(page, context, testInfo);
  await compared(page);
  await ask(page, 'How much rain fell here last year?');
  // The same sentence asked at step 2 gets a client-composed measurement and nothing else (see the header). With
  // a `baseline` in the body the handler answers it for real, and the reply gains the limitation only the chosen
  // plan can state: irrigation was left unknown, so crop water sufficiency cannot be assessed. Pinning both the
  // measurement and that sentence is what makes a stale or location-blind answer - the failure mode this branch
  // exists to close - fail here rather than read plausibly.
  expect(await freezeAll(page), 'the compared reply keeps the measurement and adds the plan limitation').toEqual([
    'Precipitation Corrected: latest non-missing value inside 2024-01-01 to 2024-12-31 is 0.06 mm/day on 2024-12-31. '
    + 'Regional estimated gridded observation at -31.89°, 116.77°; retrieved <run clock>. '
    + 'It is not current weather, a forecast or a field measurement.',
    'Irrigation is unknown; crop water sufficiency cannot be assessed.',
  ]);
  // Compare plus ask asked the two services for nothing new: the whole journey stays at one POWER call and one
  // SoilGrids call, which is the caching rule server/nasa/power.js:102 and the context cache implement together.
  expect(upstream.sort(), `${upstream.join(', ')} - a comparison or a question refetched evidence it already held`).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(await summary(page)).toBe('Sources (2)');
  paired(await sourcePanel(page));
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});
