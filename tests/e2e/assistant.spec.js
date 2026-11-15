import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gradePrompt} from '../../scripts/qa-assertions.js';
const plan=JSON.parse(readFileSync(new URL('../qa/prompts.json',import.meta.url),'utf8'));

test('all sixteen original QA questions retain their grounded answers and workflow logic',async({page},info)=>{
  test.setTimeout(180_000);
  const captured=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
  const ask=async question=>{
    await page.locator('#question').fill(question);await page.locator('#ask').click();
    await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
    const last=page.locator('#chat-history article').last();
    return {paragraphs:await last.locator(':scope > p').allTextContents(),
      links:await last.locator('a').evaluateAll(nodes=>nodes.map(node=>({title:node.textContent,url:node.href}))),
      buttons:await last.locator('button').allTextContents(),
      state:{country:await page.locator('#pest-country').inputValue(),latitude:await page.locator('#latitude').inputValue(),longitude:await page.locator('#longitude').inputValue(),
        scenarios:await page.locator('.scenario').count(),evidenceElements:await page.locator('#evidence-output > *').count()}};
  };
  try{
    for(const item of plan.cases)await test.step(item.id+': '+item.prompt,async()=>{
      await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
      await page.locator('#chat-toggle').click();
      await page.locator('#assistant-settings>summary').click();
      await page.locator('#unload-model').click();
      if(item.id==='Q05')await ask(plan.cases.find(row=>row.id==='Q04').prompt);
      if(['Q08','Q09'].includes(item.id))await ask(plan.cases.find(row=>row.id==='Q07').prompt);
      if(item.id==='Q09')await ask('Allowed crops: bush snap bean, garden pea');
      const actual=await ask(item.prompt);
      if(item.id==='Q07'){
        await ask('Allowed crops: bush snap bean, garden pea');
        await ask('at 18.5204, 73.8567');
        actual.followUp={retainedBaseline:JSON.stringify(await page.locator('[id^=baseline-]').evaluateAll(nodes=>nodes.map(n=>n.value)))===JSON.stringify(['unassessed:fao-27','unassessed:fao-15','bush-bean']),
          irrigation:await page.locator('#irrigation').inputValue(),unsupportedBaseline:/Rice.*unknown.*Wheat.*unknown/s.test(await page.locator('.scenario').first().textContent())};
      }
      const checks=gradePrompt(item.id,actual);captured.push({id:item.id,prompt:item.prompt,actual,checks});
      expect(checks.filter(check=>!check.passed),item.id+' actual reply: '+actual.paragraphs.join(' ')).toEqual([]);
    });
    expect(errors).toEqual([]);
  }finally{await info.attach('Exact QA questions and captured answers',{body:Buffer.from(JSON.stringify(captured,null,2)),contentType:'application/json'});}
});
