import snapshot from './country-crops.json' with { type: 'json' };
import { AppError } from '../errors.js';
import { catalog } from '../agronomy/catalog.js';

// Commodity evidence is a category proxy, never cultivar or farm availability.
const screening = { '414': 'bush-bean', '423': 'bush-bean', '417': 'pea', '446': 'sweet-corn' };
export function countryCropName(value) {
  const code = /^unassessed:fao-(\d+)$/.exec(value)?.[1];
  return code ? snapshot.items[code]?.name : null;
}
export function getCountryCrops({ country = '' } = {}) {
  country = String(country).toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) throw new AppError('Choose a two-letter country code.');
  const data = snapshot.countries[country];
  const records = (data?.records ?? []).map(([itemCode, year, tonnes, flag, note]) => ({ itemCode,
    name: snapshot.items[itemCode].name, year, tonnes, units: 't', flag, flagDescription: snapshot.flags[flag] ?? 'See source', note,
    screeningId: screening[itemCode] ?? null }));
  const supported = [...new Set(records.map(r => r.screeningId).filter(Boolean))];
  const choices = records.filter(r => !r.screeningId).map(r => ({ id: `unassessed:fao-${r.itemCode}`, name: r.name, screeningId: null }));
  for (const id of supported) choices.push({ id, name: catalog.crops.find(c => c.id === id).name, screeningId: id });
  choices.sort((a, b) => a.name.localeCompare(b.name));
  return { schemaVersion: 1, country, countryName: data?.name ?? country, available: records.length > 0,
    records, choices, screeningCropIds: supported.sort(), source: snapshot.source, notices: [
      'Country list uses positive national crop production records: latest record per item in 2020–2024. This is a dated snapshot, not live seed availability or farm suitability.',
      'FAO commodities are broad categories. Green/string beans support the bean screening option, green peas the garden-pea option, and green corn the sweet-corn option. Variety, bush habit and local cultivation conditions are unverified.',
      'Absent crops remain unknown, not proven impossible. No general worldwide crop list is substituted. Selected-field crop tags can add explicitly unassessed choices.',
      'Production flags include official figures and estimates; see each record. National production does not validate the agronomic rules in every region.'
    ] };
}
