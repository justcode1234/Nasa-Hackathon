# Automated answers to the supplied QA plan

The supplied [review plan](qa/FieldShift_QA_Test_Plan.md) is preserved as input,
including its observations from a different inspection environment. Those observations
are not treated as current test results. All 16 chatbot prompts are copied exactly
into [the prompt fixture](../tests/qa/prompts.json), with the plan's SHA-256 hash.

Run from the repository root:

```sh
npm test
npm run test:qa
```

`npm test` includes seven new contract regressions linked to F01/F02/F03, M03/M06/
M10/M11 and R2. They use the existing explicitly synthetic TEST ONLY weather fixture
inside tests. No synthetic readings enter the app or the browser acceptance runner.

`npm run test:qa` builds and serves the real static showcase in an isolated installed
Chrome browser. It runs F01–F06, sends all 16 exact questions through the real chat UI,
and records answers to R1–R7. NASA retrieval and retry use actual provider responses.
Q05 runs after Q04; Q08 and Q09 each run after Q07. Other questions start on a fresh
page to avoid inheriting unrelated farm state. Q07 also follows its scope question
through a real comparison to verify preservation of crops and rainfed input.

To check an existing public release in PowerShell:

```powershell
$env:TEST_BASE_URL = 'https://nasa-hackathon-three.vercel.app'
npm.cmd run test:qa
```

Results are written to [the readable answer report](../artifacts/qa/results.md) and
[the structured evidence](../artifacts/qa/results.json). `QA_REPORT_DIR` can change
the report directory. Each question records the exact prompt, actual paragraphs,
source links, relevant form/result state, and every passed or failed condition.
The seven review questions receive separate factual answers and evidence. R7 remains
blocked until the owner checks the authenticated NASA portal; the runner does not
submit forms or infer submission from a live website.

The QA command exits nonzero on unmet acceptance conditions or blocked automatic
checks. These results are not converted to skipped tests or a successful grade.
An unmet condition can mean an unhelpful/generic reply rather than a fabricated
scientific statement; inspect the saved answer and the individual failed condition.
These are explicit behavioral assertions, not an LLM judge or agronomic accuracy.

Each run removes its own newly created temporary browser profile. It does not remove
earlier artifacts or the user's browser data. The report is small; full browser
caches are not retained. No new browser, driver, model or dependency is downloaded.

## Coverage and remaining evidence

| Plan items | Automated evidence |
| --- | --- |
| F01–F06 | New QA UI runner: actual Australia flow, India common-crop flow, Singapore coverage, invalidation, blocked provider/retry, and no-farm question |
| Q01–Q16 | New QA UI runner: exact questions, context sequences, actual answers and explicit criteria |
| R01/R02 | Current sourced catalog and country records; live F01/F03 verify demo behavior |
| R03/R04/R06 | Visible pre-comparison planning text and actual fresh-browser NASA evidence |
| R05 | Aggregate result of the plan's specified Q02/Q07/Q11/Q14 questions |
| R07 | BLOCKED: owner portal verification required |
| M03/M06/M10/M11 | New contract tests for validation, paired soil inputs, all priorities and irrigation limits |
| M01/M02/M04/M05/M08/M09/M12/M13/M14 | Existing unit, static-browser, Node-browser and Firefox checks; the new QA run overlaps some checks but does not claim to replace the entire manual flow |
| M07 | Existing crop-family/nonadjacent-repeat regressions in rotation.test.js |

Real mobile hardware, independent agronomic assessment, subjective readability,
and portal eligibility/submission remain outside automatic acceptance.

## Initial baseline before assistant fixes

The initial development-machine baseline was 79/79 passing. After adding the seven
contract regressions, `npm.cmd test` passed 86/86. The runner completed all six
priority flows and all 16 prompts on the real local showcase, then repeated them
on the public Vercel origin with a fresh browser profile. The public run passed
6/6 flows and 7/16 prompts; nine prompts failed explicit acceptance conditions.
The seven review questions yielded five passes, one failure (R5, missing explicit
confidence limitations in Q14), and one blocked owner check (R7, portal submission).
Both new temporary profiles were successfully removed.

The saved [baseline answer report](qa/baseline-results.md) and
[full JSON evidence](qa/baseline-results.json) preserve the initial failed run.
That baseline QA command exited **1** for the following behaviors:

| IDs | Actual gap exposed by the exact prompt |
| --- | --- |
| Q03 | Kai lan information omits its screening-eligibility boundary |
| Q08 | The comma in “whole country, not a farm” is interpreted as a crop list |
| Q09 | A combined state/town/coordinate sentence does not apply its coordinates |
| Q10 | A pea/bean family question is routed into location selection |
| Q12 | The reply does not address the supplied high pH and flooding |
| Q13/Q14/Q16 | Generic guidance/crop facts omit an explicit yield, confidence or guarantee limitation |
| Q15 | The grain-maize versus sweet-corn question is routed into crop-list validation |

These are recorded baseline gaps; the report does not equate every failed
condition with an invented scientific value.

## Assistant improvement verification

The shared answer and workflow parsers now address all nine gaps. Current local
model-disabled and model-enabled runs pass all sixteen questions and six flows.
The test criteria and original question text have not been relaxed. Use
`$env:QA_MODEL='1'; npm.cmd run test:qa` to require actual model loading/inference;
omit QA_MODEL for deterministic fallback. Each report identifies the mode and
captures model metrics alongside actual replies. Retrained weights and public
deployment are still being evaluated; final reports will replace latest-results
only after verification. Portal submission remains an owner check.
