import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// Iteration 67, queue item F4. Iteration 66 taught the chat to select the place a farmer names with no plan open
// (docs/validation.md §66), and the same pass measured what happens when the saved list that decides it refuses:
// docs/evidence/iter66-f4-refusal-fallthrough-2026-11-20.log.gz records the same page, the same sentence and the same
// country, with the only difference being the answer to /api/locations. A list that answered gave `regionCode=GA` and
// the town prompt; a list that refused gave `answer=null`, `active=false` and the read-only crop sentence
// (“I could not match that crop to a sourced entry for Georgia.”) — because the read sits behind
// `.catch(() => null)` at public/js/modules/workflow-assistant.js:311, so a refusal is indistinguishable there from a
// list that simply holds no such row. These cases pin the third outcome the farmer is allowed to see: the failed read
// stated as the failed read, with the words the farmer typed still available to send again.
//
// The two authored shapes come from server/context/locations.js:20 and :25 as public/js/lib/api.js re-labels them
// (status plus code travel together, :57-63): a list that could not be loaded, which a second request may fix, and a
// list whose source format this app will not guess at, which it cannot.
const UNAVAILABLE = { message: 'The saved town list could not load. Retry the country selection, search a place or use the map.',
  status: 503, code: 'LOCATIONS_UNAVAILABLE' };
const SCHEMA = { message: 'The saved town list has an invalid source format. Use place search or coordinates.',
  status: 503, code: 'LOCATIONS_SCHEMA' };
// What public/js/lib/api.js:52 throws for a stop the page asked for. `cancelled` is not a failed read, and answering
// one with a refusal sentence replies for a session the farmer has left.
const CANCELLED = { message: 'Planning context changed', name: 'AbortError', cancelled: true };

const usLocations = {
  regions: [{ id: 'GA', name: 'Georgia' }, { id: 'IA', name: 'Iowa' }],
  places: [
    { id: 'u1', name: 'Athens', regionCode: 'GA', latitude: 33.95, longitude: -83.38 },
    { id: 'u2', name: 'Cordele', regionCode: 'GA', latitude: 31.96, longitude: -83.78 },
    { id: 'u3', name: 'Atlantic', regionCode: 'IA', latitude: 41.4, longitude: -95.02 }
  ]
};

function setup({ country = 'US', locations = usLocations, listFailure = null } = {}) {
  const calls = [], listAsks = [];
  let pendingFailure = listFailure;
  const state = { country, catalog, countryCrops: getCountryCrops({ country: country ?? 'ZZ' }), farm: null, farms: [],
    regionCode: null, location: null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: [], irrigation: 'unknown', soil: 'unknown', startMonth: 1, planningYear: 2026, referenceYear: 2025 } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); },
    chooseRegion(id) { calls.push('region'); state.regionCode = id; state.location = null; state.farm = null; },
    chooseLocation(place) { calls.push('location'); state.location = { latitude: place.latitude, longitude: place.longitude, placeId: place.id }; },
    loadFarms() { return []; },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning() { calls.push('inputs'); }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions,
    request: async path => {
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/locations') {
        listAsks.push(url.searchParams.get('country'));
        const failure = typeof pendingFailure === 'function' ? pendingFailure(url.searchParams.get('country')) : pendingFailure;
        if (failure) { const error = new Error(failure.message); Object.assign(error, failure); throw error; }
        return locations;
      }
      throw new Error('unexpected test request ' + path);
    } });
  return { assistant, calls, state, listAsked: () => listAsks.length, failList: failure => { pendingFailure = failure; } };
}

const text = answer => (answer?.blocks ?? []).map(block => block.text).join(' ');
const labels = answer => (answer?.followUps ?? []).map(choice => choice.label);
// The browser sends followUp.question and keeps followUp.workflowChoice, never the label.
const click = async (assistant, answer, index = 0) => { const choice = answer.followUps[index]; return assistant.respond(choice.question, choice.workflowChoice ?? null); };

