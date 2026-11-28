import { test, expect } from '@playwright/test';
import { getCountryCrops } from '../../server/context/crops.js';

const source = { title: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' };
const locationResult = {
  schemaVersion: 1, country: 'AU', available: true,
  regions: [{ id: 'R1', name: 'TEST region one' }, { id: 'R2', name: 'TEST region two' }],
  places: [
    { id: 'T1', name: 'TEST town one', country: 'AU', regionCode: 'R1', latitude: -31.89, longitude: 116.77 },
    { id: 'T2', name: 'TEST town two', country: 'AU', regionCode: 'R2', latitude: -31.90, longitude: 116.78 },
    { id: 'T3', name: 'TEST town three', country: 'AU', regionCode: 'R2', latitude: -31.91, longitude: 116.79 },
    { id: 'T4', name: 'TEST shared town', country: 'AU', regionCode: 'R1', latitude: -31.93, longitude: 116.82 },
    { id: 'T5', name: 'TEST shared town', country: 'AU', regionCode: 'R2', latitude: -31.94, longitude: 116.83 },
  ],
  source: { title: 'TEST saved places', license: 'TEST', retrievedAt: '2026-11-27T00:00:00.000Z', coverage: 'TEST only' },
  notices: [],
};
const searchResult = {
  places: [{ name: 'TEST place two', latitude: -31.92, longitude: 116.81, countryCode: 'AU', country: 'AU', region: 'TEST region two' }],
  source, retrievedAt: '2026-11-27T00:00:00.000Z',
};
const last = page => page.locator('#chat-history article').last();
const ready = page => expect(page.locator('#answer-status')).toContainText('Answer ready', { timeout: 90_000 });
const send = async (page, question) => {
  await page.locator('#question').fill(question);
  await page.locator('#ask').click();
  await ready(page);
};

async function prepare(page) {
  await page.addInitScript(({ locationResult, searchResult, countryCrops, source }) => {
    const fixture = path => {
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/locations') return locationResult;
      if (url.pathname === '/api/country-crops') return countryCrops;
      if (url.pathname === '/api/water-context') return { available: false, notices: [], source };
      if (url.pathname === '/api/farms') return { schemaVersion: 1, retrievedAt: '2026-11-27T00:00:00.000Z', source, farms: [], notices: [] };
      if (url.pathname === '/api/places') {
        if (url.searchParams.has('q')) return searchResult;
        return { places: [{ name: 'TEST reverse point', latitude: Number(url.searchParams.get('lat')), longitude: Number(url.searchParams.get('lon')),
          countryCode: 'AU', country: 'AU', region: 'TEST region two' }], source, retrievedAt: '2026-11-27T00:00:00.000Z' };
      }
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
  }, { locationResult, searchResult, countryCrops: getCountryCrops({ country: 'AU' }), source });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
}

async function expectLocation(page, latitude, longitude) {
  await expect.poll(async () => Number(await page.locator('#latitude').inputValue())).toBe(latitude);
  await expect.poll(async () => Number(await page.locator('#longitude').inputValue())).toBe(longitude);
  await expect(page.locator('#pest-country')).toHaveValue('AU');
}

async function chooseChatRegion(page) {
  await page.locator('#chat-toggle').click();
  await send(page, 'Australia');
  await last(page).getByRole('button', { name: 'Plan a rotation in Australia' }).click();
  await ready(page);
  await last(page).getByRole('button', { name: 'A specific area' }).click();
  await ready(page);
  await last(page).getByRole('button', { name: 'TEST region one', exact: true }).click();
  await ready(page);
  await expect(page.locator('#place-region')).toHaveValue('R1');
  await page.locator('#assistant-tools summary').click();
}

async function chooseChatSearchPlace(page) {
  await page.locator('#assistant-tools button[data-chat-tool="search-place"]').click();
  await page.locator('#question').fill('Search for a place named TEST place two');
  await page.locator('#ask').click();
  await ready(page);
  await last(page).locator('button[data-chat-choice]').click();
  await ready(page);
}

test('a saved dropdown town stores its exact source point and region', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.locator('#pest-country').selectOption('AU');
  await expect(page.locator('#place-region')).toBeEnabled();
  await page.locator('#place-region').selectOption('R2');
  await page.locator('#place-town').selectOption('T3');
  await expectLocation(page, -31.91, 116.79);
  await expect(page.locator('#place-region')).toHaveValue('R2');
  await expect(page.locator('#place-town')).toHaveValue('T3');
  expect(errors, info.project.name).toEqual([]);
});

test('a global place-search result stores its exact returned point', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.locator('#place-query').fill('TEST place two');
  await page.locator('#place-form').evaluate(form => form.requestSubmit());
  await expect(page.locator('#place-results option')).toContainText(['TEST place two']);
  await page.locator('#place-results').selectOption({ label: 'TEST place two' });
  await expectLocation(page, -31.92, 116.81);
  expect(errors, info.project.name).toEqual([]);
});

