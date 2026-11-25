// The sibling of the deep-link census, read-only. F14 was about `[label](file#LNNN)`, and the layer that closed it
// grades a label against the bytes of the band. Most of this ledger's pointers are not clickable: they are prose like
// "the guard at public/js/modules/chat.js:100 refuses to render a stale answer", where the number is followed by a
// colon and the reader's browser jumps nowhere. Those are certified in two places only - the pin table, which covers
// the 191 statements iteration 58 chose to quote, and scripts/citation-drift.mjs, which asks whether a cited line
// MOVED since HEAD, never whether it names what the sentence says. Neither asks the question this survey measures.
//
// For every `path.ext:NNN` citation in tracked markdown whose line also carries an identifier-shaped token, this reads
// the cited line and asks whether any identifier from the prose appears on it (exact), within a window either side
// (near), or nowhere in the file at all. It states no verdict: a citation that misses the exact line can still be
// right about a two-line condition whose subject sits one line above, which is why both numbers are printed. What it
// does establish is the denominator, so that the next pass opens a finding as "N of M pointers" rather than the two
// anecdotes that started this.
//
// Usage: node scripts/citation-band.mjs [--window=N] [--list] [--misses] [--spans]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const WINDOW = Number((process.argv.find((a) => a.startsWith('--window=')) ?? '--window=3').split('=')[1]);
const DOCS = execFileSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

// `chat.js:100`, `public/js/modules/chat.js:96-99`, `tests/x.test.js:1435`. Not the #L form (the deep-link guard owns
// those) and not a `.log.gz` row (an evidence pointer names a line of a log, which no source reader can grade).
const CITE = /(?<![\w/])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:js|mjs|cjs|css|html|json|md)):(\d+)(?:-(\d+))?(?!\d)/g;
const IDENT = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g;
// Words that name nothing in particular: without this list every sentence about "the guard at x.js:10" contributes
// `guard`, `the` and `line` as candidate identifiers and the near-hit count inflates into a green report.
const STOP = new Set(('the and for with that this from are was were not what when where which line lines file files ' +
  'guard guards test tests case cases docs doc code prose cited cites cite point pointer see says said names name ' +
  'iteration passes pass green red true false null undefined new old one two three four every each other both into ' +
  'then than them they there these those have has had would could should must only also such same very more most ' +
  'above below left right both').split(' '));

const fileCache = new Map();
const linesOf = (file) => {
  if (!fileCache.has(file)) {
    try { fileCache.set(file, readFileSync(path.join(ROOT, file), 'utf8').split('\n')); } catch { fileCache.set(file, null); }
  }
  return fileCache.get(file);
};

// Most of this ledger cites a basename - "chat.js:100" - and resolving that against the citing document finds nothing,
// which the first draft of this survey reported as 928 unreadable targets out of 1190 citations: the same vacuous
// instrument iteration 67 recorded as F15, in a new costume. So a basename is resolved through the tracked file list,
// and only a name that matches nothing or matches ambiguously counts as unreadable. A citation that resolves two ways
// is reported separately rather than guessed at, because the survey exists to size a population, not to flatter it.
const TRACKED = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const byBasename = new Map();
for (const f of TRACKED) byBasename.set(path.basename(f), [...(byBasename.get(path.basename(f)) ?? []), f]);

const resolveCite = (doc, raw) => {
  const direct = path.relative(ROOT, path.resolve(ROOT, path.dirname(doc), raw)).split(path.sep).join('/');
  if (linesOf(direct)) return { file: direct, via: 'doc-relative' };
  const named = byBasename.get(path.basename(raw));
  if (!named || named.length === 0) return { file: direct, via: 'absent' };
  if (named.length > 1) return { file: named.join(','), via: `ambiguous(${named.length})` };
  return { file: named[0], via: 'basename' };
};

