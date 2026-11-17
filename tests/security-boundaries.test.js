import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SECURITY_HEADERS } from '../server/api.js';
import { createApp } from '../server/index.js';
import { createStaticPreview } from '../scripts/static-preview.js';
import { createFarmClient, createPlaceClient } from '../server/context/farms.js';
import { createLocationClient } from '../server/context/locations.js';

// Security boundaries for the release, checked against the code that actually ships.
// These are regression gates, not a claim that anything here was exploited.
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const read = async file => readFile(file, 'utf8');
const directive = (csp, name) => csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `)) ?? '';

test('the Node server, the static preview and vercel.json send the same security headers', async () => {
  const config = JSON.parse(await read('vercel.json'));
  assert.equal(config.headers.length, 1);
  assert.equal(config.headers[0].source, '/(.*)');
  const fromVercel = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  // A CSP that only exists in one runtime means one of the two deployments is unreviewed.
  assert.deepEqual(fromVercel, SECURITY_HEADERS, 'vercel.json headers must equal server/api.js SECURITY_HEADERS');

  const staticServer = createStaticPreview({ directory: 'public' }), nodeServer = createApp();
  const ports = [await listen(staticServer), await listen(nodeServer)];
  try {
    for (const port of ports) {
      const response = await fetch(`http://127.0.0.1:${port}/index.html`);
      assert.equal(response.status, 200);
      await response.text();
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        assert.equal(response.headers.get(key), value, `${key} is not the reviewed value on port ${port}`);
      }
    }
  } finally {
    staticServer.close(); nodeServer.close();
  }
});

test('the reviewed CSP keeps script, object, framing and base permissions closed', () => {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.ok(!csp.includes("'unsafe-eval'"), 'plain unsafe-eval would let a fetched string run as code');
  assert.ok(!directive(csp, 'script-src').includes("'unsafe-inline'"), 'inline scripts would bypass the script allow-list');
  assert.match(directive(csp, 'script-src'), /^script-src 'self' 'wasm-unsafe-eval' https:\/\/cdn\.jsdelivr\.net$/);
  assert.equal(directive(csp, 'object-src'), "object-src 'none'");
  assert.equal(directive(csp, 'frame-ancestors'), "frame-ancestors 'none'");
  assert.equal(directive(csp, 'base-uri'), "base-uri 'none'");
  // Every connect-src target is a named service; a wildcard would undo the allow-list.
  assert.ok(!csp.includes('*'), 'the policy contains no wildcard source');
  for (const host of ['cdn.jsdelivr.net', 'huggingface.co']) assert.ok(csp.includes(host), `${host} must stay listed for the optional runtimes`);
});

