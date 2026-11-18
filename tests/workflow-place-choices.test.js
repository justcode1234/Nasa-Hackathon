import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { isEvidenceQuestion } from '../public/js/lib/chat-intent.js';
import { COUNTRY_NAMES } from '../public/js/lib/countries.js';
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

// Andorra, Tuvalu, Jordan and Japan save the same wording for a region row and a town row.
const parishes = { regions: [{ id: '02', name: 'La Massana' }, { id: '04', name: 'Andorra la Vella' }],
  places: [{ id: 'a1', name: 'la Massana', regionCode: '02', latitude: 42.5452, longitude: 1.5387 },
    { id: 'a2', name: 'El Bosc', regionCode: '02', latitude: 42.5612, longitude: 1.5203 },
    { id: 'a3', name: 'Andorra la Vella', regionCode: '04', latitude: 42.5078, longitude: 1.5211 }] };

test('a wording shared by a region row and a town row follows the question that was asked', async () => {
  const { assistant, state, calls } = setup({ country: 'AD', locations: parishes });
  await assistant.respond('Help me plan a rotation in Andorra');
  await assistant.respond('A specific area');
  const region = await assistant.respond('La Massana');
  assert.match(text(region), /^La Massana is selected/);
  assert.equal(state.regionCode, '02');
  assert.ok(towns(region).length > 0, 'the region reply must offer its towns');
  const town = await assistant.respond('la Massana');
  assert.match(text(town), /la Massana is selected as a town point/);
  assert.equal(state.location.placeId, 'a1', 'once the region is chosen, the same wording picks its town');
  assert.ok(calls.includes('region') && calls.includes('location'));
});

// São Francisco de Assis do Piauí is one town whose name contains the region Piauí.
const brazil = { regions: [{ id: '22', name: 'Piauí' }],
  places: [{ id: 'b1', name: 'São Francisco de Assis do Piauí', regionCode: '22', latitude: -7.25, longitude: -41.0 },
    { id: 'b2', name: 'Teresina', regionCode: '22', latitude: -5.089, longitude: -42.81 }] };

test('a town whose name contains a region name is the town when no region was asked for', async () => {
  const { assistant, state, calls } = setup({ country: 'BR', locations: brazil });
  await assistant.respond('Help me plan a rotation in Brazil');
  const answer = await assistant.respond('São Francisco de Assis do Piauí');
  assert.match(text(answer), /São Francisco de Assis do Piauí is selected as a town point/);
  assert.equal(state.location.placeId, 'b1');
  assert.ok(!calls.includes('region'), 'a town name must not be read as the region inside it');
});

const longName = 'United Townships of Dysart, Dudley, Harcourt, Guilford, Harburn, Bruton, Havelock, Eyre and Clyde';
const canada = { regions: [{ id: '35', name: 'Ontario' }],
  places: [{ id: 'c1', name: 'Ottawa', regionCode: '35', latitude: 45.4112, longitude: -75.6982 },
    { id: 'c2', name: longName, regionCode: '35', latitude: 44.4, longitude: -78.6 }] };

test('a town name that reads as a crop list is the row the farmer copied, and re-targets a chosen point', async () => {
  const { assistant, state, calls } = setup({ country: 'CA', locations: canada });
  await assistant.respond('Help me plan a rotation in Canada');
  await assistant.respond('Ottawa');
  assert.equal(state.location.placeId, 'c1');
  const answer = await assistant.respond(longName);
  assert.match(text(answer), /is selected as a town point/);
  assert.equal(state.location.placeId, 'c2', 'a copied row name moves the point instead of falling silent');
  assert.doesNotMatch(text(answer), /exactly three baseline crops/, 'a place name is not a crop list');
  assert.equal(calls.filter(call => call === 'location').length, 2);
  assert.ok(!calls.includes('NASA'), 'moving the point clears the old evidence');
});

const vietnam = { regions: [{ id: 'CT', name: 'Can Tho' }],
  places: [{ id: 'v1', name: 'Can Tho City', regionCode: 'CT', latitude: 10.0458, longitude: 105.747 },
    { id: 'v2', name: 'Ninh Kieu', regionCode: 'CT', latitude: 10.03, longitude: 105.78 }] };
const macedonia = { regions: [{ id: '34', name: 'Петровец' }],
  places: [{ id: 'm1', name: 'Петровец', regionCode: '34', latitude: 42.05, longitude: 21.4 }] };

