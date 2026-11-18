# Validation record — current release candidate

## Repository documentation review - 15 November 2026

On separate branch `review/submission-accuracy`, application source base `4f9b8b3`:

- `npm ci --ignore-scripts`: pinned dependencies installed, 0 audit vulnerabilities.
- `npm.cmd run test:release`: **119/119 offline and 116/116 Playwright**, exit 0,
  no skipped/flaky/unexpected results; browser duration 19.8 minutes. Static and
  Node runtimes at desktop/mobile widths exercise the four-module workflow, real
  field discovery, real NASA retrieval/retry, exact baseline preservation and two
  alternatives, invalidation, accessibility, preview 3D/GIBS/terrain and speech fixtures.
- Separate logged-out production run of workflow.spec.js, review-phase-a.spec.js
  and assistant.spec.js: **16/16** desktop/mobile cases, 32 original QA question
  executions, no skipped/flaky/unexpected results. Public source remains Phase A;
  these cases do not claim public 3D/voice support.
- Fourteen selected public assets match main f4c4fef by SHA-256; eleven protected
  submission/licence/package/config files match the review base byte for byte.
- New documentation local links and checker syntax pass. External references:
  35/45 ordinary GETs reachable; eight 403 restrictions and two connection/redirect
  failures remain flagged. UMN's maturity table and an official UF/IFAS PDF were
  independently retrieved through the web reader; IRRI remained unavailable.
- Singapore's confusing whole-country to region prompt reproduced in fresh public
  contexts at both widths, with no page errors and no assumed field coordinates.
  This documentation review records the issue; it does not fix that product flow.

