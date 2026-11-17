import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// Singapore stands for every area whose GeoNames regions carry no recorded names: the
// assistant must never need a region the source does not provide.
const sgPlaces = [
  { id: '1880463', name: 'Admiralty', regionCode: '', latitude: 1.44069, longitude: 103.80093 },
  { id: '1881952', name: 'Jurong East', regionCode: '04', latitude: 1.32888, longitude: 103.73995 },
  { id: '1881953', name: 'Jurong Town', regionCode: '05', latitude: 1.33417, longitude: 103.72278 },
  { id: '1881955', name: 'Jurong West', regionCode: '00', latitude: 1.35028, longitude: 103.72278 },
  { id: '1880135', name: 'Woodlands', regionCode: '03', latitude: 1.43801, longitude: 103.78877 },
  { id: '1880137', name: 'Woodlands North Coast', regionCode: '', latitude: 1.45102, longitude: 103.78373 },
  { id: '1880252', name: 'Singapore', regionCode: '', latitude: 1.28967, longitude: 103.85007 }
];
const sgLocations = { regions: [{ id: '', name: null }, { id: '00', name: null }, { id: '04', name: null }], places: sgPlaces };
const indiaLocations = { regions: [{ id: '16', name: 'Maharashtra' }, { id: '27', name: 'Maharashtra Coast' }],
  places: [{ id: 'p1', name: 'Pune', regionCode: '16', latitude: 18.51957, longitude: 73.85535 },
    { id: 'p2', name: 'Nagpur', regionCode: '16', latitude: 21.1458, longitude: 79.0082 },
    { id: 'p3', name: 'Ratnagiri', regionCode: '27', latitude: 16.9905, longitude: 73.3003 }] };

function setup({ country = 'SG', locations = sgLocations, farms = 2 } = {}) {
  const calls = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country }), farm: null, farms: [],
    regionCode: null, location: null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: getCountryCrops({ country }).screeningCropIds, irrigation: 'unknown', soil: 'unknown', startMonth: 1, planningYear: 2026, referenceYear: 2025 } };
  const scenarios = [{ timeline: [] }];
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); state.location = null; state.farm = null; state.regionCode = null; state.observations = null; state.planning.allowedCrops = state.countryCrops.screeningCropIds; },
    chooseLocation(place) { calls.push('location'); state.location = { latitude: place.latitude, longitude: place.longitude, placeId: place.id }; state.observations = null; },
    chooseRegion(id) { calls.push('region'); state.regionCode = id; state.location = null; state.farm = null; },
    chooseFarm(id) { calls.push('farm'); state.farm = state.farms.find(farm => farm.id === id); state.location = state.farm.representativePoint; },
    loadFarms() { calls.push('fields'); state.farms = Array.from({ length: farms }, (_, index) => ({ id: `way/${index + 1}`, name: `TEST FIELD ${index + 1}`, representativePoint: { latitude: 1.3 + index / 100, longitude: 103.8 } })); },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning({ baseline, allowed }) {
      calls.push('inputs');
      if (baseline) state.planning.baseline = baseline.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
      if (allowed) state.planning.allowedCrops = allowed.map(name => resolveCropInput(name, catalog, state.countryCrops).id).filter(id => state.countryCrops.screeningCropIds.includes(id));
    },
    async loadEvidence() { calls.push('NASA'); state.observations = { kind: 'TEST action completion only' }; return true; },
    compare() { calls.push('compare'); scenarios[0].timeline = state.planning.baseline.map(name => ({ cropName: name })); return { scenarios }; }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions,
    request: async path => { const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/locations') return locations;
      throw new Error('unexpected test request ' + path); } });
  return { assistant, calls, state };
}
const text = answer => (answer?.blocks ?? []).map(block => block.text).join(' ');
const towns = answer => (answer?.followUps ?? []).filter(choice => choice.workflowChoice?.type === 'town');
// The browser sends followUp.question and keeps followUp.workflowChoice, never the label.
const click = async (assistant, answer, index = 0) => { const choice = answer.followUps[index]; return assistant.respond(choice.question, choice.workflowChoice ?? null); };

test('a click path through Singapore never repeats a reply and reaches a real point', async () => {
  const { assistant, calls, state } = setup({ farms: 0 });
  const seen = [];
  let answer = await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, bulb onion.');
  for (let step = 0; step < 6 && answer?.followUps?.length; step++) {
    seen.push(text(answer));
    if (/Step 4 is ready/.test(text(answer))) break;
    const townIndex = answer.followUps.findIndex(choice => choice.workflowChoice?.type === 'town');
    answer = await click(assistant, answer, townIndex >= 0 ? townIndex : 0);
  }
  assert.equal(seen.filter((entry, index) => seen.indexOf(entry) !== index).length, 0, `repeated reply in click path: ${JSON.stringify(seen)}`);
  assert.match(text(answer), /selected as a town point|Step 4 is ready/);
  assert.ok(calls.includes('location') && calls.includes('fields'), 'a town button must select the point and look for fields');
  assert.ok(state.location, 'the click path reached a real map point');
  assert.ok(!calls.includes('region'), 'an area without named regions never asks for a region');
});

