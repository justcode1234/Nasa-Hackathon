import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createStaticPreview } from './static-preview.js';
import { openChrome } from './chrome.js';
import { sampleBrowserMemory, summarizeMemory } from './browser-memory.js';
const app=createStaticPreview();app.listen(0,'127.0.0.1');await once(app,'listening');const browser=await openChrome();
const memorySamples=[];
try{
  const url=`http://127.0.0.1:${app.address().port}`;
  await browser.call('Page.navigate',{url});await browser.waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  memorySamples.push(await sampleBrowserMemory(browser.processId,'before model load'));
  await browser.evaluate('document.querySelector("#chat-toggle").click();document.querySelector("#question").value="What do peas need?";document.querySelector("#ask").click();');
  await browser.waitFor('document.querySelector("#chat-history").textContent.includes("Fabaceae")');
  const firstAnswerMs=await browser.evaluate('window.fieldshiftAnswerLatencyMs');
  await browser.waitFor('document.querySelector("#model-status").textContent.includes("ready")',30000);
  const cold=await browser.evaluate('window.fieldshiftModelMetrics');
  await browser.evaluate('document.querySelector("#question").value="Tell me about soil";document.querySelector("#ask").click();');
  await browser.waitFor('!!window.fieldshiftModelMetrics.inferenceMs');
  const inference=await browser.evaluate('window.fieldshiftModelMetrics');
  memorySamples.push(await sampleBrowserMemory(browser.processId,'after model load and inference'));
  // Exercise actual autoregressive generation for the model card, not the app UI.
  await browser.evaluate('window.wordWorker=new Worker("/js/modules/mini-lm-worker.js");wordWorker.onmessage=e=>{if(e.data.type==="ready")wordWorker.postMessage({type:"generate",id:1,question:"what is my soil like",maxWords:12});if(e.data.type==="generation")window.rawWordEvaluation=e.data;};wordWorker.postMessage({type:"load"});');
  await browser.waitFor('!!window.rawWordEvaluation',30000);
  const generation=await browser.evaluate('window.rawWordEvaluation.text');
  await browser.evaluate('wordWorker.terminate();document.querySelector("#unload-model").click();document.querySelector("#load-model").click();');
  await browser.waitFor('document.querySelector("#model-status").textContent.includes("ready")',30000);
  const warm=await browser.evaluate('window.fieldshiftModelMetrics');
  memorySamples.push(await sampleBrowserMemory(browser.processId,'after developer generation and app model reload'));
  const result={checkedAt:new Date().toISOString(),firstEvidenceAnswerMs:firstAnswerMs,coldLoad:cold,warmLoad:warm,inference,rawGenerationForEvaluationOnly:generation,
    browserProcessMemory:summarizeMemory(memorySamples),browserProcessMemorySamples:memorySamples,
    limitations:['Development question wording is synthetic and not agronomist-reviewed.','Raw generated words never reach scientific UI output.','WASM heap capacity and tensor bytes are not total browser peak memory.']};
  await writeFile('artifacts/mini-lm-benchmark.json',JSON.stringify(result,null,2));
  assert.ok(cold.weightBytes<150000);
  assert.ok(firstAnswerMs<1000,'Evidence answer should not wait for neural inference');
  assert.ok(inference.inferenceMs<1000,'Compact-model inference target on this test machine');
  console.log(JSON.stringify({...result,browserProcessMemorySamples:undefined}));
}finally{await browser.close();await new Promise(resolve=>app.close(resolve));}
