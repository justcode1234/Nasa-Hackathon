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
  // The four iteration-57 pins. Rewriting tests/e2e/chat-evidence-panel.spec.js moved two pointers that spec's header
  // carries, and the line-existence guard let both through: the number 18 in `public/js/lib/api.js` now lands on the
  // blank line above the transport test (the Worker statement is on line 20) and the number 49 in `server/api.js`
  // lands inside the branch above the `/api/ask` guard, which is on line 55. One of them drifted onto adjacent live
  // code, which is the failure mode this guard exists for and why a test header is now a pinned surface too.
  { file: 'public/js/lib/api.js', line: 20, quote: "worker = new Worker('/js/lib/core-worker.bundle.js'", citedBy: 'tests/e2e/chat-evidence-panel.spec.js header' },
  { file: 'server/api.js', line: 55, quote: "url.pathname === '/api/ask' && (!body.baseline", citedBy: 'tests/e2e/chat-evidence-panel.spec.js header' },
  { file: 'public/js/lib/chat-context.js', line: 139, quote: 'const replaces = extraBlocks.some(', citedBy: 'tests/e2e/chat-evidence-panel.spec.js header, queued product finding' },
  { file: 'public/js/lib/chat-context.js', line: 147, quote: 'const facts = replaces ? []', citedBy: 'tests/e2e/chat-evidence-panel.spec.js header, queued product finding' },
  // The iteration-57 catch-all explains its own ordering by quoting the sentence a farmer sees when a stub stops
  // answering, which lives in the same client file as the Worker statement above; that sentence is pinned too, so
  // an edit near either of them is reported rather than left pointing at a neighbour.
  { file: 'public/js/lib/api.js', line: 48, quote: 'No answer came back for this request', citedBy: 'tests/e2e/chat-evidence-panel.spec.js catch-all comment' },
  // The four iteration-57 ledger pins. Subsection 56 cites docs/validation.md by absolute line, and this iteration's
  // own prose insertions at 3185, 3544 and 3585 shifted those two targets seven lines down while every shipped guard
  // stayed green: the citations guard only asks whether the number names a non-blank line, and validation.md had never
  // been a pinned target. The ledger is a citation surface like any other, so its own quoted sentences are pinned now.
  { file: 'docs/validation.md', line: 4001, quote: 'could not respond (fetch failed). No records were invented', citedBy: 'docs/validation.md:4131 (subsection 56, re-pointed by 57)' },
  { file: 'docs/validation.md', line: 4085, quote: 'service could not respond (signal timed out)', citedBy: 'docs/validation.md:4131 (subsection 56, re-pointed by 57)' },
  // Subsection 56's opening two cross-references, both re-measured against the tree rather than trusted from 55.
  { file: 'docs/validation.md', line: 4781, quote: 'artifacts/toolchains/node-v22.23.5-darwin-arm64/bin:$PATH', citedBy: 'docs/validation.md:4818 (subsection 56)' },
  { file: 'docs/validation.md', line: 4791, quote: 'its Playwright driver is process ID 45229', citedBy: 'docs/validation.md:4809 (subsection 56)' },
  // AGENTS.md is a citation surface too, and subsection 56 cites it by absolute line in two places. The first of
  // these two moved for real under this iteration: subsection 57 repaired four citations inside AGENTS.md and the
  // four lines it gained above the name pass-through sentence carried that target from :1053 to :1057, which is
  // the ledger drift again in the other direction (a prose edit in the cited file, not in the citing one).
  { file: 'AGENTS.md', line: 1057, quote: 'passed an `AbortError` through while four', citedBy: 'docs/validation.md:4819 (subsection 56, re-pointed by 57)' },
  { file: 'AGENTS.md', line: 933, quote: 'iteration 43 - the citation guard', citedBy: 'docs/validation.md:3955 and :3965, AGENTS.md:1157' },
  // Subsection 57 cites the rewritten spec by number in six places - the three helpers every case ends with, the
  // clock-masking line its provenance claim rests on, the ordering comment it quotes the law out of, and the two
  // link assertions that are the panel's only structural guard. This file was rewritten whole on this branch, which
  // is the edit that moved pointers without a single guard noticing, so its own lines are pinned now.
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 89, quote: 'const paired = panel => {', citedBy: 'docs/validation.md subsection 57, What the twenty cases assert' },
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 93, quote: 'const sealed = (escaped, project) => expect(escaped,', citedBy: 'docs/validation.md subsection 57, What the twenty cases assert' },
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 96, quote: 'const frozen = text => text.replace(/retrieved', citedBy: 'docs/validation.md subsection 57, The fixtures' },
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 104, quote: "// Registered before every stub, which puts it last in Playwright's", citedBy: 'docs/validation.md subsection 57, The interception law' },
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 220, quote: 'both the documentation entry and the exact request must be linked', citedBy: 'docs/validation.md subsection 57, What the twenty cases assert' },
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 248, quote: 'toEqual([POWER_DOCS, POWER_REQUEST, SOIL_DOCS])', citedBy: 'docs/validation.md subsection 57, What the twenty cases assert' },
  // Repairing the `state.inputs` falsehood needs the real mechanism quoted, not asserted: the browser only ever puts
  // inputs in an `/api/ask` body because a comparison stored them first. Those two lines are the whole claim, so they
  // are pinned and an edit near them is reported instead of leaving subsection 43 pointing at a neighbour again.
  { file: 'public/js/app.js', line: 155, quote: 'chat = initChat(() => ({ inputs: comparedInputs,', citedBy: 'docs/validation.md subsection 57, the state.inputs repair' },
  { file: 'public/js/app.js', line: 290, quote: 'comparedInputs = result.inputs;', citedBy: 'docs/validation.md:3548 (subsection 43, repaired by 57)' },
  // The two ends of the range subsection 57 quotes as the reason the catch-all cannot seize a stub: the shared list
  // and the pattern built from it. A third line in that range is the `/api` stub itself, which is a neighbour of the
  // two and moves with them, so the endpoints are what a drift would show up on.
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 71, quote: "const pinnedApi = 'observations|soil|country-crops|compare|ask'", citedBy: 'docs/validation.md subsection 57, The interception law' },
  { file: 'tests/e2e/chat-evidence-panel.spec.js', line: 73, quote: 'const unpinned = new RegExp(', citedBy: 'docs/validation.md subsection 57, The interception law' },
  // The twelve iteration-58 re-points. This iteration inserted 3 + 4 lines into public/js/modules/context.js and 8 + 2
  // + 1 into public/js/modules/workflow-assistant.js, and 5 into a Playwright spec, which moved 26 cited lines across
  // 15 prose sites in three docs while every shipped guard stayed green: each pointer still landed on a non-blank line,
  // which is all the citations guard asks. `scripts/citation-drift.mjs` measures that against the diff's own hunk
  // counts - run before the re-point it reported 26 drifted lines of HEAD's citations, after it reports 0, and both
  // reads are archived in docs/evidence/iter58-citation-drift-2026-11-20.log.gz - and the two endpoints of every
  // re-pointed range are pinned here, so the next insertion near one of them is reported rather than silently aiming a
  // paragraph at its neighbour again.
  { file: 'public/js/modules/context.js', line: 141, quote: 'You can continue with the selected map point', citedBy: 'docs/handoff-2026-11-18.md:915 (re-pointed by 58, moved by the 58 queue bullet)' },
  { file: 'public/js/modules/context.js', line: 192, quote: 'onPests(null, options)', citedBy: 'docs/handoff-2026-11-18.md:548 (re-pointed by 58)' },
  { file: 'public/js/modules/context.js', line: 195, quote: "$('pest-country').value", citedBy: 'docs/handoff-2026-11-18.md:442 and :507, docs/validation.md:2977 (re-pointed by 58)' },
  { file: 'public/js/modules/context.js', line: 213, quote: 'record.scientificName', citedBy: 'docs/handoff-2026-11-18.md:549 (re-pointed by 58)' },
  { file: 'public/js/modules/context.js', line: 215, quote: 'GBIF country query', citedBy: 'docs/handoff-2026-11-18.md:553 (re-pointed by 58)' },
  { file: 'public/js/modules/context.js', line: 226, quote: "$('pest-country').addEventListener", citedBy: 'docs/handoff-2026-11-18.md:507 (re-pointed by 58)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 479, quote: 'verifies that point (checked above)', citedBy: 'docs/handoff-2026-11-18.md:1156 (re-pointed by 58, moved by the 58 queue bullet) (re-pointed by 61) (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 519, quote: 'claimed a town question was pending', citedBy: 'docs/validation.md:1021 (re-pointed by 58) (re-pointed by 61) (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 531, quote: 'silence would leave the farmer nothing to tap', citedBy: 'docs/validation.md:1021 (re-pointed by 58) (re-pointed by 61) (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 538, quote: 'if (error.cancelled === true) throw error', citedBy: 'docs/validation.md:4388 and :4835, AGENTS.md:1827 (re-pointed by 58) (re-pointed by 61) (re-pointed by 65)' },
  { file: 'tests/e2e/chat-only-flow.spec.js', line: 86, quote: "'Step 4 is ready'", citedBy: 'docs/validation.md:3998 (re-pointed by 58)' },
  { file: 'tests/e2e/chat-only-flow.spec.js', line: 100, quote: 'one typed message with coordinates reaches step 4', citedBy: 'docs/validation.md:4084, docs/handoff-2026-11-18.md:18 (re-pointed by 58)' },
  // The fourteen lines subsection 58 names while changing them, which is the lesson iteration 57 recorded and this
  // iteration had again to apply: a fix that edits a cited file has to carry its own pointers with it.
  { file: 'public/js/modules/context.js', line: 123, quote: "reason: 'no-location'", citedBy: 'docs/validation.md subsection 58, The fix' },
  { file: 'public/js/modules/context.js', line: 130, quote: "reason: 'superseded'", citedBy: 'docs/validation.md subsection 58, The fix' },
  { file: 'public/js/modules/context.js', line: 138, quote: 'return { ok: true, count: farms.length };', citedBy: 'docs/validation.md subsection 58, The fix' },
  { file: 'public/js/modules/context.js', line: 144, quote: "reason: 'lookup-failed'", citedBy: 'docs/validation.md subsection 58, The fix' },
  { file: 'public/js/modules/workflow-assistant.js', line: 414, quote: "result?.ok === false ? 'failed' : 'done'", citedBy: 'docs/validation.md subsection 58, The fix (re-pointed by 61) (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 428, quote: 'const fieldsFailed = message => reply', citedBy: 'docs/validation.md subsection 58, The failure reply (re-pointed by 61) (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 599, quote: "fieldsFailed('Your selected point is still in place.')", citedBy: 'docs/validation.md subsection 58, The failure reply (re-pointed by 61) (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 650, quote: "if (fields === 'failed') return fieldsFailed(", citedBy: 'docs/validation.md subsection 58, The failure reply (re-pointed by 61) (re-pointed by 65)' },
  { file: 'tests/e2e/field-service-failure.spec.js', line: 21, quote: 'a refused field lookup is reported as a failure', citedBy: 'docs/validation.md subsection 58, The reproducing case' },
  { file: 'tests/e2e/field-service-failure.spec.js', line: 77, quote: '0 mapped fields were returned', citedBy: 'docs/validation.md subsection 58, The third phase' },
  { file: 'tests/workflow-place-choices.test.js', line: 627, quote: 'a town tap whose field lookup was refused reports a failure', citedBy: 'docs/validation.md subsection 58, Tests (moved 488 -> 584 -> 621 by iteration 64) (re-pointed by 65)' },
  { file: 'tests/e2e/guided-chat-accessibility.spec.js', line: 52, quote: 'field lookup did not complete', citedBy: 'docs/validation.md subsection 58, superseded assertions' },
  { file: 'server/context/client.js', line: 5, quote: 'ttlMs = 86_400_000', citedBy: 'docs/validation.md subsection 58, the cache law' },
  { file: 'server/context/client.js', line: 13, quote: 'readCached(key, ttlMs)', citedBy: 'docs/validation.md subsection 58, the cache law' },
  // Subsection 59 changed the shape of the ask failure path in public/js/modules/chat.js: its catch block grew from one
  // line to ten, which moved every line below it, and its prose then names the ten lines it depends on. Each of these
  // pins is a line that subsection cites by number or a line the fix itself sits on, so a future pass that shuffles the
  // catch block has to re-point the ledger here rather than discover the drift by hand.
  { file: 'public/js/modules/chat.js', line: 91, quote: "$('question').value = '';", citedBy: 'docs/validation.md subsection 59, What was wrong' },
  { file: 'public/js/modules/chat.js', line: 93, quote: 'const choice = pendingChoice; pendingChoice = null;', citedBy: 'docs/validation.md subsection 59, What this does not fix' },
  { file: 'public/js/modules/chat.js', line: 94, quote: 'let answer = await workflow.respond(question, choice);', citedBy: 'docs/validation.md subsection 59, What was wrong' },
  { file: 'public/js/modules/chat.js', line: 117, quote: 'const isWorkflow = answer.topic === ', citedBy: 'docs/validation.md:1308 (subsection 5), which cites the range chat.js:117-131' },
  { file: 'public/js/modules/chat.js', line: 128, quote: "'data-choice-type': followUp.workflowChoice?.type", citedBy: 'docs/validation.md:1308 (subsection 5), inside the range chat.js:117-131' },
  { file: 'public/js/modules/chat.js', line: 149, quote: '} catch (error) {', citedBy: 'tests/e2e/chat-refused-ask-keeps-question.spec.js:5 and docs/validation.md subsection 59' },
  { file: 'public/js/modules/chat.js', line: 154, quote: 'if (error.cancelled !== true && version === revision', citedBy: 'docs/validation.md subsection 56, and AGENTS.md iteration-56 bullet, both re-pointed by 59' },
  { file: 'public/js/modules/chat.js', line: 155, quote: 'announce(error.message);', citedBy: 'docs/validation.md subsection 59, What was wrong' },
  { file: 'public/js/modules/chat.js', line: 156, quote: "$('question').value === ''", citedBy: 'docs/validation.md subsection 59, The fix is one statement' },
  { file: 'public/js/modules/chat.js', line: 159, quote: "finally { if (version === revision && serial === messageSerial)", citedBy: 'docs/validation.md subsection 59, What was wrong' },
  { file: 'public/js/modules/workflow-assistant.js', line: 557, quote: 'const result = await request(`/api/places?', citedBy: 'docs/validation.md subsection 59, How it was found (re-pointed by 61) (re-pointed by 65)' },
  { file: 'server/api.js', line: 46, quote: 'body.question.length > 500', citedBy: 'docs/validation.md subsection 59, How it was found' },
  { file: 'tests/e2e/chat-refused-ask-keeps-question.spec.js', line: 26, quote: 'a refused ask leaves the message in the composer', citedBy: 'docs/validation.md subsection 59, The cases that cover it' },
  { file: 'tests/e2e/chat-refused-ask-keeps-question.spec.js', line: 54, quote: 'the refused message must still be in the composer', citedBy: 'docs/validation.md subsection 59, The cases that cover it' },
  { file: 'tests/e2e/chat-refused-ask-keeps-question.spec.js', line: 76, quote: 'a message written into the composer while the ask was in flight', citedBy: 'docs/validation.md subsection 59, The cases that cover it' },
  { file: 'tests/e2e/chat-refused-ask-keeps-question.spec.js', line: 97, quote: 'the refused message must not overwrite what the farmer wrote next', citedBy: 'docs/validation.md subsection 59, The cases that cover it' },
  // Subsection 61 is the first pass that repairs its own drift with a tool instead of by hand: `scripts/citation-drift.mjs`
  // measures it and `tests/e2e/place-list-refused.spec.js` reproduces the defect it fixes. These are the lines that prose
  // quotes by number - the two failure classes, the picker re-read that makes the recovery the refusal names pressable,
  // the identity carrier both transports depend on, and the two cases plus the fixture that is derived from the shipped
  // adapter rather than restated in the spec.
  { file: 'public/js/modules/workflow-assistant.js', line: 248, quote: 'function placeListFailure(countryName, error, question = null) {', citedBy: 'docs/validation.md subsection 61, The fix (widened by 67)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 249, quote: "const unreadable = error?.code === 'LOCATIONS_SCHEMA'", citedBy: 'docs/validation.md subsection 61, the two failure classes' },
  { file: 'public/js/modules/workflow-assistant.js', line: 463, quote: 'catch (error) { if (error.cancelled === true) throw error; listFailed = error;', citedBy: 'docs/validation.md subsection 61, What was wrong (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 618, quote: 'is selected. Now choose a town in the Town list in step 1', citedBy: 'docs/validation.md subsection 61, The recovery the refusal promises (re-pointed by 65)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 785, quote: 'if (listFailed) return placeListFailure(countryName, listFailed);', citedBy: 'docs/validation.md subsection 61, The whole-country escape (re-pointed by 65) (re-pointed by 69)' },
  { file: 'public/js/modules/context.js', line: 249, quote: "const read = await picker.setCountry(countryCode, { regionCode });", citedBy: 'docs/validation.md subsection 61, the second defect the browser run found' },
  { file: 'public/js/modules/context.js', line: 251, quote: 'Choose a region from the current country list.', citedBy: 'docs/validation.md subsection 61, the sentence the stale dropdown threw' },
  { file: 'public/js/lib/api.js', line: 13, quote: 'if (!response.ok) throw identified(new Error(data?.error?.message', citedBy: 'docs/validation.md subsection 60, and AGENTS.md §13 queue (both re-pointed by 61)' },
  { file: 'public/js/lib/api.js', line: 60, quote: 'function identified(error, status, code) {', citedBy: 'docs/validation.md subsection 60, The fix keeps identity only when a status came' },
  { file: 'public/js/lib/api.js', line: 70, quote: "return typeof data.status === 'number' ? identified(new Error(data.error), data.status, data.code)", citedBy: 'docs/validation.md subsection 60, the worker half' },
  { file: 'tests/e2e/place-list-refused.spec.js', line: 28, quote: 'async function authoredFailure(readJson) {', citedBy: 'docs/validation.md subsection 61, the fixture comes from the shipped adapter' },
  { file: 'tests/e2e/place-list-refused.spec.js', line: 36, quote: 'is reported as a failed read, keeps the country, and answers with its regions once the retry gets through', citedBy: 'docs/validation.md subsection 61, The reproducing case' },
  { file: 'tests/e2e/place-list-refused.spec.js', line: 92, quote: 'the tapped region is selected in step 1, not just in the chat', citedBy: 'docs/validation.md subsection 61, the second defect the browser run found' },
  { file: 'tests/e2e/place-list-refused.spec.js', line: 100, quote: 'an unreadable source shape names its own reason, offers no retry it has ruled out', citedBy: 'docs/validation.md subsection 61, the schema class' },
  // The three links iteration 67 re-pointed by tool - and iteration 75 re-pointed again, because 67 moved the labels
  // onto bands that hold other code. A pin that quotes the label is what makes the second repair honest: the label, the
  // `#LNNN`, the row in DEEP_LINKS below and this quote all have to move together or one of the two guards goes red.
  { file: 'docs/validation.md', line: 1007, quote: 'region is selected ([public/js/modules/workflow-assistant.js:472-477, where `allowEponymousTown`', citedBy: 'docs/validation.md subsection 61, re-pointed by subsection 75 (F14)' },
  { file: 'docs/validation.md', line: 1021, quote: 'answers honestly instead ([public/js/modules/workflow-assistant.js:675-686, the branch where `replySpelling`', citedBy: 'docs/validation.md subsection 61, re-pointed by subsection 75 (F14)' },
  { file: 'docs/validation.md', line: 1035, quote: 'anything ([public/js/modules/workflow-assistant.js:502-506, where `rowCarriesReply`', citedBy: 'docs/validation.md subsection 61, re-pointed by subsection 75 (F14)' },
  // The guard quoting its own case, because the handoff header names this file by line and four lines added above the
  // case below moved it while every other guard stayed green; iteration 66's twenty-four rows and loop moved it again.
  { file: 'tests/documentation-citation-anchors.test.js', line: 524, quote: "test('no pin is satisfied by the statement above or below the line it names'", citedBy: 'docs/handoff-2026-11-18.md:19 and docs/validation.md subsection 61 (re-pointed by 65, 66, 72 and 73)' },
  // Iteration 65 is the same shape again: the F5 fix put a fourteen-line helper above every line the coordinate
  // branch cites and added six cases to an offline file the ledger cites, so the helper, the guard that reaches
  // it, the single read the branch now shares and the cases and page spec that pin the request count are pinned.
  { file: 'public/js/modules/workflow-assistant.js', line: 260, quote: 'function coordinateListUnreadable(countryName, latitude', citedBy: 'docs/validation.md subsection 65, The reply and AGENTS.md iteration-65 bullet' },
  { file: 'public/js/modules/workflow-assistant.js', line: 564, quote: 'if (listFailed) return coordinateListUnreadable(countryName', citedBy: 'docs/validation.md subsection 65, The fix' },
  { file: 'public/js/modules/workflow-assistant.js', line: 565, quote: 'const list = listed;', citedBy: 'docs/validation.md subsection 65, one quantity one source' },
  { file: 'public/js/modules/workflow-assistant.js', line: 734, quote: 'async function getLocationList(country)', citedBy: 'docs/validation.md subsection 65, why the read was unreachable' },
  { file: 'tests/workflow-place-choices.test.js', line: 777, quote: 'a coordinate sentence whose saved list refused answers instead of throwing', citedBy: 'docs/validation.md subsection 65, Tests' },
  { file: 'tests/workflow-place-choices.test.js', line: 829, quote: 'a coordinate sentence reads the saved list once', citedBy: 'docs/validation.md subsection 65, Tests' },
  { file: 'tests/workflow-place-choices.test.js', line: 855, quote: 'a coordinate sentence that moved the plan into a country whose list refused', citedBy: 'docs/validation.md subsection 65, Tests' },
  { file: 'tests/e2e/chat-refused-ask-keeps-question.spec.js', line: 113, quote: 'a coordinate sentence whose saved list refused is answered', citedBy: 'docs/validation.md subsection 65, the page case and AGENTS.md iteration-65 bullet' },
  { file: 'server/context/locations.js', line: 9, quote: 'const cache = new Map();', citedBy: 'docs/validation.md subsection 65, F2 left as it was' },
  // Iteration 66 quotes these by number: the two module-scope patterns the veto and the parser now share, the four
  // clauses of the F1 fix, the two rules exactPlaceRow declines on, the offline cases and page cases that pin them, and
  // the line of the citation guard whose Array() arithmetic turns an inverted range into a RangeError instead of a
  // report. Every quote below was read out of the file at the line it names, and no quote is satisfied by the line
  // above or below it, which is what case 4 of this guard checks.
  { file: 'public/js/modules/workflow-assistant.js', line: 7, quote: 'const STOP_WORD = /^(?:cancel|stop|cancel planning|stop planning)$/;', citedBy: 'docs/validation.md subsection 66, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 11, quote: 'if (STOP_WORD.test(text)) return active ? { cancel: true } : null;', citedBy: 'docs/validation.md subsection 66, What was wrong' },
  { file: 'public/js/modules/workflow-assistant.js', line: 26, quote: 'if ((isEvidenceQuestion(question) && !temperatureUnit) || GREETING.test(text)) return null;', citedBy: 'docs/validation.md subsection 66, What was wrong' },
  { file: 'public/js/modules/workflow-assistant.js', line: 309, quote: 'const neverAPlaceName = !choice && (GREETING.test(written) || STOP_WORD.test(written));', citedBy: 'docs/validation.md subsection 66, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 310, quote: 'let parsed = choice ? { countries: [], constraints: {} } : parseWorkflowMessage(question, active);', citedBy: 'docs/validation.md subsection 66, the branch a button press takes' },
  { file: 'public/js/modules/workflow-assistant.js', line: 320, quote: 'const noOtherSignal = !parsed || Boolean(parsed.cancel) || !parsed.intent && !parsed.uiAction && (parsed.implicitList ||', citedBy: 'docs/validation.md subsection 66, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 328, quote: 'if (!choice && !neverAPlaceName && noOtherSignal && (active || !getState().location)) {', citedBy: 'docs/validation.md subsection 66, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 350, quote: 'if (parsed.cancel) { active = false; invalidate(); return reply(\'Guided planning stopped. Your current form values remain available.\'); }', citedBy: 'docs/validation.md subsection 66, the sentence that never reached the page' },
  { file: 'public/js/modules/workflow-assistant.js', line: 749, quote: 'if (towns.length === 1) return { type: \'town\', id: towns[0].id };', citedBy: 'docs/validation.md subsection 66, the duplicate-town limit (re-pointed by 69)' },
  { file: 'public/js/modules/workflow-assistant.js', line: 761, quote: '// two rows sharing the name stay a question rather than a guess.', citedBy: 'docs/validation.md subsection 66, why a shared name stays a question (re-pointed by 69)' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 51, quote: 'a bare region name typed with no plan open selects the region instead of answering a crop question', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 62, quote: 'assert.deepEqual(calls, [\'region\'], `the form was moved by: ${JSON.str', citedBy: 'docs/validation.md subsection 66, Tests, the assertion this pass corrected' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 89, quote: 'a greeting and a stop word are never read as place names, and cost no saved-list read', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 101, quote: 'a row name that opens like a question is selectable with no plan open', citedBy: 'docs/validation.md subsection 66, Four clauses' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 113, quote: 'a name the saved list does not hold still reaches the read-only answer', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 122, quote: 'a point the farmer already chose survives a bare region name with no plan open', citedBy: 'docs/validation.md subsection 66, Four clauses' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 132, quote: 'a stop word stays a stop word even where the saved list holds a row of that name', citedBy: 'docs/validation.md subsection 66, Tests, the red-first case' },
  { file: 'tests/workflow-bare-place-name.test.js', line: 146, quote: 'a bare place name with no country chosen selects nothing and costs no saved-list read', citedBy: 'docs/validation.md subsection 66, the no-country limit' },
  { file: 'tests/e2e/chat-bare-place-name.spec.js', line: 31, quote: 'a bare region name typed with no plan open selects the region instead of answering a crop question', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/e2e/chat-bare-place-name.spec.js', line: 36, quote: 'expect(await page.locator(\'#place-region\').inputValue(),\'no region is ', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/e2e/chat-bare-place-name.spec.js', line: 42, quote: 'expect(await page.locator(\'#place-region\').inputValue(),\'step 1 shows ', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/e2e/chat-bare-place-name.spec.js', line: 52, quote: 'a bare town name typed with no plan open sets that town point', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/e2e/chat-bare-place-name.spec.js', line: 76, quote: 'a typed cancellation mid-plan stops the plan instead of reporting a runtime error', citedBy: 'docs/validation.md subsection 66, Tests' },
  { file: 'tests/documentation-citations.test.js', line: 81, quote: 'const blank = [...Array(to - from + 1).keys()].every(step => !targetLi', citedBy: 'docs/validation.md subsection 66, the sweep that could not report itself' },
  // Iteration 67 names these by number: the place-shape test the new sentence is gated on, the four clauses that
  // replaced the swallowed read, the two lines of the comment that records why the gate exists, the marker a cancelled
  // read carries, and the eleven cases (eight offline, three in a page) that pin the behaviour and its bound. Every
  // quote was read out of the file at the line it names.
  { file: 'public/js/modules/workflow-assistant.js', line: 206, quote: 'function mentionPhrase(question) {', citedBy: 'docs/validation.md subsection 67, The bound' },
  { file: 'public/js/modules/workflow-assistant.js', line: 208, quote: 'if (!folded || folded.length > 60) return null;', citedBy: 'docs/validation.md subsection 67, The bound' },
  { file: 'public/js/modules/workflow-assistant.js', line: 254, quote: "next('Ask that again', question)", citedBy: 'docs/validation.md subsection 67, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 337, quote: 'let row = null, listFailed = null;', citedBy: 'docs/validation.md subsection 67, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 338, quote: 'try { row = await exactPlaceRow(question, {', citedBy: 'docs/validation.md subsection 67, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 339, quote: 'catch (error) { if (error.cancelled === true) throw error; listFailed = error; }', citedBy: 'docs/validation.md subsection 67, Four clauses' },
  { file: 'public/js/modules/workflow-assistant.js', line: 340, quote: 'The refusal is stated for a message that has the shape of a place name', citedBy: 'docs/validation.md subsection 67, The bound' },
  { file: 'public/js/modules/workflow-assistant.js', line: 345, quote: 'The saved place list for United States could not be read just now', citedBy: 'docs/validation.md subsection 67, The bound' },
  { file: 'public/js/modules/workflow-assistant.js', line: 346, quote: 'if (listFailed && asked === generation && mentionPhrase(question))', citedBy: 'docs/validation.md subsection 67, Four clauses' },
  { file: 'public/js/lib/api.js', line: 52, quote: 'error.cancelled = true; return error;', citedBy: 'docs/validation.md subsection 67, Four clauses' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 70, quote: 'a bare place name whose saved list refused names the read that failed', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 86, quote: 'own words back and a tap after a healthy list selects the place', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 105, quote: 'a list that arrived unreadable is reported as a source format', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 118, quote: 'a cancelled saved-list read settles as a stop, not as a refusal sentence', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 132, quote: 'a name the farmer holds a point for is never read against a refusing list', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 145, quote: 'a sentence with no place shape keeps its read-only answer', citedBy: 'docs/validation.md subsection 67, Tests and The bound' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 167, quote: 'a row name longer than the place shape is unaffected by the bound', citedBy: 'docs/validation.md subsection 67, The bound' },
  { file: 'tests/workflow-place-name-refused.test.js', line: 175, quote: 'the same long row name with the list refusing still falls through', citedBy: 'docs/validation.md subsection 67, The bound' },
  { file: 'tests/e2e/place-name-list-refused.spec.js', line: 57, quote: 'a bare place name typed while the saved list is down is reported as a failed read', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/e2e/place-name-list-refused.spec.js', line: 84, quote: 'Ask that again replays the words the farmer typed and selects the place', citedBy: 'docs/validation.md subsection 67, Tests' },
  { file: 'tests/e2e/place-name-list-refused.spec.js', line: 112, quote: 'a sentence too long to be a place name is not answered with the place-list failure', citedBy: 'docs/validation.md subsection 67, Tests' },
  // Iteration 72 quotes these by number: the two chat.js lines it replaced in place, the worker line whose text the
  // panel stopped echoing, every sentence the new classifier can build, five of the nine offline cases and the two
  // page assertions that pin the wording. A chat.js pin may not sit below line 13, because the replay case above
  // inserts there and asserts every pin in that file moves. Widening this table also moved the file's own self-pin
  // from 482, which is the drift this guard exists for arriving in the guard itself, so that entry is re-pointed too.
  { file: 'public/js/modules/chat.js', line: 63, quote: 'setStatus(modelFailureStatus(data.message))', citedBy: 'docs/validation.md subsection 72, The fix' },
  { file: 'public/js/modules/chat.js', line: 66, quote: 'setStatus(modelFailureStatus(event.message))', citedBy: 'docs/validation.md subsection 72, The fix' },
  { file: 'public/js/modules/mini-lm-worker.js', line: 59, quote: "self.postMessage({type:'error',id,message:error.message})", citedBy: 'docs/validation.md subsection 72, What was measured' },
  // Iteration 73 renamed the two chat constants to CHAT_FRAME/CHAT_RECOVERY, grew the cause table's comment and put the
  // clauses in load-bearing order, so these six re-point to the current bytes; subsection 72 carries the same pointers.
  { file: 'public/js/lib/model-failure.js', line: 26, quote: "const CHAT_FRAME = 'Model could not start';", citedBy: 'docs/validation.md subsection 72, The wording' },
  { file: 'public/js/lib/model-failure.js', line: 27, quote: "const CHAT_RECOVERY = 'Evidence chat still works.", citedBy: 'docs/validation.md subsection 72, The wording' },
  { file: 'public/js/lib/model-failure.js', line: 35, quote: "'because its runtime did not arrive'", citedBy: 'docs/validation.md subsection 72, The three causes' },
  { file: 'public/js/lib/model-failure.js', line: 34, quote: "'because a model file arrived unreadable'", citedBy: 'docs/validation.md subsection 72, The three causes' },
  { file: 'public/js/lib/model-failure.js', line: 36, quote: "'because a model file did not arrive'", citedBy: 'docs/validation.md subsection 72, The three causes' },
  { file: 'public/js/lib/model-failure.js', line: 42, quote: 'return cause ? `${frame} ${cause}. ${recovery}`', citedBy: 'docs/validation.md subsection 72, no echo' },
  { file: 'tests/model-failure.test.js', line: 19, quote: 'a runtime that never arrives is named as a runtime', citedBy: 'docs/validation.md subsection 72, Tests' },
  { file: 'tests/model-failure.test.js', line: 27, quote: 'a model file that arrives unreadable is separated', citedBy: 'docs/validation.md subsection 72, Tests' },
  { file: 'tests/model-failure.test.js', line: 47, quote: 'no branch repeats any part of the worker text', citedBy: 'docs/validation.md subsection 72, Tests, the no-leak sweep' },
  { file: 'tests/model-failure.test.js', line: 67, quote: 'the button this sentence names is the button the panel actually shows', citedBy: 'docs/validation.md subsection 72, Tests, the button pin' },
  { file: 'tests/model-failure.test.js', line: 74, quote: 'chat.js routes both failure paths through the classifier', citedBy: 'docs/validation.md subsection 72, Tests, the wiring case' },
  { file: 'tests/e2e/chat-model-egress.spec.js', line: 17, quote: "toContainText('Model could not start because its runtime did not arrive", citedBy: 'docs/validation.md subsection 72, the page case re-pointing subsection 50 :4064' },
  { file: 'tests/e2e/chat-model-egress.spec.js', line: 25, quote: 'not.toMatch(/on this device/i)', citedBy: 'docs/validation.md subsection 72, the page case' },
  // Iteration 73 (F16) quotes these by number: the dictation panel's own three lines, the worker line whose text it
  // stopped echoing, the six lines of the classifier the second panel now shares, three of the new offline cases and two
  // assertions of the page case. Widening the table moves this file's own self-pin again, which is the drift this guard
  // exists for arriving in the guard itself, so that entry is re-pointed in the same pass.
  { file: 'public/js/modules/speech.js', line: 7, quote: "import { speechFailureStatus } from '../lib/model-failure.js';", citedBy: 'docs/validation.md subsection 73, The fix' },
  { file: 'public/js/modules/speech.js', line: 72, quote: 'unload(speechFailureStatus(data.message))', citedBy: 'docs/validation.md subsection 73, The fix' },
  { file: 'public/js/modules/speech.js', line: 74, quote: 'worker.onerror = event => { event.preventDefault(); unload(speechFailureStatus(event.message)); };', citedBy: 'docs/validation.md subsection 73, The fix' },
  { file: 'public/js/modules/stt-worker.js', line: 46, quote: 'self.postMessage({ type: \'error\', id, message: error?.message ?? String(error) });', citedBy: 'docs/validation.md subsection 73, What was measured' },
  { file: 'public/js/lib/model-failure.js', line: 28, quote: "const SPEECH_FRAME = 'Voice input unavailable';", citedBy: 'docs/validation.md subsection 73, The wording' },
  { file: 'public/js/lib/model-failure.js', line: 29, quote: "const SPEECH_RECOVERY = 'Typing works as usual.", citedBy: 'docs/validation.md subsection 73, The wording' },
  { file: 'public/js/lib/model-failure.js', line: 33, quote: 'const CAUSES = [', citedBy: 'docs/validation.md subsection 73, the ordering' },
  { file: 'public/js/lib/model-failure.js', line: 39, quote: 'function classify(message, frame, recovery) {', citedBy: 'docs/validation.md subsection 73, The fix' },
  { file: 'public/js/lib/model-failure.js', line: 45, quote: 'export function modelFailureStatus(message) {', citedBy: 'docs/validation.md subsection 73, The fix' },
  { file: 'public/js/lib/model-failure.js', line: 49, quote: 'export function speechFailureStatus(message) {', citedBy: 'docs/validation.md subsection 73, The fix' },
  { file: 'tests/model-failure.test.js', line: 95, quote: 'the dictation panel classifies the same texts without echoing any of them', citedBy: 'docs/validation.md subsection 73, Tests' },
  { file: 'tests/model-failure.test.js', line: 104, quote: 'a corrupt model binary is not called a missing runtime', citedBy: 'docs/validation.md subsection 73, Tests, the ordering case' },
  { file: 'tests/model-failure.test.js', line: 137, quote: 'speech.js routes both failure paths through the classifier and echoes nothing', citedBy: 'docs/validation.md subsection 73, Tests, the wiring case' },
  { file: 'tests/e2e/speech-microphone.spec.js', line: 85, quote: "expect(status).toBe('Voice input unavailable because a model file did not arrive.", citedBy: 'docs/validation.md subsection 73, the page case' },
  { file: 'tests/e2e/speech-microphone.spec.js', line: 93, quote: 'await expect.poll(()=>hubRequests.length,{timeout:60_000}).toBeGreaterThan(attempted);', citedBy: 'docs/validation.md subsection 73, the retry proof' },
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
  assert.ok(PINS.length >= 191, `the pin table holds ${PINS.length} entries; it was sized 19 Nov at 7, widened to 12 by iteration 51 as the first prose that quotes the lines it changes, to 13 when this iteration's own citation of server/nasa/power.js:116 became a top target, to 16 by iteration 53 after a 48-line insertion in tests/context.test.js moved six ledger citations with every guard green, to 22 by iteration 54 for the six lines its own subsection names while editing them in place, to 25 by iteration 55 because it inserted 4 lines above cited code in two files that held no pin at all, to 29 by iteration 57 because replacing a Playwright spec silently moved two pointers in the header of the file that replaced it - one onto a blank line, one onto a neighbouring live line - to 30 when that iteration's catch-all quoted the client's own no-answer sentence as the reason its route ordering matters, to 34 when the same iteration's own prose insertions moved two ledger self-citations seven lines down inside docs/validation.md, which had never been a pinned surface although the ledger cites itself by absolute line, to 36 when the same drift ran the other way - four lines added to AGENTS.md moved a target the ledger names there, and the paragraph that quoted it had also quoted two file lengths as "before and after" that belonged to the previous commit - and to 42 when the ledger paragraph that reports all of that started naming six lines of the rewritten spec itself, to 44 when the repair of that spec's state.inputs falsehood quoted the two public/js/app.js lines that are the only reason an /api/ask body carries inputs at all, to 46 when it started quoting the shared stub list the catch-all is built from, to 72 by iteration 58: that fix inserted 5, 10 and 7 lines into three shipped files and moved 26 cited lines over 15 prose sites with every guard green, so both the twelve endpoints it had to re-point and the fourteen lines subsection 58 names while changing them are pinned, and to 88 by iteration 59: the ask-failure fix grew chat.js's catch block from one statement into a guard plus a restore, moved that block's own lines, and its prose cites ten chat.js lines, the reverse-lookup call site, the /api/ask length rule and four lines of the spec that reproduces it, and to 102 by iteration 61: the refused-place-list fix inserted 13 lines above four cited bands and moved 9 pins with every guard green but the one that reads quoted text, so both failure classes, the picker re-read that makes the recovery pressable, the identity carrier both transports share and four lines of its own spec are pinned, and to 106 when it added the three re-pointed deep links whose labels moved and whose anchors did not, and to 115 by iteration 65: the F5 fix added fourteen lines to public/js/modules/workflow-assistant.js above every line the coordinate branch cites and six cases to tests/workflow-place-choices.test.js, which moved 13 pins and the three deep-link labels this table quotes, so the helper, the guard that reaches it, the single read it shares, three of the six offline cases, the page case and the worker-side cache F2 leaves in place are all pinned, and to 139 by iteration 66: the F1 fix moved two patterns above every module line the ledger names, made a cancellation reply reachable that had never rendered once, and added nine offline cases and three page cases, so the shared patterns, the veto, the gate, that reply, the rule a duplicated town name is declined on and thirteen lines of the two new test files are pinned, and to 160 by iteration 67: the F4 fix turned a swallowed read into a stored refusal, gated the new sentence on the module's own place-shape test, gave the recovery helper a third argument and added eight offline cases and three page cases, so ten module and client lines and those eleven cases are pinned, and to 176 by iteration 72: the model-failure wording fix replaced two cited chat.js lines in place and wrote a nine-case offline file and a new lib module that its own ledger paragraph quotes by number, so both call sites, the worker line whose text is no longer echoed, the six lines that build the four sentences and seven lines of the two test files are pinned, and to 191 by iteration 73: the same two defects on the dictation panel grew the classifier by a second frame and a second recovery clause and put the corrupt-file cause above the runtime cause, so the six lines of the shared compose plus the two rewritten chat constants are pinned with it, and the pass also quotes three speech.js lines, the worker line it stops echoing, three of the fifteen offline cases and two page assertions - and the act of widening this table moved its own self-pin from 443 to 482, then to 503 and then to 524, which the docs citation for it now carries`);
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
  // Subsection 57's four pins are the transport split and the composer lines its spec header quotes. They are the
  // first pins whose citing text lives in a Playwright spec rather than the ledger: replacing that spec is exactly
  // the edit that moved both pointers, so a future rewrite that deletes them must go red here.
  for (const [file, line] of [['public/js/lib/api.js', 20], ['server/api.js', 55], ['public/js/lib/chat-context.js', 139], ['public/js/lib/chat-context.js', 147]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line the iteration-57 spec header quotes and is no longer pinned`);
  }
  // The ledger cites itself by absolute line, and iteration 57 measured those targets moving seven lines down under
  // its own prose while every guard stayed green. A narrowed table must go red here, not quietly.
  for (const line of [4001, 4085, 4781, 4791]) {
    assert.ok(pinned('docs/validation.md').includes(line), `docs/validation.md:${line} is a self-citation another subsection resolves and is no longer pinned`);
  }
  // And the same for the file that carries the handoff bullets: subsection 56 points at two of its lines by number,
  // and one of them has already moved once while every guard stayed green.
  for (const line of [933, 1057]) {
    assert.ok(pinned('AGENTS.md').includes(line), `AGENTS.md:${line} is a line docs/validation.md cites by number and is no longer pinned`);
  }
  // Subsection 57's own eight numbers, in the file this iteration rewrote whole. A rewrite is the worst case for a
  // line citation - nothing about it is line-neutral - and the ledger now quotes this spec by line as evidence for
  // what the cases assert, so deleting any of these eight has to be a decision made here rather than an accident.
  for (const line of [71, 73, 89, 93, 96, 104, 220, 248]) {
    assert.ok(pinned('tests/e2e/chat-evidence-panel.spec.js').includes(line), `chat-evidence-panel.spec.js:${line} is a line subsection 57 quotes by number and is no longer pinned`);
  }
  // Subsection 59's own statements: the composer clear that loses the message, the two lines of the catch that report
  // and restore, the reverse-lookup call site that no branch catches, the length rule that makes the 400 unreachable by
  // typing, and the four spec lines the ledger quotes as its evidence. Iteration 59 moved the last of the catch lines by
  // inserting above it, so a future rewrite of this block that drops any of them has to be a decision made here.
  for (const [file, line] of [['public/js/modules/chat.js', 91], ['public/js/modules/chat.js', 149], ['public/js/modules/chat.js', 154],
    ['public/js/modules/chat.js', 155], ['public/js/modules/chat.js', 156], ['public/js/modules/chat.js', 159],
    ['public/js/modules/workflow-assistant.js', 557], ['server/api.js', 46]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line subsection 59 quotes while changing it and is no longer pinned`);
  }
  for (const line of [26, 54, 76, 97]) {
    assert.ok(pinned('tests/e2e/chat-refused-ask-keeps-question.spec.js').includes(line), `chat-refused-ask-keeps-question.spec.js:${line} is a line subsection 59 quotes as its evidence and is no longer pinned`);
  }
  // Subsection 61's own eight numbers plus the ±1 repair band this iteration re-pointed by tool rather than by hand.
  for (const [file, line] of [['public/js/modules/workflow-assistant.js', 248], ['public/js/modules/workflow-assistant.js', 463],
    ['public/js/modules/workflow-assistant.js', 618], ['public/js/modules/workflow-assistant.js', 785],
    ['public/js/modules/context.js', 249], ['public/js/modules/context.js', 251],
    ['public/js/lib/api.js', 13], ['tests/e2e/place-list-refused.spec.js', 36], ['tests/e2e/place-list-refused.spec.js', 100], ['docs/validation.md', 1007], ['docs/validation.md', 1021], ['docs/validation.md', 1035], ['tests/documentation-citation-anchors.test.js', 524]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line subsection 61 quotes while changing it and is no longer pinned`);
  }
  // Subsection 65 deletes a line out of the coordinate branch it then quotes, so the helper the branch answers
  // through, the guard that reaches it, the single read it now shares, the cache that keeps that read warm, three
  // of its six offline cases and its page case are named here too: a later narrowing has to decide so here.
  for (const [file, line] of [['public/js/modules/workflow-assistant.js', 260],
    ['public/js/modules/workflow-assistant.js', 564], ['public/js/modules/workflow-assistant.js', 565],
    ['public/js/modules/workflow-assistant.js', 734], ['tests/workflow-place-choices.test.js', 777],
    ['tests/workflow-place-choices.test.js', 829], ['tests/workflow-place-choices.test.js', 855],
    ['tests/e2e/chat-refused-ask-keeps-question.spec.js', 113], ['server/context/locations.js', 9]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line subsection 65 quotes while changing it and is no longer pinned`);
  }
  // Subsection 66 moves two patterns to module scope, gates a saved-list read on a new condition, makes one sentence
  // reachable that had never rendered, and adds an offline file and a page spec the ledger quotes by line. All of those
  // are named here so a future pass that drops a pin has to decide to do it: the shared patterns, the veto, the gate,
  // the cancellation reply, the rule exactPlaceRow declines a duplicated town name on, and four of the new cases.
  for (const [file, line] of [['public/js/modules/workflow-assistant.js', 7], ['public/js/modules/workflow-assistant.js', 309],
    ['public/js/modules/workflow-assistant.js', 320], ['public/js/modules/workflow-assistant.js', 328],
    ['public/js/modules/workflow-assistant.js', 350], ['public/js/modules/workflow-assistant.js', 749],
    ['tests/workflow-bare-place-name.test.js', 51], ['tests/workflow-bare-place-name.test.js', 132],
    ['tests/e2e/chat-bare-place-name.spec.js', 31], ['tests/e2e/chat-bare-place-name.spec.js', 76]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line subsection 66 quotes while changing it and is no longer pinned`);
  }
  // Subsection 67 replaces a `.catch(() => null)` with a stored refusal, gates the new sentence on `mentionPhrase`,
  // gives the recovery helper a third argument and pins the result in eleven cases. The gate is the part a later pass
  // is most likely to "simplify" away, so the bound, both lines of its comment and every case that depends on it are
  // named here rather than left to a table size.
  for (const [file, line] of [['public/js/modules/workflow-assistant.js', 206], ['public/js/modules/workflow-assistant.js', 208],
    ['public/js/modules/workflow-assistant.js', 254], ['public/js/modules/workflow-assistant.js', 337],
    ['public/js/modules/workflow-assistant.js', 338], ['public/js/modules/workflow-assistant.js', 339],
    ['public/js/modules/workflow-assistant.js', 340], ['public/js/modules/workflow-assistant.js', 345],
    ['public/js/modules/workflow-assistant.js', 346], ['public/js/lib/api.js', 52],
    ['tests/workflow-place-name-refused.test.js', 70], ['tests/workflow-place-name-refused.test.js', 145],
    ['tests/workflow-place-name-refused.test.js', 175], ['tests/e2e/place-name-list-refused.spec.js', 57],
    ['tests/e2e/place-name-list-refused.spec.js', 112]]) {
    assert.ok(pinned(file).includes(line), `${file}:${line} is a line subsection 67 quotes while changing it and is no longer pinned`);
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
  // Iteration 57's two transport pins drifted for real on this very branch - the numbers 18 and 49 in the browser
  // client and the server handler pointed one and six lines above their targets - and one line was enough to move
  // them, so both replays below are single insertions rather than the two-line shape the iteration-50 draft used.
  const apiOriginal = await linesOf('public/js/lib/api.js');
  // Iteration 61 pinned two more statements in this file (the identity carrier at :13 and its definition at :60/:70), so
  // the fixed insertion point above the Worker line would have left them where they were and the assertion would again be
  // counting the wrong denominator. Same repair as the /api/ask replay below: insert above the earliest pinned statement.
  const apiPins = PINS.filter(pin => pin.file === 'public/js/lib/api.js');
  const apiFirst = Math.min(...apiPins.map(pin => pin.line));
  const apiDrifted = [...apiOriginal.slice(0, apiFirst - 1), '  const inserted = 1;', ...apiOriginal.slice(apiFirst - 1)];
  assert.deepEqual(mismatches(apiOriginal, apiPins), [], 'the shipped tree must satisfy the Worker-transport pin before the drift is replayed');
  const apiCaught = mismatches(apiDrifted, apiPins);
  assert.ok(apiCaught.length === apiPins.length, `the drift left ${apiPins.length - apiCaught.length} of ${apiPins.length} transport pins passing, so one line inserted above the Worker statement would not be reported`);
  assert.ok(apiDrifted.length === apiOriginal.length + 1, 'the transport replay must be a one-line insertion');
  const askOriginal = await linesOf('server/api.js');
  // Iteration 59 pinned a second, higher statement in this file (the 1-500 length rule at :46, beside the route ordering
  // rule at :55), so a fixed insertion point below :46 would leave that pin in place and the assertion would be counting
  // the wrong denominator. The replay now inserts above the earliest pinned statement in the file, which moves all of them.
  const askPins = PINS.filter(pin => pin.file === 'server/api.js');
  const askFirst = Math.min(...askPins.map(pin => pin.line));
  const askDrifted = [...askOriginal.slice(0, askFirst - 1), '  const inserted = 1;', ...askOriginal.slice(askFirst - 1)];
  assert.deepEqual(mismatches(askOriginal, askPins), [], 'the shipped tree must satisfy the /api/ask pins before the drift is replayed');
  const askCaught = mismatches(askDrifted, askPins);
  assert.ok(askCaught.length === askPins.length, `the drift left ${askPins.length - askCaught.length} of ${askPins.length} /api/ask pins passing, so one line inserted above that guard would not be reported`);
  assert.ok(askDrifted.length === askOriginal.length + 1, 'the /api/ask replay must be a one-line insertion');
  // The ledger's own shape: iteration 57 inserted 7 lines of prose above two self-citation targets and nothing said
  // so. One line above the first of them must be enough for this guard to name every moved citation, which is why the
  // insertion point is measured from the table rather than fixed at 4000: iteration 61's three self-citations at 1007,
  // 1021 and 1035 sat above that point and stayed green, which is the same wrong denominator iteration 59 recorded.
  const ledgerOriginal = await linesOf('docs/validation.md');
  const ledgerPins = PINS.filter(pin => pin.file === 'docs/validation.md'), ledgerFirst = Math.min(...ledgerPins.map(pin => pin.line));
  const ledgerDrifted = [...ledgerOriginal.slice(0, ledgerFirst - 1), '  one line of prose inserted above a self-citation target', ...ledgerOriginal.slice(ledgerFirst - 1)];
  assert.deepEqual(mismatches(ledgerOriginal, ledgerPins), [], 'the shipped ledger must satisfy its own pins before the drift is replayed');
  const ledgerCaught = mismatches(ledgerDrifted, ledgerPins);
  assert.ok(ledgerCaught.length === ledgerPins.length, `the drift left ${ledgerPins.length - ledgerCaught.length} of ${ledgerPins.length} ledger pins passing, so prose inserted above a self-citation target would not be reported`);
  assert.ok(ledgerDrifted.length === ledgerOriginal.length + 1, 'the ledger replay must also be a one-line insertion');
  // The direction iteration 57 actually measured: the citing paragraph stayed put and the cited file grew. Four
  // lines of citation repair inserted into AGENTS.md above the iteration-43 bullet is what moved the name
  // pass-through sentence from :1053 to :1057, so the replay adds the same four lines and expects both numbers.
  const agentsOriginal = await linesOf('AGENTS.md');
  const agentsDrifted = [...agentsOriginal.slice(0, 932), '  one bullet line', '  two bullet lines', '  three bullet lines', '  four bullet lines', ...agentsOriginal.slice(932)];
  const agentsPins = PINS.filter(pin => pin.file === 'AGENTS.md');
  assert.deepEqual(mismatches(agentsOriginal, agentsPins), [], 'the shipped AGENTS.md must satisfy its own pins before the drift is replayed');
  const agentsCaught = mismatches(agentsDrifted, agentsPins);
  assert.ok(agentsCaught.length === agentsPins.length, `the drift left ${agentsPins.length - agentsCaught.length} of ${agentsPins.length} AGENTS.md pins passing, so lines inserted above a cited bullet would not be reported`);
  assert.ok(agentsDrifted.length === agentsOriginal.length + 4, 'the AGENTS.md replay must be the four-line insertion this iteration made');
  // The file this iteration rewrote whole, pinned by the eight numbers its own ledger paragraph quotes. One line
  // above the shared stub list moves all eight; an insertion point below any pin would catch a subset, which this
  // case reports rather than passing, because an insertion point that catches nothing is the blind guard.
  const specOriginal = await linesOf('tests/e2e/chat-evidence-panel.spec.js');
  const specDrifted = [...specOriginal.slice(0, 70), '  const inserted = 1;', ...specOriginal.slice(70)];
  const specPins = PINS.filter(pin => pin.file === 'tests/e2e/chat-evidence-panel.spec.js');
  assert.deepEqual(mismatches(specOriginal, specPins), [], 'the shipped spec must satisfy its own pins before the drift is replayed');
  const specCaught = mismatches(specDrifted, specPins);
  assert.ok(specPins.length === 8, `the spec holds ${specPins.length} pins, not the eight subsection 57 writes about, so the replay below proves nothing`);
  assert.ok(specCaught.length === specPins.length, `the drift left ${specPins.length - specCaught.length} of ${specPins.length} spec pins passing, so a line inserted above the panel helpers would not be reported`);
  assert.ok(specDrifted.length === specOriginal.length + 1, 'the spec replay must be a one-line insertion');
});

// The six replays above each pick one insertion point per file, so they prove the guard notices drift somewhere in a
// file. Iteration 59 put two pins 9 lines apart in the same file, which made the gap visible: an insertion between them
// moved the lower pin and left the upper one green, and the fixed replay points could never have shown that. This
// replay asks the narrower question of every entry - would a single line landing on this pin's number still read as the
// quoted statement, because the neighbouring line says the same thing - so a pin that only looks specific cannot ride
// along on an adjacent line.
test('no pin is satisfied by the statement above or below the line it names', async () => {
  const byFile = new Map();
  for (const pin of PINS) byFile.set(pin.file, byFile.get(pin.file) ?? await linesOf(pin.file));
  const ambiguous = [];
  for (const [file, lines] of byFile) {
    for (const pin of PINS.filter(entry => entry.file === file)) {
      assert.ok(pin.line >= 2, `${file}:${pin.line} is pinned to the first line, which has no line above it to replay a drift against`);
      // One line inserted above the pin pushes the pinned statement down, so the pin's number now holds the old
      // previous line; one line deleted above it pulls the old next line up onto the pin's number.
      const shifts = {
        'a line inserted above': [...lines.slice(0, pin.line - 1), lines[pin.line - 2], ...lines.slice(pin.line - 1)],
        'a line deleted above': [...lines.slice(0, pin.line - 1), ...lines.slice(pin.line)],
      };
      for (const [shape, drifted] of Object.entries(shifts)) {
        if (mismatches(drifted, [pin]).length === 0) ambiguous.push(`${file}:${pin.line} still matches ${JSON.stringify(pin.quote)} after ${shape}, so this pin cannot report a one-line drift`);
      }
    }
  }
  assert.ok(ambiguous.length === 0, `pins a one-line drift would leave green:\n${ambiguous.join('\n')}`);
});

// ── iteration 75, F14: what a clickable deep link owes the reader ─────────────────────────────────────────────────
// The pins above certify a `file:NNN` number against the bytes sitting at that number, and the anchor case at
// tests/documentation-citations.test.js:139 certifies a markdown link's label against the `#LNNN` its click carries.
// Neither reads the third thing a deep link asserts: that the band the label names holds the rule the sentence around
// it describes. Iteration 67 measured the gap while repairing the *target* of this ledger's three links
// (docs/validation.md:1007, :1021 and :1035; docs/evidence/iter67-f10-deeplink-repair-2026-11-20.log.gz, whose row at
// tests/documentation-evidence-index.test.js:1435 still quotes the pre-repair labels): all three pointed at code that
// does not contain the rule, one of them at a bare `}`. The census that reopened this on 21 Nov
// (artifacts/scratch/iter75/label-census.mjs) counted 43 tracked markdown files, 3 labelled deep links, 0 unresolved
// targets and 0 labels that name anything but a coordinate. Iteration 67 then pinned those three labels *as text*, so
// the strongest guard on the branch required the wrong numbers to keep being written.
//
// DEEP_LINKS is the layer that was missing: one row per clickable link, naming the bytes its band must contain and the
// line a click has to land on. The table is graded against a fresh scan of the tracked prose in both directions, so a
// new link cannot join the tree ungraded and a row cannot be deleted to make a stale link true. The label rule is the
// half F14 complained about: a label must carry the band the row cites and must name at least one identifier the cited
// bytes contain, which a coordinate-only label cannot do.
const DEEP_LINKS = new Map([
  ['docs/validation.md:1007', {
    file: 'public/js/modules/workflow-assistant.js', from: 472, to: 477, anchor: 477,
    quotes: ['const allowEponymousTown = namedRegions.length === 0 || Boolean(regionFilter);'],
  }],
  ['docs/validation.md:1021', {
    file: 'public/js/modules/workflow-assistant.js', from: 675, to: 686, anchor: 675,
    quotes: [
      'if (replySpelling === countrySpelling && !regionMentions.length && !townMentions.length',
      'const level = regionName ? `a town in ${regionName}`',
      'or choose Whole ${countryName} for the country overview. Nothing was selected.',
    ],
  }],
  ['docs/validation.md:1035', {
    file: 'public/js/modules/workflow-assistant.js', from: 502, to: 506, anchor: 506,
    quotes: [
      'const rowCarriesReply = [...places.regions, ...places.places]',
      'if (replySpelling === countrySpelling && !rowCarriesReply) { regionMentions = []; townMentions = []; }',
    ],
  }],
  // The three rows below take this table from three pointers to six, and they are not the F14 class. They are iteration
  // 66's prose, which named `regionRecovery()` beside a `workflow-assistant.js:315` that has not held that closure since
  // code was inserted above it - a drift of 149 lines, invisible to every instrument on the branch because the drift
  // scout is differential: it compares a cited line to the same ordinal in HEAD, so a pointer that moves 20 lines per
  // commit never shows up as having moved. Queued as F18; repaired here as clickable pointers, which this table grades.
  ['docs/validation.md:1555', {
    file: 'public/js/modules/workflow-assistant.js', from: 508, to: 521, anchor: 521,
    quotes: ['const placeRecovery = () => {', 'const regionRecovery = () => {'],
  }],
  ['AGENTS.md:605', {
    file: 'public/js/modules/workflow-assistant.js', from: 521, to: 527, anchor: 521,
    quotes: ['const regionRecovery = () => {', 'const prompt = areaPrompt(countryName, null, places);'],
  }],
  // Its sibling in the same paragraph cited `:442` for "the fallthrough chooses by the pending question", which is a
  // comment three lines above the country-spelling rule and nowhere near either branch. The branches are 599-600.
  ['AGENTS.md:607', {
    file: 'public/js/modules/workflow-assistant.js', from: 666, to: 667, anchor: 666,
    quotes: ['return regionRecovery();', "return scope === 'area' || areaRegion ? placeRecovery() : null;"],
  }],
  // The last two rows point back at this file. F18's mechanism is that a pointer and the bytes it names drift apart with
  // nobody watching, and the guard that catches that for the six prose pointers was itself cited by nothing: adding a
  // case here moves the table's own tail, so this pass says so in the ledger instead of the next one discovering it.
  // Neither band may contain the row that quotes it - a quote whose own text sits inside the band it grades is the
  // vacuous instrument iteration 67 recorded as F15 - so both point below the table, at the scanner and the judgement.
  ['docs/validation.md:8028', {
    file: 'tests/documentation-citation-anchors.test.js', from: 629, to: 643, anchor: 629,
    quotes: ['async function foundDeepLinks() {', 'if (line.length > 2000) return;', 'return links;'],
  }],
  ['docs/validation.md:8026', {
    file: 'tests/documentation-citation-anchors.test.js', from: 647, to: 668, anchor: 647,
    quotes: ['function deepLinkProblems(link, row, targetLines) {', 'const out = [];'],
  }],
]);

// Same shape as the anchor case's ANCHORED, widened to carry the label: the two scanners have to disagree about
// nothing, because a link one of them can see and the other cannot is a link graded by neither.
const DEEP_LINK = /\[([^\]]+)\]\(([^()\s[\]]*?)#L(\d+)(?:-L\d+)?\)/g;
const LABEL_BAND = /[\w./-]+:(\d+)-(\d+)/g;

async function trackedFiles(pattern = null) {
  // Imported inside the call rather than at the top: a line added above this file's own pinned case is the drift
  // this guard exists to catch, and this pass has no business moving the self-pin it is re-pointing elsewhere.
  const { execFileSync } = await import('node:child_process');
  const args = pattern ? ['ls-files', '-z', pattern] : ['ls-files', '-z'];
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
}

async function foundDeepLinks() {
  const links = [];
  for (const doc of await trackedFiles('*.md')) {
    const lines = await linesOf(doc);
    lines.forEach((line, index) => {
      if (line.length > 2000) return;
      for (const match of line.matchAll(DEEP_LINK)) {
        const resolved = path.relative(ROOT, path.resolve(ROOT, path.dirname(doc), match[2])).split(path.sep).join('/');
        links.push({ key: `${doc}:${index + 1}`, label: match[1], target: match[2], resolved,
          anchor: Number(match[3]), bands: [...match[1].matchAll(LABEL_BAND)].map((b) => [Number(b[1]), Number(b[2])]) });
      }
    });
  }
  return links;
}

// One link, one row, the target's bytes: every claim the pair makes, as strings. Returning problems instead of
// asserting lets the replay below feed mutated bytes through the same judgement the shipped tree is graded by.
function deepLinkProblems(link, row, targetLines) {
  if (!link) return [];
  if (!row) return [`${link.key} links ${link.target}#L${link.anchor}, which no DEEP_LINKS row grades, so nothing reads where it lands`];
  const out = [];
  if (row.file !== link.resolved) out.push(`${link.key} row grades ${row.file} but the link resolves to ${link.resolved}`);
  if (row.anchor < row.from || row.anchor > row.to) out.push(`${link.key} row anchors line ${row.anchor} outside the band ${row.from}-${row.to} it cites`);
  if (link.anchor !== row.anchor) out.push(`${link.key} anchor is #L${link.anchor} while the row requires #L${row.anchor}, so the click no longer lands on the line the bytes are quoted from`);
  if (row.to > targetLines.length) { out.push(`${link.key} cites ${row.file}:${row.from}-${row.to} in a file of ${targetLines.length} lines`); return out; }
  if (!link.bands.some(([from, to]) => from === row.from && to === row.to)) {
    out.push(`${link.key} label reads ${JSON.stringify(link.label.slice(0, 90))} whose band ${link.bands.map(([f, t]) => `${f}-${t}`).join(', ') || 'is absent'} is not the ${row.from}-${row.to} the row grades`);
  }
  const band = targetLines.slice(row.from - 1, row.to);
  for (const quote of row.quotes) {
    if (!band.some((line) => line.includes(quote))) out.push(`${link.key} cites ${row.file}:${row.from}-${row.to} but no line in that band reads ${JSON.stringify(quote)}`);
  }
  const at = targetLines[row.anchor - 1] ?? '<no such line>';
  if (!row.quotes.some((quote) => at.includes(quote))) out.push(`${link.key} lands on ${row.file}:${row.anchor}, which reads ${JSON.stringify(at.trim().slice(0, 60))} and carries none of the quoted rule`);
  const words = (link.label.replace(LABEL_BAND, '').match(/[A-Za-z_][A-Za-z0-9_]{5,}/g) ?? []).map((w) => w.toLowerCase());
  const bandText = band.join('\n').toLowerCase();
  if (!words.some((w) => bandText.includes(w))) out.push(`${link.key} label ${JSON.stringify(link.label.slice(0, 90))} names no identifier the cited band contains, which is the coordinate-only label F14 records`);
  return out;
}

test('every labelled deep link in tracked prose resolves, and the band table grades each one and cannot be narrowed', async () => {
  const tracked = new Set(await trackedFiles());
  assert.ok(tracked.has('docs/validation.md'), 'the tracked-file scan saw no prose at all, so it would grade nothing');
  const links = await foundDeepLinks();
  const wrong = [];
  for (const link of links) {
    if (!tracked.has(link.resolved)) wrong.push(`${link.key} resolves ${link.target} to ${link.resolved}, which is not a tracked file`);
    if (link.resolved.startsWith('..')) wrong.push(`${link.key} leaves the repository through ${link.resolved}`);
  }
  const stale = [...DEEP_LINKS.keys()].filter((key) => !links.some((link) => link.key === key));
  for (const key of stale) wrong.push(`${key} has a DEEP_LINKS row but no labelled deep link is there, so the table is grading a pointer the prose no longer contains`);
  // Three links was the whole measured population on 21 Nov, six after F14 re-pointed three and F18 promoted three more,
  // and eight on 22 Nov once the ledger pointed back at this table and the function that grades it; a scan that saw none
  // would otherwise print the same clean list as one that saw all eight, which is the defect iteration 67 recorded as
  // F15. Starvation is graded before any row is called stale, because a scan that saw nothing makes every row look
  // orphaned at once and hides the cause; the message therefore names both counts so a reader can tell which side broke.
  assert.ok(links.length >= 8, `the deep-link scan saw ${links.length} clickable pointers while ${DEEP_LINKS.size} rows waited for them; the ledger has carried at least eight since iteration 75`);
  assert.ok(DEEP_LINKS.size >= 8, `the band table holds ${DEEP_LINKS.size} rows; it was written against eight links and shrinking it is a decision, not an accident`);
  assert.ok(wrong.length === 0, `deep links that resolve or are graded wrongly:\n${wrong.join('\n')}`);
});

test('a deep link band contains the rule its sentence names, and its label names that rule back', async () => {
  const links = await foundDeepLinks();
  const byFile = new Map();
  for (const link of links) {
    if (byFile.has(link.resolved)) continue;
    // A target that cannot be read is a finding this table has to state in words, not a stack trace from the reader:
    // the pointer no longer resolves, so no byte of the band it promises exists to grade against.
    try { byFile.set(link.resolved, await linesOf(link.resolved)); } catch { byFile.set(link.resolved, null); }
  }
  const wrong = [];
  for (const link of links) {
    const targetLines = byFile.get(link.resolved);
    if (targetLines === null) {
      wrong.push(`${link.key} resolves ${link.target} to ${link.resolved}, which cannot be read, so its band cannot be graded against any byte`);
      continue;
    }
    wrong.push(...deepLinkProblems(link, DEEP_LINKS.get(link.key), targetLines));
  }
  assert.ok(wrong.length === 0, `clickable pointers that do not show the reader the rule they cite:\n${wrong.join('\n')}`);
});

// The two ways this ledger has actually broken a deep link, replayed against every row so no entry can sit in the
// table unexercised: iteration 67's repair moved code above the cited band, and iteration 67's un-repaired labels
// anchored a click on a line that was a closing brace. The first is a drift the pins guard would catch in a label the
// prose cites by number; the second is invisible to every instrument that existed before this table.
test('a deep link goes red when the code moves off its band or its anchor stops carrying the rule', async () => {
  const links = await foundDeepLinks();
  const unchecked = [...DEEP_LINKS.keys()].filter((key) => !links.some((link) => link.key === key));
  assert.ok(unchecked.length === 0, `the replay cannot exercise ${unchecked.join(', ')} because no link is there to read`);
  for (const link of links) {
    const row = DEEP_LINKS.get(link.key);
    const lines = await linesOf(row.file);
    const shifted = [...lines.slice(0, row.from - 1), '  const inserted = 1;', ...lines.slice(row.from - 1)];
    assert.ok(deepLinkProblems(link, row, shifted).length > 0,
      `${link.key} still passes after one line is inserted above ${row.file}:${row.from}, so a drift off this band would stay green`);
    const brace = lines.map((line, index) => (index + 1 === row.anchor ? '}' : line));
    assert.ok(deepLinkProblems(link, row, brace).length > 0,
      `${link.key} still passes when ${row.file}:${row.anchor} becomes a bare closing brace, so the click could land off the rule unnoticed`);
    assert.deepEqual(deepLinkProblems(link, row, lines), [], `${link.key} fails on the shipped bytes, so the replay above reports a repair rather than a drift`);
  }
});