test('every area prompt for a country with unnamed regions offers tappable towns', async () => {
  const { assistant } = setup();
  await assistant.respond('Help me plan a rotation in Singapore');
  const answer = await assistant.respond('A specific area');
  assert.match(text(answer), /no named regions/i);
  assert.deepEqual(towns(answer).map(choice => choice.label), ['Admiralty', 'Jurong East', 'Jurong Town']);
  assert.equal(towns(answer)[0].question, 'Use Admiralty');
  assert.match(text(answer), /not a recommendation/);
  assert.equal(answer.followUps.find(choice => !choice.workflowChoice).label, 'Whole Singapore');
});

test('the whole-country overview then offers towns instead of returning to the same prompt', async () => {
  const { assistant, state } = setup();
  await assistant.respond('Help me plan a rotation in Singapore');
  const overview = await assistant.respond('Whole Singapore');
  assert.match(text(overview), /Whole-country overview for Singapore/);
  const area = await assistant.respond(overview.followUps[0].question);
  assert.ok(towns(area).length > 0, 'the national overview must hand over to selectable towns');
  assert.ok(!area.followUps.some(choice => choice.question === 'Whole Singapore'),
    'the national overview is already showing; its button must not lead back to it');
  assert.equal(state.location, null);
});

test('typed town names match partially, an exact name wins and a new name re-targets the point', async () => {
  const { assistant, calls, state } = setup();
  await assistant.respond('Help me plan a rotation in Singapore');
  const partial = await assistant.respond('Jurong');
  assert.match(text(partial), /Several listed towns match/);
  assert.deepEqual(partial.followUps.map(choice => choice.label), ['Jurong East', 'Jurong Town', 'Jurong West']);
  const exact = await assistant.respond('woodlands');
  assert.match(text(exact), /Woodlands is selected as a town point/);
  assert.equal(state.location.placeId, '1880135');
  const reTarget = await assistant.respond('Jurong East');
  assert.match(text(reTarget), /Jurong East is selected as a town point/);
  assert.equal(state.location.placeId, '1881952');
  assert.equal(calls.filter(call => call === 'location').length, 2, 'each named town moves the point');
  assert.ok(!calls.includes('NASA'), 'moving the point clears evidence instead of reusing the old reading');
});

test('the country name alone still selects the eponymous town when no regions are named', async () => {
  const { assistant, state } = setup();
  await assistant.respond('Help me plan a rotation in Singapore');
  const answer = await assistant.respond('Singapore');
  assert.match(text(answer), /Singapore is selected as a town point/);
  assert.equal(state.location.placeId, '1880252');
});

test('a planning request that merely mentions a country does not jump to a town point', async () => {
  const { assistant, calls } = setup();
  const answer = await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, bulb onion.');
  assert.match(text(answer), /Which part of Singapore/);
  assert.ok(!calls.includes('location'), 'no place may be chosen before the farmer picks one');
});

test('a region name selects that region and its town buttons stay inside it', async () => {
  const { assistant, state, calls } = setup({ country: 'IN', locations: indiaLocations });
  await assistant.respond('Help me plan a rotation in India');
  const area = await assistant.respond('A specific area');
  assert.match(text(area), /Which state or region of India/);
  const answer = await assistant.respond('use maharashtra');
  assert.match(text(answer), /Maharashtra is selected/);
  assert.equal(state.regionCode, '16');
  assert.deepEqual(towns(answer).map(choice => choice.label), ['Pune', 'Nagpur']);
  assert.ok(!calls.includes('NASA'));
});

test('a field prompt keeps the town-point button beside the mapped fields', async () => {
  const { assistant, calls } = setup({ farms: 3 });
  await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, onion.');
  const area = await assistant.respond('A specific area');
  const answer = await click(assistant, area, area.followUps.findIndex(choice => choice.workflowChoice?.type === 'town'));
  assert.match(text(answer), /is selected as a town point/);
  assert.deepEqual(answer.followUps.map(choice => choice.label),
    ['Field 1: TEST FIELD 1', 'Field 2: TEST FIELD 2', 'Field 3: TEST FIELD 3', 'Use selected point']);
  const ready = await click(assistant, answer, answer.followUps.length - 1);
  assert.match(text(ready), /Step 4 is ready/);
  assert.ok(calls.includes('NASA') && calls.includes('compare'), 'the town point must finish the plan without the form');
});

test('unmatched short replies never execute a place action', async () => {
  const { assistant, calls } = setup();
  await assistant.respond('Help me plan a rotation in Singapore');
  calls.length = 0;
  assert.equal(await assistant.respond('blorple flarn'), null);
  assert.equal(await assistant.respond('zzz qqq'), null);
  assert.deepEqual(calls, []);
});
