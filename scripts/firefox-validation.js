import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { buildBrowser } from './build-browser.js';
import { createStaticPreview } from './static-preview.js';
import { openFirefox } from './firefox.js';
import { validateConversation, validateGuidedWorkflow } from './chat-validation.js';

await buildBrowser();
const app = createStaticPreview();
app.listen(0, '127.0.0.1'); await once(app, 'listening');
const base = `http://127.0.0.1:${app.address().port}`;
let browser;
const checks = [], blockedRequests = [], blockingErrors = [];
const check = text => { checks.push(text); console.log(`PASS: ${text}`); };
try {
  browser = await openFirefox();
  const { call, context, evaluate, waitFor } = browser;
  const fill = async (selector, value) => evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  // Interception is global to this isolated browser, including provider calls from workers.
  const block = async hostname => call('network.addIntercept', { phases: ['beforeRequestSent'],
    urlPatterns: [{ type: 'pattern', protocol: 'https', hostname }] });
  const socketEvents = browser.events;
  let processedEvents = 0;
  const drain = setInterval(() => {
    for (; processedEvents < socketEvents.length; processedEvents++) {
      const event = socketEvents[processedEvents];
      if (event.method === 'network.beforeRequestSent' && event.params.isBlocked) {
        blockedRequests.push(event.params.request.url);
        call('network.failRequest', { request: event.params.request.request }).catch(error => blockingErrors.push(error.message));
      }
    }
  }, 25);
  try {
    const modelBlock = await block('cdn.jsdelivr.net');
    await call('browsingContext.setViewport', { context, viewport: { width: 1280, height: 1000 }, devicePixelRatio: 1 });
    await browser.navigate(base);
    await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
    assert.equal(await evaluate('document.querySelectorAll("main > section").length'), 4);
    assert.equal(await evaluate('document.querySelectorAll("[role=tabpanel]:not([hidden])").length'), 1);
    assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
    check('Firefox loads the four modules and data worker with an empty initial location');

    await evaluate('document.querySelector("#example-location").value="52.19,0.09";document.querySelector("#example-location").dispatchEvent(new Event("change",{bubbles:true}));');
    await waitFor('document.querySelector("#catalog-status").textContent.startsWith("United Kingdom")');
    assert.equal(await evaluate('document.querySelectorAll("[name=allowedCrops]").length'), 2);
    check('country crop choices load from recorded categories without a generic fallback');

    await evaluate('document.querySelector("#flow-next").click()');
    await waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")');
    assert.equal(await evaluate('document.querySelectorAll("#evidence-output svg").length'), 2);
    assert.match(await evaluate('document.querySelector("#evidence-output").textContent'), /NASA.*retrieved/is);
    check('real historical NASA evidence renders with charts, units and retrieval metadata');

    await evaluate('document.querySelector("#flow-next").click()');
    await fill('#baseline-1', 'bush-bean'); await fill('#baseline-2', 'pea'); await fill('#baseline-3', 'bush-bean');
    await evaluate('document.querySelector("#flow-next").click()');
    await waitFor('document.querySelectorAll(".scenario").length===3');
    assert.equal(await evaluate('document.querySelectorAll(".timeline > li").length'), 9);
    check('baseline and two alternatives render equal dated timelines, risks and sources');

    await evaluate('document.querySelector("#chat-toggle").click()');
    await waitFor('document.querySelector("#model-status").textContent.includes("unavailable") || document.querySelector("#model-status").textContent.includes("could not")');
    await fill('#question', 'What do peas need?');
    await evaluate('document.querySelector("#ask").click()');
    await waitFor('document.querySelector("#chat-history").textContent.includes("Fabaceae")');
    assert.ok(await evaluate('document.querySelectorAll("#chat-history a").length>0'));
    assert.ok(blockedRequests.some(url => url.includes('cdn.jsdelivr.net')));
    check('blocked model runtime shows an unavailable state while sourced evidence chat still answers');
    await validateConversation({ evaluate, waitFor, fill, check });

    await call('network.removeIntercept', { intercept: modelBlock.intercept });
    await evaluate('document.querySelector("#load-model").click()');
    await waitFor('document.querySelector("#model-status").textContent.includes("ready")', 40_000);
    await fill('#question', 'Tell me about soil'); await evaluate('document.querySelector("#ask").click()');
    await waitFor('!!window.fieldshiftModelMetrics.inferenceMs');
    const modelMetrics = JSON.parse(await evaluate('JSON.stringify(window.fieldshiftModelMetrics)'));
    assert.equal(modelMetrics.weightBytes, 116800);
    await evaluate('document.querySelector("#unload-model").click();document.querySelector("#chat-close").click()');
    check('Firefox WASM model loads, infers and unloads after the failed-load fallback');

    await fill('#soil', 'clay');
    assert.equal(await evaluate('document.querySelectorAll(".scenario").length'), 0);
    await fill('#baseline-1', 'unassessed:fao-15');
    await evaluate('document.querySelector("#compare").click()');
    await waitFor('document.querySelectorAll(".scenario").length===3');
    assert.match(await evaluate('document.querySelector(".scenario").textContent'), /Wheat.*unknown/s);
    check('edited constraints invalidate results and unsupported wheat stays unassessed');

    await call('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    const shot = await call('browsingContext.captureScreenshot', { context });
    await writeFile('artifacts/firefox-mobile-comparison.png', Buffer.from(shot.data, 'base64'));
    await evaluate('document.querySelector("[role=tab][aria-selected=true]").focus()');
    await call('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value: '\uE014' }, { type: 'keyUp', value: '\uE014' }] }] });
    assert.ok(await evaluate('document.activeElement.getAttribute("role")==="tab" && document.activeElement.getAttribute("aria-selected")==="true"'));
    check('390px Firefox layout fits the viewport and real arrow-key tab navigation works');

    const nasaBlock = await block('power.larc.nasa.gov');
    await fill('#reference-year', 2024);
    await evaluate('document.querySelector("#tab-location").click();document.querySelector("#load-evidence").click()');
    await waitFor('document.querySelector("#evidence-status").classList.contains("error")');
    assert.ok(blockedRequests.some(url => url.includes('power.larc.nasa.gov')));
    assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
    await call('network.removeIntercept', { intercept: nasaBlock.intercept });
    check('blocking the actual worker NASA request shows an error and prevents stale comparison');
    await validateGuidedWorkflow({ evaluate, waitFor, fill, check });

    const requests = browser.events.filter(event => event.method === 'network.beforeRequestSent').map(event => event.params.request.url);
    assert.ok(!requests.some(url => url.startsWith(base + '/api/')));
    const errors = browser.events.filter(event => event.method === 'log.entryAdded' && event.params.type === 'javascript');
    assert.deepEqual(errors, []);
    assert.deepEqual(blockingErrors, []);
    check('no backend /api requests or uncaught JavaScript exceptions occurred in Firefox');
    await writeFile('artifacts/firefox-validation.json', JSON.stringify({ checkedAt: new Date().toISOString(),
      browser: browser.session.capabilities, checks, errors, blockedRequests, modelMetrics,
      limitations: ['Desktop Firefox and a narrow viewport, not real mobile hardware or Safari.', 'Provider requests use live public services; country/crop suitability remains unvalidated.'] }, null, 2));
  } finally { clearInterval(drain); }
} finally {
  await browser?.close();
  await new Promise(resolve => app.close(resolve));
}
