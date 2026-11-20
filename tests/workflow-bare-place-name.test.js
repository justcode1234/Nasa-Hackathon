import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// Iteration 66, queue item F1. A farmer who has chosen a country in step 1 and then types a bare place name into the
// assistant was told about crops: parseWorkflowMessage answers only sentences that already look like planning, so the
// message reached respond() as `parsed === null`, and the one check that could have recognised it — the saved list at
// exactPlaceRow — sits behind `active` and never ran. docs/evidence/iter66-f1-page-probe-2026-11-20.log.gz records
// what the page then rendered for the two countries this harness copies: “I could not match that crop to a sourced
// entry for Georgia.” with no button at all, and “I could not match that crop to a sourced entry for Mongolia.” for
// “Inner Mongolia”. The same sentence typed one message after “Help me plan a rotation in the United States” selects
// the region, because by then a plan is open.
const usLocations = {
  regions: [{ id: 'GA', name: 'Georgia' }, { id: 'IA', name: 'Iowa' }],
  places: [
    { id: 'u1', name: 'Athens', regionCode: 'GA', latitude: 33.95, longitude: -83.38 },
    { id: 'u2', name: 'Cordele', regionCode: 'GA', latitude: 31.96, longitude: -83.78 },
    { id: 'u3', name: 'Atlantic', regionCode: 'IA', latitude: 41.4, longitude: -95.02 }
  ]
};

function setup({ country = 'US', locations = usLocations } = {}) {
  const calls = [], listAsks = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country: country ?? 'ZZ' }), farm: null, farms: [],
    regionCode: null, location: null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: [], irrigation: 'unknown', soil: 'unknown', startMonth: 1, planningYear: 2026, referenceYear: 2025 } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); },
    // The delivered form clears the point when the region changes, which is why a name typed while the farmer already
    // holds a point must not be adopted silently.
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
const labels = answer => (answer?.followUps ?? []).map(choice => choice.label);

test('a bare region name typed with no plan open selects the region instead of answering a crop question', async () => {
  const { assistant, calls, state, listAsked } = setup();
  assert.equal(assistant.isActive(), false, 'the harness starts with no guided plan, which is the state the page probe measured');
  const answer = await assistant.respond('Georgia');
  assert.ok(answer, 'respond() returned nothing, so the page answers the place name as a crop question');
  assert.match(text(answer), /Georgia is selected/, `the reply does not say which place it took: ${text(answer)}`);
  assert.equal(state.regionCode, 'GA', 'the saved region row the farmer named is what got selected');
  assert.equal(assistant.isActive(), true, 'naming a place opens the guided plan, exactly as it does mid-plan');
  assert.ok(labels(answer).length, `the reply offers a way on: ${JSON.stringify(labels(answer))}`);
  // Exactly one form control moves: the region. A name that is also a country (“Georgia” is ISO GE) must not switch
  // the plan's country, clear a point or jump the farmer to another step.
  assert.deepEqual(calls, ['region'], `the form was moved by: ${JSON.stringify(calls)}`);
  assert.equal(listAsked(), 1, 'the decision costs exactly one saved-list read');
});

test('a bare town name typed with no plan open sets that town point', async () => {
  const { assistant, state } = setup();
  const answer = await assistant.respond('Athens');
  assert.ok(answer, 'respond() returned nothing for a town that is in the saved list');
  assert.match(text(answer), /Athens is selected/, `the reply does not name the town: ${text(answer)}`);
  assert.deepEqual(state.location && { latitude: state.location.latitude, longitude: state.location.longitude },
    { latitude: 33.95, longitude: -83.38 }, 'the point the farmer named is the saved row’s point');
});

test('a knowledge question with a country held opens no plan and selects nothing', async () => {
  for (const sentence of ['Why is cassava unavailable in the United States?', 'How much rain fell last year?']) {
    const { assistant, state, calls, listAsked } = setup();
    const answer = await assistant.respond(sentence);
    assert.equal(answer, null, `"${sentence}" is not a planning request, but respond() claimed it: ${text(answer)}`);
    assert.equal(assistant.isActive(), false, `"${sentence}" opened a guided plan`);
    assert.deepEqual(calls, [], `"${sentence}" moved the form`);
    assert.equal(state.regionCode, null, `"${sentence}" changed the selected region`);
    // One bounded read at most: the row check is what decides whether a sentence names a place, so a question-shaped
    // name cannot be vetoed by its wording (“Can Tho City”), and the answer to these stays the read-only one.
    assert.ok(listAsked() <= 1, `"${sentence}" cost ${listAsked()} saved-list reads`);
  }
});