Raw log, summary, all 116 original browser results (gzip), public report, source
hashes, URL outcomes and screenshots: [repository accuracy report](submission-accuracy-review.md#verification)
and `docs/evidence/repository-review-*`. No tests weakened/removed, no dependencies
added, no CSS/application edits, no merge/deployment/portal edit. This review did
not run fresh Firefox/Safari/real-phone or real-microphone/audible-speech checks.

The following sections preserve earlier release/feature checkpoints; their counts
describe those dated runs, not the fresh review above.

Date: 2026-11-15 (local). This section supersedes the earlier planning assumptions; the user selected a Node.js backend for local testing alongside a browser-only static Vercel showcase. Previously recorded styling is preserved; no CSS polishing was added.

## Review-plan Phase A — released and verified

The deck now uses York/Australia, a country-validated three-crop fixture and real
NASA POWER 2025 observations; the generated engine result is saved under
docs/evidence/submission-comparison-current.json. It correctly reports family
repetition rather than the old impossible UK/radish example. Seven-slide layout
and seven-page PDF checks pass. The model timings now use the same dated shipped-
model benchmark as the submission text. National comparison coverage recomputes
to 89/197, and radish's missing FAOSTAT mapping is explicit.

Node source probes returned 11 complete fields west of Ames and 8 south of
Naivasha. The full release check passed 95 offline and 32 Playwright cases, exit 0,
across all four runtime/viewport projects. Send/Escape, all four examples and exact
submission sequences pass. Usable height is 73.0%, 65.7%, 68.8% at the three specified
short viewports, all with document scrolling and no horizontal overflow. Full
Leaflet/MIT licence content is asserted, and the Node credit/licence routes pass.
Raw report: docs/evidence/phase-a-playwright-local.json. The public deployment of
70eafb1 passes all 16 desktop/mobile cases, exit 0, with no skips/flaky/unexpected
results. All 21 app, model, licence and submission assets match the build. Raw
public cases: phase-a-playwright-public.json; hashes: phase-a-public-assets.json.
This is the submission candidate; further B/C work uses previews to keep production
fixed. Owner portal submission remains unverified and is not implied by deployment.

## Next/Compare regression and Playwright release gate

The reported step-3 block was real: the previous tests checked disabled Compare,
but did not assert an actionable Next recovery or a visible explanation. A new
Playwright test failed against public release 28572af after the actual Next click:
the expected location panel stayed hidden. No missing crop rule was invented to
make comparison available. New readiness guidance explains country coverage gaps,
unchecked alternatives or missing NASA evidence; Next routes to the relevant
control without clearing farmer entries. NASA failures now open the evidence tab
and expose Retry. Navigation and Compare are disabled during an active comparison.

The local release check passed **95 offline tests and 16 Playwright tests**, with
zero skipped, flaky or unexpected results in its JSON report. Four projects cover
the Node/static transports at desktop and phone widths. Each project executes
three UI flows plus all sixteen original QA questions (64 question executions).
The first QA test-port attempt tried clicking Unload inside collapsed settings;
Playwright correctly rejected that hidden control. The test now opens the settings
as a user would. This was a test-helper failure, preserved separately from the
reproduced public Next defect. Default action timeouts bound future stalls.

The existing 33 Chrome checks (including the optional model) and 18 Firefox checks
also passed after this UI change. The mobile coverage screenshot was inspected:
the complete reason and recovery control remain visible while the form scrolls.

`npm run test:release` is required before future behavior releases. Details and
failure artifacts: [Playwright checks](playwright.md). The public fix passes all
8 Playwright desktop/mobile cases, including 32 exact original QA question
executions. Both release commands returned exit code 0, with zero skips, flaky
outcomes or unexpected results. The successful comparison checks assert the exact
three-crop baseline and three distinct sequences, not just the number of cards.
App source `0fe50ce1fd20179f6bfad7fe327981314e9eb6ea`, deployment
`dpl_uzcTt6tDRGxXKXwBVHHE2kz1fhnX`; fourteen public assets matched the build.
Current raw reports and file hashes: docs/evidence/playwright-local.json,
playwright-public.json, public-navigation-assets.json and navigation-release.json.
Older public reports below describe earlier releases.

## Assistant improvements — verified local and public release

The nine QA failures have targeted shared answer/parser fixes. The local showcase
now passes **16/16 exact prompts and 6/6 flows**, both with the shipped compact
model disabled and enabled. Both runs use real providers. `npm.cmd test` passes
**93/93**, including additional phrasings, regional/coordinate disagreement,
town-distance checks and explicit scientific capability limits. The Node-backed
browser workflow also passes; durable reports are under docs/evidence and docs/qa.
The accepted 39,274-parameter model has 157,096 weight bytes. It
matched 14/36 new free-form development questions versus 8/36 before, and 85/126
overall versus 83/126; legacy matches fell 75/90 to 71/90. Vocabulary uses training
rows only, and checkpoint selection uses validation data. The first answer-only
candidate was rejected. Exact comparison/failures and integrity hashes are in
models/README.md and public/models/fieldshift-mini/evaluation.json.

Current checks: 93 offline, 33 static Chrome, 19 Node-backed Chrome and 18 Firefox
workflow checks passed, plus 16/16 QA questions and 6/6 flows with the accepted
model enabled and disabled. The separate benchmark exercised actual generation,
load, inference, reload and process-memory snapshots. All default Python cells in
the three Jupyter notebooks passed; optional Python training remained disabled.
The public Vercel origin passes all sixteen questions and six flows with the model
enabled and disabled, and all 33 full Chrome checks. Fifteen public assets matched
the build for app source `0d2c71789951e9eead08e0b6139a4938b7cf6ced`; production
deployment `dpl_EerXCncopFA9U7H6UZXG6AoTkBuw`. The [latest answer report](qa/latest-results.md)
contains actual public replies and asset/fixture/grader attribution; the
[model-off report](qa/public-model-off-results.md) verifies fallback. All temporary
profiles were removed. Six review checks pass; R07 portal submission remains
unverified and owner-controlled. No perfect-model or independent agronomic
validation claim is made.

Node mode separately passed actual compact-model load, inference, generation,
unload/reload and immediate evidence answers: 157,096 weight bytes, 16.5 ms
inference, 6.7 ms evidence response in that observed run. Reproduce with
`$env:BENCH_NODE='1'; node scripts/benchmark-mini-lm.js`. Raw evidence:
docs/evidence/mini-lm-node-benchmark.json. Model-on static benchmark and memory
limitations remain in the model card.

## Exact QA-plan questions — initial baseline before fixes

The supplied QA plan is now executable via `npm run test:qa`, with all 16 exact
chatbot prompts and factual answers to its seven review questions. Seven new
contract regressions brought `npm test` to **86/86 passing**. Local and public
browser runs used actual NASA/provider responses and completed all requested cases.
The public run passed **6/6 priority flows and 7/16 prompts**; nine prompt expectations
were unmet. Review questions: 5 pass, 1 fail, 1 blocked (owner portal verification).
These failures include scope/coordinate parsing, missed crop-family/pH context,
grain-maize distinction and absent explicit limits for yield/confidence/guarantees.
Baseline replies and grades remain in [the saved report](qa/baseline-results.md)
and [JSON evidence](qa/baseline-results.json). See [coverage](qa-regression.md).
That baseline command exited 1. The subsequent fixes above close these acceptance
gaps; the original failed evidence remains available for comparison.

## Previously verified release workflow

Latest chat/action verification: **79 offline tests, 33 static Chrome checks,
19 Node-backed Chrome checks and 18 Firefox checks passed**. Both browser delivery
paths completed the chat-only flow: choose India, ask for a specific location,
verify supplied 18.5204°, 73.8567° coordinates against Nominatim, apply the supplied
rice → wheat → bean baseline and rainfed constraint, retrieve actual NASA POWER
data and open three scenarios in step 4. Rice/wheat remain explicitly unassessed.
Greetings, kai lan/Singapore, rice/India, focused follow-up buttons and expandable
sources passed. Knowledge questions leave map selection unchanged and cannot
append another country's weather. Offline action tests cover missing inputs,
current field-ID validation, explicit field numbering, country disagreement,
unsupported allowed crops, provider failure and cancellation after manual edits.
No generated code or model-selected actions are executed.

Geographic-scope checks now cover the first question (“Which part of India … or
the whole country?”), both buttons, national FAOSTAT context with no point weather
or comparison, naming Maharashtra to filter towns, and continuing to step 4 without
re-entering the supplied crops. Offline cases also cover typed whole-country
variants, switching from a selected field, narrowing directly to Punjab, other
countries and absent national coverage. Whole-country mode never runs a field
comparison or substitutes an arbitrary country point.

Production verification also passed **33 public Chrome checks** on
https://nasa-hackathon-three.vercel.app/ at source 05a66cc. The optional model loaded,
inferred and unloaded, and chat completed India planning through step 4 using real
NASA data. Thirteen public files matched local build SHA-256 values; HTTP 200 assets
include the source ZIP/PDF and model files. /api/health returns 404 for this static
showcase. Checkpoint reports are docs/evidence/public-browser-validation.json and
public-file-validation.json; docs/deployment.md records exact release attribution.

## Executed checks

- `npm.cmd test`: **79 passing tests**. Adapter units/fill/absence, schema changes, cache/coalescing, failures, equal horizons, crop restrictions/country filters, family repeats, pH/drainage, rain-free exposure, leap/year boundaries, static build, model topology/weight integrity, embedding-gradient arithmetic, location-lookup races, process-memory bookkeeping and isolated startup reuse/port collision are covered. Offline scientific observations are explicitly labelled synthetic test inputs only.
- `npm.cmd run build`: emits `dist/client`, local Leaflet, the browser core worker and static model files. Country-sized GeoNames place files are included without entering the initial worker bundle. No Vercel functions, backend URL or secrets. Static-preview `/api/health` returns 404.
- `npm.cmd run start`: prebuilds, opens the browser and serves the app. A repeat invocation reuses the same project's preview without EADDRINUSE; an unrelated server keeps its port. Both branches passed actual HTTP tests and the CLI reuse was executed.
- `TEST_MODEL=1 npm.cmd run test:browser`: **33 passing checks** in Chrome 157.0.8103.79, 1280×1000 desktop and 390×844 mobile emulation, against a freshly built static preview. Correct 01–04 numbering, Next/Back controls, country selection/list changes and insufficient-coverage gating passed. Real named-place search, OSM field dropdown/selection, NASA charts/metadata, country pest lookup, nine dated crop slots, source-linked answers, invalidation, unassessed wheat, keyboard tabs and page-width overflow were checked. A UI-only held-country-response fixture verified that editing coordinates cancels an earlier pending evidence submission; it supplies no NASA observations. The compact language model loaded/inferred/unloaded. Blocking the data worker's actual NASA request yielded a visible error and disabled stale comparison. No `/api` network request occurred; no uncaught JS/CSP errors or unexpected external-resource failures.
- `node scripts/firefox-validation.js`: **18 passing checks** in installed Firefox 160.0 using native WebDriver BiDi, an isolated profile and the real static build. Real NASA charts, country crops, three timelines, unsupported wheat, input invalidation, a 390px viewport and real arrow-key navigation passed. Blocking the model runtime preserved sourced chat; removing the block allowed WASM model load/inference/unload. Blocking the actual worker NASA request produced an error and disabled comparison. No backend `/api` request or uncaught JavaScript exception occurred. Raw evidence: `docs/evidence/firefox-validation.json`. No browser or driver was downloaded. `npm run test:firefox` now aliases the same script.
- `node scripts/check-sourced-context.js`: a **static-only** preview retrieved real NASA and SoilGrids data at the York validation coordinate, showed dated ABS totals/derived ratios, left measured farm pH empty and returned sourced soil/water chat facts. No local backend API existed in that preview.
- `npm.cmd run test:live`: real POWER 2025 retrievals at Perth, Minneapolis and Nairobi had all five parameters available in those requests, with different seasonal temperature series. Latest non-missing date within each request was 2025-12-31. All five response units were checked. This does not establish crop suitability.
- All default code cells in `llm_training.ipynb`, `si_experiments.ipynb` and `pretrained_llm_finetuning.ipynb` executed with Python 3.14.7. Artifact inspection works; optional Python training paths correctly skip. No Python TensorFlow training/export is claimed.
- The deck was rendered in Chrome, checked for clipped content and exported as **exactly seven PDF pages**. Final deck/source packaging checks are repeated after content updates.

Raw reports and fixed model evidence are published in docs/evidence/ and source model evaluation files; local screenshots/profiles remain in ignored artifacts/.

## Compact language-model experiment

The accepted clean browser TensorFlow.js 4.22.0/WASM run trained a word-level Embedding(24) → LSTM(48) → Dense(word vocabulary) model for 50 epochs. It has 29,200 parameters and 116,800 weight bytes. It predicts next words, not classifier topic logits. A developer continuation was actually generated; raw generated words never become scientific app output.

The corpus is labelled DEVELOPMENT/synthetic question wording with source-linked explanatory continuations, not fabricated NASA readings or human-reviewed farmer data. Splits share topic vocabulary, and the vocabulary included held-out wording. Results are optimistic development evidence: 75/90 expected topic selections; only 9/18 free-form cases. Full failures remain in public/models/fieldshift-mini/evaluation.json. No agronomic accuracy or confidence is inferred.

One Chrome/WASM run: 903 ms cold load, 652.6 ms warm load, 84 ms neural inference and 10 ms first evidence answer. Weights: 116,800 bytes. Resident initialized tensors: 116,800 bytes; WASM heap capacity: 16 MiB. Full peak browser/process memory and real mobile behavior are unmeasured. Timings are one test machine, not guarantees. Sourced evidence renders before inference and remains if the model is inconclusive, unloaded or unavailable.

The latest resumed benchmark adds process-memory evidence and is documented in the extended G4 section below. Raw counters are in `docs/evidence/mini-lm-benchmark-latest.json`; the original timing report remains in `docs/evidence/mini-lm-benchmark-initial.json`. Exact full-session peak memory remains unmeasured.

## Observed failures and fixes

- The first new public release passed crop-country UI checks but its optional model
  failed to load: a broad models/ entry in .vercelignore also removed public/models.
  The ignore is now anchored to /models/. Deployment dry-run checks must explicitly
  require the three model loading files. The corrected release passed the complete
  public browser flow, including actual model load/inference/unload.
- The resumed clean-checkout run passed 36/37 tests: startup could serve HTTP 404 while a concurrent deployment test was still creating `dist/client`. Startup tests now serve isolated temporary fixtures. A third startup check verifies that a preview serving another directory is never reused. Normal `npm start` still serves `dist/client`.
- A reproduced country-lookup race reused a previous location's pending request after coordinates changed. Lookups now coalesce only within the same location revision; an old completion cannot clear a newer task. Two UI regression tests cover moving during lookup and an outdated lookup failure. Evidence submissions also stop if inputs change while awaiting country identification.
- Browser validation previously served the Node test harness despite production being static. It now builds and serves the actual static preview before checking the workflow, with the same Vercel headers.
- PowerShell blocks npm.ps1 here: use npm.cmd. No execution-policy change was made.
- Public Overpass instances timed out/were overloaded; bounded OSM map JSON worked and is used instead. No invented fields filled failures.
- Initial port-3000 repeat-start failed with EADDRINUSE. Startup now identifies/reuses this project or finds a free port and opens the browser.
- TensorFlow.js' regenerator fallback initially violated strict CSP. Predeclaring its global binding allowed initialization without unsafe-eval.
- An early CPU model run was interrupted by a backend-switch race and produced no accepted weights. A clean initialized WASM run completed. Missing WASM UnsortedSegmentSum for embedding gradients was implemented as a bounded row sum and checked before training.
- A 12.5 MB TinyStories candidate loaded quickly but failed both evidence-following questions and was rejected. The earlier 184 MB SmolLM2 baseline was too slow for the user's default experience; it is not the shipped model.
- The first deck layout clipped a table; measured layout was corrected and the seven-page export checked again.
- Original tab numbers followed internal module IDs rather than the user path; visible headings/tabs now run 01–04. Persistent Next/Back navigation was exercised, including NASA loading, valid comparison submission and missing-input validation. Screenshot review found a grid-placement gap that hid crop selection; crop controls now precede context on mobile and sit beside it on desktop.
- Country lists now use the verified FAOSTAT bulk snapshot; the obsolete Fenix API returned HTTP 521. Australia/UK choices differ, foreign selections clear, and Singapore's missing starter-rule coverage blocks comparisons. No generic list substitutes for absent country evidence.
- Page-only network interception did not block worker fetches; the browser test now attaches to the actual data worker. Its network-failure test genuinely blocks the external NASA request.

## Scientific and deployment limits

Global map coverage is not worldwide agronomic validation. The crop catalog and pest list are small. SoilGrids is regional background, not farm soil evidence; ABS ratios are historical national practices, not irrigation prescriptions. No water demand, nitrogen credit, yield, savings, soil improvement, pest prevention or economic outcome is predicted.

Safari/WebKit, real mobile hardware, independent farmer-question evaluation, measured soil/crop-water balances, exact full-session memory peaks and broader local agronomy remain unverified. Chrome process-tree phase snapshots and Firefox workflow evidence now exist, with their limits documented below. These limits are disclosed rather than marked passed.

The exact challenge brief and supplied Explorer team page were successfully read from their public rendered-data streams. The team is Explorer, Singapore, and was unsubmitted at inspection. The general NASA November 15 local-time deadline and seven-slide/30-second format were verified from official sources; the team owner must check event-specific portal exceptions and perform submission.

The live Vercel production deployment is verified in the current release record above. The earlier private Sites exploration was never published and its adapter was removed. No NASA submission was made by these tools.

Final release checks: 64 own JavaScript files passed `node --check`; the static preview served the app, seven-page PDF, source ZIP and exact 116,800-byte model weights (HTTP 200). `/api/health` returned 404. The source ZIP was reopened and every file checked against its SHA-256 manifest; it excludes local browser profiles, dependencies, secrets and build outputs. Desktop and 390px screenshots were reviewed after the workflow changes. No public source push or production deployment is implied by local packaging.

## Gate status after the resumed audit

- **G0–G3:** existing contracts and sourced starter crops retained; the current unit, HTTP, live NASA and static-browser checks verify the implemented bounded workflow. No worldwide agronomic validation is implied.
- **G4:** the two reproduced failures above are fixed and regression checks pass. Real mobile hardware, Safari/WebKit, independent agronomic review and exact full-session memory peaks remain unverified; G4 is not declared fully complete.
- **G5:** local submission files exist. No new CSS polishing, public deployment, source push or portal submission was performed in this audit. Account access and user review remain necessary for those external steps.

## Extended G4 evidence - Firefox and process memory

The latest `node scripts/benchmark-mini-lm.js` run records 228.2 ms first model initialization in that run, 184 ms reload, 13.8 ms inference and 2.3 ms first evidence answer. Earlier measurements remain historical samples, not a speedup comparison. Full raw process counters now accompany the latest report.

Windows process snapshots: 556,417,024 bytes aggregate working set before model use; 607,367,168 after load/inference; 748,978,176 after the extra developer generation/reload check. Maximum sampled private memory was 354,177,024 bytes. Sum of observed per-process lifetime peak working sets was 798,654,464 bytes. The approximate 1 GB target was assessed with these observations, not declared universally met. Shared pages may be counted more than once; lifetime peaks are not necessarily simultaneous; short-lived processes between snapshots can be missed. Exact full-session peak and mobile-device behavior remain unknown. See models/README.md for method and primary counter documentation.

The first Firefox validation attempt stopped at a test-only label assertion expecting the short country name. FAOSTAT uses the longer United Kingdom name; the assertion was corrected to accept that sourced name. The subsequent full 10-check run passed; this was not a product data substitution. Firefox's narrow screenshot was reviewed. No CSS changes were made.

The user resolved the architecture question by requesting both Node testing and a Vercel showcase. Publishing still requires suitable authenticated hosting access. The Vercel connector is still uninstalled and no CLI/project auth was found in this read-only check. The goal remains active; no deployment, public source push or portal submission is claimed.

## Dual-runtime and guided-location validation

- The user requested Node.js for testing and a Vercel showcase. `npm run start:node` now serves real backend endpoints and explicitly marks the frontend transport as HTTP. `npm run start:showcase` and `npm start` keep the static-worker build. Ports default to 3001 and 3000 respectively, and runtime-specific preview identities prevent cross-mode reuse. Unit/HTTP checks cover coexistence, restart reuse and entry markers.
- `npm.cmd run test:node-browser`: **19 passing checks** against the Node-backed frontend in Chrome. The test blocked browser NASA access and the browser data-worker script, yet real NASA observations, comparison timelines and sourced questions worked through Node HTTP APIs. The optional model was explicitly unloaded. A test-only upstream failure reached the UI without substitute observations, disabled comparison and recovered on retry. Country/town browsing selected Cambridge through the Node list endpoint. Raw evidence: `docs/evidence/node-browser-validation.json`.
- The static Chrome run now passes **25 checks**, including country -> region -> town selection without typing, country-change clearing, real NASA, optional model loading/unloading and actual worker-request failure. Firefox passes **10 checks** on the current static build. The original Node test attempt incorrectly expected page-level CDN blocking to force a worker-model failure and timed out; the accepted Node check explicitly unloads the model instead. Firefox independently exercises actual model-runtime blocking.
- GeoNames snapshot: **70,036 places / 245 countries and areas**. Offline checks verify every country file's SHA-256, byte count, source coordinates, region join and IDs, plus missing-country coverage, malformed responses and failure/retry. The full raw city dump is not bundled into the initial worker. Country lists total 4,254,070 bytes; the largest is 453,783 bytes. A selected town is a location reference, not a farm or agricultural recommendation.
- A reproduced scientific-scope bug mapped unspecified maize/corn to sweet-corn maturity. Generic aliases were removed. Two regression tests now keep those baseline names unassessed and restrict sourced sweet-corn answers to explicit sweet-corn names in both runtimes.
- A source-data edge case supplies blank administrative-region codes for some towns. The optional filter now uses a distinct All-regions value; selecting Region not recorded genuinely filters that subset. The Node-backed browser check exercises this with the UK list. The mobile picker screenshot was reviewed. Added slide copy initially overflowed slide 3; shorter copy restored the verified seven-page layout without CSS changes.

The main scientific limits remain: four starter crop types, a historical-year analogue, no crop water balance or validated global planting advice. Real mobile hardware, Safari/WebKit and exact full-session peak memory remain unverified. Vercel publication and portal submission have not occurred.

## Claude Code review — 2026-11-15 (commit 8b53619, no code changes kept)

Executed: `npm test` 95/95 pass; `npm run test:e2e` 16/16 pass (static/Node × desktop/
mobile). A scratch Playwright audit (outside the repo) found:
- axe-core 4.10.2 (WCAG 2.2 AA + best practice): 0 violations in 10 states.
- Public site matched the local build.
- The country→region→town path works.

Defects found (see docs/plans/2026-11-15-review-fixes-and-3d-plan.md, section 1):
- Usable content is 54–78 px at 200% zoom and 127 px in phone landscape.
- Chat focus is lost after clicking Send.
- Ames and Naivasha example regions return 0 mapped fields.
- Only 89/197 countries can produce a comparison.
- Deck slide 4 is not reproducible in the current app.
- Step-4 uncertainty text is unlabelled.

These are open until fixed and re-tested.

## Phase B checkpoint - 2026-11-15

Work is isolated on feature/review-phase-b. Production stays frozen at f4c4fef.
Seven sourced screening crops now cover 166/197 countries. Generic maize, Napa
cabbage and green onions remain distinct. Results/evidence wording, archived unused
workers, tighter CSP, favicon/arrows and axe licence delivery are implemented.
CSS consolidation produced identical computed styles/geometry and pixel-identical
initial/planning screenshots at 1366x768, 1280x1000 and 390x844.

Executed: 99 offline tests pass. The first focused desktop run passed axe in all five
states and actual model-on Q01/Q03/Q16; the human field path failed. Overpass has
25-second timeouts, one fallback, partial-response rejection and visible retry, but
real probes failed for all four examples on both providers. The full release suite
is running; failed live fields must stay red. No fabricated replacement fields or
production deployment. V0-only MapLibre feasibility measurements may proceed; the
application dependency and V1 still need the plan's explicit approval.

## Verified Phase B / V0 checkpoint - 15 November 2026

`npm.cmd run test:release` exited 1: 99/99 offline pass; 36/44 Playwright pass,
8 fail, 0 skipped/flaky. All failures are live field selection/example checks on
both runtimes and viewports. All 20 axe scans and model-on Q01/Q03/Q16 in all four
projects pass. An additional four field transport-failure/retry UI tests pass.
Raw reports: docs/evidence/phase-b-playwright-local.json and phase-b-playwright-retry.json.
No Phase B behavior release or deployment is authorized while the gate is red.
Production remains f4c4fef. The source/PDF submission artifacts remain the frozen
Phase A version; regenerate them only for a qualified later release.

V0 has measured real globe/terrain rendering, source metadata, native POWER centres
and WebGL-disabled fallback; see docs/3d-feasibility.md. It downloads pinned renderer
files only into ignored artifacts, never public or package.json. Approval of the
application dependency is pending. V1-V5 remain unimplemented.

## Field outage follow-up - 15 November, 04:23 UTC

A fresh actual-browser probe captured both Overpass requests ending with
net::ERR_ABORTED at the configured 25-second deadlines, with no console/CSP errors.
Both service status endpoints also failed 10-second probes from this device.
This does not establish global service availability; it identifies the current
local request failure. Evidence: phase-b-field-network-diagnostic.json and
phase-b-service-status-recheck.json under docs/evidence.

The field error now explains that the user can continue with the selected point.
The enhanced failure case exercises Retry, preserves coordinates, loads real NASA
data and completes a tomato/cabbage/onion baseline comparison in all four projects:
4/4 pass, 0 skips/flaky outcomes (phase-b-playwright-field-degradation.json).
The first test draft used a role locator after its panel became hidden; that test
locator was corrected before the accepted 4/4 run. Actual-field success checks
remain unchanged and still block release. The complete suite enumerates 48 cases;
no complete green 48-case run is claimed.

Production index/CSS/app/core-worker hashes were rechecked against the frozen Phase A
manifest; all four match (phase-a-freeze-recheck.json). A reusable real-browser
diagnostic is scripts/diagnose-fields.js (writes artifacts/field-network-diagnostic.json
and exits nonzero if fewer than three fields return). The original browser probe
was executed; the reusable wrapper has syntax validation. The V0 benchmark's
Playwright timeout argument was corrected to the options position; the previously
measured fast rendering result is unchanged. MapLibre approval remains pending.

## Preview approval and security fix - 15 November 2026

The user approved preview implementation, keeping Leaflet default. Installing the
approved 5.24.0 package revealed CVE-2026-85061 (GHSA-jrc7-96c5-q579), a critical
attribution sanitizer bypass affecting versions through 6.4.0. The upstream fix
starts at 6.4.1: https://github.com/advisories/GHSA-jrc7-96c5-q579 . We switched to
exact 6.4.1 to fix the approved dependency, rather than shipping the vulnerable
version. This is the same optional MapLibre renderer, with no new service/account.
`npm audit` reports zero vulnerabilities. The release predates the two-week gate.

Repeated isolated desktop measurements: 1.68 seconds interactive, 60 fps, 672.3 MB
maximum sampled process working set. JS/CSS/modules total 1,150,828 bytes raw and
293,319 bytes gzip. Version 6 uses three ES modules and a same-origin module worker;
the initial terrain benchmark exposed a missing self permission in the experiment
worker CSP. Fixing that permission and setting projection before terrain restored
actual terrain rendering. A console favicon 404 in that run was fixed afterward.
Raw results: docs/evidence/maplibre-6.4.1-benchmark.json and package-size.json.
These replace the 5.24 measurements for the approved preview; real-phone and
combined-model memory remain unmeasured. Production remains frozen.

## V1 native rainfall columns - verified locally, 15 November

The approved optional map is now inside the existing geospatial step, with Leaflet
2D default. MapLibre 6.4.1 (security-fixed) and its three ES modules/CSS/licence
are vendored and lazy-loaded. Both Node and worker use the new bounded
/api/power-grid adapter. Native MERRA-2 centres use the documented origin and
spacing; midpoint bounds wrap the date line and clip at poles. Date-line requests
show one actual native-centre point response rather than invented neighbours.

Monthly rain columns have a zero baseline and an explicitly labelled display scale.
Null and true zero differ; missing months hatch, partial sums keep valid-day counts.
The month control synchronises exact selected-cell values and the existing evidence
table highlight. The API retains units, dates, source, native spacing, retrieval
time and missingness. No crop recommendation or imagery-derived value was added.
Changing point/year closes stale 3D state. Rapid close/reopen cleanup is isolated
per renderer instance so an old load cannot remove a newer map.

Executed: npm test 104/104; full V1 Playwright 16/16 across static/Node and
desktop/mobile, with no skips/flaky results. This includes real NASA values,
nonblank screenshot pixels, slider/table equality, blocked WebGL fallback, provider
failure/real retry, and delayed-module location-change races. npm audit: zero
vulnerabilities. Reports: v1-playwright-complete.json, v1-native-rain-fixture.json
and maplibre-6.4.1-audit.json under docs/evidence. The first pixel test read a
renderer framebuffer before paint; it now checks actual screenshot pixels.

No deployment: Phase B's actual field-success gate still fails. A fresh 06:47 UTC
status probe still timed out at both Overpass hosts from this device. V2 imagery,
V3 terrain/field context, V4 strategy linkage and V5 complete validation remain.

## V2 dated NASA imagery - locally verified, 15 November

Added on-demand GIBS controls inside the existing 3D map: NDVI, SMAP L4 surface
soil moisture, IMERG precipitation rate and MODIS daytime land-surface temperature.
Node and browser worker share /api/gibs-layers. The adapter parses current WMTS
capabilities into a fixed product allowlist, native product resolution, exact
availability intervals/default dates, maximum tile zoom, templates and legends.
Gaps and invalid dates are rejected; XML entities/foreign resource hosts are not
accepted. Metadata is cached with its original retrieval time. Units/resolution
were checked against NASA Worldview's own product descriptions: NDVI 250 m;
SMAP model-derived top-5-cm moisture 9 km in m3/m3; IMERG 0.1-degree source grid
in mm/hour; MODIS LST 1 km in K. Tile zoom is not native product resolution.

Layers are labelled imagery, values not extracted; POWER data and crop screening
never read map colours. The user chooses an advertised date, can adjust opacity,
and can turn imagery off. Coverage and overzoom limits remain visible. Metadata
failures have a real retry; tile failures leave a visible notice and the rain table.
No provider failures are replaced with made-up imagery or dates.

Executed: 107/107 offline tests; 12/12 GIBS browser cases across four projects,
covering all four real products (16 selections), real metadata retry and aborted
tile transport. V1's 16-case report is retained separately. Three-dimensional tests
deliberately abort unrelated field transport rather than hammering Overpass; the
eight separate real-field success checks remain mandatory release blockers.
Reports: docs/evidence/v2-playwright-complete.json and v2-gibs-metadata.json.
Small subsequent lifecycle guards avoid updates after map closure. A final complete
release/a11y/performance run is still required after V3/V4. Production is frozen.

## V3 terrain and field context - implemented, partial live verification

Added shared Node/worker terrain-point and terrain-context endpoints. Terrarium
PNG decoding validates CRCs, dimensions, filters, bounded decompression and missing
pixels with no new dependency. Field context masks pixel centres against a Polygon
and its holes; gradients use unexaggerated central differences with actual Web
Mercator ground sampling. Circular aspect handles north wrapping and cancellation.
Fewer than nine valid gradients leaves slope/aspect unassessed; nine is an
engineering support threshold, not agronomic validation or a confidence percentage.
Analysis is limited to 1,000 vertices, 50,000 candidate pixels and nine zoom-12 tiles.
Dateline-crossing fields and non-Mercator polar areas remain explicitly unsupported.

The optional view has DEM terrain, hillshade, an explicit x1/x2/x3 exaggeration
control, selected-point marker and selected-field fill/outline when present.
Terrain view hides scaled rain columns; returning to regional/globe restores them.
Exaggeration changes display only. Missing terrain has an actual retry and no
substituted values. Full provider attribution is shipped and linked. The DEM is a
mosaic including SRTM and other sources, not uniformly NASA, a current survey or
an erosion/crop prediction. Per-tile source headers are retained when exposed;
file modification dates are not acquisition dates.

Executed: 112/112 offline tests, including known RGB pixels independently checked
with Pillow, malformed PNG rejection, synthetic plane slopes/aspects, hole masks,
small-field gaps and cache/failure contracts. Eight real-terrain browser cases pass
across static/Node and desktop/mobile: actual pixels, sampling, x1 default, numeric
invariance under x2, explicit no-field gap, tile/API failure and real retry.

A one-object provenance check (not a discovery fallback) captured two previously
known OSM outlines. The Ames Node HTTP endpoint assessed 907 gradients, median
slope 0.9768 degrees, circular aspect 77.96 degrees, using NED mosaic tiles.
The Naivasha outline had only five gradients and correctly stayed unassessed;
its sources include SRTM/GMTED. These are derived DEM examples, not surveyed farm
facts. The actual browser field-selection/drape path is still unverified because
Overpass has not returned the field list. Those original live success tests are
unchanged and still block release. No recorded outline substitutes for them.
Evidence: docs/evidence/v3-*. V4 strategy linkage and V5 full validation remain;
production is frozen and no new branch has been deployed.


## V4 exact strategy weather windows; V5 focused review - 15 November 2026

A supported crop-slot button opens 3D at the exact upper-maturity assessment
window used by the strategy. Shared historicalWindow/rainIndicators functions
serve both paths; the UI does not approximate the four-month slot. Daily selected
cell/point equality and exact strategy sum, valid-day, partial, zero-run and leap
checks reject stale or different weather. Reference calendar dates wrap December;
a missing reference leap day maps to February 28 exactly as before. The map table,
legend and overlapping full-month evidence rows follow the window, with an explicit
warning that whole-month rows are not partial-window totals. Monthly browsing is
paused/hidden until Return to monthly view. Constraint edits remove the linked
window; location/year changes still close and dispose 3D. Unsupported slots have
no invented weather-window action.

Executed: npm test 114/114; focused weather-window + map3d-review Playwright 8/8
across all four projects, including 24 axe scans, no CSP/page errors, reduced
motion, no idle camera movement, short-screen layout and focus return. The review
caught a real missing OSM connect-src permission (MapLibre uses fetch rather than
Leaflet image loading); both Node/static policies now allow the exact tile host.
The before-fix failure is retained in v5-csp-regression-before-fix.json; passing
focused report is v4-v5-playwright-focused.json. A later tiny UI change hides the
paused month control; the complete release run will recheck it.

The actual full application benchmark, including native POWER data, dated NDVI,
terrain and a loaded compact model with actual inference, measured 2.899 s desktop
and 1.619 s phone-sized open-to-data, about 60 fps, and 846.6 / 762.0 MB maximum
sampled working set. Zero renderer requests before opt-in; zero page/CSP errors or
observed HTTP error responses. Model inference completed but its proposed topic
was rejected by the grounded-answer guard; this is not model accuracy evidence.
The 293,319-byte gzip lazy renderer remains unchanged. Report and screenshots:
docs/evidence/v5-app-*. Both runs used desktop headless Chrome; real phone memory,
exact full-session peak and the live-field path are unverified. Benchmark script:
node scripts/benchmark-3d-app.js (build first). Its first attempt failed at a wrong
Close-button locator; the corrected run completed both viewports.

The existing real-example field test now also requires the live-returned Ames
outline to render on terrain with derived slope context; no fixture can satisfy
it. This new section has not yet executed past discovery. The 07:58 UTC curl status
probe received HTTP 406 from overpass-api.de; earlier app probes timed out. Do not
try alternate identities to bypass rejection. The required full release, real
field selection/drape, user visual signoff and preview delivery remain open.
Production remains frozen at Phase A and nothing was pushed or deployed.


## V5 full-run checkpoint and visual approval

The user approved the current actual 3D visuals for preview on 15 November 2026.
No further visual approval is needed for this reviewed layout. Production remains
frozen; this approval does not waive the failed release gate.

npm run test:release completed: 114/114 offline and 84/92 browser cases passed,
eight field-lookup failures, zero skips/flaky cases. Each project has 21 passes and
two field failures. All original 16 QA prompts ran in every project (64 executions),
and the four model-on cases ran Q01/Q03/Q16 (12 executions). All 44 axe state scans
passed: 20 existing flow states and 24 3D/crop-window states. All point terrain,
GIBS, native-cell, exact crop-window, fallback, retry, focus and reduced-motion
cases passed in the complete run. Current product sources were unchanged during
the run except the branch-only Git deployment suppression metadata.

The Node desktop trace shows Cambridge /api/farms returned 200 and its field count
passed before York returned 502; service availability is partial/unreliable, not
proven globally down. The Ames drape assertion was unreachable behind earlier
example failures, so it has been moved into a standalone real-discovery test.
The original every-example and human-path success requirements remain intact.
The new standalone four-project run is in progress. No saved outline is injected.

Complete failure summary: docs/evidence/v5-release-summary.json. The report with
actual replies/values is v5-release.json; the original report is preserved losslessly
as v5-release.raw.json.gz with its SHA-256. Large passed-rule axe node lists are
compacted only in the readable copy; failure details and raw evidence are retained.
This avoids committing repeated multi-megabyte passed-node lists. Current public
core assets still match Phase A (v5-production-freeze.json); remote main remains
f4c4fef. No behavior release has been made.


## Added user requests - 15 November 2026

The user approved the 3D visual direction for preview. The separate live Ames
field-terrain test failed in all four projects at field discovery (v5-field-terrain.json).
The live field-selection/drape path remains unverified; future full release now
contains 96 browser cases, including the standalone field case. Do not deploy.

New authorized work: add small English-only STT and TTS with a mic icon/control in
chat, loaded on demand, and investigate/train a compact local classification/
decision model inspired by TypeSafe AI Jev. The user corrected the earlier JEPA/
LeJEPA interpretation: do NOT build JEPA. Reference supplied: https://jevtypesafe.org/ .
That page identifies itself as an unofficial third-party host, so verify TypeSafe's
own documentation before making claims. Do not call a locally trained classifier
Jev, claim access to proprietary weights, or assume exponential speedup. Benchmark
schema correctness, held-out performance, abstention and latency against the existing
rule engine and tiny language model. Keep validated actions/scientific rules final.
No cloud model/account/paid service is authorized by these requests; prefer local.
Speech transcripts should be editable before Send; voice playback must use the
actual grounded response and have Stop/Unload controls. Real microphone permission
comes only from an explicit mic click. No audio was recorded in the research step.

Research so far: OpenAI whisper-tiny.en explicitly has English-only training and
39M parameters; Xenova provides ONNX exports for Transformers.js. KittenTTS Nano
int8 advertises 15M parameters and about 25 MB, but its exact English-only training
provenance/runtime still needs verification. The official KittenTTS web SDK docs
mention optional analytics (must be off); npm @kittentts/web currently returns 404,
so do not pretend that advertised install works. No new speech dependency has yet
been installed. Current registry Transformers.js is 4.3.2; evaluate/pin only after
review and browser feasibility. The previous HF workers remain archived; any new
speech-only runtime needs an explicit narrow CSP and licence update.


## Green release gate, field fix, voice and judgment checks - 15 November 2026

Executed in this session (development desktop, installed Chrome via Playwright):

| Check | Result |
| --- | --- |
| Live Ames field -> terrain drape -> slope, four projects (after lookup fix) | 4/4 passed (was 0/4) |
| Full release after lookup fix | 114/114 offline; 95/96 browser. One example-regions case failed when all three Overpass services stayed busy for 75 s (7 attempts) |
| Speech specs, four projects | 20/20 passed |
| **Final `npm run test:release`** | **117/117 offline; 116/116 browser; 0 skipped; 0 flaky; 0 user retries needed** |
| npm audit | 0 vulnerabilities |

Evidence: docs/evidence/v5-field-fix-release.json, v5-field-terrain-after-fix.raw.json,
v5-green-release-summary.json (+ .raw.json.gz, .log.gz), speech-playwright.raw.json.gz.

Voice input measurements (same machine, each project): transcript exactly "Tell me
about tomatoes in Kenya."; model download 43,536,374 bytes; load 3.3-3.5 s; inference
1.67-1.74 s for about 4 s of audio. The runtime WASM (26.9 MB) is additional. Tests
assert that no non-GET request leaves the machine during dictation, that no chat
message is sent, that no country is selected, and that a refused microphone triggers
no model download.

Typed-judgment experiment, 95 held-out messages (second evaluation; see
models/judgment/README.md): action 77 (rules 75, majority 73), unsupported 80 (81, 78),
topic 43 (50, 22). Not wired into the app.

Not verified: real phones or tablets, real microphones, accents and noise, memory
use of the speech model, Safari/Firefox voice input, audible read-aloud output (only
text, voice choice and Stop are checked), availability of the public field services
at any other time, and independent review of classifier labels.

## Logged-out public check and document reconciliation - 15 November 2026 (about 09:50 UTC)

- Production https://nasa-hackathon-three.vercel.app/ : the Phase A Playwright suite
  (commit f4c4fef) passed 16/16 desktop and mobile cases from fresh, logged-out
  browser contexts. The app, deck page, seven-page PDF, credits page and source ZIP
  all returned HTTP 200 without login. Production serves Phase A (no 3D view, no
  voice input). Evidence: docs/evidence/public-logged-out-check-2026-11-15.json.
- **NASA team page (public data, not logged in): `isSubmitted: false`,
  `submittedAt: null`, last saved 2026-11-15T07:53Z; the data-references and
  project-references fields were empty.** The project is a saved draft, not a
  submission. Only the team owner can submit; the deadline is 23:59 Singapore time
  on 15 November.
- README, docs/playwright.md, docs/3d-validation.md and AGENTS.md section 10 were
  reconciled with the green release gate. Older failing results are kept as history
  and marked superseded.
- The typed-judgment classifier remains an experiment; the validated rules stay in
  charge of routing.


## Final quality handoff: baseline, submission support and P0.3

At start the tree was clean on feature/3d-evidence-map at 25e9476; local/remote main
were f4c4fef. The user chose to keep Phase A public and retain all three existing
Overpass services. No merge, deployment, project setting or NASA portal edit was made.
The 09:55 UTC public NASA page still showed an unsubmitted draft and empty references;
paste-ready Phase A fields were prepared in docs/submission-fields-2026-11-15.md.
Baseline commands actually passed: npm test 117/117; npm run test:release 117 offline
and 116 browser, zero skips/flaky/unexpected. Evidence: final-quality-baseline-*.
P0.3 reviewed all ten named scientific presentation modules. The kai-lan catalog
claim now says sourced instead of validated; npm test again passed 117/117.
See docs/final-quality-review.md. User-reported Aland crop selection/chat failure
was reproduced on this branch and is not fixed yet; sourced regional context and
new prompt regressions are next. The classifier remains unwired. No dependency added.


## P0.4 completed - new crop source and exclusion checks

Live primary-source numbers match the stored tomato, head-cabbage and bulb-onion
entries; no numeric crop rules changed. Added duration-basis/pH/temperature checks
and an actual comparison contract proving Chinese cabbage, bok choy and spring
onion remain unassessed. An initial added wording assertion omitted the existing
qualifier head-cabbage; corrected that test defect to require head-cabbage
transplants. Final npm test: 119/119 pass. Source and both test-run reports are
under docs/evidence/final-quality-crop-source-probes-* and final-quality-p04-*.
The user also requested sourced local crop-type suggestions for empty areas,
aligned Back/Next controls that open chat cannot cover, and three clickable chat
starter examples. These are included in the remaining P0.6/P1 work. All three field
services are retained by explicit user decision. No new dependency or deployment.

## 15 November 2026 - merged release checkpoint (final gate pending)

Current application checkpoint: 3e82b2c; final behavior hashes are retained in
merged-release-application-source.json. All previous branch histories are ancestors
of this checkpoint. Main and production remain f4c4fef until the authorized gate
passes. 128 offline tests pass; legacy Chrome model-on 33, Node Chrome 19 and
Firefox 18 checks passed before the final small launcher correction. Original
QA 16 questions + six flows pass with model off/on (22/22 each). Their separate
review checklist has five passes and two blocked items (local run cannot establish
public-origin CORS or authenticated portal status). Independent public NASA status
is recorded separately, not retroactively inserted into those results.

Five-size before/after review covers all four steps and chat, with 3D/terrain after
captures. It caught a closed-launcher overlap on short screens, now fixed and
asserted. Two mobile prompt-sweep failures were test interactions under open chat;
close/change/reopen repairs the harness without removing answer or state checks.
Interrupted/failing logs are preserved. The fresh 152-case four-project gate is
running; do not treat a partial run as a release pass.

Durable review and actual QA replies: docs/merged-release-review.md and
merged-release-* evidence. Real phones, Safari/WebKit, microphone/accent/noise,
audible voice quality, exact session memory peaks and agronomic validation remain
unverified. Installed English TTS training provenance is unverified and explicitly
accepted for this release. No dependency or classifier activation was added.

## Merged release live; whole-country chat flow fixed - 15 November 2026 (evening)

Public production (dpl_DVZLzVaybdoLsXuQf57xfVynaeq8, commit ef0e80e): 76/76 logged-out
Playwright cases passed on desktop and mobile; live assets match the tested source.

User report after release: the India starter button → "Whole India" "fails". Reproduced on
production with a real browser:
- The overview said "Your supplied crops are retained" but step 3 was empty.
- It jumped to step 3 with no location, so comparison was impossible.
- "Choose a region" then offered only a "Whole India" button (no way on by clicking).
- Picking a town in step 1 wiped the step 3 crops: every same-country location change
  briefly emptied the crop lists (context.js loadCountry) and lost the selections.
A second report: "How does Rice fit a rotation in India?" (a button the chat itself offered)
answered "I do not have a verified rotation rule" twice over.

Fixes (feature work on main, not yet pushed at the time of writing):
- Guided chat puts the farmer's crops and constraints into step 3 whenever it pauses for a
  location, so the "entered in step 3" message is true and survives manual changes.
- Whole country stays a national overview (no farm point, no weather) and stays on step 1.
  "Choose a state or region" offers three tappable regions (rule stated in the reply: the
  three with the most towns in the saved place list).
- After a manual town/field pick in step 1, chat offers "Continue planning with this
  location", which loads NASA evidence and compares.
- A new town or field in the same country no longer reloads/empties the crop lists.
- Rice and wheat rotation answers cite Cornell's grain-family grouping; apple/apricot explain
  that tree crops are not rotated season by season. Follow-up buttons appear only when there
  is sourced content (cassava no longer offers "Rotation role"). Plainer wording replaces
  "rotation-screening catalog" for profiles without their own limitation text.
Tests: new tests/e2e/whole-country-flow.spec.js (8/8 in four projects, real NASA data);
new offline regression in tests/workflow-assistant.test.js; two prompt-wording assertions
updated to the new text.

Full `npm run test:release` with these fixes (started 15:18 UTC): **129/129 offline; 156/158
browser**, 0 skipped, 0 flaky. All four whole-country-flow cases passed. The two failures were
live field lookups (static-desktop example regions; static-mobile human path): the app reported
"The field lookup services are busy or unavailable (8 / 7 attempts across 3 services). No fields
were invented." and the test's two user retries also failed. A status check immediately after
the run found all three public Overpass services unavailable (overpass-api.de connection error,
maps.mail.ru 504, overpass.private.coffee timeout). Classified as **environment**, not a product
defect; the field code was not changed. Those two cases must be re-run when the services recover.
Evidence: docs/evidence/whole-country-fix-release.raw.json.gz and .log.gz.

## 18 November 2026 - whole-matrix chat audit, country-name collisions, nonsense-town recovery

Scope: the chat-only guided flow, driven for every saved country list, every region and town name, and
every crop the app can offer, under the goal "no dead ends, no invented data, every claim backed by an
executed test".

### Executed

- `npm test` — **167 tests, 167 passed, 0 failed, 0 skipped**, including the new cases listed below. An
  earlier run in this same work passed **166/166** before the place-list-less country case was added. The
  committed deep-scan summary is `docs/evidence/deep-matrix-scan-2026-11-18.json`
  (`artifacts/` is gitignored, so the raw logs live only on the working machine).
- `npm audit` — **0 vulnerabilities**.
- `node scripts/audit-matrix.js --deep` — 245 countries, **70,036 town rows**, **66,546** names selected by
  the short-reply matcher, **7** eponymous skips, **79** names too long for a short reply and therefore
  re-verified through the production engine (79 of 79 reached a point or an explicit "Which one do you
  mean?"), **0 defects**, **0 ambiguous country names**, flow statuses
  `{ terminal: 245 }`, 19.6 s. The bounded scan gives the same zero defects with 25 names per list.
  Artifacts: `artifacts/matrix/deep-scan.json`, `artifacts/matrix/deep-scan-run3.log`,
  `artifacts/matrix/bounded-scan.json`.
- Re-run of the same deep audit after widening country recognition to every supported code:
  `countryOnlyChecked: 250` (the 245 saved lists plus AQ BV HM IO UM), `defects: []`,
  `ambiguousCountryNames: []`, `flowStatuses: { terminal: 245 }` — `artifacts/matrix/deep-scan.json`,
  generated 2026-11-17T18:55:47Z.
- Ten-country browser chat probe (`artifacts/final-quality/chat-matrix-probe.log`, TV, TO, VC, NR, GD, DJ,
  LC, DM, ST, PF, Chrome channel, Overpass aborted): found two defects, recorded below.
- Focused browser probe after the fixes (`artifacts/final-quality/fix-probe.log`, ST, PH, TV, PF):
  **0 replies without a button, 0 country-only sentences that picked a place, 0 page errors.** Every
  nonsense-town reply inside a chosen region returned the town-recovery prompt with 2–4 buttons.
- Chat-only browser probe of the five supported codes that have no saved place list, plus ST as the
  control that does (`artifacts/final-quality/listless-country-probe.log`, committed as
  `docs/evidence/listless-country-probe-2026-11-18.json`; AQ BV HM IO UM ST, Chrome
  channel, Overpass aborted, no step-1 control touched):
  **6 codes, 0 button-less replies, 0 replies naming a town control the list does not have, 0 page
  errors.** Each listless country answers "Which part of X …" with `Whole X` + `A specific area`;
  "A specific area" states "No towns are listed for X in this saved place list …" and keeps
  `Whole X`; the overview then offers `Use the map or coordinates`. ST keeps its real region and town
  buttons ("São Tomé Island" → Folha Fede / Neves / São Tomé).
- Supporting diagnostic (`artifacts/final-quality/listless-diagnose.log`, committed as
  `docs/evidence/listless-country-diagnose-2026-11-18.json`): the shipped country picker
  really does offer those codes — `#pest-country` has **251 options** including AQ and HM — which is why
  the chat must stay honest about a place list it does not have.

### Defects found and fixed

1. **A nonsense town could end the plan with no button.** In 6 of the 10 probe countries the reply after
   a town point had already been chosen was "I could not match that request…" with zero choices. Fixed in
   `public/js/modules/workflow-assistant.js`: inside a chosen region an unmatched short reply is answered
   with the town-recovery prompt (real town buttons + `Whole <country>`) even after a point exists. The
   invariant "nonsense text runs no workflow action" is kept: the recovery performs only `showStep`, and
   outside a chosen region the reply is still handed to the read-only assistant.
   Pinned by `an unmatched town typed after a town point still leaves a tappable way forward`
   (`tests/workflow-place-choices.test.js`) and by the unchanged
   `nonsense and full-width read-only questions cannot advance a pending point workflow`.
2. **A country name that contains its own region picked that region.** "Help me plan a rotation in
   São Tomé and Príncipe. Crops: rice, maize, beans. Rainfed" jumped straight to the Príncipe region and
   then to a town, skipping the country question. Nine saved lists carry this collision (AG, CD, CG, GW,
   HK, PM, SJ, ST, TT). Fixed by matching the sentence and the row names in `regionPhrase` shape and
   rejecting a place hit that falls **inside** the country-name span, instead of deleting country words.
   Pinned by `a region named inside its own country name is picked only when the farmer names the region`.
3. **A regression from the first attempt at fix 2, caught by the deep scan.** Deleting country words made
   the real Philippines row "Pamayanang University of Philippines Employment Housing Cooperative
   Subdivision" unselectable, because its own name contains "Philippines". The span rule fixes both
   directions; pinned by `a town whose own name contains the country name is still selectable`.
4. The audit itself now refuses to pass in this class again: every country is asked once with a sentence
   that names only the country, and a `region`/`location` action or a button-less reply is a defect.
5. **The five supported codes with no saved place list dead-ended in the chat.** `#pest-country` offers
   251 countries but the manifest holds 245 place lists, so AQ BV HM IO UM are selectable in step 1 and
   reachable by typing their names. Two real defects were behind that: the whole-country overview said
   "Choose a town … this place list has no named regions", naming a control with nothing in it, and for
   AQ the answer to "A specific area" came back with **zero buttons** — the plan could not continue from
   the chat at all. Fixed in `public/js/modules/workflow-assistant.js`: the overview now distinguishes
   "has regions" / "has towns" / "has neither" and states the map-or-coordinates route for the last one,
   and `areaPrompt` always keeps `Whole <country>` when there is no town to tap. Pinned durably by
   `a country with no saved town list keeps both routes honest and tappable` (`tests/matrix-coverage.test.js`),
   which loops every code without a list and asserts both replies keep a button and nothing is compared.
6. **Country recognition was only proven for the codes that have a place list.** The durable test and
   `scripts/audit-matrix.js` covered 245; they now cover all **250** supported codes (`countryOnlyChecked`
   in the deep scan proves the wider sweep ran), and the 16 compound `Saint …` / `… & …` spellings are
   asserted by name — `AG BA BL GS HM KN LC MF PM SH SJ ST TC TT VC WF` — so a regression reports the
   country that broke instead of failing a count. The dependency direction is pinned too: "Georgia"
   resolves to GE while "South Georgia" resolves to GS alone.
7. **A test-only flake in the read-aloud spec.** `tests/e2e/speech.spec.js` checked that "Stop speaking"
   was visible, then ran the axe scan (several seconds) before clicking it; a headless utterance can end
   inside that gap, the button flips back to "Read aloud" and the click times out. The click and its two
   assertions now run before the scan; no assertion was removed or loosened.

The tiny word model was **not** retrained: this work changed no crop/town/step vocabulary and no reply
label the model is trained on (guided replies still carry `useSelectedLocation:false`, and
`tests/model.test.js` pins the shipped 157,096-byte weight hash, which still matches). Retraining would
have invalidated that integrity pin for no behavioural change.

### Not claimed

The Playwright release suite that was running while these edits were made tested a mixed source state and
is **not** recorded as a gate; a clean full `npm run test:e2e` on the committed code is reported in the
entry above it only once it has finished. Real phones, Safari/WebKit, microphone and noise quality,
audible read-aloud quality and independent agronomic review remain unverified. No production deployment,
no NASA portal edit, no new dependency.

## 17 November 2026 - Singapore flow, chat buttons, place matching, security boundaries

All commands were run on `fix/chat-flow-and-answers` (Windows, Node v24.22.1). Main was not
pushed and nothing was deployed.

Executed:
- `npm test` → **144/144 pass, 0 fail** (129 before this work: +8 place-choice click paths in
  tests/workflow-place-choices.test.js, +6 boundaries in tests/security-boundaries.test.js, +1
  data invariant in tests/locations.test.js).
- `npm audit` → **found 0 vulnerabilities**.
- `npx playwright test tests/e2e/city-state-chat-flow.spec.js` → **8/8** (static-desktop,
  static-mobile, node-desktop, node-mobile). New spec; it clicks only what a farmer sees.
- `npx playwright test tests/e2e/assistant.spec.js tests/e2e/whole-country-flow.spec.js
  tests/e2e/workflow.spec.js tests/e2e/help-and-explanations.spec.js` → first run **56/60**;
  the four failures were one assertion in help-and-explanations.spec.js pinned to the superseded
  sentence "No named regions". That case was rewritten to the new wording **and strengthened**
  (three named town buttons, then tapping one must fill `#latitude`); re-run → **36/36**.

What the browser actually rendered in the Singapore flow (real place list, Overpass transport
deliberately aborted so field failures stay honest):
- "Help me plan a rotation in Singapore" → buttons `[Whole Singapore, A specific area]`.
- "A specific area" → "Singapore has no named regions in this place list, so no region is needed…"
  with buttons `[Admiralty, Alexandra Estate, Anak Bukit, Whole Singapore]` — the fourth button
  only exists because the chat now renders every offered choice.
- "Alexandra Estate" → "…is selected as a town point", `#latitude` filled, the Region control
  hidden, and "0 mapped fields were returned" for the aborted lookup (reported as a service
  failure, no fields invented).
- Typed "Jurong" → "Several listed towns match" with `[Jurong East, Jurong Town, Jurong West]`;
  tapping Jurong East moved the point to a different latitude.
- "Use selected point" → asks for three crops; "crops: cabbage, tomato, spinach" → "Step 4 is
  ready" with three `.scenario` cards and real NASA evidence.
- Seven messages produced seven distinct assistant replies (no repeat = no ping-pong) and zero
  `pageerror` events.

- Full `npm run test:e2e` (build + every Playwright project) → **168/168 passed in 24.9 min,
  0 failed, 0 skipped** (log: artifacts/tmp/full-e2e.log, not committed). After removing one
  unused helper constant the bundle was rebuilt and the two Singapore/chat specs were re-run:
  **22/22**, with `npm test` re-confirmed (now 144/144 after the data invariant was added).
- Read audit of the shipped place data (245 lists): exactly **18** carry no region names —
  AW BL CC CW CX EH FK GI GS MF NF NU PN SG SX TC VA VG — and every one of them still lists at
  least one named town (SG 95, AW 12, EH 7, CW 6, SX 5, GI 3, MF/TC 2, and 1 for BL CC CX FK GS
  NF NU PN VA VG), so the region-less prompt always has a real place to offer. A new
  tests/locations.test.js case asserts this and pins the count at 18.

Security pass (tests/security-boundaries.test.js, 6 cases): vercel.json headers equal
`SECURITY_HEADERS` and both servers emit them byte-for-byte; the CSP keeps `script-src` free of
`unsafe-eval`/`unsafe-inline` and keeps `object-src`/`base-uri`/`frame-ancestors` closed; no HTML
sink or runtime code compilation in app-authored browser modules; rejected coordinates, oversized
place text (2–120 characters), an unsupported `detail` value and a non-two-letter country code
never open a request or read a path, and the one accepted Overpass query is exactly the quantised
numeric bounding box; the Node preview returns 404 for four traversal spellings, 413 for an
oversized body, 415 for a non-JSON post, 405 for DELETE, and keeps the security headers on errors;
every dependency is an exact pinned version and `index.html` loads no third-party script tag.

Still unverified after this change: real phones, Safari/WebKit, microphone and read-aloud audio
quality, and independent agronomic review. Shared public Overpass services remain outside our
control; their failures are reported with their cause.

## 18 November 2026 - region-name loop, duplicate town buttons

**Branch:** `fix/chat-flow-and-answers`. **Files:** `public/js/modules/workflow-assistant.js`,
`tests/matrix-coverage.test.js`.

### Defect 8 — repeating the chosen region’s name re-asked the same question

Eleven saved lists hold a town spelled exactly like a *different* region’s name: AR “Buenos Aires”
(town row in region `07 Buenos Aires F.D.`, province row `01`), TW “Taipei”, GB “Wales”, ZA
“Mpumalanga”, CO “Córdoba”, CN “Jiangxi”, MN “Sühbaatar”, BM “Hamilton”, CI “Yamoussoukro”, WS
“Palauli”, AF “Farah”. Driving the flow with each spelling produced:

```text
r3  “Buenos Aires is selected. Now choose a town in the Town list in step 1 …”   region 01  loc null
r4  “Buenos Aires is selected. Now choose a town in the Town list in step 1 …”   region 01  loc null
```

The second reply was the region answer again: actions `…+region+region`, and no point was ever set.
`exactPlaceRow` filtered candidate towns by the already-selected region, so the only exact match left
in the list was the region the farmer had just chosen, and `respond` treated that as a new region
choice.

**Fix (interaction layer, no data change):** `exactPlaceRow` no longer returns the already-selected
region for a bare reply — it falls through to the town rows, inside the region first and then anywhere
in that country’s saved list, and returns nothing when the spelling is only a region so the
pending-question handler answers honestly. The typed-path guard now only claims “no town by that name
here” when no town carries the name at all. After the fix, the same drive gives:

```text
r4  “Buenos Aires is selected as a town point. Choose the specific field; t…”
    lat -34.61315  lon -58.37723   actions …+region+location+fields+step:location
```

Those coordinates are the saved GeoNames row, not a computed or invented point.

### Defect 9 — two identically worded buttons for two different points

Where a list holds two towns sharing a name *and* a region (PH “Quezon · Cagayan Valley”), the
disambiguation reply rendered both with the same label, and it silently showed three rows of a larger
set. Labels now append the saved latitude/longitude only when the wording collides, and the reply
states “showing 3 of N”.

### Executed

- `npm test` — **169 tests, 169 passed, 0 failed** (`tests/matrix-coverage.test.js` 13/13).
  Diagnostics from that file: *region-and-town name collisions followed in 147 countries, 10 of them
  answered with a town outside the chosen region and 0 with “not a town here”* (AR, BM, CI, CN, CO, GB,
  MN, TW, WS, ZA; US “California” resolves inside California) and *duplicate town names exercised in 49
  countries (2 of them showing 3 of a larger set)*.
- `npm audit` — **found 0 vulnerabilities**.
- The collision test now fails if the town question repeats “is selected. Now choose a town”, and it
  asserts that the outside-region case is still exercised, so the fix cannot silently become vacuous.
- `node scripts/audit-matrix.js --deep` on the committed tree — **0 defects, 0 ambiguous country
  names, 245/245 flows terminal** over 70,036 places (66,546 short-reply matches, 7 eponymous skips,
  79 names too long for a bare reply), 13.3 s
  (`docs/evidence/deep-matrix-2026-11-18-postfix.json`; log `artifacts/final-quality/deep-matrix-2026-11-18-postfix.log`).
- Browser runs: an earlier queued full suite reported **180 passed (26.7 m)**, but its bundle was built
  before this fix, so it is **not** the gate for `15b76d1`. A fresh `npm run test:e2e` on the committed
  tree was started and was still running when the user asked this session to stop (log
  `artifacts/playwright/full-suite-15b76d1.log`, 56 of 180 cases reported at that moment); no gate
  number is recorded for it until its own summary line is read. A dedicated chat-only browser probe of
  the 13 collision spellings was started too, but it prints only at the end and did not finish inside the
  requested window, so it was stopped without a result. The fix is therefore verified offline across all
  147 collision countries plus the whole suite’s chat specs, **not** yet by that dedicated probe.

Still unverified: real phones, Safari/WebKit, microphone and read-aloud audio quality, independent
agronomic review, and a clean full-browser gate on this committed code.


## 18 November 2026 - country-name recognition parity across engines

Found by driving the real browser after the region-name fix: the collision probe's only
`noPointChosen` case was TW, and its reply was the button-less "Which country should we look at?".
The cause is not the place data but the country-name table in
[public/js/lib/countries.js](../public/js/lib/countries.js), which is built from one
`Intl.DisplayNames(['en'])` call. Two measured consequences:

* **The same wording resolves on one engine and not on another.** Measured in Chrome and in Node on
  18 November: PS "Palestine" vs "Palestinian Territories", HK "Hong Kong" vs "Hong Kong SAR China",
  MO "Macao" vs "Macao SAR China", GS "South Georgia & South Sandwich Islands" vs the spelled-out
  form. The step-1 picker label and the chat read the same table, so a farmer typing what their own
  browser shows could still be told the app has no idea which country they mean.
* **A parenthetical name only matches its whole phrase.** Node's "Myanmar (Burma)" and Chrome's
  "Cocos (Keeling) Islands" / "Falkland Islands (Islas Malvinas)" meant typing "Myanmar", "Cocos
  Islands" or "Burma" matched nothing at all.
* **Names our own sources use are in no table at all.** `server/context/country-crops.json` labels
  records "China, Hong Kong SAR", "China, Macao SAR", "Palestine", "Viet Nam" and "North Macedonia",
  and the FAO/IOC name for TW is "Chinese Taipei"; none of those spellings resolved.

Fix, all inside the recognition layer: merge the `en-001` table, split each parenthetical display
name into its whole phrase, its phrase without the parenthesis and the parenthesis alone, and add the
curated spellings above (ISO 3166-1 short names and the spellings this project already ships). A bare
abbreviation such as "in US Virgin Islands" no longer adds the United States as a second country: the
`in|from <abbr>` rule now only fires when no full display name already claimed that span. The 250-code
table now holds 297 recognised spellings on Node v22 (more on engines whose tables keep the
parenthetical halves), and `countryNameForms()` is exported so the tests walk the real table instead of
a hand-picked list.

**Executed**

* `npm test` **173/173** (169 before, plus the new
  [tests/country-name-recognition.test.js](../tests/country-name-recognition.test.js) 4/4: every form
  resolves to its own country and no other; the alternate-spelling table; the no-absorption and
  no-invented-country probes; the guided flow finishing step 1 from "Chinese Taipei").
* `npm audit` 0 vulnerabilities.
* `node scripts/audit-matrix.js --deep` on this tree: **0 defects, 0 ambiguous country names,
  245/245 flows terminal** over 70,036 places (66,546 short-reply matches, 7 eponymous skips, 79 names
  too long for a short reply) - [docs/evidence/deep-matrix-2026-11-18-recognition.json](evidence/deep-matrix-2026-11-18-recognition.json).
* Real Chrome, chat only, live modules on 127.0.0.1:4175: 23 typed spellings (the 19 that used to fail
  plus Georgia / China / Netherlands controls) - **0 wrong country, 0 button-less replies, 0 page
  errors** (artifacts/final-quality/recognition-chat-probe-2026-11-18.log, whose stdout also records
  Chrome's own `en` and `en-001` strings for every case). The first run of this probe printed 15
  button-less replies; that was the probe reading the user's own bubble before the assistant article
  appeared, so the wait was fixed and the whole probe re-run.
* The tiny word LM was **not** retrained: `scripts/build-mini-corpus.js` imports no country table
  (grep for `countries`/`COUNTRY` returns nothing), no reply label or place-name vocabulary changed, and
  `tests/model.test.js` still passes its sha256 pin on the shipped 157,096-byte weights.

Behaviour kept deliberately, and now recorded rather than assumed: typing the country's own name where
a saved town shares it ("Macau", "Chinese Taipei") selects that town point and says so - the same
eponymous-capital rule the audit already skips 7 of - because the reply names the point it chose and
still offers the field/whole-country buttons. What remains unverified: the full Playwright gate on this
committed code, real phones, Safari/WebKit, microphone and read-aloud audio quality, and independent
agronomic review. The "Which country should we look at?" reply for a name no engine and no source
spells still has no chat button, because every chat button sends text and the app cannot list 250
countries; it names the step-1 dropdown, which the assistant scrolls to.

## 18 November 2026 - the seven same-named towns and the country-name reply loop

### Defect 10 — a town spelled like its country could not be typed once a region was chosen

Seven saved lists hold a town whose whole name equals the country's own spelling: **Colombia** in Huila
Department (CO), **Djibouti** in Djibouti (DJ), **Luxembourg** in Luxembourg (LU), **Monaco** in the
Municipality of Monaco (MC), **Mozambique** in Nampula (MZ), **San Marino** in its own
region row San Marino (SM) and **Türkmenistan** in Ahal (TM). `allowEponymousTown` was computed as
`namedRegions.length === 0`, so in every list that *has* regions the country spelling stayed excluded
from the town matches even after the plan was asking "which town". The farmer could see the town in
step 1's list, tap it if a button offered it, but could not type it. The rule now also allows it while a
region is selected ([public/js/modules/workflow-assistant.js:222-228](file:///C:/Users/~/Documents/Life/Coding/github/Nasa-Hackathon/public/js/modules/workflow-assistant.js#L222)),
because the pending question at that point is a town question and the country overview is already
reachable through the `Whole <country>` button.

Deliberately *not* changed: the exclusion is still spelling-exact, not ASCII-folded. Folding it would
drop the real saved region rows "México", "Panamá" and "Türkmenistan" out of the suggestions and make
them untypeable - a regression for MX, PA and TM, measured before choosing.

### Defect 11 — answering a place question with the country's own name re-asked the same question

At "Which state or region of France?", typing "France" matched nothing: the reply fell through to the
same area prompt, so the chat asked itself the same thing with nothing new to tap. The long official
spellings reached it too ("South Georgia & South Sandwich Islands" is past the short-reply limit, so the
first attempt only fixed the short ones). The rule now compares the whole reply in the same canonical
shape as `regionPhrase` and answers honestly instead ([public/js/modules/workflow-assistant.js:386-397](file:///C:/Users/~/Documents/Life/Coding/github/Nasa-Hackathon/public/js/modules/workflow-assistant.js#L386)):
it names the level still missing ("a town in Nampula", "one of its regions"), offers that level's real
rows plus `Whole <country>`, and ends with "Nothing was selected." A saved row that really does carry
the country's spelling is matched earlier and still selects itself, so Guadeloupe and Martinique keep
answering their own region row rather than being refused.

### Defect 12 — the country's official spelling quietly selected the town inside it

The browser probe caught a case the offline matcher tests missed. At *"Which state or region of São Tomé
& Príncipe?"* the reply `"São Tomé & Príncipe"` answered **"São Tomé is selected as a town point. Choose
the specific field; the town itself is not farmland."** - the chat picked a place the farmer never named,
because the country's own spelling *contains* the town's spelling and `typedPlace` matched that prefix.
Defect 11's honest reply could not fire: it only ran when nothing matched at all. The narrowing rule now
requires the reply to equal a saved row's whole canonical spelling before a country-name reply may select
anything ([public/js/modules/workflow-assistant.js:250-257](file:///C:/Users/~/Documents/Life/Coding/github/Nasa-Hackathon/public/js/modules/workflow-assistant.js#L250));
otherwise the mentions are dropped and the honest reply answers instead. A town genuinely called "São
Tomé" stays typeable by that name, and the two lists whose rows really do carry the country spelling
(Guadeloupe, Martinique) still select themselves.

### Executed on this tree

* `npm test` **183/183 passed, 0 failed** -
  [artifacts/final-quality/unit-prefix-fix-2026-11-18.log](../artifacts/final-quality/unit-prefix-fix-2026-11-18.log)
  (182/182 before the Defect 12 fix:
  [artifacts/final-quality/unit-country-name-loop-2026-11-18.log](../artifacts/final-quality/unit-country-name-loop-2026-11-18.log)) -
  including the new durable test *'the country's own name never re-asks the pending place question and
  its same-named town stays typeable'* over all 245 lists x every `countryPhrasings()` spelling, plus
  three targeted tests in [tests/workflow-place-choices.test.js](../tests/workflow-place-choices.test.js)
  (LU town row selected from a Luxembourg region reply; FR region question answered with "France" then
  resolved by tapping the first region button; ST region question answered with "São Tomé & Príncipe" and
  required to select nothing). The matrix test now also fails on a *quiet narrow*: any country spelling
  that ends up reported as "is selected" without a saved row carrying that exact spelling is collected in
  `quietNarrow` and asserted empty.
* `npm audit` **0 vulnerabilities**.
* `node scripts/audit-nonsense-town.js` - `{"cases":2151,"countries":245,"failures":0,"deferredToEvidenceAnswer":54}`.
* `node scripts/audit-matrix.js --deep` - **0 defects, 0 ambiguous country names** over 70,036 place
  rows: 66,546 matched by the short-reply rules, 79 names too long for them and re-verified through the
  production engine, 3,743/3,743 named region rows selectable, and **245/245 guided flows terminal**.
  The census no longer *skips* the seven eponymous towns: `verifyEponymousTown` drives each one through
  the assistant after its own region and reports
  `eponymousNames: 7, eponymousSelected: 7`
  ([docs/evidence/chat-place-matrix-2026-11-18.json](evidence/chat-place-matrix-2026-11-18.json)).
* Real-browser chat probe (Chrome, chat only, field lookups blocked; reproducible with
  `PROBE_PORT=<served port> node scripts/chat-place-probe.mjs`, run this session from the identical
  scratch copy), 16 sessions, run twice: on
  5b4cf29 it printed `{cases:16, failures:1, pageErrors:0, townsSelectedAsTownPoints:7, honestReplies:8}`
  — the single failure was the São Tomé narrow that became Defect 12 — and on the fixed tip cbeff6b it
  printed `{cases:16, failures:0, pageErrors:0, townsSelectedAsTownPoints:7, honestReplies:9}`, with each
  of the seven same-named towns setting `#latitude` to its saved row and all nine country-name replies
  (FR, JP, BR, DE, KE, GS, ST, AQ, GP) answering differently from the pending question and keeping a
  tappable button ([docs/evidence/eponymous-and-country-name-probe-2026-11-18-final.log](evidence/eponymous-and-country-name-probe-2026-11-18-final.log),
  both summaries in [docs/evidence/chat-place-matrix-2026-11-18.json](evidence/chat-place-matrix-2026-11-18.json)
  under `browserProbe`).
* `npm run test:e2e` on 5b4cf29, **180 passed / 0 failed / 0 skipped (28.4 min)** - the summary line
  reads `180 passed (28.4m)` and the full run is kept gzipped at
  [docs/evidence/full-suite-5b4cf29-2026-11-18.log.gz](evidence/full-suite-5b4cf29-2026-11-18.log.gz) -
  across static-desktop, static-mobile, node-desktop and node-mobile on ports 4573/4574.
  The same suite for the final tip cbeff6b runs into
  [artifacts/playwright/full-suite-prefix-rule-2026-11-18.log](../artifacts/playwright/full-suite-prefix-rule-2026-11-18.log);
  only its own summary line counts as that gate, and it is recorded here when it reports.
  An unrelated background run from another workspace (`tests/e2e/chat-basic.spec.js`, which does not
  exist in this repository) is **not** counted as evidence for this project either way.

### Not verified by these checks

Everything above is headless Chrome/Node against the saved place lists and the shipped crop catalog.
Still unverified, and not inferred from these runs: real phone hardware and touch behaviour, Safari and
other WebKit browsers, microphone quality and speech recognition under real noise, the audible quality of
the installed on-device read-aloud voice, and independent agronomic review of the crop windows and
rotation reasons. Field outlines depend on shared public Overpass services and fail when those services
are busy; the probe blocks them deliberately, so nothing here proves field discovery works.

## 18 November 2026 - durable coverage for the region-less lists and the eponymous towns

**Branch:** `fix/chat-flow-and-answers`. **Files:** `tests/matrix-coverage.test.js` only.

Re-auditing the validation goal against the shipped tests, rather than against these notes, found no new
app defect but two assertions weaker than the goal requires:

* The full-list census treated *a town spelled like its own country* as expected-untyped and `continue`d
  past it, so nothing durable proved those seven rows (CO Colombia, DJ Djibouti, LU Luxembourg,
  MC Monaco, MZ Mozambique, SM San Marino, TM Türkmenistan) stayed selectable after the Fix A/C changes.
  The census now keeps them in `eponymous` **and** requires `typedPlace` to return the row when its own
  saved region is the filter; an untypeable one is reported by name.
* The seventeen lists other than Singapore had no interaction-layer test. `tests/locations.test.js` proves
  the *data* shape (18 lists without region names, each holding at least one town) and one synthetic
  Singapore case pins the wording, but a regression in the shared `areaPrompt`/`townButtons` path could
  have given Aruba, Christmas Island, the Falklands or Vatican City a buttonless area question and still
  passed everything recorded above.

The new test drives every real region-less list through the production assistant — `Help me plan a
rotation in <official country name>` then `A specific area` — and fails on: a silent reply; no town
button while the list holds towns; a missing `Whole <country>` route; the prompt offering towns without
saying the list has no named regions and is *not a recommendation*; an offered button whose label does
not equal a saved row's `name`; and a tapped button that does not put that row's own
`latitude`/`longitude` on the plan. All **18** lists (AW BL CC CW CX EH FK GI GS MF NF NU PN SG SX TC
VA VG) pass, so no name in their area prompt is unreachable from the chat.

Two more assertions turned out to be narrower than the goal requires, and both are now exhaustive:

* The town-name sweep capped itself at 100 unique names per country, so `npm test` covered 13,673 of the
  **66,632** unique town names in the saved lists and trusted the standalone script for the rest. The cap
  is gone: every unique name is typed through `typedPlace` as `Use <name>` and then `in <name>`, and only
  the residue goes through the assistant engine. That one test costs about 45 s — the file's own runtime
  went from 26.1 s to 70.3 s — and it found no new defect:
  `66632 unique town names … 79 needed the exact-row path, 7 skipped as eponymous with the
  country` — which is the same 79 and 7 the deep audit reports, now asserted in the suite.
* The unknown-town census lived only in `scripts/audit-nonsense-town.js`. The census moved into
  `tests/helpers/matrix-harness.js` as `nonsenseCensus()`; the script and a new test both call it, so the
  printed number and the asserted number cannot drift. Re-run after the move:
  `{"cases":2151,"countries":245,"failures":0,"deferredToEvidenceAnswer":54}` in 12.9 s — byte-identical
  to the pre-move result.

* `node --test tests/matrix-coverage.test.js` → **19/19 passed, 0 failed** (70.3 s).
* The region sweep prints its own bound now: **3,736** named region rows typed into the assistant, with
  the **7** rows spelled exactly like their own country (DJ, GP, GT, LU, MQ, SM, TW) covered by the
  collision and own-name tests instead — 3,736 + 7 equals the 3,743 the deep census counts.
* `npm test` → **185/185 passed, 0 failed, 0 skipped** in 78.3 s
  ([evidence/unit-exhaustive-2026-11-18.log](evidence/unit-exhaustive-2026-11-18.log)); the earlier
  184/184 run of the region-less test alone is kept at
  [evidence/unit-regionless-2026-11-18.log](evidence/unit-regionless-2026-11-18.log).
* `npm audit` → **0 vulnerabilities** (no `package.json` or lockfile change in any of these steps).
* No app module, place row, crop record or model vocabulary changed in this step, so the tiny word LM is
  not retrained and the browser numbers recorded above still describe this code.

### Not verified here either

The same list as the section above: real phones and touch, Safari/WebKit, microphone and read-aloud audio
quality, independent agronomic review, and live Overpass field discovery. In addition, the seventeen
region-less lists other than Singapore are proven at the interaction layer through the production
assistant module offline; only Singapore's equivalent has a browser-level assertion
(`tests/e2e/help-and-explanations.spec.js`, "Singapore skips unnamed regions"), so a browser-specific
rendering difference in those seventeen remains unverified.


## 18 November 2026 - the clean browser gate on the current tip, and a chat walk of every saved list

### Why this step

The goal asks for real-browser chat probes over the full matrix, not only the 16-34 country sessions
probed so far, and for the Playwright gate's own number on the code this branch now ships.

### Executed

* `npm run test:e2e` on the committed code → **180 passed, 0 failed, 0 skipped (35.8 min)**, kept at
  [evidence/e2e-full-suite-2026-11-18.log.gz](evidence/e2e-full-suite-2026-11-18.log.gz). It was launched
  on `cbeff6b`; the five commits since touch only tests, scripts and docs, because
  `git diff --name-only cbeff6b..HEAD -- public server dist` returns **0 files**. The same 180 cases
  therefore describe the app code at the current tip.
* `npm audit` on the current tip → **0 vulnerabilities**, no `package.json` or lockfile change.
* `scripts/chat-place-matrix-probe.mjs` was written for this: it opens a fresh Chrome page per saved
  list, types the country, taps "A specific area", then taps only what the assistant offers, choosing the
  row level the question actually asks for ("Which state or region of X?" → a region row; "Which town
  in …/Now choose a town/first three towns" → a town row), and requires `#latitude` to equal a saved row
  within 1e-4. The first draft preferred a town row by name and so misread **17 countries** as defects:
  at a region question a label like "Andorra la Vella", "Abu Dhabi", "Yerevan" or "Plovdiv" *is* a region
  row too, and the app answered correctly while the probe judged it wrongly. The classifier is the fix;
  no app code changed for it. A six-country smoke run (AD, SG, JP, TV, ST, PH) then set a real point in
  6/6 with 0 page errors, SG in one tap (region-less) and the others in two.
* Full run over all **245** saved lists in real Chrome, 5 concurrent pages, Overpass aborted:
  **245 cases, 242 points set, 0 page errors, 3 defects** — `statuses: {"point": 242, "buttonless": 3}`
  (`artifacts/final-quality/chat-place-matrix-probe-2026-11-18.log`). Every defect was the same class and
  it was a real one: HK "Hong Kong SAR China", MO "Macao SAR China" and PS "Palestinian Territories"
  reached *"Which country should we look at?"* with **no button at all**, so the chat could not finish
  step 1 for those spellings. The wording is what Node's Intl prints and Chrome's does not, so the
  Node-only recognition test resolved it from its own table and never saw the gap.
* Fix, in the runtime-independent alias list rather than the matching rules:
  `hong kong sar china`, `macao sar china` and `palestinian territories` are now named spellings for
  HK, MO and PS on every engine ([public/js/lib/countries.js](../public/js/lib/countries.js)). Re-run of
  the same walk for those three codes: **3/3 points, 0 defects, 0 page errors** (PS → Al Burayj @
  31.43944). Durable coverage: `tests/country-name-recognition.test.js` now asserts the **aliases
  themselves** contain those spellings, which an Intl-only assertion cannot do on Node.
* New cross-engine check `scripts/country-spelling-cross-engine-probe.mjs` loads the app's own
  `/js/lib/countries.js` inside Chrome and feeds it all **773** spellings the Node harness generates for
  the **250** codes: **0 unrecognised in Chrome**
  (`artifacts/final-quality/country-spelling-cross-engine-2026-11-18.log`). It also reports the 4 codes
  whose Chrome-only short label is absent from Node's generated list; that direction is harmless because
  each engine's own label is always in its own table.
### Not verified by these checks

The browser gate above ran on `cbeff6b`; the alias fix changes app code, so a fresh full
`npm run test:e2e` on the fixed tip is required before that 180-case number can be quoted for it.
The checks that do cover the fixed tip are recorded in the next section.

## 18 November 2026 - the offline suite, the region-less browser walk and one probe-side correction, all on the alias-fixed code

### Why this step

The three alias strings are app code, so the 180-case gate above no longer describes the tip by itself.
This section records what was actually re-run after the change.

### Executed on the fixed tip

* `npm test` → **186 tests, 186 passed, 0 failed, 0 skipped (74.5 s)**, log
  `artifacts/final-quality/unit-after-alias-fix-2026-11-18.log`. The count includes the new
  `tests/country-name-recognition.test.js` case that asserts the alias list itself, which passes only
  because of the fix.
* `npm audit` → **0 vulnerabilities** (re-run on the current tip, no dependency change).
* `scripts/chat-place-probe.mjs`, the 34-session focused browser walk → **34 cases, 7 eponymous towns,
  9 country-name-at-a-place-question replies, 18 region-less lists, 0 page errors, 25 towns selected as
  town points, 9 honest replies, 1 failure**.
* That one failure is **FK**, and it was the probe's expectation, not the app: the page offered
  `Whole Falkland Islands (Islas Malvinas)` — Chrome's Intl spelling of the country — while the probe
  compared with `` `Whole ${COUNTRY_NAMES.of('FK')}` `` built in Node, whose label is
  `Falkland Islands`. The button existed, was worded from the app's own runtime table, and was tappable;
  the check was runtime-dependent in exactly the way the cross-engine probe above had just documented.
  The probe now tests the route by shape (`/^Whole\s+\S/`) and records the actual label as evidence
  ([scripts/chat-place-probe.mjs](../scripts/chat-place-probe.mjs)). No app code changed for it.
* Re-run of the same 34 sessions with the corrected assertion → **34 cases, 0 failures, 0 page errors,
  25 towns selected as town points, 9 honest replies**
  (`artifacts/final-quality/place-probe-fkfix-2026-11-18.log`), served from the bundle that contains the
  alias fix (`grep -c "hong kong sar china" dist/client/js/lib/countries.js` → 1).
* The Playwright chat/workflow specs (`chat-only-flow`, `city-state-chat-flow`,
  `help-and-explanations`, `workflow`) on that build: static-desktop → **17 passed, 0 failed (1.8 min)**,
  and the same four specs across all four projects (static-desktop, static-mobile, node-desktop,
  node-mobile) → **68 passed, 0 failed (6.1 min)**, `docs/evidence/e2e-chat-all-projects-fixed-tip-2026-11-18.log.gz`.
  This is the chat slice of the release gate on the fixed tip; the complete 180-case gate has **not** been
  re-run since the three alias strings changed, so the 180 figure above must not be quoted as if it had.

### One earlier sentence is now superseded

The 18-Nov section on the region-less lists said that "only Singapore's equivalent has a browser-level
assertion". That is no longer true: the 34-session walk above drives **all eighteen** region-less lists in
real Chrome (AW BL CC CW CX EH FK GI GS MF NU PN SG SX TC VA VG plus the whole-country route), and the
245-list matrix walk drives every saved list end to end. The offline-only claim at
`docs/validation.md` "Not verified here either" of that earlier section should be read with this
correction.

## 18 November 2026 - improvement loop on the probe and chat layer, and one measured nine-second stall

### Why this step

The user asked for a loop: find one evidence-backed improvement, make the smallest honest fix, re-run the
relevant checks, record the executed numbers. Eight passes followed the 180-case gate on `35a11b7`. Each
item below names what was measured before the change, so the fix is a response to evidence rather than to
taste.

### 1. The picker and the chat were checked in the wrong engine

`scripts/country-spelling-cross-engine-probe.mjs` compared Node-generated spellings inside Chrome, but the
guarantee a farmer depends on is that the wording the step-1 dropdown *shows* is a wording the chat
accepts, and those `<option>` labels come from the browser's own `Intl` table
([public/js/modules/context.js:13](../public/js/modules/context.js)). The probe now reads the live labels
out of the rendered DOM and feeds each one to the page's own `findCountries`. Executed on the built
bundle: **250 codes, 773 spellings, 0 unrecognised in Chrome, 250 picker options checked, 0 labels the
chat rejects** (`artifacts/final-quality/picker-parity-probe-2026-11-18.log`); the four lines under
`chromeOwnSpellingNotInNodeList` are Chrome printing its own name, which is context, not a gap.

### 2. Every probe now refuses to measure a stale bundle

The browser probes talk to whatever answers on port 4575. After a source edit, an old `dist/client` would
have been reported as the new app, so `scripts/lib/probe-app.mjs` starts the static preview itself when the
port is free and refuses to run when `dist/client` is older than `public/` or `server/` unless
`PROBE_ALLOW_STALE=1`. Verified by touching `public/js/lib/countries.js` and re-running a probe (refused,
with the reason printed), then clearing it with `npm run build`. Three probes now share it, so the guard
cannot be forgotten in a new one.

### 3. The chat silently dropped the button that was the only way out

`public/js/modules/chat.js` rendered `followUps.slice(0, 6)` while the workflow assistant bounds its own
offers lower than that, so nothing was being cut today - but the day an offer grew, the last choice would
have vanished from the screen while still being described in the sentence, which is the same defect class as
the Singapore escape button that was invisible at three. The cap is gone; the widest offer across the whole
matrix was measured at **4 choices** and is now pinned offline
([tests/matrix-coverage.test.js](../tests/matrix-coverage.test.js)) with an assertion that no reply ever
offers more than six. Re-validated after the change: `npm test` **186/186, 0 skipped**, `npm audit`
**0 vulnerabilities**, the 34-session browser walk **34 cases, 0 failures, 0 page errors**, and the
four-project Playwright chat slice **68 passed, 0 failed (5.4 min)**
(`artifacts/final-quality/chat-place-after-uncap-2026-11-18.log`,
`artifacts/final-quality/e2e-chat-after-uncap-2026-11-18.log`).

### 4. A point is a pair of coordinates, not one of them

Both browser walks compared only `#latitude`. Two saved towns can share a name, a region and a rounded
latitude, so a wrong point could have passed. Both scripts now read `#longitude` as well and require both
axes to match one saved row (`chat-place-probe.mjs` at 0.01°, `chat-place-matrix-probe.mjs` at 1e-4).
Re-run with the pair check: **34 sessions, 0 failures, 0 page errors**
(`artifacts/final-quality/chat-place-pair-check-2026-11-18.log` via the task log). The first matrix
subset run of this pass printed **12 crashes**; that was the probe being edited while it ran, not the app,
and it is recorded here because a probe that crashes loudly is doing its job.

### 5. The buttons now say which level they select, and the five list-less codes are walked

The matrix walk used to guess whether a reply was asking for a region or a town by matching its sentence.
That guessing produced 17 false defects earlier, and "Andorra la Vella" is both a parish and a town, so the
app now stamps every choice button with `data-choice-type` (town / region / farm / follow-up) and names the
group for a screen reader as "Choose one of these to continue planning" when the buttons are the only way
to answer ([public/js/modules/chat.js:150-166](../public/js/modules/chat.js)). The walk taps by button
position and kind instead of by text. It also walks the five supported codes with no saved place list
(AQ BV HM IO UM) as its own terminal state, because requiring a town point there was never meaningful:
executed **5 cases, 5 explained whole-country replies, 0 defects**. A 17-code subset through the rewritten
walk printed **16 real town points, 0 page errors, 1 defect** - the defect being the walk itself assuming
every code has a list, which is what the previous sentence fixed. `tests/e2e/chat-only-flow.spec.js` now
also asserts the attribute exists and holds a known kind on every button it taps, so the contract the walks
depend on cannot rot silently; that assertion has not been run in Playwright yet and is listed below.

### 6. A nine-second wait before "the services are unavailable"

Adding the latency stamp to the walk (`window.fieldshiftAnswerLatencyMs`, previously read only by the LM
benchmark) made the guided place step's responsiveness measurable instead of assumed. The first census
found the pattern immediately: the answer to a **town** tap took **9042 ms (US · Acton)** and
**9038 ms (AD · Canillo)** while every other step answered in tens of milliseconds. One traced session
showed the status line reading "Step 1: finding community-mapped fields near the town…" from 125 ms to
9187 ms, with all three Overpass services refusing the request within **60 ms** of each other
(`artifacts/final-quality/latency-diag-2026-11-18.log`). The hedge in
[server/context/farms.js](../server/context/farms.js) retried every service through its backoff ladder
(3 s + 6 s) whatever the failure was, so a farmer with no route to those services waits the full ladder to
be told they are unavailable. `server/context/client.js` now records whether the service answered at all
(or was merely slow), and the hedge stops retrying an endpoint it cannot reach while still giving a busy or
slow one its ladder. Measured after the change, same session, same blocked services: the town tap answers
in **56 ms** (was 9050 ms) with the same coordinates in the form and the same honest notice
(`artifacts/final-quality/latency-diag-after-fix-2026-11-18.log`). The durable test that had pinned the old
cost - `assert.equal(failures, 9, 'each of three services gets three attempts with backoff')` - was
replaced, not deleted: it now requires each of the three services to be attempted, the outage to be
reported in under 100 ms, and a *mixed* outage (one unreachable, one busy-then-recovered) to still retry
the busy service three times and the unreachable one once. Executed: `node --test tests/context.test.js`
**11/11**, `npm test` **186/186, 0 failed, 0 skipped**, `npm audit` **0 vulnerabilities**
(`artifacts/final-quality/unit-farms-latency-2026-11-18.log`).

### 7. The whole matrix, walked again on the fixed code

`npm run test:chat-matrix` over **every supported code** - the 245 with a saved place list and the five
without - driving only the buttons the assistant itself offers, tapping by position and by the level each
button declares: **250 cases, 245 plans carrying a saved town point (both coordinates matching the row),
5 explained whole-country replies, 0 defects, 0 page errors**
(`artifacts/final-quality/chat-matrix-full-2026-11-18.log`). The same pass is the latency census for the
guided place step: **977 answers, p50 19 ms, p95 47 ms, max 156 ms**, the slowest being a first question
(US, 156 ms). Nothing in the flow now approaches the 9 s the trace above caught, and the number is a
measurement over every country rather than one benchmark machine.

### 8. A field service that answers late, measured and taken out of the chat path

The section 6 fix covered services this client *cannot reach*. The sentence left there open - "a service
that accepts the connection and then answers slowly is a different path, bounded by the 75 s shared
deadline, and is not what was measured here" - was then measured directly against
`createFarmClient` with a stub that holds the connection and never answers:

* stub ignoring the caller's abort signal: **105,029 ms**, 6 attempts across 3 services
  (`docs/evidence/farms-hanging-unreachable-2026-11-18.log.gz`);
* stub honouring it the way `fetch` does: **75,016 ms** for the same 6 attempts
  (`docs/evidence/farms-hanging-service-deadline-2026-11-18.log.gz`).

The second figure is the one a farmer would see, and it matches the server's own `deadlineMs` exactly, so
the hedge does bound the wait. What it does not bound is the chat: tapping a town button ran
`await run('loadFarms')` in [public/js/modules/workflow-assistant.js](../public/js/modules/workflow-assistant.js)
*before* replying, so for those 75 s the panel sat on "Step 1: finding community-mapped fields near the
town…" with Send disabled - even though the town point had already been saved one line earlier.

The guided path now waits for the lookup for at most `fieldsGraceMs` (default 10 s) and then answers:
the reply confirms the selected town point, says the field services have not answered yet and that nothing
was invented, and offers the two real way-ons `Use selected point` and `Show mapped fields`. The field
answer itself is not lost - the same request is kept in flight and a second ask joins it instead of adding
another hanging request to a shared community service; the plan's own invalidation drops it. Step 1 keeps
its own full-deadline search and its `up to a minute when busy` notice, which is the right budget for the
button a farmer chose deliberately.

Driving that change also exposed a second, smaller defect: the retry sentence `Show mapped fields around
this point` carries none of the verbs in the workflow's intent list, so it fell out of the guided path at
the place-reply check and the chat answered it with a generic evidence reply instead of the fields. The
field request is now itself counted as farmer input in `hasInput`, so the typed sentence and the button do
the same thing.

Executed: `node --test tests/workflow-place-choices.test.js` **26/26** (the new case asserts a town tap
under a never-answering service replies in well under the deadline, keeps `#latitude`, offers both
way-ons, claims no field count, and that the retry opens no second request); `npm test` **187/187, 0
failed, 0 skipped (55.7 s)** (`docs/evidence/unit-187-field-grace-2026-11-18.log.gz`); `npm audit` **0
vulnerabilities**. The browser counterpart is
[tests/e2e/field-service-latency.spec.js](../tests/e2e/field-service-latency.spec.js), which hangs every
field request through `context.route`, ran **4 passed (1.5 m)** - one case per project, each completing the
tap-and-retry flow in about 21 s of wall time including the page load, i.e. inside the two 10 s graces the
flow crosses rather than inside a 75 s deadline
(`docs/evidence/e2e-field-service-latency-2026-11-18.log.gz`). Its first two runs failed on the test side,
not the app: a browser cannot tell the chat's own re-ask apart from the hedge legitimately starting a
second service after 6 s and a third after 12 s, so the request-count check lives in the offline test where
it is deterministic and the browser case asserts only what a farmer sees.

### 9. Making the branch reproducible from another device

The improvement loop had recorded its results in `artifacts/` paths that are
gitignored, so an agent cloning this branch on another machine could read the claims
but could not re-run or even see them. Added
[handoff-2026-11-18.md](handoff-2026-11-18.md): the branch and `main` commits, the
Node/Playwright/Chrome versions the numbers were produced on, the command list with
measured durations, the probe environment variables, the chat DOM contract the three
probes and the e2e specs navigate by, the source-data census (245 lists / 250 codes,
18 unnamed-region lists, 7 eponymous towns, 11 region-name collisions, 5 list-less
codes), the invariants each past defect paid for, the loop queue, and the rule that
`artifacts/**` is local while `docs/evidence/*.gz` is the durable copy. It is linked
from AGENTS.md §10, [docs/README.md](README.md) and the [development
guide](development.md), whose "Additional checks" list was missing all four probe
scripts added by this branch.

Executed: `node scripts/check-documentation.js` **117 local links, 0 broken**;
`npx playwright test --list` **Total: 184 tests in 17 files** (180 plus the four new
field-latency cases); `npm test` after the documentation edits **187/187, 0 failed, 0
skipped (55.7 s)**. There is no CI in this repository, so no number above is anything
other than a locally executed command.

### 10. Documented commands and cited evidence files, checked by a test

Two things a second device hits first were unguarded: the commands the docs tell it to run, and the
evidence paths the docs cite as proof. Scanning every markdown file at the root and under `docs/`
(excluding the `evidence/` and `history/` dumps) found **39 commands in fenced blocks**, **7
`scripts/`, `tests/`, `server/` and `notebooks/` file paths**, and **49 `docs/evidence/…`
citations**. No command was missing from `package.json` (the four probe scripts were added earlier in
this loop) and no path was missing, but **two citations were dangling**: this file named
`e2e-chat-all-projects-fixed-tip-2026-11-18.log` where the committed archive is
`…log.gz`, and the handoff used an illustrative name that read like a real file. Both are corrected —
the citation now resolves to the archive whose own summary line is `68 passed (6.1m)`, and the example
is written as `docs/evidence/<run>-2026-11-18.log.gz`.

`tests/documentation-commands.test.js` (new) keeps them honest: every documented npm command exists
in `package.json`, every documented verification file exists, every hand-run script is named in a
current doc (only the two `prestart*` lifecycle hooks are exempt, and 18 of the 20 scripts pass), and
every non-glob `docs/evidence/…` citation resolves. Each check asserts a minimum number of things
found, so a scanner that matches nothing cannot pass silently.

A clean clone of the pushed branch, with no copy of the source device involved, ran `npm ci` → **137
packages in 10 s**, `npm test` → **187 passed, 0 failed, 0 skipped (54.6 s)**,
`node scripts/check-documentation.js` → **117 local links, 0 broken**, `npm audit` → **found 0
vulnerabilities**. `npm test` builds `dist/client` itself, so the only prerequisites are the cloned
tree and the pinned install; no offline test imports a third-party package.

Executed: `node --test tests/documentation-commands.test.js` **4/4**. Non-vacuity, twice: injecting
`npm run test:does-not-exist` and `node scripts/no-such-probe.js` into `docs/development.md` failed
checks 1 and 2; restoring the missing `.gz` in the validation citation failed check 4, and putting
the correction back returned the file to **4/4**. The injected files were removed from the working
tree after each demonstration.

### 11. The archived experiment harness cannot load, and a guard that can fail

`notebooks/legacy-workers/` holds the two rejected Hugging Face workers and their old benchmark
harness. Its README said the harness is not a current validation command; measured, it is plainer
than that — it cannot be loaded at all:

```sh
node --input-type=module -e "import('./notebooks/legacy-workers/benchmark-candidate.js')"
# ERR_MODULE_NOT_FOUND: Cannot find module '…/notebooks/server/index.js' (specifier ../server/index.js)
```

The file was moved a directory deeper and its import depth was never updated, so a device following
the README could waste time "repairing" an archived worker. The README now records the measured
failure and warns against re-pointing it at the live server.

The same review found a hole in the existing coverage: `scripts/build-browser.js:30` deletes
`llm-worker.js` and `candidate-worker.js` from `dist/client`, so a build-output-only assertion can
never fail — the builder strips whatever reappears. `tests/deployment.test.js` now rejects those two
names in `public/js/modules` as well, which is where they would have to be restored, and that is the
half that bites.

Executed: `node --test tests/deployment.test.js` **1/1**. Copying the archived `llm-worker.js` into
`public/js/modules` made it fail with "Missing expected rejection: llm-worker.js is a rejected
experiment and must not be restored into the shipped frontend"; deleting that copy returned it to
**1/1**, and `git status --porcelain -- public/js/modules` printed nothing.

### 12. The documentation guard failed on the tip's own quoted error text

The previous subsection added the archived harness's measured error to this file, including its path:

```sh
node --input-type=module -e "import('./notebooks/legacy-workers/benchmark-candidate.js')"
# ERR_MODULE_NOT_FOUND: Cannot find module '…/notebooks/server/index.js' (specifier ../server/index.js)
```

That text is evidence: the path must *not* exist in the repository, because its absence is what the
archived harness demonstrates. But the guard added in subsection 10 scanned every line inside a fenced
block and required each `scripts|tests|server|notebooks/…js|py|ipynb` path on it to exist, so on the
committed tip **the offline suite failed on the repository's own evidence**. Measured before any edit,
on Node v22.23.5: `npm test` **191 tests, 190 pass, 1 fail, 0 skipped (234.8 s)**; the subtest was
`every documented verification file exists` (tests/documentation-commands.test.js:46) and its only
entry was `docs/validation.md -> notebooks/server/index.js`
(`docs/evidence/unit-doc-guard-before-2026-11-18.log.gz`). No application module was involved: the
failure was iteration 12's guard misreading iteration 12's prose, which is exactly why the loop reruns
the whole suite instead of the two edited files.

The fix is in the scanner, not in the evidence: `fencedLines()` now drops lines whose first non-space
character is `#`. A shell comment is prose nobody can run, and the quoted error is the **only** comment
line in the tree that contains such a path (measured: 1 match across 33 markdown files); command lines
are still scanned exactly as before, and the two scanners now share one `DOCUMENTED_FILE` pattern so
the halves cannot drift apart. Scan counts on the fixed tree: **39 documented npm commands** (minimum
30), **9 documented file references** (minimum 5), **66 cited evidence files** (minimum 20).

A new subtest pins the distinction with a synthetic block that holds the real error text beside two
real command lines: the comment is absent from the scanned lines, both commands are present and still
match the file pattern. Non-vacuity, twice: the tip itself failed before the change (above), and after
it an injected `node scripts/iteration13-missing-probe.js` in docs/development.md failed check 2 with
exactly that path while an injected comment naming `notebooks/server/index.js` was ignored; restoring
the file printed **5/5** again (`docs/evidence/doc-guard-injection-2026-11-18.log.gz`,
`docs/evidence/doc-guard-focused-2026-11-18.log.gz`).

Executed on the fixed tree, Node v22.23.5: `node --test tests/documentation-commands.test.js` **5/5**;
`npm test` **192 tests, 192 pass, 0 fail, 0 skipped (24.8 s)**
(`docs/evidence/unit-doc-guard-after-2026-11-18.log.gz`); re-run after this section's own edits, the
focused guard was **5/5** and `npm test` **192/192, 0 failed, 0 skipped (25.7 s)**
(`docs/evidence/unit-doc-guard-final-2026-11-18.log.gz`); `npm audit` **0 vulnerabilities**;
`node scripts/check-documentation.js` **117 local links, 0 broken**;
`npx playwright test --list` **Total: 184 tests in 17 files**. The 24.8 s is a warm-cache run on this
device; the same command took **234.8 s** on the cold tree before the change, so the two durations are
not comparable.

Environment note, recorded rather than worked around: this device's only system Node is **v26.13.1**,
so the numbers above were produced with **Node v22.23.5** from the official tarball, unpacked under the
gitignored `artifacts/` (no system change). On v26.13.1 this repository's esbuild 0.28.2 binary runs
(`--version` prints 0.28.2) and `transformSync` answers, but the JS `build()`/`buildSync()` API never
returns: the service process sits idle reading stdin while the parent waits on a semaphore at 0 % CPU
(sampled). `npm test` therefore cannot complete its `dist/client` build step there. Nothing in the
repository was changed for this; it is a local toolchain finding a second device should know before
concluding the suite is hung.

Measured here and **not fixed** (iteration 14 candidate): at the region question the saved list still
answers a nonsense reply at the wrong level. Driving the real India list offline, "Which state or
region of India?" answered with `Zqxwv` — or with a plausible absent name, `Maisonette District` —
returns "No town by that name is in the saved place list for India…" and offers the country-wide town
buttons Pune/Nagpur/Ratnagiri plus Whole India, dropping the two real region buttons (Maharashtra,
Maharashtra Coast) that the same prompt had just offered. The buttons are real, so it is not a dead
end, but the reply answers a question that was never asked and silently skips the region level. No fix
was attempted in this iteration; the reproduction is offline and deterministic
(`docs/evidence/region-nonsense-repro-2026-11-18.log.gz`).

### 13. An unknown region at the area question kept the town-level recovery

Subsection 12 measured this defect and left it unfixed. This iteration fixed it. Driving the real
India list offline, "Which state or region of India?" answered with `Zqxwv` — or with a plausible
absent name, `Maisonette District` — returned "No town by that name is in the saved place list for
India…" and replaced the two region buttons (Maharashtra, Maharashtra Coast) with the country-wide
town buttons Pune/Nagpur/Ratnagiri plus Whole India. The buttons were real, but the reply answered a
question that was never asked and skipped the level the farmer was standing on. The before output is
archived from iteration 13 (`docs/evidence/region-nonsense-repro-2026-11-18.log.gz`).

Cause: `respond()` reached one fallthrough for both pending place questions
(`workflow-assistant.js:424`). A short reply that matched no saved row was answered by
`placeRecovery()`, whose wording, caveat and buttons all assume the plan is asking for a town. At the
area question the plan is asking for a region.

The fix adds `regionRecovery()` beside `placeRecovery()` (`workflow-assistant.js:297`). It reuses
`areaPrompt()`'s own region rows and honesty caveat, prefixed with a sentence that names the level
and says nothing was selected: "No region by that name is in the saved place list for India, and no
listed town carries that spelling either. Nothing was selected; I will not guess a similar name."
It always keeps `Whole <country>` tappable, and it runs no data action. The fallthrough now chooses
by the pending question: region-level only while the plan is at the area question, no region is
selected, and the list holds a named region row; otherwise it stays town-level, so the town recovery
inside a chosen region and the region-less lists behave exactly as before.

After, the same India run returns the region sentence followed by the prompt's own caveat, with
Maharashtra, Maharashtra Coast and Whole India as buttons, and no call beyond `step:location`
(`docs/evidence/region-recovery-after-2026-11-18.log.gz`). A new census test
(`tests/matrix-coverage.test.js:502`) walks **every saved list with a named region row — 227 lists**
through the same three steps and pins the wording (`No region by that name`, not `No town by that
name`), at least one real region button, and that no region or point was selected and no evidence or
comparison ran. Non-vacuity: with the new branch disabled, that test reported **227 of 227 replies
at the town level** and exited 1 (`docs/evidence/region-recovery-injection-2026-11-18.log.gz`);
restored, it was **1/1 (474 ms)**. The two neighbouring workflow suites were **49/49**.

Executed on the fixed tree, Node v22.23.5: `npm test` **193 tests, 193 pass, 0 fail, 0 skipped
(30,013 ms)** (`docs/evidence/region-recovery-suite-2026-11-18.log.gz`); re-run after this section's
own edits, **193/193, 0 failed, 0 skipped (40,012 ms)**
(`docs/evidence/region-recovery-suite-final-2026-11-18.log.gz`); `npm audit` **0
vulnerabilities**; `node scripts/check-documentation.js` **117 local links, 0 broken**. Playwright
was not re-run in this iteration, so **`npx playwright test --list` remains 184 tests in 17 files**
and no browser result is claimed here. Only `workflow-assistant.js` changed in the app; no place
data and no model vocabulary changed, so the tiny word LM is not retrained. Nothing was deployed,
`main` is untouched, and no NASA portal edit was made.

### 14. No axe scan had covered a chat state the assistant's own buttons reach

The repository's only two axe call sites scanned the read-aloud-stopped state and the microphone
recording state. Every reply and its `role="group"` choice list is rendered dynamically into
`#chat-history`, so a contrast or accessible-name regression inside a guided reply would have passed
the whole gate. Measured before writing the test, against the built bundle on this device at
1280×1000: scans at the guided scope, town and field prompts each reported **0 violations and 51
passes**; `color-contrast` stayed in axe's `incomplete` set in every state, which the shared helper
already excludes from its assertion and which is not counted as a pass
(`docs/evidence/axe-guided-chat-measure-axe-taps-2026-11-18.log.gz`).

The new test `tests/e2e/guided-chat-accessibility.spec.js` walks one real Singapore flow — send,
"A specific area", tap the first saved town — asserts the reply text that makes each state real
(`Which part of Singapore`, `no named regions`, `<town> is selected as a town point`, `0 mapped
fields were returned`), and scans all three states with the existing `scanAccessibility` helper. It
adds one test, so `npx playwright test --list` now reports **188 tests in 18 files** (184 before).

Executed: the four projects passed **4/4 (9.4 s)** on ports 4180/4181 with an isolated `--output`
directory, because a concurrent full-gate run owns 4173/4174 and the default artifact directory. A
first attempt in that shared directory reported one `static-desktop` error — `browserContext.close:
ENOENT …/artifacts/playwright/test-results/.playwright-artifacts-…/trace` — caused by the two runs
sharing one output directory; the isolated rerun passed all four projects, and no app assertion
changed (`docs/evidence/axe-guided-chat-axe-spec-pass-2-2026-11-18.log.gz`).

Non-vacuity: injecting `#chat-history button[data-chat-choice]{background:#cfcfcf;color:#c4c4c4;
border-color:#cfcfcf}` with `page.addStyleTag` before the first scan made `static-desktop` fail at
`guided scope prompt` on `color-contrast` (the assertion in `axe-helper.js:8`), and removing the
injection returned **1/1 (2.6 s)**
(`docs/evidence/axe-guided-chat-axe-spec-broken-2026-11-18.log.gz`,
`docs/evidence/axe-guided-chat-axe-spec-restored-2026-11-18.log.gz`). Executed on the same tree:
`npm test` **193 tests, 193 pass, 0 fail, 0 skipped (40,561 ms)**. No app module changed; this
iteration adds a test only, so the tiny word LM is not retrained. Nothing was deployed, `main` is
untouched, and no NASA portal edit was made. The scan covers automated WCAG A/AA and best-practice
rules at one desktop viewport in headless Chrome; it is not a claim of accessibility for real phones,
Safari/WebKit or assistive-technology users.

### 15. The 320 px phone and landscape chat layout had been measured but never asserted

The chat panel is `position: fixed` with `width: min(440px, calc(100vw - 2rem))` and a separate
`@media` rule at `public/css/app.css:71,108`; its bottom offset is driven by a ResizeObserver. In
iteration 15 the 320×568 and 568×320 layouts were measured (`panel 304/552 px wide, choices 44 px
high`; `docs/evidence/small-screen-measure-2026-11-18.log.gz`), but the numbers lived only in a
handoff note: any later CSS change could push a choice or the
panel off a small screen and the gate would stay green. The geometry was not covered by an assertion
anywhere — `review-phase-a.spec.js:16` checks the navigation bar's usable height at 683×384 and
similar sizes, not the chat panel's width, its right edge, its clearance from `.workflow-navigation`,
or where its buttons land.

The new `tests/e2e/small-screen-chat.spec.js` walks the Singapore flow the chat-only spec uses
(send, "A specific area", tap the first town) and, after two animation frames so the ResizeObserver
has re-run, asserts at each state: the document does not scroll sideways (`scrollWidth <= width`),
the panel's left/right edges are inside the viewport, the panel's bottom stays above the workflow
navigation whenever that bar is on screen, and every `button[data-chat-choice]` in the last reply is
fully inside the viewport and at least 24 px high. It covers the scope prompt and the town prompt at
320×568, the town prompt at 568×320, and the field prompt (which carries "Use selected point") at
both 568×320 and 320×568. `npx playwright test --list` now reports **192 tests in 19 files** (188
before).

Executed: all four projects passed **4/4 (4.3 s)** on ports 4180/4181 with
`--output=artifacts/playwright/small-screen-run`; after adding the portrait field-prompt check the
same four passed **4/4 (7.0 s)**
(`docs/evidence/small-screen-geometry-final-2026-11-18.log.gz`). Non-vacuity: injecting
`#chat-panel{right:-2rem!important}` with `page.addStyleTag` before the first measurement made
`static-desktop` fail at the `panel right edge` assertion (`docs/evidence/small-screen-geometry-broken-2026-11-18.log.gz`);
removing the injection returned **4/4 (4.4 s)**
(`docs/evidence/small-screen-geometry-restored-2026-11-18.log.gz`). On the same tree `npm test`
reported **193 tests, 193 pass, 0 fail, 0 skipped (38,133 ms)**
(`docs/evidence/small-screen-npm-test-2026-11-18.log.gz`), `npm audit` **0 vulnerabilities**, and
`node scripts/check-documentation.js` **`failures: []`** (0 external flags).

Two failures were seen in a full-gate attempt on the superseded commit `022569e` and are recorded
here so they are not mistaken for app assertions that iteration 16 loosened: at 30 of 184 cases,
`map3d.spec.js:61` failed in `browserContext.close` with
`ENOENT …/.playwright-artifacts-0/traces/…-recording….network` — the same trace-teardown signature
documented in subsection 14, at a moment when a second Playwright run was active on the machine and
with the test body itself complete — and `review-phase-a.spec.js:34` failed after 4.9 min with
"real fields were still unavailable after two user retries", the live public-Overpass dependency
listed under "Not yet executed" below (from this network `overpass.private.coffee` did not answer
within 15 s). That run was stopped once the tip moved past it; a full gate on this tip is the next
item, and only its own summary line will be recorded.

This is a test-only change: no app module, CSS, place data or model vocabulary changed, so the tiny
word LM is not retrained. Nothing was deployed, `main` is untouched, and no NASA portal edit was
made. The assertions run in headless Chrome with touch emulation at emulated viewport sizes; they are
not evidence about real phones, real touch, or Safari/WebKit.

### 16. A reply could push the message box and the status line below the panel's visible edge

The chat panel is height-capped (`max-height: min(740px, calc(100dvh - var(--chat-bottom) - 1rem))`)
and scrolls inside itself, so content appended to `#chat-history` moves the form and `#answer-status`
down without moving the panel's bottom edge. Subsection 15 asserted the panel and its choice buttons
fit at 320×568 and 568×320, but it never checked the controls below the history. A headless probe
(`docs/evidence/chat-status-clipping-measure-2026-11-18.log.gz`) measured the gap: at 320×568 after
one reply `#answer-status` sat at y=385 and `#question` at y=329 while the panel ended at y=307; at
568×320 the status line was at y=399 against a panel bottom of 254; even at 1280×1000 the status line
was clipped by 12 px (bottom 847 vs 835). Six consecutive replies at 320×568 left the status line at
y=320 against 307. On the error path `#answer-status` is the only place the message appears, so a
failed request could be completely invisible on a phone. The first hypothesis for this iteration — an
axe `scrollable-region-focusable` violation on `#chat-history` — was disproved by the probe (each
reply's "Read aloud" button makes the log focusable, 0 violations), so it was abandoned.

Fix in [public/js/modules/chat.js:15](../public/js/modules/chat.js): `announce()` now sets the text and
calls `#answer-status.scrollIntoView({ block: 'nearest' })`, every status write goes through it
(retrieving, ready, error, invalidated), and the `resize` listener re-reveals the status line after
`positionChat()` so a rotation does not inherit the previous orientation's scroll position. The
regression test is the second case in `tests/e2e/small-screen-chat.spec.js` ("a reply keeps the
message box and the status line inside the visible panel"): after one `thanks` reply at 320×568 and
after rotating to 568×320, and after six replies at 568×320, it asserts the message box, Send button
and status line all lie inside the panel's top/bottom edges and the viewport's left/right edges.

Executed: with the fix, the first run reported **6 passed, 2 failed** — only `node-desktop` and
`node-mobile`, at "one reply at 568×320: status line bottom … Expected: <= 254.71875, Received:
275.1875" — because portrait scroll survived the rotation with no status update; after adding the
resize re-reveal the four projects passed **8/8 (7.5 s)**
(`docs/evidence/chat-status-clipping-fixed-2026-11-18.log.gz`; pre-resize-fix run in
`docs/evidence/chat-status-clipping-first-run-2026-11-18.log.gz`). Non-vacuity: reverting both the
`scrollIntoView` call and the resize wrapper, rebuilding, and running `--project=static-desktop -g
"visible panel"` failed with **1 failed** at `Expected: <= 307.203125, Received: 370.34375`
(`docs/evidence/chat-status-clipping-broken-2026-11-18.log.gz`); restoring the file and rebuilding
returned **8/8 (8.3 s)** (`docs/evidence/chat-status-clipping-restored-2026-11-18.log.gz`).
`npx playwright test --list` is now **196 tests in 19 files**. On the same tree `npm test` reported
**193 tests, 193 pass, 0 fail, 0 skipped (26,095 ms)**
(`docs/evidence/chat-status-clipping-npm-test-2026-11-18.log.gz`), `npm audit` **0
vulnerabilities**, and `node scripts/check-documentation.js` **`failures: []`** (0 external flags).

No CSS, crop data or model vocabulary changed, so the tiny word LM is not retrained. Nothing was
deployed, `main` is untouched, and no NASA portal edit was made. The scrolling fix is asserted in
headless Chrome at emulated viewport sizes only; it is not evidence about real phones, real touch,
or Safari/WebKit.

### 17. Chat context triggers matched inside longer words and changed the answer's topic

`chat.js` decided which loaded evidence to add to a chat answer with substring tests over the whole
question. `farm` also matched "farmer", `australia` on its own admitted the ABS irrigation
benchmark, `ph\b` matched "graph", `water` matched "waterlogging" and `field` matched "fieldwork".
The context blocks are prepended to the answer and the reply keeps at most three blocks with only a
limitation surviving from the API's own blocks, so a wrong trigger changed what the reply was about:
"Our farmer reported a soil pH of 6.5" added a mapped field record, and any question naming
Australia added the national irrigation ratio. A scratch comparison of the old triggers with the new
rules over 40 realistic questions found **7 differences, all intended**
(`docs/evidence/chat-topic-routing-diff-2026-11-18.log.gz`): the two farmer questions, "wheat in
Australia" and "pests in Australia", "Waterlogging in the lower paddock", "Graph my temperatures"
(soil no longer fires on `graph`, weather still fires on `temperatures`) and "Fieldwork timing".
The same comparison caught a regression in the first word-boundary version — `\btemperature\b` and
`\brainfall\b` had stopped matching the plural "temperatures" and "rainfalls" — so the patterns now
carry optional plurals.

Fix: the builder moved unchanged to [public/js/lib/chat-context.js](../public/js/lib/chat-context.js)
with whole-word topic patterns, and `chat.js` imports it. The new `tests/chat-context.test.js` runs
the pure builder against fixed evidence fixtures and pins both leaks, the triggers that must still
fire, and the greeting/location guard.

Executed: with the module in place the file reported **3 pass, 0 fail**. Reverting only the water
and farm patterns to the old substrings made it **2 pass, 1 fail** with "field record leaked into
limitation,mapped field record"
(`docs/evidence/chat-topic-routing-broken-2026-11-18.log.gz`); restoring them returned **3 pass, 0
fail** (`docs/evidence/chat-topic-routing-restored-2026-11-18.log.gz`). The chat browser specs
(`chat-only-flow`, `assistant`, `small-screen-chat`) passed **24/24 (1.0 m)** in four projects
(`docs/evidence/chat-topic-routing-e2e-2026-11-18.log.gz`). `npm test` reported **196 tests, 196
pass, 0 fail, 0 skipped (36,520 ms)**
(`docs/evidence/chat-topic-routing-npm-test-2026-11-18.log.gz`), `npm audit` **0
vulnerabilities**, and `node scripts/check-documentation.js` **`failures: []`**.

One bug in the first test draft was found and fixed rather than papered over: the farmer case also
loaded soil context, whose limitation filled the two-block budget and hid the leaked field record, so
it passed against the old patterns; that case now supplies only the field record. No crop data or
model vocabulary changed, so the tiny word LM is not retrained. Nothing was deployed, `main` is
untouched, and no NASA portal edit was made. This is a unit-level check of a pure function; no real
phone, touch, microphone, Safari/WebKit or agronomic review was performed.

### 18. Added context replaced the answer's own paragraphs, and the owed full gate was run

Two things in this iteration.

First, the reply assembly in `chat.js` kept at most three paragraphs and, whenever the chat added
local evidence, kept only the API's *limitation* block from the answer: `[...extra, ...limitations
slice(1)]`. For a crop question that also named the selected field, the reply became the mapped field
record plus a caveat and the sourced crop paragraph disappeared — the same class of loss as
subsection 17, but caused by the composition rule rather than the trigger. A second symptom showed up
while pinning it: with soil context loaded, the extra blocks already contain a limitation and the API
limitation was appended as well, so the reply carried two caveat paragraphs.

The rule moved to `composeAnswerBlocks()` in `public/js/lib/chat-context.js`, first ported verbatim so
the required behaviour could be recorded failing: against the ported rule the file reports **3 pass,
2 fail** (`docs/evidence/chat-composition-broken-2026-11-18.log.gz`) — the field-record case returns
`['mapped field record','limitation']` with the crop paragraph gone, and the soil case returns
`['regional soil model','limitation','limitation']` with the duplicated caveat.
The shipped rule keeps weather and soil estimates standing in for the generic templates (they are the
answer to an evidence question), while a field record, a pest occurrence or the irrigation ratio are
treated as surroundings and one paragraph of the crop answer survives beside them; the API limitation
is only appended when the context does not already carry one. After the change the file reports
**5 pass, 0 fail**.

The QA specs that read reply paragraphs were re-run rather than adjusted: `chat-only-flow`,
`assistant` (the sixteen QA cases with their graded assertions), `small-screen-chat` and
`help-and-explanations` passed **60/60 (2.7 m)** in four projects
(`docs/evidence/chat-composition-e2e-2026-11-18.log.gz`), and `npm test` reported **198 tests, 198
pass, 0 fail, 0 skipped (31,438 ms)**
(`docs/evidence/chat-composition-npm-test-2026-11-18.log.gz`), with `npm audit` **0
vulnerabilities** and `node scripts/check-documentation.js` **`failures: []`**. No assertion was
weakened or removed; `scripts/qa-assertions.js` and `tests/qa/prompts.json` have no forbidden-text
cases, which is why the extra surviving paragraph cannot trip them.

Second, the full gate owed by subsections 15–17 was run on `b87a6da` with the four projects on the
default ports and a dedicated output directory: **196 passed (22.2 m)**, exit code 0
(`docs/evidence/e2e-gate-b87a6da-2026-11-18.log.gz`). It included
`review-phase-a.spec.js:34` reaching live public Overpass and passing this time, so the earlier
"fields unavailable after two retries" was network availability, not app behaviour. No test was
changed for this run. The gate for the composition change itself ran on `c659a59` and reported
**195 passed, 1 failed (22.2 m)**, exit code 1
(`docs/evidence/e2e-gate-c659a59-2026-11-18.log.gz`). The single failure is
`field-terrain.spec.js:4` on `node-desktop`: the page reported
"Terrain data is unavailable (fetch failed)", so the AWS terrain-tile request that test makes for real did
not answer while 196 cases were running back to back. The same test on the same commit passed in isolation
**1 passed (1.9 m)**, and it passed again in the four-project slice recorded in subsection 19, so the gate
line is recorded as one external-fetch failure rather than a clean suite.

### 19. A frost question quoted the mean air temperature while the plan counts the minimum

The chat's weather paragraph picks which NASA POWER series to quote from the words in the question:
solar asks get `ALLSKY_SFC_SW_DWN`, rain asks get `PRECTOTCORR`, and everything else fell through to
`T2M` — the *mean* air temperature. "Show me frost evidence" therefore answered with the mean, while
this app's own frost rule is the minimum: `server/agronomy/rotation.js:103` counts a day as
frost-tender exposure when `T2M_MIN <= 0`, and the evidence table labels that series "Lowest air"
(`public/js/modules/data-flow.js:47`). In the fixture the two differ by more than a season: the mean
reads 12.9 °C on a night the minimum puts at −0.6 °C, so the reply described a mild day beside a plan
that had just reported frost exposure. `T2M_MIN` is requested for every location
(`server/nasa/power.js:4`), so the correct number was already in the payload the chat received.

The selection now takes the minimum series for frost wording and falls back to the mean when that
series is absent, which keeps an older cached observation answering instead of throwing.

**Executed.** The guard was written first and recorded failing against the shipped code: **5 pass,
1 fail** (`docs/evidence/chat-frost-parameter-before-2026-11-18.log.gz`). After extending it with the
two companion assertions the pre-fix module still reports **5 pass, 1 fail**
(`docs/evidence/chat-frost-parameter-broken-2026-11-18.log.gz`) — the only failure is the frost
assertion; "an ordinary temperature question still quotes the mean" and "a missing minimum series
falls back" pass against the old code on purpose, because they guard against the fix over-sweeping
rather than proving the defect. With the fix the file reports **6 pass, 0 fail**
(`docs/evidence/chat-frost-parameter-restored-2026-11-18.log.gz`), `npm test` reports **199 tests,
199 pass, 0 fail, 0 skipped (26,006 ms)**
(`docs/evidence/chat-frost-npm-test-2026-11-18.log.gz`), `npm audit` **0 vulnerabilities**, and the
two chat specs that read replies — `chat-only-flow` and `assistant` (the sixteen graded QA cases) —
passed **16/16 (1.3 m)** across all four projects
(`docs/evidence/chat-frost-e2e-2026-11-18.log.gz`).

The wider eight-spec chat slice did **not** go green on this device while the work was done, and the
number is recorded rather than quietly dropped: attempt 1 reported **74 passed, 6 failed (12.4 m)**
(`docs/evidence/chat-frost-slice-load-a-2026-11-18.log.gz`) and attempt 2, on the same tree,
**71 passed, 9 failed (14.5 m)** (`docs/evidence/chat-frost-slice-load-b-2026-11-18.log.gz`). Fifteen of the fifteen failures are
infrastructure-shaped rather than answer-shaped: twelve `locator.click` timeouts, one `locator.check`
timeout and one `toBeVisible` failure — Playwright reporting "waiting for element to be visible,
enabled and stable" for the whole 15 s action window — plus one `toContainText` in
`field-terrain.spec.js:4` where the live terrain request answered "Terrain data is unavailable (fetch
failed)", and the failing set moved between projects and between runs, which is not how a code
regression behaves. The cause is host load: an unrelated local model server (`ollama llama-server`,
~54 % of one core) held the load average at 8–10 on 12 cores while the suite wanted frames. Two
checks separate that from app behaviour: the specs pass individually
(`assistant` alone **1 passed (8.6 s)**, `field-terrain` alone **1 passed (1.9 m)**), and a probe that
sampled `#chat-toggle`'s position over 90 consecutive animation frames on `static-desktop` and
`node-desktop` at that same load measured **one distinct position** in all four traces — the launcher
is not oscillating, the renderer is just starved
(`docs/evidence/chat-frost-launcher-probe-2026-11-18.log.gz`). No timeout was raised, no retry was
configured and no assertion was weakened for these runs; a re-run of that slice on an idle device is
recorded below as owed, as is the full gate on this tip.

Nothing was deployed, `main` is untouched at `4a54fa3`, and no NASA portal edit was made. Real
phones, touch, Safari/WebKit, microphones, audible read-aloud quality and independent agronomic
review remain unverified.

### Not yet executed at the time of writing

* A clean full `npm run test:e2e` on this tip. The 180-case gate above describes `35a11b7`; the app has
  changed since (`chat.js`, `farms.js`, `client.js`, `workflow-assistant.js`), so 180/180 must not be
  quoted for the current commit until it is re-run. No Playwright run was launched on the device that
  wrote subsection 12, so the suite remains owed; only its own summary line will be recorded here. The
  chat-heavy slice that does cover the `data-choice-type` contract ran separately: **80 passed, 0 failed
  (6.0 min)** across all four projects (`docs/evidence/e2e-chat-slice-choice-type-2026-11-18.log.gz`).
* The offline suite total on the tip that adds `tests/documentation-commands.test.js` and the
  `tests/deployment.test.js` assertions is now measured in subsection 12: **190/191 with one failure**
  before the fix (the guard read its own quoted error as a documented file) and **192/192, 0 failed,
  0 skipped** after it. The **187/187** figures earlier in this section describe the tip before those
  two files were added. Subsection 13 adds one census test and measures **193/193, 0 failed, 0
  skipped (30,013 ms)** on its own fixed tree.
* A full `npm run test:e2e` summary for the current tip. Iterations 16 and 17 raised `--list` to
  **196 tests in 19 files**, and that suite passed **196/196 (22.2 m)** on `b87a6da`
  (`docs/evidence/e2e-gate-b87a6da-2026-11-18.log.gz`, subsection 18). The gate on the tip that carries
  the composition change ran on `c659a59` and is recorded there: **195 passed, 1 failed (22.2 m)**, the
  failure being the live AWS terrain fetch in `field-terrain.spec.js:4`, which passes in isolation. The
  frost change in subsection 19 has not been through a full gate, so a 196-case run on the tip that
  carries it is still owed; only its own summary line will be added here. The wider eight-spec chat
  slice used while measuring it also owes one clean run on an idle device - the two recorded attempts
  were load-degraded (subsection 19), and only the 16-case `chat-only-flow` + `assistant` slice on
  that tree is green so far.
* Unchanged and still unverified: real phones and touch, Safari/WebKit, microphones and ambient noise,
  audible read-aloud quality, independent agronomic review, and live Overpass availability from a network
  that can actually reach it - the section 6 fix is measured against refused connections, which is the
  failure mode a blocked or offline farmer sees. The answer-but-late path is now measured and bounded in
  section 8, but only against a stub, never against a real overloaded Overpass instance.



