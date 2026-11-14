# Validation record — current release candidate

Date: 2026-11-14. This section supersedes the earlier planning assumptions; the user selected a browser-only static Vercel architecture and approved map-first dark-green/cream styling.

## Executed checks

- `npm.cmd test`: **37 passing tests**. Adapter units/fill/absence, schema changes, cache/coalescing, failures, equal horizons, crop restrictions/country filters, family repeats, pH/drainage, rain-free exposure, leap/year boundaries, static build, model topology/weight integrity, embedding-gradient arithmetic and startup reuse/port collision are covered. Offline scientific observations are explicitly labelled synthetic test inputs only.
- `npm.cmd run build`: emits `dist/client`, local Leaflet, the browser core worker and static model files. No functions, backend URL or secrets. Static-preview `/api/health` returns 404.
- `npm.cmd run start`: prebuilds, opens the browser and serves the app. A repeat invocation reuses the same project's preview without EADDRINUSE; an unrelated server keeps its port. Both branches passed actual HTTP tests and the CLI reuse was executed.
- `TEST_MODEL=1 npm.cmd run test:browser`: **23 passing checks** in Chrome 157.0.8103.78, 1280×1000 desktop and 390×844 mobile emulation. Correct 01–04 numbering, Next/Back controls, country selection/list changes and insufficient-coverage gating passed. Real named-place search, OSM field dropdown/selection, NASA charts/metadata, country pest lookup, nine dated crop slots, source-linked answers, invalidation, unassessed wheat, keyboard tabs and page-width overflow were checked. The compact language model loaded/inferred/unloaded. Blocking the data worker's actual NASA request yielded a visible error and disabled stale comparison. No `/api` network request occurred; no uncaught JS/CSP errors or unexpected external-resource failures.
- `node scripts/check-sourced-context.js`: a **static-only** preview retrieved real NASA and SoilGrids data at the York validation coordinate, showed dated ABS totals/derived ratios, left measured farm pH empty and returned sourced soil/water chat facts. No local backend API existed in that preview.
- `npm.cmd run test:live`: real POWER 2025 retrievals at Perth, Minneapolis and Nairobi had all five parameters available in those requests, with different seasonal temperature series. Latest non-missing date within each request was 2025-12-31. All five response units were checked. This does not establish crop suitability.
- All default code cells in `llm_training.ipynb`, `si_experiments.ipynb` and `pretrained_llm_finetuning.ipynb` executed with Python 3.14.7. Artifact inspection works; optional Python training paths correctly skip. No Python TensorFlow training/export is claimed.
- The deck was rendered in Chrome, checked for clipped content and exported as **exactly seven PDF pages**. Final deck/source packaging checks are repeated after content updates.

Raw reports and fixed model evidence are published in docs/evidence/ and source model evaluation files; local screenshots/profiles remain in ignored artifacts/.

## Compact language-model experiment

The accepted clean browser TensorFlow.js 4.22.0/WASM run trained a word-level Embedding(24) → LSTM(48) → Dense(word vocabulary) model for 50 epochs. It has 29,200 parameters and 116,800 weight bytes. It predicts next words, not classifier topic logits. A developer continuation was actually generated; raw generated words never become scientific app output.

The corpus is labelled DEVELOPMENT/synthetic question wording with source-linked explanatory continuations, not fabricated NASA readings or human-reviewed farmer data. Splits share topic vocabulary, and the vocabulary included held-out wording. Results are optimistic development evidence: 75/90 expected topic selections; only 9/18 free-form cases. Full failures remain in public/models/fieldshift-mini/evaluation.json. No agronomic accuracy or confidence is inferred.

One Chrome/WASM run: 903 ms cold load, 652.6 ms warm load, 84 ms neural inference and 10 ms first evidence answer. Weights: 116,800 bytes. Resident initialized tensors: 116,800 bytes; WASM heap capacity: 16 MiB. Full peak browser/process memory and real mobile behavior are unmeasured. Timings are one test machine, not guarantees. Sourced evidence renders before inference and remains if the model is inconclusive, unloaded or unavailable.

## Observed failures and fixes

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

Other browser engines, real mobile hardware, independent farmer-question evaluation, measured soil/crop-water balances, full model-process peak memory and broader local agronomy remain unverified. These limits are disclosed rather than marked passed.

The exact challenge brief and supplied Explorer team page were successfully read from their public rendered-data streams. The team is Explorer, Singapore, and was unsubmitted at inspection. The general NASA November 15 local-time deadline and seven-slide/30-second format were verified from official sources; the team owner must check event-specific portal exceptions and perform submission.

A live Vercel deployment is not claimed without authenticated account access and success evidence. Vercel settings are checked in; the earlier private Sites exploration was never published and its adapter was removed. No NASA submission was made by these tools.

Final release checks: 53 own JavaScript files passed `node --check`; the static preview served the app, seven-page PDF, source ZIP and exact 116,800-byte model weights (HTTP 200). `/api/health` returned 404. The source ZIP was reopened and every file checked against its SHA-256 manifest; it excludes local browser profiles, dependencies, secrets and build outputs. Desktop and 390px screenshots were reviewed after the workflow changes. No public source push or production deployment is implied by local packaging.
