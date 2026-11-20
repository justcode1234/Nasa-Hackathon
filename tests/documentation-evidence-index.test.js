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
];

test('the tally of every archived run is printed by that archive, not by the prose quoting it', async () => {
  assert.ok(TALLIES.length >= 63, `the table carries ${TALLIES.length} archives; subsections 57 through 60 quote more runs than ` +
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
    'had landed.');
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
