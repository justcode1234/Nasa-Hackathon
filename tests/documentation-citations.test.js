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
const EVIDENCE = /docs\/evidence\/[A-Za-z0-9._*-]+\.log\.gz/g;
const LINE_REF = /([A-Za-z0-9_.\-/]{1,120}\.(?:js|mjs|cjs|css|py|sh)):(\d+)(?:-(\d+))?/g;

async function proseFiles(dir = '', collected = []) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) await proseFiles(relative, collected); }
    else if (EXTS.has(path.extname(entry.name)) && (await stat(path.join(ROOT, relative))).size <= 300 * 1024) collected.push(relative);
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
  const evidenceCount = [...text.values()].flat().join('\n').match(/docs\/evidence\//g)?.length ?? 0;
  const lineRefCount = [...text.values()].flat().join('\n').match(/[A-Za-z0-9_./-]+\.(?:js|mjs|cjs):\d+/g)?.length ?? 0;
  assert.ok(evidenceCount >= 200, `only ${evidenceCount} evidence citations were visible to the scan`);
  assert.ok(lineRefCount >= 150, `only ${lineRefCount} file:line citations were visible to the scan`);
});
