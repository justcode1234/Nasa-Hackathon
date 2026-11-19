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
// Why these three cases exist: iteration 37 measured, through the real route on 18 Nov (UTC), that
// `useSelectedLocation` is set to `false` at nine sites across the catalog, grounded, planning, conversational and
// guided-workflow layers, and that the composer returned early on that flag. A pest-worded question the app holds a watchlist for
// therefore reached no record at all: an 8-wording scan against the live handler with no comparison found 0 of 8
// replies whose gate stood open, because a crop named in the question is routed to the country-aware retrieval at
// `server/agronomy/conversation.js:120` first, and the one reply shape that leaves the flag unset
// (`server/agronomy/answers.js:88`) is only produced after a comparison - the browser sets `state.inputs` there
// (public/js/app.js:290). The first two cases below pin that comparison pairing, which happens nowhere else in the
// suite. The third is the same kind of sentence with no comparison run at all, which is what iteration 38 changed:
// public/js/lib/chat-context.js:33 now gates only the field-scoped topics and decides the watchlist branch on the
// country the reply and the loaded records share (:103-109), so a species a farmer names outright is answered from
// the lookup they already ran. Citation ids are resolved where the paragraphs are (public/js/modules/chat.js:99
// appends the context sources after the answer's own, public/js/lib/dom.js:16 keeps the first entry per id), so the
// paragraph and its two links are asserted together rather than assumed to travel together.
test.describe.configure({ mode: 'serial' });
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const last=page=>page.locator('#chat-history article').last();
const paragraphs=async page=>{const reply=last(page);await expect(reply.locator('h3')).toHaveText('Assistant');
  return (await reply.locator(':scope > p').allTextContents()).map(text=>text.trim());};
const links=page=>last(page).locator('details a').evaluateAll(nodes=>nodes.map(node=>node.href));
const summary=page=>last(page).locator('details summary').innerText();

async function planned(page,context,withPestLookup,withComparison=true){
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
  if (withComparison) {
    await page.locator('#compare').click();
    await expect(page.locator('.scenario')).toHaveCount(3,{timeout:90_000});
  }
  if (withPestLookup) {
    // The comparison opens step 04 by itself (public/js/app.js:293), and the watchlist control lives in step 03,
    // so a farmer has to come back for it - the same click a person would make. Without a comparison the app is
    // still on step 03, so there is nothing to come back from.
    if (withComparison) await page.locator('#tab-si').click();
    await page.locator('#load-pests').click();
    await expect(page.locator('#pest-status')).toContainText('Country context loaded',{timeout:60_000});
  }
  await page.locator('#chat-toggle').click();
  return errors;
}
async function ask(page,text){await page.locator('#question').fill(text);await page.locator('#ask').click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:90_000});}

// Why this helper exists: the panel's number and the panel's list are produced by two different rules on two
// different lines. public/js/modules/chat.js:108 counts `[...new Set(blocks.flatMap(block => block.sourceIds))]`,
// the ids the rendered paragraphs cite, while public/js/lib/dom.js:15-17 emits one entry only for an id the source
// list can match and `return`s without emitting anything for one it cannot - no link, no text, no marker. So a
// counted id can disappear from the screen while the summary keeps counting it. Measured on this tree, and the
// reason the helper is here rather than a comment: dropping one citation (`nasa-power`) from the merged list at
// public/js/modules/chat.js:99 left the whole offline suite at 220/220 and all five shipped cases in this file
// green, because no assertion anywhere reads the list against the number - the existing hrefs are checked by
// index, and an id past the last index the cases index is invisible. docs/evidence/pest42-blind-offline-2026-11-19.log.gz
// and docs/evidence/pest42-blind-browser-2026-11-19.log.gz hold that pass. The same build makes the two `paired()`
// calls in the wordings that cite `nasa-power` fail - `Sources (5)` over 4 and `Sources (3)` over 2 - while the three
// wordings that never cite it stay green, which is the precision the pairing buys: it fails where the divergence is,
// not everywhere. The separators travel with the same contract: dom.js:18 keys the " · " off the id's
// index rather than the entries it rendered, so a dropped entry can also leave an orphan separator on screen.
const sourcePanel=async page=>{const printed=Number((await summary(page)).match(/(\d+)/)[1]);
  return {printed,...await last(page).locator('details p').first().evaluate(node=>({
    entries:[...node.querySelectorAll('a,span')].length,
    labels:[...node.querySelectorAll('a,span')].map(entry=>entry.textContent.trim()),
    separators:[...node.childNodes].filter(child=>child.nodeType===3&&child.textContent===' · ').length,
  }))};};
