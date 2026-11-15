import { build } from 'esbuild';
import { mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildBrowser() {
  await mkdir('public/vendor/leaflet', { recursive: true });
  for (const file of ['leaflet.js', 'leaflet.css', 'images']) await cp(`node_modules/leaflet/dist/${file}`, `public/vendor/leaflet/${file}`, { recursive: true });
  await cp('node_modules/leaflet/LICENSE','public/vendor/leaflet/LICENSE.txt');
  await mkdir('public/vendor/maplibre',{recursive:true});
  for(const file of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs','maplibre-gl.css'])await cp(`node_modules/maplibre-gl/dist/${file}`,`public/vendor/maplibre/${file}`);
  await cp('node_modules/maplibre-gl/LICENSE.txt','public/vendor/maplibre/LICENSE.txt');
  // Speech-to-text runtime: served from this origin, fetched only after the mic is pressed.
  await mkdir('public/vendor/transformers',{recursive:true});
  await cp('node_modules/@huggingface/transformers/dist/transformers.min.js','public/vendor/transformers/transformers.min.js');
  await cp('node_modules/@huggingface/transformers/LICENSE','public/vendor/transformers/LICENSE.txt');
  for(const file of ['ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm'])await cp(`node_modules/onnxruntime-web/dist/${file}`,`public/vendor/transformers/${file}`);
  await mkdir('public/licenses',{recursive:true});
  await cp('LICENSE','public/licenses/fieldshift-mit.txt');
  await cp('node_modules/esbuild/LICENSE.md','public/licenses/esbuild-mit.txt');
  await cp('node_modules/playwright/LICENSE','public/licenses/playwright-apache-2.0.txt');
  await cp('node_modules/playwright/NOTICE','public/licenses/playwright-NOTICE.txt');
  await cp('node_modules/playwright/ThirdPartyNotices.txt','public/licenses/playwright-third-party-notices.txt');
  await cp('node_modules/axe-core/LICENSE','public/licenses/axe-mpl-2.0.txt');
  await build({ entryPoints: ['public/js/lib/core-worker-entry.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
    outfile: 'public/js/lib/core-worker.bundle.js', minify: true });
  await mkdir('dist/client', { recursive: true });
  await cp('public', 'dist/client', { recursive: true });
  // A previous build may still contain the archived, unused model experiments.
  for(const name of ['llm-worker.js','candidate-worker.js'])await rm(`dist/client/js/modules/${name}`,{force:true});
  console.log('Built static browser app in dist/client. No server functions or /api network calls.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildBrowser();
