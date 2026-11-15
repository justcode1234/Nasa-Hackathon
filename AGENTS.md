# AGENTS.md — FieldShift (NASA Space Apps Challenge 2026)

> Instructions for Codex. Read this file before writing code. This project is in its planning/early implementation stage. Preserve user decisions, build incrementally, and do not treat suggested features as already implemented.

> **Current implementation and cross-device handoff:** read section 10 at the end
> before resuming work. It records later user decisions and current verified state.
>
> **Next work (start here):** section 12 and
> **docs/plans/codex-final-quality-handoff.md** are the active plan (final quality
> review before the NASA deadline). Section 11 and the older plan file are implemented
> history. Section 10 records verified state. Earlier user decisions remain in force.
> Never merge or deploy to production, or touch the NASA submission, without the
> user's explicit approval.

## 1. Mission and product rules

Build **FieldShift**, a **global, location-adaptive crop-rotation decision-support web app** for the 2026 NASA Space Apps Challenge: **“Field Shift: Adapting Farms with NASA Data.”**

The user selects any supported location, enters the existing crops/rotation and farm constraints, and gets **at least three comparable crop-rotation scenarios** (the existing rotation plus two alternatives). Each scenario must explain suitability, trade-offs, risks, evidence, limitations, and uncertainty.

- **Do not hardcode Singapore or any single crop as the product's scope.** Use optional named locations only as demonstration/test fixtures.
- Global **map availability** is not the same as validated **agronomic recommendations everywhere**. Clearly label where crop or soil information is missing.
- This is **decision support**, not an autonomous farming authority. Never guarantee yield, savings, soil improvement, disease prevention, or safety.
- Use **actual NASA data**, not invented observations or invented precision. NASA datasets have different resolutions and observation delays.
- The app must remain useful when AI/chat is disabled: maps, data, rotation comparisons, and explanations must still work.

## 2. Fixed technology decisions

- **Backend:** Node.js; use minimal dependencies. Express is acceptable if it simplifies routing. Use built-in `fetch` for NASA requests where appropriate.
- **Frontend:** vanilla HTML, CSS, JavaScript (ES modules). **No Next.js, React, Tailwind, or large UI framework** unless the user explicitly changes this requirement.
- **Mapping:** a lightweight interactive mapping library such as Leaflet is allowed.
- **Charts:** lightweight charting library or plain SVG/canvas, chosen only for a concrete need.
- **SI training/experiments:** Python **Jupyter notebooks + TensorFlow/Keras**; export a small model to a browser-compatible format when feasible (e.g., TensorFlow.js).
- **Browser AI:** evaluate a small pretrained quantized language model and browser runtime (e.g., WebLLM/WebGPU) for natural-language answers. **Do not pretend a TensorFlow classifier is a generative LLM.**
- **Deployment:** an ordinary Node.js host/static frontend. Avoid unnecessary accounts, infrastructure, databases, authentication, and paid services for the prototype.
- **Visual design:** postpone detailed CSS and brand decisions until core features work. Keep early screens clean, readable, usable, and semantically structured.

## 3. Exactly four product modules

| # | Module | Responsibilities | Minimum proof it works |
|---|---|---|---|
| 01 | **SI Model** | Interpret environmental/crop inputs, generate feasible candidate rotations, rank them using transparent criteria, answer farmer questions using retrieved evidence | Same inputs give reproducible rankings; a question about a crop is answered from traceable data |
| 02 | **Geospatial Map** | Select a global location or optional farm boundary; show where each NASA layer applies and its actual spatial resolution | A different coordinate changes the selected location and downstream inputs |
| 03 | **Data Flow** | Fetch, normalise, cache, date-stamp, and visualise NASA observations (rainfall, heat, soil moisture/vegetation when available) | Real measurements appear with source, units, observation period, and missing-data notices |
| 04 | **Strategy Logic** | Compare baseline + alternatives by seasonal fit, crop families, water requirements, nutrient/soil effects, potential pest-cycle impacts, farmer priorities and uncertainty | User can see at least three comparable rotation timelines with reasons, evidence, risks and gaps |

**Typical information path:** 02 → 03 → 01 → 04. Farmer inputs feed 01 and 04. The four modules share the same validated data contract; avoid duplicating scientific calculations in the UI.

The challenge video also references imaginative extensions. **Do not build a fifth “Future X” module.**

## 4. Data and scientific integrity

**First integration: NASA POWER Daily API** for historical temperature, rainfall/precipitation, and solar conditions at a selected coordinate. Start with a small documented parameter set, e.g. `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN` where supported. Confirm actual response units, dates, missing-value codes, spatial support and API behaviour with live tests.

Then evaluate, **only if feasible**:
- **GPM IMERG:** regional precipitation and extremes.
- **SMAP:** regional soil moisture (not a field-bed moisture sensor).
- **Landsat / MODIS:** vegetation indicators and time trends where pixels, cloud cover and land cover permit.
- **ECOSTRESS:** thermal/vegetation-water-stress evidence with coverage limits.
- **GRACE/GRACE-FO:** very large-area water trends; **never** label these farm-level measurements.

Every observable value shown to the farmer needs: **source/product, units, observation or aggregation date, geographical/spatial resolution when known, retrieval time, missingness, and whether measured/estimated/scenario-based.** Do not label old observations as live or real-time. NASA POWER may have near-real-time delays; display the latest available observation, not the current clock time as if it were measured.

