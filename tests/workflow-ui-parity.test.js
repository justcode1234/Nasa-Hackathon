import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant, parseWorkflowMessage, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

const farms = Array.from({ length: 4 }, (_, index) => ({
  id: `way/${index + 1}`, name: `Test field ${index + 1}`, crops: [],
  representativePoint: { latitude: -31.89 + index / 100, longitude: 116.77 },
}));
const searchPlaces = [
  { id: 'search-1', name: 'Cambridge', countryCode: 'GB', regionCode: 'ENG', latitude: 52.19, longitude: 0.09 },
  { id: 'search-2', name: 'Cambridge', countryCode: 'US', regionCode: 'MA', latitude: 42.36, longitude: -71.06 },
];

function setup(overrides = {}) {
  const calls = [], requests = [];
  const state = { country: 'AU', catalog, countryCrops: getCountryCrops({ country: 'AU' }), farms,
    location: { latitude: -31.89, longitude: 116.77 }, observations: null, temperatureUnit: 'C',
    soilRequested: false, pestRequested: false, map3d: false, step: 'location',
    planning: { baseline: ['', '', ''], allowedCrops: getCountryCrops({ country: 'AU' }).screeningCropIds,
      irrigation: 'unknown', soil: 'unknown', drainage: 'unknown', pestHistory: '', previousCrop: '' } };
  const actions = {
    chooseCountry(code) { calls.push(['country', code]); state.country = code; state.countryCrops = getCountryCrops({ country: code }); },
    chooseLocation(point, countryCode) { calls.push(['location', point.id, countryCode]); state.location = { ...point }; },
    chooseRegion(id) { calls.push(['region', id]); },
    chooseFarm(id) { calls.push(['farm', id]); const farm = state.farms.find(row => row.id === id); state.location = { ...farm.representativePoint }; },
    loadFarms() { calls.push(['fields']); return { ok: true, count: state.farms.length }; },
    showStep(step) { calls.push(['step', step]); state.step = step; },
    applyPlanning({ baseline, constraints, allowed }) {
      calls.push(['inputs', constraints]);
      if (baseline) state.planning.baseline = baseline.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
      Object.assign(state.planning, constraints);
      if (allowed) state.planning.allowedCrops = allowed.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
    },
    async loadEvidence() { calls.push(['NASA']); state.observations = { kind: 'TEST action completion only' }; return true; },
    compare() { calls.push(['compare']); return { scenarios: [{ timeline: [] }] }; },
    setTemperatureUnit(unit) { calls.push(['temperature', unit]); state.temperatureUnit = unit; return true; },
    async loadSoilContext() { calls.push(['soil']); state.soilRequested = true; return true; },
    async loadPestContext() { calls.push(['pests']); state.pestRequested = true; return true; },
    async openMap3D() { calls.push(['open3d']); state.map3d = true; return true; },
    closeMap3D() { calls.push(['close3d']); state.map3d = false; return true; },
    goBack() { calls.push(['back']); state.step = 'evidence'; return true; },
    async searchPlaces(query) { calls.push(['search', query]); return searchPlaces; },
    ...overrides.actions,
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions,
    request: async path => {
      requests.push(path);
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/locations') return { places: [], regions: [] };
      if (url.pathname === '/api/places') return { places: [{ countryCode: 'AU', region: 'Western Australia' }] };
      throw new Error(`Unexpected test request ${path}`);
    } });
  return { assistant, calls, state, requests };
}

test('standalone chat reads the previous crop, drainage and pest history controls', () => {
  const parsed = parseWorkflowMessage('Previous crop: maize. Drainage is poorly drained. Pest history: aphids and whiteflies.');
  assert.ok(parsed, 'a standalone constraint message must stay in the workflow');
  assert.equal(parsed.constraints.previousCrop, 'maize');
  assert.equal(parsed.constraints.drainage, 'poor');
  assert.equal(parsed.constraints.pestHistory, 'aphids and whiteflies');
  assert.equal(parseWorkflowMessage('The field floods.').constraints.drainage, 'poor');
  assert.equal(parseWorkflowMessage('Tell me about soil pH', true), null);
});

