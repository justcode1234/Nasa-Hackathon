// QA plan contract checks. All weather here is the explicitly synthetic TEST ONLY
// fixture; browser acceptance tests use the real provider and never this fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiHandler } from '../server/api.js';
import { getCountryCrops } from '../server/context/crops.js';
import { validateInputs, compareRotations } from '../server/agronomy/rotation.js';
import { syntheticObservations } from './fixtures.js';

const input = () => ({ country: 'AU', latitude: -31.89, longitude: 116.77,
  referenceYear: 2025, planningYear: 2027, startMonth: 1,
  baseline: ['sweet-corn', 'pea', 'bush-bean'], allowedCrops: getCountryCrops({ country: 'AU' }).screeningCropIds,
  irrigation: 'unknown', soil: 'unknown', priority: 'family' });
const compare = (changes = {}, observations = syntheticObservations()) => compareRotations(validateInputs({ ...input(), ...changes }), observations);

test('QA F01/R2: Australia produces three distinct comparable scenarios from its recorded screened subset', () => {
  const result = compare();
  assert.deepEqual(result.scenarios[0].timeline.map(slot => slot.originalInput), input().baseline);
  assert.equal(new Set(result.scenarios.map(scenario => scenario.id)).size, 3);
  assert.equal(result.scenarios.flatMap(scenario => scenario.timeline).length, 9);
  for (const scenario of result.scenarios.slice(1)) for (const slot of scenario.timeline) {
    assert.ok(input().allowedCrops.includes(slot.cropId));
    assert.equal(scenario.timeline[0].start, result.horizon.start);
    assert.equal(scenario.timeline[2].endExclusive, result.horizon.endExclusive);
  }
  assert.match(result.assumptions.join(' '), /four-month.*14 days/s);
  assert.match(result.uncertainty, /local agronomic validation.*unavailable/);
});

test('QA F02: India rice and wheat retain unknown scientific fields while its screened alternatives stay constrained', () => {
  const result = compare({ country: 'IN', latitude: 18.5204, longitude: 73.8567,
    baseline: ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean'],
    allowedCrops: getCountryCrops({ country: 'IN' }).screeningCropIds });
  assert.deepEqual(result.scenarios[0].timeline.slice(0, 2).map(slot => slot.cropName), ['Rice', 'Wheat']);
  for (const slot of result.scenarios[0].timeline.slice(0, 2)) {
    assert.equal(slot.family, null); assert.equal(slot.maturityDays, null); assert.equal(slot.indicators, null);
  }
  for (const scenario of result.scenarios.slice(1)) for (const slot of scenario.timeline) {
    assert.ok(getCountryCrops({ country: 'IN' }).screeningCropIds.includes(slot.cropId));
  }
});

test('QA F03/R2: Singapore and Brazil cannot bypass missing screening coverage through the API', async () => {
  let requests = 0;
  const api = createApiHandler({ getObservations: async () => { requests++; throw new Error('Must validate country coverage first'); } });
  for (const country of ['SG', 'BR']) {
    assert.deepEqual(getCountryCrops({ country }).screeningCropIds, []);
    await assert.rejects(api({ method: 'POST', url: new URL('https://test.invalid/api/compare'), readJson: async () => ({ ...input(), country }) }), /selected country/);
  }
  assert.equal(requests, 0);
});

test('QA M03: impossible coordinates and the incomplete current year are rejected before provider access', async () => {
  let requests = 0;
  const api = createApiHandler({ getObservations: async () => { requests++; throw new Error('Unexpected provider call'); } });
  for (const change of [{ latitude: 91 }, { longitude: 200 }, { referenceYear: new Date().getUTCFullYear() }]) {
    await assert.rejects(api({ method: 'POST', url: new URL('https://test.invalid/api/compare'), readJson: async () => ({ ...input(), ...change }) }));
  }
  assert.equal(requests, 0);
});

test('QA M06: changing pH/drainage changes sourced soil warnings without changing weather or baseline', () => {
  const poor = compare({ soilPh: 8, drainage: 'poor' }).scenarios[0];
  const improved = compare({ soilPh: 6.5, drainage: 'well' }).scenarios[0];
  assert.ok(poor.criteria.soilConcerns > improved.criteria.soilConcerns);
  assert.equal(improved.criteria.soilConcerns, 0);
  assert.deepEqual(poor.timeline.map(slot => slot.originalInput), improved.timeline.map(slot => slot.originalInput));
  assert.deepEqual(poor.timeline.map(slot => slot.indicators), improved.timeline.map(slot => slot.indicators));
  assert.ok(poor.risks.some(risk => /pH 8/.test(risk)));
  assert.ok(poor.risks.some(risk => /poor drainage/.test(risk)));
});

test('QA M10: all priorities retain the same hard warnings and disclose their actual ordering', () => {
  const weather = syntheticObservations();
  weather.parameters.T2M_MIN.values.fill(-2); weather.parameters.PRECTOTCORR.values[10] = null;
  const results = ['family', 'water', 'short-season', 'climate'].map(priority => compare({ priority, soilPh: 8, drainage: 'poor' }, weather));
  for (const result of results) {
    assert.deepEqual(result.ranking.orderedCriteria.slice(0, 5), results[0].ranking.orderedCriteria.slice(0, 5));
    assert.deepEqual(result.scenarios[0].criteria, results[0].scenarios[0].criteria);
    assert.deepEqual(result.scenarios[0].risks, results[0].scenarios[0].risks);
    assert.match(result.scenarios[0].status, /concerns/);
    assert.match(result.ranking.limitation, /not suitability probabilities/);
  }
  assert.match(results[1].ranking.orderedCriteria[5], /zero-rain run/);
  assert.match(results[2].ranking.orderedCriteria[5], /maturity/);
  assert.match(results[3].ranking.orderedCriteria[5], /Pea days/);
});

test('QA M11: irrigation availability alone cannot become sufficiency or calculated water savings', () => {
  const rainfed = compare({ irrigation: 'rainfed' });
  const available = compare({ irrigation: 'available' });
  assert.deepEqual(rainfed.scenarios[0].timeline.map(slot => slot.indicators), available.scenarios[0].timeline.map(slot => slot.indicators));
  assert.match(rainfed.gaps.join(' '), /cannot confirm enough crop water/);
  assert.match(available.gaps.join(' '), /volume, quality and reliability are unknown; adequacy cannot be assessed/);
  for (const result of [rainfed, available]) {
    assert.match(result.ranking.limitation, /does not imply lower water demand/);
    assert.ok(result.scenarios.every(scenario => !Object.keys(scenario.criteria).some(key => /yield|saving|confidence|litres/i.test(key))));
  }
});
