#!/usr/bin/env node
// Iteration 47 generator. It writes the committed snapshot docs/evidence-index.md: one row per file under
// docs/evidence whose full relative path no other tracked prose file carries, each with the byte size read
// from stat so tests/documentation-evidence-index.test.js can re-verify the row against the filesystem.
// Iteration 47 parked this in artifacts/ (gitignored) on the grounds that the guard, not the generator, is what the
// repository commits to. Iteration 60 supersedes that: the ledger had by then told a reader to run it in four places,
// twelve passes had regenerated the index with it, and a committed generated file nobody else can produce is not a
// measurement a reviewer can check. `--stdout` prints the document without writing it, which is what lets the guard
// compare the committed index against a fresh scan without touching the file it is judging.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['evidence', 'history', 'node_modules', '.git', 'dist', 'artifacts', 'submission',
  'coverage', 'playwright-report', 'test-results']);
const EXTS = new Set(['.js', '.mjs', '.cjs', '.md', '.css', '.py', '.sh', '.txt']);
const LEDGER = /^(docs\/|AGENTS\.md$)/;
const INDEX = 'docs/evidence-index.md';
const cap = 300 * 1024;

async function proseFiles(dir = '', collected = []) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) await proseFiles(relative, collected); }
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

const prose = await proseFiles();
const bodies = new Map();
// The index names its own rows, so it must not count as prose that cites evidence; the landed guard
// excludes it the same way, otherwise a second run would read a tidied-up tree.
for (const file of prose) { if (file === INDEX) continue; bodies.set(file, await readFile(path.join(ROOT, file), 'utf8')); }
const evidence = await evidenceFiles();
const named = new Set();
for (const [file, body] of bodies) for (const relative of evidence) if (body.includes(relative)) named.add(relative);
const orphan = evidence.filter(relative => !named.has(relative) && relative !== INDEX);
const bytes = new Map();
for (const relative of orphan) bytes.set(relative, (await stat(path.join(ROOT, relative))).size);
const total = [...bytes.values()].reduce((sum, size) => sum + size, 0);
const kind = relative => path.extname(relative) === '.png' ? 'screenshot'
  : relative.endsWith('.log.gz') ? 'gzipped command log'
    : relative.endsWith('.mjs.gz') ? 'gzipped probe script'
      : relative.endsWith('.raw.json.gz') ? 'gzipped raw JSON capture'
        : relative.endsWith('.json') ? 'JSON capture'
          : relative.endsWith('.log') ? 'command log' : 'capture';
const groups = new Map();
for (const relative of orphan) {
  const key = kind(relative);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(relative);
}
// Iteration 57: the stamp used to be the literal "19 Nov 2026", the day this generator was written, so every
// regeneration since then dated the index to a run that had not happened. It now reads its own clock, in UTC, and
// says so, because the host clock is UTC+8 and a bare local date would move the file by a day around midnight.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const now = new Date();
const stamp = `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()} UTC`;
let out = `# Evidence the loop never cited\n\n`;
out += `<!-- Generated ${stamp} by an isolated scan of docs/evidence against the tracked prose tree. Scanning\n`;
out += `     and re-checking is the job of tests/documentation-evidence-index.test.js; the sizes below are read from the\n`;
out += `     filesystem by that generator and re-asserted by that test, so a row cannot rot into a lie. -->\n\n`;
out += `${orphan.length} of ${evidence.length} files under \`docs/evidence/\` are named by no other tracked prose file:\n`;
out += `no \`docs/validation.md\` subsection, no AGENTS.md bullet and no handoff sentence says what they are evidence\n`;
out += `for. They are listed here with the byte size each one has in this commit, because that is the only fact about\n`;
out += `them a reader can check without opening them. ${total.toLocaleString('en-US')} bytes total.\n\n`;
for (const [key, list] of groups) {
  out += `\n## ${key} (${list.length} ${list.length === 1 ? 'file' : 'files'})\n\n`;
  for (const relative of list) out += `* \`${relative}\` - ${bytes.get(relative)} bytes\n`;
}
out += `
## What these files are not

None of the files above is cited as the evidence for a claim in this repository. A reader who needs to know
what one of them proves has to open it; a reader who needs to know what a *numbered* claim in
\`docs/validation.md\` rests on never has to come here, because those citations point at the archives the
\`tests/documentation-citations.test.js\` guard already walks in the other direction.
`;
if (process.argv.includes('--stdout')) {
  process.stdout.write(out);
} else {
  await writeFile(path.join(ROOT, 'docs/evidence-index.md'), out);
  console.log(`orphan ${orphan.length} / evidence ${evidence.length} / prose ${prose.length} / bytes ${total}`);
  for (const [key, list] of groups) console.log(`  ${key}: ${list.length}`);
}
const namedCount = named.size;

