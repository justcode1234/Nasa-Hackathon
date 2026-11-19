import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApiHandler } from '../server/api.js';
import { contextBlocks, composeAnswerBlocks } from '../public/js/lib/chat-context.js';

// Iteration 55: a farmer who has loaded historical evidence at a point, and then asks the assistant about the
// rainfall or soil at that same point, was told "I could not match that request to a supported question or
// planning step" and nothing else - even though the number they asked for is already in the browser and the panel
// has a paragraph that quotes it. Found by replaying the raw upstream bytes inside the `static-desktop` project
// (the first run of these three questions against the real handler instead of a recorded /api/ask payload); the
// stubbed cases could not see it because the recorded payload answers a different question than the one typed,
// and because its `useSelectedLocation` is unset where the shipped handler sets it to false.
//
// The panel's suppression is deliberate in the cases that pin it (tests/chat-context.test.js:75, :118): a reply
// about another country must not have this field's evidence pasted onto it. What is not deliberate is that the
// same flag covers a reply that claims no location at all. These cases hold both halves, so the fix has to be
// the narrow one: an answer may decline the location, but it cannot both decline to answer and hide the reading.
const observations = JSON.parse(readFileSync(new URL('./e2e/fixtures/chat-evidence-observations.json', import.meta.url), 'utf8'));
const soil = JSON.parse(readFileSync(new URL('./e2e/fixtures/chat-evidence-soil.json', import.meta.url), 'utf8'));
const state = { observations, soil };
const body = { latitude: -31.89, longitude: 116.77, referenceYear: 2024, selectedCountry: 'Australia' };
// The point of this file is the handler the app actually ships, with only its two network providers stood in by
// the recorded payloads; no stubbed answer and no plan (`baseline`), which is the state step 1 leaves the farmer in.
const ask = async question => {
  const handle = createApiHandler({ getObservations: async () => observations, getSoil: async () => soil });
  return handle({ method: 'POST', url: new URL('https://fieldshift.local/api/ask'), readJson: async () => ({ ...body, question }) });
};
const rendered = async question => {
  const answer = await ask(question);
  const { blocks, sources } = contextBlocks(question, state, answer);
  return { answer, blocks: composeAnswerBlocks(answer.blocks, blocks), sources };
};

test('a rainfall question about the loaded point quotes the loaded rainfall', async () => {
  for (const question of ['How much rain fell here last year?', 'How much rainfall fell here last year?',
    'How much precipitation fell here last year?', 'Show me rainfall evidence']) {
    const { answer, blocks } = await rendered(question);
    assert.equal(answer.blocks[0].kind, 'clarification',
      `the handler was expected to decline this question, so the premise of the case changed: ${question} -> ${JSON.stringify(answer.blocks)}`);
    const weather = blocks.filter(block => block.kind === 'historical weather evidence');
    assert.equal(weather.length, 1, `${question} rendered ${JSON.stringify(blocks.map(block => block.kind))} with the reading loaded`);
    // The number is the recorded payload's own, not a value chosen here: PRECTOTCORR's latest non-missing day.
    const date = observations.parameters.PRECTOTCORR.latestAvailableDate;
    const value = observations.parameters.PRECTOTCORR.values[observations.dates.indexOf(date)];
    assert.ok(weather[0].text.includes(`is ${value} ${observations.parameters.PRECTOTCORR.units} on ${date}`),
      `the paragraph did not quote the loaded series: ${weather[0].text}`);
    assert.ok(weather[0].text.includes(`${observations.location.latitude}°, ${observations.location.longitude}°`),
      'the paragraph must name the point it describes');
  }
});

test('a soil question about the loaded point quotes the loaded soil model', async () => {
  const { answer, blocks } = await rendered('Is the soil pH acidic here?');
  assert.equal(answer.blocks[0].kind, 'clarification', `premise changed: ${JSON.stringify(answer.blocks)}`);
  assert.ok(blocks.some(block => block.kind === 'regional soil model'),
    `the soil estimate is missing: ${JSON.stringify(blocks.map(block => block.kind))}`);
  assert.ok(blocks.some(block => /^ISRIC advises against/.test(block.text)),
    'the estimate must not arrive without the advisory that qualifies it');
});

// The suppression stays where it earns its place. Each of these is the invented-evidence failure class the
// programme keeps finding, so a fix that widens the gate past the declining answer fails here.
test('a reply about a different country still gets no evidence pasted from this point', async () => {
  const geographic = { schemaVersion: 1, mode: 'deterministic geographic clarification', topic: 'weather',
    useSelectedLocation: false, context: { cropKey: '', country: 'BR' },
    blocks: [{ kind: 'location needed', text: 'For NASA weather evidence in Brazil, choose a town or point there.', sourceIds: [] }], sources: [] };
  assert.deepEqual(contextBlocks('How much rainfall fell here last year?', state, geographic).blocks, [],
    'another country’s weather clarification had this field’s reading added to it');
  const crop = { topic: 'crop', useSelectedLocation: false };
  assert.deepEqual(contextBlocks('Show me rainfall evidence', state, crop).blocks, [],
    'a crop-topic reply had this field’s reading added to it');
  assert.deepEqual(contextBlocks('Show me rainfall evidence', state, { topic: 'greeting' }).blocks, [],
    'a greeting had evidence appended to it');
  // Evidence only reaches the screen when the app actually holds it: no payload, no paragraph, and the reply
  // must say the reading is missing rather than leaving the farmer with silence.
  assert.deepEqual(contextBlocks('How much rainfall fell here last year?', {},
    { topic: 'weather', useSelectedLocation: false, locationScope: 'unmatched' }).blocks, [],
    'an unmatched reply with nothing loaded added a paragraph anyway');
});
