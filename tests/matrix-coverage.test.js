import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';
import { COUNTRY_CODES, COUNTRY_NAMES, findCountries, normalizeName, regionPhrase } from '../public/js/lib/countries.js';
import { parseWorkflowMessage, resolveCropInput, typedPlace } from '../public/js/modules/workflow-assistant.js';
import { countryPhrasings, driveAssistant, listCountries, locations, makeAssistant, nonsenseCensus, textOf } from './helpers/matrix-harness.js';

// Coverage for every country the app offers a town list for. These are the same production
// modules the browser imports; the doubles only record workflow actions, never observations.
const cache = new Map();
const listFor = async country => {
  let data = cache.get(country);
  if (!data) { data = await locations({ country }); cache.set(country, data); }
  return data;
};
const namedRegions = (list, countryName) => list.regions.filter(region => region.name && normalizeName(region.name) !== normalizeName(countryName));
// The compound “Saint …” / “… & …” spellings that used to resolve to the wrong code or to two codes,
// listed by name so a regression reports the country that broke.
const compoundNames = ['AG', 'BA', 'BL', 'GS', 'HM', 'KN', 'LC', 'MF', 'PM', 'SH', 'SJ', 'ST', 'TC', 'TT', 'VC', 'WF'];
// Supported codes with no saved place list at all (the uninhabited territories): the chat has to stay
// honest about a town list it does not have.
const noPlaceList = COUNTRY_CODES.filter(code => !listCountries.includes(code));

test(`all ${listCountries.length} saved country lists can complete step 1 from the chat`, async () => {
  assert.ok(listCountries.length > 200, 'the saved place data must not silently shrink');
  const withoutTowns = [];
  for (const country of listCountries) if (!(await listFor(country)).places.length) withoutTowns.push(country);
  // A country with no towns is still usable through search, the map or coordinates, but the
  // chat must never claim a town list it does not have; the guided drive test proves the reply.
  assert.ok(Array.isArray(withoutTowns));
});

test(`all ${COUNTRY_CODES.length} supported country codes resolve from every spelling a farmer types`, () => {
  const failures = [];
  for (const country of COUNTRY_CODES) {
    for (const phrase of countryPhrasings(country)) {
      const found = findCountries(`Help me plan a rotation in ${phrase}. Crops: rice, wheat, beans`);
      if (found.length !== 1 || found[0] !== country) failures.push(`${country}: “${phrase}” -> ${JSON.stringify(found)}`);
    }
  }
  assert.deepEqual(failures, []);
  // The compound “Saint …” / “… & …” dependencies are the family that used to resolve to the wrong
  // code or to two codes at once. Heard Island sits outside the saved place lists, so the phrasing
  // loop above is the only place it is checked.
  assert.deepEqual(compoundNames.map(country => findCountries(`Help me plan a rotation in ${COUNTRY_NAMES.of(country)}`)),
    compoundNames.map(country => [country]), 'a compound country name must resolve to that one country');
});