Use **separate referenced agricultural sources** for crop families, growing conditions, crop durations, nitrogen fixation, soil effects, and rotation constraints. NASA weather records **do not** constitute a worldwide crop recommendation database. Start with a small traceable dataset, then expand it through verified entries. Mark uncertain/unsupported crop or location cases as such.

For candidate rotations:
- Always include the user's baseline; compare equal time horizons and consistent scoring definitions.
- Evaluate crop-family repetition, calendar fit, water availability, heat/rain vulnerability, and user priorities.
- Differentiate **observations**, **derived indicators**, **rules**, **model outputs**, and **assumptions**.
- Never invent confidence percentages, predicted yield increases, water savings, nitrogen amounts, or economic returns. Only display quantitative claims supported by a transparent and documented calculation plus input data.
- Prefer understandable breakdowns, warnings and uncertainty ranges/categories over an opaque “optimal crop” assertion.
- If soil type, irrigation, pest history, economics or local agronomy is missing, explicitly say what cannot be concluded.

## 5. Mini-LLM / TensorFlow plan (important feasibility boundary)

The user wants a **small, locally running browser assistant** that can respond to questions such as “What crop should I plant here?” while incorporating newly retrieved NASA information. Implement this as **retrieval + validated decision logic + optional browser language model**, not by expecting tiny model weights to store current NASA data.

**Architecture:**
1. The browser sends selected coordinates, farmer inputs, and question to Node.js endpoints (or calls the existing endpoints directly).
2. The backend fetches/serves current-*available* NASA observations, normalises them, and passes structured facts to the deterministic agronomy engine.
3. The engine returns comparable rotation results plus reasons, source IDs and limitations.
4. A browser-local quantized LLM **may phrase/summarise these facts** and answer follow-up questions. It must not manufacture satellite readings, crop facts, sources, numerical confidence or unsupported recommendations.
5. Where a model cannot load or lacks device support, present clear, deterministic template-based answers from the same trusted results. **No fake AI responses.**

**Training notebook:** Create `notebooks/si_experiments.ipynb` to investigate a **small TensorFlow/Keras task model**, such as question-intent classification or candidate-rotation ranking, only if there are suitable labelled examples. Document dataset source, split, evaluation, failure cases, trained weights, export procedure, and reproducible environment. Do **not** train a generative LLM from scratch on a tiny dataset and call it reliable. Fine-tune a compact pretrained language model **only if** the actual training/export/in-browser runtime combination is demonstrated to work. TensorFlow training and a WebLLM runtime are **not automatically interchangeable**.

**Initial performance target, to be measured rather than claimed:** aim for browser model assets around **300 MB or less**, with peak client memory around **1 GB or less** on a test device. Assess actual download size, memory, inference latency, browser/WebGPU support and mobile fallback. These are *targets*, not promised guarantees. Do not force a model choice until benchmarks pass. Load AI **on demand**, not on initial page load; keep map interactions responsive (use a worker where appropriate).

The LLM must never autonomously access arbitrary third-party URLs, invent tool results, or execute actions. NASA retrieval stays in explicitly validated app code.

## 6. UI / anti-"AI slop" rules (design planning now; detailed CSS later)

**“AI slop”** refers to low-quality, mass-produced AI content. In web design it often manifests as generic layouts, irrelevant decoration, fake figures, shallow copy and nonfunctional components. Our standard is **deliberate, farmer-specific, data-first design**, not merely “looks modern.”

**Do not:**
- Build the default purple/blue gradient hero with glassmorphism, endless rounded cards, giant glowing headings and random floating blobs.
- Use meaningless decorative charts, synthetic precision, fake user counts, fake “98.4% accuracy,” placeholder values presented as live NASA data, or stock imagery pretending to depict our mapped farm.
- Add generic AI copy such as “Revolutionise your farming journey,” unnecessary emoji/icon spam, constant animations, or identical card grids as a substitute for information architecture.
- Hide crucial scientific assumptions in tooltips, tiny footnotes or an opaque total score.
- Build buttons, filters, map overlays or sliders that do nothing. No fake data connections or cosmetic-only “AI analysis.”

**Do:**
- Make the primary farmer workflow obvious: **pick place → provide constraints → inspect evidence → compare rotations → understand trade-offs**.
- Give data and useful comparisons the visual priority. Use real units, legends, accessible contrast, readable scales, source labels and honest loading/empty/error states.
- Use meaningful language instead of hype. Prioritise clarity for non-technical farmers and mobile usability.
- Define a coherent typography, spacing, grid, color and interaction system **later in a separate visual-design pass**, using actual content and reviewed references. Avoid deciding a theme by imitation of the provided video screenshots.
- Use semantic HTML, keyboard-accessible forms, visible focus, reduced-motion preferences, and responsive layouts.
- Review screenshots at realistic viewport sizes; remove any visual element whose purpose cannot be justified.

**Design gate:** After functionality and key workflows have been validated, present a brief visual-direction proposal to the user **before** extensive CSS polishing. The user explicitly asked not to design the CSS yet.

