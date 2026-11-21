import test from 'node:test';
import assert from 'node:assert/strict';
import { answerConversation } from '../server/agronomy/conversation.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';
import { COUNTRY_CODES, COUNTRY_NAMES, countryNameForms } from '../public/js/lib/countries.js';
import { makeAssistant, textOf } from './helpers/matrix-harness.js';

const text = answer => answer.blocks.map(block => block.text).join('\n');
const ask = (question, context) => answerConversation(question, { country: 'AU', context });

test('greetings and thanks remain brief and need no scientific sources', () => {
  for (const question of ['hi', 'Hello!', 'hey', 'Good morning', 'thanks']) {
    const answer = ask(question);
    assert.equal(answer.topic, 'greeting');
    assert.equal(answer.blocks.length, 1);
    assert.deepEqual(answer.sources, []);
    assert.ok(text(answer).length < 150);
  }
});

test('kai lan from Singapore is sourced independently of the selected country', () => {
  for (const name of ['kai lan', 'kai-lan', 'kailan', 'gai lan', 'Chinese broccoli']) {
    const answer = ask(`tell me about ${name} from singapore\n\\`);
    assert.deepEqual(answer.context, { cropKey: 'kai-lan', country: 'SG' });
    assert.match(text(answer), /NParks.*Singapore/);
    assert.ok(answer.sources.some(source => source.id === 'nparks-leafy'));
    assert.doesNotMatch(text(answer), /FAOSTAT records|NASA|21–55/);
    assert.equal(answer.useSelectedLocation, false);
  }
  assert.equal(catalog.crops.some(crop => crop.id === 'kai-lan'), false);
});

test('topic buttons and typed follow-ups retrieve one part of crop knowledge at a time', () => {
  const overview = ask('Tell me about kai lan in Singapore');
  const conditions = ask(overview.followUps.find(choice => choice.label === 'Growing conditions').question, overview.context);
  assert.equal(conditions.topic, 'conditions');
  assert.match(text(conditions), /full sun/);
  assert.doesNotMatch(text(conditions), /21–55|tonnes/);
  const harvest = ask('How long does it take to harvest?', overview.context);
  assert.equal(harvest.context.cropKey, 'kai-lan');
  assert.match(text(harvest), /21–55/);
  assert.doesNotMatch(text(harvest), /full sun/);
});

