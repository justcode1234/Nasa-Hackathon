import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { AppError } from './errors.js';
import { createApiHandler, SECURITY_HEADERS } from './api.js';
import { createLocationClient } from './context/locations.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const previewId = createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.bin': 'application/octet-stream', '.pdf': 'application/pdf', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8' };

async function readJson(request,limit=16_384) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AppError('Send application/json.', 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new AppError('Request body is too large.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError('Request must contain valid JSON.'); }
}

export function createApp(dependencies = {}) {
  const handleApi = createApiHandler({ getLocations: createLocationClient({ readJson: async name =>
    JSON.parse(await readFile(path.join(root, 'public/data/locations', name), 'utf8')) }), ...dependencies });
  return http.createServer(async (request, response) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(key, value);
    const json = (body, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/.well-known/fieldshift-preview' && ['GET', 'HEAD'].includes(request.method)) {
        return json({ app: 'fieldshift-node-preview', previewId });
      }
      if (url.pathname.startsWith('/api/')) {
        return json(await handleApi({ method: request.method, url, readJson: () => readJson(request,url.pathname==='/api/terrain-context'?65_536:16_384) }));
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw new AppError('Method not allowed.', 405);
      let base = path.join(root, 'public');
      let relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
      const leafletLicense = ['vendor/leaflet/LICENSE.txt','vendor/maplibre/LICENSE.txt'].includes(relative);
      if (leafletLicense) {
        base = path.join(root, relative.includes('/maplibre/')?'node_modules/maplibre-gl':'node_modules/leaflet');
        relative = relative.includes('/maplibre/')?'LICENSE.txt':'LICENSE';
      } else if(relative.startsWith('vendor/maplibre/')) {
        base=path.join(root,'node_modules/maplibre-gl/dist');relative=relative.slice('vendor/maplibre/'.length);
      } else if (relative.startsWith('vendor/leaflet/')) {
        base = path.join(root, 'node_modules/leaflet/dist');
        relative = relative.slice('vendor/leaflet/'.length);
      }
      const filename = path.resolve(base, relative);
      const contentType = leafletLicense ? 'text/plain; charset=utf-8' : types[path.extname(filename)];
      if (!filename.startsWith(`${base}${path.sep}`) || !contentType) throw new AppError('Not found.', 404);
      let data = await readFile(filename);
      if (filename === path.join(root, 'public', 'index.html')) {
        const marker = '<meta name="fieldshift-transport" content="worker">';
        if (!data.toString('utf8').includes(marker)) throw new Error('The app entry is missing its explicit transport marker.');
        data = Buffer.from(data.toString('utf8').replace(marker, '<meta name="fieldshift-transport" content="http">'));
      }
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500);
      if (status === 500) console.error(error);
      json({ error: { code: error instanceof AppError ? error.code : 'SERVER_ERROR', message: status === 500 ? 'The server could not complete this request.' : error.message } }, status);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`FieldShift: http://localhost:${port}`));
}
