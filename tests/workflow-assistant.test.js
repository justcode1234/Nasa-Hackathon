import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowAssistant, parseWorkflowMessage, resolveCropInput } from '../public/js/modules/workflow-assistant.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';

// These doubles test action sequencing, never stand in for observed NASA readings.
function setup({ failEvidence = false, country = 'GB', point = true, waitEvidence, locations = { places: [], regions: [] }, reverseRegion='Maharashtra', allowedCrops = null } = {}) {
  const calls = [];
  const state = { country, catalog, countryCrops: getCountryCrops({ country }), farm: null, farms: [],
    location: point ? { latitude: 52.19, longitude: 0.09 } : null, observations: null,
    planning: { baseline: ['', '', ''], allowedCrops: allowedCrops ?? getCountryCrops({ country }).screeningCropIds, irrigation: 'unknown', soil: 'unknown' } };
  const actions = {
    chooseCountry(code) { calls.push('country'); state.country = code; state.countryCrops = getCountryCrops({ country: code }); state.location = null; state.farm = null; state.regionCode = null; state.observations = null; state.planning.allowedCrops = state.countryCrops.screeningCropIds; },
    chooseLocation(location) { calls.push('location'); state.location = location; state.observations = null; },
    chooseRegion(id) { calls.push('region'); state.regionCode = id; state.location = null; state.farm = null; },
    chooseFarm(id) { calls.push('farm'); state.farm = state.farms.find(farm => farm.id === id); state.location = state.farm.representativePoint; },
    loadFarms() { calls.push('fields'); },
    showStep(step) { calls.push(`step:${step}`); },
    applyPlanning({ baseline, constraints, allowed }) {
      calls.push('inputs');
      if (baseline) state.planning.baseline = baseline.map(name => resolveCropInput(name, catalog, state.countryCrops).id);
      Object.assign(state.planning, constraints);
      if (allowed) state.planning.allowedCrops = allowed.map(name => resolveCropInput(name, catalog, state.countryCrops).id).filter(id => state.countryCrops.screeningCropIds.includes(id));
    },
    async loadEvidence() { calls.push('NASA'); if (waitEvidence) await waitEvidence; if (failEvidence) return false; state.observations = { kind: 'TEST action completion only' }; return true; },
    compare() { calls.push('compare'); return { scenarios: [{ timeline: state.planning.baseline.map(name => ({ cropName: name })) }] }; }
  };
  const assistant = createWorkflowAssistant({ getState: () => state, actions,
    request: async path => {
      const url = new URL(path, 'https://test.invalid');
      if (url.pathname === '/api/places') return { places: [{ countryCode: Number(url.searchParams.get('latitude')) > 40 ? 'GB' : 'IN',region:reverseRegion }] };
      if (url.pathname === '/api/locations') return locations;
      throw new Error('Unexpected test request');
    } });
  return { assistant, calls, state };
}

test('workflow parser distinguishes actions from read-only crop questions', () => {
  assert.equal(parseWorkflowMessage('tell me about rice in India'), null);
  assert.equal(parseWorkflowMessage('How long does rice grow?', true), null);
  const request = parseWorkflowMessage('Help me pick India at 18.52, 73.85. Crops: rice, wheat, beans. Rainfed; clay soil; pH 6.2');
  assert.deepEqual(request.countries, ['IN']);
  assert.deepEqual(request.location, { latitude: 18.52, longitude: 73.85 });
  assert.deepEqual(request.baseline, ['rice', 'wheat', 'beans']);
  assert.deepEqual(request.constraints, { irrigation: 'rainfed', soil: 'clay', soilPh: 6.2 });
  assert.deepEqual(parseWorkflowMessage('help me rotate rice, wheat, beans in India').baseline, ['rice', 'wheat', 'beans']);
});

