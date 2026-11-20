import {test,expect} from '@playwright/test';

// Measured 20 Nov on this branch, on static-desktop, static-mobile, node-desktop and node-mobile alike: a guided plan
// that names its own coordinates is checked against the place service by `await request('/api/places?…')` at
// public/js/modules/workflow-assistant.js:449, which no branch catches. Before this iteration the ask then rejected
// into the catch at public/js/modules/chat.js:149, which wrote the failure into the status line at :155
// and nowhere else, while the composer had already been emptied at :91 - before the request was even made.
// The farmer's sentence survived only as their own message higher up the history, where it cannot be sent, and
// the status line that explains the failure is overwritten by the next message.
// The three probes that found this are in artifacts/scratch/iter59/ and each result below was measured, not assumed: a
// catalogue question answers from bundled data with zero requests (server/api.js:55) so it cannot fail, the composer's
// maxlength=500 agrees with the handler's own 1-500 limit so the 400 at server/api.js:46 is unreachable by typing, and
// an evidence question with every external host cut never reaches the network at all while no place is selected. The
// refused reverse lookup is the failure a farmer can actually hit, and cutting one service is enough to prove it.
// One regex covers both transports because the worker fetches the place service itself on static while the Node build
// asks the app's own /api/places: the same interception the field specs already use, resolved locally, no live service.
const places=/nominatim\.openstreetmap\.org|\/api\/places\?/;
const question='Use my point 1.3521, 103.8198 to plan a rotation in Singapore';
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|could not respond|came back|unavailable|Error/i,{timeout:60_000});};
const last=page=>page.locator('#chat-history article').last();
const speaker=async page=>(await last(page).locator('h3').textContent()).trim();
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const composer=page=>page.locator('#question').inputValue();
const send=async(page,text)=>{await page.locator('#question').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};

test('a refused ask leaves the message in the composer so the farmer can send it again',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[],counts={refuse:0,answered:0};let mode='refuse';
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().route(places,async route=>{
    counts[mode]++;
    if(mode==='refuse') return route.abort('failed');
    // A place service that answered: the Node build is asked through the app's own /api/places contract and the static
    // worker is asked by Nominatim's reverse contract, and both mean "this point is in Singapore".
    if(route.request().url().includes('/api/places?')) return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({schemaVersion:1,places:[{name:'Singapore',latitude:1.3521,longitude:103.8198,countryCode:'SG',
        country:'Singapore',region:'Central'}],source:{title:'OpenStreetMap / Nominatim',url:'https://www.openstreetmap.org/copyright'},
        retrievedAt:'2026-11-20T00:00:00.000Z'})});
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({address:{country_code:'sg',country:'Singapore',state:'Central'},display_name:'Singapore',lat:'1.3521',lon:'103.8198'})});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in Singapore');
  await send(page,question);

  expect(counts.refuse,'the guided plan asked the place service about the typed point').toBeGreaterThan(0);
  const refusedStatus=await page.locator('#answer-status').textContent();
  expect(refusedStatus,'the failure is reported in the status line').toMatch(/could not respond|no answer came back/i);
  expect(await speaker(page),'the refusal echoes the farmer and invents no assistant reply').toBe('You');
  expect(await page.locator('#latitude').inputValue(),'a refused reverse lookup must not set a location').toBe('');
  expect(await page.locator('#longitude').inputValue(),'a refused reverse lookup must not set a location').toBe('');
  expect(await composer(page),'the refused message must still be in the composer, ready to send again').toBe(question);
  await expect(page.locator('#ask'),'the send button is live again after the refusal').toBeEnabled();

  // The retry is the point of the assertion above: the farmer presses Send again without retyping, and the message that
  // comes back is the one they wrote. Nothing here re-fills the field - if the composer is empty the form submit
  // returns at public/js/modules/chat.js:83 and the counts below stay at zero.
  mode='answered';
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await ready(page);
  expect(counts.answered,'the retained message was put to the place service again').toBeGreaterThan(0);
  expect(await page.locator('#latitude').inputValue(),'the retried point is the one in the sentence').toBe('1.3521');
  expect(await page.locator('#longitude').inputValue(),'the retried point is the one in the sentence').toBe('103.8198');
  expect(await speaker(page),'the retry is answered').toBe('Assistant');
  expect(await replyText(page),'the retried plan continues from the verified point').toMatch(/location is set/i);
  expect(await composer(page),'a message that was answered is cleared from the composer').toBe('');
  expect(errors,'page errors while the place service refused once and then answered').toEqual([]);
  await info.attach('Refused and retried ask',{body:Buffer.from(JSON.stringify({counts,refusedStatus,question,retriedStatus:await page.locator('#answer-status').textContent()},null,2)),contentType:'application/json'});
});