Research used: Merriam-Webster definition (`https://www.globenewswire.com/news-release/2025/12/15/3205236/0/en/Merriam-Webster-Announces-Slop-as-the-2025-Word-of-the-Year.html`) and design-pattern discussions (`https://slopfix.getbags.app/checklist`, `https://github.com/wpgaurav/design-slop/blob/main/SKILL.md`). Treat those design checklists as heuristics, not universal bans on any component.

## 7. Practical initial project structure

```text
AGENTS.md
README.md
package.json
server/
  index.js                  # Node.js entry point and API routes
  nasa/power.js             # NASA POWER adapter + caching/validation
  agronomy/rotation.js      # deterministic candidate generator/scoring
  agronomy/crops.json       # small sourced crop dataset
public/
  index.html
  css/app.css               # minimal CSS first, polish later
  js/app.js
  js/modules/si.js
  js/modules/map.js
  js/modules/data-flow.js
  js/modules/strategy.js
  js/lib/api.js
notebooks/
  si_experiments.ipynb      # TensorFlow feasibility/training experiments
  README.md
models/
  README.md                 # model card/benchmarks, binaries if permitted
tests/
  nasa.test.js
  rotation.test.js
  integration.test.js
 docs/
  data-sources.md
  decisions.md
  validation.md
```

Structure is a **starting suggestion**, not a reason to generate empty files. Use only what has working code. Keep a simple `npm start` / `npm test` experience.

## 8. Implementation gates and how Codex must work

| Gate | Build | Must pass before moving on |
|---|---|---|
| **G0 — Specification** | Define data contracts, minimal farmer inputs, baseline/scenario structure, test criteria and sourced starter crops | A coherent written plan and no conflicting assumptions |
| **G1 — Data** | Running Node server, global coordinate selection, tested NASA POWER retrieval, basic crop metadata | Different coordinates yield appropriately different real observations; missing/error responses handled |
| **G2 — Strategy** | Deterministic, explainable rotation logic, three comparable rotations and uncertainty | Unit tests on crop family, windows, missing fields, constraints; source traceability |
| **G3 — Four modules** | Map, data charts, SI assistant pathway, strategy comparison wired end to end | Browser can complete the entire flow; no dead controls; AI fallback works |
| **G4 — Validate** | Tests on contrasting global locations, API failures, model memory, browser support, unsupported agronomy cases | Document observed failures and fix high-impact ones; no invented scientific outcomes |
| **G5 — Presentation** | User-reviewed CSS direction, public deployment, scientific evidence, concise challenge submission demo | Public URLs accessible without login, AI use disclosed and NASA sources credited |

**Codex operating rules:**
1. Start by reading `AGENTS.md`, then inspect the actual repository before assuming files exist.
2. **First response/action:** briefly report proposed G0 architecture and specific immediate tasks; create a working skeleton only after requirements are internally consistent. Do not invent that work is complete.
3. Make small, testable changes. Finish each gate to a working state; don't scaffold all features with fake demo data and claim success.
4. Run and report actual commands/tests. Separate **tested**, **unverified**, **blocked**, and **proposed** items. Never mark a test passed unless executed.
5. Keep any demo fixtures unmistakably labelled **DEMO / synthetic**; never blend them into production NASA results.
6. Use stable API/data contracts and clean separation between map, data adapters, agronomy logic and optional LLM narration.
7. Don't silently introduce heavy dependencies, paid APIs, credentials, new frameworks, external model downloads or architecture changes. Explain trade-offs before changes that are hard to reverse.
8. Never expose secrets, commit real API keys or run untrusted generated code from the chat model.
9. Keep `docs/decisions.md` and `docs/validation.md` updated with decisions, source references, tests, known limitations and remaining work so context survives long coding sessions.
10. Ask the user for a decision only if essential. Otherwise pick the simplest reversible approach and document the assumption.

## 9. Submission context

The project must demonstrate NASA data usage and explain how its proposed rotations help farmers **compare alternatives, reveal trade-offs, understand risk and make uncertainty visible**. The challenge welcomes SI, but the application's scientific credibility matters more than a flashy model.

The supplied *NASA Space Apps 2026 Project Submission Guide* indicates a demo **up to seven slides OR a 30-second video**, a project summary and detailed description, a public project/demo link, NASA data/resource citations, other data citations and disclosure of SI/AI use. Respect the relevant 2026 deadline and verify local-event timing in the team portal; **submission prep must not wait for a perfect model**.

### Reference documentation (consult/verify during implementation)

- Challenge: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/
- NASA POWER daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- TensorFlow.js conversion guide: https://www.tensorflow.org/js/guide/conversion
- TensorFlow.js runtime and memory: https://www.tensorflow.org/js/guide/platform_environment
- WebLLM browser runtime: https://github.com/mlc-ai/web-llm

**Priority when there is a conflict:** scientific honesty and working functionality > benchmarked, optional browser AI > CSS polish and extra features. User-approved requirements override speculative implementation ideas in this document.

## 10. Current implementation and cross-device handoff - 2026-11-15

