import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowser } from '../scripts/build-browser.js';
import { readFile, access } from 'node:fs/promises';

test('Vercel build is static and includes browser workers, crop data and local map assets', async () => {
  await buildBrowser();
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.outputDirectory, 'dist/client');
  assert.equal(config.functions, undefined);
  assert.equal(config.rewrites, undefined);
  for (const file of ['index.html', 'css/app.css', 'js/app.js', 'js/lib/core-worker.bundle.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/images/marker-icon.png']) await access(`dist/client/${file}`);
  const browserCore = await readFile('dist/client/js/lib/core-worker.bundle.js', 'utf8');
  assert.match(browserCore, /power\.larc\.nasa\.gov/);
  assert.match(browserCore, /rest\.isric\.org/);
  assert.doesNotMatch(browserCore, /node:fs|node:http|readFileSync/);
  assert.match(await readFile('public/js/lib/api.js', 'utf8'), /new Worker/);
});
