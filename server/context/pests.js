import { AppError } from '../errors.js';
import { createCachedJson } from './client.js';

export const PESTS = [
  { id: 'fall-armyworm', name: 'Fall armyworm', scientificName: 'Spodoptera frugiperda', taxonKey: 5109855,
    cropIds: ['sweet-corn'], hostNote: 'Maize is a principal host; this is not a complete host list.',
    hostSource: { title: 'IPPC / FAO: fall armyworm hosts', url: 'https://ippc.int/en/the-global-action-for-fall-armyworm-control/about-fall-armyworm/' } },
  { id: 'diamondback-moth', name: 'Diamondback moth', scientificName: 'Plutella xylostella', taxonKey: 1831136,
    cropIds: ['radish'], hostNote: 'Crucifer vegetables including radish are hosts; local damage is unassessed.',
    hostSource: { title: 'University of Florida IFAS: diamondback moth', url: 'https://ask.ifas.ufl.edu/publication/IN276' } }
];
export function createPestClient(options = {}) {
  const request = createCachedJson(options);
  return async input => {
    if (typeof input.country !== 'string' || !/^[A-Z]{2}$/.test(input.country)) throw new AppError('Select a two-letter country code from place context.');
    const country = input.country;
    const records = await Promise.all(PESTS.map(async pest => {
      const url = new URL('https://api.gbif.org/v1/occurrence/search');
      url.search = new URLSearchParams({ country, taxonKey: pest.taxonKey, occurrenceStatus: 'PRESENT', limit: 1 });
      try {
        const raw = await request(url);
        if (!Number.isInteger(raw.count) || !Array.isArray(raw.results)) throw new Error('Unrecognised occurrence response');
        const sample = raw.results[0];
        return { ...pest, status: raw.count ? 'Country records found' : 'No matching records in this query', occurrenceCount: raw.count, retrievedAt: raw._fieldshiftRetrievedAt,
          sourceUrl: url.href, example: sample ? { url: `https://www.gbif.org/occurrence/${sample.key}`, eventDate: sample.eventDate ?? null,
            datasetKey: sample.datasetKey, basisOfRecord: sample.basisOfRecord, license: sample.license, recordedBy: sample.recordedBy ?? null } : null };
      } catch (error) { return { ...pest, status: 'Unavailable', occurrenceCount: null, example: null, sourceUrl: url.href, error: error.message }; }
    }));
    return { country, retrievedAt: records.map(r => r.retrievedAt).filter(Boolean).sort().at(-1) ?? null, records,
      notices: ['A small watchlist of two sourced crop pests, not a complete country pest inventory. Beans and peas have no sourced pest entries yet.',
        'GBIF records include historical observations and specimens. Country presence is not farm presence, an active outbreak or a probability of damage.',
        'Record counts reflect reporting and sampling, not abundance or risk; zero records do not establish absence.',
        'Occurrence records are not official phytosanitary status. Check the local plant-protection authority and inspect the field. No pesticide advice is generated.'] };
  };
}
