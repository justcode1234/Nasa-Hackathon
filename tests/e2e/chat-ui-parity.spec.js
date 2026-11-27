import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createApiHandler } from '../../server/api.js';
import { createPowerClient } from '../../server/nasa/power.js';
import { createSoilClient } from '../../server/context/soil.js';
import { createPestClient } from '../../server/context/pests.js';

const raw = name => JSON.parse(readFileSync(new URL(`./fixtures/raw/${name}`, import.meta.url), 'utf8'));
const power = raw('chat-evidence-raw-power-2024.json');
const soil = raw('chat-evidence-raw-soilgrids.json');
const fields = /overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const last = page => page.locator('#chat-history article').last();
const ready = page => expect(page.locator('#answer-status')).toContainText('Answer ready', { timeout: 90_000 });
const send = async (page, question) => {
  await page.locator('#question').fill(question);
  await page.locator('#ask').click();
  await ready(page);
};
const tool = (page, prompt) => page.locator(`#assistant-tools button[data-prompt="${prompt}"]`);

async function prepared(page, context, info) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    return route.abort('failed');
  });
  const placeResult = url => url.pathname.endsWith('/reverse') ? {
    lat: '-31.89', lon: '116.77', display_name: 'York, Western Australia, Australia',
    address: { country_code: 'au', country: 'Australia', state: 'Western Australia' },
  } : [
    { lat: '52.19', lon: '0.09', display_name: 'Cambridge, Cambridgeshire, United Kingdom',
      address: { country_code: 'gb', country: 'United Kingdom', state: 'Cambridgeshire' } },
    { lat: '42.36', lon: '-71.06', display_name: 'Cambridge, Massachusetts, United States',
      address: { country_code: 'us', country: 'United States', state: 'Massachusetts' } },
  ];
  if (info.project.name.startsWith('node')) {
    const fetchImpl = async input => {
      const url = new URL(String(input));
      const json = url.hostname === 'rest.isric.org' ? soil : url.hostname === 'api.gbif.org' ? { count: 0, results: [] }
        : url.hostname === 'nominatim.openstreetmap.org' ? placeResult(url) : power;
      return { ok: true, status: 200, json: async () => structuredClone(json) };
    };
    const handler = createApiHandler({ getObservations: createPowerClient({ fetchImpl }), getSoil: createSoilClient({ fetchImpl }),
      getPests: createPestClient({ fetchImpl }),
      getPlaces: async input => {
        const rows = placeResult(new URL(input.latitude != null ? '/reverse' : '/search', 'https://test.invalid'));
        const list = Array.isArray(rows) ? rows : [rows];
        return { places: list.map(row => ({ name: row.display_name, latitude: Number(row.lat), longitude: Number(row.lon),
          countryCode: row.address.country_code.toUpperCase(), country: row.address.country, region: row.address.state })),
          source: { title: 'OpenStreetMap / Nominatim', url: 'https://www.openstreetmap.org/copyright' }, retrievedAt: new Date().toISOString() };
      },
      getFarms: async () => { throw new Error('TEST field lookup refused'); } });
    await context.route(/\/api\//, async route => {
      const request = route.request(), url = new URL(request.url());
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      try {
        const result = await handler({ method: request.method(), url, readJson: async () => body });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
      } catch (error) {
        await route.fulfill({ status: error.status ?? 500, contentType: 'application/json',
          body: JSON.stringify({ error: { code: error.code ?? 'SERVER_ERROR', message: error.message } }) });
      }
    });
  } else {
    await context.route(/power\.larc\.nasa\.gov\/api\//, route => route.fulfill({ json: power }));
    await context.route(/rest\.isric\.org/, route => route.fulfill({ json: soil }));
    await context.route(/api\.gbif\.org\/v1\/occurrence\/search/, route => route.fulfill({ json: { count: 0, results: [] } }));
    await context.route(/nominatim\.openstreetmap\.org\/(?:search|reverse)/, route => route.fulfill({ json: placeResult(new URL(route.request().url())) }));
    await context.route(fields, route => route.abort('failed'));
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalog-status')).toContainText('Choose a country', { timeout: 60_000 });
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await expect(page.locator('#country-status')).toContainText('Australia', { timeout: 60_000 });
  await page.locator('#chat-toggle').click();
  return errors;
}

test('chat tools perform evidence, constraint, context, temperature, search and navigation tasks', async ({ page, context }, info) => {
  test.setTimeout(240_000);
  const errors = await prepared(page, context, info);
  for (const prompt of ['Load historical NASA evidence', 'Find mapped fields around this point', 'Compare baseline and two alternatives',
    'Show temperature in Celsius', 'Show temperature in Fahrenheit', 'Load regional soil estimates', 'Look up country pest records',
    'Open 3D evidence map', 'Return to 2D map', 'Go back one step']) await expect(tool(page, prompt)).toHaveCount(1);
  await expect(page.locator('#assistant-tools button[data-chat-tool="search-place"]')).toHaveCount(1);
  await page.locator('#assistant-tools summary').click();

  await tool(page, 'Load historical NASA evidence').click();
  await ready(page);
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded', { timeout: 60_000 });
  await expect(page.locator('#evidence-output table').first().locator('tbody tr')).toHaveCount(5);

  await send(page, 'Previous crop: moonfruit. Drainage is poorly drained. Pest history: aphids and whiteflies.');
  await expect(page.locator('#previous-crop')).toHaveValue('unassessed:moonfruit');
  await expect(page.locator('#drainage')).toHaveValue('poor');
  await expect(page.locator('#pest-history')).toHaveValue('aphids and whiteflies');

  await tool(page, 'Show temperature in Fahrenheit').click();
  await ready(page);
  await expect(page.locator('#temperature-unit')).toHaveValue('F');
  await expect(page.locator('#evidence-output')).toHaveAttribute('data-temperature-unit', 'F');

  await page.evaluate(() => {
    document.querySelector('#soil-context-output').textContent = 'TEST reset rendered soil context';
    document.querySelector('#soil-context-status').textContent = 'Regional soil context is not loaded for this location.';
  });
  await tool(page, 'Load regional soil estimates').click();
  await ready(page);
  await expect(page.locator('#soil-context-status')).toContainText('Regional soil context loaded', { timeout: 60_000 });

  await tool(page, 'Look up country pest records').click();
  await ready(page);
  await expect(page.locator('#pest-status')).toContainText('Country context loaded', { timeout: 60_000 });
  await expect(page.locator('#pest-output')).toContainText('Country presence is not farm presence');

  await tool(page, 'Go back one step').click();
  await ready(page);
  await expect(page.locator('#evidence')).toBeVisible();

  await page.locator('#assistant-tools button[data-chat-tool="search-place"]').click();
  await expect(page.locator('#question')).toHaveValue('Search for a place named ');
  await expect(page.locator('#question')).toBeFocused();
  await page.locator('#question').fill('Search for a place named Cambridge');
  await page.locator('#ask').click();
  await ready(page);
  const choices = last(page).locator('button[data-chat-choice]');
  await expect(choices).toHaveCount(2);
  await choices.last().click();
  await ready(page);
  await expect(page.locator('#latitude')).toHaveValue('42.36');
  await expect(page.locator('#longitude')).toHaveValue('-71.06');
  await expect(page.locator('#pest-country')).toHaveValue('US');
  expect(errors, info.project.name).toEqual([]);
});

test('chat opens and closes the real optional 3D evidence map', async ({ page, context }, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route(fields, route => route.abort('failed'));
  await context.route(/cdn\.jsdelivr\.net|huggingface\.co|us\.aws\.cdn\.hf\.co/, route => route.abort('failed'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalog-status')).toContainText('Choose a country', { timeout: 60_000 });
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await expect(page.locator('#country-status')).toContainText('Australia', { timeout: 60_000 });
  await page.locator('#chat-toggle').click();
  await page.locator('#assistant-tools summary').click();
  await tool(page, 'Open 3D evidence map').click();
  await ready(page);
  await expect(page.locator('#map3d-panel')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#map')).toBeHidden();
  await tool(page, 'Return to 2D map').click();
  await ready(page);
  await expect(page.locator('#map3d-panel')).toBeHidden();
  await expect(page.locator('#map')).toBeVisible();
  expect(errors, info.project.name).toEqual([]);
});