- **Release gate GREEN; voice input and typed-judgment experiment added (Claude Code session, 15 Nov):**
  `npm run test:release` passed 117/117 offline and 116/116 browser cases (29 per project,
  zero skips/flaky, no field retries needed). Evidence: docs/evidence/v5-green-release-summary.json
  (+ raw .json.gz and log). Changes since ef11d3a:
  - **Field lookup fixed.** The client gave up after 25 s per service while overpass-api.de
    answered in 26-27 s. Lookup now overlaps three public Overpass services with exponential
    backoff (three attempts each) under one 75 s deadline; nothing is substituted on failure.
    Live field -> terrain drape -> slope passes in all four projects. An intermediate full run
    was 95/96 (one real all-services-busy window, v5-field-fix-release.json); tests now press
    the app's Retry like a user (max twice) via tests/e2e/live-fields.js and still require real
    fields. These are shared volunteer services: a later run can still fail if all are down.
  - **Voice input implemented.** Mic button in chat -> explicit permission -> Whisper tiny.en
    (onnx-community export, revision 794207f, q8; 43.5 MB measured) transcribed on the device
    with vendored Transformers.js 4.3.2 + ONNX Runtime Web (public/vendor/transformers, built
    from node_modules; 26.9 MB WASM). Transcript goes to the editable message box; never
    auto-sent. Unload button, 20 s cap, permission-denied, download-failure and cancel paths
    are tested. Measured on the development desktop: about 3.4 s load, 1.7 s for a 4 s clip.
    The test clip is synthetic Windows-voice English (tests/fixtures/TEST-...wav).
  - **Read aloud implemented with the built-in on-device English voice** (speechSynthesis,
    localService only). KittenTTS was NOT adopted: no stated training data/English-only
    provenance, no official web package, GPL espeak dependency. Details in docs/decisions.md.
  - **Typed-judgment experiment (Jev-inspired, not Jev) trained, NOT wired into the app.**
    33,229 parameters; held-out 95 messages: action 77, unsupported 80, topic 43 vs rules
    75/81/50. See models/judgment/README.md and evaluation.json. Do not present its
    probabilities as agronomic confidence.
  - New dependencies: @huggingface/transformers 4.3.2 (runtime, vendored; 3.8.1 rejected for
    a flagged sharp dependency), @tensorflow/tfjs 4.22.0 (dev only). npm audit: 0 findings.
    CSP connect-src adds huggingface.co, us.aws.cdn.hf.co and maps.mail.ru only.
  - **Unverified:** real phones, real accents/noise, speech memory use, Safari/Firefox voice
    behaviour, audible TTS output, independent label review for the classifier.
  - Branch push and Vercel PREVIEW status are recorded in docs/deployment.md. Production
    stays frozen at Phase A (main f4c4fef).

- **(Superseded by the entry above) New user scope:** implement small English-only STT/TTS with a mic option in chat and investigate/train a local typed classifier inspired by TypeSafe AI Jev. User corrected JEPA/LeJEPA: do not build JEPA. Research/requirements and actual dependency findings are at the end of docs/decisions.md. No speech dependency/model is installed yet. The 3D visuals are approved for preview, but full release still fails: 114 offline pass, 84/92 browser pass; standalone Ames field-terrain additionally fails all four projects at discovery. Current release suite has 96 browser cases. Keep the original field requirements and production freeze.

- **(Historical; superseded by the green-gate entry above) V5 visual approval received; full release still fails at fields:** user approved the current visuals for preview. Full release: 114 offline pass; 84/92 browser pass, eight real-field failures, no skips/flaky cases; 44 axe scans pass. All 3D point/data/window/retry cases pass. Node Cambridge returned fields, then York failed: availability is partial. Ames field drape is now a standalone real-discovery test (all four fail at discovery), not gated behind unrelated example failures. Exact branch-only Git deployment suppression permits cross-device sync without creating a release; push verification is pending. Reports: docs/evidence/v5-release*. Production core hashes and remote main still match Phase A.

- **V4 crop-window linkage locally verified; V5 review in progress:** crop slots use the same shared calendar/rain functions as strategy, with exact daily grid/point and strategy-total guards. Leap substitution, December wrapping, missing days and zero-rain runs are covered. Linked windows show maturity-assessment days, not whole four-month slots; input edits clear the link. 114 offline tests and eight focused V4/V5 browser cases passed, including 24 axe state scans, reduced motion and short screens. The review exposed OSM fetches missing from connect-src; both CSPs are fixed and the regression now passes. Actual application + loaded mini-LM measurements: 2.899 s desktop / 1.619 s phone-sized open-to-data, about 60 fps, 846.6 / 762.0 MB max sampled working set. These are desktop Chrome, not real-phone or exact peak guarantees. Full report: docs/evidence/v5-app-benchmark.json. Full release, live-discovered field drape, real-phone measurements (if available), visual signoff and preview delivery remain. Production stays frozen.


- **(Historical; field flow now verified, see top entry) V3 terrain implemented, field browser flow still unverified:** shared PNG/DEM context, hillshade, selected-field drape, x1/x2/x3 display-only exaggeration and explicit sampling/missingness are implemented. 112 offline and eight real-terrain browser cases pass. A separate live Node HTTP check assessed a known Ames polygon (907 gradients); a small Naivasha polygon stayed unassessed (five). These one-object provenance probes are not field-discovery fallbacks. Overpass still blocks the actual browser field-selection/drape success path and full release. Full source/method/limits and raw results: docs/evidence/v3-* and docs/validation.md. V4 strategy linkage and V5 complete validation remain.

