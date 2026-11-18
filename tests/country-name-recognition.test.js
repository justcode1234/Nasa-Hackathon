// Country-name recognition. The step-1 picker labels and the chat both come from Intl, but Intl's
// spelling is a property of the runtime's ICU build, not of the country, and some official spellings
// (the FAO names in server/context/country-crops.json, "Chinese Taipei") exist in no table at all.
// These tests prove the whole recognised table resolves, that the known alternate spellings survive
// a runtime change, and that the shorter name never swallows a longer one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_CODES, COUNTRY_NAMES, countryNameForms, findCountries } from '../public/js/lib/countries.js';
import { makeAssistant, textOf } from './helpers/matrix-harness.js';

test('every country spelling the app recognises resolves to that country and to no other', () => {
  const failures = [];
  let forms = 0;
  for (const code of COUNTRY_CODES) {
    const known = countryNameForms(code);
    assert.ok(known.length > 0, `${code} has no spelling the chat can recognise`);
    forms += known.length;
    for (const form of known) {
      const hits = findCountries(`Help me plan a rotation in ${form}`);
      if (hits.length !== 1 || hits[0] !== code) failures.push(`${code} "${form}" -> ${hits.join(',') || 'nothing'}`);
    }
  }
  // Measured: 297 spellings on Node, more on engines whose tables keep the parenthetical halves.
  assert.ok(forms > COUNTRY_CODES.length, `only ${forms} spellings for ${COUNTRY_CODES.length} codes`);
  assert.deepEqual(failures.slice(0, 10), [], `${failures.length} recognised spellings do not resolve to one country`);
});

test('the spellings another engine or our own sources use still resolve', () => {
  // Measured on 18 Nov: Node v22/v24 and Chrome disagree on PS, HK, MO and FK, the FAO records label
  // five of them differently, and "Chinese Taipei" is in neither table. Chrome's "Falkland Islands
  // (Islas Malvinas)" and its "Keeling"-style parenthetical halves are covered generically by the
  // test above, because that one walks whichever forms this runtime's tables actually publish.
  const wanted = { PS: ['Palestinian Territories', 'Palestine'], HK: ['Hong Kong SAR China', 'Hong Kong', 'China, Hong Kong SAR'],
    MO: ['Macao SAR China', 'Macao', 'Macau', 'China, Macao SAR'], TW: ['Taiwan', 'Chinese Taipei'],
    FK: ['Falkland Islands'], VN: ['Vietnam', 'Viet Nam'],
    MK: ['North Macedonia', 'Macedonia'], MM: ['Myanmar', 'Myanmar (Burma)', 'Burma'], CC: ['Cocos (Keeling) Islands', 'Cocos Islands', 'Keeling'],
    CV: ['Cape Verde', 'Cabo Verde'], VA: ['Vatican City', 'Holy See'], TR: ['Türkiye', 'Turkey'],
    SZ: ['Eswatini', 'Swaziland'], TL: ['Timor-Leste', 'East Timor'], VI: ['Virgin Islands, U.S.', 'US Virgin Islands', 'United States Virgin Islands'],
    VG: ['Virgin Islands, British', 'British Virgin Islands'], UM: ['US Outlying Islands', 'United States Outlying Islands'],
    BQ: ['Caribbean Netherlands'], GS: ['South Georgia and the South Sandwich Islands', 'South Georgia'] };
  for (const [code, names] of Object.entries(wanted)) {
    for (const name of names) {
      const hits = findCountries(`Help me plan a rotation in ${name}`);
      assert.ok(hits.includes(code), `"${name}" resolved to ${JSON.stringify(hits)}, expected ${code}`);
    }
  }
  assert.equal(findCountries('Help me plan a rotation in Chinese Taipei').join(), 'TW',
    'the country step cannot be finished from the chat for the FAO/IOC name');
});

test('a shorter country name never absorbs a longer one, and no other wording invents a country', () => {
  const single = { 'South Georgia and the South Sandwich Islands': 'GS', 'South Georgia': 'GS', Georgia: 'GE',
    'the Republic of Georgia': 'GE', 'United States Virgin Islands': 'VI', 'British Virgin Islands': 'VG',
    'Caribbean Netherlands': 'BQ', 'Curaçao': 'CW', Netherlands: 'NL', China: 'CN', 'Chinese Taipei': 'TW',
    'China, Hong Kong SAR': 'HK', 'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC',
    'Saint Helena, Ascension and Tristan da Cunha': 'SH', 'Saint Martin': 'MF', 'Sint Maarten': 'SX',
    'Papua New Guinea': 'PG', 'Equatorial Guinea': 'GQ', Guinea: 'GN', 'Guinea-Bissau': 'GW', Palestine: 'PS',
    'United States': 'US', 'the United States of America': 'US', UK: 'GB', UAE: 'AE' };
  for (const [name, code] of Object.entries(single))
    assert.equal(findCountries(`Help me plan a rotation in ${name}`).join(), code, `"${name}" is not ${code} alone`);
  for (const noise of ['moonfruit', 'a place I did not name', 'the river basin'])
    assert.deepEqual(findCountries(`Help me plan a rotation in ${noise}`), [], `"${noise}" matched a country`);
});

test('the guided flow finishes step 1 from a name no Intl table returns', async () => {
  const { assistant, state } = makeAssistant();
  const answer = await assistant.respond('Help me plan a rotation in Chinese Taipei for rice and wheat');
  assert.equal(state.country, 'TW');
  assert.doesNotMatch(textOf(answer), /Which country should we look at\?/,
    'the chat still asks for the country it just matched');
});
