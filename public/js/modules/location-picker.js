import { el, list, sourceLinks } from '../lib/dom.js';

export function initLocationPicker({ request, onTown, onRegion }) {
  const $ = id => document.getElementById(id);
  let data, revision = 0, country = '';
  const cache = new Map();
  const regionName = id => data?.regions.find(region => region.id === id)?.name ?? 'Region not recorded';
  function renderTowns(regionCode = null, placeId = '') {
    const places = data?.places.filter(place => regionCode === null || place.regionCode === regionCode) ?? [];
    $('place-town').replaceChildren(el('option', places.length ? 'Choose a town / city' : 'No listed towns here — use search or the map', { value: '' }));
    places.forEach(place => $('place-town').append(el('option', `${place.name} · ${regionName(place.regionCode)}`, { value: place.id })));
    $('place-town').disabled = !places.length;
    $('place-town').value = places.some(place => place.id === placeId) ? placeId : '';
    $('location-list-status').textContent = places.length ?
      `${places.length.toLocaleString('en')} listed towns/cities ${regionCode === null ? 'in this country' : `in ${regionName(regionCode)}`}. ${data?.regions.some(region=>region.name) ? 'Choose a town or change the region filter.' : 'No named regions are available in this place list; choose a town directly, use the map or enter coordinates.'}` :
      'No towns are listed for this selection. Search a place, pick the map or enter coordinates.';
  }
  async function setCountry(nextCountry, { regionCode = null, placeId = '' } = {}) {
    const version = ++revision;
    country = nextCountry;
    data = null;
    $('place-region').replaceChildren(el('option', country ? 'Loading regions…' : 'Choose a country first', { value: '' }));
    $('place-town').replaceChildren(el('option', country ? 'Loading towns…' : 'Choose a country first', { value: '' }));
    $('place-region').disabled = true; $('place-town').disabled = true;
    $('place-region').closest('label').hidden=false;
    $('location-list-source').replaceChildren();
    $('location-list-status').textContent = country ? 'Loading the saved region and town list…' : 'Choose a country to browse regions and towns. No place name is needed.';
    if (!country) return;
    try {
      const result = cache.get(country) ?? await request(`/api/locations?country=${country}`);
      if (version !== revision) return;
      data = result; cache.set(country, data);
      while (cache.size > 4) cache.delete(cache.keys().next().value);
      $('place-region').replaceChildren(el('option', 'All regions', { value: '__all__' }));
      [...data.regions].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')).forEach(region =>
        $('place-region').append(el('option', region.name ?? 'Region not recorded', { value: region.id })));
      const namedRegions=data.regions.some(region=>region.name);
      $('place-region').disabled = !data.places.length||!namedRegions;
      $('place-region').closest('label').hidden=!namedRegions;
      $('place-region').value = data.regions.some(region => region.id === regionCode) ? regionCode : '__all__';
      renderTowns($('place-region').value === '__all__' ? null : $('place-region').value, placeId);
      $('location-list-source').replaceChildren(el('p', `${data.source.title} · ${data.source.license} · snapshot retrieved ${data.source.retrievedAt}. ${data.source.coverage}`),
        list(data.notices), sourceLinks(['geonames-places'], [data.source]));
    } catch (error) {
      if (version !== revision) return;
      $('location-list-status').textContent = error.message;
      $('place-region').replaceChildren(el('option', 'List unavailable — reselect country to retry', { value: '' }));
      $('place-town').replaceChildren(el('option', 'Use search, map or coordinates', { value: '' }));
    }
  }
  $('place-region').addEventListener('change', () => {
    if (!data) return;
    const regionCode = $('place-region').value === '__all__' ? null : $('place-region').value;
    renderTowns(regionCode);
    onRegion({ country, regionCode });
  });
  $('place-town').addEventListener('change', () => {
    const place = data?.places.find(place => place.id === $('place-town').value);
    if (place) onTown(place);
  });
  return { setCountry };
}
