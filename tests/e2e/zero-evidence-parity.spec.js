import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createApiHandler} from '../../server/api.js';
import {createPowerClient} from '../../server/nasa/power.js';
import {createSoilClient} from '../../server/context/soil.js';

// Iteration 63, P1/P2. A NASA POWER year in which every daily value is the service's own fill code answers HTTP 200
// with valid unit metadata, so nothing in server/nasa/power.js rejects it: normalizePower turns all 366 days into
// null (server/nasa/power.js:48-52), latestAvailableDate becomes null, and the journey keeps going. What the farmer
// then reaches is a ranked comparison whose third ordering criterion — "Missing evidence days" — has silently become
// each rotation's own summed maturity, because rotation.js:102 counts a day as missing when ANY required parameter
// is null. Measured on this capture-derived year at artifacts/scratch/iter63/all-fill-derivation-2026-11-20.log:
// baseline 245/245, alternatives 240/240 and 260/260 missing/maturity days, so with priority "water" the first
// alternative was selected by crop length at the position labelled as evidence. The fix is a disclosure at the point
// of use plus a device-cache policy for a payload that carries no reading; re-choosing the criterion is an agronomy
// decision this prototype does not own and stays UNVERIFIED (docs/handoff-2026-11-18.md).
//
// The empty year is derived here, from the shipped capture, rather than committed beside it:
// tests/e2e/fixtures/raw/chat-evidence-raw-power-2024.json carries 1,830 value cells, all non-fill, and only
// `properties.parameter` is rewritten — to the capture's own `header.fill_value` (-999), with `header` and
// `parameters` metadata left byte-identical (both asserted below, both printed by the probe). Two copies of 1.4 MB
// of otherwise identical JSON could drift; one source cannot.
//
// METHOD is the one tests/e2e/chat-evidence-panel.spec.js established: all four projects, the app's own controls,
// the node projects answered by the shipped handler running in the Playwright process and the static projects
// answered where the worker really fetches. A catch-all route is registered FIRST so it is matched LAST
// (context.route unshifts), which makes any request no stub pinned fail the case by URL instead of silently
// reaching live NASA. Every sentence below is pinned exactly, so a divergence between the two compositions of the
// same shipped agronomy fails here rather than on a farmer's device.
const raw = name => JSON.parse(readFileSync(new URL(`./fixtures/raw/${name}`, import.meta.url), 'utf8'));
const rawPower = raw('chat-evidence-raw-power-2024.json'), rawSoil = raw('chat-evidence-raw-soilgrids.json');
const fill = rawPower.header.fill_value;
const allFillPower = (() => {
  const derived = structuredClone(rawPower);
  for (const byDate of Object.values(derived.properties.parameter)) for (const key of Object.keys(byDate)) byDate[key] = fill;
  return derived;
})();
// `properties.parameter` is an object per parameter keyed by `YYYYMMDD`, so the cell list needs flatMap: an
// array-flat would return the five objects and every count below would read 5.
const cells = payload => Object.values(payload.properties.parameter).flatMap(Object.values);
const readings = payload => cells(payload).filter(value => value !== fill).length;
// The derivation must be a derivation of readings, not of an already-empty file, and it must leave the metadata the
// schema guard checks (header/parameters) exactly as the capture has them.
test('the empty year this spec serves really is the shipped capture with every reading replaced', () => {
  expect(cells(rawPower).length, 'the capture no longer has five parameters over a full year').toBe(1830);
  expect(readings(rawPower), 'the shipped capture itself lost readings, so the derivation proves nothing').toBe(1830);
  expect(cells(allFillPower).length, 'the derivation added or dropped a cell').toBe(1830);
  expect(readings(allFillPower), 'the derived year still carries a reading').toBe(0);
  expect(allFillPower.header).toEqual(rawPower.header);
  expect(allFillPower.parameters).toEqual(rawPower.parameters);
  expect(fill).toBe(-999);
});

const POWER_DOCS = 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/';
const SOIL_DOCS = 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html';
const fields = /overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const pinnedApi = 'observations|soil|country-crops|compare|ask';
const apiStubs = new RegExp(`/api/(${pinnedApi})`);
const unpinned = new RegExp(`power\\.larc|rest\\.isric|overpass|maps\\.mail|/api/(farms\\?|${pinnedApi})`);
const sealed = (escaped, project) => expect(escaped,
  `${project} reached ${escaped.length} request(s) no stub pinned: ${escaped.join(' ')}`).toEqual([]);
