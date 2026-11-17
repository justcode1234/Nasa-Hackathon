# AGENTS.md — FieldShift (NASA Space Apps Challenge 2026)

> Instructions for Codex. Read this file before writing code. Preserve user decisions, inspect the actual implementation, and distinguish verified behavior from proposed work.

> **Start here:** section 10 and
> **docs/plans/2026-11-15-merged-release.md** contain the current state and later
> user decisions. The user approved one merged main branch and deployment after
> all release checks pass. Preserve the dated Phase A materials; never edit the
> NASA portal. Sections 11-12 and older review reports are historical plans.

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

- **Active release record:** [docs/plans/2026-11-15-merged-release.md](docs/plans/2026-11-15-merged-release.md).
  Read it first for current process handles, results and remaining work. Earlier
  implementation notes are preserved in [handoff history](docs/history/implementation-handoff-through-review.md).
  Sections 11-12 below retain the original plans; later user decisions here prevail.
- **Authorization:** user explicitly requested one merged main branch and answered
  "Deploy after all release checks pass". This supersedes the earlier Phase A
  freeze for this release. Do not edit or submit the NASA portal. Preserve original
  Phase A prepared materials under public/submission/phase-a and its source tag.
- **NASA status:** unauthenticated public GET at 22:09 UTC+8 reports isSubmitted and
  projectSubmitted true; submittedAt 21:04:58 on 15 November. Evidence:
  docs/evidence/merged-release-team-status.json. This is a public-record observation,
  not an action performed by the agent.
- **Current source:** feature/3d-evidence-map at c0690dc plus uncommitted release work.
  Assistant checkpoint 5647f04 and documentation review 9685ccb are merged. Main
  remains f4c4fef until the final gate passes. No new production deployment yet.
  Review worktree must be detached before its merged branch is removed. Preserve
  the unrelated detached Kilo worktree and all worktree files.
- **Implemented, final verification running:** seven screened crops / 166 of 197
  country lists; optional 3D POWER cells, GIBS imagery and terrain; three persistent
  chat examples; grounded crop-control help including separate official Aland
  records; Singapore skips unnamed region codes; one location method at a time;
  Next loads evidence; three explained graphs and C/F display conversion; explicit
  alternative-crop approval; coverage meters and explained missing/comparable
  checks; apple/apricot tree context without annual or orchard prescriptions.
- **AI and speech boundary:** optional 39,274-parameter word LM / 157,096-byte weights
  can prioritize retrieved paragraphs, not generate agricultural claims. Whisper
  tiny.en dictation uses first-use consent before permission/download (~70 MB),
  remains local and supplies an editable unsent draft. User explicitly chose the
  installed on-device English voice for read-aloud; training-language provenance
  is unverified. A separately trained English-only TTS model is not implemented.
  Typed-judgment classifier stays unwired. No new dependency in this release work.
- **RELEASED (15 Nov ~22:55 UTC+8):** user approved; main pushed to ef0e80e (merge b094f40);
  production deployment dpl_DVZLzVaybdoLsXuQf57xfVynaeq8 serves the merged release; logged-out
  public Playwright 76/76 passed; assets match. Rollback target and steps: docs/deployment.md.
- **Post-release fix (whole-country chat flow, rice rotation answer) — LIVE since ~23:50, dpl_9aQGEBmw31Z7uv83MDgSm2rGSCDz, public 12/12:** see the latest entry in
  docs/validation.md. Committed on main after its own full release gate; pushing it to
  production needs the user's approval. Branch cleanup (one branch only, as the user asked in
  the Codex session) is pending the same approval: detach the review worktree first, keep the
  Kilo worktree and tag phase-a-submission-2026-11-15.
- **Earlier checks:** 128/128 offline; focused static-desktop 14/14; legacy
  model-on Chrome 33, Node Chrome 19, Firefox 18; original QA 16 questions plus six
  flows pass both model-off and model-on (22/22 each). Full 152-case four-project
  Playwright release is currently running: session 6649, log
  artifacts/final-quality/merged-release.log. Inspect before restarting; do not
  claim the final gate or public release passed until actual results exist.
- **Runtime/account:** Node testing and static Vercel share scientific handlers.
  Exactly four product modules, vanilla JS, no classifier activation. Vercel CLI
  whoami verified justcode1234; linked justcode1234s-projects/nasa-hackathon.
  Preserve the separate 4chatgptsim account. Recheck identity before deployment.
- **Remaining:** complete full gate, save evidence, finish five-size screenshot
  review including 3D/terrain, refresh and visually inspect current seven-slide
  materials, consolidate/push main, verify deployment/public flows and assets,
  remove only fully merged local/remote branches, record actual results here.
  Real phones, Safari/WebKit, microphone/noise quality, audible voice quality and
  independent agronomic validation remain unverified. Never infer them from emulation.
- **17 Nov branch work (user: "only to 1 branch", never main) — region-less countries,
  chat buttons, assistant place matching, security pass.** User report: choosing Singapore
  ping-ponged between "Whole Singapore" and "A specific area" with no button that could finish
  step 1. Cause is source-faithful data (the saved GeoNames extract has 18 areas, incl. SG, AW,
  MF, TC, VA, EH, whose region rows carry `name: null`), so the fix is in the interaction layer:
  unnamed regions are never asked for, the area prompt offers the first three real towns of the
  visible step 1 list ("not a recommendation"), and no prompt can offer a button back to itself.
  `chat.js` had been truncating offered choices at three, which is why the only escape button was
  invisible; it now renders every choice. Short place replies match the real list (diacritic/
  punctuation folding, lead-in stripping, prefix match with exact-name precedence, bare town name
  re-targets a chosen point); unmatched text still runs no action. `sourceLinks` links only
  absolute http(s) URLs. **Executed:** `npm test` 144/144 (137 with the new
  tests/workflow-place-choices.test.js 8, plus new tests/security-boundaries.test.js 6 and one
  data invariant for the 18 region-less lists), `npm audit` 0 vulnerabilities, new
  tests/e2e/city-state-chat-flow.spec.js 8/8 in four projects, chat-adjacent browser batch
  56/60 → 36/36 after rewriting the one Singapore assertion that pinned the superseded wording
  (strengthened: it now requires three named town buttons and that tapping one fills `#latitude`).
  Full `npm run test:e2e` on this branch: **168/168 passed, 0 skipped (24.9 min)**; after one
  dead-constant removal the bundle was rebuilt and the two chat specs re-run green (22/22) with
  `npm test` re-confirmed. Work is committed on `fix/chat-flow-and-answers` only;
  main is untouched and nothing was deployed; no NASA portal edit. Real
  phones/Safari/audio and independent agronomic review remain unverified.

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
