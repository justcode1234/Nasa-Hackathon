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
  records: [{ id: 'helicoverpa', name: 'Helicoverpa', status: 'present', occurrenceCount: 120, hostNote: 'Recorded on several crops.', sourceUrl: 'https://example.invalid/gbif', hostSource: { id: 'helicoverpa-host', title: 'GBIF host query', url: 'https://example.invalid/gbif/host' } }]
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
