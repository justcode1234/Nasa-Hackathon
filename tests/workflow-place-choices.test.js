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

function setup({ country = 'SG', locations = sgLocations, farms = 2, fieldsGraceMs, fieldsNeverAnswer = false, fieldsRefused = false, listFailure = null, reverse = null } = {}) {
  const calls = []; const listAsks = []; let pendingFailure = listFailure; const reverseAsked = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country }), farm: null, farms: [],
    regionCode: null, location: null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: getCountryCrops({ country }).screeningCropIds, irrigation: 'unknown', soil: 'unknown', startMonth: 1, planningYear: 2026, referenceYear: 2025 } };
  const scenarios = [{ timeline: [] }];
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); state.location = null; state.farm = null; state.regionCode = null; state.observations = null; state.planning.allowedCrops = state.countryCrops.screeningCropIds; },
    chooseLocation(place) { calls.push('location'); state.location = { latitude: place.latitude, longitude: place.longitude, placeId: place.id }; state.observations = null; },
    chooseRegion(id) { calls.push('region'); state.regionCode = id; state.location = null; state.farm = null; },
    chooseFarm(id) { calls.push('farm'); state.farm = state.farms.find(farm => farm.id === id); state.location = state.farm.representativePoint; },
    loadFarms() {
      calls.push('fields');
      // A shared community service that accepts the connection and never answers: the request stays open.
      if (fieldsNeverAnswer) return new Promise(() => {});
      // A service that refuses outright: this is what public/js/modules/context.js reports now, and `state.farms`
      // is left as it was, which is exactly the leftover the chat must not read as an answer.
      if (fieldsRefused) return { ok: false, reason: 'lookup-failed' };
      state.farms = Array.from({ length: farms }, (_, index) => ({ id: `way/${index + 1}`, name: `TEST FIELD ${index + 1}`, representativePoint: { latitude: 1.3 + index / 100, longitude: 103.8 } }));
    },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning({ baseline, allowed }) {
      calls.push('inputs');
      if (baseline) state.planning.baseline = baseline.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
      if (allowed) state.planning.allowedCrops = allowed.map(name => resolveCropInput(name, catalog, state.countryCrops).id).filter(id => state.countryCrops.screeningCropIds.includes(id));
    },
    async loadEvidence() { calls.push('NASA'); state.observations = { kind: 'TEST action completion only' }; return true; },
    compare() { calls.push('compare'); scenarios[0].timeline = state.planning.baseline.map(name => ({ cropName: name })); return { scenarios }; }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions, fieldsGraceMs,
    request: async path => { const url = new URL(path, 'https://test.invalid');
      // `locations` may be a function of the requested country so a test can hold a different saved list per country.
      if (url.pathname === '/api/locations') { const country = url.searchParams.get('country'); listAsks.push(country);
        const failure = typeof pendingFailure === 'function' ? pendingFailure(country) : pendingFailure;
        if (failure) { const error = new Error(failure.message); Object.assign(error, failure); throw error; } return typeof locations === 'function' ? locations(country) : locations; }
      // A typed point is reverse-geocoded before the saved list is consulted; `reverse` is opt-in so a test that
      // never speaks coordinates still fails loudly on any request it has not modelled.
      if (url.pathname === '/api/places') { if (!reverse) throw new Error('unexpected test request ' + path); reverseAsked.push(url.searchParams.get('detail')); return typeof reverse === 'function' ? reverse(url.searchParams) : reverse; }
      throw new Error('unexpected test request ' + path); } });
  return { assistant, calls, state, listAsked: () => listAsks.length, listAsks: () => listAsks.slice(),
    reverseAsked: () => reverseAsked, failList: failure => { pendingFailure = failure; } };
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

