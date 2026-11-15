import snapshot from './country-crops.json' with { type: 'json' };
import { AppError } from '../errors.js';
import { catalog } from '../agronomy/catalog.js';
import regional from './regional-crops.json' with { type: 'json' };
import { COUNTRY_NAMES } from '../../public/js/lib/countries.js';

// Commodity evidence is a category proxy, never cultivar or farm availability.
export const screening = { '414': 'bush-bean', '423': 'bush-bean', '417': 'pea', '446': 'sweet-corn', '388':'tomato', '358':'cabbage', '403':'onion' };
export const screeningItemIds = cropId => Object.keys(screening).filter(id=>screening[id]===cropId);
export const cropItems = Object.entries(snapshot.items).map(([id, item]) => ({ id, name: item.name }));
export function countryCropName(value) {
  const code = /^unassessed:fao-(\d+)$/.exec(value)?.[1];
  const local = /^unassessed:regional:([A-Z]{2}):([a-z-]+)$/.exec(value);
  return code ? snapshot.items[code]?.name : local ? regional[local[1]]?.records.find(record=>record.id===local[2])?.name ?? null : null;
}
export function getCountryCrops({ country = '' } = {}) {
  country = String(country).toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) throw new AppError('Choose a two-letter country code.');
  const data = snapshot.countries[country];
  const regionalContext = regional[country] ?? null;
  const records = (data?.records ?? []).map(([itemCode, year, tonnes, flag, note]) => ({ itemCode,
    name: snapshot.items[itemCode].name, year, tonnes, units: 't', flag, flagDescription: snapshot.flags[flag] ?? 'See source', note,
    screeningId: screening[itemCode] ?? null }));
  const supported = [...new Set(records.map(r => r.screeningId).filter(Boolean))];
  const choices = records.filter(r => !r.screeningId).map(r => ({ id: `unassessed:fao-${r.itemCode}`, name: r.name, screeningId: null }));
  for (const id of supported) choices.push({ id, name: catalog.crops.find(c => c.id === id).name, screeningId: id });
  for (const record of regionalContext?.records ?? []) choices.push({id:`unassessed:regional:${country}:${record.id}`,name:record.name,screeningId:null,sourceId:regionalContext.source.id});
  choices.sort((a, b) => a.name.localeCompare(b.name));
  return { schemaVersion: 1, country, countryName: data?.name ?? (country ? COUNTRY_NAMES.of(country) : ''), available: records.length > 0,
    records, choices, regionalContext, screeningCropIds: supported.sort(), source: snapshot.source, notices: [
      'Country list uses positive national crop production records: latest record per item in 2020–2024. This is a dated snapshot, not live seed availability or farm suitability.',
      'FAO commodities are category proxies: green/string beans, green peas, green corn, tomatoes, cabbages and dry onions/shallots. Cabbage type and onion variety are unknown; these do not validate head-cabbage or bulb-onion suitability locally. Radish has no mapped FAOSTAT category. Cultivar, bush habit and local conditions remain unverified.',
      'Absent crops remain unknown, not proven impossible. No general worldwide crop list is substituted. Selected-field crop tags can add explicitly unassessed choices.',
      'Production flags include official figures and estimates; see each record. National production does not validate the agronomic rules in every region.'
    ] };
}
