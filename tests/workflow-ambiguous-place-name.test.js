import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// Iteration 69, queue item F9. A farmer who has chosen a country and then types a town name that the saved list carries
// more than once was answered nothing at all. exactPlaceRow (public/js/modules/workflow-assistant.js) returns a row only
// when one town row or one region row claims the folded spelling, so with five Athens rows it answered null, the guided
// branch never ran because no plan was open, and respond() returned null: the page fell to the read-only answer.
// artifacts/scratch/iter69/f9-probe.mjs records that reading against the delivered build (arm AMBIGUOUS:
// answered=no asks=1 calls=[] location=none) over the rows the country's own JSON holds, measured by
// artifacts/scratch/iter69/name-counts.mjs: Argentina lists San Vicente three times (Buenos Aires once, Misiones twice)
// with no region row of that name, and the United States lists Athens five times (GA, OH, TN, TX, AL). Mid-plan the same
// sentence already gets the selector — tests/matrix-coverage.test.js walks it in over 20 countries — so what was missing
// is the shape this file pins: the name typed before any plan is open.
//
// Every id, coordinate and region name below is copied from public/data/locations/<CC>.json; the invented part is only
// that the fixtures hold a subset of each country's rows.
const arLocations = {
  regions: [{ id: '01', name: 'Buenos Aires' }, { id: '14', name: 'Misiones' }],
  places: [
    { id: '3428067', name: 'San Vicente', regionCode: '01', latitude: -35.0249, longitude: -58.42409 },
    { id: '3428068', name: 'San Vicente', regionCode: '14', latitude: -26.61667, longitude: -54.13333 },
    { id: '12035902', name: 'San Vicente', regionCode: '14', latitude: -26.99627, longitude: -54.47697 }
  ]
};
const usLocations = {
  regions: [{ id: 'GA', name: 'Georgia' }, { id: 'OH', name: 'Ohio' }, { id: 'TN', name: 'Tennessee' },
    { id: 'TX', name: 'Texas' }, { id: 'AL', name: 'Alabama' }],
  places: [
    { id: '4180386', name: 'Athens', regionCode: 'GA', latitude: 33.96095, longitude: -83.37794 },
    { id: '4505542', name: 'Athens', regionCode: 'OH', latitude: 39.32924, longitude: -82.10126 },
    { id: '4603284', name: 'Athens', regionCode: 'TN', latitude: 35.44285, longitude: -84.59299 },
    { id: '4671545', name: 'Athens', regionCode: 'TX', latitude: 32.20487, longitude: -95.85552 },
    { id: '4830668', name: 'Athens', regionCode: 'AL', latitude: 34.80243, longitude: -86.97219 },
    // One row, the shape that has to stay a silent selection: a name the list carries once must not start a conversation.
    { id: '4189423', name: 'Cordele', regionCode: 'GA', latitude: 31.96351, longitude: -83.78239 },
    { id: '5407841', name: 'West Athens', regionCode: 'CA', latitude: 33.92335, longitude: -118.30341 }
  ]
};
// Costa Rica is the collision the region rule exists for: “San José” is province 08 and two towns, and the province wins.
const crLocations = {
  regions: [{ id: '01', name: 'Alajuela Province' }, { id: '08', name: 'San José' }],
  places: [
    { id: '3621841', name: 'San José', regionCode: '01', latitude: 10.95192, longitude: -85.13572 },
    { id: '3621849', name: 'San José', regionCode: '08', latitude: 9.93388, longitude: -84.08489 }
  ]
};

function setup({ country = 'AR', locations = arLocations } = {}) {
  const calls = [], listAsks = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country: country ?? 'ZZ' }), farm: null, farms: [],
    regionCode: null, location: null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: [], irrigation: 'unknown', soil: 'unknown', startMonth: 1, planningYear: 2026, referenceYear: 2025 } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); },
    // The delivered form clears the point when the region changes, which is why an ambiguous name must never move it.
    chooseRegion(id) { calls.push('region'); state.regionCode = id; state.location = null; state.farm = null; },
    chooseLocation(place) { calls.push('location'); state.location = { latitude: place.latitude, longitude: place.longitude, placeId: place.id }; },
    loadFarms() { return []; },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning() { calls.push('inputs'); }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions,
    request: async path => {
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/locations') { listAsks.push(url.searchParams.get('country')); return locations; }
      throw new Error('unexpected test request ' + path);
    } });
  return { assistant, calls, state, listAsked: () => listAsks.length };
}

const text = answer => (answer?.blocks ?? []).map(block => block.text).join(' ');
const townChoices = answer => (answer?.followUps ?? []).filter(choice => choice.workflowChoice?.type === 'town');

