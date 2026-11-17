import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';
import { COUNTRY_NAMES, findCountries, normalizeName, regionPhrase } from '../public/js/lib/countries.js';
import { parseWorkflowMessage, resolveCropInput, typedPlace } from '../public/js/modules/workflow-assistant.js';
import { countryPhrasings, driveAssistant, listCountries, locations, makeAssistant, textOf } from './helpers/matrix-harness.js';

// Coverage for every country the app offers a town list for. These are the same production
// modules the browser imports; the doubles only record workflow actions, never observations.
const cache = new Map();
const listFor = async country => {
  let data = cache.get(country);
  if (!data) { data = await locations({ country }); cache.set(country, data); }
  return data;
};
const namedRegions = (list, countryName) => list.regions.filter(region => region.name && normalizeName(region.name) !== normalizeName(countryName));

test(`all ${listCountries.length} saved country lists can complete step 1 from the chat`, async () => {
  assert.ok(listCountries.length > 200, 'the saved place data must not silently shrink');
  const withoutTowns = [];
  for (const country of listCountries) if (!(await listFor(country)).places.length) withoutTowns.push(country);
  // A country with no towns is still usable through search, the map or coordinates, but the
  // chat must never claim a town list it does not have; the guided drive test proves the reply.
  assert.ok(Array.isArray(withoutTowns));
});

