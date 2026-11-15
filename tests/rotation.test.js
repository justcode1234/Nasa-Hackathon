import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInputs, compareRotations, answerQuestion, rankingVector } from '../server/agronomy/rotation.js';
import { catalog } from '../server/agronomy/catalog.js';
import { syntheticObservations } from './fixtures.js';

export const validInput = () => ({ latitude: -31.95, longitude: 115.86, referenceYear: 2025,
  planningYear: 2027, startMonth: 1, baseline: ['sweet-corn', 'sweet-corn', 'pea'],
  allowedCrops: catalog.crops.map(c => c.id), previousCrop: 'pea', irrigation: 'unknown', soil: 'unknown', pestHistory: '', priority: 'family' });

test('rankings repeat exactly; baseline and two distinct alternatives share one 12-month horizon', () => {
  const inputs = validateInputs(validInput());
  const a = compareRotations(inputs, syntheticObservations());
  assert.deepEqual(a, compareRotations(inputs, syntheticObservations()));
  assert.equal(a.scenarios.length, 3);
  assert.equal(new Set(a.scenarios.map(s => s.id)).size, 3);
  assert.equal(a.scenarios[0].baseline, true);
  assert.deepEqual(a.scenarios[0].timeline.map(s => s.cropId), inputs.baseline);
  for (const scenario of a.scenarios) {
    assert.equal(scenario.timeline[0].start, a.horizon.start);
    assert.equal(scenario.timeline[2].endExclusive, a.horizon.endExclusive);
    assert.ok(scenario.sourceIds.every(id => a.sources.some(source => source.id === id)));
    assert.equal(scenario.timeline.reduce((days, slot) => days + slot.slotDays, 0), 365);
  }
});
test('family repetition includes bean/pea, nonadjacent crops and supplied previous crop', () => {
  const input = validInput();
  input.baseline = ['bush-bean', 'sweet-corn', 'pea'];
  const result = compareRotations(validateInputs(input), syntheticObservations());
  assert.equal(result.scenarios[0].criteria.repeatedFamilies, 2);
  assert.ok(result.scenarios[0].risks.some(r => r.includes('Fabaceae')));
});
test('unsupported baseline is preserved and is never assigned crop facts', () => {
  const input = validInput();
  input.baseline = ['rice', 'teff', 'yam'];
  const baseline = compareRotations(validateInputs(input), syntheticObservations()).scenarios[0];
  assert.equal(baseline.criteria.unsupportedCrops, 3);
  assert.equal(baseline.timeline[0].originalInput, 'rice');
  assert.equal(baseline.timeline[0].family, null);
  assert.equal(baseline.timeline[0].indicators, null);
});

