// Development training runs entirely in the browser with TensorFlow.js.
// This is an autoregressive word language model, not a classifier softmax over topics.
window.runMiniTraining = async () => {
  const corpus = await (await fetch('/models/fieldshift-mini/corpus.json')).json();
  // TF.js' bundled regenerator fallback uses Function only if this binding is absent.
  // Predeclare the binding so strict CSP stays intact; no unsafe-eval is enabled.
  window.regeneratorRuntime = {};
  await new Promise((resolve, reject) => { const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js'; s.onload=resolve; s.onerror=reject; document.head.append(s); });
  const tf = window.tf;
  if (typeof tf?.setBackend !== 'function') throw new Error(`TensorFlow runtime did not initialize: ${JSON.stringify({type:typeof tf,keys:Object.keys(tf??{}).slice(0,25)})}`);
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
  tf.wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');tf.wasm.setThreadsCount(1);
  await tf.setBackend('wasm'); await tf.ready();
  const {registerEmbeddingGradient}=await import('./wasm-training-kernel.js');registerEmbeddingGradient(tf);
  const tokens = text => text.toLowerCase().match(/[a-z]+|[.?]/g) ?? [];
  const vocabulary = ['<pad>', '<unk>', '<end>', ...new Set(corpus.rows.flatMap(row => tokens(`question ${row.question} answer ${row.reply}`)))];
  const wordIndex = new Map(vocabulary.map((word, i) => [word, i]));
  const encode = text => tokens(text).map(t => wordIndex.get(t) ?? 1);
  const length = 40;
  const training = corpus.rows.filter(row => row.split === 'train');
  const validation = corpus.rows.filter(row => row.split === 'validation');
  const makeData = rows => {
    const x=[], y=[];
    for (const row of rows) {
      const ids=[...encode(`question ${row.question} answer ${row.reply}`), 2];
      x.push(Array.from({length},(_,i)=>ids[i]??0));
      y.push(Array.from({length},(_,i)=>ids[i+1]??0));
    }
    return { x:tf.tensor2d(x,[rows.length,length],'int32'), y:tf.oneHot(tf.tensor2d(y,[rows.length,length],'int32'),vocabulary.length) };
  };
  const data=makeData(training), val=makeData(validation);
  const model=tf.sequential();
  model.add(tf.layers.embedding({inputDim:vocabulary.length,outputDim:24,inputLength:length,embeddingsInitializer:tf.initializers.glorotUniform({seed:42})}));
  model.add(tf.layers.lstm({units:48,returnSequences:true,kernelInitializer:tf.initializers.glorotUniform({seed:43}),recurrentInitializer:tf.initializers.glorotUniform({seed:44})}));
  model.add(tf.layers.dense({units:vocabulary.length,activation:'softmax',kernelInitializer:tf.initializers.glorotUniform({seed:45})}));
  model.compile({optimizer:tf.train.adam(.004),loss:(truth,prediction)=>tf.tidy(()=>{
    const mask=truth.argMax(-1).notEqual(0).toFloat();
    return tf.metrics.categoricalCrossentropy(truth,prediction).mul(mask).sum().div(mask.sum().maximum(1));
  })});
  const start=performance.now();
  await model.fit(data.x,data.y,{epochs:50,batchSize:32,shuffle:false,validationData:[val.x,val.y],callbacks:{onEpochEnd:async(epoch,logs)=>{
    window.trainingProgress={epoch:epoch+1,loss:logs.loss,valLoss:logs.val_loss,elapsedMs:performance.now()-start,backend:tf.getBackend()};
    await tf.nextFrame();
  }}});
  // Score only answer words, so the model's likelihood of the question cannot bias routing.
  const select = async question => {
    const q=encode(`question ${question} answer`);
    const sequences=corpus.topics.map(topic=>[...q,...encode(topic.reply),2]);
    const input=tf.tensor2d(sequences.map(ids=>Array.from({length},(_,i)=>ids[i]??0)),[sequences.length,length],'int32');
    const prediction=model.predict(input); const values=await prediction.array();
    const scores=sequences.map((ids,row)=>{
      let score=0,count=0;
      for(let i=Math.max(0,q.length-1);i<Math.min(length,ids.length-1);i++){score-=Math.log(Math.max(values[row][i][ids[i+1]],1e-8));count++;}
      return score/Math.max(1,count);
    });
    input.dispose();prediction.dispose();
    return corpus.topics[scores.indexOf(Math.min(...scores))].id;
  };
  const test=corpus.rows.filter(row=>row.split==='test');
  const results=[];
  for(const row of test) results.push({question:row.question,expected:row.topic,predicted:await select(row.question),freeform:row.group.includes(':freeform:')});
  let artifacts;
  await model.save(tf.io.withSaveHandler(async value=>{artifacts=value;return{modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));
  const bytes=new Uint8Array(artifacts.weightData);let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
  window.miniTrainingResult={modelTopology:artifacts.modelTopology,weightSpecs:artifacts.weightSpecs,weightBase64:btoa(binary),vocabulary,topics:corpus.topics,length,
    metrics:{parameters:model.countParams(),weightBytes:bytes.length,trainExamples:training.length,validationExamples:validation.length,testExamples:test.length,
      correct:results.filter(r=>r.expected===r.predicted).length,freeformCorrect:results.filter(r=>r.freeform&&r.expected===r.predicted).length,
      freeformExamples:results.filter(r=>r.freeform).length,trainingMs:performance.now()-start,results}};
};
