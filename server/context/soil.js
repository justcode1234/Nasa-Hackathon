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

export function createSoilClient({ fetchImpl = fetch, ...options } = {}) {
  let lastStartedAt = 0;
  const request = createCachedJson({ ...options, fetchImpl: async (url, init) => {
    // SoilGrids' documented public fair-use limit is five requests per minute.
    if (Date.now() - lastStartedAt < 12_100) throw new Error('Soil service rate limit: retry after 13 seconds');
    lastStartedAt = Date.now();
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
