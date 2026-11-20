import {test,expect} from '@playwright/test';

// Measured 20 Nov on this branch, on static-desktop, static-mobile, node-desktop and node-mobile alike: when the
// community field services refuse the lookup, `loadFarms()` reports the failure into step 2 and catches it there,
// so the guided assistant never learns the lookup failed. It read the leftover empty `state.farms` as a result and
// answered "0 mapped fields were returned" — a statement about what is mapped near the farmer's point, drawn from
// a transport failure — and, unlike the waiting reply pinned in field-service-latency.spec.js, it offered only
// `Use selected point`: no way to ask again from inside the chat.
// The pair below is the point of the test: the same sentence about the same empty list is correct when a service
// answered and found no farmland, and must not be said when no service answered at all. A third phase fails the retry
// after a successful one, because the two ways of asking for fields run through different branches of the assistant.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|Error|could not|unavailable/i,{timeout:60_000});};
const last=page=>page.locator('#chat-history article').last();
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const choices=page=>last(page).locator('button[data-chat-choice]');
const labels=async page=>(await choices(page).allTextContents()).map(label=>label.trim());
const send=async(page,question)=>{await page.locator('#question').fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const tap=async(page,label)=>{await choices(page).filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();await ready(page);};

test('a refused field lookup is reported as a failure, not as an empty map, and keeps a retry',async({page,context},info)=>{
  test.setTimeout(180_000);
  const errors=[],counts={refuse:0,answered:0};let mode='refuse';
  page.on('pageerror',error=>errors.push(error.message));
  await context.route(fields,async route=>{
    counts[mode]++;
    if(mode==='refuse') return route.abort('failed');
    // A service that answered: the node transport is asked through the app's own /api/farms contract, the static
    // worker is asked by the Overpass instance contract, and both mean "no farmland polygon in this search box".
    if(route.request().url().includes('/api/farms?')) return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({schemaVersion:1,retrievedAt:'2026-11-20T00:00:00.000Z',source:{title:'OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright'},farms:[],notices:['The search covers a small area around your selection.']})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:[]})});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in Singapore');
  await tap(page,'A specific area');
  const town=(await labels(page)).find(label=>!/^Whole /.test(label));
  expect(town,'the assistant offered a town button').toBeTruthy();
  await tap(page,town);

  const refused=await replyText(page);
  expect(refused,'the town point the farmer tapped is still confirmed').toMatch(/is selected as a town point/);
  expect(refused,'a lookup that never completed must not be reported as a returned field count').not.toMatch(/mapped fields were returned/);
  expect(refused,'the reply must say the lookup did not complete').toMatch(/field lookup did not complete/i);
  expect(refused,'the reply must not draw a coverage conclusion it cannot support').toMatch(/cannot say whether any mapped fields exist/i);
  expect(refused,'nothing may be invented in place of the missing list').toMatch(/no field list is shown/i);
  expect(await page.locator('#latitude').inputValue(),'the saved town point stays in the form').not.toBe('');
  expect(await page.locator('#farms-status').textContent(),'step 2 keeps saying which part failed').toMatch(/no answer came back|busy or unavailable/i);
  const afterRefusal=await labels(page);
  expect(afterRefusal,'the failure reply keeps the way on').toContain('Use selected point');
  expect(afterRefusal,'the failure reply must offer the retry the waiting reply already offers').toContain('Show mapped fields');

  // A second refusal, asked through the retry button the failure reply just offered, runs the other branch of the
  // assistant: with a point already in place `Show mapped fields` is the `parsed.findFarms` branch, not the town-tap
  // branch. Tapping proves the button is wired and not merely shown. These refusals must come before the answered
  // phase, not after it: the first successful lookup is held for 24 h by createCachedJson (server/context/client.js)
  // and a retry for the same point is then answered from that cache with no request leaving, so a refusal after a
  // success reads as an answered lookup on static where the node transport is still cut at /api/farms.
  await tap(page,'Show mapped fields');
  const refailed=await replyText(page);
  expect(refailed,'the selected point survives a failed retry').toMatch(/selected point is still in place/);
  expect(refailed,'a failed retry must not report the field count of a lookup that never completed').not.toMatch(/mapped fields were returned/);
  expect(refailed,'the retry reply says the lookup did not complete').toMatch(/field lookup did not complete/i);
  expect(await page.locator('#latitude').inputValue(),'the point stays in the form after a failed retry').not.toBe('');
  expect(await page.locator('#farms-status').textContent(),'step 2 still names the failed part after a retry').toMatch(/no answer came back|busy or unavailable/i);
  const afterRetryFailure=await labels(page);
  expect(afterRetryFailure,'the failed retry keeps the way on').toContain('Use selected point');
  expect(afterRetryFailure,'the failed retry can be asked again').toContain('Show mapped fields');

  // Asking again must actually re-ask, not replay the earlier empty list.
  mode='answered';
  await tap(page,'Show mapped fields');
  const answered=await replyText(page);
  expect(counts.answered,'the field services were asked again after the refusal').toBeGreaterThan(0);
  expect(answered,'a lookup that completed and returned nothing may report its count').toMatch(/0 mapped fields were returned/);
  expect(answered,'the answered reply keeps its own coverage limit').toMatch(/Map coverage and crop tags may be incomplete/i);
  expect(await page.locator('#farms-status').textContent(),'step 2 reports the answered count').toMatch(/0 mapped fields returned/);
  expect(await labels(page),'the returned list is empty so only the point is offered').toContain('Use selected point');
  expect(errors,'page errors while the field services refused twice and then answered').toEqual([]);
  await info.attach('Refused and answered field lookups',{body:Buffer.from(JSON.stringify({town,counts,refused,afterRefusal,refailed,afterRetryFailure,answered},null,2)),contentType:'application/json'});
});