// One token per paragraph can only be this run's clock; everything else is a recorded byte string.
const frozen = text => text.replace(/retrieved \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'retrieved <run clock>');
const last = page => page.locator('#chat-history article').last();
const paragraphs = async page => (await last(page).locator(':scope > p').allTextContents()).map(text => frozen(text.trim()));
const summary = page => last(page).locator('details summary').innerText();
// The sentence this iteration adds, quoted from the run that produced it
// (artifacts/scratch/iter63/all-fill-derivation-2026-11-20.log, RANKING evidenceLimitation) with the counts the
// shipped code computes from this payload: 366 days, four required parameters, all zero, priority water.
const NOTICE = 'Weather evidence limit: every day inside every crop window lacked at least one required NASA POWER '
  + 'reading (usable days out of 366: T2M 0, T2M_MIN 0, T2M_MAX 0, PRECTOTCORR 0). The "Missing evidence days" '
  + 'criterion then equalled each rotation\'s own summed maturity, so at that position it compared crop lengths '
  + 'rather than evidence, ahead of the water tie-breaks. Frost, heat and rain counts of 0 mean nothing was '
  + 'measured, not that risk is low.';
const GENERIC = 'Counts are screening rules, not suitability probabilities. Unequal thermal evidence between crops '
  + 'limits the ordering; unknown heat risk is not zero risk. Shorter maturity does not imply lower water demand.';

async function prepared(page, context, testInfo, payload = allFillPower) {
  const httpTransport = testInfo.project.name.startsWith('node');
  const errors = [], upstream = [], escaped = [], observationsCache = [];
  await context.route('**/*', route => {const url = route.request().url();
    if (unpinned.test(url)) {escaped.push(url); return route.abort('failed');}
    return route.continue();});
  const fetchImpl = async url => {upstream.push(new URL(String(url)).host);
    return {ok: true, status: 200, json: async () => structuredClone(String(url).includes('isric') ? rawSoil : payload)};};
  page.on('pageerror', error => errors.push(error.message));
  if (httpTransport) {
    const handler = createApiHandler({getObservations: createPowerClient({fetchImpl}), getSoil: createSoilClient({fetchImpl})});
    await context.route(apiStubs, async route => {
      const request = route.request(), url = new URL(request.url());
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      try {
        const result = await handler({method: request.method(), url, readJson: async () => body});
        // The cache policy this iteration sets travels to the page inside the payload; the node transport has no
        // browser-side store to inspect, so this is the half of the claim that transport can witness.
        if (url.pathname.endsWith('/api/observations') && result.cache) observationsCache.push(result.cache);
        await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(result)});
      } catch (error) {
        const status = error.status ?? 500;
        await route.fulfill({status, contentType: 'application/json',
          body: JSON.stringify({error: {code: error.code ?? 'SERVER_ERROR', message: error.message}})});
      }
    });
  } else {
    await context.route(/power\.larc\.nasa\.gov\/api\//, async route => {upstream.push('power.larc.nasa.gov');
      void route.fulfill({json: payload});});
    await context.route(/rest\.isric\.org/, async route => {upstream.push('rest.isric.org'); void route.fulfill({json: rawSoil});});
  }
  await context.route(fields, route => route.abort('failed'));
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.locator('#location-method').selectOption('places');
  await page.locator('#pest-country').selectOption('AU');
  await expect(page.locator('#catalog-status')).toContainText('Australia');
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill('-31.89');
  await page.locator('#longitude').fill('116.77');
  await page.locator('#reference-year').fill('2024');
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded', {timeout: 60_000});
  await expect(page.locator('#soil-context-status')).toContainText('Regional soil context loaded', {timeout: 60_000});
  return {errors, upstream, escaped, httpTransport, observationsCache};
}

// The step-4 journey, driven with the app's own controls and the priority this spec's sentence names.
async function compared(page) {
  await page.locator('#flow-next').click();
  await expect(page.locator('#si')).toBeVisible({timeout: 60_000});
  await page.locator('#priority').selectOption('water');
  for (const [i, value] of ['sweet-corn', 'pea', 'bush-bean'].entries()) await page.locator('#baseline-' + (i + 1)).selectOption(value);
  for (const choice of await page.locator('[name=allowedCrops]').all()) await choice.uncheck();
  await page.locator('[name=allowedCrops]').nth(0).check();
  await page.locator('[name=allowedCrops]').nth(1).check();
  await page.locator('#flow-next').click();
  await expect(page.locator('#strategy')).toBeVisible({timeout: 90_000});
  await expect(page.locator('.scenario')).toHaveCount(3);
}

