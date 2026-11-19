import {waitForLiveFields} from './live-fields.js';
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {gradePrompt} from '../../scripts/qa-assertions.js';
const require=createRequire(import.meta.url),axe=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const prompts=JSON.parse(readFileSync(new URL('../qa/prompts.json',import.meta.url),'utf8')).cases;

async function openExample(page){
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
  await expect(page.locator('#catalog-status')).toContainText('Australia:');
}
async function evidence(page){
  await page.getByRole('spinbutton',{name:'Historical reference year',exact:true}).fill('2025');
  await page.getByRole('button',{name:/Next: NASA evidence/}).click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:45_000});
}
async function compare(page){
  await page.getByRole('button',{name:/Next: Plan crops/}).click();
  for(const [i,value] of ['tomato','cabbage','onion'].entries())await page.getByRole('combobox',{name:['First crop','Second crop','Third crop'][i],exact:true}).selectOption(value);
  await page.getByRole('button',{name:'Compare baseline and two alternatives',exact:true}).click();
  await expect(page.locator('.scenario')).toHaveCount(3);
  await expect(page.locator('.timeline').first().locator('h4')).toHaveText(['1. Tomato','2. Cabbage','3. Bulb onion']);
}

test('a failed field request has a reachable retry and still permits a point-based comparison',async({page,context})=>{
  await context.route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/,r=>r.abort('failed'));
  await page.goto('/',{waitUntil:'domcontentloaded'});await openExample(page);
  await expect(page.locator('#farms-status')).toHaveClass(/error/);
  await expect(page.locator('#farms-status')).toContainText(/No fields were invented|No answer came back for this request/);
  await expect(page.getByRole('button',{name:'Retry mapped field search',exact:true})).toBeEnabled();
  await expect(page.getByRole('combobox',{name:'Mapped field',exact:true})).toBeDisabled();
  await expect(page.locator('.scenario')).toHaveCount(0);
  await expect(page.locator('#farms-status')).toContainText('continue with the selected map point or coordinates');
  const latitude=await page.locator('#latitude').inputValue();
  await page.getByRole('button',{name:'Retry mapped field search',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry mapped field search',exact:true})).toBeEnabled();
  await expect(page.locator('#latitude')).toHaveValue(latitude);
  // Field outlines are optional. Retain the explicit point and use real NASA data.
  await evidence(page);await compare(page);
  await expect(page.locator('#farm-results')).toBeDisabled();
});

test('human dropdowns, map click, fields and a new-crop comparison form a working path',async({page},info)=>{
  test.setTimeout(480_000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('AU');
  const regions=page.getByRole('combobox',{name:'Region (optional filter)',exact:true});
  await expect(regions).toBeEnabled();await regions.selectOption({label:'Western Australia'});
  const towns=page.getByRole('combobox',{name:'Town / city',exact:true});
  await expect(towns.locator('option').filter({hasText:/^Perth ·/})).toHaveCount(1);
  const perth=await towns.locator('option').filter({hasText:/^Perth ·/}).getAttribute('value');await towns.selectOption(perth);
  await expect(page.locator('#latitude')).not.toHaveValue('');
  const before=await page.locator('#longitude').inputValue();
  await page.getByRole('region',{name:/Location and mapped farmland/}).click({position:{x:80,y:100}});
  await expect(page.locator('#longitude')).not.toHaveValue(before);
  // One explicit search per complete run; never type-triggered autocomplete.
  if(info.project.name===info.config.projects[0].name){
    await page.getByRole('textbox',{name:'Town, region or country',exact:true}).fill('Cambridge, United Kingdom');
    await page.getByRole('button',{name:'Search places',exact:true}).click();
    await expect(page.getByRole('combobox',{name:'Search results',exact:true})).toBeEnabled({timeout:30_000});
    expect(await page.getByRole('combobox',{name:'Search results',exact:true}).locator('option').count()).toBeGreaterThan(1);
  }
  await openExample(page);
  const fields=page.getByRole('combobox',{name:'Mapped field',exact:true});
  await waitForLiveFields(page,info);await expect(fields).toBeEnabled();
  const id=await fields.locator('option').nth(1).getAttribute('value');await fields.selectOption(id);
  await expect(page.getByRole('link',{name:'View mapped field and history',exact:true})).toHaveAttribute('href',`https://www.openstreetmap.org/${id}`);
  await expect(page.locator('#farm-details')).toContainText('Ownership, access and current production are unverified');
  await evidence(page);await compare(page);
  await expect(page.locator('#strategy-output')).toContainText('Jan–Apr 2027');
  await expect(page.getByText('How alternatives were ordered',{exact:true})).toBeVisible();
  expect(await page.locator('#strategy-output').innerText()).not.toMatch(/Lexicographic|day-slots|end excluded/);
  expect(errors).toEqual([]);
});

test('WCAG AA and best-practice checks pass in initial, evidence, plan, compare and chat states',async({page},info)=>{
  test.setTimeout(180_000);await page.goto('/',{waitUntil:'domcontentloaded'});const rows=[];
  const scan=async state=>{
    await page.evaluate(axe);
    const result=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));
    rows.push({state,violations:result.violations,incomplete:result.incomplete.map(r=>({id:r.id,nodes:r.nodes.length})),passes:result.passes.length});
    expect(result.violations,`${state}: ${result.violations.map(v=>v.id+': '+v.nodes.map(n=>n.target).join(',')).join('; ')}`).toEqual([]);
  };
  try{
    await scan('initial');await openExample(page);await evidence(page);await scan('evidence');
    await expect(page.locator('#evidence-output')).toContainText('°C');
    await expect(page.locator('#evidence-output')).toContainText('Jan 2025');
    await page.getByRole('button',{name:/Next: Plan crops/}).click();await scan('plan');
    // compare helper starts at evidence to exercise the same Next control.
    await page.getByRole('tab',{name:/02.*NASA evidence/}).click();await compare(page);await scan('compare');
    await page.getByRole('button',{name:'Open FieldShift assistant'}).click();await scan('chat');
  }finally{await info.attach('axe-core 4.10.2 states and manual-review items',{body:Buffer.from(JSON.stringify(rows,null,2)),contentType:'application/json'});}
});