test('a town name the saved list carries three times asks which one instead of answering nothing', async () => {
  const { assistant, calls, state, listAsked } = setup();
  assert.equal(assistant.isActive(), false, 'the harness starts with no guided plan, which is the shape the probe measured');
  const answer = await assistant.respond('San Vicente');
  assert.ok(answer, 'respond() returned nothing, so the page answers the town name as a crop question');
  assert.match(text(answer), /Several listed towns match/i, `the reply does not say the name is ambiguous: ${text(answer)}`);
  assert.match(text(answer), /which one/i, `the reply does not ask the farmer to pick: ${text(answer)}`);
  assert.equal(townChoices(answer).length, 3, `the reply offered ${townChoices(answer).length} rows of the three the list holds: ${JSON.stringify((answer?.followUps ?? []).map(c => c.label))}`);
  assert.deepEqual(townChoices(answer).map(choice => choice.workflowChoice.id).sort(), ['12035902', '3428067', '3428068'],
    'the buttons are the rows the source holds, by their saved ids');
  // Nothing may be chosen for the farmer: selecting one of three same-named towns would put the plan on a point the
  // farmer never picked, and the form clears a held point when the region changes.
  assert.deepEqual(calls, [], `an ambiguous name moved the form by: ${JSON.stringify(calls)}`);
  assert.equal(state.location, null, 'no point was set');
  assert.equal(state.regionCode, null, 'no region was selected');
  assert.equal(assistant.isActive(), true, 'the plan is open and waiting for the pick, as it is for an unambiguous name');
  assert.equal(listAsked(), 1, 'the decision costs exactly one saved-list read');
});

test('tapping one of the offered rows sets that row’s own point, not the first match', async () => {
  const { assistant, calls, state } = setup();
  const answer = await assistant.respond('San Vicente');
  assert.ok(answer, 'the ambiguous name was not answered, so there is nothing to tap');
  const offered = townChoices(answer);
  const picked = offered.find(choice => choice.workflowChoice.id === '12035902');
  assert.ok(picked, `the row the list holds twice inside Misiones is not offered: ${JSON.stringify(offered.map(c => c.label))}`);
  const tapped = await assistant.respond(picked.question, picked.workflowChoice);
  assert.ok(tapped, 'tapping an offered town answered nothing');
  assert.deepEqual({ latitude: state.location?.latitude, longitude: state.location?.longitude },
    { latitude: -26.99627, longitude: -54.47697 }, 'the point set is the tapped row’s, not the first same-named row’s');
  assert.equal(state.location?.placeId, '12035902', 'the saved row the farmer picked is recorded');
  assert.match(text(tapped), /San Vicente is selected as a town point/i, `the confirmation does not name the town: ${text(tapped)}`);
  assert.ok(calls.includes('location'), `the town tap never reached the form: ${JSON.stringify(calls)}`);
});

test('a name the list carries five times says how many it is hiding', async () => {
  const { assistant, state } = setup({ country: 'US', locations: usLocations });
  const answer = await assistant.respond('Athens');
  assert.ok(answer, 'respond() returned nothing for the five US towns called Athens');
  assert.match(text(answer), /showing 3 of 5/, `the reply hides the size of the set: ${text(answer)}`);
  assert.equal(townChoices(answer).length, 3, 'only three buttons are offered at a time');
  assert.equal(state.location, null, 'no Athens was picked');
});

test('two rows sharing a name and a region are told apart by their saved coordinates', async () => {
  // placeLabel gives both Misiones rows “San Vicente · Misiones”, and two identically worded buttons for two points
  // 60 km apart cannot be chosen between, so the selector appends the coordinates the source holds.
  const { assistant } = setup();
  const answer = await assistant.respond('San Vicente');
  assert.ok(answer, 'the ambiguous name was not answered');
  const labels = townChoices(answer).map(choice => choice.label);
  assert.equal(new Set(labels).size, labels.length, `two buttons carry the same wording: ${JSON.stringify(labels)}`);
  const misiones = labels.filter(label => /Misiones/.test(label));
  assert.equal(misiones.length, 2, `the two Misiones rows are not both offered: ${JSON.stringify(labels)}`);
  assert.ok(misiones.every(label => /-?\d+(\.\d+)?, -?\d+(\.\d+)?/.test(label)),
    `same-region rows are not separated by coordinates: ${JSON.stringify(misiones)}`);
});

