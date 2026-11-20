import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

// METHOD: docs/evidence holds the archives this loop ships, and two guards already read that tree in one
// direction - tests/documentation-commands.test.js and tests/documentation-citations.test.js check that an
// archive a document NAMES exists on disk. Nothing checked the other direction, so an archive could land with
// no document naming it and every guard stayed green. Measured 19 Nov with the same scan the citations guard
// uses: 479 files under docs/evidence, of which 172 were named by their full path in no document at all (103 of
// them not even by bare file name) - 25,712,457 bytes of evidence a reviewer cannot reach from any claim.
// docs/evidence-index.md now carries every still-unreachable file with the byte size read from the filesystem,
// and the rules below keep that index true: it must cover every unreachable file, every row must still match
// the bytes on disk, no row may go stale by naming a file a document has since started citing, and the scan must
// still be looking at the prose it was sized against.
//
// The floors are sized to that 19 Nov measurement, the same way iteration 46b sized the citation floors. A pass
// that genuinely closes part of this gap rewrites them to its own numbers and says so; it does not delete them.
const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['evidence', 'history', 'node_modules', '.git', 'dist', 'artifacts', 'submission',
  'coverage', 'playwright-report', 'test-results']);
const EXTS = new Set(['.js', '.mjs', '.cjs', '.md', '.css', '.py', '.sh', '.txt']);
const LEDGER = /^(docs\/|AGENTS\.md$)/;
const GENERATED = new Set(['public/js/lib/core-worker.bundle.js', 'public/vendor/maplibre/maplibre-gl.mjs',
  'public/vendor/maplibre/maplibre-gl-shared.mjs', 'public/vendor/transformers/transformers.min.js']);
