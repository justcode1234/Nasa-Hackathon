import { COUNTRY_CODES, COUNTRY_NAMES } from '../lib/countries.js';
import { api } from '../lib/api.js';
import { el, list, sourceLinks, table, number } from '../lib/dom.js';
import { initLocationPicker } from './location-picker.js';

export function initContext({ map, coordinates, selectLocation, onFarm, onPests, onSoil, onWater, onCountry, onCountrySelection, request = api }) {
  let farms = [], places = [], token = 0;
  let countryTimer, countryTask;
  const $ = id => document.getElementById(id);
  // ISO 3166-1 codes; names are supplied by the browser's Intl locale data.
  const codes = [...COUNTRY_CODES];
  const names = COUNTRY_NAMES;
  codes.sort((a, b) => names.of(a).localeCompare(names.of(b))).forEach(code => $('pest-country').append(el('option', names.of(code), { value: code })));
  const message = (id, text, error = false) => { $(id).textContent = text; $(id).classList.toggle('error', error); };
  const picker = initLocationPicker({ request,
    onTown: place => {
      selectLocation(place.latitude, place.longitude, { pan: true, countryCode: place.country, regionCode: place.regionCode, placeId: place.id });
      message('place-status', `${place.name} · ${names.of(place.country)}. This is a town point; choose a field or map point before interpreting farm conditions.`);
      loadFarms();
    },
    onRegion: ({ country, regionCode }) => { onCountrySelection(); locationChanged({ countryCode: country, regionCode }); }
  });
  function locationChanged({ preserveFields = false, countryCode = '', regionCode = null, placeId = '', fromAssistant = false } = {}) {
    token++;
    clearTimeout(countryTimer);
    $('pest-country').value = countryCode;
    const placeTask = picker.setCountry(countryCode, { regionCode, placeId });
    $('pest-output').replaceChildren();
    onPests(null, { fromAssistant });
    onSoil(null); onWater(null);
    $('soil-context-output').replaceChildren(); $('water-context-output').replaceChildren();
    message('soil-context-status', 'Regional soil context is not loaded for this location.');
    if (countryCode) loadWater(countryCode);
    const cropTask = loadCountry(countryCode, { fromAssistant });
    if (!countryCode && coordinates()) countryTimer = setTimeout(() => { ensureCountry(); }, 450);
    message('pest-status', 'Load country records for this selection. Country presence is not farm presence.');
    if (!preserveFields) {
      $('find-farms').disabled = false;
      $('find-farms').textContent = 'Find mapped fields around selection';
      farms = []; map.clearFarms();
      $('farm-results').replaceChildren(el('option', 'Load nearby fields first', { value: '' }));
      $('farm-results').disabled = true;
      $('farm-details').replaceChildren();
      onFarm(null, { fromAssistant });
    }
    return Promise.all([placeTask, cropTask]);
  }
  let loadedCountry = null;
  async function loadCountry(country, options = {}) {
    // A new town or field in the same country keeps the loaded crop lists, so the
    // farmer's step 3 selections are not wiped by an empty interim list.
    if (country && country === loadedCountry) return;
    loadedCountry = null;
    const version = token;
    onCountry(null, options);
    message('country-status', country ? `Loading recorded crops for ${names.of(country)}…` : 'Choose a country to see its recorded crops.');
    try {
      const data = await request(`/api/country-crops?country=${country}`);
      if (version !== token) return;
      onCountry(data, options); loadedCountry = country;
      message('country-status', country ? `${names.of(country)} · ${data.records.length} crop production categories in the 2020–2024 source snapshot. National records do not establish field suitability.` : 'Choose a country to see its recorded crops.');
    } catch (error) { if (version === token) message('country-status', error.message, true); }
  }
  async function ensureCountry(options = {}) {
    clearTimeout(countryTimer);
    if ($('pest-country').value) return;
    const position = coordinates(), version = token;
    if (!position) return;
    if (countryTask?.version === version) return countryTask.promise;
    const task = (async () => {
      try {
        const data = await request(`/api/places?${new URLSearchParams(position)}`);
        if (version !== token) return;
        const country = data.places[0]?.countryCode;
        if (!country) return message('country-status', 'No country identified at this point. Choose a country or a named place.');
        $('pest-country').value = country;
        picker.setCountry(country);
        loadWater(country);
        await loadCountry(country, options);
      } catch (error) { if (version === token) message('country-status', `Country could not be identified: ${error.message}`, true); }
    })();
    countryTask = { version, promise: task };
    try { await task; } finally {
      // A previous location may finish after a newer lookup has already started.
      if (countryTask?.promise === task) countryTask = null;
    }
  }
  async function loadWater(country) {
    const version = token;
    try {
      const data = await request(`/api/water-context?country=${country}`);
      if (version !== token) return;
      onWater(data);
      const root = $('water-context-output');
      root.replaceChildren(el('h3', 'Published irrigation history'), list(data.notices));
      if (data.available) root.append(el('p', `${data.geographicalSupport} · ${data.period} · released ${data.publishedDate} · source checked ${data.sourceCheckedDate}`),
        table(['Category', 'Irrigated area (ha)', 'Applied water (ML)', 'Derived annual ML/ha'], data.rows.map(r => [r.category, r.irrigatedHa, r.waterAppliedMl, number(r.appliedMlPerIrrigatedHa, 2)]), 'Historical reported irrigation, not a watering recommendation'), el('p', 'Calculation: published ML ÷ published irrigated hectares. No daily schedule is inferred.'));
      root.append(sourceLinks(['abs-irrigation'], [data.source]));
    } catch (error) { if (version === token) $('water-context-output').textContent = error.message; }
  }
  async function loadSoil() {
    const position = coordinates(), version = token;
    if (!position) return message('soil-context-status', 'Choose a location first.', true);
    $('load-soil-context').disabled = true;
    message('soil-context-status', 'Retrieving mapped regional soil estimates and source prediction intervals…');
    try {
      const data = await request(`/api/soil?${new URLSearchParams(position)}`);
      if (version !== token) return;
      onSoil(data);
      $('soil-context-output').replaceChildren(el('p', `${data.product} · ${data.kind} · nominal ${data.nominalResolutionM} m grid · depth ${data.depth} · retrieved ${data.retrievedAt}. No single observation date.`),
        table(['Property', 'Model mean', '5th–95th quantiles', 'Units'], data.properties.map(p => [p.name, number(p.mean), `${number(p.lower)} to ${number(p.upper)}`, p.units]), 'Regional soil estimates — not measured farm soil'),
        list(data.notices), sourceLinks(['soilgrids'], [data.source]));
      message('soil-context-status', 'Regional soil context loaded. Farm soil inputs remain unknown until supplied from local evidence.');
    } catch (error) { if (version === token) message('soil-context-status', `${error.message} Soil remains unknown; no typical soil was guessed.`, true); }
    finally { $('load-soil-context').disabled = false; }
  }
  $('load-soil-context').addEventListener('click', loadSoil);
  // The lookup reports its outcome as a structured fact because the chat has to tell a refusal apart from
  // an empty map: `farms-status` below is a rendered sentence, and a caller outside step 2 must not read
  // error text to decide what the farmer is told. Nothing here forwards the runtime's own words.
  async function loadFarms() {
    const position = coordinates();
    if (!position) { message('farms-status', 'Choose a place or coordinate first.', true); return { ok: false, reason: 'no-location' }; }
    const version = token;
    $('find-farms').disabled = true;
    $('find-farms').textContent = 'Finding mapped fields…';
    message('farms-status', 'Loading community-mapped farmland in a small area around this point… The shared OpenStreetMap lookup services can take up to a minute when busy.');
    try {
      const data = await request(`/api/farms?${new URLSearchParams(position)}`);
      if (version !== token) return { ok: false, reason: 'superseded' };
      farms = data.farms; map.setFarms(farms);
      $('farm-results').replaceChildren(el('option', farms.length ? 'Choose a mapped field' : 'No complete mapped fields returned', { value: '' }));
      farms.forEach((farm, index) => $('farm-results').append(el('option', `${index + 1}. ${farm.name}${farm.crops.length ? ` · ${farm.crops.join(', ')}` : ' · crop unknown'}`, { value: farm.id })));
      $('farm-results').disabled = !farms.length;
      message('farms-status', `${farms.length} mapped fields returned. OSM data retrieved ${data.retrievedAt}. Coverage is incomplete; this is not land available for use.`);
      $('farm-details').replaceChildren(list(data.notices));
      $('find-farms').textContent = 'Find mapped fields around selection';
      return { ok: true, count: farms.length };
    } catch (error) {
      if (version === token) {
        message('farms-status', `${error.message} You can continue with the selected map point or coordinates without field outlines.`, true);
        $('find-farms').textContent = 'Retry mapped field search';
      }
      return { ok: false, reason: 'lookup-failed' };
    }
    finally { if(version===token)$('find-farms').disabled = false; }
  }
  async function selectFarm(id, options = {}) {
    const farm = farms.find(f => f.id === id);
    if (!farm) return;
    const countryCode = $('pest-country').value;
    const selected = selectLocation(farm.representativePoint.latitude, farm.representativePoint.longitude, { preserveFields: true, countryCode, ...options });
    $('farm-results').value = id;
    map.highlightFarm(id);
    const root = $('farm-details');
    root.replaceChildren(el('h3', farm.name), el('p', `Recorded crops: ${farm.crops.length ? farm.crops.join(', ') : 'unknown — no crop tag'}. ${farm.cropEvidence}.`),
      el('p', `OSM last edited: ${farm.updatedAt ?? 'unknown'}. This is an edit date, not a crop observation date. Ownership, access and current production are unverified.`));
    root.append(el('a', 'View mapped field and history', { href: farm.sourceUrl, target: '_blank', rel: 'noreferrer' }));
    onFarm(farm, options);
    await selected;
  }
  $('find-farms').addEventListener('click', loadFarms);
  $('farm-results').addEventListener('change', () => selectFarm($('farm-results').value));
  $('place-form').addEventListener('submit', async event => {
    event.preventDefault();
    const version = ++token;
    $('search-place').disabled = true;
    places = []; $('place-results').disabled = true;
    $('place-results').replaceChildren(el('option', 'Searching…', { value: '' }));
    message('place-status', 'Searching place names with OpenStreetMap / Nominatim…');
    try {
      const data = await request(`/api/places?${new URLSearchParams({ q: $('place-query').value })}`);
      if (version !== token) return;
      places = data.places;
      $('place-results').replaceChildren(el('option', places.length ? 'Choose a result' : 'No matching places', { value: '' }));
      places.forEach((place, index) => $('place-results').append(el('option', place.name, { value: index })));
      $('place-results').disabled = !places.length;
      message('place-status', `${places.length} results · OpenStreetMap / Nominatim. Choose one to explore nearby fields.`);
    } catch (error) { if (version === token) message('place-status', error.message, true); }
    finally { $('search-place').disabled = false; }
  });
  $('place-results').addEventListener('change', () => {
    if ($('place-results').value === '') return;
    const place = places[Number($('place-results').value)];
    selectLocation(place.latitude, place.longitude, { pan: true, countryCode: place.countryCode });
    message('place-status', place.name);
    loadFarms();
  });
  $('pest-form').addEventListener('submit', async event => {
    event.preventDefault();
    const version = token;
    $('load-pests').disabled = true; $('pest-output').replaceChildren(); onPests(null);
    message('pest-status', 'Looking up country occurrence records…');
    try {
      let country = $('pest-country').value;
      if (!country) {
        const position = coordinates();
        if (!position) throw new Error('Select a location or choose a country.');
        const data = await request(`/api/places?${new URLSearchParams(position)}`);
        if (version !== token) return;
        country = data.places[0]?.countryCode;
        if (!country) throw new Error('Country could not be identified here. Choose one manually.');
        $('pest-country').value = country;
        loadWater(country);
        loadCountry(country);
      }
      const data = await request(`/api/pests?country=${country}`);
      if (version !== token) return;
      const root = $('pest-output');
      root.replaceChildren(el('p', `${names.of(country)} · GBIF country records, all dates · retrieved ${data.retrievedAt ?? 'unavailable'}`), list(data.notices));
      data.records.forEach(record => {
        const article = el('article');
        article.append(el('h4', `${record.name} (${record.scientificName})`),
          el('p', `${record.status}${record.occurrenceCount !== null ? `: ${record.occurrenceCount} occurrence records (not abundance).` : '.'} ${record.hostNote}`),
          sourceLinks(['query', 'host'], [{ id: 'query', title: 'GBIF country query', url: record.sourceUrl }, { id: 'host', ...record.hostSource }]));
        if (record.example) article.append(el('p', `Example record date: ${record.example.eventDate ?? 'unknown'}; type: ${record.example.basisOfRecord}; license: ${record.example.license ?? 'see source'}. This is not necessarily the latest record.`),
          el('a', 'View example occurrence and dataset attribution', { href: record.example.url, target: '_blank', rel: 'noreferrer' }));
        root.append(article);
      });
      onPests(data);
      message('pest-status', 'Country context loaded. These are inspection leads, not a field diagnosis.');
    } catch (error) { if (version === token) message('pest-status', error.message, true); }
    finally { $('load-pests').disabled = false; }
  });
  $('pest-country').addEventListener('change', () => {
    const country = $('pest-country').value;
    onCountrySelection();
    locationChanged({ countryCode: country });
    message('place-status', country ? 'Choose a region or town from the dropdowns, search a place, or pick the map.' : 'Choose a country to browse towns.');
  });
  return { locationChanged, loadFarms, selectFarm, loadSoil, ensureCountry, getFarms: () => farms,
    async chooseCountry(country, options = {}) {
      if (!codes.includes(country)) throw new Error('Choose a supported country.');
      onCountrySelection(options);
      return locationChanged({ countryCode: country, ...options });
    },
    async chooseRegion(regionCode, options = {}) {
      const countryCode = $('pest-country').value;
      if (!countryCode) throw new Error('Choose a country before selecting a region.');
      // The Region list is what this check reads, and it is filled asynchronously: after a saved-list read that
      // failed it keeps its `List unavailable` placeholder until the country is reselected, so a region the chat
      // just recovered would be refused by a form still holding the older failure. Ask this country's rows of the
      // picker first — it caches a body only on a successful read, so that is a real re-check after a failure and
      // costs nothing on a healthy list — and then the sentence below means what it says.
      await picker.setCountry(countryCode, { regionCode });
      if (![...$('place-region').options].some(option => option.value === regionCode && option.value !== '__all__')) throw new Error('Choose a region from the current country list.');
      onCountrySelection(options);
      return locationChanged({ countryCode, regionCode, ...options });
    } };
}