test('coordinate entry replaces an older town and region with the entered point', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.locator('#pest-country').selectOption('AU');
  await expect(page.locator('#place-region')).toBeEnabled();
  await page.locator('#place-region').selectOption('R1');
  await page.locator('#place-town').selectOption('T1');
  await page.locator('#location-method').selectOption('coordinates');
  await page.locator('#latitude').fill('-31.92');
  await page.locator('#longitude').fill('116.80');
  await expectLocation(page, -31.92, 116.80);
  await expect(page.locator('#place-region')).toHaveValue('__all__');
  await expect(page.locator('#place-town')).toHaveValue('');
  expect(errors, info.project.name).toEqual([]);
});

test('a map click stores the same rounded point in coordinates, map status and country lookup', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await expect(page.locator('#country-status')).toContainText('Australia');
  const box = await page.locator('#map').boundingBox();
  await page.locator('#map').click({ position: { x: box.width * 0.6, y: box.height * 0.5 } });
  await expect(page.locator('#latitude')).not.toHaveValue('');
  await expect(page.locator('#longitude')).not.toHaveValue('');
  const latitude = await page.locator('#latitude').inputValue();
  const longitude = await page.locator('#longitude').inputValue();
  await expect(page.locator('#map-status')).toContainText(`Selected ${latitude}°, ${longitude}°.`);
  await expect(page.locator('#pest-country')).toHaveValue('AU');
  expect(errors, info.project.name).toEqual([]);
});

test('chat global search clears an older region before a town in another region', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await chooseChatRegion(page);
  await chooseChatSearchPlace(page);
  await expectLocation(page, -31.92, 116.81);
  await expect(page.locator('#place-region')).toHaveValue('__all__');
  await send(page, 'TEST shared town');
  await expect(last(page)).toContainText('Several listed towns match');
  await expect(last(page).locator('button[data-chat-choice]')).toHaveCount(2);
  await last(page).locator('button[data-chat-choice]').last().click();
  await ready(page);
  await expectLocation(page, -31.94, 116.83);
  await expect(page.locator('#place-region')).toHaveValue('R2');
  await expect(page.locator('#place-town')).toHaveValue('T5');
  expect(errors, info.project.name).toEqual([]);
});

test('chat coordinates clear an older region before a town in another region', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await chooseChatRegion(page);
  await send(page, 'coordinates -31.92, 116.80');
  await expectLocation(page, -31.92, 116.80);
  await expect(page.locator('#place-region')).toHaveValue('__all__');
  await send(page, 'TEST shared town');
  await expect(last(page)).toContainText('Several listed towns match');
  await expect(last(page).locator('button[data-chat-choice]')).toHaveCount(2);
  await last(page).locator('button[data-chat-choice]').last().click();
  await ready(page);
  await expectLocation(page, -31.94, 116.83);
  await expect(page.locator('#place-region')).toHaveValue('R2');
  await expect(page.locator('#place-town')).toHaveValue('T5');
  expect(errors, info.project.name).toEqual([]);
});
