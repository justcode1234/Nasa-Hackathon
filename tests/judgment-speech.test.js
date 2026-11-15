import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build, SCHEMA, normalize } from '../scripts/build-judgment-data.js';
import { englishLocalVoice } from '../public/js/modules/speech.js';

test('typed-judgment data keeps acceptance prompts out of every split and the held-out set separate', () => {
  const data = build();
  const acceptance = new Set(JSON.parse(readFileSync('tests/qa/prompts.json', 'utf8')).cases.map(c => normalize(c.prompt)));
  const development = new Set([...data.train, ...data.validation].map(row => normalize(row.text)));
  for (const row of [...data.train, ...data.validation, ...data.holdout]) assert.ok(!acceptance.has(normalize(row.text)), row.text);
  for (const row of data.holdout) assert.ok(!development.has(normalize(row.text)), row.text);
  const trainTemplates = new Set(data.train.map(row => row.template));
  assert.ok(data.validation.every(row => !trainTemplates.has(row.template)), 'validation templates are unseen in training');
  assert.ok(data.train.length > 400 && data.holdout.length >= 90);
});

test('typed-judgment report matches the saved weights, uses only schema options and makes no agronomic claim', () => {
  const report = JSON.parse(readFileSync('models/judgment/evaluation.json', 'utf8'));
  assert.equal(report.weightsSha256, createHash('sha256').update(readFileSync('models/judgment/weights.bin')).digest('hex'));
  assert.equal(report.weightBytes, report.parameters * 4);
  for (const [head, result] of Object.entries(report.evaluation)) {
    assert.deepEqual(result.options, SCHEMA[head]);
    for (const failure of result.failures) { assert.ok(SCHEMA[head].includes(failure.predicted)); assert.ok(SCHEMA[head].includes(failure.expected)); }
    assert.ok(result.abstention.answered + result.abstention.abstained === result.heldOutExamples);
    assert.ok(result.ruleBaselineCorrect >= 0 && result.majorityClassCorrect > 0);
  }
  assert.match(report.kind, /Not Jev; not agronomic accuracy or crop-success confidence/);
  assert.match(report.training.heldOutEvaluations, /no longer untouched/);
});

test('read aloud only ever selects an on-device English voice', () => {
  const voices = [{ name: 'Remote English', lang: 'en-US', localService: false, default: true }, { name: 'Local French', lang: 'fr-FR', localService: true },
    { name: 'Local UK', lang: 'en-GB', localService: true }, { name: 'Local US', lang: 'en-US', localService: true, default: true }];
  assert.equal(englishLocalVoice(voices).name, 'Local US');
  assert.equal(englishLocalVoice(voices.slice(0, 2)), null, 'a remote English voice or a local non-English voice is never used');
  const source = readFileSync('public/js/modules/speech.js', 'utf8');
  assert.doesNotMatch(source, /requestSubmit|\.submit\(/, 'dictation must never send a message');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/, 'the speech module itself makes no network requests');
});