test('a bare place name whose saved list refused names the read that failed instead of a crop', async () => {
  const { assistant, calls, state, listAsked } = setup({ listFailure: UNAVAILABLE });
  const answer = await assistant.respond('Georgia');
  assert.ok(answer, 'respond() returned nothing, so the page answers the name with the read-only crop sentence');
  const sentence = text(answer);
  assert.match(sentence, /saved place list for United States could not be read just now/, `the refusal is not stated as the read that failed: ${sentence}`);
  assert.match(sentence, /Nothing was selected and nothing was invented/, 'a read that never answered cannot be reported as a lookup that found nothing');
  // The fall-through this iteration closes: the sentence the read-only branch writes for a name it cannot match.
  assert.doesNotMatch(sentence, /could not match that crop/, `the failed read still ended in the crop answer: ${sentence}`);
  assert.doesNotMatch(sentence, /not in the saved list|no such place/, `a refusal is not a finding about the list contents: ${sentence}`);
  assert.equal(state.regionCode, null, 'nothing may be selected from a list this app never saw');
  assert.equal(assistant.isActive(), false, 'a refusal must not open a guided plan on a place it could not check');
  assert.deepEqual(calls, [], `the refusal moved the form anyway: ${JSON.stringify(calls)}`);
  assert.equal(listAsked(), 1, 'one read per ask, and no second read to compose the reply');
});

test('the refusal offers the farmer’s own words back and a tap after a healthy list selects the place', async () => {
  const { assistant, state, listAsked, failList } = setup({ listFailure: UNAVAILABLE });
  const answer = await assistant.respond('Georgia');
  const replay = answer.followUps.findIndex(choice => choice.label === 'Ask that again');
  assert.ok(replay >= 0, `the reply offers no way to send the same sentence again: ${labels(answer).join(' | ')}`);
  // Preserving the input means the button carries the farmer’s wording, not a paraphrase that would ask about
  // something else once the list answers.
  assert.equal(answer.followUps[replay].question, 'Georgia', 'the replay button sends other words than the farmer typed');
  assert.ok(labels(answer).includes('Whole United States'), `the route that needs no saved list is missing: ${labels(answer).join(' | ')}`);
  // The retry has to be a real read: a failure kept in the per-session cache would replay the refusal forever.
  const asked = listAsked();
  failList(null);
  const again = await click(assistant, answer, replay);
  assert.ok(listAsked() > asked, 'the retry did not re-read the saved list, so a failure was kept as though it were a result');
  assert.match(text(again), /Georgia is selected/, `a recovered list still does not take the name the farmer typed: ${text(again)}`);
  assert.equal(state.regionCode, 'GA', 'the place named one message earlier is what the retry selects');
  assert.equal(assistant.isActive(), true, 'the retry opens the guided plan the refusal left closed');
});

test('a list that arrived unreadable is reported as a source format and offers no replay', async () => {
  const { assistant, state, listAsked } = setup({ listFailure: SCHEMA });
  const answer = await assistant.respond('Athens');
  const sentence = text(answer);
  assert.match(sentence, /saved place list for United States arrived in a shape this app cannot read/, `the shape failure is not told apart from a moment: ${sentence}`);
  assert.match(sentence, /asking again cannot change a source format/);
  assert.ok(!labels(answer).includes('Ask that again'), `a replay the reply has just ruled out is offered anyway: ${labels(answer).join(' | ')}`);
  assert.ok(labels(answer).includes('Whole United States'), 'the route that needs no saved list stays available');
  assert.equal(state.location, null, 'no point was selected from rows this app could not read');
  assert.equal(assistant.isActive(), false, 'no plan was opened');
  assert.equal(listAsked(), 1, 'one read per ask');
});

