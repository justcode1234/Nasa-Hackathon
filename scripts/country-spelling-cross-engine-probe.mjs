// Cross-engine country-spelling check. The recognition table is built from Intl, and Intl's spelling is
// a property of the runtime: measured 18 Nov, Chrome's "en" says "Hong Kong" where Node says "Hong Kong
// SAR China". A farmer who copies a spelling from a document, a search result or another browser must
// still resolve it, so this loads the app's own module in a real browser and feeds it every spelling the
// Node harness generates for all 250 supported codes, reporting any that the browser cannot recognise.
// Run it with: npm run test:country-spelling (serves the built app itself when PROBE_PORT is free).
import { chromium } from '@playwright/test';
import { listCountries, countryPhrasings } from '../tests/helpers/matrix-harness.js';
import { COUNTRY_CODES } from '../public/js/lib/countries.js';
import { startProbeApp } from './lib/probe-app.mjs';

const { base, close: closeApp } = await startProbeApp();
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
  // The guarantee a farmer actually depends on: the wording the step-1 dropdown shows them must be a
  // wording the chat accepts. Read the live <option> labels from this engine's DOM instead of reasoning
  // about which table it uses.
  const labels = [...document.querySelectorAll('#pest-country option')].map(option => ({
    code: option.value, label: option.textContent.trim() })).filter(row => row.code && row.label);
  const pickerFailures = labels.filter(row => {
    const hits = findCountries(`Help me plan a rotation in ${row.label}`);
    return hits.length !== 1 || hits[0] !== row.code;
  });
  return { failures, chromeForms, labels: labels.length, pickerFailures };
}, byCode);
await browser.close();
await closeApp();

// The engine itself can differ on its own wording: report where Chrome's short name is not one of the
// spellings Node generated. That is context rather than a gap, because the picker and the chat read the
// same runtime table - and the picker half of that argument is now checked, not assumed, by reading the
// live <option> labels above. Only the failures and picker mismatches decide the exit code.
const divergent = Object.entries(result.chromeForms)
  .filter(([code, name]) => !byCode[code]?.includes(name)).map(([code, name]) => ({ code, name }));
console.log(JSON.stringify({ codes: Object.keys(byCode).length, spellings: Object.values(byCode).flat().length,
  unrecognisedInChrome: result.failures.length, pickerOptionsChecked: result.labels,
  pickerLabelsTheChatRejects: result.pickerFailures.length,
  chromeOwnSpellingNotInNodeList: divergent.length,
  failures: result.failures.slice(0, 40), pickerFailures: result.pickerFailures.slice(0, 40),
  note: divergent.length ? 'Chrome prints its own label; only the failures and picker mismatches above are gaps' : '' }, null, 1));
if (result.failures.length || result.pickerFailures.length) process.exitCode = 1;