- **V2 imagery locally verified:** four NASA GIBS products use current capabilities dates/legends and verified native product resolution. Shared Node/worker metadata adapter rejects gaps, unsafe URLs and unsupported intervals. Imagery is labelled visual context; values are never extracted or sent to scoring. Metadata retry and tile-failure notices are implemented. 107 offline tests and 12 GIBS browser cases pass (four projects, 16 real product selections); V1 retains its 16-case passing report. Reports: docs/evidence/v2-*. V3 terrain/field context, V4 strategy linkage and V5 full validation remain. Production stays frozen; actual-field checks still block release.

- **(Historical; gate now green on feature/3d-evidence-map) Phase B implemented but release blocked on feature/review-phase-b:** seven sourced crops cover 166/197 countries; 99 offline tests pass. Results/evidence wording, archived workers, tighter CSP, arrow semantics, axe licence and pixel-identical CSS cleanup are implemented. Full release: 36/44 Playwright cases pass, with all 8 failures at live Overpass field lookup; zero skips/flaky results. All 20 axe state scans and 12 model-on QA executions pass. Four enhanced transport-failure cases also pass: Retry preserves coordinates, and real NASA evidence still leads to step 4 using the explicit point (phase-b-playwright-field-degradation.json). Fresh browser probes show both Overpass deadlines expiring with no CSP errors; status endpoints also time out from this device. Production core hashes still match Phase A (phase-a-freeze-recheck.json). Production stays at f4c4fef; no Phase B deployment. Raw results: docs/evidence/phase-b-playwright-local.json and phase-b-playwright-retry.json.
- **Phase C preview approved; V1 locally verified on feature/3d-evidence-map:** the user approved preview implementation on 15 November. MapLibre 5.24.0 proved vulnerable to CVE-2026-85061 during installation; patched 6.4.1 is now pinned (zero npm audit findings), with repeated desktop measurements 1.68 s / 60 fps / 672.3 MB max sampled working set; 293 KB gzip modules+CSS. Real-phone and combined-model memory remain unverified. Native rain cells, month control/table equality, missingness, WebGL fallback, provider retry and stale-load cleanup pass 16/16 V1 Playwright cases across four projects; npm test passes 104/104. Metadata and all raw reports are in docs/evidence/v1-* and maplibre-6.4.1-*.json. Node and worker share /api/power-grid. V3-V5 remain. Production stays frozen; live Overpass success cases still block deployment.

Update this section and docs/decisions.md / docs/validation.md after each substantive
implementation change. Record what changed, actual checks, remaining work and deployment
state. Do not leave another device relying on an earlier planning assumption.

- **Review plan execution, Phase A released:** submission example now uses
  enterable York/Australia baseline and allowed crops, with saved real NASA/engine
  output. New rural Ames and Naivasha points returned 11 and 8 complete OSM fields
  in Node probes. Chat Send focus, labelled uncertainty, readable runtime/footer,
  credits/licence delivery and short-height document scrolling are implemented.
  `npm run test:release` passed 95 offline and 32 Playwright cases, exit 0, across
  both runtimes and viewports. All four examples return at least 3 complete fields;
  the fixture's exact sequences match the live UI. At 683×384, 640×360 and 844×390,
  measured usable height is 73.0%, 65.7% and 68.8%, with no horizontal overflow.
  Seven-slide layout/PDF checks pass. Public app source 70eafb1 passed 16
  desktop/mobile Playwright cases, exit 0; all 21 checked public app, licence,
  model and submission assets match the build. Reports: phase-a-playwright-local,
  phase-a-playwright-public and phase-a-public-assets under docs/evidence.
  MIT/third-party delivery (B4) is pulled forward because A6 needs a real credits
  link. This Phase A release is the submission candidate. Freeze production after
  this checkpoint; Phase B/C work belongs on feature branches and Vercel previews.
  Only the owner submits through NASA's portal; portal submission is unverified.

- **Current goal: Next/Compare fix and Playwright flow tests (verified release).** The user
  reproduced a blocked step-3 screen. Earlier coverage tests checked that Compare
  was disabled but missed the unusable Next/recovery experience. The new Playwright
  test failed against the previous public app on the actual Next click (step 01
  stayed hidden). New UI distinguishes absent country rules from unchecked crops,
  keeps a visible reason beside navigation, and routes Next to country selection,
  evidence loading or allowed-crop selection without clearing entered values.
  NASA request errors now open the visible evidence panel with Retry.
  Playwright 1.65.1 is an explicitly requested development dependency; it uses the
  installed Chrome, with no browser/model download. Four projects exercise static
  and Node frontends at 1280px and 390px. Tests use real NASA data, with deliberate
  transport failure followed by real retry; they never fabricate readings.
  `npm run test:release` is required before future behavior releases. It runs
  unit/logic tests plus Playwright: 95 offline + 16 Playwright tests pass locally,
  including all sixteen original QA prompts in every project (64 executions).
  The existing 33 Chrome and 18 Firefox checks also pass on this UI fix.
  Public verification passes all 8 desktop/mobile Playwright cases (32 original
  QA question executions), with no skips/flaky/unexpected results. App source
  0fe50ce is deployed at the existing origin, deployment
  dpl_uzcTt6tDRGxXKXwBVHHE2kz1fhnX. Fourteen public assets match the build. Source
  and test hashes, raw answers and results are under docs/evidence/playwright-*.json;
  docs/playwright.md explains the release command and coverage. A disabled Compare
  assertion alone is not a flow test. Both Next and Compare must preserve the exact
  baseline and render two distinct alternatives; the browser tests assert this.

