// Goal 6 measurement: when a tap throws and chat.js restores only the composer text, does the
// farmer's untouched retry land on the same workflow branch as the tap did?
//
// Run with `npm run test:choice-loss`; it needs no server and no browser.
//
// It drives the shipped assistant over the shipped place
// lists via tests/helpers/matrix-harness.js's list reader, so no matching logic is re-implemented
// here. Both sides walk the IDENTICAL tapped path - every earlier button is tapped with its armed
// `workflowChoice`, the way a click sends it - and only the final tap differs:
//   good  - the final button is tapped and its action answers normally
//   lost  - the final button is tapped while its action refuses, then the button's own text is sent
//           again with no choice, which is the state chat.js leaves behind after its catch.
// The refusal is armed for that one tap only, so the retry runs against a service that has recovered.
// Read the result together with the case "no tapped place choice rejects the send..." in
// tests/workflow-place-choices.test.js: this instrument measures what a lost choice would cost, that case
// pins the reason the page cannot currently lose one.
import { createWorkflowAssistant, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { getCountryCrops } from '../server/context/crops.js';
import { catalog } from '../server/agronomy/catalog.js';
import { COUNTRY_NAMES } from '../public/js/lib/countries.js';
import { listCountries, locations, textOf } from '../tests/helpers/matrix-harness.js';

function session() {
  const calls = [];
  let armed = null;
  const state = { country: '', countryCrops: getCountryCrops({}), catalog, farms: [], farm: null,
    location: null, observations: null, regionCode: null,
    planning: { baseline: ['', '', ''], allowedCrops: [], irrigation: 'unknown', soil: 'unknown',
      startMonth: 1, planningYear: 2027, referenceYear: 2024 } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.location = null; state.farm = null;
      state.regionCode = null; state.observations = null; state.planning.baseline = ['', '', ''];
      state.countryCrops = getCountryCrops({ country: code }); state.planning.allowedCrops = []; },
    chooseLocation(place) { calls.push('location'); state.location = { latitude: place.latitude, longitude: place.longitude };
      state.observations = null; },
    chooseRegion(id) { calls.push('region'); state.regionCode = id; },
    chooseFarm(id) { calls.push('farm'); state.farm = state.farms.find(farm => farm.id === id); },
    loadFarms() { calls.push('fields'); },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning({ baseline, constraints, allowed }) {
      calls.push('inputs');
      if (baseline) state.planning.baseline = baseline.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
      Object.assign(state.planning, constraints);
      if (allowed) state.planning.allowedCrops = allowed.map(name => resolveCropInput(name, catalog, state.countryCrops).id)
        .filter(id => state.countryCrops.screeningCropIds.includes(id));
      else state.planning.allowedCrops = state.countryCrops.screeningCropIds.filter(id => state.planning.baseline.includes(id));
    },
    async loadEvidence() { calls.push('NASA'); state.observations = { kind: 'TEST' }; return true; },
    compare() { calls.push('compare'); return { scenarios: [{ timeline: [] }, { timeline: [] }, { timeline: [] }] }; }
  };
  // public/js/modules/context.js:237-250 refuses before it ever reaches locationChanged, so a
  // refusal leaves the doubled state where it was. Throwing before the mutation models that order.
  const wrapped = Object.fromEntries(Object.entries(actions).map(([name, fn]) => [name, (...args) => {
    if (armed === name) {
      const error = new Error(`TEST refusal: the saved place list could not be re-read (${name})`);
      error.status = 503;
      throw error;
    }
    return fn(...args);
  }]));
  const assistant = createWorkflowAssistant({ getState: () => state, calls, actions: wrapped, request: async path => {
    const url = new URL(path, 'https://test.invalid');
    if (url.pathname === '/api/locations') return locations({ country: url.searchParams.get('country') });
    if (url.pathname === '/api/places') {
      const data = await locations({ country: state.country });
      const region = data.regions.find(row => row.name);
      return { places: [{ countryCode: state.country, region: region?.name ?? state.country }] };
    }
    throw new Error(`Unexpected test request: ${path}`);
  } });
  return { assistant, state, arm: name => { armed = name; }, disarm: () => { armed = null; } };
}

// Walk a tapped path. `taps` carry {question, choice}; a missing choice is a typed send. When
// `throwOnLast` names an action, that action refuses on the last tap only.
async function drive(country, taps, { throwOnLast = null } = {}) {
  const s = session();
  let answer = await s.assistant.respond(`Help me plan a rotation in ${COUNTRY_NAMES.of(country)}`);
  if (!answer) return { failed: 'the country opening answered with silence' };
  for (const [index, tap] of taps.entries()) {
    const last = index === taps.length - 1;
    if (last && throwOnLast) s.arm(throwOnLast);
    let threw = null;
    try {
      answer = tap.choice ? await s.assistant.respond(tap.question, tap.choice) : await s.assistant.respond(tap.question);
    } catch (error) { threw = error.message; } finally { if (last && throwOnLast) s.disarm(); }
    if (threw !== null) {
      if (!last || !throwOnLast) return { failed: `mid-path throw at step ${index}: ${threw}` };
      return { threw, state: s.state };
    }
    if (!answer) return { failed: `step ${index} answered with silence` };
  }
  return { answer, state: s.state };
}

