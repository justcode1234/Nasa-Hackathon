import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Two committed citation defects lived where no check reads. Iteration 41 shipped two evidence-archive
// names (a stale -2026-11-18 date and a wildcard) inside tests/e2e/chat-pest-context.spec.js comments that no
// shipped archive matched - scripts/check-documentation.js walks markdown links and tests/documentation-commands.test.js
// reads only AGENTS.md and docs/*.md, so a path in a test file's comments was checked by nothing. Iteration
// 42 then nearly repeated the shape with a wrong line range (`:195-196` for what was `:153-154`). A census
// over the tracked prose tree measured 399 evidence citations and 321 `file.js:N` citations before this
// guard landed, so the rules below are sized to the tree that exists, and they fail on exactly the two
// shapes this loop has already committed once: a named archive that is not shipped, and a `file:N` that
// misses the line (or names a basename two files share, where the reader cannot know which was meant).
const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['evidence', 'history', 'node_modules', '.git', 'dist', 'artifacts', 'submission',
  'coverage', 'playwright-report', 'test-results']);
const EXTS = new Set(['.js', '.mjs', '.cjs', '.md', '.css', '.py', '.sh', '.txt']);
// The size cap keeps generated and vendored bulk (bundles, map runtimes) out of the scan. The ledger
// is handwritten prose the guard exists to police and it grows every iteration, so it is exempt by
// role: on 19 Nov validation.md passed 300 KB and the scan silently skipped it until the reach
// assertion below failed. Bumping the number would only re-open the same silent gap later.
const LEDGER = /^(docs\/|AGENTS\.md$)/;
// Measured 19 Nov, the only tracked prose-extension files above 300 KB once the ledger is exempt. A new
// vendored or generated file lands here by review, never by silently falling out of the citation rules.
const GENERATED = new Set(['public/js/lib/core-worker.bundle.js', 'public/vendor/maplibre/maplibre-gl.mjs',
  'public/vendor/maplibre/maplibre-gl-shared.mjs', 'public/vendor/transformers/transformers.min.js']);
// Archives files live in folders too, so the class has to carry `/`. A nested citation that truncates
// before the slash would never be stat()'d as the file it names.
const EVIDENCE = /docs\/evidence\/[A-Za-z0-9._*\/-]+\.log\.gz/g;
const LINE_REF = /([A-Za-z0-9_.\-/]{1,120}\.(?:js|mjs|cjs|css|py|sh)):(\d+)(?:-(\d+))?/g;

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

async function scannedTree() {
  const files = await proseFiles();
  const text = new Map();
  for (const file of files) text.set(file, (await readFile(path.join(ROOT, file), 'utf8')).split('\n'));
  const nameCounts = new Map();
  for (const file of files) { const base = file.split('/').pop(); nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1); }
  return { files, text, nameCounts };
}

test('every docs/evidence archive named anywhere in prose exists on disk', async () => {
  const { text } = await scannedTree();
  const missing = [];
  for (const [file, lines] of text) {
    for (let index = 0; index < lines.length; index++) {
      for (const match of lines[index].matchAll(EVIDENCE)) {
        try { await readFile(path.join(ROOT, match[0])); }
        catch { missing.push(`${file}:${index + 1} cites ${match[0]}`); }
      }
    }
  }
  assert.ok(missing.length === 0, `cited archives that are not shipped:\n${missing.join('\n')}`);
});

test('every file:line citation resolves and names a line that exists and is not blank', async () => {
  const { files, text, nameCounts } = await scannedTree();
  const broken = [];
  for (const [file, lines] of text) lines.forEach((line, index) => {
    if (line.length > 2000) return;
    for (const match of line.matchAll(LINE_REF)) {
      const target = match[1].includes('/') ? match[1]
        : (nameCounts.get(match[1]) === 1 ? files.find(f => f.split('/').pop() === match[1]) : null);
      if (!target || !text.has(target)) continue; // untracked or bundle target: not a reader's pointer
      const from = Number(match[2]);
      const to = match[3] ? Number(match[3]) : from;
      const targetLines = text.get(target);
      if (to > targetLines.length || from > targetLines.length) { broken.push(`${file}:${index + 1} cites ${match[0]} but ${target} has ${targetLines.length} lines`); continue; }
      const blank = [...Array(to - from + 1).keys()].every(step => !targetLines[from - 1 + step].trim());
      if (blank) broken.push(`${file}:${index + 1} cites ${match[0]} but every line ${from}-${to} in ${target} is blank`);
    }
  });
  assert.ok(broken.length === 0, `citations that miss the line they name:\n${broken.join('\n')}`);
});

test('a file:line citation never names a bare basename that two tracked files share', async () => {
  const { text, nameCounts } = await scannedTree();
  const shared = new Set([...nameCounts].filter(([, count]) => count > 1).map(([name]) => name));
  const offenders = [];
  for (const [file, lines] of text) lines.forEach((line, index) => {
    if (line.length > 2000) return;
    for (const match of line.matchAll(LINE_REF)) {
      if (!match[1].includes('/') && shared.has(match[1])) offenders.push(`${file}:${index + 1} cites ${match[0]} but ${nameCounts.get(match[1])} tracked files are named ${match[1]}`);
    }
  });
  assert.ok(offenders.length === 0, `ambiguous citations:\n${offenders.join('\n')}`);
});