test('a town name that opens like a question, and one saved in another script, are still selectable', async () => {
  const { assistant, state } = setup({ country: 'VN', locations: vietnam });
  await assistant.respond('Help me plan a rotation in Vietnam');
  const answer = await assistant.respond('Can Tho City');
  assert.match(text(answer), /Can Tho City is selected as a town point/);
  assert.equal(state.location.placeId, 'v1');

  // Folding keeps the script: no transliteration is invented for a name the source stores in Cyrillic.
  const cyrillic = setup({ country: 'MK', locations: macedonia });
  await cyrillic.assistant.respond('Help me plan a rotation in North Macedonia');
  const named = await cyrillic.assistant.respond('Петровец');
  assert.match(text(named), /Петровец is selected/);
  assert.ok(cyrillic.state.location?.placeId === 'm1' || cyrillic.state.regionCode === '34',
    'the row that was chosen must come from the saved list, in its own script');
});

test('a tapped region works from its row id when the saved spelling has no accent', async () => {
  const reunion = { regions: [{ id: '01', name: 'Reunion' }],
    places: [{ id: 'r1', name: 'Saint-Denis', regionCode: '01', latitude: -20.878, longitude: 55.45 }] };
  const { assistant, state } = setup({ country: 'RE', locations: reunion });
  await assistant.respond('Help me plan a rotation in Réunion');
  const area = await assistant.respond('A specific area');
  assert.match(text(area), new RegExp(`Which state or region of ${COUNTRY_NAMES.of('RE')}`));
  const tap = area.followUps.findIndex(choice => choice.workflowChoice?.type === 'region');
  assert.equal(area.followUps[tap].label, 'Reunion');
  const answer = await click(assistant, area, tap);
  assert.match(text(answer), /Reunion is selected/);
  assert.equal(state.regionCode, '01', 'the tap must resolve by row id, not by accented spelling');
  assert.ok(towns(answer).length > 0, 'the region tap must hand over its towns');
});

test('a local place name that contains another country name does not move the plan', async () => {
  const grenada = { regions: [{ id: '01', name: 'Saint George' }],
    places: [{ id: 'g1', name: 'Carriacou and Petite Martinique', regionCode: '02', latitude: 12.4728, longitude: -61.4583 },
      { id: 'g2', name: "St. George's", regionCode: '01', latitude: 12.0561, longitude: -61.6963 }] };
  const { assistant, state, calls } = setup({ country: 'GD', locations: grenada });
  await assistant.respond('Help me plan a rotation in Grenada');
  const answer = await assistant.respond('Carriacou and Petite Martinique');
  assert.match(text(answer), /Carriacou and Petite Martinique is selected as a town point/);
  assert.equal(state.location.placeId, 'g1');
  assert.equal(calls.filter(call => call === 'country').length, 0, 'a parish name is not a country request');
});

test('a place name is never read as a question, but a real question stays read-only', () => {
  // These names only look like questions through their first letters; the keyword has to stand as a
  // word of its own. “Can Tho City” genuinely does match the pattern, and the assistant still claims
  // it from the saved list while a place question is pending, which the test above proves.
  for (const name of ['Is-Swieqi', 'Is-Siġġiewi', 'Canóvanas']) {
    assert.equal(isEvidenceQuestion(name), false, `“${name}” must stay a place reply`);
  }
  assert.equal(isEvidenceQuestion('Is the rainfall low this month?'), true);
  assert.equal(isEvidenceQuestion('Can I plant rice here'), true);
  assert.equal(isEvidenceQuestion('What does the NASA evidence show'), true);
});

// “Príncipe” is a saved region and also the second half of the country name the farmer typed, and
// “São Tomé” is a town inside that same wording. The country name must not read as a place choice.
const stLocations = { regions: [{ id: '01', name: 'São Tomé Island' }, { id: '02', name: 'Príncipe' }],
  places: [{ id: 's1', name: 'Santo António', regionCode: '01', latitude: 0.336, longitude: 6.737 },
    { id: 's2', name: 'São Tomé', regionCode: '01', latitude: 0.333, longitude: 6.733 },
    { id: 'p1', name: 'Santo António', regionCode: '02', latitude: 1.594, longitude: 7.414 }] };

test('a region named inside its own country name is picked only when the farmer names the region', async () => {
  const { assistant, calls, state } = setup({ country: 'ST', locations: stLocations });
  const prompt = await assistant.respond('Help me plan a rotation in São Tomé and Príncipe. Crops: rice, maize, beans. Rainfed');
  assert.match(text(prompt), /Which part of .* should we focus on/s);
  assert.ok(!calls.includes('region') && !calls.includes('location'), 'the country spelling is not a place choice');
  assert.equal(state.regionCode, null);
  // The region stays reachable from the chat, because the saved list holds it as its own row.
  calls.length = 0;
  const chosen = await assistant.respond('Príncipe');
  assert.match(text(chosen), /Príncipe is selected/s);
  assert.ok(calls.includes('region') && !calls.includes('location'));
  assert.equal(state.regionCode, '02');
});

