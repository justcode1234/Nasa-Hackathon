import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
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
  // Iteration 58. Subsection 58 quotes the sentence a farmer was shown before the fix, so the sentence is pinned to
  // the bytes of the run that printed it rather than to the paragraph.
  { archive: 'docs/evidence/iter58-focused-red-2026-11-20.log.gz', lines: ['Running 4 tests using 1 worker', '4 failed'],
    phrases: ['Received string:      "Admiralty is selected as a town point. Choose the specific field; the town itself is not farmland. 0 mapped fields were returned.',
      'a lookup that never completed must not be reported as a returned field count'] },
  { archive: 'docs/evidence/iter58-focused-green-2026-11-20.log.gz',
    lines: ['### a refused field lookup is reported as a failure, not as an empty map, and keeps a retry [static-desktop] status=passed at field-service-failure.spec.js:21',
      '### a refused field lookup is reported as a failure, not as an empty map, and keeps a retry [node-mobile] status=passed at field-service-failure.spec.js:21',
      'JSON_TALLY 4 passed expected=4 unexpected=0 flaky=0 skipped=0'],
    phrases: ['The community field lookup did not complete', '"refuse": 6', '"refuse": 2'] },
  { archive: 'docs/evidence/iter58-focused-green-json-2026-11-20.log.gz',
    lines: ['"expected": 4,', '"unexpected": 0,', '"flaky": 0'],
    phrases: ['a refused field lookup is reported as a failure, not as an empty map, and keeps a retry', 'static-mobile'] },
  // The controls, both readings. The source-only run is kept because it is the measurement of a harness defect: the
  // same four breaks it missed in the two static projects, the rebuilt run caught in all four.
  { archive: 'docs/evidence/iter58-focused-controls-source-only-2026-11-20.log.gz',
    lines: ['MISSED static-desktop static-mobile of 4 projects ran', 'CONTROLS_DONE 4 cases, 4 detected',
      'CONTROL_RESTORED_RUN exit=0 4 passed'],
    phrases: ['CASE nc-a-refusal-reported-as-empty-list: RED as required (exit 1, 2 failed / 2 passed)'] },
  { archive: 'docs/evidence/iter58-focused-controls-2026-11-20.log.gz',
    lines: ['BUILD_BASELINE exit=0 context.=e9f2c6ac6f9826df workflow=d6b54dd6ca75b153',
      'MISSED none of 4 projects ran', 'CASE nc-d-selected-point-site-unclassified: RED as required (exit 1, 4 failed / 0 passed)',
      'CONTROLS_DONE 4 cases, 4 detected', 'CONTROL_RESTORED_RUN exit=0 4 passed',
      'CONTROL_SHA_AFTER public/js/modules/context.js e9f2c6ac6f9826df identical=true'],
    phrases: ['DETECTED node-desktop node-mobile static-desktop static-mobile'] },
  { archive: 'docs/evidence/iter58-neighbours-superseded-2026-11-20.log.gz', lines: ['Running 20 tests using 1 worker',
    '8 failed', '12 passed (3.8m)'],
    phrases: ["Expected substring: \"mapped fields were returned\"", 'guided-chat-accessibility.spec.js:17:1'] },
  // One `[n/252] [project]` progress line per case is what `--reporter=line` prints, so the four project prefixes are
  // how the gate itself proves the new case ran in all four transports rather than only in the focused run. The gate
  // never prints `tests/e2e/live-fields.js`: that path is a helper module (`waitForLiveFields`), not a spec, which is
  // why the 19 Nov red quoted a helper frame and named no spec. `code: 'CONTEXT_UNAVAILABLE'` is the pair of genuine
  // upstream refusals the gate's own web server logged while those 252 cases ran.
  { archive: 'docs/evidence/iter58-gate-2026-11-20.log.gz', lines: ['Running 252 tests using 1 worker',
    '252 passed (27.6m)', 'playwright_exit=0'], marks: 0,
    phrases: ["code: 'CONTEXT_UNAVAILABLE'",
      '[20/252] [static-desktop] › tests/e2e/field-service-failure.spec.js:21:1',
      '[83/252] [static-mobile] › tests/e2e/field-service-failure.spec.js:21:1',
      '[146/252] [node-desktop] › tests/e2e/field-service-failure.spec.js:21:1',
      '[209/252] [node-mobile] › tests/e2e/field-service-failure.spec.js:21:1'] },
  { archive: 'docs/evidence/iter58-citation-drift-2026-11-20.log.gz',
    lines: ['HEAD CITED_LINES_CHECKED 180 DRIFTED 26 INSIDE_DIFF_HUNKS 0',
      'TREE CITED_LINES_CHECKED 179 DRIFTED 0 INSIDE_DIFF_HUNKS 1'] },
  // The offline run that went red on the index's own header after this iteration's archives landed, kept because it is
  // the proof the header guard fires; `onlyReds` says nothing else failed.
  { archive: 'docs/evidence/iter58-offline-index-red-2026-11-20.log.gz',
    lines: ['ℹ tests 259', 'ℹ pass 258', 'ℹ fail 1', 'OFFLINE_EXIT=1'],
    onlyReds: ['the index header states counts its own rows and the filesystem agree with'] },
  // The census behind "no skip in tests/e2e": subsection 58 reads 252 in 24 files, the skip scan's own `(none)` line and
  // the four per-project entries of the new spec out of this archive rather than out of the prose.
  { archive: 'docs/evidence/iter58-census-2026-11-20.log.gz',
    lines: ['Total: 252 tests in 24 files', '(none)'],
    phrases: ['field-service-failure.spec.js entries in the census:\n4'] },
  { archive: 'docs/evidence/iter58-tally-controls-2026-11-20.log.gz',
    lines: ['CONTROL_ROWS 25', 'CONTROL_RESTORED_IDENTICAL true', 'CONTROL_RESTORED_RUN exit=0 ℹ tests 1 ℹ pass 1 ℹ fail 0',
      'CONTROLS_DONE 24 cases, 24 detections aimed, 0 red-but-unaimed, 0 invalid patches, 0 green controls, 0 skipped anchors'],
    phrases: ['CONTROL_TARGET_SHA_BEFORE eaf7bc42673ff24d', 'CONTROL_TARGET_SHA_AFTER eaf7bc42673ff24d'] },
  // Pass two of the same harness, kept because it is the pass that met the anchor rule instead of slipping past it:
  // `CONTROL_RESTORED_IDENTICAL true` is a needle three rows pin, so the patch was refused and announced.
  { archive: 'docs/evidence/iter58-tally-controls-run1-skipped-2026-11-20.log.gz',
    lines: ['CONTROL_ROWS 29',
      'CASE controls-own-row-restore-flag: SKIP - anchor matched 3 times, must match exactly once (nothing was patched)',
      'CONTROLS_DONE 30 cases, 29 detections aimed, 0 red-but-unaimed, 0 invalid patches, 0 green controls, ' +
      '1 skipped anchors'] },
  { archive: 'docs/evidence/iter58-tally-controls-run2-32cases-2026-11-20.log.gz',
    lines: ['CONTROLS_DONE 32 cases, 32 detections aimed, 0 red-but-unaimed, 0 invalid patches, 0 green controls, ' +
      '0 skipped anchors'],
    absent: [': SKIP - anchor'] },
  // The pass whose coverage line is the point of the whole harness: a case count says nothing about which rows are
  // attacked, so this one prints the row census and subsection 58 reads it back out of the archive.
  { archive: 'docs/evidence/iter58-tally-controls-final-2026-11-20.log.gz',
    lines: ['CONTROL_ROWS_IN_TABLE 29 ATTACKED 29 UNATTACKED 0', 'CONTROL_RESTORED_RUN exit=0 ℹ tests 1 ℹ pass 1 ℹ fail 0',
      'CONTROLS_DONE 39 cases, 39 detections aimed, 0 red-but-unaimed, 0 invalid patches, 0 green controls, ' +
      '0 skipped anchors'],
    phrases: ['FLOOR_ANCHOR TALLIES.length >= 29, -> attacked by raising it to 999',
      'CONTROL_TARGET_SHA_BEFORE e1088a17e718bbb0'] },
  // Pass five, kept because it is the pass that printed the gap rather than hiding it: it attacked 30 of the 33 rows
  // that existed and named the three it had not been taught to attack.
  { archive: 'docs/evidence/iter58-tally-controls-pass5-2026-11-20.log.gz',
    lines: ['CONTROL_ROWS 33', 'CONTROL_ROWS_IN_TABLE 33 ATTACKED 30 UNATTACKED 3', 'CONTROL_RESTORED_IDENTICAL true',
      'CONTROL_RESTORED_RUN exit=0 ℹ tests 1 ℹ pass 1 ℹ fail 0',
      'UNATTACKED iter58-tally-controls-run1-skipped-2026-11-20.log.gz',
      'UNATTACKED iter58-tally-controls-run2-32cases-2026-11-20.log.gz',
      'UNATTACKED iter58-tally-controls-final-2026-11-20.log.gz',
      'CONTROLS_DONE 43 cases, 43 detections aimed, 0 red-but-unaimed, 0 invalid patches, 0 green controls, ' +
      '0 skipped anchors'],
    phrases: ['CONTROL_TARGET_SHA_BEFORE 50332367110e9d32', 'CONTROL_TARGET_SHA_AFTER 50332367110e9d32',
      'CASE offline-row-wrong-tally-rows: RED aimed at iter58-offline (exit 1)'],
    absent: [': SKIP - anchor'] },
  // Pass six is the shipped coverage reading: every row that existed when it ran was attacked, including the rows the
  // earlier passes could not reach. It has no `: SKIP -` absence because its own assertion echoes quote the skip line
  // they were aimed at, which the archive therefore does print.
  { archive: 'docs/evidence/iter58-tally-controls-pass6-2026-11-20.log.gz',
    lines: ['CONTROL_ROWS 35', 'CONTROL_ROWS_IN_TABLE 35 ATTACKED 35 UNATTACKED 0', 'CONTROL_RESTORED_IDENTICAL true',
      'CONTROL_RESTORED_RUN exit=0 ℹ tests 1 ℹ pass 1 ℹ fail 0',
      'CONTROLS_DONE 53 cases, 53 detections aimed, 0 red-but-unaimed, 0 invalid patches, 0 green controls, ' +
      '0 skipped anchors'],
    phrases: ['CONTROL_TARGET_SHA_BEFORE ea4c8c62beef21c1', 'CONTROL_TARGET_SHA_AFTER ea4c8c62beef21c1',
      // Deliberately cut before `assert.ok(`: the controls harness finds the floor with
      // /assert\.ok\(TALLIES\.length >= (\d+),/ and requires exactly one hit, so a needle quoting a previous pass's
      // floor line verbatim would be read as a second threshold and the floor attack would SKIP silently.
      '(TALLIES.length >= 35, -> attacked by raising it to 1005'],
    absent: ['GREEN - CONTROL FAILED'] },
  { archive: 'docs/evidence/iter58-offline-prefinal-2026-11-20.log.gz',
    lines: ['OFFLINE_PREFINAL_START 2026-11-20T02:48:20Z — npm test on the tree after the iteration-58 archives were shelved and the index regenerated',
      'ℹ tests 259', 'ℹ pass 259', 'ℹ fail 0', 'OFFLINE_EXIT=0'],
    absent: ['✖', 'OFFLINE_EXIT=1', 'ℹ fail 1'] },
  // The shipped green `npm test` on the finished tree - the archive the ledger's offline-suite cell ends on. Its header
  // prints `TALLY_ROWS 32` because this row is written after the run it pins, which is the self-reference subsection 58
  // records for iteration 57 rather than something this table can fix.
  { archive: 'docs/evidence/iter58-offline-2026-11-20.log.gz',
    lines: ['TALLY_ROWS 32', 'DIRTY_ENTRIES 30', 'GIT_BRANCH fix/chat-flow-and-answers',
      'ℹ tests 259', 'ℹ pass 259', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
    phrases: ['OFFLINE_FINAL_START 2026-11-20T03:24:18.508Z - npm test on the finished iteration-58 tree,'],
    absent: ['✖', 'OFFLINE_EXIT=1', 'ℹ fail 1', ': SKIP -'] },
  // The five guard files re-run on their own, which is the first check that can read a row about the shipped offline
  // archive above; its header prints the row count it saw, so this archive carries one fewer than it checks.
  { archive: 'docs/evidence/iter58-docsguards-final-2026-11-20.log.gz',
    lines: ['GUARD_TABLE_ROWS 34', 'ℹ tests 24', 'ℹ pass 24', 'ℹ fail 0', 'ℹ skipped 0', 'DOCSGUARDS_EXIT=0'],
    phrases: ['DOCSGUARDS_START 2026-11-20T03:30:47Z - the five documentation guard files re-run on the 34-row tally table'],
    absent: ['✖', 'DOCSGUARDS_EXIT=1', 'ℹ fail 1'] },
  // The provenance snapshot: every hash subsection 58 quotes for the shipped files, plus the remote-main reference the
  // push recipe re-reads, has to be printed by this archive and not merely asserted next to it.
  { archive: 'docs/evidence/iter58-provenance-2026-11-20.log.gz',
    lines: ['PROVENANCE_ITERATION 58 dated 2026-11-20', 'GIT_HEAD d6ce8c884fd6979041113ccb035128aada97cbaf',
      'GIT_BRANCH fix/chat-flow-and-answers',
      'SHA public/js/modules/context.js e9f2c6ac6f9826df4dded0205e413a834739fc8d5cfecccd3c9535fa0e2222d2 15699B 244L',
      'SHA public/js/modules/workflow-assistant.js d6b54dd6ca75b15335c5396b1a3457233193c129624259ee74b23909bf893d52 64057B 694L',
      'SHA server/context/client.js 1bb7c539aff8ddde942cfa6bc0e268e461d7b2ee2b99ab95d0d4ad4d6046aa68 3419B 51L',
      'PROVENANCE_DONE 9 shipped hashes'],
    phrases: ['GIT_REMOTE_MAIN 4a54fa3fbd75f4b1ccaae238b00d439accf1d0d4'] },
  // Iteration 59. The three probes subsection 59 reads its "cannot actually be reached" claims out of, then the ladder
  // that built every number in the subsection. Each ladder step prints the sha256 of the `chat.js` it built, which is
  // what tells the red run from the two attacks: all three report 4 failed / 4 passed and only the hash says which
  // bytes produced them.
  { archive: 'docs/evidence/iter59-probes-2026-11-20.log.gz',
    lines: ['PHASE plain TRANSPORT worker', 'ASK_REQUESTS 0', 'COMPOSER ""'],
    phrases: ['######## probe-ask-requests.mjs ########', '######## probe-evidence-ask.mjs ########',
      '######## probe-place-cut.mjs ########', 'EXTERNALS_CUT 9 tile.openstreetmap.org'] },
  { archive: 'docs/evidence/iter59-ladder-script-2026-11-20.py.gz',
    lines: ["FIXED_SHA = '103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89'",
      "RESTORE = \"        if ($('question').value === '') $('question').value = question;\\n\"",
      "UNGUARDED = \"        $('question').value = question;\\n\""],
    phrases: ['assert sha(CHAT) == FIXED_SHA'] },
  { archive: 'docs/evidence/iter59-red-2026-11-20.log.gz',
    lines: ['STEP red-2', 'CHAT_SHA256 be315867814eaeeb65b38d455fd1e2bf86523952457b34fba32cd3856409f985',
      'Running 8 tests using 1 worker', '4 failed', '4 passed (19.6s)', 'EXIT=1'], marks: 4,
    phrases: ['Error: the refused message must still be in the composer, ready to send again',
      'Received: ""',
      '[node-mobile] › tests/e2e/chat-refused-ask-keeps-question.spec.js:26:1 › a refused ask leaves the message in the composer'],
    absent: ['EXIT=0'] },
  // The same four failures with the restore statement deleted from the fixed file: the previous commit's bytes and this
  // attack print the same tally, so the pair is only evidence because the hashes differ (be315867 against ad3caf58).
  { archive: 'docs/evidence/iter59-attackA-2026-11-20.log.gz',
    lines: ['STEP attackA2', 'CHAT_SHA256 ad3caf589c272123fa052b057c7f31081238aa6aeed368ff45c833c2379aebe3',
      '4 failed', '4 passed (19.5s)', 'EXIT=1'], marks: 4,
    phrases: ['Error: the refused message must still be in the composer, ready to send again'],
    absent: ['EXIT=0', 'must not overwrite what the farmer wrote next'] },
  // The paired attack: only the empty-composer guard removed, so the other case goes red and this one's message appears
  // in the diff as the value that was pasted over. Neither attack can be mistaken for the other.
  { archive: 'docs/evidence/iter59-attackB-2026-11-20.log.gz',
    lines: ['STEP attackB2', 'CHAT_SHA256 5086a0ed344c71a948d99b3abb033e35adbe3919c17ae9d4e1371d4a1f269556',
      '4 failed', '4 passed (20.3s)', 'EXIT=1'], marks: 4,
    phrases: ['Error: the refused message must not overwrite what the farmer wrote next',
      'Expected: "Also look at the lower field after the rain"',
      'Received: "Use my point 1.3521, 103.8198 to plan a rotation in Singapore"',
      '[static-desktop] › tests/e2e/chat-refused-ask-keeps-question.spec.js:76:1'],
    absent: ['EXIT=0', 'Error: the refused message must still be in the composer'] },
  { archive: 'docs/evidence/iter59-green-2026-11-20.log.gz',
    lines: ['STEP green-final', 'CHAT_SHA256 103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89',
      'Running 8 tests using 1 worker', '8 passed (19.6s)', 'EXIT=0'], marks: 0,
    phrases: ['✓  8 [node-mobile] › tests/e2e/chat-refused-ask-keeps-question.spec.js:76:1'],
    absent: ['EXIT=1', '4 failed'] },
  { archive: 'docs/evidence/iter59-offline-2026-11-20.log.gz',
    lines: ['STEP offline-final', 'COMMAND npm test',
      'CHAT_SHA256 103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89',
      'ℹ tests 259', 'ℹ pass 259', 'ℹ fail 0', 'ℹ skipped 0', 'EXIT=0'],
    absent: ['✖', 'ℹ fail 1', 'EXIT=1'] },
  // The neighbour slice this iteration re-ran on the shipped bytes: the nine chat-adjacent specs it inherited from
  // subsections 56-58, which are the regressions a chat.js change could cause. The new spec is not in this archive - it
  // is the 8-case ladder above and the gate below - and subsection 59 says "the nine chat-adjacent browser specs" for
  // exactly that reason.
  { archive: 'docs/evidence/iter59-focused-2026-11-20.log.gz',
    lines: ['Running 88 tests using 1 worker', '88 passed (2.1m)', 'FOCUSED_EXIT=0'], marks: 0,
    phrases: ['tests/e2e/field-service-failure.spec.js', 'tests/e2e/chat-only-flow.spec.js',
      'tests/e2e/guided-chat-accessibility.spec.js'],
    absent: ['✖', 'FOCUSED_EXIT=1', 'chat-refused-ask-keeps-question.spec.js'] },
  // The gate attempt stopped on purpose: its spec header cited a line the fix had already moved, so publishing its
  // numbers would have quoted coordinates that do not exist in the committed file. It is kept to record that it ran, and
  // an archive cited as ending before its tally must print none - hence `noTally` rather than a needle list alone.
  { archive: 'docs/evidence/iter59-gate-attempt1-interrupted-2026-11-20.log.gz',
    lines: ['Running 260 tests using 1 worker', 'BUILD_EXIT=0'],
    phrases: ['103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89  public/js/modules/chat.js',
      '3e68b9d9a4cd85a6a4087c9ff760ef2f9da676eb141b3960fee57893c19e3fff  tests/e2e/chat-refused-ask-keeps-question.spec.js'],
    absent: ['GATE_EXIT'], noTally: true },
  // The four-project gate on the shipped bytes, and the census it matches. The gate is the only archive that proves the
  // new spec really ran in all four transports - a focused run could have selected a subset - so one position line per
  // project is a needle, not decoration. `CONTEXT_UNAVAILABLE` is absent because this run met no live field refusal at
  // all, which is the opposite of iteration 58's gate and has to be recorded as its own fact.
  { archive: 'docs/evidence/iter59-gate-2026-11-20.log.gz',
    lines: ['Running 260 tests using 1 worker', '260 passed (21.0m)', 'GATE_EXIT=0', 'BUILD_EXIT=0',
      '103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89  public/js/modules/chat.js',
      'd173167e944821d7000f7c4d5db92e97e3366036fcf42893e87ecb78917cb217  tests/e2e/chat-refused-ask-keeps-question.spec.js'],
    marks: 0,
    phrases: ['✓   18 [static-desktop] › tests/e2e/chat-refused-ask-keeps-question.spec.js:26:1',
      '✓   84 [static-mobile] › tests/e2e/chat-refused-ask-keeps-question.spec.js:76:1',
      '✓  148 [node-desktop] › tests/e2e/chat-refused-ask-keeps-question.spec.js:26:1',
      '✓  214 [node-mobile] › tests/e2e/chat-refused-ask-keeps-question.spec.js:76:1'],
    absent: ['✘', 'GATE_EXIT=1', 'skipped', 'did not run', 'CONTEXT_UNAVAILABLE'] },
  { archive: 'docs/evidence/iter59-census-2026-11-20.log.gz',
    lines: ['Total: 260 tests in 25 files', 'CENSUS_EXIT=0'],
    phrases: ['CENSUS_CMD npx playwright test --list (full output, no tail)',
      '[static-desktop] › chat-refused-ask-keeps-question.spec.js:26:1',
      '[node-mobile] › chat-refused-ask-keeps-question.spec.js:76:1'],
    absent: ['(skipped)', 'Total: 252 tests in 24 files'] },
  // The known bootstrap red: archives shelved before `docs/evidence-index.md` is regenerated. It is the index guard
  // firing correctly, and it is also the reading that proves the offline suite is 260 cases now, not 259.
  { archive: 'docs/evidence/iter59-offline-index-red-2026-11-20.log.gz',
    lines: ['ℹ tests 260', 'ℹ pass 258', 'ℹ fail 2', 'ℹ skipped 0', 'OFFLINE_EXIT=1'],
    onlyReds: ['every shipped evidence file is named by a document or carried by the index',
      'the index header states counts its own rows and the filesystem agree with'],
    phrases: ['the header says 612 files under docs/evidence and the scan found 614',
      "actual: [ 'docs/evidence/iter59-census-2026-11-20.log.gz', 'docs/evidence/iter59-gate-2026-11-20.log.gz' ]"],
    absent: ['ℹ fail 0', 'OFFLINE_EXIT=0'] },
  // The offline run this iteration reports as green. Its header states the table size it executed against, because the
  // rows below it were added after it ran and a reader cannot otherwise tell which tree printed 260/260.
  { archive: 'docs/evidence/iter59-offline-final-2026-11-20.log.gz',
    lines: ['ℹ tests 260', 'ℹ pass 260', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
    phrases: ['OFFLINE_CMD npm test (tally table 48 rows, index regenerated)',
      '103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89  public/js/modules/chat.js'],
    absent: ['ℹ fail 2', 'OFFLINE_EXIT=1'] },
  // The five documentation guard files run on their own, which is the only way a reviewer can see the guard table and
  // the citations agreeing without waiting for the whole offline suite. Its header prints the table size it read, so
  // the archive says how big the table was at the moment it went green.
  { archive: 'docs/evidence/iter59-docsguards-final-2026-11-20.log.gz',
    lines: ['GUARD_TABLE_ROWS 49', 'ℹ tests 25', 'ℹ pass 25', 'ℹ fail 0', 'ℹ skipped 0', 'DOCSGUARDS_EXIT=0'],
    phrases: ['the five documentation guard files re-run on the 49-row tally table, iteration 59 publication chain'],
    absent: ['✖', 'DOCSGUARDS_EXIT=1'] },
  // The provenance snapshot of the tree iteration 59 commits. Subsection 59 quotes two sha256s as the bytes the browser
  // readings ran against and names the guard runner it ships; every one of those has to be printed by this archive
  // rather than asserted beside it, and the interpreter line is here because the gate logs carry no banner at all.
  { archive: 'docs/evidence/iter59-provenance-2026-11-20.log.gz',
    lines: ['PROVENANCE_ITERATION 59 dated 2026-11-20',
      'INTERPRETER v26.13.1 /opt/homebrew/Cellar/node/26.13.1_2/bin/node',
      'GIT_HEAD cadd0b375191b9616a76c121304e318ed642a473',
      'GIT_BRANCH fix/chat-flow-and-answers',
      'SHA public/js/modules/chat.js 103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89 12508B 180L',
      'SHA tests/e2e/chat-refused-ask-keeps-question.spec.js d173167e944821d7000f7c4d5db92e97e3366036fcf42893e87ecb78917cb217 8582B 102L',
      'SHA public/js/modules/workflow-assistant.js d6b54dd6ca75b15335c5396b1a3457233193c129624259ee74b23909bf893d52 64057B 694L',
      'SHA scripts/docs-guards.mjs 27577b3c1e48c63c1fe2b4d11301f3addbd48c101b95439003e1330ccea078a0 2407B 43L',
      'PROVENANCE_DONE 8 shipped hashes'],
    phrases: ['GIT_REMOTE_MAIN 4a54fa3fbd75f4b1ccaae238b00d439accf1d0d4'],
    absent: ['PROVENANCE_DONE 7 shipped hashes'] },
  // Iteration 60. The guard that passed on the bug: on this tree three documented instruments still lived under the
  // gitignored `artifacts/`, and the prose-command case reported them as satisfied because it only asked whether the
  // bytes were on disk. `fail 1` is the index case failing for an unrelated reason - the generator was not in
  // `scripts/` yet, so the case could not spawn it - and both facts matter to the paragraph, which says the invalid
  // run's single red was never the shipped-ness check.
  { archive: 'docs/evidence/iter60-red-invalid-guard-checked-disk-not-ship-2026-11-20.log.gz',
    lines: ['ITER60_RED_START 2026-11-20T05:15:51Z', 'ℹ tests 14', 'ℹ pass 13', 'ℹ fail 1',
      '✔ a command named inside a sentence is a file the repository ships, not one only this machine has (4.92075ms)'],
    phrases: ['scripts/evidence-index-generator.mjs exited 1'],
    absent: ['under the ignored artifacts/', 'ℹ fail 0'] },
  // The two sides of the run that did describe the defect, archived together because a red quoted without the green
  // that followed it cannot be told apart from a red that was never fixed. Six distinct rejections are printed, over
  // eight raw mentions, and the green half is the 14 cases of both guard files on the shipped tree.
  { archive: 'docs/evidence/iter60-two-guards-red-then-green-2026-11-20.log.gz',
    lines: ['ITER60_RED_START 2026-11-20T05:17:07Z', 'ℹ pass 12', 'ℹ fail 2', 'RED_EXIT=1',
      'AGENTS.md -> artifacts/iter47-index-generator.mjs (under the ignored artifacts/)',
      'docs/validation.md -> artifacts/iter49-census.py (under the ignored artifacts/)',
      'ITER60_GREEN_TWOGUARDS 2026-11-20T05:22:04Z HEAD e3982cd425da0daf9fef718ff79ef94ce2442c6d',
      'ℹ pass 14', 'ℹ fail 0', 'EXIT=0'],
    phrases: ['(under the ignored artifacts/)', 'scripts/evidence-index-generator.mjs exited 1'],
    absent: ['ℹ fail 1', 'ℹ fail 3'] },
  // All three instruments run from the paths the repository now ships, which is the only reading that shows the move
  // did not break them. The census counts are the ones subsection 60 quotes, and the generator's byte count is what the
  // reproduction case compares against the committed index.
  { archive: 'docs/evidence/iter60-instruments-after-move-2026-11-20.log.gz',
    lines: ['ITER60_INSTRUMENTS 2026-11-20T05:18:36Z HEAD e3982cd425da0daf9fef718ff79ef94ce2442c6d',
      '27/27 as expected · 19/27 produced a location · module public/', 'prose files in scope : 225',
      'archive citations    : read as-is 1109, newline-joined 1109',
      'file:line references : read as-is 905, newline-joined 905',
      'split archive citations (0):', 'split file:line references (0):',
      'lines ending in a path-shaped token : 160', '11580'],
    absent: ['Traceback', 'ERR_MODULE_NOT_FOUND', 'no such file'] },
  // Four controls, an older control that separates the new index case from the three it sits beside, and the measurement
  // that sized the scan floor - concatenated, with each control's full transcript behind the summary that names it, so a
  // reader can check the floor against the same bytes the controls ran on. `CONTROL_1` is absent on purpose: the first
  // draft's ignore-prefix control was dropped as redundant with the real red above, and a count of four in the ledger
  // has to stay four.
  { archive: 'docs/evidence/iter60-negative-controls-2026-11-20.log.gz',
    lines: ['ITER60_CONTROLS 2026-11-20T05:30:18Z HEAD e3982cd425da0daf9fef718ff79ef94ce2442c6d',
      'CONTROLS_RAN 4 CONTROLS_DETECTED 4 CONTROLS_RED 4', 'CONTROL_EXITS c2=1 c3=1 c4=1 c5=1',
      'RESTORE_CHECK census_on_disk=yes', 'ℹ pass 4', 'ℹ fail 3',
      '{"files":34,"fence":11,"inline":56,"total":67,"inlineOnlyFromFilesWithNoFencedHits":55}',
      'FLOOR_RAISE_EXIT=1', 'SPLIT_RESTORE_VERIFIED floor back to 60'],
    phrases: ['RESTORE_CHECK commands_sha_before=63700dd9a2bd5294', 'RESTORE_CHECK commands_sha_now=63700dd9a2bd5294',
      'RESTORE_CHECK index_sha_before=f29cb1b5fe1dfd3217', 'RESTORE_CHECK index_sha_now=f29cb1b5fe1dfd3217',
      'found 67', 'First differing line is 194', 'First differing line is 15'],
    absent: ['CONTROL_1', 'ℹ fail 0'] },
  // The new case rejecting a sentence its own author had just written. Subsection 60 explains why the wording moved
  // instead of the guard: `ℹ fail 1` here is the whole five-file documentation suite, and the one red is the case whose
  // comment says a documented command must be a file the repository ships.
  { archive: 'docs/evidence/iter60-guard-caught-its-own-author-2026-11-20.log.gz',
    lines: ['ℹ tests 27', 'ℹ pass 26', 'ℹ fail 1', 'GUARD_EXIT=1'],
    phrases: ['docs/validation.md -> artifacts/iter47-index-generator.mjs (under the ignored artifacts/)',
      'ITER60_AUTHOR_RED 2026-11-20T05:43:46Z HEAD e3982cd425da0daf9fef718ff79ef94ce2442c6d'],
    absent: ['ℹ pass 27', 'GUARD_EXIT=0'] },
  // The four-project gate on the tree that ships the three instruments. It proves the branch still behaves, not this
  // pass's own change: no application byte moved, which is why the archive stamps the product directories unchanged
  // since the iteration-59 commit rather than re-measuring a fix.
  { archive: 'docs/evidence/iter60-gate-2026-11-20.log.gz',
    lines: ['ITER60_GATE_START 2026-11-20T05:31:31Z',
      'GIT_HEAD e3982cd425da0daf9fef718ff79ef94ce2442c6d',
      'Running 260 tests using 1 worker', '260 passed (20.1m)', 'GATE_EXIT=0',
      'ITER60_GATE_DONE 2026-11-20T05:51:41Z'],
    phrases: ['PRODUCT_BYTES public/js server tests-e2e unchanged since HEAD e3982cd',
      '✓   18 [static-desktop] › tests/e2e/chat-refused-ask-keeps-question.spec.js:26:1',
      '✓  214 [node-mobile] › tests/e2e/chat-refused-ask-keeps-question.spec.js:76:1'],
    marks: 0,
    absent: ['✘', 'skipped', 'CONTEXT_UNAVAILABLE'] },
  // The offline suite on the tree at 57 rows, re-run at 62 as iter60-offline-shipped below. Its header names the table
  // size it executed against, and the rows beneath it were written after it ran, which is the same self-reference
  // subsection 58 records rather than something this table can fix.
  { archive: 'docs/evidence/iter60-offline-final-2026-11-20.log.gz',
    lines: ['ℹ tests 262', 'ℹ pass 262', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0',
      '✔ a command named inside a sentence is a file the repository ships, not one only this machine has (19.70925ms)'],
    phrases: ['OFFLINE_CMD npm test (tally table 57 rows, index regenerated)', 'ℹ duration_ms 26160.451375',
      'PRODUCT_SHA 103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89  public/js/modules/chat.js'],
    absent: ['ℹ fail 2', 'OFFLINE_EXIT=1'] },
  // The five documentation guard files alone, on the same tree as the run above. No bootstrap red happened this
  // iteration because the generated index was reprinted before either run started, so this archive is the only guard
  // reading the pass ships.
  { archive: 'docs/evidence/iter60-docsguards-final-2026-11-20.log.gz',
    lines: ['DOCSGUARDS_START 2026-11-20T05:53:46Z', 'ℹ tests 27', 'ℹ pass 27', 'ℹ fail 0', 'ℹ skipped 0',
      'DOCSGUARDS_SUMMARY tests 27 | pass 27 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0', 'GUARD_EXIT=0'],
    phrases: ['GUARD_TABLE_ROWS 57',
      'GUARD_CMD node scripts/docs-guards.mjs (five documentation guard files, tally table 57 rows)'],
    absent: ['ℹ fail 1', 'GUARD_EXIT=1', 'DOCSGUARDS_ABORT'] },
  // Five attacks on the rows this pass wrote, so the gate/offline/guard numbers above are known to be load-bearing
  // rather than decorative.
  { archive: 'docs/evidence/iter60-tally-controls-2026-11-20.log.gz',
    lines: ['CONTROL_TARGET_SHA_BEFORE 60cd2bd207442eb5',
      'CONTROLS_RAN 5 CONTROLS_DETECTED 5 CONTROLS_RED 5',
      'RESTORE_CHECK before=60cd2bd207442eb5 now=60cd2bd207442eb5',
      'AFTER_RESTORE exit=0 tests_fails=0',
      'AFTER_RESTORE_SUMMARY ℹ tests 7 ℹ pass 7 ℹ fail 0', 'LADDER_EXIT=0'],
    phrases: ['ATTACK a1-gate-wall-time exit=1 fail_lines=1 names_target=True DETECTED=yes',
      'ATTACK a3-guard-child-exit exit=1 fail_lines=1 names_target=True DETECTED=yes',
      'ATTACK a4-floor exit=1 fail_lines=1 names_target=True DETECTED=yes',
      'ATTACK a5-absent-needle exit=1 fail_lines=1 names_target=True DETECTED=yes',
      'GIT_HEAD e3982cd425da0daf9fef718ff79ef94ce2442c6d'],
    absent: ['GREEN - CONTROL FAILED', 'REFUSED pattern'] },
  // The ladder that produced the run above, shipped as bytes so a reader can re-run it. Its row pins the floor value
  // the attack was written against, which is how a later pass can tell this archive from a stale one.
  { archive: 'docs/evidence/iter60-tally-controls-ladder-2026-11-20.py.gz',
    lines: ["('a4-floor', 'TALLIES.length >= 59', 'TALLIES.length >= 1005',",
      "TARGET = 'tests/documentation-evidence-index.test.js'", "SUITE = ['node', '--test', TARGET]"],
    phrases: ['def run_suite():', 'if original.count(old) != 1:',
      "print(f'CONTROLS_RAN {len(ATTACKS)} CONTROLS_DETECTED {detected} CONTROLS_RED {detected}')"] },
  // Kept because bundling the ladder into the log it was attacking made that log contain the string its own row
  // forbids, and the guard said so: an archive and its source are two different pieces of evidence.
  { archive: 'docs/evidence/iter60-bundle-red-2026-11-20.log.gz',
    lines: ['ℹ tests 7', 'ℹ pass 6', 'ℹ fail 1', 'RED_EXIT=1'],
    phrases: ['contains "GREEN - CONTROL FAILED", which the ledger states that archive does not print',
      'ITER60_BUNDLE_RED_START'],
    absent: ['ℹ pass 7', 'RED_EXIT=0'] },
  // The offline suite re-run once every row above had landed, so the tally the ledger reports as shipped is the tally of
  // the tree the ledger ships. Its header names a 62-row table because this row is the 63rd.
  { archive: 'docs/evidence/iter60-offline-shipped-2026-11-20.log.gz',
    lines: ['ℹ tests 262', 'ℹ pass 262', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
    phrases: ['OFFLINE_CMD npm test (tally table 62 rows, index regenerated)', 'ℹ duration_ms 27318.48525',
      'PRODUCT_SHA 103dede5c2026f5fa49307c3923053c03e4aa4bc3010bb8d6fc04efe178fca89  public/js/modules/chat.js',
      'ITER60_OFFLINE_SHIPPED_START'],
    absent: ['ℹ fail 1', 'OFFLINE_EXIT=1'] },
  // Iteration 61. The red that started the pass: the two browser cases existed, the fix did not, and the run stopped on
  // the sentence the app invented instead of the one the ledger promises.
  { archive: 'docs/evidence/iter61-browser-red-2026-11-20.log.gz',
    lines: ['CMD npx playwright test place-list-refused --project=node-desktop',
      'HEAD 92fdf2cbdfe09b7eebf93b33476c86bb8f189e42', 'NODE v26.13.1 /opt/homebrew/bin/node',
      '1 failed', '1 passed (1.0m)', 'EXIT=1'],
    phrases: ['Running 2 tests using 1 worker', 'place-list-refused.spec.js:36:3',
      'Received string:  "Choose a region from the current country list."'],
    absent: ['8 passed', 'EXIT=0'], marks: 1 },
  // The same spec after the fix, all four projects, one worker, with the four product/spec hashes it was gated on.
  { archive: 'docs/evidence/iter61-browser-gate-2026-11-20.log.gz',
    lines: ['CMD npx playwright test place-list-refused --workers=1', '8 passed (7.7s)', 'EXIT=0',
      'SHA api=aa5a4c2789f5be26a229f5e7418e3fc4 wa=cf52b64bb5ab8cf23d598a37add6ad11 ctx=454f3be7d958957e999e37dd5ba2bcec spec=c39051f1efa35a2b0e1f6ab1b2b6849a'],
    phrases: ['Running 8 tests using 1 worker', '[node-desktop] › tests/e2e/place-list-refused.spec.js:36:3',
      '[static-mobile] › tests/e2e/place-list-refused.spec.js:100:3'],
    absent: ['1 failed', '2 failed', 'EXIT=1'], marks: 0 },
  // The four-way control ladder: shipped bytes green, both pre-fix files reverted red on two cases, the identity
  // stripped red on the schema case only, the re-read stripped red on the retry case only, and a hash check that the
  // tree came back byte-identical.
  { archive: 'docs/evidence/iter61-controls-2026-11-20.log.gz',
    lines: ['2 passed (1.7s)', '2 failed', '1 passed (1.7s)', '1 passed (1.0m)', '1 failed',
      'RESTORE_OK three product files byte-identical to the manifest taken before the control set'],
    phrases: ['=== CONTROL FIXED revert= ===',
      '=== CONTROL ORIGINAL_DEFECT revert=public/js/modules/workflow-assistant.js public/js/lib/api.js ===',
      '=== CONTROL NO_IDENTITY revert=public/js/lib/api.js ===',
      '=== CONTROL NO_REREAD revert=public/js/modules/context.js ===',
      'No towns are listed for India in this saved place list'],
    absent: ['8 passed', 'RESTORE_MISMATCH'], marks: 4 },
  // The offline suite on the finished-tree-except-the-rows-below, which is where 262 became 268.
  { archive: 'docs/evidence/iter61-offline-2026-11-20.log.gz',
    lines: ['ℹ tests 268', 'ℹ pass 268', 'ℹ fail 0', 'ℹ skipped 0', 'EXIT 0'],
    phrases: ['CMD npm test  (iteration 61 offline suite)', 'HEAD 92fdf2cbdfe09b7eebf93b33476c86bb8f189e42',
      'ℹ duration_ms 24405.868209', 'Built static browser app in dist/client.'],
    absent: ['ℹ fail 1', 'ℹ tests 262'] },
  // The instrument that measures the drift this pass had to repair, kept because its own blind spot is part of the
  // record: 53 HEAD-coordinate pointers moved, and `--head` is the only mode that can see them.
  { archive: 'docs/evidence/iter61-citation-drift-head-2026-11-20.log.gz',
    lines: ['HEAD CITED_LINES_CHECKED 307 DRIFTED 53 INSIDE_DIFF_HUNKS 0',
      'FILES_WITH_EDITS public/js/lib/api.js public/js/modules/context.js public/js/modules/workflow-assistant.js tests/api-transport.test.js tests/workflow-place-choices.test.js'],
    phrases: ["CMD node scripts/citation-drift.mjs --head  (repair list, 20 Nov)",
      'DRIFT docs/validation.md:1007 public/js/modules/workflow-assistant.js:222',
      'warning: in the working copy of \'public/licenses/playwright-apache-2.0.txt\', CRLF will be replaced by LF'],
    absent: ['DRIFTED 0', 'INSIDE_DIFF_HUNKS 3'] },
  // The control for the guard this pass wrote after finding its own defect: repairing a label without its `#LNNN`
  // anchor is a red the citation scan cannot see, so the anchor case reads both and this proves it moves.
  { archive: 'docs/evidence/iter61-anchor-control-2026-11-20.log.gz',
    lines: ['STALE_ANCHOR_EXIT=1', 'RESTORED_EXIT=1', 'RESTORE_OK docs/validation.md byte-identical',
      'VALIDATION_MD5_BEFORE 5fa0d5e968ab6663ab085f3e638ad297',
      'VALIDATION_MD5_AFTER 5fa0d5e968ab6663ab085f3e638ad297',
      'docs/validation.md:1007 labels workflow-assistant.js:235-241 but its anchor lands on line 222'],
    phrases: ['CONTROL_TARGET tests/documentation-citations.test.js against docs/validation.md:1007',
      'NODE v26.13.1 /opt/homebrew/Cellar/node/26.13.1_2/bin/node'],
    // The restored round is 5 pass / 1 fail, not green: the fail is the docs-guards archive this pass cites before it
    // can exist, which is the bootstrap asymmetry subsection 57 records rather than a suppressed red.
    absent: ['RESTORE_MISMATCH', 'ℹ fail 0'] },
  { archive: 'docs/evidence/iter61-docsguards-bootstrap-red-2026-11-20.log.gz',
    lines: ['GUARD_TABLE_ROWS 69', 'ℹ tests 28', 'ℹ pass 26', 'ℹ fail 2', 'GUARD_EXIT=1',
      'DOCSGUARDS_SUMMARY tests 28 | pass 26 | fail 2 | skipped 0'],
    phrases: ['the guard set on the tree that cites its own green docsguards archive one run before that archive can exist',
      'NODE v26.13.1 /opt/homebrew/Cellar/node/26.13.1_2/bin/node',
      'docs/validation.md -> docs/evidence/iter61-docsguards-2026-11-20.log.gz'],
    // The two reds are the pair of existence guards, and nothing else: subsection 57's bootstrap asymmetry again, this
    // time the archive that documents it being the one whose absence turns them red.
    absent: ['ℹ pass 28', 'GUARD_EXIT=0'], marks: 0,
    onlyReds: ['every docs/evidence archive named anywhere in prose exists on disk',
      'every archived evidence file a doc points at exists'] },
  { archive: 'docs/evidence/iter61-docsguards-2026-11-20.log.gz',
    lines: ['GUARD_TABLE_ROWS 70', 'ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0', 'ℹ skipped 0', 'GUARD_EXIT=0',
      'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0'],
    phrases: ['the guard set on the tree whose placeholder docsguards archive is the cited green run',
      'NODE v26.13.1 /opt/homebrew/Cellar/node/26.13.1_2/bin/node'],
    absent: ['ℹ fail 2', 'GUARD_EXIT=1'], marks: 0 },
  { archive: 'docs/evidence/iter61-docsguards-final-2026-11-20.log.gz',
    lines: ['GUARD_TABLE_ROWS 71', 'ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0', 'GUARD_EXIT=0',
      'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0'],
    phrases: ['run after both docsguards archives above were real bytes and their rows were on the table'],
    absent: ['ℹ fail 2', 'GUARD_EXIT=1'], marks: 0 },
  { archive: 'docs/evidence/iter61-offline-shipped-2026-11-20.log.gz',
    lines: ['OFFLINE_CMD npm test (tally table 73 rows, index regenerated)', 'ℹ tests 269', 'ℹ pass 269',
      'ℹ fail 0', 'ℹ skipped 0', 'EXIT 0'],
    phrases: ['CMD npm test  (iteration 61 offline suite on the finished documentation tree)',
      'NODE v26.13.1 /opt/homebrew/Cellar/node/26.13.1_2/bin/node'],
    absent: ['ℹ fail 1', '✖ failing tests:'], marks: 0 },
  // The four-project gate on the finished iteration-61 tree, kept as the red run it was. Five `static-desktop` cases
  // waited out a live service: NASA POWER stalled to its own 25 s client timeout, GIBS stalled twice its budget and
  // Overpass refused until the shared live-fields helper spent its two user retries. The same five specs are green on
  // the other three projects in this very log, on identical delivered bytes, so the archive carries both sides.
  // No timeout was raised, no case was re-run inside the gate and the run was never restarted to harvest a green.
  { archive: 'docs/evidence/iter61-gate-2026-11-20.log.gz',
    lines: ['ITER61_GATE_START 2026-11-20T07:49:50Z',
      'GIT_HEAD 92fdf2cbdfe09b7eebf93b33476c86bb8f189e42',
      'Running 268 tests using 1 worker', '5 failed', '263 passed (25.4m)', 'GATE_EXIT=1',
      'ITER61_GATE_DONE 2026-11-20T08:15:15Z'],
    phrases: ['MD5 api=aa5a4c2789f5be26a229f5e7418e3fc4 ctx=454f3be7d958957e999e37dd5ba2bcec',
      'Received string:    "AssistantNASA evidence could not be loaded. The app has not generated a comparison. ' +
      'Check the error in step 2 and retry.RetryRead aloud"',
      'real fields were still unavailable after two user retries',
      '✓   87 [static-mobile] › tests/e2e/city-state-chat-flow.spec.js:13:1',
      '✓   94 [static-mobile] › tests/e2e/gibs.spec.js:37:1',
      'LOAD_AT_END { 4.03 3.87 3.92 }'],
    absent: ['268 passed', 'GATE_EXIT=0'], marks: 5 },
  // The census the handoff's suite-size cell now leads with. It is read from `--list` on this tip rather than inferred
  // from the gate's own opening line, because the "+8 over iteration 60" the cell claims is a statement about which
  // cases exist: the eight needles below are exactly `place-list-refused.spec.js`'s two cases in each of four projects.
  { archive: 'docs/evidence/iter61-census-2026-11-20.log.gz',
    lines: ['CENSUS_CMD npx playwright test --list (iteration-61 tip, four projects)',
      'HEAD 92fdf2cbdfe09b7eebf93b33476c86bb8f189e42', 'Total: 268 tests in 26 files', 'CENSUS_EXIT=0'],
    phrases: ['[static-desktop] › place-list-refused.spec.js:36:3', '[static-desktop] › place-list-refused.spec.js:100:3',
      '[static-mobile] › place-list-refused.spec.js:36:3', '[static-mobile] › place-list-refused.spec.js:100:3',
      '[node-desktop] › place-list-refused.spec.js:36:3', '[node-desktop] › place-list-refused.spec.js:100:3',
      '[node-mobile] › place-list-refused.spec.js:36:3', '[node-mobile] › place-list-refused.spec.js:100:3'],
    marks: 0, absent: ['test.skip', 'fixme('] },
  // The one informative isolated check the programme allows after a live-service red: the three spec files the gate
  // failed, on the bytes that gate executed, nothing widened and nothing re-run inside the gate itself. Note the
  // header's `chat=` field hashes `public/js/modules/chat.js`, whereas the same label in the gate archive above hashes
  // `public/js/lib/chat-context.js`; the api/ctx/wa hashes are the files the two runs share, and they are equal.
  { archive: 'docs/evidence/iter61-isolated-check-2026-11-20.log.gz',
    lines: ['ITER61_ISOLATED_START 2026-11-20T08:20:40Z',
      'GIT_HEAD 92fdf2cbdfe09b7eebf93b33476c86bb8f189e42',
      'CMD npx playwright test city-state-chat-flow field-terrain gibs --workers=1 ' +
      '--output=artifacts/playwright/iter61-isolated-check',
      'Running 24 tests using 1 worker', '24 passed (3.8m)', 'ISOLATED_EXIT=0',
      'ITER61_ISOLATED_DONE 2026-11-20T08:24:27Z'],
    phrases: ['MD5 api=aa5a4c2789f5be26a229f5e7418e3fc4 ctx=454f3be7d958957e999e37dd5ba2bcec ' +
      'wa=cf52b64bb5ab8cf23d598a37add6ad11',
      '✓   1 [static-desktop] › tests/e2e/city-state-chat-flow.spec.js:13:1',
      '✓   3 [static-desktop] › tests/e2e/field-terrain.spec.js:4:1',
      '✓   6 [static-desktop] › tests/e2e/gibs.spec.js:37:1'],
    marks: 0, absent: ['✘', 'test.skip'] },
  // The two runs that certify the tree after the gate/census/isolated rows above joined it: the offline suite and the
  // five guard files, both captured with the process status read straight off the command (no pipe, so no `tail`
  // exit masquerading as the runner's). Their headers say 76 rows because that is the table they executed against;
  // the two rows you are reading are the 77th and 78th, which is subsection 57's asymmetry stated instead of hidden.
  { archive: 'docs/evidence/iter61-offline-tally76-2026-11-20.log.gz',
    lines: ['OFFLINE_CMD node --test tests/*.test.js (iteration 61, tally table 76 rows, index regenerated)',
      'HEAD 92fdf2cbdfe09b7eebf93b33476c86bb8f189e42', 'ℹ tests 269', 'ℹ pass 269', 'ℹ fail 0', 'ℹ skipped 0',
      'OFFLINE_EXIT=0'],
    phrases: ['a saved list that could not be read says so, keeps the country and re-asks instead of caching the failure',
      'a list that arrives unreadable reports its own reason and offers no retry that cannot help',
      'an answered empty list keeps its wording and a cancelled read is never answered as data'],
    marks: 0, absent: ['✘', 'not ok', 'test.skip'] },
  { archive: 'docs/evidence/iter61-docsguards-tally76-2026-11-20.log.gz',
    lines: ['DOCSGUARDS_CMD node scripts/docs-guards.mjs (iteration 61, tally table 76 rows, index regenerated)',
      'GUARD_FILES 5', 'ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0',
      'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0', 'DOCSGUARDS_EXIT=0'],
    phrases: ['the tally of every archived run is printed by that archive, not by the prose quoting it',
      'every shipped evidence file is named by a document or carried by the index',
      'the committed index is what the shipped generator prints, line for line'],
    marks: 0, absent: ['✘', 'not ok'] },
  // Iteration 62, goal 6: the measurement that decided the work, and the two runs that show what the shipped fix
  // changes. The census had to be archived because the ledger now quotes 2,338 taps from it; the probe pair had to be
  // archived as a pair because the before run is the only witness that the node transport really did blame the farmer.
  { archive: 'docs/evidence/iter62-census-2026-11-20.log.gz',
    lines: ['TAPS_MEASURED 2338 | region 655 | town 1683', 'INSTRUMENT_FAILURES 0', 'DIVERGENT 27',
      'DIVERGENT_BY_STAGE town=27', 'DIVERGENT_BY_CATEGORY region-changed=7 point-changed-or-lost=20',
      'CENSUS_DONE', 'CENSUS_EXIT=0'],
    phrases: ['HEAD bf4bc8c63085ba7bd357b7c598af9e4d56168de1', 'test:choice-loss'],
    marks: 0, absent: ['✘', 'not ok'] },
  { archive: 'docs/evidence/iter62-tap-rejection-before-fix-2026-11-20.log.gz',
    lines: ['VERDICT_NODE town_tap_rejects=false region_tap_rejects=true',
      'VERDICT_STATIC town_tap_rejects=false region_tap_rejects=false',
      'B_TAP_STATUS Choose a region from the current country list.',
      'B_TAP_REGION_FIELD ""', 'TAPREJ_NODE_EXIT=0'],
    phrases: ['B_TAP_COMPOSER "Hamilton city"', 'A_REJECTED false', 'B_REGION_FIELD_PLACEHOLDER "List unavailable'],
    marks: 0 },
  { archive: 'docs/evidence/iter62-tap-rejection-after-fix-2026-11-20.log.gz',
    lines: ['VERDICT_NODE town_tap_rejects=false region_tap_rejects=true',
      'VERDICT_STATIC town_tap_rejects=false region_tap_rejects=false',
      'B_STATUS The saved place list for Bermuda could not be read just now, so the region you chose could not be ' +
      'checked against it. Nothing was selected; step 1 shows the same failure and its lists refill once that lookup ' +
      'answers.', 'B_LAST_SPEAKER You', 'B_REQUESTS_DURING_TAP 0 []', 'B_REQUESTS_DURING_TAP 1 []'],
    phrases: ['HEAD bf4bc8c63085ba7bd357b7c598af9e4d56168de1', 'COUNTS {"A":3,"B":0}', 'COUNTS {"A":2,"B":1}'],
    marks: 0, absent: ['Choose a region from the current country list'] },
  { archive: 'docs/evidence/iter62-region-tap-red-2026-11-20.log.gz',
    lines: ['1 failed'],
    phrases: ['Received string:  "Choose a region from the current country list."', 'Timeout: 60000ms',
      'place-list-refused.spec.js:154:3'],
    marks: 1 },
  { archive: 'docs/evidence/iter62-region-tap-negative-control-2026-11-20.log.gz',
    lines: ['1 failed'],
    phrases: ["Error: a list read that failed is reported as the farmer's own choice: Choose a region from the " +
      'current country list.', 'Received string:      "Choose a region from the current country list."'],
    marks: 1 },
  { archive: 'docs/evidence/iter62-region-tap-green-2026-11-20.log.gz',
    lines: ['1 passed (2.1s)'], phrases: ['place-list-refused.spec.js:154:3'], marks: 0 },
  { archive: 'docs/evidence/iter62-spec-four-projects-2026-11-20.log.gz',
    lines: ['3 passed (2.7s)', '3 passed (2.5s)', '3 passed (2.4s)'],
    phrases: ['[static-desktop] › tests/e2e/place-list-refused.spec.js:154:3', '[static-mobile] › tests/e2e/place-list-refused.spec.js:154:3',
      '[node-desktop] › tests/e2e/place-list-refused.spec.js:154:3', '[node-mobile] › tests/e2e/place-list-refused.spec.js:154:3'],
    marks: 0 },
  { archive: 'docs/evidence/iter62-offline-negative-control-2026-11-20.log.gz',
    lines: ['ℹ tests 31', 'ℹ pass 30', 'ℹ fail 1'],
    phrases: ['the tapped region was looked up again instead of read from the list its buttons came from',
      'actual: 3', 'expected: 2'],
    onlyReds: ['a tapped place choice answers without re-reading the list, whatever the place service does afterwards'],
    marks: 0 },
  { archive: 'docs/evidence/iter62-offline-pair-green-2026-11-20.log.gz',
    lines: ['ℹ tests 33', 'ℹ pass 33', 'ℹ fail 0', 'ℹ skipped 0'],
    phrases: ['a tapped place choice answers without re-reading the list, whatever the place service does afterwards',
      'moving while country lookup is pending starts a lookup for the new coordinates and ignores the old result'],
    marks: 0, absent: ['✘', 'not ok'] },
  // The three closing readings of this pass: what the four-project suite now holds, the whole offline suite on the
  // shipped bytes and the guard set re-run after the iteration-62 ledger bullet existed. The offline header names the
  // 87-row table it executed against, which is the row count before the three rows below it - the bootstrap asymmetry
  // subsections 57, 58 and 61 record, restated here rather than hidden by re-running.
  { archive: 'docs/evidence/iter62-census-playwright-2026-11-20.log.gz',
    lines: ['Total: 272 tests in 26 files', 'CENSUS_EXIT=0'],
    phrases: ['[static-desktop] › place-list-refused.spec.js:154:3', '[static-mobile] › place-list-refused.spec.js:154:3',
      '[node-desktop] › place-list-refused.spec.js:154:3', '[node-mobile] › place-list-refused.spec.js:154:3',
      'a tapped region the form cannot check names the read that failed and still leaves its region selectable'],
    marks: 0, absent: ['test.skip', 'fixme(', 'CENSUS_EXIT=1'] },
  { archive: 'docs/evidence/iter62-offline-final-2026-11-20.log.gz',
    lines: ['ℹ tests 270', 'ℹ pass 270', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
    phrases: ['OFFLINE_CMD node --test tests/*.test.js (iteration 62, tally table 87 rows, index regenerated)',
      'HEAD bf4bc8c63085ba7bd357b7c598af9e4d56168de1', 'duration_ms 24349.294625'],
    marks: 0, absent: ['✖', 'OFFLINE_EXIT=1', 'ℹ fail 1'] },
  { archive: 'docs/evidence/iter62-docsguards-final-2026-11-20.log.gz',
    lines: ['GUARD_FILES 5', 'ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0', 'ℹ skipped 0',
      'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0'],
    phrases: ['CMD node scripts/docs-guards.mjs on the iteration-62 tree after the AGENTS.md section 10 bullet was written',
      'GUARD_FILE tests/documentation-citation-anchors.test.js'],
    marks: 0, absent: ['✖', 'fail 1', ': SKIP -'] },
  // The gate on the delivered bytes, archived from the log the runner wrote rather than from a re-run: 272 cases across
  // the four projects, green, with the one live-service event of the pass (a field-lookup refusal the server absorbed)
  // still in it. The new region-tap case is quoted once per project because the parity claim is that all four agree.
  { archive: 'docs/evidence/iter62-gate-2026-11-20.log.gz',
    lines: ['272 passed (17.9m)', 'GATE_EXIT=0', 'Running 272 tests using 1 worker'],
    phrases: ['GIT_HEAD bf4bc8c63085ba7bd357b7c598af9e4d56168de1', 'ITER62_GATE_DONE 2026-11-20T09:55:09Z',
      'server/context/farms.js:89', "code: 'CONTEXT_UNAVAILABLE'",
      'The field lookup services are busy or unavailable (8 attempts across 3 services). No fields were invented.',
      '✓   45 [static-desktop] › tests/e2e/place-list-refused.spec.js:154:3',
      '✓  113 [static-mobile] › tests/e2e/place-list-refused.spec.js:154:3',
      '✓  181 [node-desktop] › tests/e2e/place-list-refused.spec.js:154:3',
      '✓  249 [node-mobile] › tests/e2e/place-list-refused.spec.js:154:3'],
    marks: 0, absent: ['✘', 'GATE_EXIT=1', 'did not run', 'cdn.jsdelivr.net'] },
  // The offline suite re-run once the gate archive was on the shelf and this table carried 91 rows. Its header names
  // that size, which is the row count before its own row below - the asymmetry the paragraph quoting it states.
  { archive: 'docs/evidence/iter62-offline-gate-row-2026-11-20.log.gz',
    lines: ['ℹ tests 270', 'ℹ pass 270', 'ℹ fail 0', 'ℹ skipped 0', 'ℹ duration_ms 26503.551708'],
    phrases: ['CMD node --test tests/*.test.js (iteration 62, tally table 91 rows, index regenerated at evidence 661, ' +
      'the gate archive already shelved)', 'HEAD bf4bc8c63085ba7bd357b7c598af9e4d56168de1',
      'EXIT_OBSERVED_BY_ARCHIVER 0'],
    marks: 0, absent: ['✖', 'ℹ fail 1', 'OFFLINE_EXIT'] },
  // Iteration 63, goal 6 (the P1/P2 pair). The two ranking probes are archived as a pair on purpose: the synthetic one is
  // the only witness that the *selection* changes when the evidence disappears (the same inputs, a different Alternative
  // 1, one vector slot different), and the capture-derived one is the only witness of the sentence the shipped code
  // prints for the crops and the year the browser spec serves. The controls pair is kept for the same reason: the first
  // pass's C6 was a control that proved nothing, and a table that only carries the re-cut would hide that.
  { archive: 'docs/evidence/iter63-synthetic-ranking-probe-2026-11-20.log.gz',
    lines: ['C_MISSING_EQ MATURITY [{"label":"Existing rotation","missing":205,"maturity":205,"equal":true},'
      + '{"label":"Alternative 1","missing":180,"maturity":180,"equal":true},'
      + '{"label":"Alternative 2","missing":185,"maturity":185,"equal":true}]',
      'C_ALTERNATIVES_SPARSE 1:radish--radish--radish 2:bush-bean--radish--radish',
      'C_ALTERNATIVES_FULL 1:bush-bean--radish--radish 2:radish--bush-bean--radish',
      'C_COMPARED 1 vector_changed 1 changed_only_by_missing_evidence 1',
      'C_SPARSE_ORDER 1:180/180 2:185/185', 'C_FULL_ORDER 1:0/185 2:0/185'],
    phrases: ['CATALOG_IDS radish,bush-bean,pea,onion COUNT 4', 'B_ENGINE_ACCEPTED true candidates 63'],
    marks: 0, absent: ['✘', 'not ok'] },
  { archive: 'docs/evidence/iter63-all-fill-derivation-2026-11-20.log.gz',
    lines: ['CAPTURE header.fill_value -999 parameters 5 value cells 1830 non-fill cells 1830',
      'DERIVED value cells 1830 non-fill after derivation 0 metadata preserved true',
      'NORMALIZED dates 366 validDays T2M 0,T2M_MAX 0,T2M_MIN 0,PRECTOTCORR 0,ALLSKY_SFC_SW_DWN 0 latestAvailableDate null completeMonths 0 notices 5',
      'RANKING evidenceLimited true priority water',
      'SCENARIOS baseline|245|245|0|0|0 pea--pea--pea|240|240|0|0|0 pea--pea--sweet-corn|260|260|0|0|0',
      'CONTROL_POPULATED evidenceLimited false limitation starts "Counts are screening rules, not suitabil"',
      'ALL_FILL_DERIVATION_DONE'],
    phrases: ['CMD node artifacts/scratch/iter63/all-fill-derivation.mjs', 'usable days out of 366: T2M 0, T2M_MIN 0'],
    marks: 0, absent: ['✘', 'not ok'] },
  { archive: 'docs/evidence/iter63-cache-fill-probe-2026-11-20.log.gz',
    lines: ['HEADLESS_FILL fetches 1 first.hit false second.hit true validDays 0,0,0,0,0 latest null',
      'CONTROL_POPULATED fetches 1 first.hit false second.hit true validDays 366,366,366,366,366 latest "2024-12-31"',
      'SAME_SENTENCE both paths print {"cache":{"hit":false,"ttlSeconds":21600}} {"cache":{"hit":false,"ttlSeconds":21600}}',
      'TTL retry_inside_ttl.hit true retry_after_ttl.hit false fetches 2 ttlSeconds 21600', 'CACHE_FILL_PROBE_DONE'],
    phrases: ['CMD node artifacts/scratch/iter63/cache-fill-probe.mjs'], marks: 0, absent: ['✘', 'not ok'] },
  { archive: 'docs/evidence/iter63-offline-controls-run1-2026-11-20.log.gz',
    lines: ["CONTROL C6 persistence-seam-ignored mutated server/nasa/power.js -> 'persistence = { readCached: async () => null, '",
      'VERDICT MISSED', 'RESTORE_OK'],
    phrases: ['  counts: ℹ tests 24 ℹ pass 24 ℹ fail 0', '  red tests: 0 | named-as-must-fail matched: 0'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter63-offline-controls-2026-11-20.log.gz',
    lines: ['CONTROL C1 never-disclose mutated server/agronomy/rotation.js -> \'const evidenceLimited = false && hasAllSeries\'',
      'CONTROL C2 always-disclose mutated server/agronomy/rotation.js -> \'const evidenceLimited = true || hasAllSeries\'',
      'CONTROL C3 sentence-not-merged-into-limitation mutated server/agronomy/rotation.js -> \'`Counts are screening rules\'',
      "CONTROL C4 always-persist mutated server/nasa/power.js -> 'const persisted = true;'",
      "CONTROL C5 never-persist mutated server/nasa/power.js -> 'const persisted = false;'",
      "CONTROL C6 persistence-seam-bypassed mutated server/nasa/power.js -> ''",
      "CONTROL C7 write-guard-dropped mutated server/nasa/power.js -> 'await persistence.writeCached('",
      'RESTORE_OK', 'FINAL_REPLAY ℹ tests 24 ℹ pass 24 ℹ fail 0 reds 0'],
    phrases: ["BASE {'server/agronomy/rotation.js': 'a6c523bf7805', 'server/nasa/power.js': 'e5f1aba224ba'}"],
    marks: 0, absent: ['VERDICT MISSED', 'PARTIAL', '✘'] },
  // The spec's own history, kept as three readings because the story is the point: 12 red on its first execution (every
  // one a spec assertion wrong about the app), the same three cases green per project once repaired, then 20 green with
  // the device-cache half added.
  { archive: 'docs/evidence/iter63-spec-first-run-2026-11-20.log.gz',
    lines: ['Running 12 tests using 1 worker', '12 failed'],
    phrases: ['Error: a year of fill codes produced a non-zero valid-day count',
      'Error: the collapsed note and the visible notice disagree',
      'zero-evidence-parity.spec.js:41:1 › the empty year this spec serves'],
    marks: 12 },
  { archive: 'docs/evidence/iter63-spec-repaired-12-2026-11-20.log.gz',
    lines: ['Running 12 tests using 1 worker', '12 passed (8.6s)'],
    phrases: ['[static-desktop] › tests/e2e/zero-evidence-parity.spec.js:44:1',
      '[node-mobile] › tests/e2e/zero-evidence-parity.spec.js:136:1',
      '[node-desktop] › tests/e2e/zero-evidence-parity.spec.js:168:1'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter63-spec-focused-2026-11-20.log.gz',
    lines: ['Running 20 tests using 1 worker', '20 passed (15.4s)'],
    phrases: ['[static-desktop] › tests/e2e/zero-evidence-parity.spec.js:225:1',
      '[node-mobile] › tests/e2e/zero-evidence-parity.spec.js:245:1'],
    marks: 0, absent: ['✘', 'did not run'] },
  { archive: 'docs/evidence/iter63-control-renderer-2026-11-20.log.gz',
    lines: ['C8 VERDICT DETECTED: spec exited non-zero', 'RESTORE_OK 34a43fcd43c2be9543139e813e777ec3',
      '|   4 failed', '|   8 passed (1.1m)', '| FINAL_REPLAY   12 passed (8.3s)'],
    phrases: ['MUTATED: deleted line 28 (the visible notice append)',
      'Error: expect(locator).toHaveCount(expected) failed',
      'zero-evidence-parity-the-c-de394--its-evidence-criterion-did-node-mobile'],
    marks: 0 },
  { archive: 'docs/evidence/iter63-control-devicecache-2026-11-20.log.gz',
    lines: ['C9 VERDICT DETECTED: spec exited non-zero', 'RESTORE_OK 15dd3b30db33c958b901194d0cd63646',
      '|   4 failed', '|   16 passed (23.4s)', '| FINAL_REPLAY   20 passed (14.3s)'],
    phrases: ['MUTATED 127:', 'zero-evidence-parity-a-yea-d2762-written-to-the-device-cache-static-desktop',
      'zero-evidence-parity-a-yea-d2762-written-to-the-device-cache-node-desktop'],
    marks: 0 },
  { archive: 'docs/evidence/iter63-gate-2026-11-20.log.gz',
    lines: ['Running 292 tests using 1 worker', '292 passed (21.1m)', 'GATE_EXIT=0'],
    phrases: ['ITER63_GATE_START 2026-11-20T10:40:10Z', 'ITER63_GATE_DONE 2026-11-20T11:01:16Z',
      '[node-desktop] › tests/e2e/zero-evidence-parity.spec.js:225:1',
      'unavailable (6 attempts across 3 services)', 'server/context/farms.js:89'],
    marks: 0, absent: ['✘', 'did not run', 'cdn.jsdelivr.net'] },
  { archive: 'docs/evidence/iter63-census-playwright-2026-11-20.log.gz',
    lines: ['Total: 292 tests in 27 files', 'CENSUS_EXIT=0'],
    phrases: ['[static-desktop] › zero-evidence-parity.spec.js:44:1',
      '[node-mobile] › zero-evidence-parity.spec.js:245:1'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter63-offline-absent-claim-red-2026-11-20.log.gz',
    lines: ['ℹ tests 274', 'ℹ pass 271', 'ℹ fail 3', 'ℹ skipped 0', 'OFFLINE_EXIT=1'],
    phrases: ['the header says 672 files under docs/evidence and the scan found 674',
      'contains "✘", which the ledger states that archive does not print',
      'docs/evidence-index.md is not what scripts/evidence-index-generator.mjs prints'],
    marks: 0 },
  { archive: 'docs/evidence/iter63-docsguards-absent-claim-red-2026-11-20.log.gz',
    lines: ['ℹ tests 28', 'ℹ pass 25', 'ℹ fail 3', 'ℹ skipped 0',
      'DOCSGUARDS_SUMMARY tests 28 | pass 25 | fail 3 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 1'],
    phrases: ['the tally of every archived run is printed by that archive, not by the prose quoting it',
      'the committed index is what the shipped generator prints, line for line'],
    marks: 0 },
  { archive: 'docs/evidence/iter63-docsguards-final-2026-11-20.log.gz',
    lines: ['ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0', 'ℹ skipped 0',
      'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0'],
    phrases: ['against the 106-row tally table'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter63-offline-final-2026-11-20.log.gz',
    lines: ['ℹ tests 274', 'ℹ pass 274', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
    phrases: ['a saved list that could not be read says so', 'the tally of every archived run is printed by that archive'],
    marks: 0, absent: ['✘'] },
  // Iteration 64. A place name that is also another country's name reached the switch guard while the country's own
  // saved list was refusing, and the guard answered "it is not a local place" - which moves the whole plan. The probe
  // that measured it, the offline cases as they were written red, the controls pass that missed one of its own
  // mutations, the browser drafts that were blind to their own instrumentation and the green that followed.
  { archive: 'docs/evidence/iter64-country-switch-probe-2026-11-20.log.gz',
    phrases: ['PARSE_INNER_MONGOLIA countries=["MN"]',
      'S2_FAILED_LIST after=country=MN region=null place=null evidence=null',
      'CMD node artifacts/scratch/iter64/country-switch-probe.mjs'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-coord-list-refused-probe-2026-11-20.log.gz',
    phrases: ['listRefused=true', 'The saved place list could not load.',
      '{"country":"IN","location":null}'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-offline-cases-red-4-2026-11-20.log.gz',
    lines: ['ℹ tests 35', 'ℹ pass 31', 'ℹ fail 4', 'ℹ skipped 0'],
    onlyReds: ['a switch an unreadable list cannot arbitrate keeps the plan and names the read it could not do',
      'a list whose shape cannot be read offers the move outright and no retry it has ruled out',
      '“switch to Mongolia” still moves the plan when the saved list refuses',
      'a cancelled list read is a stop, not a licence to move the plan to another country'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-offline-cases-red-3-2026-11-20.log.gz',
    lines: ['ℹ tests 35', 'ℹ pass 32', 'ℹ fail 3', 'ℹ skipped 0'],
    onlyReds: ['a switch an unreadable list cannot arbitrate keeps the plan and names the read it could not do',
      'a list whose shape cannot be read offers the move outright and no retry it has ruled out',
      'a cancelled list read is a stop, not a licence to move the plan to another country'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-offline-cases-green-37-2026-11-20.log.gz',
    lines: ['ℹ tests 37', 'ℹ pass 37', 'ℹ fail 0', 'ℹ skipped 0'],
    phrases: ['a switch an unreadable list cannot arbitrate keeps the plan and names the read it could not do',
      'a list answering the switch check after the plan moved on stops instead of answering'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter64-offline-controls-superseded-2026-11-20.log.gz',
    phrases: ['CONTROL C6 no guard after the switch read', 'fail_count=0 restore_ok=true', 'red=[]'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-offline-controls-2026-11-20.log.gz',
    phrases: ['CONTROL C1 shipped bare-catch shape', 'CONTROL C7 harness ignores the country',
      'fail_count=3 restore_ok=true digest=89d6666e1f567185c2bcf2b7ee2e4bda',
      'fail_count=2 restore_ok=true digest=8598d72d8a805b0f49dc96518a8e8190'],
    marks: 0, absent: ['fail_count=0'] },
  { archive: 'docs/evidence/iter64-browser-red-form-built-plan-2026-11-20.log.gz',
    lines: ['4 failed', '12 passed (13.0s)'],
    phrases: ['ITER64_SPEC_START 2026-11-20T11:55:26Z HEAD=6ca7cca6cdf32e5e79678d88c2a3caaa43fa84f6', 'the switch check read the saved list, so the refusal below is one it received'], marks: 0 },
  { archive: 'docs/evidence/iter64-browser-red-worker-cache-2026-11-20.log.gz',
    lines: ['2 failed', '14 passed (12.8s)'],
    phrases: ['ITER64_SPEC_START 2026-11-20T11:57:36Z HEAD=6ca7cca6cdf32e5e79678d88c2a3caaa43fa84f6', 'Error: the switch check read the saved list, so the refusal below is one it received'], marks: 0 },
  { archive: 'docs/evidence/iter64-browser-focused-green-2026-11-20.log.gz',
    lines: ['16 passed (11.7s)'],
    phrases: ['ITER64_SPEC_START 2026-11-20T12:02:40Z HEAD=6ca7cca6cdf32e5e79678d88c2a3caaa43fa84f6', 'a region spelled like another country keeps the plan when the list refuses'], marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter64-browser-control-2026-11-20.log.gz',
    lines: ['4 failed', '12 passed (14.3s)'],
    phrases: ['ITER64_NEGCTL_BROWSER_START 2026-11-20T12:03:57Z HEAD=6ca7cca6cdf32e5e79678d88c2a3caaa43fa84f6', '2a27d927af5aeca3cf0fa517dad8650f', 'Error: a list that refused cannot claim the name is not a local place'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-browser-restore-green-2026-11-20.log.gz',
    lines: ['16 passed (14.5s)'],
    phrases: ['ITER64_RESTORE md5=89d6666e1f567185c2bcf2b7ee2e4bda expected=89d6666e1f567185c2bcf2b7ee2e4bda'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter64-bare-name-crop-misanswer-2026-11-20.log.gz',
    phrases: ['active_before=false active_after=false asked=[]', 'reply=""', 'Georgia is selected',
      'SOURCE_MD5=89d6666e1f567185c2bcf2b7ee2e4bda'],
    marks: 0 },
  { archive: 'docs/evidence/iter64-offline-final-2026-11-20.log.gz',
    lines: ['ℹ tests 280', 'ℹ pass 280', 'ℹ fail 0', 'ℹ skipped 0'],
    phrases: ['a tapped place choice answers without re-reading the list',
      'OFFLINE CMD=node --test tests/*.test.js'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter64-offline-final-full-2026-11-20.log.gz',
    lines: ['ℹ tests 280', 'ℹ pass 280', 'ℹ fail 0', 'ℹ skipped 0', 'ℹ duration_ms 24392.744083'],
    phrases: ['a list answering the switch check after the plan moved on stops instead of answering',
      'a switch an unreadable list cannot arbitrate keeps the plan and names the read it could not do',
      'a cancelled list read is a stop, not a licence to move the plan to another country'],
    marks: 0, absent: ['✘'] },
  { archive: 'docs/evidence/iter64-gate-2026-11-20.log.gz',
    lines: ['Running 296 tests using 1 worker', '296 passed (23.4m)', 'GATE_EXIT=0', 'ITER64_GATE_DONE 2026-11-20T12:30:21Z'],
    phrases: ['GIT_HEAD 6ca7cca6cdf32e5e79678d88c2a3caaa43fa84f6',
      'MD5 assistant=89d6666e1f567185c2bcf2b7ee2e4bda', 'place-list-refused.spec.js:224:3',
      '(8 attempts across 3 services). No fields were invented'],
    marks: 0, absent: ['✘', 'did not run', 'cdn.jsdelivr.net', 'skipped'] },
  { archive: 'docs/evidence/iter64-census-2026-11-20.log.gz',
    lines: ['Listing tests:', 'Total: 296 tests in 27 files'],
    phrases: ['[node-mobile] › zero-evidence-parity.spec.js:245:1', 'place-list-refused.spec.js:224:3'],
    marks: 0, absent: ['✘', 'skipped'] },
  { archive: 'docs/evidence/iter64-spec-comment-shelf-repoint-2026-11-20.log.gz',
    lines: ['16 passed (11.4s)'],
    phrases: ['ITER64_SPEC_DONE 2026-11-20T12:33:50Z exit=0', 'ac19cc29c44b8f14f1a6c9cdb6b9456c',
      'dccb577c480dc3224afacd393b88ccf1'],
    marks: 0, absent: ['✘', 'did not run'] },
  // The probe that walked the shipped module over the shipped location adapter, both arms.
  { archive: 'docs/evidence/iter65-f5-coord-refused-recheck-2026-11-20.log.gz',
   phrases: ['PROBE iter65-recheck WHAT=F5 coordinate sentence against a refused saved list HEAD=e32ec0a NODE=',
       '--- listRefused=false', '--- listRefused=true',
       'outcome: {"threw":"Error: The saved place list could not load.","cancelled":false}',
       'state: {"country":"IN","location":null}', 'SyntaxError: Invalid or unexpected token'],
    marks: 0 },
  // Five of the six coordinate cases against the module as `e32ec0a` shipped it.
  { archive: 'docs/evidence/iter65-offline-cases-red-3-2026-11-20.log.gz',
   lines: ['ℹ tests 42', 'ℹ pass 39', 'ℹ fail 3'],
   phrases: ['SOURCE_MD5=89d6666e1f567185c2bcf2b7ee2e4bda'],
   onlyReds: ['a coordinate sentence whose saved list refused answers instead of throwing out of respond()',
       'a coordinate sentence against an unreadable list shape reports its own reason and offers no retry',
       'the coordinate sentence sets the point as soon as the saved list answers again'],
    marks: 0 },
  // The whole file after a harness rename left the old counter name dangling.
  { archive: 'docs/evidence/iter65-offline-harness-rename-37-2026-11-20.log.gz',
   lines: ['ℹ tests 42', 'ℹ pass 5', 'ℹ fail 37'],
   phrases: ['SOURCE_MD5=166c93504f3d0bc817c02ccb3cd8c6a6'],
    marks: 0 },
  // The 43-case green on a revision of the test file edited again before delivery.
  { archive: 'docs/evidence/iter65-offline-cases-green-43-earlier-test-bytes-2026-11-20.log.gz',
   lines: ['ℹ tests 43', 'ℹ pass 43', 'ℹ fail 0'],
   phrases: ['TEST_MD5=965600d1e6c4714379c8b2e800e0cde6'],
    marks: 0 },
  // The six coordinate cases against the pre-fix module, same superseded revision.
  { archive: 'docs/evidence/iter65-offline-revert-control-earlier-test-bytes-2026-11-20.log.gz',
   lines: ['ℹ tests 6', 'ℹ pass 2', 'ℹ fail 4'],
   phrases: ['REVERTED_MD5=89d6666e1f567185c2bcf2b7ee2e4bda', 'TEST_MD5=965600d1e6c4714379c8b2e800e0cde6'],
    marks: 0 },
  // The second mutant ladder, same superseded revision, printed as the script emitted it.
  { archive: 'docs/evidence/iter65-offline-controls-earlier-test-bytes-2026-11-20.log.gz',
   phrases: ['module_md5 166c93504f3d0bc817c02ccb3cd8c6a6', 'TEST_MD5=965600d1e6c4714379c8b2e800e0cde6',
       'guard-after-duplicate-read tests 6 fail 4 restore_ok True',
       'swallow-cancellation tests 6 fail 1 restore_ok True'],
    marks: 0 },
  // The first ladder, whose own restore flag was computed before the restore write.
  { archive: 'docs/evidence/iter65-offline-controls-superseded-2026-11-20.log.gz',
   phrases: ['"restore_ok": false', '"control": "guard-after-duplicate-read"', '"tests": "6"'],
    marks: 0 },
  // The whole offline suite before any ledger or pin repair.
  { archive: 'docs/evidence/iter65-offline-docguards-red-2026-11-20.log.gz',
   lines: ['ℹ tests 286', 'ℹ pass 283', 'ℹ fail 3'],
   phrases: ['TEST_MD5=965600d1e6c4714379c8b2e800e0cde6'],
   onlyReds: ['every pinned ledger citation lands on the statement the ledger quotes',
       'every docs/evidence archive named anywhere in prose exists on disk',
       'every file:line citation resolves and names a line that exists and is not blank'],
    marks: 0 },
  // The build that put the delivered module into `dist/client`.
  { archive: 'docs/evidence/iter65-build-witness-2026-11-20.log.gz',
   lines: ['BUILD_EXIT=0'],
   phrases: ['MODULE_BEFORE=166c93504f3d0bc817c02ccb3cd8c6a6', 'Built static browser app in dist/client.'],
    marks: 0 },
  // The new page case, focused, on the node transport.
  { archive: 'docs/evidence/iter65-browser-focused-green-node-2026-11-20.log.gz',
   lines: ['Running 1 test using 1 worker', 'FOCUS_EXIT=0'],
   phrases: ['1 passed', '--project=node-desktop'],
   absent: ['✘'],
    marks: 0 },
  // The same case, focused, on the static transport.
  { archive: 'docs/evidence/iter65-browser-focused-green-static-2026-11-20.log.gz',
   lines: ['Running 1 test using 1 worker', 'FOCUS_EXIT=0'],
   phrases: ['1 passed', '--project=static-desktop'],
   absent: ['✘'],
    marks: 0 },
  // The delivered file, 43 cases, on the delivered module and test bytes.
  { archive: 'docs/evidence/iter65-offline-cases-green-43-2026-11-20.log.gz',
   lines: ['ℹ tests 43', 'ℹ pass 43', 'ℹ fail 0', 'ℹ skipped 0'],
   phrases: ['TEST_MD5=a8ec8622d9f61ed295285e251cf5cd63', 'OFL_EXIT=0 utc=2026-11-20T15:26:31Z'],
    marks: 0 },
  // The delivered file against the module as HEAD ships it.
  { archive: 'docs/evidence/iter65-offline-revert-delivered-2026-11-20.log.gz',
   lines: ['ℹ tests 43', 'ℹ pass 39', 'ℹ fail 4'],
   phrases: ['TEST_MD5=a8ec8622d9f61ed295285e251cf5cd63'],
   onlyReds: ['a coordinate sentence whose saved list refused answers instead of throwing out of respond()',
       'a coordinate sentence against an unreadable list shape reports its own reason and offers no retry',
       'a coordinate sentence that moved the plan into a country whose list refused reports the half-moved state',
       'the coordinate sentence sets the point as soon as the saved list answers again'],
    marks: 0 },
  // The five mutants re-run on the delivered test bytes.
  { archive: 'docs/evidence/iter65-offline-controls-2026-11-20.log.gz',
   lines: ['MODULE_AFTER=166c93504f3d0bc817c02ccb3cd8c6a6'],
   phrases: ['TEST_MD5=a8ec8622d9f61ed295285e251cf5cd63', 'restore_ok=true', 'OFL_EXIT=0 utc=2026-11-20T15:26:42Z',
       'guard-after-duplicate-read', 'swallow-cancellation'],
    marks: 0 },
  // The witnessed page control: revert, build, fail both transports, restore, build, pass both.
  { archive: 'docs/evidence/iter65-browser-controls-restore-2026-11-20.log.gz',
   lines: ['BUILD_REVERTED_EXIT=0', 'BUILD_RESTORE_EXIT=0'],
   phrases: ['module=89d6666e1f567185c2bcf2b7ee2e4bda dist=89d6666e1f567185c2bcf2b7ee2e4bda unreadable_in_dist=0',
       'module=166c93504f3d0bc817c02ccb3cd8c6a6 dist=166c93504f3d0bc817c02ccb3cd8c6a6 unreadable_in_dist=2',
       '121 × locator resolved', 'PLAYWRIGHT_EXIT rc=1 project=node-desktop',
       'PLAYWRIGHT_EXIT rc=1 project=static-desktop', 'PLAYWRIGHT_EXIT rc=0 project=node-desktop',
       'PLAYWRIGHT_EXIT rc=0 project=static-desktop', '1 passed (1.3s)'],
    marks: 2 },
  // The four-project gate on the delivered bytes, before any ledger moved.
  { archive: 'docs/evidence/iter65-gate-2026-11-20.log.gz',
   lines: ['Running 300 tests using 1 worker', '300 passed (26.2m)', 'GATE_EXIT=0'],
   phrases: ['ITER65_GATE_START 2026-11-20T14:59:17Z', 'ITER65_GATE_DONE 2026-11-20T15:25:28Z',
       'ITER65_FROZEN assistant=166c93504f3d0bc817c02ccb3cd8c6a6',
       'spec=92d37f54fa118cdca30d31f1867647d8 placetest=a8ec8622d9f61ed295285e251cf5cd63'],
   absent: ['✘', 'did not run', 'skipped'],
    marks: 0 },
  // The `--list` census on the same tree.
  { archive: 'docs/evidence/iter65-census-2026-11-20.log.gz',
   lines: ['Total: 300 tests in 27 files'],
   phrases: ['chat-refused-ask-keeps-question.spec.js:113:1'],
   absent: ['✘'],
    marks: 0 },
  // The whole offline suite on delivered bytes with the pins still naming the pre-fix lines.
  { archive: 'docs/evidence/iter65-offline-pins-red-2026-11-20.log.gz',
   lines: ['ℹ tests 286', 'ℹ pass 282', 'ℹ fail 4'],
   onlyReds: ['every pinned ledger citation lands on the statement the ledger quotes',
       'inserting a line above a pinned statement turns this guard red rather than leaving it green',
       'every file:line citation resolves and names a line that exists and is not blank',
       'every docs/evidence archive named anywhere in prose exists on disk'],
    marks: 0 },
  // The pin scout over the repaired ledger, before the table was re-pointed.
  { archive: 'docs/evidence/iter65-pins-drift-13-2026-11-20.log.gz',
   lines: ['pins=106 drifting=13'],
    marks: 0 },
  // The re-point pass itself and the anchor guard re-run after it.
  { archive: 'docs/evidence/iter65-pins-repoint-green-2026-11-20.log.gz',
   lines: ['repointed=4 inserted=11 at_line=304 plus_one_case_moved=392->403', 'ANCHORS_EXIT 0', 'ℹ tests 4',
       'ℹ pass 4', 'ℹ fail 0'],
    marks: 0 },
  // The scripted prose re-point, full capture.
  { archive: 'docs/evidence/iter65-docs-repoint-moves-2026-11-20.log.gz',
   lines: ['changed_sources=3 moves=78 ambiguous=0 unmatched=1'],
    marks: 0 },
  // The same re-point grouped by the prose line holding each move.
  { archive: 'docs/evidence/iter65-docs-repoint-sites-2026-11-20.log.gz',
   lines: ['sites=18'],
   phrases: ['AGENTS.md:1970  tests/workflow-place-choices.test.js  621->627'],
    marks: 0 },
  // The citation scout in both modes after every pointer moved.
  { archive: 'docs/evidence/iter65-docs-drift-scout-2026-11-20.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 229 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'HEAD CITED_LINES_CHECKED 229 DRIFTED 84 INSIDE_DIFF_HUNKS 0'],
   phrases: ['--- head mode ---', 'DRIFT_EXIT=0'],
    marks: 0 },
  // The static half of the same control from an earlier pass, with no build digest.
  { archive: 'docs/evidence/iter65-browser-control-static-unwitnessed-2026-11-20.log.gz',
   lines: ['1 failed'],
   phrases: ['122 × locator resolved'],
   absent: ['WITNESS'],
    marks: 1 },
  // The whole offline suite on the delivered bytes after every repair, the reading row 19 of the handoff quotes.
  { archive: 'docs/evidence/iter65-offline-final-2026-11-20.log.gz',
   lines: ['ℹ tests 286', 'ℹ pass 286', 'ℹ fail 0', 'ℹ skipped 0'],
   phrases: ['MODULE_MD5=166c93504f3d0bc817c02ccb3cd8c6a6', 'TEST_MD5=a8ec8622d9f61ed295285e251cf5cd63',
       'OFL_EXIT=0'],
   absent: ['✘'],
    marks: 0 },
  // The five documentation guard files together on the same tree.
  { archive: 'docs/evidence/iter65-docguards-final-2026-11-20.log.gz',
   lines: ['ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0'],
   phrases: ['CMD node scripts/docs-guards.mjs', 'DG_EXIT=0'],
   absent: ['✘'],
    marks: 0 },
  // The citation scout over the finished ledger, both modes, with the exit statuses it measured.
  { archive: 'docs/evidence/iter65-docs-drift-final-2026-11-20.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 242 DRIFTED 0 INSIDE_DIFF_HUNKS 18', '--- head mode ---',
       'HEAD CITED_LINES_CHECKED 230 DRIFTED 84 INSIDE_DIFF_HUNKS 0'],
   phrases: ['DRIFT_TREE_EXIT=0 DRIFT_HEAD_EXIT=0'],
    marks: 0 },
  // F1's page probe on the bytes HEAD ships, stamping the digests it served on its own first and third lines.
  { archive: 'docs/evidence/iter66-f1-page-probe-2026-11-20.log.gz',
   lines: ['PROBE_STATE pre-fix module=166c93504f3d0bc817c02ccb3cd8c6a6 dist=166c93504f3d0bc817c02ccb3cd8c6a6 head=93fea60 utc=2026-11-20T17:18:22Z',
       'BYTES served_dist_module=166c93504f3d0bc817c02ccb3cd8c6a6 source_module=166c93504f3d0bc817c02ccb3cd8c6a6 marker_served=0 marker_source=0',
       'buttons=[]', 'PROBE_EXIT=0 state=pre-fix utc=2026-11-20T17:18:24Z'],
   phrases: ['I could not match that crop to a sourced entry for Mongolia',
       'fields before={"country":"","region":"","lat":""} after={"country":"","region":"","lat":""}',
       'pageerrors=[]'],
   absent: ['is selected. Now choose a town', 'Cannot read properties'],
    marks: 0 },
  // The same probe, the same four sentences, on the delivered module.
  { archive: 'docs/evidence/iter66-f1-page-probe-fixed-2026-11-20.log.gz',
   lines: ['PROBE_STATE delivered module=1dce9746a1260ba70822e044a81730e9 dist=1dce9746a1260ba70822e044a81730e9 head=93fea60 utc=2026-11-20T17:18:24Z',
       'BYTES served_dist_module=1dce9746a1260ba70822e044a81730e9 source_module=1dce9746a1260ba70822e044a81730e9 marker_served=2 marker_source=2',
       'buttons=["Acworth","Adel","Albany","Whole United States"]',
       'PROBE_EXIT=0 state=delivered utc=2026-11-20T17:18:26Z'],
   phrases: ['Georgia is selected. Now choose a town', 'Inner Mongolia is selected.',
       'fields before={"country":"CN","region":"","lat":""} after={"country":"CN","region":"20","lat":""}'],
   absent: ['Cannot read properties'],
    marks: 0 },
  // The four runs the F1 offline file was written in, one red of mine and one of the product's.
  { archive: 'docs/evidence/iter66-f1-redfirst-2026-11-20.log.gz',
   lines: ['MODULE_MD5_AT_MERGE=1dce9746a1260ba70822e044a81730e9 UNIT_MD5_AT_MERGE=17ad63d25d60e5f95bbacda3ceaf77bf',
       'ℹ tests 6', 'ℹ pass 5', 'ℹ fail 1', 'ℹ tests 7', 'ℹ pass 6', 'ℹ pass 7',
       'ℹ tests 72', 'ℹ pass 72', 'ℹ fail 0'],
   onlyReds: ['a bare region name typed with no plan open selects the region instead of answering a crop question',
       'a stop word stays a stop word even where the saved list holds a row of that name'],
    marks: 0 },
  // The four mutants of the four clauses of the F1 fix, over the finished offline file.
  { archive: 'docs/evidence/iter66-f1-offline-controls-2026-11-20.log.gz',
   lines: ['delivered: exit=0 tests=9 pass=9 fail=0', 'gate-back-to-active-only: exit=1 tests=9 pass=5 fail=4',
       'veto-dropped: exit=1 tests=9 pass=7 fail=2', 'point-guard-dropped: exit=1 tests=9 pass=8 fail=1',
       'cancel-short-circuit-dropped: exit=1 tests=9 pass=8 fail=1', 'restored: exit=0 tests=9 pass=9 fail=0',
       'CONTROLS OK'],
   phrases: ['CONFIRMED the TypeError the cancel branch used to raise'],
   absent: ['restored_identical=False'],
    marks: 0 },
  // The page spec against the shipped bytes and the delivered ones on both desktop transports, build witness each way.
  { archive: 'docs/evidence/iter66-f1-browser-controls-2026-11-20.log.gz',
   lines: ['PLAYWRIGHT_EXIT rc=1 project=node-desktop phase=reverted utc=2026-11-20T17:28:25Z',
       'PLAYWRIGHT_EXIT rc=1 project=static-desktop phase=reverted utc=2026-11-20T17:29:30Z',
       'PLAYWRIGHT_EXIT rc=0 project=node-desktop phase=restored utc=2026-11-20T17:29:34Z',
       'PLAYWRIGHT_EXIT rc=0 project=static-desktop phase=restored utc=2026-11-20T17:29:48Z',
       '3 failed', '3 passed (3.5s)', '3 passed (13.7s)'],
   phrases: ['WITNESS 2026-11-20T17:28:25Z module=166c93504f3d0bc817c02ccb3cd8c6a6 dist=166c93504f3d0bc817c02ccb3cd8c6a6 fix_marker=0/0',
       "Cannot read properties of undefined (reading 'length')"],
    marks: 6 },
  // The same three page cases once per project, which is the 12 gate cases this iteration adds.
  { archive: 'docs/evidence/iter66-f1-spec-4projects-2026-11-20.log.gz',
   lines: ['MODULE_MD5=1dce9746a1260ba70822e044a81730e9 DIST_MD5=1dce9746a1260ba70822e044a81730e9 SPEC_MD5=beff67b47087836ffee9dc17559e62b6 marker=2',
       'PROJECT_EXIT=0 project=static-desktop utc=2026-11-20T17:30:02Z',
       'PROJECT_EXIT=0 project=node-desktop utc=2026-11-20T17:30:05Z',
       'PROJECT_EXIT=0 project=static-mobile utc=2026-11-20T17:30:11Z',
       'PROJECT_EXIT=0 project=node-mobile utc=2026-11-20T17:30:14Z'],
   phrases: ['3 passed', 'SPEC4_DONE 2026-11-20T17:30:14Z'],
   absent: ['PROJECT_EXIT=1'],
    marks: 0 },
  // Pass one of the citation re-point: the map it built and the nine files it rewrote pointers in.
  { archive: 'docs/evidence/iter66-docs-repoint-sites-2026-11-20.log.gz',
   lines: ['map: 752 lines at HEAD, 770 in the worktree; 98 pointer sites over 56 distinct targets; 0 unmapped and 0 inside a replaced hunk',
       'rewrote 27 pointer(s) in AGENTS.md', 'rewrote 17 pointer(s) in docs/handoff-2026-11-18.md',
       'rewrote 44 pointer(s) in docs/validation.md',
       'rewrote 3 pointer(s) in tests/documentation-citation-anchors.test.js'],
   phrases: ['rewrote 2 pointer(s) in tests/documentation-evidence-index.test.js'],
    marks: 0 },
  // Pass two, the range endpoints, applied and then re-run over its own output.
  { archive: 'docs/evidence/iter66-docs-repoint-ranges-2026-11-20.log.gz',
   lines: ['lines changed: 20; endpoints with no map entry: 0', 'lines changed: 0; endpoints with no map entry: 0'],
   phrases: ['================ repoint-ranges-apply2.log', '================ repoint-ranges-idem.log',
       'rewrite AGENTS.md:1538'],
    marks: 0 },
  // The control that justified reverting the two literals pass one moved inside this guard file.
  { archive: 'docs/evidence/iter66-docs-fixture-literals-2026-11-20.log.gz',
   lines: ['grep_count_in_iter61-citation-drift-head=1', 'grep_count_in_iter61-anchor-control=2',
       'pass_two_skips_this_file=2 constant(s) naming the exclusion'],
   phrases: ["'DRIFT docs/validation.md:1007 public/js/modules/workflow-assistant.js:222'",
       'HEAD=93fea603fa4d78e3c61b34f08cc08469b8e43bc4 RUN_UTC=2026-11-20T17:25:24Z GUARD_MD5=262aa3a1513bbe0caffeef0bc0e57555'],
    marks: 0 },
  // The two instruments of this pass that were wrong before they measured anything.
  { archive: 'docs/evidence/iter66-instrument-failures-2026-11-20.log.gz',
   lines: ['PROBE_EXIT=1 state=pre-fix utc=2026-11-20T17:17:30Z', 'PROBE_EXIT=1 state=delivered utc=2026-11-20T17:17:30Z',
       'BUILD_PREFIX_EXIT=0', 'BUILD_RESTORE_EXIT=0', 'TREE_OK module_and_dist_on_delivered_bytes'],
   phrases: ["open '../../../dist/client/js/modules/workflow-assistant.js'",
       'REFUSING: something already serves the probe port 4575'],
   absent: ['PROBE_EXIT=0'],
    marks: 0 },
  // F4, the swallowed refusal, measured at module level on the delivered bytes: both arms asked once and threw
  // nothing, which is the point — the refusal never reaches the caller as an error. `absent` here cannot name
  // ERR_MODULE_NOT_FOUND even though no arm hit it: the header the shelving tool writes is part of the archived
  // body, and that header describes the first attempt at the probe, which died exactly that way.
  { archive: 'docs/evidence/iter66-f4-refusal-fallthrough-2026-11-20.log.gz',
   lines: ['REFUSE_LIST=false asked=1 threw=none', 'REFUSE_LIST=true asked=1 threw=none',
       'state regionCode=GA location=null active=true', 'state regionCode=null location=null active=false',
       'F4PROBE_EXIT=0 RUN_UTC=2026-11-20T18:08:17Z'],
   phrases: ['answer="Georgia is selected. Now choose a town in the Town list in step 1, or type its name here.',
       'answer=null (chat.js falls through to the read-only answer)',
       'HEAD=93fea603fa4d78e3c61b34f08cc08469b8e43bc4 NODE=v26.13.1 RUN_UTC=2026-11-20T18:08:16Z module=1dce9746a1260ba70822e044a81730e9'],
   absent: ['threw=Error', 'Cannot read properties'],
    marks: 0 },
  // The shelving tool that went blind to its own cross-check, and the wrapper that aborted on an unbound parameter.
  { archive: 'docs/evidence/iter66-instrument-failures-2-2026-11-20.log.gz',
   lines: ['REFUSING TO SHELF: the prose-cite extractor found only 10 iter66 archives in the ledger; it is broken, not the prose',
       'REFUSING TO SHELF: the prose-cite extractor found only 11 iter66 archives in the ledger; it is broken, not the prose',
       'artifacts/scratch/iter66/final66.sh: line 22: $3: unbound variable'],
   phrases: ['=== FOURTH FAULT (same pass, the closing wrapper)', 'MERGE_UTC 2026-11-20T18:12:40Z',
       'FINAL66_SCRIPT_EXIT=1', 'SOURCE_LOG_MD5_before f7d1a011500bbdac6f084b9397c65d5f',
       'SOURCE_LOG_MD5_after  d6dc14898b817fe815b5d3955bb0ec02'],
   absent: ['found only 12'],
    marks: 0 },
  // The control that shows the F11 pin is live: green on the renamed title, red with line 146 alone reverted.
  { archive: 'docs/evidence/iter66-f11-pin-control-2026-11-20.log.gz',
   lines: ['ℹ tests 13', 'ℹ pass 13', 'ℹ fail 0', 'ℹ tests 4', 'ℹ pass 3', 'ℹ fail 1',
       'RESTORE_PROOF backup=18a060ff76259ad7dd8e0fb0ff586f8f live=18a060ff76259ad7dd8e0fb0ff586f8f equal=yes'],
   phrases: ['MERGE_UTC 2026-11-20T18:24:59Z HEAD 93fea603fa4d78e3c61b34f08cc08469b8e43bc4 NODE v26.13.1',
       'tests/workflow-bare-place-name.test.js:146 reads "test(\'a bare place name with no country chosen asks for the coun"',
       'but docs/validation.md subsection 66, the no-country limit quotes "a bare place name with no country chosen selects'],
   absent: ['✘', 'equal=NO'],
    marks: 0 },
  // The four-project gate this iteration closes on. Its line 2 is the freeze stamp, and two digests on that stamp are
  // the pre-rename bytes of the two test files the F11 control measured separately; the gate itself passed, so the
  // archive must carry no ✘ case line and no non-zero exit.
  { archive: 'docs/evidence/iter66-gate-2026-11-20.log.gz',
   lines: ['ITER66_GATE_START 2026-11-20T17:52:51Z HEAD=93fea603fa4d78e3c61b34f08cc08469b8e43bc4 NODE=v26.13.1 pgid=21684',
       'Running 312 tests using 1 worker', '312 passed (23.5m)', 'GATE_EXIT=0',
       'ITER66_GATE_DONE 2026-11-20T18:16:20Z'],
   phrases: ['ITER66_FROZEN assistant=1dce9746a1260ba70822e044a81730e9', 'marker=2'],
   absent: ['✘', 'GATE_EXIT=1'],
    marks: 0 },
  // The whole offline suite on the finished tree, read from its own summary rather than from a pipeline's last exit.
  { archive: 'docs/evidence/iter66-offline-final-2026-11-20.log.gz',
   lines: ['ℹ tests 295', 'ℹ pass 295', 'ℹ fail 0', 'ℹ cancelled 0', 'ℹ skipped 0',
       'ℹ duration_ms 24128.991709', 'OFFLINE_EXIT=0'],
   phrases: ['CMD node --test tests/*.test.js', 'HEAD 93fea603fa4d78e3c61b34f08cc08469b8e43bc4'],
   absent: ['✘', 'fail 1'],
    marks: 0 },
  // The five documentation guard files re-run as a set on the finished docs, including this guard.
  { archive: 'docs/evidence/iter66-docguards-final-2026-11-20.log.gz',
   lines: ['ℹ tests 28', 'ℹ pass 28', 'ℹ fail 0',
       'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'GUARD_FILES 5',
       'DOCSGUARDS_CHILD_EXIT 0'],
   phrases: ['CMD node scripts/docs-guards.mjs',
       '✔ the tally of every archived run is printed by that archive, not by the prose quoting it'],
   absent: ['✘', 'DOCSGUARDS_CHILD_EXIT 1'],
    marks: 0 },
  // The tree-side citation scout. Its counters move whenever the ledger grows, so this row is the only place the
  // reading is asserted against the bytes that printed it.
  { archive: 'docs/evidence/iter66-drift-final-2026-11-20.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 295 DRIFTED 0 INSIDE_DIFF_HUNKS 12', 'DRIFT_EXIT=0'],
   phrases: ['CMD node scripts/citation-drift.mjs',
       'FILES_WITH_EDITS public/js/modules/workflow-assistant.js'],
   absent: ['DRIFTED 1', 'DRIFT_EXIT=1'],
    marks: 0 },
  // The four-project case census: the 312 the gate ran, counted from `--list` on the delivered tree.
  { archive: 'docs/evidence/iter66-census-final-2026-11-20.log.gz',
   lines: ['Total: 312 tests in 28 files', 'CENSUS_EXIT=0'],
   phrases: ['CMD npx playwright test --list', '[node-mobile] › zero-evidence-parity.spec.js:245:1'],
   absent: ['Total: 300 tests', '✘'],
    marks: 0 },
  // The same three instruments read again with all five closing shelves on the tree, so the readings above are not the
  // last word about a tree that no longer exists. The equality of the two drift readings is printed by the log itself.
  { archive: 'docs/evidence/iter66-confirm-final-2026-11-20.log.gz',
   lines: ['CONFIRM_OFFLINE_EXIT=0',
       'OFFLINE ℹ tests 295 ℹ pass 295 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0',
       'DOCGUARDS DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0',
       'DRIFT TREE CITED_LINES_CHECKED 295 DRIFTED 0 INSIDE_DIFF_HUNKS 12',
       'PREV_DRIFT TREE CITED_LINES_CHECKED 295 DRIFTED 0 INSIDE_DIFF_HUNKS 12',
       'DRIFT_UNCHANGED=yes', 'CONFIRM_DONE 2026-11-20T18:39:14Z'],
   phrases: ['rows=171', 'CONFIRM_DOCGUARDS_EXIT=0', 'CONFIRM_DRIFT_EXIT=0'],
   absent: ['✘', 'CONFIRM_OFFLINE_EXIT=1', 'DRIFTED 1', 'fail 1'],
    marks: 0 },
];

test('the tally of every archived run is printed by that archive, not by the prose quoting it', async () => {
  assert.ok(TALLIES.length >= 172, `the table carries ${TALLIES.length} archives; subsections 57 through 66 quote more runs than ` +
    'that, so a number in them is unguarded. The floor was 16 after iteration 57, 25 when iteration 58 archived the red, ' +
    'the two controls readings, the focused green, its raw JSON, the superseded neighbours, the gate, the citation-drift ' +
    'instrument and the offline run that caught the stale header, 29 when the census, the tally controls run, the ' +
    'green pre-final offline suite and the provenance snapshot joined it, 32 when the skipped controls pass, the ' +
    'superseded one and the pass that prints row coverage joined it, 33 when the shipped green offline run on the ' +
    'finished tree joined it, 34 when the pass that printed the coverage gap joined it, 35 when the archive of the ' +
    'five guard files re-run on their own joined it, 36 when the pass that attacks every row preceding it joined it, ' +
    '45 when iteration 59 archived its three probes, the ladder script that drove the four browser readings, the ' +
    'red, both attacks, the green, the offline suite, the neighbour slice and the gate attempt it stopped on purpose, ' +
    '48 when the four-project gate, the `--list` census and the bootstrap index red it expected joined it, and 49 when ' +
    'the offline run that printed its own summary after that red joined it, 50 when the five guard files re-run on ' +
    'their own joined it and 51 when the provenance snapshot that carries the hashes subsection 59 quotes joined it, ' +
    '52 when iteration 60 archived the guard that went green with the defect still standing, 53 the red/green pair ' +
    'that named eight unshipped mentions across three documents, 54 the three instruments re-run from `scripts/`, 55 ' +
    'the four-control bundle and 56 the run where the guard rejected this ledger quoting its own gitignored path, ' +
    '57 when the four-project gate on the shipped tree joined it, 59 when that tree\'s offline suite and its guard ' +
    're-run joined it, 60 when the five attacks on this pass\'s own rows joined it, 61 the ladder that ran them, 62 the ' +
    'red that bundling that ladder into its own subject caused and 63 the offline suite re-run once every row above it ' +
    'had landed, and 69 when iteration 61 archived the refused-place-list red, the eight-case four-project gate, the ' +
    'four-way control ladder, the 268-case offline suite, the 53-pointer drift reading and the control that proved the ' +
    'deep-link anchor case detects a label repaired without its anchor; 72 with this pass\'s three docsguards logs, 73 ' +
    'with the offline suite re-run after they landed and 74 with the four-project gate that ended red on five ' +
    'live-service cases and was archived as it finished, not as a re-run would have made it, and 75 with the `--list` ' +
    'census whose eight place-list needles are what the handoff\'s "+8 over iteration 60" rests on, and 76 with the ' +
    'isolated four-project re-check of the five cases that gate lost, and 78 with the offline suite and the guard set ' +
    'that executed against a 76-row table and exited under their own process status rather than a pipeline\'s last ' +
    'command, and 87 when iteration 62 archived the 2,338-tap place-choice census, the before/after tap-rejection ' +
    'probe pair, the red the new browser case printed against the unfixed `chooseRegion`, its reverted-bytes control, ' +
    'the focused green, the same spec once per project and the offline control/green pair, and 90 when this pass\'s ' +
    'three closing readings joined it: the `--list` census at 272 in 26 files, the whole offline suite at 270 and the ' +
    'guard set at 28 re-run after the iteration-62 ledger bullet existed, and 91 when the four-project gate on the ' +
    'delivered bytes finished green at 272 and was archived from the log its own runner wrote, which is the only ' +
    'reading in this pass that exercised the browser transports rather than a `--list` count or an offline suite, and ' +
    '92 when the offline suite that ran against that 91-row table joined it, carrying the gate archive on the shelf, and '
    + '102 when iteration 63 archived the two ranking probes that established the degenerate evidence criterion (the '
    + 'selection that changes with it and the sentence the shipped code prints), the caching probe that established the '
    + 'device-write half, the seven-mutation ladder and the pass whose sixth control proved nothing, the browser spec '
    + 'red on its own first execution, the same three cases repaired and green per project, the finished twenty, and the '
    + 'two mutation controls that took the shipped notice and the shipped write guard back out, and 104 when the '
    + 'four-project gate on those bytes closed green at 292 passed (21.1m) with exit 0 and the `--list` census counted '
    + 'the same 292 in 27 files, and 106 when this pass\'s own publication error was shelved with them: an archive '
    + 'header that spelled the strings its tally row declared absent, which went red twice over - once in the guard set '
    + 'alone and once in the whole offline suite - and stayed on the shelf as those two logs, and 108 when the guard set '
    + 'and the whole suite were read again green on the finished tree, their own two rows the only ones in this pass that '
    + 'no run of this pass executed, and 122 when iteration 64 shelved the probe that measured the move this pass '
    + 'prevents, the two red drafts of its offline cases, the controls pass that left one of its own mutations '
    + 'undetected and the pass that caught it, the three browser drafts, the browser control that made the new page '
    + 'case bite, the byte-identical restore re-run, the probe that measured what the new case could not reach and the '
    + 'whole offline suite as it finished, and 125 when the four-project gate on those delivered bytes closed at 296 '
    + 'passed (23.4m) with exit 0, the `--list` census counted the same 296 in 27 files, and the focused spec ran once '
    + 'more after a comment line in it was re-pointed from a gitignored scratch path to the shelf file that now holds '
    + 'those bytes, and 126 when the complete capture of that offline suite joined it beside the filtered one, six case '
    + 'titles against 280, and 150 when iteration 65 archived the F5 coordinate-sentence fix with the 43-case '
    + 'green on its delivered bytes, the control that ran those same cases against the module as `e32ec0a` '
    + 'shipped it and printed four of them red, the five mutants re-run on the delivered test bytes, the four- '
    + 'project gate at 300 passed (26.2m) and the census that counted the same 300 in 27 files, the build that '
    + 'carried the fix into `dist/client`, the browser control that watched both transports fail and both pass, '
    + 'the 13-pin repair and the 78-site prose re-point around it, and the superseded runs an earlier draft of '
    + 'this pass published instead, and 152 when the two closing readings joined it: the whole offline suite at '
    + '286 passed / 0 failed / 0 skipped and the guard set at 28, both on the delivered bytes, whose own two rows '
    + 'are the only ones in this pass that no archived run of this pass executed, and 153 when the citation scout '
    + 'over the finished ledger joined it with the reading nothing else in this pass could print - 242 pointers '
    + 'checked against the tree, 0 drifted and 18 skipped for sitting inside this pass\'s own diff hunks - '
    + 'because the scout runs outside the guard set the offline suite executes, and 163 when iteration 66 archived F1 '
    + 'with the page probe that measured the harm on the bytes HEAD ships and the same probe on the delivered ones, '
    + 'the four runs its offline file was written in, the four mutants of its four clauses, its page spec reverted and '
    + 'restored on both desktop transports and that spec once per project, and the three instruments of its '
    + 'documentation sweep that were wrong before they measured anything: the pass that rewrote only the start of each '
    + 'range, the pass that repaired the 20 lines that left inverted or stale, and the control that reverted two '
    + 'literals the first pass had moved inside this guard file, 166 when F4\'s refusal probe, the second instrument-faults '
    + 'record and the F11 pin control that went red on purpose joined it, and 171 when this iteration\'s five closing legs '
    + 'joined it: the four-project gate at 312 passed (23.5m), the whole offline suite re-run on the renamed tree at 295, '
    + 'the guard set at 28, the citation scout over the finished ledger and the `--list` census at 312 in 28 files, and '
    + '172 when the confirmation leg that re-read those three instruments with all five shelves on the tree joined it.');
  for (const { archive, lines = [], phrases = [], absent = [], marks, partial, noTally, onlyReds } of TALLIES) {
    let text;
    try { text = gunzipSync(await readFile(path.join(ROOT, archive))).toString('utf8'); }
    catch { assert.fail(`${archive} is quoted by the ledger and is not a readable gzip in the repository`); }
    const got = text.split('\n').map(line => line.trim());
    for (const line of lines) assert.ok(got.includes(line), `${archive} never prints the line "${line}" the ledger reads out of it`);
    for (const phrase of phrases) assert.ok(text.includes(phrase), `${archive} never contains "${phrase}"`);
    for (const needle of absent) assert.ok(!text.includes(needle), `${archive} contains "${needle}", which the ledger ` +
      'states that archive does not print');
    const crosses = got.filter(line => line.startsWith('✘'));
    if (marks !== undefined) assert.equal(crosses.length, marks, `${archive} prints ${crosses.length} ✘ case lines, not the ${marks} quoted`);
    if (onlyReds) {
      // `✖ name (12ms)` is how node --test prints a red case, and it repeats the list under "failing tests:". The set
      // has to match exactly: a run red on more cases than the ledger says, or on a different one, is another run.
      const reds = [...new Set(got.filter(line => line.startsWith('✖ ')).map(line => line.slice(2).replace(/ \(\d+(\.\d+)?ms\)$/, '')).filter(name => name !== 'failing tests:'))].sort();
      assert.deepEqual(reds, [...onlyReds].sort(),
        `${archive} was red on ${reds.join(' / ') || 'nothing'}, which is not the red set the ledger describes`);
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
    if (noTally) {
      // The shape iteration 59 needed and `partial` could not serve: a gate killed on purpose, whose remaining cases
      // were not failures at all, so it names no red case. It still has to be a run that started and has to print no
      // tally, and only a file named as a stop may claim that, so a completed run cannot dodge a tally this way.
      assert.match(path.basename(archive), /-interrupted-|-partial-|-stopped-/,
        `${archive} is cited as a run that stopped before its tally but is not named as one`);
      assert.ok(/Passing --list|Running \d+ tests/.test(text),
        `${archive} is cited as a stopped run but shows no evidence a run started in it`);
      assert.deepEqual(got.filter(line => TALLY_LINE.test(line)), [],
        `${archive} is cited as a run that stopped before its tally, and it now prints one: ${got.filter(line => TALLY_LINE.test(line)).join(' / ')}`);
    }
    // The other direction, because an optional field is only a guard if dropping it is caught: a file named as a stop
    // has to carry the check that proves it stopped, or its row silently claims a tally that was never printed.
    if (!partial && !noTally) assert.doesNotMatch(path.basename(archive), /-interrupted-|-partial-|-stopped-/,
      `${archive} is named as a run that stopped before its tally, and its row states no check that it printed none`);
  }
});

test('the committed index is what the shipped generator prints, line for line', async () => {
  // Every case above judges the index row by row against the archive a row names, so none of them could see the scan
  // that produces the document drift away from the file: until iteration 60 the generator lived under the gitignored
  // `artifacts/` directory, the committed snapshot was reproducible only on the machine that wrote it, and a row added
  // by hand satisfied every other case. `--stdout` prints the document without writing it, so the judge cannot overwrite
  // what it is judging.
  const generator = 'scripts/evidence-index-generator.mjs';
  const run = spawnSync(process.execPath, [generator, '--stdout'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, `${generator} exited ${run.status}: ${(run.stderr || run.stdout).split('\n').slice(0, 2).join(' / ')}`);
  const [committed, produced] = [await readFile(path.join(ROOT, INDEX), 'utf8'), run.stdout];
  if (committed === produced) return;
  const before = committed.split('\n'), after = produced.split('\n');
  const first = before.findIndex((line, index) => line !== after[index]);
  assert.fail(`${INDEX} is not what ${generator} prints. First differing line is ${first + 1}: committed ${JSON.stringify(before[first])} `
    + `against generated ${JSON.stringify(after[first])} (${before.length} committed lines against ${after.length} generated)`);
});