test('the scan actually reaches every file where the two committed defects lived', async () => {
  const { files, text } = await scannedTree();
  for (const required of ['AGENTS.md', 'docs/validation.md', 'tests/e2e/chat-pest-context.spec.js', 'public/js/lib/dom.js', 'server/api.js']) {
    assert.ok(files.includes(required), `the scan skipped ${required}`);
    assert.ok(text.get(required).length > 20, `${required} was scanned as almost empty`);
  }
  // These floors are a second tripwire for a scan that lost sight of prose, sized from the measured
  // tree rather than left at the values chosen when the guard first landed: 19 Nov saw 551 evidence and
  // 369 file:line citations with this ledger in scope and 235 and 212 with docs/validation.md dropped by
  // the size cap, so the old 200/150 floors stayed green through a real 272-and-158 citation loss.
  const evidenceCount = [...text.values()].flat().join('\n').match(/docs\/evidence\//g)?.length ?? 0;
  const lineRefCount = [...text.values()].flat().join('\n').match(/[A-Za-z0-9_./-]+\.(?:js|mjs|cjs):\d+/g)?.length ?? 0;
  assert.ok(evidenceCount >= 450, `only ${evidenceCount} evidence citations were visible to the scan`);
  assert.ok(lineRefCount >= 320, `only ${lineRefCount} file:line citations were visible to the scan`);
});

test('the size cap drops only the named generated or vendored files, never handwritten prose', async () => {
  const scanned = new Set(await proseFiles());
  const dropped = (await proseFiles('', [], Infinity)).filter(file => !scanned.has(file)).sort();
  const unsighted = dropped.filter(file => !GENERATED.has(file));
  const stale = [...GENERATED].filter(file => !dropped.includes(file));
  assert.ok(unsighted.length === 0, `files the cap dropped with no review: ${unsighted.join(', ')}`);
  assert.ok(stale.length === 0, `GENERATED lists files the cap no longer drops: ${stale.join(', ')}`);
});

// A markdown deep link carries the same coordinate twice: the label a reader reads (`path/file.js:235-241`) and the
// `#LNNN` anchor a click lands on. Iteration 61's citation repair rewrote three labels in docs/validation.md and left
// their anchors on the pre-fix numbers, so the prose named the right line and the click jumped thirteen lines away.
// Nothing else could see it: LINE_REF only reads labels, and the pins check code content, not URLs. This case reads both.
// The pattern used to require a `file:///` target, which iteration 67 found was a second defect of its own: the three
// absolute Windows paths this guard had been certifying were the unreadable ones F10 removed, and replacing them with
// repo-relative targets starved the scan to zero labelled links, tripping the floor below. Any markdown link target
// ending in a `#LNNN` fragment now counts, so the guard follows the ledger instead of one URL scheme. The class still
// excludes brackets and parentheses: the first draft allowed them, which made the match open on the `(` of
// `([label](target))` instead of the one before the target, so the label lookup found nothing and the scan reported
// zero links on a ledger that had three.
const ANCHORED = /\(([^()\s[\]]*?)#L(\d+)(?:-\d+)?\)/g;

test('a deep link anchor jumps to the line its own label names', async () => {
  const { text } = await scannedTree();
  const mismatched = [];
  let checked = 0;
  for (const [file, lines] of text) lines.forEach((line, index) => {
    if (line.length > 2000) return;
    for (const anchorMatch of line.matchAll(ANCHORED)) {
      const base = anchorMatch[1].split('/').pop();
      const labelStart = line.lastIndexOf('[', anchorMatch.index);
      if (labelStart < 0) continue; // an anchor with no link text before it is not a labelled pointer
      const labelBands = [...line.slice(labelStart + 1, anchorMatch.index)
        .matchAll(new RegExp(`[\\w./-]*${base.replace(/\./g, '\\.')}:(\\d+)(?:-(\\d+))?`, 'g'))]
        .map(match => [Number(match[1]), Number(match[2] ?? match[1])]);
      if (labelBands.length === 0) continue;
      checked++;
      const at = Number(anchorMatch[2]);
      // A link to a band may legitimately anchor on any line inside it; anything outside is a stale anchor.
      if (!labelBands.some(([from, to]) => at >= from && at <= to)) {
        mismatched.push(`${file}:${index + 1} labels ${labelBands.map(([f, t]) => `${base}:${f}${t > f ? `-${t}` : ''}`).join(', ')} ` +
          `but its anchor lands on line ${at}`);
      }
    }
  });
  // The floor is the point, not an afterthought: three links is all the prose had on 20 Nov, and a scan that saw none
  // of them would otherwise report the same clean list as a scan that saw all three.
  assert.ok(checked >= 3, `the anchor scan saw ${checked} labelled deep links; the ledger has had at least three since iteration 51`);
  assert.ok(mismatched.length === 0, `deep links whose click disagrees with their prose:\n${mismatched.join('\n')}`);
});