// The reverse case: a saved town whose own name contains the country name is still that town, so the
// wording may not be discarded as “just the country”. The row is the real Philippines place name the
// coverage audit found.
const phLocations = { regions: [{ id: '03', name: 'Central Luzon' }],
  places: [{ id: 'h1', name: 'Pamayanang University of Philippines Employment Housing Cooperative Subdivision', regionCode: '03', latitude: 14.9, longitude: 120.6 },
    { id: 'h2', name: 'Angeles', regionCode: '03', latitude: 15.15, longitude: 120.58 }] };

test('a town whose own name contains the country name is still selectable', async () => {
  const { assistant, calls, state } = setup({ country: 'PH', locations: phLocations });
  const prompt = await assistant.respond('Help me plan a rotation in the Philippines. Crops: rice, maize, beans');
  assert.match(text(prompt), /Which part of/s);
  assert.ok(!calls.includes('region') && !calls.includes('location'), `naming the country picked a place: ${calls.join(', ')}`);
  const picked = await assistant.respond(phLocations.places[0].name);
  assert.match(text(picked), /is selected as a town point/s);
  assert.equal(state.location.placeId, 'h1');
});

test('an unmatched town typed after a town point still leaves a tappable way forward', async () => {
  const { assistant, calls, state } = setup({ country: 'ST', locations: stLocations });
  await assistant.respond('Help me plan a rotation in São Tomé and Príncipe. Crops: rice, maize, beans. Rainfed');
  await assistant.respond('A specific area');
  await assistant.respond('Príncipe');
  const pointed = await assistant.respond('Santo António');
  assert.match(text(pointed), /Santo António is selected as a town point/s);
  assert.equal(state.location.placeId, 'p1');
  calls.length = 0;
  const recovered = await assistant.respond('Zzyvxilletown');
  assert.ok(recovered, 'a place reply inside a chosen region is never met with silence');
  assert.match(text(recovered), /No town by that name is in the saved place list .* in Príncipe/s);
  assert.ok(recovered.followUps.length >= 1, 'the recovery reply must carry a button');
  assert.ok(!calls.includes('NASA') && !calls.includes('compare') && !calls.includes('location'),
    `recovery runs no data action: ${calls.join(', ')}`);
  assert.equal(state.location.placeId, 'p1', 'the point already chosen stays as it was');
});

// Fifteen saved lists hold a region whose spelling contains another country (Inner Mongolia,
// Northern Ireland, the Macedonias, West Azerbaijan, Niger State, New Jersey, Port of Spain…). The
// town buttons send “Use <name>”, so the same lead-in is what a farmer copies for a region; the whole
// region-name scan over the saved lists runs in tests/matrix-coverage.test.js.
const provinces = { regions: [{ id: '20', name: 'Inner Mongolia' }, { id: '13', name: 'Hebei' }],
  places: [{ id: 'n1', name: 'Hohhot', regionCode: '20', latitude: 40.8494, longitude: 111.6649 },
    { id: 'n2', name: 'Baotou', regionCode: '20', latitude: 40.6582, longitude: 109.8404 },
    { id: 'n3', name: 'Shijiazhuang', regionCode: '13', latitude: 38.0428, longitude: 114.5149 }] };

test('“Use Inner Mongolia” answers the region question instead of moving the plan to Mongolia', async () => {
  const { assistant, state, calls } = setup({ country: 'CN', locations: provinces });
  await assistant.respond('Help me plan a rotation in China');
  const answer = await assistant.respond('Use Inner Mongolia');
  assert.equal(state.country, 'CN', 'a Chinese province is not the country Mongolia');
  assert.equal(calls.filter(call => call === 'country').length, 0, 'the plan must not change country');
  assert.equal(state.regionCode, '20');
  assert.match(text(answer), /^Inner Mongolia is selected/);
  assert.deepEqual(towns(answer).map(choice => choice.label), ['Hohhot', 'Baotou'], 'its own towns follow the region');
});

const states = { regions: [{ id: 'GA', name: 'Georgia' }, { id: 'NJ', name: 'New Jersey' }],
  places: [{ id: 's1', name: 'Athens', regionCode: 'GA', latitude: 33.9609, longitude: -83.3779 },
    { id: 's2', name: 'Newark', regionCode: 'NJ', latitude: 40.7357, longitude: -74.1724 }] };

