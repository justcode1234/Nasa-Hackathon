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
  const training = corpus.rows.filter(row => row.split === 'train');
  const validation = corpus.rows.filter(row => row.split === 'validation');
  const vocabulary = ['<pad>', '<unk>', '<end>', ...new Set(training.flatMap(row => tokens(`question ${row.question} answer ${row.reply}`)))];
  const wordIndex = new Map(vocabulary.map((word, i) => [word, i]));
  const encode = text => tokens(text).map(t => wordIndex.get(t) ?? 1);
  const length = 48;
  const makeData = rows => {
    const x=[], y=[];
    for (const row of rows) {
      const prefix=encode(`question ${row.question} answer`);
      const ids=[...prefix,...encode(row.reply), 2];
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
  const test=corpus.rows.filter(row=>row.split==='test');
  const evaluateModel = async (candidate, words, sequenceLength, examples=test) => {
    const ids=new Map(words.map((word,i)=>[word,i]));
    const encodeWith=text=>tokens(text).map(word=>ids.get(word)??1);
    const results=[];
    for(const row of examples){
      const prefix=encodeWith(`question ${row.question} answer`);
      const sequences=corpus.topics.map(topic=>[...prefix,...encodeWith(topic.reply),2]);
      const x=tf.tensor2d(sequences.map(seq=>Array.from({length:sequenceLength},(_,i)=>seq[i]??0)),[sequences.length,sequenceLength],'int32');
      const prediction=candidate.predict(x), values=await prediction.array();
      const scores=sequences.map((seq,r)=>{let total=0,n=0;for(let i=prefix.length-1;i<Math.min(sequenceLength,seq.length-1);i++){total-=Math.log(Math.max(values[r][i][seq[i+1]],1e-8));n++;}return total/Math.max(1,n);});
      x.dispose();prediction.dispose();
      results.push({question:row.question,expected:row.topic,predicted:corpus.topics[scores.indexOf(Math.min(...scores))].id,freeform:row.group.includes('freeform'),newHoldout:row.group.includes('v2-freeform')});
    }
    return {correct:results.filter(r=>r.expected===r.predicted).length,testExamples:results.length,newHoldoutCorrect:results.filter(r=>r.newHoldout&&r.expected===r.predicted).length,newHoldoutExamples:results.filter(r=>r.newHoldout).length,results};
  };
  const oldTokenizer=await(await fetch('/models/fieldshift-mini/tokenizer.json')).json();
  const oldModel=await tf.loadLayersModel('/models/fieldshift-mini/model.json');
  const baseline=await evaluateModel(oldModel,oldTokenizer.vocabulary,oldTokenizer.length);oldModel.dispose();
  let best=null,bestLoss=Infinity,bestEpoch=0,bestValidationCorrect=-1;
  // Checkpoints are selected using validation routing, never held-out answers.
  await model.fit(data.x,data.y,{epochs:100,batchSize:32,shuffle:false,validationData:[val.x,val.y],callbacks:{onEpochEnd:async(epoch,logs)=>{
    if((epoch+1)%5===0){
      const scored=await evaluateModel(model,vocabulary,length,validation);
      if(scored.correct>bestValidationCorrect || (scored.correct===bestValidationCorrect && logs.val_loss<bestLoss)){
        best?.forEach(weight=>weight.dispose());best=model.getWeights().map(weight=>weight.clone());bestLoss=logs.val_loss;bestEpoch=epoch+1;bestValidationCorrect=scored.correct;
      }
    }
    window.trainingProgress={epoch:epoch+1,loss:logs.loss,valLoss:logs.val_loss,bestEpoch,bestValidationCorrect,elapsedMs:performance.now()-start,backend:tf.getBackend()};
    await tf.nextFrame();
  }}});
  model.setWeights(best);best.forEach(weight=>weight.dispose());
  const evaluated=await evaluateModel(model,vocabulary,length),results=evaluated.results;
  let artifacts;
  await model.save(tf.io.withSaveHandler(async value=>{artifacts=value;return{modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));
  const bytes=new Uint8Array(artifacts.weightData);let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
  window.miniTrainingResult={modelTopology:artifacts.modelTopology,weightSpecs:artifacts.weightSpecs,weightBase64:btoa(binary),vocabulary,topics:corpus.topics,length,
    metrics:{parameters:model.countParams(),weightBytes:bytes.length,trainExamples:training.length,validationExamples:validation.length,testExamples:test.length,
      correct:evaluated.correct,freeformCorrect:results.filter(r=>r.freeform&&r.expected===r.predicted).length,
      freeformExamples:results.filter(r=>r.freeform).length,newHoldoutCorrect:evaluated.newHoldoutCorrect,newHoldoutExamples:evaluated.newHoldoutExamples,baseline,bestEpoch,bestValidationLoss:bestLoss,
      bestValidationCorrect,checkpointSelection:'Validation continuation-selection correct count, then validation next-word loss; checked every five epochs.',
      vocabularySource:corpus.vocabularySource,loss:'Next-word cross entropy across question and answer; padding masked. Routing scores answer continuations only.',trainingMs:performance.now()-start,results}};
};
