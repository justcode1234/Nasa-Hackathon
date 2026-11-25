// Lists or extracts the verbatim source sections embedded in a docs/evidence gzip archive.
// Usage: node scripts/evidence-source.mjs <archive.gz> [--list] [--section=NAME] [--out=DIR]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const archive = args.find((arg) => !arg.startsWith('--'));
if (!archive) {
  console.error('SOURCE_USAGE node scripts/evidence-source.mjs <archive.gz> [--list] [--section=NAME] [--out=DIR]');
  process.exit(2);
}
const file = path.resolve(ROOT, archive);
const text = gunzipSync(readFileSync(file)).toString('utf8');
const header = /^=== (.+?) \((.*), verbatim, md5 ([0-9a-f]+)\) ===$/gm;
const matches = [...text.matchAll(header)];
if (!matches.length) {
  if (args.includes('--list')) console.log('NO_EMBEDDED_SECTIONS');
  else process.stdout.write(text);
  process.exit(0);
}
const sections = matches.map((match, index) => {
  const start = match.index + match[0].length + 1;
  const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
  const wrapped = text.slice(start, end);
  const bytes = Buffer.from(wrapped.endsWith('\n') ? wrapped.slice(0, -1) : wrapped, 'utf8');
  const md5 = createHash('md5').update(bytes).digest('hex');
  return { title: match[1], description: match[2], expected: match[3], md5, bytes };
});
if (args.includes('--list')) {
  for (const section of sections) console.log(`${section.title}\t${section.md5}\t${section.md5 === section.expected ? 'OK' : 'MISMATCH'}\t${section.bytes.length}`);
  process.exit(sections.every((section) => section.md5 === section.expected) ? 0 : 1);
}
const wanted = args.find((arg) => arg.startsWith('--section='))?.slice(10);
const selected = wanted ? sections.filter((section) => section.title.includes(wanted)) : sections;
if (!selected.length) {
  console.error(`SOURCE_NO_SECTION ${wanted ?? '<all>'}`);
  process.exit(2);
}
const out = args.find((arg) => arg.startsWith('--out='))?.slice(6);
if (out) {
  const dir = path.resolve(ROOT, out);
  mkdirSync(dir, { recursive: true });
  for (const section of selected) {
    const name = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.txt';
    writeFileSync(path.join(dir, name), section.bytes);
    console.log(`EXTRACTED ${name} ${section.bytes.length} bytes md5=${section.md5}`);
  }
} else {
  for (const section of selected) {
    process.stdout.write(`=== ${section.title} ===\n`);
    process.stdout.write(section.bytes);
    process.stdout.write('\n');
  }
}
process.exit(selected.every((section) => section.md5 === section.expected) ? 0 : 1);