// The restore is guarded by `$('question').value === ''` because dictation writes into this field while a request is in
// flight, so a non-empty composer at the moment of the failure holds text the farmer wrote after sending. The empty-box
// case above cannot see that: without the guard it passes too. This is the case that makes the guard load-bearing.
test('a message written into the composer while the ask was in flight is not pasted over by the refusal',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[];const typed='Also look at the lower field after the rain';
  page.on('pageerror',error=>errors.push(error.message));
  let asked=0;
  await page.context().route(places,async route=>{
    asked++;
    // Hold the lookup open so the second message is genuinely written while the first is still in flight, then refuse it.
    await new Promise(resolve=>setTimeout(resolve,2_500));
    return route.abort('failed');
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in Singapore');
  await page.locator('#question').fill(question);
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.locator('#question').fill(typed);
  await ready(page);
  expect(asked,'the held place lookup was refused').toBeGreaterThan(0);
  expect(await page.locator('#answer-status').textContent(),'the refusal is still reported').toMatch(/could not respond|no answer came back/i);
  expect(await composer(page),'the refused message must not overwrite what the farmer wrote next').toBe(typed);
  expect(await page.locator('#chat-history article').last().evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' ')),'the sentence waiting in the composer is not also in the history').not.toContain(typed);
  expect(errors,'page errors while the place lookup was held open and then refused').toEqual([]);
  await info.attach('Refusal against a composer already in use',{body:Buffer.from(JSON.stringify({asked,typed,status:await page.locator('#answer-status').textContent()},null,2)),contentType:'application/json'});
});

// Iteration 65, queue item F5. The same kind of sentence reaches a second saved-list read, the one that cross-checks
// the typed point against the country's regions and towns - and that read sat outside any try/catch, where a refusal
// escaped the handler instead of answering. It is only ever reached as a retry of a refusal, because the shared read
// above it caches what a successful read returned. On the page that meant the guided plan moved to the country the
// farmer named, the point was dropped, and the ask settled as a failed send with the sentence waiting in the composer
// (public/js/modules/chat.js:149, the path this file's first case exists for). This is the same coordinate sentence
// over both transports, with the place service answered from the contract bodies above so the saved-list refusal is
// the only failure in it and no live geocoder is trusted with the result.
const lists=/\/api\/locations\?|\/data\/locations\//;
const coord='Use my point 18.52, 73.85 to plan a rotation in India';
test('a coordinate sentence whose saved list refused is answered, and its point is taken on the replay',async({page},info)=>{
  test.setTimeout(180_000);
  const errors=[],counts={listRefused:0,listAnswered:0,places:0};let mode='refused';
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().route(places,async route=>{
    counts.places++;
    if(route.request().url().includes('/api/places?')) return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({schemaVersion:1,places:[{name:'Pune',latitude:18.52,longitude:73.85,countryCode:'IN',
        country:'India',region:'Maharashtra'}],source:{title:'OpenStreetMap / Nominatim',url:'https://www.openstreetmap.org/copyright'},
        retrievedAt:'2026-11-20T00:00:00.000Z'})});
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({address:{country_code:'in',country:'India',state:'Maharashtra'},display_name:'Pune, Maharashtra',lat:'18.52',lon:'73.85'})});
  });
  await page.context().route(lists,async route=>{
    if(mode==='refused'){counts.listRefused++;return route.abort('failed');}
    counts.listAnswered++;return route.continue();
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in India');
  expect(counts.listRefused,'the plan is open in a country whose saved list has refused').toBeGreaterThan(0);

  await send(page,coord);
  expect(counts.places,'the typed point was put to the place service, so the refusal below is the list read and not a lookup').toBeGreaterThan(0);
  const status=await page.locator('#answer-status').textContent();
  expect(status,`a saved-list refusal at the coordinate branch must answer, not fail the send: ${status}`).not.toMatch(/could not respond|no answer came back/i);
  expect(await speaker(page),'the assistant replies instead of leaving the farmer own message last').toBe('Assistant');
  const spoken=await replyText(page);
  expect(spoken,'the reply names the read that failed').toMatch(/saved place list for India could not be read just now/i);
  expect(spoken,'the coordinates the farmer typed are quoted back').toMatch(/18\.52, 73\.85/);
  expect(spoken,'the country the sentence moved the plan into is a fact it may state').toMatch(/India is the country this plan is in/i);
  for(const claim of ['is selected','No towns are listed','no towns to choose from'])
    expect(spoken,`a read that never completed became a finding about the data: ${spoken}`).not.toContain(claim);
  expect(await page.locator('#latitude').inputValue(),'a point this app could not cross-check must not be set').toBe('');
  expect(await page.locator('#longitude').inputValue(),'a point this app could not cross-check must not be set').toBe('');
  const offered=(await last(page).locator('button[data-chat-choice]').allTextContents()).map(label=>label.trim());
  expect(offered,`the sentence has to stay replayable: ${offered.join(' | ')}`).toContain('Ask that again');

  mode='answered';
  const answeredBefore=counts.listAnswered;
  await last(page).locator('button[data-chat-choice]').filter({hasText:/^Ask that again$/}).click();
  await ready(page);
  expect(counts.listAnswered,'the replay re-asked the saved list instead of replaying the refusal').toBeGreaterThan(answeredBefore);
  expect(await speaker(page),'the replayed sentence is answered').toBe('Assistant');
  expect(await replyText(page),'a read that answered is not reported as a failure').not.toMatch(/could not be read/i);
  expect(await page.locator('#latitude').inputValue(),'the replayed point is the one in the sentence').toBe('18.52');
  expect(await page.locator('#longitude').inputValue(),'the replayed point is the one in the sentence').toBe('73.85');
  expect(errors,'page errors while the saved list refused once and then answered').toEqual([]);
  await info.attach('Coordinate ask against a refused saved list',{body:Buffer.from(JSON.stringify({counts,status,spoken,offered},null,2)),contentType:'application/json'});
});
