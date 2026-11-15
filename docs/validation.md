# Validation record — current release candidate

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
