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

* `node --test tests/matrix-coverage.test.js` → **18/18 passed, 0 failed**.
* `npm test` → **184/184 passed, 0 failed, 0 skipped**
  ([evidence/unit-regionless-2026-11-18.log](evidence/unit-regionless-2026-11-18.log)).
* `npm audit` → **0 vulnerabilities**.
* No app module, place row, crop record or model vocabulary changed in this step, so the tiny word LM is
  not retrained and the browser numbers recorded above still describe this code.

### Not verified here either

The same list as the section above: real phones and touch, Safari/WebKit, microphone and read-aloud audio
quality, independent agronomic review, and live Overpass field discovery.

