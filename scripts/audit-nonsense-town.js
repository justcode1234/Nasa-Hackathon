// Feed an unknown town at every pending position of the guided plan, for every saved country list, and
// require a way forward. Usage: node scripts/audit-nonsense-town.js
// A reply is acceptable when it offers a tappable choice. The guided module deliberately answers nothing
// it cannot ground in the saved list — once a point is already chosen, a bare word is ambiguous between
// a town and a crop — so those cases are counted as deferred, and they only pass while the earlier
// message still has a button on screen for the farmer to press.
import { COUNTRY_NAMES } from '../public/js/lib/countries.js';
import { listCountries, locations, makeAssistant, textOf } from '../tests/helpers/matrix-harness.js';

const NOISE = ['Zzyzxvale', 'moonfruit city', 'Nowhereville'];
const failures = [], deferred = [];
let cases = 0;
for (const country of listCountries) {
  const countryName = COUNTRY_NAMES.of(country);
  const list = await locations({ country });
  const region = list.regions.find(row => row.name);
  const town = list.places[0];
  // Three positions in the pending plan: before any place, inside a chosen region, after a town point.
  const positions = [['area prompt', ['A specific area']],
    ...(region ? [['in region', ['A specific area', region.name]]] : []),
    ...(town ? [['at a point', ['A specific area', ...(region ? [region.name] : []), town.name]]] : [])];
  for (const [label, setup] of positions) {
    for (const noise of NOISE) {
      cases++;
      const { assistant, state, calls } = makeAssistant();
      await assistant.respond(`Help me plan a rotation in ${countryName}`);
      let onScreen = 0;
      for (const message of setup) {
        const step = await assistant.respond(message);
        if (!step) { failures.push(`${country}/${label}: setup “${message}” got no reply`); break; }
        onScreen = step.followUps.length;
      }
      calls.length = 0;
      const answer = await assistant.respond(noise);
      if (!answer) {
        deferred.push(`${country}/${label}`);
        if (!onScreen) failures.push(`${country}/${label}: “${noise}” answered with silence and no earlier button was on screen`);
        continue;
      }
      if (!answer.followUps.length) failures.push(`${country}/${label}: “${noise}” left no button — ${textOf(answer).slice(0, 90)}`);
      if (calls.includes('NASA') || calls.includes('compare')) failures.push(`${country}/${label}: “${noise}” ran ${calls.join('+')}`);
      if (label === 'area prompt' && state.regionCode) failures.push(`${country}/${label}: “${noise}” selected region ${state.regionCode}`);
    }
  }
}
console.log(JSON.stringify({ cases, countries: listCountries.length, failures: failures.length, deferredToEvidenceAnswer: deferred.length }));
for (const failure of failures) console.log('DEFECT ' + failure);
if (failures.length) process.exitCode = 1;
