import {test,expect} from '@playwright/test';

// Iteration 70, queue item F3. Iteration 69's ledger left this line: the region branch answered a sentence naming the
// region the plan already holds by selecting that region again - `chooseRegion` with the id already in the dropdown -
// and `public/js/modules/context.js:237` routes every one of those calls through `locationChanged`, which clears the
// town the farmer picked, the point beside it and the evidence loaded for it. The unit cases in
// tests/workflow-place-choices.test.js can only report the call list and the fake state object; what a farmer sees is
// the step 1 Town dropdown going back to "Choose a town / city" and #latitude emptying. This file reads those two
// controls, on all four transports.
// The scenario the handoff describes (docs/handoff-2026-11-18.md:1552) is the replay of a refused place-list read, and
// whether the page can reach it depends on the transport. Measured rather than assumed
// (docs/evidence/iter70-f2-list-cache-blind-2026-11-21.log.gz): with the route armed to fail, the static transport
// makes no list request at all once step 1 has read China - it fetched /data/locations/manifest.json and
// /data/locations/CN.json during the country selection and every later assistant read was served from that, so the
// counters hold at {"refused":0,"answered":2} across three sends - while the node transport issues a fresh
// /api/locations?country=CN per assistant read, so a refusal and its `Ask that again` replay are reachable there. The
// last case drives that arm and takes its branch from the counters, so each transport asserts what it can show; the
// static blindness itself is queue item F2, and it is a client-side cache rather than the server-side one the handoff
// names. The two cases before it hold a point and a region the app itself recorded, which is the state the branch is
// keyed on, and run on all four transports.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const lists=/\/api\/locations\?|\/data\/locations\//;
const baotou={id:'2038432',lat:'40.6516',lng:'109.84389'},bayanHot={id:'1816821',lat:'38.83861',lng:'105.66861'};
const last=page=>page.locator('#chat-history article').last();
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|could not respond|came back|unavailable|Error/i,{timeout:60_000});};
const send=async(page,text)=>{await page.locator('#question').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const offered=async page=>(await last(page).locator('button[data-chat-choice]').allTextContents()).map(label=>label.trim());
const speaker=async page=>(await last(page).locator('h3').textContent()).trim();
const held=async page=>({town:await page.locator('#place-town').inputValue(),region:await page.locator('#place-region').inputValue(),
  latitude:await page.locator('#latitude').inputValue(),longitude:await page.locator('#longitude').inputValue()});
const tapTown=async(page,name)=>{await last(page).locator('button[data-chat-choice]').filter({hasText:new RegExp(`^${name}$`)}).click();await ready(page);};

test('a farmer who picked the region in step 1 and then types its name keeps the town point they picked',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.locator('#pest-country').selectOption('CN');
  await expect(page.locator('#place-region')).not.toHaveValue('',{timeout:60_000});
  await page.locator('#place-region').selectOption('20');
  await page.locator('#place-town').selectOption(baotou.id);
  await expect(page.locator('#latitude')).not.toHaveValue('');
  const picked=await held(page);
  expect(picked.latitude,'step 1 holds the Baotou row of the saved China list').toBe(baotou.lat);
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in China');
  expect(await held(page),'starting a guided plan in the country already selected moves no point').toEqual(picked);
  const asked=await replyText(page);
  expect(asked,'the plan asks the town question it has not been answered').toMatch(/Which town in Inner Mongolia/i);

  await send(page,'Inner Mongolia');
  const reply=await replyText(page);
  expect(reply,'naming the region the plan is already in selects it a second time').toMatch(/Inner Mongolia is the region this plan is already in/i);
  expect(reply,'the defect sentence, which claimed a choice the farmer already had').not.toMatch(/Inner Mongolia is selected/i);
  expect(reply,'the reply states the point that stays').toContain(`${baotou.lat}, ${baotou.lng}`);
  expect(await held(page),'the town, its point and the region survive the sentence').toEqual(picked);
  const labels=await offered(page);
  expect(labels,'the way forward includes the towns of that region and the continue step').toEqual(
    expect.arrayContaining(['Bayan Hot','Continue planning with this location']));
  // The retained state has to be usable, not just intact: the town button the reply offers still moves the point.
  await tapTown(page,'Bayan Hot');
  const moved=await held(page);
  expect([moved.latitude,moved.longitude],'the offered town sets its own point').toEqual([bayanHot.lat,bayanHot.lng]);
  expect(moved.town,'and the step 1 Town list follows it').toBe(bayanHot.id);
  expect(errors,'page errors while the region name was typed twice over a step 1 selection').toEqual([]);
  await info.attach('Region named while step 1 holds its town',
    {body:Buffer.from(JSON.stringify({picked,asked,reply,labels,moved},null,2)),contentType:'application/json'});
});

