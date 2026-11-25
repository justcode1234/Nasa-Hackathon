// One exact-string mutation, applied only where it matches once. The control ladder grades a guard by editing a file,
// and a mutation whose anchor is absent - because a repair reworded the line last week - changes nothing and the leg
// then reports a red that the mutation did not cause. Counting the occurrences turns that into a refusal.
// Usage: node scripts/exact-mutate.mjs <file> <count-expected> <old> <new>
import { readFileSync, writeFileSync } from 'node:fs';

const [file, want, oldText, newText] = process.argv.slice(2);
if (!file || want === undefined || oldText === undefined || newText === undefined) {
  console.error('MUTATE_USAGE node scripts/exact-mutate.mjs <file> <count> <old> <new>');
  process.exit(2);
}
const bytes = readFileSync(file, 'utf8');
const found = bytes.split(oldText).length - 1;
if (found !== Number(want)) {
  console.error(`MUTATE_ANCHOR ${file}: ${JSON.stringify(oldText.slice(0, 80))} occurs ${found} time(s), the control expected ${want}. ` +
    'Refusing to mutate, because a leg that changes nothing cannot prove anything.');
  process.exit(3);
}
// split/join rather than replace(): a replacement string goes through `$&`/`$'` expansion, and an anchor that happens to
// contain one of those sequences would write text nobody asked for.
writeFileSync(file, bytes.split(oldText).join(newText));
console.log(`MUTATE_APPLIED ${file} occurrences=${found}`);
