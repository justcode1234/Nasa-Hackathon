import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// METHOD: the live chat panel in four projects, driven with the app's own step 1 controls. The evidence the
// farmer loads comes from tests/e2e/fixtures/*.json, recorded on 18 Nov 2026 through this repository's own
// production adapters (`node scripts/playwright-server.js --node`, GET /api/observations for -31.89, 116.77
// year 2024 and GET /api/soil for the same point; the ask fixture is `answerQuestion` run on those recorded
// observations with a tomato/cabbage/onion rainfed plan, which is the branch at
// server/agronomy/rotation.js:200 that leaves `useSelectedLocation` unset). Each file still carries its own
// `retrievedAt`, and the numbers are the services' as retrieved — they are the input to a rendering test, not
// a claim about any farm, and nothing here asserts a yield, a saving or a confidence. One edit was made to the
// recorded payload: the daily `dates`/`values` arrays are truncated to the last 8 days of 2024 (the monthly
// series, `source`, `period`, `location` and notices are byte-for-byte what the service returned), because the
// panel renders one value — the latest non-missing day — and a 366-day array would sit in git for a number that
// is already printed in the assertion below.
//
// Why stubs at all: every other spec in this directory calls the real NASA, SoilGrids and GBIF services, so the
// chat evidence panel could only ever be observed when those were up, and it never was — `grep -rl soilgrids
// tests/e2e/` returned only gibs.spec.js, which never opens the chat. Freezing the payloads makes the panel
// testable in every run, and the subject stays the browser-side composition in
// public/js/lib/chat-context.js and public/js/modules/chat.js: which paragraphs reach the screen, in what
// order, and which citation chips the panel can actually resolve (sourceLinks, public/js/lib/dom.js:16).
//
// These cases run in the two Node-transport projects, and that is a measured limit rather than a preference.
// server/index.js:62-64 rewrites the entry's transport marker to `http` when it serves, so the page itself
// issues /api/ask, /api/soil and /api/observations and a route can answer them. dist/client keeps the shipped
// `worker` marker (public/index.html:8), and there the same calls are posted to /js/lib/core-worker.bundle.js,
// which contains the compiled API handler and fetches the real upstreams from inside the worker; Playwright
// routes cover the page and its frames, not a dedicated worker. Running stubbed here produced exactly that
// signature on 18 Nov (UTC): the reply came back as the worker bundle's own clarification text and step 2 reported
// "The external context service could not respond (Failed to fetch)". The panel code under test is the same
// module in both builds, so what the static projects lose here is the fixture transport, not the composition —
// and they still carry the live chat coverage of the other specs.
test.describe.configure({ mode: 'serial' });
const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8'));
const observations=fixture('chat-evidence-observations.json'), soil=fixture('chat-evidence-soil.json'), askRain=fixture('chat-evidence-ask-rain.json');
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const last=page=>page.locator('#chat-history article').last();
const paragraphs=async page=>{const reply=last(page);await expect(reply.locator('h3')).toHaveText('Assistant');
  return (await reply.locator(':scope > p').allTextContents()).map(text=>text.trim());};
const links=page=>last(page).locator('details a').evaluateAll(nodes=>nodes.map(node=>node.href));
const summary=page=>last(page).locator('details summary').innerText();

async function prepared(page,context){
  await context.route(fields,route=>route.abort('failed'));
  await context.route(/\/api\/observations/,route=>route.fulfill({json:observations}));
  await context.route(/\/api\/soil/,route=>route.fulfill({json:soil}));
  await context.route(/\/api\/ask/,route=>route.fulfill({json:askRain}));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill(String(observations.location.latitude));
  await page.locator('#longitude').fill(String(observations.location.longitude));
  await page.locator('#reference-year').fill('2024');
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:60_000});
  // Step 2 loads the mapped soil context by itself (public/js/app.js:233), which is what makes a soil
  // question able to answer at all.
  await expect(page.locator('#soil-context-status')).toContainText('Regional soil context loaded',{timeout:60_000});
  await page.locator('#chat-toggle').click();
  return errors;
}
async function ask(page,text){await page.locator('#question').fill(text);await page.locator('#ask').click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});}

