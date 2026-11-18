import {test,expect} from '@playwright/test';

// Measured 18 Nov: a community field service that accepts the connection and never answers keeps the
// lookup open for its whole 75 s server deadline (server/context/farms.js). The chat awaited that before
// confirming a town tap, so the panel sat on "finding community-mapped fields" with Send disabled.
// Here the field requests are hung on purpose: the farmer must still get a reply, keep the point, and
// have a way on; that the chat never re-asks the service while one is open is pinned offline.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|Error|could not|unavailable/i,{timeout:60_000});};
const last=page=>page.locator('#chat-history article').last();
const replyText=async page=>(await last(page).evaluate(node=>[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' '))).trim();
const choices=page=>last(page).locator('button[data-chat-choice]');
const labels=async page=>(await choices(page).allTextContents()).map(label=>label.trim());
const send=async(page,question)=>{await page.locator('#question').fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const tap=async(page,label)=>{await choices(page).filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();await ready(page);};

test('a town tap is answered while the field service is still holding the connection',async({page,context})=>{
  test.setTimeout(180_000);
  const errors=[],asked=[];let counting=false;
  page.on('pageerror',error=>errors.push(error.message));
  await context.route(fields,async route=>{if(counting)asked.push(route.request().url());await new Promise(()=>{});});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in Singapore');
  await tap(page,'A specific area');
  counting=true;
  const town=(await labels(page)).find(label=>!/^Whole /.test(label));
  expect(town,'the assistant offered a town button').toBeTruthy();
  const started=Date.now();
  await tap(page,town);
  const waitedMs=Date.now()-started;
  const text=await replyText(page);
  expect(waitedMs,'the reply waited for the whole service deadline instead of the chat grace').toBeLessThan(30_000);
  expect(text,'the town point is confirmed even with no field answer').toMatch(/is selected as a town point/);
  expect(text,'the reply says which part has not arrived').toMatch(/have not answered yet/);
  expect(text,'no field count is claimed before the data arrives').not.toMatch(/mapped fields were returned/);
  expect(await page.locator('#latitude').inputValue(),'the saved town point stays in the form').not.toBe('');
  const offered=await labels(page);
  expect(offered,'the waiting reply leaves a way on').toContain('Use selected point');
  expect(offered,'the waiting reply leaves a retry').toContain('Show mapped fields');
  // Only the behaviour is asserted here. Counting requests belongs in the offline test: in static mode
  // the browser-side hedge legitimately starts a second service after 6 s and a third after 12 s
  // (server/context/farms.js), so a growing count says nothing about whether the chat re-asked.
  // tests/workflow-place-choices.test.js pins that a second ask joins the open lookup instead.
  expect(asked.length,'the field services were asked at all').toBeGreaterThanOrEqual(1);
  await tap(page,'Show mapped fields');
  expect(await replyText(page)).toMatch(/have not answered yet/);
  expect(errors,'page errors while the field service hung').toEqual([]);
});