test('the optional model loads and Q01, Q03 and Q16 retain grounded answers',async({page},info)=>{
  test.setTimeout(180_000);await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open FieldShift assistant'}).click();
  await expect(page.locator('#model-status')).toContainText('Compact model ready',{timeout:60_000});
  const captured=[];
  for(const id of ['Q01','Q03','Q16']){
    const question=prompts.find(q=>q.id===id).prompt;
    await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
    const last=page.locator('#chat-history article').last();
    const actual={paragraphs:await last.locator(':scope > p').allTextContents(),links:await last.locator('a').evaluateAll(nodes=>nodes.map(n=>({title:n.textContent,url:n.href}))),buttons:await last.locator('button').allTextContents(),state:{country:await page.locator('#pest-country').inputValue(),latitude:await page.locator('#latitude').inputValue(),longitude:await page.locator('#longitude').inputValue(),scenarios:await page.locator('.scenario').count(),evidenceElements:await page.locator('#evidence-output > *').count()}};
    const checks=gradePrompt(id,actual);captured.push({id,question,actual,checks});expect(checks.filter(c=>!c.passed),JSON.stringify(actual)).toEqual([]);
  }
  expect(await page.evaluate(()=>window.fieldshiftModelSelections??0),'Actual worker inference completed').toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.fieldshiftModelMetrics.weightBytes)).toBe(157096);
  await info.attach('Model-on exact QA answers',{body:Buffer.from(JSON.stringify(captured,null,2)),contentType:'application/json'});
});