test('a POWER year of fill codes is shown as no evidence, and the chat quotes no number for it', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped, httpTransport} = await prepared(page, context, testInfo);
  expect(httpTransport).toBe(testInfo.project.name.startsWith('node'));
  // The service's own counts, in the panel's own words: nothing usable, nothing latest. The first column of every
  // row is a `th scope=row` (public/js/lib/dom.js:39), so the fourth and fifth children are the tds that hold the
  // counts; a locator that took one td out of the whole table would compare a one-cell answer against five rows.
  const parameters = page.locator('#evidence-output table').first().locator('tbody tr');
  await expect(parameters).toHaveCount(5);
  expect(await parameters.locator('td:nth-child(4)').allTextContents(), 'a year of fill codes produced a non-zero valid-day count').toEqual(['0 / 366', '0 / 366', '0 / 366', '0 / 366', '0 / 366']);
  expect(await parameters.locator('td:nth-child(5)').allTextContents(), 'a year with no readings reported a latest day').toEqual(['None', 'None', 'None', 'None', 'None']);
  await expect(page.locator('#evidence-output')).toContainText('Latest non-missing day within this request: none.');
  // 12 months on each of the three charts, every one labelled Missing rather than plotted as zero.
  await expect(page.locator('#evidence-output svg text').filter({hasText: 'Missing'})).toHaveCount(36);
  // The sentence the panel adds only when a month has complete temperature data must not appear at all.
  await expect(page.locator('#evidence-output p').filter({hasText: 'Reading this historical year'})).toHaveCount(0);
  await page.locator('#chat-toggle').click();
  await page.locator('#question').fill('How much rain fell here last year?');
  await page.locator('#ask').click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready', {timeout: 60_000});
  // chat-context.js:48 leaves value null when there is no latest date, so the paragraph says "missing" and
  // "unknown date" instead of inventing either - and it still cites the documentation page and the exact request.
  expect(await paragraphs(page), 'the assistant quoted a measurement for a year that carries none').toEqual([
    'Precipitation Corrected: latest non-missing value inside 2024-01-01 to 2024-12-31 is missing mm/day on unknown date. '
    + 'Regional estimated gridded observation at -31.89°, 116.77°; retrieved <run clock>. '
    + 'It is not current weather, a forecast or a field measurement.',
  ]);
  expect(await summary(page)).toBe('Sources (2)');
  expect(upstream.sort(), `${upstream.join(', ')} - the empty year was not served from one POWER call and one SoilGrids call`).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

