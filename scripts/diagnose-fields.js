// Diagnose the real field lookup through the actual static browser worker.
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {buildBrowser} from './build-browser.js';
import {createStaticPreview} from './static-preview.js';

await buildBrowser();
const app=createStaticPreview();
const requests=[],consoleErrors=[];
let browser,page,result;
try{
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome'});
  const context=await browser.newContext();page=await context.newPage();
  context.on('requestfailed',request=>{
    if(/overpass/.test(request.url()))requests.push({kind:'failed',url:request.url(),failure:request.failure()});
  });
  context.on('response',response=>{
    if(/overpass/.test(response.url()))requests.push({kind:'response',url:response.url(),status:response.status()});
  });
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.goto(`http://127.0.0.1:${app.address().port}`,{waitUntil:'domcontentloaded'});
  await page.getByRole('combobox',{name:'Explore an example farming region',exact:true}).selectOption('-31.89,116.77');
  await page.waitForFunction(()=>/mapped fields returned|Both field lookup/.test(document.querySelector('#farms-status').textContent),null,{timeout:60_000});
  const completeFields=await page.locator('#farm-results option[value]:not([value=""])').count();
  result={checkedAt:new Date().toISOString(),runtime:'static browser worker',uiStatus:await page.locator('#farms-status').innerText(),requests,consoleErrors,completeFields};
  if(completeFields<3)process.exitCode=1;
}catch(error){
  result={checkedAt:new Date().toISOString(),runtime:'static browser worker',error:error.message,uiStatus:page?await page.locator('#farms-status').textContent().catch(()=>null):null,requests,consoleErrors};
  process.exitCode=1;
}finally{
  if(result){await writeFile('artifacts/field-network-diagnostic.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
  await browser?.close();if(app.listening)await new Promise(resolve=>app.close(resolve));
}