test('unspecified corn and maize remain unassessed instead of inheriting sweet-corn maturity rules', () => {
  const inputs = validateInputs({ ...validInput(), baseline: ['maize', 'corn', 'sweet-corn'] });
  const observations = syntheticObservations();
  const result = compareRotations(inputs, observations);
  const baseline = result.scenarios[0];
  assert.equal(baseline.criteria.unsupportedCrops, 2);
  for (const slot of baseline.timeline.slice(0, 2)) {
    assert.equal(slot.cropId, null);
    assert.equal(slot.maturityDays, null);
    assert.equal(slot.indicators, null);
  }
  assert.equal(baseline.timeline[2].cropId, 'sweet-corn');
  const answer = answerQuestion('Can I grow grain maize here?', result, observations);
  assert.ok(answer.blocks.every(block => block.kind !== 'sourced crop facts'));
  assert.ok(answer.blocks.some(block => block.text.includes('remain unassessed')));
  assert.ok(answerQuestion('Tell me about sweet corn', result, observations).blocks.some(block => block.sourceIds.includes('umn-corn')));
});
test('alternatives respect crop restrictions while baseline remains intact', () => {
  const input = validInput();
  input.allowedCrops = ['pea', 'radish'];
  const result = compareRotations(validateInputs(input), syntheticObservations());
  assert.ok(result.scenarios.slice(1).every(s => s.timeline.every(slot => input.allowedCrops.includes(slot.cropId))));
  assert.ok(result.scenarios[0].risks.some(r => r.includes('excluded')));
});
test('missing weather prevents an apparently clean screening and produces null totals', () => {
  const observations = syntheticObservations();
  for (const p of Object.values(observations.parameters)) p.values.fill(null);
  const result = compareRotations(validateInputs(validInput()), observations);
  assert.ok(result.scenarios.every(s => s.criteria.missingEvidenceDays > 0));
  assert.equal(result.scenarios[0].timeline[0].indicators.precipitationMm, null);
  assert.match(result.scenarios[0].status, /concerns/);
});
test('frost-tender historical exposure is counted; it is not called a safe candidate', () => {
  const observations = syntheticObservations();
  observations.parameters.T2M_MIN.values.fill(-2);
  const result = compareRotations(validateInputs(validInput()), observations);
  assert.equal(result.scenarios[0].criteria.frostRiskDays, 200);
  assert.match(result.scenarios[0].status, /concerns/);
});
test('calendar screening catches maturity overruns and handles year-wrap and leap-day mapping', () => {
  const input = validInput();
  input.planningYear = 2028;
  input.startMonth = 11;
  const crop = catalog.crops[0];
  const original = crop.maturityDays;
  try {
    crop.maturityDays = [110, 130];
    input.baseline = ['bush-bean', 'pea', 'radish'];
    const result = compareRotations(validateInputs(input), syntheticObservations());
    assert.equal(result.scenarios[0].criteria.calendarOverruns, 1);
    assert.equal(result.horizon.endExclusive, '2029-11-01');
  } finally { crop.maturityDays = original; }
  input.planningYear = 2028;
  input.startMonth = 1;
  input.baseline = ['sweet-corn', 'pea', 'radish'];
  const result = compareRotations(validateInputs(input), syntheticObservations());
  assert.equal(result.scenarios[0].timeline[0].indicators.leapDaySubstitutions, 1);
  assert.equal(result.scenarios[0].criteria.missingEvidenceDays, 0);
});
test('input validation rejects missing constraints, oversized text and impossible alternatives', () => {
  for (const change of [{ baseline: [] }, { allowedCrops: ['pea'] }, { startMonth: 0 }, { planningYear: 2200 },
    { irrigation: 'guaranteed' }, { soil: undefined }, { priority: 'yield' }, { pestHistory: 'x'.repeat(301) },
    { latitude: null }, { allowedCrops: ['rice', 'pea'] }]) {
    assert.throws(() => validateInputs({ ...validInput(), ...change }));
  }
});
test('priority changes the documented tie-break ordering, not safety checks', () => {
  const scenario = { criteria: { unsupportedCrops: 1, calendarOverruns: 2, missingEvidenceDays: 3, frostRiskDays: 4,
    repeatedFamilies: 5, daysAboveIdealAir: 6, maturityUpperDays: 7 } };
  assert.deepEqual(rankingVector(scenario, 'family'), [1, 2, 3, 4, 0, 5, 6, 7]);
  assert.deepEqual(rankingVector(scenario, 'short-season'), [1, 2, 3, 4, 0, 7, 5, 6]);
});
test('sourced soil pH and drainage checks use farmer inputs while unassessed crops remain explicit', () => {
  const inputs = validateInputs({ ...validInput(), soilPh: 8, drainage: 'poor' });
  const baseline = compareRotations(inputs, syntheticObservations()).scenarios[0];
  assert.equal(baseline.criteria.soilPhAssessedSlots, 3);
  assert.equal(baseline.criteria.soilConcerns, 6);
  assert.match(baseline.status, /concerns/);
  assert.throws(() => validateInputs({ ...validInput(), soilPh: 15 }));
});
test('rain-free exposure counts exact zeros, never missing values or water savings', () => {
  const observations = syntheticObservations();
  observations.parameters.PRECTOTCORR.values.fill(0);
  observations.parameters.PRECTOTCORR.values[49] = null;
  const result = compareRotations(validateInputs({ ...validInput(), priority: 'water' }), observations);
  assert.equal(result.scenarios[0].criteria.longestZeroRainRunDays, 100);
  assert.equal(result.scenarios[0].timeline[0].indicators.longestZeroRainRunDays, 50);
  assert.ok(result.ranking.orderedCriteria.includes('Longest zero-rain run in a crop window'));
});
test('crop and water questions use traceable facts and deterministic limitations', () => {
  const observations = syntheticObservations();
  const result = compareRotations(validateInputs(validInput()), observations);
  const answer = answerQuestion('Tell me about peas', result, observations);
  assert.match(answer.mode, /no language model/);
  assert.ok(answer.blocks.some(b => b.text.includes('Fabaceae') && b.sourceIds.includes('umn-peas')));
  assert.ok(answer.sources.every(s => s.url.startsWith('https://')));
  assert.ok(answerQuestion('Will I have enough water?', result, observations).blocks.some(b => b.text.includes('cannot be assessed')));
});
