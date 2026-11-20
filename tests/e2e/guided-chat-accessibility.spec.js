import {test,expect} from '@playwright/test';
import {scanAccessibility} from './axe-helper.js';

// The repository's axe scans covered the read-aloud and microphone states, but no scan ran on a
// state a farmer reaches by tapping the assistant's own buttons: the scope prompt, the town prompt
// and the field prompt are all rendered dynamically into the chat history, so a contrast or
// accessible-name regression inside those replies and their role="group" choice lists would pass
// every other check. Measured 18 Nov before this test: three scans, 0 violations, 51 passes each
// (contrast stayed "incomplete", which the shared helper already tolerates and does not treat as a
// pass). This walks one real Singapore flow and scans each of those states.
// Extended 20 Nov, iteration 58: the flow now holds four scans. A refused field lookup and an answered-but-empty one
// are different replies with different buttons, and only the second one can be reached without the services refusing.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=page=>page.locator('#answer-status').filter({hasText:/Answer ready|Step 4 is ready/}).waitFor({timeout:120_000});
const last=page=>page.locator('#chat-history article').last();
const choice=label=>new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`);
const tap=async(page,label)=>{await last(page).locator('button[data-chat-choice]').filter({hasText:choice(label)}).click();await ready(page);};

test('every guided chat state reached by the assistant’s buttons passes the accessibility scan',async({page,context},info)=>{
  test.setTimeout(180_000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let mode='refuse';
  await context.route(fields,async route=>{
    if(mode==='refuse') return route.abort('failed');
    if(route.request().url().includes('/api/farms?')) return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({schemaVersion:1,retrievedAt:'2026-11-20T00:00:00.000Z',source:{title:'OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright'},farms:[],notices:['The search covers a small area around your selection.']})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:[]})});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await page.locator('#question').fill('Help me plan a rotation in Singapore');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await ready(page);
  await expect(last(page)).toContainText('Which part of Singapore');
  await scanAccessibility(page,info,'guided scope prompt');

  await tap(page,'A specific area');
  await expect(last(page)).toContainText(/no named regions/i);
  // The scan is only worth something if the reply really carries the dynamic choice group.
  const offered=last(page).locator('button[data-chat-choice]');
  expect(await offered.count()).toBeGreaterThan(0);
  await scanAccessibility(page,info,'guided town prompt');

  const label=(await offered.first().textContent()).trim();
  await tap(page,label);
  await expect(last(page)).toContainText(`${label} is selected as a town point`);
  // Rewritten stricter 20 Nov, iteration 58. This spec aborts the field services, so the reply it scans is a lookup
  // failure. The superseded assertion pinned /0 mapped fields were returned/, which only held because the chat read a
  // transport refusal as an empty map; tests/e2e/field-service-failure.spec.js now pins that sentence to answered
  // lookups alone. Scanning the failure reply covers a state the old assertion could never reach.
  await expect(last(page)).toContainText(/field lookup did not complete/i);
  await expect(last(page)).not.toContainText(/mapped fields were returned/);
  await scanAccessibility(page,info,'guided field lookup failure');

  // The field prompt is only reached by a lookup that answered, so the same retry now runs against services that do
  // reply. Asking again must re-ask: the cached answer of a refused lookup cannot exist, and a count sentence here
  // would still mean the chat had confused a refusal with an empty map.
  mode='answered';
  await tap(page,'Show mapped fields');
  await expect(last(page)).toContainText(/0 mapped fields were returned/);
  await scanAccessibility(page,info,'guided field prompt');

  expect(errors).toEqual([]);
});