const INDEX = 'docs/evidence-index.md';
const ROW = /^\* `(docs\/evidence\/[^`]+)` - ([\d,]+) bytes$/gm;
// Iteration 48. The header sentence is what a reviewer reads first, and control F on 19 Nov measured that nothing
// compared it with the rows underneath: citing an indexed archive and deleting its row left the header describing
// the scan from before the edit - "158 of 486" printed over 157 rows - with all four cases green. The two regexes
// below pin the three numbers in that sentence so the same edit has to move them.
const HEAD_COUNTS = /^([\d,]+) of ([\d,]+) files under `docs\/evidence\/`/m;
const HEAD_BYTES = /([\d,]+) bytes total\./;

async function proseFiles(dir = '', collected = [], cap = 300 * 1024) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) await proseFiles(relative, collected, cap); }
    else if (EXTS.has(path.extname(entry.name))) {
      const size = (await stat(path.join(ROOT, relative))).size;
      if (size <= cap || LEDGER.test(relative)) collected.push(relative);
    }
  }
  return collected;
}

async function evidenceFiles(dir = 'docs/evidence', collected = []) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await evidenceFiles(relative, collected);
    else collected.push(relative);
  }
  return collected.sort();
}

// The index is read outside the prose map: its rows name the very files this guard is measuring, so counting it
// as prose would report a tidied-up tree on the second run and on every run after that.
async function scan() {
  const evidence = await evidenceFiles();
  const bodies = new Map();
  for (const file of await proseFiles()) {
    if (file === INDEX) continue;
    bodies.set(file, await readFile(path.join(ROOT, file), 'utf8'));
  }
  const text = [...bodies.values()].join('\n');
  const indexBody = await readFile(path.join(ROOT, INDEX), 'utf8');
  const rows = [...indexBody.matchAll(ROW)]
    .map(match => ({ relative: match[1], bytes: Number(match[2].replace(/,/g, '')) }));
  const unreachable = evidence.filter(relative => relative !== INDEX && !text.includes(relative));
  return { evidence, bodies, rows, unreachable };
}

test('the evidence and prose scans still see the tree this guard was sized against', async () => {
  const { evidence, bodies, unreachable } = await scan();
  assert.ok(evidence.length >= 470, `the scan saw only ${evidence.length} files under docs/evidence`);
  assert.ok(bodies.size >= 200, `the scan saw only ${bodies.size} prose files`);
  for (const required of ['AGENTS.md', 'docs/validation.md', 'docs/handoff-2026-11-18.md']) {
    assert.ok(bodies.has(required), `the scan skipped ${required}`);
  }
  // 172 unreachable files were measured against 211 prose files in scope. A reading far below that means the
  // scan lost sight of prose, and a lost scan would show a tidy tree instead of the gap this guard is for.
  assert.ok(unreachable.length >= 80, `only ${unreachable.length} files look uncited, against 172 measured 19 Nov`);
  const hidden = (await proseFiles('', [], Infinity)).filter(file => !bodies.has(file) && file !== INDEX
    && !GENERATED.has(file));
  assert.deepEqual(hidden, [], `prose files the size cap hides: ${hidden.join(', ')}`);
});

test('every shipped evidence file is named by a document or carried by the index', async () => {
  const { unreachable, rows } = await scan();
  const indexed = new Set(rows.map(row => row.relative));
  const orphaned = unreachable.filter(relative => !indexed.has(relative));
  assert.deepEqual(orphaned, [], `evidence no document names or indexes:\n${orphaned.join('\n')}`);
});

test('every index row names a file that exists with exactly the bytes recorded', async () => {
  const { rows } = await scan();
  assert.ok(rows.length >= 80, `the index carries only ${rows.length} rows, against 172 measured 19 Nov`);
  const wrong = [];
  const seen = new Set();
  for (const { relative, bytes } of rows) {
    if (seen.has(relative)) wrong.push(`${relative} is indexed twice`);
    seen.add(relative);
    try {
      const size = (await stat(path.join(ROOT, relative))).size;
      if (size !== bytes) wrong.push(`${relative} is ${size} bytes but the index records ${bytes}`);
    } catch { wrong.push(`${relative} is indexed but not in the repository`); }
  }
  assert.deepEqual(wrong, [], `index rows that do not match the filesystem:\n${wrong.join('\n')}`);
});

test('an index row goes stale the moment a document starts citing that file', async () => {
  const { bodies, rows } = await scan();
  const text = [...bodies.values()].join('\n');
  const redundant = rows.filter(row => text.includes(row.relative)).map(row => row.relative);
  assert.deepEqual(redundant, [], `indexed files a document already cites:\n${redundant.join('\n')}`);
});

test('the index header states counts its own rows and the filesystem agree with', async () => {
  const { evidence, rows, unreachable } = await scan();
  const body = await readFile(path.join(ROOT, INDEX), 'utf8');
  const counts = body.match(HEAD_COUNTS);
  const bytes = body.match(HEAD_BYTES);
  // Rewording the header away is a decision this case forces into the open rather than an edit that can pass
  // quietly: the numbers a reviewer reads first would otherwise live in nothing but prose.
  assert.ok(counts && bytes, `the index no longer states its row count, file count and byte total in the sentence ` +
    'this case checks, so update the regexes and say why');
  const number = text => Number(text.replace(/,/g, ''));
  const rowBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  assert.equal(number(counts[1]), rows.length,
    `the header says ${counts[1]} of them are indexed and the index carries ${rows.length} rows`);
  assert.equal(number(counts[2]), evidence.length,
    `the header says ${counts[2]} files under docs/evidence and the scan found ${evidence.length}`);
  assert.equal(number(bytes[1]), rowBytes,
    `the header says ${bytes[1]} bytes total and the rows it sits over add up to ${rowBytes.toLocaleString('en-US')}`);
  assert.equal(rows.length, unreachable.length,
    `the header counts ${counts[1]} and the scan finds ${unreachable.length} uncited files: ${rows.length} rows ` +
    'are between the two, so a row went stale or the prose started citing a file the header still counts');
});

// Iteration 57. The counts subsection 57 quotes are read out of the archived bytes here, not out of the paragraph
// that quotes them. The reason is a defect this iteration produced itself: the shipped spec's comment claimed the
// 23:42 wrong-ordering run "failed all ten static cases", and the archive behind that claim is eleven lines long,
// prints seven `✘` marks and stops with no tally and no exit status because the run was killed to free the port. A
// count that belongs to a run which never completed is the class of bug; `wc -l`-style prose numbers survived twelve
// iterations because nothing compared a number with the bytes it was supposedly read from. The rules below are that
// comparison: each archive's own tally line, the number of `✘` marks, and the farmer-facing sentences the ledger
// quotes have to be present in the gzip. An archive named `-partial-` must stay a log that has no tally line, so the
// only way for "ten static cases failed" to come back is a run that prints it. The one entry the table cannot check
// from inside is its own suite's offline tally: the run that wrote those bytes carried a smaller table and so never read
// the row that quotes it, which is stated in subsection 57 rather than hidden, and whose first real check is the run
// after it. The row is kept because a quote with no archive behind it is the defect this case exists to catch, not
// because the case can certify its own predecessor.
const TALLY_LINE = /^\d+ (passed|failed|flaky|did not run)/;
const TALLIES = [
  { archive: 'docs/evidence/iter57-gate-1-2026-11-20.log.gz', lines: ['248 passed (24.8m)', 'GATE_EXIT=0'], marks: 0,
    phrases: ['farms.js:89', 'CONTEXT_UNAVAILABLE'], absent: ['SPEC_SHA256'] },
  // Iteration 57, after the prose was written: subsection 57 now states that this gate ran on the pre-correction spec
  // and before the tally case existed, and its own banner is the only source for that. Pinned here so the sentence
  // cannot outlive the bytes that justify it.
  { archive: 'docs/evidence/iter57-gate-2-2026-11-20.log.gz', lines: ['248 passed (22.1m)', 'GATE2_EXIT=0'], marks: 0,
    phrases: ['farms.js:89', 'CONTEXT_UNAVAILABLE', 'spec sha ba6f5bc2', 'offline 257/257 pass just before'],
    absent: ['SPEC_SHA256'] },
  { archive: 'docs/evidence/iter57-panel-focused-final-2026-11-20.log.gz', lines: ['20 passed (16.2s)',
    'FOCUSED_FINAL_EXIT=0', 'SPEC_SHA256 4eef52d3e776b42078914fc5493a3715ae32014ef060d9b98018658d300ec59b'], marks: 0 },
  { archive: 'docs/evidence/iter57-panel-focused-tripwire-green-2026-11-20.log.gz', lines: ['20 passed (16.3s)'], marks: 0 },
  { archive: 'docs/evidence/iter57-panel-api-seizure-2026-11-20.log.gz', lines: ['10 failed', '10 passed (2.8m)'],
    phrases: ['Crop catalog unavailable: No answer came back for this request'] },
  { archive: 'docs/evidence/iter57-panel-catchall-last-partial-2026-11-20.log.gz', partial: true, marks: 7 },
  { archive: 'docs/evidence/iter57-control-d-tripwire-2026-11-20.log.gz', lines: ['5 failed'],
    phrases: ['NASA POWER could not be reached or returned invalid JSON'] },
  { archive: 'docs/evidence/iter57-control-d2-sealed-fires-2026-11-20.log.gz', lines: ['5 failed'],
    phrases: ['static-desktop reached 1 request(s) no stub pinned: http://127.0.0.1:4173/css/app.css'] },
  { archive: 'docs/evidence/iter57-worker-route-probe-2026-11-20.log.gz',
    lines: ['PROBE_COUNTS {"power":1,"soil":1}', '1 passed (2.4s)'] },
  { archive: 'docs/evidence/iter57-census-after-2026-11-20.log.gz', lines: ['Total: 248 tests in 23 files'],
    absent: ['test.skip', 'testFixme'] },
  { archive: 'docs/evidence/iter57-gate-3-2026-11-20.log.gz', lines: ['248 passed (22.1m)', 'GATE3_EXIT=0',
    'SPEC_SHA256 4eef52d3e776b42078914fc5493a3715ae32014ef060d9b98018658d300ec59b'], marks: 0,
    phrases: ['farms.js:89', 'CONTEXT_UNAVAILABLE', 'The field lookup services are busy or unavailable (7 attempts across 3 services)'] },
  { archive: 'docs/evidence/iter57-offline-tallybootstrap-red-2026-11-20.log.gz',
    lines: ['ℹ tests 258', 'ℹ pass 254', 'ℹ fail 4', 'OFFLINE_INTERIM_EXIT=1'],
    onlyReds: ['every docs/evidence archive named anywhere in prose exists on disk',
      'every archived evidence file a doc points at exists',
      'every shipped evidence file is named by a document or carried by the index',
      'the index header states counts its own rows and the filesystem agree with'] },
  { archive: 'docs/evidence/iter57-offline-first-red-2026-11-20.log.gz',
    lines: ['ℹ tests 257', 'ℹ pass 256', 'ℹ fail 1',
      'docs/validation.md:3185 cites chat-evidence-panel.spec.js:81 but every line 81-81 in tests/e2e/chat-evidence-panel.spec.js is blank',
      'docs/validation.md:3541 cites tests/e2e/chat-evidence-panel.spec.js:81 but every line 81-81 in tests/e2e/chat-evidence-panel.spec.js is blank',
      'NPM_TEST_EXIT=1'],
    onlyReds: ['every file:line citation resolves and names a line that exists and is not blank'] },
  // The eight negative controls on this very case, archived 01:06Z. `GREEN - CONTROL FAILED` is the line the control
  // script prints when a corrupted table entry still passes, so its absence is the machine-checked form of "every
  // control detected its injected error" - and the first run of this script printed that line once, which is why the
  // sentence in subsection 57 is pinned to an archive rather than to the paragraph.
  { archive: 'docs/evidence/iter57-tallyguard-controls-2026-11-20.log.gz',
    lines: ['CONTROLS_DONE 8 cases', 'CONTROL_RESTORED_IDENTICAL true', 'TALLY_CONTROLS_EXIT=0'],
    phrases: ['RED as required', 'GUARD_SHA256 42c9070395125379eed01697637e83311ea960b8e28818ee822d7176377b0d3f'],
    absent: ['GREEN - CONTROL FAILED'] },
  // The green offline run this iteration's prose quotes. Its entry is the one the table header said could not exist:
  // the suite that produced these bytes carried a 14-entry table, so the run itself cannot have checked this row and
  // the first run that does is the next one. The focused guard archive below is that first check, kept separate
  // because a whole-suite re-run to satisfy a self-reference would only move the problem one archive later.
  { archive: 'docs/evidence/iter57-offline-final-2026-11-20.log.gz',
    lines: ['ℹ tests 258', 'ℹ pass 258', 'ℹ fail 0', 'ℹ skipped 0', 'NPM_TEST_EXIT=0',
      'GUARD_SHA256 ae72fb49c3006c38ea59c4abd429e5d1d91193ec0030b6bc68b91558bba9b485',
      'SPECSHA 4eef52d3e776b42078914fc5493a3715ae32014ef060d9b98018658d300ec59b'],
    absent: ['✖'] },
  // Pass two of the same control script, run after this table grew to the two rows above: twelve detections, four of
  // them aimed at those new rows. Its `absent` list carries a second needle so the control that targets it cannot
  // collide with the row above, which prints the same first string.
  { archive: 'docs/evidence/iter57-tallyguard-controls-2-2026-11-20.log.gz',
    lines: ['CONTROLS_DONE 12 cases', 'CONTROL_RESTORED_IDENTICAL true',
      'CONTROL_RESTORED_RUN exit=0 ℹ tests 1 ℹ pass 1 ℹ fail 0', 'TALLY_CONTROLS2_EXIT=0',
      'GUARD_SHA256 f1d0a0c960b760acadfde3bd461a173f65d09bb1f48b922d3a047135258438ce'],
    absent: ['GREEN - CONTROL FAILED', 'SKIP - anchor text not found'] },
];

test('the tally of every archived run is printed by that archive, not by the prose quoting it', async () => {
  assert.ok(TALLIES.length >= 16, `the table carries ${TALLIES.length} archives; subsection 57 quotes more runs than ` +
    'that, so a number in it is unguarded');
  for (const { archive, lines = [], phrases = [], absent = [], marks, partial, onlyReds } of TALLIES) {
    let text;
    try { text = gunzipSync(await readFile(path.join(ROOT, archive))).toString('utf8'); }
    catch { assert.fail(`${archive} is quoted by subsection 57 and is not a readable gzip in the repository`); }
    const got = text.split('\n').map(line => line.trim());
    for (const line of lines) assert.ok(got.includes(line), `${archive} never prints the line "${line}" the ledger reads out of it`);
    for (const phrase of phrases) assert.ok(text.includes(phrase), `${archive} never contains "${phrase}"`);
    for (const needle of absent) assert.ok(!text.includes(needle), `${archive} contains "${needle}", which subsection 57 ` +
      'states that archive does not print');
    const crosses = got.filter(line => line.startsWith('✘'));
    if (marks !== undefined) assert.equal(crosses.length, marks, `${archive} prints ${crosses.length} ✘ case lines, not the ${marks} quoted`);
    if (onlyReds) {
      // `✖ name (12ms)` is how node --test prints a red case, and it repeats the list under "failing tests:". The set
      // has to match exactly: a run red on more cases than the ledger says, or on a different one, is another run.
      const reds = [...new Set(got.filter(line => line.startsWith('✖ ')).map(line => line.slice(2).replace(/ \(\d+(\.\d+)?ms\)$/, '')).filter(name => name !== 'failing tests:'))].sort();
      assert.deepEqual(reds, [...onlyReds].sort(),
        `${archive} was red on ${reds.join(' / ') || 'nothing'}, which is not the red set subsection 57 describes`);
    }
    if (partial) {
      // A partial run has to stay visibly partial. If a tally ever appears in this file the archive is a different run
      // and the paragraph that calls it partial is the defect, so both the name and the content have to move together.
      assert.match(path.basename(archive), /-partial-/, 'only the partial archive is checked for a missing tally');
      assert.deepEqual(got.filter(line => TALLY_LINE.test(line)), [],
        `${archive} is cited as a run that stopped before its tally, and it now prints one: ${got.filter(line => TALLY_LINE.test(line)).join(' / ')}`);
      assert.ok(crosses.length > 0 && crosses.every(line => line.includes('[static-')),
        `${archive} must show the aborted cases and only the static ones, since the node projects were green in it`);
    }
  }
});
