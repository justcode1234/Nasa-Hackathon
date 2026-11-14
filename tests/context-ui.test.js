import test from 'node:test';
import assert from 'node:assert/strict';
import { initContext } from '../public/js/modules/context.js';

// Minimal UI test doubles; no provider data or scientific measurements are fabricated.
function setup(t) {
  const nodes = new Map();
  const node = () => ({
    value: '', textContent: '', children: [], disabled: false,
    classList: { toggle() {} }, setAttribute() {}, addEventListener() {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; this.textContent = ''; }
  });
  const original = globalThis.document;
  globalThis.document = {
    createElement: node,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, node());
      return nodes.get(id);
    }
  };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  let position = { latitude: 1, longitude: 2 };
  const lookups = [], countries = [];
  const request = async path => {
    const url = new URL(path, 'https://fieldshift.test');
    if (url.pathname === '/api/places') return new Promise((resolve, reject) => lookups.push({ url, resolve, reject }));
    if (url.pathname === '/api/country-crops') return { country: url.searchParams.get('country'), records: [] };
    if (url.pathname === '/api/locations') return { country: url.searchParams.get('country'), regions: [], places: [], source: { title: 'TEST place list', license: 'TEST', retrievedAt: 'TEST' }, notices: [] };
    if (url.pathname === '/api/water-context') return { available: false, notices: [], source: { id: 'abs-irrigation', title: 'Test source', url: 'https://example.invalid' } };
    throw new Error(`Unexpected test request: ${path}`);
  };
  const context = initContext({ request, coordinates: () => position,
    map: { clearFarms() {} }, selectLocation() {}, onFarm() {}, onPests() {}, onSoil() {}, onWater() {}, onCountrySelection() {},
    onCountry: country => countries.push(country)
  });
  return { context, nodes, countries, lookups, move(next) { position = next; context.locationChanged(); } };
}

test('moving while country lookup is pending starts a lookup for the new coordinates and ignores the old result', async t => {
  const { context, nodes, countries, lookups, move } = setup(t);
  move({ latitude: 1, longitude: 2 });
  const old = context.ensureCountry();
  move({ latitude: 3, longitude: 4 });
  const current = context.ensureCountry();
  // Resolve everything even if an assertion fails, so the test leaves no pending timers.
  const hasCurrentLookup = lookups.length === 2;
  lookups[0].resolve({ places: [{ countryCode: 'KE' }] });
  await old;
  if (hasCurrentLookup) {
    const sameCurrent = context.ensureCountry();
    assert.equal(lookups.length, 2, 'finishing the old lookup must not clear the current in-flight task');
    assert.equal(lookups[1].url.searchParams.get('latitude'), '3');
    assert.equal(lookups[1].url.searchParams.get('longitude'), '4');
    lookups[1].resolve({ places: [{ countryCode: 'AU' }] });
    await sameCurrent;
  }
  await current;
  assert.ok(hasCurrentLookup, 'the second location must not reuse the first location lookup');
  assert.equal(nodes.get('pest-country').value, 'AU');
  assert.equal(countries.at(-1).country, 'AU');
  assert.ok(!countries.some(country => country?.country === 'KE'));
});

test('an outdated country-lookup failure cannot overwrite the newer country selection', async t => {
  const { context, nodes, countries, lookups, move } = setup(t);
  move({ latitude: 1, longitude: 2 });
  const old = context.ensureCountry();
  context.locationChanged({ countryCode: 'AU' });
  await context.ensureCountry();
  const message = nodes.get('country-status').textContent;
  lookups[0].reject(new Error('Test-only old lookup failure'));
  await old;
  assert.equal(nodes.get('country-status').textContent, message);
  assert.equal(nodes.get('pest-country').value, 'AU');
  assert.equal(countries.at(-1).country, 'AU');
});
