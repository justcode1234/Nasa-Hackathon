import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createApp } from '../server/index.js';
import { openChrome } from './chrome.js';
const app=createApp();app.listen(0,'127.0.0.1');await once(app,'listening');
const browser=await openChrome();
try {
  await browser.call('Page.navigate',{url:`http://127.0.0.1:${app.address().port}`});
  await browser.waitFor('document.readyState === "complete"');
  await browser.evaluate('import("/js/modules/train-mini-lm.js").then(()=>runMiniTraining()).catch(e=>window.miniTrainingError=e.stack||e.message);true');
  let done=false;
  while(!done){
    await new Promise(resolve=>setTimeout(resolve,10000));
    const status=await browser.evaluate('({progress:window.trainingProgress,error:window.miniTrainingError,done:!!window.miniTrainingResult})');
    console.log(JSON.stringify(status));
    if(status.error){console.log(JSON.stringify(browser.events.filter(e=>e.method==='Runtime.exceptionThrown').slice(-3)));throw new Error(status.error);}
    done=status.done;
  }
  const result=await browser.evaluate('window.miniTrainingResult');
  const directory='public/models/fieldshift-mini';
  await writeFile(`${directory}/weights.bin`,Buffer.from(result.weightBase64,'base64'));
  await writeFile(`${directory}/model.json`,JSON.stringify({format:'layers-model',generatedBy:'TensorFlow.js browser training',convertedBy:null,modelTopology:result.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:result.weightSpecs}]}));
  await writeFile(`${directory}/tokenizer.json`,JSON.stringify({vocabulary:result.vocabulary,length:result.length,topics:result.topics}));
  await writeFile(`${directory}/evaluation.json`,JSON.stringify(result.metrics,null,2));
  console.log(JSON.stringify({...result.metrics,results:undefined}));
} finally {await browser.close();await new Promise(resolve=>app.close(resolve));}