test('a single row of that name is still selected without a question', async () => {
  const { assistant, calls, state, listAsked } = setup({ country: 'US', locations: usLocations });
  const answer = await assistant.respond('Cordele');
  assert.ok(answer, 'an unambiguous town name went unanswered');
  assert.doesNotMatch(text(answer), /Several listed towns match/i, `a one-row name was treated as ambiguous: ${text(answer)}`);
  assert.deepEqual({ latitude: state.location?.latitude, longitude: state.location?.longitude },
    { latitude: 31.96351, longitude: -83.78239 }, 'the town the farmer named is the point set');
  assert.deepEqual(calls, ['location', 'step:location'], `the form was moved by: ${JSON.stringify(calls)}`);
  assert.equal(listAsked(), 1, 'one read decides');
});

test('a name that is also one region row still selects the region', async () => {
  // Costa Rica lists the province San José (08) and two towns of that name. Region precedence is delivered behaviour and
  // the ambiguity rule must sit behind it, not in front; the probe records this arm as answered=yes calls=[region].
  const { assistant, calls, state } = setup({ country: 'CR', locations: crLocations });
  const answer = await assistant.respond('San José');
  assert.ok(answer, 'the collision name went unanswered');
  assert.doesNotMatch(text(answer), /Several listed towns match/i, `the region row lost to the town rows: ${text(answer)}`);
  assert.equal(state.regionCode, '08', 'the province the farmer named is the one selected');
  assert.deepEqual(calls, ['region'], `the form was moved by: ${JSON.stringify(calls)}`);
});

test('a longer row that contains an ambiguous name is still one row', async () => {
  // West Athens is a real California row and Athens is a five-row name. A fix that widened the comparison to containment
  // would make the one-row name ambiguous, so the rule stays exact-fold equality: this selects the row and asks nothing.
  const { assistant, calls, state } = setup({ country: 'US', locations: usLocations });
  const answer = await assistant.respond('West Athens');
  assert.ok(answer, 'the row the list carries once was not selected');
  assert.doesNotMatch(text(answer), /Several listed towns match/i, `the four-letter name inside it was pulled in: ${text(answer)}`);
  assert.deepEqual({ latitude: state.location?.latitude, longitude: state.location?.longitude },
    { latitude: 33.92335, longitude: -118.30341 }, 'the California point is the one set');
  assert.deepEqual(calls, ['location', 'step:location'], `the form was moved by: ${JSON.stringify(calls)}`);
});

test('a name the list does not carry still reaches the read-only answer', async () => {
  const { assistant, state, listAsked } = setup({ country: 'US', locations: usLocations });
  const answer = await assistant.respond('Atlantis');
  assert.equal(answer, null, 'an unknown word must not open a plan on a place the source does not list');
  assert.equal(state.location, null, 'nothing was selected');
  assert.equal(assistant.isActive(), false, 'no plan was opened');
  assert.equal(listAsked(), 1, 'the list is what decides, so the read has to have happened');
});

test('a point the farmer already chose survives an ambiguous name and costs no read', async () => {
  const { assistant, calls, state, listAsked } = setup({ country: 'US', locations: usLocations });
  state.location = { latitude: 42, longitude: -93.69, placeId: 'typed' };
  const answer = await assistant.respond('Athens');
  assert.equal(answer, null, 'adopting the name would clear the coordinates the farmer entered, so the chat leaves the plan closed');
  assert.deepEqual(calls, [], `the held point was touched by: ${JSON.stringify(calls)}`);
  assert.deepEqual({ latitude: state.location.latitude, longitude: state.location.longitude }, { latitude: 42, longitude: -93.69 },
    'the farmer’s point is where it was');
  assert.equal(listAsked(), 0, 'a held point is answered without reading the list');
});

test('an ambiguous name inside a region the farmer already holds also asks which one', async () => {
  // Both rows are in Misiones, so this is the same rule reached through the region filter rather than country-wide. The
  // guided path has always answered it; the point here is that the fix does not answer it only for the no-region shape.
  const { assistant, calls, state, listAsked } = setup();
  state.regionCode = '14';
  const answer = await assistant.respond('San Vicente');
  assert.ok(answer, 'the in-region ambiguous name was dropped');
  assert.match(text(answer), /Several listed towns match/i, `the reply does not say the name is ambiguous: ${text(answer)}`);
  assert.equal(townChoices(answer).length, 2, `both Misiones rows should be offered: ${JSON.stringify((answer?.followUps ?? []).map(c => c.label))}`);
  assert.equal(state.location, null, 'no point was chosen for the farmer');
  assert.deepEqual(calls, [], `the form was moved by: ${JSON.stringify(calls)}`);
  assert.equal(listAsked(), 1, 'one read decides');
});
