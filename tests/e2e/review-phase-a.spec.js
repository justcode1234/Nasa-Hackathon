import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('../../public/data/submission-example.json',import.meta.url),'utf8'));

test('mouse Send preserves chat input focus and Escape returns to the launcher',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const launcher=page.getByRole('button',{name:'Open FieldShift assistant'});
  await launcher.click();const input=page.getByRole('textbox',{name:'Message',exact:true});
  await input.fill('Hi');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(input).toBeFocused();await expect(page.locator('#answer-status')).toContainText('Answer ready');
  await expect(input).toBeFocused();await input.press('Escape');
  await expect(page.locator('#chat-panel')).toBeHidden();await expect(launcher).toBeFocused();
});

test('short zoom and landscape viewports retain sixty percent usable height',async({page},info)=>{
  const measurements=[];
  for(const [width,height] of [[683,384],[640,360],[844,390]]){
    await page.setViewportSize({width,height});await page.goto('/',{waitUntil:'domcontentloaded'});
    await page.getByRole('combobox',{name:'Country',exact:true}).selectOption('SG');
    await expect(page.locator('#catalog-status')).toContainText('Singapore');
    await page.getByRole('tab',{name:/03.*Plan crops/}).click();
    await page.evaluate(()=>window.scrollTo(0,document.querySelector('main').offsetTop));
    const metric=await page.evaluate(()=>{const bar=document.querySelector('.workflow-navigation').getBoundingClientRect();return{width:innerWidth,height:innerHeight,usableFraction:(innerHeight-Math.max(0,Math.min(innerHeight,bar.bottom)-Math.max(0,bar.top)))/innerHeight,bodyOverflow:getComputedStyle(document.body).overflowY,mainOverflow:getComputedStyle(document.querySelector('main')).overflowY,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};});
    measurements.push(metric);expect(metric.usableFraction).toBeGreaterThanOrEqual(.6);
    expect(metric.bodyOverflow).not.toBe('hidden');expect(metric.mainOverflow).toBe('visible');expect(metric.horizontalOverflow).toBe(false);
    await expect(page.getByRole('button',{name:/Choose another location/})).toBeInViewport({ratio:1});
    await page.screenshot({path:info.outputPath(`short-${width}-${height}.png`)});
    await page.getByRole('button',{name:/Choose another location/}).click();await expect(page.getByRole('combobox',{name:'Country',exact:true})).toBeFocused();
  }
  await info.attach('Measured usable content height',{body:Buffer.from(JSON.stringify(measurements,null,2)),contentType:'application/json'});
});

test('every example region returns at least three complete mapped fields',async({page})=>{
  test.setTimeout(120_000);await page.goto('/',{waitUntil:'domcontentloaded'});
  for(const point of ['52.19,0.09','-31.89,116.77','42,-93.69','-0.77,36.42']){
    await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption(point);
    await expect.poll(async()=>page.locator('#farm-results option[value]:not([value=""])').count(),{timeout:30_000}).toBeGreaterThanOrEqual(3);
  }
});

test('the submission fixture is enterable and reproduces the three live-engine scenarios',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption(`${fixture.inputs.latitude},${fixture.inputs.longitude}`);
  await page.getByRole('spinbutton',{name:'Historical reference year',exact:true}).fill(String(fixture.inputs.referenceYear));
  await page.getByRole('button',{name:/Next: NASA evidence/}).click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:45_000});
  await page.getByRole('button',{name:/Next: Plan crops/}).click();
  for(let i=0;i<3;i++)await page.getByRole('combobox',{name:['First crop','Second crop','Third crop'][i],exact:true}).selectOption(fixture.inputs.baseline[i]);
  await page.getByRole('spinbutton',{name:'Planning year',exact:true}).fill(String(fixture.inputs.planningYear));
  await page.getByRole('combobox',{name:'First planting month',exact:true}).selectOption(String(fixture.inputs.startMonth));
  await page.getByRole('button',{name:'Compare baseline and two alternatives',exact:true}).click();
  await expect(page.locator('.scenario')).toHaveCount(3);await expect(page.locator('#strategy-output')).toContainText('Uncertainty: high');
  const captured=JSON.parse(readFileSync('docs/evidence/submission-comparison-current.json','utf8'));
  const names=await page.locator('.timeline h4').allTextContents();
  expect(names).toEqual(captured.scenarios.flatMap(s=>s.timeline.map(slot=>`${slot.slot}. ${slot.cropName}`)));
});
