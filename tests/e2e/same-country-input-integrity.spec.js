import { test, expect } from '@playwright/test';
import { getCountryCrops } from '../../server/context/crops.js';
import { syntheticObservations } from '../fixtures.js';

const source = { title: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' };
const locationResult = {
  schemaVersion: 1, country: 'AU', available: true,
  regions: [{ id: 'R1', name: 'TEST region one' }, { id: 'R2', name: 'TEST region two' }],
  places: [
    { id: 'T1', name: 'TEST town one', country: 'AU', regionCode: 'R1', latitude: -31.89, longitude: 116.77 },
    { id: 'T2', name: 'TEST town two', country: 'AU', regionCode: 'R2', latitude: -31.95, longitude: 116.85 },
  ],
  source: { title: 'TEST saved places', license: 'TEST', retrievedAt: '2026-11-28T00:00:00.000Z', coverage: 'TEST only' },
  notices: [],
};
const farmsResult = {
  schemaVersion: 1, retrievedAt: '2026-11-28T00:00:00.000Z', source,
  farms: [
    { id: 'way/one', name: 'FIELD ONE', crops: ['wheat'], representativePoint: { latitude: -31.89, longitude: 116.77 },
      geometry: { type: 'Polygon', coordinates: [[[116.76, -31.90], [116.78, -31.90], [116.78, -31.88], [116.76, -31.88], [116.76, -31.90]]] },
      cropEvidence: 'TEST ONLY', updatedAt: null, sourceUrl: 'https://www.openstreetmap.org/way/one' },
    { id: 'way/two', name: 'FIELD TWO', crops: ['maize'], representativePoint: { latitude: -31.95, longitude: 116.85 },
      geometry: { type: 'Polygon', coordinates: [[[116.84, -31.96], [116.86, -31.96], [116.86, -31.94], [116.84, -31.94], [116.84, -31.96]]] },
      cropEvidence: 'TEST ONLY', updatedAt: null, sourceUrl: 'https://www.openstreetmap.org/way/two' },
  ],
  notices: [],
};

async function prepare(page) {
  await page.addInitScript(({ locationResult, farmsResult, countryCrops, observations, source }) => {
    const fixture = path => {
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/locations') return locationResult;
      if (url.pathname === '/api/country-crops') return countryCrops;
      if (url.pathname === '/api/water-context') return { available: false, notices: [], source };
      if (url.pathname === '/api/farms') return farmsResult;
      if (url.pathname === '/api/observations') return observations;
      return undefined;
    };
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      postMessage(message) {
        const data = message?.path ? fixture(message.path) : undefined;
        if (data !== undefined) {
          queueMicrotask(() => this.onmessage({ data: { id: message.id, data: structuredClone(data) } }));
          return;
        }
        return super.postMessage(message);
      }
    };
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(input?.url ?? input, location.href);
      const data = fixture(`${url.pathname}${url.search}`);
      if (data !== undefined) return Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } }));
      return originalFetch(input, init);
    };
  }, { locationResult, farmsResult, countryCrops: getCountryCrops({ country: 'AU' }),
    observations: { ...syntheticObservations(2024), cache: { hit: false } }, source });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
}

async function setCrops(page) {
  await page.locator('#tab-si').click();
  for (const [index, value] of ['sweet-corn', 'pea', 'bush-bean'].entries()) await page.locator(`#baseline-${index + 1}`).selectOption(value);
  for (const choice of await page.locator('[name="allowedCrops"]').all()) await choice.uncheck();
  await page.locator('[name="allowedCrops"][value="sweet-corn"]').check();
  await page.locator('[name="allowedCrops"][value="pea"]').check();
}

async function loadEvidence(page) {
  await page.locator('#tab-location').click();
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded', { timeout: 60_000 });
}

async function expectInputs(page) {
  await expect(page.locator('#baseline-1')).toHaveValue('sweet-corn');
  await expect(page.locator('#baseline-2')).toHaveValue('pea');
  await expect(page.locator('#baseline-3')).toHaveValue('bush-bean');
  expect((await page.locator('[name="allowedCrops"]:checked').evaluateAll(nodes => nodes.map(node => node.value))).sort()).toEqual(['pea', 'sweet-corn']);
}

async function expectEvidenceCleared(page) {
  await expect(page.locator('#evidence-status')).toContainText('Location or reference year changed');
  await expect(page.locator('#evidence-output')).toBeEmpty();
  await expect(page.locator('#compare')).toBeDisabled();
  await expect(page.locator('.scenario')).toHaveCount(0);
}

test('a same-country town change preserves crop choices and clears loaded evidence', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.locator('#pest-country').selectOption('AU');
  await expect(page.locator('#place-region')).toBeEnabled();
  await page.locator('#place-region').selectOption('R1');
  await page.locator('#place-town').selectOption('T1');
  await page.locator('#reference-year').fill('2024');
  await setCrops(page);
  await loadEvidence(page);
  await expectInputs(page);
  await page.locator('#tab-location').click();
  await page.locator('#place-region').selectOption('R2');
  await page.locator('#place-town').selectOption('T2');
  await expect(page.locator('#pest-country')).toHaveValue('AU');
  await expect(page.locator('#latitude')).toHaveValue('-31.95');
  await expect(page.locator('#longitude')).toHaveValue('116.85');
  await expectInputs(page);
  await expectEvidenceCleared(page);
  expect(errors, info.project.name).toEqual([]);
});

test('same-country field changes preserve crop choices and clear each older evidence load', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await page.locator('#reference-year').fill('2024');
  await setCrops(page);
  await loadEvidence(page);
  await page.locator('#tab-location').click();
  await page.locator('#find-farms').click();
  await expect(page.locator('#farm-results')).toBeEnabled();
  await page.locator('#farm-results').selectOption('way/one');
  await expect(page.locator('#farm-details')).toContainText('FIELD ONE');
  await expectInputs(page);
  await expectEvidenceCleared(page);
  await loadEvidence(page);
  await page.locator('#tab-location').click();
  await page.locator('#farm-results').selectOption('way/two');
  await expect(page.locator('#farm-details')).toContainText('FIELD TWO');
  await expect(page.locator('#pest-country')).toHaveValue('AU');
  await expect(page.locator('#latitude')).toHaveValue('-31.95');
  await expect(page.locator('#longitude')).toHaveValue('116.85');
  await expectInputs(page);
  await expectEvidenceCleared(page);
  expect(errors, info.project.name).toEqual([]);
});
