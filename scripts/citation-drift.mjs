// Citation drift check, first run in iteration 58. `tests/documentation-citations.test.js` only asks whether a cited
// line exists and is not blank, so an insertion above a target keeps every guard green while the pointer silently
// names a neighbouring statement. This tool measures that directly.
//
// For each modified tracked file it takes the shift `git diff -U0` reports and, for every line the docs cite that
// sits OUTSIDE a diff hunk, compares the bytes now at that line with the bytes at the pre-edit line number in HEAD.
// Lines inside a hunk are counted separately, because there the edit was intentional and only the prose can say
// whether it still describes the code.
//
// `node scripts/citation-drift.mjs --head` reads the citations as they were committed, which is the pre-repair state
// and must report drift; without `--head` it reads the working tree, where 0 means every pointer still lands on the
// statement the ledger quotes. Text search cannot substitute: `actions.showStep('location');` occurs twice a few
// lines apart, so searching for a drifted line's text finds the wrong one. Comparison is on trimmed lines because a
// restructure re-indents statements without moving them.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = ['docs/validation.md', 'docs/handoff-2026-11-18.md', 'AGENTS.md', 'docs/evidence-index.md',
  'docs/qa-regression.md', 'docs/development.md'];
const SOURCES = /^(public|server|tests)\//;
const CLOCK = /\b\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const URL = /https?:\/\/\S+/g;
const TRIPLE = /((?:public|server|tests)\/[A-Za-z0-9_./-]+\.js):\d+(?:-\d+)?:\d+/g;
const BARE_FILE = /(?<![A-Za-z0-9_./-])(?:[A-Za-z0-9_-]+\.js):\d+(?:-\d+)?/g;

export function citationsFromLine(line) {
  const cleaned = line.replace(URL, ' ').replace(CLOCK, ' ').replace(TRIPLE, '$1').replace(BARE_FILE, ' ');
  const found = [];
  for (const sentence of cleaned.split(/(?<=[.!?])\s+/)) {
    let last = null, lastIndex = -1;
    for (const match of sentence.matchAll(/((?:public|server|tests)\/[A-Za-z0-9_./-]+\.js)|:([0-9]+)(?:-([0-9]+))?(?![\d:])/g)) {
      if (match[1]) { last = match[1]; lastIndex = match.index; continue; }
      if (!last || match.index - lastIndex > 120) continue;
      found.push({ file: last, from: Number(match[2]), to: Number(match[3] ?? match[2]) });
      lastIndex = match.index;
    }
  }
  return found;
}

export function comparePair(now, was) {
  const nowText = now?.trim() ?? '';
  const wasText = was?.trim() ?? '';
  if (!nowText || !wasText) return { kind: 'unreadable', nowText, wasText };
  return nowText === wasText ? { kind: 'same', nowText, wasText } : { kind: 'drift', nowText, wasText };
}

function main() {
  const useHead = process.argv.includes('--head');
  const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const readAt = (file, rev) => (rev ? git(['show', `${rev}:${file}`]) : readFileSync(path.join(ROOT, file), 'utf8')).split('\n');

  function edits() {
    const status = git(['diff', '-U0', '--name-only']).split('\n').filter(Boolean).filter(file => SOURCES.test(file));
    const out = new Map();
    for (const file of status) {
      const hunks = [];
      for (const line of git(['diff', '-U0', '--', file]).split('\n')) {
        const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) continue;
        const oldCount = match[2] === undefined ? 1 : Number(match[2]);
        const newCount = match[4] === undefined ? 1 : Number(match[4]);
        hunks.push({ newStart: Number(match[3]), newEnd: Number(match[3]) + newCount - 1, delta: newCount - oldCount });
      }
      if (hunks.length) out.set(file, hunks);
    }
    return out;
  }

  const hunks = edits();
  let checked = 0, drifted = 0, inHunks = 0, unreadable = 0;
  for (const [file, fileHunks] of hunks) {
    const head = readAt(file, 'HEAD');
    const tree = readAt(file, null);
    const resolve = n => {
      if (fileHunks.some(h => n >= h.newStart && n <= h.newEnd)) return null;
      return n - fileHunks.filter(h => h.newEnd < n).reduce((sum, h) => sum + h.delta, 0);
    };
    for (const doc of DOCS) {
      readAt(doc, useHead ? 'HEAD' : null).forEach((line, index) => {
        for (const citation of citationsFromLine(line)) {
          if (citation.file !== file) continue;
          for (let n = citation.from; n <= citation.to; n += 1) {
            const old = useHead ? n : resolve(n);
            if (old === null) { inHunks += 1; continue; }
            checked += 1;
            const result = comparePair(tree[n - 1], head[old - 1]);
            if (result.kind === 'same') continue;
            if (result.kind === 'unreadable') {
              unreadable += 1;
              console.log(`UNREADABLE ${doc}:${index + 1} ${file}:${n} tree=${JSON.stringify(result.nowText || '<missing>')} HEAD:${old}=${JSON.stringify(result.wasText || '<missing>')}`);
            } else {
              drifted += 1;
              console.log(`DRIFT ${doc}:${index + 1} ${file}:${n} reads ${JSON.stringify(result.nowText.slice(0, 78))}`
                + ` but HEAD:${old} read ${JSON.stringify(result.wasText.slice(0, 78))}`);
            }
          }
        }
      });
    }
  }
  console.log(`FILES_WITH_EDITS ${[...hunks.keys()].join(' ')}`);
  console.log(`${useHead ? 'HEAD' : 'TREE'} CITED_LINES_CHECKED ${checked} DRIFTED ${drifted} UNREADABLE ${unreadable} INSIDE_DIFF_HUNKS ${inHunks}`);
  if (unreadable > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
