import test from 'node:test';
import assert from 'node:assert/strict';
import { contextBlocks, composeAnswerBlocks } from '../public/js/lib/chat-context.js';
import { PESTS } from '../server/context/pests.js';

const observations = {
  period: { start: '2024-01-01', end: '2024-12-31' },
  dates: ['2024-06-01', '2024-06-02'],
  location: { latitude: -31.89, longitude: 116.77 },
  retrievedAt: '2025-02-01T00:00:00Z',
  source: { id: 'nasa-power', title: 'NASA POWER exact data request', url: 'https://example.invalid/power' },
  parameters: {
    T2M: { label: 'Mean air temperature', units: '°C', latestAvailableDate: '2024-06-02', values: [12.1, 12.9] },
    T2M_MIN: { label: 'Minimum air temperature', units: '°C', latestAvailableDate: '2024-06-02', values: [-1.4, -0.6] },
    PRECTOTCORR: { label: 'Rainfall', units: 'mm/day', latestAvailableDate: '2024-06-02', values: [0, 3.4] },
    ALLSKY_SFC_SW_DWN: { label: 'Solar irradiance', units: 'MJ/m^2/day', latestAvailableDate: '2024-06-02', values: [9.8, 10.2] }
  }
};
const soil = {
  nominalResolutionM: 250, depth: '0–5 cm', retrievedAt: '2025-02-02T00:00:00Z',
  source: { id: 'soilgrids', title: 'ISRIC SoilGrids', url: 'https://example.invalid/soil' },
  properties: [
    { id: 'phh2o', name: 'pH', units: 'pH', mean: 6.1, lower: 5.4, upper: 6.8 },
    { id: 'sand', name: 'Sand', units: '%', mean: 41, lower: 30, upper: 52 },
    { id: 'clay', name: 'Clay', units: '%', mean: 22, lower: 15, upper: 29 }
  ]
};
const water = {
  available: true, period: '2022–23', publishedDate: '2024-06-28',
  rows: [{ category: 'Vegetables', waterAppliedMl: 1200, irrigatedHa: 150, appliedMlPerIrrigatedHa: 8 }],
  source: { id: 'abs-irrigation', title: 'ABS irrigation', url: 'https://example.invalid/abs' }
};
const farm = { name: 'Field 7', crops: ['wheat'], updatedAt: '2023-04-02', sourceUrl: 'https://example.invalid/osm/way/1' };
const pests = {
  country: 'Australia',
  records: [{ id: 'helicoverpa', name: 'Helicoverpa armigera', status: 'present', occurrenceCount: 120, hostNote: 'Recorded on several crops.', sourceUrl: 'https://example.invalid/gbif', hostSource: { id: 'helicoverpa-host', title: 'GBIF host query', url: 'https://example.invalid/gbif/host' } },
    { id: 'armyworm', name: 'Fall armyworm', status: 'present', occurrenceCount: 88, hostNote: 'Recorded on maize.', sourceUrl: 'https://example.invalid/gbif/2', hostSource: { id: 'armyworm-host', title: 'GBIF armyworm host query', url: 'https://example.invalid/gbif/2/host' } },
    { id: 'locust', name: 'Australian plague locust', status: 'present', occurrenceCount: 40, hostNote: 'Recorded on grasses.', sourceUrl: 'https://example.invalid/gbif/3', hostSource: { id: 'locust-host', title: 'GBIF locust host query', url: 'https://example.invalid/gbif/3/host' } }]
};
const fullState = () => ({ observations, soil, water, farm, pests });
const kinds = (question, state = fullState(), answer = { topic: 'crop' }) => contextBlocks(question, state, answer).blocks.map(block => block.kind);

test('a topic word inside a longer word does not add its evidence', () => {
  // "farm" inside farmer used to add a mapped field record to a soil question. Only the field
  // record is loaded here: with soil loaded too, its limitation filled the two-block budget and
  // hid the leak, which is why this case supplies just the field.
  const farmer = kinds('Our farmer reported a soil pH of 6.5; how reliable is that?', { farm });
  assert.deepEqual(farmer, ['limitation'], `field record leaked into ${farmer}`);

  // Naming Australia alone used to displace the answer with the national irrigation ratio.
  const australia = kinds('Tell me about wheat in Australia');
  assert.deepEqual(australia, [], `irrigation or other context leaked into ${australia}`);
});