test('common crop-country pairs resolve to their actual national records', () => {
  for (const [question, country, cropKey, item] of [
    ['rice in India', 'IN', 'rice', '27'], ['wheat in Australia', 'AU', 'wheat', '15'],
    ['tomatoes in Kenya', 'KE', 'tomato', '388'], ['soybeans in Brazil', 'BR', 'fao-236', '236'],
    ['cassava in Ghana', 'GH', 'fao-125', '125'], ['maize in the United States', 'US', 'fao-56', '56']
  ]) {
    const overview = ask(question);
    assert.deepEqual(overview.context, { cropKey, country }, question);
    const answer = ask(`Show me production statistics for ${question}`);
    const record = getCountryCrops({ country }).records.find(record => String(record.itemCode) === item);
    assert.ok(record, question);
    assert.match(text(answer), new RegExp(record.tonnes.toLocaleString('en-US').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text(answer), /national.*not field yield/);
    assert.ok(answer.sources.some(source => source.id === 'faostat-qcl'));
  }
});

test('a country-only follow-up keeps the crop while a named new crop changes it', () => {
  const context = ask('rice in India').context;
  assert.deepEqual(ask('What about Japan?', context).context, { cropKey: 'rice', country: 'JP' });
  assert.deepEqual(ask('wheat in Canada', context).context, { cropKey: 'wheat', country: 'CA' });
  assert.equal(ask('Tell me about moonfruit in Canada', context).topic, 'clarification');
  assert.equal(ask('What about moonfruit in Canada', context).topic, 'clarification');
});

test('national production and source-region references do not become local cultivation proof', () => {
  const answer = ask('What growing conditions does wheat need in Australia?');
  assert.match(text(answer), /Minnesota/);
  assert.match(text(answer), /not valid|unverified|do not verify/);
  const otherCountry = ask('kai lan in Norway');
  assert.match(text(otherCountry), /Singapore.*Norway-specific.*not verified/);
  const missing = ask('rice in Antarctica');
  assert.match(text(missing), /missing coverage, not proof/);
  const kaiProduction = ask('kai lan production in Singapore');
  assert.match(text(kaiProduction), /no kai-lan-specific national production/);
  assert.doesNotMatch(text(kaiProduction), /FAOSTAT records .* t/);
});

test('named-country weather never reuses observations for a different map country', () => {
  for (const question of ['rice weather in India', 'Show me rainfall in India']) {
    const answer = ask(question);
    assert.equal(answer.useSelectedLocation, false);
    assert.match(text(answer), /choose a town or point there/);
    assert.deepEqual(answer.sources, []);
  }
  const answer = ask('Show me rainfall', ask('rice in India').context);
  assert.equal(answer.useSelectedLocation, false);
  assert.match(text(answer), /India/);
});

test('country names use complete matches and ask for a focus when two are named', () => {
  assert.equal(ask('rice in Guinea-Bissau').context.country, 'GW');
  assert.equal(ask('rice in Equatorial Guinea').context.country, 'GQ');
  assert.equal(ask('Tell us about rice in India').context.country, 'IN');
  const answer = ask('rice in India and Japan');
  assert.equal(answer.topic, 'clarification');
  assert.equal(ask(answer.followUps.find(choice => choice.label === 'Japan').question).context.country, 'JP');
});

test('answers stay bounded and every visible source ID resolves once', () => {
  for (const question of ['kai lan in Singapore', 'rice in India', 'wheat in Australia', 'tomato rotation in Kenya',
    'maize harvest in France', 'soybean growing conditions in Brazil', 'mango in India']) {
    const answer = ask(question);
    assert.ok(answer.blocks.length <= 3, question);
    assert.ok(answer.followUps.length <= 3, question);
    assert.ok(text(answer).split(/\s+/).length < 180, question);
    const ids = answer.blocks.flatMap(block => block.sourceIds);
    assert.deepEqual([...new Set(answer.sources.map(source => source.id))].sort(), [...new Set(ids)].sort());
    assert.ok(answer.followUps.every(choice => choice.label.length < 30));
  }
});

// Iteration 68, queue item F8. A message that is nothing but a country name reached the sentence above as
// if the farmer had named a crop: `docs/evidence/iter66-f1-page-probe-2026-11-20.log.gz` records the page
// answering “Georgia” with “I could not match that crop to a sourced entry for Georgia.” and `buttons=[]`,
// and `docs/evidence/iter68-f8-probe-2026-11-21.log.gz` measures that shape on all 302 spellings this
// runtime’s tables publish. The guided place switch cannot intercept it — `exactPlaceRow`
// (public/js/modules/workflow-assistant.js) reads a saved list only once a country is held — so the
// sentence is what had to change, and the change belongs here because one handler answers both transports.
test('a message that is only a country name is answered as a place, not as a crop', () => {
  for (const code of ['GE', 'US', 'AE', 'CV', 'TW']) {
    for (const form of [COUNTRY_NAMES.of(code), ...countryNameForms(code).filter(name => !/[A-Z]/.test(name))].slice(0, 3)) {
      const answer = answerConversation(form, { country: '' });
      const name = COUNTRY_NAMES.of(code);
      assert.equal(answer.mode, 'deterministic country-name clarification', `${code} "${form}"`);
      assert.doesNotMatch(text(answer), /could not match that crop/i, `${code} "${form}" is not a crop question`);
      assert.ok(text(answer).includes(`“${name}” is a country this assistant recognises`), `${code} "${form}": ${text(answer)}`);
      assert.ok(text(answer).includes('saved place list of the country chosen in step 1'), `${code} "${form}": ${text(answer)}`);
      assert.equal(answer.useSelectedLocation, false, code);
      assert.deepEqual(answer.followUps, [{ label: `Plan a rotation in ${name}`, question: `Plan a rotation in ${name}` }], code);
      assert.ok(answer.blocks.length === 1 && answer.sources.length === 0, `${code} claims evidence it does not cite`);
    }
  }
});

// The whole table rather than five picked codes, because the defect was in a branch every country reaches.
test('no recognised country spelling is answered as a crop question', () => {
  const wrong = [];
  let forms = 0;
  for (const code of COUNTRY_CODES) {
    for (const form of countryNameForms(code)) {
      if (!form.trim()) continue;
      forms++;
      if (/could not match that crop/i.test(text(answerConversation(form, { country: '' })))) wrong.push(`${code} "${form}"`);
    }
  }
  assert.ok(forms > COUNTRY_CODES.length, `only ${forms} spellings for ${COUNTRY_CODES.length} codes`);
  assert.deepEqual(wrong.slice(0, 10), [], `${wrong.length} of ${forms} country spellings were answered as a crop`);
});

// A reply that offers a way on only counts as a way on if tapping it moves the app. This drives the
// sentence’s own button through the guided assistant the page uses, with no country held at the start.
test('the country name reply offers a button that opens the plan on that country', async () => {
  const { assistant, state } = makeAssistant();
  assert.equal(await assistant.respond('Georgia'), null, 'the guided layer still declines a bare name with nothing held');
  assert.equal(state.country, '', 'and it selects no country while doing so');
  const [offer] = answerConversation('Georgia', { country: '' }).followUps;
  const opened = await assistant.respond(offer.question);
  assert.ok(opened, `the sentence offers “${offer.question}”, which the app cannot answer`);
  assert.equal(state.country, 'GE', 'tapping the offer lands the farmer in the country the offer named');
  assert.match(textOf(opened), /Georgia/);
});

// The sentence the fix replaced was written for a real case, and that case must keep its answer.
test('an unmatched crop is still answered as a crop question', () => {
  for (const [question, countryName] of [['Tell me about moonfruit in Canada', 'Canada'], ['moonfruit in Ghana', 'Ghana']]) {
    const answer = answerConversation(question, { country: '' });
    assert.equal(answer.mode, 'deterministic conversational clarification', question);
    assert.match(text(answer), /could not match that crop to a sourced entry/i, question);
    assert.ok(text(answer).includes(`for ${countryName}`), question);
    assert.deepEqual(answer.followUps, [], question);
  }
  assert.equal(answerConversation('moonfruit', { country: '' }), null, 'a bare word that names no country reaches the catalog fallback');
});
