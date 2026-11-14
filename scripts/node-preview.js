import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/index.js';
import { startPreview } from './static-preview.js';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
export function startNodePreview({ dependencies, ...options } = {}) {
  return startPreview({ port: 3001, ...options, directory: root, appName: 'fieldshift-node-preview', createServer: () => createApp(dependencies) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await startNodePreview({ port: Number(process.env.PORT ?? 3001), open: process.env.NO_OPEN !== '1' && !process.argv.includes('--no-open') });
    console.log(`Opening FieldShift Node.js testing mode: ${result.url}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
