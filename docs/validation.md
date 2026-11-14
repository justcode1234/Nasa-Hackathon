# Validation record — current release candidate

Date: 2026-11-15 (local). This section supersedes the earlier planning assumptions; the user selected a Node.js backend for local testing alongside a browser-only static Vercel showcase. Previously recorded styling is preserved; no CSS polishing was added.

Latest chat/action verification: **74 offline tests, 31 static Chrome checks,
17 Node-backed Chrome checks and 16 Firefox checks passed**. Both browser delivery
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

Production verification also passed **31 public Chrome checks** on
https://nasa-hackathon-three.vercel.app/ at source 4af1dab. The optional model loaded,
inferred and unloaded, and chat completed India planning through step 4 using real
NASA data. Twelve public files matched local build SHA-256 values; HTTP 200 assets
include the source ZIP/PDF and model files. /api/health returns 404 for this static
showcase. Checkpoint reports are docs/evidence/public-browser-validation.json and
public-file-validation.json; docs/deployment.md records exact release attribution.

## Executed checks

- `npm.cmd test`: **74 passing tests**. Adapter units/fill/absence, schema changes, cache/coalescing, failures, equal horizons, crop restrictions/country filters, family repeats, pH/drainage, rain-free exposure, leap/year boundaries, static build, model topology/weight integrity, embedding-gradient arithmetic, location-lookup races, process-memory bookkeeping and isolated startup reuse/port collision are covered. Offline scientific observations are explicitly labelled synthetic test inputs only.
- `npm.cmd run build`: emits `dist/client`, local Leaflet, the browser core worker and static model files. Country-sized GeoNames place files are included without entering the initial worker bundle. No Vercel functions, backend URL or secrets. Static-preview `/api/health` returns 404.
- `npm.cmd run start`: prebuilds, opens the browser and serves the app. A repeat invocation reuses the same project's preview without EADDRINUSE; an unrelated server keeps its port. Both branches passed actual HTTP tests and the CLI reuse was executed.
- `TEST_MODEL=1 npm.cmd run test:browser`: **31 passing checks** in Chrome 157.0.8103.79, 1280×1000 desktop and 390×844 mobile emulation, against a freshly built static preview. Correct 01–04 numbering, Next/Back controls, country selection/list changes and insufficient-coverage gating passed. Real named-place search, OSM field dropdown/selection, NASA charts/metadata, country pest lookup, nine dated crop slots, source-linked answers, invalidation, unassessed wheat, keyboard tabs and page-width overflow were checked. A UI-only held-country-response fixture verified that editing coordinates cancels an earlier pending evidence submission; it supplies no NASA observations. The compact language model loaded/inferred/unloaded. Blocking the data worker's actual NASA request yielded a visible error and disabled stale comparison. No `/api` network request occurred; no uncaught JS/CSP errors or unexpected external-resource failures.
- `node scripts/firefox-validation.js`: **16 passing checks** in installed Firefox 160.0 using native WebDriver BiDi, an isolated profile and the real static build. Real NASA charts, country crops, three timelines, unsupported wheat, input invalidation, a 390px viewport and real arrow-key navigation passed. Blocking the model runtime preserved sourced chat; removing the block allowed WASM model load/inference/unload. Blocking the actual worker NASA request produced an error and disabled comparison. No backend `/api` request or uncaught JavaScript exception occurred. Raw evidence: `docs/evidence/firefox-validation.json`. No browser or driver was downloaded. `npm run test:firefox` now aliases the same script.
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
- `npm.cmd run test:node-browser`: **17 passing checks** against the Node-backed frontend in Chrome. The test blocked browser NASA access and the browser data-worker script, yet real NASA observations, comparison timelines and sourced questions worked through Node HTTP APIs. The optional model was explicitly unloaded. A test-only upstream failure reached the UI without substitute observations, disabled comparison and recovered on retry. Country/town browsing selected Cambridge through the Node list endpoint. Raw evidence: `docs/evidence/node-browser-validation.json`.
- The static Chrome run now passes **25 checks**, including country -> region -> town selection without typing, country-change clearing, real NASA, optional model loading/unloading and actual worker-request failure. Firefox passes **10 checks** on the current static build. The original Node test attempt incorrectly expected page-level CDN blocking to force a worker-model failure and timed out; the accepted Node check explicitly unloads the model instead. Firefox independently exercises actual model-runtime blocking.
- GeoNames snapshot: **70,036 places / 245 countries and areas**. Offline checks verify every country file's SHA-256, byte count, source coordinates, region join and IDs, plus missing-country coverage, malformed responses and failure/retry. The full raw city dump is not bundled into the initial worker. Country lists total 4,254,070 bytes; the largest is 453,783 bytes. A selected town is a location reference, not a farm or agricultural recommendation.
- A reproduced scientific-scope bug mapped unspecified maize/corn to sweet-corn maturity. Generic aliases were removed. Two regression tests now keep those baseline names unassessed and restrict sourced sweet-corn answers to explicit sweet-corn names in both runtimes.
- A source-data edge case supplies blank administrative-region codes for some towns. The optional filter now uses a distinct All-regions value; selecting Region not recorded genuinely filters that subset. The Node-backed browser check exercises this with the UK list. The mobile picker screenshot was reviewed. Added slide copy initially overflowed slide 3; shorter copy restored the verified seven-page layout without CSS changes.

The main scientific limits remain: four starter crop types, a historical-year analogue, no crop water balance or validated global planting advice. Real mobile hardware, Safari/WebKit and exact full-session peak memory remain unverified. Vercel publication and portal submission have not occurred.
