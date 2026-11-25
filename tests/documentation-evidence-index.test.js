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
  // Iteration 67's F4 evidence, each archive a merge of the one-file-per-run captures the pass actually produced. The
  // five legs that can only be read after the ledger cites them - the closing suite, guard set, scout, gate and census
  // - are not here: their placeholders get rows when final67.sh replaces them from real captures.
  { archive: 'docs/evidence/iter67-f4-offline-redfirst-2026-11-20.log.gz',
   lines: ['MODULE 1dce9746a1260ba70822e044a81730e9', 'RED_UTC 2026-11-20T18:50:30Z', 'ℹ tests 6', 'ℹ pass 1',
       'ℹ fail 5', 'ℹ tests 8', 'ℹ pass 8', 'ℹ fail 0'],
   phrases: ['a refusal for one sentence does not answer a later sentence that is not a place'],
   absent: ['✘', 'LOCK left in place', 'ABORT', 'restored'],
    marks: 0,
   onlyReds: ['a bare place name whose saved list refused names the read that failed instead of a crop',
       'the refusal offers the farmer’s own words back and a tap after a healthy list selects the place',
       'a list that arrived unreadable is reported as a source format and offers no replay',
       'a cancelled saved-list read settles as a stop, not as a refusal sentence',
       'a refusal for one sentence does not answer a later sentence that is not a place'] },
  { archive: 'docs/evidence/iter67-f4-offline-controls-2026-11-20.log.gz',
   lines: ['ℹ pass 6', 'ℹ fail 2', 'ℹ pass 3', 'ℹ fail 5'],
   phrases: ['a sentence with no place shape keeps its read-only answer while the list refuses'],
   absent: ['✘', 'pass 8', 'ABORT'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-f4-browser-controls-2026-11-20.log.gz',
   lines: ['MUT1 RESTORED md5 43c133a152fee4fa5b15dee6dff8e0e0', 'CTL_HEAD DIST md5 43c133a152fee4fa5b15dee6dff8e0e0',
       'MUT1 DONE 2026-11-20T19:40:59Z LOCK_RELEASED', 'CTL_HEAD DONE 2026-11-20T19:41:26Z LOCK_RELEASED'],
   phrases: ['CTL_HEAD ON_HEAD md5 1dce9746a1260ba70822e044a81730e9 lines      770',
       'Expected pattern: /could not be read just now/',
       'CTRLRERUN FINAL module=43c133a152fee4fa5b15dee6dff8e0e0 dist=43c133a152fee4fa5b15dee6dff8e0e0',
       'BUILD rc=0 (mutated)', 'BUILD rc=0 (restored)'],
   absent: ['LOCK left in place', 'ABORT', 'RESTORE FAILED'],
    marks: 12 },
  { archive: 'docs/evidence/iter67-f4-spec-4projects-2026-11-20.log.gz',
   lines: ['Running 3 tests using 1 worker'],
   phrases: ['[node-desktop]', '[static-desktop]', '[node-mobile]', '[static-mobile]', '3 passed'],
   absent: ['✘', 'ABORT'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-docs-repoint-2026-11-20.log.gz',
   lines: ['DOCUMENT_CITATIONS_REPOINTED 57', 'NOTES 10', 'DOCUMENT_CITATIONS_REPOINTED 73',
       'CITATIONS_NEEDING_PROSE 13', 'IndexError: list index out of range',
       'ALIGNED public/js/modules/workflow-assistant.js HEAD_LINES 771 TREE_LINES 788 LINES_MOVED 543',
       'ALIGNED tests/documentation-citation-anchors.test.js HEAD_LINES 463 TREE_LINES 463 LINES_MOVED 0'],
   phrases: ['REWRITTEN :: function placeListFailure(countryName, error) {', 'beyond-head :: <no HEAD line 735>',
       'repoint_docs.py", line 107, in rewrite'],
   absent: ['✘', 'REPOINTED 74'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-instruments-2026-11-20.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 230 DRIFTED 0 INSIDE_DIFF_HUNKS 6',
       'TREE CITED_LINES_CHECKED 244 DRIFTED 0 INSIDE_DIFF_HUNKS 3',
       'DOCSGUARDS_SUMMARY tests 28 | pass 25 | fail 3 | skipped 0',
       'DOCSGUARDS_SUMMARY tests 28 | pass 24 | fail 4 | skipped 0',
       'CITES_JUDGED 228 UNJUDGED 686 STALE 192'],
   phrases: ['RangeError [Error]: Invalid array length',
       'public/js/modules/workflow-assistant.js:483 is a line subsection 59 quotes while changing it and is no longer pinned'],
   absent: ['✘', 'DRIFTED 1'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-tally-controls-2026-11-20.log.gz',
   lines: ['TARGET tests/documentation-evidence-index.test.js md5=a3d192c53c2dfb9a7744d047b0c6896c',
       'GREEN rc=0 ℹ pass 7 ℹ fail 0',
       'CTRLTALLY_FINAL md5=a3d192c53c2dfb9a7744d047b0c6896c SAME=yes', 'CTRLTALLY_DONE_UTC 2026-11-20T19:54:54Z'],
   phrases: ['never prints the line "Running 4 tests using 1 worker"',
       'never contains "BUILD rc=0 (mutated) and never restored"',
       'which the ledger states that archive does not print', 'prints 12 ✘ case lines, not the 11 quoted',
       'is not the red set the ledger describes', 'the table carries 178 archives',
       'WARNING: the control driver shares the launcher process group'],
   absent: ['ABORT', 'APPLY_FAILED', 'same=NO'],
    marks: 0 },
  // F10 and F15 are one repair and one instrument fault found by it, so their three archives are read as a set: the
  // before/after counts, the run the widening lost, and the four breaks that prove the anchor case detects them.
  { archive: 'docs/evidence/iter67-f10-deeplink-repair-2026-11-20.log.gz',
   lines: ['count_file_slash_C=3', 'count_file_slash_C=0',
       'ANCHOR_SCAN pattern=file_scheme_only head=3 tree=0',
       'ANCHOR_SCAN pattern=any_markdown_target head=3 tree=3',
       'ANCHOR_SCAN pattern=brackets_allowed head=0 tree=0',
       'RAW_ANCHOR_TOKENS head=4 tree=4'],
   phrases: ['1007:region is selected ([public/js/modules/workflow-assistant.js:255-261](../public/js/modules/workflow-assistant.js#L255)),',
       '1035:anything ([public/js/modules/workflow-assistant.js:283-295](../public/js/modules/workflow-assistant.js#L283));',
       '--- F14: the labels still say 255-261 / 462-474 / 283-295; those are not where the rules live now ---',
       '--- F15: how many labelled deep links each pattern can see in each version of the file ---',
       'const allowEponymousTown = namedRegions.length === 0 || Boolean(regionFilter);'],
   absent: ['✘', 'ABORT', 'PLACEHOLDER'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-anchor-scan-starved-2026-11-20.log.gz',
   lines: ['ℹ tests 303', 'ℹ pass 300', 'ℹ fail 3', 'OFFLINE_EXIT=1'],
   phrases: ['the anchor scan saw 0 labelled deep links; the ledger has had at least three since iteration 51',
       'the header says 754 files under docs/evidence and the scan found 755'],
   absent: ['✘', 'ABORT', 'OFFLINE_EXIT=0'],
    marks: 0,
   onlyReds: ['a deep link anchor jumps to the line its own label names',
       'the index header states counts its own rows and the filesystem agree with',
       'the committed index is what the shipped generator prints, line for line'] },
  { archive: 'docs/evidence/iter67-anchor-controls-2026-11-20.log.gz',
   lines: ['TARGET guard=29b33722884ce6b06ccddadbe5a8eb33 ledger=78ae3e3ff04604533e379abaec5696ad',
       'RESTORED guard=29b33722884ce6b06ccddadbe5a8eb33 ledger=78ae3e3ff04604533e379abaec5696ad',
       'WARNING: the control driver shares the launcher process group', 'F15_CONTROLS_DONE 2026-11-20T20:37:57Z'],
   phrases: ['the anchor scan saw 3 labelled deep links', 'the anchor scan saw 0 labelled deep links',
       'docs/validation.md:1007 labels workflow-assistant.js:255-261 but its anchor lands on line 300',
       '==== CTRL-D the naive widening'],
   absent: ['✘', 'ABORT', 'APPLY_FAILED'],
    marks: 0 },
  // The five closing legs, read on the delivered bytes after the gate: they are what §67's committed-readings paragraph
  // quotes, so every number in that paragraph has a row here or it is prose about a run nobody archived.
  { archive: 'docs/evidence/iter67-gate-2026-11-20.log.gz',
   lines: ['ITER67_GATE_START 2026-11-20T20:00:51Z HEAD=6c3091f370fa9f7dd1eb2a3fe992b2a08f3d00bf NODE=v26.13.1 pgid=87040',
       'Running 324 tests using 1 worker', '324 passed (26.4m)', 'GATE_EXIT=0', 'ITER67_GATE_DONE 2026-11-20T20:27:13Z'],
   phrases: ['ITER67_FROZEN assistant=43c133a152fee4fa5b15dee6dff8e0e0 dist=43c133a152fee4fa5b15dee6dff8e0e0',
       'ITER67_AFTER assistant=43c133a152fee4fa5b15dee6dff8e0e0 dist=43c133a152fee4fa5b15dee6dff8e0e0'],
   absent: ['✘', 'ABORT', 'failed ('],
    marks: 0 },
  { archive: 'docs/evidence/iter67-offline-final-2026-11-20.log.gz',
   lines: ['ℹ tests 303', 'ℹ pass 303', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
   phrases: ['a bare place name whose saved list refused names the read that failed instead of a crop'],
   absent: ['✘', 'ABORT', 'fail 3'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-docguards-final-2026-11-20.log.gz',
   lines: ['DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0', 'DOCGUARDS_EXIT=0'],
   phrases: ['GUARD_FILES 5', '✔ a deep link anchor jumps to the line its own label names',
       '✔ the tally of every archived run is printed by that archive, not by the prose quoting it'],
   absent: ['✘', 'ABORT', 'fail 3'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-drift-final-2026-11-20.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 264 DRIFTED 0 INSIDE_DIFF_HUNKS 10', 'DRIFT_EXIT=0',
       'FILES_WITH_EDITS public/js/modules/workflow-assistant.js tests/documentation-citation-anchors.test.js tests/documentation-citations.test.js tests/documentation-evidence-index.test.js'],
   phrases: ['RUN_UTC 2026-11-20T20:43:14Z', 'node scripts/citation-drift.mjs'],
   absent: ['✘', 'ABORT', 'DRIFTED 1'],
    marks: 0 },
  { archive: 'docs/evidence/iter67-census-final-2026-11-20.log.gz',
   lines: ['Total: 324 tests in 29 files', 'CENSUS_EXIT=0'],
   phrases: ['npx playwright test --list',
       '[node-mobile] › zero-evidence-parity.spec.js:245:1 › control: a year with readings is still written to the device cache'],
   absent: ['✘', 'ABORT', 'Total: 312'],
    marks: 0 },
  // The rows this pass appends are only evidence if the table can reject them, and the ladder that shows it is an
  // archived run too. Its own row reads the six bites the child output proved, not a summary this file could invent, and
  // its `absent:` list is the shortest in the table for a reason worth knowing: a ladder echoes the `MUTATED` needle it
  // applies, so the strings carried by the needles it echoed - `✘`, `ABORT` and `OFFLINE_EXIT=0` all came in on the CTRL-D
  // needle aimed at the gate row's own `absent:` list - are inside its log by construction, and declaring any of them
  // absent is a guaranteed red. Only the two markers that would mean a leg failed to apply or failed to bite are safe to
  // declare absent, and the claim that the ladder ran nothing red of its own moves to `marks: 0`, which counts case lines
  // beginning with the glyph - the same layer CTRL-D proved by raising it to 1 on the gate row above.
  { archive: 'docs/evidence/iter67-tally8-controls-2026-11-20.log.gz',
   lines: ['TARGET guard=29c42386ea70d85bc66b3cd87c783b08 ledger=32c0ae32d0e549a62596b81ae7e63138',
       'RESTORED guard=29c42386ea70d85bc66b3cd87c783b08 ledger=32c0ae32d0e549a62596b81ae7e63138',
       'LAYER_BITE layer=lines matched="never prints the line"',
       'LAYER_BITE layer=phrases matched="never contains"',
       'LAYER_BITE layer=absent matched="states that archive does not print"',
       'LAYER_BITE layer=marks matched="case lines, not the"',
       'LAYER_BITE layer=onlyReds matched="is not the red set the ledger describes"',
       'LAYER_BITE layer=floor matched="the table carries 187 archives"',
       'TALLY8_CONTROLS_DONE 2026-11-20T20:49:18Z'],
   phrases: ['==== baseline BASELINE, the eight new rows on the tree as this pass wrote them (expect 7/7 green)',
       '==== restored RESTORED after CTRL-F'],
   absent: ['MUTATION_REFUSED', 'LAYER_BITE_FAILED'],
    marks: 0 },
  // F13 firing on this pass's own prose, kept as it ran: the first draft of the ledger's F15 paragraph named the control
  // driver instead of the archive that driver wrote, and the guard that checks a sentence's commands are shippable files
  // said so on the whole offline suite.
  { archive: 'docs/evidence/iter67-commands-guard-red-2026-11-20.log.gz',
   lines: ['ℹ tests 303', 'ℹ pass 302', 'ℹ fail 1', 'OFFLINE_EXIT=1'],
   phrases: ['these commands are named in prose and no clone has the file:',
       'docs/validation.md -> artifacts/scratch/iter67/f15-anchor-controls.sh (under the ignored artifacts/)'],
   absent: ['✘', 'ABORT', 'OFFLINE_EXIT=0'],
    marks: 0,
   onlyReds: ['a command named inside a sentence is a file the repository ships, not one only this machine has'] },
  // Iteration 68 (F8). One file holds both arms of the sentence probe: HEAD's answer to a bare country name and the
  // delivered one, over the 302 spellings the runtime tables publish. The banner line is the row that keeps a repaired
  // instrument honest - the first merge stamped it with printf, lost its separators and collapsed four sentences onto
  // one 447-character line, which `merged-2` restamps without moving a measured byte.
  { archive: 'docs/evidence/iter68-f8-probe-2026-11-21.log.gz',
   lines: ['MERGE_UTC 2026-11-21T06:15:10Z ITERATION 68 F8 probe, both arms in one file, red arm first',
       'PROBE iter68 F8 red-first', 'PROBE iter68 F8 post-fix',
       'CENSUS spellings=302 cropSentence=0 withNoButton=0 currentPredicateCatches=0 misses=0 e.g.',
       'PROBE COMPLETE', 'EXIT=0'],
   phrases: ['cropSentence=302 withNoButton=302 currentPredicateCatches=266 misses=36',
       'mode="deterministic country-name clarification"', 'buttons=["Plan a rotation in Georgia"]',
       'GUIDED q="Georgia" len=7 answered=no country=none'],
   absent: ['✘', 'ABORT'],
    marks: 0 },
  // Five mutants, one clause each, each restored by digest before the next. M4 is the narrowness control: it goes red on
  // exactly one case, and the row pins which case, because "the fix does not swallow sentences that merely mention a
  // country" is only evidence if an archive names the assertion that measures it.
  { archive: 'docs/evidence/iter68-f8-offline-controls-2026-11-21.log.gz',
   lines: ['DELIVERED rc=0 tests=13 pass=13 fail=0 reds=0',
       'M4-any-mention-of-a-country rc=1 tests=13 pass=12 fail=1 reds=1',
       'RED an unmatched crop is still answered as a crop question',
       'CTL_FINAL md5 6f52f4d8d538d2565be069ce0a481a07 identical=True fail=0'],
   phrases: ['M1-no-country-name-branch MUTATED',
       'M5-intl-spellings-only RESTORED md5 6f52f4d8d538d2565be069ce0a481a07 identical=True'],
   absent: ['✘', 'ABORT'],
    marks: 0 },
  // The same argument on the page: green, red on both transports with HEAD's file rebuilt into the bundle, green again.
  // Two bundle digests are pinned because the served file is built and gitignored - a stale bundle would print one.
  { archive: 'docs/evidence/iter68-f8-browser-controls-2026-11-21.log.gz',
   lines: ['ARM=green exit=0 cases=2 static-desktop:passed node-desktop:passed',
       'ARM=reverted exit=1 cases=2 static-desktop:failed node-desktop:failed',
       'ARM=restored exit=0 cases=2 static-desktop:passed node-desktop:passed',
       'RESTORED_SRC_MD5=6f52f4d8d538d2565be069ce0a481a07 identical=True'],
   phrases: ['BUNDLE_MD5=3ec88085fb5873b6cc7f0b426daf022f', 'BUNDLE_MD5=7434ebb3a4a2b8e12733649db789a90c',
       'a country name is not the crop question the farmer did not ask'],
   absent: ['✘', 'ABORT'],
    marks: 0 },
  // Where the new branch stops, read off the handler rather than off the source: folded spellings answer as a place,
  // a country name inside other wording still answers as a crop question, and the offered planning sentence is proved
  // to be answered a layer above this handler by the bytes that say so.
  { archive: 'docs/evidence/iter68-f8-limits-2026-11-21.log.gz',
   lines: ['LIMITS_UTC=2026-11-21T06:20:54Z INTERPRETER=v26.13.1', 'LIMITS COMPLETE',
       'LIMITS q="in Georgia" mode="deterministic conversational clarification" buttons=[] crop=true ' +
       'generic=false text="I could not match that crop to a sourced entry for Georgia. Try its comm"'],
   phrases: ['LIMITS_MD5 server/agronomy/conversation.js=6f52f4d8d538d2565be069ce0a481a07',
       'q="Georgia and Japan" mode="deterministic conversational clarification" buttons=["Georgia","Japan"] ' +
       'crop=false'],
   absent: ['✘', 'ABORT'],
    marks: 0 },
  // The gate on the frozen bytes. Both digest banners are pinned because their equality, not the prose around them, is
  // what shows nothing moved while 328 cases ran. `skipped` is assertable here only because the shelving header that
  // wraps this log was reworded to avoid the token: a provenance line that mentions a marker disqualifies the needle
  // whose job is to catch it, and the first draft of this row failed on its own banner for exactly that reason.
  { archive: 'docs/evidence/iter68-gate-2026-11-21.log.gz',
   lines: ['Running 328 tests using 1 worker', '328 passed (20.3m)', 'GATE_EXIT=0',
       'ITER68_GATE_DONE 2026-11-21T06:36:52Z'],
   phrases: ['ITER68_FROZEN conversation=6f52f4d8d538d2565be069ce0a481a07',
       'ITER68_AFTER conversation=6f52f4d8d538d2565be069ce0a481a07',
       'chat-bare-place-name.spec.js:105:1 › a bare country name typed with step 1 empty'],
   absent: ['✘', 'ABORT', 'failed (', 'skipped'],
    marks: 0 },
  // The four closing legs and the ladder that controls the F8 rows. Two things are worth reading before these rows:
  // first, `node --test` prints U+2716 (✖) for a red case and Playwright prints U+2718 (✘), so a leg that ran the unit
  // suite asserts the former glyph rather than inheriting the latter from the gate row above, where it would have been
  // the absence of a character that runner never emits. Second, the ladder row asserts almost nothing away, because a
  // driver that mutates a needle echoes that needle's own text into its log: ✘, ABORT and OFFLINE_EXIT=0 are inside the
  // archive by construction, and the claim that nothing failed moves to `LAYERS_BITTEN 5/5 ALL` plus `marks: 0`.
  { archive: 'docs/evidence/iter68-offline-final-2026-11-21.log.gz',
   lines: ['ℹ tests 307', 'ℹ pass 307', 'ℹ fail 0', 'ℹ skipped 0',
       'LEG=offline OFFLINE_TESTS=307', 'LEG=offline OFFLINE_EXIT=0'],
   phrases: ['DIGESTS conversation=6f52f4d8d538d2565be069ce0a481a07', 'node --test tests/*.test.js'],
   absent: ['✘', '✖', 'ABORT', 'fail 3'],
    marks: 0 },
  { archive: 'docs/evidence/iter68-docguards-final-2026-11-21.log.gz',
   lines: ['DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0',
       'LEG=docguards DOCSGUARDS_EXIT=0'],
   phrases: ['GUARD_FILES 5',
       '✔ the tally of every archived run is printed by that archive, not by the prose quoting it',
       'node scripts/docs-guards.mjs'],
   absent: ['✘', '✖', 'ABORT', 'fail 2'],
    marks: 0 },
  // The scout's own coverage boundary is stated in the ledger as 27 lines against roughly a thousand citations, and the
  // row pins both modes' counts so a scout that walked nothing could not report the clean half of the pair.
  { archive: 'docs/evidence/iter68-drift-final-2026-11-21.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 27 DRIFTED 0 INSIDE_DIFF_HUNKS 2',
       'HEAD CITED_LINES_CHECKED 24 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'LEG=drift TREE_EXIT=0', 'LEG=drift HEAD_EXIT=0'],
   phrases: ['node scripts/citation-drift.mjs', 'FILES_WITH_EDITS server/agronomy/conversation.js'],
   absent: ['✘', 'ABORT', 'DRIFTED 1'],
    marks: 0 },
  { archive: 'docs/evidence/iter68-census-final-2026-11-21.log.gz',
   lines: ['Total: 328 tests in 29 files',
       'LEG=census CENSUS_SPEC=tests/e2e/chat-bare-place-name.spec.js', 'LEG=census CENSUS_SPEC_LINES=16',
       'LEG=census CENSUS_SPEC_PROJECTS= 4 node-desktop; 4 node-mobile; 4 static-desktop; 4 static-mobile',
       'LEG=census CENSUS_EXIT=0'],
   phrases: ['npx playwright test --list'],
   absent: ['✘', 'ABORT', 'Total: 327'],
    marks: 0 },
  { archive: 'docs/evidence/iter68-tally-controls-2026-11-21.log.gz',
   lines: ['BASELINE rc=0 tests=7 pass=7 fail=0 reds=0', 'ROWS_ON_TREE 194', 'LAYERS_BITTEN 5/5 ALL',
       'LAYER_BITE layer=lines red=True bit=True', 'LAYER_BITE layer=floor red=True bit=True',
       'TALLYCTL_FINAL md5 d2b7d1367bf621caa479d9d168201ee2 identical=True fail=0'],
   phrases: ['DELIVERED md5 d2b7d1367bf621caa479d9d168201ee2',
       'RESTORED md5 d2b7d1367bf621caa479d9d168201ee2 identical=True'],
   absent: ['MUTATION_REFUSED', 'ABORT the guard is not green'],
    marks: 0 },
  // Iteration 69's F9 captures: the offline guards as they ran against the bytes HEAD ships (green, because the defect
  // was still unfixed), the mutation ladder that attacked this pass's own cases in two rounds, and the page spec once
  // per project - the last of which prints the digest each arm served, because a static arm that measured a stale
  // `dist/client` would otherwise read as a transport difference.
  { archive: 'docs/evidence/iter69-f9-offline-redfirst-2026-11-21.log.gz',
   lines: ['ℹ tests 82', 'ℹ pass 82', 'ℹ fail 0', 'GUARD_NODE_EXIT=0', 'ℹ fail 5', 'GUARD_NODE_EXIT=1',
       'PROBE_GREEN_EXIT=0', 'PROBE_RED_EXIT=0', '######## 2. offline guards, REVERTED arm (shipped defect)'],
   phrases: ['delivered md5 efd158ed05f258705593ceb422893a5c', 'shipped defect md5 8027a1ec55ff7f6208d0454cf50e78d4',
       'ARM AMBIGUOUS AR q="San Vicente" regionHeld=none townRows=3 regionRows=2 answered=yes',
       'CENSUS lists=245 regionRows=3802 townRows=70036 ambiguousNames=2478'],
   absent: ['✘', 'EPONYMOUS_EXIT=1', 'SAMEREGION_EXIT=1', 'NAMECOUNTS_EXIT=1'],
    marks: 0 },
  { archive: 'docs/evidence/iter69-f9-offline-controls-2026-11-21.log.gz',
   lines: ['CONTROLS RAN=5 of 5', 'LAYERS_BITTEN 3/4 INCOMPLETE',
       'CONTROLS RAN=6 of 6 SCORED=4 DOCUMENTED_BLIND=1 MISSED=0', 'LAYERS_BITTEN 4/4 ALL',
       'MUT REVERT verdict=CAUGHT by 5 failing cases', 'MUT NOOP APPLIED=noop TESTS=82 PASS=82 FAIL=0'],
   phrases: ['round 1 (recorded as it happened: NOGUARD scored MISSED)',
       'CONTROLS SRC_MD5=efd158ed05f258705593ceb422893a5c',
       'CONTROLS SRC_MD5=fe1f66a8c199d11ef6a35b6a24a3d25d', 'BLIND_AT_BOUNDARY'],
   absent: ['✘', 'MUTATION_NOT_APPLIED'],
    marks: 0 },
  { archive: 'docs/evidence/iter69-f9-spec-4projects-2026-11-21.log.gz',
   lines: ['8 failed', '8 passed (27.1s)',
       'PW69 REVERTED_ARM_EXIT=1 VERDICT=red, which is what a guard against the shipped defect must be',
       'PW69 GREEN_ARM_EXIT=0 VERDICT=green',
       'PW69 DONE 2026-11-21T07:47:35Z module=efd158ed05f258705593ceb422893a5c '
           + 'served=efd158ed05f258705593ceb422893a5c red_exit=1 green_exit=0'],
   phrases: ['PROBE TEXT Several listed towns match, showing 3 of 5. Which one do you mean?',
       'PROBE BUTTONS Athens · Georgia | Athens · Ohio | Athens · Tennessee',
       'md5 43c133a152fee4fa5b15dee6dff8e0e0', 'served=8027a1ec55ff7f6208d0454cf50e78d4'],
   absent: ['GREEN_ARM_EXIT=1', 'red_exit=0', '✖'],
    marks: 8 },
  // The gate is the only iteration-69 capture that drove a browser. Its two digest banners being equal is the freeze
  // claim: ten inputs, read before the first project and after the last, with nothing in between moved.
  { archive: 'docs/evidence/iter69-gate-2026-11-21.log.gz',
   lines: ['ITER69_GATE_START 2026-11-21T07:52:45Z HEAD=976d77924a98c7969b1d141457a1ef40c694caf7 '
           + 'NODE=v26.13.1 pgid=18335',
       'Running 336 tests using 1 worker', '336 passed (21.2m)', 'GATE_EXIT=0',
       'ITER69_GATE_DONE 2026-11-21T08:13:59Z'],
   phrases: ['ITER69_FROZEN conversation=6f52f4d8d538d2565be069ce0a481a07 assistant=efd158ed05f258705593ceb422893a5c '
           + 'served=efd158ed05f258705593ceb422893a5c',
       'ITER69_AFTER conversation=6f52f4d8d538d2565be069ce0a481a07 assistant=efd158ed05f258705593ceb422893a5c '
           + 'served=efd158ed05f258705593ceb422893a5c', 'npm run test:e2e'],
   absent: ['✘', '✖', 'ABORT', '1 failed', '335 passed'],
    marks: 0 },
  // The scout is the one instrument in this pass that can print a clean reading while comparing nothing, so both
  // modes' checked-line counts sit next to their drift counts. HEAD's 21 are the line moves this fix caused: that
  // mode reads this pass's edited ledger against the assistant module as the previous commit shipped it, so every
  // pointer this pass re-pointed (708 to 718, 681 to 682, 693 to 694) is correct against the tree and stale at HEAD.
  { archive: 'docs/evidence/iter69-drift-final-2026-11-21.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 252 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'HEAD CITED_LINES_CHECKED 253 DRIFTED 21 INSIDE_DIFF_HUNKS 0',
       'LEG=drift TREE_EXIT=0', 'LEG=drift HEAD_EXIT=0'],
   phrases: ['FILES_WITH_EDITS public/js/modules/workflow-assistant.js '
           + 'tests/documentation-citation-anchors.test.js',
       'LEG=drift DIGESTS assistant=efd158ed05f258705593ceb422893a5c', 'node scripts/citation-drift.mjs'],
   absent: ['✘', 'ABORT', 'TREE CITED_LINES_CHECKED 27'],
    marks: 0 },
  { archive: 'docs/evidence/iter69-census-final-2026-11-21.log.gz',
   lines: ['Total: 336 tests in 30 files',
       'LEG=census CENSUS_SPEC=tests/e2e/chat-ambiguous-place-name.spec.js', 'LEG=census CENSUS_SPEC_LINES=8',
       'LEG=census CENSUS_SPEC_PROJECTS= 2 node-desktop; 2 node-mobile; 2 static-desktop; 2 static-mobile',
       'LEG=census CENSUS_EXIT=0'],
   phrases: ['npx playwright test --list', 'LEG=census CENSUS_RAW_MD5=8b13f0e0859423dc9a50bd3451eadb8e'],
   absent: ['✘', 'ABORT', 'Total: 328'],
    marks: 0 },
  // The offline suite and the guard set are the two legs that had to run twice: the first reading of each was red on
  // exactly the two citation cases that name this pass's six archives, because the prose was written before the shelf
  // was filled. The bytes on the shelf are the re-run, so the row pins the green summary and not the red one.
  { archive: 'docs/evidence/iter69-offline-final-2026-11-21.log.gz',
   lines: ['ℹ tests 317', 'ℹ pass 317', 'ℹ fail 0', 'LEG=offline OFFLINE_TESTS=317', 'LEG=offline OFFLINE_EXIT=0'],
   phrases: ['node --test tests/*.test.js', 'LEG=offline DIGESTS assistant=efd158ed05f258705593ceb422893a5c',
       '✔ an ambiguous name inside a region the farmer already holds also asks which one'],
   absent: ['✘', '✖', 'ABORT', 'OFFLINE_EXIT=1', 'ℹ fail 2'],
    marks: 0 },
  { archive: 'docs/evidence/iter69-docguards-final-2026-11-21.log.gz',
   lines: ['DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_CHILD_EXIT 0',
       'LEG=docguards DOCSGUARDS_EXIT=0'],
   phrases: ['GUARD_FILES 5', 'node scripts/docs-guards.mjs',
       '✔ the tally of every archived run is printed by that archive, not by the prose quoting it'],
   absent: ['✘', '✖', 'ABORT', 'fail 2'],
    marks: 0 },
  // The ladder's own row pins the table size it ran against - 205, before the three rows above it existed - because a
  // row that pinned a count the archived run could not have printed would be the invention this whole table exists to
  // catch. The later rows landed after it, and the offline suite re-read on the finished 208-row table is what proves
  // they are green.
  { archive: 'docs/evidence/iter69-tally-controls-2026-11-21.log.gz',
   lines: ['BASELINE rc=0 tests=7 pass=7 fail=0 reds=0', 'ROWS_ON_TREE 205', 'LAYERS_BITTEN 5/5 ALL',
       'LAYER_BITE layer=lines red=True bit=True', 'LAYER_BITE layer=floor red=True bit=True',
       'TALLYCTL_FINAL md5 2a14bab0dedfd8364c50c7eb87b74cb5 identical=True fail=0'],
   phrases: ['DELIVERED md5 2a14bab0dedfd8364c50c7eb87b74cb5',
       'RESTORED md5 2a14bab0dedfd8364c50c7eb87b74cb5 identical=True'],
   absent: ['MUTATION_REFUSED', 'ABORT the guard is not green'],
    marks: 0 },
  // Iteration 70, queue item F3. One archive, two arms, so the red and the green of the same walk sit next to each
  // other and the ledger cannot quote one and mean the other. The two `MODULE_MD5` line pins say which bytes each arm
  // read (798 lines shipped by iteration 69, 812 delivered here), the adjacent-pair phrase pins says which arm the
  // changed-keys line belongs to - `["place","coordinates"]` after a `calls=["region"]` replay is the defect, `[]`
  // after `calls=[]` is the repair - and the two `identical=true` phrases pin that neither arm's module digest moved
  // while its four walks ran. A row that only listed both changed-keys lines would pass an archive where both came
  // from the same arm.
  { archive: 'docs/evidence/iter70-f3-replay-probe-2026-11-21.log.gz',
   lines: ['PROBE HEAD=60500c3077ee6702575c1f70b6783420a667ea82',
       'PROBE MODULE_MD5=efd158ed05f258705593ceb422893a5c MODULE_LINES=798',
       'PROBE MODULE_MD5=6a23d42a807c8f7243077a67fb43c24b MODULE_LINES=812',
       'A_REFUSAL_UNCHANGED  true',
       'RESTORE_VERIFIED md5 6a23d42a807c8f7243077a67fb43c24b 6a23d42a807c8f7243077a67fb43c24b'],
   phrases: ['ARM1_EXPECT_MD5=efd158ed05f258705593ceb422893a5c\nPROBE start_utc=',
       'ARM2_EXPECT_MD5=6a23d42a807c8f7243077a67fb43c24b\nPROBE start_utc=',
       'MODULE_MD5=efd158ed05f258705593ceb422893a5c identical=true',
       'MODULE_MD5=6a23d42a807c8f7243077a67fb43c24b identical=true',
       'A_AFTER_REPLAY  {"country":"CN","regionCode":"20","place":null,"coordinates":null,"farm":null,"observations":"LOADED"}  calls=["region"]\nA_REPLAY_CHANGED_KEYS  ["place","coordinates"]',
       'A_AFTER_REPLAY  {"country":"CN","regionCode":"20","place":"n1","coordinates":"40.8494,111.6649","farm":null,"observations":"LOADED"}  calls=[]\nA_REPLAY_CHANGED_KEYS  []'],
   absent: ['✘', '✖', 'ABORT'],
    marks: 0 },
  // The page-level harm run: one measure instrument, walked on both desktop transports against the shipped bytes and
  // then against the delivered ones, and re-run a second time with the module digests stamped in-band. `DIFF_MEASURE
  // lines=0` is the diff of the MEASURE lines between those two captures, which is what ties the digests in the REPRO
  // banner to the sentences printed here. Both arms see the same state before the repeat and differ only after it.
  { archive: 'docs/evidence/iter70-f3-page-harm-2026-11-21.log.gz',
   lines: ['REPRO HEAD=60500c3077ee6702575c1f70b6783420a667ea82',
       'REPRO arm2 APPLIED md5=efd158ed05f258705593ceb422893a5c WANT=efd158ed05f258705593ceb422893a5c identical=true',
       'REPRO RESTORED md5=6a23d42a807c8f7243077a67fb43c24b identical=true',
       'REPRO DIFF_MEASURE lines=0 identical=true',
       'ARM=defect MEASURE after_repeat={"town":"","region":"20","latitude":"","longitude":""}',
       'ARM=delivered MEASURE after_repeat={"town":"2038432","region":"20","latitude":"40.6516","longitude":"109.84389"}'],
   phrases: ['FieldShift iteration 70, queue item F3 (the page half of the harm measurement)',
       'Nothing is\nasserted by the instrument',
       'ARM=defect MEASURE after_plan={"town":"2038432","region":"20","latitude":"40.6516","longitude":"109.84389"}\nARM=defect MEASURE after_repeat={"town":"","region":"20","latitude":"","longitude":""}',
       'ARM=delivered MEASURE after_plan={"town":"2038432","region":"20","latitude":"40.6516","longitude":"109.84389"}\nARM=delivered MEASURE after_repeat={"town":"2038432","region":"20","latitude":"40.6516","longitude":"109.84389"}',
       '✓  2 [node-desktop] › tests/e2e/zz-iter70-measure.spec.js:13:1'],
   absent: ['✘'],
   marks: 0 },
  // F2's premise, measured rather than inherited: the instrument counts place-list requests per transport while a
  // refusal is armed. The static page reads the list twice at country selection and never again, so the refusal it
  // prints cannot have been caused by a read it did not make; the node page re-reads per assistant turn. The two
  // `LOG FINAL` lines are the same instrument on the two servers, which is what makes the counts comparable.
  { archive: 'docs/evidence/iter70-f2-list-cache-blind-2026-11-21.log.gz',
   lines: ['REPRO DIFF_EXPLORE lines=0 identical=true',
       'STEP counts {"refused":0,"answered":2}',
       'F2URLS SPEC_MD5=1501c8d107bb92e6706feaec73288e34 MODULE_MD5=6a23d42a807c8f7243077a67fb43c24b SERVED_MD5=6a23d42a807c8f7243077a67fb43c24b',
       'LOG FINAL seen=2 counts={"refused":0,"answered":2}',
       'LOG FINAL seen=4 counts={"refused":2,"answered":2}',
       'LOG REQ n=1 phase=country-cn-selected mode=answered method=GET resourceType=fetch url=http://127.0.0.1:4173/data/locations/manifest.json'],
   phrases: ['FieldShift iteration 70, queue item F2 (measured premise, not a fix)',
       'server-side cache in server/context/locations.js',
       'url=http://127.0.0.1:4174/api/locations?country=CN',
       'RAW STEP counts {"refused":0,"answered":2}'],
   absent: ['✘'],
   marks: 0 },
  // The refusal-and-replay page run the third spec case was written from: on node the replay button exists and the
  // second read is answered, on static the button is never offered because the list was never re-requested. Both
  // transports keep the same town, point and region across it, which is the assertion the shipped code could break.
  { archive: 'docs/evidence/iter70-f3-refusal-replay-page-2026-11-21.log.gz',
   lines: ['F3REPLAY PLAYWRIGHT_EXIT=0',
       'LOG P3 node-desktop replay_button="Ask that again" counts={"refused":2,"answered":1}',
       'LOG P3 static-desktop replay_button=null counts={"refused":0,"answered":2}',
       'LOG P3 node-desktop after-replay held={"town":"2038432","region":"20","latitude":"40.6516","longitude":"109.84389"} counts={"refused":2,"answered":2}',
       'LOG P3 static-desktop FINAL counts={"refused":0,"answered":2} held={"town":"2038432","region":"20","latitude":"40.6516","longitude":"109.84389"}'],
   phrases: ['FieldShift iteration 70, queue item F3 (the refusal half, on the page)',
       'the instrument asserts nothing, it prints what the farmer is shown',
       'after-replay text=Inner Mongolia is the region this plan is already in, so nothing was selected again: the point 40.6516, 109.84389 stays as the location.',
       '4 passed (4.1s)'],
   absent: ['✘'],
   marks: 0 },
  // The mutation ladder over the browser spec, and the only row that scores the unit layer per arm: 44/45/46/48 pass
  // for revert/half/sentencedrop/delivered. `sentencedrop` keeps the wording and drops the state, so the two ✘ lines
  // it reddens - the `held(page)` assertions - are the witness that those DOM reads detect anything. Eighteen ✘ case
  // lines is 3 cases x 2 projects x 3 red arms; the delivered arm prints none.
  { archive: 'docs/evidence/iter70-f3-spec-controls-2026-11-21.log.gz',
   lines: ['MUT revert UNIT_EXIT=1 ℹ tests 48 ℹ pass 44 ℹ fail 4',
       'MUT half UNIT_EXIT=1 ℹ tests 48 ℹ pass 45 ℹ fail 3',
       'MUT sentencedrop UNIT_EXIT=1 ℹ tests 48 ℹ pass 46 ℹ fail 2',
       'MUT delivered UNIT_EXIT=0 ℹ tests 48 ℹ pass 48 ℹ fail 0',
       'MUT revert PLAYWRIGHT_EXIT=1',
       'MUT half PLAYWRIGHT_EXIT=1',
       'MUT sentencedrop PLAYWRIGHT_EXIT=1',
       'MUT delivered PLAYWRIGHT_EXIT=0',
       'MUT delivered RESTORED md5=6a23d42a807c8f7243077a67fb43c24b identical=true'],
   phrases: ['CONTROLS iter70 F3-spec arm=sentencedrop',
       'MUT revert DETAIL     > 56 |   expect(reply,\'naming the region the plan is already in selects it a second time\')',
       'MUT half DETAIL     > 146 |     expect(refusal,\'the list was answered from what the page already holds, so the sentence is the plain one\')',
       'MUT sentencedrop DETAIL     > 59 |   expect(await held(page),\'the town, its point and the region survive the sentence\').toEqual(picked);',
       'MUT sentencedrop DETAIL     > 152 |   expect(await held(page),\'the town, its point and the region survive on either arm\').toEqual(picked);',
       'MUT sentencedrop   6 failed',
       'MUT delivered   6 passed ('],
   marks: 18 },
  // The green gate for the spec on the delivered tree: 3 cases x 4 projects, with the branch witness printed to
  // stdout because Playwright discards attachments for passing tests and the archive would otherwise not say which arm
  // each transport took.
  { archive: 'docs/evidence/iter70-f3-spec-4projects-2026-11-21.log.gz',
   lines: ['PLAYWRIGHT_EXIT=0',
       'SPEC_MD5=3d9352d140a4af7333869c94067fc7fd MODULE_MD5=6a23d42a807c8f7243077a67fb43c24b SERVED_MD5=6a23d42a807c8f7243077a67fb43c24b',
       'REGION-REPEAT static-desktop arm=list-never-requested step-one-reads={"refused":0,"answered":2} final-counts={"refused":0,"answered":2}',
       'REGION-REPEAT node-desktop arm=refusal-replayed step-one-reads={"refused":0,"answered":1} final-counts={"refused":2,"answered":2}',
       '12 passed (8.2s)'],
   phrases: ['FieldShift iteration 70, queue item F3 (the shipped browser guard, all four transports)',
       'REGION-REPEAT static-mobile arm=list-never-requested',
       'REGION-REPEAT node-mobile arm=refusal-replayed'],
   absent: ['✘'],
   marks: 0 },
  // The four closing captures, in the order they were taken: the browser gate, the case census, the offline suite and the
  // document guards. Each header names the leg command and the digests that leg stamped before it ran, so a green summary is
  // attached to bytes rather than to a date. Their rows arrive after the readings they quote, because a row cannot pin a count
  // the run it describes did not print, which is why each one pins the leg's own status line beside its verdict: a capture
  // re-shelved over a different reading has to disagree with itself before it can pass.
  { archive: 'docs/evidence/iter70-gate-2026-11-21.log.gz',
   lines: ['GATE iter70 start_utc=2026-11-21T09:55:45Z interpreter=v26.13.1 head=60500c3077ee6702575c1f70b6783420a667ea82',
       'GATE MODULE_MD5=6a23d42a807c8f7243077a67fb43c24b SERVED_MD5=6a23d42a807c8f7243077a67fb43c24b',
       'GATE E2E_SPECS=31 TREE_STATUS_LINES=15',
       'Running 348 tests using 1 worker',
       '348 passed (22.7m)',
       'GATE_EXIT=0',
       'GATE end_utc=2026-11-21T10:18:28Z'],
   phrases: ['ITERATION 70',
       'the four Playwright projects (static-desktop, static-mobile, node-desktop, node-mobile) on one worker with no build step',
       'This pass\'s spec contributes 12 of those lines',
       'GATE SELF_PGID=24316 PARENT_PGID=24312'],
   absent: ['✘', 'GATE_EXIT=1'],
   marks: 0 },
  // The census is not a run and claims no pass: it exists so the gate's 348 is the runner's own count of the same
  // configuration, and so a spec that reached only the two projects which read server/ could not hide inside a correct total.
  { archive: 'docs/evidence/iter70-census-final-2026-11-21.log.gz',
   lines: ['CENSUS iter70 start_utc=2026-11-21T10:23:47Z interpreter=v26.13.1 head=60500c3077ee6702575c1f70b6783420a667ea82',
       'Total: 348 tests in 31 files',
       'CENSUS_SPEC_LINES=12',
       '3 CENSUS_SPEC_PROJECTS node-desktop', '3 CENSUS_SPEC_PROJECTS node-mobile',
       '3 CENSUS_SPEC_PROJECTS static-desktop', '3 CENSUS_SPEC_PROJECTS static-mobile',
       'CENSUS_EXIT=0'],
   phrases: ['the four-project case census on the delivered configuration',
       'CENSUS_RAW_MD5 ee8d0f8afc5e90285579b8c5e555e3cc',
       '=== THIS PASS SPEC IN THE RAW LISTING (12 lines) ==='],
   absent: ['✘', 'CENSUS_EXIT=1'],
   marks: 0 },
  // The offline suite over the delivered tree, archived with the red reading it superseded: that first run failed on the
  // three index cases because this pass had shelved the gate capture without regenerating the index beside it, so the
  // archive carries both the disagreement and the green that followed it once the shelf and the index agreed.
  { archive: 'docs/evidence/iter70-offline-final-2026-11-21.log.gz',
   lines: ['OFFLINE iter70 start_utc=2026-11-21T10:24:25Z interpreter=v26.13.1 head=60500c3077ee6702575c1f70b6783420a667ea82',
       'ℹ tests 322', 'ℹ pass 322', 'ℹ fail 0', 'ℹ skipped 0', 'OFFLINE_EXIT=0'],
   phrases: ['SOURCE_STATE this reading is the second',
       'duration_ms 24908.816125',
       'the three index cases'],
   absent: ['✘', 'OFFLINE_EXIT=1'],
   marks: 0 },
  // The five documentation guard files over the ledger this pass writes. Their count is the one thing a reader cannot get
  // from the tally table itself: the table checks archives, and these five check the prose that quotes the table.
  { archive: 'docs/evidence/iter70-docguards-final-2026-11-21.log.gz',
   lines: ['DOCSGUARDS iter70 start_utc=2026-11-21T10:26:11Z interpreter=v26.13.1 head=60500c3077ee6702575c1f70b6783420a667ea82',
       'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0', 'DOCSGUARDS_EXIT=0', 'GUARD_FILES 5'],
   phrases: ['the five documentation guard files over the ledger as this leg found it',
       'shelved after the closing paragraph is on the tree',
       'HEADER_CORRECTION this file was re-gzipped at 2026-11-21T10:40:41Z',
       'BODY_MD5 a36c3f697ff13d9ec538d0d387e984ee'],
   absent: ['✘', 'DOCSGUARDS_EXIT=1', '2026-11-21T2026-11-21'],
   marks: 0 },
  // The second ladder of this pass, the one that attacks the four rows above. It cannot pin itself - the row naming it is
  // written after it runs - but its own log carries the guard digest it attacked, so a reader can check the row and the
  // ladder describe the same table. `identical=False` is the line the driver prints when a restore misses the delivered
  // bytes, which would leave a mutant on the tree and make every reading after it a different file.
  { archive: 'docs/evidence/iter70-tally-controls-2-2026-11-21.log.gz',
   lines: ['TALLYCTL2_START_UTC 2026-11-21T10:32:35Z', 'DELIVERED md5 1b276977f4f7b0fef59b1c893299fb6e',
       'ROWS_ON_TREE 218', 'BASELINE rc=0 tests=7 pass=7 fail=0 reds=0', 'LAYERS_BITTEN 6/6 ALL',
       'TALLYCTL2_FINAL md5 1b276977f4f7b0fef59b1c893299fb6e identical=True fail=0',
       'TALLYCTL2_DONE 2026-11-21T10:32:44Z'],
   phrases: ['ITERATION 70',
       'the tally of every archived run is printed by that archive, not by the prose quoting it',
       'AssertionError [ERR_ASSERTION]: docs/evidence/iter70-gate-2026-11-21.log.gz never prints the line "348 passed (22.8m)" the ledger reads out of it',
       'LAYER_BITE layer=marks red=True bit=True\nRESTORED md5 1b276977f4f7b0fef59b1c893299fb6e identical=True',
       'DRIVER SOURCE (artifacts/scratch/iter70/tally-controls-2.py, md5 530aef398c80f5ff88d25f81dc40ded7)'],
   absent: ['identical=False', 'Traceback (most recent call last)'],
   marks: 0 },
  // The drift scout, the last leg of the pass and the only one that reads the finished ledger. Its two readings are pinned
  // as a pair because the working copy and `--head` are different questions: one asks whether this pass's prose points at
  // this pass's bytes, the other whether the prose that survives on the branch points at the branch. `DRIFTED 1` is the
  // shape of a real drift verdict, so declaring it absent is the case asserting that neither reading found one.
  { archive: 'docs/evidence/iter70-drift-final-2026-11-21.log.gz',
   lines: ['DRIFT iter70 start_utc=2026-11-21T10:38:19Z interpreter=v26.13.1 head=60500c3077ee6702575c1f70b6783420a667ea82',
       'TREE CITED_LINES_CHECKED 263 DRIFTED 0 INSIDE_DIFF_HUNKS 2',
       'HEAD CITED_LINES_CHECKED 262 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'DRIFT_TREE_EXIT=0', 'DRIFT_HEAD_EXIT=0', 'LEG drift end_utc=2026-11-21T10:38:20Z'],
   phrases: ['ITERATION 70',
       'GUARD_MD5=b6159a0e1529f6bc9591d48c389e3e6e TALLY_ROWS=219',
       'FILES_WITH_EDITS public/js/modules/workflow-assistant.js tests/documentation-evidence-index.test.js tests/workflow-place-choices.test.js',
       'DRIFT_TREE_EXIT=0\nTREE CITED_LINES_CHECKED 263 DRIFTED 0 INSIDE_DIFF_HUNKS 2'],
   absent: ['✘', 'DRIFTED 1', 'DRIFT_TREE_EXIT=1', 'DRIFT_HEAD_EXIT=1'],
   marks: 0 },
  { archive: 'docs/evidence/iter71-f2-layer-census-2026-11-21.log.gz',
   lines: ['MODE static BASE http://127.0.0.1:4173 STEP1_PICKER_CACHE=location-picker.js:6 CHAT_CACHE=workflow-assistant.js:284 TRANSPORT_CACHE=locations.js:9',
       'SENTENCE_OBSERVED 3 [sentence /data/locations/manifest.json , sentence /data/locations/manifest.json , sentence /data/locations/manifest.json]',
       'RETRY_OBSERVED 2 [retry /data/locations/manifest.json , retry /data/locations/BM.json]',
       'TAP_OBSERVED 0 []',
       'LAYER_VERDICT static tap_answered=true tap_reads=0',
       'RETRY_OBSERVED 1 [retry /api/locations?country=BM]',
       'TAP_OBSERVED 1 [tap /api/locations?country=BM]',
       'LAYER_VERDICT node tap_answered=false tap_reads=1',
       'PLACE_LIST_CACHE_LAYERS_DONE'],
   phrases: ['ESTABLISHED: the blind layer is the location client bundled into the static service worker',
       'NOT ESTABLISHED: whether the worker\'s Map or the picker\'s Map',
       '=== INSTRUMENT SOURCE (scripts/place-list-cache-layers.mjs, md5 68cc4832e23db8c5ca83772570194fd2) ===',
       'the region you chose could not be checked against it. Nothing was selected'],
   absent: ['Place list is busy or unavailable.', '✘'],
   marks: 0 },
  { archive: 'docs/evidence/iter71-instrument-hardening-2026-11-21.log.gz',
   lines: ['CTL_START probe_md5=5554dc6f1a45b305c82fbf11b597b05e layers_md5=68cc4832e23db8c5ca83772570194fd2',
       'CTL1_restored md5_equal=True', 'CTL2_restored md5_equal=True', 'CTL3_restored md5_equal=True',
       'CTL4_restored md5_equal=True', 'CTL5_restored md5_equal=True', 'CTL6_restored md5_equal=True',
       'Error: cannot arm a saved-list failure (503/LOCATIONS_SCHEMA)',
       'A_REQUESTS_DURING_TAP 2 []',
       'B_REQUESTS_DURING_TAP 1 []',
       'B_REQUESTS_DURING_TAP 1 [B /api/locations?country=BM]',
       'B_REQUESTS_DURING_TAP 0 []',
       'CONTROLS_DONE'],
   phrases: ['=== CONTROLS SUMMARY (bash artifacts/scratch/iter71/controls.sh, verbatim) ===',
       'CTL6_mutation_lines=1', 'CTL3_mutation_lines=1', 'CTL5_mutation_lines=4',
       'ABORT no "Try the place list again" button was offered',
       'LAYER_VERDICT node tap_answered=false tap_reads=0',
       'B_REQUESTS_DURING_TAP 0 [B /data/locations/manifest.json]'],
   absent: ['✘', 'town_tap_rejects=true', 'VERDICT_STATIC region_tap_rejects=true'],
   marks: 0 },
  { archive: 'docs/evidence/iter71-tally-ladder-2026-11-21.log.gz',
   lines: ['LADDER_START guard_md5=eca41712c7624d9171e3bd080ed47690 rows=222',
       'MUTANT_M1 exit=1 red_lines=3', 'MUTANT_M2 exit=1 red_lines=3', 'MUTANT_M3 exit=1 red_lines=3',
       'MUTANT_M4 exit=1 red_lines=3', 'MUTANT_M5 exit=1 red_lines=3', 'MUTANT_M6 exit=1 red_lines=9',
       'MUTANT_M1_restored md5_equal=True', 'MUTANT_M6_restored md5_equal=True',
       'LADDER_FINAL md5=eca41712c7624d9171e3bd080ed47690 md5_equal=True',
       'LADDER_DONE'],
   phrases: ['never prints the line "TAP_OBSERVED 7 []" the ledger reads out of it',
       'contains "PLACE_LIST_CACHE_LAYERS_DONE", which the ledger states that archive does not print',
       'evidence no document names or indexes',
       '=== LADDER DRIVER SOURCE (artifacts/scratch/iter71/tally-ladder.sh, md5 994cf7d839d5727632b710afee4775ec) ==='],
   absent: ['MUTANT_M1 exit=0', 'MUTANT_M6 exit=0'],
   // The ✘ glyph appears twice in this archive inside quoted driver text and once inside the floor message it embeds, so
   // the row cannot claim the archive never prints it. What it claims is that no case line does, which is `marks: 0`.
   marks: 0 },
  // Iteration 71's citation leg. The interesting pair here is not the zero but the denominator: `scripts/citation-drift.mjs`
  // walks pointers only into files the working copy modifies, so a pass that moves no application byte reports one pointer
  // checked and calls the leg green. The row pins that reading literally - a larger number here would mean the pass had
  // edited sources after the capture - and pins the eight `QUOTE` lines the archive adds to cover what the scout cannot see.
  { archive: 'docs/evidence/iter71-drift-final-2026-11-21.log.gz',
   lines: ['TREE CITED_LINES_CHECKED 1 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'HEAD CITED_LINES_CHECKED 1 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'DRIFT_TREE_EXIT=0', 'DRIFT_HEAD_EXIT=0', 'CLOSE71_LEG_DONE leg=drift', 'QUOTED_LINES_DONE',
       'FILES_WITH_EDITS tests/documentation-evidence-index.test.js',
       "QUOTE server/context/locations.js:20 :: throw new AppError('The saved town list could not load. Retry the country selection, search a place or use the map.', 503, 'LOCATIONS_UNAVAILABLE');",
       'QUOTE public/js/modules/context.js:248 :: const read = await picker.setCountry(countryCode, { regionCode });',
       'QUOTE tests/security-boundaries.test.js:103 :: assert.equal(locationReads, 0, \'a rejected country code must not read a file path\');'],
   phrases: ['=== QUOTED-LINE RUN LOG (bash artifacts/scratch/iter71/quoted-lines.sh, verbatim, md5 0aca66dbec131412bf42d92fa329bec9) ===',
       'ESTABLISHED: every `file:line` pointer this pass writes bytes about lands on those bytes',
       'NOT ESTABLISHED: the same thing the scout has never established for an unmodified file',
       'a green drift leg on such a pass is the shape of a guard skipping while',
       'That gap is queued as F15 in `docs/handoff-2026-11-18.md`'],
   absent: ['✘', 'DRIFTED 1', 'DRIFT_TREE_EXIT=1', 'DRIFT_HEAD_EXIT=1', 'CITED_LINES_CHECKED 263'],
   marks: 0 },
// Iteration 72 closes the optional-model wording: the six arms by which the model can fail to start posted five
// distinct texts and chat.js rendered one of them - a sentence about this device - on both transports. The capture
// archives hold what the page actually showed, the two control ladders hold what the guards do when the wording or
// the classifier is broken, and the gate archive holds the four-project run that graded the shipped bytes.
  { archive: 'docs/evidence/iter72-capture-static-2026-11-21.log.gz',
   lines: ['CMD node artifacts/scratch/iter72/model-error-capture.mjs static (driver source embedded below)',
       'ARM none STATUS "Compact model ready · 157.1 KB weights · 0.1s load · experimental"',
       'ARM none BUTTONS load=false unload=true metrics=set',
       'ARM cdn STATUS "Model could not start on this device. Evidence chat still works."',
       'ARM cdn BUTTONS load=true unload=false metrics=undefined',
       'ARM worker POSTED []',
       'ARM worker ERRORED [{"script":"/js/modules/mini-lm-worker.js","message":null,"filename":null,"lineno":null}]',
       'CAPTURE_DONE'],
   phrases: ['Failed to execute \'importScripts\' on \'WorkerGlobalScope\'',
       'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
       '"message":"Failed to fetch"',
       'Failed to parse model JSON of response from /models/fieldshift-mini/model.json',
       'Unexpected token',
       'the pre-fix wording, which is the finding rather than an oversight'],
   absent: ['because its runtime did not arrive',
       'Press Enable compact local model to try again',
       'ARM none BUTTONS load=true'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-capture-node-2026-11-21.log.gz',
   lines: ['CMD node artifacts/scratch/iter72/model-error-capture.mjs node (driver source embedded below)',
       'ARM none STATUS "Compact model ready · 157.1 KB weights · 0.1s load · experimental"',
       'ARM wasm STATUS "Compact model ready · 157.1 KB weights · 0.2s load · experimental"',
       'ARM cdn STATUS "Model could not start on this device. Evidence chat still works."',
       'ARM model POSTED [{"script":"/js/modules/mini-lm-worker.js","id":null,"message":"Failed to fetch"}]',
       'ARM worker ERRORED [{"script":"/js/modules/mini-lm-worker.js","message":null,"filename":null,"lineno":null}]',
       'CAPTURE_DONE'],
   phrases: ['Failed to execute \'importScripts\' on \'WorkerGlobalScope\'',
       '"message":"Failed to fetch"',
       'the pre-fix wording, which is the finding rather than an oversight'],
   absent: ['because its runtime did not arrive',
       'Press Enable compact local model to try again',
       '✘'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-unit-controls-2026-11-21.log.gz',
   lines: ['CTL baseline exit=0 | tests 9 pass 9 fail 0  | (shipped bytes, expected green)',
       'CTL ctl1-device-sentence exit=1 red_lines=2 | tests 9 pass 8 fail 1  | (chat.js reverted to the device sentence)',
       'CTL ctl2-raw-echo exit=1 red_lines=14 | tests 9 pass 2 fail 7  | (classifier quotes the worker text back)',
       'CTL ctl3-no-causes exit=1 red_lines=6 | tests 9 pass 6 fail 3  | (cause table emptied)',
       'CTL ctl4-no-recovery exit=1 red_lines=12 | tests 9 pass 3 fail 6  | (recovery clause replaced by a bare word)',
       'CTL ctl5-button-renamed exit=1 red_lines=2 | tests 9 pass 8 fail 1  | (the recovery names a control that no longer exists)',
       'SHIPPED_CHAT_MD5 57fb95190930e3dc9d5ad47244537d9c SHIPPED_MODULE_MD5 69fa1817db5601937e4f7a05835091ca (must equal the stamps above)'],
   phrases: ['six-leg mutation ladder over the new offline guard tests/model-failure.test.js'],
   absent: ['CTL baseline exit=1',
       'CTL ctl1-device-sentence exit=0',
       'CTL ctl2-raw-echo exit=0',
       'CTL ctl3-no-causes exit=0',
       'CTL ctl4-no-recovery exit=0',
       'CTL ctl5-button-renamed exit=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-page-controls-2026-11-21.log.gz',
   lines: ['PAGECTL shipped chat=57fb95190930e3dc9d5ad47244537d9c module=69fa1817db5601937e4f7a05835091ca spec=3c1cd4912171af374b7f055fda7ab14d',
       'PAGECTL A exit=0 | tally:   4 passed (3.2s)',
       'PAGECTL B exit=1 | tally:   4 failed',
       'PAGECTL B DID_NOT_EXECUTE_MARKER present',
       'PAGECTL C DID_NOT_EXECUTE_MARKER present',
       'PAGECTL   Received string:    "Model could not start on this device. Evidence chat still works."',
       'PAGECTL C exit=1 | tally:   4 failed',
       'PAGECTL   Received string:    "Model could not start: Failed to execute \'importScripts\' on \'WorkerGlobalScope\': The script at \'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js\' failed to load."',
       'PAGECTL D exit=0 | tally:   4 passed (3.4s)',
       'PAGECTL_FINAL chat=57fb95190930e3dc9d5ad47244537d9c module=69fa1817db5601937e4f7a05835091ca spec=3c1cd4912171af374b7f055fda7ab14d',
       'PAGECTL_EXPECT chat=57fb95190930e3dc9d5ad47244537d9c module=69fa1817db5601937e4f7a05835091ca spec=3c1cd4912171af374b7f055fda7ab14d'],
   phrases: ['leg B restores',
       'reproduced through this pass',
       'grep -qE "No tests found|already used, make sure"'],
   absent: ['PAGECTL A exit=1',
       'PAGECTL D exit=1',
       'PAGECTL B exit=0',
       'PAGECTL C exit=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-gate-2026-11-21.log.gz',
   lines: ['GATE_BUILD_EXIT=0',
       'GATE_EXIT=0',
       'GATE_SERVED CHAT=57fb95190930e3dc9d5ad47244537d9c MODULE=69fa1817db5601937e4f7a05835091ca',
       'Running 348 tests using 1 worker',
       '348 passed (26.1m)',
       'GATE_PASSED_LINES 348',
       'GATE_RED_LINES 0',
       'GATE_EGRESS_LINES 4',
       'GATE_CDN_HOST_LINES 0',
       'GATE_SPECS 0',
       'GATE_TREE_STATUS_LINES_NOW 8',
       '✓   15 [static-desktop] › tests/e2e/chat-model-egress.spec.js:11:1 › a blocked model CDN reports the failure and the chat still answers a typed question (365ms)',
       '✓  102 [static-mobile] › tests/e2e/chat-model-egress.spec.js:11:1 › a blocked model CDN reports the failure and the chat still answers a typed question (395ms)',
       '✓  189 [node-desktop] › tests/e2e/chat-model-egress.spec.js:11:1 › a blocked model CDN reports the failure and the chat still answers a typed question (529ms)',
       '✓  276 [node-mobile] › tests/e2e/chat-model-egress.spec.js:11:1 › a blocked model CDN reports the failure and the chat still answers a typed question (302ms)'],
   phrases: ['Interpreter v26.13.1, source revision 108a5534a2e48b580f6fc0a644f7a58c0e866e5b plus this pass',
       'GATE iter72 start_utc=2026-11-21T12:00:09Z interpreter=v26.13.1 head=108a5534a2e48b580f6fc0a644f7a58c0e866e5b'],
   absent: ['GATE_EXIT=1',
       'GATE_BUILD_EXIT=1',
       'GATE_SERVED CHAT=6c91d2705da110e7118707b8bed07e87',
       'Model could not start on this device'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-census-2026-11-21.log.gz',
   lines: ['CMD bash artifacts/scratch/iter72/close72.sh census (driver source embedded below)',
       'CENSUS_EXIT=0',
       'CENSUS_TOTAL Total: 348 tests in 31 files',
       'Total: 348 tests in 31 files',
       'CENSUS_SPECS 31',
       'CLOSE72_LEG_DONE leg=census'],
   phrases: ['DETACHED=yes',
       'CENSUS RAW OUTPUT (npx playwright test --list, verbatim'],
   absent: ['CENSUS_EXIT=1',
       'Total: 347 tests',
       'OFFLINE_EXIT=0',
       'DOCSGUARDS_SUMMARY tests 28 | pass 28'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-offline-2026-11-21.log.gz',
   lines: ['CMD bash artifacts/scratch/iter72/close72.sh offline (driver source embedded below)',
       'OFFLINE_EXIT=0',
       'ℹ tests 331',
       'ℹ pass 331',
       'ℹ fail 0',
       'ℹ skipped 0',
       'OFFLINE_UNIT_LINES 331',
       'CLOSE72_LEG_DONE leg=offline'],
   phrases: ['DETACHED=yes',
       'OFFLINE RAW OUTPUT (node --test tests/*.test.js, verbatim'],
   absent: ['ERR_ASSERTION',
       'ℹ fail 4',
       'ℹ pass 327',
       'OFFLINE_EXIT=1',
       'CENSUS_EXIT=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-docguards-2026-11-21.log.gz',
   lines: ['CMD bash artifacts/scratch/iter72/close72.sh docguards (driver source embedded below)',
       'DOCSGUARDS_EXIT=0',
       'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0',
       'CLOSE72_LEG_DONE leg=docguards'],
   phrases: ['DETACHED=yes',
       'DOCGUARDS RAW OUTPUT (node scripts/docs-guards.mjs, verbatim'],
   absent: ['ERR_ASSERTION',
       'DOCSGUARDS_EXIT=1',
       'pass 24 | fail 4',
       'DOCSGUARDS_CHILD_EXIT 1',
       'CENSUS_EXIT=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter72-drift-2026-11-21.log.gz',
   lines: ['CMD bash artifacts/scratch/iter72/close72.sh drift (driver source embedded below)',
       'DRIFT_TREE_EXIT=0',
       'DRIFT_HEAD_EXIT=0',
       'HEAD CITED_LINES_CHECKED 125 DRIFTED 22 INSIDE_DIFF_HUNKS 0',
       'CLOSE72_LEG_DONE leg=drift'],
   phrases: ['DETACHED=yes',
       'TREE CITED_LINES_CHECKED',
       'DRIFTED 0 INSIDE_DIFF_HUNKS',
       'DRIFT WORKING-COPY OUTPUT (node scripts/citation-drift.mjs, verbatim'],
   absent: ['DRIFT_TREE_EXIT=1',
       'DRIFT_HEAD_EXIT=1',
       'CENSUS_EXIT=0',
       'OFFLINE_EXIT=0'],
   marks: 0 },
  // The matrix that graded the other nine rows. Its negatives are whole run names because the archive embeds the
  // verifier that holds them, so an abbreviated negative would sit inside the bytes it forbids; see subsection 72.
  { archive: 'docs/evidence/iter72-row-matrix-2026-11-21.log.gz',
   lines: ['CMD bash artifacts/scratch/iter72/matrix72.sh (driver and verifier source embedded below)',
       'MATRIX self_ok=9/9 cross_rejected=72/72 cross_accepted=0',
       'SELF_OK iter72-gate-2026-11-21.log.gz',
       'SELF_OK iter72-capture-static-2026-11-21.log.gz',
       'SELF_OK iter72-capture-node-2026-11-21.log.gz',
       'SELF_OK iter72-drift-2026-11-21.log.gz'],
   phrases: ['ROW VERIFIER SOURCE (node artifacts/scratch/iter72/verify-row72.mjs, verbatim',
       'MATRIX RUN LOG (bash artifacts/scratch/iter72/matrix72.sh, verbatim'],
   absent: ['SELF_REJECTED iter72-gate-2026-11-21.log.gz',
       'CROSS_ACCEPTED row=iter72-gate-2026-11-21.log.gz archive=iter72-census-2026-11-21.log.gz',
       'VERIFY_BAD docs/evidence/iter72-row-matrix-2026-11-21.log.gz'],
   marks: 0 },
  // Iteration 73 moved the same defect shape one module over: the speech panel echoed raw engine text and blamed the
  // device. The four capture rows below are the eight-arm census before and after the fix, one row per transport per
  // phase, so the pre-fix rows carry the leak in their `lines` and the post-fix rows carry it in their `absent`.
  // Two of the pre-fix negatives name the other transport's port: a row that would read the wrong transport's capture
  // is a row that read nothing about the transport it cites.
  { archive: 'docs/evidence/iter73-capture-static-pre-2026-11-21.log.gz',
   lines: ['ARM hub STATUS "Voice input unavailable: Failed to fetch. Typing works as usual."',
       'ARM hub LEAKS none device_blame=false raw_echo=true doubled_period=false engine_ellipsis=false',
       'ARM runtime STATUS "The speech model could not start on this device. Typing works as usual."',
       'ARM runtime ERRORED [{"script":"/js/modules/stt-worker.js","message":null,"filename":null,"lineno":null}]',
       'ARM onnx-garbage LEAKS ["error_code","protobuf"] device_blame=false raw_echo=true doubled_period=true engine_ellipsis=false',
       'SPEECH_CENSUS mode=static arms=7 leaking=2 device_blame=2 raw_echo=4 doubled_period=2 settled=7',
       'CAPTURE mode=static phase=pre exit=0 arm_lines=42 census=SPEECH_CENSUS mode=static arms=7 leaking=2 device_blame=2 raw_echo=4 doubled_period=2 settled=7',
       'CAPTURE_DONE mode=static arms=7'],
   phrases: ['Aborted(NetworkError: Failed to execute \'send\' on \'XMLHttpRequest\': Failed to load \'http://127.0.0.1:4173/vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm\'',
       'Build with -sASSERTIONS for more info.. Typing works as usual.',
       'draft="Tell me about tomatoes in Kenya."',
       'the pre-fix wording, which is the finding rather than an oversight'],
   absent: ['127.0.0.1:4174',
       'ARM hub STATUS "Voice input unavailable because a model file did not arrive',
       'leaking=0 device_blame=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter73-capture-node-pre-2026-11-21.log.gz',
   lines: ['ARM hub STATUS "Voice input unavailable: Failed to fetch. Typing works as usual."',
       'ARM wasm LEAKS ["http","/vendor/",".wasm","runtimeerror","assertions"] device_blame=false raw_echo=true doubled_period=true engine_ellipsis=false',
       'ARM worker-script STATUS "The speech model could not start on this device. Typing works as usual."',
       'ARM config-garbage LEAKS none device_blame=false raw_echo=true doubled_period=false engine_ellipsis=true',
       'SPEECH_CENSUS mode=node arms=7 leaking=2 device_blame=2 raw_echo=4 doubled_period=2 settled=7',
       'CAPTURE mode=node phase=pre exit=0 arm_lines=42 census=SPEECH_CENSUS mode=node arms=7 leaking=2 device_blame=2 raw_echo=4 doubled_period=2 settled=7',
       'CAPTURE_DONE mode=node arms=7'],
   phrases: ['Failed to load \'http://127.0.0.1:4174/vendor/transformers/ort-wasm-simd-threaded.asyncify.wasm\'',
       'Can\'t create a session. ERROR_CODE: 7, ERROR_MESSAGE: Failed to load model because protobuf parsing failed.. Typing works as usual.',
       'the pre-fix wording, which is the finding rather than an oversight'],
   absent: ['127.0.0.1:4173',
       'ARM runtime STATUS "Voice input unavailable. Typing works as usual. Press the microphone',
       'leaking=0 device_blame=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter73-capture-static-post-2026-11-21.log.gz',
   lines: ['ARM hub STATUS "Voice input unavailable because a model file did not arrive. Typing works as usual. Press the microphone button to try again."',
       'ARM wasm STATUS "Voice input unavailable because its runtime did not arrive. Typing works as usual. Press the microphone button to try again."',
       'ARM config-garbage STATUS "Voice input unavailable because a model file arrived unreadable. Typing works as usual. Press the microphone button to try again."',
       'ARM runtime STATUS "Voice input unavailable. Typing works as usual. Press the microphone button to try again."',
       'ARM none CONTROLS pressed=false mic=true unload=true draft="Tell me about tomatoes in Kenya." metrics=value',
       'SPEECH_CENSUS mode=static arms=7 leaking=0 device_blame=0 raw_echo=0 doubled_period=0 settled=7',
       'CAPTURE mode=static phase=post exit=0 arm_lines=42 census=SPEECH_CENSUS mode=static arms=7 leaking=0 device_blame=0 raw_echo=0 doubled_period=0 settled=7',
       'CAPTURE_DONE mode=static arms=7'],
   phrases: ['the post-fix wording, produced by this pass',
       'model-failure.js a614c2ff10a95f4a1dd5b7693391bd90'],
   absent: ['ARM hub STATUS "Voice input unavailable: Failed to fetch',
       'raw_echo=true',
       'leaking=2 device_blame=2'],
   marks: 0 },
  { archive: 'docs/evidence/iter73-capture-node-post-2026-11-21.log.gz',
   lines: ['ARM hub STATUS "Voice input unavailable because a model file did not arrive. Typing works as usual. Press the microphone button to try again."',
       'ARM onnx-garbage STATUS "Voice input unavailable because a model file arrived unreadable. Typing works as usual. Press the microphone button to try again."',
       'ARM worker-script STATUS "Voice input unavailable. Typing works as usual. Press the microphone button to try again."',
       'SPEECH_CENSUS mode=node arms=7 leaking=0 device_blame=0 raw_echo=0 doubled_period=0 settled=7',
       'CAPTURE mode=node phase=post exit=0 arm_lines=42 census=SPEECH_CENSUS mode=node arms=7 leaking=0 device_blame=0 raw_echo=0 doubled_period=0 settled=7',
       'CAPTURE_DONE mode=node arms=7'],
   phrases: ['the post-fix wording, produced by this pass',
       'speech.js ed702667361edf7657db607d71d5c289'],
   absent: ['ARM runtime STATUS "The speech model could not start on this device',
       'doubled_period=true',
       'leaking=2 device_blame=2'],
   marks: 0 },
  // The two ladders. The unit row pins the four tally lines and the two mutation-applied stamps; its must-not-occur list
  // is the pair of exit statuses that would make the ladder a tautology (a green mutant or a red baseline).
  { archive: 'docs/evidence/iter73-unit-controls-2026-11-21.log.gz',
   lines: ['LEG baseline exit=0 counts=    tests 15    pass 15    fail 0',
       'LEG ctl1-causes-swapped exit=1 counts=    tests 15    pass 13    fail 2',
       'LEG ctl2-raw-interpolated exit=1 counts=    tests 15    pass 6    fail 9',
       'LEG restore exit=0 counts=    tests 15    pass 15    fail 0',
       'UNITCTL_FINAL md5=a614c2ff10a95f4a1dd5b7693391bd90 identical=True test_md5=c404af2cac50329404843b3ffcaff8ad utc=2026-11-21T13:59:14Z',
       'UNITCTL_DONE'],
   phrases: ['RED ✖ a corrupt model binary is not called a missing runtime',
       'RED ✖ the dictation panel classifies the same texts without echoing any of them',
       'RED ✖ the null error event gets the sentence that claims no cause',
       'CTL1_APPLIED',
       'CTL2_APPLIED',
       'CTL2_RESTORED md5=a614c2ff10a95f4a1dd5b7693391bd90 identical=True',
       'DETACHED=yes',
       'BASELINE RAW OUTPUT',
       'ℹ pass 13',
       'ℹ fail 9'],
   absent: ['LEG baseline exit=1',
       'LEG ctl1-causes-swapped exit=0',
       'LEG ctl2-raw-interpolated exit=0',
       'LEG restore exit=1'],
   marks: 0 },
  { archive: 'docs/evidence/iter73-page-controls-2026-11-21.log.gz',
   lines: ['LEG A-shipped build_exit=0 served=ed702667361edf7657db607d71d5c289 served_module=a614c2ff10a95f4a1dd5b7693391bd90',
       'LEG A-shipped exit=0 summary=  12 passed (39.1s)',
       'LEG A-shipped running=1 green=12 red=0',
       'LEG B_APPLIED speech_md5=9a7d2e2982fa453f55dcd565b99c8bb3 want=9a7d2e2982fa453f55dcd565b99c8bb3 identical=True',
       'LEG B-reverted-to-head exit=1 summary=  4 failed  8 passed (38.8s)',
       'LEG B-reverted-to-head running=1 green=8 red=4',
       'LEG C_RESTORED speech_md5=ed702667361edf7657db607d71d5c289 identical=True',
       'LEG C-restore exit=0 summary=  12 passed (37.5s)',
       'PAGECTL_FINAL speech_md5=ed702667361edf7657db607d71d5c289 identical=True utc=2026-11-21T14:01:19Z'],
   phrases: ['Received: "Voice input unavailable: Failed to fetch. Typing works as usual."',
       'Expected: "Voice input unavailable because a model file did not arrive. Typing works as usual. Press the microphone button to try again."',
       'leg B\'s received string is HEAD\'s sentence, byte for byte',
       'DETACHED=yes',
       '✘   3 [static-desktop] › tests/e2e/speech-microphone.spec.js:67:1 › a failed speech-model download is reported and typed chat still works',
       'LEG B RAW SUITE OUTPUT'],
   absent: ['LEG A-shipped exit=1',
       'LEG B-reverted-to-head exit=0',
       'LEG C-restore exit=1',
       'LEG A-shipped running=1 green=8'],
   // Four because the archive carries leg B's raw suite output, and that is the only place in it a Playwright red marker
   // can appear: legs A and C each print twelve greens.
   marks: 4 },
  // The five closing legs and the run they replaced, inserted by iteration 73 after the gate released the ports. Each row
  // quotes lines its own archive prints and names a foreign leg only by a marker the driver emits through $LEG, so no
  // negative can sit inside the embedded driver source; the interrupted row carries noTally because its log has no
  // GATE_EXIT, no closing stamp and no tally, which is the shape the reverse rule below refuses to let pass silently.
  { archive: 'docs/evidence/iter73-gate-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=2617 PARENT_PGID=2617 DETACHED=yes',
        'GATE iter73 start_utc=2026-11-21T14:26:42Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'GATE_BUILD_EXIT=0',
        'GATE_SERVED SPEECH=ed702667361edf7657db607d71d5c289 MODULE=a614c2ff10a95f4a1dd5b7693391bd90 CHAT=aa198a0886235605ef1394bab36c2fdc',
        'GATE_EXIT=0',
        'Running 348 tests using 1 worker',
        '348 passed (25.7m)',
        'GATE_PASSED_LINES 348',
        'GATE_RED_LINES 0',
        'GATE_SPEECH_LINES 12',
        'GATE_EGRESS_LINES 4',
        'GATE_CDN_HOST_LINES 0',
        'GATE_SPECS 31',
        'GATE_TREE_STATUS_LINES_NOW 18',
        'gate end_utc=2026-11-21T14:52:28Z'],
    phrases: ['GUARD_MD5=8acdf8cf05e0ebb4b4de232e4f7748d6 TALLY_ROWS=240 PINS=191 SHELF=811 TREE_STATUS_LINES=18',
        'api-exit-parity.spec.js:9:1 › a request that ends with no status reads one authored sentence on either transport',
        'md5 a90acd22951bcc3423337250c0b3b6f8',
        'GATE SUITE OUTPUT'],
    absent: ['GATE_RED_LINES 1',
        'GATE_EXIT=1',
        '1 failed',
        'flaky 1',
        'CLOSE73_LEG_DONE leg=census'],
    marks: 0 },
  { archive: 'docs/evidence/iter73-census-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=43747 PARENT_PGID=43747 DETACHED=yes',
        'CENSUS iter73 start_utc=2026-11-21T14:53:12Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'CENSUS_EXIT=0',
        'CENSUS_TOTAL Total: 348 tests in 31 files',
        'CENSUS_SPEECH_LISTINGS 12',
        'CENSUS_EGRESS_LISTINGS 4',
        'CENSUS_SPECS 31',
        'census end_utc=2026-11-21T14:53:13Z',
        'CLOSE73_LEG_DONE leg=census'],
    phrases: ['Total: 348 tests in 31 files',
        'speech-microphone.spec.js',
        'chat-model-egress.spec.js',
        'CENSUS RAW OUTPUT'],
    absent: ['Total: 349 tests in 31 files',
        'CENSUS_EXIT=1',
        'CLOSE73_LEG_DONE leg=offline'],
    marks: 0 },
  { archive: 'docs/evidence/iter73-offline-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=43747 PARENT_PGID=43747 DETACHED=yes',
        'OFFLINE iter73 start_utc=2026-11-21T14:53:13Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'OFFLINE_EXIT=0',
        'ℹ tests 337',
        'ℹ pass 337',
        'ℹ fail 0',
        'ℹ cancelled 0',
        'ℹ skipped 0',
        'OFFLINE_UNIT_LINES 337',
        'CLOSE73_LEG_DONE leg=offline'],
    phrases: ['The difference is one file, measured rather than attributed',
        '15 cases on this tree and 9 at HEAD',
        'OFFLINE RAW OUTPUT',
        'model-failure'],
    absent: ['ℹ fail 1',
        'not ok',
        'CLOSE73_LEG_DONE leg=docguards'],
    marks: 0 },
  { archive: 'docs/evidence/iter73-docguards-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=43747 PARENT_PGID=43747 DETACHED=yes',
        'DOCSGUARDS iter73 start_utc=2026-11-21T14:53:37Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'DOCSGUARDS_EXIT=0',
        'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0',
        'CLOSE73_LEG_DONE leg=docguards'],
    phrases: ['DOCSGUARDS_RAW_MD5',
        'documentation-citation-anchors',
        'widened to 191 pins',
        'DOCGUARDS RAW OUTPUT'],
    absent: ['DOCSGUARDS_SUMMARY tests 27',
        'fail 1 |',
        'CLOSE73_LEG_DONE leg=drift'],
    marks: 0 },
  { archive: 'docs/evidence/iter73-drift-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=43747 PARENT_PGID=43747 DETACHED=yes',
        'DRIFT iter73 start_utc=2026-11-21T14:53:39Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'DRIFT_TREE_EXIT=0',
        'TREE CITED_LINES_CHECKED 139 DRIFTED 0 INSIDE_DIFF_HUNKS 13',
        'DRIFT_HEAD_EXIT=0',
        'HEAD CITED_LINES_CHECKED 155 DRIFTED 17 INSIDE_DIFF_HUNKS 0',
        'CLOSE73_LEG_DONE leg=drift'],
    phrases: ['DRIFT WORKING-COPY OUTPUT',
        'DRIFT HEAD OUTPUT',
        'TREE CITED_LINES_CHECKED 139 DRIFTED 0',
        'public/js/modules/speech.js'],
    absent: ['TREE CITED_LINES_CHECKED 139 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
        'DRIFT_TREE_EXIT=1',
        'CLOSE73_LEG_DONE leg=gate'],
    marks: 0 },
  { archive: 'docs/evidence/iter73-gate-interrupted-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=72083 PARENT_PGID=72083 DETACHED=yes',
        'GATE iter73 start_utc=2026-11-21T14:04:51Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'GATE SPEECH_MD5=ed702667361edf7657db607d71d5c289 CHAT_MD5=aa198a0886235605ef1394bab36c2fdc MODULE_MD5=a614c2ff10a95f4a1dd5b7693391bd90 STT_MD5=e07f8847d99fbf5ab5cd9adaa256a40c WORKER_MD5=0018ed60b754a783804cdb4e26f8f516 SPEECHSPEC_MD5=b66312af651a68a665c49e46185af638 CHATSPEC_MD5=3c1cd4912171af374b7f055fda7ab14d UNIT_MD5=c404af2cac50329404843b3ffcaff8ad ANCHORS_MD5=7ec1059e3cee9ee847d7c7d9929136cd GUARD_MD5=8acdf8cf05e0ebb4b4de232e4f7748d6 TALLY_ROWS=240 PINS=191 SHELF=811 TREE_STATUS_LINES=18',
        'GATE_BUILD_EXIT=0',
        'GATE_SERVED SPEECH=ed702667361edf7657db607d71d5c289 MODULE=a614c2ff10a95f4a1dd5b7693391bd90 CHAT=aa198a0886235605ef1394bab36c2fdc',
        'Running 348 tests using 1 worker',
        '✓  235 [node-desktop] › tests/e2e/review-phase-a.spec.js:16:1 › short zoom and landscape viewports retain sixty percent usable height (866ms)'],
    phrases: ['GATE INTERRUPTED LEG LOG',
        'GATE INTERRUPTED SUITE OUTPUT',
        'md5 a90acd22951bcc3423337250c0b3b6f8',
        '✓    1 [static-desktop] › tests/e2e/api-exit-parity.spec.js:9:1 › a request that ends with no status reads one authored sentence on either transport (231ms)'],
    absent: ['GATE_EXIT=0',
        'CLOSE73_LEG_DONE leg=gate',
        'GATE AFTER SPEECH_MD5',
        'passed ('],
    marks: 0,
    noTally: true },
  // A row inserted after the run it grades, by iteration 73: the table/shelf state pinned in its negatives is the point
  // of the archive, because the earlier leg of the same name graded a smaller tree.
  { archive: 'docs/evidence/iter73-offline-final-2026-11-21.log.gz',
    lines: ['CLOSE73 SELF_PGID=56479 PARENT_PGID=56479 DETACHED=yes',
        'OFFLINE_FINAL iter73 start_utc=2026-11-21T15:11:12Z interpreter=v26.13.1 head=021ecf790cbd9efe148cccc778dac57152ff791c',
        'OFFLINE_FINAL_EXIT=0',
        'OFFLINE_FINAL_UNIT_LINES 337',
        'OFFLINE_FINAL_RAW_MD5 14b553427c982de484dfa000739c450f',
        'CLOSE73_LEG_DONE leg=offline-final',
        'ℹ tests 337',
        'ℹ pass 337',
        'ℹ fail 0',
        'ℹ cancelled 0',
        'ℹ skipped 0'],
    phrases: ['TALLY_ROWS=246 PINS=191 SHELF=818 TREE_STATUS_LINES=26',
        'OFFLINE-FINAL LEG LOG',
        'OFFLINE-FINAL RAW OUTPUT',
        'This run\'s table size is the `TALLY_ROWS=` line inside its own log',
        'GUARD_MD5=e1eae6dac745896dec6bf459aca544cf'],
    absent: ['OFFLINE_EXIT=0',
        'OFFLINE_UNIT_LINES 337',
        'TALLY_ROWS=240',
        'SHELF=811',
        'ℹ fail 1',
        'not ok'],
    marks: 0 },
  // A row inserted after the run it grades, by iteration 73: the table/shelf state pinned in its negatives is the point
  // of the archive, because the earlier leg of the same name graded a smaller tree.
  { archive: 'docs/evidence/iter73-row-matrix-2026-11-21.log.gz',
    lines: ['MATRIX self_ok=13/13 cross_rejected=156/156 cross_accepted=0',
        'SELF_OK iter73-capture-node-post-2026-11-21.log.gz',
        'SELF_OK iter73-capture-node-pre-2026-11-21.log.gz',
        'SELF_OK iter73-capture-static-post-2026-11-21.log.gz',
        'SELF_OK iter73-capture-static-pre-2026-11-21.log.gz',
        'SELF_OK iter73-census-2026-11-21.log.gz',
        'SELF_OK iter73-docguards-2026-11-21.log.gz',
        'SELF_OK iter73-drift-2026-11-21.log.gz',
        'SELF_OK iter73-gate-2026-11-21.log.gz',
        'SELF_OK iter73-gate-interrupted-2026-11-21.log.gz',
        'SELF_OK iter73-offline-2026-11-21.log.gz',
        'SELF_OK iter73-offline-final-2026-11-21.log.gz',
        'SELF_OK iter73-page-controls-2026-11-21.log.gz',
        'SELF_OK iter73-unit-controls-2026-11-21.log.gz'],
    phrases: ['MATRIX DRIVER SOURCE',
        'ROW VERIFIER SOURCE',
        'MATRIX RUN LOG',
        'driver_md5=5fdec8531aed91eb4e32edff64cd1e6b',
        'MATRIX iter73 start_utc=',
        'matrix end_utc='],
    absent: ['SELF_REJECTED iter73-gate-2026-11-21.log.gz',
        'SELF_REJECTED iter73-offline-final-2026-11-21.log.gz',
        'CROSS_ACCEPTED row=iter73-offline-2026-11-21.log.gz archive=iter73-offline-final-2026-11-21.log.gz',
        'VERIFY_NO_ROW iter73-offline-final-2026-11-21.log.gz',
        'MATRIX self_ok=12/13',
        'ports=busy'],
    marks: 0 },
  { archive: 'docs/evidence/iter74-spec-2026-11-21.log.gz',
   lines: ['SPEC iter74 start_utc=2026-11-21T16:23:50Z interpreter=v26.13.1 head=91798d4c3e8ebd246609bc27de02cdd019fbfa86',
       'SPEC_SERVED CHAT=aa198a0886235605ef1394bab36c2fdc CHAT_SOURCE=aa198a0886235605ef1394bab36c2fdc',
       'SPEC_GREEN_LINES 16',
       'SPEC_RED_LINES 0',
       'SPEC_STATIC_LINES 8',
       'SPEC_NODE_LINES 8',
       'SPEC_EXIT=0'],
   phrases: ['SPEC_RAW_MD5 7fd5537f713022ee07e5badd7b0b9c56',
       '=== SPEC RAW SUITE OUTPUT (npx playwright test tests/e2e/chat-stale-reply-superseded.spec.js, verbatim,'],
   absent: ['SPEC_EXIT=1',
       'the superseded turn unlocked the composer 20 time(s)'],
   marks: 0 },
  { archive: 'docs/evidence/iter74-page-controls-2026-11-21.log.gz',
   lines: ['CTL A-shipped exit=0 green=16 red=0',
       'CTL B-guard100-deleted exit=0 green=16 red=0',
       'CTL D-guard159-loosened exit=1 green=12 red=4',
       'CTL W-zero-hold exit=1 green=12 red=4',
       'CTL X-spec-restore exit=0 green=16 red=0',
       'CTL_FINAL chat_md5=aa198a0886235605ef1394bab36c2fdc identical_to_pristine=True spec_md5=0834fdf9255cdd07aa7d7360f589b3de spec_identical=True'],
   phrases: ['CTL_B_APPLIED chat_md5=23675e9d4a660ef3167e0ca222def775 guard_lines=0',
       'CTL_W_APPLIED spec_md5=2663a218a9558805e8c9391032bde6fa zero_hold_lines=3 (pristine had 1, the disarm line)',
       'Error: the superseded turn unlocked the composer 20 time(s) while the newer one was still waiting'],
   absent: ['identical_to_pristine=False',
       'CTL A-shipped exit=1',
       'CTL B-guard100-deleted exit=1'],
   marks: 16 },
  { archive: 'docs/evidence/iter74-offline-2026-11-21.log.gz',
   lines: ['OFFLINE iter74 start_utc=2026-11-21T17:31:50Z interpreter=v26.13.1 head=91798d4c3e8ebd246609bc27de02cdd019fbfa86',
       'OFFLINE_EXIT=0',
       'CLOSE74_LEG_DONE leg=offline',
       'ℹ pass 337',
       'ℹ fail 0'],
   phrases: ['OFFLINE_RAW_MD5 08304cd91ccc810d139ae91cd8d15dce',
       '=== OFFLINE LEG LOG (bash artifacts/scratch/iter74/close74.sh offline, verbatim,'],
   absent: ['✖ ',
       'OFFLINE_EXIT=1'],
   marks: 0 },
  { archive: 'docs/evidence/iter74-docguards-2026-11-21.log.gz',
   lines: ['DOCSGUARDS iter74 start_utc=2026-11-21T17:56:41Z interpreter=v26.13.1 head=91798d4c3e8ebd246609bc27de02cdd019fbfa86',
       'DOCSGUARDS CHAT_MD5=aa198a0886235605ef1394bab36c2fdc SPEC_MD5=0834fdf9255cdd07aa7d7360f589b3de CONFIG_MD5=77025ef6cd7ae6f745e6bfd9dc177dfa GUARD_MD5=ecdb298fa11ca7b798fa52d87ea2f742 TALLY_ROWS=251 PINS=191 SHELF=822 TREE_STATUS_LINES=10',
       'DOCSGUARDS_EXIT=0',
       'DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0',
       'docguards end_utc=2026-11-21T17:56:42Z',
       'CLOSE74_LEG_DONE leg=docguards'],
   phrases: ['=== DOCGUARDS RAW OUTPUT (node scripts/docs-guards.mjs, verbatim,',
       'ℹ tests 28'],
   absent: ['DOCSGUARDS_EXIT=1',
       'ℹ fail 1',
       '✖ '],
   marks: 0 },
  { archive: 'docs/evidence/iter74-drift-2026-11-21.log.gz',
   lines: ['DRIFT iter74 start_utc=2026-11-21T17:56:42Z interpreter=v26.13.1 head=91798d4c3e8ebd246609bc27de02cdd019fbfa86',
       'DRIFT CHAT_MD5=aa198a0886235605ef1394bab36c2fdc SPEC_MD5=0834fdf9255cdd07aa7d7360f589b3de CONFIG_MD5=77025ef6cd7ae6f745e6bfd9dc177dfa GUARD_MD5=ecdb298fa11ca7b798fa52d87ea2f742 TALLY_ROWS=251 PINS=191 SHELF=822 TREE_STATUS_LINES=10',
       'FILES_WITH_EDITS tests/documentation-evidence-index.test.js',
       'TREE CITED_LINES_CHECKED 1 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'HEAD CITED_LINES_CHECKED 1 DRIFTED 0 INSIDE_DIFF_HUNKS 0',
       'DRIFT_TREE_EXIT=0',
       'DRIFT_HEAD_EXIT=0',
       'drift end_utc=2026-11-21T17:56:43Z',
       'CLOSE74_LEG_DONE leg=drift'],
   phrases: ['=== DRIFT WORKING-COPY OUTPUT (node scripts/citation-drift.mjs, verbatim,',
       '=== DRIFT HEAD OUTPUT (node scripts/citation-drift.mjs --head, verbatim,'],
   absent: ['DRIFTED 1',
       'DRIFT_TREE_EXIT=1',
       'DRIFT_HEAD_EXIT=1',
       '✖ '],
   marks: 0 },
  { archive: 'docs/evidence/iter74-offline-final-2026-11-21.log.gz',
   lines: ['OFFLINE_FINAL iter74 start_utc=2026-11-21T18:01:02Z interpreter=v26.13.1 head=91798d4c3e8ebd246609bc27de02cdd019fbfa86',
       'OFFLINE_FINAL CHAT_MD5=aa198a0886235605ef1394bab36c2fdc SPEC_MD5=0834fdf9255cdd07aa7d7360f589b3de CONFIG_MD5=77025ef6cd7ae6f745e6bfd9dc177dfa GUARD_MD5=560fdcd3a50baf8fb1148ae351cfd95e TALLY_ROWS=253 PINS=191 SHELF=824 TREE_STATUS_LINES=12',
       'OFFLINE_FINAL_EXIT=0',
       'OFFLINE_FINAL_RAW_MD5 7f02205b8543da2810090b2c0bdc918d',
       'offline-final end_utc=2026-11-21T18:01:32Z',
       'CLOSE74_LEG_DONE leg=offline-final',
       'ℹ pass 337'],
   phrases: ['=== OFFLINE-FINAL RAW OUTPUT (node --test tests/*.test.js, verbatim,'],
   absent: ['OFFLINE_FINAL_EXIT=1',
       'ℹ fail 1',
       '✖ '],
   marks: 0 },
  { archive: 'docs/evidence/iter74-row-matrix-2026-11-21.log.gz',
   lines: ['MATRIX iter74 start_utc=2026-11-21T18:07:25Z verifier_md5=5e8c63c5876922696ce065e7330696cb driver_md5=5d5a6740e3a0b17a1b92d4aed4346a2d',
       'MATRIX74 DENOMINATORS archives=6 rows=6',
       'MATRIX self_ok=6/6 cross_rejected=30/30 cross_accepted=0',
       'MATRIX74_DONE',
       'SELF_OK iter74-spec-2026-11-21.log.gz',
       'matrix end_utc=2026-11-21T18:07:28Z'],
   phrases: ['=== MATRIX RUN LOG (bash artifacts/scratch/iter74/matrix74.sh, verbatim,'],
   absent: ['ℹ duration_ms',
       'Running 16 tests using'],
   marks: 0 },
  { archive: 'docs/evidence/iter75-controls-2026-11-22.log.gz',
   lines: ['CONTROL75 start_utc=2026-11-21T18:51:00Z anchors_md5=dc02722654f92cb0e3f6eabe29c668c0 validation_md5=2d0e62b9e8bffded72fcf3126e00bb54 interpreter=v26.13.1 head=9bf5613d4e08801997227f144decf6aaa997fc07',
       'CONTROL75 LEGS_TSV lines=11 rows_not_6_fields=0',
       'LEG L8-floor-raised file=tests/documentation-citation-anchors.test.js parse=ok rc=1 pass_lines=12 control=13 deep_link_failures=2 markers=1/1 missed:none anchors_md5=4889b87443c95b759174d77a28a0298a verdict=PASS',
       'LEG L9-scan-blind file=tests/documentation-citation-anchors.test.js parse=ok rc=1 pass_lines=11 control=13 deep_link_failures=4 markers=2/2 missed:none anchors_md5=7a83ce63fb8891981f9d550f46750d06 verdict=PASS',
       'CONTROLS75_FINAL anchors=dc02722654f92cb0e3f6eabe29c668c0 validation=2d0e62b9e8bffded72fcf3126e00bb54 SAME=yes legs=11 failed=0 control_pass=13'],
   phrases: ['CONTROLS75_DONE_UTC 2026-11-21T18:51:07Z',
       'LEG CTRL-restored file=NONE parse=skipped rc=0 pass_lines=13 control=13 deep_link_failures=0 markers=0/0 missed:none'],
   absent: ['DOCSGUARDS_SUMMARY tests 31',
       'CITATION_BAND window=3 docs=43 citations=1204',
       'OFFLINE75_EXIT=0',
       'TREE CITED_LINES_CHECKED 12'],
   marks: 0 },
  { archive: 'docs/evidence/iter75-docguards-2026-11-22.log.gz',
   lines: ['DOCSGUARDS_START 2026-11-21T18:55:37Z',
       'GUARD_FILES 5',
       'DOCSGUARDS_SUMMARY tests 31 | pass 31 | fail 0 | skipped 0',
       'DOCSGUARDS_CHILD_EXIT 0'],
   phrases: ['GUARD_FILE tests/documentation-evidence-index.test.js',
       '✔ every labelled deep link in tracked prose resolves, and the band table grades each one and cannot be narrowed'],
   absent: ['CONTROLS75_FINAL',
       'CITATION_BAND window=3 docs=43 citations=1204',
       'OFFLINE75_EXIT=0',
       'TREE CITED_LINES_CHECKED 12'],
   marks: 0 },
  { archive: 'docs/evidence/iter75-drift-2026-11-22.log.gz',
   lines: ['ITER75 DRIFT start_utc=2026-11-21T18:55:38Z head=9bf5613 interpreter=v26.13.1',
       'FILES_WITH_EDITS tests/documentation-citation-anchors.test.js',
       'TREE CITED_LINES_CHECKED 12 DRIFTED 0 INSIDE_DIFF_HUNKS 37',
       'HEAD CITED_LINES_CHECKED 12 DRIFTED 0 INSIDE_DIFF_HUNKS 0'],
   phrases: ['--- tree mode',
       '--- head mode'],
   absent: ['CONTROLS75_FINAL',
       'DOCSGUARDS_SUMMARY tests 31',
       'CITATION_BAND window=3 docs=43 citations=1204',
       'OFFLINE75_EXIT=0'],
   marks: 0 },
  { archive: 'docs/evidence/iter75-instruments-2026-11-22.log.gz',
   lines: ['### iteration 75 instruments, run on the tree this commit ships (head=9bf5613, interpreter=v26.13.1, utc=2026-11-21T18:52:04Z)',
       'HEAD_LINK_COUNT 3',
       'LABELLED_LINKS 8 label_shares_token 7 label_disjoint 1 target_blank 0 target_file_absent 0',
       'LABEL_SHAPE coordinate_only 0 names_a_rule 8',
       'CITATION_BAND window=3 docs=43 citations=1204',
       'CANDIDATE_ROWS 55',
       'CONTROLS75_FINAL anchors=dc02722654f92cb0e3f6eabe29c668c0 validation=2d0e62b9e8bffded72fcf3126e00bb54 SAME=yes legs=11 failed=0 control_pass=13'],
   phrases: ['The fix adds `regionRecovery()` beside `placeRecovery()`',
       'SPAN_SYMBOL_ON_CITED_LINE 126 within_3_lines 38 elsewhere_in_file 29 nowhere_in_file 26'],
   absent: ['DOCSGUARDS_SUMMARY tests 31',
       'OFFLINE75_EXIT=0',
       'TREE CITED_LINES_CHECKED 12',
       'ℹ tests 340'],
   marks: 0 },
  { archive: 'docs/evidence/iter75-offline-2026-11-22.log.gz',
   lines: ['ITER75 OFFLINE start_utc=2026-11-21T18:55:38Z head=9bf5613 interpreter=v26.13.1 command=\'node --test tests/*.test.js\'',
       'ℹ tests 340',
       'ℹ pass 340',
       'ℹ fail 0',
       'ℹ skipped 0',
       'OFFLINE75_EXIT=0'],
   phrases: ['a cancellation the page asked for carries that fact and not only the runtime name',
       'the worker path marks its own cancellation the way the HTTP path does'],
   absent: ['CONTROLS75_FINAL',
       'CITATION_BAND window=3 docs=43 citations=1204',
       'DOCSGUARDS_SUMMARY tests 31',
       'TREE CITED_LINES_CHECKED 12',
       'CANDIDATE_ROWS 55'],
   marks: 0 },
  { archive: 'docs/evidence/iter76-row-matrix-2026-11-25.log.gz',
   lines: ['MATRIX iter76 start_utc=2026-11-25T08:52:22Z verifier_md5=5079d57b408659b92902d3052b1e73a7 driver_md5=3112c03124bcb1615059531577a36ee8',
       'MATRIX76 DENOMINATORS archives=5 rows=5',
       'MATRIX self_ok=5/5 cross_rejected=20/20 cross_accepted=0',
       'MATRIX76_DONE',
       'SELF_OK iter75-controls-2026-11-22.log.gz',
       'matrix end_utc=2026-11-25T08:52:24Z'],
   phrases: ['=== MATRIX RUN LOG'],
   absent: ['explicit Node transport sends form inputs as JSON and preserves abort signals',
       'the index header states counts its own rows and the filesystem agree with'],
   marks: 0 },
];

test('the tally of every archived run is printed by that archive, not by the prose quoting it', async () => {
  assert.ok(TALLIES.length >= 261, `the table carries ${TALLIES.length} archives; subsections 57 through 75 quote more runs ` +
    'than that, so a number in them is unguarded. The floor was 16 after iteration 57, 25 when iteration 58 archived the red, ' +
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
    + '172 when the confirmation leg that re-read those three instruments with all five shelves on the tree joined it, '
    + 'and 178 when iteration 67 archived F4 with the six merged captures its ledger cites: the offline file as it was '
    + 'written (6 tests with five red on the bytes HEAD ships, 6 with one red on the unbounded fix, 8 green on the '
    + 'delivered ones), the two offline control legs, both browser controls with their digest stamps inside the archive '
    + 'rather than only on the console, the page spec once per project, the citation sweep that re-pointed 73 pointers '
    + 'and died once on its own report, and the instrument readings that bracket the pin widening - the guard set dying '
    + 'twice on RangeError: Invalid array length and the anchors guard red on one subsection-59 tuple then green at 160 '
    + 'entries, and 179 when the six perturbation runs that prove those rows fail rather than pass by default joined '
    + 'it - the guard green once, then red six times, one broken needle per assertion layer, the file restored '
    + 'byte-for-byte between each, and 187 when iteration 67\'s eight more joined it: the F10 before/after capture that '
    + 'counted the three `file:///C:/` targets HEAD ships against the zero the repair leaves, the wave-1 offline suite '
    + 'that printed F15 as three reds instead of being told about it, the four breaks of the widened anchor case with '
    + 'their digest-stamped restore, and the five closing legs on the delivered bytes - the four-project gate at 324 '
    + 'passed (26.4m), the whole offline suite at 303, the guard set at 28, the citation scout over the finished ledger '
    + 'and the `--list` census counting the same 324 in 29 files, and 188 when the ladder that breaks one needle in each '
    + 'of those rows\' assertion layers joined it beside them - its row reading the six bites the child printed, since a '
    + 'summary this file wrote would prove nothing about them - and 189 when the whole offline suite that went red '
    + 'because this pass\'s own prose named a gitignored driver joined it too, and 194 when iteration 68 archived F8 with the same sentence read on '
    + 'both trees - HEAD answered a country name as a crop question on all 302 spellings the tables publish, and the '
    + 'predicate this pass did not use would have caught 266 of them and missed 36 - beside the five-clause mutant '
    + 'ladder, the three-arm page control on both transports, the measured boundary of the new branch and the '
    + 'four-project gate whose two digest banners are equal because no byte moved while its 328 cases ran, and 199 when '
    + 'this pass\'s four closing legs and the ladder that controls their rows joined it - the offline suite at 307, the '
    + 'guard set at 28, the scout in both of its modes and the census that counts the new spec in all four projects - '
    + 'because a closing reading is the one number a pass can invent without noticing, and these five cannot be '
    + 'quoted from prose while the table holds their pins, and 208 when iteration 69 archived F9 with the same six ' +
    'shapes - the offline guards read against the bytes HEAD ships, the two-round mutation ladder that left one of its ' +
    'own mutants unscored and said so, the page spec once per project printing the digest each arm served, the ' +
    'four-project gate at 336 whose two digest banners are equal because no byte moved while it ran, the scout in both ' +
    'of its modes, the case census and the ladder over these nine rows, beside the offline suite and the guard set as ' +
    'they read once every one of those shelves existed, and 209 when iteration 70 archived F3 as one file with two arms ' +
    '- the 798-line module iteration 69 shipped, whose replay of a refused switch read selected the region the plan ' +
    'already held and lost the town point, and the 812-line one delivered here, whose replay states the point it keeps ' +
    '- each arm printing the digest of the bytes it imported before and after its four walks, and 214 when the same ' +
    'iteration shelved the page side of the same defect: the two-arm harm measure over four projects, whose delivered ' +
    'bytes keep town 2038432 at 40.6516, 109.84389 across a repeat while the shipped ones empty both fields with the ' +
    'same instrument file byte-for-byte between arms, the F2 blindness run that counts a place-list request per ' +
    'transport and shows the static page answering from a client-side cache it never re-reads, the refused-read replay ' +
    'green on all four projects with the branch each transport took printed to stdout, the four-arm browser ladder ' +
    'whose sentence-preserving mutant reddens exactly the two state assertions and whose eighteen ✘ case lines are 3 ' +
    'cases x 2 projects x 3 red arms, and the 12-case four-project gate on the delivered bytes; 218 when that iteration shelved ' +
    'the closing captures themselves - the four-project browser gate printing 348 passed with the served bundle equal to the ' +
    'source it was meant to exercise, the case census printing the same 348 in 31 files with twelve project lines for the new ' +
    'spec, the offline suite at 322 with none skipped after its first reading went red on the three index cases this pass had ' +
    'disturbed by shelving a capture beside a stale index, and the five document guard files at 28 with the citation-drift ' +
    'scout deliberately left to run after the prose that cites these archives exists; 219 when the same iteration shelved ' +
    'the second ladder beside them - the one that attacks those four closing rows, six assertion shapes broken one at a ' +
    'time against the archives on the shelf, each of which had to go red naming the file it reads, and which ran three ' +
    'times before every layer bit because its first two drafts anchored on text that matched nothing or matched seven ' +
    'rows at once, and 220 when the citation-drift scout that reads all six joined it - the leg that runs last because it ' +
    'counts the pointers the closing paragraph adds, and whose row arrived after it, together with the docguards capture ' +
    're-shelved over a corrected header once its own WHAT line claimed a ledger newer than the run it described; 221 when ' +
    'iteration 71 archived the F2 layer census that names which place-list cache absorbs a tapped region\'s read on each ' +
    'transport, and 222 when it archived the six mutation controls over the two instruments that produced that census - ' +
    'the witness line whose deletion empties a bracket while its count survives, once per handler, the arming guard that ' +
    'has to refuse a 503 whose code is not the outage being armed, and the census counter that silently starts reporting ' +
    'the static column\'s zero when its recording line goes, and 223 when the ladder over these three rows joined it - ' +
    'six mutants, one broken needle per assertion shape, each red naming the archive its row reads, and the sixth caught ' +
    'by the coverage case rather than the floor in a ledger whose prose did not yet cite the shelves, and 224 when this ' +
    'pass\'s citation leg joined it - the leg whose zero is true and whose denominator is one, because the scout opens ' +
    'only the files a working copy modifies and a pass that moves no application byte leaves it nothing to compare, so ' +
    'the eight source lines the ledger quotes bytes about are pinned here by the lines a driver printed rather than by a ' +
    'green verdict that measured none of them, and 229 when iteration 72 shelved the optional-model failure classifier with its ' +
    'two transport captures, its six-leg unit ladder and its four-leg page ladder, and 233 when the four closing legs joined ' +
    'them: the census that prints CENSUS_SPECS 31 beside the gate line that read GATE_SPECS 0, the whole offline suite at 331, ' +
    'the guard set at 28 and the scout that reads last - each of those four rows pinning its own CMD line while naming a foreign ' +
    'leg by its summary line as a must-not-occur, because a leg row that would read any leg is a row that reads none, and 234 ' +
    'when the matrix that graded those nine joined it: that row pins the run printing its own denominator - nine rows each ' +
    'accepting the archive it cites and refusing the eight it does not, 72 refusals in all - and it is the one row in this ' +
    'table that cannot write a negative as a single literal, because the archive embeds the row list that forbids it and the ' +
    'literal would then sit inside the bytes the row states it never prints, and 240 when iteration 73 closed F16, the same ' +
    'echo-and-blame shape one module over in the dictation panel: four capture rows for the seven arms observed before and ' +
    'after on each transport, which is the first pass where the same arm appears twice in this table with opposite verdicts ' +
    'because the pre-fix rows pin the leak in their lines and the post-fix rows forbid the same string in their absent lists, ' +
    'plus the unit ladder that reddens two cases when the cause table is swapped and nine when the classifier echoes its ' +
    'argument, and the page ladder whose middle leg prints the four reds and the exact byte string HEAD served while its ' +
    'first and last legs print twelve green, and 246 when iteration 73 shelved its own closing: the gate that reports 348 ' +
    'passed beside GATE_RED_LINES 0 and the three served digests it graded, the four legs that ran behind it (the census ' +
    'printing the same 348 in the same 31 files, the offline suite at 337, the guard set at 28 and the drift scout at 139 ' +
    'checked with 13 of them inside this iteration diff), and the first gate launch the host stopped mid-suite - the only ' +
    'row in this table that has to state noTally, because its basename names the stop and the reverse rule at the bottom of ' +
    'the loop refuses a stop-named archive whose row checks nothing about the tally it could not print, and 247 when the same ' +
    'pass re-ran that offline suite on the tree it delivers: this is the one row whose point is a number that must differ from ' +
    'a sibling row, because it graded a table of 246 rows over 818 archived files while the earlier offline leg of the same ' +
    'pass graded 240 over 811, so a row that accepted both archives would grade neither, and 248 when the matrix that graded ' +
    'all thirteen of those rows joined them: its row is the only one written from two-part strings, because the archive holds ' +
    'the row list that grades it and a negative typed as one contiguous string is therefore a string the archive contains - ' +
    'which is how this pass found that a helper meant to hide such needles was joining its parts with a space, producing a ' +
    'needle no bytes could ever contain, and 251 when iteration 74 joined the spec that pins a superseded chat turn, the ' +
    'seven-arm ladder that measures what that spec is worth and the offline run both were graded on. Every needle in those ' +
    'three rows is a rendered stamp with its values in place, because all three archives embed the same driver bytes and a ' +
    'needle copied from a line of that source therefore matches all of them - which is exactly what the row/archive matrix ' +
    'asks each row about. Iteration 76 adds the five iteration-75 archives and the matrix that grades them, because their existence checks did not pin a single reported number.');
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
