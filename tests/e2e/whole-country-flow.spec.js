import {test,expect} from '@playwright/test';

// User-reported failure (15 Nov): the India starter -> "Whole India" ended in a dead end, the
// reply claimed crops were "retained" while step 3 was empty, and picking a town afterwards
// wiped the crops. This is the click-only path a farmer takes. Real NASA data; fields are
// not part of this flow, so field lookups are blocked to keep it independent of Overpass.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const crops=page=>page.locator('[id^=baseline-]').evaluateAll(nodes=>nodes.map(node=>node.value));

test('whole-country starter flow keeps the crops and reaches step 4 by clicking',async({page,context})=>{
  test.setTimeout(180_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  const chat=page.locator('#chat-history');
  const tap=async name=>{await chat.getByRole('button',{name,exact:true}).last().click();await expect(page.locator('#answer-status')).toContainText(/ready|Step 4/,{timeout:90_000});};
  await page.getByRole('button',{name:'Plan tomatoes, cabbage and onions in India',exact:true}).click();
  await expect(chat.getByRole('button',{name:'Whole India',exact:true})).toBeVisible({timeout:60_000});
  await tap('Whole India');
  const overview=chat.locator('article').last();
  await expect(overview).toContainText('Your crops are entered in step 3: Tomato → Cabbage → Bulb onion');
  expect(await crops(page)).toEqual(['tomato','cabbage','onion']);
  await expect(page.locator('#irrigation')).toHaveValue('rainfed');
  // A whole country never becomes a farm point or a weather reading.
  await expect(page.locator('#latitude')).toHaveValue('');await expect(page.locator('.scenario')).toHaveCount(0);
  await tap('Choose a state or region');
  const regions=await chat.locator('article').last().getByRole('button').allTextContents();
  expect(regions.filter(name=>name!=='Read aloud').length,'tappable region shortcuts').toBe(3);
  await tap('Maharashtra');
  await expect(chat.locator('article').last()).toContainText('Maharashtra is selected');
  await expect(page.locator('#place-region')).toHaveValue('16');
  // The farmer picks a town in step 1 themselves.
  const pune=await page.locator('#place-town option').evaluateAll(options=>options.find(option=>/^Pune\b/.test(option.textContent))?.value);
  expect(pune,'Pune is in the saved place list').toBeTruthy();
  await page.locator('#place-town').selectOption(pune);
  await expect(page.locator('#latitude')).not.toHaveValue('');
  expect(await crops(page),'a same-country town change must not wipe step 3').toEqual(['tomato','cabbage','onion']);
  await chat.getByRole('button',{name:'Continue planning with this location',exact:true}).click();
  await expect(page.locator('.scenario')).toHaveCount(3,{timeout:120_000});
  await expect(page.locator('#strategy')).toBeVisible();
  await expect(page.locator('.timeline').first().locator('h4')).toHaveText(['1. Tomato','2. Cabbage','3. Bulb onion']);
  const sequences=await page.locator('.timeline').evaluateAll(nodes=>nodes.map(node=>[...node.querySelectorAll('h4')].map(h=>h.textContent).join(' / ')));
  expect(new Set(sequences).size,'baseline and two distinct alternatives').toBe(3);
  await expect(page.locator('#evidence-output a').first()).toHaveAttribute('href',/^https:\/\/power\.larc\.nasa\.gov\//);
  expect(errors).toEqual([]);
});

test('rotation follow-ups only appear when there is sourced content, and rice gets a family answer',async({page,context})=>{
  await context.route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  const ask=async question=>{await page.locator('#question').fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});return page.locator('#chat-history article').last();};
  const rice=await ask('How does rice fit a rotation in India?');
  await expect(rice).toContainText('grain family');await expect(rice).not.toContainText('I do not have a verified rotation rule');
  await rice.locator('summary').filter({hasText:/^Sources/}).click();
  await expect(rice.getByRole('link',{name:/Cornell/})).toBeVisible();
  const cassava=await ask('Tell me about cassava in Ghana');
  const buttons=await cassava.getByRole('button').allTextContents();
  expect(buttons,'no follow-up that leads to "no verified information"').not.toContain('Rotation role');
  expect(buttons).not.toContain('Growing conditions');
});
