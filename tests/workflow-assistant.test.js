import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant, parseWorkflowMessage, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// These doubles test action sequencing, never stand in for observed NASA readings.
function setup({ failEvidence = false, country = 'GB', point = true, waitEvidence, locations = { places: [], regions: [] }, reverseRegion='Maharashtra' } = {}) {
  const calls = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country }), farm: null, farms: [],
    location: point ? { latitude: 52.19, longitude: 0.09 } : null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: getCountryCrops({ country }).screeningCropIds, irrigation: 'unknown', soil: 'unknown' } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); state.location = null; state.farm = null; state.regionCode = null; state.observations = null; state.planning.allowedCrops = state.countryCrops.screeningCropIds; },
    chooseLocation(location) { calls.push('location'); state.location = location; state.observations = null; },
    chooseRegion(id) { calls.push('region'); state.regionCode = id; state.location = null; state.farm = null; },
    chooseFarm(id) { calls.push('farm'); state.farm = state.farms.find(farm => farm.id === id); state.location = state.farm.representativePoint; },
    loadFarms() { calls.push('fields'); },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning({ baseline, constraints, allowed }) {
      calls.push('inputs');
      if (baseline) state.planning.baseline = baseline.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
      Object.assign(state.planning, constraints);
      if (allowed) state.planning.allowedCrops = allowed.map(name => resolveCropInput(name, catalog, state.countryCrops).id).filter(id => state.countryCrops.screeningCropIds.includes(id));
    },
    async loadEvidence() { calls.push('NASA'); if (waitEvidence) await waitEvidence; if (failEvidence) return false; state.observations = { kind: 'TEST action completion only' }; return true; },
    compare() { calls.push('compare'); return { scenarios: [{ timeline: state.planning.baseline.map(name => ({ cropName: name })) }] }; }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions,
    request: async path => {
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/places') return { places: [{ countryCode: Number(url.searchParams.get('latitude')) > 40 ? 'GB' : 'IN',region:reverseRegion }] };
      if (url.pathname === '/api/locations') return locations;
      throw new Error('Unexpected test request');
    } });
  return { assistant, calls, state };
}

test('workflow parser distinguishes actions from read-only crop questions', () => {
  assert.equal(parseWorkflowMessage('tell me about rice in India'), null);
  assert.equal(parseWorkflowMessage('How long does rice grow?', true), null);
  const request = parseWorkflowMessage('Help me pick India at 18.52, 73.85. Crops: rice, wheat, beans. Rainfed; clay soil; pH 6.2');
  assert.deepEqual(request.countries, ['IN']);
  assert.deepEqual(request.location, { latitude: 18.52, longitude: 73.85 });
  assert.deepEqual(request.baseline, ['rice', 'wheat', 'beans']);
  assert.deepEqual(request.constraints, { irrigation: 'rainfed', soil: 'clay', soilPh: 6.2 });
  assert.deepEqual(parseWorkflowMessage('help me rotate rice, wheat, beans in India').baseline, ['rice', 'wheat', 'beans']);
});

