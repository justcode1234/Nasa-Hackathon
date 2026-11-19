import test from 'node:test';
import assert from 'node:assert/strict';
import { createPowerClient, normalizePower, validateLocation } from '../server/nasa/power.js';
import { syntheticPower } from './fixtures.js';

test('validates global coordinates and historical complete-year bounds', () => {
  assert.deepEqual(validateLocation('-90', '180', '2025', new Date('2026-11-14')), { latitude: -90, longitude: 180, year: 2025 });
  for (const args of [[91, 0, 2025], [0, -181, 2025], ['', 0, 2025], [null, 0, 2025], [true, 0, 2025], [[], 0, 2025], [' ', 0, 2025], [0, 0, 2026], [0, 0, 2000], [0, 0, '']]) {
    assert.throws(() => validateLocation(...args, new Date('2026-11-14')));
  }
});
test('normalises fill and absent dates without turning missing rainfall into zero', () => {
  const raw = syntheticPower();
  raw.properties.parameter.PRECTOTCORR['20250101'] = -999;
  delete raw.properties.parameter.PRECTOTCORR['20250102'];
  raw.properties.parameter.T2M['20251231'] = -999;
  const result = normalizePower(raw, { latitude: 1, longitude: 2, year: 2025 }, 'TEST', '2026-11-14');
  assert.equal(result.parameters.PRECTOTCORR.missingDays, 2);
  assert.deepEqual(result.parameters.PRECTOTCORR.values.slice(0, 2), [null, null]);
  assert.equal(result.monthly[0].parameters.PRECTOTCORR.sum, 58);
  assert.equal(result.monthly[0].parameters.PRECTOTCORR.partial, true);
  assert.equal(result.parameters.T2M.latestAvailableDate, '2025-12-30');
  assert.equal(result.parameters.ALLSKY_SFC_SW_DWN.units, 'MJ/m^2/day');
});
test('all-missing parameters have no observed date, mean or total', () => {
  const raw = syntheticPower(2024);
  delete raw.properties.parameter.T2M;
  const result = normalizePower(raw, { latitude: 0, longitude: 0, year: 2024 }, 'TEST', 'TEST');
  assert.equal(result.dates.length, 366);
  assert.equal(result.parameters.T2M.latestAvailableDate, null);
  assert.equal(result.monthly[0].parameters.T2M.mean, null);
  assert.equal(result.monthly[0].parameters.T2M.sum, null);
});
test('rejects schema and unit changes instead of applying incorrect rules', () => {
  assert.throws(() => normalizePower({}, { year: 2025 }), /unrecognised/);
  const raw = syntheticPower();
  raw.parameters.ALLSKY_SFC_SW_DWN.units = 'kWh';
  assert.throws(() => normalizePower(raw, { year: 2025 }), /units/);
  delete raw.parameters.ALLSKY_SFC_SW_DWN;
  assert.throws(() => normalizePower(raw, { year: 2025 }), /unit metadata/);
  raw.header.time_standard = 'UTC';
  assert.throws(() => normalizePower(raw, { year: 2025 }), /time standard/);
});
test('coalesces concurrent requests, caches original retrieval time, separates coordinates and expires', async () => {
  let calls = 0;
  let timestamp = Date.parse('2026-11-14T00:00:00Z');
  const client = createPowerClient({ now: () => new Date(timestamp), ttlMs: 1000,
    fetchImpl: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { ok: true, json: async () => syntheticPower() }; } });
  const input = { latitude: 0, longitude: 0, year: 2025 };
  const [first, parallel] = await Promise.all([client(input), client(input)]);
  assert.equal(calls, 1);
  assert.equal(first.retrievedAt, parallel.retrievedAt);
  timestamp += 500;
  assert.equal((await client(input)).cache.hit, true);
  assert.equal((await client(input)).retrievedAt, first.retrievedAt);
  await client({ ...input, latitude: 1 });
  assert.equal(calls, 2);
  timestamp += 1001;
  assert.equal((await client(input)).cache.hit, false);
  assert.equal(calls, 3);
});
test('upstream HTTP, JSON and network failures return errors and never cache substitutes', async () => {
  const unreachable = 'NASA POWER could not be reached or returned invalid JSON. Retry later; no substitute readings were generated.';
  const shapes = {
    'service answered 429': { fetchImpl: async () => ({ ok: false, status: 429 }), sentence: 'NASA POWER is unavailable (HTTP 429). Retry later; no substitute readings were generated.', reason: undefined },
    'host unreachable': { fetchImpl: async () => { throw new TypeError('fetch failed'); }, sentence: unreachable, reason: 'fetch failed' },
    'service answered invalid JSON': { fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } }), sentence: unreachable, reason: 'Unexpected token < in JSON at position 0' },
  };
  // A status the service answered is a fact a farmer can act on, so it stays in the text; the wording a runtime gives
  // its own transport failure is not, so it stays on the error as `cause` for the log at server/index.js:70.
  for (const [label, shape] of Object.entries(shapes)) {
    const error = await createPowerClient({ fetchImpl: shape.fetchImpl })({ latitude: 0, longitude: 0, year: 2025 }).then(() => null, reason => reason);
    assert.equal(error.status, 502, label);
    assert.equal(error.message, shape.sentence, `${label} sentence`);
    if (shape.reason === undefined) assert.equal(error.cause, undefined, `${label} invents a reason it never caught`);
    else {
      assert.ok(error.cause instanceof Error, `${label} lost the reason the server log needs`);
      assert.equal(error.cause.message, shape.reason, `${label} kept the wrong reason`);
      assert.ok(!error.message.includes(shape.reason), `${label} leaked its reason into farmer-facing text`);
    }
  }
});