test('every country is recognised from the long official spelling a farmer types', () => {
  const failures = [];
  for (const country of listCountries) {
    for (const phrase of countryPhrasings(country)) {
      const found = findCountries(`Help me plan a rotation in ${phrase}. Crops: rice, wheat, beans`);
      if (found.length !== 1 || found[0] !== country) failures.push(`${country}: “${phrase}” -> ${JSON.stringify(found)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('compound region names resolve to one country and never to a name inside them', () => {
  assert.deepEqual(findCountries('Help me plan in Saint Vincent and the Grenadines'), ['VC']);
  assert.deepEqual(findCountries('Help me plan in Antigua and Barbuda'), ['AG']);
  assert.deepEqual(findCountries('Help me plan in São Tomé and Príncipe'), ['ST']);
  assert.deepEqual(findCountries('Help me plan in Sao Tome and Principe'), ['ST']);
  assert.deepEqual(findCountries('Help me plan in Bosnia and Herzegovina'), ['BA']);
  assert.deepEqual(findCountries('Help me plan in Saint Lucia'), ['LC']);
  assert.deepEqual(findCountries('Help me plan in Georgia'), ['GE']);
  // “South Georgia” is a dependency of the United Kingdom, not the country Georgia.
  assert.deepEqual(findCountries('Help me plan in South Georgia'), ['GS']);
  assert.ok(!findCountries('Help me plan in South Georgia').includes('GE'));
});

test('whole-country phrasing works for shortened and spelled-out names', () => {
  for (const name of ['Saint Vincent and the Grenadines', 'St. Vincent & Grenadines', 'SAINT VINCENT AND THE GRENADINES']) {
    const parsed = parseWorkflowMessage(`Whole ${name}`);
    assert.equal(parsed?.wholeCountry, true, name);
    assert.deepEqual(parsed.countries, ['VC']);
  }
  assert.equal(parseWorkflowMessage('Whole India').wholeCountry, true);
  assert.equal(parseWorkflowMessage('Whole Tuvalu').wholeCountry, true);
});

test('every named region in every saved list can be selected by typing its name', async () => {
  const failures = [];
  let checked = 0;
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const regions = namedRegions(list, countryName);
    if (!regions.length) continue;
    const { assistant } = makeAssistant();
    await assistant.respond(`Help me plan a rotation in ${countryName}`);
    await assistant.respond('A specific area');
    for (const region of regions) {
      // A bare reply is accepted up to four words; a longer row name uses the documented
      // “in <name>” lead-in, which is the same path a farmer is told to use.
      const typed = normalizeName(region.name).split(' ').length > 4 ? `in ${region.name}` : region.name;
      const answer = await assistant.respond(typed);
      const text = answer ? textOf(answer) : '';
      checked++;
      if (!text.startsWith(`${region.name} is selected`)) failures.push(`${country}: “${typed}” -> ${text.slice(0, 80) || '(no reply)'}`);
      assistant.invalidate();
    }
  }
  assert.ok(checked > 3000, `expected every named region to be exercised, checked ${checked}`);
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} of ${checked} region names are not selectable from the chat`);
});

test('town names stay selectable and every unmatchable name has a stated reason', async t => {
  const perCountry = 100, unexplained = [], eponymous = [], driven = [];
  let checked = 0;
  // The short-reply matcher is the fast path. A name it cannot reach is still checked against the
  // production engine, which accepts a reply that equals a step 1 row exactly (“Chak One Hundred
  // Forty Nine Left”, “Петровец”) and asks which one when several rows share a name.
  const engines = new Map();
  const drive = async (country, name) => {
    let engine = engines.get(country);
    if (!engine) { engine = makeAssistant().assistant; engines.set(country, engine); }
    engine.testState.location = null; engine.testState.regionCode = null; engine.invalidate();
    await engine.respond(`Help me plan a rotation in ${COUNTRY_NAMES.of(country)}`);
    const answer = await engine.respond(name);
    // A point is chosen when the engine says so or when the next question is about the plan itself
    // (a town selection that moved straight on to the baseline).
    return { text: answer ? textOf(answer) : '', located: Boolean(engine.testState.location) };
  };
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const allowEponymous = namedRegions(list, countryName).length === 0;
    const byName = new Map();
    for (const place of list.places) if (!byName.has(normalizeName(place.name))) byName.set(normalizeName(place.name), place);
    const names = [...byName.values()];
    for (const place of names.slice(0, perCountry)) {
      checked++;
      if (typedPlace(list, `Use ${place.name}`, { countryName, allowEponymous }).some(match => match.id === place.id)) continue;
      // A name beyond the bare-reply limit is still typeable with the lead-in the reply suggests.
      if (typedPlace(list, `in ${place.name}`, { countryName, allowEponymous }).some(match => match.id === place.id)) continue;
      // The engine excludes a town spelled like the country (any accent form) unless the list has
      // no named regions; that is the one documented reason a listed name is not typed.
      if (regionPhrase(place.name) === regionPhrase(countryName)) { eponymous.push(`${country}/${place.name}`); continue; }
      const { text, located } = await drive(country, place.name);
      if (located || /Which one do you mean/.test(text)) { driven.push(`${country}/${place.name}`); continue; }
      unexplained.push(`${country}/${place.name} -> ${text.slice(0, 70) || '(no reply)'}`);
    }
  }
  assert.ok(checked > 13000, `expected a wide town sample, checked ${checked}`);
  t.diagnostic(`typed-place coverage: ${checked} unique town names sampled, ${driven.length} needed the exact-row path, ` +
    `${eponymous.length} skipped as eponymous with the country: ${eponymous.join(', ') || 'none'}`);
  assert.deepEqual(unexplained.slice(0, 12), [], `${unexplained.length} listed towns cannot be selected from the chat`);
});

test(`all ${listCountries.length} countries end in an honest outcome with no dead end or cycle`, async () => {
  const outcomes = { terminal: 0, handoff: 0 };
  const defects = [];
  for (const country of listCountries) {
    const countryName = COUNTRY_NAMES.of(country);
    const { assistant, calls } = makeAssistant();
    const result = await driveAssistant(assistant, `Help me plan a rotation in ${countryName}. Crops: rice, wheat, beans. Rainfed`);
    outcomes[result.status] = (outcomes[result.status] ?? 0) + 1;
    const last = result.replies.at(-1), text = last ? textOf(last) : '';
    if (result.status !== 'terminal' && result.status !== 'handoff') {
      defects.push(`${country}: ${result.status} -> ${text.slice(0, 90)}`);
      continue;
    }
    // Every reply on the way must give the farmer a way to continue.
    for (const reply of result.replies.slice(0, -1)) if (!reply.followUps.length) defects.push(`${country}: a mid-plan reply offered no choice`);
    const screened = getCountryCrops({ country }).screeningCropIds.length;
    if (screened >= 2) {
      if (!/Step 4 is ready/.test(text) || !calls.includes('compare')) defects.push(`${country}: ${screened} screened crops but no comparison: ${text.slice(0, 90)}`);
    } else {
      if (!/cannot show two alternatives for this country/.test(text)) defects.push(`${country}: under-screened country did not say comparison is impossible`);
      // Naming a control the country does not have is the dead end being repaired.
      if (/Let me choose different crops below/.test(text)) defects.push(`${country}: told to use a step 3 crop list it does not have`);
      if (!last.followUps.length) defects.push(`${country}: under-screened country offered no way forward`);
      if (!calls.includes('NASA')) defects.push(`${country}: under-screened country never loaded the real evidence`);
      if (calls.includes('compare')) defects.push(`${country}: compared rotations without two screened crops`);
    }
  }
  assert.deepEqual(defects.slice(0, 12), [], `${defects.length} countries dead-end or misreport through the chat`);
  assert.equal(outcomes.terminal + outcomes.handoff, listCountries.length);
});

test('no country is offered a comparison it cannot support and unknown crops are never substituted', async () => {
  const failures = [];
  for (const country of listCountries) {
    const countryCrops = getCountryCrops({ country });
    for (const choice of countryCrops.choices) {
      const resolved = resolveCropInput(choice.name, catalog, countryCrops);
      if (resolved.id !== choice.id && !resolved.id.startsWith('unassessed:')) failures.push(`${country}: “${choice.name}” -> ${resolved.id}`);
      if (countryCrops.screeningCropIds.includes(resolved.id) && !choice.screeningId && !/^unassessed:/.test(resolved.id)) failures.push(`${country}: unscreened “${choice.name}” became screened ${resolved.id}`);
    }
    for (const name of ['moonfruit', 'glittergrass', 'starwheat', 'zzz not a crop']) {
      const resolved = resolveCropInput(name, catalog, countryCrops);
      if (resolved.id !== `unassessed:${name}`) failures.push(`${country}: unknown “${name}” -> ${resolved.id}`);
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} crop names resolve to a different crop`);
});

test('every catalog crop and alias resolves to its own id wherever it is screened', () => {
  const failures = [];
  for (const crop of catalog.crops) {
    for (const country of listCountries) {
      const countryCrops = getCountryCrops({ country });
      if (!countryCrops.screeningCropIds.includes(crop.id)) continue;
      for (const label of [crop.name, ...crop.aliases]) {
        const resolved = resolveCropInput(label, catalog, countryCrops);
        if (resolved.id !== crop.id) failures.push(`${country}: “${label}” -> ${resolved.id}`);
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} catalog aliases resolve elsewhere`);
});

test('an unknown town during a pending area plan stays recoverable with buttons', async () => {
  for (const country of ['TV', 'TO', 'SG', 'US', 'IN']) {
    const countryName = COUNTRY_NAMES.of(country);
    const list = await listFor(country);
    const { assistant, calls } = makeAssistant();
    await assistant.respond(`Help me plan a rotation in ${countryName}. Crops: rice, wheat, beans`);
    await assistant.respond('A specific area');
    const region = namedRegions(list, countryName)[0];
    if (region) await assistant.respond(region.name);
    const answer = await assistant.respond('Zzyzxvale');
    assert.ok(answer, `${country}: an unknown town fell through to the generic answer`);
    assert.match(textOf(answer), /No town by that name is in the saved place list/);
    assert.ok(answer.followUps.length >= 1, `${country}: the unknown-town reply offered no way forward`);
    assert.ok(!calls.includes('NASA') && !calls.includes('compare'), `${country}: an unknown town must not run evidence or comparison`);
    // The reply is only honest if a button can actually finish the step.
    const town = answer.followUps.find(choice => choice.workflowChoice?.type === 'town');
    if (town) { await assistant.respond(town.question, town.workflowChoice); assert.ok(calls.includes('location')); }
  }
});
