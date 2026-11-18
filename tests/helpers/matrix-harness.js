// Shared harness for the full country / town / crop coverage checks.
// The action doubles prove only which validated workflow actions run, and in what order. They
// never stand in for observed NASA readings: real retrieval is covered by the Node and browser
// tests. `allowedCrops` mirrors app.js syncControls(), where the default alternative scope offers
// the intersection of the baseline and the crops this app has screening rules for.
import { readFile } from 'node:fs/promises';
import { createLocationClient } from '../../server/context/locations.js';
import { getCountryCrops } from '../../server/context/crops.js';
import { catalog } from '../../server/agronomy/catalog.js';
import { createWorkflowAssistant, resolveCropInput } from '../../public/js/modules/workflow-assistant.js';
import { COUNTRY_NAMES } from '../../public/js/lib/countries.js';

const directory = new URL('../../public/data/locations/', import.meta.url);
const readJson = async name => JSON.parse(await readFile(new URL(name, directory), 'utf8'));
export const locations = createLocationClient({ readJson });
export const listCountries = Object.keys((await readJson('manifest.json')).countries)
  .filter(code => /^[A-Z]{2}$/.test(code)).sort();

export const terminalPlan = /Step 4 is ready|cannot show two alternatives for this country|rotation comparison is being claimed/;
export const textOf = answer => answer.blocks.map(block => block.text).join(' ');

// The forms a farmer can plausibly type for one country, including the long official spellings
// that Intl shortens with "&" and "St.".
export function countryPhrasings(code) {
  const official = COUNTRY_NAMES.of(code) ?? '';
  const long = official.replace(/\s*&\s*/g, ' and ').replace(/(^|\s)St\.?\s/g, '$1Saint ');
  const ascii = official.normalize('NFD').replace(/\p{M}/gu, '');
  return [...new Set([official, long, ascii, official.toUpperCase(), `the ${official}`].filter(Boolean))];
}

export function makeAssistant({ crops = ['rice', 'wheat', 'beans'] } = {}) {
  const calls = [];
  const state = { country: '', countryCrops: getCountryCrops({}), catalog, farms: [], farm: null,
    location: null, observations: null, regionCode: null,
    planning: { baseline: ['', '', ''], allowedCrops: [], irrigation: 'unknown', soil: 'unknown',
      startMonth: 1, planningYear: 2027, referenceYear: 2024 } };
  const screenAllowed = () => {
    state.planning.allowedCrops = state.countryCrops.screeningCropIds
      .filter(id => state.planning.baseline.includes(id));
  };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.location = null; state.farm = null;
      state.regionCode = null; state.observations = null; state.planning.baseline = ['', '', ''];
      state.countryCrops = getCountryCrops({ country: code }); state.planning.allowedCrops = []; },
    chooseLocation(place) { calls.push('location'); state.location = { latitude: place.latitude, longitude: place.longitude }; state.observations = null; },
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
      else screenAllowed();
    },
    async loadEvidence() { calls.push('NASA'); state.observations = { kind: 'TEST action completion only' }; return true; },
    compare() { calls.push('compare'); return { scenarios: [{ timeline: state.planning.baseline.map(id => ({ cropName: id })) }, { timeline: [] }, { timeline: [] }] }; }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, calls, actions, request: async path => {
    const url = new URL(path, 'https://test.invalid');
    if (url.pathname === '/api/locations') return locations({ country: url.searchParams.get('country') });
    if (url.pathname === '/api/places') {
      const data = await locations({ country: state.country });
      const region = data.regions.find(row => row.name);
      return { places: [{ countryCode: state.country, region: region?.name ?? state.country }] };
    }
    throw new Error(`Unexpected test request: ${path}`);
  } });
  assistant.testState = state;
  assistant.testCalls = calls;
  return { assistant, calls, state, crops };
}

