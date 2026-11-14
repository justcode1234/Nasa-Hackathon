import { api } from '../lib/api.js';
import { el, list, sourceLinks, table, number } from '../lib/dom.js';

export function initContext({ map, coordinates, selectLocation, onFarm, onPests, onSoil, onWater, onCountry, onCountrySelection }) {
  let farms = [], places = [], token = 0;
  let countryTimer, countryTask;
  const $ = id => document.getElementById(id);
  // ISO 3166-1 codes; names are supplied by the browser's Intl locale data.
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  codes.sort((a, b) => names.of(a).localeCompare(names.of(b))).forEach(code => $('pest-country').append(el('option', names.of(code), { value: code })));
  const message = (id, text, error = false) => { $(id).textContent = text; $(id).classList.toggle('error', error); };
  function locationChanged({ preserveFields = false, countryCode = '' } = {}) {
    token++;
    clearTimeout(countryTimer);
    $('pest-country').value = countryCode;
    $('pest-output').replaceChildren();
    onPests(null);
    onSoil(null); onWater(null);
    $('soil-context-output').replaceChildren(); $('water-context-output').replaceChildren();
    message('soil-context-status', 'Regional soil context is not loaded for this location.');
    if (countryCode) loadWater(countryCode);
    loadCountry(countryCode);
    if (!countryCode && coordinates()) countryTimer = setTimeout(() => { ensureCountry(); }, 450);
    message('pest-status', 'Load country records for this selection. Country presence is not farm presence.');
    if (!preserveFields) {
      farms = []; map.clearFarms();
      $('farm-results').replaceChildren(el('option', 'Load nearby fields first', { value: '' }));
      $('farm-results').disabled = true;
      $('farm-details').replaceChildren();
      onFarm(null);
    }
  }
  async function loadCountry(country) {
    const version = token;
    onCountry(null);
    message('country-status', country ? `Loading recorded crops for ${names.of(country)}…` : 'Choose a country to see its recorded crops.');
    try {
      const data = await api(`/api/country-crops?country=${country}`);
      if (version !== token) return;
      onCountry(data);
      message('country-status', country ? `${names.of(country)} · ${data.records.length} crop production categories in the 2020–2024 source snapshot. National records do not establish field suitability.` : 'Choose a country to see its recorded crops.');
    } catch (error) { if (version === token) message('country-status', error.message, true); }
  }
  async function ensureCountry() {
    clearTimeout(countryTimer);
    if ($('pest-country').value) return;
    if (countryTask) return countryTask;
    const position = coordinates(), version = token;
    if (!position) return;
    countryTask = (async () => {
      try {
        const data = await api(`/api/places?${new URLSearchParams(position)}`);
        if (version !== token) return;
        const country = data.places[0]?.countryCode;
        if (!country) return message('country-status', 'No country identified at this point. Choose a country or a named place.');
        $('pest-country').value = country;
        loadWater(country);
        await loadCountry(country);
      } catch (error) { if (version === token) message('country-status', `Country could not be identified: ${error.message}`, true); }
    })();
    try { await countryTask; } finally { countryTask = null; }
  }
  async function loadWater(country) {
    const version = token;
    try {
      const data = await api(`/api/water-context?country=${country}`);
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
      const data = await api(`/api/soil?${new URLSearchParams(position)}`);
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
  async function loadFarms() {
    const position = coordinates();
    if (!position) return message('farms-status', 'Choose a place or coordinate first.', true);
    const version = token;
    $('find-farms').disabled = true;
    message('farms-status', 'Loading community-mapped farmland in a small area around this point…');
    try {
      const data = await api(`/api/farms?${new URLSearchParams(position)}`);
      if (version !== token) return;
      farms = data.farms; map.setFarms(farms);
      $('farm-results').replaceChildren(el('option', farms.length ? 'Choose a mapped field' : 'No complete mapped fields returned', { value: '' }));
      farms.forEach((farm, index) => $('farm-results').append(el('option', `${index + 1}. ${farm.name}${farm.crops.length ? ` · ${farm.crops.join(', ')}` : ' · crop unknown'}`, { value: farm.id })));
      $('farm-results').disabled = !farms.length;
      message('farms-status', `${farms.length} mapped fields returned. OSM data retrieved ${data.retrievedAt}. Coverage is incomplete; this is not land available for use.`);
      $('farm-details').replaceChildren(list(data.notices));
    } catch (error) { if (version === token) message('farms-status', error.message, true); }
    finally { $('find-farms').disabled = false; }
  }
  function selectFarm(id) {
    const farm = farms.find(f => f.id === id);
    if (!farm) return;
    const countryCode = $('pest-country').value;
    selectLocation(farm.representativePoint.latitude, farm.representativePoint.longitude, { preserveFields: true, countryCode });
    $('farm-results').value = id;
    map.highlightFarm(id);
    const root = $('farm-details');
    root.replaceChildren(el('h3', farm.name), el('p', `Recorded crops: ${farm.crops.length ? farm.crops.join(', ') : 'unknown — no crop tag'}. ${farm.cropEvidence}.`),
      el('p', `OSM last edited: ${farm.updatedAt ?? 'unknown'}. This is an edit date, not a crop observation date. Ownership, access and current production are unverified.`));
    root.append(el('a', 'View mapped field and history', { href: farm.sourceUrl, target: '_blank', rel: 'noreferrer' }));
    onFarm(farm);
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
      const data = await api(`/api/places?${new URLSearchParams({ q: $('place-query').value })}`);
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
        const data = await api(`/api/places?${new URLSearchParams(position)}`);
        if (version !== token) return;
        country = data.places[0]?.countryCode;
        if (!country) throw new Error('Country could not be identified here. Choose one manually.');
        $('pest-country').value = country;
        loadWater(country);
        loadCountry(country);
      }
      const data = await api(`/api/pests?country=${country}`);
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
  $('pest-country').addEventListener('change', async () => {
    const country = $('pest-country').value;
    onCountrySelection();
    locationChanged({ countryCode: country });
    const version = token;
    if (!country) return;
    message('place-status', `Finding ${names.of(country)}. Choose a town or field next for a precise location.`);
    try {
      const data = await api(`/api/places?${new URLSearchParams({ q: names.of(country) })}`);
      if (version !== token) return;
      const place = data.places.find(p => p.countryCode === country);
      if (!place) throw new Error('No matching location returned. Search a town in this country.');
      selectLocation(place.latitude, place.longitude, { pan: true, countryCode: country });
      message('place-status', `${place.name}. This is a country representative point; choose a town or field before planning.`);
    } catch (error) { if (version === token) message('place-status', error.message, true); }
  });
  return { locationChanged, loadFarms, selectFarm, loadSoil, ensureCountry };
}
