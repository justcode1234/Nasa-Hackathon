import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { registerEmbeddingGradient } from '../public/js/modules/wasm-training-kernel.js';

test('compact artifact is a trained word-level sequence LM with traceable weights and candid evaluation',async()=>{
  const directory=new URL('../public/models/fieldshift-mini/',import.meta.url);
  const json=async name=>JSON.parse(await readFile(new URL(name,directory),'utf8'));
  const [model,tokenizer,evaluation,corpus,weights]=await Promise.all([json('model.json'),json('tokenizer.json'),json('evaluation.json'),json('corpus.json'),readFile(new URL('weights.bin',directory))]);
  const layers=model.modelTopology.config.layers;
  assert.deepEqual(layers.map(l=>l.class_name),['Embedding','LSTM','Dense']);
  assert.equal(layers[1].config.return_sequences,true);
  assert.equal(layers[2].config.units,tokenizer.vocabulary.length);
  assert.ok(layers[2].config.units>tokenizer.topics.length,'The output predicts words, not topic labels');
  assert.equal(weights.length,evaluation.weightBytes);
  assert.equal(weights.length,evaluation.parameters*4);
  const integrity=JSON.parse(await readFile(new URL('../models/mini-integrity.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(integrity))assert.equal(createHash('sha256').update(await readFile(new URL(file,directory))).digest('hex'),hash,file);
  assert.ok(Array.from({length:weights.length/4},(_,i)=>weights.readFloatLE(i*4)).every(Number.isFinite));
  assert.match(corpus.kind,/DEVELOPMENT synthetic/);
  assert.equal(corpus.reviewedByAgronomist,false);
  assert.ok(evaluation.results.some(r=>r.freeform&&r.expected!==r.predicted),'Known free-form failures are retained');
  assert.ok(evaluation.newHoldoutCorrect>evaluation.baseline.newHoldoutCorrect);
  assert.ok(evaluation.correct>=evaluation.baseline.correct);
  assert.equal(evaluation.newHoldoutExamples,36);
  assert.match(corpus.vocabularySource,/Training questions and replies only/);
  const tokens=text=>text.toLowerCase().match(/[a-z]+|[.?]/g)??[];
  const trainWords=new Set(corpus.rows.filter(row=>row.split==='train').flatMap(row=>tokens(`question ${row.question} answer ${row.reply}`)));
  assert.ok(tokenizer.vocabulary.slice(3).every(word=>trainWords.has(word)));
  const normalize=text=>text.toLowerCase().replace(/[^a-z]+/g,' ').trim();
  const heldout=new Set(corpus.rows.filter(row=>row.split==='test').map(row=>normalize(row.question)));
  assert.ok(corpus.rows.filter(row=>row.split!=='test').every(row=>!heldout.has(normalize(row.question))));
  const qa=JSON.parse(await readFile(new URL('qa/prompts.json',import.meta.url),'utf8'));
  const questions=new Set(qa.cases.map(row=>normalize(row.prompt)));
  assert.ok(corpus.rows.filter(row=>row.split==='train').every(row=>!questions.has(normalize(row.question))));
});
test('WASM embedding gradient sums repeated IDs correctly and ignores negative segment IDs',()=>{
  let registration;
  registerEmbeddingGradient({registerKernel:value=>{registration=value;}});
  assert.equal(registration.kernelName,'UnsortedSegmentSum');
  const values={x:new Float32Array([1,2,3,4,5,6,99,99]),ids:new Int32Array([0,1,0,-1])};
  const result=registration.kernelFunc({inputs:{x:{dataId:'x',shape:[4,2],dtype:'float32'},segmentIds:{dataId:'ids',shape:[4],dtype:'int32'}},attrs:{numSegments:2},backend:{
    readSync:id=>values[id],makeOutput:(shape,dtype,offset,data)=>({shape,dtype,data:Array.from(data)})
  }});
  assert.deepEqual(result,{shape:[2,2],dtype:'float32',data:[6,8,3,4]});
});
