import { build } from 'esbuild';
import { copyFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fs.cp overwriting an existing file briefly removes it: the offline citation scanner walks public/
// in a parallel test process while deployment.test.js runs this build, and that gap surfaced once
// as an ENOENT crash (iteration 46). copyFile replaces content with no missing-destination window
// (probe: cp 4 misses per 310,897 concurrent reads, copyFile 0; docs/validation.md subsection 45). The
// images directory stays on cp because the scanner never stats or reads its .png contents.
export async function buildBrowser() {
  await mkdir('public/vendor/leaflet', { recursive: true });
  for (const file of ['leaflet.js', 'leaflet.css']) await copyFile(`node_modules/leaflet/dist/${file}`, `public/vendor/leaflet/${file}`);
  await cp('node_modules/leaflet/dist/images', 'public/vendor/leaflet/images', { recursive: true });
  await copyFile('node_modules/leaflet/LICENSE','public/vendor/leaflet/LICENSE.txt');
  await mkdir('public/vendor/maplibre',{recursive:true});
  for(const file of ['maplibre-gl.mjs','maplibre-gl-shared.mjs','maplibre-gl-worker.mjs','maplibre-gl.css'])await copyFile(`node_modules/maplibre-gl/dist/${file}`,`public/vendor/maplibre/${file}`);
  await copyFile('node_modules/maplibre-gl/LICENSE.txt','public/vendor/maplibre/LICENSE.txt');
  // Speech-to-text runtime: served from this origin, fetched only after the mic is pressed.
  await mkdir('public/vendor/transformers',{recursive:true});
  await copyFile('node_modules/@huggingface/transformers/dist/transformers.min.js','public/vendor/transformers/transformers.min.js');
  await copyFile('node_modules/@huggingface/transformers/LICENSE','public/vendor/transformers/LICENSE.txt');
  for(const file of ['ort-wasm-simd-threaded.asyncify.mjs','ort-wasm-simd-threaded.asyncify.wasm'])await copyFile(`node_modules/onnxruntime-web/dist/${file}`,`public/vendor/transformers/${file}`);
  await mkdir('public/licenses',{recursive:true});
  await copyFile('LICENSE','public/licenses/fieldshift-mit.txt');
  await copyFile('node_modules/esbuild/LICENSE.md','public/licenses/esbuild-mit.txt');
  await copyFile('node_modules/playwright/LICENSE','public/licenses/playwright-apache-2.0.txt');
  await copyFile('node_modules/playwright/NOTICE','public/licenses/playwright-NOTICE.txt');
  await copyFile('node_modules/playwright/ThirdPartyNotices.txt','public/licenses/playwright-third-party-notices.txt');
  await copyFile('node_modules/axe-core/LICENSE','public/licenses/axe-mpl-2.0.txt');
  await build({ entryPoints: ['public/js/lib/core-worker-entry.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
    outfile: 'public/js/lib/core-worker.bundle.js', minify: true });
  await mkdir('dist/client', { recursive: true });
  await cp('public', 'dist/client', { recursive: true });
  // A previous build may still contain the archived, unused model experiments.
  for(const name of ['llm-worker.js','candidate-worker.js'])await rm(`dist/client/js/modules/${name}`,{force:true});
  console.log('Built static browser app in dist/client. No server functions or /api network calls.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildBrowser();
