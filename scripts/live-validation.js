import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPowerClient } from '../server/nasa/power.js';

const getObservations = createPowerClient();
const year = new Date().getUTCFullYear() - 1;
const places = [
  { name: 'Perth — validation location', latitude: -31.95, longitude: 115.86 },
  { name: 'Minneapolis — validation location', latitude: 44.98, longitude: -93.27 },
  { name: 'Nairobi — validation location', latitude: -1.29, longitude: 36.82 }
];
const results = [];
// Sequential requests avoid unnecessary pressure on the public NASA service.
for (const place of places) {
  const observations = await getObservations({ ...place, year });
  assert.ok(observations.parameters.T2M.validDays > 0);
  assert.equal(observations.parameters.PRECTOTCORR.units, 'mm/day');
  assert.equal(observations.parameters.ALLSKY_SFC_SW_DWN.units, 'MJ/m^2/day');
  const summary = { ...place, year, retrievedAt: observations.retrievedAt,
    latestAvailableDate: observations.latestAvailableDate,
    januaryMeanC: observations.monthly[0].parameters.T2M.mean,
    julyMeanC: observations.monthly[6].parameters.T2M.mean,
    missingDays: Object.fromEntries(Object.entries(observations.parameters).map(([id, p]) => [id, p.missingDays])),
    source: observations.source };
  results.push(summary);
  console.log(JSON.stringify(summary));
}
assert.notEqual(results[0].januaryMeanC, results[1].januaryMeanC);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/live-validation.json', JSON.stringify(results, null, 2));
console.log('PASS: three real locations, response units, date coverage and contrasting January observations.');