test('recognised topic words still add their loaded evidence', () => {
  assert.deepEqual(kinds('Show me rainfall evidence'), ['historical weather evidence']);
  assert.ok(kinds('Tell me about the soil pH here').includes('regional soil model'));
  assert.ok(kinds('The drainage here is poor; what does that mean for clay soil?').includes('regional soil model'));
  assert.ok(kinds('Tell me about this farm').includes('mapped field record'));
  assert.ok(kinds('How much water is used for irrigation in Australia?').includes('historical national irrigation context'));
  assert.ok(kinds('Which pests affect wheat?').includes('country occurrence context'));
});

test('a greeting or an answer that must not use the location adds no context', () => {
  assert.deepEqual(kinds('Tell me about wheat in Australia', fullState(), { topic: 'greeting' }), []);
  assert.deepEqual(kinds('Show me rainfall evidence', fullState(), { topic: 'crop', useSelectedLocation: false }), []);
});

// The reply shows at most three paragraphs. Any added context used to replace the API's own
// paragraphs except a limitation, so "Tell me about wheat in this field" answered with the field
// record and dropped the wheat facts completely.
const block = (kind, text) => ({ kind, text, sourceIds: [] });
const cropAnswer = [block('sourced crop facts', 'Wheat belongs to Poaceae…'), block('limitation', 'Crop-specific retrieval covers…')];

test('place, pest and irrigation context supplement the crop answer instead of replacing it', () => {
  assert.deepEqual(composeAnswerBlocks(cropAnswer, [block('mapped field record', 'Field 7.')]).map(b => b.kind),
    ['mapped field record', 'sourced crop facts', 'limitation']);
  assert.deepEqual(composeAnswerBlocks(cropAnswer, [block('country occurrence context', 'Helicoverpa in Australia.')]).map(b => b.kind),
    ['country occurrence context', 'sourced crop facts', 'limitation']);
  const waterAnswer = [block('observation scope', 'POWER precipitation is regional…'), block('limitation', 'Irrigation amount unverified.')];
  assert.deepEqual(composeAnswerBlocks(waterAnswer, [block('historical national irrigation context', 'Vegetables: 8.00 ML/ha.')]).map(b => b.kind),
    ['historical national irrigation context', 'observation scope', 'limitation']);
});

test('weather and soil evidence still stand in for the generic answer', () => {
  const weatherAnswer = [block('observation scope', 'POWER precipitation is regional…'), block('limitation', 'Not current weather.')];
  assert.deepEqual(composeAnswerBlocks(weatherAnswer, [block('historical weather evidence', 'Rainfall: 3.4 mm/day on 2024-06-02.')]).map(b => b.kind),
    ['historical weather evidence', 'limitation']);
  const soilAnswer = [block('rule and limitation', 'Family changes may interrupt shared pest hosts…'), block('limitation', 'Soil tests needed.')];
  assert.deepEqual(composeAnswerBlocks(soilAnswer, [block('regional soil model', 'pH: mean 6.1.'), block('limitation', 'ISRIC advises…')]).map(b => b.kind),
    ['regional soil model', 'limitation']);
  assert.deepEqual(composeAnswerBlocks(cropAnswer, []).map(b => b.kind), ['sourced crop facts', 'limitation']);
});

test('a frost question quotes the minimum air temperature, not the mean', () => {  const { blocks } = contextBlocks('Show me frost evidence', { observations }, { topic: 'weather' });
  assert.equal(blocks.length, 1);
  assert.match(blocks[0].text, /^Minimum air temperature/);
  assert.match(blocks[0].text, /-0\.6 °C on 2024-06-02/);

  // A frost question must not steal the mean from an ordinary temperature question, and a frost
  // question must still answer when the minimum series was never retrieved.
  assert.match(contextBlocks('Show me temperature evidence', { observations }, { topic: 'weather' }).blocks[0].text, /^Mean air temperature/);
  const withoutMinimums = { ...observations, parameters: { T2M: observations.parameters.T2M } };
  assert.match(contextBlocks('Was there a frost?', { observations: withoutMinimums }, { topic: 'weather' }).blocks[0].text, /^Mean air temperature/);
});