- **Current user goal — resolve QA gaps and improve the tiny LM (verified release):**
  fix all nine failed prompts in shared grounded answers and validated action
  parsing; retrain/evaluate the optional small word LM using additional development
  wording and a fixed held-out set, without training on the 16 acceptance prompts.
  Require 16/16 prompts and 6/6 flows locally and on Vercel, model-on/model-off
  verification, variant regressions, existing checks, and an honest model comparison.
  Preserve scientific uncertainty and source limits. Do not label these checks
  perfection or agronomic accuracy. The earlier foundation objective is complete;
  the goal tool now tracks this explicit assistant/retraining/release objective.

- **Assistant improvement checkpoint:** shared capability-limit/pH/family/grain
  handlers and read-only intent guards close the nine baseline QA gaps locally.
  Region/point checks handle the combined Maharashtra/Pune coordinate command.
  Local model-off and model-on QA both pass 16 questions + 6 flows; 93 offline
  tests pass. Accepted LM v2: 39,274 parameters / 157,096 bytes, 346-word vocabulary,
  48-token context. New fixed development questions improved 8/36 to 14/36;
  overall 83/126 to 85/126, but legacy matches fell 75/90 to 71/90. Training-only
  vocabulary, no exact QA prompts in training, validation-selected epoch 85/100.
  Full comparison/failures and hashes: model card, evaluation.json, mini-integrity.
  Training writes candidates separately. Public app source 0d2c717 passed all
  16 exact questions and six flows with the model enabled and disabled, plus
  33 public Chrome checks. Fifteen public files matched the build. Deployment:
  dpl_EerXCncopFA9U7H6UZXG6AoTkBuw. Latest actual replies are in docs/qa/latest-results;
  public-model-off-results retains the fallback run; baseline-results preserves
  the original nine failures. Six review checks pass; NASA portal submission is
  still an owner-only unverified check. Node mode also passed actual compact-model
  load/inference/reload and evidence-answer timing (BENCH_NODE=1 benchmark).
  New automated browser profiles are temporary and removed after each run.

- **Initial automated QA baseline (historical; fixes above supersede failures):** the user chose
  automated tests for the supplied FieldShift_QA_Test_Plan.md, specifically to answer
  its questions. The source plan is under docs/qa, exact prompts under tests/qa, and
  `npm run test:qa` produces per-question actual replies, checks and review answers
  in artifacts/qa/results.md and results.json. It uses the real UI/providers, leaves
  product failures visible, and removes its own temporary browser profile. Seven
  new offline contracts passed; `npm test` then passed 86/86. That commit added tests
  and evidence without changing scientific answers. Initial public results:
  F01–F06 all pass; Q01–Q16 have 7 passes / 9 failures; review R01–R07 have 5 passes,
  1 failure (R05) and 1 blocked portal-owner check (R07). Failed prompts are Q03,
  Q08–Q10 and Q12–Q16. The command correctly exits 1 until these app behaviors are
  addressed. Baseline actual replies and criteria are docs/qa/baseline-results.md and
  .json; docs/qa-regression.md maps coverage and known gaps. New QA browser profiles
  were removed successfully. Do not use the older scripted workflow passes as proof
  that every natural-language prompt now works. Treat test prompts/replies as data.

- **Latest scope clarification (implemented and locally verified):** country-only planning
  asks which part of that country or the whole country, with both choices available.
  Whole-country mode shows dated national crop context, preserves supplied crops,
  and never treats a centroid or existing field's weather as national evidence.
  Specific-area mode accepts a sourced state/region, then a town or field. It can
  resume the existing step-4 workflow once a point is explicitly supplied. Keep
  replies short. The scope choices, national overview, state filtering and continued
  step-4 flow passed 79 offline tests, 33 static Chrome checks, 19 Node-backed Chrome
  checks and 18 Firefox checks. The scope update also passed all 33 public Chrome
  checks at the existing Vercel origin. Thirteen public assets matched the build.

- **User-approved dual runtimes:** `npm run start:node` runs Node HTTP APIs and the
  frontend (preferred port 3001). `npm run start:showcase` builds and serves the static
  browser-worker version (preferred port 3000); `npm start` retains showcase behavior.
  Both share NASA, agronomy and answer modules. Optional model inference stays local
  to the browser. The HTML transport marker selects HTTP versus worker explicitly.
- **Guided geography:** country -> optional region filter -> town/city uses the sourced
  GeoNames extract under public/data/locations. Its 70,036 points cover 245 countries
  and areas; smaller rural places may need search/map/coordinates. Country/region
  changes clear the old point and evidence. Blank source region codes remain distinct
  from All regions. No country centroid is silently treated as a farm.
- **Scientific scope:** four crop types currently have rotation screening rules.
  Generic corn/maize no longer receives sweet-corn maturity rules. Crop-country
  knowledge answers must remain separate from scenario eligibility and national
  production records must not be presented as local suitability proof.
