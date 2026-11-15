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
  assert.equal(await readFile('dist/client/vendor/leaflet/LICENSE.txt','utf8'),await readFile('node_modules/leaflet/LICENSE','utf8'),'Ship the complete Leaflet licence, not only its script header');
  assert.equal(await readFile('dist/client/licenses/fieldshift-mit.txt','utf8'),await readFile('LICENSE','utf8'));
  // Speech runtime ships from this origin with its licences; no third-party script host is needed for it.
  for (const file of ['vendor/transformers/transformers.min.js', 'vendor/transformers/ort-wasm-simd-threaded.asyncify.mjs', 'vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm', 'vendor/transformers/LICENSE.txt', 'licenses/onnxruntime-mit.txt', 'js/modules/stt-worker.js', 'js/modules/speech.js']) await access(`dist/client/${file}`);
  assert.doesNotMatch(await readFile('dist/client/js/modules/stt-worker.js','utf8'),/https?:\/\/(?!huggingface)/,'The speech worker must not import code from another origin');
  assert.match(await readFile('dist/client/credits.html','utf8'),/Not affiliated with or endorsed by NASA/);
  const browserCore = await readFile('dist/client/js/lib/core-worker.bundle.js', 'utf8');
  assert.match(await readFile('dist/client/index.html', 'utf8'), /name="fieldshift-transport" content="worker"/);
  assert.match(browserCore, /power\.larc\.nasa\.gov/);
  assert.match(browserCore, /rest\.isric\.org/);
  assert.doesNotMatch(browserCore, /node:fs|node:http|readFileSync/);
  assert.match(await readFile('public/js/lib/api.js', 'utf8'), /new Worker/);
});
