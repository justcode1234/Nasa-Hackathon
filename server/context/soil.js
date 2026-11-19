import { AppError } from '../errors.js';
import { locationInput } from './farms.js';
import { createCachedJson } from './client.js';

export function normalizeSoil(raw, position, sourceUrl, retrievedAt) {
  if (!Array.isArray(raw?.properties?.layers)) throw new AppError('Unrecognised SoilGrids response.', 502, 'SOIL_SCHEMA');
  const properties = ['phh2o', 'sand', 'clay'].map(id => {
    const layer = raw.properties.layers.find(l => l.name === id);
    const values = layer?.depths?.find(d => d.range?.top_depth === 0 && d.range?.bottom_depth === 5)?.values;
    if (layer && layer.unit_measure?.d_factor !== 10) throw new AppError('SoilGrids unit conversion changed; values have not been interpreted.', 502, 'SOIL_UNITS');
    const value = key => typeof values?.[key] === 'number' && values[key] >= 0 ? values[key] / 10 : null;
    return { id, name: { phh2o: 'pH in water', sand: 'Sand', clay: 'Clay' }[id], units: id === 'phh2o' ? 'pH' : '%', mean: value('mean'),
      lower: value('Q0.05'), upper: value('Q0.95'), interval: '5th–95th model prediction quantiles', missing: value('mean') === null };
  });
  return { position, sourceUrl, retrievedAt, kind: 'regional modelled soil context — not a farm measurement', product: 'ISRIC SoilGrids', depth: '0–5 cm', nominalResolutionM: 250,
    observationDate: null, properties,
    source: { id: 'soilgrids', title: 'ISRIC SoilGrids · Poggio et al. (2021)', url: 'https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html', license: 'CC BY 4.0' },
    notices: ['ISRIC advises against using SoilGrids for local/farm-level decisions. These values supply regional background and do not replace a soil test.',
      'SoilGrids has no single observation year. Retrieval time is not a soil sampling date. The API does not identify a measurement date for this point.',
      'The 0–5 cm layer does not describe the whole root zone, drainage, salinity, nutrients, management or irrigation capacity.',
      'Prediction intervals are supplied by the soil model, not invented crop-confidence percentages. Regional estimates are never auto-filled as measured farm inputs.'] };
}

// ISRIC publishes five requests a minute for the public SoilGrids endpoint; 12.1 s between lookups stays under it.
const FAIR_USE_WINDOW_MS = 12_100;
function fairUseRefusal(remainingMs) {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return new AppError(`SoilGrids publishes five regional soil lookups a minute, and this app is holding to that limit, so nothing was sent to the service. Load regional soil estimates again in ${seconds} second${seconds === 1 ? '' : 's'}.`, 429, 'SOIL_FAIR_USE');
}

export function createSoilClient({ fetchImpl = fetch, now = () => new Date(), ...options } = {}) {
  // The moment the next lookup may go out. 0 means none has gone out yet, so the first request is always allowed
  // whatever clock is in use; a refusal never moves it, so it cannot push the window further away.
  let nextAllowedAt = 0;
  const request = createCachedJson({ ...options, fetchImpl: async (url, init) => {
    // SoilGrids' documented public fair-use limit is five requests per minute, so this app spaces its own lookups.
    // A lookup refused inside that window has contacted no service (measured 19 Nov: 0 upstream requests), which is a
    // different fact from one that failed to answer, and the wait it quotes is the wait actually left.
    const startedAt = now().getTime();
    if (startedAt < nextAllowedAt) throw fairUseRefusal(nextAllowedAt - startedAt);
    nextAllowedAt = startedAt + FAIR_USE_WINDOW_MS;
    return fetchImpl(url, init);
  } });
  return async input => {
    const position = locationInput(input);
    const url = new URL('https://rest.isric.org/soilgrids/v2.0/properties/query');
    url.search = new URLSearchParams({ lon: position.longitude, lat: position.latitude });
    for (const property of ['phh2o', 'sand', 'clay']) url.searchParams.append('property', property);
    url.searchParams.append('depth', '0-5cm');
    for (const value of ['mean', 'Q0.05', 'Q0.95']) url.searchParams.append('value', value);
    const raw = await request(url, { timeoutMs: 20_000 });
    return normalizeSoil(raw, position, url.href, raw._fieldshiftRetrievedAt ?? new Date().toISOString());
  };
}