test('a cancelled saved-list read settles as a stop, not as a refusal sentence', async () => {
  const { assistant, state, calls, listAsked } = setup({ listFailure: CANCELLED });
  // getCountryCrops is asked for a country the harness holds, so the bare name reaches the row check with one read
  // pending: this is the only path on which a stop the page asked for can arrive here, because getLocationList keeps
  // a body that answered and never a failure.
  assert.equal(listAsked(), 0, 'the case is armed to refuse the first read the plan makes');
  await assert.rejects(assistant.respond('Georgia'), error => error.cancelled === true && error.name === 'AbortError',
    'a stop the page asked for was answered as a reply about the farmer’s places');
  assert.equal(listAsked(), 1, 'the stop came from the read the name asked for');
  assert.equal(state.regionCode, null, 'a cancelled read selected a region on its way out');
  assert.equal(assistant.isActive(), false, 'a cancelled read opened a plan');
  assert.deepEqual(calls, [], 'a cancelled read moved the form');
});

test('a name the farmer holds a point for is never read against a refusing list', async () => {
  const { assistant, state, calls, listAsked } = setup({ listFailure: UNAVAILABLE });
  state.location = { latitude: 42, longitude: -93.69, placeId: 'typed' };
  const answer = await assistant.respond('Georgia');
  // Iteration 66 established that adopting the name would clear this point, so no read is made at all; a refusal
  // must not change that veto into a failure sentence about a lookup the app never attempted.
  assert.equal(listAsked(), 0, `the veto was bypassed and the list read ${listAsked()} times`);
  assert.equal(answer, null, `the veto answer came back as something else: ${text(answer)}`);
  assert.deepEqual(calls, [], 'the held point was touched');
  assert.deepEqual({ latitude: state.location.latitude, longitude: state.location.longitude }, { latitude: 42, longitude: -93.69 },
    'the farmer’s point is where it was');
});

test('a sentence with no place shape keeps its read-only answer while the list refuses', async () => {
  const { assistant, state, listAsked } = setup({ listFailure: UNAVAILABLE });
  // The first version of this branch answered every message that reached the row check with the refusal, which took
  // the read-only answer down with the list: a question about rain got a sentence about places the farmer never
  // mentioned. The read stays wording-blind (only the list can tell a row name from a question), but the refusal is
  // reserved for a message that has the shape of a place name.
  const asked = await assistant.respond('How much rain fell last year?');
  assert.equal(asked, null, `the question was claimed by the place refusal: ${text(asked)}`);
  assert.equal(listAsked(), 1, 'the read is still what decides whether the sentence names a place');
  const named = await assistant.respond('Georgia');
  assert.match(text(named), /could not be read just now/, `a bare name with the same list down is not told about the failed read: ${text(named)}`);
  assert.equal(state.regionCode, null, 'nothing was selected across the exchange');
  assert.equal(listAsked(), 2, 'one read per ask');
});

// The bound above has a cost, and it is pinned rather than left to prose: a row name longer than the place shape is
// still readable by the wording-blind check when the list answers, and still falls to the read-only branch when it
// does not. The long wording is invented here to exercise the bound, the way “Cancel” is invented in
// tests/workflow-bare-place-name.test.js, and is not claimed about any saved list.
const longNameLocations = {
  regions: [{ id: 'XX', name: 'United Townships of the Eastern Shore and Cleveland' }], places: [] };

test('a row name longer than the place shape is unaffected by the bound when the list answers', async () => {
  const { assistant, state } = setup({ locations: longNameLocations });
  const answer = await assistant.respond('United Townships of the Eastern Shore and Cleveland');
  assert.match(text(answer), /United Townships of the Eastern Shore and Cleveland is selected/,
    `the wording-blind row check was narrowed: ${text(answer)}`);
  assert.equal(state.regionCode, 'XX', 'the long row the farmer typed is what got selected');
});

test('the same long row name with the list refusing still falls through, which is this fix’s limit', async () => {
  const { assistant, state, listAsked } = setup({ locations: longNameLocations, listFailure: UNAVAILABLE });
  const answer = await assistant.respond('United Townships of the Eastern Shore and Cleveland');
  assert.equal(answer, null, 'a name outside the place shape is not reported as a failed read, so the read-only answer stands');
  assert.equal(listAsked(), 1, 'the read was still attempted, which is what makes the fall-through a consequence and not a skip');
  assert.equal(state.regionCode, null, 'nothing was selected');
});