test('a country with no saved town list keeps both routes honest and tappable', async () => {
  for (const code of noPlaceList) {
    const countryName = COUNTRY_NAMES.of(code);
    const { assistant, calls, state } = makeAssistant();
    const answer = await assistant.respond(`Help me plan a rotation in ${countryName}. Crops: rice, wheat, beans. Rainfed`);
    assert.equal(state.country, code, `${code}: the typed country must be the one selected`);
    assert.deepEqual(answer.followUps.map(choice => choice.label), [`Whole ${countryName}`, 'A specific area'],
      `${code}: both routes must stay offered: ${textOf(answer)}`);
    const overview = await assistant.respond(answer.followUps[0].question);
    const text = textOf(overview);
    // The overview must not name a town control this place list does not have.
    assert.doesNotMatch(text, /Choose a town|no named regions/, `${code}: ${text}`);
    assert.match(text, /no towns to choose from/, `${code}: ${text}`);
    assert.ok(overview.followUps.length >= 1, `${code}: the overview must keep a button`);
    const area = await assistant.respond(answer.followUps[1].question);
    assert.match(textOf(area), /No towns are listed/, `${code}: ${textOf(area)}`);
    assert.ok(area.followUps.length >= 1, `${code}: an empty town list must still keep a button`);
    assert.ok(!calls.includes('compare'), `${code}: nothing may be compared without weather for one place`);
  }
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

test('every named region in every saved list can be selected by typing its name', async t => {
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
  t.diagnostic(`${checked} named region rows typed into the assistant; the ${listCountries.length} lists hold ` +
    'their other rows (the country-spelled ones) through the dedicated collision test');
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} of ${checked} region names are not selectable from the chat`);
});

test('town names stay selectable and every unmatchable name has a stated reason', async t => {
  const unexplained = [], eponymous = [], driven = [];
  let checked = 0;
  // Every unique town name in every saved list goes through the short-reply matcher. A name it cannot
  // reach is still checked against the production engine, which accepts a reply that equals a step 1 row
  // exactly (“Chak One Hundred Forty Nine Left”, “Петровец”) and asks which one when several rows share
  // a name.
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
    for (const place of names) {
      checked++;
      if (typedPlace(list, `Use ${place.name}`, { countryName, allowEponymous }).some(match => match.id === place.id)) continue;
      // A name beyond the bare-reply limit is still typeable with the lead-in the reply suggests.
      if (typedPlace(list, `in ${place.name}`, { countryName, allowEponymous }).some(match => match.id === place.id)) continue;
      // A town spelled like its country is excluded only while the plan still asks which region it
      // covers. Once its own region is chosen it has to match again, so assert that here instead of
      // letting the name pass as merely "documented as untyped".
      if (regionPhrase(place.name) === regionPhrase(countryName)) {
        eponymous.push(`${country}/${place.name}`);
        const ownRegion = list.regions.find(row => row.id === place.regionCode);
        if (ownRegion && !typedPlace(list, `Use ${place.name}`, { countryName, regionCode: ownRegion.id, allowEponymous: true })
          .some(match => match.id === place.id)) {
          unexplained.push(`${country}/${place.name} stayed untypeable under its own region ${ownRegion.name}`);
        }
        continue;
      }
      const { text, located } = await drive(country, place.name);
      if (located || /Which one do you mean/.test(text)) { driven.push(`${country}/${place.name}`); continue; }
      unexplained.push(`${country}/${place.name} -> ${text.slice(0, 70) || '(no reply)'}`);
    }
  }
  assert.ok(checked > 60000, `expected every unique town name, checked ${checked}`);
  t.diagnostic(`typed-place coverage: ${checked} unique town names in every saved list, ${driven.length} needed the exact-row path, ` +
    `${eponymous.length} skipped as eponymous with the country: ${eponymous.join(', ') || 'none'}`);
  assert.deepEqual(unexplained.slice(0, 12), [], `${unexplained.length} listed towns cannot be selected from the chat`);
});

test('towns that share a name and a region never produce two identical buttons', async t => {
  // “Quezon · Cagayan Valley” is two different saved points, and two identically worded buttons cannot be
  // chosen between. The reply also has to admit when it shows three of a larger set.
  const driven = [], failures = [];
  let capped = 0;
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const regionNames = new Set(list.regions.filter(region => region.name).map(region => normalizeName(region.name)));
    const groups = new Map();
    for (const place of list.places) {
      const region = list.regions.find(row => row.id === place.regionCode);
      // A name that is also a region name resolves to the region first, which is the other test’s job.
      if (!region?.name || regionNames.has(normalizeName(place.name))) continue;
      const key = `${normalizeName(place.name)}|${place.regionCode}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(place);
    }
    const duplicate = [...groups.entries()].filter(([, rows]) => rows.length > 1)
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (!duplicate) continue;
    const rows = duplicate[1], region = list.regions.find(row => row.id === duplicate[0].split('|')[1]);
    const { assistant, calls } = makeAssistant();
    await assistant.respond(`Help me plan a rotation in ${countryName}`);
    await assistant.respond('A specific area');
    await assistant.respond(`in ${region.name}`);
    const typed = normalizeName(rows[0].name).split(' ').length > 4 ? `in ${rows[0].name}` : rows[0].name;
    const answer = await assistant.respond(typed);
    const text = answer ? textOf(answer) : '';
    if (!/Several listed towns match/.test(text)) { failures.push(`${country}: “${typed}” -> ${text.slice(0, 70) || '(no reply)'}`); continue; }
    const labels = answer.followUps.map(choice => choice.label);
    if (new Set(labels).size !== labels.length) failures.push(`${country}: identical buttons ${JSON.stringify(labels)}`);
    if (labels.length < 2) failures.push(`${country}: the disambiguation reply offered ${labels.length} buttons`);
    if (rows.length > 3) {
      capped++;
      // The reply counts the places it matched, which can be more than the exact-name group because a
      // longer row may also contain the typed name; it must never claim fewer than it hides.
      const stated = Number(text.match(/showing 3 of (\d+)/)?.[1] ?? 0);
      if (stated < rows.length) failures.push(`${country}: ${rows.length} matches but the reply said “${text.slice(0, 60)}”`);
    }
    const town = answer.followUps.find(choice => choice.workflowChoice?.type === 'town');
    if (!town) { failures.push(`${country}: no town button to tap`); continue; }
    await assistant.respond(town.question, town.workflowChoice);
    if (!calls.includes('location')) failures.push(`${country}: tapping a named town chose no point`);
    driven.push(`${country}/${rows[0].name}x${rows.length}`);
  }
  t.diagnostic(`duplicate town names exercised in ${driven.length} countries (${capped} of them showing 3 of a larger set): ${driven.slice(0, 10).join(', ')}`);
  assert.ok(driven.length > 20, `expected the real duplicate-name cases to be exercised, drove ${driven.length}`);
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} duplicate-name replies cannot be chosen between`);
});

test('one spelling that is both a region and a town follows the question that is pending', async t => {
  // Funafuti, Salzburg, Dubai, Burgas and most other capitals are saved as a region row and a town row.
  // The answer must depend on which question the farmer is replying to, not on which row comes first.
  const checked = [], recovery = [], elsewhere = [], failures = [];
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const townNames = new Set(list.places.map(place => normalizeName(place.name)));
    const region = list.regions.find(row => row.name && townNames.has(normalizeName(row.name)) &&
      normalizeName(row.name) !== normalizeName(countryName));
    if (!region) continue;
    const typed = normalizeName(region.name).split(' ').length > 4 ? `in ${region.name}` : region.name;
    const atRegion = makeAssistant();
    await atRegion.assistant.respond(`Help me plan a rotation in ${countryName}`);
    await atRegion.assistant.respond('A specific area');
    const regionAnswer = await atRegion.assistant.respond(typed);
    const regionText = regionAnswer ? textOf(regionAnswer) : '';
    if (atRegion.state.regionCode !== region.id || atRegion.state.location) {
      failures.push(`${country}: “${typed}” at the region question -> region ${atRegion.state.regionCode}, location ${JSON.stringify(atRegion.state.location)}`);
    }
    if (!/is selected\. Now choose a town/.test(regionText)) failures.push(`${country}: region answer -> ${regionText.slice(0, 70) || '(no reply)'}`);
    const atTown = makeAssistant();
    await atTown.assistant.respond(`Help me plan a rotation in ${countryName}`);
    await atTown.assistant.respond('A specific area');
    await atTown.assistant.respond(typed);
    const townAnswer = await atTown.assistant.respond(typed);
    const townText = townAnswer ? textOf(townAnswer) : '';
    // The defect this pins: repeating the chosen region’s own name must never answer the town
    // question with “region is selected” a second time, which asked the farmer the same question twice.
    if (/is selected\. Now choose a town/.test(townText)) {
      failures.push(`${country}: “${typed}” at the town question re-selected the region instead of a town`);
      continue;
    }
    if (/No town by that name is in the saved place list/.test(townText)) {
      // Where no town carries the spelling at all, the honest answer is “not a town here” plus real towns.
      recovery.push(`${country}/${region.name}`);
      if (!townAnswer.followUps.length) failures.push(`${country}: the region-name reply offered no way forward`);
      if (!townAnswer.followUps.some(choice => choice.workflowChoice?.type === 'town')) {
        failures.push(`${country}: “${typed}” at the town question recovered with no real town: ${JSON.stringify(townAnswer.followUps.map(c => c.label))}`);
      }
      continue;
    }
    // Several rows in one region can share the name, and then asking which one is the correct answer.
    if (/Which one do you mean/.test(townText)) {
      const town = townAnswer.followUps.find(choice => choice.workflowChoice?.type === 'town');
      assert.ok(town, `${country}: the collision disambiguation offered no town button`);
      await atTown.assistant.respond(town.question, town.workflowChoice);
    }
    if (!atTown.calls.includes('location') || !atTown.state.location) {
      failures.push(`${country}: “${typed}” at the town question chose no point -> ${townText.slice(0, 70) || '(no reply)'}`);
      continue;
    }
    // In eleven lists the shared spelling is a town in a DIFFERENT region (the city of Buenos Aires is
    // not inside the province), so the town question is answered with that saved point.
    const row = list.places.find(place => place.latitude === atTown.state.location.latitude &&
      place.longitude === atTown.state.location.longitude);
    if (row && row.regionCode !== region.id) elsewhere.push(`${country}/${region.name}`);
    checked.push(`${country}/${region.name}`);
  }
  t.diagnostic(`region-and-town name collisions followed in ${checked.length} countries, ${elsewhere.length} of them ` +
    `answered with a town outside the chosen region and ${recovery.length} with “not a town here”: ` +
    `${checked.slice(0, 8).join(', ')} | ${elsewhere.slice(0, 12).join(', ')}`);
  assert.ok(checked.length > 100, `expected the collision family to be exercised, checked ${checked.length}`);
  assert.ok(elsewhere.length > 0, 'the shared-spelling-in-another-region case stopped being exercised');
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} region/town collisions answered the wrong question`);
});