test('a greeting and a stop word are never read as place names, and cost no saved-list read', async () => {
  for (const sentence of ['hi', 'hello', 'cancel', 'stop']) {
    const { assistant, state, calls, listAsked } = setup();
    const answer = await assistant.respond(sentence);
    assert.equal(answer, null, `"${sentence}" was answered as planning: ${text(answer)}`);
    assert.equal(assistant.isActive(), false, `"${sentence}" opened a guided plan`);
    assert.deepEqual(calls, [], `"${sentence}" moved the form`);
    assert.equal(listAsked(), 0, `"${sentence}" spent a saved-list read looking for a place`);
    assert.equal(state.regionCode, null, `"${sentence}" selected a region`);
  }
});

test('a row name that opens like a question is selectable with no plan open', async () => {
  // Can Tho is a real region row in Vietnam’s saved list, spelled so that its first word is a modal verb. It is the
  // counter-example that keeps the rule above wording-blind: tests/matrix-coverage.test.js walks every saved region
  // name and tests/workflow-place-choices.test.js pins this one mid-plan; this is the same name with no plan open.
  const vnLocations = { regions: [{ id: 'CT', name: 'Can Tho City' }],
    places: [{ id: 'v1', name: 'Ninh Kieu', regionCode: 'CT', latitude: 10.03, longitude: 105.78 }] };
  const { assistant, state } = setup({ country: 'VN', locations: vnLocations });
  const answer = await assistant.respond('Can Tho City');
  assert.match(text(answer), /Can Tho City is selected/, `the question-shaped row name was not taken as a place: ${text(answer)}`);
  assert.equal(state.regionCode, 'CT', 'the region the farmer named is the one selected');
});

test('a name the saved list does not hold still reaches the read-only answer', async () => {
  const { assistant, state, listAsked } = setup();
  const answer = await assistant.respond('Atlantis');
  assert.equal(answer, null, 'an unknown word must not open a plan on a place the source does not list');
  assert.equal(listAsked(), 1, 'the list is what decides, so the read has to have happened');
  assert.equal(state.regionCode, null, 'nothing was selected');
  assert.equal(assistant.isActive(), false, 'no plan was opened');
});

test('a point the farmer already chose survives a bare region name with no plan open', async () => {
  const { assistant, state, calls } = setup();
  state.location = { latitude: 42, longitude: -93.69, placeId: 'typed' };
  const answer = await assistant.respond('Georgia');
  assert.equal(answer, null, 'adopting the name would clear the coordinates the farmer entered, so the chat leaves the plan closed');
  assert.deepEqual(calls, [], `the held point was touched by: ${JSON.stringify(calls)}`);
  assert.deepEqual({ latitude: state.location.latitude, longitude: state.location.longitude }, { latitude: 42, longitude: -93.69 },
    'the farmer’s point is where it was');
});

test('a stop word stays a stop word even where the saved list holds a row of that name', async () => {
  // “Cancel” is invented here as a row name to exercise the rule, not claimed about any source list: a saved row that
  // reads exactly like the stop word used to win, because { cancel: true } carries no other workflow signal and the row
  // check replaced the cancellation with a place. The farmer who typed “cancel” kept a plan they had asked to stop.
  const places = { ...usLocations, regions: [...usLocations.regions, { id: 'CZ', name: 'Cancel' }] };
  const { assistant, state } = setup({ locations: places });
  const opened = await assistant.respond('Help me plan a rotation in the United States');
  assert.match(text(opened), /Which part of United States|whole country/i, `the plan did not open: ${text(opened)}`);
  const stopped = await assistant.respond('cancel');
  assert.match(text(stopped), /planning stopped/i, `“cancel” was answered as a place: ${text(stopped)}`);
  assert.equal(assistant.isActive(), false, 'the plan is closed');
  assert.equal(state.regionCode, null, 'no region was selected by the stop word');
});

test('a bare place name with no country chosen selects nothing and costs no saved-list read', async () => {
  const { assistant, state, listAsked } = setup({ country: null });
  const answer = await assistant.respond('Georgia');
  assert.equal(answer, null, '"Georgia" is a US state and a country, and with nothing held the app cannot pick');
  assert.equal(listAsked(), 0, 'there is no country whose list could be read');
  assert.equal(state.regionCode, null, 'no region was selected outside a country');
});
