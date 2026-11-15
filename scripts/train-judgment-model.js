// Typed chat-judgment experiment ("System One"-style, inspired by TypeSafe AI's public
// description of Jev; NOT Jev, not its architecture, weights or training method).
// A small TensorFlow.js Layers (Keras API) classifier answers three fixed questions
// about one chat message. Outputs are enums defined in advance, each with a
// temperature-calibrated probability and an abstention rule. It makes judgments
// only; validated application code keeps every action and scientific calculation.
// Probabilities here describe message classification. They are NOT crop-success,
// yield or agronomic confidence.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as tf from '@tensorflow/tfjs';
import { build, SCHEMA, normalize } from './build-judgment-data.js';
import { parseWorkflowMessage } from '../public/js/modules/workflow-assistant.js';
import { answerGroundedQuestion } from '../server/agronomy/answers.js';

const DIM = 1024, HEADS = Object.keys(SCHEMA), SEED = 20261115;
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % DIM; };
// Fixed, vocabulary-free features: hashed word unigrams/bigrams and character trigrams.
export function featurize(text) {
  const vector = new Float32Array(DIM), clean = normalize(text), words = clean.split(' ').filter(Boolean);
  const add = (token, weight) => { vector[hash(token)] += weight; };
  words.forEach((word, i) => { add(`w:${word}`, 1); if (i) add(`b:${words[i - 1]} ${word}`, 1); });
  const padded = ` ${clean} `;
  for (let i = 0; i < padded.length - 2; i++) add(`c:${padded.slice(i, i + 3)}`, .5);
  let norm = 0; for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1; for (let i = 0; i < DIM; i++) vector[i] /= norm;
  return vector;
}
const labelIndex = (row, head) => head === 'topic' ? SCHEMA.topic.indexOf(row.topic) : row[head];
const tensors = rows => ({ x: tf.tensor2d(rows.map(row => featurize(row.text))),
  y: Object.fromEntries(HEADS.map(head => [head, tf.oneHot(tf.tensor1d(rows.map(row => labelIndex(row, head)), 'int32'), SCHEMA[head].length)])) });
const softmax = (logits, T) => { const m = Math.max(...logits), e = logits.map(v => Math.exp((v - m) / T)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); };
const nll = (logitRows, labels, T) => logitRows.reduce((sum, logits, i) => sum - Math.log(Math.max(softmax(logits, T)[labels[i]], 1e-9)), 0) / labels.length;
function ece(confidences, correct, bins = 10) {
  let total = 0;
  for (let b = 0; b < bins; b++) {
    const idx = confidences.map((c, i) => i).filter(i => confidences[i] > b / bins && confidences[i] <= (b + 1) / bins);
    if (!idx.length) continue;
    const acc = idx.filter(i => correct[i]).length / idx.length, conf = idx.reduce((s, i) => s + confidences[i], 0) / idx.length;
    total += idx.length / confidences.length * Math.abs(acc - conf);
  }
  return total;
}
// Deterministic baselines: the application's existing validated rules.
const topicWords = { greeting: ['hi', 'hello', 'hey', 'thanks', 'thank', 'morning', 'afternoon', 'evening', 'cheers'],
  crops: ['pea', 'peas', 'bean', 'beans', 'corn', 'radish', 'crop', 'crops', 'family', 'maturity', 'legume', 'plant', 'tomato', 'tomatoes', 'cabbage', 'onion', 'onions', 'rice', 'wheat', 'maize'],
  soil: ['soil', 'ph', 'sand', 'sandy', 'clay', 'drainage', 'drain', 'drained'], water: ['water', 'irrigation', 'irrigate', 'watering', 'rainfed', 'drought', 'litres', 'liters'],
  pests: ['pest', 'pests', 'insect', 'insects', 'moth', 'worm', 'armyworm', 'disease', 'infestation'], weather: ['weather', 'nasa', 'rainfall', 'rain', 'precipitation', 'temperature', 'solar', 'frost', 'heat', 'hot', 'cold'],
  comparison: ['rotation', 'baseline', 'alternative', 'alternatives', 'compare', 'comparison', 'sequence', 'timeline', 'repeat', 'scenario', 'ranked', 'ranking'],
  location: ['farm', 'farms', 'farmland', 'map', 'mapped', 'field', 'fields', 'place', 'coordinates', 'location', 'land', 'country', 'town', 'region'] };
export const ruleBaseline = text => {
  const words = normalize(text).split(/[^\p{L}\p{N}]+/u), parsed = parseWorkflowMessage(text, false), grounded = answerGroundedQuestion(text);
  const counts = Object.entries(topicWords).map(([topic, list]) => [topic, words.filter(word => list.includes(word)).length]).sort((a, b) => b[1] - a[1]);
  return { action: parsed && !parsed.cancel ? 1 : 0,
    unsupported: grounded && /^I cannot (?:assign|estimate|calculate|guarantee)/.test(grounded.blocks[0]?.text ?? '') ? 1 : 0,
    topic: SCHEMA.topic.indexOf(counts[0][1] ? counts[0][0] : 'other') };
};