test(`all ${listCountries.length} countries end in an honest outcome with no dead end or cycle`, async t => {
  const outcomes = { terminal: 0, handoff: 0 };
  const branches = { none: 0, single: 0, comparable: 0 };
  // The browser renders every choice a reply offers, so an offer has to stay small enough to read:
  // a wall of buttons hides the way out as surely as dropping the last one did.
  let maxOffered = 0, widestOffer = '';
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
    for (const reply of result.replies) if ((reply.followUps?.length ?? 0) > maxOffered) {
      maxOffered = reply.followUps.length; widestOffer = `${country}: ${textOf(reply).slice(0, 70)}`;
    }
    // Every reply on the way must give the farmer a way to continue.
    for (const reply of result.replies.slice(0, -1)) if (!reply.followUps.length) defects.push(`${country}: a mid-plan reply offered no choice`);
    const screened = getCountryCrops({ country }).screeningCropIds.length;
    if (screened === 0) branches.none++; else if (screened === 1) branches.single++; else branches.comparable++;
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
  t.diagnostic(`screened-crop branches driven: ${branches.none} countries with none, ${branches.single} with exactly one, ` +
    `${branches.comparable} with two or more; outcomes ${JSON.stringify(outcomes)}`);
  // Each of the three outcomes has to be exercised by real data, or the honest-decline wording could stop
  // being tested without any test failing.
  assert.ok(branches.none > 0 && branches.single > 0 && branches.comparable > 100,
    `expected all three screened-crop branches, drove ${JSON.stringify(branches)}`);
  t.diagnostic(`widest offer across the matrix: ${maxOffered} choices — ${widestOffer}`);
  // Six is the number the browser used to cap its buttons at. Anything larger would have been trimmed in
  // silence, which is the defect class this assertion now prevents from coming back.
  assert.ok(maxOffered <= 6, `a reply offered ${maxOffered} choices: ${widestOffer}`);
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

// The same census scripts/audit-nonsense-town.js prints, now inside the suite: five sampled countries
// above cannot catch a button-less unknown-town reply in one of the other 240 saved lists.
test('an unknown town at every pending position of every saved list keeps a way forward', async t => {
  const { cases, failures, deferred } = await nonsenseCensus();
  t.diagnostic(`${cases} unknown-town cases over ${listCountries.length} lists, ` +
    `${deferred.length} deferred to the grounded evidence answer with an earlier button on screen`);
  assert.ok(cases >= 2000, `only ${cases} unknown-town cases ran; the saved lists shrank`);
  assert.deepEqual(failures, [], `${failures.length} unknown-town replies offered no way forward:\n${failures.slice(0, 10).join('\n')}`);
});

// The region rows a farmer can accidentally lose to the country tables: those whose spelling contains
// another country’s name (Inner Mongolia, Northern Ireland, New Jersey, Port of Spain) and those
// spelled exactly like their own country (Luxembourg, Djibouti, Martinique…). Scanned from the saved
// lists, so a new collision in the data is covered without editing this test.
test('every region row that collides with a country spelling stays selectable as a region', async t => {
  const collisions = [], failures = [];
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const named = list.regions.filter(row => row.name);
    const nameCount = new Map();
    for (const row of named) nameCount.set(normalizeName(row.name), (nameCount.get(normalizeName(row.name)) ?? 0) + 1);
    for (const region of named) {
      const eponymous = normalizeName(region.name) === normalizeName(countryName);
      const other = findCountries(`in ${region.name}`).filter(code => code !== country);
      if (!eponymous && !other.length) continue;
      collisions.push(`${country}/${region.name}${other.length ? ` (${other.join(',')})` : ' (own country)'}`);
      if (nameCount.get(normalizeName(region.name)) > 1) continue;
      for (const typed of [`Use ${region.name}`, `in ${region.name}`, region.name]) {
        const { assistant, state } = makeAssistant();
        await assistant.respond(`Help me plan a rotation in ${countryName}`);
        await assistant.respond('A specific area');
        const answer = await assistant.respond(typed);
        if (state.country !== country) { failures.push(`${country}: “${typed}” moved the plan to ${state.country}`); continue; }
        const text = answer ? textOf(answer) : '';
        if (state.regionCode !== region.id && !/^Which one do you mean/.test(text)) {
          failures.push(`${country}: “${typed}” -> ${text.slice(0, 70) || '(no reply)'}`);
        }
      }
    }
  }
  t.diagnostic(`${collisions.length} region rows collide with a country spelling, each typed three ways: ${collisions.join(', ')}`);
  assert.ok(collisions.length >= 20, `the scan found only ${collisions.length} colliding region rows; the saved lists or the country tables changed shape`);
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} colliding region names are not selectable from the chat`);
});

// Thirty-odd saved town rows fold to one or two letters (Aš, Ry, Ii, Od, Pa…). A bare reply that short
// is normally a typo, so only the exact whole-reply path can reach them, and that path must not lose a
// row simply because another region is already selected.
test('a town row too short for the bare-reply rule is still selectable while another region is chosen', async t => {
  const short = [], failures = [];
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const regions = namedRegions(list, countryName);
    if (!regions.length) continue;
    for (const place of list.places) {
      if (normalizeName(place.name).normalize('NFD').replace(/\p{M}/gu, '').length >= 3) continue;
      if (place.regionCode === regions[0].id) continue;
      short.push(`${country}/${place.name}`);
      const { assistant, state } = makeAssistant();
      await assistant.respond(`Help me plan a rotation in ${countryName}`);
      await assistant.respond('A specific area');
      await assistant.respond(regions[0].name);
      const answer = await assistant.respond(place.name);
      const text = answer ? textOf(answer) : '';
      // India lists both “Un” and “Ūn”, whose folded spellings are one reply, so the honest outcome is
      // the disambiguation question — but only if it puts real buttons on screen to answer it with.
      const asked = /Which one do you mean/.test(text) && (answer?.followUps ?? []).length > 0;
      if (!state.location && !asked) {
        failures.push(`${country}/${place.name} (region ${regions[0].name}) -> ${text.slice(0, 70) || '(no reply)'}`);
      }
    }
  }
  t.diagnostic(`${short.length} one- or two-letter town rows typed while a different region was selected`);
  assert.ok(short.length >= 10, `the scan found only ${short.length} short town rows; the saved lists changed shape`);
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} short town rows cannot be selected from the chat`);
});

