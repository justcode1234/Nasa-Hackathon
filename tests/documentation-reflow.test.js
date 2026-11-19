import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// METHOD: this loop rewrites its own prose with a text-wrapping tool, and on 19 Nov that practice cut an archive
// citation in half - the head of `docs/evidence/iter47-npm-` at the end of one line and the rest at the start of the
// next. The commands guard went red only because its archive regex cannot cross a newline, so it read the head half
// as a path that does not exist. Iteration 47 probed how far that catch reaches
// (docs/evidence/iter47-wrap-probe-2026-11-19.log.gz) and found it narrow: the citations guard passes the same
// fragment because its regex demands the `.log.gz` suffix, and a split code path is invisible to every case in the
// repository because no case looks at a line break at all. Measured 19 Nov before writing this guard: 213 prose
// files in scope, 153 of their lines end in a multi-segment path token, and zero of those joins resolve.
//
// A split citation is detectable without knowing which token is an archive: rejoin the last path-shaped token of one
// line with the first file-named token of the next, and a citation that was cut produces a string that exists on
// disk. Nothing else in the tree does that, so one rule covers archives, code paths and every other tracked file at
// once. The doubled-marker case closes the sibling artifact of the same habit: a wrapper that prepends its own bullet
// marker leaves `- - ` in the file, and that is how the iteration-43 bullet in AGENTS.md shipped.
//
// The floors are sized to that 19 Nov measurement. A pass that genuinely narrows the gap rewrites them to its own
// numbers and says so; it does not delete them.
const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['evidence', 'history', 'node_modules', '.git', 'dist', 'artifacts', 'submission',
  'coverage', 'playwright-report', 'test-results']);
const EXTS = new Set(['.js', '.mjs', '.cjs', '.md', '.css', '.py', '.sh', '.txt']);
const LEDGER = /^(docs\/|AGENTS\.md$)/;
const CAP = 300 * 1024;
// The line ends with a path: at least one segment and a name that could still have more letters after the break. A
// line ending `server/` is a directory a list is naming, and the hyphen ending is the shape a wrapper actually
// leaves behind, so both the dot and the dash have to stay inside the class.
const HEAD = /(?:[\w.-]+\/)+[\w.-]+\s*$/;
// The next line opens with the rest of a file name: something carrying an extension.
const TAIL = /^[`*_ ]*([\w./-]+\.\w+)/;
const DOUBLED = /^\s*[-*] [-*] /;

async function proseFiles(dir = '', collected = []) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) await proseFiles(relative, collected); }
    else if (EXTS.has(path.extname(entry.name))) {
      const size = (await stat(path.join(ROOT, relative))).size;
      if (size <= CAP || LEDGER.test(relative)) collected.push(relative);
    }
  }
  return collected.sort();
}

// The rule on its own, over the lines of one file: how many line ends it considered, and which of them rejoined with
// the next line into a file that exists.
function reflow(lines) {
  const joins = [];
  let heads = 0;
  lines.forEach((line, index) => {
    const head = HEAD.exec(line.replace(/\s+$/, ''));
    if (!head) return;
    heads++;
    const next = lines[index + 1];
    if (next === undefined) return;
    const tail = TAIL.exec(next);
    if (!tail) return;
    const trimmed = head[0].trimEnd();
    if (existsSync(path.join(ROOT, trimmed + tail[1]))) {
      joins.push({ line: index + 1, joined: trimmed + tail[1], head: trimmed, tail: tail[1] });
    }
  });
  return { joins, heads };
}

// One pass over the tree: the joins that resolve, the lines the rule had to look at, and the doubled markers.
async function scan() {
  const joins = [];
  const doubled = [];
  let heads = 0;
  const files = await proseFiles();
  for (const file of files) {
    const lines = (await readFile(path.join(ROOT, file), 'utf8')).split('\n');
    lines.forEach((line, index) => { if (DOUBLED.test(line)) doubled.push(`${file}:${index + 1}`); });
    const seen = reflow(lines);
    heads += seen.heads;
    for (const join of seen.joins) joins.push({ ...join, where: `${file}:${join.line}` });
  }
  return { files, joins, doubled, heads };
}

test('the reflow scan still sees the prose tree this guard was sized against', async () => {
  const { files, heads } = await scan();
  assert.ok(files.length >= 200, `the scan saw only ${files.length} prose files, against 213 measured 19 Nov`);
  for (const required of ['AGENTS.md', 'docs/validation.md', 'docs/handoff-2026-11-18.md']) {
    assert.ok(files.includes(required), `the scan skipped ${required}`);
  }
  // The rule is only as good as the haystack it walks: 153 path-ended lines were the 19 Nov reading, and a scan that
  // lost them would report a clean tree instead of the split it exists to catch.
  assert.ok(heads >= 120, `only ${heads} lines end in a path-shaped token, against 153 measured 19 Nov`);
});

test('no citation is split across a line break anywhere in the prose tree', async () => {
  const { joins } = await scan();
  const found = joins.map(join => `${join.where} rejoins to ${join.joined} (${join.head} + ${join.tail})`);
  assert.deepEqual(found, [], `citations cut by a line break:\n${found.join('\n')}`);
});

test('the rule still catches the splits it was written for', () => {
  // Fixtures, not the tree. Both halves live in string literals on their own lines so this file never puts a head and
  // its tail on two adjacent prose lines and trips the case above. What this pins is the pattern: the first draft
  // terminated HEAD at a word character, which silently skipped the hyphen ending a wrapper really leaves behind, and
  // the two tree cases stayed green because a clean tree passes either way.
  const cases = [
    ['archive citation', 'logged at docs/evidence/iter48-gate-2026-11-', '19.log.gz and nothing else'],
    ['code path', 'the worker is public/js/modules/stt-wor', 'ker.js, loaded by app.js'],
  ];
  for (const [shape, head, tail] of cases) {
    const { joins } = reflow([head, tail]);
    assert.equal(joins.length, 1, `a split ${shape} is no longer caught: ${head} / ${tail}`);
  }
});

test('no line in the prose tree carries a doubled list marker', async () => {
  const { doubled } = await scan();
  assert.deepEqual(doubled, [], `lines whose bullet marker was doubled by a rewrap: ${doubled.join(', ')}`);
});
