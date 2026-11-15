import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildBrowser() {
  await mkdir('public/vendor/leaflet', { recursive: true });
  for (const file of ['leaflet.js', 'leaflet.css', 'images']) await cp(`node_modules/leaflet/dist/${file}`, `public/vendor/leaflet/${file}`, { recursive: true });
  await cp('node_modules/leaflet/LICENSE','public/vendor/leaflet/LICENSE.txt');
  await mkdir('public/licenses',{recursive:true});
  await cp('LICENSE','public/licenses/fieldshift-mit.txt');
  await cp('node_modules/esbuild/LICENSE.md','public/licenses/esbuild-mit.txt');
  await cp('node_modules/playwright/LICENSE','public/licenses/playwright-apache-2.0.txt');
  await cp('node_modules/playwright/NOTICE','public/licenses/playwright-NOTICE.txt');
  await cp('node_modules/playwright/ThirdPartyNotices.txt','public/licenses/playwright-third-party-notices.txt');
  await build({ entryPoints: ['public/js/lib/core-worker-entry.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
    outfile: 'public/js/lib/core-worker.bundle.js', minify: true });
  await mkdir('dist/client', { recursive: true });
  await cp('public', 'dist/client', { recursive: true });
  console.log('Built static browser app in dist/client. No server functions or /api network calls.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildBrowser();
