// Real Node backend + installed Chrome; deliberate failures never supply substitute NASA values.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createApp } from '../server/index.js';
import { createPowerClient } from '../server/nasa/power.js';
import { openChrome } from './chrome.js';
import { validateConversation, validateGuidedWorkflow } from './chat-validation.js';

let rejectNasa = false, browser;
const upstreamRequests = [], apiRequests = [], checks = [];
const getObservations = createPowerClient({ fetchImpl: async (url, init) => {
  upstreamRequests.push({ url: String(url), intentionallyFailed: rejectNasa });
  if (rejectNasa) throw new Error('TEST ONLY: intentional upstream failure');
  return fetch(url, init);
} });
const app = createApp({ getObservations });
app.on('request', request => { if (request.url.startsWith('/api/')) apiRequests.push(request.url); });
app.listen(0, '127.0.0.1'); await once(app, 'listening');
const base = `http://127.0.0.1:${app.address().port}`;
const check = text => { checks.push(text); console.log(`PASS: ${text}`); };
try {
  browser = await openChrome();
  const { call, evaluate, waitFor } = browser;
  const fill = (selector, value) => evaluate(`(() => { if(["#latitude","#longitude"].includes(${JSON.stringify(selector)})){const mode=document.querySelector("#location-method");mode.value="coordinates";mode.dispatchEvent(new Event("change",{bubbles:true}));} const node=document.querySelector(${JSON.stringify(selector)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  // The Node variant must work without a browser data worker or direct browser NASA access.
  await call('Network.setBlockedURLs', { urls: ['*power.larc.nasa.gov*', '*core-worker.bundle.js*'] });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base });
  await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  assert.equal(await evaluate('document.querySelector("meta[name=fieldshift-transport]").content'), 'http');
  assert.match(await evaluate('document.querySelector("#runtime-status").textContent'), /Node.js testing/);
  assert.equal((await fetch(base + '/api/health')).status, 200);
  check('Node entry explicitly selects HTTP transport and displays its testing mode');

  await evaluate('document.querySelector("#pest-country").value="GB";document.querySelector("#pest-country").dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('[...document.querySelector("#place-town").options].some(o=>o.textContent.startsWith("Cambridge ·"))');
  const allTownCount = await evaluate('document.querySelector("#place-town").options.length');
  assert.ok(await evaluate('(() => { const options=[...document.querySelector("#place-region").options];return new Set(options.map(o=>o.value)).size===options.length; })()'));
  await evaluate('document.querySelector("#place-region").value="";document.querySelector("#place-region").dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('!document.querySelector("#place-town").disabled');
  assert.ok(await evaluate('document.querySelector("#place-town").options.length') < allTownCount);
  await evaluate('document.querySelector("#place-region").value="__all__";document.querySelector("#place-region").dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('[...document.querySelector("#place-town").options].some(o=>o.textContent.startsWith("Cambridge ·"))');
  await evaluate('const t=document.querySelector("#place-town");t.value=[...t.options].find(o=>o.textContent.startsWith("Cambridge ·")).value;t.dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('document.querySelectorAll("[name=allowedCrops]").length===5');
  assert.ok(apiRequests.includes('/api/locations?country=GB'));
  assert.notEqual(await evaluate('document.querySelector("#latitude").value'), '');
  check('Node serves the sourced country town dropdown and choosing Cambridge sets the location');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const pickerShot = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile('artifacts/node-mobile-location-picker.png', Buffer.from(pickerShot.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.querySelector("#flow-next").click()');
  await waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")');
  assert.equal(await evaluate('document.querySelectorAll("#evidence-output svg").length'), 3);
  assert.ok(upstreamRequests.some(request => !request.intentionallyFailed));
  check('Node fetches real NASA observations while browser NASA access and the data worker are blocked');

  await evaluate('document.querySelector("#flow-next").click()');
  await fill('#baseline-1', 'bush-bean'); await fill('#baseline-2', 'pea'); await fill('#baseline-3', 'bush-bean');
  await evaluate('document.querySelector("#flow-next").click()');
  await waitFor('document.querySelectorAll(".scenario").length===3');
  assert.equal(await evaluate('document.querySelectorAll(".timeline > li").length'), 9);
  assert.ok(apiRequests.includes('/api/compare'));
  check('Node comparison returns the baseline and two alternatives through the shared engine');

  await evaluate('document.querySelector("#chat-toggle").click()');
  await evaluate('document.querySelector("#unload-model").click()');
  assert.match(await evaluate('document.querySelector("#model-status").textContent'), /No model loaded/);
  await fill('#question', 'What do peas need?'); await evaluate('document.querySelector("#ask").click()');
  await waitFor('document.querySelector("#chat-history").textContent.includes("Fabaceae")');
  assert.ok(apiRequests.includes('/api/ask'));
  assert.ok(await evaluate('document.querySelectorAll("#chat-history a").length>0'));
  check('sourced assistant answers arrive from Node with the optional browser model unloaded');
  await validateConversation({ evaluate, waitFor, fill, check });

  await fill('#question', 'How long does grain maize take?'); await evaluate('document.querySelector("#ask").click()');
  await waitFor('document.querySelector("#chat-history").textContent.includes("Other or unspecified corn/maize types remain unassessed")');
  await evaluate('document.querySelector("#chat-close").click()');
  check('unsupported grain maize questions do not inherit sweet-corn maturity facts');

  await fill('#soil', 'clay');
  assert.equal(await evaluate('document.querySelectorAll(".scenario").length'), 0);
  await fill('#baseline-1', 'unassessed:fao-15');
  await evaluate('document.querySelector("#compare").click()');
  await waitFor('document.querySelectorAll(".scenario").length===3');
  assert.match(await evaluate('document.querySelector(".scenario").textContent'), /Wheat.*unknown/s);
  check('constraint edits invalidate Node results and unsupported baseline crops remain unassessed');

  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile('artifacts/node-mobile-comparison.png', Buffer.from(shot.data, 'base64'));
  check('Node runtime label and comparison fit a 390px viewport');

  rejectNasa = true;
  await fill('#reference-year', 2024);
  await evaluate('document.querySelector("#tab-location").click();document.querySelector("#flow-next").click()');
  await waitFor('document.querySelector("#evidence-status").classList.contains("error")');
  assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
  assert.ok(upstreamRequests.some(request => request.intentionallyFailed));
  check('Node upstream failure reaches the UI as an error and prevents stale-evidence comparison');
  rejectNasa = false;
  await evaluate('document.querySelector("#retry-evidence").click()');
  await waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")');
  check('retrying after the Node upstream failure retrieves real evidence successfully');
  await validateGuidedWorkflow({ evaluate, waitFor, fill, check });

  const requestedUrls = browser.events.filter(event => event.method === 'Network.requestWillBeSent').map(event => event.params.request.url);
  assert.ok(requestedUrls.some(url => url.startsWith(base + '/api/observations')));
  assert.ok(!requestedUrls.some(url => url.includes('power.larc.nasa.gov') || url.includes('core-worker.bundle.js')));
  const errors = browser.events.filter(event => event.method === 'Runtime.exceptionThrown');
  assert.deepEqual(errors, []);
  check('all data calls use the Node API with no browser NASA request, data-worker load or uncaught exception');
  await writeFile('artifacts/node-browser-validation.json', JSON.stringify({ checkedAt: new Date().toISOString(), browser: await call('Browser.getVersion'),
    checks, errors, apiRequests, upstreamRequests,
    limitations: ['Desktop Chrome and narrow viewport emulation, not real mobile hardware.', 'The intentional provider failure was injected in the test harness; successful observations came from the real NASA service.'] }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => app.close(resolve)); }