// Irrigation survives either word order ("Rainfed", "irrigation is available") but a soil type only reached the
// plan as `clay soil`: writing the same fact the other way round — "soil is clay", "soil: clay", "soil type is
// clay" — parsed to no soil at all, and the plan went ahead without saying a constraint was dropped. Both orders
// are read from the three textures the step-1 select offers, and prose that names soil without naming one of
// them still reports nothing rather than guessing.
test('a volunteered soil type is read in either word order', () => {
  const soilOf = tail => parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`)?.constraints?.soil ?? null;
  for (const [phrasing, soil] of [['clay soil', 'clay'], ['soil is clay', 'clay'], ['soil: clay', 'clay'],
    ['soil = clay', 'clay'], ['soil type is clay', 'clay'], ['soil texture is loam', 'loam'],
    ['sandy soil', 'sandy'], ['soil is sandy loam', 'sandy']]) {
    assert.equal(soilOf(`Rainfed; ${phrasing}`), soil, `“${phrasing}” was dropped from the plan`);
  }
  assert.equal(soilOf('Rainfed; the soil here is heavy clay'), null, 'an unbounded match would guess from prose');
  assert.equal(soilOf('Rainfed; soil is not clay'), null, 'a negation must not set the soil');
  assert.equal(soilOf('Rainfed; soil pH 6.2'), null, 'naming the property is not naming a texture');
});

// A planting month was read only from "start …": "start in early April", "plant in May", "sow in June" and
// "start planting in March" all parsed to no month, so the plan used the month already in the form without
// saying the stated window was dropped. The month survives from a prepositional phrase and from an -ing verb
// directly before it, and a base verb with no preposition still sets nothing — "start may take longer" is not
// a plan for May.
test('a planting month survives the verb and qualifier in front of it', () => {
  const monthOf = tail => parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`)?.constraints?.startMonth ?? null;
  for (const [phrasing, month] of [['start in April', 4], ['starting April', 4], ['start month April', 4],
    ['start in early April', 4], ['start in mid April', 4], ['start in late april', 4],
    ['start at the beginning of April', 4], ['start around October', 10], ['start planting in march', 3],
    ['plant in May', 5], ['sow in June', 6], ['begin in July', 7], ['start in april 2027', 4]]) {
    assert.equal(monthOf(`Rainfed; ${phrasing}`), month, `“${phrasing}” was dropped from the plan`);
  }
  assert.equal(monthOf('Rainfed; start may take longer than the season allows'), null, 'the modal “may” is not May');
  assert.equal(monthOf('Rainfed; start in the spring'), null, 'a season is not a month');
  assert.equal(monthOf('Rainfed; start in May and harvest in September'), 5, 'the window, not the end, is the start month');
});

