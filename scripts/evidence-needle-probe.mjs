// Measures candidate evidence needles as whole lines and substrings across the shipped gzip logs.
// Usage: node scripts/evidence-needle-probe.mjs [--prefix=iter74] "<needle>" [...]
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const prefix = process.argv.find((arg) => arg.startsWith('--prefix='))?.slice(9) ?? '';
const candidates = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!candidates.length) {
  console.error('PROBE_USAGE node scripts/evidence-needle-probe.mjs [--prefix=iter74] "<needle>" [...]');
  process.exit(2);
}
const files = readdirSync(path.join(ROOT, 'docs/evidence'), { recursive: true })
  .filter((file) => file.endsWith('.log.gz') && (!prefix || file.includes(prefix)));
const bodies = new Map(files.map((file) => [file, gunzipSync(readFileSync(path.join(ROOT, 'docs/evidence', file))).toString('utf8')]));
for (const needle of candidates) {
  const lines = [], subs = [];
  for (const [name, body] of bodies) {
    if (body.split('\n').some((line) => line.trim() === needle)) lines.push(name);
    if (body.includes(needle)) subs.push(name);
  }
  console.log(`LINE=${lines.length}/${bodies.size} SUB=${subs.length}/${bodies.size} ${JSON.stringify(needle)}`);
  console.log(`   line-archives: ${lines.join(',') || '-'}   sub-archives: ${subs.join(',') || '-'}`);
}
