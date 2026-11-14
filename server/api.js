import { AppError } from './errors.js';
import { createPowerClient } from './nasa/power.js';
import { catalog } from './agronomy/catalog.js';
import { createFarmClient, createPlaceClient } from './context/farms.js';
import { createPestClient } from './context/pests.js';
import { answerCatalogQuestion } from './agronomy/answers.js';
import { validateInputs, compareRotations, answerQuestion } from './agronomy/rotation.js';
import { createSoilClient } from './context/soil.js';
import { getWaterContext } from './context/water.js';
import { getCountryCrops } from './context/crops.js';
import { createLocationClient } from './context/locations.js';
import { answerConversation, questionTopic } from './agronomy/conversation.js';

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co https://power.larc.nasa.gov https://api.openstreetmap.org https://nominatim.openstreetmap.org https://api.gbif.org https://rest.isric.org; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};

export function createApiHandler({ getObservations = createPowerClient(), getFarms = createFarmClient(), getPlaces = createPlaceClient(), getPests = createPestClient(), getSoil = createSoilClient(), getLocations = createLocationClient() } = {}) {
  return async function handle({ method, url, readJson }) {
    const query = Object.fromEntries(url.searchParams);
    if (method === 'GET') {
      if (url.pathname === '/api/health') return { status: 'ok', schemaVersion: 1 };
      if (url.pathname === '/api/crops') return { schemaVersion: 1, ...catalog };
      if (url.pathname === '/api/country-crops') return getCountryCrops(query);
      if (url.pathname === '/api/locations') return getLocations(query);
      if (url.pathname === '/api/farms') return getFarms(query);
      if (url.pathname === '/api/places') return getPlaces(query);
      if (url.pathname === '/api/pests') return getPests(query);
      if (url.pathname === '/api/soil') return getSoil(query);
      if (url.pathname === '/api/water-context') return getWaterContext(query);
      if (url.pathname === '/api/observations') return getObservations(query);
    }
    if (method === 'POST' && ['/api/compare', '/api/ask'].includes(url.pathname)) {
      const body = await readJson();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Provide a planning or question object.');
      if (url.pathname === '/api/ask' && (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 500)) throw new AppError('Enter a question of 1–500 characters.');
      if (url.pathname === '/api/ask') {
        const conversation = answerConversation(body.question, { country: body.country ?? body.selectedCountry, context: body.chatContext });
        if (conversation) return conversation;
      }
      if (url.pathname === '/api/ask' && !body.baseline) return { ...answerCatalogQuestion(body.question), topic: questionTopic(body.question) };
      const inputs = validateInputs(body);
      const observations = await getObservations({ latitude: inputs.latitude, longitude: inputs.longitude, year: inputs.referenceYear });
      const result = compareRotations(inputs, observations);
      return url.pathname === '/api/ask' ? { ...answerQuestion(body.question, result, observations), topic: questionTopic(body.question) } : { ...result, observations };
    }
    throw new AppError('API route or method not found.', 404, 'NOT_FOUND');
  };
}
