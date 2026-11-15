import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/index.js';
import { createPowerClient } from '../server/nasa/power.js';
import { syntheticPower } from './fixtures.js';

const input = () => ({ latitude: -31.95, longitude: 115.86, referenceYear: 2025, planningYear: 2027,
  startMonth: 1, baseline: ['sweet-corn', 'pea', 'radish'], allowedCrops: ['sweet-corn', 'bush-bean', 'pea', 'radish'],
  priority: 'family', irrigation: 'rainfed', soil: 'unknown' });
async function withApp(fn, fetchImpl = async () => ({ ok: true, json: async () => syntheticPower() })) {
  const app = createApp({ getObservations: createPowerClient({ fetchImpl }) });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  try { await fn(`http://127.0.0.1:${app.address().port}`); }
  finally { await new Promise(resolve => app.close(resolve)); }
}
const post = (base, route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('HTTP conversational crop-country answers bypass NASA and planning validation', async () => {
  let calls = 0;
  await withApp(async base => {
    for (const question of ['hi', 'kai lan from Singapore', 'rice in India', 'Show me rainfall in India']) {
      const response = await post(base, '/api/ask', { question, selectedCountry: 'AU', baseline: ['unconfigured'] });
      assert.equal(response.status, 200);
      const answer = await response.json();
      assert.ok(answer.blocks.length <= 3);
      assert.ok(answer.blocks.every(block => typeof block.text === 'string'));
    }
    assert.equal(calls, 0);
  }, async () => { calls++; throw new Error('A crop-country question must not retrieve unrelated NASA observations'); });
});

test('HTTP end to end: static modules, local map assets, NASA contract, comparison, sourced assistant', async () => {
  await withApp(async base => {
    for (const file of ['/', '/credits.html', '/licenses/fieldshift-mit.txt', '/vendor/leaflet/LICENSE.txt', '/js/app.js', '/js/modules/map.js', '/js/modules/si.js', '/js/modules/strategy.js', '/js/modules/data-flow.js', '/css/app.css', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/images/marker-icon.png']) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200, file);
      assert.ok(response.headers.get('content-security-policy'));
    }
    const crops = await (await fetch(base + '/api/crops')).json();
    assert.match(await (await fetch(base + '/')).text(), /name="fieldshift-transport" content="http"/);
    assert.match(await (await fetch(base + '/index.html')).text(), /name="fieldshift-transport" content="http"/);
    assert.equal(crops.crops.length, 4);
    const places = await (await fetch(base + '/api/locations?country=AU')).json();
    assert.ok(places.places.some(place => place.name === 'Perth'));
    assert.equal(places.source.license, 'CC BY 4.0');
    const observations = await (await fetch(base + '/api/observations?latitude=0&longitude=0&year=2025')).json();
    assert.equal(observations.parameters.T2M.validDays, 365);
    const comparison = await (await post(base, '/api/compare', input())).json();
    assert.equal(comparison.scenarios.length, 3);
    assert.equal(comparison.observations.location.latitude, -31.95);
    const answer = await (await post(base, '/api/ask', { ...input(), question: 'Tell me about peas' })).json();
    assert.ok(answer.sources.some(source => source.id === 'umn-peas'));
    assert.ok(answer.blocks.some(block => block.text.includes('Fabaceae')));
  });
});
test('invalid HTTP inputs are rejected before NASA retrieval', async () => {
  let calls = 0;
  await withApp(async base => {
    assert.equal((await fetch(base + '/api/observations?latitude=&longitude=0&year=2025')).status, 400);
    assert.equal((await post(base, '/api/compare', { ...input(), baseline: [] })).status, 400);
    assert.equal((await post(base, '/api/ask', { ...input(), question: ' ' })).status, 400);
    assert.equal((await post(base, '/api/ask', { ...input(), question: 'x'.repeat(501) })).status, 400);
    assert.equal((await post(base, '/api/compare', null)).status, 400);
    const malformed = await fetch(base + '/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal((await fetch(base + '/api/compare', { method: 'POST', body: '{}' })).status, 415);
    assert.equal(calls, 0);
  }, async () => { calls++; throw new Error('Must not be called'); });
});
test('upstream failure surfaces honest error; server remains usable', async () => {
  await withApp(async base => {
    const response = await post(base, '/api/compare', input());
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error.message, /no substitute readings/);
    assert.equal((await fetch(base + '/api/health')).status, 200);
  }, async () => ({ ok: false, status: 503 }));
});
test('static file routing cannot expose project files, dependencies outside Leaflet, or directories', async () => {
  await withApp(async base => {
    for (const route of ['/AGENTS.md', '/package.json', '/server/index.js', '/vendor/leaflet/../package.json', '/%2e%2e%5cserver%5cindex.js', '/js/', '/api/no-such-route']) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
  });
});
