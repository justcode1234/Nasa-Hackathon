import { AppError, isPermanentRefusal } from '../errors.js';
import { createCachedJson } from './client.js';

export function locationInput(input) {
  const result = {};
  for (const [key, bound] of [['latitude', 90], ['longitude', 180]]) {
    if (!['string', 'number'].includes(typeof input[key]) || String(input[key]).trim() === '' || !Number.isFinite(Number(input[key])) || Math.abs(Number(input[key])) > bound) throw new AppError(`Invalid ${key}.`);
    result[key] = Number(input[key]);
  }
  return result;
}

export function normalizeFarms(raw, center, retrievedAt) {
  if (raw?.remark) throw new AppError('The field service returned an incomplete query. Retry the field search.', 502, 'CONTEXT_UNAVAILABLE');
  if (!Array.isArray(raw?.elements)) throw new AppError('Unrecognised OSM response.', 502, 'CONTEXT_SCHEMA');
  const nodes = new Map(raw.elements.filter(e => e.type === 'node').map(n => [n.id, [n.lon, n.lat]]));
  const farms = raw.elements.filter(e => e.type === 'way' && ['farmland', 'orchard', 'vineyard', 'plant_nursery'].includes(e.tags?.landuse)).flatMap(way => {
    const ring = way.geometry?.map(p => [p.lon, p.lat]) ?? way.nodes?.map(id => nodes.get(id));
    if (!ring || ring.length < 4 || ring.some(p => !p || !p.every(Number.isFinite)) || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return [];
    const lons = ring.map(p => p[0]), lats = ring.map(p => p[1]);
    const position = { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lons) + Math.max(...lons)) / 2 };
    return [{ id: `way/${way.id}`, name: way.tags.name || `Mapped ${way.tags.landuse.replaceAll('_', ' ')} · OSM ${way.id}`,
      kind: 'community-mapped land-use polygon', landuse: way.tags.landuse,
      crops: (way.tags.crop ?? way.tags.produce ?? '').split(';').map(c => c.trim()).filter(Boolean).slice(0, 12),
      cropEvidence: way.tags.crop ? 'OSM crop tag' : way.tags.produce ? 'OSM produce tag' : 'No crop tag recorded',
      updatedAt: way.timestamp ?? null, version: way.version ?? null, sourceUrl: `https://www.openstreetmap.org/way/${way.id}`,
      representativePoint: position, geometry: { type: 'Polygon', coordinates: [ring] } }];
  }).sort((a, b) => {
    const distance = farm => (farm.representativePoint.latitude - center.latitude) ** 2 + ((farm.representativePoint.longitude - center.longitude) * Math.cos(center.latitude * Math.PI / 180)) ** 2;
    return distance(a) - distance(b) || a.id.localeCompare(b.id);
  }).slice(0, 60);
  return { schemaVersion: 1, center, retrievedAt, source: { title: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    farms, notices: ['Mapped land-use polygons, not verified ownership parcels or land available to rent, enter or use.',
      'The search covers a small area around your selection. Missing mapped fields or crop tags do not mean agriculture is absent.',
      'Crop tags can be old; an edit timestamp is not a crop observation date. Untagged crop types and existing rotations are unknown.',
      'Only complete closed OSM ways are drawn; relation-only boundaries and incomplete ways are omitted. Representative points are bounding-box centers, not surveyed field centroids.'] };
}

