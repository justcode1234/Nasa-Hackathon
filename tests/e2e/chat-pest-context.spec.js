import {test,expect} from '@playwright/test';

// METHOD: the country pest watchlist, observed in the live chat panel after the app's own comparison has run.
// The flow is the app's: a point in Western Australia (-31.89, 116.77) as coordinates, reference year 2024,
// a sweet corn / tomato / onion baseline, then "Look up country pest records" in step 03. Nothing is stubbed
// here except the mapped-field transport, which the other specs in this directory abort for the same reason:
// a test must not depend on which OSM mirror answers. NASA POWER, the country crop snapshot and GBIF are the
// real services, so no assertion below quotes an occurrence count or any other number the services can move -
// the species, the country, the host sentence, the non-farm-presence sentence and the two citation URLs are all
// strings the app itself composes (public/js/lib/chat-context.js) from its own watchlist (server/context/pests.js).
//
// Why these two cases exist: the pest branch of the evidence composer is guarded offline by tests/chat-context.test.js,
// which every time calls `contextBlocks(question, state, { topic: 'pest' })`. That answer shape is not what a
// pest-worded question produces. Measured on 18 Nov (UTC) through the real route, `useSelectedLocation` is set to `false` at
// eight sites across the catalog, grounded, planning and conversational layers, and
// public/js/lib/chat-context.js:24 returns early on that flag - so no unit guard exercises a reply the app can
// actually hand back for these sentences. One reply shape (`server/agronomy/answers.js:84`) does leave the flag
// unset, but an 8-wording scan against the live handler with no comparison found 0 of 8 replies whose gate stood
// open, because a crop named in the question is routed to the country-aware retrieval at
// `server/agronomy/conversation.js:120` first. The shape that does open it is the comparison-backed answer at
// server/api.js:59, which needs `state.inputs`, and the browser only sets that when a comparison has
// run (public/js/app.js:290). That pairing - a plan, a loaded watchlist, and a real reply - happens nowhere else
// in the suite, and it is where the citation ids are resolved (public/js/modules/chat.js:99 appends the context
// sources after the answer's own, public/js/lib/dom.js:16 keeps the first entry per id), so the paragraph and
// its two links are asserted together rather than assumed to travel together.
test.describe.configure({ mode: 'serial' });
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const last=page=>page.locator('#chat-history article').last();
const paragraphs=async page=>{const reply=last(page);await expect(reply.locator('h3')).toHaveText('Assistant');
  return (await reply.locator(':scope > p').allTextContents()).map(text=>text.trim());};
const links=page=>last(page).locator('details a').evaluateAll(nodes=>nodes.map(node=>node.href));
const summary=page=>last(page).locator('details summary').innerText();

async function planned(page,context,withPestLookup){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  // The shipped catalog is a live call, and a busy machine can take longer than the 15 s default to answer it.
  await expect(page.locator('#catalog-status')).toContainText('Choose a country',{timeout:60_000});
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill('-31.89');
  await page.locator('#longitude').fill('116.77');
  await page.locator('#reference-year').fill('2024');
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:90_000});
  // The point identifies its own country before any crop can be chosen (public/js/modules/context.js ensureCountry),
  // which is what makes the watchlist lookup in step 03 a country the app derived rather than one a test typed.
  await expect(page.locator('#country-status')).toContainText('Australia',{timeout:60_000});
  await page.locator('#tab-si').click();
  for(const [i,value] of ['sweet-corn','tomato','onion'].entries())await page.locator(`#baseline-${i+1}`).selectOption(value);
  await page.locator('#alternative-scope').selectOption('custom');
  for(const choice of await page.locator('[name=allowedCrops]').all())await choice.uncheck();
  await page.locator('[name=allowedCrops][value="sweet-corn"]').check();
  await page.locator('[name=allowedCrops][value="onion"]').check();
  await page.locator('#compare').click();
  await expect(page.locator('.scenario')).toHaveCount(3,{timeout:90_000});
  if (withPestLookup) {
    // The comparison opens step 04 by itself (public/js/app.js:293), and the watchlist control lives in step 03,
    // so a farmer has to come back for it - the same click a person would make.
    await page.locator('#tab-si').click();
    await page.locator('#load-pests').click();
    await expect(page.locator('#pest-status')).toContainText('Country context loaded',{timeout:60_000});
  }
  await page.locator('#chat-toggle').click();
  return errors;
}
async function ask(page,text){await page.locator('#question').fill(text);await page.locator('#ask').click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:90_000});}