test('a bare-rain question renders the measured rainfall paragraph with its own citation',async({page,context},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('node'),'the static build answers /api inside /js/lib/core-worker.bundle.js, which a page-level route cannot reach - see the METHOD header');
  const errors=await prepared(page,context);
  await ask(page,'How much rain fell here last year?');
  const seen=await paragraphs(page);
  expect(seen.length,'a reply shows at most three paragraphs').toBeLessThanOrEqual(3);
  // Before this change this sentence added nothing: TOPIC.weather accepted "rainfall" and "precipitation" but not
  // "rain", although the series picker behind that gate lists rain|rains|rainy. The reply then quoted the
  // answer's own generic scope sentence and no measurement. The label is the payload's own (server/nasa/power.js
  // names PRECTOTCORR "Precipitation Corrected"), so the paragraph is pinned to the recorded series, not to a
  // name invented for a test.
  expect(seen[0],`the first paragraph must be the recorded precipitation estimate, got: ${seen[0]}`).toMatch(/^Precipitation Corrected: latest non-missing value/);
  expect(seen[0]).toContain('is 0.06 mm/day on 2024-12-31');
  expect(seen[0]).toContain(`Regional estimated gridded observation at ${observations.location.latitude}°, ${observations.location.longitude}°`);
  expect(seen[0]).toContain('It is not current weather, a forecast or a field measurement.');
  // The answer's own caveat must survive the estimate arriving beside it: one measured paragraph still leaves
  // room for the limitation, which is what composeAnswerBlocks guarantees.
  expect(seen[1],`the reply dropped the answer's own limitation: ${JSON.stringify(seen)}`).toMatch(/^Rainfed: historical precipitation is context only/);
  expect(await summary(page)).toBe('Sources (1)');
  // Measured 18 Nov (UTC), and deliberately pinned here as the behaviour of today rather than as the wanted end
  // state: the weather paragraph cites its own `nasa-power` entry (the exact POWER request URL that reproduces
  // the number), but public/js/modules/chat.js appends the context sources *after* the reply's own and
  // public/js/lib/dom.js:16 resolves an id with `sources.find`, so the first entry with that id wins and the
  // rendered link is the reply's generic "NASA POWER Daily API" documentation page. One id, two different URLs
  // = one silently dropped. Recorded as the next iteration's target in docs/handoff-2026-11-18.md; when it lands, this
  // assertion is rewritten to require observations.source.url and this note replaced by that requirement.
  expect(await links(page),`the single citation must be the reply's own POWER source`).toEqual([askRain.sources[0].url]);
  expect(errors).toEqual([]);
});

test('the SoilGrids advisory travels beside the estimate it qualifies in a mixed question',async({page,context},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('node'),'the static build answers /api inside /js/lib/core-worker.bundle.js, which a page-level route cannot reach - see the METHOD header');
  const errors=await prepared(page,context);
  await ask(page,'How much rain fell here last year, and is the soil pH acidic?');
  const seen=await paragraphs(page);
  expect(seen.length,'a mixed reply still shows at most three paragraphs').toBeLessThanOrEqual(3);
  expect(seen.filter(text=>/^Precipitation Corrected: latest non-missing value/.test(text)),`the rain estimate is missing from ${JSON.stringify(seen)}`).toHaveLength(1);
  expect(seen.filter(text=>/^pH in water: mean/.test(text)),`the soil estimate is missing from ${JSON.stringify(seen)}`).toHaveLength(1);
  // The ISRIC sentence used to be the first thing a busy reply dropped, because the old shared budget of two
  // counted caveats beside estimates. It must ride with the paragraph it qualifies, so it cannot be crowded out
  // by the rainfall estimate arriving in the same reply.
  const advisory=seen.findIndex(text=>/^ISRIC advises against/.test(text));
  expect(advisory,'the ISRIC advisory is absent from the rendered reply').toBeGreaterThan(-1);
  expect(seen[advisory-1],`the advisory must follow the estimate it qualifies: ${JSON.stringify(seen)}`).toMatch(/^pH in water: mean/);
  expect(seen[advisory]).toContain('no measured pH, drainage or soil-water capacity is inferred for this field');
  expect(await summary(page)).toBe('Sources (2)');
  // Two ids survive in a mixed reply, and the soil one resolves to SoilGrids; the `nasa-power` id is shadowed
  // exactly as recorded in the first test.
  expect(await links(page)).toEqual([askRain.sources[0].url,soil.source.url]);
  expect(errors).toEqual([]);
});

test('a compound modifier is not read as a weather topic and the answer keeps its own paragraphs',async({page,context},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('node'),'the static build answers /api inside /js/lib/core-worker.bundle.js, which a page-level route cannot reach - see the METHOD header');
  const errors=await prepared(page,context);
  await ask(page,'Is rain-fed maize viable here?');
  const seen=await paragraphs(page);
  // "rain-fed" is a way of farming, not a request about rainfall, so the gate must stay shut and the answer's
  // own sentences must survive - the recorded reply is the comparison's scope note plus its two caveats. The
  // guard is the weather paragraph's own sentence shape, so it holds whichever series the picker would choose.
  expect(seen.filter(text=>/latest non-missing value inside/.test(text)),'a hyphenated modifier added weather evidence').toEqual([]);
  expect(seen[0],`the answer's own first paragraph was displaced: ${seen[0]}`).toMatch(/^POWER precipitation for/);
  expect(seen.length).toBe(3);
  expect(await summary(page)).toBe('Sources (2)');
  expect(errors).toEqual([]);
});
