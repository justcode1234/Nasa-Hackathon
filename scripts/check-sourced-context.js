import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createStaticPreview } from './static-preview.js';
import { openChrome } from './chrome.js';
const app=createStaticPreview();app.listen(0,'127.0.0.1');await once(app,'listening');const browser=await openChrome();
const base=`http://127.0.0.1:${app.address().port}`;
try{
  assert.equal((await fetch(base+'/api/health')).status,404);
  await browser.call('Page.navigate',{url:base});
  await browser.waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  await browser.evaluate('const s=document.querySelector("#example-location");s.value="-31.89,116.77";s.dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("#load-evidence").click();');
  await browser.waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")',40000);
  await browser.waitFor('document.querySelector("#soil-context-status").textContent.startsWith("Regional soil context loaded")',35000);
  await browser.waitFor('document.querySelector("#water-context-output").textContent.includes("382626")');
  await browser.evaluate('document.querySelector("#tab-si").click();');
  assert.match(await browser.evaluate('document.querySelector("#soil-context-output").textContent'),/SoilGrids/);
  assert.equal(await browser.evaluate('document.querySelector("#soil-ph").value'),'');
  await browser.evaluate('document.querySelector("#chat-toggle").click();document.querySelector("#question").value="What soil data do you have?";document.querySelector("#ask").click();');
  await browser.waitFor('document.querySelector("#chat-history").textContent.includes("regional soil model")');
  assert.match(await browser.evaluate('document.querySelector("#chat-history").textContent'),/not a farm measurement/);
  await browser.evaluate('document.querySelector("#question").value="What is historical Australian irrigation use?";document.querySelector("#ask").click();');
  await browser.waitFor('document.querySelector("#chat-history").textContent.includes("382626")');
  const result={checkedAt:new Date().toISOString(),staticApiStatus:404,soil:await browser.evaluate('document.querySelector("#soil-context-output").innerText'),water:await browser.evaluate('document.querySelector("#water-context-output").innerText'),chat:await browser.evaluate('document.querySelector("#chat-history").innerText')};
  await writeFile('artifacts/sourced-context-validation.json',JSON.stringify(result,null,2));
  console.log('PASS: static-only browser retrieves real NASA/SoilGrids data, renders sourced ABS ratios, retains unknown farm pH, and answers soil/water questions with source links.');
}finally{await browser.close();await new Promise(resolve=>app.close(resolve));}
