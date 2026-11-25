// Iteration 74, F17 premise measurement. The earlier probe for this used a regex over the guard source and silently
// matched 91 of 248 rows, so every number it printed described the regex rather than the table. This one extracts the
// `const TALLIES = [ ... ]` literal with a lexer that skips line comments, block comments and all three string
// delimiters, then evaluates that literal with the same JavaScript the guard itself parses - so PARSED_ROWS must come
// back equal to the shipped floor (248) before any other line here means anything.
//
// What it answers: how many rows state a negative (`absent`) or nothing positive at all. A row with no `lines` and no
// `phrases` cannot fail for the reason its prose claims, because the archive only has to *not* contain a string.
// Usage: node scripts/tally-shape.mjs [path-to-guard]
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const file = process.argv[2] ?? 'tests/documentation-evidence-index.test.js';
const src = readFileSync(path.resolve(ROOT, file), 'utf8');
const head = src.indexOf('const TALLIES');
if (head < 0) throw new Error(`no const TALLIES in ${file}`);
const open = src.indexOf('[', head);

let i = open, depth = 0, str = null, esc = false;
for (; i < src.length; i++) {
  const c = src[i], n = src[i + 1];
  if (str) {
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === str) str = null;
    continue;
  }
  if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) throw new Error('comment runs to EOF'); continue; }
  if (c === '/' && n === '*') { i = src.indexOf('*/', i); if (i < 0) throw new Error('block comment runs to EOF'); i++; continue; }
  if (c === '"' || c === "'" || c === '`') { str = c; continue; }
  if (c === '[' || c === '{' || c === '(') depth++;
  else if (c === ']' || c === '}' || c === ')') { depth--; if (depth === 0) break; }
}
if (depth !== 0) throw new Error('the TALLIES literal never closed');
const literal = src.slice(open, i + 1);
// The literal is data the repository already ships, and the guard parses the same text at import time; evaluating it
// here reproduces that rather than approximating it. It contains object/array/string/number literals only.
const rows = new Function(`return (${literal});`)();

const positive = r => (r.lines?.length ?? 0) + (r.phrases?.length ?? 0);
const noPositive = rows.filter(r => positive(r) === 0);
const noNegative = rows.filter(r => !(r.absent?.length ?? 0));
const marks = rows.filter(r => (r.marks ?? 0) > 0);
const seen = new Map();
for (const r of rows) seen.set(r.archive, (seen.get(r.archive) ?? 0) + 1);
const dups = [...seen].filter(([, n]) => n > 1);
const keys = new Set(rows.flatMap(r => Object.keys(r)));

const floor = Number(src.match(/assert\.ok\(TALLIES\.length >= (\d+)/)?.[1] ?? 0);
console.log(`SHAPE source=${file} literal_bytes=${literal.length}`);
console.log(`SHAPE PARSED_ROWS=${rows.length} (the guard floor asserts >= ${floor}; anything else and this file is reading the wrong thing)`);
console.log(`SHAPE ROWS_WITHOUT_POSITIVE_NEEDLE=${noPositive.length}`);
for (const r of noPositive.slice(0, 30)) console.log(`  NOPOS ${r.archive} keys=[${Object.keys(r).join(',')}] marks=${r.marks ?? 'unset'} partial=${r.partial ?? false}`);
if (noPositive.length > 30) console.log(`  NOPOS ... ${noPositive.length - 30} more`);
console.log(`SHAPE ROWS_WITHOUT_ABSENT_NEEDLE=${noNegative.length}`);
// A row can carry a positive needle and still accept a different run: "ℹ tests 337" and "348 passed (26.4m)" are printed
// by every pass whose case count happens to match. Rows made only of those are counted here, because that is the set a
// swapped-in archive could satisfy; the empirical half of the question (which archive satisfies which row) is what the
// row/archive matrix measures, not this file.
const GENERIC = [/^ℹ (tests|pass|fail|cancelled|skipped|todo|suites|duration_ms?) [\d.]+ ?m?s?$/, /^\d+ (passed|failed|flaky|did not run)( \(.*\))?$/,
  /^Running \d+ tests( using \d+ workers?)?$/, /^# (tests|pass|fail|cancelled|skipped) \d+$/, /^\d+ (\d+ )?tests? in \d+ files?$/];
const genericOnly = rows.filter(r => {
  const pos = [...(r.lines ?? []), ...(r.phrases ?? [])];
  return pos.length > 0 && pos.every(n => GENERIC.some(re => re.test(n.trim())));
});
console.log(`SHAPE ROWS_WITH_ONLY_COUNT_SHAPED_POSITIVES=${genericOnly.length}`);
for (const r of genericOnly.slice(0, 25)) console.log(`  GENERIC ${r.archive} [${[...(r.lines ?? []), ...(r.phrases ?? [])].join(' | ')}]`);
if (genericOnly.length > 25) console.log(`  GENERIC ... ${genericOnly.length - 25} more`);
console.log(`SHAPE ROWS_WITH_MARKS=${marks.length} ROWS_PARTIAL=${rows.filter(r => r.partial).length}`);
console.log(`SHAPE DUPLICATE_ARCHIVE_KEYS=${dups.length}`);
for (const [a, n] of dups.slice(0, 10)) console.log(`  DUP ${a} x${n}`);
console.log(`SHAPE KEYS_SEEN=[${[...keys].sort().join(',')}]`);