- **Crop-country chat implemented and browser-verified:** the question can
  name a crop and country independently of the map. FAOSTAT commodity matching covers
  the saved global production extract; sourced cultivation profiles cover kai lan,
  rice, wheat, tomato and the four screening crops. NParks, IRRI and UMN references
  retain their scope limits. These extra knowledge profiles do not become ranked crops.
  Greetings get one short reply; answers have at most three paragraphs and three
  follow-up buttons. Sources are expandable, with scientific caveats still visible.
  Typed follow-ups retain crop/country context. Another country's question cannot
  reuse the selected location's NASA weather. Unknown crops or missing local rules
  produce an explicit gap. No cloud model or new dependency was added. Focused
  source-backed questions and follow-ups passed in Chrome and Firefox.
- **Chat can carry out the four-step workflow (implemented and tested).** Use a
  finite set of validated app actions: choose country/place or
  a returned field, enter the farmer's three crops and explicit constraints, load
  NASA observations, then run comparison and open step 4. Never choose an arbitrary
  farm, invent missing crops, infer field ownership, or execute generated code/URLs.
  The same app functions serve chat and forms. Manual edits cancel pending chat
  actions; assistant-origin changes preserve the conversation. Keep ordinary crop
  knowledge questions read-only. Offline coverage includes action order, missing
  inputs, coordinate-country disagreement, explicit field selection, unsupported
  alternatives, provider failure and manual cancellation. Both delivery modes and
  Firefox completed an India coordinate + farmer-crops flow using real NASA data
  through step 4; rice/wheat baseline slots stayed unassessed. No CSS was changed.
- **Vercel setup:** CLI 65.16.0 is installed; current CLI identity was verified as
  justcode1234. This checkout is linked to justcode1234s-projects/nasa-hackathon.
  Global Codex Vercel plugin 0.54.1 is enabled; the shared MCP URL is
  https://mcp.vercel.com. Current connector tools are available, but list_teams
  returned no teams and the known project deployment returned a scoped-access
  403. The existing CLI login works as justcode1234 and is used for release checks.
  Connector team consent remains separate. Preserve the user's 4chatgptsim account;
  do not alter unrelated MCP entries, logins or approval settings.
  Recheck `vercel whoami` and linked project before deploying; never store credentials
  in this repository. The CLI-created .env.local and .vercel directory are ignored.
- **Deployment:** existing public origin is https://nasa-hackathon-three.vercel.app/ .
  Source is pushed to main and Git integration deploys it automatically. The complete
  33-check public workflow passed on commit 05a66cc, including model load/inference,
  geographic scope choices and guided India planning through step 4. Thirteen public assets matched the local
  build hashes. Checkpoint reports are docs/evidence/public-*-validation.json;
  docs/deployment.md records the deployment ID. Pull main before continuing elsewhere.
  Public checks caught an unanchored models/ ignore rule excluding public/models;
  it is now /models/. Require the three model-loading files in every upload dry run.
  An earlier deployment
  dry run initially included local browser artifacts, so .vercelignore now excludes
  those, local dependencies, credentials and generated output. Build inputs and
  public showcase files remain included. Verify the dry-run file list before upload.
- **Latest executed checks:** 95 offline tests, 16 local Playwright cases across
  four runtime/viewport projects, 8 public desktop/mobile Playwright cases,
  33 static Chrome checks,
  19 Node-backed Chrome checks, 18 Firefox checks and 83 JavaScript syntax checks
  passed. Seven-slide PDF and source ZIP are regenerated before publishing.
  The public origin also passed all 33 Chrome checks, including the new scope flow.
  Reports live under docs/evidence; transient profiles/logs are ignored in artifacts.
  Rerun checks appropriate to future changes and record their actual results here.
- **Still deferred/unverified:** CSS polishing, real mobile hardware, Safari/WebKit,
  exact full-session memory peaks, independent agronomic validation and NASA portal
  submission. Keep these distinct from the tested prototype behavior.

## 11. Active plan — review fixes and 3D evidence map (proposed 2026-11-15)

A Claude Code review of commit 8b53619 produced this plan; the user asked Codex to carry
it out. **Status: Phase A released (production frozen). Phase B and Phase C V0-V5 implemented on feature/3d-evidence-map; the complete release gate passed 117 offline + 116 browser cases on 15 November (see section 10). Preview only; real-phone checks remain unverified.** The review
baseline was 8b53619, where
`npm test` passed 95/95 and `npm run test:e2e` passed 16/16 locally. Detail, evidence,
exact file locations, verified source quotes and ready-to-apply crop entries are in
**docs/plans/2026-11-15-review-fixes-and-3d-plan.md**. Read it before starting. Update
section 10 as items become verified; do not mark any item done without executed checks.

**User decisions (2026-11-15):** MIT licence for the team's own code (holder "Team
Explorer"). Deploy after `npm run test:release` passes; reconfirm if scope changes. The
user asked for a 3D data-visualization plan. The user approved preview implementation after V0; use security-fixed MapLibre 6.4.1 (not vulnerable 5.24.0).

**Deadline:** Nov 15, 2026, 11:59 PM Singapore time (UTC+8). Only the owner can submit
in the NASA portal. Do Phase A first, deploy, verify the public site, and remind the
owner to submit. Then keep production equal to the submitted version until judging
ends (use Vercel preview URLs for later work) unless the user decides otherwise.