async function main() {
  const data = build();
  tf.util.seedrandom?.(SEED);
  const input = tf.input({ shape: [DIM] });
  const hidden = tf.layers.dropout({ rate: .5, seed: SEED }).apply(tf.layers.dense({ units: 32, activation: 'relu', kernelInitializer: tf.initializers.glorotUniform({ seed: SEED }),
    kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }) }).apply(tf.layers.dropout({ rate: .2, seed: SEED + 9 }).apply(input)));
  const outputs = HEADS.map((head, i) => tf.layers.dense({ units: SCHEMA[head].length, name: head, kernelInitializer: tf.initializers.glorotUniform({ seed: SEED + i + 1 }) }).apply(hidden));
  const model = tf.model({ inputs: input, outputs });
  model.compile({ optimizer: tf.train.adam(.003), loss: HEADS.map(() => (y, logits) => tf.losses.softmaxCrossEntropy(y, logits)) });
  const train = tensors(data.train), validation = tensors(data.validation);
  let best = Infinity, bestWeights = null, bestEpoch = 0;
  const history = [];
  for (let epoch = 1; epoch <= 120; epoch++) {
    await model.fit(train.x, HEADS.map(head => train.y[head]), { epochs: 1, batchSize: 32, shuffle: false, verbose: 0 });
    const loss = model.evaluate(validation.x, HEADS.map(head => validation.y[head]), { verbose: 0 });
    const value = (await loss[0].data())[0]; loss.forEach(t => t.dispose());
    const out = model.predict(validation.x);
    const accuracies = await Promise.all(out.map(async (t, i) => { const a = t.argMax(-1), b = validation.y[HEADS[i]].argMax(-1), p = await a.data(), y = await b.data(); a.dispose(); b.dispose(); return p.reduce((n, v, k) => n + (v === y[k] ? 1 : 0), 0) / p.length; }));
    out.forEach(t => t.dispose());
    const accuracy = accuracies.reduce((a, b) => a + b, 0) / HEADS.length;
    history.push([Number(value.toFixed(4)), Number(accuracy.toFixed(4))]);
    // Model selection: highest mean validation accuracy across heads; validation loss breaks ties.
    const score = -accuracy + value * 1e-3;
    if (score < best - 1e-6) { best = score; bestEpoch = epoch; bestWeights?.forEach(w => w.dispose()); bestWeights = model.getWeights().map(w => w.clone()); }
    else if (epoch - bestEpoch >= 25) break;
  }
  model.setWeights(bestWeights);
  const logitsOf = async rows => { const out = model.predict(tf.tensor2d(rows.map(row => featurize(row.text)))); const arrays = await Promise.all(out.map(t => t.array())); out.forEach(t => t.dispose()); return Object.fromEntries(HEADS.map((head, i) => [head, arrays[i]])); };
  const valLogits = await logitsOf(data.validation), testLogits = await logitsOf(data.holdout);
  // Temperature per head and abstention threshold are chosen on VALIDATION only.
  const calibration = {};
  for (const head of HEADS) {
    const labels = data.validation.map(row => labelIndex(row, head));
    let T = 1, bestNll = Infinity;
    for (let t = .5; t <= 5.001; t += .05) { const v = nll(valLogits[head], labels, t); if (v < bestNll) { bestNll = v; T = Number(t.toFixed(2)); } }
    const probs = valLogits[head].map(l => softmax(l, T)), conf = probs.map(p => Math.max(...p)), ok = probs.map((p, i) => p.indexOf(Math.max(...p)) === labels[i]);
    // Lowest threshold whose accepted validation answers are at least 95% correct; else abstain below .95.
    let threshold = .95;
    for (let th = .5; th <= .95001; th += .05) { const kept = conf.map((c, i) => i).filter(i => conf[i] >= th); if (kept.length && kept.filter(i => ok[i]).length / kept.length >= .95) { threshold = Number(th.toFixed(2)); break; } }
    calibration[head] = { temperature: T, abstainBelow: threshold, validationAccuracy: ok.filter(Boolean).length / ok.length };
  }
  const evaluation = { heads: {}, examples: [] };
  const baselineRows = data.holdout.map(row => ruleBaseline(row.text));
  for (const head of HEADS) {
    const labels = data.holdout.map(row => labelIndex(row, head)), { temperature, abstainBelow } = calibration[head];
    const probs = testLogits[head].map(l => softmax(l, temperature)), pred = probs.map(p => p.indexOf(Math.max(...p))), conf = probs.map(p => Math.max(...p));
    const ok = pred.map((p, i) => p === labels[i]), kept = conf.map((c, i) => i).filter(i => conf[i] >= abstainBelow);
    const base = baselineRows.map(row => row[head]), baseOk = base.map((p, i) => p === labels[i]);
    const majority = Math.max(...SCHEMA[head].map((_, c) => labels.filter(l => l === c).length));
    evaluation.heads[head] = { options: SCHEMA[head], heldOutExamples: labels.length,
      modelCorrect: ok.filter(Boolean).length, ruleBaselineCorrect: baseOk.filter(Boolean).length, majorityClassCorrect: majority,
      expectedCalibrationError: Number(ece(conf, ok).toFixed(4)), uncalibratedExpectedCalibrationError: Number(ece(testLogits[head].map(l => Math.max(...softmax(l, 1))), ok).toFixed(4)),
      abstention: { threshold: abstainBelow, answered: kept.length, answeredCorrect: kept.filter(i => ok[i]).length, abstained: labels.length - kept.length },
      modelRightRuleWrong: ok.filter((v, i) => v && !baseOk[i]).length, ruleRightModelWrong: ok.filter((v, i) => !v && baseOk[i]).length,
      failures: data.holdout.map((row, i) => ok[i] ? null : { text: row.text, expected: SCHEMA[head][labels[i]], predicted: SCHEMA[head][pred[i]], probability: Number(conf[i].toFixed(3)), abstained: conf[i] < abstainBelow }).filter(Boolean) };
  }
  // Schema guarantee: every output is one of the predefined options (argmax over a fixed head).
  // Latency on this machine (pure-JS CPU backend), single message, after warm-up.
  const one = tf.tensor2d([featurize('warm up')]); model.predict(one).forEach(t => t.dispose());
  const samples = data.holdout.slice(0, 50), start = performance.now();
  for (const row of samples) { const x = tf.tensor2d([featurize(row.text)]); const out = model.predict(x); await Promise.all(out.map(t => t.data())); out.forEach(t => t.dispose()); x.dispose(); }
  const modelMs = (performance.now() - start) / samples.length, ruleStart = performance.now();
  for (let r = 0; r < 20; r++) for (const row of samples) ruleBaseline(row.text);
  const ruleMs = (performance.now() - ruleStart) / (samples.length * 20);
  const weights = model.getWeights(), parameters = model.countParams();
  const flat = Buffer.concat(await Promise.all(weights.map(async w => Buffer.from((await w.data()).buffer))));
  mkdirSync('models/judgment', { recursive: true });
  writeFileSync('models/judgment/weights.bin', flat);
  const report = { kind: 'DEVELOPMENT experiment: typed chat-message judgments. Not Jev; not agronomic accuracy or crop-success confidence.',
    trainedAt: new Date().toISOString(), framework: `TensorFlow.js ${tf.version.tfjs} Layers API (Keras-compatible), backend ${tf.getBackend()}`, seed: SEED,
    architecture: `hashed word/bigram/char-trigram features (${DIM}) -> Dropout(0.2) -> Dense(32, relu, L2 1e-4) -> Dropout(0.5) -> three linear heads`, parameters, weightBytes: flat.length,
    weightsSha256: createHash('sha256').update(flat).digest('hex'), weightShapes: weights.map(w => w.shape),
    data: { train: data.train.length, validation: data.validation.length, heldOut: data.holdout.length, split: 'train/validation by wording template; held-out hand-written; evaluated twice (see training.heldOutEvaluations)',
      acceptancePromptsExcluded: true, labelAuthor: 'AI-assisted authored labels; not independently reviewed' },
    training: { epochsRun: history.length, selectedEpoch: bestEpoch, selection: 'highest mean validation accuracy across heads', validationLossAndAccuracyByEpoch: history,
      heldOutEvaluations: 'Second evaluation on this held-out set. Run 1 (fewer templates, loss-selected) scored action 73/95, unsupported 78/95, topic 31/95, each at or below the majority-class rate. Changes for run 2 were chosen from validation behaviour only, but the held-out set is no longer untouched.' }, calibration,
    latency: { modelMsPerMessage: Number(modelMs.toFixed(3)), ruleBaselineMsPerMessage: Number(ruleMs.toFixed(4)), note: 'Development machine, Node, pure-JS CPU backend. The rules are faster; no speed-up is claimed.' },
    evaluation: evaluation.heads };
  writeFileSync('models/judgment/evaluation.json', JSON.stringify(report, null, 1));
  writeFileSync('models/judgment/model.json', JSON.stringify({ schema: SCHEMA, featureDim: DIM, calibration, weightShapes: weights.map(w => w.shape), topology: model.toJSON(null, false) }));
  for (const head of HEADS) { const h = evaluation.heads[head]; console.log(head, `model ${h.modelCorrect}/${h.heldOutExamples}`, `rules ${h.ruleBaselineCorrect}`, `majority ${h.majorityClassCorrect}`, `ECE ${h.expectedCalibrationError}`, `answered ${h.abstention.answeredCorrect}/${h.abstention.answered} at >=${h.abstention.threshold}`); }
  console.log(`parameters ${parameters}, ${flat.length} bytes, epoch ${bestEpoch}/${history.length}, model ${modelMs.toFixed(2)} ms vs rules ${ruleMs.toFixed(3)} ms per message`);
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/train-judgment-model.js')) await main();