test('the comparison that a fill-coded year still ranks says out loud what its evidence criterion did', async ({page, context}, testInfo) => {
  const {errors, upstream, escaped} = await prepared(page, context, testInfo);
  await compared(page);
  // The disclosure has to be visible without opening anything: before iteration 63 the only place that could say it
  // was public/js/modules/strategy.js:36, inside the collapsed "How alternatives were ordered" block.
  const notices = page.locator('#strategy-output > p.notice').filter({hasText: 'Weather evidence limit'});
  await expect(notices).toHaveCount(1);
  await expect(notices.first()).toBeVisible();
  expect((await notices.first().innerText()).trim(), 'the visible disclosure is not the sentence the shipped code computed').toBe(NOTICE);
  // The ordering note keeps both sentences, in the same words, so the two places cannot disagree. It stays collapsed
  // here, and content inside a closed <details> has no rendered text at all (innerText reads ""), so the comparison
  // is made on textContent while the block's hidden state is asserted separately - that is the whole defect.
  const method = page.locator('#strategy-output details').filter({hasText: 'How alternatives were ordered'});
  await expect(method.locator('summary')).toHaveText(/^How alternatives were ordered/);
  const collapsed = method.locator('p').last();
  await expect(collapsed).toBeHidden();
  expect((await collapsed.textContent()).trim(), 'the collapsed note and the visible notice disagree').toBe(`${NOTICE} ${GENERIC}`);
  // What the farmer sees for each window: every day assessed is a day without evidence. The day counts come from
  // each crop's own maturity bound, so the pair is compared to itself rather than to numbers guessed here.
  const windows = page.locator('.scenario p').filter({hasText: 'Historical same-calendar window'});
  expect(await windows.count(), 'a scenario lost its per-slot evidence line').toBe(9);
  for (const text of await windows.allTextContents()) {
    const pair = text.trim().match(/^Historical same-calendar window: (\d+) days in reference year 2024; (\d+) days lack required weather values\.$/);
    expect(pair, `a crop window line states no assessed/missing pair: ${text}`).not.toBeNull();
    expect(pair[2], `a window of ${pair[1]} assessed days claimed ${pair[2]} missing days: ${text}`).toBe(pair[1]);
  }
  await expect(page.locator('.scenario p').filter({hasText: 'Longest observed zero-rain run: 0 days'})).toHaveCount(9);
  // Compare asked the two services for nothing new, even though the payload carries no reading and iteration 63
  // stopped writing that payload to the device cache: the in-process cache still answers it.
  expect(upstream.sort(), `${upstream.join(', ')} - a comparison refetched evidence it already held`).toEqual(['power.larc.nasa.gov', 'rest.isric.org']);
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

// The device-cache half of iteration 63, read through whichever store the transport actually has: neither branch is
// skipped. server/persistence.js keeps its entries in IndexedDB, which exists only where the API client runs in the
// page's own worker (the static projects, public/js/lib/core-worker.bundle.js); on the node projects the same module
// runs inside the Playwright process, where globalThis.indexedDB is absent and readCached returns null from the first
// line, so that transport reports its decision in the payload it answers with instead.
const devicePowerKeys = page => page.evaluate(() => new Promise((resolve, reject) => {
  const opening = indexedDB.open('fieldshift-evidence-v1');
  opening.onupgradeneeded = () => {
    if (!opening.result.objectStoreNames.contains('responses')) opening.result.createObjectStore('responses', {keyPath: 'key'});
  };
  opening.onerror = () => reject(opening.error);
  opening.onsuccess = () => {
    const database = opening.result;
    if (!database.objectStoreNames.contains('responses')) return resolve([]);
    const keys = database.transaction('responses').objectStore('responses').getAllKeys();
    keys.onsuccess = () => resolve(keys.result.filter(key => String(key).startsWith('power:')));
    keys.onerror = () => reject(keys.error);
  };
}));

test('a year with no readings is never written to the device cache', async ({page, context}, testInfo) => {
  const {upstream, errors, escaped, httpTransport, observationsCache} = await prepared(page, context, testInfo);
  // The whole step-3/4 journey runs on the same client before the store is read, so a write that the code issued has
  // had every opportunity to land; `writeCached` does not await its transaction, and this is not a timeout race.
  await compared(page);
  expect(upstream.filter(host => host === 'power.larc.nasa.gov').length,
    'the empty year never reached the client, so the store proves nothing').toBeGreaterThanOrEqual(1);
  if (httpTransport) {
    expect(observationsCache.length, 'no /api/observations answer was served, so nothing was observed').toBeGreaterThanOrEqual(1);
    expect(observationsCache.map(cache => cache.persisted), 'an empty year was offered as device-persistent evidence')
      .toEqual(observationsCache.map(() => false));
  } else {
    expect(await devicePowerKeys(page), 'a year with no readings was left in IndexedDB for the next session').toEqual([]);
  }
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});

// Control, on the same two observables: a year that does carry readings keeps the durable write it always had. Without
// it the empty list above would be equally satisfied by a device cache that never works at all.
test('control: a year with readings is still written to the device cache', async ({page, context}, testInfo) => {
  const {errors, escaped, httpTransport, observationsCache} = await prepared(page, context, testInfo, rawPower);
  expect(await page.locator('#evidence-output table').first().locator('tbody tr td:nth-child(4)').allTextContents(),
    'the control year does not carry a full set of readings').toEqual(['366 / 366', '366 / 366', '366 / 366', '366 / 366', '366 / 366']);
  await compared(page);
  if (httpTransport) {
    expect(observationsCache.length, 'no /api/observations answer was served, so nothing was observed').toBeGreaterThanOrEqual(1);
    expect(observationsCache.map(cache => cache.persisted), 'a populated year stopped being offered as device-persistent evidence')
      .toEqual(observationsCache.map(() => true));
  } else {
    expect(await devicePowerKeys(page), 'a populated year no longer reaches the device cache').toHaveLength(1);
  }
  expect(errors).toEqual([]);
  sealed(escaped, testInfo.project.name);
});
