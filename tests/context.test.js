import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarmClient, createPlaceClient, normalizeFarms } from '../server/context/farms.js';
import { createPestClient, PESTS } from '../server/context/pests.js';
import { createCachedJson } from '../server/context/client.js';
import { answerCatalogQuestion } from '../server/agronomy/answers.js';
import { normalizeSoil } from '../server/context/soil.js';
import { getWaterContext } from '../server/context/water.js';

// DEMO / synthetic OSM/GBIF responses for offline contract checks only.
const osm = () => ({ elements: [
  { type: 'node', id: 1, lat: 52.19, lon: .09 }, { type: 'node', id: 2, lat: 52.191, lon: .09 }, { type: 'node', id: 3, lat: 52.19, lon: .091 },
  { type: 'way', id: 4, nodes: [1, 2, 3, 1], tags: { landuse: 'farmland', crop: 'wheat;barley' }, timestamp: '2022-01-01T00:00:00Z', version: 1 },
  { type: 'way', id: 5, nodes: [1, 2, 99, 1], tags: { landuse: 'farmland' } },
  { type: 'way', id: 6, nodes: [1, 2, 3], tags: { landuse: 'farmland' } },
  { type: 'way', id: 7, nodes: [1, 2, 3, 1], tags: { landuse: 'orchard' } }
] });
test('OSM normalization draws only complete rings, preserves crop tags and edit dates, and leaves absent crops unknown', () => {
  const result = normalizeFarms(osm(), { latitude: 52.19, longitude: .09 }, 'TEST');
  assert.equal(result.farms.length, 2);
  assert.deepEqual(result.farms[0].crops, ['wheat', 'barley']);
  assert.equal(result.farms[0].updatedAt, '2022-01-01T00:00:00Z');
  assert.deepEqual(result.farms[1].crops, []);
  assert.match(result.notices.join(' '), /not verified ownership/);
});
test('bounded farm requests validate coordinates, use a fixed host, and cache original retrieval times', async () => {
  let calls = 0, requested;
  const client = createFarmClient({ fetchImpl: async url => { calls++; requested = String(url); return { ok: true, json: async () => osm() }; } });
  const input = { latitude: 52.19, longitude: .09 };
  const first = await client(input), second = await client(input);
  assert.equal(calls, 1); assert.equal(first.retrievedAt, second.retrievedAt);
  assert.ok(requested.startsWith('https://api.openstreetmap.org/api/0.6/map.json?bbox='));
  await assert.rejects(client({ latitude: 90, longitude: 0 }));
  await assert.rejects(client({ latitude: '', longitude: 0 }));
});
test('context errors do not become empty success records', async () => {
  const request = createCachedJson({ fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(request('https://example.invalid'), /No records were invented/);
});
test('place searches are validated and contain the country returned by Nominatim', async () => {
  const getPlaces = createPlaceClient({ fetchImpl: async () => ({ ok: true, json: async () => [{ display_name: 'TEST place', lat: '1', lon: '2', address: { country_code: 'ke', country: 'Kenya' } }] }) });
  const result = await getPlaces({ q: 'TEST' });
  assert.equal(result.places[0].countryCode, 'KE');
  assert.equal(result.places[0].latitude, 1);
  await assert.rejects(getPlaces({ q: '*' }));
});
test('point verification requests regional detail from the fixed place service and retains its region',async()=>{
  let observed;
  const getPlaces=createPlaceClient({fetchImpl:async url=>{observed=new URL(url);return {ok:true,json:async()=>({display_name:'TEST reverse point',lat:'18.52',lon:'73.85',address:{country_code:'in',state:'Maharashtra'}})}}});
  const result=await getPlaces({latitude:18.52,longitude:73.85,detail:'region',url:'https://untrusted.invalid'});
  assert.equal(observed.hostname,'nominatim.openstreetmap.org');assert.equal(observed.pathname,'/reverse');
  assert.equal(observed.searchParams.get('zoom'),'10');assert.equal(observed.searchParams.get('accept-language'),'en');
  assert.equal(result.places[0].region,'Maharashtra');assert.equal(result.places[0].countryCode,'IN');
  await assert.rejects(getPlaces({latitude:18.52,longitude:73.85,detail:'arbitrary'}),/supported region detail/);
});
test('pest occurrence counts are country records, zero means no records, and query failures stay unknown', async () => {
  let calls = 0;
  const getPests = createPestClient({ fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ count: 0, results: [] }) }; } });
  const result = await getPests({ country: 'AU' });
  assert.equal(calls, PESTS.length);
  assert.ok(result.records.every(r => r.occurrenceCount === 0 && r.status.includes('No matching')));
  assert.match(result.notices.join(' '), /zero records do not establish absence/);
  await assert.rejects(getPests({ country: 'Australia' }));
  const unavailable = await createPestClient({ fetchImpl: async () => { throw new Error('offline'); } })({ country: 'KE' });
  assert.ok(unavailable.records.every(r => r.occurrenceCount === null && r.status === 'Unavailable'));
});
test('general crop questions return sourced facts without needing a field or synthetic NASA evidence', () => {
  const answer = answerCatalogQuestion('What do peas need?');
  assert.ok(answer.blocks.some(b => b.text.includes('Fabaceae')));
  assert.ok(answer.sources.some(s => s.id === 'umn-peas'));
  assert.ok(answer.blocks.some(b => b.text.includes('No location-specific comparison')));
});

test('catalog answers match explicit multiword sweet-corn names and explain unsupported generic corn', () => {
  for (const name of ['sweet corn', 'sweet-corn', 'sweetcorn']) {
    assert.ok(answerCatalogQuestion(`Tell me about ${name}`).blocks.some(block => block.kind === 'sourced crop facts' && block.sourceIds.includes('umn-corn')));
  }
  for (const name of ['maize', 'corn', 'grain maize', 'field corn']) {
    const answer = answerCatalogQuestion(`How long does ${name} take?`);
    assert.ok(answer.blocks.every(block => block.kind !== 'sourced crop facts'));
    assert.ok(answer.blocks.some(block => block.text.includes('remain unassessed')));
  }
});
test('soil model values use source unit factors, retain intervals and never become farm measurements', () => {
  const raw = { properties: { layers: [{ name: 'phh2o', unit_measure: { d_factor: 10 }, depths: [{ range: { top_depth: 0, bottom_depth: 5 }, values: { mean: 72, 'Q0.05': 56, 'Q0.95': 88 } }] }] } };
  const result = normalizeSoil(raw, { latitude: -31.89, longitude: 116.77 }, 'TEST', 'TEST');
  assert.equal(result.properties[0].mean, 7.2);
  assert.equal(result.properties[0].lower, 5.6);
  assert.equal(result.properties[1].mean, null);
  assert.equal(result.observationDate, null);
  assert.match(result.notices.join(' '), /advises against/);
  raw.properties.layers[0].unit_measure.d_factor = 1;
  assert.throws(() => normalizeSoil(raw, {}, '', ''), /unit conversion/);
});
test('Australian irrigation benchmark is a reproducible annual aggregate, never applied to other countries', () => {
  const au = getWaterContext({ country: 'AU' });
  assert.equal(au.rows[0].appliedMlPerIrrigatedHa, 382626 / 98785);
  assert.equal(au.period, 'Australian financial year 2020–21');
  assert.equal(getWaterContext({ country: 'KE' }).available, false);
  assert.deepEqual(getWaterContext({ country: 'KE' }).rows, []);
  assert.match(au.notices.join(' '), /not a recommended dose/);
});
