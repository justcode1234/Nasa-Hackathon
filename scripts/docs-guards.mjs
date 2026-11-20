// Documentation guard runner, first run in iteration 59. The five guard files used to be named by hand in whatever
// shell command closed a publication chain, and that silently dropped coverage: a mistyped list of five paths, two
// of which did not exist, ran 15 cases and was reported as exit 0 because the exit status was read from a pipeline
// stage rather than the test process (`node --test … 2>&1 | tail -20`). A green run that did not run the suite is
// precisely the failure this programme keeps hitting, so the file list now lives here, every entry is required to
// exist before the child starts, and the exit code is this process's own.
//
// Usage: `node scripts/docs-guards.mjs` - prints GUARD_FILES, the resolved paths and the tally lines the child
// prints, then exits with the child's status. Nothing is swallowed; redirect to a log instead of piping.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url).pathname;
const GUARD_FILES = ['tests/documentation-citation-anchors.test.js', 'tests/documentation-citations.test.js',
  'tests/documentation-commands.test.js', 'tests/documentation-evidence-index.test.js',
  'tests/documentation-reflow.test.js'];

const missing = GUARD_FILES.filter(relative => !existsSync(ROOT + relative));
if (missing.length > 0) {
  console.error(`DOCSGUARDS_ABORT guard file(s) not on disk: ${missing.join(', ')}`);
  process.exit(1);
}
if (GUARD_FILES.length !== 5) {
  console.error(`DOCSGUARDS_ABORT the guard set is ${GUARD_FILES.length} files; the ledger says five`);
  process.exit(1);
}

console.log(`DOCSGUARDS_START ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`);
console.log(`GUARD_FILES ${GUARD_FILES.length}`);
for (const relative of GUARD_FILES) console.log(`GUARD_FILE ${relative}`);

const run = spawnSync(process.execPath, ['--test', ...GUARD_FILES], { cwd: ROOT, encoding: 'utf8' });
if (run.error) {
  console.error(`DOCSGUARDS_ABORT ${run.error.message}`);
  process.exit(1);
}
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
const summary = run.stdout.split('\n').filter(line => /^ℹ (tests|pass|fail|skipped)/.test(line));
console.log(`DOCSGUARDS_SUMMARY ${summary.map(line => line.replace(/^ℹ\s*/, '').replace(/\s+/g, ' ')).join(' | ')}`);
console.log(`DOCSGUARDS_CHILD_EXIT ${run.status}`);
process.exit(run.status ?? 1);