test('explicit country, coordinates and farmer crops execute through step 4 in order', async () => {
  const { assistant, calls, state } = setup();
  const answer = await assistant.respond('Help me plan a rotation in India at 18.52, 73.85. Crops: rice, wheat, beans. Rainfed');
  assert.match(answer.blocks[0].text, /Step 4 is ready/);
  assert.deepEqual(calls.filter(call => !call.startsWith('step:')), ['country', 'location', 'inputs', 'NASA', 'compare']);
  assert.deepEqual(state.planning.baseline, ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean']);
  assert.equal(state.planning.irrigation, 'rainfed');
  assert.equal(state.planning.soil, 'unknown');
});

test('country without a field asks for a point and retains supplied crops across messages', async () => {
  const { assistant, calls } = setup();
  const first = await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  assert.match(first.blocks[0].text, /Which part of India.*whole country/);
  assert.deepEqual(first.followUps.map(choice => choice.label), ['Whole India', 'A specific area']);
  assert.ok(!calls.includes('NASA'));
  const second = await assistant.respond('at 18.52, 73.85');
  assert.match(second.blocks[0].text, /Step 4 is ready/);
  assert.equal(calls.filter(call => call === 'compare').length, 1);
});

test('whole-country replies use national evidence without loading point weather or comparing', async () => {
  for (const question of ['Whole India', 'all of India', 'the whole of India', 'entire country', 'nationwide', 'I want the whole country, not a farm', 'An overview of all India, not this field']) {
    const { assistant, calls, state } = setup();
    await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
    const answer = await assistant.respond(question);
    const text = answer.blocks.map(block => block.text).join(' ');
    assert.match(text, /Whole-country overview for India/);
    assert.match(text, /Rice \(2024\).*Wheat \(2024\)/);
    assert.match(text, /not local suitability evidence/);
    assert.ok(answer.sources.some(source => source.id === 'faostat-qcl'));
    assert.equal(state.location, null);
    assert.ok(!calls.includes('NASA') && !calls.includes('compare'));
  }
});

test('combined place/coordinate sentences resolve a coherent point and reject region/town conflicts',async()=>{
  const locations={regions:[{id:'16',name:'Maharashtra'}],places:[{id:'pune',name:'Pune',regionCode:'16',latitude:18.51957,longitude:73.85535}]};
  for(const question of ['Use Maharashtra, near Pune, 18.5204, 73.8567','Use Pune (18.5204, 73.8567).']) {
    const {assistant,state}=setup({locations});
    await assistant.respond('Help me plan in India. Crops: rice, wheat, beans. Rainfed');
    const answer=await assistant.respond(question);
    assert.match(answer.blocks[0].text,/Step 4 is ready/);
    assert.equal(state.location.latitude,18.5204);
    assert.equal(state.planning.irrigation,'rainfed');
  }
  const mismatch=setup({locations,reverseRegion:'Punjab'});
  await mismatch.assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  assert.match((await mismatch.assistant.respond('Use Maharashtra, near Pune, 18.5204, 73.8567')).blocks[0].text,/could not be verified in Maharashtra/);
  assert.ok(!mismatch.calls.includes('NASA'));
  const far=setup({locations});
  await far.assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  assert.match((await far.assistant.respond('Use Pune at 19.076, 72.8777')).blocks[0].text,/more than 50 km/);
  assert.ok(!far.calls.includes('NASA'));
});

test('national scope clears an existing field point and keeps the farmer sequence', async () => {
  const { assistant, state, calls } = setup({ country: 'IN' });
  state.farm = { id: 'way/1', name: 'TEST selected field' };
  state.observations = { kind: 'TEST existing point evidence' };
  state.planning.baseline = ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean'];
  const answer = await assistant.respond('Whole India');
  assert.equal(state.location, null);
  assert.equal(state.farm, null);
  assert.equal(state.observations, null);
  assert.match(answer.blocks[0].text, /Rice.*Wheat.*Bush snap bean/);
  assert.ok(!calls.includes('compare'));
});

test('specific-area mode accepts a sourced region and preserves crops through the local comparison', async () => {
  const { assistant, calls, state } = setup({ locations: { regions: [{ id: '16', name: 'Maharashtra' }], places: [] } });
  await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  const area = await assistant.respond('A specific area');
  assert.match(area.blocks[0].text, /Which state, region or town in India/);
  const region = await assistant.respond('Maharashtra');
  assert.match(region.blocks[0].text, /Which town or farmland in Maharashtra/);
  assert.equal(state.regionCode, '16');
  assert.ok(!calls.includes('NASA'));
  const result = await assistant.respond('at 18.52, 73.85');
  assert.match(result.blocks[0].text, /Step 4 is ready/);
  assert.deepEqual(state.planning.baseline, ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean']);
});

test('whole-country mode can narrow directly to a named region without repeating the crops', async () => {
  const { assistant, state } = setup({ locations: { regions: [{ id: '23', name: 'Punjab' }], places: [] } });
  await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  await assistant.respond('Whole India');
  const answer = await assistant.respond('Punjab');
  assert.match(answer.blocks[0].text, /Which town or farmland in Punjab/);
  assert.equal(state.regionCode, '23');
});

test('scope choices apply to other countries and empty national coverage stays honest', async () => {
  for (const country of ['Australia', 'Antarctica']) {
    const { assistant, calls } = setup();
    const first = await assistant.respond(`Help me plan a rotation in ${country}`);
    assert.match(first.blocks[0].text, new RegExp(`Which part of ${country}`));
    const all = await assistant.respond(first.followUps[0].question);
    assert.match(all.blocks[0].text, new RegExp(`Whole-country overview for ${country}`));
    assert.match(all.blocks[1].text, /Missing categories remain unknown/);
    assert.ok(!calls.includes('NASA'));
  }
});

test('a selected point still needs three farmer crops and never fills missing slots', async () => {
  const { assistant, calls, state } = setup();
  const first = await assistant.respond('Help me plan a rotation using the selected point');
  assert.match(first.blocks[0].text, /three existing crops/);
  const incomplete = await assistant.respond('crops: wheat, peas');
  assert.match(incomplete.blocks[0].text, /exactly three/);
  assert.deepEqual(state.planning.baseline, ['', '', '']);
  assert.ok(!calls.includes('NASA'));
});

test('coordinate-country disagreement stops before location and NASA actions', async () => {
  const { assistant, calls } = setup();
  const answer = await assistant.respond('Help me plan in India at 52.19, 0.09. Crops: rice, wheat, beans');
  assert.match(answer.blocks[0].text, /identified in United Kingdom/);
  assert.ok(!calls.includes('location'));
  assert.ok(!calls.includes('NASA'));
});

test('field actions require a currently returned source ID', async () => {
  const { assistant, calls } = setup();
  const answer = await assistant.respond('Use mapped field way/999999');
  assert.match(answer.blocks[0].text, /not in the current mapped results/);
  assert.ok(!calls.includes('farm'));
});

test('an explicitly numbered returned field is selected without guessing another outline', async () => {
  const { assistant, calls, state } = setup();
  state.farms = [1, 2].map(id => ({ id: `way/${id}`, name: `TEST FIELD ${id}`, representativePoint: { latitude: 52.19 + id / 1000, longitude: 0.09 } }));
  await assistant.respond('Select the second field');
  assert.equal(state.farm.id, 'way/2');
  assert.ok(calls.includes('farm'));
  assert.ok(!calls.includes('NASA'));
});

test('provider failure is not reported as a successful comparison', async () => {
  const { assistant, calls } = setup({ failEvidence: true });
  await assistant.respond('Use the selected point');
  const answer = await assistant.respond('crops: wheat, peas, beans');
  assert.match(answer.blocks[0].text, /could not be loaded/);
  assert.ok(!calls.includes('compare'));
});

test('manual edits cancel a pending continuation before comparison runs', async () => {
  let finish;
  const waitEvidence = new Promise(resolve => { finish = resolve; });
  const { assistant, calls } = setup({ waitEvidence });
  await assistant.respond('Use the selected point');
  const pending = assistant.respond('crops: wheat, peas, beans');
  while (!calls.includes('NASA')) await new Promise(resolve => setTimeout(resolve, 0));
  assistant.invalidate(); finish();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.ok(!calls.includes('compare'));
});

test('restricting alternatives to unsupported crops never silently substitutes other crops', async () => {
  const { assistant, calls } = setup();
  await assistant.respond('Use the selected point');
  const answer = await assistant.respond('crops: wheat, peas, beans. Alternatives: rice, wheat');
  assert.match(answer.blocks[0].text, /fewer than two allowed/);
  assert.ok(!calls.includes('NASA'));
  assert.ok(!calls.includes('compare'));
});

test('crop resolution preserves unknown varieties and existing FAO selections', () => {
  const country = getCountryCrops({ country: 'IN' });
  assert.equal(resolveCropInput('rice', catalog, country).id, 'unassessed:fao-27');
  assert.equal(resolveCropInput('unassessed:fao-27', catalog, country).id, 'unassessed:fao-27');
  assert.equal(resolveCropInput('grain maize', catalog, country).id, 'unassessed:grain maize');
  assert.equal(resolveCropInput('moonfruit', catalog, country).id, 'unassessed:moonfruit');
});

test('an explicit alternative list is separate from baseline and a mixed unsupported list needs correction',async()=>{
  const parsed=parseWorkflowMessage('Allowed crops: bush snap bean, garden pea',true);assert.equal(parsed.baseline,undefined);assert.deepEqual(parsed.allowed,['bush snap bean','garden pea']);
  const {assistant,calls}=setup();await assistant.respond('Use the selected point');calls.length=0;
  const rejected=await assistant.respond('Crops: beans, peas, beans. Alternatives: beans, peas, rice');assert.match(rejected.blocks[0].text,/rice.*not silently discard/s);assert.ok(!calls.includes('NASA')&&!calls.includes('compare'));
  assert.match((await assistant.respond('Allowed crops: beans, peas')).blocks[0].text,/Step 4 is ready/);
});

test('unmatched text in national scope does not execute a workflow action',async()=>{
  const {assistant,calls}=setup({point:false});await assistant.respond('Help me plan in India');await assistant.respond('Whole India');calls.length=0;
  assert.equal(await assistant.respond('blorple flarn'),null);assert.deepEqual(calls,[]);
});


test('nonsense and full-width read-only questions cannot advance a pending point workflow', async()=>{
  const {assistant,calls}=setup();
  await assistant.respond('Help me plan a rotation using the selected point');calls.length=0;
  assert.equal(await assistant.respond('blorple flarn'),null);assert.deepEqual(calls,[]);
  assert.equal(parseWorkflowMessage(String.fromCharCode(0xff1f,0xff1f,0xff1f),true),null);
});

test('Singapore with unnamed region codes goes directly to places and never needs a region',async()=>{
  const {assistant,calls,state}=setup({country:'SG',point:false,locations:{regions:[{id:'01',name:null}],places:[{id:'town',name:'Singapore',regionCode:'01',latitude:1.29,longitude:103.85}]}});
  await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, onion');
  const overview=await assistant.respond('Whole Singapore');
  assert.equal(overview.followUps[0].label,'Choose a town or field');
  const area=await assistant.respond('A specific area');assert.match(area.blocks[0].text,/No named regions.*choose a town|No named regions.*Choose a town/s);
  assert.ok(!calls.includes('region')&&!calls.includes('NASA'));assert.equal(state.location,null);
});