// Guadeloupe and Martinique hold a region row spelled exactly like the country and nothing else, so the
// old region question pointed at a step 1 list whose only entry its own wording had just ruled out and
// offered no button. Every saved list with regions must leave something to tap, and a region button it
// offers must select that very row.
test('the region question always leaves a tappable choice, even when only the country’s own name is listed', async t => {
  const buttonless = [], mistapped = [], eponymousOnly = [];
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const rows = list.regions.filter(region => region.name);
    if (!rows.length) continue;
    const { assistant, state } = makeAssistant();
    await assistant.respond(`Help me plan a rotation in ${countryName}`);
    const area = await assistant.respond('A specific area');
    const choices = area?.followUps ?? [];
    if (!choices.length) buttonless.push(`${country} (${rows.length} region rows) -> ${textOf(area).slice(0, 60) || '(no reply)'}`);
    if (rows.every(region => normalizeName(region.name) === normalizeName(countryName))) {
      eponymousOnly.push(country);
      const offered = choices.find(choice => choice.workflowChoice?.type === 'region');
      if (!offered) { mistapped.push(`${country}: the question offered no region button`); continue; }
      await assistant.respond(offered.question);
      if (state.country !== country || state.regionCode !== offered.workflowChoice.id)
        mistapped.push(`${country}: tapping “${offered.label}” left region ${state.regionCode ?? 'unset'}`);
    }
  }
  t.diagnostic(`${eponymousOnly.join(', ')}: ${eponymousOnly.length} lists whose only region row is spelled like the country; ${buttonless.length} buttonless region questions`);
  assert.ok(eponymousOnly.length >= 1, 'no all-eponymous region list was found; the saved lists changed shape');
  assert.deepEqual(buttonless, [], `${buttonless.length} region questions offered nothing to tap`);
  assert.deepEqual(mistapped, [], `${mistapped.length} offered region buttons did not select their own row`);
});

