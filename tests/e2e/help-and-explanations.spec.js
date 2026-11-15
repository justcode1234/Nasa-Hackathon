import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const prompts=JSON.parse(readFileSync(new URL('../qa/unexpected-prompts.json',import.meta.url),'utf8')).cases;
const fieldTransport=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
async function open(page){await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');}
async function country(page,code){
  const reopen=await page.locator('#chat-panel').isVisible();
  if(reopen)await page.locator('#chat-close').click();
  await page.locator('#tab-location').click();await page.locator('#location-method').selectOption('places');await page.locator('#pest-country').selectOption(code);
  if(code)await expect(page.locator('#country-status')).toContainText('crop production categories');else await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  if(reopen)await page.locator('#chat-toggle').click();
}
async function ask(page,text){await page.locator('#question').fill(text);await page.locator('#ask').click();await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});const last=page.locator('#chat-history article').last();return {paragraphs:await last.locator(':scope>p').allTextContents(),links:await last.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href))};}
const state=page=>page.evaluate(()=>({country:document.querySelector('#pest-country').value,latitude:document.querySelector('#latitude').value,longitude:document.querySelector('#longitude').value,baseline:[1,2,3].map(i=>document.querySelector('#baseline-'+i).value),scenarios:document.querySelectorAll('.scenario').length}));

for(const model of ['off','on'])test(`28 unexpected questions remain bounded and read-only with model ${model}`,async({page,context},info)=>{
  test.setTimeout(240_000);await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await page.locator('#chat-toggle').click();
  if(model==='off'){await page.locator('#assistant-settings>summary').click();await page.locator('#unload-model').click();await page.locator('#assistant-settings>summary').click();}
  else await expect(page.locator('#model-status')).toContainText('Compact model ready',{timeout:60_000});
  const replies=[];
  try{for(const item of prompts){
    if(item.previousCountry){await country(page,item.previousCountry);await ask(page,item.previousQuestion);}
    if(item.country)await country(page,item.country);else if((await state(page)).country){await country(page,'');await expect(page.locator('#catalog-status')).toContainText('Choose a country');}
    const before=await state(page),text=item.repeatToLength?item.question.repeat(Math.ceil(item.repeatToLength/item.question.length)).slice(0,item.repeatToLength):item.question;
    const reply=await ask(page,text),body=reply.paragraphs.join(' ');replies.push({id:item.id,question:text,reply,before,after:await state(page)});
    expect(reply.paragraphs.length,item.id).toBeLessThanOrEqual(3);for(const pattern of item.checks)expect(body,item.id).toMatch(new RegExp(pattern,'i'));for(const pattern of item.forbidden??[])expect(body,item.id).not.toMatch(new RegExp(pattern,'i'));
    expect(await state(page),item.id+' must not execute planning actions').toEqual(before);
  }if(model==='on')expect(await page.evaluate(()=>window.fieldshiftModelSelections??0)).toBeGreaterThan(0);
  }finally{await info.attach(`Unexpected questions, model ${model}`,{body:Buffer.from(JSON.stringify(replies,null,2)),contentType:'application/json'});}
});

test('three visible starter buttons teach facts, guided India planning and crop-choice help',async({page,context})=>{
  await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await page.locator('#chat-toggle').click();
  const examples=page.getByRole('group',{name:'Try an example'}).getByRole('button');await expect(examples).toHaveCount(3);await expect(page.locator('#assistant-settings')).not.toHaveAttribute('open');
  expect((await state(page)).country).toBe('');await expect(page.locator('#chat-history article')).toHaveCount(0);
  await examples.nth(0).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');const fact=page.locator('#chat-history article').last();await expect(fact).toContainText('Kai lan');await expect(fact.locator('a').first()).toHaveAttribute('href',/nparks\.gov\.sg/);expect((await state(page)).country).toBe('');
  await examples.nth(1).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');await expect(page.locator('#chat-history article').last()).toContainText('Which part of India');await expect(page.getByRole('button',{name:'Whole India',exact:true}).last()).toBeVisible();
  expect((await state(page)).latitude).toBe('');await examples.nth(2).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');await expect(page.locator('#chat-history article').last()).toContainText('India');expect((await state(page)).scenarios).toBe(0);
});