test('standalone chat buttons invoke the same temperature, context, map and navigation actions', async () => {
  const cases = [
    ['Show temperature in Fahrenheit', 'temperature', 'temperatureUnit', /Fahrenheit/],
    ['Load historical NASA evidence', 'NASA', 'observations', /evidence loaded/i],
    ['Load regional soil estimates', 'soil', 'soilRequested', /soil estimates/i],
    ['Look up country pest records', 'pests', 'pestRequested', /pest records/i],
    ['Open 3D evidence map', 'open3d', 'map3d', /3D evidence map/i],
    ['Return to 2D map', 'close3d', 'map3d', /2D map/i],
    ['Go back one step', 'back', 'step', /back one workflow step/i],
  ];
  for (const [question, call, key, text] of cases) {
    const { assistant, calls, state, requests } = setup();
    state.location = null;
    const answer = await assistant.respond(question);
    assert.ok(answer, `${question} must return a guided reply`);
    assert.deepEqual(requests, [], `${question} must not be probed as a place name`);
    assert.ok(calls.some(entry => entry[0] === call), `${question} did not invoke ${call}`);
    assert.match(answer.blocks[0].text, text);
    if (key === 'map3d') assert.equal(state.map3d, question.startsWith('Open'));
    else if (key === 'step') assert.equal(state.step, 'evidence');
    else if (key === 'temperatureUnit') assert.equal(state.temperatureUnit, 'F');
    else if (key === 'observations') assert.ok(state.observations);
    else assert.equal(state[key], true);
  }
});

test('an unavailable UI action is reported as unavailable instead of fake success', async () => {
  const { assistant, state } = setup({ actions: {
    openMap3D() { state.map3d = false; return false; },
    loadSoilContext() { state.soilRequested = false; return false; },
    async loadEvidence() { state.observations = null; return false; },
    goBack() { state.step = 'location'; return false; },
  } });
  for (const [question, expected] of [['Open 3D evidence map', /not available/i], ['Load regional soil estimates', /not loaded/i],
    ['Load historical NASA evidence', /not loaded/i], ['Go back one step', /no earlier workflow step/i]]) {
    const answer = await assistant.respond(question);
    assert.ok(answer, `${question} must explain the unavailable action`);
    assert.match(answer.blocks[0].text, expected);
  }
  assert.equal(state.map3d, false);
  assert.equal(state.soilRequested, false);
  assert.equal(state.observations, null);
  assert.equal(state.step, 'location');
});

test('global place search offers exact source rows and selecting one loads every mapped field', async () => {
  const { assistant, calls, state } = setup();
  const answer = await assistant.respond('Search for a place named Cambridge');
  assert.ok(answer, 'a global search must return a guided reply');
  assert.deepEqual(calls.at(-1), ['search', 'Cambridge']);
  assert.deepEqual(answer.followUps.map(choice => choice.workflowChoice), [
    { type: 'place', place: searchPlaces[0], countryCode: 'GB' },
    { type: 'place', place: searchPlaces[1], countryCode: 'US' },
  ]);
  const selected = await assistant.respond(answer.followUps[1].question, answer.followUps[1].workflowChoice);
  assert.equal(state.location.id, 'search-2');
  assert.equal(state.location.latitude, 42.36);
  assert.ok(calls.some(entry => entry[0] === 'location' && entry[1] === 'search-2' && entry[2] === 'US'));
  assert.ok(calls.some(entry => entry[0] === 'fields'));
  assert.deepEqual(selected.followUps.map(choice => choice.label), [
    'Field 1: Test field 1', 'Field 2: Test field 2', 'Field 3: Test field 3', 'Field 4: Test field 4', 'Use selected point',
  ]);
});

test('an empty global place search offers recovery without selecting a point', async () => {
  const before = { latitude: -31.89, longitude: 116.77 };
  const { assistant, state } = setup({ actions: { async searchPlaces() { return []; } } });
  const answer = await assistant.respond('Search for a place named Nowhere');
  assert.ok(answer, 'an empty search must return recovery guidance');
  assert.match(answer.blocks[0].text, /No matching places/);
  assert.deepEqual(state.location, before);
});

test('a global search row without a country code still offers a usable choice', async () => {
  const place = { id: 'search-3', name: 'Country not recorded', countryCode: null, latitude: 10, longitude: 20 };
  const { assistant } = setup({ actions: { async searchPlaces() { return [place]; } } });
  const answer = await assistant.respond('Search for a place named Country not recorded');
  assert.ok(answer, 'a row with no country code must not crash the search reply');
  assert.equal(answer.followUps[0].label, 'Country not recorded · country not recorded');
  assert.deepEqual(answer.followUps[0].workflowChoice, { type: 'place', place, countryCode: null });
});
