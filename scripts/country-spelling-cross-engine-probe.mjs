// Cross-engine country-spelling check. The recognition table is built from Intl, and Intl's spelling is
// a property of the runtime: measured 18 Nov, Chrome's "en" says "Hong Kong" where Node says "Hong Kong
// SAR China". A farmer who copies a spelling from a document, a search result or another browser must
// still resolve it, so this loads the app's own module in a real browser and feeds it every spelling the
// Node harness generates for all 250 supported codes, reporting any that the browser cannot recognise.
// Run against a served app: PROBE_PORT=4575 node scripts/country-spelling-cross-engine-probe.mjs
import { chromium } from '@playwright/test';
import { listCountries, countryPhrasings } from '../tests/helpers/matrix-harness.js';
import { COUNTRY_CODES } from '../public/js/lib/countries.js';

const base = `http://127.0.0.1:${process.env.PROBE_PORT ?? 4575}`;
const byCode = Object.fromEntries(COUNTRY_CODES.map(code => [code, countryPhrasings(code)]));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(base, { waitUntil: 'domcontentloaded' });
const result = await page.evaluate(async table => {
  const { findCountries, COUNTRY_NAMES } = await import('/js/lib/countries.js');
  const failures = [], chromeForms = {};
  for (const [code, phrasings] of Object.entries(table)) {
    chromeForms[code] = COUNTRY_NAMES.of(code);
    for (const phrasing of phrasings) {
      const hits = findCountries(`Help me plan a rotation in ${phrasing}`);
      if (hits.length !== 1 || hits[0] !== code) failures.push({ code, phrasing, hits });
    }
  }
  return { failures, chromeForms };
}, byCode);
await browser.close();

// The engine itself can differ on its own wording: report where Chrome's short name is not one of the
// spellings Node generated. That direction is harmless — Chrome's own label is in Chrome's table by
// construction — so only the failures above decide the exit code, and this list is reported for context.
const divergent = Object.entries(result.chromeForms)
  .filter(([code, name]) => !byCode[code]?.includes(name)).map(([code, name]) => ({ code, name }));
console.log(JSON.stringify({ codes: Object.keys(byCode).length, spellings: Object.values(byCode).flat().length,
  unrecognisedInChrome: result.failures.length, chromeOwnSpellingNotInNodeList: divergent.length,
  failures: result.failures.slice(0, 40), note: divergent.length ? 'Chrome prints its own label; only the failures above are gaps' : '' }, null, 1));
if (result.failures.length) process.exitCode = 1;