const snapshot = result => ({
  text: textOf(result.answer),
  region: result.state.regionCode,
  location: JSON.stringify(result.state.location),
  choices: result.answer.followUps.map(choice => `${choice.workflowChoice?.type ?? 'follow-up'}:${choice.label}`).slice(0, 6)
});

const rows = [], failures = [];
for (const country of listCountries) {
  const toArea = await drive(country, [{ question: 'A specific area' }]);
  if (toArea.failed) { failures.push(`${country} area prompt: ${toArea.failed}`); continue; }
  const areaTaps = [{ question: 'A specific area' }];
  const regionButtons = toArea.answer.followUps.filter(choice => choice.workflowChoice?.type === 'region')
    .map(choice => ({ question: choice.question, choice: choice.workflowChoice, label: choice.label }));
  const probes = regionButtons.map(button => ({ stage: 'region', prefix: areaTaps, button }));
  for (const regionButton of regionButtons) {
    const inRegion = await drive(country, [...areaTaps, regionButton]);
    if (inRegion.failed) { failures.push(`${country} region tap ${regionButton.label}: ${inRegion.failed}`); continue; }
    for (const choice of inRegion.answer.followUps.filter(item => item.workflowChoice?.type === 'town')) {
      probes.push({ stage: 'town', prefix: [...areaTaps, regionButton], button: { question: choice.question, choice: choice.workflowChoice, label: choice.label } });
    }
  }
  for (const { stage, prefix, button } of probes) {
    const good = await drive(country, [...prefix, button]);
    if (good.failed) { failures.push(`${country}/${stage}/${button.label}: healthy tap ${good.failed}`); continue; }
    const lost = await drive(country, [...prefix, button], { throwOnLast: stage === 'region' ? 'chooseRegion' : 'chooseLocation' });
    if (lost.failed) { failures.push(`${country}/${stage}/${button.label}: ${lost.failed}`); continue; }
    if (!lost.threw) { failures.push(`${country}/${stage}/${button.label}: the armed refusal never reached the send`); continue; }
    // The farmer presses Send on the restored composer: the same text, no armed choice, healthy service.
    const retry = await drive(country, [...prefix, { question: button.question }]);
    if (retry.failed) { failures.push(`${country}/${stage}/${button.label}: retry ${retry.failed}`); continue; }
    const tap = snapshot(good), retried = snapshot(retry);
    rows.push({ country, stage, label: button.label, armedId: button.choice.id, stateAtLoss: `${lost.state.regionCode}/${JSON.stringify(lost.state.location)}`,
      tap, retried, same: tap.text === retried.text && tap.region === retried.region && tap.location === retried.location });
  }
}

const divergent = rows.filter(row => !row.same);
const category = row => {
  if (row.tap.region !== row.retried.region) return 'region-changed';
  if (row.tap.location !== row.retried.location) return 'point-changed-or-lost';
  return 'reply-text-differs';
};
const byCategory = new Map(), byStage = new Map();
for (const row of divergent) {
  byCategory.set(category(row), (byCategory.get(category(row)) ?? 0) + 1);
  byStage.set(row.stage, (byStage.get(row.stage) ?? 0) + 1);
}
console.log(`COUNTRIES_SCANNED ${listCountries.length}`);
console.log(`TAPS_MEASURED ${rows.length} | region ${rows.filter(row => row.stage === 'region').length} | town ${rows.filter(row => row.stage === 'town').length}`);
console.log(`INSTRUMENT_FAILURES ${failures.length}`);
for (const line of failures.slice(0, 12)) console.log(`  FAILED ${line}`);
console.log(`STATE_AT_LOSS_NEVER_MOVED ${rows.filter(row => row.stateAtLoss === 'null/null').length} of ${rows.length}`);
console.log(`DIVERGENT ${divergent.length}`);
console.log(`DIVERGENT_BY_STAGE ${[...byStage].map(([key, value]) => `${key}=${value}`).join(' ') || 'none'}`);
console.log(`DIVERGENT_BY_CATEGORY ${[...byCategory].map(([key, value]) => `${key}=${value}`).join(' ') || 'none'}`);
for (const row of divergent) {
  console.log(`\n--- ${row.country} ${row.stage} "${row.label}" armed id ${row.armedId}`);
  console.log(`    tap    region=${row.tap.region} location=${row.tap.location}`);
  console.log(`           ${row.tap.text.slice(0, 170)}`);
  console.log(`    retry  region=${row.retried.region} location=${row.retried.location}`);
  console.log(`           ${row.retried.text.slice(0, 170)}`);
}
console.log('CENSUS_DONE');