// Many locales write 18,52 for 18.52. The pair pattern only allowed a dot inside a number, so it read the comma
// as the separator between latitude and longitude: "at 18,52, 73,85" (Goa) became latitude 18, longitude 52 —
// a point on the Egypt/Libya border — and "-23,55, -46,63" (São Paulo) became -23, +55 in the Indian Ocean with
// the second sign lost. Both invented numbers pass the ±90/±180 range check, so nothing warned the farmer.
test('a decimal-comma coordinate is read as one number per position', () => {
  const at = tail => parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`)?.location ?? null;
  assert.deepEqual(at('at 18,52, 73,85'), { latitude: 18.52, longitude: 73.85 }, 'the decimal comma was split into a new place');
  assert.deepEqual(at('the point is -23,55, -46,63'), { latitude: -23.55, longitude: -46.63 }, 'the second sign was dropped');
  assert.deepEqual(at('gps: 18,52 73,85'), { latitude: 18.52, longitude: 73.85 }, 'a space-separated pair of comma decimals');
  assert.deepEqual(at('at 8,5 and 49,35'), { latitude: 8.5, longitude: 49.35 });
  assert.deepEqual(at('at 18.52, 73.85'), { latitude: 18.52, longitude: 73.85 }, 'the dotted pair is unchanged');
  assert.deepEqual(at('at 18, 52'), { latitude: 18, longitude: 52 }, 'a spaced pair of whole numbers is still two numbers');
  // Iteration 30 supersedes the limit this line used to pin: a hemisphere letter is now read as the sign,
  // so the same message must resolve instead of being refused.
  assert.deepEqual(at('at 35.9 N 14.4 E'), { latitude: 35.9, longitude: 14.4 }, 'a hemisphere pair is read, not refused');
});

// A pin copied from a paper form or a map app arrives as "18.52N 73.85E", "33.9 S, 18.4 W" or
// "lat 18.52 lon 73.85". Nine such spellings were measured on the live module and every one parsed to no
// location at all, so the farmer was told to supply coordinates that they had just supplied. The letters carry
// the sign a decimal form states with a minus, so N/E stay positive and S/W flip. Only a number with a fraction
// or a degree mark counts, because "use 4N fertilizer on the 15E slope" is a dose and a gradient, not a point.
test('a coordinate written with hemisphere letters or lat/lon labels is placed', () => {
  const at = tail => parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`)?.location ?? null;
  assert.deepEqual(at('at 35.9 N, 14.4 E'), { latitude: 35.9, longitude: 14.4 });
  assert.deepEqual(at('14.4E 35.9N'), { latitude: 35.9, longitude: 14.4 }, 'the pair may be written east first');
  assert.deepEqual(at('33.9 S, 18.4 W'), { latitude: -33.9, longitude: -18.4 }, 'S and W are the negative half');
  assert.deepEqual(at('the point is 18.52N 73.85E right now'), { latitude: 18.52, longitude: 73.85 });
  assert.deepEqual(at('lat 18.52 lon 73.85'), { latitude: 18.52, longitude: 73.85 });
  assert.deepEqual(at('long 73.85 lat 18.52'), { latitude: 18.52, longitude: 73.85 }, 'each number keeps its own label');
  assert.deepEqual(at('at 18,52° N, 73,85° E'), { latitude: 18.52, longitude: 73.85 }, 'a decimal comma with degree marks is one number, not the fraction alone');
  assert.deepEqual(at('18,52 N 73,85 E'), { latitude: 18.52, longitude: 73.85 }, 'a decimal comma with no degree mark');
  assert.deepEqual(at('at 23,55 S, 46,63 W'), { latitude: -23.55, longitude: -46.63 }, 'the comma decimals flip negative together');
  assert.equal(at('use 4N fertilizer on the 15E slope'), null, 'an integer grade and a gradient are not a point');
  assert.equal(at('apply 20.5 N per hectare and 12.4 E of lime'), null, 'two rates in one sentence are not a pin');
  assert.equal(at('a field 40 km north of town'), null, 'a direction word is not a hemisphere tag');
});

