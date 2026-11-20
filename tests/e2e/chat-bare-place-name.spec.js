import {test,expect} from '@playwright/test';

// Iteration 66, queue item F1. Measured 20 Nov on a served build of this branch, in
// docs/evidence/iter66-f1-page-probe-2026-11-20.log.gz: a country chosen in step 1 plus a bare place name typed into
// the chat reached none of the place switch. The switch that can
// select a row is gated on a plan being open, and with no plan open the sentence fell to the read-only answer at
// public/js/modules/chat.js:96, which reads a place name as a crop. On the page "Georgia" came back as
// "I could not match that crop to a sourced entry for Georgia." with zero buttons to tap, and with China held
// "Inner Mongolia" came back attributed to Mongolia. One message later - after any planning sentence opened the
// plan - the same word selects the region.
// The guard lives in respond(), which asks the saved list when the wording carries no other signal, so these three
// cases pin the user-visible halves: a region name selects, a town name sets a point, and a cancellation typed
// mid-plan stops the plan instead of raising the TypeError the cancel branch used to hit on its way past
// `parsed.countries.length`. All three run over both transports with no live geocoder: the saved lists are the
// app's own bundled rows, and the field lookups are cut so the town case cannot depend on OpenStreetMap's answer.
const lists=/\/api\/locations\?|\/data\/locations\//;
const fields=/overpass-api\.de|\/api\/farms\?/;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|could not respond|came back|unavailable|Error/i,{timeout:60_000});};
const last=page=>page.locator('#chat-history article').last();
const speaker=async page=>(await last(page).locator('h3').textContent()).trim();
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const send=async(page,text)=>{await page.locator('#question').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
// Step 1's own country control, so nothing in these cases opens a chat plan before the bare name is typed.
const openWithCountry=async page=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#pest-country').selectOption('US');
  await expect(page.locator('#country-status')).toContainText(/crop production categories/,{timeout:60_000});
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
};

test('a bare region name typed with no plan open selects the region instead of answering a crop question',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await openWithCountry(page);
  expect(await page.locator('#place-region').inputValue(),'no region is selected before the message').not.toBe('GA');
  await send(page,'Georgia');
  const spoken=await replyText(page);
  expect(await speaker(page),'the sentence is answered as a place, not left as the farmer own message').toBe('Assistant');
  expect(spoken,'a saved region name selects the region').toMatch(/^Georgia is selected\./);
  expect(spoken,'the read-only crop answer is not what the farmer is given').not.toMatch(/could not match that crop/i);
  expect(await page.locator('#place-region').inputValue(),'step 1 shows the region the chat selected').toBe('GA');
  const offered=(await last(page).locator('button[data-chat-choice]').allTextContents()).map(label=>label.trim());
  expect(offered.length,`a selection with nothing to tap next is a dead end: ${offered.join(' | ')}`).toBeGreaterThan(0);
  expect(errors,'page errors while a bare region name was typed with no plan open').toEqual([]);
  await info.attach('Bare region name with no plan open',{body:Buffer.from(JSON.stringify({spoken,offered},null,2)),contentType:'application/json'});
});

// The town half of the same guard, with the field service cut: the shipped sentence says the town point is set and
// then asks for a field, and `fieldsWaiting`/`fieldsFailed`/`fieldPrompt` differ only in the second half. Cutting the
// lookup keeps the assertion about the place switch rather than about OpenStreetMap's availability.
test('a bare town name typed with no plan open sets that town point',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[],counts={fields:0,lists:0};
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().route(fields,async route=>{counts.fields++;return route.abort('failed');});
  await page.context().route(lists,async route=>{counts.lists++;return route.continue();});
  await openWithCountry(page);
  await send(page,'Acworth');
  const spoken=await replyText(page);
  expect(await speaker(page),'the town name is answered').toBe('Assistant');
  expect(spoken,'a saved town name sets the point').toMatch(/Acworth is selected as a town point\./);
  expect(spoken,'the read-only crop answer is not what the farmer is given').not.toMatch(/could not match that crop/i);
  expect(counts.lists,'the name was checked against the saved list, not guessed from its wording').toBeGreaterThan(0);
  expect(await page.locator('#latitude').inputValue(),'the town coordinate the saved row holds is the one set').toBe('34.06635');
  expect(await page.locator('#longitude').inputValue(),'the town coordinate the saved row holds is the one set').toBe('-84.67837');
  expect(errors,'page errors while a bare town name was typed with no plan open').toEqual([]);
  await info.attach('Bare town name with no plan open',{body:Buffer.from(JSON.stringify({spoken,counts},null,2)),contentType:'application/json'});
});

// The cancel half is not about the guard above, but the same `respond()` entry made it unreachable: a cancellation
// carries no `countries` array, and the length read before the stop-word branch threw into
// public/js/modules/chat.js:149, which reports the runtime's own words in the status line and leaves the plan open.
// Measured with the short-circuit removed (docs/evidence/iter66-f1-offline-controls-2026-11-20.log.gz), typing "cancel" mid-plan ended
// with "Cannot read properties of undefined (reading 'length')" where "Guided planning stopped." should be.
test('a typed cancellation mid-plan stops the plan instead of reporting a runtime error',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in the United States');
  expect(await replyText(page),'the guided plan is open').toMatch(/United States/);
  await send(page,'cancel');
  const spoken=await replyText(page);
  const status=await page.locator('#answer-status').textContent();
  expect(status,`a typed cancellation must not surface a runtime error: ${status}`).not.toMatch(/Cannot read properties/i);
  expect(await speaker(page),'the cancellation is answered').toBe('Assistant');
  expect(spoken,'the cancellation states what stopped').toMatch(/Guided planning stopped\./);
  // The form is not wiped by stopping, which is what the sentence promises. The country step 1 held before the plan
  // opened is still held, and nothing about the cancellation moves the region or the point.
  expect(await page.locator('#pest-country').inputValue(),'stopping the plan leaves the farmer country selection alone').toBe('US');
  expect(errors,'page errors while a plan was opened and cancelled by typing').toEqual([]);
  await info.attach('Typed cancellation mid-plan',{body:Buffer.from(JSON.stringify({spoken,status},null,2)),contentType:'application/json'});
});