// The series selector inside the weather branch used the same substring habit the topic triggers had
// before subsection 17: "farmer training" asked for rainfall, and "minimum wages" and a "defrost
// cycle" asked for the coldest series. All three questions reach the branch through "NASA", so the
// reply quoted a series the farmer never asked about.
test('the weather series is chosen by whole words, not by letters inside other words', () => {
  const series = question => contextBlocks(question, { observations }, { topic: 'weather' }).blocks[0].text.split(':')[0];
  assert.equal(series('Does NASA mention farmer training for wheat?'), 'Mean air temperature');
  assert.equal(series('What does the NASA series say about our minimum wages for staff?'), 'Mean air temperature');
  assert.equal(series('NASA: is a defrost cycle relevant to my pipes?'), 'Mean air temperature');
  assert.equal(series('Show me rainfall evidence'), 'Rainfall');
  assert.equal(series('How much rain fell last spring? NASA figures please'), 'Rainfall');
  assert.equal(series('How strong is the solar evidence here?'), 'Solar irradiance');
  assert.equal(series('What was the lowest temperature the NASA series recorded?'), 'Minimum air temperature');
  assert.equal(series('Show me frost evidence'), 'Minimum air temperature');
});

// The pest trigger is a list of generic nouns, so a farmer who names the insect — which is what farmers
// do — gets nothing: "fall armyworm" is one word (`worms?` cannot match it) and "locust" is not in the
// list at all even though the app has that record loaded. The loaded names are the vocabulary the
// answer is allowed to use, so they have to be able to open the branch and pick their own record.
test('naming a pest the app has a record for opens the pest evidence', () => {
  const asked = question => contextBlocks(question, { pests }, { topic: 'pest' }).blocks
    .filter(b => b.kind === 'country occurrence context').map(b => b.text.split(' in ')[0]);
  assert.deepEqual(asked('How do I control fall armyworm in my maize?'), ['Fall armyworm']);
  assert.deepEqual(asked('Tell me about the Australian plague locust'), ['Australian plague locust']);
  assert.deepEqual(asked('Are locusts a problem here?'), ['Australian plague locust']);
  assert.deepEqual(asked('Which pests affect wheat?'), ['Helicoverpa armigera']);

  // Opening the branch on a name must not turn every sentence about the country into a pest answer.
  assert.deepEqual(asked('Tell me about the Australian grains industry'), []);
  assert.deepEqual(asked('What is the soil pH here?'), []);
});

// The two-block context budget counted limitations, so the sentence saying a SoilGrids number is not a
// farm measurement was the first thing the budget cut: a question naming both the rain and the soil
// printed the mapped pH with only the API's crop caveat, while the identical pH in a soil-only reply
// carried the ISRIC advisory. A caveat qualifies the estimate beside it, so it does not compete with the
// other topics for the same slot; the panel still receives at most three paragraphs.
test('a mapped soil estimate keeps its advisory beside another topic', () => {
  const reply = (question, state) => composeAnswerBlocks(cropAnswer, contextBlocks(question, state, { topic: 'crop' }).blocks);
  const kindsOf = blocks => blocks.map(block => block.kind);

  const mixed = reply('Does the rainfall pattern affect the soil pH here?', { observations, soil });
  assert.ok(mixed.some(block => /ISRIC advises against local\/farm-level use/.test(block.text)),
    `the advisory vanished next to a mapped pH: ${kindsOf(mixed)}`);
  assert.ok(mixed.some(block => block.kind === 'regional soil model') && mixed.some(block => block.kind === 'historical weather evidence'),
    `both asked-for estimates must stay: ${kindsOf(mixed)}`);

  // The advisory must not be bought by silencing the question's own subject: a mapped estimate still
  // stands in for the generic answer, descriptive context still leaves a paragraph for the crop facts,
  // and no combination exceeds the three paragraphs the panel renders.
  for (const [question, state] of [
    ['Tell me about the soil pH here', { soil }],
    ['Show me rainfall evidence', { observations }],
    ['What does this field record say about pests?', fullState()],
    ['Does the soil pH change how much irrigation water I apply?', { soil, water }],
    ['Does the soil pH change how much water I apply on this farm?', { farm, pests }]
  ]) {
    const blocks = reply(question, state);
    assert.ok(blocks.length <= 3, `${question} rendered ${blocks.length} paragraphs: ${kindsOf(blocks)}`);
  }
  const descriptive = reply('What does this field record say about pests?', fullState());
  assert.ok(descriptive.some(block => block.kind === 'sourced crop facts'),
    `the crop answer was pushed out by context: ${kindsOf(descriptive)}`);
  assert.ok(reply('Tell me about the soil pH here', { soil }).some(block => /ISRIC advises/.test(block.text)),
    'the soil-only reply lost its advisory');
});