test('Singapore skips unnamed regions and national scope never invents farm coordinates',async({page,context})=>{
  await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await country(page,'SG');await expect(page.locator('#place-region').locator('..')).toBeHidden();await expect(page.locator('#place-town')).toBeEnabled();
  await page.locator('#chat-toggle').click();await ask(page,'Help me plan a rotation in Singapore. Crops: tomato, cabbage, onion');await page.getByRole('button',{name:'Whole Singapore',exact:true}).last().click();await expect(page.locator('#answer-status')).toContainText('Answer ready');
  await page.getByRole('button',{name:'Choose a town or field',exact:true}).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');await expect(page.locator('#chat-history article').last()).toContainText('No named regions');expect((await state(page)).latitude).toBe('');expect((await state(page)).scenarios).toBe(0);
});

test('Åland official crop records enable baseline choices without inventing alternative screening rules',async({page},info)=>{
  await open(page);await country(page,'AX');await page.locator('#tab-si').click();await expect(page.locator('#baseline-1')).toBeEnabled();await expect(page.locator('[name=allowedCrops]')).toHaveCount(0);
  const values=await page.locator('#baseline-1 optgroup').last().locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));expect(values).toHaveLength(5);
  for(let i=1;i<=3;i++)await page.locator('#baseline-'+i).selectOption(values[i-1]);await page.locator('#soil-ph').fill('7.3');await expect(page.locator('#compare')).toBeDisabled();await page.locator('#chat-toggle').click();await page.locator('#chat-examples button').nth(2).click();await expect(page.locator('#answer-status')).toContainText('Answer ready');
  const reply=page.locator('#chat-history article').last();await expect(reply).toContainText('ÅSUB');await expect(reply).toContainText('2024');await expect(reply).toContainText('not evidence that no crops grow');await expect(reply.locator('a[href*="asub.ax"]')).toHaveCount(1);
  await page.locator('#chat-close').click();await page.locator('#flow-next').click();await expect(page.locator('#location')).toBeVisible();await page.locator('#tab-si').click();expect((await state(page)).baseline).toEqual(values.slice(0,3));await expect(page.locator('#soil-ph')).toHaveValue('7.3');
  await info.attach('Åland real source-backed baseline choices',{body:Buffer.from(JSON.stringify({choices:values,reply:await reply.textContent()},null,2)),contentType:'application/json'});
});

test('location methods, Next, temperature graphs and explicit alternative choices form one honest flow',async({page,context},info)=>{
  await context.route(fieldTransport,r=>r.abort('failed'));await open(page);await expect(page.locator('#pest-country')).toBeVisible();await expect(page.locator('#latitude')).toBeHidden();await expect(page.locator('#load-evidence')).toBeHidden();
  await page.locator('#location-method').selectOption('coordinates');await expect(page.locator('#pest-country')).toBeHidden();await expect(page.locator('#example-location')).toBeHidden();await expect(page.locator('#latitude')).toBeVisible();
  await page.locator('#latitude').fill('-31.89');await page.locator('#longitude').fill('116.77');await page.locator('#reference-year').fill('2025');await page.locator('#flow-next').click();await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:60_000});
  await expect(page.locator('#evidence-output figure')).toHaveCount(3);const c=Number(await page.locator('#evidence-output figure').first().locator('circle').first().getAttribute('data-value'));
  const rain=await page.locator('[data-evidence-month]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rainSum));await page.locator('#temperature-unit').selectOption('F');
  const f=Number(await page.locator('#evidence-output figure').first().locator('circle').first().getAttribute('data-value'));expect(f).toBeCloseTo(c*9/5+32,8);await expect(page.locator('#evidence-output')).toContainText('°F');expect(await page.locator('[data-evidence-month]').evaluateAll(nodes=>nodes.map(n=>n.dataset.rainSum))).toEqual(rain);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download normalized evidence (JSON)',exact:true}).click();const evidence=JSON.parse(readFileSync(await (await download).path(),'utf8'));expect(evidence.parameters.T2M.units).toBe('C');expect(evidence.monthly[0].parameters.T2M.mean).toBeCloseTo(c,8);
  await page.locator('#flow-next').click();for(const [i,value] of ['bush-bean','unassessed:fao-526','unassessed:fao-515'].entries())await page.locator('#baseline-'+(i+1)).selectOption(value);
  await expect(page.locator('#compare')).toBeDisabled();await expect(page.locator('[name=allowedCrops][value="sweet-corn"]')).not.toBeChecked();await page.locator('#alternative-scope').selectOption('custom');
  await page.locator('[name=allowedCrops][value="bush-bean"]').check();await page.locator('[name=allowedCrops][value="pea"]').check();await page.locator('#compare').click();await expect(page.locator('.scenario')).toHaveCount(3);
  const baseline=page.locator('.scenario').first();await expect(baseline).toContainText('Apricots');await expect(baseline).toContainText('orchard');await expect(baseline).toContainText('Rosaceae');await page.getByText('Explain the comparison checks',{exact:true}).click();await expect(page.getByRole('region',{name:/Comparison explained/})).toContainText('Not comparable');await expect(page.getByRole('region',{name:/Comparison explained/})).toContainText('Not assessed: soil inputs');
  expect((await page.locator('.scenario').allTextContents()).join(' ')).not.toContain('Sweet corn');await expect(page.locator('meter')).toHaveCount(3);await expect(page.locator('meter').first()).toHaveAttribute('value','1');
  await info.attach('Converted chart and explained comparison',{body:Buffer.from(JSON.stringify({celsius:c,fahrenheit:f,rawUnits:evidence.parameters.T2M.units,baseline:await baseline.innerText()},null,2)),contentType:'application/json'});
});

