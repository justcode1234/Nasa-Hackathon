// Measures how the hemisphere route treats coordinates whose halves are whole degrees with no degree mark.
// Run with: node scripts/chat-coordinate-probe.mjs [path-to-workflow-assistant.js], from the repository root.
// Written in iteration 36 as artifacts/iter36-coordinate-probe.mjs; moved here in iteration 60 because
// docs/validation.md calls it "one command" and a clone never had the file.
import { pathToFileURL } from 'node:url';
const { parseWorkflowMessage } = await import(pathToFileURL(process.argv[2] ?? process.cwd() + '/public/js/modules/workflow-assistant.js').href);

const at = tail => parseWorkflowMessage(`Help me plan a rotation in India. Crops: rice, cabbage, tomato. ${tail}`)?.location ?? null;
const CASES = [
  // Farmer-shaped ways of writing the pin itself. Each one is what the recorded defect says is refused today.
  ['what can I grow at 37N 127E', { latitude: 37, longitude: 127 }],
  ['at 18N 73E', { latitude: 18, longitude: 73 }],
  ['the point is 33S 70W', { latitude: -33, longitude: -70 }],
  ['18N, 73E', { latitude: 18, longitude: 73 }],
  ['37N; 127E', { latitude: 37, longitude: 127 }],
  ['127E 37N', { latitude: 37, longitude: 127 }],
  ['at 37N 127E with rice', { latitude: 37, longitude: 127 }],
  // Shapes the module already accepts, re-run so a fix cannot quietly narrow them.
  ['at 37°N 127°E', { latitude: 37, longitude: 127 }],
  ['at 35.9 N 14.4 E', { latitude: 35.9, longitude: 14.4 }],
  ['the point is 18.52N 73.85E right now', { latitude: 18.52, longitude: 73.85 }],
  ['18,52 N 73,85 E', { latitude: 18.52, longitude: 73.85 }],
  ['at 23,55 S, 46,63 W', { latitude: -23.55, longitude: -46.63 }],
  ['lat 18.52 lon 73.85', { latitude: 18.52, longitude: 73.85 }],
  ['at 18.52, 73.85', { latitude: 18.52, longitude: 73.85 }],
  ['at 18, 52', { latitude: 18, longitude: 52 }],
  // Neighbours that must stay closed: measurements that merely happen to carry the letters N and E.
  ['use 4N fertilizer on the 15E slope', null],
  ['apply 20.5 N per hectare and 12.4 E of lime', null],
  ['seed rate 3.5 N and 2.1 E per kg', { latitude: 3.5, longitude: 2.1 }],
  ['seed rate 4 N and 2 E per kg', null],
  // With a location lead-in in front of them, whole degrees joined by "and" are the same point said twice; without
  // one (the case above) the same connector is a list of two rates. Measured, not assumed.
  ['what can I grow at 37N and 127E', { latitude: 37, longitude: 127 }],
  ['a field 40 km north of town', null],
  ['top dress 60 N and 30 S per hectare', null],
  ['sow 12 rows at 3N spacing on 9E slopes', null],
  ['salinity 3,7 dS/m', null],
  ['soil pH 6,2 here', null],
];
// A reply to the app's own step-1 question "enter your farm coordinates" is the pair alone, with no sentence in
// front of it, so it is parsed against the whole message rather than the rotation prompt above.
const STANDALONE = [['18N 73E', { latitude: 18, longitude: 73 }], ['37N 127E', { latitude: 37, longitude: 127 }]];
let opened = 0, matched = 0, total = 0;
for (const [text, expected] of CASES) {
  const actual = at(text);
  const ok = expected == null ? actual == null : JSON.stringify(actual) === JSON.stringify(expected);
  matched += ok ? 1 : 0;
  opened += actual ? 1 : 0;
  total++;
  console.log(`${ok ? 'MATCH ' : 'DIFFER'} | ${JSON.stringify(text)} | expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}
for (const [text, expected] of STANDALONE) {
  const actual = parseWorkflowMessage(text, true)?.location ?? null;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  matched += ok ? 1 : 0;
  opened += actual ? 1 : 0;
  total++;
  console.log(`${ok ? 'MATCH ' : 'DIFFER'} | standalone ${JSON.stringify(text)} | expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}
console.log(`\n${matched}/${total} as expected · ${opened}/${total} produced a location · module ${process.argv[2] ?? 'public/'}`);
