import { api } from './lib/api.js';
import { initMap } from './modules/map.js';
import { renderEvidence } from './modules/data-flow.js';
import { renderStrategy } from './modules/strategy.js';
import { renderCatalog, updateCropChoices } from './modules/si.js';
import { initTabs } from './lib/tabs.js';
import { initContext } from './modules/context.js';
import { initChat } from './modules/chat.js';

const $ = selector => document.querySelector(selector);
let observations = null;
let comparedInputs = null;
let catalogReady = false;
let revision = 0;
let controller;
let catalogData, countryCrops = null, selectedFarm = null, pestContext = null, soilContext = null, waterContext = null, context, chat;
const activateTab = initTabs();
const year = new Date().getUTCFullYear();
$('#reference-year').value = year - 1;
$('#reference-year').max = year - 1;
$('#planning-year').value = Math.min(2100, year + 1);
for (let month = 1; month <= 12; month++) {
  const option = document.createElement('option');
  option.value = month;
  option.textContent = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));
  $('#start-month').append(option);
}
function status(selector, message, error = false) {
  const node = $(selector);
  node.textContent = message;
  node.classList.toggle('error', error);
}
function syncControls() {
  $('#compare').disabled = !observations || !catalogReady || document.querySelectorAll('[name="allowedCrops"]:checked').length < 2;
}
function invalidate(clearEvidence) {
  revision++;
  controller?.abort();
  comparedInputs = null;
  chat?.invalidate();
  $('#strategy-output').textContent = 'Inputs changed. Compare again to see results for the current inputs.';
  status('#comparison-status', clearEvidence ? 'Load evidence for the selected coordinates and year.' : 'Constraints changed. Compare again.');
  if (clearEvidence) {
    observations = null;
    $('#evidence-output').replaceChildren();
    status('#evidence-status', 'Location or reference year changed. Load historical NASA evidence.');
  }
  $('#load-evidence').disabled = false;
  syncControls();
}
function selectLocation(latitude, longitude, options = {}) {
  $('#latitude').value = latitude;
  $('#longitude').value = longitude;
  $('#example-location').value = '';
  invalidate(true);
  map.setLocation(latitude, longitude, options.pan ?? false);
  context?.locationChanged(options);
}
const map = initMap((latitude, longitude) => selectLocation(latitude, longitude), id => context.selectFarm(id));
context = initContext({ map, selectLocation,
  coordinates: () => $('#latitude').value !== '' && $('#longitude').value !== '' && $('#latitude').checkValidity() && $('#longitude').checkValidity() ?
    { latitude: Number($('#latitude').value), longitude: Number($('#longitude').value) } : null,
  onFarm: farm => {
    selectedFarm = farm;
    if (catalogData) updateCropChoices(catalogData, farm?.crops ?? [], countryCrops);
    $('#recorded-crops').textContent = farm ? `Selected field: ${farm.name}. ${farm.crops.length ? `Recorded crop tags: ${farm.crops.join(', ')}. They are available as unassessed choices.` : 'No crop tags are recorded.'} A current tag does not establish rotation history.` : 'Choose crops yourself; a map tag does not provide a three-crop rotation history.';
    chat?.invalidate();
  }, onPests: data => { pestContext = data; chat?.invalidate(); },
  onSoil: data => { soilContext = data; }, onWater: data => { waterContext = data; },
  onCountrySelection: () => { $('#latitude').value = ''; $('#longitude').value = ''; invalidate(true); },
  onCountry: data => {
    const changed = countryCrops?.country !== data?.country;
    countryCrops = data;
    if (catalogData) renderCatalog(catalogData, countryCrops, selectedFarm?.crops ?? []);
    if (changed && observations) invalidate(false);
    syncControls();
  }
});
chat = initChat(() => ({ inputs: comparedInputs, observations, farm: selectedFarm, pests: pestContext, soil: soilContext, water: waterContext }));
for (const id of ['#latitude', '#longitude']) $(id).addEventListener('input', () => {
  $('#example-location').value = '';
  invalidate(true);
  context.locationChanged();
  if ($('#latitude').value !== '' && $('#longitude').value !== '' && $('#latitude').checkValidity() && $('#longitude').checkValidity()) {
    map.setLocation(Number($('#latitude').value), Number($('#longitude').value));
  }
});
$('#reference-year').addEventListener('input', () => invalidate(true));
$('#example-location').addEventListener('change', () => {
  if (!$('#example-location').value) return;
  const [latitude, longitude] = $('#example-location').value.split(',').map(Number);
  const countryCode = { '52.19,0.09': 'GB', '-31.89,116.77': 'AU', '42.03,-93.62': 'US', '-0.717,36.43': 'KE' }[$('#example-location').value];
  $('#latitude').value = latitude;
  $('#longitude').value = longitude;
  invalidate(true);
  map.setLocation(latitude, longitude, true);
  context.locationChanged({ countryCode });
  context.loadFarms();
});
$('#planning-form').addEventListener('input', () => invalidate(false));
$('#location-form').addEventListener('submit', async event => {
  event.preventDefault();
  await context.ensureCountry();
  invalidate(true);
  const version = revision;
  controller = new AbortController();
  $('#load-evidence').disabled = true;
  status('#evidence-status', 'Retrieving historical NASA POWER data… This may take up to 25 seconds.');
  const params = new URLSearchParams({ latitude: $('#latitude').value, longitude: $('#longitude').value, year: $('#reference-year').value });
  try {
    const data = await api(`/api/observations?${params}`, { signal: controller.signal });
    if (revision !== version) return;
    observations = data;
    renderEvidence(data);
    status('#evidence-status', 'Historical evidence loaded. Inspect sources and missingness below.');
    status('#comparison-status', 'Enter the baseline and constraints, then compare.');
    activateTab('evidence');
    context.loadSoil();
  } catch (error) {
    if (error.name !== 'AbortError' && revision === version) status('#evidence-status', error.message, true);
  } finally {
    if (revision === version) { $('#load-evidence').disabled = false; syncControls(); }
  }
});
function readInputs() {
  return { latitude: Number($('#latitude').value), longitude: Number($('#longitude').value), referenceYear: Number($('#reference-year').value), country: countryCrops?.country ?? '',
    planningYear: Number($('#planning-year').value), startMonth: Number($('#start-month').value),
    baseline: [1, 2, 3].map(i => $(`#baseline-${i}`).value),
    allowedCrops: [...document.querySelectorAll('[name="allowedCrops"]:checked')].map(node => node.value),
    previousCrop: $('#previous-crop').value, irrigation: $('#irrigation').value, soil: $('#soil').value,
    pestHistory: $('#pest-history').value, priority: $('#priority').value,
    soilPh: $('#soil-ph').value === '' ? null : Number($('#soil-ph').value), drainage: $('#drainage').value };
}
activateTab.beforeNext = from => {
  if (from === 'location' && !observations) {
    if ($('#location-form').reportValidity()) $('#location-form').requestSubmit();
    return false;
  }
  if (from === 'si') {
    if (!observations) { status('#comparison-status', 'Load NASA evidence in step 02 before comparing.', true); return false; }
    if (document.querySelectorAll('[name="allowedCrops"]:checked').length < 2) { status('#comparison-status', 'At least two country crops with screening rules are required. See country coverage above.', true); return false; }
    if ($('#planning-form').reportValidity()) $('#planning-form').requestSubmit();
    return false;
  }
};
$('#planning-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!observations || !catalogReady) return;
  invalidate(false);
  const version = revision;
  const inputs = readInputs();
  controller = new AbortController();
  $('#compare').disabled = true;
  status('#comparison-status', 'Comparing sourced crop rules and historical evidence…');
  try {
    const result = await api('/api/compare', { method: 'POST', body: inputs, signal: controller.signal });
    if (version !== revision) return;
    renderStrategy(result);
    comparedInputs = inputs;
    status('#comparison-status', 'Baseline and two alternatives ready. Review the trade-offs in module 04.');
    status('#answer-status', 'Ask about a catalog crop, water, soil, pest limits or the comparison.');
    activateTab('strategy');
  } catch (error) {
    if (error.name !== 'AbortError' && version === revision) status('#comparison-status', error.message, true);
  } finally { if (version === revision) syncControls(); }
});
try {
  const catalog = await api('/api/crops');
  catalogData = catalog;
  renderCatalog(catalog, countryCrops, selectedFarm?.crops ?? []);
  catalogReady = true;
  syncControls();
} catch (error) { status('#catalog-status', `Crop catalog unavailable: ${error.message} Reload this page to retry.`, true); }
