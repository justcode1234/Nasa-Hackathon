import test from 'node:test';
import assert from 'node:assert/strict';
import { contextBlocks, composeAnswerBlocks } from '../public/js/lib/chat-context.js';

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
