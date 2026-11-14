import { once } from 'node:events';
import { createApp } from '../server/index.js';
import { openChrome } from './chrome.js';
const app=createApp();app.listen(0,'127.0.0.1');await once(app,'listening');const browser=await openChrome();
try {
  await browser.call('Page.navigate',{url:`http://127.0.0.1:${app.address().port}`});
  await browser.waitFor('document.readyState === "complete"');
  const result=await browser.evaluate(`(async()=>{
    window.regeneratorRuntime={};
    const script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)});
    await script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js');
    tf.wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');tf.wasm.setThreadsCount(1);
    await tf.setBackend('wasm');await tf.ready();
    const {registerEmbeddingGradient}=await import('/js/modules/wasm-training-kernel.js');registerEmbeddingGradient(tf);
    const m=tf.sequential();m.add(tf.layers.embedding({inputDim:10,outputDim:4,inputLength:5}));m.add(tf.layers.lstm({units:8,returnSequences:true}));m.add(tf.layers.dense({units:10,activation:'softmax'}));m.compile({optimizer:'adam',loss:'categoricalCrossentropy'});
    const x=tf.tensor2d([[1,2,3,4,5]],[1,5],'int32');const y=tf.oneHot(tf.tensor2d([[2,3,4,5,6]],[1,5],'int32'),10);const t=performance.now();const loss=await m.trainOnBatch(x,y);
    return{backend:tf.getBackend(),loss,stepMs:performance.now()-t};
  })()`);
  console.log(JSON.stringify(result));
} finally{await browser.close();await new Promise(resolve=>app.close(resolve));}