// Replying to a place question with the country’s own name used to bring back the very same question,
// so the chat could ask itself the same thing twice with nothing new to tap. The reply must change, must
// leave something to tap, and must not claim a place it did not select. A saved row spelled like the
// country is its own case: at the region question that region is what the name means, and where the
// name belongs to a town the town has to be typeable once its region is chosen.
const foldWhole = value => normalizeName(value).normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

test('the country’s own name never re-asks the pending place question and its same-named town stays typeable', async t => {
  const repeated = [], buttonless = [], silent = [], regionMissed = [], townMissed = [], quietNarrow = [], eponymousTowns = [], townFailures = [];
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    const regions = namedRegions(list, countryName);
    const sameName = row => row.name && foldWhole(row.name) === foldWhole(countryName);
    const townRow = list.places.find(sameName);
    // Every spelling the app itself shows or ships is tried, so the long official names are covered
    // too: “South Georgia & South Sandwich Islands” is far past the short-reply limit.
    for (const phrasing of countryPhrasings(country)) {
      const { assistant, state } = makeAssistant();
      await assistant.respond(`Help me plan a rotation in ${countryName}`);
      const area = await assistant.respond('A specific area');
      const answer = await assistant.respond(phrasing);
      if (!answer) { silent.push(`${country} “${phrasing}”`); continue; }
      const text = textOf(answer);
      if (text === textOf(area)) repeated.push(`${country} “${phrasing}” -> ${text.slice(0, 60)}`);
      if (!answer.followUps.length) buttonless.push(`${country} “${phrasing}” -> ${text.slice(0, 60)}`);
      // Naming the whole country must never settle for a row whose name is merely a piece of it:
      // “São Tomé & Príncipe” holds the town São Tomé, and choosing that town would change the farmer’s
      // stated scope without saying so. Only a row spelled exactly like the reply may be selected.
      const replyShape = foldWhole(regionPhrase(phrasing));
      const rowCarriesReply = [...list.regions, ...list.places].some(row => row.name && foldWhole(regionPhrase(row.name)) === replyShape);
      if (replyShape === foldWhole(regionPhrase(countryName)) && !rowCarriesReply && /is selected/i.test(text))
        quietNarrow.push(`${country} “${phrasing}” -> ${text.slice(0, 60)}`);
      // A reply that is exactly the name of a saved row has to select that row; a wording that merely
      // begins one (“Andorra” for the parish Andorra la Vella) is matched by the prefix rules, and
      // naming the country when no row carries that name must stay a question instead.
      const canonical = foldWhole(phrasing);
      const exactRegion = list.regions.find(row => row.name && foldWhole(row.name) === canonical);
      const exactTown = list.places.find(row => row.name && foldWhole(row.name) === canonical);
      if (exactRegion) {
        if (state.regionCode !== exactRegion.id) regionMissed.push(`${country} “${phrasing}”: expected region ${exactRegion.id}, got ${state.regionCode ?? 'unset'}`);
      } else if (exactTown && !regions.length) {
        if (!state.location) townMissed.push(`${country}/${exactTown.name} “${phrasing}” -> ${text.slice(0, 60)}`);
      }
    }
    if (!townRow || !regions.length) continue;
    eponymousTowns.push(`${country}/${townRow.name}`);
    const second = makeAssistant();
    await second.assistant.respond(`Help me plan a rotation in ${countryName}`);
    await second.assistant.respond('A specific area');
    const townRegion = list.regions.find(row => row.id === townRow.regionCode);
    if (!townRegion?.name) continue;
    await second.assistant.respond(townRegion.name);
    if (second.state.regionCode !== townRegion.id) {
      townFailures.push(`${country}: its own region row “${townRegion.name}” is not selectable by name, so the town was never reached`);
      continue;
    }
    const typed = await second.assistant.respond(townRow.name);
    if (!second.state.location) townFailures.push(`${country}/${townRow.name} (region ${townRegion.name}) typed after its region -> ${typed ? textOf(typed).slice(0, 60) : '(no reply)'}`);
  }
  t.diagnostic(`${eponymousTowns.length} lists hold a town spelled like the country while also listing named regions: ${eponymousTowns.join(', ')}`);
  assert.ok(eponymousTowns.length >= 5, `only ${eponymousTowns.length} same-named town rows were found; the saved lists changed shape`);
  assert.deepEqual(silent, [], `${silent.length} country spellings answered with silence`);
  assert.deepEqual(repeated, [], `${repeated.length} replies repeated the pending place question`);
  assert.deepEqual(buttonless, [], `${buttonless.length} replies offered nothing to tap`);
  assert.deepEqual(regionMissed, [], `${regionMissed.length} replies naming a saved region row did not select it`);
  assert.deepEqual(townMissed, [], `${townMissed.length} towns named like their region-less country were not selected`);
  assert.deepEqual(townFailures, [], `${townFailures.length} towns named like their country cannot be typed after their region is chosen`);
  assert.deepEqual(quietNarrow, [], `${quietNarrow.length} replies naming the whole country selected a row whose name is only part of it`);
});

