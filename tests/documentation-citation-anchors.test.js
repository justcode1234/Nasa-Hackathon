import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// METHOD: a `file:NN` citation is checked for two things and nothing else - the file exists and line NN is not blank
// (tests/documentation-citations.test.js:74-82). Neither survives an edit to the cited file. On 19 Nov the first draft
// of the iteration-50 chat.js fix inserted two lines above the code, which moved all 40 citations that name public/js/
// modules/chat.js two lines off their target: under those bytes `chat.js:99` reads `const extra = contextBlocks(...)`
// instead of the `answer.sources.push(...)` every citation quotes, and `chat.js:108` reads
// `response.append(el('p', block.text))` instead of the `sourceIds` line. All 20 documentation guards stayed green on
// that tree (docs/evidence/iter50-citation-drift-2026-11-19.log.gz), so the drift is silent, and one of the 40 was
// already stale before this iteration: docs/validation.md:1685 cites chat.js:15 for `announce()`, which the comment
// block above it pushed to line 16.
//
// The fix that iteration 50 shipped is line-neutral for exactly this reason, and this guard is what keeps the next
// edit honest about it: pin the statements the ledger quotes to the line numbers it names, so inserting a line above
// them is a red test that says which citation moved rather than a green one that says nothing. The pins cover the
// targets measured 19 Nov as the most-quoted in the repository, not every citation - the floor case keeps a narrowed
// table from passing quietly, and case 3 proves the matching logic actually moves when a line is inserted.
const ROOT = path.resolve(import.meta.dirname, '..');

// Each pin is a statement a ledger citation names, plus the line the citation says it is on. The quoted text comes
// from the citing sentence, so a pass means the reader who follows the number lands on the code being discussed.
const PINS = [
  { file: 'public/js/modules/chat.js', line: 16, quote: 'const announce = message =>', citedBy: 'docs/validation.md:1685' },
  { file: 'public/js/modules/chat.js', line: 96, quote: "await api('/api/ask'", citedBy: 'docs/validation.md:2974 and 8 more' },
  { file: 'public/js/modules/chat.js', line: 99, quote: 'answer.sources.push(...extra.sources)', citedBy: 'tests/chat-context.test.js:409 and 14 more' },
  { file: 'public/js/modules/chat.js', line: 108, quote: 'const sourceIds = [...new Set(', citedBy: 'tests/e2e/chat-pest-context.spec.js:74 and 14 more' },
  { file: 'public/js/lib/dom.js', line: 13, quote: 'export function sourceLinks(ids, sources)', citedBy: 'docs/handoff-2026-11-18.md:207' },
  { file: 'public/js/lib/dom.js', line: 16, quote: 'sources.find(s => s.id === id)', citedBy: 'AGENTS.md:830' },
  { file: 'public/js/lib/dom.js', line: 17, quote: 'if (!source) return;', citedBy: 'public/js/lib/chat-context.js:110' },
];

// The drift shape this guard exists to catch: line 15 is a comment and 16 is the code, so a citation that lands on a
// neighbouring line is wrong even though the guard in documentation-citations.test.js calls it valid.
function mismatches(lines, pins) {
  const wrong = [];
  for (const pin of pins) {
    const at = lines[pin.line - 1];
    if (at === undefined) wrong.push(`${pin.file}:${pin.line} does not exist (file has ${lines.length} lines)`);
    else if (!at.includes(pin.quote)) wrong.push(`${pin.file}:${pin.line} reads ${JSON.stringify(at.trim().slice(0, 64))} but ${pin.citedBy} quotes ${JSON.stringify(pin.quote)}`);
  }
  return wrong;
}

async function linesOf(file) {
  return (await readFile(path.join(ROOT, file), 'utf8')).split('\n');
}

test('every pinned ledger citation lands on the statement the ledger quotes', async () => {
  const byFile = new Map();
  for (const pin of PINS) byFile.set(pin.file, byFile.get(pin.file) ?? await linesOf(pin.file));
  const wrong = [];
  for (const [file, lines] of byFile) wrong.push(...mismatches(lines, PINS.filter(pin => pin.file === file)));
  assert.ok(wrong.length === 0, `citations that no longer name their code:\n${wrong.join('\n')}`);
});

test('the pin table covers the citation targets the loop leans on and cannot be narrowed to pass', () => {
  assert.ok(PINS.length >= 7, `the pin table holds ${PINS.length} entries; it was sized 19 Nov at 7`);
  const pinned = file => PINS.filter(pin => pin.file === file).map(pin => pin.line);
  for (const line of [16, 96, 99, 108]) {
    assert.ok(pinned('public/js/modules/chat.js').includes(line), `chat.js:${line} is one of the four most-cited targets and is no longer pinned`);
  }
  for (const line of [13, 16, 17]) {
    assert.ok(pinned('public/js/lib/dom.js').includes(line), `dom.js:${line} names the renderer every source-count citation depends on and is no longer pinned`);
  }
  for (const pin of PINS) {
    assert.ok(pin.quote.length >= 12, `${pin.file}:${pin.line} is pinned to a ${pin.quote.length}-character fragment, which a rewritten line can satisfy by accident`);
    assert.ok(pin.citedBy.length > 0, `${pin.file}:${pin.line} has no citation to explain it`);
  }
});

test('inserting a line above a pinned statement turns this guard red rather than leaving it green', async () => {
  // The iteration-50 draft, replayed in memory: two comment/const lines above line 13, which is what moved 40
  // citations while every shipped guard stayed green. The guard must notice.
  const original = await linesOf('public/js/modules/chat.js');
  const drifted = [...original.slice(0, 12), '  // inserted explanation', "  const modelFailure = 'x';", ...original.slice(12)];
  const chatPins = PINS.filter(pin => pin.file === 'public/js/modules/chat.js');
  assert.deepEqual(mismatches(original, chatPins), [], 'the shipped tree must satisfy its own pins before the drift is replayed');
  const caught = mismatches(drifted, chatPins);
  assert.ok(caught.length === chatPins.length, `the drift left ${chatPins.length - caught.length} of ${chatPins.length} pins passing, so a line inserted above them would not be reported`);
  assert.ok(drifted.length === original.length + 2, 'the replay must be the two-line insertion this guard was written for');
});