test('a regionless town choice never turns its unnamed code into a region filter', async () => {
  const { assistant, state } = setup({ farms: 0 });
  await assistant.respond('Help me plan a rotation in Singapore');
  const area = await assistant.respond('A specific area');
  const jurongEast = area.followUps.findIndex(choice => choice.label === 'Jurong East');
  assert.ok(jurongEast >= 0, 'the regionless list offers Jurong East');
  const selected = await click(assistant, area, jurongEast);
  assert.match(text(selected), /Jurong East is selected as a town point/);
  const partial = await assistant.respond('Jurong');
  assert.match(text(partial), /Several listed towns match/);
  assert.deepEqual(towns(partial).map(choice => choice.label), ['Jurong East', 'Jurong Town', 'Jurong West']);
  assert.equal(state.regionCode, null);
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

// Measured 20 Nov on the iteration-63 tree by an offline walk of the shipped assistant: the guard above decides
// whether a name that contains another country is a local place by reading the saved list, and the
// `.catch(() => null)` that then stood on public/js/modules/workflow-assistant.js:358 answered that question with
// “not a local place” whenever the read refused. With a China plan holding region 20, a Hohhot point and loaded
// evidence, the same sentence reported `country=MN region=null place=null evidence=null` after the calls
// `country:MN`, `inputs` and `step:location`, and answered “Which part of Mongolia should we focus on…”. The list
// never answered, so it could not have said either; a page restored without a list read is how a farmer reaches
// that state. Iteration 61 and 62 fixed the two other readers of the same refused list (:356 and chooseRegion).
const mongoliaPlan = (harness, observations = { kind: 'TEST evidence the farmer already loaded' }) => {
  // The region, the town point and the evidence are seeded rather than clicked through: a refused list makes the
  // click path unreachable, and what is under test is the switch decision, not the picker.
  harness.state.regionCode = '20';
  harness.state.location = { latitude: 40.8494, longitude: 111.6649, placeId: 'n1' };
  harness.state.observations = observations;
  return { country: harness.state.country, regionCode: harness.state.regionCode,
    place: harness.state.location.placeId, observations: harness.state.observations,
    allowed: [...harness.state.planning.allowedCrops] };
};

test('a switch an unreadable list cannot arbitrate keeps the plan and names the read it could not do', async () => {
  const harness = setup({ country: 'CN', locations: provinces, listFailure: UNAVAILABLE });
  const { assistant, state, calls, listAsked, failList } = harness;
  await assistant.respond('Help me plan a rotation in China');
  const before = mongoliaPlan(harness);
  const asked = listAsked();
  const answer = await assistant.respond('Inner Mongolia');
  assert.deepEqual({ country: state.country, regionCode: state.regionCode, place: state.location?.placeId,
    observations: state.observations, allowed: [...state.planning.allowedCrops] }, before,
    'a place-list read that never answered moved the plan to another country');
  assert.equal(calls.filter(call => call === 'country').length, 0, 'chooseCountry ran on the strength of a list it could not read');
  const sentence = text(answer), labels = answer.followUps.map(choice => choice.label);
  assert.match(sentence, /could not be read just now/, `the refusal must name the read it could not do: ${sentence}`);
  assert.match(sentence, /China/);
  assert.match(sentence, /Mongolia/, 'the country the sentence could have meant is named, not hidden');
  assert.match(sentence, /cannot tell whether/, 'the ambiguity the list would have settled is stated as an ambiguity');
  for (const claim of ['is selected', 'Which part of Mongolia', 'No towns are listed', 'nothing matches'])
    assert.ok(!sentence.includes(claim), `an unanswered read was answered as a finding: ${sentence}`);
  assert.equal(listAsked(), asked + 1, 'one read per ask, and no second read to compose the reply');
  // Both ways out have to work: replaying the sentence re-checks against a list that may now answer, and the
  // explicit move is honoured without one.
  assert.ok(labels.some(label => /again/i.test(label)) && labels.some(label => /switch to mongolia/i.test(label)),
    `the refusal must offer the replay and the outright move: ${labels.join(' | ')}`);
  failList(null);
  const replay = answer.followUps.findIndex(choice => /again/i.test(choice.label));
  const after = await click(assistant, answer, replay);
  assert.equal(state.country, 'CN', 'a retry whose list now answers may not move the country either');
  assert.match(text(after), /Inner Mongolia is the region this plan is already in/, `iteration 69 pinned “Inner Mongolia is selected” here, which is F3: a replay that selects the region again instead of settling as the place the plan is already in: ${text(after)}`);
});

test('a list whose shape cannot be read offers the move outright and no retry it has ruled out', async () => {
  const harness = setup({ country: 'CN', locations: provinces, listFailure: SCHEMA });
  const { assistant, state, calls } = harness;
  await assistant.respond('Help me plan a rotation in China');
  mongoliaPlan(harness);
  const answer = await assistant.respond('Inner Mongolia');
  const sentence = text(answer), labels = answer.followUps.map(choice => choice.label);
  assert.match(sentence, /arrived in a shape this app cannot read/);
  assert.ok(!labels.some(label => /again/i.test(label)), `a retry the reply has just ruled out is offered anyway: ${labels.join(' | ')}`);
  assert.ok(labels.some(label => /switch to mongolia/i.test(label)), 'the way out that needs no list stays offered');
  assert.equal(state.country, 'CN');
  assert.equal(calls.filter(call => call === 'country').length, 0);
});

// The positive control that makes the case above a classification and not a blanket refusal: a farmer who names the
// move outright has said what the unread list could not settle, so the refused read must not stop it. The reply the
// switch lands on is the neutral country question at public/js/modules/workflow-assistant.js:592, which claims nothing
// about the list and keeps the button that does state the gap.
test('“switch to Mongolia” still moves the plan when the saved list refuses', async () => {
  const harness = setup({ country: 'CN', locations: provinces, listFailure: UNAVAILABLE });
  const { assistant, state, calls } = harness;
  await assistant.respond('Help me plan a rotation in China');
  mongoliaPlan(harness);
  const answer = await assistant.respond('switch to Mongolia');
  assert.equal(state.country, 'MN', 'an explicit move must not be held hostage to a place list');
  assert.ok(calls.includes('country'), 'chooseCountry never ran for the country the farmer named');
  const labels = answer.followUps.map(choice => choice.label);
  assert.match(text(answer), /Which part of Mongolia/, `the move should land on the country question: ${text(answer)}`);
  assert.ok(labels.includes('A specific area'), `the button that states the refused read is gone: ${labels.join(' | ')}`);
  const area = await click(assistant, answer, answer.followUps.findIndex(choice => choice.label === 'A specific area'));
  assert.match(text(area), /could not be read just now/, 'and the probe does name the read that failed');
});

test('a cancelled list read is a stop, not a licence to move the plan to another country', async () => {
  // No list is ever read successfully here, so the switch guard is the first thing a second cancellation reaches.
  const harness = setup({ country: 'CN', locations: provinces, listFailure: { message: 'Planning context changed', name: 'AbortError', cancelled: true } });
  const { assistant, state, calls } = harness;
  const isStop = error => error.cancelled === true && error.name === 'AbortError';
  await assert.rejects(() => assistant.respond('Help me plan a rotation in China'), isStop,
    'a cancelled read at the country question already answers as data');
  mongoliaPlan(harness);
  await assert.rejects(() => assistant.respond('Inner Mongolia'), isStop,
    'a stop the page asked for did not settle as a stop');
  assert.equal(state.country, 'CN', 'a cancelled read must move nothing');
  assert.equal(calls.filter(call => call === 'country').length, 0);
});

// The switch check awaits on its own, so it has the stale half of the same hazard: a list that answers after the
// farmer moved on must not be the thing that decides whether the plan changes country.
test('a list answering the switch check after the plan moved on stops instead of answering', async () => {
  let settle; const late = new Promise(resolve => { settle = resolve; });
  let list = provinces;
  const harness = setup({ country: 'CN', locations: () => list,
    listFailure: { message: 'The saved town list could not load.', status: 503, code: 'LOCATIONS_UNAVAILABLE' } });
  await harness.assistant.respond('Help me plan a rotation in China');
  harness.failList(null);
  list = late;
  // Said outright, so nothing else can stop the switch: if the late read is allowed to arbitrate, `chooseCountry`
  // runs and clears the plan before the next guard notices the session is gone.
  const inFlight = harness.assistant.respond('switch to Mongolia');
  await new Promise(yielded => setTimeout(yielded, 0));
  harness.assistant.invalidate();
  settle(provinces);
  await assert.rejects(() => inFlight, error => error.cancelled === true && error.name === 'AbortError',
    'a list that answered after the session moved on was allowed to arbitrate the switch');
  assert.equal(harness.state.country, 'CN', 'the stale read moved the plan after the farmer had left the session');
  assert.equal(harness.calls.filter(call => call === 'country').length, 0);
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

// The other side of the same clause: a farmer who says the move outright means the country even when the current
// list holds a region of that spelling. Without this, “resolved locally whenever a row matches” would strand it.
const georgiaCountry = { regions: [{ id: '14', name: 'Kakheti' }, { id: '65', name: 'Tbilisi' }],
  places: [{ id: 'g1', name: 'Telavi', regionCode: '14', latitude: 41.9179, longitude: 45.4741 }] };
test('“switch to Georgia” in a US plan means the country, not the Georgia region row', async () => {
  const { assistant, state, calls } = setup({ country: 'US', locations: code => (code === 'US' ? states : georgiaCountry) });
  await assistant.respond('Help me plan a rotation in the United States');
  const answer = await assistant.respond('switch to Georgia');
  assert.deepEqual({ country: state.country, regionCode: state.regionCode, location: state.location },
    { country: 'GE', regionCode: null, location: null }, 'the lead-in names the country, and a US region row must not answer for it');
  assert.ok(calls.includes('country') && !calls.includes('region'), 'chooseCountry never ran for the country the farmer named');
  assert.match(text(answer), /Which part of Georgia/, 'the plan restarts as a question about the country the farmer moved to');
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

// São Tomé and Príncipe stands for every country whose official spelling contains a saved place name.
// The plan is asking which region it covers, so the whole country name cannot be a place answer and it
// must not quietly narrow the country to the town that shares a piece of its spelling.
const saoTomeLocations = {
  regions: [{ id: 'P', name: 'Príncipe' }, { id: 'S', name: 'São Tomé' }],
  places: [{ id: 'st1', name: 'São Tomé', regionCode: 'S', latitude: 0.33616, longitude: 6.73397 },
    { id: 'st2', name: 'Neves', regionCode: 'P', latitude: 1.53667, longitude: 7.42083 }]
};

test('naming the whole country at the region question does not select the town inside that name', async () => {
  const { assistant, state } = setup({ country: 'ST', locations: saoTomeLocations });
  await assistant.respond('Help me plan a rotation in São Tomé and Príncipe');
  const area = await assistant.respond('A specific area');
  assert.match(text(area), /Which state or region of São Tomé/i, 'the pending question is about regions');
  const answer = await assistant.respond('São Tomé & Príncipe');
  assert.equal(state.location, null, 'the town São Tomé was not chosen');
  assert.equal(state.regionCode, null, 'no region was chosen either');
  assert.match(text(answer), /is the country, not one of its regions/);
  assert.ok(answer.followUps.length > 0, 'the reply still leaves something to tap');
  const chosen = await click(assistant, answer, 0);
  assert.ok(chosen);
  assert.ok(state.regionCode, 'tapping one of the offered regions advances the plan');
});

// Measured 18 Nov: a community field service that accepts the connection and never answers holds the
// lookup open for its full 75 s server deadline, and the chat awaited it before confirming the tap.
test('a town tap confirms the point instead of waiting out a field service that never answers', async () => {
  const { assistant, calls, state } = setup({ farms: 0, fieldsNeverAnswer: true, fieldsGraceMs: 25 });
  await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, bulb onion.');
  const answer = await assistant.respond('A specific area');
  const townIndex = answer.followUps.findIndex(choice => choice.workflowChoice?.type === 'town');
  assert.ok(townIndex >= 0, 'a town button was offered');
  const started = Date.now();
  const waited = await click(assistant, answer, townIndex);
  const waitedMs = Date.now() - started;
  assert.ok(state.location, 'the saved town point is not lost while the lookup is open');
  assert.ok(waitedMs < 2_000, `the town tap waited ${waitedMs} ms for a service that never answered`);
  assert.match(text(waited), /is selected as a town point/);
  assert.match(text(waited), /have not answered yet/, 'the reply says which part has not arrived');
  assert.match(text(waited), /nothing was invented/);
  assert.doesNotMatch(text(waited), /mapped fields were returned/, 'no field count is claimed before the data arrives');
  const labels = waited.followUps.map(choice => choice.label);
  assert.ok(labels.some(label => /Use selected point/.test(label)) && labels.some(label => /Show mapped fields/.test(label)),
    `the waiting reply leaves nothing to tap: ${labels.join(' | ')}`);
  // Asking again must join the request already in flight, not open a second one against the same service.
  const asked = calls.filter(call => call === 'fields').length;
  const again = await assistant.respond('Show mapped fields around this point');
  assert.equal(calls.filter(call => call === 'fields').length, asked, 'a second field request was opened while the first was still in flight');
  assert.match(text(again), /have not answered yet/);
});

// Measured 20 Nov on all four Playwright projects: when the community services refuse the lookup, step 2 catches the
// failure and `state.farms` keeps whatever it held (empty for a first ask), which the chat used to read as an answer
// and report as "0 mapped fields were returned" — a claim about the farmland near the farmer's point, drawn from a
// transport refusal, with no retry offered. tests/e2e/field-service-failure.spec.js proves that in a browser; this
// pins the same classification where no service is involved, on the structured outcome alone.
test('a town tap whose field lookup was refused reports a failure, keeps a retry and re-asks on tap', async () => {
  const { assistant, calls, state } = setup({ farms: 0, fieldsRefused: true });
  await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, bulb onion.');
  const answer = await assistant.respond('A specific area');
  const townIndex = answer.followUps.findIndex(choice => choice.workflowChoice?.type === 'town');
  assert.ok(townIndex >= 0, 'a town button was offered');
  const refused = await click(assistant, answer, townIndex);
  assert.ok(state.location, 'the saved town point is not lost when the lookup is refused');
  assert.equal(state.farms.length, 0, 'no field was invented in place of the missing list');
  assert.match(text(refused), /is selected as a town point/);
  assert.doesNotMatch(text(refused), /mapped fields were returned/, 'a lookup that never completed is not reported as a field count');
  assert.match(text(refused), /field lookup did not complete/, 'the reply says the lookup did not complete');
  assert.match(text(refused), /cannot say whether any mapped fields exist/, 'no coverage conclusion is drawn from a refusal');
  assert.match(text(refused), /no field list is shown/i);
  const labels = refused.followUps.map(choice => choice.label);
  assert.ok(labels.includes('Use selected point') && labels.includes('Show mapped fields'),
    `the failure reply leaves nothing to tap: ${labels.join(' | ')}`);
  // Unlike an open request, a finished refusal must be asked again from the start.
  const asked = calls.filter(call => call === 'fields').length;
  const again = await assistant.respond('Show mapped fields around this point');
  assert.equal(calls.filter(call => call === 'fields').length, asked + 1, 'the retry did not re-ask the field services');
  assert.doesNotMatch(text(again), /mapped fields were returned/);
  assert.match(text(again), /field lookup did not complete/);
  // The pair: the same empty list is reportable once a service has answered it.
  const answered = setup({ farms: 0 });
  await answered.assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, bulb onion.');
  const area = await answered.assistant.respond('A specific area');
  const done = await click(answered.assistant, area, area.followUps.findIndex(choice => choice.workflowChoice?.type === 'town'));
  assert.match(text(done), /0 mapped fields were returned/, 'an answered empty lookup reports its count');
  assert.doesNotMatch(text(done), /did not complete/, 'an answered lookup is not reported as a failure');
});

// Measured 20 Nov by an offline walk of the shipped assistant over the shipped location adapter
// (docs/evidence/review-goals-place-list-2026-11-20.log.gz): a saved list whose read threw landed in
// `catch { listed = null }`, and every sentence below it reads `places` as the country's contents — so a refusal
// answered "No towns are listed for <country> in this saved place list", the same country-normalized wording a list
// that genuinely answered with nothing produces, for a list that in production holds every town of the country.
// Iteration 58 recorded that exact class for the field lookup (validation.md subsection 58); this is the place half.
const UNAVAILABLE = { message: 'The saved town list could not load. Retry the country selection, search a place or use the map.',
  status: 503, code: 'LOCATIONS_UNAVAILABLE' };
const SCHEMA = { message: 'The saved town list has an invalid source format. Use place search or coordinates.',
  status: 503, code: 'LOCATIONS_SCHEMA' };

test('a saved list that could not be read says so, keeps the country and re-asks instead of caching the failure', async () => {
  const { assistant, state, listAsked, failList } = setup({ country: 'IN', locations: indiaLocations, listFailure: UNAVAILABLE });
  await assistant.respond('Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.');
  const asked = listAsked();
  assert.ok(asked > 0, 'the guided plan reads the saved list before it answers a place question');
  const area = await assistant.respond('A specific area');
  const sentence = text(area), labels = area.followUps.map(choice => choice.label);
  assert.match(sentence, /could not be read just now/, `a refusal must name the lookup that failed: ${sentence}`);
  assert.match(sentence, /cannot say which regions or towns it lists/, 'no conclusion about the list contents may be drawn');
  assert.match(sentence, /Nothing was selected and nothing was invented/);
  for (const claim of ['No towns are listed', 'no towns to choose from', 'no named regions', 'is in the saved place list'])
    assert.ok(!sentence.includes(claim), `a read that never completed is reported as a fact about the data: ${sentence}`);
  assert.equal(state.country, 'IN', 'the country the farmer chose stays selected through a failed read');
  assert.equal(state.location, null, 'a failed read must not select a place');
  assert.ok(labels.includes('Try the place list again') && labels.includes('Whole India'),
    `the refusal must offer the retry and the route that needs no list: ${labels.join(' | ')}`);
  // Tapping the retry has to send a second request: neither cache may keep a failure, or the button replays the
  // refusal it is supposed to clear.
  const retryIndex = area.followUps.findIndex(choice => choice.label === 'Try the place list again');
  const again = await click(assistant, area, retryIndex);
  assert.ok(listAsked() > asked, 'the retry did not re-read the saved list — a failure was kept as though it were a result');
  assert.match(text(again), /could not be read just now/, 'a second refusal reads the same way');
  // And once the read answers, the same tap path offers the farmer the real rows.
  failList(null);
  const healthy = await click(assistant, again, again.followUps.findIndex(choice => choice.label === 'Try the place list again'));
  const towns = healthy.followUps.filter(choice => choice.workflowChoice?.type === 'region').map(choice => choice.label);
  assert.ok(towns.includes('Maharashtra'), `a recovered list offers its saved regions again: ${towns.join(' | ')}`);
  assert.doesNotMatch(text(healthy), /could not be read/);
});

test('a list that arrives unreadable reports its own reason and offers no retry that cannot help', async () => {
  const { assistant, listAsked } = setup({ country: 'IN', locations: indiaLocations, listFailure: SCHEMA });
  await assistant.respond('Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.');
  const asked = listAsked();
  const area = await assistant.respond('A specific area');
  const sentence = text(area), labels = area.followUps.map(choice => choice.label);
  assert.match(sentence, /arrived in a shape this app cannot read/);
  assert.match(sentence, /asking again cannot change a source format/);
  assert.ok(!sentence.includes('No towns are listed'), `an unreadable shape is still not a finding about the towns: ${sentence}`);
  assert.ok(!labels.includes('Try the place list again'), `a retry the reply has just ruled out is offered anyway: ${labels.join(' | ')}`);
  assert.ok(labels.includes('Whole India'), 'the route that needs no saved list stays available');
  assert.equal(listAsked(), asked + 1, 'one read per ask, and no second read to compose the reply');
});

// The pair that makes the branch above a classification and not a blanket refusal: a list that answered with no
// rows keeps the wording that is true of it, and a cancellation is not a failed read at all.
test('an answered empty list keeps its wording and a cancelled read is never answered as data', async () => {
  const empty = setup({ country: 'IN', locations: { regions: [], places: [] } });
  await empty.assistant.respond('Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.');
  const area = await empty.assistant.respond('A specific area');
  assert.match(text(area), /No towns are listed/, 'a list that answered with nothing may say so');
  assert.doesNotMatch(text(area), /could not be read/);
  const cancelled = setup({ country: 'IN', locations: indiaLocations, listFailure: { message: 'Planning context changed', name: 'AbortError', cancelled: true } });
  await assert.rejects(cancelled.assistant.respond('Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.'),
    error => error.cancelled === true && error.name === 'AbortError',
    'a stop the page asked for must settle as a stop, not as a reply about the farmer\'s country');
  assert.equal(cancelled.state.location, null, 'a cancelled read must select nothing on the way out');
});

// Iteration 62, goal 6. public/js/modules/chat.js:93 lifts the armed `workflowChoice` out of `pendingChoice` before the
// await, and its catch at :154-157 writes the sentence back to the composer and not the choice - so a tapped button
// whose send rejects comes back as a typed message. scripts/place-choice-loss-census.mjs measured what that costs over
// every saved list: 27 of 1,683 town taps land on a different branch, 7 of them on another region's towns, because a
// town button says "Use <name>" and only its id says which row. The case below pins why the page does not reach that
// state today: a place button a farmer can tap never re-reads the saved list, so there is no uncaught read left on the
// tap and the ask settles as a reply rather than a rejection. It goes red the moment a tap starts depending on a live
// read, which is exactly when the restore asymmetry stops being theoretical and the pair has to be restored together.
test('a tapped place choice answers without re-reading the list, whatever the place service does afterwards', async () => {
  const { assistant, state, listAsked, failList } = setup({ country: 'IN', locations: indiaLocations });
  await assistant.respond('Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.');
  const area = await assistant.respond('A specific area');
  const asked = listAsked();
  assert.ok(asked > 0, 'the buttons below are built from a saved list the plan actually read');
  // From here every saved-list read refuses, and any other path the harness is asked for throws already.
  failList(UNAVAILABLE);
  const indexOf = (answer, type) => answer.followUps.findIndex(choice => choice.workflowChoice?.type === type);
  const region = await click(assistant, area, area.followUps.findIndex(choice => choice.label === 'Maharashtra'));
  assert.equal(listAsked(), asked, 'the tapped region was looked up again instead of read from the list its buttons came from');
  assert.match(text(region), /Maharashtra is selected\. Now choose a town/);
  const town = await click(assistant, region, indexOf(region, 'town'));
  assert.equal(listAsked(), asked, 'the tapped town re-read the saved list');
  assert.ok(state.location, 'the town point the tap chose is in place');
  assert.match(text(town), /Pune is selected as a town point/);
  const fieldTap = indexOf(town, 'farm');
  assert.ok(fieldTap >= 0, `the town tap left no mapped field to tap: ${town.followUps.map(choice => choice.label).join(' | ')}`);
  const field = await click(assistant, town, fieldTap);
  assert.equal(listAsked(), asked, 'the tapped field re-read the saved list');
  assert.ok(state.farm, 'the field the tap chose is selected');
  for (const answer of [region, town, field]) {
    assert.ok(answer, 'a tapped place choice answered');
    assert.doesNotMatch(text(answer), /could not be read|did not complete/, 'a tap that needed no read is not reported as a failed one');
  }
});

// Iteration 65, queue item F5. A sentence that names coordinates reads the saved list a second time to cross-check
// them, and until this iteration that second read sat outside any try/catch. It was also unreachable except as a
// retry of a refusal: `getLocationList` stores the body a successful read returned, so the only way the coordinate
// branch met a cache miss is the guarded shared read having failed just above it. The farmer then met the refusal
// twice in one sentence, and the second one escaped `respond()` as a raw error after `chooseCountry` had already
// moved the plan. Measured on the iteration-64 tip by
// docs/evidence/iter65-f5-coord-refused-recheck-2026-11-20.log.gz, which walked the shipped module over the shipped
// adapter and recorded asks `/api/locationsIN`, `/api/places`, `/api/locationsIN`, calls `["country"]`,
// state `{"country":"IN","location":null}` and outcome `{"threw":"Error: The saved place list could not
// load.","cancelled":false}`.
const COORD = 'Help me plan a rotation in India at 18.52, 73.85. Crops: rice, wheat, beans. Rainfed';
const MAHARASHTRA_REVERSE = { places: [{ countryCode: 'IN', region: 'Maharashtra' }] };

test('a coordinate sentence whose saved list refused answers instead of throwing out of respond()', async () => {
  const { assistant, calls, state, listAsked, reverseAsked } = setup({ country: 'IN', locations: indiaLocations, listFailure: UNAVAILABLE, reverse: MAHARASHTRA_REVERSE });
  let thrown = null, answer = null;
  try { answer = await assistant.respond(COORD); } catch (error) { thrown = error; }
  assert.equal(thrown, null, `a refused saved list left the farmer a raw error instead of a reply: ${thrown?.message}`);
  const sentence = text(answer), labels = answer.followUps.map(choice => choice.label);
  assert.match(sentence, /saved place list for India could not be read just now/, `the reply must name the read that failed: ${sentence}`);
  assert.match(sentence, /18\.52, 73\.85/, 'the coordinates the farmer typed have to be quoted back, not silently dropped');
  assert.match(sentence, /India is the country this plan is in/, 'the country the sentence moved the plan to is a fact the reply may keep');
  assert.ok(reverseAsked().length, 'the reply is only honest about the country if the reverse lookup really ran');
  for (const claim of ['is selected', 'No towns are listed', 'no towns to choose from', 'verified'])
    assert.ok(!sentence.includes(claim), `a read that never completed became a finding about the list: ${sentence}`);
  assert.equal(state.location, null, 'a point this app could not cross-check was accepted anyway');
  assert.equal(state.country, 'IN');
  assert.deepEqual(calls, [], `a refusal this early in the sentence may select nothing at all: ${calls.join(' → ')}`);
  assert.equal(listAsked(), 1, 'the refusal was asked twice inside one sentence');
  assert.ok(labels.includes('Ask that again'), `the sentence has to be replayable once the list answers: ${labels.join(' | ')}`);
  assert.ok(labels.includes('Whole India'), 'the route that needs no saved list stays offered');
});

// The same branch reached by a list whose rows arrived unreadable: a second request cannot fix a source format, so
// this arm keeps the reason and drops the retry, exactly as placeListFailure does for the area path.
test('a coordinate sentence against an unreadable list shape reports its own reason and offers no retry', async () => {
  const { assistant, state, listAsked } = setup({ country: 'IN', locations: indiaLocations, listFailure: SCHEMA, reverse: MAHARASHTRA_REVERSE });
  let thrown = null, answer = null;
  try { answer = await assistant.respond(COORD); } catch (error) { thrown = error; }
  assert.equal(thrown, null, 'an unreadable shape is a reportable failure, not an exception');
  const sentence = text(answer), labels = answer.followUps.map(choice => choice.label);
  assert.match(sentence, /arrived in a shape this app cannot read/);
  assert.match(sentence, /asking again cannot change a source format/);
  assert.ok(!labels.includes('Ask that again'), `a retry the reply has just ruled out is offered anyway: ${labels.join(' | ')}`);
  assert.equal(state.location, null);
  assert.equal(listAsked(), 1, 'one read per sentence, whatever the failure');
});

// The pair that makes the reply above a report and not a dead end: with the list answering again, the same sentence
// sets the same point. A refusal may never be kept as though it were the country's contents.
test('the coordinate sentence sets the point as soon as the saved list answers again', async () => {
  const { assistant, state, listAsked, failList } = setup({ country: 'IN', locations: indiaLocations, listFailure: UNAVAILABLE, reverse: MAHARASHTRA_REVERSE });
  const refused = await assistant.respond(COORD);
  assert.match(text(refused), /could not be read just now/);
  failList(null);
  const answer = await assistant.respond(COORD);
  assert.ok(state.location, 'the replayed sentence still found no point');
  assert.equal(state.location.latitude, 18.52);
  assert.equal(state.location.longitude, 73.85);
  assert.doesNotMatch(text(answer), /could not be read/, 'a read that answered is not reported as a failure');
  assert.equal(listAsked(), 2, 'each sentence reads the saved list once: ' + listAsked());
});

// Held across the fix: a sentence that names a point a readable list can cross-check keeps working, and the readable
// list is read once per sentence rather than once per branch.
test('a coordinate sentence reads the saved list once and sets the point it cross-checked', async () => {
  const { assistant, calls, state, listAsked } = setup({ country: 'IN', locations: indiaLocations, reverse: MAHARASHTRA_REVERSE });
  const answer = await assistant.respond(COORD);
  assert.equal(listAsked(), 1, 'the coordinate branch re-read a list this sentence already read');
  assert.ok(state.location);
  assert.equal(state.location.latitude, 18.52);
  assert.equal(state.location.longitude, 73.85);
  assert.equal(state.location.placeId, undefined, 'a typed point stays a point, not the nearest saved row');
  assert.doesNotMatch(text(answer), /could not be read|arrived in a shape/);
  assert.ok(calls.includes('location'), 'the cross-checked point is the selection the plan carries');
});

// And a cancellation stays a cancellation: the fix must not swallow the stop the page asked for into a reply about
// the farmer's own coordinates.
test('a coordinate sentence cancelled during the list read stops as a cancellation', async () => {
  const { assistant, state, listAsked } = setup({ country: 'IN', locations: indiaLocations,
    listFailure: { message: 'Planning context changed', name: 'AbortError', cancelled: true }, reverse: MAHARASHTRA_REVERSE });
  await assert.rejects(assistant.respond(COORD), error => error.cancelled === true && error.name === 'AbortError',
    'a stopped sentence must settle as a stop, not as an answer');
  assert.equal(state.location, null, 'a cancelled read must select no point on the way out');
  assert.equal(listAsked(), 1, 'a cancelled read was retried inside the same sentence');
});

// The journey shape the probe recorded: one sentence moves the plan into another country and names a point there, and
// the country it moves into is the one whose list refuses. `chooseCountry` has already run by then, so the reply keeps
// that fact, states that the point was not accepted, and cannot say nothing was selected.
test('a coordinate sentence that moved the plan into a country whose list refused reports the half-moved state', async () => {
  const { assistant, calls, state, listAsks } = setup({ country: 'SG',
    locations: code => code === 'IN' ? indiaLocations : sgLocations,
    listFailure: code => code === 'IN' ? UNAVAILABLE : null, reverse: MAHARASHTRA_REVERSE });
  let thrown = null, answer = null;
  try { answer = await assistant.respond(COORD); } catch (error) { thrown = error; }
  assert.equal(thrown, null, `the plan was left half-moved with no answer: ${thrown?.message}`);
  const sentence = text(answer);
  assert.match(sentence, /saved place list for India could not be read just now/, sentence);
  assert.match(sentence, /India is the country this plan is in/, 'the move that did happen has to be stated, not hidden');
  assert.ok(!sentence.includes('Nothing was selected'), `a country really did change: ${sentence}`);
  assert.equal(state.country, 'IN', 'the country the farmer named stays where the sentence moved it');
  assert.equal(state.location, null, 'only the point is withheld, because only the point could not be cross-checked');
  assert.deepEqual(calls, ['country'], 'the sentence may change the country and nothing else: ' + calls.join(' → '));
  assert.deepEqual(listAsks(), ['SG', 'IN'], 'the switch check and the shared read, one each: ' + listAsks().join(','));
});

// Iteration 70, queue item F3. The refusal above promises that “no region, point or loaded evidence was dropped”, and
// the recovery it offers replays the farmer’s own words. Measured 21 Nov on the tree that shipped iteration 69
// (artifacts/scratch/iter70/f3-replay-probe.mjs, archived as docs/evidence/iter70-f3-replay-probe-2026-11-21.log.gz):
// the replay reached the region branch with that sentence, called `chooseRegion` with the id the plan already held, and
// the harness’s own clear-on-region-select (the same clearing `public/js/modules/context.js:237` performs through
// `locationChanged`) dropped the Hohhot point while the reply said “Inner Mongolia is selected. Now choose a town…”.
// One thing had moved after a reply that promised nothing had: the town went unselected again. The cause is the
// `&& !state.location` clause on that revision’s guard at `public/js/modules/workflow-assistant.js:567`, which excluded
// exactly the state a point is held in, so the rule the row resolver keeps at `:683` (“a region row equal to the region
// already selected answers no pending question”) never reached it.
test('the replay of a refused switch keeps the point the refusal promised to keep', async () => {
  const harness = setup({ country: 'CN', locations: provinces, listFailure: UNAVAILABLE });
  const { assistant, state, calls, failList } = harness;
  await assistant.respond('Help me plan a rotation in China');
  const before = mongoliaPlan(harness);
  const answer = await assistant.respond('Inner Mongolia');
  failList(null);
  calls.length = 0;
  const after = await click(assistant, answer, answer.followUps.findIndex(choice => /again/i.test(choice.label)));
  const sentence = text(after), labels = answer.followUps.map(choice => choice.label);
  assert.deepEqual(calls.filter(call => call === 'region'), [], 'the replay re-selected a region the plan already held');
  const held = { country: state.country, regionCode: state.regionCode, place: state.location?.placeId, observations: state.observations };
  assert.deepEqual(held, { country: before.country, regionCode: before.regionCode, place: before.place,
    observations: before.observations }, 'the replayed sentence changed the selection the refusal said it left alone');
  assert.match(sentence, /Inner Mongolia is the region this plan is already in/, sentence);
  assert.match(sentence, /40\.8494, 111\.6649/, 'the point that stays has to be the one the farmer can still see in step 1');
  assert.ok(!/^Inner Mongolia is selected/.test(sentence), `the replay answers as if nothing were selected: ${sentence}`);
  assert.ok(labels.includes('Ask that again'), 'the refusal still offers this replay');
  assert.deepEqual(towns(after).map(choice => choice.label), ['Hohhot', 'Baotou'], 'the towns of the region stay the way forward');
});

// The same branch with no refusal behind it: any farmer who types the name of the region they already sit in while a
// point is held loses that point today, so the fix is not a replay special case.
test('repeating the chosen region’s name with a point held selects nothing and states what stays', async () => {
  const harness = setup({ country: 'CN', locations: provinces });
  const { assistant, state, calls } = harness;
  await assistant.respond('Help me plan a rotation in China');
  const before = mongoliaPlan(harness);
  calls.length = 0;
  const answer = await assistant.respond('Inner Mongolia');
  assert.deepEqual(calls.filter(call => call === 'region'), [], 'a region already chosen was selected a second time');
  assert.deepEqual({ regionCode: state.regionCode, place: state.location?.placeId, observations: state.observations },
    { regionCode: before.regionCode, place: before.place, observations: before.observations }, 'the held point moved');
  const sentence = text(answer);
  assert.match(sentence, /is the region this plan is already in/, sentence);
  assert.match(sentence, /nothing was selected again/, sentence);
  const labels = answer.followUps.map(choice => choice.label);
  assert.ok(labels.includes('Continue planning with this location'), `the reply must offer the step the held point unlocks: ${labels.join(' | ')}`);
  assert.ok(labels.includes('Whole China'), `the escape that needs no region stays: ${labels.join(' | ')}`);
});

// Two controls that keep the fix a scope limit rather than a refusal to name a region.
test('a region named while the point sits in another region is still that region choice', async () => {
  const { assistant, state, calls } = setup({ country: 'CN', locations: provinces });
  await assistant.respond('Help me plan a rotation in China');
  state.regionCode = '13';
  state.location = { latitude: 38.0428, longitude: 114.5149, placeId: 'n3' };
  calls.length = 0;
  const answer = await assistant.respond('Inner Mongolia');
  assert.ok(calls.includes('region'), 'a different region has to be selectable over a held point');
  assert.equal(state.regionCode, '20');
  assert.match(text(answer), /^Inner Mongolia is selected/, text(answer));
});

// And the half the row resolver at `:683` already does: where the region spelling is also a listed town, the town wins
// over both a re-selection and the “already here” reply.
test('a region name that is also a listed town resolves to that town while a point is held', async () => {
  const towns = { regions: provinces.regions,
    places: [{ id: 'z9', name: 'Inner Mongolia', regionCode: '13', latitude: 39.1, longitude: 115.2 }, ...provinces.places] };
  const harness = setup({ country: 'CN', locations: towns });
  const { assistant, state, calls } = harness;
  await assistant.respond('Help me plan a rotation in China');
  state.regionCode = '20';
  state.location = { latitude: 40.8494, longitude: 111.6649, placeId: 'n1' };
  calls.length = 0;
  const answer = await assistant.respond('Inner Mongolia');
  assert.deepEqual(calls.filter(call => call === 'region'), [], 'the region was re-selected instead of the town');
  assert.equal(state.location.placeId, 'z9', 'the listed town carrying the name is the choice');
  assert.match(text(answer), /is selected as a town point/, text(answer));
});

// The unchanged half: with no point held the reply is still the honest “no town by that name here”.
test('repeating the chosen region with no point still answers the town question', async () => {
  const { assistant, state, calls } = setup({ country: 'CN', locations: provinces });
  await assistant.respond('Help me plan a rotation in China');
  state.regionCode = '20';
  calls.length = 0;
  const answer = await assistant.respond('Inner Mongolia');
  assert.deepEqual(calls.filter(call => call === 'region'), [], 'a region already chosen was selected a second time');
  assert.equal(state.regionCode, '20');
  assert.match(text(answer), /^No town by that name is in the saved place list for China in Inner Mongolia/, text(answer));
});
