import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createLocationClient } from '../server/context/locations.js';

const readJson = async name => JSON.parse(await readFile(new URL(`../public/data/locations/${name}`, import.meta.url), 'utf8'));

test('country-sized location files match their source manifest, hashes and coordinate contract', async () => {
  const manifest = await readJson('manifest.json');
  assert.equal(manifest.source.license, 'CC BY 4.0');
  assert.ok(manifest.source.inputs.every(input => input.url.startsWith('https://download.geonames.org/') && input.sha256.length === 64));
  let total = 0;
  for (const [country, entry] of Object.entries(manifest.countries)) {
    const bytes = await readFile(new URL(`../public/data/locations/${country}.json`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
    const data = JSON.parse(bytes);
    assert.equal(data.country, country);
    assert.equal(data.places.length, entry.places);
    assert.equal(new Set(data.places.map(place => place[0])).size, data.places.length);
    assert.ok(data.places.every(place => data.regions.some(region => region.id === place[2]) &&
      Number.isFinite(place[3]) && Math.abs(place[3]) <= 90 && Number.isFinite(place[4]) && Math.abs(place[4]) <= 180));
    total += entry.places;
  }
  assert.equal(total, 70036);
});

test('country lists expose real source towns and regions; missing coverage never uses another country', async () => {
  const getLocations = createLocationClient({ readJson });
  const au = await getLocations({ country: 'AU' }), gb = await getLocations({ country: 'GB' });
  const perth = au.places.find(place => place.name === 'Perth');
  assert.ok(perth && perth.latitude < -30 && perth.longitude > 110);
  assert.ok(au.regions.some(region => region.id === perth.regionCode && region.name === 'Western Australia'));
  assert.ok(gb.places.some(place => place.name === 'Cambridge'));
  assert.ok(gb.places.every(place => place.country === 'GB'));
  assert.equal((await getLocations({ country: 'ZZ' })).available, false);
  assert.deepEqual((await getLocations({ country: 'ZZ' })).places, []);
  await assert.rejects(getLocations({ country: '../AU' }));
  await assert.rejects(getLocations({ country: '' }));
});

test('place-list failures are visible and a retry can succeed with the original source metadata', async () => {
  let fail = true;
  const getLocations = createLocationClient({ readJson: async name => {
    if (fail) throw new Error('TEST missing saved list');
    return readJson(name);
  } });
  await assert.rejects(getLocations({ country: 'AU' }), /could not load/);
  fail = false;
  const first = await getLocations({ country: 'AU' }), second = await getLocations({ country: 'AU' });
  assert.equal(first, second);
  assert.equal(first.source.retrievedAt, (await readJson('manifest.json')).source.retrievedAt);
});

test('malformed or cross-country place data cannot become selectable locations', async () => {
  // Explicit schema fixtures, never production geographical or NASA evidence.
  for (const raw of [{ country: 'GB', places: [], regions: [] }, { country: 'AU', places: [[1, 'TEST', 'TEST', Infinity, 0]], regions: [] }]) {
    const getLocations = createLocationClient({ readJson: async name => name === 'manifest.json' ? { countries: { AU: {} }, source: {} } : raw });
    await assert.rejects(getLocations({ country: 'AU' }), error => error.code === 'LOCATIONS_SCHEMA');
  }
});
