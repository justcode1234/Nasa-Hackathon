import {test,expect} from '@playwright/test';

// Iteration 69, queue item F9. The page half of the ambiguity rule: a town name the saved list carries more than once,
// typed with a country held and no plan open. The United States lists Athens five times (rows 4180386/4505542/4603284/
// 4671545/4830668), so these cases use the largest collision in the shipped data rather than an invented fixture, and
// they pin the two halves a farmer can see: the question says how many rows it is hiding, and nothing moves in step 1
// until a row is tapped. Before the change the page answered the same sentence with the generic refusal “I could not
// match that request to a supported question or planning step.” and no buttons at all (measured with the pre-fix module
// bytes, artifacts/scratch/iter69/f9-page-probe-static.log), because exactPlaceRow returned a row only when exactly one
// claimed the name and respond() then returned null — the offline reading of that is archived in
// docs/evidence/iter69-f9-offline-redfirst-2026-11-21.log.gz and the page ladder in
// docs/evidence/iter69-f9-spec-4projects-2026-11-21.log.gz.
// public/js/modules/workflow-assistant.js is imported by the page through public/js/modules/chat.js:17, so the same
// module answers on both transports and neither project is a copy of the other; the row coordinates asserted below come
// from whichever list path that transport serves, so a transport that could not read its rows cannot pass by accident.
const fields=/overpass-api\.de|\/api\/farms\?/;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|could not respond|came back|unavailable|Error/i,{timeout:60_000});};
const last=page=>page.locator('#chat-history article').last();
const speaker=async page=>(await last(page).locator('h3').textContent()).trim();
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const send=async(page,text)=>{await page.locator('#question').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const openWithCountry=async page=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#pest-country').selectOption('US');
  await expect(page.locator('#country-status')).toContainText(/crop production categories/,{timeout:60_000});
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
};

test('a town name the saved list carries five times asks which one and moves nothing',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await openWithCountry(page);
  const regionBefore=await page.locator('#place-region').inputValue();
  const latBefore=await page.locator('#latitude').inputValue();
  await send(page,'Athens');  const spoken=await replyText(page);
  expect(await speaker(page),'the ambiguous town name is answered').toBe('Assistant');
  expect(spoken,'the read-only crop answer is not what the farmer is given').not.toMatch(/could not match that crop/i);
  expect(spoken,'the reply says the name matches several towns').toMatch(/Several listed towns match/);
  expect(spoken,'the reply admits it is showing three of the five the list holds').toMatch(/showing 3 of 5/);
  expect(spoken,'the reply asks the farmer which one').toMatch(/Which one do you mean\?/);
  const offered=(await last(page).locator('button[data-chat-choice]').allTextContents()).map(label=>label.trim());
  // The list's own order: Georgia, Ohio, Tennessee are the first three rows named Athens, and each button says which
  // region it belongs to so the three are distinguishable on screen.
  expect(offered,`the offered rows are the first three of the five saved Athens rows: ${offered.join(' | ')}`).toEqual(['Athens · Georgia','Athens · Ohio','Athens · Tennessee']);
  expect(await page.locator('#place-region').inputValue(),'asking which one selects no region').toBe(regionBefore);
  expect(await page.locator('#latitude').inputValue(),'asking which one sets no point').toBe(latBefore);
  expect(errors,'page errors while an ambiguous town name was typed with no plan open').toEqual([]);
  await info.attach('Ambiguous town name with no plan open',{body:Buffer.from(JSON.stringify({spoken,offered},null,2)),contentType:'application/json'});
});

test('tapping one offered row sets that row’s point and not the first match',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // The field lookup is cut so this measures the place switch rather than OpenStreetMap's availability; the shipped
  // sentence sets the town point before it asks for a field either way.
  await page.context().route(fields,async route=>route.abort('failed'));
  await openWithCountry(page);
  await send(page,'Athens');
  await last(page).getByRole('button',{name:'Athens · Ohio',exact:true}).click();
  await ready(page);
  const spoken=await replyText(page);
  expect(await speaker(page),'the tapped row is answered').toBe('Assistant');
  expect(spoken,'the tap confirms the town it set').toMatch(/Athens is selected as a town point\./);
  expect(await page.locator('#latitude').inputValue(),'the Ohio row’s latitude is the one put in step 1').toBe('39.32924');
  expect(await page.locator('#longitude').inputValue(),'the Ohio row’s longitude is the one put in step 1').toBe('-82.10126');
  expect(errors,'page errors while an offered ambiguous town was tapped').toEqual([]);
  await info.attach('Ambiguous town name tapped to a point',{body:Buffer.from(JSON.stringify({spoken},null,2)),contentType:'application/json'});
});