// Each watchlist entry says which crop it is about (`cropIds`) and the plan says which crops the farmer is
// growing, but the quoted record ignored both: measured against the shipped two-species table, a radish /
// tomato / cabbage plan asking a plain pest question got the maize armyworm paragraph, because the list
// happens to start with it. The entry that matches the plan is the one that can say something about this
// farm; a name typed in the question still beats the plan, and a crop the watchlist does not cover keeps
// the existing first-entry answer rather than inventing a match.
test('the pest record quoted is the one about the crop being planned', () => {
  const records = PESTS.map(pest => ({ ...pest, status: 'Country records found', occurrenceCount: 4213,
    sourceUrl: `https://example.invalid/gbif/${pest.id}`, hostSource: { ...pest.hostSource } }));
  const quoted = planning => contextBlocks('Which pests should I watch for this season?',
    { pests: { country: 'IN', records, retrievedAt: '2026-11-18T00:00:00Z' }, planning }, { topic: 'pest' })
    .blocks.filter(block => block.kind === 'country occurrence context').map(block => block.text.split(' in ')[0]);

  assert.deepEqual(quoted({ baseline: ['radish', 'tomato', 'cabbage'], allowedCrops: [] }), ['Diamondback moth'],
    'a crucifer plan was answered with the maize pest');
  assert.deepEqual(quoted({ baseline: ['wheat', 'sweet-corn', 'rice'], allowedCrops: [] }), ['Fall armyworm'],
    'a maize plan was answered with the radish pest');
  assert.deepEqual(quoted({ baseline: ['wheat', 'barley', 'sorghum'], allowedCrops: ['radish'] }), ['Diamondback moth'],
    'an allowed crop was ignored');
  assert.deepEqual(quoted({ baseline: ['wheat', 'barley', 'sorghum'], allowedCrops: [] }), ['Fall armyworm'],
    'a crop outside the watchlist lost the existing answer');
  assert.deepEqual(quoted(undefined), ['Fall armyworm'], 'a plan that is not filled in yet lost the existing answer');
  assert.deepEqual(contextBlocks('How do I control fall armyworm in my maize?',
    { pests: { country: 'IN', records, retrievedAt: '2026-11-18T00:00:00Z' }, planning: { baseline: ['radish', 'radish', 'radish'], allowedCrops: [] } },
    { topic: 'pest' }).blocks.filter(block => block.kind === 'country occurrence context')
    .map(block => block.text.split(' in ')[0]), ['Fall armyworm'], 'the named insect must beat the planned crop');
});

// Iteration 22 let a loaded record name open the branch through its last word only, and only if that word
// is five letters or longer. Measured against the shipped watchlist on a maize plan (so iteration 24's crop
// match cannot rescue it): "Is the diamondback pressure high this year?" answered with nothing at all,
// because the head noun "moth" is four letters and the distinguishing word is the modifier; and "do moths
// matter here?" opened the branch through the generic trigger and then quoted the *armyworm*. A short head
// noun is too generic to name a pest on its own, but the word in front of it is exactly what makes the
// species unique — so that is the word the matcher uses when the head is short.
test('a pest is found by the word that makes its name unique', () => {
  const records = PESTS.map(pest => ({ ...pest, status: 'Country records found', occurrenceCount: 4213,
    sourceUrl: `https://example.invalid/gbif/${pest.id}`, hostSource: { ...pest.hostSource } }));
  const maizePlan = { pests: { country: 'IN', records, retrievedAt: '2026-11-18T00:00:00Z' },
    planning: { baseline: ['wheat', 'barley', 'sorghum'], allowedCrops: [] } };
  const quoted = question => contextBlocks(question, maizePlan, { topic: 'pest' }).blocks
    .filter(block => block.kind === 'country occurrence context').map(block => block.text.split(' in ')[0]);

  assert.deepEqual(quoted('Is the diamondback pressure high this year?'), ['Diamondback moth'],
    'the distinguishing word of a record name was invisible to the matcher');
  assert.deepEqual(quoted('do moths matter here?'), ['Diamondback moth'],
    'a moth question was answered with the armyworm record');

  // The specificity rule must not open the branch on words that are not about a pest at all: "Fall" is a
  // season, and a geographic adjective names a place rather than a species (iteration 22's leak).
  assert.deepEqual(quoted('Should I sow in the fall or the spring?'), []);
  assert.deepEqual(quoted('Tell me about the Australian grains industry'), []);
});
