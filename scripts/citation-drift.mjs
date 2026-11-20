// Citation drift check, first run in iteration 58. `tests/documentation-citations.test.js` only asks whether a cited
// line exists and is not blank, so an insertion above a target keeps every guard green while the pointer silently
// names a neighbouring statement: this iteration's own fix inserted 5, 10 and 7 lines into three shipped files and
// moved 26 cited lines over 15 prose sites without a single red case. This tool measures that directly.
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

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = ['docs/validation.md', 'docs/handoff-2026-11-18.md', 'AGENTS.md', 'docs/evidence-index.md',
  'docs/qa-regression.md', 'docs/development.md'];
const SOURCES = /^(public|server|tests)\//;
const useHead = process.argv.includes('--head');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const readAt = (file, rev) => (rev ? git(['show', `${rev}:${file}`]) : readFileSync(path.join(ROOT, file), 'utf8')).split('\n');

// Modified tracked files under the source tree, each with its hunk ranges in NEW coordinates and the shift the diff
// applies to lines below each hunk.
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

const HUNKS = edits();
let checked = 0;
let drifted = 0;
let inHunks = 0;

for (const [file, hunks] of HUNKS) {
  const head = readAt(file, 'HEAD');
  const tree = readAt(file, null);
  // new line -> HEAD line: subtract the deltas of every hunk that sits entirely above it.
  const resolve = n => {
    if (hunks.some(h => n >= h.newStart && n <= h.newEnd)) return null;
    return n - hunks.filter(h => h.newEnd < n).reduce((sum, h) => sum + h.delta, 0);
  };
  for (const doc of DOCS) {
    readAt(doc, useHead ? 'HEAD' : null).forEach((line, index) => {
      let last = null;
      // A citation may name the file once and continue with bare `:NNN`; the citations guard resolves those the same
      // way, so the scan keeps the last full path it saw on the line.
      for (const match of line.matchAll(/((?:public|server|tests)\/[A-Za-z0-9_./-]+\.js)|:([0-9]+)(?:-([0-9]+))?/g)) {
        if (match[1]) { last = match[1]; continue; }
        if (last !== file) continue;
        for (let n = Number(match[2]); n <= Number(match[3] ?? match[2]); n += 1) {
          // In `--head` the cited number is a pre-edit line, so the only question is whether that same line still
          // holds the same statement once the working tree is read; mapping it through the diff would undo the very
          // shift being measured. Without `--head` the cited number is a current line and has to be walked back to
          // the HEAD line it corresponds to.
          const old = useHead ? n : resolve(n);
          if (old === null) { inHunks += 1; continue; }
          checked += 1;
          const nowLine = tree[n - 1]?.trim();
          const wasLine = head[old - 1]?.trim();
          if (nowLine === wasLine) continue;
          drifted += 1;
          console.log(`DRIFT ${doc}:${index + 1} ${file}:${n} reads ${JSON.stringify(nowLine?.slice(0, 78) ?? '<none>')}`
            + ` but HEAD:${old} read ${JSON.stringify(wasLine?.slice(0, 78) ?? '<none>')}`);
        }
      }
    });
  }
}

console.log(`FILES_WITH_EDITS ${[...HUNKS.keys()].join(' ')}`);
console.log(`${useHead ? 'HEAD' : 'TREE'} CITED_LINES_CHECKED ${checked} DRIFTED ${drifted} INSIDE_DIFF_HUNKS ${inHunks}`);
