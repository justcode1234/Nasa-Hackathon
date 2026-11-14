export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
export const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export const normalizeName = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const aliases = { SG: ['singapore'], US: ['united states', 'united states of america', 'usa', 'u s a'],
  GB: ['united kingdom', 'uk', 'britain', 'great britain'], AE: ['uae', 'united arab emirates'],
  KR: ['south korea'], KP: ['north korea'], CI: ['ivory coast'], CZ: ['czech republic'] };
const names = COUNTRY_CODES.flatMap(country => [...new Set([COUNTRY_NAMES.of(country), ...(aliases[country] ?? [])])]
  .map(name => ({ country, name: normalizeName(name) }))).sort((a, b) => b.name.length - a.name.length);
export function findCountries(value) {
  const text = normalizeName(value), spans = [], countries = new Set();
  for (const entry of names) {
    const start = (` ${text} `).indexOf(` ${entry.name} `), end = start + entry.name.length + 1;
    if (start < 0 || spans.some(span => start < span.end && end > span.start)) continue;
    spans.push({ start, end }); countries.add(entry.country);
  }
  const code = /\b(?:in|from)\s+(sg|us|usa|uk|uae)\b/.exec(text)?.[1];
  if (code) countries.add({ sg: 'SG', us: 'US', usa: 'US', uk: 'GB', uae: 'AE' }[code]);
  return [...countries];
}