const paired=panel=>{
  expect(panel.entries,`Sources (${panel.printed}) was printed over ${panel.entries} rendered citations`).toBe(panel.printed);
  expect(panel.separators,`${panel.entries} rendered citations carried ${panel.separators} separators`).toBe(panel.entries-1);
};

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
  // The five are now enumerated instead of counted, which closes the derivation this case left open: two ids come
  // from the quoted country record (the GBIF query and its host reference), two from the reply's own rotation
  // paragraph (the UMN and Cornell extension pages) and one from the weather sentence the reply opens with
  // (NASA POWER). Printed as measured in docs/evidence/pest42-print-browser-2026-11-19.log.gz; these are the app's
  // own citation titles, not service output, so they do not move between runs.
  const panel=await sourcePanel(page);
  paired(panel);
  expect(panel.labels,`the five counted ids rendered: ${JSON.stringify(panel.labels)}`).toEqual([
    'GBIF Fall armyworm country query',
    'IPPC / FAO: fall armyworm hosts',
    'UMN Extension: healthy soil and plant families',
    'Cornell Extension: rotating vegetables by family',
    'NASA POWER Daily API',
  ]);
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
  // Deliberately no literal count here: the print measured `Sources (3)` for this state
  // (docs/evidence/pest42-print-browser-2026-11-19.log.gz), but every one of those ids comes from the reply's own
  // live paragraphs, so only the pairing that must hold whatever they cite is pinned.
  paired(await sourcePanel(page));
  expect(errors).toEqual([]);
});

// Why this third case exists: iteration 37 recorded that a pest question with no comparison never reached the
// watchlist because every reply the app can hand back sets `useSelectedLocation: false` and the composer returned
// early. Measured through the real route on 18 Nov (UTC) before the change, "Do I need to worry about diamondback
// moth here?" rendered one paragraph - `deterministic clarification`, Sources (0) - with the watchlist loaded in
// the same session. The composer now decides the pest branch on the country the reply and the lookup share, so the
// case below is the browser pin for that pairing, and it is deliberately run with no comparison so nothing else in
// the state can supply the record.
test('a species named outright reaches the loaded watchlist with no comparison run',async({page,context})=>{
  test.setTimeout(240_000);
  const errors=await planned(page,context,true,false);
  await ask(page,'Do I need to worry about diamondback moth here?');
  const seen=await paragraphs(page);
  expect(seen.length,'a reply shows at most three paragraphs').toBeLessThanOrEqual(3);
  expect(seen[0],`the first paragraph must be the record for the species named in the question, got: ${JSON.stringify(seen)}`).toMatch(/^Diamondback moth in AU:/);
  expect(seen[0]).toContain('Crucifer vegetables including radish are hosts; local damage is unassessed.');
  expect(seen[0]).toContain('This does not establish farm presence or current outbreak.');
  // The other watchlist entry must not be quoted just because it heads the list: this is the no-comparison state,
  // so nothing in a plan can justify it, and a head-of-list fallback is what would show instead.
  expect(seen.filter(text=>/Fall armyworm/.test(text)),'the species nobody asked about was quoted').toEqual([]);
  // The reply's own sentence survives: the record supplements a clarification, it does not replace it.
  expect(seen.findIndex(text=>/^I could not match that request/.test(text)),'the clarification the reply produced is missing').toBeGreaterThan(0);
  expect(await summary(page)).toBe('Sources (2)');
  paired(await sourcePanel(page));
  const hrefs=await links(page);
  expect(hrefs[0],`the first citation must be the GBIF country query for the named species: ${hrefs[0]}`).toContain('api.gbif.org/v1/occurrence/search');
  expect(hrefs[0]).toContain('country=AU');
  expect(hrefs[0]).toContain('taxonKey=1831136');
  expect(hrefs[1],'the second citation must be the host reference this record carries').toContain('ask.ifas.ufl.edu');
  expect(errors).toEqual([]);
});