// Public Overpass instances, in preference order. They are shared community services
// that are often at capacity, so one slow or failed attempt must not end the lookup.
export const OVERPASS_HOSTS = ['overpass-api.de', 'overpass.private.coffee', 'maps.mail.ru/osm/tools/overpass'];
export function createFarmClient({ deadlineMs = 75_000, staggerMs = 6_000, backoffMs = 3_000, maxAttempts = 3, hosts = OVERPASS_HOSTS, ...options } = {}) {
  const request = createCachedJson(options);
  return async input => {
    const center = locationInput(input);
    // Quantise only the discovery search center for cache reuse, never NASA coordinates.
    const latitude = Math.round(center.latitude * 100) / 100, longitude = Math.round(center.longitude * 100) / 100;
    if (Math.abs(latitude) > 85 || Math.abs(longitude) > 179.98) throw new AppError('This bounded farmland search does not support the poles or antimeridian. Select a nearby place.');
    const bounds = { south: latitude - .02, west: longitude - .02, north: latitude + .02, east: longitude + .02 };
    const bbox = [bounds.south, bounds.west, bounds.north, bounds.east].map(v => v.toFixed(4)).join(',');
    const query = `[out:json][timeout:25];way["landuse"~"^(farmland|orchard|vineyard|plant_nursery)$"](${bbox});out meta geom;`;
    // Hedged lookup: the preferred service starts first; the next one joins when the
    // previous has failed or after a stagger. A service that answered but is busy or slow retries with
    // exponential backoff until one shared deadline; one this client cannot reach at all is dropped after
    // its first attempt, so an outage is reported instead of waited out. The first complete real response
    // wins. Nothing is substituted when every service fails.
    const startedAt = Date.now(), remaining = () => deadlineMs - (Date.now() - startedAt);
    let settled = false, wakeAll = [], refusalCount = 0, refusalStatus;
    const pause = ms => new Promise(resolve => { const timer = setTimeout(done, ms); function done() { clearTimeout(timer); resolve(); } wakeAll.push(done); });
    const attempts = [];
    const tryHost = async (host, index, previousFailed) => {
      if (index) await Promise.race([pause(staggerMs * index), previousFailed]);
      for (let wait = backoffMs, attempt = 1; !settled && remaining() > 1_000; wait *= 2, attempt++) {
        const url = `https://${host}/api/interpreter?data=${encodeURIComponent(query)}`;
        attempts.push(host);
        let serviceAnswered = false;
        try {
          const raw = await request(url, { timeoutMs: Math.max(1_000, Math.min(45_000, remaining())) });
          serviceAnswered = true;
          const result = normalizeFarms(raw, { latitude, longitude }, new Date().toISOString());
          return { ...result, sourceUrl: url, retrievedAt: raw._fieldshiftRetrievedAt ?? result.retrievedAt, bounds };
        } catch (error) {
          failed[index]?.();
          // Backoff is for a service that might answer on the next attempt: one that said it is busy, one this client
          // is still waiting on, and one that sent bytes this app could not read. A request that never reached the
          // service will not reach it 3 or 9 seconds later inside the same farmer action (measured 18 Nov: a town tap
          // waited 9.05 s to be told the services are unavailable), and one a service read and declined is no luckier.
          const mayRecover = serviceAnswered || Boolean(error?.answered) || Boolean(error?.slow), refused = isPermanentRefusal(error?.responseStatus); if (refused) { refusalCount++; refusalStatus = error.responseStatus; }
          if (settled || !mayRecover || refused || attempt >= maxAttempts || remaining() <= wait) break;
          await pause(wait);
        }
      }
      throw new Error(`${host} unavailable`);
    };
    const failed = [], failedSignals = hosts.map((_, i) => new Promise(resolve => { failed[i] = resolve; }));
    try {
      return await Promise.any(hosts.map((host, i) => tryHost(host, i, i ? failedSignals[i - 1] : null)));
    } catch {
      throw new AppError(refusalCount && refusalCount === attempts.length ? `The field lookup services refused this request (HTTP ${refusalStatus}, ${attempts.length} attempts across ${new Set(attempts).size} services). No fields were invented. Retrying the same request will not help.` : `The field lookup services are busy or unavailable (${attempts.length} attempts across ${new Set(attempts).size} services). No fields were invented. Retry the field search.`, 502, 'CONTEXT_UNAVAILABLE');
    } finally { settled = true; wakeAll.forEach(wake => wake()); }
  };
}

export function createPlaceClient({ fetchImpl = fetch, baseUrl = globalThis.process?.env?.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org', ...options } = {}) {
  const cached = createCachedJson({ fetchImpl, ...options });
  // One queue for search + reverse across this process; public Nominatim permits 1 req/s.
  let queue = Promise.resolve(), lastRequestAt = 0;
  const cache = new Map();
  const run = url => {
    if (cache.has(url.href)) return cache.get(url.href);
    const task = queue.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastRequestAt))));
      lastRequestAt = Date.now();
      return cached(url);
    });
    queue = task.catch(() => {});
    cache.set(url.href, task);
    while (cache.size > 80) cache.delete(cache.keys().next().value);
    task.catch(() => cache.delete(url.href));
    return task;
  };
  return async input => {
    const reverse = input.latitude != null;
    const url = new URL(reverse ? '/reverse' : '/search', baseUrl);
    if (reverse) {
      const location = locationInput(input);
      if (input.detail != null && input.detail !== 'region') throw new AppError('Choose the supported region detail option.');
      url.search = new URLSearchParams({ lat: location.latitude, lon: location.longitude, zoom: input.detail === 'region' ? 10 : 3, format: 'jsonv2', addressdetails: 1, 'accept-language': 'en' });
    } else {
      if (typeof input.q !== 'string' || input.q.trim().length < 2 || input.q.length > 120) throw new AppError('Enter a place name of 2–120 characters.');
      url.search = new URLSearchParams({ q: input.q.trim(), format: 'jsonv2', addressdetails: 1, limit: 5 });
    }
    const raw = await run(url);
    if ((!reverse && !Array.isArray(raw)) || (reverse && !raw.address)) throw new AppError('No place context was returned for this selection.', 404);
    const places = (reverse ? [raw] : raw).map(p => ({ name: p.display_name, latitude: Number(p.lat), longitude: Number(p.lon),
      countryCode: p.address?.country_code?.toUpperCase() ?? null, country: p.address?.country ?? null,
      region: p.address?.state ?? p.address?.region ?? null }));
    return { places, source: { title: 'OpenStreetMap / Nominatim', url: 'https://www.openstreetmap.org/copyright' }, retrievedAt: raw._fieldshiftRetrievedAt ?? new Date().toISOString() };
  };
}
