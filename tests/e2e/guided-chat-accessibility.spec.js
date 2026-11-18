import {test,expect} from '@playwright/test';
import {scanAccessibility} from './axe-helper.js';

// The repository's axe scans covered the read-aloud and microphone states, but no scan ran on a
// state a farmer reaches by tapping the assistant's own buttons: the scope prompt, the town prompt
// and the field prompt are all rendered dynamically into the chat history, so a contrast or
// accessible-name regression inside those replies and their role="group" choice lists would pass
// every other check. Measured 18 Nov before this test: three scans, 0 violations, 51 passes each
// (contrast stayed "incomplete", which the shared helper already tolerates and does not treat as a
// pass). This walks one real Singapore flow and scans each of those states.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=page=>page.locator('#answer-status').filter({hasText:/Answer ready|Step 4 is ready/}).waitFor({timeout:120_000});
const last=page=>page.locator('#chat-history article').last();
const choice=label=>new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`);
const tap=async(page,label)=>{await last(page).locator('button[data-chat-choice]').filter({hasText:choice(label)}).click();await ready(page);};

test('every guided chat state reached by the assistant’s buttons passes the accessibility scan',async({page,context},info)=>{
  test.setTimeout(180_000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route(fields,route=>route.abort('failed'));
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
  await expect(last(page)).toContainText(/0 mapped fields were returned/);
  await scanAccessibility(page,info,'guided field prompt');

  expect(errors).toEqual([]);
});