test('app-authored browser code has no HTML sink, dynamic code execution or unsafe source links', async () => {
  const files = ['js/lib/dom.js', 'js/lib/api.js', 'js/app.js', 'js/modules/chat.js', 'js/modules/workflow-assistant.js',
    'js/modules/location-picker.js', 'js/modules/mini-lm-worker.js', 'js/modules/speech.js'];
  for (const file of files) {
    const source = await read(`public/${file}`);
    assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|document\.write/, `${file} writes markup`);
    assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(\s*['"]/, `${file} compiles code at runtime`);
  }
  // Chat and assistant text reaches the page only through el(), which assigns textContent.
  const dom = await read('public/js/lib/dom.js');
  assert.match(dom, /node\.textContent = text/);
  // A source label becomes a link only for an absolute http(s) URL.
  assert.ok(dom.includes("^https?:\\/\\/\\S+$"), 'the http(s)-only link guard is missing from sourceLinks');
  assert.match(dom, /el\('span', source\.title\)/, 'a non-link source keeps its label visible instead of disappearing');
  // The local model may only reorder paragraphs, and only after an integer check.
  const chat = await read('public/js/modules/chat.js');
  assert.match(chat, /Number\.isInteger\(index\)/);
  assert.match(chat, /answer\.blocks\[index\]\?\.kind\s*===\s*'limitation'/);
});

test('untrusted coordinates and place text cannot reach the field or place services', async () => {
  const requested = [];
  const farms = createFarmClient({ fetchImpl: async url => { requested.push(String(url)); return { ok: true, json: async () => ({ elements: [] }) }; } });
  for (const input of [{ latitude: '52.19); out geom; //', longitude: 0.09 }, { latitude: 52.19, longitude: '999' },
    { latitude: NaN, longitude: 0.09 }, { latitude: undefined, longitude: 0.09 }, { latitude: 52.19, longitude: '1;2' }]) {
    await assert.rejects(farms(input), /Invalid (latitude|longitude)/, `accepted ${JSON.stringify(input)}`);
  }
  assert.deepEqual(requested, [], 'a rejected coordinate must not open a network request');
  await farms({ latitude: 52.1937, longitude: '0.1288' });
  const query = new URL(requested[0]).searchParams.get('data');
  // The only interpolated values are the quantised, fixed-precision bounds.
  assert.equal(query, '[out:json][timeout:25];way["landuse"~"^(farmland|orchard|vineyard|plant_nursery)$"](52.1700,0.1100,52.2100,0.1500);out meta geom;');

  const seen = [];
  const places = createPlaceClient({ fetchImpl: async url => { seen.push(new URL(url)); return { ok: true, json: async () => [] }; } });
  for (const input of [{ q: 'a' }, { q: '  ' }, { q: 'x'.repeat(121) }, { q: 42 }, { latitude: 52.19, longitude: 0.09, detail: 'full' },
    { latitude: '91', longitude: 0.09 }, { latitude: null, longitude: null, q: null }]) {
    await assert.rejects(places(input), /Invalid latitude|Invalid longitude|place name of 2–120|supported region detail/, `accepted ${JSON.stringify(input)}`);
  }
  await places({ q: 'Pune, India' });
  const last = seen.at(-1);
  assert.equal(last.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(last.searchParams.get('q'), 'Pune, India');
  assert.ok(seen.every(url => !url.search.includes('x'.repeat(50))), 'an oversized payload is never forwarded');

  let locationReads = 0;
  const locations = createLocationClient({ readJson: async () => { locationReads++; return {}; } });
  for (const country of ['../../server/index.js', 'sg', 'S', 'SGN', '1', null, 7, 'SG/../../package.json']) {
    await assert.rejects(locations({ country }), /two-letter country code/, `accepted ${String(country)}`);
  }
  assert.equal(locationReads, 0, 'a rejected country code must not read a file path');
});

test('the Node preview rejects traversal, oversized bodies and non-JSON posts', async () => {
  const server = createApp();
  const port = await listen(server);
  try {
    for (const attempt of ['/%2e%2e%2fpackage.json', '/../server/index.js', '/%2e%2e%2f%2e%2e%2fserver/api.js', '/data/locations/../../../package.json']) {
      const response = await fetch(`http://127.0.0.1:${port}${attempt}`);
      const body = await response.text();
      assert.equal(response.status, 404, `${attempt} returned ${response.status}: ${body.slice(0, 80)}`);
      assert.ok(!body.includes('"fieldshift"') && !body.includes('SECURITY_HEADERS'), `${attempt} leaked file contents`);
    }
    const notJson = await fetch(`http://127.0.0.1:${port}/api/ask`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'question=rice' });
    assert.equal(notJson.status, 415);
    assert.match((await notJson.json()).error.message, /application\/json/);
    const tooLarge = await fetch(`http://127.0.0.1:${port}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'x'.repeat(40_000) }) });
    assert.equal(tooLarge.status, 413);
    assert.match((await tooLarge.json()).error.message, /too large/);
    const badCountry = await fetch(`http://127.0.0.1:${port}/api/locations?country=${encodeURIComponent('../../package.json')}`);
    assert.equal(badCountry.status, 400);
    assert.match((await badCountry.json()).error.message, /two-letter country code/);
    const method = await fetch(`http://127.0.0.1:${port}/index.html`, { method: 'DELETE' });
    assert.equal(method.status, 405);
    await method.text();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) assert.equal(method.headers.get(key), value, 'errors keep the security headers');
  } finally {
    server.close();
  }
});

test('every dependency is pinned to an exact version', async () => {
  const pkg = JSON.parse(await read('package.json'));
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(pkg[section] ?? {})) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${section}.${name} must be an exact version, not ${version}`);
    }
  }
  // The vendored 3D runtime is the pinned package, not a floating CDN script tag.
  const html = await read('public/index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
});