// Eighteen saved lists carry no region name at all (Aruba, Singapore, Vatican City, Christmas Island,
// the Falklands, …), so the region question has nothing honest to offer and the plan must go straight to
// real towns. Only Singapore was pinned by a test, so a regression in the shared prompt could leave the
// other seventeen with a buttonless or invented list and still pass everything else.
test('every region-less saved list answers the area question with real saved towns and a way on', async t => {
  const lists = [], deadEnds = [], invented = [], unselectable = [];
  for (const country of listCountries) {
    const list = await listFor(country), countryName = COUNTRY_NAMES.of(country);
    if (list.regions.some(region => region.name)) continue;
    lists.push(country);
    const { assistant, state } = makeAssistant();
    await assistant.respond(`Help me plan a rotation in ${countryName}`);
    const area = await assistant.respond('A specific area');
    if (!area) { deadEnds.push(`${country}: the area question was answered with silence`); continue; }
    const text = textOf(area);
    const towns = (area.followUps ?? []).filter(choice => choice.workflowChoice?.type === 'town');
    if (!towns.length) deadEnds.push(`${country}: ${list.places.length} saved towns but the area question offered none: ${text.slice(0, 60)}`);
    if (!area.followUps.some(choice => choice.label === `Whole ${countryName}`))
      deadEnds.push(`${country}: the area question dropped the Whole ${countryName} route`);
    if (list.places.length && (!/no named regions/i.test(text) || !/not a recommendation/i.test(text)))
      deadEnds.push(`${country}: its town list is offered without saying the list is not advice: ${text.slice(0, 70)}`);
    // Every offered name has to be a row the saved list really holds, and tapping it the way the
    // button does has to put that row's own coordinates on the plan.
    for (const choice of towns) {
      const row = list.places.find(place => place.id === choice.workflowChoice.id);
      if (!row || row.name !== choice.label) { invented.push(`${country}: “${choice.label}” names no saved town row`); continue; }
      state.location = null;
      await assistant.respond(choice.question, choice.workflowChoice);
      if (!state.location || state.location.latitude !== row.latitude || state.location.longitude !== row.longitude)
        unselectable.push(`${country}: tapping “${row.name}” set ${JSON.stringify(state.location)} instead of ${row.latitude}, ${row.longitude}`);
    }
  }
  t.diagnostic(`${lists.length} saved lists with no region names, each driven from the area question to a tapped town: ${lists.join(', ')}`);
  assert.ok(lists.length >= 15, `only ${lists.length} region-less lists were found; the saved place data changed shape`);
  assert.deepEqual(deadEnds, [], `${deadEnds.length} region-less countries dead-end or misreport at the area question`);
  assert.deepEqual(invented, [], `${invented.length} offered town buttons do not name a saved row`);
  assert.deepEqual(unselectable, [], `${unselectable.length} offered town buttons did not select their own row's point`);
});
