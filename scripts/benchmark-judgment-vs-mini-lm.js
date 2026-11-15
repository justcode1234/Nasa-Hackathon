// Compares topic judgments on the held-out set: typed classifier vs deterministic
// rules vs the existing FieldShift Mini word LM (same scoring and relevance guard as
// public/js/modules/mini-lm-worker.js, run here on the pure-JS backend).
import { readFileSync, writeFileSync } from 'node:fs';
import * as tf from '@tensorflow/tfjs';
const dir = 'public/models/fieldshift-mini/';
const spec = JSON.parse(readFileSync(dir + 'model.json', 'utf8')), tokenizer = JSON.parse(readFileSync(dir + 'tokenizer.json', 'utf8'));
const bin = readFileSync(dir + 'weights.bin');
const model = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology: spec.modelTopology, weightSpecs: spec.weightsManifest[0].weights,
  weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) }));
const index = new Map(tokenizer.vocabulary.map((word, i) => [word, i]));
const encode = text => (text.toLowerCase().match(/[a-z]+|[.?]/g) ?? []).map(word => index.get(word) ?? 1);
const topicWords = { crops: ['pea', 'peas', 'bean', 'beans', 'corn', 'radish', 'crop', 'crops', 'family', 'maturity', 'legume', 'plant'], soil: ['soil', 'ph', 'sand', 'clay', 'drainage', 'drain'], water: ['water', 'irrigation', 'irrigate', 'watering', 'rainfed', 'drought'], pests: ['pest', 'pests', 'insect', 'insects', 'moth', 'worm', 'armyworm', 'disease', 'infestation'], weather: ['weather', 'nasa', 'rainfall', 'precipitation', 'temperature', 'solar', 'frost', 'heat'], rotation: ['rotation', 'baseline', 'alternative', 'alternatives', 'compare', 'comparison', 'sequence', 'timeline', 'repeat'], location: ['farm', 'farms', 'farmland', 'map', 'mapped', 'field', 'fields', 'place', 'coordinates', 'location', 'land'], limits: ['accuracy', 'confidence', 'reliable', 'uncertainty', 'limitation', 'limitations', 'unknown', 'missing', 'guarantee', 'yield', 'risk', 'risks', 'savings'], other: [] };
async function score(question) {
  const words = question.toLowerCase().match(/[a-z]+/g) ?? [], q = encode(`question ${question} answer`);
  if (q.length > tokenizer.length - 16 || !q.length || q.filter(id => id === 1).length / q.length > .5) return { topic: null, accepted: false };
  const rows = tokenizer.topics.map(topic => [...q, ...encode(topic.reply), 2]);
  const input = tf.tensor2d(rows.map(ids => Array.from({ length: tokenizer.length }, (_, i) => ids[i] ?? 0)), [rows.length, tokenizer.length], 'int32');
  const output = model.predict(input), probabilities = await output.array(); input.dispose(); output.dispose();
  const scores = rows.map((ids, row) => { let total = 0, count = 0; for (let t = q.length - 1; t < Math.min(tokenizer.length, ids.length - 1); t++) { total -= Math.log(Math.max(probabilities[row][t][ids[t + 1]], 1e-8)); count++; } return total / Math.max(1, count); });
  const order = scores.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value), topic = tokenizer.topics[order[0].i].id;
  return { topic, accepted: (topicWords[topic] ?? []).some(word => words.includes(word)) && order[1].value - order[0].value >= .06 };
}
// Shared label space: the LM has no greeting topic; its "rotation" equals our "comparison";
// its "limits" topic is compared with the unsupported-claim judgment.
const map = { rotation: 'comparison' }, rows = JSON.parse(readFileSync('models/judgment/holdout.json', 'utf8')).rows;
const report = JSON.parse(readFileSync('models/judgment/evaluation.json', 'utf8'));
let topicRows = 0, top1 = 0, accepted = 0, acceptedCorrect = 0, limitsRows = 0, limitsHit = 0, ms = 0;
for (const row of rows) {
  const started = performance.now(), result = await score(row.text); ms += performance.now() - started;
  const topic = map[result.topic] ?? result.topic;
  if (row.unsupported) { limitsRows++; if (result.topic === 'limits') limitsHit++; }
  if (row.topic === 'greeting' || row.unsupported) continue;
  topicRows++; if (topic === row.topic) top1++;
  if (result.accepted) { accepted++; if (topic === row.topic) acceptedCorrect++; }
}
report.miniLmComparison = { note: 'Existing FieldShift Mini word LM on the same held-out rows, excluding greeting rows (no such LM topic) and unsupported-claim rows (scored separately). Not an agronomic measure.',
  topicRows, topicTop1Correct: top1, acceptedByRelevanceGuard: accepted, acceptedCorrect, unsupportedRows: limitsRows, unsupportedRowsRankedAsLimits: limitsHit, msPerMessage: Number((ms / rows.length).toFixed(2)) };
writeFileSync('models/judgment/evaluation.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.miniLmComparison));