test('a state spelled like another country stays in the country the plan is already in', async () => {
  const { assistant, state, calls } = setup({ country: 'US', locations: states });
  await assistant.respond('Help me plan a rotation in the United States');
  const answer = await assistant.respond('in Georgia');
  assert.equal(state.country, 'US', '“in Georgia” inside a US plan is the state');
  assert.equal(state.regionCode, 'GA');
  assert.equal(calls.filter(call => call === 'country').length, 0);
  assert.match(text(answer), /^Georgia is selected/);
});

// Luxembourg, Djibouti, Martinique, San Marino, Taiwan, Guadeloupe and Guatemala each save a region
// spelled exactly like their country. It is left out of the suggestion lists so those never duplicate
// “Whole X”, which must not make the row itself unanswerable.
const districts = { regions: [{ id: 'LU', name: 'Luxembourg' }, { id: 'GR', name: 'Grevenmacher' }],
  places: [{ id: 'd1', name: 'Luxembourg', regionCode: 'LU', latitude: 49.6116, longitude: 6.1319 },
    { id: 'd2', name: 'Echternach', regionCode: 'GR', latitude: 49.8124, longitude: 6.4198 }] };

test('the region spelled like its country is selectable by typing it at the region question', async () => {
  const { assistant, state, calls } = setup({ country: 'LU', locations: districts });
  await assistant.respond('Help me plan a rotation in Luxembourg');
  const area = await assistant.respond('A specific area');
  assert.match(text(area), /Which state or region of Luxembourg/);
  assert.ok(!area.followUps.some(choice => choice.label === 'Luxembourg'),
    'the buttons stay distinct from “Whole Luxembourg”, so the country spelling is not offered twice');
  const answer = await assistant.respond('Use Luxembourg');
  assert.equal(state.country, 'LU');
  assert.equal(state.regionCode, 'LU', 'the saved region row answers the question that was asked');
  assert.equal(calls.filter(call => call === 'country').length, 0);
  assert.match(text(answer), /^Luxembourg is selected/);
});

// Seven saved lists also hold a town carrying the country’s own name (Colombia in Huila, Türkmenistan
// in Ahal, Luxembourg in Luxembourg), and outside a chosen region that spelling means the country, so
// it stayed untypeable: the town question came back unchanged. Once a region is picked the pending
// question is “which town”, and the row has to answer it.
test('the town spelled like its country is typeable once another region is chosen', async () => {
  const { assistant, state, calls } = setup({ country: 'LU', locations: districts });
  await assistant.respond('Help me plan a rotation in Luxembourg');
  await assistant.respond('Use Grevenmacher');
  assert.equal(state.regionCode, 'GR', 'the test drives a plan inside one region');
  const answer = await assistant.respond('Luxembourg');
  assert.equal(state.location?.placeId, 'd1', 'the saved town row answers the question that was asked');
  assert.match(text(answer), /^Luxembourg is selected as a town point/);
  assert.equal(calls.filter(call => call === 'country').length, 0, 'a Luxembourg town is not a request to change country');
});

const franceRegions = { regions: [{ id: '01', name: 'Ain' }, { id: '02', name: 'Aisne' }, { id: '03', name: 'Allier' }],
  places: [{ id: 'f1', name: 'Bourg-en-Bresse', regionCode: '01', latitude: 46.2046, longitude: 5.228 },
    { id: 'f2', name: 'Laon', regionCode: '02', latitude: 49.5642, longitude: 3.6237 }] };

// Naming the country answers neither “which region?” nor “which town?”, and until this round the
// assistant replied with that same question, so the chat could be asked it twice with nothing new to
// tap. The reply must say what the word is, leave the real regions to choose from and select nothing.
test('answering the region question with the country’s own name asks something new instead of repeating itself', async () => {
  const { assistant, state } = setup({ country: 'FR', locations: franceRegions });
  await assistant.respond('Help me plan a rotation in France');
  const area = await assistant.respond('A specific area');
  const answer = await assistant.respond('France');
  assert.notEqual(text(answer), text(area), 'the pending question must not come back unchanged');
  assert.match(text(answer), /is the country, not one of its regions/);
  assert.equal(state.regionCode, null, 'naming the country does not pick a region');
  assert.equal(state.location, null, 'and it does not pick a town either');
  assert.ok(answer.followUps.length > 0, 'the reply still leaves a way forward to tap');
  const chosen = await click(assistant, answer, 0);
  assert.equal(state.regionCode, '01', 'the region it offers still answers the question');
  assert.match(text(chosen), /^Ain is selected/);
});
