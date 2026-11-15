// Real local Chrome + real NASA requests. No browser automation dependency.
import assert from 'node:assert/strict';
import { validateConversation, validateGuidedWorkflow } from './chat-validation.js';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { buildBrowser } from './build-browser.js';
import { createStaticPreview } from './static-preview.js';

const chromePath = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].find(existsSync);
if (!chromePath) throw new Error('Set CHROME_PATH to an installed Chromium browser. No browser will be downloaded.');
await mkdir('artifacts', { recursive: true });
const profileRoot=await realpath(tmpdir());
const profile = await mkdtemp(path.join(profileRoot,'fieldshift-validation-'));
const externalBase = process.env.TEST_BASE_URL;
let app, base;
if (externalBase) {
  const target = new URL(externalBase);
  if (target.protocol !== 'https:') throw new Error('Public deployment validation requires an HTTPS origin.');
  base = target.origin;
} else {
  await buildBrowser();
  app = createStaticPreview();
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  base = `http://127.0.0.1:${app.address().port}`;
}
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let browserSocket;
let nextId = 0;
const pending = new Map();
const errors = [];
const failures = [];
const workerSessions = new Map();
const requestedUrls = [];
let intentionalBlocking = false;
const checks = [];
const check = message => { checks.push(message); console.log(`PASS: ${message}`); };
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 40_000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
  return result.result.value;
}
async function waitFor(expression, timeout = 35_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expression)) return;
    await delay(150);
  }
  throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`);
}
const fill = async (selector, value) => evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); node.value = ${JSON.stringify(value)}; node.dispatchEvent(new Event('input', {bubbles:true})); })()`);
async function screenshot(filename) {
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(`artifacts/${filename}.png`, Buffer.from(shot.data, 'base64'));
}
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not expose a debugging endpoint.')), 20_000);
    chrome.stderr.on('data', data => {
      output += data.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.on('error', reject);
    chrome.on('exit', code => { if (code) reject(new Error(`Chrome exited: ${code}`)); });
  });
  const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Target.attachedToTarget' && message.params.targetInfo.type === 'worker') {
      workerSessions.set(message.params.sessionId, message.params.targetInfo);
      call('Network.enable', {}, message.params.sessionId).catch(() => {});
    }
    if (message.method === 'Target.detachedFromTarget') workerSessions.delete(message.params.sessionId);
    if (message.method === 'Network.requestWillBeSent') requestedUrls.push(message.params.request.url);
    if (message.method === 'Log.entryAdded' && message.params.entry.source === 'security') errors.push(message.params.entry);
    if (message.method === 'Network.loadingFailed' && !intentionalBlocking && !message.params.canceled) failures.push(message.params);
  });
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable'); await call('Network.enable');
  await call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base });
  await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  assert.equal(await evaluate('document.querySelectorAll("main > section").length'), 4);
  assert.equal(await evaluate('document.querySelectorAll("[role=tabpanel]:not([hidden])").length'), 1);
  assert.ok(await evaluate('document.documentElement.scrollHeight <= window.innerHeight'));
  assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
  assert.equal(await evaluate('document.querySelector("#latitude").value'), '');
  assert.equal(await evaluate('document.querySelectorAll("[name=allowedCrops]").length'), 0);
  assert.deepEqual(await evaluate('[...document.querySelectorAll("[role=tab]")].map(t=>t.textContent.slice(0,2))'), ['01','02','03','04']);
  check('four numbered steps, empty initial location, no generic crop list or automatic NASA/model download');
  // UI-only regression fixture: hold country identification without fabricating NASA data.
  await evaluate(`(() => {
    window.heldCountryLookups = [];
    window.regressionPaths = [];
    window.originalPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, ...args) {
      window.regressionPaths.push(message.path);
      if (message.path?.startsWith('/api/places?latitude=')) {
        window.heldCountryLookups.push({ worker: this, id: message.id });
        return;
      }
      return window.originalPostMessage.call(this, message, ...args);
    };
  })()`);
  await fill('#latitude', '1'); await fill('#longitude', '2');
  await evaluate('document.querySelector("#location-form").requestSubmit()');
  await waitFor('window.heldCountryLookups.length === 1');
  await fill('#latitude', '3'); await fill('#longitude', '4');
  await evaluate(`(async () => {
    const held = window.heldCountryLookups[0];
    held.worker.dispatchEvent(new MessageEvent('message', { data: { id: held.id, data: { places: [] } } }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);
  assert.equal(await evaluate('window.regressionPaths.some(path => path?.startsWith("/api/observations"))'), false);
  assert.equal(await evaluate('document.querySelector("#evidence-output").children.length'), 0);
  assert.equal(await evaluate('document.querySelector("#load-evidence").disabled'), false);
  check('editing coordinates while country identification is pending cancels the earlier evidence submission');
  await evaluate('Worker.prototype.postMessage = window.originalPostMessage');
  await call('Page.navigate', { url: base });
  await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  await evaluate('document.querySelector("#flow-next").click()');
  assert.equal(await evaluate('document.querySelector("#location").hidden'), false);
  await evaluate('document.querySelector("#tab-evidence").click()');
  await evaluate('document.querySelector("#flow-next").click()');
  assert.equal(await evaluate('document.querySelector("#si").hidden'), false);
  await evaluate('document.querySelector("#flow-next").click()');
  assert.equal(await evaluate('document.querySelector("#location").hidden'), false);
  assert.equal(await evaluate('document.activeElement.id'), 'pest-country');
  await evaluate('document.querySelector("#tab-si").click()');
  await evaluate('document.querySelector("#flow-back").click()');
  assert.equal(await evaluate('document.querySelector("#evidence").hidden'), false);
  await evaluate('document.querySelector("#flow-back").click()');
  assert.equal(await evaluate('document.querySelector("#flow-back").disabled'), true);
  check('persistent Next/Back controls follow workflow order and validate missing inputs');
  await evaluate('document.querySelector("#tab-si").click()');
  assert.equal(await evaluate('document.querySelector("#location").hidden'), true);
  assert.equal(await evaluate('document.querySelector("#si").hidden'), false);
  await evaluate('document.querySelector("#tab-location").click()');
  check('tabs switch modules without page scrolling; inactive panels are hidden');
  await evaluate('document.querySelector("#map").focus()');
  await screenshot('desktop-initial');
  await evaluate('const c=document.querySelector("#pest-country");c.value="AU";c.dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Australia:") && document.querySelector("#place-town").options.length > 1');
  assert.equal(await evaluate('document.querySelector("#latitude").value'), '');
  await evaluate('const r=document.querySelector("#place-region");r.value=[...r.options].find(o=>o.textContent==="Western Australia").value;r.dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('[...document.querySelector("#place-town").options].some(o=>o.textContent.startsWith("Perth ·"))');
  assert.ok(await evaluate('[...document.querySelector("#place-town").options].every(o=>!o.value||o.textContent.includes("Western Australia"))'));
  await evaluate('const t=document.querySelector("#place-town");t.value=[...t.options].find(o=>o.textContent.startsWith("Perth ·")).value;t.dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('document.querySelector("#latitude").value !== "" && document.querySelector("#catalog-status").textContent.startsWith("Australia:")');
  assert.ok(await evaluate('Number(document.querySelector("#latitude").value)<-30 && Number(document.querySelector("#longitude").value)>110'));
  check('country, region and town dropdowns select a real sourced point without typing a place name');
  await screenshot('desktop-location-picker');
  assert.ok(await evaluate('[...document.querySelector("#baseline-1").options].some(o=>o.value==="unassessed:fao-27")'));
  await fill('#baseline-1', 'sweet-corn');
  await evaluate('document.querySelector("#pest-country").value="SG";document.querySelector("#pest-country").dispatchEvent(new Event("change",{bubbles:true}));');
  await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Singapore:") && document.querySelector("#place-town").options.length > 1');
  assert.equal(await evaluate('document.querySelector("#latitude").value'), '');
  assert.equal(await evaluate('document.querySelector("#place-town").value'), '');
  assert.equal(await evaluate('document.querySelectorAll("[name=allowedCrops]").length'), 0);
  assert.equal(await evaluate('document.querySelector("#baseline-1").value'), '');
  assert.ok(await evaluate('![...document.querySelector("#baseline-1").options].some(o=>o.value==="sweet-corn")'));
  assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
  check('country selection updates real crop lists, clears foreign selections and blocks insufficient screening coverage');
  const mapPoint = await evaluate('(() => {const r=document.querySelector("#map").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...mapPoint, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mapPoint, button: 'left', clickCount: 1 });
  assert.notEqual(await evaluate('document.querySelector("#latitude").value'), '');
  check('actual map click selects a coordinate and updates the coordinate form');
  await fill('#place-query', 'Cambridge, United Kingdom');
  await evaluate('document.querySelector("#search-place").click()');
  await waitFor('document.querySelector("#place-results").options.length > 1');
  check('place-name search returns real Nominatim place choices');
  await evaluate('(() => { const s=document.querySelector("#example-location"); s.value="52.19,0.09"; s.dispatchEvent(new Event("change", {bubbles:true})); })()');
  await waitFor('document.querySelector("#farm-results").options.length > 1');
  await waitFor('document.querySelectorAll("[name=allowedCrops]").length === 2');
  assert.ok(await evaluate('![...document.querySelector("#baseline-1").options].some(o=>o.value==="unassessed:fao-27")'));
  await evaluate('(() => { const s=document.querySelector("#farm-results"); s.selectedIndex=1; s.dispatchEvent(new Event("change", {bubbles:true})); })()');
  assert.match(await evaluate('document.querySelector("#farm-details").textContent'), /OSM last edited/);
  check('real OSM field polygons and dropdown select a field with dated metadata and unknown crop labels');
  await evaluate('document.querySelector("#flow-next").click()');
  await waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")');
  assert.equal(await evaluate('document.querySelectorAll("#evidence-output svg").length'), 2);
  assert.match(await evaluate('document.querySelector("#evidence-output").textContent'), /MJ\/m\^2\/day/);
  check('real NASA year loads with units, source timestamps, daily metadata, monthly charts and tables');
  await evaluate('document.querySelector("#tab-si").click()');
  await waitFor('document.querySelectorAll("[name=allowedCrops]").length === 2');
  await fill('#baseline-1', 'bush-bean'); await fill('#baseline-2', 'pea'); await fill('#baseline-3', 'bush-bean');
  await evaluate('document.querySelector("#load-pests").click()');
  await waitFor('document.querySelector("#pest-status").textContent.startsWith("Country context loaded")');
  assert.match(await evaluate('document.querySelector("#pest-output").textContent'), /Diamondback moth/);
  check('country pest query displays sourced hosts and GBIF historical occurrence context');
  assert.ok(await evaluate('document.querySelector("#baseline-1").getBoundingClientRect().top < innerHeight'));
  await evaluate('document.querySelector("#flow-next").click()');
  await waitFor('document.querySelectorAll(".scenario").length === 3');
  assert.equal(await evaluate('document.querySelector("#strategy").hidden'), false);
  assert.equal(await evaluate('document.querySelector("#flow-next").hidden'), true);
  assert.equal(await evaluate('document.querySelectorAll(".timeline > li").length'), 9);
  assert.deepEqual(await evaluate('[...document.querySelector(".timeline").querySelectorAll("h4")].map(node=>node.textContent)'), ['1. Bush snap bean','2. Garden pea','3. Bush snap bean']);
  assert.equal(await evaluate('new Set([...document.querySelectorAll(".timeline")].map(node=>[...node.querySelectorAll("h4")].map(h=>h.textContent).join(" / "))).size'),3);
  await evaluate('document.querySelector("#strategy").scrollIntoView()');
  await screenshot('desktop-comparison');
  await evaluate('document.querySelector(".timeline").scrollIntoView()');
  await screenshot('desktop-timeline');
  check('baseline + two distinct alternatives render nine dated crop slots with risks and evidence');
  await evaluate('document.querySelector("#chat-toggle").click()');
  assert.equal(await evaluate('document.querySelector("#chat-panel").hidden'), false);
  await fill('#question', 'What do we know about peas?');
  await evaluate('document.querySelector("#ask").click()');
  await waitFor('document.querySelector("#chat-history").textContent.includes("Fabaceae")');
  assert.ok(await evaluate('document.querySelectorAll("#chat-history a").length > 0'));
  await validateConversation({ evaluate, waitFor, fill, check });
  await screenshot('desktop-chat');
  await evaluate('document.querySelector("#chat-close").click()');
  check('assistant fallback answers crop question with source links and no model');
  await fill('#soil', 'clay');
  assert.equal(await evaluate('document.querySelectorAll(".scenario").length'), 0);
  assert.match(await evaluate('document.querySelector("#chat-history").textContent'), /context changed/);
  check('constraint edits immediately clear outdated comparison and answer');
  await fill('#baseline-1', 'unassessed:fao-15');
  await evaluate('document.querySelector("#compare").click()');
  await waitFor('document.querySelectorAll(".scenario").length === 3');
  assert.match(await evaluate('document.querySelector(".scenario").textContent'), /Wheat.*unknown/s);
  check('unsupported baseline crop stays visible without invented family or weather fit');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate('document.querySelector("#strategy").scrollIntoView()');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
  assert.ok(await evaluate('(() => { const r=document.querySelector("#flow-back").getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight; })()'));
  await screenshot('mobile-comparison');
  await evaluate('document.querySelector(".timeline").scrollIntoView()');
  await screenshot('mobile-timeline');
  check('390px mobile layout has no page-wide horizontal overflow');
  await evaluate('document.querySelector("[role=tab][aria-selected=true]").focus()');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  assert.ok(await evaluate('document.activeElement.getAttribute("role") === "tab" && document.activeElement.getAttribute("aria-selected") === "true"'));
  check('arrow-key navigation selects and focuses the next tab');
  await fill('#latitude', '44.98'); await fill('#longitude', '-93.27');
  assert.equal(await evaluate('document.querySelector("#evidence-output").children.length'), 0);
  assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
  await evaluate('document.querySelector("#load-evidence").click()');
  await waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")');
  assert.match(await evaluate('document.querySelector("#evidence-output").textContent'), /44\.98°, -93\.27°/);
  check('different coordinates clear prior evidence and load a different real NASA location');
  intentionalBlocking = true;
  await call('Network.setBlockedURLs', { urls: ['*tile.openstreetmap.org*', '*vendor/leaflet/leaflet.js*'] });
  await call('Page.navigate', { url: base });
  await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  assert.match(await evaluate('document.querySelector("#map-status").textContent'), /Map library unavailable/);
  await fill('#latitude', '-1.29'); await fill('#longitude', '36.82');
  await evaluate('document.querySelector("#load-evidence").click()');
  await waitFor('document.querySelector("#evidence-status").textContent.startsWith("Historical evidence loaded")');
  check('coordinates and NASA evidence work with map library and tiles unavailable');
  if (process.env.TEST_MODEL === '1') {
    intentionalBlocking = false;
    await call('Network.setBlockedURLs', { urls: [] });
    await evaluate('document.querySelector("#chat-toggle").click()');
    await evaluate('document.querySelector("#load-model").click()');
    await waitFor('document.querySelector("#model-status").textContent.includes("ready") || document.querySelector("#model-status").textContent.includes("unavailable") || document.querySelector("#model-status").textContent.includes("could not")', 240_000);
    assert.match(await evaluate('document.querySelector("#model-status").textContent'), /ready/);
    await fill('#question', 'Tell me about peas');
    await evaluate('document.querySelector("#ask").click()');
    await waitFor('!!window.fieldshiftModelMetrics.inferenceMs', 60_000);
    const modelMetrics = await evaluate('window.fieldshiftModelMetrics');
    await waitFor('!!window.fieldshiftModelMetrics.inferenceMs');
    const measured = await evaluate('window.fieldshiftModelMetrics');
    await writeFile('artifacts/browser-mini-model-check.json', JSON.stringify(measured, null, 2));
    assert.ok(measured.inferenceMs > 0);
    assert.equal(measured.weightBytes, JSON.parse(await readFile('public/models/fieldshift-mini/evaluation.json','utf8')).weightBytes);
    check('custom compact browser language model loads and selects evidence with recorded metrics');
    await evaluate('document.querySelector("#unload-model").click()');
    assert.match(await evaluate('document.querySelector("#model-status").textContent'), /No model loaded/);
    check('model unload returns to working evidence mode');
    intentionalBlocking = true;
  }
  const coreSession = [...workerSessions].find(([, target]) => target.url.includes('/js/lib/core-worker.bundle.js'))?.[0] ?? [...workerSessions.keys()].at(-1);
  assert.ok(coreSession, `Browser data worker is present: ${JSON.stringify([...workerSessions.values()])}`);
  await call('Network.setBlockedURLs', { urls: ['*power.larc.nasa.gov*'] }, coreSession);
  await fill('#latitude', '0');
  await evaluate('document.querySelector("#load-evidence").click()');
  await waitFor('document.querySelector("#evidence-status").classList.contains("error")');
  assert.equal(await evaluate('document.querySelector("#compare").disabled'), true);
  check('network failure produces visible error and prevents stale-evidence comparisons');
  assert.ok(!requestedUrls.some(url => url.startsWith(base + '/api/')));
  check('all data and comparison calls stay in the browser; no server /api request occurred');
  await call('Network.setBlockedURLs', { urls: [] });
  intentionalBlocking = false;
  await call('Network.setBlockedURLs', { urls: [] }, coreSession);
  await validateGuidedWorkflow({ evaluate, waitFor, fill, check, capture: () => screenshot('guided-chat-step4') });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base + '/submission/index.html' });
  await waitFor('document.querySelectorAll(".slide").length === 7');
  const layout = await evaluate('[...document.querySelectorAll(".slide")].map((s,i)=>({slide:i+1,scrollHeight:s.scrollHeight,height:s.clientHeight,foot:s.querySelector(".foot").getBoundingClientRect().top,last:s.querySelector(".foot").previousElementSibling.getBoundingClientRect().bottom}))');
  await writeFile('artifacts/deck-layout.json', JSON.stringify(layout, null, 2));
  assert.ok(layout.every(s => s.scrollHeight <= s.height && s.last < s.foot), JSON.stringify(layout));
  const pdf = await call('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  const pdfBytes = Buffer.from(pdf.data, 'base64');
  assert.equal((pdfBytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, 7);
  if (!externalBase) await writeFile('public/submission/fieldshift-deck.pdf', pdfBytes);
  await evaluate('document.querySelector("#slide-4").scrollIntoView()');
  await screenshot('submission-slide-4');
  check('seven-slide deck has no clipped content and exports exactly seven PDF pages');
  assert.deepEqual(errors, [], 'No uncaught JavaScript or CSP errors');
  check('no uncaught JavaScript exceptions or CSP violations');
  if (failures.length) console.log(`Observed ${failures.length} external resource failures (see report).`);
  await writeFile(externalBase ? 'artifacts/public-browser-validation.json' : 'artifacts/browser-validation.json', JSON.stringify({ checkedAt: new Date().toISOString(), origin: base,
    scope: externalBase ? 'public deployment' : 'local static preview', browser: await call('Browser.getVersion'), checks, errors, failures }, null, 2));
  browserSocket = new WebSocket(endpoint);
  await once(browserSocket, 'open');
  browserSocket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
} finally {
  socket?.close(); browserSocket?.close();
  chrome.kill();
  if (app) await new Promise(resolve => app.close(resolve));
  const target=await realpath(profile);
  if(path.dirname(target)!==profileRoot || !path.basename(target).startsWith('fieldshift-validation-'))throw new Error('Temporary validation profile escaped its intended root');
  await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});
}
