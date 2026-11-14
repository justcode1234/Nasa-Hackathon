import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.js';
import { createApiHandler, SECURITY_HEADERS } from './api.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.bin': 'application/octet-stream', '.pdf': 'application/pdf', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8' };

async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AppError('Send application/json.', 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new AppError('Request body is too large.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError('Request must contain valid JSON.'); }
}

export function createApp(dependencies = {}) {
  const handleApi = createApiHandler(dependencies);
  return http.createServer(async (request, response) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(key, value);
    const json = (body, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        return json(await handleApi({ method: request.method, url, readJson: () => readJson(request) }));
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw new AppError('Method not allowed.', 405);
      let base = path.join(root, 'public');
      let relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
      if (relative.startsWith('vendor/leaflet/')) {
        base = path.join(root, 'node_modules/leaflet/dist');
        relative = relative.slice('vendor/leaflet/'.length);
      }
      const filename = path.resolve(base, relative);
      if (!filename.startsWith(`${base}${path.sep}`) || !types[path.extname(filename)]) throw new AppError('Not found.', 404);
      const data = await readFile(filename);
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-cache' });
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