test('the same region sentence typed twice inside one guided plan is not a second selection',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  // Every step through the chat, so nothing here depends on how step 1 writes its controls: the plan is opened, the
  // region is chosen, a town inside it is chosen, and then the farmer repeats the region word they already used.
  await send(page,'Help me plan a rotation in China');
  await send(page,'Inner Mongolia');
  expect(await replyText(page),'the first time the sentence is a choice').toMatch(/Inner Mongolia is selected/i);
  expect((await held(page)).region,'and it reaches the step 1 region list').toBe('20');
  await send(page,'Baotou');
  const point=await held(page);
  expect([point.latitude,point.longitude],'the town named next sets its point').toEqual([baotou.lat,baotou.lng]);
  expect(point.town,'which is the row the step 1 Town list holds').toBe(baotou.id);

  await send(page,'Inner Mongolia');
  expect(await speaker(page),'the repeated sentence is answered').toBe('Assistant');
  const reply=await replyText(page);
  expect(reply,'a repeat of the region already in place answers the town question, not a new selection').toMatch(/is the region this plan is already in/i);
  expect(reply,'the defect sentence, which dropped the point below it').not.toMatch(/Inner Mongolia is selected/i);
  expect(await held(page),'the point, the town and the region all stay where the farmer put them').toEqual(point);
  expect(await offered(page),'the continue step is offered against the point that stays').toContain('Continue planning with this location');
  expect(errors,'page errors while one region sentence was typed twice inside a guided plan').toEqual([]);
  await info.attach('Region sentence repeated inside a guided plan',
    {body:Buffer.from(JSON.stringify({point,reply,offered:await offered(page)},null,2)),contentType:'application/json'});
});

test('the replay of a refused place-list read keeps the town point the refusal promised to keep',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const counts={refused:0,answered:0};let mode='answered';
  await page.context().route(fields,route=>route.abort('failed'));
  await page.context().route(lists,async route=>{
    if(mode==='refused'){counts.refused++;return route.abort('failed');}
    counts.answered++;return route.continue();
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.locator('#pest-country').selectOption('CN');
  await expect(page.locator('#place-region')).not.toHaveValue('',{timeout:60_000});
  await page.locator('#place-region').selectOption('20');
  await page.locator('#place-town').selectOption(baotou.id);
  await expect(page.locator('#latitude')).not.toHaveValue('');
  const picked=await held(page);
  const stepOneReads=JSON.parse(JSON.stringify(counts));
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  mode='refused';
  await send(page,'Help me plan a rotation in China');
  const listWasRead=counts.refused>0;
  await send(page,'Inner Mongolia');
  const refusal=await replyText(page);
  const offeredWithRefusal=await offered(page);
  let arm='list-never-requested';
  if(listWasRead){
    arm='refusal-replayed';
    expect(refusal,'the assistant cannot read the list, so it says so instead of choosing').toMatch(/could not be read just now/i);
    expect(offeredWithRefusal,'the refusal offers the replay of the same sentence').toContain('Ask that again');
    expect(refusal,'and states that nothing was dropped while it could not read').toMatch(/no region, point or loaded evidence was dropped/i);
    mode='answered';
    await last(page).locator('button[data-chat-choice]').filter({hasText:/^Ask that again$/}).click();
    await ready(page);
    const replayed=await replyText(page);
    expect(replayed,'the replay answers the town question against the point that stays').toMatch(/is the region this plan is already in/i);
    expect(replayed,'the defect sentence, which claimed a choice the farmer already had').not.toMatch(/Inner Mongolia is selected/i);
    expect(replayed,'the reply names the point it keeps').toContain(`${baotou.lat}, ${baotou.lng}`);
    expect(await offered(page),'the way forward after the replay includes the towns of that region and the continue step').toEqual(
      expect.arrayContaining(['Bayan Hot','Continue planning with this location']));
  }else{
    expect(refusal,'the list was answered from what the page already holds, so the sentence is the plain one').toMatch(
      /is the region this plan is already in/i);
    expect(refusal,'the defect sentence, which claimed a choice the farmer already had').not.toMatch(/Inner Mongolia is selected/i);
    expect(offeredWithRefusal,'and the way forward is the same one the replayed transport offers').toEqual(
      expect.arrayContaining(['Bayan Hot','Continue planning with this location']));
  }
  expect(await held(page),'the town, its point and the region survive on either arm').toEqual(picked);
  expect(errors,'page errors while the place list was armed to fail').toEqual([]);
  console.log(`REGION-REPEAT ${info.project?.name ?? 'unknown'} arm=${arm} step-one-reads=${JSON.stringify(stepOneReads)} final-counts=${JSON.stringify(counts)}`);
  await info.attach('Place-list refusal and its replay, per transport',
    {body:Buffer.from(JSON.stringify({project:info.project?.name ?? 'unknown',arm,picked,stepOneReads,counts,refusal,offeredWithRefusal},null,2)),contentType:'application/json'});
});
