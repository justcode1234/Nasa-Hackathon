import { test, expect } from '@playwright/test';
import { getCountryCrops } from '../../server/context/crops.js';
import { syntheticObservations } from '../fixtures.js';
import { installTransportHolds, releaseHold, waitForHold } from './helpers/transport-holds.js';

const source = { title: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' };
const placeResult = (name, id, countryCode, latitude, longitude) => ({
  schemaVersion: 1, retrievedAt: '2026-11-27T00:00:00.000Z', source,
  places: [{ id, name, countryCode, country: countryCode, region: 'TEST region', latitude, longitude }],
});
const locationResult = {
  schemaVersion: 1, country: 'AU', available: true,
  regions: [{ id: 'R1', name: 'TEST region one' }, { id: 'R2', name: 'TEST region two' }],
  places: [
    { id: 'T1', name: 'TEST town one', country: 'AU', regionCode: 'R1', latitude: -31.89, longitude: 116.77 },
    { id: 'T2', name: 'TEST town two', country: 'AU', regionCode: 'R2', latitude: -31.90, longitude: 116.78 },
    { id: 'T3', name: 'TEST town three', country: 'AU', regionCode: 'R2', latitude: -31.91, longitude: 116.79 },
  ],
  source: { title: 'TEST saved places', license: 'TEST', retrievedAt: '2026-11-27T00:00:00.000Z', coverage: 'TEST only' },
  notices: [],
};
const oldFarms = {
  schemaVersion: 1, retrievedAt: '2026-11-27T00:00:00.000Z', source,
  farms: [{ id: 'way/old', name: 'OLD FIELD', crops: ['old crop'], representativePoint: { latitude: -31.89, longitude: 116.77 },
    geometry: { type: 'Polygon', coordinates: [[[116.76, -31.90], [116.78, -31.90], [116.78, -31.88], [116.76, -31.88], [116.76, -31.90]]] },
    cropEvidence: 'TEST ONLY', updatedAt: null, sourceUrl: 'https://www.openstreetmap.org/way/old' }],
  notices: [],
};

async function open(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
}

test('late country crop and town lists cannot replace a newer country', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installTransportHolds(page, [
    { name: 'oldCrops', pathIncludes: '/api/country-crops', queryIncludes: 'country=AU', response: getCountryCrops({ country: 'AU' }) },
    { name: 'oldTowns', pathIncludes: '/api/locations', queryIncludes: 'country=AU', response: { ...locationResult,
      regions: [{ id: 'OLD', name: 'OLD REGION' }], places: [{ id: 'OLD', name: 'OLD TOWN', country: 'AU', regionCode: 'OLD', latitude: -31.89, longitude: 116.77 }] } },
  ]);
  await open(page);
  await page.locator('#pest-country').selectOption('AU');
  await waitForHold(page, 'oldCrops');
  await waitForHold(page, 'oldTowns');
  await page.locator('#pest-country').selectOption('KH');
  await expect(page.locator('#catalog-status')).toContainText('Cambodia');
  await expect(page.locator('#country-status')).toContainText('Cambodia');
  await expect(page.locator('#place-region')).toBeEnabled();
  await releaseHold(page, 'oldCrops');
  await releaseHold(page, 'oldTowns');
  await expect(page.locator('#pest-country')).toHaveValue('KH');
  await expect(page.locator('#catalog-status')).toContainText('Cambodia');
  await expect(page.locator('#country-status')).toContainText('Cambodia');
  await expect(page.locator('#place-region option')).not.toContainText(['OLD REGION']);
  await expect(page.locator('#place-town option')).not.toContainText(['OLD TOWN']);
  expect(errors, info.project.name).toEqual([]);
});

