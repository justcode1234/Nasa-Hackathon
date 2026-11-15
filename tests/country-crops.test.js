import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountryCrops, countryCropName } from '../server/context/crops.js';
import { validateInputs, compareRotations } from '../server/agronomy/rotation.js';
import { syntheticObservations } from './fixtures.js';

test('country choices are sourced production records, never a global fallback', () => {
  const au = getCountryCrops({ country: 'AU' }), gb = getCountryCrops({ country: 'GB' });
  assert.ok(au.choices.some(c => c.id === 'unassessed:fao-27')); // Rice
  assert.ok(!gb.choices.some(c => c.id === 'unassessed:fao-27'));
  assert.ok(au.screeningCropIds.includes('sweet-corn'));
  assert.ok(!gb.screeningCropIds.includes('sweet-corn'));
  assert.deepEqual(getCountryCrops({ country: '' }).choices, []);
  assert.deepEqual(getCountryCrops({ country: 'AQ' }).choices, []);
  assert.deepEqual(getCountryCrops({ country: 'SG' }).screeningCropIds, ['cabbage','tomato']);
  assert.deepEqual(getCountryCrops({ country: 'KH' }).screeningCropIds, []);
  assert.throws(() => getCountryCrops({ country: 'Australia' }));
  assert.ok(au.records.every(r => r.tonnes > 0 && r.units === 't' && r.year >= 2020 && r.year <= 2024 && r.flagDescription));
  assert.ok(au.source.archiveSha256 && au.source.retrievedAt && au.source.license);
  assert.match(au.notices.join(' '), /not live seed availability/);
});

test('country constraints reject foreign alternatives and preserve named unassessed baselines', () => {
  const inputs = { latitude: -31.89, longitude: 116.77, referenceYear: 2025, planningYear: 2027,
    startMonth: 1, country: 'AU', baseline: ['unassessed:fao-27', 'pea', 'bush-bean'], allowedCrops: ['pea', 'bush-bean', 'sweet-corn'],
    priority: 'family', irrigation: 'unknown', soil: 'unknown' };
  assert.throws(() => validateInputs({ ...inputs, country: 'GB' }), /selected country/);
  const result = compareRotations(validateInputs(inputs), syntheticObservations());
  assert.equal(result.scenarios[0].timeline[0].cropName, 'Rice');
  assert.equal(result.scenarios[0].timeline[0].family, null);
  assert.ok(result.sources.some(s => s.id === 'faostat-qcl'));
  assert.equal(countryCropName('unassessed:fao-15'), 'Wheat');
});
