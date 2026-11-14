import { AppError } from '../errors.js';

export function createLocationClient({ readJson = async name => {
  const response = await fetch(`/data/locations/${name}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
} } = {}) {
  let manifest;
  const cache = new Map();
  return async ({ country = '' } = {}) => {
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) throw new AppError('Choose a two-letter country code for the town list.');
    if (cache.has(country)) return cache.get(country);
    let index, raw;
    try {
      manifest ??= readJson('manifest.json');
      index = await manifest;
      raw = index.countries[country] ? await readJson(`${country}.json`) : { country, places: [], regions: [] };
    } catch {
      manifest = null;
      throw new AppError('The saved town list could not load. Retry the country selection, search a place or use the map.', 503, 'LOCATIONS_UNAVAILABLE');
    }
    if (raw.country !== country || !Array.isArray(raw.places) || !Array.isArray(raw.regions) || raw.places.some(place =>
      !Array.isArray(place) || !Number.isInteger(place[0]) || typeof place[1] !== 'string' || typeof place[2] !== 'string' ||
      !Number.isFinite(place[3]) || Math.abs(place[3]) > 90 || !Number.isFinite(place[4]) || Math.abs(place[4]) > 180)) {
      throw new AppError('The saved town list has an invalid source format. Use place search or coordinates.', 503, 'LOCATIONS_SCHEMA');
    }
    const result = { schemaVersion: 1, country, available: raw.places.length > 0, regions: raw.regions, source: index.source,
      places: raw.places.map(([id, name, regionCode, latitude, longitude, modifiedDate]) =>
        ({ id: String(id), name, country, regionCode, latitude, longitude, modifiedDate, sourceUrl: `https://www.geonames.org/${id}/` })),
      notices: ['A town point locates the map; it is not a field boundary, agricultural suitability assessment or current crop record.',
        'This dated place-name extract does not contain every rural settlement. Missing places can be found through search, the map or coordinates.',
        'Region labels follow the source administrative codes. A source edit date is not a farm or weather observation date.'] };
    cache.set(country, result);
    while (cache.size > 4) cache.delete(cache.keys().next().value);
    return result;
  };
}
