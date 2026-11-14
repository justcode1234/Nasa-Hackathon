# AGENTS.md — FieldShift (NASA Space Apps Challenge 2026)

> Instructions for Codex. Read this file before writing code. This project is in its planning/early implementation stage. Preserve user decisions, build incrementally, and do not treat suggested features as already implemented.

> **Current implementation and cross-device handoff:** read section 10 at the end
> before resuming work. It records later user decisions and current verified state.

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

Update this section and docs/decisions.md / docs/validation.md after each substantive
implementation change. Record what changed, actual checks, remaining work and deployment
state. Do not leave another device relying on an earlier planning assumption.

- **Current user goal — resolve QA gaps and improve the tiny LM (in progress):**
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
  Training writes candidates separately; public verification is still pending.
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
  https://mcp.vercel.com and OAuth login succeeded. Active-session MCP tool discovery
  still needs verification. Do not alter unrelated MCP entries or approval settings.
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
- **Latest executed checks:** 93 offline tests, 33 static Chrome checks,
  19 Node-backed Chrome checks, 18 Firefox checks and 77 JavaScript syntax checks
  passed. Seven-slide PDF and source ZIP are regenerated before publishing.
  The public origin also passed all 33 Chrome checks, including the new scope flow.
  Reports live under docs/evidence; transient profiles/logs are ignored in artifacts.
  Rerun checks appropriate to future changes and record their actual results here.
- **Still deferred/unverified:** CSS polishing, real mobile hardware, Safari/WebKit,
  exact full-session memory peaks, independent agronomic validation and NASA portal
  submission. Keep these distinct from the tested prototype behavior.
