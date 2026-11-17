// Deep coverage audit: every saved town and region name in every country, through the same
// matchers the browser runs. npm test keeps a bounded sample; this script is the full scan.
//   node scripts/audit-matrix.js            bounded per-country view
//   node scripts/audit-matrix.js --deep     all 70k town names (minutes, single process)
import { mkdir, writeFile } from 'node:fs/promises';
import { COUNTRY_CODES, COUNTRY_NAMES, normalizeName, regionPhrase } from '../public/js/lib/countries.js';
import { typedPlace } from '../public/js/modules/workflow-assistant.js';
import { countryPhrasings, driveAssistant, listCountries, locations, makeAssistant, textOf } from '../tests/helpers/matrix-harness.js';

const deep = process.argv.includes('--deep');
// Country recognition is checked for every supported code, not only the 245 with a saved place list:
// the uninhabited codes (AQ, BV, HM, IO, UM) are reachable by typing their names and must resolve too.
const allCodes = [...new Set([...listCountries, ...COUNTRY_CODES])].sort();
const started = Date.now();
const rows = [], sentenceChecks = [];
let totalPlaces = 0, matched = 0, eponymous = 0, tooLong = 0, defects = [], unboundedNames = 0;

for (const country of listCountries) {
  const list = await locations({ country }), countryName = COUNTRY_NAMES.of(country);
  const namedRegions = list.regions.filter(region => region.name && normalizeName(region.name) !== normalizeName(countryName));
  const allowEponymous = namedRegions.length === 0;
  const unique = new Map();
  for (const place of list.places) if (!unique.has(normalizeName(place.name))) unique.set(normalizeName(place.name), place);
  const names = [...unique.values()];
  totalPlaces += list.places.length;
  const before = { matched, eponymous, tooLong };
  const long = [];
  for (const place of (deep ? names : names.slice(0, 25))) {
    if (typedPlace(list, `Use ${place.name}`, { countryName, allowEponymous }).some(match => match.id === place.id) ||
      typedPlace(list, `in ${place.name}`, { countryName, allowEponymous }).some(match => match.id === place.id)) { matched++; continue; }
    if (regionPhrase(place.name) === regionPhrase(countryName)) { eponymous++; continue; }
    tooLong++; long.push(place);
  }
  unboundedNames += deep ? long.length : 0;
  // The engine accepts a reply that equals a saved row exactly, whatever its length; verify that
  // on the real assistant rather than assuming it from the matcher.
  for (const place of (deep ? long : long.slice(0, 2))) {
    const { assistant, state } = makeAssistant();
    await assistant.respond(`Help me plan a rotation in ${countryName}`);
    const answer = await assistant.respond(place.name);
    const text = answer ? textOf(answer) : '';
    const selected = Boolean(state.location) || /Which one do you mean/.test(text);
    sentenceChecks.push({ country, name: place.name, selected });
    if (!selected) defects.push({ country, name: place.name, reason: `no reply path selects this town: ${text.slice(0, 70) || '(no reply)'}` });
  }
  rows.push({ country, places: list.places.length, uniqueNames: names.length, regions: namedRegions.length,
    checked: names.length - (deep ? 0 : Math.max(0, names.length - 25)), scanned: matched - before.matched + (matched - before.matched === 0 ? 0 : 0) });
}

const flows = [];
for (const country of listCountries) {
  const { assistant, calls } = makeAssistant();
  const result = await driveAssistant(assistant, `Help me plan a rotation in ${COUNTRY_NAMES.of(country)}. Crops: rice, wheat, beans. Rainfed`);
  const text = textOf(result.replies.at(-1) ?? { blocks: [] });
  flows.push({ country, status: result.status, replies: result.replies.length, screened: result.replies.length && calls.includes('compare') ? 'compared' : 'not compared', text: text.slice(0, 140) });
}
// Naming only the country must never be read as a place choice, because a region or town can sit
// inside the country name itself (“Príncipe” in “São Tomé and Príncipe”). The reply also has to keep
// a button, or the farmer cannot continue from the chat.
const nationalScope = [];
for (const country of allCodes) {
  const { assistant, calls } = makeAssistant();
  const answer = await assistant.respond(`Help me plan a rotation in ${COUNTRY_NAMES.of(country)}. Crops: rice, wheat, beans. Rainfed`);
  const picked = calls.filter(call => call === 'region' || call === 'location');
  if (picked.length || !answer?.followUps.length) {
    const text = textOf(answer ?? { blocks: [] }).slice(0, 90);
    nationalScope.push({ country, picked, text });
    defects.push({ country, name: '(a sentence naming only the country)',
      reason: picked.length ? `${picked.join('+')} picked from the country spelling: ${text}` : `reply offers no button: ${text}` });
  }
}
const countryNames = [];
for (const country of allCodes) for (const phrase of countryPhrasings(country)) {
  const found = (await import('../public/js/lib/countries.js')).findCountries(`Help me plan a rotation in ${phrase}`);
  if (found.length !== 1 || found[0] !== country) countryNames.push({ country, phrase, found });
}
const summary = { generatedAt: new Date().toISOString(), mode: deep ? 'deep' : 'bounded', elapsedMs: Date.now() - started,
  countries: listCountries.length, totalPlaces, matched, eponymousSkipped: eponymous, tooLongForShortReply: tooLong,
  countryOnlyChecked: allCodes.length,
  defects, flowStatuses: flows.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }), {}),
  ambiguousCountryNames: countryNames, exampleRows: rows.slice(0, 12) };
await mkdir(new URL('../artifacts/matrix/', import.meta.url), { recursive: true });
await writeFile(new URL(`../artifacts/matrix/${deep ? 'deep' : 'bounded'}-scan.json`, import.meta.url), JSON.stringify({ ...summary, flows, sentenceChecks: sentenceChecks.slice(0, 400) }, null, 2));
console.log(JSON.stringify({ mode: summary.mode, countries: summary.countries, totalPlaces: summary.totalPlaces, matched: summary.matched,
  eponymousSkipped: summary.eponymousSkipped, tooLongForShortReply: summary.tooLongForShortReply, defects: summary.defects.length,
  ambiguousCountryNames: summary.ambiguousCountryNames.length, flowStatuses: summary.flowStatuses, elapsedMs: summary.elapsedMs }, null, 2));
for (const defect of summary.defects.slice(0, 20)) console.log(`DEFECT ${defect.country}: ${defect.name} — ${defect.reason}`);
for (const row of flows.filter(flow => flow.status !== 'terminal' && flow.status !== 'handoff').slice(0, 20)) console.log(`FLOW ${row.country}: ${row.status} — ${row.text}`);
if (summary.defects.length || summary.ambiguousCountryNames.length) process.exitCode = 1;