// Why these two cases exist: the shape below is what iteration 40 changed (`public/js/lib/chat-context.js:147`), and
// until now nothing in a browser could see it - docs/evidence/pest40-blast-radius-2026-11-18.log.gz measured 0 of 88
// QA wordings reaching the widened branch, so subsection 39's first open limit was that the rule was pinned only by
// an offline unit case and an offline probe. Both wordings were first run as prints on this tree and their real
// paragraphs read from that log (docs/evidence/pest41-measure-2026-11-19.log.gz) before a single shape below was
// written; that archive holds the counts those prints produced, and iteration 42's own print
// (docs/evidence/pest42-print-browser-2026-11-19.log.gz) re-measured the same wordings' citation lists.
test('a pest reply spends its third slot on its own second paragraph rather than leaving it empty',async({page,context})=>{
  test.setTimeout(240_000);
  const errors=await planned(page,context,true);
  await ask(page,'What pests affect sweet corn?');
  const seen=await paragraphs(page);
  // The three paragraphs this wording renders on this composer, in order: the loaded record, the crop fact, and the
  // national-production sentence that the cap of one used to cut. Each is asserted as a slot so a change of order or
  // a dropped paragraph fails with the rendered list in the message.
  expect(seen,`the reply's own second paragraph did not reach the panel: ${JSON.stringify(seen)}`).toHaveLength(3);
  expect(seen[0],`the first paragraph must be the loaded country record, got: ${JSON.stringify(seen)}`).toMatch(/^Fall armyworm in (AU|Australia): Country records found/);
  expect(seen[1]).toMatch(/^Sweet corn belongs to Poaceae\./);
  // Measured, not guessed: the third paragraph is the reply's own FAOSTAT sentence for the plan's own country, and it
  // is a production record rather than a caveat, so this is the paragraph the old facts.slice(0, 1) cut.
  expect(seen[2],'the third slot holds the reply\'s own sentence').toMatch(/^Australia has a .* FAOSTAT production record for Green corn \(maize\)\./);
  expect(seen[2]).toContain('National records do not verify local suitability');
  // No live number is pinned anywhere above: the occurrence count in seen[0] comes from GBIF at request time, so this
  // case asserts the sentence that carries it and never its value.
  expect(seen.filter(text=>/Diamondback moth/.test(text)),'a record the plan does not name was quoted').toEqual([]);
  // Three paragraphs and seven counted ids were the measured render (docs/evidence/pest42-print-browser-2026-11-19.log.gz).
  // The count itself is not pinned - it moves with whichever paragraphs the live reply produces - but each id the
  // panel counts has to appear under it, which is what iteration 40's slot-filling could otherwise break silently.
  paired(await sourcePanel(page));
  expect(errors).toEqual([]);
});
test('a pest question naming a country the loaded watchlist is not explains the gap instead of quoting it',async({page,context})=>{
  test.setTimeout(240_000);
  const errors=await planned(page,context,true);
  await ask(page,'What pests affect sweet corn in Brazil?');
  const seen=await paragraphs(page);
  const advisory=seen.filter(text=>/^The country pest watchlist loaded here covers/.test(text));
  expect(advisory,`the wrong-country explanation is absent: ${JSON.stringify(seen)}`).toHaveLength(1);
  // conversation.js:51 lets an explicit country win over the selected point and :121 reports it, so the composer knows
  // which two countries disagree. The executed render spells both as the codes AU and BR; the assertion accepts the
  // display names too so the pin fails on the substance (which country is named) rather than on label style.
  expect(advisory[0]).toMatch(/AU|Australia/);
  expect(advisory[0]).toMatch(/BR|Brazil/);
  expect(advisory[0]).toContain('no occurrence record is quoted');
  expect(advisory[0]).toContain('Load the pest lookup for');
  // The failure class: Australia's records answering a Brazil question. Nothing but the advisory may speak of records.
  expect(seen.filter(text=>text!==advisory[0]&&/occurrence record/i.test(text)),'an occurrence claim crossed the country gate').toEqual([]);
  // The reply keeps its own honesty sentence beside the explanation, which is the same budget the case above pins.
  expect(seen).toHaveLength(3);
  expect(seen.some(text=>/^The saved FAOSTAT extract has no matching positive .* record for Brazil/.test(text)),
    `the reply's own evidence gap was displaced: ${JSON.stringify(seen)}`).toBe(true);
  // The advisory is the composer declining to quote, so the ids it does not cite must not be counted either: the
  // measured render printed `Sources (5)` with five entries and no GBIF link at all
  // (docs/evidence/pest42-print-browser-2026-11-19.log.gz), and this is the pairing that keeps a declined
  // citation from being counted while it is dropped from the list.
  const panel=await sourcePanel(page);
  paired(panel);
  expect(panel.labels.filter(label=>/GBIF/.test(label)),'the watchlist citation was counted while the advisory declined to quote it').toEqual([]);
  expect(errors).toEqual([]);
});
