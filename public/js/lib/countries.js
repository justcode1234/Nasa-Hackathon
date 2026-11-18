export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
export const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export const normalizeName = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
// Intl shortens compound region names ("Antigua & Barbuda") and abbreviates "Saint", while a
// farmer writes the long official form. Matching both sides in one canonical shape is the only
// way to keep whole-phrase matching: the longer entry still wins over the "Georgia" inside
// "South Georgia and the South Sandwich Islands".
export const regionPhrase = value => normalizeName(value)
  .normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/\b(?:st|ste|sint)\b/g, 'saint')
  .split(' ').filter(word => word !== 'and' && word !== 'of' && word !== 'the').join(' ');
// Exported so a test can prove the other-runtime spellings are in the runtime-independent list itself:
// on Node those names also happen to come from Intl, so resolving them alone would not catch their
// removal here.
export const aliases = { SG: ['singapore'], US: ['united states', 'united states of america', 'usa', 'u s a'],
  GB: ['united kingdom', 'uk', 'britain', 'great britain'], AE: ['uae', 'united arab emirates'],
  KR: ['south korea'], KP: ['north korea'], CI: ['ivory coast'], CZ: ['czech republic'],
  // "South Georgia" is not the country Georgia; the shorter dependent name must win the span.
  GS: ['south georgia'],
  // The other runtime's spelling and the names our own sources use. Intl differs between engines
  // (measured 18 Nov: Chrome "en" says "Palestine"/"Hong Kong"/"Falkland Islands (Islas Malvinas)",
  // Node says "Palestinian Territories"/"Hong Kong SAR China"/"Falkland Islands"), the FAO labels in
  // server/context/country-crops.json read "China, Hong Kong SAR", "China, Macao SAR", "Palestine",
  // "Viet Nam" and "North Macedonia", and "Chinese Taipei" is the FAO/IOC name for TW that no Intl
  // table returns. Cabo Verde, Holy See, Turkey, Burma, East Timor and Swaziland are official or
  // recently-replaced ISO 3166 short names where the table prints another form.
  TW: ['chinese taipei'], HK: ['hong kong', 'hong kong sar china', 'china, hong kong sar'],
  MO: ['macao', 'macau', 'macao sar china', 'china, macao sar'],
  // Measured in Chrome on the full-matrix probe: a farmer who types the spelling another runtime prints
  // ("Hong Kong SAR China", "Macao SAR China", "Palestinian Territories") got a reply with no button,
  // because only this runtime's short name is in the table and the long form was not in the alias list.
  PS: ['palestine', 'palestinian territories'], VN: ['viet nam'], MK: ['macedonia'], CV: ['cabo verde'], VA: ['holy see'],
  TR: ['turkey'], MM: ['burma'], TL: ['east timor'], SZ: ['swaziland'],
  // The dependent territories whose ISO spelling puts the qualifier first or last, so no table's phrase
  // order matches what a farmer actually types ("Virgin Islands, U.S." is the ISO 3166-1 short name).
  VI: ['united states virgin islands', 'virgin islands, u.s.'], VG: ['british virgin islands', 'virgin islands, british'],
  UM: ['united states outlying islands'] };
// A parenthetical display name ("Myanmar (Burma)", "Cocos (Keeling) Islands") only matches its whole
// contiguous phrase, so either half typed alone resolved to no country at all. Each name therefore
// contributes the full phrase, the phrase without the parenthesis, and the parenthesis on its own.
const nameForms = name => {
  const parts = /^(.*)\((.*)\)(.*)$/.exec(name.trim());
  if (!parts) return [name];
  const [before, inside, after] = [parts[1], parts[2], parts[3]].map(part => part.trim().replace(/\s+/g, ' '));
  return [`${before} ${inside} ${after}`.trim(), `${before} ${after}`.trim(), inside].filter(Boolean);
};
// Intl's spelling is a property of the runtime, not of the country, and world-English adds the forms
// some engines omit. Merging the tables means one typed wording resolves in every browser.
const otherTables = ['en-001'].map(locale => new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' }));
const displayNames = country => [...new Set([COUNTRY_NAMES, ...otherTables]
  .map(table => table.of(country)).filter(name => name && !/^[A-Z]{2}$/.test(name)))];
// Every wording that resolves to one country code, exported so the tests can prove the whole table
// rather than a hand-picked list.
export const countryNameForms = country => [...new Set([...displayNames(country).flatMap(nameForms), ...(aliases[country] ?? [])])];
const names = COUNTRY_CODES.flatMap(country => countryNameForms(country).map(name => ({ country, name: regionPhrase(name) })))
  .filter(entry => entry.name).sort((a, b) => b.name.length - a.name.length);
export function findCountries(value) {
  const text = regionPhrase(value), spans = [], countries = new Set();
  const claim = word => {
    const start = (` ${text} `).indexOf(` ${word} `), end = start + word.length + 1;
    if (start < 0 || spans.some(span => start < span.end && end > span.start)) return false;
    spans.push({ start, end }); return true;
  };
  for (const entry of names) if (claim(entry.name)) countries.add(entry.country);
  // "in US Virgin Islands" is one country, not the United States plus a fragment of a longer name:
  // a bare abbreviation only counts when no full display name already claimed that span.
  const abbreviation = /\b(?:in|from)\s+(sg|us|usa|uk|uae)\b/.exec(text);
  if (abbreviation && claim(abbreviation[1])) countries.add({ sg: 'SG', us: 'US', usa: 'US', uk: 'GB', uae: 'AE' }[abbreviation[1]]);
  return [...countries];
}