// Tap the way a farmer would: a listed town first, then the selected point, then any other
// forward choice. A read-only handoff button ends the drive because the guided assistant
// deliberately declines it and the grounded evidence answer takes over.
function pickChoice(answer) {
  const choices = answer.followUps;
  return choices.find(choice => choice.workflowChoice?.type === 'town') ??
    choices.find(choice => choice.workflowChoice?.type === 'region') ??
    choices.find(choice => choice.label === 'Use selected point') ??
    choices.find(choice => !/^Whole /.test(choice.label) && !/weather$/i.test(choice.label)) ?? choices[0];
}

export async function driveAssistant(assistant, firstMessage, { max = 14 } = {}) {
  const replies = [];
  const tapped = new Set();
  let answer = await assistant.respond(firstMessage);
  if (!answer) return { replies, status: 'silent', tapped: null };
  for (let step = 0; step < max; step++) {
    replies.push(answer);
    if (terminalPlan.test(textOf(answer))) return { replies, status: 'terminal', tapped: null };
    if (!answer.followUps.length) return { replies, status: 'stuck', tapped: null };
    const choice = pickChoice(answer);
    // Offering a question that was already tapped means the plan cycles instead of advancing. The
    // country is part of the key because a second country may legitimately ask the same wording.
    const key = `${assistant.testState.country}:${choice.question}`;
    if (tapped.has(key)) return { replies, status: 'loop', tapped: choice };
    tapped.add(key);
    answer = choice.workflowChoice ? await assistant.respond(choice.question, choice.workflowChoice) : await assistant.respond(choice.question);
    if (!answer) return { replies, status: 'handoff', tapped: choice };
  }
  return { replies, status: 'unbounded', tapped: null };
}

// Feed an unknown town at every pending position of the guided plan, for every saved country list, and
// require a way forward. A reply is acceptable when it offers a tappable choice. The guided module
// deliberately answers nothing it cannot ground in the saved list — once a point is already chosen, a
// bare word is ambiguous between a town and a crop — so those cases are counted as deferred, and they
// only pass while the earlier message still has a button on screen for the farmer to press.
const NOISE = ['Zzyzxvale', 'moonfruit city', 'Nowhereville'];
export async function nonsenseCensus() {
  const failures = [], deferred = [];
  let cases = 0;
  for (const country of listCountries) {
    const countryName = COUNTRY_NAMES.of(country);
    const list = await locations({ country });
    const region = list.regions.find(row => row.name);
    const town = list.places[0];
    // Three positions in the pending plan: before any place, inside a chosen region, after a town point.
    const positions = [['area prompt', ['A specific area']],
      ...(region ? [['in region', ['A specific area', region.name]]] : []),
      ...(town ? [['at a point', ['A specific area', ...(region ? [region.name] : []), town.name]]] : [])];
    for (const [label, setup] of positions) {
      for (const noise of NOISE) {
        cases++;
        const { assistant, state, calls } = makeAssistant();
        await assistant.respond(`Help me plan a rotation in ${countryName}`);
        let onScreen = 0;
        for (const message of setup) {
          const step = await assistant.respond(message);
          if (!step) { failures.push(`${country}/${label}: setup “${message}” got no reply`); break; }
          onScreen = step.followUps.length;
        }
        calls.length = 0;
        const answer = await assistant.respond(noise);
        if (!answer) {
          deferred.push(`${country}/${label}`);
          if (!onScreen) failures.push(`${country}/${label}: “${noise}” answered with silence and no earlier button was on screen`);
          continue;
        }
        if (!answer.followUps.length) failures.push(`${country}/${label}: “${noise}” left no button — ${textOf(answer).slice(0, 90)}`);
        if (calls.includes('NASA') || calls.includes('compare')) failures.push(`${country}/${label}: “${noise}” ran ${calls.join('+')}`);
        if (label === 'area prompt' && state.regionCode) failures.push(`${country}/${label}: “${noise}” selected region ${state.regionCode}`);
      }
    }
  }
  return { cases, failures, deferred };
}
