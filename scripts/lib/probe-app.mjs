// Browser probes need a served build. Reuse one that is already listening, otherwise serve dist/client in
// this process so `npm run test:chat-place` works without a second terminal. A probe that silently drives
// an old bundle reports the wrong app, so a build older than public/ or server/ is refused.
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticPreview } from '../static-preview.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientRoot = path.join(repo, 'dist', 'client');

async function newestMtime(directory) {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? await newestMtime(full) : (await stat(full)).mtimeMs);
  }
  return newest;
}

async function reachable(url) {
  try { const response = await fetch(url); await response.text(); return response.ok; } catch { return false; }
}

export async function startProbeApp(port = Number(process.env.PROBE_PORT ?? 4575)) {
  const origin = `http://127.0.0.1:${port}`;
  if (await reachable(`${origin}/`)) return { base: origin, close: async () => {}, reused: true };
  const built = await newestMtime(clientRoot).catch(() => 0);
  if (!built) throw new Error(`nothing serves ${origin} and no build exists at ${clientRoot}; run npm run build`);
  const sources = await Promise.all(['public', 'server'].map(dir => newestMtime(path.join(repo, dir)).catch(() => 0)));
  if (Math.max(...sources) > built + 1000 && !process.env.PROBE_ALLOW_STALE)
    throw new Error(`refusing to probe a stale bundle: dist/client is older than public/ or server/. Run npm run build, or set PROBE_ALLOW_STALE=1 to override.`);
  const server = createStaticPreview().listen(port);
  await new Promise(resolve => server.once('listening', resolve));
  return { base: origin, close: () => new Promise(resolve => server.close(resolve)), reused: false };
}
