import { AppError } from '../errors.js';
import { readCached, writeCached } from '../persistence.js';

export const PARAMETERS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN'];
const UNITS = ['C', 'C', 'C', 'mm/day', 'MJ/m^2/day'];
const DAY = 86_400_000;
const API = 'https://power.larc.nasa.gov/api/temporal/daily/point';

export function validateLocation(latitude, longitude, year, now = new Date()) {
  for (const [name, value, min, max] of [['latitude', latitude, -90, 90], ['longitude', longitude, -180, 180]]) {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
      throw new AppError(`${name} must be a number from ${min} to ${max}.`);
    }
  }
  const lastYear = now.getUTCFullYear() - 1;
  if (!['number', 'string'].includes(typeof year) || String(year).trim() === '' || !Number.isInteger(Number(year)) || Number(year) < 2001 || Number(year) > lastYear) {
    throw new AppError(`Choose a complete historical year from 2001 to ${lastYear}.`);
  }
  return { latitude: Number(latitude), longitude: Number(longitude), year: Number(year) };
}

export function datesInYear(year) {
  const dates = [];
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += DAY) dates.push(new Date(t).toISOString().slice(0, 10));
  return dates;
}

export function normalizePower(raw, location, sourceUrl, retrievedAt) {
  if (!raw?.properties?.parameter || !raw?.header || !raw?.parameters) {
    throw new AppError('NASA returned an unrecognised data response. Try again later.', 502, 'NASA_SCHEMA');
  }
  if (raw.header.time_standard !== 'LST') {
    throw new AppError('NASA returned an unexpected time standard; seasonal screening has stopped.', 502, 'NASA_SCHEMA');
  }
  const dates = datesInYear(location.year);
  const notices = [];
  const parameters = {};
  const fill = raw.header.fill_value ?? -999;
  for (const [index, id] of PARAMETERS.entries()) {
    const metadata = raw.parameters[id];
    if (!metadata && Object.keys(raw.properties.parameter[id] ?? {}).length) {
      throw new AppError(`NASA returned ${id} values without unit metadata; screening has stopped.`, 502, 'NASA_SCHEMA');
    }
    if (metadata && metadata.units !== UNITS[index]) {
      throw new AppError(`NASA changed the units for ${id}; screening has stopped to avoid an incorrect calculation.`, 502, 'NASA_UNITS');
    }
    const data = raw.properties.parameter[id] ?? {};
    const values = dates.map(date => {
      const value = data[date.replaceAll('-', '')];
      return typeof value === 'number' && Number.isFinite(value) && value !== fill && value !== -999 &&
        !(index >= 3 && value < 0) ? value : null;
    });
    const missingDays = values.filter(value => value === null).length;
    if (missingDays) notices.push(`${id}: ${missingDays} of ${dates.length} requested days are missing; missing values are not zero.`);
    const validDates = dates.filter((_, i) => values[i] !== null);
    parameters[id] = {
      id, label: metadata?.longname ?? id, units: metadata?.units ?? UNITS[index],
      kind: 'estimated gridded observation', sourceId: 'nasa-power',
      resolution: index < 4 ? { latitudeDegrees: 0.5, longitudeDegrees: 0.625 } : { latitudeDegrees: 1, longitudeDegrees: 1 },
      resolutionSourceId: 'power-resolution', values, missingDays, validDays: dates.length - missingDays,
      latestAvailableDate: validDates.at(-1) ?? null
    };
  }
  const monthly = Array.from({ length: 12 }, (_, month) => {
    const indexes = dates.flatMap((date, i) => Number(date.slice(5, 7)) === month + 1 ? [i] : []);
    const summaries = {};
    for (const id of PARAMETERS) {
      const values = indexes.map(i => parameters[id].values[i]).filter(value => value !== null);
      const sum = values.reduce((total, value) => total + value, 0);
      summaries[id] = {
        mean: values.length ? sum / values.length : null,
        sum: values.length ? sum : null,
        min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
        validDays: values.length, expectedDays: indexes.length,
        kind: 'derived indicator', partial: values.length !== indexes.length
      };
    }
    return { month: month + 1, period: `${location.year}-${String(month + 1).padStart(2, '0')}`, parameters: summaries };
  });
  const available = Object.values(parameters).map(p => p.latestAvailableDate).filter(Boolean).sort();
  return {
    schemaVersion: 1, location: { latitude: location.latitude, longitude: location.longitude },
    period: { start: dates[0], end: dates.at(-1), timeStandard: raw.header.time_standard ?? 'LST' },
    retrievedAt, latestAvailableDate: available.at(-1) ?? null,
    source: { id: 'nasa-power', product: raw.header.title, apiVersion: raw.header.api?.version ?? null,
      products: raw.header.sources ?? [], url: sourceUrl,
      documentationUrl: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/' },
    dates, parameters, monthly,
    notices: [...notices, ...(Array.isArray(raw.messages) ? raw.messages.filter(m => typeof m === 'string') : []),
      'Historical regional estimates, not field sensors, a forecast or a climate normal. Latest available dates refer only to the requested period.',
      'Soil moisture, soil type, vegetation, land suitability and irrigation demand are not measured by this integration.']
  };
}

export function createPowerClient({ fetchImpl = fetch, now = () => new Date(), ttlMs = 6 * 3_600_000, timeoutMs = 25_000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  return async function getObservations(input) {
    const location = validateLocation(input.latitude, input.longitude, input.year, now());
    const key = `${location.latitude},${location.longitude},${location.year}`;
    const hit = cache.get(key);
    if (hit && now().getTime() - hit.storedAt < ttlMs) return { ...hit.data, cache: { hit: true, ttlSeconds: ttlMs / 1000 } };
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const saved = await readCached(`power:${key}`, ttlMs);
      if (saved) {
        cache.set(key, { data: saved.data, storedAt: saved.storedAt });
        return { ...saved.data, cache: { hit: true, ttlSeconds: ttlMs / 1000 } };
      }
      const url = new URL(API);
      url.search = new URLSearchParams({ parameters: PARAMETERS.join(','), community: 'AG', latitude: String(location.latitude),
        longitude: String(location.longitude), start: `${location.year}0101`, end: `${location.year}1231`, format: 'JSON', 'time-standard': 'LST' });
      let raw;
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
        if (!response.ok) throw new AppError(`NASA POWER is unavailable (HTTP ${response.status}). Retry later; no substitute readings were generated.`, 502, 'NASA_UNAVAILABLE');
        raw = await response.json();
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('NASA POWER could not be reached or returned invalid JSON. Retry later; no substitute readings were generated.', 502, 'NASA_UNAVAILABLE');
      }
      const data = normalizePower(raw, location, url.href, now().toISOString());
      await writeCached(`power:${key}`, data, data.retrievedAt);
      cache.delete(key);
      cache.set(key, { data, storedAt: now().getTime() });
      while (cache.size > 64) cache.delete(cache.keys().next().value);
      return { ...data, cache: { hit: false, ttlSeconds: ttlMs / 1000 } };
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
