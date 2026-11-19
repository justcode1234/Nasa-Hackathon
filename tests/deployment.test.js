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
  // The two rejected Hugging Face workers are archived under notebooks/legacy-workers, whose loader
  // has not resolved since the move (ERR_MODULE_NOT_FOUND on ../server/index.js). The builder deletes
  // them from dist/client, so a dist-only check could never fail; this checks the source tree they
  // would have to be copied back into, and the shipped tree that must not carry a second model runtime.
  for (const name of ['llm-worker.js', 'candidate-worker.js']) {
    await assert.rejects(access(`public/js/modules/${name}`), `${name} is a rejected experiment and must not be restored into the shipped frontend`);
    await assert.rejects(access(`dist/client/js/modules/${name}`), `${name} must not reach the build output`);
  }
  assert.doesNotMatch(await readFile('dist/client/js/modules/stt-worker.js','utf8'),/https?:\/\/(?!huggingface)/,'The speech worker must not import code from another origin');
  assert.match(await readFile('dist/client/credits.html','utf8'),/Not affiliated with or endorsed by NASA/);
  const browserCore = await readFile('dist/client/js/lib/core-worker.bundle.js', 'utf8');
  assert.match(await readFile('dist/client/index.html', 'utf8'), /name="fieldshift-transport" content="worker"/);
  assert.match(browserCore, /power\.larc\.nasa\.gov/);
  assert.match(browserCore, /rest\.isric\.org/);
  assert.doesNotMatch(browserCore, /node:fs|node:http|readFileSync/);
  assert.match(await readFile('public/js/lib/api.js', 'utf8'), /new Worker/);
  assert.match(await readFile('scripts/build-browser.js', 'utf8'), /copyFile\('node_modules\/esbuild\/LICENSE\.md'/,
    'license writes must use copyFile - fs.cp overwrites briefly remove the destination, which the citation scanner observed as ENOENT while this build ran in a parallel test process (iteration 46)');
});