const rows = [];
for (const doc of DOCS) {
  const text = readFileSync(path.join(ROOT, doc), 'utf8');
  text.split('\n').forEach((line, index) => {
    if (line.length > 2000) return;
    for (const m of line.matchAll(CITE)) {
      if (line.slice(Math.max(0, m.index - 3), m.index) === '](#' || m[0].includes('#L')) continue;
      const { file: resolved, via } = resolveCite(doc, m[1]);
      const target = linesOf(resolved);
      const from = Number(m[2]);
      const to = Number(m[3] ?? m[2]);
      // Identifiers in the prose, taken from the whole sentence: a citation at the end of a clause still describes the
      // subject at its start. The citation text itself is removed first, because a path contributes `modules`, `chat`
      // and `test` as candidate identifiers and every pointer then looks self-certifying.
      const proseOnly = line.replace(CITE, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[A-Za-z0-9_.-]+\//g, ' ');
      const identifiers = [...new Set((proseOnly.replace(/`/g, '').match(IDENT) ?? [])
        .filter((w) => !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w)))];
      let exact = false, near = false, absent = 0;
      let citedText = null;
      if (target) {
        citedText = (target[from - 1] ?? '').trim();
        const windowLines = target.slice(Math.max(0, from - 1 - WINDOW), to + WINDOW).join('\n');
        const inWindow = identifiers.filter((w) => windowLines.includes(w));
        near = inWindow.length > 0;
        exact = identifiers.some((w) => citedText.includes(w));
        absent = identifiers.filter((w) => !target.join('\n').includes(w)).length;
      }
      rows.push({ doc, at: index + 1, file: resolved, via, from, to, missing: !target, blank: target ? citedText === '' : null,
        outOfRange: target ? from > target.length : null, identifiers: identifiers.length, exact, near, absent,
        citedText, prose: line.trim(), rawLine: line, citeAt: m.index, targetLines: target });
    }
  });
}

const n = (p) => rows.filter(p).length;
const readable = rows.filter((r) => !r.missing);
const viaCounts = [...new Set(rows.map((r) => r.via))].map((v) => `${v}=${n((r) => r.via === v)}`);
console.log(`CITATION_BAND window=${WINDOW} docs=${DOCS.length} citations=${rows.length}`);
console.log(`RESOLVED_VIA ${viaCounts.join(' ')}`);
console.log(`UNREADABLE_TARGET ${n((r) => r.missing)} CITED_LINE_PAST_EOF ${n((r) => r.outOfRange === true)} BLANK_CITED_LINE ${n((r) => r.blank === true)}`);
console.log(`NO_IDENTIFIER_ON_LINE ${n((r) => r.identifiers === 0)}`);
console.log(`IDENTIFIER_ON_CITED_LINE ${n((r) => r.exact)} identifier_within_${WINDOW}_lines_only ${n((r) => !r.exact && r.near)} identifier_nowhere_in_window ${n((r) => r.identifiers > 0 && !r.near && !r.missing)}`);
console.log(`PER_DOC ${DOCS.map((d) => [d, n((r) => r.doc === d)]).filter(([, c]) => c).map(([d, c]) => `${d}=${c}`).join(' ')}`);
if (process.argv.includes('--misses') || process.argv.includes('--list')) {
  const hard = readable.filter((r) => !r.near);
  console.log(`MISS_LINES ${hard.length}`);
  for (const r of hard.slice(0, process.argv.includes('--list') ? hard.length : 40)) {
    console.log(`${r.doc}:${r.at} -> ${r.file}:${r.from}${r.to !== r.from ? `-${r.to}` : ''} :: cited="${(r.citedText ?? '').slice(0, 70)}" :: prose="${r.prose.slice(0, 110)}"`);
  }
}

// The tight population: a code span sitting next to the number. 440 of 1190 citations fail the loose sentence test
// above, and reading that list is the reason it stays a measurement and not a rule - a sentence may cite a line while
// naming it in ordinary English ("with a warning not to re-point it at the live server"), and no identifier heuristic
// separates those from a pointer that genuinely moved. Where the writer puts a symbol in backticks beside the
// coordinate they have said which token the line must carry, and the bytes either do or do not.
//
// A span that is itself a citation, a path, or a shell command is not a symbol, so it is skipped; and where a line
// carries two citations and several spans, each citation is graded against its NEAREST span, because
// "`public/js/lib/api.js:9` and `:25`" is about the code at public/js/lib/api.js:9 rather than whatever else the sentence names.
const SPAN = /`([^`\n]+)`/g;
// Only a span that could be pasted into the source as a name is graded. The first draft accepted any span without a
// `/`, so `dom.js:16-17` - itself a citation - became the "symbol" a line had to carry, and 64 rows reported a name
// that exists nowhere while every one of them was the survey's own filter. A colon, a slash, or a dotted tail that is
// a file extension disqualifies a span; so does anything that is not a bare name or a member chain.
const SYMBOL = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*(?:\(\))?$/;
const EXT = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'md', 'json', 'css', 'html', 'gz', 'log', 'txt', 'yaml', 'yml', 'sh', 'py']);
const spanRows = [];
for (const r of rows) {
  if (!r.targetLines) continue;
  let best = null;
  for (const s of r.rawLine.matchAll(SPAN)) {
    const inner = s[1].trim();
    if (/[:/\s]/.test(inner) || !SYMBOL.test(inner)) continue;
    if (/^[0-9a-f]{7,40}$/.test(inner)) continue; // a commit SHA is a coordinate too, not a symbol the line must carry
    if (EXT.has(inner.split('.').at(-1)) || inner.split('.').length === 2 && EXT.has(inner.split('.')[0])) continue;
    const identifiers = [...new Set((inner.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) ?? []).filter((w) => !STOP.has(w.toLowerCase())))];
    if (identifiers.length === 0) continue;
    const distance = Math.abs(s.index - r.citeAt);
    if (!best || distance < best.distance) best = { inner, identifiers, distance };
  }
  if (!best) continue;
  const whole = r.targetLines.join('\n');
  const windowLines = r.targetLines.slice(Math.max(0, r.from - 1 - WINDOW), r.to + WINDOW).join('\n');
  spanRows.push({ ...r, span: best.inner, identifiers: best.identifiers,
    exact: best.identifiers.some((w) => (r.citedText ?? '').includes(w)),
    window: best.identifiers.some((w) => windowLines.includes(w)),
    inFile: best.identifiers.some((w) => whole.includes(w)) });
}
const s = (p) => spanRows.filter(p).length;
console.log(`SPAN_PAIRED ${spanRows.length} of ${readable.length} readable citations`);
console.log(`SPAN_SYMBOL_ON_CITED_LINE ${s((r) => r.exact)} within_${WINDOW}_lines ${s((r) => !r.exact && r.window)} elsewhere_in_file ${s((r) => !r.window && r.inFile)} nowhere_in_file ${s((r) => !r.inFile)}`);
if (process.argv.includes('--spans')) {
  for (const r of spanRows.filter((x) => !x.window)) {
    console.log(`SPAN ${r.doc}:${r.at} \`${r.span.slice(0, 40)}\` -> ${r.file}:${r.from}${r.to !== r.from ? `-${r.to}` : ''} in_file=${r.inFile} :: cited="${(r.citedText ?? '').slice(0, 60)}" :: prose="${r.prose.slice(0, 130)}"`);
  }
}