test('a plan naming a watchlist crop renders that country record with both of its citations',async({page,context})=>{
  test.setTimeout(240_000);
  const errors=await planned(page,context,true);
  await ask(page,'Which pests should I watch for in this plan?');
  const seen=await paragraphs(page);
  expect(seen.length,'a reply shows at most three paragraphs').toBeLessThanOrEqual(3);
  // server/context/pests.js names sweet corn for the fall armyworm and the plan above contains it, so this is the
  // record the composer is expected to quote. Honest limit of this case, recorded rather than hidden: with the
  // shipped two-entry watchlist the crop-matched entry is also `records[0]`, because the other entry names radish
  // and radish has no FAOSTAT category (server/context/crops.js notice: "Radish has no mapped FAOSTAT category"),
  // so no plan the app can offer matches it. That means this case cannot tell crop-matching from a head-of-list
  // fallback, and it does not claim to - tests/chat-context.test.js:188 pins that choice with an Indian payload
  // where the two differ. What only a browser can show is that the paragraph reaches the screen at all beside a
  // real reply, and that its two ids resolve.
  expect(seen[0],`the first paragraph must be the country record, got: ${JSON.stringify(seen)}`).toMatch(/^Fall armyworm in AU: Country records found/);
  expect(seen[0]).toContain('Maize is a principal host; this is not a complete host list.');
  expect(seen[0]).toContain('This does not establish farm presence or current outbreak.');
  expect(seen.filter(text=>/Diamondback moth/.test(text)),'the record the plan does not name was quoted').toEqual([]);
  // The occurrence paragraph cites `<id>` and `<id>-host` (two ids for one paragraph is this composer's own
  // convention), and the panel counts ids cited by the paragraphs it actually rendered. Both must be resolvable:
  // a counted id that the source list cannot match renders as text with no link, which is the defect class
  // iteration 25/26 recorded. Asserting the hrefs rather than a count is deliberate - `Sources (N)` says how many
  // ids were cited, these two say that the country query and the host reference both reached the DOM.
  expect(await summary(page)).toBe('Sources (5)');
  const hrefs=await links(page);
  expect(hrefs[0],`the first citation must be the GBIF country query: ${hrefs[0]}`).toContain('api.gbif.org/v1/occurrence/search');
  expect(hrefs[0]).toContain('country=AU');
  expect(hrefs[0]).toContain('taxonKey=5109855');
  expect(hrefs[1],'the second citation must be the host reference the record carries').toContain('ippc.int');
  expect(errors).toEqual([]);
});

test('a pest question without a loaded country context says it is not loaded instead of guessing',async({page,context})=>{
  test.setTimeout(240_000);
  const errors=await planned(page,context,false);
  await ask(page,'Which pests should I watch for in this plan?');
  const seen=await paragraphs(page);
  // The same sentence with the lookup never run: the composer must report the missing layer and name the control
  // that supplies it, and must not quote a species or an occurrence figure it does not hold. This is the half of
  // the branch that keeps the loaded case above from passing on a paragraph that invents context.
  expect(seen.filter(text=>/^Country pest context is not loaded/.test(text)),`the missing-context sentence is absent: ${JSON.stringify(seen)}`).toHaveLength(1);
  expect(seen.filter(text=>/^Country pest context is not loaded/.test(text))[0]).toContain('There are no pest observations for this farm in the app.');
  expect(seen.filter(text=>/armyworm|moth|occurrence records/i.test(text)),'a species or an occurrence count was quoted with no country context loaded').toEqual([]);
  expect(errors).toEqual([]);
});