test('explicit country, coordinates and farmer crops execute through step 4 in order', async () => {
  const { assistant, calls, state } = setup();
  const answer = await assistant.respond('Help me plan a rotation in India at 18.52, 73.85. Crops: rice, wheat, beans. Rainfed');
  assert.match(answer.blocks[0].text, /Step 4 is ready/);
  assert.deepEqual(calls.filter(call => !call.startsWith('step:')), ['country', 'location', 'inputs', 'NASA', 'compare']);
  assert.deepEqual(state.planning.baseline, ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean']);
  assert.equal(state.planning.irrigation, 'rainfed');
  assert.equal(state.planning.soil, 'unknown');
});

test('country without a field asks for a point and retains supplied crops across messages', async () => {
  const { assistant, calls } = setup();
  const first = await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  assert.match(first.blocks[0].text, /Which part of India.*whole country/);
  assert.deepEqual(first.followUps.map(choice => choice.label), ['Whole India', 'A specific area']);
  assert.ok(!calls.includes('NASA'));
  const second = await assistant.respond('at 18.52, 73.85');
  assert.match(second.blocks[0].text, /Step 4 is ready/);
  assert.equal(calls.filter(call => call === 'compare').length, 1);
});

test('whole-country replies use national evidence without loading point weather or comparing', async () => {
  for (const question of ['Whole India', 'all of India', 'the whole of India', 'entire country', 'nationwide', 'I want the whole country, not a farm', 'An overview of all India, not this field']) {
    const { assistant, calls, state } = setup();
    await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
    const answer = await assistant.respond(question);
    const text = answer.blocks.map(block => block.text).join(' ');
    assert.match(text, /Whole-country overview for India/);
    assert.match(text, /Rice \(2024\).*Wheat \(2024\)/);
    assert.match(text, /not local suitability evidence/);
    assert.ok(answer.sources.some(source => source.id === 'faostat-qcl'));
    assert.equal(state.location, null);
    assert.ok(!calls.includes('NASA') && !calls.includes('compare'));
  }
});

test('combined place/coordinate sentences resolve a coherent point and reject region/town conflicts',async()=>{
  const locations={regions:[{id:'16',name:'Maharashtra'}],places:[{id:'pune',name:'Pune',regionCode:'16',latitude:18.51957,longitude:73.85535}]};
  for(const question of ['Use Maharashtra, near Pune, 18.5204, 73.8567','Use Pune (18.5204, 73.8567).']) {
    const {assistant,state}=setup({locations});
    await assistant.respond('Help me plan in India. Crops: rice, wheat, beans. Rainfed');
    const answer=await assistant.respond(question);
    assert.match(answer.blocks[0].text,/Step 4 is ready/);
    assert.equal(state.location.latitude,18.5204);
    assert.equal(state.planning.irrigation,'rainfed');
  }
  const mismatch=setup({locations,reverseRegion:'Punjab'});
  await mismatch.assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  assert.match((await mismatch.assistant.respond('Use Maharashtra, near Pune, 18.5204, 73.8567')).blocks[0].text,/could not be verified in Maharashtra/);
  assert.ok(!mismatch.calls.includes('NASA'));
  const far=setup({locations});
  await far.assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  assert.match((await far.assistant.respond('Use Pune at 19.076, 72.8777')).blocks[0].text,/more than 50 km/);
  assert.ok(!far.calls.includes('NASA'));
});

test('national scope clears an existing field point and keeps the farmer sequence', async () => {
  const { assistant, state, calls } = setup({ country: 'IN' });
  state.farm = { id: 'way/1', name: 'TEST selected field' };
  state.observations = { kind: 'TEST existing point evidence' };
  state.planning.baseline = ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean'];
  const answer = await assistant.respond('Whole India');
  assert.equal(state.location, null);
  assert.equal(state.farm, null);
  assert.equal(state.observations, null);
  assert.match(answer.blocks[0].text, /Rice.*Wheat.*Bush snap bean/);
  assert.ok(!calls.includes('compare'));
});

test('specific-area mode accepts a sourced region and preserves crops through the local comparison', async () => {
  const { assistant, calls, state } = setup({ locations: { regions: [{ id: '16', name: 'Maharashtra' }], places: [] } });
  await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  const area = await assistant.respond('A specific area');
  assert.match(area.blocks[0].text, /Which state or region of India/);
  const region = await assistant.respond('Maharashtra');
  assert.match(region.blocks[0].text, /Maharashtra is selected.*choose a town/s);
  assert.equal(state.regionCode, '16');
  assert.ok(!calls.includes('NASA'));
  const result = await assistant.respond('at 18.52, 73.85');
  assert.match(result.blocks[0].text, /Step 4 is ready/);
  assert.deepEqual(state.planning.baseline, ['unassessed:fao-27', 'unassessed:fao-15', 'bush-bean']);
});

test('whole-country mode can narrow directly to a named region without repeating the crops', async () => {
  const { assistant, state } = setup({ locations: { regions: [{ id: '23', name: 'Punjab' }], places: [] } });
  await assistant.respond('Help me plan in India. Crops: rice, wheat, beans');
  await assistant.respond('Whole India');
  const answer = await assistant.respond('Punjab');
  assert.match(answer.blocks[0].text, /Punjab is selected.*choose a town/s);
  assert.equal(state.regionCode, '23');
});

test('whole-country choice puts the supplied crops in step 3, offers tappable regions and can finish after a manual town pick', async () => {
  const locations = { regions: [{ id: '16', name: 'Maharashtra' }, { id: '25', name: 'Tamil Nadu' }, { id: '23', name: 'Punjab' }, { id: '99', name: 'Goa' }],
    places: [['1','16'],['2','16'],['3','25'],['4','25'],['5','25'],['6','23'],['7','99']].map(([id, regionCode]) => ({ id, name: 'TEST town ' + id, regionCode, latitude: 18.5, longitude: 73.8 })) };
  const { assistant, calls, state } = setup({ point: false, country: 'IN', locations });
  const scope = await assistant.respond('Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion. Rainfed.');
  assert.deepEqual(scope.followUps.map(f => f.label), ['Whole India', 'A specific area']);
  const whole = await assistant.respond('Whole India');
  // The claim matches the form: crops and the rainfed constraint are really in step 3.
  assert.match(whole.blocks[0].text, /Your crops are entered in step 3: Tomato → Cabbage → Bulb onion/);
  assert.deepEqual(state.planning.baseline, ['tomato', 'cabbage', 'onion']);
  assert.equal(state.planning.irrigation, 'rainfed');
  assert.ok(calls.includes('step:location') && !calls.includes('NASA') && !calls.includes('location'), 'no farm point or weather for a whole country');
  const area = await assistant.respond(whole.followUps[0].question);
  // Shortcuts follow the stated rule: most listed towns first.
  assert.deepEqual(area.followUps.map(f => f.label), ['Tamil Nadu', 'Maharashtra', 'Goa']);
  const region = await assistant.respond(area.followUps[1].question);
  assert.match(region.blocks[0].text, /Maharashtra is selected/);
  // The user picks a town in step 1 (manual edit clears assistant memory), then continues.
  assistant.invalidate(); state.location = { latitude: 18.52, longitude: 73.85 };
  assert.equal(assistant.isActive(), true);
  const done = await assistant.respond('Use the selected point');
  assert.match(done.blocks[0].text, /Step 4 is ready/);
  assert.deepEqual(state.planning.baseline, ['tomato', 'cabbage', 'onion']);
  assert.ok(calls.includes('NASA') && calls.includes('compare'));
});

test('scope choices apply to other countries and empty national coverage stays honest', async () => {
  for (const country of ['Australia', 'Antarctica']) {
    const { assistant, calls } = setup();
    const first = await assistant.respond(`Help me plan a rotation in ${country}`);
    assert.match(first.blocks[0].text, new RegExp(`Which part of ${country}`));
    const all = await assistant.respond(first.followUps[0].question);
    assert.match(all.blocks[0].text, new RegExp(`Whole-country overview for ${country}`));
    assert.match(all.blocks[1].text, /Missing categories remain unknown/);
    assert.ok(!calls.includes('NASA'));
  }
});

test('a selected point still needs three farmer crops and never fills missing slots', async () => {
  const { assistant, calls, state } = setup();
  const first = await assistant.respond('Help me plan a rotation using the selected point');
  assert.match(first.blocks[0].text, /three existing crops/);
  const incomplete = await assistant.respond('crops: wheat, peas');
  assert.match(incomplete.blocks[0].text, /exactly three/);
  assert.deepEqual(state.planning.baseline, ['', '', '']);
  assert.ok(!calls.includes('NASA'));
});

test('coordinate-country disagreement stops before location and NASA actions', async () => {
  const { assistant, calls } = setup();
  const answer = await assistant.respond('Help me plan in India at 52.19, 0.09. Crops: rice, wheat, beans');
  assert.match(answer.blocks[0].text, /identified in United Kingdom/);
  assert.ok(!calls.includes('location'));
  assert.ok(!calls.includes('NASA'));
});

test('field actions require a currently returned source ID', async () => {
  const { assistant, calls } = setup();
  const answer = await assistant.respond('Use mapped field way/999999');
  assert.match(answer.blocks[0].text, /not in the current mapped results/);
  assert.ok(!calls.includes('farm'));
});

test('an explicitly numbered returned field is selected without guessing another outline', async () => {
  const { assistant, calls, state } = setup();
  state.farms = [1, 2].map(id => ({ id: `way/${id}`, name: `TEST FIELD ${id}`, representativePoint: { latitude: 52.19 + id / 1000, longitude: 0.09 } }));
  await assistant.respond('Select the second field');
  assert.equal(state.farm.id, 'way/2');
  assert.ok(calls.includes('farm'));
  assert.ok(!calls.includes('NASA'));
});

test('provider failure is not reported as a successful comparison', async () => {
  const { assistant, calls } = setup({ failEvidence: true });
  await assistant.respond('Use the selected point');
  const answer = await assistant.respond('crops: wheat, peas, beans');
  assert.match(answer.blocks[0].text, /could not be loaded/);
  assert.ok(!calls.includes('compare'));
});

test('manual edits cancel a pending continuation before comparison runs', async () => {
  let finish;
  const waitEvidence = new Promise(resolve => { finish = resolve; });
  const { assistant, calls } = setup({ waitEvidence });
  await assistant.respond('Use the selected point');
  const pending = assistant.respond('crops: wheat, peas, beans');
  while (!calls.includes('NASA')) await new Promise(resolve => setTimeout(resolve, 0));
  assistant.invalidate(); finish();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.ok(!calls.includes('compare'));
});

test('restricting alternatives to unsupported crops never silently substitutes other crops', async () => {
  const { assistant, calls } = setup();
  await assistant.respond('Use the selected point');
  const answer = await assistant.respond('crops: wheat, peas, beans. Alternatives: rice, wheat');
  assert.match(answer.blocks[0].text, /fewer than two allowed/);
  assert.ok(!calls.includes('NASA'));
  assert.ok(!calls.includes('compare'));
});

test('a plan blocked on allowed crops offers the screened list as a tappable chat choice', async () => {
  const { assistant, calls, state } = setup({ allowedCrops: ['cabbage'] });
  await assistant.respond('Use the selected point');
  const answer = await assistant.respond('crops: rice, cabbage, tomato');
  assert.match(answer.blocks[0].text, /fewer than two allowed/);
  assert.match(answer.blocks[0].text, /not a recommendation/);
  assert.equal(answer.followUps.length, 1, 'the blocked reply must offer exactly one way forward');
  assert.equal(answer.followUps[0].label, 'Allow Bush snap bean, Cabbage, Bulb onion');
  assert.match(answer.followUps[0].question, /^allowed crops: /);
  assert.ok(!calls.includes('compare'), 'a one-crop alternative set must not be compared');
  const ready = await assistant.respond(answer.followUps[0].question);
  assert.match(ready.blocks[0].text, /Step 4 is ready/);
  assert.deepEqual(state.planning.allowedCrops, ['bush-bean', 'cabbage', 'onion']);
  assert.ok(calls.includes('compare'));
});

test('crop resolution preserves unknown varieties and existing FAO selections', () => {
  const country = getCountryCrops({ country: 'IN' });
  assert.equal(resolveCropInput('rice', catalog, country).id, 'unassessed:fao-27');
  assert.equal(resolveCropInput('unassessed:fao-27', catalog, country).id, 'unassessed:fao-27');
  assert.equal(resolveCropInput('grain maize', catalog, country).id, 'unassessed:grain maize');
  assert.equal(resolveCropInput('moonfruit', catalog, country).id, 'unassessed:moonfruit');
});

test('an explicit alternative list is separate from baseline and a mixed unsupported list needs correction',async()=>{
  const parsed=parseWorkflowMessage('Allowed crops: bush snap bean, garden pea',true);assert.equal(parsed.baseline,undefined);assert.deepEqual(parsed.allowed,['bush snap bean','garden pea']);
  const {assistant,calls}=setup();await assistant.respond('Use the selected point');calls.length=0;
  const rejected=await assistant.respond('Crops: beans, peas, beans. Alternatives: beans, peas, rice');assert.match(rejected.blocks[0].text,/rice.*not silently discard/s);assert.ok(!calls.includes('NASA')&&!calls.includes('compare'));
  assert.match((await assistant.respond('Allowed crops: beans, peas')).blocks[0].text,/Step 4 is ready/);
});

test('unmatched text in national scope does not execute a workflow action',async()=>{
  const {assistant,calls}=setup({point:false});await assistant.respond('Help me plan in India');await assistant.respond('Whole India');calls.length=0;
  assert.equal(await assistant.respond('blorple flarn'),null);assert.deepEqual(calls,[]);
});


test('nonsense and full-width read-only questions cannot advance a pending point workflow', async()=>{
  const {assistant,calls}=setup();
  await assistant.respond('Help me plan a rotation using the selected point');calls.length=0;
  assert.equal(await assistant.respond('blorple flarn'),null);assert.deepEqual(calls,[]);
  assert.equal(parseWorkflowMessage(String.fromCharCode(0xff1f,0xff1f,0xff1f),true),null);
});

test('Singapore with unnamed region codes goes directly to places and never needs a region',async()=>{
  const {assistant,calls,state}=setup({country:'SG',point:false,locations:{regions:[{id:'01',name:null}],places:[{id:'town',name:'Singapore',regionCode:'01',latitude:1.29,longitude:103.85}]}});
  await assistant.respond('Help me plan a rotation in Singapore. Crops: tomato, cabbage, onion');
  const overview=await assistant.respond('Whole Singapore');
  assert.equal(overview.followUps[0].label,'Choose a town or field');
  const area=await assistant.respond('A specific area');
  assert.match(area.blocks[0].text,/no named regions.*first three towns/s);
  // The prompt is only honest if it carries a button that can actually finish the step.
  assert.deepEqual(area.followUps.filter(choice=>choice.workflowChoice?.type==='town').map(choice=>choice.label),['Singapore']);
  const picked=await assistant.respond(area.followUps[0].question,area.followUps[0].workflowChoice);
  assert.match(picked.blocks[0].text,/Singapore is selected as a town point/);
  assert.ok(!calls.includes('region')&&!calls.includes('NASA'));assert.equal(state.location.latitude,1.29);
});

// A soil test written in a comma-decimal locale says "pH 6,2". The number pattern only allowed a dot, so it
// stopped at the comma and kept 6 - a legal pH that the 0-14 range check can never question - and the same comma
// then looked like a separator between two coordinates, so the message also carried a pin at latitude 6, longitude 2
// in the Gulf of Guinea. Both halves of that are measured on the live module before any edit.
test('a soil test written with a decimal comma keeps its fraction and is not a pin', () => {
  const parse = tail => parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`, true) ?? {};
  const ph = tail => parse(tail).constraints?.soilPh ?? null;
  const at = tail => parse(tail).location ?? null;
  assert.equal(ph('soil pH 6,2'), 6.2, 'the comma was the decimal separator, not the coordinate separator');
  assert.equal(ph('the soil ph is 6,2 and it drains badly'), 6.2);
  assert.equal(ph('pH: 7,5'), 7.5);
  assert.equal(ph('soil pH 6.2'), 6.2, 'the dotted form is unchanged');
  assert.equal(ph('soil pH 7'), 7, 'a whole number stays whole');
  assert.equal(ph('rainfall 1200 mm'), null);
  assert.equal(ph('salinity 3,7 dS/m'), null, 'a salt reading is not a pH');
  assert.equal(at('soil pH 6,2'), null, 'the two halves of one pH are not a latitude and a longitude');
  assert.deepEqual(at('at 18.52, 73.85 with soil pH 6.2'), { latitude: 18.52, longitude: 73.85 }, 'a real pair beside a pH still lands');
  assert.deepEqual(at('soil pH 6,2 at 18.52, 73.85'), { latitude: 18.52, longitude: 73.85 }, 'a refused pH comma no longer hides the real pair that follows it');
  assert.equal(at('salinity 3,7 dS/m'), null, 'a salt reading is one number, not a place');
});

test('one number written with a decimal comma is not a pair of coordinates', () => {
  const at = tail => (parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`, true) ?? {}).location ?? null;
  assert.equal(at('salinity 3,7 dS/m'), null, 'a salt reading is one number, not a latitude and a longitude');
  assert.equal(at('organic matter 3,5 % and a bit of gravel'), null);
  assert.equal(at('the soil is 62,5 % sand'), null, '62 would pass as a latitude, which is how a wrong pin goes unnoticed');
  assert.deepEqual(at('at 18.52, 73.85'), { latitude: 18.52, longitude: 73.85 }, 'the spaced pair is unaffected');
  assert.deepEqual(at('at 18, 52'), { latitude: 18, longitude: 52 }, 'two whole numbers with a space are still a pair');
  assert.deepEqual(at('at -31.89,116.77'), { latitude: -31.89, longitude: 116.77 }, 'the app writes its own region list in this tight form');
  assert.deepEqual(at('at 42,-93.69'), { latitude: 42, longitude: -93.69 });
  assert.deepEqual(at('at 52.19,0.09'), { latitude: 52.19, longitude: 0.09 });
  assert.deepEqual(at('at 18,52, 73,85'), { latitude: 18.52, longitude: 73.85 }, 'two comma decimals are still a pair');
  assert.deepEqual(at('the point is 18.52N 73.85E right now'), { latitude: 18.52, longitude: 73.85 });
  assert.deepEqual(at('rainfall 1.250,5 mm last season'), { latitude: 1.25, longitude: 5 }, 'measured limit: a dot thousands separator plus a comma decimal is still read as a pair');
  assert.deepEqual(at('seed rate 3.5 N and 2.1 E per kg'), { latitude: 3.5, longitude: 2.1 }, 'measured limit: the hemisphere route still trusts two agronomy letters');
});

