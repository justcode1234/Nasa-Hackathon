// Feed an unknown town at every pending position of the guided plan, for every saved country list, and
// require a way forward. Usage: node scripts/audit-nonsense-town.js
// The census itself lives in tests/helpers/matrix-harness.js so that `npm test` runs exactly the same
// checks; this script only prints the counts for a targeted run outside the suite.
import { listCountries, nonsenseCensus } from '../tests/helpers/matrix-harness.js';

const { cases, failures, deferred } = await nonsenseCensus();
console.log(JSON.stringify({ cases, countries: listCountries.length, failures: failures.length, deferredToEvidenceAnswer: deferred.length }));
for (const failure of failures) console.log('DEFECT ' + failure);
if (failures.length) process.exitCode = 1;
