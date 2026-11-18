import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

// A device with only this repository learns the verification probes from the docs, because there is
// no CI. On 18 Nov the four browser/place probes were reachable only by typing `node scripts/….mjs`
// with their environment variables, nothing listed them in package.json, and no check compared the
// commands the docs tell a person to run against the scripts that actually exist. Both sides are now
// recorded, and these checks fail if either drifts: a documented command nobody can run is a
// confusing first hour on another machine, and a script no doc names is a check nobody re-runs.
const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['evidence', 'history', 'node_modules', '.git', 'dist', 'artifacts']);

async function markdownFiles(dir, collected = []) {
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) await markdownFiles(relative, collected); }
    else if (entry.name.endsWith('.md')) collected.push(relative);
  }
  return collected;
}
function fencedLines(markdown) {
  // A shell comment inside a block is prose, not something a device can run: validation.md quotes
  // the archived harness's own error ("# ERR_MODULE_NOT_FOUND: … notebooks/server/index.js"), and
  // that path must exist in the *error*, not in the repository. Commands stay on their own lines.
  return [...markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].flatMap(block => block[1].split('\n'))
    .filter(line => !/^\s*#/.test(line));
}
const DOCUMENTED_FILE = /(?:scripts|tests|server|notebooks)\/[A-Za-z0-9_./-]+\.(?:m?js|js|py|ipynb)/g;
// npm's own verbs and the lifecycle hooks a person never types are not project scripts.
const NPM_VERBS = new Set(['ci', 'install', 'i', 'audit', 'ls', 'exec', 'doctor', 'login', 'logout', 'config', 'update', 'view', 'why', 'fund']);

test('every documented command is a real npm script', async () => {
  const scripts = new Set(Object.keys(JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')).scripts));
  const files = ['AGENTS.md', 'README.md', ...(await markdownFiles('docs'))];
  const unknown = [], seen = [];
  for (const file of files) {
    for (const line of fencedLines(await readFile(path.join(ROOT, file), 'utf8'))) {
      const match = line.match(/\bnpm (?:--\S+ )*?(?:run )?([a-z][a-z0-9_:.-]*)/);
      if (!match) continue;
      seen.push(`${file}: ${match[1]}`);
      if (!NPM_VERBS.has(match[1]) && !scripts.has(match[1])) unknown.push(`${file} | ${line.trim()}`);
    }
  }
  // A scanner that matches nothing would pass silently, so the bound is the measured count rounded down.
  assert.ok(seen.length >= 30, `expected the scan to find documented commands, found ${seen.length}`);
  assert.deepEqual(unknown, [], `these documented npm commands do not exist:\n${unknown.join('\n')}`);
});

test('every documented verification file exists', async () => {
  const files = ['AGENTS.md', 'README.md', ...(await markdownFiles('docs'))];
  const missing = [], seen = [];
  for (const file of files) {
    for (const line of fencedLines(await readFile(path.join(ROOT, file), 'utf8'))) {
      for (const match of line.matchAll(DOCUMENTED_FILE)) {
        seen.push(match[0]);
        try { await readFile(path.join(ROOT, match[0]), 'utf8'); } catch { missing.push(`${file} -> ${match[0]}`); }
      }
    }
  }
  assert.ok(seen.length >= 5, `expected the scan to find documented files, found ${seen.length}`);
  assert.deepEqual(missing, [], `these documented files do not exist:\n${missing.join('\n')}`);
});

test('every run-by-hand npm script is discoverable in the docs', async () => {
  const scripts = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  const docs = [];
  for (const file of ['AGENTS.md', 'README.md', ...(await markdownFiles('docs'))]) docs.push(await readFile(path.join(ROOT, file), 'utf8'));
  const joined = docs.join('\n');
  // pre* hooks run automatically before start/showcase, so nobody can be told to type them.
  const hidden = Object.keys(scripts).filter(name => !name.startsWith('pre') && !joined.includes(name));
  assert.deepEqual(hidden, [], `these npm scripts exist but no current doc names them:\n${hidden.join('\n')}`);
});

test('a quoted error message is not a documented file, a command line still is', () => {
  const sample = [
    '```sh',
    `node --input-type=module -e "import('./notebooks/legacy-workers/benchmark-candidate.js')"`,
    `# ERR_MODULE_NOT_FOUND: Cannot find module '…/notebooks/server/index.js' (specifier ../server/index.js)`,
    'node scripts/check-documentation.js',
    '```'
  ].join('\n');
  const lines = fencedLines(sample).map(line => line.trim()).filter(Boolean);
  assert.deepEqual(lines, [
    `node --input-type=module -e "import('./notebooks/legacy-workers/benchmark-candidate.js')"`,
    'node scripts/check-documentation.js'
  ], 'a comment inside a block is not a command, and the commands around it are still scanned');
  const scanned = lines.flatMap(line => [...line.matchAll(DOCUMENTED_FILE)].map(match => match[0]));
  assert.deepEqual(scanned, ['notebooks/legacy-workers/benchmark-candidate.js', 'scripts/check-documentation.js']);
});

test('every archived evidence file a doc points at exists', async () => {
  const files = ['AGENTS.md', 'README.md', ...(await markdownFiles('docs'))];
  const missing = [], seen = new Set();
  for (const file of files) {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    for (const match of text.matchAll(/docs\/evidence\/[A-Za-z0-9_.\-*]+/g)) {
      const target = match[0].replace(/\.+$/, '');
      // An angle bracket marks the shape of a new file name, and a trailing star is a glob;
      // neither is a citation a device is supposed to open.
      if (target.includes('<') || target.includes('*')) continue;
      seen.add(`${file} -> ${target}`);
      try { await stat(path.join(ROOT, target)); } catch { missing.push(`${file} -> ${target}`); }
    }
  }
  assert.ok(seen.size >= 20, `expected the scan to find cited evidence files, found ${seen.size}`);
  assert.deepEqual(missing, [], `these cited evidence files are not in the repository:\n${missing.join('\n')}`);
});