test('every Comparison Priority value a farmer can name in words is reachable from chat', () => {
  const pr = phrasing => (parseWorkflowMessage(phrasing, true) ?? {}).constraints?.priority ?? '';
  // The four values are the options of #priority (public/index.html:122) and each one reorders the
  // comparison (server/agronomy/rotation.js:143-147). Spellings marked app: are the repository's own.
  for (const [want, phrasing] of [
    ['water', 'priority is water'], ['family', 'priority is family'],
    ['family', 'priority is fewer family repeats'], ['family', 'prioritize fewer family repeats'],
    ['family', 'rerun with fewer family repeats as priority'], ['family', 'the comparison priority is family'],
    ['climate', 'priority is known thermal warnings'], ['climate', 'priority is climate'],
    ['climate', 'my priority is heat warnings'], ['climate', 'prioritize thermal risk'],
    ['climate', 'with climate as the priority'], ['water', 'priority is less historical rain free exposure'],
    ['water', 'compare again with water as the priority'], ['water', 'priority low water use'],
    ['water', 'prioritize saving water'], ['short-season', 'priority is shorter maturity'],
    ['short-season', 'my priority is a shorter season'], ['short-season', 'prioritize early maturity'],
    ['short-season', 'with short season as the priority'],
    ['climate', 'climate priority'], ['water', 'water priority'],
    ['short-season', 'short-season priority'], ['family', 'family priority'],
    ['water', 'water priority please'], ['short-season', 'set a short-season priority'],
    ['climate', 'use known climate priority for the rerun'],
    ['water', 'priority: water'], ['climate', 'priority = climate'],
    ['short-season', 'priority: shorter maturity'], ['water', 'PRIORITY: WATER'],
    ['water', 'set priority to water'], ['climate', 'change the priority to climate'],
    ['', 'priority. water'], ['', 'priority—water'],
    ['', 'I want fewer crop family repeats'], ['', 'I want the shortest season'],
    ['', 'priority is water and fewer family repeats'], ['', 'priority is unclear, just show me the options'],
    ['', 'my farm is short on labour and the season is long'], ['', 'do not change the priority'],
    ['', 'compare with maize after rice'],
    ['', 'priority is unclear, heat warnings worry me'], ['', 'set the priority later, the water is fine here'],
    ['', 'I have no priority yet but the water is short'],
    ['', 'the priority menu is confusing, family farm is the name of my field'],
    ['', 'do not change the priority, just show the shorter season options'],
    ['', 'low priority heat pump install near the water'],
    ['', 'compare again with water as the priority and fewer family repeats']
  ]) assert.equal(pr(phrasing), want, `${phrasing} must set priority to ${want || 'nothing'}`);
  assert.equal(pr('priority is water'), 'water', 'the shipped spelling keeps working');
  assert.equal(pr('my priority is a shorter season'), 'short-season', 'no phrasing may keep the select on its first option silently');
});
