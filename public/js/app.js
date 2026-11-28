import { api, getTransport } from './lib/api.js';
import { initMap } from './modules/map.js';
import { renderEvidence } from './modules/data-flow.js';
import { renderStrategy } from './modules/strategy.js';
import { renderCatalog, updateCropChoices } from './modules/si.js';
import { initTabs, setNavigationLabel } from './lib/tabs.js';
import { initContext } from './modules/context.js';
import { initChat } from './modules/chat.js';
import { resolveCropInput } from './modules/workflow-assistant.js';
import { comparisonReadiness } from './lib/comparison-readiness.js';

const $ = selector => document.querySelector(selector);
$('#runtime-status').textContent = getTransport() === 'http' ? 'Node.js testing mode' : 'Runs in your browser · no account needed';
let observations = null;
$('#temperature-unit').addEventListener('change',()=>{if(observations)renderEvidence(observations);});
function setLocationMethod(value){$('#location-method').value=value;$('#place-inputs').hidden=value==='coordinates';$('#coordinate-inputs').hidden=value!=='coordinates';$('#example-location').closest('label').hidden=value==='coordinates';}
$('#location-method').addEventListener('change',()=>setLocationMethod($('#location-method').value));
function validLocation(report=false){
  const valid=$('#latitude').value!==''&&$('#longitude').value!==''&&$('#latitude').checkValidity()&&$('#longitude').checkValidity();
  if(!valid&&report){status('#place-status','Choose a town or map point, or switch to Enter coordinates and provide a valid latitude/longitude.',true);
    if($('#location-method').value==='coordinates')$('#latitude').focus();else if(!$('#pest-country').value)$('#pest-country').focus();else $('#place-town').focus();}
  return valid;
}
let evidenceMap3D=null,map3DVersion=0;
function closeMap3D(){
  const wasOpen=!$('#map3d-panel').hidden||$('#open-map3d').disabled;
  map3DVersion++;evidenceMap3D?.close();evidenceMap3D=null;
  $('#map3d-panel').hidden=true;$('#map').hidden=false;$('#open-map3d').disabled=false;
  $('#open-map3d').setAttribute('aria-expanded','false');
  if(wasOpen)$('#map3d-notice').textContent='3D closed. The 2D map is available.';
  window.dispatchEvent(new Event('fieldshift:tabchange'));
}
async function openEvidenceMap3D(){
  if(evidenceMap3D){await evidenceMap3D.ready;return evidenceMap3D;}
  if($('#latitude').value===''||$('#longitude').value===''||!$('#location-form').checkValidity()){
    $('#map3d-notice').textContent='Select a town, map point or valid coordinates first.';$('#latitude').focus();return;
  }
  const version=++map3DVersion;$('#open-map3d').disabled=true;$('#map3d-notice').textContent='Opening the optional 3D view…';
  try{
    const module=await import('./modules/map3d.js');if(version!==map3DVersion)return;
    $('#map3d-panel').hidden=false;$('#map').hidden=true;$('#open-map3d').setAttribute('aria-expanded','true');
    const instance=await module.createEvidenceMap({getState:()=>({location:$('#latitude').value===''||$('#longitude').value===''?null:{latitude:Number($('#latitude').value),longitude:Number($('#longitude').value)},year:Number($('#reference-year').value),observations,farm:selectedFarm}),onClose:()=>{closeMap3D();$('#open-map3d').focus();}});
    if(version!==map3DVersion){instance.close();await instance.ready.catch(()=>{});return;}evidenceMap3D=instance;
    await instance.ready;
    if(version===map3DVersion){$('#map3d-notice').textContent='3D evidence view open. Use Return to 2D at any time.';return instance;}
  }catch(error){if(version===map3DVersion){closeMap3D();$('#map3d-notice').textContent=error.message;}}
}
$('#open-map3d').addEventListener('click',()=>openEvidenceMap3D());
window.addEventListener('fieldshift:weather-window',async event=>{
  const version=revision,{slot,scenarioLabel,inputs}=event.detail;
  if(!comparedInputs||JSON.stringify(inputs)!==JSON.stringify(comparedInputs))return;
  activateTab('location');
  try{
    const instance=await openEvidenceMap3D();
    if(instance&&version===revision){instance.showWindow(slot,scenarioLabel);document.querySelector('#map3d-window').focus();}
  }catch(error){$('#map3d-notice').textContent=error.message;}
});
let comparedInputs = null;
let catalogReady = false;
let catalogFailed = false;
let comparing = false;
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
  syncAllowedCrops();
  const gate = getComparisonReadiness();
  $('#compare').disabled = !gate.ready || comparing;
  $('#compare').setAttribute('aria-describedby', 'comparison-readiness');
  $('#comparison-readiness').textContent = gate.message;
  const planning = !$('#si').hidden;
  $('#flow-blocker').hidden = !planning || gate.ready;
  $('#flow-blocker').textContent = gate.ready ? '' : gate.message;
  $('#flow-next').disabled = planning && (gate.code === 'catalog' || comparing);
  if (planning) setNavigationLabel($('#flow-next'),comparing ? 'Comparing…' : gate.label);
  $('#flow-next').setAttribute('aria-describedby', planning && !gate.ready ? 'flow-blocker' : 'flow-progress');
}
function syncAllowedCrops(){
  const selected=[1,2,3].map(i=>$(`#baseline-${i}`).value);
  const missing=selected.filter(value=>value&&!catalogData?.crops.some(crop=>crop.id===value));
  const note=$('#crop-selection-status');
  if(missing.length){note.dataset.selectionWarning='true';note.hidden=false;note.textContent=`${missing.length} of your selected baseline crops lack annual screening rules. They will stay visible with an explanation of the missing evidence. This planner does not model orchard replacement or invent crop requirements. You must explicitly choose any additional crops for alternatives.`;}
  else if(note.dataset.selectionWarning){delete note.dataset.selectionWarning;note.textContent=countryCrops?.regionalContext?'Official regional crop records are available as unassessed baseline choices; no alternative screening rules have been added.':'';note.hidden=!note.textContent;}
  if($('#alternative-scope').value!=='baseline')return;
  document.querySelectorAll('[name=allowedCrops]').forEach(input=>input.checked=selected.includes(input.value));
}
function getComparisonReadiness() {
  return comparisonReadiness({catalogReady,catalogFailed,country:countryCrops,observations,
    allowedCount:document.querySelectorAll('[name="allowedCrops"]:checked').length});
}
window.addEventListener('fieldshift:tabchange',()=>{syncControls();evidenceMap3D?.resize();});
function invalidate(clearEvidence, options = {}) {
  revision++;
  evidenceMap3D?.clearWindow();
  controller?.abort();
  comparing = false;
  comparedInputs = null;
  chat?.invalidate(options);
  $('#strategy-output').textContent = 'Inputs changed. Compare again to see results for the current inputs.';
  status('#comparison-status', clearEvidence ? 'Load evidence for the selected coordinates and year.' : 'Constraints changed. Compare again.');
  if (clearEvidence) {
    closeMap3D();
    observations = null;
    $('#retry-evidence').hidden = true;
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
  invalidate(true, options);
  map.setLocation(latitude, longitude, options.pan ?? false);
  return context?.locationChanged(options);
}
const map = initMap((latitude, longitude) => selectLocation(latitude, longitude), id => context.selectFarm(id));
context = initContext({ map, selectLocation,
  coordinates: () => $('#latitude').value !== '' && $('#longitude').value !== '' && $('#latitude').checkValidity() && $('#longitude').checkValidity() ?
    { latitude: Number($('#latitude').value), longitude: Number($('#longitude').value) } : null,
  onFarm: (farm, options = {}) => {
    selectedFarm = farm;
    if (catalogData) updateCropChoices(catalogData, farm?.crops ?? [], countryCrops);
    $('#recorded-crops').textContent = farm ? `Selected field: ${farm.name}. ${farm.crops.length ? `Recorded crop tags: ${farm.crops.join(', ')}. They are available as unassessed choices.` : 'No crop tags are recorded.'} A current tag does not establish rotation history.` : 'Choose crops yourself; a map tag does not provide a three-crop rotation history.';
    chat?.invalidate(options);
  }, onPests: (data, options = {}) => { pestContext = data; chat?.invalidate(options); },
  onSoil: data => { soilContext = data; }, onWater: data => { waterContext = data; },
  onCountrySelection: (options = {}) => { $('#latitude').value = ''; $('#longitude').value = ''; map.clearLocation(); invalidate(true, options); },
  onCountry: (data, options = {}) => {
    const changed = countryCrops?.country !== data?.country;
    countryCrops = data;
    if (catalogData) renderCatalog(catalogData, countryCrops, selectedFarm?.crops ?? []);
    if (changed && observations) invalidate(false, options);
    syncControls();
  }
});
chat = initChat(() => ({ inputs: comparedInputs, country: countryCrops?.country ?? '', observations, farm: selectedFarm,
  pests: pestContext, soil: soilContext, water: waterContext,
  location: $('#latitude').value !== '' && $('#longitude').value !== '' && $('#location-form').checkValidity() ?
    { latitude: Number($('#latitude').value), longitude: Number($('#longitude').value) } : null,
  planning: readInputs(), countryCrops, catalog: catalogData, farms: context.getFarms(),
  regionCode: $('#place-region').value === '__all__' ? null : $('#place-region').value || null }), {
  chooseCountry: code => context.chooseCountry(code, { fromAssistant: true }),
  chooseRegion: code => context.chooseRegion(code, { fromAssistant: true }),
  // A chat point carries its saved region when known; global search and raw coordinates clear an older filter.
  chooseLocation: (point, countryCode) => {if(!point.id)setLocationMethod('coordinates');
    return selectLocation(point.latitude, point.longitude, { pan: true, countryCode, regionCode: point.regionCode ?? null, placeId: point.id ?? '', fromAssistant: true });},
  chooseFarm: id => context.selectFarm(id, { fromAssistant: true }),
  loadFarms: () => context.loadFarms(),
  showStep: activateTab, loadEvidence: () => loadEvidence({ fromAssistant: true }), setTemperatureUnit: unit => { $('#temperature-unit').value = unit; if (observations) renderEvidence(observations, unit); }, loadSoilContext: () => $('#load-soil-context').disabled ? false : context.loadSoil(), loadPestContext: () => $('#load-pests').disabled ? false : context.loadPests({ fromAssistant: true }), openMap3D: async () => Boolean(await openEvidenceMap3D()), closeMap3D: () => { if ($('#map3d-panel').hidden) return false; closeMap3D(); return true; }, goBack: () => { if ($('#flow-back').disabled) return false; $('#flow-back').click(); return true; }, searchPlaces: async query => (await api(`/api/places?${new URLSearchParams({ q: query })}`)).places,
  compare: () => runComparison({ fromAssistant: true }),
  applyPlanning({ baseline, constraints, allowed }) {
    if (!catalogData || !countryCrops?.country) throw new Error('Country crop evidence is not loaded.');
    if (baseline) baseline.forEach((name, index) => {
      const crop = resolveCropInput(name, catalogData, countryCrops);
      const select = $(`#baseline-${index + 1}`);
      if (![...select.options].some(option => option.value === crop.id)) select.add(new Option(`${crop.name} — farmer supplied / unassessed`, crop.id));
      select.value = crop.id;
    });
    const controls = { irrigation: '#irrigation', soil: '#soil', soilPh: '#soil-ph', priority: '#priority', drainage: '#drainage', pestHistory: '#pest-history',
      planningYear: '#planning-year', startMonth: '#start-month', referenceYear: '#reference-year' };
    for (const [key, value] of Object.entries(constraints ?? {})) if (key === 'previousCrop') { const crop = resolveCropInput(value, catalogData, countryCrops), select = $('#previous-crop'); if (![...select.options].some(option => option.value === crop.id)) select.add(new Option(`${crop.name} — farmer supplied / unassessed`, crop.id)); select.value = crop.id; } else if (controls[key]) $(controls[key]).value = value;
    if (allowed) {
      $('#alternative-scope').value='custom';
      const ids = allowed.map(name => resolveCropInput(name, catalogData, countryCrops).id);
      document.querySelectorAll('[name=allowedCrops]').forEach(input => { input.checked = ids.includes(input.value); });
    }
    invalidate(Boolean(constraints?.referenceYear), { fromAssistant: true });
  }
});
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
  const countryCode = { '52.19,0.09': 'GB', '-31.89,116.77': 'AU', '42,-93.69': 'US', '-0.77,36.42': 'KE' }[$('#example-location').value];
  $('#latitude').value = latitude;
  $('#longitude').value = longitude;
  invalidate(true);
  map.setLocation(latitude, longitude, true);
  context.locationChanged({ countryCode });
  context.loadFarms();
});
$('#planning-form').addEventListener('input', event => {if(event.target.name==='allowedCrops')$('#alternative-scope').value='custom';invalidate(false);});
async function loadEvidence(options = {}) {
  if (!validLocation(true)||!$('#location-form').reportValidity()) return false;
  const selectionVersion = revision;
  await context.ensureCountry(options);
  if (selectionVersion !== revision) return;
  invalidate(true, options);
  const version = revision;
  controller = new AbortController();
  $('#load-evidence').disabled = true;
  status('#evidence-status', 'Retrieving historical NASA POWER data… This may take up to 25 seconds.');
  activateTab('evidence');
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
    return true;
  } catch (error) {
    if (error.cancelled !== true && revision === version) { status('#evidence-status', error.message, true); $('#retry-evidence').hidden = false; }
    return false;
  } finally {
    if (revision === version) { $('#load-evidence').disabled = false; syncControls(); }
  }
}
$('#location-form').addEventListener('submit', event => { event.preventDefault(); loadEvidence(); });
$('#retry-evidence').addEventListener('click', () => loadEvidence());
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
    if (validLocation(true)&&$('#location-form').reportValidity()) $('#location-form').requestSubmit();
    return false;
  }
  if (from === 'si') {
    const gate = getComparisonReadiness();
    if (!gate.ready) {
      status('#comparison-status', gate.message, true);
      if (gate.code === 'country' || gate.code === 'coverage' || gate.code === 'evidence') {
        activateTab('location');
        if(gate.code==='evidence')$('#flow-next').focus();else {setLocationMethod('places');$('#pest-country').focus();}
      } else if (gate.code === 'allowed') {
        $('#allowed-crops').closest('fieldset').scrollIntoView({block:'center'});
        document.querySelector('[name="allowedCrops"]')?.focus();
      }
      return false;
    }
    if ($('#planning-form').reportValidity()) $('#planning-form').requestSubmit();
    return false;
  }
};
async function runComparison(options = {}) {
  const gate = getComparisonReadiness();
  if (!gate.ready) { status('#comparison-status', gate.message, true); syncControls(); return false; }
  if (!$('#planning-form').checkValidity()) return false;
  invalidate(false, options);
  const version = revision;
  const inputs = readInputs();
  controller = new AbortController();
  comparing = true;
  syncControls();
  status('#comparison-status', 'Comparing sourced crop rules and historical evidence…');
  try {
    const result = await api('/api/compare', { method: 'POST', body: inputs, signal: controller.signal });
    if (version !== revision) return;
    renderStrategy(result);
    comparedInputs = result.inputs;
    status('#comparison-status', 'Baseline and two alternatives ready. Review the trade-offs in module 04.');
    status('#answer-status', 'Ask about a catalog crop, water, soil, pest limits or the comparison.');
    activateTab('strategy');
    return result;
  } catch (error) {
    if (error.cancelled !== true && version === revision) status('#comparison-status', error.message, true);
    return false;
  } finally { if (version === revision) { comparing = false; syncControls(); } }
}
$('#planning-form').addEventListener('submit', event => { event.preventDefault(); runComparison(); });
try {
  const catalog = await api('/api/crops');
  catalogData = catalog;
  renderCatalog(catalog, countryCrops, selectedFarm?.crops ?? []);
  catalogReady = true;
  syncControls();
} catch (error) { catalogFailed = true; syncControls(); status('#catalog-status', `Crop catalog unavailable: ${error.message} Reload this page to retry.`, true); }