test('chat and primary navigation never overlap and navigation aligns with main content',async({page},info)=>{
  const rows=[];for(const [width,height] of [[1366,768],[1280,1000],[390,844],[844,390],[683,384]]){await page.setViewportSize({width,height});await open(page);await country(page,'AX');await page.locator('#tab-si').click();await page.locator('.workflow-navigation').scrollIntoViewIfNeeded();
    await expect.poll(()=>page.evaluate(()=>{const bar=document.querySelector('.workflow-navigation').getBoundingClientRect(),launcher=document.querySelector('#chat-toggle').getBoundingClientRect();return Math.max(0,Math.min(launcher.bottom,bar.bottom)-Math.max(launcher.top,bar.top));})).toBe(0);
    await page.locator('#chat-toggle').click();
    const row=await page.evaluate(()=>{const bar=document.querySelector('.workflow-navigation').getBoundingClientRect(),chat=document.querySelector('#chat-panel').getBoundingClientRect(),main=document.querySelector('main'),m=main.getBoundingClientRect(),back=document.querySelector('#flow-back').getBoundingClientRect(),next=document.querySelector('#flow-next').getBoundingClientRect(),style=getComputedStyle(main);return{width:innerWidth,height:innerHeight,overlap:Math.max(0,Math.min(chat.bottom,bar.bottom)-Math.max(chat.top,bar.top)),left:back.left-(m.left+parseFloat(style.paddingLeft)),right:next.right-(m.left+main.clientWidth-parseFloat(style.paddingRight)),overflow:document.documentElement.scrollWidth>innerWidth};});rows.push(row);expect(row.overlap).toBe(0);expect(Math.abs(row.left)).toBeLessThan(3);expect(Math.abs(row.right)).toBeLessThan(3);expect(row.overflow).toBe(false);
  }await info.attach('Navigation and chat geometry',{body:Buffer.from(JSON.stringify(rows,null,2)),contentType:'application/json'});
});

test('voice download can be cancelled before permission or network access',async({page})=>{
  await open(page);await page.locator('#chat-toggle').click();await page.evaluate(()=>{window.micRequests=0;navigator.mediaDevices.getUserMedia=()=>{window.micRequests++;return Promise.reject(new DOMException('denied','NotAllowedError'));};});
  await page.locator('#mic').click();await expect(page.locator('#speech-consent')).toContainText('70 MB');expect(await page.evaluate(()=>window.micRequests)).toBe(0);await page.locator('#cancel-dictation').click();
  expect(await page.evaluate(()=>window.micRequests)).toBe(0);expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/huggingface|hf\.co|transformers/.test(e.name)).length)).toBe(0);await expect(page.locator('#mic')).toBeFocused();
});

test('closing chat while microphone permission is pending stops a late grant without starting speech downloads',async({page})=>{
  await open(page);await page.locator('#chat-toggle').click();await page.locator('#question').fill('keep this draft');
  await page.evaluate(()=>{window.stoppedTracks=0;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.resolveMicrophone=resolve);});
  await page.locator('#mic').click();await page.locator('#start-dictation').click();await expect(page.locator('#mic')).toBeDisabled();await page.locator('#chat-close').click();
  await page.evaluate(()=>window.resolveMicrophone({getTracks:()=>[{stop(){window.stoppedTracks++;}}]}));await page.waitForFunction(()=>window.stoppedTracks===1);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/huggingface|hf\.co|transformers/.test(e.name)).length)).toBe(0);await expect(page.locator('#question')).toHaveValue('keep this draft');
});
