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
  { file: 'public/js/lib/dom.js', line: 17, quote: 'if (!source) return;', citedBy: 'public/js/lib/chat-context.js:114' },
  // The six iteration-51 pins: this is the first subsection whose prose quotes the lines it edits, so an insertion
  // above any of them would leave the ledger naming code that is no longer there while every other guard stayed green.
  { file: 'server/index.js', line: 70, quote: 'if (status >= 500) console.error(error);', citedBy: 'docs/validation.md subsection 51, The fix' },
  { file: 'server/index.js', line: 71, quote: "message: status === 500 ? 'The server could not complete this request.'", citedBy: 'docs/validation.md subsection 51, What was measured' },
  { file: 'server/context/client.js', line: 40, quote: 'const wrapped = new AppError(\'The external context service could not respond.', citedBy: 'docs/validation.md subsection 51, The fix' },
  { file: 'server/context/terrain.js', line: 59, quote: "Terrain data is unavailable. Elevation, slope and aspect remain unknown", citedBy: 'docs/validation.md subsection 51, The fix' },
  { file: 'server/nasa/power.js', line: 120, quote: 'throw Object.assign(new AppError(', citedBy: 'docs/validation.md subsection 51, The fix' },
  // 116 is quoted by this subsection's own Limits paragraph six times over, and the 16 Nov survey made it a top unpinned target.
  { file: 'server/nasa/power.js', line: 116, quote: 'NASA POWER is unavailable (HTTP ', citedBy: 'docs/validation.md subsection 51, Limits' },
  // The three iteration-53 pins. Adding two cases at tests/context.test.js:142 inserted 48 lines and moved six
  // ledger citations - context.test.js:163, :164, :168, :173 and integration.test.js:77 - and every shipped guard,
  // including this one, stayed green, because a test file was never a pinned target. Iteration 53 re-pointed all
  // six by comparing each cited statement against `git show HEAD:<file>`; these pins are what makes that drift loud.
  { file: 'tests/context.test.js', line: 214, quote: 'leaked a transport detail into farmer-facing text', citedBy: 'docs/validation.md:4265 and 2 more' },
  { file: 'tests/context.test.js', line: 223, quote: 'a service that answered 503 stays classifiable as having answered', citedBy: 'docs/validation.md:4121 and 3 more' },
  { file: 'tests/integration.test.js', line: 78, quote: 'assert.match(body.error.message, /no substitute readings/)', citedBy: 'docs/validation.md:4128' },
  // The six iteration-54 pins. This subsection names the lines it edits, and it edits them in place, so the pins are
  // what would notice if a later pass grew one of those files and left the ledger pointing at a neighbour.
  { file: 'server/errors.js', line: 12, quote: 'export function isPermanentRefusal(status)', citedBy: 'docs/validation.md subsection 54, The fix' },
  { file: 'server/context/client.js', line: 43, quote: 'wrapped.slow = signal?.aborted === true', citedBy: 'docs/validation.md subsection 54, The fix' },
  { file: 'server/context/farms.js', line: 78, quote: 'const mayRecover = serviceAnswered', citedBy: 'docs/validation.md subsection 54, The fix' },
  { file: 'server/context/farms.js', line: 89, quote: 'refused this request (HTTP ', citedBy: 'docs/validation.md subsection 54, Costs' },
  { file: 'tests/context.test.js', line: 234, quote: 'the retry facts a hedge reads come from what this client observed', citedBy: 'docs/validation.md subsection 54, Tests' },
  { file: 'tests/nasa.test.js', line: 88, quote: 'a NASA POWER refusal keeps the status it answered', citedBy: 'docs/validation.md subsection 54, Tests' },
  // The three iteration-55 pins: this iteration inserted 4 lines into each of the two files whose ledger citations it
  // also had to re-pin, and neither file was pinned, so the drift it would have caused was visible only to construction.
  { file: 'public/js/lib/chat-context.js', line: 33, quote: "answer.locationScope !== 'unmatched'", citedBy: 'docs/validation.md subsection 55, The fix' },
  { file: 'server/agronomy/answers.js', line: 80, quote: "mode: 'deterministic clarification'", citedBy: 'docs/validation.md subsection 55, The fix' },
  { file: 'server/agronomy/answers.js', line: 84, quote: "locationScope: 'unmatched',", citedBy: 'docs/validation.md subsection 55, The fix' },
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
  assert.ok(PINS.length >= 25, `the pin table holds ${PINS.length} entries; it was sized 19 Nov at 7, widened to 12 by iteration 51 as the first prose that quotes the lines it changes, to 13 when this iteration's own citation of server/nasa/power.js:116 became a top target, to 16 by iteration 53 after a 48-line insertion in tests/context.test.js moved six ledger citations with every guard green, to 22 by iteration 54 for the six lines its own subsection names while editing them in place, and to 25 by iteration 55 because it inserted 4 lines above cited code in two files that held no pin at all`);
  const pinned = file => PINS.filter(pin => pin.file === file).map(pin => pin.line);
  for (const line of [33]) {
    assert.ok(pinned('public/js/lib/chat-context.js').includes(line), `chat-context.js:${line} is the composer gate every location-suppression citation in the ledger depends on and is no longer pinned`);
  }
  for (const line of [80, 84]) {
    assert.ok(pinned('server/agronomy/answers.js').includes(line), `answers.js:${line} is the decline whose new structured fact the gate reads and is no longer pinned`);
  }
  for (const line of [16, 96, 99, 108]) {
    assert.ok(pinned('public/js/modules/chat.js').includes(line), `chat.js:${line} is one of the four most-cited targets and is no longer pinned`);
  }
  for (const line of [13, 16, 17]) {
    assert.ok(pinned('public/js/lib/dom.js').includes(line), `dom.js:${line} names the renderer every source-count citation depends on and is no longer pinned`);
  }
  for (const line of [70, 71]) {
    assert.ok(pinned('server/index.js').includes(line), `index.js:${line} is the exit rule subsection 51 compares the worker against and is no longer pinned`);
  }
  for (const [file, line] of [['server/context/client.js', 40], ['server/context/terrain.js', 59], ['server/nasa/power.js', 120], ['server/nasa/power.js', 116]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a producer line subsection 51 quotes and is no longer pinned`);
  }
  // Test files carry the assertions the ledger quotes too, and iteration 53 proved they drift the same way.
  for (const [file, line] of [['tests/context.test.js', 214], ['tests/context.test.js', 223], ['tests/integration.test.js', 78]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a test assertion the ledger quotes and is no longer pinned`);
  }
  // Subsection 54 names the six lines it edits in place, so the floor alone would let a future pass delete them and
  // still report a 22-entry table; this is the same paired gate iteration 53 used for its own three pins.
  for (const [file, line] of [['server/errors.js', 12], ['server/context/client.js', 43], ['server/context/farms.js', 78],
    ['server/context/farms.js', 89], ['tests/context.test.js', 234], ['tests/nasa.test.js', 88]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line subsection 54 quotes while editing it in place and is no longer pinned`);
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
  const indexOriginal = await linesOf('server/index.js');
  const indexDrifted = [...indexOriginal.slice(0, 68), '  // two lines inserted above the exit rule', '  const note = 1;', ...indexOriginal.slice(68)];
  const indexPins = PINS.filter(pin => pin.file === 'server/index.js');
  assert.deepEqual(mismatches(indexOriginal, indexPins), [], 'the shipped tree must satisfy its own server pins before the drift is replayed');
  const indexCaught = mismatches(indexDrifted, indexPins);
  assert.ok(indexCaught.length === indexPins.length, `the drift left ${indexPins.length - indexCaught.length} of ${indexPins.length} server pins passing, so an insertion above the exit rule would not be reported`);
  assert.ok(indexDrifted.length === indexOriginal.length + 2, 'the server replay must also be a two-line insertion');
});