**Phase A — before submission (small, low risk):**
1. Deck slide 4 shows a result the app cannot reproduce (UK + radish, 0 family repeats).
   Regenerate the deck, PDF, ZIP and manifest from a current, enterable example.
   Reconcile the model timing numbers between the deck and submission.md.
2. Ames and Naivasha example regions return 0 mapped fields. Move them to verified
   farmland points (≥3 fields), then record coordinates and the retrieval date.
3. Step 4 shows "High — …" without a label. Change it to "Uncertainty: high — …".
4. Submission text: state comparable-country coverage (89/197 today), and say radish has
   no FAOSTAT category, so country lists never offer it.
5. AI disclosure: add Claude Code (review, accessibility audit, source checks, plan).
6. Footer: replace "Browser showcase mode" with plain text. Add "Not affiliated with or
   endorsed by NASA" and a licences/credits link.
7. Chat: clicking Send drops focus to `<body>`, so Escape stops working. Keep focus in
   the input.
8. Short viewports: the fixed app shell leaves 54–78 px of content at 200% zoom and
   127 px in phone landscape. Under `max-height: 560px`, let the page scroll with a
   sticky step bar. Target ≥60% usable height.

**Phase B — after Phase A is live:**
- Add tomato, cabbage and bulb onion (FAO 388, 358, 403), sourced from Clemson HGIC,
  Utah State, NC State and Cornell. Comparable countries rise from 89 to 166 of 197.
  Generalise the pea-only heat label (`peaDaysAboveIdeal` → `daysAboveIdealAir`). Move
  the zero-coverage Playwright case off Singapore.
- Rework step 4: results first, method in `<details>`, plain words and human dates.
  Evidence view: °C, month names, charts first.
- Add MIT `LICENSE`, `THIRD-PARTY-NOTICES.md` and a shipped credits page (ship the full
  Leaflet BSD-2 text). Move field outlines from the OSM editing API to Overpass (slow and
  504-prone in today's probe, so add a timeout, fallback endpoint and retry state).
  Remove the unreferenced Hugging Face workers and their CSP hosts. Add favicon and
  `aria-hidden` arrows. Merge the CSS override layers with no visual change.
- Tests: human path (dropdowns, example fields, search, map click); axe-core 4.10.2 dev
  dependency with zero violations in all projects; zoom/landscape; chat focus; one
  model-on QA case; example regions return fields. Prefer role/label locators.

**Phase C — 3D evidence map ("globe to field"), inside module 02, never a fifth
module:**
- Purpose: show that one NASA POWER value covers a 0.5° × 0.625° cell (1° × 1° solar),
  then its neighbours, its terrain and the field inside it.
- Layers:
  - True-size POWER cell columns: height and colour encode one metric, with a month
    slider synced to the monthly table; missing values stay missing.
  - SRTM-derived terrain with a visible exaggeration factor.
  - The OSM field draped on terrain, with derived slope/aspect as context only.
  - Dated NASA GIBS overlays (NDVI, SMAP, IMERG, LST), labelled as imagery.
  - A link from step-4 crop slots to their weather window.
- Technology: approved MapLibre GL JS 6.4.1 (BSD-3), pinned, vendored and lazy-loaded.
  Leaflet 2D stays the default and fallback.
- Rules: no auto-rotation, starfields or glow; reduced motion respected; table/text
  equivalents; WebGL fallback; size, memory and fps measured, not claimed.
- Gates: V0 spike + feasibility doc + user approval → V1 columns → V2 GIBS →
  V3 terrain/field → V4 step-4 link → V5 validation and design review. Build on branch
  `feature/3d-evidence-map` and deploy previews only.

## 12. Active plan - final quality handoff (proposed 15 November 2026)

Full detail, file lists, commands and acceptance criteria:
**docs/plans/codex-final-quality-handoff.md**. Status: proposed; nothing in it is
implemented until recorded in section 10 with executed checks.

**Verified starting point:** branch feature/3d-evidence-map at 638431a (pushed, clean);
release gate 117 offline + 116 browser green; production still Phase A (main f4c4fef),
16/16 public cases logged out; preview is login-protected; the public NASA team page
showed the project as an unsubmitted draft with empty references fields.

**Order of work:**
1. P0.1 Report team-page status and give paste-ready submission fields. Do not submit.
2. P0.2 Ask the user: keep Phase A public (default), release the branch, or make the
   preview public. Wait for an explicit answer before any production change.
3. Baseline `npm test` and `npm run test:release`; save evidence.
4. P0.3 scientific wording audit; P0.4 re-verify the three new crops against sources;
   P0.6 unexpected-question sweep for the assistant; P0.5 run and repair the legacy
   Chrome/Node/Firefox/QA scripts on this branch.
5. P1 screenshot-based CSS/UX review: declutter the chat panel, voice download notice,
   one spacing/control system, accessibility of new UI, plain-language explanations.
   Show before/after screenshots to the user before large CSS changes.
6. Full release gate, then docs. Release only with approval, following the plan's
   deployment and rollback steps.
7. P2 measurements, cache headers, real-phone session; P3 optional experiments.

**Standing limits:** keep the typed-judgment classifier unwired unless a fresh test set
shows it beats the rules. Field lookup depends on shared public Overpass services;
report busy-service failures as failures with their cause. Real phones, Safari, real
microphones and audible read-aloud remain unverified.
