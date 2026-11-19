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
// server/index.js:62-64 rewrites the transport marker to http when it serves, so those pages issue their own
// /api/ask, /api/soil and /api/observations and a route can answer them. dist/client keeps worker, and there
// public/js/lib/api.js:18 posts those paths to /js/lib/core-worker.bundle.js instead of requesting them:
// measured 19 Nov (UTC), 51 outbound requests and no /api/* among them. The stubs below therefore have
// nothing to answer, step 2 fell back to the live upstreams (18 Nov: "The external context service could not
// respond"), and this note's old excuse - that a page-level route cannot reach a dedicated worker - is false,
// since context.route does intercept the worker's own POWER and SoilGrids fetches and drove the shipped static
// build to both loaded states with zero escapes. The static projects need replay fixtures at that layer, not a
// new interception point; that conversion is queued, and the composition itself is shared by both builds today.
test.describe.configure({ mode: 'serial' });
const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8'));
const observations=fixture('chat-evidence-observations.json'), soil=fixture('chat-evidence-soil.json'), askRain=fixture('chat-evidence-ask-rain.json');
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const last=page=>page.locator('#chat-history article').last();
const paragraphs=async page=>{const reply=last(page);await expect(reply.locator('h3')).toHaveText('Assistant');
  return (await reply.locator(':scope > p').allTextContents()).map(text=>text.trim());};
const links=page=>last(page).locator('details a').evaluateAll(nodes=>nodes.map(node=>node.href));
const summary=page=>last(page).locator('details summary').innerText();
// The printed count and the rendered chips can disagree silently: chat.js:108 prints the unique ids the
// surviving reply blocks cite, while dom.js:16 resolves each id against the merged source list and drops
// an id no entry carries, and dom.js:18 keys the separator off the loop index. The pest spec guards the
// same panel with these two rules; pinning the pairing beside the pinned counts means a first-id shadow
// (count printed over a chip that never rendered) or a separator regression fails here, not just offline.
const sourcePanel=async page=>{const printed=Number((await summary(page)).match(/(\d+)/)[1]);
  return {printed,...await last(page).locator('details p').first().evaluate(node=>({
    entries:[...node.querySelectorAll('a,span')].length,
    separators:[...node.childNodes].filter(child=>child.nodeType===3&&child.textContent===' · ').length,
  }))};};
const paired=panel=>{
  expect(panel.entries,`Sources (${panel.printed}) was printed over ${panel.entries} rendered citations`).toBe(panel.printed);
  expect(panel.separators,`${panel.entries} rendered citations carried ${panel.separators} separators`).toBe(panel.entries-1);
};

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
  test.skip(!testInfo.project.name.startsWith('node'),'the worker build answers /api in-process, so the /api stubs here never fire - see the METHOD header');
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
  expect(await summary(page)).toBe('Sources (2)');
  paired(await sourcePanel(page));
  // Required behaviour, replacing what iteration 34 pinned as today's: the weather paragraph used to cite the
  // registry id `nasa-power` for its own request URL, public/js/modules/chat.js:99 appended that entry after the
  // reply's own, and public/js/lib/dom.js:16 keeps the first source for an id - so the chip opened the POWER
  // documentation page and the query that reproduces the quoted number never reached the DOM. The paragraph now
  // cites two ids and pushes both, so the documentation page the panel already offered keeps linking *and* the
  // assembled request travels beside it. The old assertion is gone rather than relaxed: this case fails if either
  // link disappears, which is the half that a distinct id alone could not fix (measured 18 Nov (UTC): citing only
  // `nasa-power-request` rendered one chip, because the answer paragraph that cites the docs page can be cut by
  // the three-paragraph cap while the sources list cannot).
  expect(await links(page),`both the documentation entry and the exact request must be linked`).toEqual([askRain.sources[0].url,observations.source.url]);
  expect(errors).toEqual([]);
});

test('the SoilGrids advisory travels beside the estimate it qualifies in a mixed question',async({page,context},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('node'),'the worker build answers /api in-process, so the /api stubs here never fire - see the METHOD header');
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
  expect(await summary(page)).toBe('Sources (3)');
  paired(await sourcePanel(page));
  // Three ids survive a mixed reply: the POWER documentation entry, the exact request beside it, and SoilGrids for
  // both the estimate and the advisory that qualifies it. The request URL is asserted here as well as in the bare
  // case because a busy reply is where the citation used to be lost - the context entries are appended after the
  // answer's own, so a shared id is the one that disappears.
  expect(await links(page)).toEqual([askRain.sources[0].url,observations.source.url,soil.source.url]);
  expect(errors).toEqual([]);
});

test('a compound modifier is not read as a weather topic and the answer keeps its own paragraphs',async({page,context},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('node'),'the worker build answers /api in-process, so the /api stubs here never fire - see the METHOD header');
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
  // This case pins no link hrefs, so the pairing above is the only structural check the panel gets here.
  paired(await sourcePanel(page));
  expect(errors).toEqual([]);
});
