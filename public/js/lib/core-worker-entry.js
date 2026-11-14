// Browser-only application core. Providers are called from this worker, never a server function.
import { createApiHandler } from '../../../server/api.js';
const handle = createApiHandler();
self.onmessage = async event => {
  const { id, path, method, body } = event.data;
  try {
    const data = await handle({ method, url: new URL(path, 'https://fieldshift.local'), readJson: async () => body });
    self.postMessage({ id, data });
  } catch (error) { self.postMessage({ id, error: error.message, code: error.code ?? 'CLIENT_ERROR' }); }
};
