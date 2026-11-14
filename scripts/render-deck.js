import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createStaticPreview } from './static-preview.js';
import { openChrome } from './chrome.js';
const app=createStaticPreview();app.listen(0,'127.0.0.1');await once(app,'listening');const browser=await openChrome();
try{
  await browser.call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await browser.call('Page.navigate',{url:`http://127.0.0.1:${app.address().port}/submission/index.html`});
  await browser.waitFor('document.querySelectorAll(".slide").length===7');
  const layout=await browser.evaluate('[...document.querySelectorAll(".slide")].map((s,i)=>({slide:i+1,scrollHeight:s.scrollHeight,height:s.clientHeight,foot:s.querySelector(".foot").getBoundingClientRect().top,last:s.querySelector(".foot").previousElementSibling.getBoundingClientRect().bottom}))');
  await writeFile('artifacts/deck-layout.json',JSON.stringify(layout,null,2));
  assert.ok(layout.every(s=>s.scrollHeight<=s.height&&s.last<s.foot),JSON.stringify(layout));
  const pdf=await browser.call('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});const bytes=Buffer.from(pdf.data,'base64');
  assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length,7);
  await writeFile('public/submission/fieldshift-deck.pdf',bytes);
  for(const number of [3,5,7]){
    await browser.evaluate(`document.querySelector('#slide-${number}').scrollIntoView()`);
    const shot=await browser.call('Page.captureScreenshot',{format:'png'});await writeFile(`artifacts/submission-slide-${number}.png`,Buffer.from(shot.data,'base64'));
  }
  console.log('PASS: seven slides fit their frames; exported PDF contains exactly seven pages.');
}finally{await browser.close();await new Promise(resolve=>app.close(resolve));}
