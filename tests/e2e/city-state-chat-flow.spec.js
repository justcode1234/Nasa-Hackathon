import {test,expect} from '@playwright/test';

// User-reported failure (17 Nov): Singapore has no named regions in the saved place list, so
// the assistant ping-ponged between "Whole Singapore" and "A specific area" and no chat button
// could finish step 1. This spec clicks only what a farmer sees, with real NASA evidence.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const ready=async page=>{await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready/,{timeout:120_000});};
const send=async (page,question)=>{await page.locator('#question').fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await ready(page);};
const last=page=>page.locator('#chat-history article').last();
const choiceLabels=async page=>(await last(page).locator('button[data-chat-choice]').allTextContents()).map(label=>label.trim());
const tap=async (page,label)=>{await last(page).locator('button[data-chat-choice]').filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();await ready(page);};

test('Singapore city-state chat path: every button advances and no reply repeats',async({page,context})=>{
  test.setTimeout(240_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  await send(page,'Help me plan a rotation in Singapore');
  expect(await choiceLabels(page)).toEqual(['Whole Singapore','A specific area']);
  await tap(page,'A specific area');
  await expect(last(page)).toContainText(/no named regions/i);
  const towns=await choiceLabels(page);
  // A prompt that only works if the fourth choice survives: the UI must render every
  // offered choice, not silently drop the last button.
  expect(towns).toEqual(['Admiralty','Alexandra Estate','Anak Bukit','Whole Singapore']);
  await expect(last(page)).toContainText('not a recommendation');
  await tap(page,'Alexandra Estate');
  await expect(last(page)).toContainText('Alexandra Estate is selected as a town point');
  await expect(page.locator('#latitude')).not.toHaveValue('');
  await expect(page.locator('#place-region').locator('..')).toBeHidden();
  const firstPoint=await page.locator('#latitude').inputValue();
  // A partial name must offer the real candidates instead of silently giving up.
  await send(page,'Jurong');
  await expect(last(page)).toContainText('Several listed towns match');
  expect(await choiceLabels(page)).toEqual(['Jurong East','Jurong Town','Jurong West']);
  await tap(page,'Jurong East');
  await expect(last(page)).toContainText('Jurong East is selected as a town point');
  const secondPoint=await page.locator('#latitude').inputValue();
  expect(secondPoint,`re-naming the town must move the point (was ${firstPoint})`).not.toBe(firstPoint);
  await tap(page,'Use selected point');
  await expect(last(page)).toContainText('three existing crops');
  await send(page,'crops: cabbage, tomato, spinach');
  await expect(last(page)).toContainText('Step 4 is ready');
  await expect(page.locator('.scenario')).toHaveCount(3,{timeout:120_000});
  const articles=await page.locator('#chat-history article').evaluateAll(nodes=>nodes
    .map(node=>({who:node.querySelector('h3')?.textContent,text:[...node.querySelectorAll(':scope > p')].map(p=>p.textContent).join(' | ')})));
  const replies=articles.filter(article=>article.who==='Assistant').map(article=>article.text);
  // Seven messages were sent (3 typed, 4 button taps): every one must answer exactly once,
  // and no reply may repeat, which is what the old region ping-pong looked like.
  expect(articles.filter(article=>article.who==='You'),'"You" messages').toHaveLength(7);
  expect(replies.filter((entry,index)=>replies.indexOf(entry)!==index),'no reply is asked twice').toEqual([]);
  expect(replies.length,'every sent message produced exactly one reply').toBe(7);
  expect(errors).toEqual([]);
});

test('the three example buttons in the chat box send their own question',async({page,context})=>{
  test.setTimeout(180_000);
  await context.route(fields,route=>route.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
  const starters=page.locator('#chat-examples button');
  await expect(starters).toHaveCount(3);
  const prompts=await starters.evaluateAll(nodes=>nodes.map(node=>node.dataset.prompt));
  expect(prompts.length).toBe(3);
  await starters.first().click();
  await ready(page);
  const userMessage=page.locator('#chat-history article').first();
  await expect(userMessage).toContainText(prompts[0]);
  await expect(page.locator('#chat-history article').last()).toContainText(/kai lan/i);
  await page.locator('#chat-history article').last().locator('summary').filter({hasText:/^Sources/}).click();
  await expect(page.locator('#chat-history article').last().getByRole('link',{name:/NParks/i}).first()).toBeVisible();
  // The example buttons must be usable again for the next question.
  await expect(starters.nth(1)).toBeEnabled();
  expect(await starters.nth(1).getAttribute('data-prompt')).toBe(prompts[1]);
});
