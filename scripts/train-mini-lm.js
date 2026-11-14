import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/index.js';
import { openChrome } from './chrome.js';
const app=createApp();app.listen(0,'127.0.0.1');await once(app,'listening');
const root=await realpath(tmpdir()),profile=await mkdtemp(path.join(root,'fieldshift-training-'));
const browser=await openChrome({profileDirectory:profile});
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
  const directory='artifacts/mini-candidate';await mkdir(directory,{recursive:true});
  await writeFile(`${directory}/weights.bin`,Buffer.from(result.weightBase64,'base64'));
  await writeFile(`${directory}/model.json`,JSON.stringify({format:'layers-model',generatedBy:'TensorFlow.js browser training',convertedBy:null,modelTopology:result.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:result.weightSpecs}]}));
  await writeFile(`${directory}/tokenizer.json`,JSON.stringify({vocabulary:result.vocabulary,length:result.length,topics:result.topics}));
  await writeFile(`${directory}/evaluation.json`,JSON.stringify(result.metrics,null,2));
  await copyFile('public/models/fieldshift-mini/corpus.json',`${directory}/corpus.json`);
  console.log(JSON.stringify({parameters:result.metrics.parameters,weightBytes:result.metrics.weightBytes,correct:result.metrics.correct,testExamples:result.metrics.testExamples,newHoldoutCorrect:result.metrics.newHoldoutCorrect,newHoldoutExamples:result.metrics.newHoldoutExamples,baselineCorrect:result.metrics.baseline.correct,baselineHoldoutCorrect:result.metrics.baseline.newHoldoutCorrect,bestEpoch:result.metrics.bestEpoch,trainingMs:result.metrics.trainingMs}));
  if(result.metrics.newHoldoutCorrect<=result.metrics.baseline.newHoldoutCorrect || result.metrics.correct<result.metrics.baseline.correct)throw new Error('Candidate did not improve the fixed held-out comparison; production weights were not replaced');
} finally {await browser.close();await new Promise(resolve=>app.close(resolve));const target=await realpath(profile);if(path.dirname(target)!==root||!path.basename(target).startsWith('fieldshift-training-'))throw new Error('Training profile escaped its intended root');await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});}