test('newer region, town and global place-search selections survive older completions', async ({ page, context }, info) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route(/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/, route => route.abort('failed'));
  await installTransportHolds(page, [
    { name: 'towns', pathIncludes: '/api/locations', queryIncludes: 'country=AU', response: locationResult },
    { name: 'oldSearch', pathIncludes: '/api/places', queryIncludes: 'q=Cambridge', response: placeResult('OLD SEARCH RESULT', 'old', 'GB', 52.19, 0.09) },
    { name: 'newSearch', pathIncludes: '/api/places', queryIncludes: 'q=York', response: placeResult('NEW SEARCH RESULT', 'new', 'GB', 53.95, -1.08) },
  ]);
  await open(page);
  await page.locator('#pest-country').selectOption('AU');
  await waitForHold(page, 'towns');
  await releaseHold(page, 'towns');
  await expect(page.locator('#place-region')).toBeEnabled();
  await page.locator('#place-region').selectOption('R1');
  await page.locator('#place-region').selectOption('R2');
  await expect(page.locator('#place-region')).toHaveValue('R2');
  await page.locator('#place-town').selectOption('T2');
  await page.locator('#place-town').selectOption('T3');
  await expect(page.locator('#place-town')).toHaveValue('T3');
  await expect(page.locator('#latitude')).toHaveValue('-31.91');
  await expect(page.locator('#longitude')).toHaveValue('116.79');
  await page.locator('#place-query').fill('Cambridge');
  await page.locator('#place-form').evaluate(form => form.requestSubmit());
  await waitForHold(page, 'oldSearch');
  await page.locator('#place-query').fill('York');
  await page.locator('#place-form').evaluate(form => form.requestSubmit());
  await waitForHold(page, 'newSearch');
  await releaseHold(page, 'newSearch');
  await expect(page.locator('#place-results option')).toContainText(['NEW SEARCH RESULT']);
  await releaseHold(page, 'oldSearch');
  await expect(page.locator('#place-results option')).toContainText(['NEW SEARCH RESULT']);
  await expect(page.locator('#place-results option')).not.toContainText(['OLD SEARCH RESULT']);
  expect(errors, info.project.name).toEqual([]);
});

test('a field lookup released after a location change cannot attach old outlines or counts', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installTransportHolds(page, [
    { name: 'oldFarms', pathIncludes: '/api/farms', queryIncludes: 'latitude=-31.89', response: oldFarms },
  ]);
  await open(page);
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await waitForHold(page, 'oldFarms');
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill('52.19');
  await page.locator('#longitude').fill('0.09');
  await releaseHold(page, 'oldFarms');
  await expect(page.locator('#farm-results')).toBeDisabled();
  await expect(page.locator('#farm-results option')).toHaveText(['Load nearby fields first']);
  await expect(page.locator('#farm-details')).toBeEmpty();
  await expect(page.locator('#farms-status')).not.toContainText('OLD FIELD');
  await expect(page.locator('#farms-status')).not.toContainText('1 mapped fields returned');
  await expect(page.locator('#find-farms')).toHaveText('Find mapped fields around selection');
  expect(errors, info.project.name).toEqual([]);
});

test('evidence released after a location change is neither rendered nor reported as a NASA failure', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installTransportHolds(page, [
    { name: 'oldEvidence', pathIncludes: '/api/observations', queryIncludes: 'latitude=-31.89', response: { ...syntheticObservations(2024), cache: { hit: false } } },
  ]);
  await open(page);
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await page.locator('#reference-year').fill('2024');
  await page.locator('#flow-next').click();
  await waitForHold(page, 'oldEvidence');
  await page.locator('#tab-location').click();
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill('52.19');
  await page.locator('#longitude').fill('0.09');
  await releaseHold(page, 'oldEvidence');
  await expect(page.locator('#evidence-status')).toContainText('Location or reference year changed');
  await expect(page.locator('#evidence-status')).not.toHaveClass(/error/);
  await expect(page.locator('#evidence-output')).toBeEmpty();
  await expect(page.locator('#retry-evidence')).toBeHidden();
  await expect(page.locator('#compare')).toBeDisabled();
  expect(errors, info.project.name).toEqual([]);
});
