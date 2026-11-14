import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant, parseWorkflowMessage, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// These doubles test action sequencing, never stand in for observed NASA readings.
function setup({ failEvidence = false, country = 'GB', point = true, waitEvidence } = {}) {
  const calls = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country }), farm: null, farms: [],
    location: point ? { latitude: 52.19, longitude: 0.09 } : null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: getCountryCrops({ country }).screeningCropIds, irrigation: 'unknown', soil: 'unknown' } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); state.location = null; state.farm = null; state.observations = null; state.planning.allowedCrops = state.countryCrops.screeningCropIds; },
    chooseLocation(location) { calls.push('location'); state.location = location; state.observations = null; },
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
      if (url.pathname === '/api/places') return { places: [{ countryCode: Number(url.searchParams.get('latitude')) > 40 ? 'GB' : 'IN' }] };
      if (url.pathname === '/api/locations') return { places: [], regions: [] };
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
  assert.match(first.blocks[0].text, /town.*latitude, longitude/);
  assert.ok(!calls.includes('NASA'));
  const second = await assistant.respond('at 18.52, 73.85');
  assert.match(second.blocks[0].text, /Step 4 is ready/);
  assert.equal(calls.filter(call => call === 'compare').length, 1);
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
