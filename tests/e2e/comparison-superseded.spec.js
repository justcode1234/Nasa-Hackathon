import { test, expect } from '@playwright/test';
import { compareRotations } from '../../server/agronomy/rotation.js';
import { normalizePower } from '../../server/nasa/power.js';
import { syntheticPower } from '../fixtures.js';

const staleResult = compareRotations({
  latitude: -31.89, longitude: 116.77, referenceYear: 2024, country: 'AU', planningYear: 2027, startMonth: 1,
  baseline: ['sweet-corn', 'pea', 'bush-bean'], allowedCrops: ['sweet-corn', 'pea'], previousCrop: '',
  irrigation: 'unknown', soil: 'unknown', pestHistory: '', priority: 'family', soilPh: null, drainage: 'unknown',
}, normalizePower(syntheticPower(2024), { latitude: -31.89, longitude: 116.77, year: 2024 }, 'https://example.invalid/TEST-ONLY'));
staleResult.scenarios.forEach((scenario, index) => { scenario.label = `STALE COMPARISON ${index + 1}`; });

async function prepare(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.locator('#example-location').selectOption('-31.89,116.77');
  await page.locator('#reference-year').fill('2024');
  await expect(page.locator('#country-status')).toContainText('Australia');
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded', { timeout: 60_000 });
  await page.locator('#tab-si').click();
  for (const [index, value] of ['sweet-corn', 'pea', 'bush-bean'].entries()) await page.locator(`#baseline-${index + 1}`).selectOption(value);
  for (const choice of await page.locator('[name="allowedCrops"]').all()) await choice.uncheck();
  await page.locator('[name="allowedCrops"][value="sweet-corn"]').check();
  await page.locator('[name="allowedCrops"][value="pea"]').check();
  await expect(page.locator('#compare')).toBeEnabled();
}

test('a comparison released after constraints change never renders or survives as current', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(result => {
    window.__staleComparison = result;
    window.__heldComparisons = 0;
    window.__releasedComparisons = 0;
    const release = () => {
      window.__releasedComparisons++;
      window.__releaseComparison?.();
      window.__releaseComparison = null;
    };
    window.__releaseHeldComparison = release;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      postMessage(message) {
        if (message?.path === '/api/compare' && window.__heldComparisons === 0) {
          window.__heldComparisons++;
          window.__releaseComparison = () => this.onmessage({ data: { id: message.id, data: window.__staleComparison } });
          return;
        }
        return super.postMessage(message);
      }
    };
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = new URL(input?.url ?? input, location.href);
      if (url.pathname === '/api/compare' && window.__heldComparisons === 0 && (init?.method ?? input?.method ?? 'GET') === 'POST') {
        window.__heldComparisons++;
        return new Promise(resolve => {
          window.__releaseComparison = () => resolve(new Response(JSON.stringify(window.__staleComparison), {
            status: 200, headers: { 'content-type': 'application/json' },
          }));
        });
      }
      return originalFetch(input, init);
    };
  }, staleResult);
  await prepare(page);
  await page.locator('#compare').click();
  await page.waitForFunction(() => window.__heldComparisons === 1);
  await page.locator('#priority').selectOption('water');
  await expect(page.locator('#comparison-status')).toContainText('Constraints changed');
  await expect(page.locator('#strategy-output')).toContainText('Inputs changed');
  await page.evaluate(() => window.__releaseHeldComparison());
  await page.waitForFunction(() => window.__releasedComparisons === 1);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.scenario')).toHaveCount(0);
  await expect(page.locator('#strategy-output')).not.toContainText('STALE COMPARISON');
  await page.locator('#chat-toggle').click();
  await expect(page.locator('#chat-history')).not.toContainText('STALE COMPARISON');
  await page.locator('#chat-toggle').click();
  await expect(page.locator('#compare')).toBeEnabled();
  await page.locator('#compare').click();
  await expect(page.locator('.scenario')).toHaveCount(3, { timeout: 60_000 });
  await expect(page.locator('#strategy-output')).not.toContainText('STALE COMPARISON');
  expect(errors, info.project.name).toEqual([]);
});
