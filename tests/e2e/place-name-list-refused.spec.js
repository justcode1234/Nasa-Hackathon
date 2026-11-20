import {test,expect} from '@playwright/test';
import {createLocationClient} from '../../server/context/locations.js';

// Iteration 67, queue item F4. F1 (iteration 66) taught a chat with no plan open to ask the saved place list about a
// bare place name; the ask was wrapped in `catch(() => null)`, so the two things a list can do - answer "no such row"
// and never answer at all - produced the same page. Measured 20 Nov on a served build, same refusal and same sentence
// (docs/evidence/iter66-f4-refusal-fallthrough-2026-11-20.log.gz): with the list refused, "Georgia" fell to the
// read-only answer and came back as "I could not match that crop to a sourced entry for Georgia." The offline side of
// this is pinned in tests/workflow-place-name-refused.test.js; these three cases are the farmer-visible halves over
// both transports, plus the bound the fix must not cross.
//
// The list is refused from before the page loads, which is the outage the farmer actually meets: step 1's own read
// fails too, so nothing can have cached a good row set for the chat to answer from. Each transport is cut where it
// really reads - the static worker fetches /data/locations/US.json itself and its adapter turns that into the authored
// 503, while the node transport reads the file from disk inside /api/locations, which no page-side route reaches, so
// its refusal is answered at the API boundary with the body the shipped adapter produces (server/context/locations.js)
// rather than a string typed out here.
//
// No page-side request counter is treated as proof of what the app read: on the static transport the worker holds its
// own cache and its reads are only visible when they reach the network (queue item F2). The counters below only
// separate "the list was down for this message" from "the list answered it", which is what the two modes mean.
const lists=/\/api\/locations\?|\/data\/locations\//;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|could not|came back|unavailable|Error/i,{timeout:60_000});};
const last=page=>page.locator('#chat-history article').last();
const speaker=async page=>(await last(page).locator('h3').textContent()).trim();
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const choiceButtons=page=>last(page).locator('button[data-chat-choice]');
const labels=async page=>(await choiceButtons(page).allTextContents()).map(label=>label.trim());
const send=async(page,text)=>{await page.locator('#question').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const tap=async(page,label)=>{await choiceButtons(page).filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();await ready(page);};
// The 503 the server writes, taken from the shipped adapter with a failing reader instead of restated here.
async function authoredRefusal(){
  const client=createLocationClient({readJson:async name=>{throw new Error(`HTTP 503 ${name}`);}});
  const error=await client({country:'US'}).then(()=>{throw new Error('the fixture read was expected to fail');},reason=>reason);
  expect(error.status,'the fixture refusal has to carry the status the page classifies').toBe(503);
  return {status:error.status,body:{error:{code:error.code,message:error.message}}};
}
// Step 1's country control, so no case below opens a plan before the sentence is typed.
async function startRefused(page,context,state){
  const refusal=await authoredRefusal();
  page.on('pageerror',error=>state.errors.push(error.message));
  await context.route(lists,async route=>{
    const url=route.request().url();
    state.counts[state.mode]++;
    if(state.mode==='refused')return url.includes('/api/locations')
      ?route.fulfill({...refusal,contentType:'application/json',body:JSON.stringify(refusal.body)})
      :route.abort('failed');
    return route.continue();
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#pest-country').selectOption('US');
  await expect(page.locator('#country-status')).toContainText(/crop production categories/,{timeout:60_000});
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
}
const refused=()=>({mode:'refused',errors:[],counts:{refused:0,answered:0}});

test('a bare place name typed while the saved list is down is reported as a failed read, not as a crop question',async({page,context},info)=>{
  test.setTimeout(180_000);
  const state=refused();
  await startRefused(page,context,state);
  expect(await page.locator('#place-region').inputValue(),'no region is selected before the message').not.toBe('GA');
  await send(page,'Georgia');
  const spoken=await replyText(page);
  expect(state.counts.refused,'the list was read for this message, so the sentence below answers a refusal').toBeGreaterThan(0);
  expect(await speaker(page),'the farmer gets an answer, not silence').toBe('Assistant');
  expect(spoken,'a read that never completed says which lookup failed').toMatch(/could not be read just now/);
  expect(spoken,'no conclusion about the list contents may be drawn from a refusal').toMatch(/cannot say which regions or towns it lists/);
  expect(spoken,'nothing may be invented in place of the missing rows').toMatch(/Nothing was selected and nothing was invented/);
  expect(spoken,`a list that refused is not a list that answered "no such row": ${spoken}`).not.toMatch(/could not match that crop/i);
  for(const claim of ['No towns are listed','no towns to choose from','no named regions','is in the saved place list'])
    expect(spoken,`a refusal reported as a finding about the data: ${spoken}`).not.toContain(claim);
  expect(await page.locator('#place-region').inputValue(),'a failed read selects no region').not.toBe('GA');
  expect(await page.locator('#latitude').inputValue(),'a failed read selects no point').toBe('');
  const offered=await labels(page);
  expect(offered,`the refusal has to offer the sentence again: ${offered.join(' | ')}`).toContain('Ask that again');
  expect(offered,'the route that needs no saved list stays available').toContain('Whole United States');
  expect(state.errors,'page errors while a bare place name met a refused place list').toEqual([]);
  await info.attach('Bare place name against a refused list',{body:Buffer.from(JSON.stringify({spoken,offered,counts:state.counts},null,2)),contentType:'application/json'});
});

// The retry is the half that makes the refusal honest: it has to send the farmer's own words back, because the
// generic `Try the place list again` from the area path asks for a specific area instead. A refusal is not cached by
// either layer, so the second read is a real one.
test('Ask that again replays the words the farmer typed and selects the place once the list answers',async({page,context},info)=>{
  test.setTimeout(240_000);
  const state=refused();
  await startRefused(page,context,state);
  await send(page,'Georgia');
  expect(await replyText(page),'the list is down for the first read').toMatch(/could not be read just now/);
  state.mode='answered';
  const askedBefore=state.counts.refused;
  await tap(page,'Ask that again');
  expect(state.counts.answered,'the retry re-asked instead of replaying the cached failure').toBeGreaterThan(0);
  expect(state.counts.refused,'nothing was read while the list was still down after the retry').toBe(askedBefore);
  const replayed=(await page.locator('#chat-history article').nth(-2).evaluate(node=>({who:node.querySelector('h3').textContent.trim(),text:node.querySelectorAll('p')[0].textContent.trim()})));
  expect(replayed.who,'the replayed sentence is the farmer’s own message, not a button label the app invented').toBe('You');
  expect(replayed.text,'the words sent on retry are the words that were typed').toBe('Georgia');
  const spoken=await replyText(page);
  expect(spoken,'the recovered read selects the place the farmer named').toMatch(/^Georgia is selected\./);
  expect(spoken,'the recovered answer does not still describe a failed lookup').not.toMatch(/could not be read/);
  expect(await page.locator('#place-region').inputValue(),'step 1 shows the region the chat selected').toBe('GA');
  expect(state.errors,'page errors while a refused place list recovered').toEqual([]);
  await info.attach('Retry after a refused list',{body:Buffer.from(JSON.stringify({replayed,spoken,counts:state.counts},null,2)),contentType:'application/json'});
});

// The bound: only a message with the shape of a place name gets the place-list sentence. The read itself stays
// wording-blind, so gating the reply on the refusal alone would answer any long sentence with a lookup complaint
// (measured 21 Nov on the first version of this branch). A folded message longer than 60 characters is outside
// `mentionPhrase`, which is what this case crosses: whatever the read-only answer says, it must not be about the list,
// and it must not select anything. Its control is the module with `&& mentionPhrase(question)` removed - see
// docs/evidence/iter67-f4-* - which turns this case red.
test('a sentence too long to be a place name is not answered with the place-list failure',async({page,context},info)=>{
  test.setTimeout(180_000);
  const state=refused();
  await startRefused(page,context,state);
  const question='How much rain fell in Georgia last year, and what should I plant there after maize?';
  expect(question.length,'the sentence has to sit outside the place-name shape this reply is gated on').toBeGreaterThan(60);
  await send(page,question);
  const spoken=await replyText(page);
  expect(await speaker(page),'the long sentence gets an answer').toBe('Assistant');
  expect(spoken,`a question that names no place to select is not a place lookup: ${spoken}`).not.toMatch(/saved place list for United States/);
  expect(await labels(page),'the place-list recovery buttons are not attached to this answer').not.toContain('Ask that again');
  expect(await page.locator('#place-region').inputValue(),'a sentence with no place shape selects no region').not.toBe('GA');
  expect(state.errors,'page errors while a long sentence met a refused place list').toEqual([]);
  await info.attach('Long sentence against a refused list',{body:Buffer.from(JSON.stringify({question,spoken,offered:await labels(page),counts:state.counts},null,2)),contentType:'application/json'});
});
