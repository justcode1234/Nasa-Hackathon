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
- **Work on the current branch:** [docs/handoff-2026-11-18.md](docs/handoff-2026-11-18.md) is the
  cross-device handoff for `fix/chat-flow-and-answers` — environment, exact commands and durations,
  the chat DOM contract the probes depend on, the invariants paid for by real defects, and the
  improvement-loop queue. `artifacts/` paths named in the bullets below are gitignored local logs;
  the durable dated copies live in `docs/evidence/`.
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
- **18 Nov whole-matrix chat audit (same branch, never main).** Driving every saved list found two more
  chat defects: a nonsense town typed after a town point could answer with **no buttons at all** (6 of 10
  probe countries), and a sentence naming only the country auto-picked a region whose spelling sits
  **inside** the country name (São Tomé and Príncipe → Príncipe; nine lists: AG, CD, CG, GW, HK, PM, SJ,
  ST, TT). Both are fixed in the matching rules, not the data: the whole-sentence place scan is compared in
  `regionPhrase` shape and rejects a hit contained inside the country-name span (while a town whose own
  name contains the country, e.g. the real Philippines "Pamayanang University of Philippines Employment
  Housing Cooperative Subdivision", still selects that town — the first attempt deleted country words and
  the deep scan caught that regression), and an unmatched short reply inside a chosen region now returns
  the town-recovery prompt with real buttons. **Executed:** `npm test` 166/166, `npm audit` 0
  vulnerabilities, `node scripts/audit-matrix.js --deep` 0 defects (70,036 places, 66,546 matched, 79 long
  names verified through the engine, 245/245 flows terminal) plus the new 245-country national-scope check,
  and a Chrome probe of ST/PH/TV/PF with 0 button-less replies and 0 page errors
  (artifacts/final-quality/fix-probe.log). The Playwright suite that overlapped these edits tested a mixed
  source state and is not counted as a gate; a clean `npm run test:e2e` on the committed code is recorded
  in docs/validation.md once it finishes. The tiny word LM was **not** retrained — no vocabulary or reply
  label changed, and a rebuild would break tests/model.test.js integrity pinning for no behaviour gain.
- **18 Nov, same branch: the five supported codes with no saved place list (AQ BV HM IO UM).** The country
  picker offers 251 options and the chat recognises all 250 codes, but only 245 have a place list, and the
  new tests exposed a real dead end: for Antarctica "A specific area" explained the gap and gave **zero
  buttons**, and the whole-country overview told the farmer to "Choose a town" from a list that has none.
  Fixed in the interaction layer only — `areaPrompt` always keeps `Whole <country>` when there is no town to
  tap, and `countryOverview` now separates "has regions" / "has towns, no regions" / "has no towns" and
  points the last case at the map or step-1 coordinates. The neutral "Which part of X …" question
  deliberately stays for an empty list, because an empty list can also mean a place list that failed to
  load, and only that path can tell the two apart. Country coverage now follows the recognition boundary:
  the durable phrasing test and `scripts/audit-matrix.js` iterate all 250 codes (`countryOnlyChecked: 250`)
  and assert the 16 compound `Saint …`/`… & …` spellings by name while "South Georgia" stays out of GE.
  **Executed:** `npm test` 167/167, `npm audit` 0 vulnerabilities, `node scripts/audit-matrix.js --deep`
  0 defects / 0 ambiguous names / 245-of-245 flows terminal over 70,036 places (66,546 short-reply matches,
  7 eponymous skips, 79 long names re-verified through the production engine, 79/79 reachable), and a
  chat-only Chrome probe of AQ BV HM IO UM plus ST as the control: 6 codes, 0 button-less replies, 0 replies
  naming a town control the list lacks, 0 page errors
  (artifacts/final-quality/listless-country-probe.log, listless-diagnose.log). One e2e failure was fixed
  test-side rather than app-side: tests/e2e/speech.spec.js ran the multi-second axe scan between the
  "Stop speaking" visibility check and its click, so a headless utterance ending inside that gap flipped the
  button back and the click timed out; the click and its two assertions now run first, nothing removed. A
  clean full `npm run test:e2e` on the committed code is running
  (artifacts/playwright/full-suite-clean.log) — not a passed gate until its own number is recorded here.
- **18 Nov, same branch: the region-name loop and identical town buttons.** Two more real defects came out
  of driving every collision in the saved lists. (a) Eleven lists hold a town spelled exactly like a
  *different* region's name (the city of Buenos Aires is not inside the province row, Chinese Taipei's
  "Taipei" town row sits in another region, "Wales" is a town in England, "Mpumalanga", "Córdoba",
  "Hamilton", "Yamoussoukro", "Sühbaatar", "Palauli", "Jiangxi", "Farah" likewise). Retyping the chosen
  region's own name at the "now choose a town" question answered it by selecting that region **again** —
  the same question twice, with no point ever set. Cause was `exactPlaceRow`: an already-selected region
  filtered the town rows out, so the only exact match left was the region the farmer had chosen. It now
  falls through to the town rows (in the region first, then anywhere in the country list) and, when the
  spelling is a region and nothing else, the pending-question handler answers honestly instead. 10 of the
  147 collision countries now set a real saved point from the town row outside the chosen region; US
  "California" resolves to its own row inside California. (b) Two towns that share a name **and** a region
  ("Quezon · Cagayan Valley" twice) produced two identically worded buttons, and the reply hid rows by
  claiming no count. Labels now carry the saved coordinates when the wording collides, and the reply says
  "showing 3 of N" when it truncates. **Executed:** `npm test` 169/169 (matrix-coverage 13/13, including
  the two new collision tests over 147 and 49 countries), `npm audit` 0 vulnerabilities, and
  `node scripts/audit-matrix.js --deep` on the committed tree: **0 defects, 0 ambiguous names, 245/245
  flows terminal** over 70,036 places (`docs/evidence/deep-matrix-2026-11-18-postfix.json`). Two browser
  items are **not** recorded as passing: an earlier queued suite printed 180 passed but was built before
  this fix, and a fresh `npm run test:e2e` on `15b76d1` was still running (case 56/180 in
  `artifacts/playwright/full-suite-15b76d1.log`) when the user asked this session to stop; a dedicated
  chat-only collision probe was stopped unfinished. Read that log's own summary before claiming the gate.
  The tiny word LM is unchanged and not retrained: no place
  name vocabulary or reply label in `public/models/fieldshift-mini` was altered, and a rebuild would break
  the sha256 pin in tests/model.test.js for no behaviour gain.
- **18 Nov, same branch: country-name recognition parity.** The collision probe's only unanswered case
  was TW, and the cause is `public/js/lib/countries.js`, which built the whole 250-code name table from
  one `Intl.DisplayNames(['en'])` call. Measured that day: Chrome says PS "Palestine", HK "Hong Kong",
  MO "Macao", GS "South Georgia & South Sandwich Islands" where Node says the longer forms, so a farmer
  could type the exact wording their own picker shows and be asked "Which country should we look at?";
  a parenthetical name matched only its whole phrase, so "Myanmar", "Burma", "Cocos Islands" and
  "Falkland Islands" matched nothing; and the labels in our own `server/context/country-crops.json`
  ("China, Hong Kong SAR", "China, Macao SAR", "Palestine", "Viet Nam", "North Macedonia") plus the
  FAO/IOC "Chinese Taipei" were in no table at all. Recognition now merges `en-001`, splits each
  parenthetical name into whole/without-parenthesis/parenthesis-alone, adds the sourced spellings, and
  only applies the `in|from <abbr>` shortcut when no full name already claimed that span (so "in US
  Virgin Islands" is VI, not VI + US). `countryNameForms()` is exported for the tests; 297 spellings
  resolve on Node v22. **Executed:** `npm test` 173/173 (new tests/country-name-recognition.test.js 4/4),
  `npm audit` 0 vulnerabilities, `node scripts/audit-matrix.js --deep` 0 defects / 0 ambiguous names /
  245-of-245 flows terminal over 70,036 places
  (docs/evidence/deep-matrix-2026-11-18-recognition.json), and a real-Chrome chat probe of the 19
  formerly failing spellings plus 3 controls: 0 wrong country, 0 button-less replies, 0 page errors
  (artifacts/final-quality/recognition-chat-probe-2026-11-18.log; its first run's 15 button-less lines
  were the probe reading the user bubble too early, fixed in the probe and re-run). The word LM is again
  not retrained: `scripts/build-mini-corpus.js` imports no country table and no reply label changed.
  Typing a country whose name is also a saved town ("Macau", "Chinese Taipei") still selects that town
  point and says so — the pre-existing eponymous-capital rule the deep audit skips 7 of — and the
  no-name-matches reply keeps no chat button because a button sends text and the app will not enumerate
  250 countries; it names the step-1 dropdown instead. A clean `npm run test:e2e` on this committed code
  is restarted below; until its own number is recorded it is not a passed gate.

- **18 Nov, same branch: iteration 9 — the 75-second field-service wait, taken out of the chat.** The
  sentence left open by the nine-second fix ("a service that accepts the connection and then answers
  slowly … is not what was measured here") was measured against `createFarmClient` with a
  never-answering stub: **75,016 ms** when the stub honours the caller's abort signal the way `fetch` does
  (docs/evidence/farms-hanging-service-deadline-2026-11-18.log.gz) and 105,029 ms when it does not
  (docs/evidence/farms-hanging-unreachable-2026-11-18.log.gz) — so the server deadline does bound it, but
  a town tap in the guided chat `await run('loadFarms')` before replying, freezing the panel on "finding
  community-mapped fields" with Send disabled for that whole time even though the point was already saved
  one line earlier. Fixed in the chat layer: `fieldsGraceMs` (default 10 s) caps only how long a guided
  reply waits, and the reply then names the selected town point, says the field services have not answered
  and nothing was invented, and offers the two real way-ons `Use selected point` / `Show mapped fields`;
  the open lookup is kept so a second ask joins it instead of adding another hanging request to a shared
  community service, and the step-1 button keeps its own full-deadline search and its "up to a minute when
  busy" notice. Building it exposed one more real defect: the typed sentence "Show mapped fields around
  this point" carries none of the workflow's intent verbs, so it fell out of the guided path at the
  place-reply check and the button would only ever produce a generic answer — the field request now counts
  as farmer input in `hasInput`. **Executed:** `node --test tests/workflow-place-choices.test.js` 26/26
  (new case: town tap under a never-answering service replies in well under the deadline, keeps
  `#latitude`, offers both way-ons, claims no field count, retry opens no second lookup), `npm test`
  **187/187, 0 failed, 0 skipped (55.7 s)**, `npm audit` 0 vulnerabilities, and the chat slice carrying
  the `data-choice-type` assertions **80 passed, 0 failed (6.0 min)** across four projects
  (docs/evidence/e2e-chat-slice-choice-type-2026-11-18.log.gz). New durable browser spec
  `tests/e2e/field-service-latency.spec.js` hangs every field request through `context.route` and asserts
  the reply, the point and the way-ons in all four projects; its first two runs failed on the test side,
  not the app: request-count assertions cannot see the chat through the hedge's own second (6 s) and
  third (12 s) service, so that check lives offline where it is deterministic. It passed there: **4 passed
  (1.5 m)**, ~21 s per case including page load, i.e. inside the graces rather than inside the deadline
  (docs/evidence/e2e-field-service-latency-2026-11-18.log.gz). The tiny word LM was again
  **not** retrained: no place-name vocabulary or reply label in `public/models/fieldshift-mini` changed
  and `scripts/build-mini-corpus.js` reads only the development questions and QA prompts. Nothing was
  deployed, main is untouched, no NASA portal edit; a clean full `npm run test:e2e` on this tip is still
  owed, and 75 s is measured against a stub, never against a real overloaded Overpass.

- **18 Nov, same branch: the branch is now reproducible from another device.** Because this loop's
  logs live in gitignored `artifacts/`, a fresh clone could read the claims but not re-run them.
  [docs/handoff-2026-11-18.md](docs/handoff-2026-11-18.md) now carries the branch and `main` commits,
  the Node v22.14.0 / Playwright 1.65.1 / installed-Chrome environment the numbers came from, every
  command with its measured duration and the probe `PROBE_*` variables, the chat DOM contract the
  probes and specs depend on, the place-data census and the invariants past defects paid for, the loop
  queue, and the `artifacts/` vs `docs/evidence/` rule. Linked from §10, `docs/README.md` and
  `docs/development.md` (whose additional-checks list was missing all four probe scripts this branch
  added). **Executed:** `node scripts/check-documentation.js` 117 local links / 0 broken,
  `npx playwright test --list` 184 tests in 17 files, `npm test` re-run after the edits **187/187**.
  There is no CI here: every figure in these documents is a locally executed command, and none of it
  was deployed.

- **18 Nov, same branch: the pushed branch was run from a clean clone, and the docs are now checked
  against the tree.** Iterations 10-12. `378c6b6` (with `8aadfcd`, `7819501`) is pushed to
  `fix/chat-flow-and-answers`; `main` stays `4a54fa3`, nothing deployed, no NASA portal edit. To test
  the reproducibility claim instead of asserting it, the branch was cloned from GitHub into an empty
  directory with no copy of this workspace: `npm ci` **137 packages in 10 s**, `npm test` **187/187,
  0 failed, 0 skipped (54.6 s)**, `node scripts/check-documentation.js` **117 local links / 0 broken**,
  `npm audit` **0 vulnerabilities**. `npm test` builds `dist/client` by itself, no offline test imports
  a third-party package, and the model assets are tracked (`git ls-files public/models` → 5 files), so
  the clone needs nothing but the install. Scanning every markdown file for the commands and paths it
  tells a reader to run found 39 commands and 7 script paths clean (the probe `test:*` scripts added
  earlier in this loop are why) but **2 dangling evidence citations** — `docs/validation.md` named
  `…fixed-tip-2026-11-18.log` where the committed archive is `.log.gz`, and the handoff used an
  illustrative name that read like a real file. Both fixed, and
  [tests/documentation-commands.test.js](tests/documentation-commands.test.js) (new, **4/4**) now
  asserts that every documented npm command exists, every documented verification file exists, every
  hand-run script is named in a current doc (only `prestart*` hooks exempt), and every non-glob
  `docs/evidence/…` citation resolves — each with a minimum-found count so a scanner that matches
  nothing cannot pass. Verified non-vacuous twice: injected bogus commands failed checks 1 and 2, and
  restoring the missing `.gz` failed check 4; both reverted. Reviewing `notebooks/legacy-workers/`
  measured that its archived benchmark cannot even load (`ERR_MODULE_NOT_FOUND` on
  `../server/index.js`, which resolves to `notebooks/server/index.js` after the move), recorded in that
  README with a warning not to re-point it at the live server; and because `scripts/build-browser.js:30`
  deletes `llm-worker.js`/`candidate-worker.js` from `dist/client`, a build-output-only assertion can
  never fail, so `tests/deployment.test.js` (**1/1**) now also rejects those names in
  `public/js/modules` — demonstrated by copying one there (fails) and deleting it (passes again). The
  clean full `npm run test:e2e` (184 cases) launched **from that clone** and the aggregate offline run
  on this tip are recorded in docs/validation.md when their own summaries print.

- **18 Nov, same branch: three more chat place defects, from driving every saved list and then the
  browser.** (a) Seven lists hold a town spelled exactly like the country — "Colombia" in Huila (CO),
  "Djibouti" (DJ), "Luxembourg" (LU), "Monaco" in the Municipality of Monaco (MC), "Mozambique" in
  Nampula (MZ), "San Marino" (SM) and "Türkmenistan" in Ahal (TM) — and `allowEponymousTown` was
  `namedRegions.length === 0`, so once the pending question was "which town" that town could be tapped
  but never typed; it is now typeable while a region filter is set. The exclusion deliberately stays
  spelling-exact: ASCII-folding it would drop the real "México", "Panamá" and "Türkmenistan" region rows
  out of the suggestions. (b) Answering a pending place question with the country's own spelling
  re-asked the identical question, for short names and for long official spellings past the short-reply
  cap ("South Georgia & South Sandwich Islands"). The reply is now compared in `regionPhrase` shape and
  answers honestly instead — names the level still missing, offers that level's real rows plus
  `Whole <country>`, and ends "Nothing was selected" — while a saved row whose own spelling *is* that
  reply (GP, MQ, the seven towns) still selects itself. (c) The real-browser probe of (b) then caught a
  third case the offline assertions had tolerated: at the region question, "São Tomé & Príncipe"
  selected the town **São Tomé**, a strict piece of the country name, narrowing the plan's scope without
  saying so. A reply equal to the country's whole spelling may now only select a row whose own whole
  spelling equals it. **Executed:** `npm test` 183/183 (matrix-coverage 17 tests, workflow-place-choices
  25, including the new 245-list × every-phrasing checks and the São Tomé test), `npm audit` 0
  vulnerabilities, `node scripts/audit-nonsense-town.js` 2151 cases / 0 failures,
  `node scripts/audit-matrix.js --deep` **0 defects / 0 ambiguous names** over 70,036 place rows
  (66,546 short-reply matches, 79 long names re-verified through the production engine, 3,743/3,743
  regions, 245/245 flows terminal) with the census now *verifying* the seven same-named towns
  (`eponymousSelected: 7`) instead of skipping them —
  [docs/evidence/chat-place-matrix-2026-11-18.json](docs/evidence/chat-place-matrix-2026-11-18.json).
  Chrome, chat only, 16 sessions on 5b4cf29: 7/7 same-named towns became real town points with the
  latitude field matching the saved row, 0 page errors, and 1 flagged reply that became defect (c)
  docs/evidence/eponymous-and-country-name-probe-2026-11-18.log). Re-run on the final tip
  cbeff6b: 16 cases, **0 failures, 0 page errors**, 7/7 towns still selectable and **9/9** country-name
  replies honest, São Tomé now answering "is the country, not one of its regions" — raw rows
  docs/evidence/eponymous-and-country-name-probe-2026-11-18-final.log, extracted summaries in
  docs/evidence/chat-place-matrix-2026-11-18.json under `browserProbe`. A clean full
  `npm run test:e2e` on 5b4cf29 printed **180 passed (28.4 min)**, full run kept at
  docs/evidence/full-suite-5b4cf29-2026-11-18.log.gz; the suite for the final tip
  `cbeff6b` is running into artifacts/playwright/full-suite-prefix-rule-2026-11-18.log and only its own
  summary counts as that gate. An unrelated background Playwright run from another workspace (its
  `tests/e2e/chat-basic.spec.js` does not exist in this repository) is not evidence either way. The
  tiny word LM was **not** retrained: `scripts/build-mini-corpus.js` reads
  `models/mini-development-questions.json` and `tests/qa/prompts.json` only — no country table and no
  assistant reply strings — and `tests/model.test.js` still passes its sha256 pin. Real phones,
  Safari/WebKit, microphone and read-aloud audio quality and independent agronomic review remain
  unverified.
- **18 Nov, same branch: closing the last two coverage gaps in the goal's own terms.** Re-auditing the
  acceptance criteria against the code, not memory, found no new app defect but two places where a
  regression could hide. (a) `tests/matrix-coverage.test.js` *skipped* a town spelled like its country,
  so a matcher regression there was silent; it now requires each of the 7 (CO DJ LU MC MZ SM TM) to match
  through `typedPlace` under its own saved region. (b) Only a synthetic Singapore case pinned the
  region-less area prompt, so the other 17 of the 18 lists (AW BL CC CW CX EH FK GI GS MF NF NU PN SG SX
  TC VA VG) were untested at the interaction layer; a new test drives each real list from "Help me plan a
  rotation in &lt;country&gt;" through "A specific area" and asserts a non-empty reply, a town button for every
  offered name that resolves to that saved row, `Whole &lt;country&gt;` still present, the "no named regions" and
  "not a recommendation" wording, and that tapping the button sets the plan to that row's own
  coordinates. **Executed:** `node --test tests/matrix-coverage.test.js` 19/19, `npm test` **185/185, 0
  failed, 0 skipped (78.3 s)** (docs/evidence/unit-exhaustive-2026-11-18.log), `npm audit` 0
  vulnerabilities. Two more assertions were then widened to the whole matrix because the cap was
  invisible: the town sweep had typed only 100 unique names per country (13,673 of 66,632) and now types
  every unique name through `typedPlace`, with only the 79 long/ambiguous residue driven through the
  engine and the 7 eponymous towns asserted under their own region — 0 unexplained; and the unknown-town
  census moved from `scripts/audit-nonsense-town.js` into `tests/helpers/matrix-harness.js` as
  `nonsenseCensus()`, called by both the script and a new test, re-run after the move with the identical
  `{"cases":2151,"countries":245,"failures":0,"deferredToEvidenceAnswer":54}`. Test and script files
  only — no app module, no place data, no model vocabulary changed, so the tiny word LM is again
  not retrained and the `cbeff6b` browser gate above still describes this app code.
- **18 Nov, same branch: the clean full-suite browser gate on the current tip, plus the full-matrix
  button walk.** `npm run test:e2e` run on the committed code finished **180 passed, 0 failed, 0 skipped
  (35.8 min)** in `artifacts/playwright/full-suite-prefix-rule-2026-11-18.log`, kept at
  `docs/evidence/e2e-full-suite-2026-11-18.log.gz`. That run was launched on `cbeff6b`, and the five
  commits since then touch only tests, scripts and docs — `git diff --name-only cbeff6b..HEAD -- public
  server dist` lists **0 files** — so the same app code is what this branch now ships. `npm audit` on
  `fcdd765`: 0 vulnerabilities. To get browser evidence for *every* saved list rather than the 16–34
  sessions probed so far, `scripts/chat-place-matrix-probe.mjs` walks all 245 lists in real Chrome: type
  the country, tap "A specific area", then tap only buttons the assistant itself offers (region first,
  then a town, coordinate-suffixed duplicate labels included) and require `#latitude` to equal a saved
  row within 1e-4, classifying each country as `point` or a named defect (`buttonless`,
  `no-offered-name`, `town-tapped-without-a-point`, `point-from-another-row`, `no-point-in-five-taps`,
  `crash`); Overpass is aborted because a shared field-service outage is not a chat defect.
- **18 Nov, same branch: the full-matrix walk found a real chat dead end in another engine's spelling.**
  The walk over all 245 lists in Chrome printed **245 cases, 242 points, 0 page errors, 3 defects**
  (`artifacts/final-quality/chat-place-matrix-probe-2026-11-18.log`, statuses `{"point":242,
  "buttonless":3}`). The three were HK "Hong Kong SAR China", MO "Macao SAR China" and PS "Palestinian
  Territories": the country never resolved, so the chat answered "Which country should we look at?" with
  **no button**, and step 1 could not be finished from the chat. Root cause is that those spellings come
  from *this* runtime's Intl table and not Chrome's, so the Node recognition test resolved them from the
  table and could never see the gap. Fixed by naming them in the runtime-independent `aliases` list in
  `public/js/lib/countries.js` (`hong kong sar china`, `macao sar china`, `palestinian territories`), and
  `tests/country-name-recognition.test.js` now asserts the alias list itself, not only resolution, so a
  move to the shorter table cannot hide it. Re-walked in Chrome: **3/3 real town points, 0 defects**.
  The new `scripts/country-spelling-cross-engine-probe.mjs` then fed all **773** Node-generated spellings
  for **250** codes into Chrome's own recognition module: **0 unrecognised**. Because this changed app
  code, the 180-case gate above no longer describes the tip on its own; the browser evidence that does
  is the next bullet. The tiny word LM is again **not** retrained — `scripts/build-mini-corpus.js` reads
  `models/mini-development-questions.json` and `tests/qa/prompts.json` only, and no reply label or
  vocabulary entry changed. Nothing was deployed, main is untouched, no NASA portal edit.
- **18 Nov, same branch: re-running the checks on the alias-fixed build, and one probe-side bug.**
  `npm test` **186/186, 0 skipped (74.5 s)** and `npm audit` **0 vulnerabilities** on the fixed tip. The
  34-session focused browser walk (`scripts/chat-place-probe.mjs`) printed **1 failure, FK**: the page
  offered `Whole Falkland Islands (Islas Malvinas)` — Chrome's Intl spelling — while the probe compared
  against `` `Whole ${COUNTRY_NAMES.of('FK')}` `` built in Node, whose label is `Falkland Islands`. The
  button existed and was tappable, so the defect was the assertion's runtime dependency, not the app; the
  probe now checks the whole-country route by shape and records its label
  (`docs/evidence/place-probe-after-alias-fix-2026-11-18.log.gz` before,
  `place-probe-fkfix-2026-11-18.log.gz` after). Corrected run: **34 cases, 0 failures, 0 page errors,
  25 towns selected as town points, 9 honest country-name replies, all 18 region-less lists driven in
  Chrome** — which supersedes the earlier note that only Singapore had browser-level region-less proof.
  Playwright chat/workflow specs on that build: **17 passed** static-desktop, then **68 passed (6.1 min)**
  across all four projects (`docs/evidence/e2e-chat-all-projects-fixed-tip-2026-11-18.log.gz`). The
  complete 180-case `npm run test:e2e` was then re-run on that alias-fixed tip and printed
  **180 passed, 0 failed, 0 skipped (24.0 min)** (`docs/evidence/e2e-full-suite-fixed-tip-2026-11-18.log.gz`),
  so the whole browser gate does describe the released-branch code at `35a11b7`; the app changes after that
  run are recorded in the next bullet and need their own gate. The unverified list is unchanged (real
  phones/touch, Safari/WebKit, microphones and noise, audible read-aloud, independent agronomic review,
  live Overpass discovery).
- **18 Nov, same branch: an eight-pass improvement loop, and a measured nine-second stall.** Detail with
  every executed number is in docs/validation.md ("improvement loop on the probe and chat layer"). Each
  pass names the evidence that provoked it. Picker↔chat parity is now checked in the engine that renders
  the picker (live `<option>` labels → that engine's `findCountries`): **250 labels, 0 the chat rejects**,
  beside the 773 Node spellings still at 0 unrecognised. All three browser probes share
  `scripts/lib/probe-app.mjs`, which starts the static preview and **refuses a bundle older than `public/`
  or `server/`** (verified by touching a source file). The silent `followUps.slice(0, 6)` DOM cap in
  `chat.js` is gone — widest offer measured across the matrix at **4** — and that bound is pinned offline.
  Both browser walks now require the coordinate **pair** to match a saved row, not just the latitude.
  `chat.js` stamps `data-choice-type` (town/region/farm/follow-up) on every choice and names the group for a
  screen reader, so `scripts/chat-place-matrix-probe.mjs` taps by position and declared level instead of
  regexing the sentence, and the five list-less codes (AQ BV HM IO UM) became their own terminal state
  (5/5 explained, 0 defects). Adding the app's own `fieldshiftAnswerLatencyMs` stamp to that walk found the
  real defect: **the answer to a town tap took 9042 ms (US) and 9038 ms (AD)** while every other step took
  tens of milliseconds — traced to `server/context/farms.js` retrying *every* Overpass service through its
  3 s + 6 s backoff ladder even when all three refused the connection within 60 ms, so an offline or blocked
  farmer waited the whole ladder to be told the services are unavailable. `server/context/client.js` now
  records whether a service answered or was merely slow, and the hedge retries only that; the same tap
  answers in **56 ms** with the same coordinates and the same notice. The superseded
  `assert.equal(failures, 9)` was replaced rather than removed: each service must still be attempted, the
  outage reported in under 100 ms, and a busy service in a mixed outage still get its three attempts.
  **Executed:** `node --test tests/context.test.js` 11/11, `npm test` **186/186, 0 failed, 0 skipped**,
  `npm audit` **0 vulnerabilities**, the 34-session probe **0 failures / 0 page errors**, and the walk over
  **every supported code: 250 cases, 245 saved town points, 5 explained list-less replies, 0 defects,
  0 page errors**, whose latency census (**977 answers, p50 19 ms, p95 47 ms, max 156 ms**) is now the
  measured responsiveness of the guided place step (`artifacts/final-quality/chat-matrix-full-2026-11-18.log`).
  The field-lookup fix is committed as `0af312d`. **Not** yet re-run on this tip: the Playwright chat slice
  carrying the new `data-choice-type` assertion (running into
  `artifacts/final-quality/e2e-chat-slice-choice-type-2026-11-18.log`) and a clean full
  `npm run test:e2e` — so the 180/180 above still describes `35a11b7`, not this commit. A slow-but-answering
  Overpass service (the 75 s shared-deadline path) was not measured, and the standing unverified list is
  unchanged: real phones/touch, Safari/WebKit, microphones and noise, audible read-aloud, independent
  agronomic review, live Overpass availability. Nothing was deployed, main is untouched, no NASA portal edit.

- **18 Nov, same branch: iteration 13 — the documentation guard failed on the tip's own quoted error.**
  Running the whole offline suite on the committed tip (iteration 12 had executed the two changed files
  separately, not as a suite) printed **191 tests, 190 pass, 1 fail, 0 skipped (234.8 s)**:
  `tests/documentation-commands.test.js` read the fenced block that iteration 12 added to validation.md
  and required the quoted `ERR_MODULE_NOT_FOUND … notebooks/server/index.js` path to exist as a
  documented file — the path's absence is the evidence. Fix in the scanner only: `fencedLines()` now
  skips shell-comment lines (a comment is prose; the quoted error is the only such line in 33 markdown
  files), command lines are still scanned, and both scanners share one `DOCUMENTED_FILE` pattern. A new
  subtest pins comment-vs-command with the real error text beside two commands. **Executed on Node
  v22.23.5:** focused guard **5/5**, dropped to **4/5** when `node scripts/iteration13-missing-probe.js`
  was injected into docs/development.md (the injected comment naming notebooks/server/index.js was
  ignored) and back to **5/5** after the revert; `npm test` **192/192, 0 failed, 0 skipped (24.8 s)**
  (docs/evidence/unit-doc-guard-after-2026-11-18.log.gz), `npm audit` **0 vulnerabilities**,
  `node scripts/check-documentation.js` **117 local links / 0 broken**, `npx playwright test --list`
  **184 tests in 17 files**. Environment note: this device's system Node v26.13.1 runs esbuild's binary
  but hangs its JS build API (service idle on stdin, 0 % CPU), so the suite was run on Node v22.23.5
  from the official tarball under gitignored `artifacts/`; no repository change for that. Measured and
  left for iteration 14: at the region question a nonsense reply gets the town-level recovery and drops
  the region buttons (reproduced offline, docs/evidence/region-nonsense-repro-2026-11-18.log.gz). No app
  module, place data or model vocabulary changed, so the tiny word LM is not retrained. Nothing was
  deployed, main is untouched, no NASA portal edit.

- **18 Nov, same branch: iteration 14 — an unknown region at the area question kept the town-level
  recovery.** Iteration 13 measured this and left it open; driving the real India list, the region
  question answered with `Zqxwv` returned "No town by that name…" with country-wide town buttons and
  dropped the real region rows. `respond()` reached one fallthrough for both pending place questions;
  a new `regionRecovery()` (workflow-assistant.js:297) reuses `areaPrompt()`'s region rows and caveat,
  says the level that is missing and that nothing was selected, and always keeps `Whole <country>`
  tappable. The fallthrough (workflow-assistant.js:424) now chooses by the pending question and leaves
  the town recovery unchanged inside a chosen region and in region-less lists. A new census
  (tests/matrix-coverage.test.js:502) walks **every saved list with a named region row — 227 lists**
  and pins the wording, a real region button, and no selection or data action; with the branch
  disabled it failed **227/227**, restored it was **1/1 (474 ms)**. **Executed on Node v22.23.5:**
  neighbours **49/49**, `npm test` **193/193, 0 failed, 0 skipped (30,013 ms)**, `npm audit` **0
  vulnerabilities**, `node scripts/check-documentation.js` **117 local links / 0 broken**; Playwright
  was not re-run, so **184 tests in 17 files** still describes `--list`, not a fresh browser result.
  Only `workflow-assistant.js` changed in the app; no place data or model vocabulary changed, so the
  tiny word LM is not retrained. Nothing was deployed, main is untouched, no NASA portal edit.

- **18 Nov, same branch: iteration 15 — no axe scan covered a guided chat state.** The only two axe
  call sites scanned read-aloud-stopped and microphone-recording; every guided reply and its
  `role="group"` choice list is rendered dynamically, so a contrast or name regression there passed
  the gate. A measurement at the scope, town and field prompts reported **0 violations / 51 passes**
  each (contrast stayed in axe's `incomplete` set, which the helper does not count as a pass), and the
  new `tests/e2e/guided-chat-accessibility.spec.js` now walks one Singapore flow and scans all three
  states. **Executed:** the four projects passed **4/4 (9.4 s)** on isolated ports/output; injecting a
  low-contrast rule failed `static-desktop` on `color-contrast` and reverting it passed **1/1 (2.6
  s)**; `npx playwright test --list` is now **188 tests in 18 files**; `npm test` **193/193, 0 failed,
  0 skipped (40,561 ms)**. Test-only change; no app module or model vocabulary changed, so the tiny
  word LM is not retrained. A concurrent full-gate run owns the default artifact directory, so the
  focused runs used ports 4180/4181 and `--output=artifacts/playwright/axe-run`; one first attempt in
  the shared directory failed with a trace `ENOENT`, not an app assertion. Nothing was deployed, main
  is untouched, no NASA portal edit.

- **18 Nov, same branch: iteration 16 — the 320 px phone and landscape chat layout were measured but
  never asserted.** Iteration 15 recorded 320×568 and 568×320 geometry in a handoff note only; the
  fixed panel derives its width from `100vw` and its bottom from a ResizeObserver, so a later CSS
  change could push a choice off-screen with the gate still green. The new
  `tests/e2e/small-screen-chat.spec.js` walks the Singapore flow and, after two animation frames,
  asserts at the scope, town and field prompts (320×568 and 568×320) that the page does not scroll
  sideways, the panel's edges are inside the viewport and its bottom stays above
  `.workflow-navigation` when that bar is on screen, and every choice is fully visible and at least
  24 px high. **Executed:** four projects **4/4 (4.3 s)**, then **4/4 (7.0 s)** with the added
  portrait field-prompt check, on isolated ports/output; injecting `#chat-panel{right:-2rem!important}`
  failed `static-desktop` at `panel right edge` and removing it passed **4/4 (4.4 s)**;
  `npx playwright test --list` is now **192 tests in 19 files**; `npm test` **193/193, 0 failed, 0
  skipped (38,133 ms)**, `npm audit` **0 vulnerabilities**, `node scripts/check-documentation.js`
  **`failures: []`**. A full-gate attempt on the superseded `022569e` was stopped at 30/184: one
  `browserContext.close` trace `ENOENT` (same infrastructure signature as iteration 15) and one
  live public-Overpass failure after two user retries; neither was an app assertion and neither was
  loosened. The gate on this tip was owed when this was written and has since been paid on later tips
  that include these specs: **196/196 (22.2 m)** on `b87a6da` and **196/196 (19.1 m)** on `acb6c96`. Test-only
  change; no app module, CSS or model vocabulary changed, so the tiny word LM is not retrained.
  Nothing was deployed, main is untouched, no NASA portal edit.

- **18 Nov, same branch: iteration 17 — a reply could push the message box and the error status line
  below the panel's visible edge.** The panel is height-capped and scrolls itself, so appending to
  `#chat-history` moved `#question-form` and `#answer-status` down without moving the panel's bottom
  edge; a probe measured the status line at y=385 against a panel bottom of 307 at 320×568, y=399 vs
  254 at 568×320, and a 12 px clip even at 1280×1000. `announce()` in `public/js/modules/chat.js`
  now scrolls `#answer-status` into view on every status write, and the `resize` listener re-reveals
  it after `positionChat()`; the second case in `tests/e2e/small-screen-chat.spec.js` asserts the
  message box, Send button and status line stay inside the panel and viewport after one reply at
  320×568, after rotation to 568×320, and after six replies at 568×320. **Executed:** with the first
  version of the fix the run was **6 passed, 2 failed** (`node-desktop`, `node-mobile`: status
  bottom 275.19 vs 254.72 after rotation — portrait scroll carried over); with the resize re-reveal
  four projects passed **8/8 (7.5 s)**; reverting both calls failed `static-desktop` at
  `Expected: <= 307.203125, Received: 370.34375` and restoring it passed **8/8 (8.3 s)**;
  `npx playwright test --list` is now **196 tests in 19 files**; `npm test` **193/193, 0 failed, 0
  skipped (26,095 ms)**, `npm audit` **0 vulnerabilities**, `node scripts/check-documentation.js`
  **`failures: []`**. An axe `scrollable-region-focusable` hypothesis for `#chat-history` was
  disproved (0 violations; each reply's Read aloud button makes it focusable) and abandoned. Emulated
  viewports in headless Chrome only — no claim about real phones, touch or Safari/WebKit. Nothing
  was deployed, main is untouched, no NASA portal edit.

- **18 Nov, same branch: iteration 18 — chat context triggers matched inside longer words and could
  change the answer's topic.** The context builder in `chat.js` tested substrings over the whole
  question: `farm` matched a farmer, `australia` alone added the ABS irrigation benchmark, `ph` in
  "graph" added soil, `water` in "waterlogging" and `field` in "fieldwork" also fired. Context blocks
  are prepended and only a limitation survives from the API's own blocks, so a wrong trigger changed
  what the reply was about. The builder is now the pure `public/js/lib/chat-context.js` with
  whole-word topic patterns, imported by `chat.js`; `tests/chat-context.test.js` pins both leaks, the
  triggers that must still fire and the greeting/location guard. **Executed:** the new file **3 pass,
  0 fail**; reverting only the water/farm patterns to the old substrings made it **2 pass, 1 fail**
  ("field record leaked into limitation,mapped field record") and restoring returned **3 pass, 0
  fail**; a 40-question scratch diff of old versus new triggers showed **7 differences, all
  intended**, and caught that a first word-boundary draft had dropped plural "temperatures" and
  "rainfalls", now fixed; `chat-only-flow`, `assistant` and `small-screen-chat` passed **24/24 (1.0
  m)** in four projects; `npm test` **196/196, 0 failed, 0 skipped (36,520 ms)**, `npm audit` **0
  vulnerabilities**, `node scripts/check-documentation.js` **`failures: []`**. The farmer test was
  rewritten after it passed against the old patterns (loading soil too hid the leak behind the
  two-block budget) — the assertion now pins the required behaviour. Unit-level only; no real
  phone, microphone, Safari/WebKit or agronomic review. Nothing was deployed, main is untouched, no
  NASA portal edit.

- **18 Nov, same branch: iteration 19 — added context replaced the answer's own paragraphs, and the
  owed full gate was run.** The reply kept at most three paragraphs and, when chat added local
  evidence, kept only the API's limitation: a crop question naming the selected field became the field
  record plus a caveat with the sourced crop paragraph gone, and with soil context the reply carried
  two limitation paragraphs. The rule moved to `composeAnswerBlocks()` in
  `public/js/lib/chat-context.js`, ported verbatim first so the required behaviour could be recorded
  failing (**3 pass, 2 fail** against the ported rule: the field case returned `mapped field record,
  limitation` with the crop paragraph gone, and the soil case returned `regional soil model,
  limitation, limitation`), then shipped: weather and soil estimates
  still stand in for the generic templates, while field, pest and irrigation records keep one crop
  paragraph beside them and the API caveat is appended only when the context has none. **Executed:**
  `tests/chat-context.test.js` **5 pass, 0 fail**; the QA-bearing specs `chat-only-flow`, `assistant`
  (sixteen graded cases), `small-screen-chat` and `help-and-explanations` passed **60/60 (2.7 m)** in
  four projects; `npm test` **198/198, 0 failed, 0 skipped (31,438 ms)**, `npm audit` **0
  vulnerabilities**, `node scripts/check-documentation.js` **`failures: []`**. Separately, the full
  four-project gate on `b87a6da` passed **196/196 (22.2 m)** including the live public-Overpass
  `review-phase-a` case, which confirms the earlier failure there was network availability; the
  composition tip still owes its own gate. No assertion was weakened; the QA fixtures have no
  forbidden-text cases. Nothing was deployed, main is untouched, no NASA portal edit.
- **18 Nov, same branch: iteration 20 — a frost question quoted the mean air temperature.** The chat
  weather paragraph chooses its POWER series from the question words and fell through to `T2M` for
  anything that was not solar or rain, so "Show me frost evidence" answered with the mean while
  `server/agronomy/rotation.js:103` counts frost-tender exposure as `T2M_MIN <= 0` and the evidence
  table labels that series "Lowest air"; the fixture shows the gap as 12.9 °C against a −0.6 °C night.
  `T2M_MIN` was already fetched for every location. The selection now uses the minimum series for frost
  wording and falls back to the mean when the series is absent. **Executed:** the guard was recorded
  failing first (**5 pass, 1 fail**, and again **5 pass, 1 fail** after extending it, the extra
  assertions being anti-over-sweeping guards rather than defect proof), then **6 pass, 0 fail**;
  `npm test` **199/199, 0 failed, 0 skipped (26,006 ms)**, `npm audit` **0 vulnerabilities**, and
  `chat-only-flow` + `assistant` **16/16 (1.3 m)** in four projects. The wider eight-spec chat slice did
  not go green on this device and is recorded as-is: **74 passed / 6 failed (12.4 m)** and **71 passed /
  9 failed (14.5 m)**, with all fifteen failures being actionability timeouts (twelve click, one check,
  one `toBeVisible`) plus the live terrain fetch, the failing set moving between projects, the same
  specs passing individually (**8.6 s**, **1.9 m**) and a 90-frame probe measuring one constant
  `#chat-toggle` position on two projects under that same load — an unrelated local model server held
  the load average at 8–10 on 12 cores. No timeout, retry or assertion was changed to hide it; an idle
  re-run of that slice and the 196-case gate on this tip were both owed when this was written — the gate
  has since run clean on `acb6c96` (**196 passed, 0 failed, 19.1 m**), which covers these specs, and the
  two degraded tallies above stand as recorded. Nothing was deployed, main is
  untouched, no NASA portal edit.
- **18 Nov, same branch: iteration 21 — the weather series was chosen by letters inside other words.**
  The topic triggers were given whole-word matching in iteration 18, but the series selector one level
  below them (added to in iteration 20) still sorted by bare substrings, so reaching the weather branch
  at all — "NASA" is enough — let any word fragment choose the quoted series. Measured with a six-question
  probe against the committed module: "Does NASA mention farmer training for wheat?" quoted Rainfall
  (`training` contains `rain`), "our minimum wages for staff" quoted Minimum air temperature, and
  "is a defrost cycle relevant to my pipes?" did the same through `defrost`. The server's own weather
  topic already matches with `\b…\b` (`server/agronomy/conversation.js:20`). The three selectors now
  match whole words, frost only on phrases that mean cold air, and rainfall keeps the plural and
  adjectival forms the app's own suggestion buttons use. **Executed:** failing-first
  `tests/chat-context.test.js` **6 pass, 1 fail** (`+ 'Rainfall' / - 'Mean air temperature'`), then
  **7 pass, 0 fail**; the probe re-run against both modules flips exactly the three questions;
  `npm test` **200/200, 0 failed, 0 skipped (25,927 ms)**, `npm audit` **0 vulnerabilities**, and
  `chat-only-flow` + `assistant` + `help-and-explanations` **52/52 (3.9 m)** in four projects at load
  average above 10. Nothing was deployed, main is untouched, no NASA portal edit.
- **18 Nov, same branch: iteration 22 — a farmer who named the pest got no pest evidence at all.** The
  pest trigger is a closed list of generic nouns, so it fired on "pests"/"worms" but not on the species
  words farmers use: "How do I control fall armyworm in my maize?" and "Tell me about the Australian
  plague locust" both returned nothing although the app had that record, its occurrence count and its
  host note loaded. The record-matching line under the trigger already searched for those names, so the
  gate above it was throwing away data it held. Loaded record names now open the branch too, matched on
  the whole name or the head noun only — matching every word would let "Australian" pull a pest
  paragraph into any sentence about the country, the leak iteration 18 removed — and the matched record
  is the one quoted. An earlier hypothesis for this iteration (soil properties selected by substrings,
  "sand" in "standard") was probed against the shipped module and **rejected**; nothing was changed for
  it, and the probe run is in the evidence. **Executed:** `tests/chat-context.test.js` **7 pass, 1 fail**
  against the committed module (`+ [] / - ['Fall armyworm']`), **8 pass, 0 fail** after, including the
  negative cases; `npm test` **201/201, 0 failed, 0 skipped (24,907 ms)**, `npm audit` **0
  vulnerabilities**, `chat-only-flow` + `assistant` + `help-and-explanations` + `workflow` **64/64
  (2.6 m)** in four projects at load average 4.2. Nothing was deployed, main is untouched, no NASA portal
  edit.
- **18 Nov, same branch: the owed 196-case gate was run on `acb6c96`.** `npx playwright test` with the
  four projects, the built `dist/client` and the live `public/` node server on ports 4202/4203 reported
  **196 passed, 0 failed (19.1 m)** with exit code 0
  (`docs/evidence/e2e-gate-acb6c96-2026-11-18.log.gz`). No case was deselected, no timeout or retry was
  raised and no assertion was changed for the run; the live-service cases held — `field-terrain.spec.js`
  took 48.4 s, 32.8 s, 35.4 s and 2.5 s in the four projects, i.e. the same AWS terrain fetch that failed
  on `c659a59` passed everywhere here. Nothing was deployed, main is untouched, no NASA portal edit.
- **18 Nov, same branch: iteration 23 — the reply budget deleted the sentence saying soil data is not a
  farm measurement.** `contextBlocks()` capped everything at two blocks, and because the SoilGrids branch
  is the only one emitting a separate caveat block, that cap cut the ISRIC advisory whenever the question
  also named the weather: measured on `acb6c96`, "Does the rainfall pattern affect the soil pH here?"
  printed the mapped pH with the API's crop caveat and no advisory, while a soil-only question printed the
  advisory — the same number read either as an estimate or, silently, as a measurement. The same cap also
  dropped the irrigation ratio a soil-plus-water question asked for. Caveats now get their own slot: two
  measured blocks *plus* one limitation, and `composeAnswerBlocks()` spends all three paragraphs on context
  only when a measured estimate is on screen, keeping iteration 19's rule that descriptive context leaves a
  paragraph for the crop facts. **Executed:** guard written first — `tests/chat-context.test.js`
  **8 pass, 1 fail** quoting the composed kinds, then **9 pass, 0 fail**; the direct-module probe flips the
  advisory from absent to present in both soil replies and brings the irrigation ratio back; `npm test`
  **202/202, 0 failed, 0 skipped (25,519 ms)**, `npm audit` **0 vulnerabilities**,
  `node scripts/check-documentation.js` **117 local links, 0 broken, `failures: []`**, and
  `chat-only-flow` + `assistant` + `help-and-explanations` **52/52 (2.3 m)** in four projects at load
  average 3.1. Still owed on this tip: the 196-case gate (the clean run belongs to `acb6c96`) and a browser
  case that loads NASA and SoilGrids into one session — until then the mixed reply is pinned by the unit
  guard and the probe, not by the rendered panel. Nothing was deployed, main is untouched, no NASA portal edit.
- **18 Nov, same branch: iteration 24 — a pest question about radish was answered with the maize pest.**
  The watchlist declares the crop each entry is about (`server/context/pests.js`: `Fall armyworm →
  sweet-corn`, `Diamondback moth → radish`) and the chat state holds the plan's crops
  (`state.planning.baseline`/`allowedCrops`), but the quoted record was `askedPest ?? records[0]`, so unless
  the farmer typed the insect it answered whichever entry the list starts with: measured against the shipped
  table, a radish/tomato/cabbage plan got "Fall armyworm … Maize is a principal host" while the crucifer
  entry sat loaded in the same state. Selection now prefers the record matching the plan (typed name still
  wins, first entry stays the fallback), with no new vocabulary — both sides already speak crop ids.
  **Executed:** guard written first — `tests/chat-context.test.js`, now built from the real `PESTS` table,
  **9 pass, 1 fail** (`a crucifer plan was answered with the maize pest`, `+ 'Fall armyworm' /
  - 'Diamondback moth'`) then **10 pass, 0 fail**; the direct-module probe flips the crucifer plan to
  `Diamondback moth` and leaves the maize and uncovered-cereal plans as they were; `npm test`
  **203/203, 0 failed, 0 skipped (38,335 ms)** and `npm audit` **0 vulnerabilities**. The browser run waited
  for an idle device — a local Python job held four workers at ~260 % CPU each (load 9.9–11.3) while this was
  measured, which is the starvation that produced the unquotable tallies in validation.md subsection 19 — and
  the waiter started the suite at load **3.97**: **64 passed, 0 failed (2.6 m)**, exit code 0, across
  `chat-only-flow`/`assistant`/`help-and-explanations`/`workflow` on all four projects (slowest case 9.0 s,
  `docs/evidence/chat-pest-crop-e2e-2026-11-18.log.gz`). The 196-case gate is still owed on this tip; only
  these 64 cases were re-run. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **18 Nov, same branch: iteration 25 — "do moths matter here?" was answered with the armyworm.** Iteration 22
  opened the pest branch from a loaded record's name, but only through its last word and only when that word
  is five letters or longer, matched as a substring. `TOPIC.pest` already lists `moths?`, so the app invites a
  moth question and then cannot pick the moth record: `Diamondback moth` fails the length rule on its head noun
  and `diamondback`, the word that actually distinguishes the species, was never consulted. Measured on the
  shipped table with a plan the watchlist does not cover (so iteration 24's crop match cannot interfere), that
  gave `Is the diamondback pressure high this year?` → no pest paragraph and `do moths matter here?` →
  `Fall armyworm`. The matcher now uses the head noun when it can carry the name alone and the word in front of
  it when the head is short, each as a whole word with an optional plural — which keeps `fall` (a season, and
  the modifier of `Fall armyworm`) and demonyms like `Australian` out. **Executed:** guard first,
  `tests/chat-context.test.js` **10 pass, 1 fail** → **11 pass, 0 fail**, the previous ten including the
  iteration-22 whole-word and iteration-24 plan cases unchanged; a paired probe that imports the committed and
  the fixed module in one process shows both moth questions moving to `Diamondback moth` while every armyworm,
  season, demonym and soil question selects exactly the record it selected before
  (`docs/evidence/chat-name-word-before-after-2026-11-18.log.gz`); `npm run build` exit 0, `npm test`
  **204/204, 0 failed, 0 skipped (27,360 ms)**, `npm audit` **0 vulnerabilities**. No e2e spec mentions `moth`
  or `diamondback`, so re-running the 64-case chat slice on this tip is a regression check that the wider
  matcher pulled no pest paragraph into other answers; pinning the new behaviour in the rendered panel still
  needs the stubbed POWER/SoilGrids/GBIF chat spec. Nothing was deployed, main is untouched (`4a54fa3`), no NASA
  portal edit.
- **18 Nov, same branch: iteration 26 — a paragraph could cite a source the panel counts but cannot link.**
  `chat.js:108` prints `Sources (n)` from the ids the rendered paragraphs carry, while `dom.js:16-17` skips an id
  with no matching entry, so an unresolved citation is a count with nothing behind it. `contextBlocks()` paired
  them by copying the record through — `sources.push(state.soil.source)` and
  `sources.push({ id: `${pest.id}-host`, ...pest.hostSource })` — which lets the record's own id win over the one
  the paragraph cites. The shipped services agree today (`soilgrids` in `server/context/soil.js:17`,
  `abs-irrigation` in `server/context/water.js:13`, no id on either `hostSource` in `server/context/pests.js`),
  so nothing is visibly broken; the pairing was agreement, not construction, and one renamed field from a
  service would have unlinked a citation. The id is now written after the spread at all three sites, so the paragraph
  decides what the citation is called and the record still supplies title, url and licence. **Executed:** guard
  first — **11 pass, 1 fail** (`a host source id overwrote the citation Which pests affect wheat? declares`)
  then **12 pass, 0 fail**; a paired before/after probe shows the five shipped shapes orphan nothing on either
  side *and* render identical titles, while a host entry with its own id, a soil source with no id, a renamed
  soil source and a renamed irrigation source all go from orphaned to clean
  (`docs/evidence/chat-citation-probe-before-after-2026-11-18.log.gz`); `npm run build` exit 0, `npm test`
  **205/205, 0 failed, 0 skipped (31,575 ms)**, `npm audit` **0 vulnerabilities**. The 64-case chat slice covering
  iterations 25 and 26 together on this tip came out **61 passed, 3 failed (4.3 m)** at load 5.47; all three were
  `#chat-toggle` click-stability timeouts in `static-desktop` and all three passed when re-run alone (3/3, 17.2 s),
  so they are host starvation, not a code regression — but the slice therefore does not certify the tip and the
  full 196-case gate is still owed. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal
  edit.
- **18 Nov, same branch: iteration 27 — a soil texture written after the noun never reached the plan.** Step 1 asks
  for a texture with a select holding only `unknown|sandy|loam|clay` (`public/index.html:119`) and
  `applyPlanning()` copies `constraints.soil` straight into it (`public/js/app.js:181-183`), but the parser read
  `/\b(sandy|loam|clay) soil\b/` — one word order. "clay soil" set the field; "soil is clay" set nothing, and
  because `parseWorkflowMessage` matches `normalizeName(question)`, which lowercases and removes punctuation, the
  colon and equals spellings arrive as the bare "soil clay" and could never be found by a pattern that looked for
  a colon. The plan then used the `unknown` already in the field and said nothing about the dropped constraint.
  The pattern now anchors on `soil` and allows at most `type`/`texture` and one `is` before the texture, so the
  prose shapes stay empty: "the soil here is heavy clay" and "soil is not clay" still set nothing, which the guard
  pins. **Executed:** guard first — **23 pass, 1 fail** (“soil is clay” was dropped from the plan) then **24 pass,
  0 fail**; one probe script run against the live module before the edit and again after it shows the three
  pre-noun orders unchanged, five
  post-noun spellings going from no soil key to the right texture and three negative shapes empty on both sides
  (`docs/evidence/workflow-soil-order-probe-before-after-2026-11-18.log.gz`); `npm run build` exit 0, `npm test`
  **206/206, 0 failed, 0 skipped (26,040 ms)**, `npm audit` **0 vulnerabilities**, and the 64-case chat and
  workflow slice — the same 64 that came out 61/3 on `32f2888` — passed **64/64 (2.6 m)** at load 3.58
  (`docs/evidence/workflow-soil-order-e2e-slice-2026-11-18.log.gz`). The 196-case gate is still owed on this tip.
  Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **18 Nov, same branch: iteration 28 — a planting month was read only from the verb "start".**
  `constraints.startMonth` drives the one First-planting-month select (`public/index.html:117`,
  `public/js/app.js:182-183`) and the parser used `/\bstart(?:ing)? (?:in |month )?([a-z]+)/`, so "plant in May",
  "sow in June", "begin in July", "start around October", "start planting in march", "start at the beginning of
  April" and "start in early/mid/late April" all parsed to **no start month** — measured on the live module before
  any edit: 5 of 17 phrasings resolved. Same shape as iteration 27: the plan quietly kept the month already in the
  form instead of saying the stated window was dropped. The parser now accepts a planting verb plus a preposition
  plus at most one qualifier, and an `-ing` verb sitting directly before the month
  (`public/js/modules/workflow-assistant.js:58-60`), while a base verb still requires the preposition so
  "start may take longer than the season allows" cannot read May into the plan. **Executed:** guard first —
  **24 pass, 1 fail** (“start in early April” was dropped from the plan) then **25 pass, 0 fail**; the probe re-run
  resolves 14 of 17 (`docs/evidence/workflow-month-phrasing-probe-before-after-2026-11-18.log.gz`); `npm run build`
  exit 0, `npm test` **207/207, 0 failed, 0 skipped (28,026 ms)** — an intermediate run was 206/1 and the failure
  was my own doc citing an evidence filename that did not exist, caught by
  `tests/documentation-commands.test.js:93` — `npm audit` **0 vulnerabilities**, and the 64-case chat and workflow
  slice passed **64/64 (3.6 m)** at load 4.50
  (`docs/evidence/workflow-month-phrasing-e2e-slice-2026-11-18.log.gz`). Abbreviated month names ("start in
  Sept") and a month behind a copula ("the first planting is in April") are still not read; recorded, not claimed.
  The 196-case gate remains owed. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **18 Nov, same branch: iteration 29 — a decimal-comma coordinate became a different place on Earth.** The pair
  pattern at `public/js/modules/workflow-assistant.js:22` (pre-fix) allowed a dot inside each number and used a
  comma as the separator, so in locales that write `18,52` for 18.52 it consumed the decimal comma: "at 18,52,
  73,85" — Goa — parsed to latitude 18, longitude 52, a point on the Egypt/Libya border, and "-23,55, -46,63" —
  São Paulo — parsed to **-23, +55** in the Indian Ocean with the second minus sign lost. This is the worst class
  found so far because it does not drop a fact, it substitutes a wrong one, and the ±90/±180 range check cannot
  see it (both invented numbers are in range) while the country check only fires when a country was already named.
  The parser now tries a comma-decimal shape first, requiring `digits,digits` on **both** sides of the separator,
  and only then falls back to the old pattern (`:26-30`), so "at 18, 52" stays a pair of whole numbers.
  **Executed:** guard first — **25 pass, 1 fail** ("the decimal comma was split into a new place",
  `docs/evidence/workflow-coordinate-comma-guard-before-2026-11-18.log.gz`) then **26 pass, 0 fail**; a before/after
  probe on the live module shows the four comma-decimal spellings going from wrong to right while the dotted pair,
  "at 18.521, 73.852", "at 18, 52" and "at 18.52 73.85" are unchanged
  (`docs/evidence/workflow-coordinate-comma-probe-before-after-2026-11-18.log.gz`); `npm run build` exit 0, `npm
  test` **208/208, 0 failed, 0 skipped (29,168 ms)**, `npm audit` **0 vulnerabilities**. The guard also pins the two
  forms still *not* read: "at 35.9 N 14.4 E" is pinned by the guard to yield no location (a hemisphere letter is
  not turned into a sign), and "at 18.52 73.85" is measured to yield none in the probe (a dotted pair with no
  separator). The 64-case Chrome slice on this tip came out **61 passed, 3 failed (8.3 m)**, all three at
  `static-desktop` with `locator.click … waiting for element to be visible, enabled and stable` on `#tab-location`
  and `#flow-next` — the documented starvation signature, and no coordinate assertion failed — and exactly those
  three cases pass **3/3 (8.2 s)** when run alone, so the slice tally is recorded as degraded rather than as a
  result about this change. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **18 Nov, same branch: iteration 30 — a hemisphere-letter or labelled coordinate was refused outright.** The parser
  only recognised two dotted numbers around a comma, so nine spellings measured on the live module — `35.9 N 14.4 E`,
  `33.9 S, 18.4 W`, `14.4E 35.9N`, `lat 18.52 lon 73.85`, `latitude … longitude …`, `long 73.85 lat 18.52`,
  `18.52N 73.85E`, `18.52 S and 73.85 W` — all returned no location and the app asked the farmer for coordinates they
  had just typed. Each number may now carry a fraction in either notation and an optional degree mark, `S`/`W` flip
  the sign, and a point is accepted only when both halves are tagged, one carries a fraction or `°`, and the tags are
  written next to each other (`public/js/modules/workflow-assistant.js:34-49`, precedence `:51-55`). **The first
  version of that rule was itself a defect and is the reason the fraction must stay attached to its own number:** it
  read `at 18,52° N, 73,85° E` as latitude 52, longitude 85 — the iteration-29 substituted-value class reborn — which
  the probe captured before the shipped version turned it into 18.52, 73.85. Measured limits, recorded rather than
  hidden: whole degrees with no `°` (`37N 127E`) are still refused, and `seed rate 3.5 N and 2.1 E per kg` is still
  read as a point because the "and" connector a real `18.52 S and 73.85 W` needs is indistinguishable. **Executed:**
  guard **26 pass, 1 fail → 27 pass, 0 fail** (`docs/evidence/workflow-hemisphere-labels-guard-before-2026-11-18.log.gz`,
  `…-guard-after-2026-11-18.log.gz`), including rewriting the iteration-29 assertion that pinned "at 35.9 N 14.4 E" as
  unread — that line guarded superseded behaviour, so it now requires the pair; a four-part before/after probe
  (`docs/evidence/workflow-hemisphere-labels-probe-before-after-2026-11-18.log.gz`); `npm run build` exit 0, `npm test`
  **209/209, 0 failed, 0 skipped** (`docs/evidence/workflow-hemisphere-labels-npm-test-2026-11-18.log.gz`), `npm audit`
  **0 vulnerabilities**. The 64-case Chrome slice on this tip came out **60 passed, 4 failed (6.1 m)** — all four at
  `static-desktop`, all four `locator.click … waiting for element to be visible, enabled and stable` on `#chat-toggle`
  (`docs/evidence/workflow-hemisphere-labels-e2e-slice-2026-11-18.log.gz`) — and a prompt-level probe of all sixteen
  `tests/qa/prompts.json` questions through the shipped parser shows only `Q09` carrying a location (18.5204, 73.8567,
  unchanged from before the edit), so the failures are host starvation rather than this change; exactly those four
  cases re-run alone finished **4 passed (20.3 s)** (`docs/evidence/workflow-hemisphere-labels-e2e-isolated-2026-11-18.log.gz`),
  and the shipped tree's offline suite is **209/209 (37,936 ms)**. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **19 Nov, same branch: iteration 43 - the citation guard: nothing read a citation that lived inside a code
  file's comments.** Coverage iteration, no production file changed. `scripts/check-documentation.js` walks
  markdown links and `tests/documentation-commands.test.js` reads `AGENTS.md` and the fenced commands of
  `docs/*.md`, so a path inside a `.js` comment was checked by nothing - iteration 41 committed two unresolvable
  archive names exactly there, and iteration 42 nearly committed a wrong line range in the same file. Measured
  before any rule: the census `artifacts/iter43-citation-probe.mjs` over 205 prose-shaped tracked files measured
  **399 evidence citations, 0 unresolvable; 321 file:line citations, 0 missing the line they name; one ambiguous
  bare basename, `api.js`** (`docs/evidence/doc43-census-2026-11-19.log.gz`). The first census hung for minutes
  and was killed - an unbounded name token before a dot is quadratic on minified single-line bundles - so the scan
  caps files at 300 KB and skips build output and submission material; the ambiguity was harmless in fact because
  `public/js/lib/api.js` has 42 lines, so only `server/api.js` can own a line 59, and iteration 35's mention was
  repaired to `server/api.js:59`. `tests/documentation-citations.test.js` adds four offline cases: every named
  evidence archive exists; every `file:N(-M)` citation resolves, stays in bounds and is not wholly blank; no
  citation names a bare basename two tracked files share; and the scan demonstrably reaches the five files where
  the defects lived, with 200-evidence and 150-line-citation floors so a skip-list typo cannot silently empty the
  guard. Four negative controls - a bogus archive, `:9999`, an ambiguous bare-basename `api.js` citation and a
  blank `:17` - were injected one at a time into `tests/chat-context.test.js` comments and `cmp`-reverted
  byte-identical; each failed exactly the intended rule and printed the offending file:line
  (`docs/evidence/doc43-controls-2026-11-19.log.gz`). On the final tree a re-run caught the guard flagging its own
  author: three bullets quoted the ambiguity control as a literal bare-basename token with a line number, read by
  the scan as a real citation; the quotes were reworded to the un-hooked basename and the re-run went green.
  Costs:
  guard **4 passed (0.33 s)** standalone, offline suite
  **224/224, 0 skipped** (`docs/evidence/doc43-npm-test-2026-11-19.log.gz`), up from 220; the Playwright census is
  unchanged at **228 tests in 21 files** because no Playwright-covered file changed, so the full gate on `10a6e47`
  recorded in iteration 42 remains the executed four-project evidence for this tree. The gate-debt ledger in
  `docs/validation.md` was also brought current: its bullets now cite the 222 passed / 6 skipped gate on
  `10a6e47`, mark the pest half paid by iterations 37 and 40 to 42, and leave the `nasa-power` browser measurement
  and the worker-transport half open. (Repaired in iteration 44: that `nasa-power` sentence was stale - the
  browser measurement with `state.inputs` set was already standing at `tests/e2e/chat-evidence-panel.spec.js:110`
  and `:135`, and this bullet's open list below repeated it.) What stays open: within-file line drift is
  still a reader's problem because
  the guard cannot prefer `:98` over `:96`; `docs/history` and files over 300 KB are outside the scan; a citation
  to an existing but unscanned target passes without a line check; the pairing is not yet applied to the three
  counts in `chat-evidence-panel.spec.js:99,129,150`; and the `nasa-power` ledger sentence, which iteration 44
  found stale and repaired. Emulated Chrome only; nothing deployed; no NASA portal edit; main untouched
  (`4a54fa3`).
- **19 Nov, same branch: iteration 44 - the citation-collision guard read only the context side, while the reply's
  own source list was merged in first and never checked.** Coverage iteration, no source change.
  `tests/chat-context.test.js:420` compared what `contextBlocks` pushes against `catalog.sources` for six fixed
  wordings, but the merge the panel renders is `public/js/modules/chat.js:99` - the reply's own sources first -
  and `public/js/lib/dom.js:16` resolves each id with `sources.find`, so the first entry under an id decides where
  the chip opens and a later entry under the same id is unrenderable dead weight. A producer pushing an id with a
  different URL than the registry (the exact shape subsection 34 fixed) would have passed silently. A probe
  replayed the real `createApiHandler` (`server/api.js:24`) with only the POWER transport stubbed to the payload
  recorded on 18 Nov through this repository's own adapter, over eight question families with a valid plan body:
  the rain family composes `nasa-power` twice - registry and context copies agree on the documentation URL today,
  so first-match opens the same target either way, which is why this is a guard and not a live defect
  (`docs/evidence/plan44-probe-2026-11-19.log.gz`). `tests/chat-context.test.js:489` now replays the real handler
  per question, composes exactly as `chat.js` does, and asserts no id maps to two different URLs in the merged
  list and every id a rendered block cites resolves. Injection control: a divergent entry at the head of the
  reply's own sources in `server/agronomy/rotation.js:220` failed the new case naming both URLs while the
  registry-only case stayed green on the same tree, 19 passed 1 failed, `cmp`-reverted byte-identical
  (`docs/evidence/plan44-controls-2026-11-19.log.gz`). Costs: guard **20/20 (0.16 s)** standalone, offline suite
  **225/225, 0 skipped**, up from 224 (`docs/evidence/plan44-npm-test-2026-11-19.log.gz`); Playwright census
  unchanged at 228 in 21 files, so the `10a6e47` gate remains the executed four-project evidence. The stale
  ledger sentence and subsection 41's limit (vi) are repaired in `docs/validation.md` subsection 43. What stays
  open: the matrix is eight families with one plan shape; titles are not compared; the worker-transport half
  stays open as the six skips at `chat-evidence-panel.spec.js:82,115,140`; the pairing counts at
  `:99,129,150` are the next widening. Executed offline only; nothing deployed; no NASA portal edit; main
  untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 51 - one upstream failure was five different farmer-facing sentences, and the
  reason now goes to the log instead of the screen.** `server/context/client.js:36` at `9607565` wrapped every
  upstream failure in a sentence that interpolated `error.message`, and `server/index.js:71` forwards that text
  verbatim for a 502, so what the farmer read was whatever the runtime calls its own transport failure. Measured
  first with `artifacts/iter51-error-shape-probe.mjs` against the real `createCachedJson`: five shapes of one
  condition produced 5 distinct sentences, one per shape, each interpolating the runtime's own wording - `(fetch
  failed)`, `(signal timed out)`, `(Load failed)`, `(HTTP 503)` and a parser fragment - and the probe counted 4 of
  the 5 as a detail no farmer can act on; the exception is `(HTTP 503)`, a status the service answered, which
  `tests/context.test.js:173` keeps as machine-readable `answered` data instead of as text, while
  `server/nasa/power.js:116` still prints its own status number
  (`docs/evidence/iter51-error-shapes-2026-11-19.log.gz`). Three of those wordings already sit in this ledger as
  though they were three products, so the defect was on the record before it was named. The repository already had
  the right shape: `server/nasa/power.js:116-120` words "could not be reached or returned invalid JSON" itself and
  interpolates nothing. Four single-statement edits: `server/context/client.js:40` and
  `server/context/terrain.js:59` now emit one fixed sentence each and keep the reason as `cause`,
  `server/nasa/power.js:120` attaches the same `cause`, and `server/index.js:70` logs every 5xx rather than only
  500, which is where an operator reads it - `artifacts/iter51-502-probe.mjs` asks the running app with
  `globalThis.fetch` replaced, gets clean 502 bodies and 2 stderr lines naming the reason, and 0 of those lines
  with the sink reverted (`docs/evidence/iter51-502-sink-2026-11-19.log.gz`). `tests/context.test.js` pins one
  sentence across four of the shapes plus `slow`/`answered`/`cause`; `tests/terrain.test.js:49`'s `/remain
  unknown/` - which the leaky text satisfied too - is rewritten to the exact sentence, a superseded assertion made
  stricter. Ten controls, three archives (`docs/evidence/iter51-controls-2026-11-19.log.gz`,
  `docs/evidence/iter51-power-controls-2026-11-19.log.gz`,
  `docs/evidence/iter51-anchor-controls-2026-11-19.log.gz`): product files reverted -> 2 of 17 red and exactly the
  two cases written here; clean sentence with no `cause` -> red on the two `cause` assertions only, so the sink is
  load-bearing; `error.name` interpolated -> red on one assertion, and the re-run captured it: 1 of 12 in the
  context file, the exact sentence against `...could not respond (TypeError). No records were invented. Try again
  later.`, and the case aborts at `tests/context.test.js:163` before the sentence count at `:168`; log line alone
  reverted -> reason lines 0; POWER's `{ cause: error }` removed -> 1 of 6 named `host unreachable lost the reason
  the server log needs`; that sentence leaking again -> 1 of 6 on `host unreachable sentence`, so leak and sink
  fail separately; the answered shape handed an invented cause -> 1 of 6 on `service answered 429 invents a reason
  it never caught`; and the log-line revert from the guard side -> 2 of 3 in the anchors file, the drift-replay
  case failing its own precondition first; the new `server/nasa/power.js:116` pin deleted -> 1 of 3 printing the
  floor message whole; that pinned line reworded -> 1 of 3 naming the file, line and quoting subsection.
  `tests/documentation-citation-anchors.test.js` went 7 pins to 13 - five for the lines this subsection edits and
  one for its own `server/nasa/power.js:116` quote, which the re-run survey found at 7 citations - and its floor
  message, a template literal closed by a stray double quote, is repaired and printed by control (I). Offline
  suite 240/240. Two gate runs on these bytes: 225 passed / 6 skipped / 1 failed in 31.9m, the red being the
  non-hermetic `tests/e2e/assistant.spec.js:6` Q07 reading back this iteration's own sentence while the context
  service was down (`docs/evidence/iter51-gate-attempt1-2026-11-19.log.gz`), and 226 / 6 skipped / 0 failed in
  20.6m (`docs/evidence/iter51-gate-attempt2-2026-11-19.log.gz`). Subsection 50's queued step was measured too:
  CDP `Fetch` on either the browser or the page session pauses a dedicated worker's cross-origin fetch and
  `Fetch.fulfillRequest` answers it inside the worker (`resolved 201 {"probe":"answered-by-cdp"}`,
  `docs/evidence/iter51-worker-egress-2026-11-19.log.gz`), so the interception point needs no new dependency - but
  `tests/e2e/fixtures/` holds post-adapter payloads, so the 6 `chat-evidence-panel.spec.js` skips stay until raw
  captures exist, and a `context.route` re-measurement against the same worker request opens the next iteration.

- **19 Nov, same branch: iteration 50 - the gate never blocked the model CDN, and a two-line fix silently moved 40
  ledger citations.** `public/js/modules/chat.js:63` interpolated the raw worker exception into the panel, so with
  the CDN aborted the status line read `Model unavailable: Failed to execute 'importScripts' on
  'WorkerGlobalScope': The script at 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js' failed
  to load.. Evidence chat still works.` - a host, an internal API and a doubled period. The wording already
  existed on the sibling branch at `public/js/modules/chat.js:66`, and `scripts/firefox-validation.js:35` has
  blocked that host since before this iteration, so the gap was in the Playwright gate only. The first draft of
  the fix inserted two lines above line 13, which moves all 40 tracked citations of a `chat.js` line (`:15`,
  `:96`, `:99`, `:108`, `:150-166`) off their statements while every shipped guard stayed green - executed on disk
  in `docs/evidence/iter50-citation-drift-2026-11-19.log.gz`, where the four guards read 20 passed, 0 failed
  against a tree whose `chat.js:99` no longer holds `answer.sources.push(...extra.sources)`. Shipped instead as
  one line, `git diff --numstat` 1 added and 1 removed, file still 170 lines, so no citation moved.
  `tests/e2e/chat-model-egress.spec.js` (new) aborts the model CDN and the Overpass hosts, requires the degraded
  sentence, `#load-model` enabled, `#unload-model` disabled, `Answer ready` for a typed question and
  `window.fieldshiftModelMetrics === undefined`, whose only writers are `public/js/modules/chat.js:59` and `:60`;
  controls (A) green 1.2 s, (B) the fix reverted red with the CDN URL in the received string, (C) the abort
  removed red reading `Compact model ready · 157.1 KB weights · 0.2s load · experimental`, (D) Overpass abort
  alone removed green, (E) the metrics assertion inverted red, (F) restored byte-identical green
  (`docs/evidence/iter50-controls-2026-11-19.log.gz`). `tests/documentation-citation-anchors.test.js` (new, 3
  cases) pins the 7 most-quoted statements to the line numbers the ledger names, and `docs/validation.md:1685` is
  repaired from `chat.js:15` to `:16`, which a comment block had already invalidated. The offline suite moves 236
  to 239 (239 passed, 0 failed, exit 0, 52.7 s, `docs/evidence/iter50-npm-test-2026-11-19.log.gz`), `--list` moves
  228 in 21 files to 232 in 22, the documentation guards 20 to 23. The Playwright gate on these bytes took two
  attempts: attempt 1 exited 1 in 28.0 m with 3 failed, 215 passed, 6 skipped and 8 did not run
  (`docs/evidence/iter50-gate-attempt1-2026-11-19.log.gz`), the three failures all cases reaching live third-party
  services and the 8 the serial tail they blocked (`tests/e2e/chat-pest-context.spec.js:26`); those two files
  alone on the same bytes return 32 passed, 0 failed in 59.4 s, exit 0, and attempt 2 is the gate this iteration
  stands on at 226 passed, 6 skipped, 0 failed in 28.3 m (`docs/evidence/iter50-gate-2026-11-19.log.gz`). Limits:
  the assistant's server-side leg is still uncached in Node (`server/context/client.js`, `server/persistence.js`),
  so the gate is still not hermetic; the anchors cover 7 statements, not the 436 `file:line` citations in the
  ledger; real phones, Safari, microphones and independent agronomy stay unverified. Nothing deployed; no NASA
  portal edit; main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 49 - a citation cut by a line break was invisible to every scanner in the
  repository, and one had shipped.** Iteration 47's wrap split an archive citation in half and was caught only
  because the commands guard's archive regex cannot cross a newline, so it mistook the head half for an archive
  that does not exist. Measured first (docs/evidence/iter49-census-2026-11-19.log.gz): 214 prose files, 763
  archive citations and 389 file:line references read as-is against exactly the same counts read with every
  newline replaced by a space - joining can only add matches, so nothing is cut today - while 156 lines end in a
  path-shaped token and the iteration-43 bullet at `AGENTS.md:933` carried a list marker a wrapper had prepended
  twice. Fix: a new offline guard, `tests/documentation-reflow.test.js`, rejoins the last path-shaped token of a
  line with the first file-named token of the next and calls the citation cut when the result exists, which needs
  no per-extension regex and so covers archives, code paths and every other tracked file at once. Its case 1
  floors the walk against the measurement, case 3 keeps two split fixtures because the first head pattern
  terminated at a word character - it silently skipped the hyphen a wrapper really leaves behind, counted 94 heads
  instead of 153 and stayed green on a clean tree - case 2 asserts zero resolving joins, case 4 sweeps doubled
  markers, and the shipped bullet is repaired in the same commit so case 4 starts green for the right reason.
  Controls (docs/evidence/iter49-controls-2026-11-19.log.gz): a planted archive split goes red here and on
  commands case 6 while the citations guard stays green; a planted code-path split goes red here and green on both
  older guards, 5 of 5 and 6 of 6, which is the gap measured rather than assumed; a break whose halves join to
  nothing stays green; narrowing the head pattern fails the floor and the fixture; dropping markdown from the walk
  fails the floor at 174 files; every mutation restores byte-identically and the four documentation guards finish
  green at 20 passed, 0 failed. The 228-case Playwright gate on these bytes went red on its first attempt: two
  `node-desktop` chat cases in tests/e2e/chat-only-flow.spec.js reached live third-party services
  (docs/evidence/iter49-gate-attempt1-2026-11-19.log.gz), while that file alone on the same bytes returns 3 passed
  in 6.7 s, so the red is an upstream condition and not a result about this change; attempt 2 is the gate this
  iteration stands on at 222 passed, 6 skipped, 0 failed in 24.8 m (docs/evidence/iter49-gate-2026-11-19.log.gz).
  The offline suite moves from 232 to 236. One ledger correction: the iteration-48 handoff bullet quoted 739
  archive citations and 387 references from a probe whose stdout was never archived; the pair measured on those
  bytes is 763 and 389 and both now cite an archived log. Nothing deployed; no NASA portal edit; main untouched
  (`4a54fa3`).
- **19 Nov, same branch: iteration 48 - the evidence index checked every claim it makes about individual files and
  none of the claim it makes about itself, so the first sentence a reviewer reads was the least checked line in
  the tree.** Iteration 47's control F made the edit every later pass has to make - start citing an indexed
  archive and delete its row - and all four cases stayed green while the header of docs/evidence-index.md went on
  claiming "158 of 486 files" over 157 rows. The row count, the file count and the byte total are all recomputable
  from the index and the filesystem, and none of them was. The fix is a fifth case in
  tests/documentation-evidence-index.test.js built on the scan that guard already runs: it reads the header with
  two regexes, recomputes rows, files and the row byte sum and asserts they agree, pins rows against unreachable
  so a stale row cannot sit quiet, and fails if the sentence stops stating its numbers at all - which turns
  rewording from a quiet edit into one that has to be explained. Controls
  (docs/evidence/iter48-controls-2026-11-19.log.gz): baseline 5 passed, then one mutation at a time with a
  byte-identical restore after each - the header row count one low fails alone, the byte total one low fails
  alone, a reworded header fails on the "no longer states" pin instead of passing quietly, the control-F replay
  leaves cases 1-4 green and only the new case red, and shipping an archive with neither a citation nor a row
  moves cases 2 and 5 together ("the header says 491 files under docs/evidence and the scan found 492"). Costs:
  the offline suite moves from 231 to 232 and the three documentation guards from 15 to 16 tests; the guards are
  green on the restored tree, and the full offline run on the byte-final tree is
  docs/evidence/iter48-npm-test-2026-11-19.log.gz. The gate on these bytes is **222 passed, 6 skipped, 0 failed,
  exit 0 in 20.9 m** on the first attempt (docs/evidence/iter48-gate-2026-11-19.log.gz). Recorded in
  docs/validation.md subsection 48. Nothing deployed; no NASA portal edit; main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 47 - the evidence guards walked one way only, so 172 of 479 archives were
  unreachable by full path, and the scan that should have caught it could not express a nested path.** Measured
  with the same prose walk the citation guard uses: 172 files under docs/evidence are named by their full relative
  path in no other tracked file, 103 of them not even by bare file name - 25,712,457 bytes a reviewer cannot reach
  from any claim, 13 carrying this loop's own dates. Both older checks ask only whether a CITED archive exists, so
  an archive nobody cites can never fail anything, and the section 4 index freezing at iteration 33 was the
  visible half of that blind spot. The fix is two parts. docs/evidence-index.md is a committed measurement: 158
  rows, one per archive no prose file names, each carrying the byte size read from stat, and
  tests/documentation-evidence-index.test.js adds four offline cases that hold it true - every shipped archive
  cited or indexed, every row matching the bytes on disk and appearing once, every row stale the moment a document
  starts citing it, plus a scan-reach floor so a prose tree the scan lost sight of cannot report a tidy gap.
  Thirteen loop-era archives left the index for citations written from their own contents, and the nested
  screenshot the same subsection names made fourteen. The second part is a demonstrated false green: the evidence
  character classes in tests/documentation-commands.test.js and tests/documentation-citations.test.js carried no
  slash, so a citation like docs/evidence/merged-release-visuals/after-390-chat.png stopped at the slash and
  stat() approved its directory instead of the file; both classes now carry slash and a sample assertion pins the
  whole-path read. Controls: every row deleted fails 'evidence no document names or indexes' with the full
  unreachable set listed; one row with wrong bytes, a duplicated row, and an archive shipped with no citation each
  fail the row check; an indexed archive that validation.md starts citing fails the stale-row check; the
  nested-citation probe resolves as a directory under HEAD's class and as a missing file under the widened one;
  and the future pass's own edit - cite an indexed archive, delete its row - leaves the header describing the scan
  before it over 157 rows with all four cases green, which is the next candidate rather than something fixed here.
  Two defects of this iteration's own making, caught rather than assumed: rewrapping this bullet with a
  text-wrapping tool split an archive citation across a line and the commands guard failed on the half-path, and
  the header recipe these archives used printed local time under a `Z` label (measured on this host: `date`
  20:01:10 against `date -u` 12:01:10). The probes behind the first are
  docs/evidence/iter47-wrap-probe-2026-11-19.log.gz, which also shows how narrow that catch is, and all eight
  iteration-47 archives were rewritten with `date -u -r` without any measured number in subsection 47 moving.
  
  Costs: the offline suite moves 226 to 231, the four index cases plus the commands guard's parse case. Offline
  **231/231, 0 failed, 0 skipped, exit 0** on the byte-final tree
  (docs/evidence/iter47-npm-test-2026-11-19.log.gz), whose header carries that run. The gate on these bytes is
  **222 passed, 6 skipped, 0 failed, exit 0 in 23.3 m** across the 228 cases `npx playwright test --list` counts
  (docs/evidence/iter47-gate-2026-11-19.log.gz); that is attempt 3, and attempts 1 and 2 went red on third-party
  CDN fetches that subsection 47 records. Nothing deployed; no NASA portal edit; main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 46b - the citation scanner had silently stopped reading docs/validation.md once
  the ledger passed its 307,200-byte size cap; closed by exempting the ledger by role and naming what the cap may
  drop.**
  Test-coverage iteration, one test file changed and nothing shipped. The scanner filters candidates by size
  before reading them, so when docs/validation.md measured 306,985 bytes at `01be9d0` (215 bytes under the cap)
  and then 311,056 after subsection 45 landed, the largest handwritten file left the citation scan with nothing
  saying so; iteration 46's own verification run caught it at 224 pass, 1 fail, 'the scan skipped
  docs/validation.md'. Counted with the guard's own patterns: cap only, 170 archive and 212 file:line citations
  visible; ledger back in scope, 442 and 370 - the ledger alone carried 272 and 158. Raising the number was
  measured as the alternative: on the committed guard any cap from 320 KiB to 1 MiB passes today, so the vendor
  bulk adds no false citation, but the ledger grows 4,984-5,461 bytes per iteration, so a number expires (1 MiB in
  roughly 143 iterations) while docs/ and AGENTS.md exempt by role cannot. The same run showed the guard's two
  visibility floors were not load-bearing: 551 archive and 369 file:line citations measured with the ledger
  scanned against 235 and 212 without it, so the 200/150 floors chosen at iteration 43 stayed green through the
  loss; they are raised to 450 and 320, and a control that also removes the ledger from the required list fails
  'only 235 evidence citations were visible to the scan'. A fifth assertion names the four files the cap is
  allowed to drop and fails if the cap drops anything else or if the list goes stale, so the size limit and the
  list cannot be edited apart; it caught a bug in its own first draft, where the recursive directory call dropped
  the limit argument and subdirectories silently kept the default cap. Controls: removing the role exemption fails
  two assertions at once ('the scan skipped docs/validation.md' and 'files the cap dropped with no review:
  docs/validation.md'), restoring byte-identical gives 5/5, and a fabricated 318,611-byte handwritten file at the
  root is named by the new assertion (docs/evidence/iter46b-controls-2026-11-19.log.gz,
  docs/evidence/iter46b-guard-green-2026-11-19.log.gz). Costs: the suite total moved 225 to 226; offline
  **226/226, 0 failed, 0 skipped, exit 0** on the byte-final tree
  (docs/evidence/iter46b-npm-test-2026-11-19.log.gz), whose header carries that run's own duration; repeated
  runs of these bytes differed by 10 s with host load, so no duration is quoted as a suite cost. The gate
  measured **222 passed,
  6 skipped, 0 failed (22.7 m)** across the 228 cases `npx playwright test --list` counts, exit 0
  (docs/evidence/iter46b-gate-2026-11-19.log.gz); no e2e spec reads docs/ or AGENTS.md, so the shipped
  frontend is unchanged from iteration 46 and the gate is re-run to keep the pushed tip green. Nothing
  deployed; no NASA portal edit; main untouched (`01be9d0`).
- **19 Nov, same branch: iteration 46 - the deployment test rebuilt public/licenses with fs.cp while the citation
  scanner walked them; one ENOENT crash, closed with copyFile.**
  Fix iteration, one production build script changed. Root cause traced before any edit:
  tests/deployment.test.js:7 runs buildBrowser in one of node --test's parallel file processes and
  scripts/build-browser.js copied every vendor and licence file with fs.cp, whose overwrite briefly removes the
  destination; tests/documentation-citations.test.js walks public/ from another process, so a scan overlapping a
  licence overwrite crashed with ENOENT - the stack is the iteration-45 flake archive. A micro-probe copying a 2
  MB file over an existing destination under a continuous reader measured cp 4 ENOENT per 310,897 reads against
  copyFile 0 per 298,594 and staging-then-rename 0 per 287,795 (a first unarchived execution: 19 per 271,668) -
  the non-atomicity is cp's overwrite path, not libuv's copyFile. The fix moves all eighteen regular-file copies
  to copyFile (builder :13,15,17,18,21-23,25-30), deliberately leaves the images directory on cp (:14, the scanner
  never stats or reads .png), and records the why at :6-10; the deployment test now pins the esbuild licence line
  to copyFile (tests/deployment.test.js:33-34). Controls: reverting that line to cp fails the suite on exactly the
  new assertion message and the byte-identical restore passes
  (`docs/evidence/iter46-pin-control-2026-11-19.log.gz`); scanner-shaped system probes measured pre-fix 203 runs
  over 1,808 passes with 0 ENOENT (`docs/evidence/iter46-system-prefix-2026-11-19.log.gz`) and post-fix 275 runs
  over 2,363 passes with 0 ENOENT (`docs/evidence/iter46-system-postfix-2026-11-19.log.gz`) - the in-suite flake
  is rare, so the causal evidence is the micro-probe. Costs: Offline **225/225, 0 skipped (46.3 s)** on the
  code-final tree (`docs/evidence/iter46-npm-test-2026-11-19.log.gz`); the four-project gate **222 passed, 6
  skipped, 0 failed (24.3 m)**, exit 0 (`docs/evidence/iter46-gate-2026-11-19.log.gz`) - the same totals as
  iteration 45, so the restructured vendor copies removed no coverage. Nothing deployed; no NASA portal edit; main
  untouched (`01be9d0`).
- **19 Nov, same branch: iteration 45 - the e2e panel cases printed a Sources count and pinned hrefs, but nothing
  compared the count with the chips that rendered.** Coverage iteration, no production file changed. Case 3 of
  `tests/e2e/chat-evidence-panel.spec.js` pinned no link targets at all, and no case compared the printed count
  with the rendered chips, so a reply whose count outran its panel passed everything. `sourcePanel`/`paired` now
  sit beside the three pinned counts (`:99`, `:129`, `:150`): entries must equal the printed count (dom.js:16
  drops an id no source entry carries) and separators must equal entries minus one (dom.js:18 keys the ` · ` off
  the loop index). Measured: the node-desktop slice passed **3 (3.3 s)**; control A dropped the fixture's
  `power-resolution` entry and only the new entries rule failed - `Sources (2) was printed over 1 rendered
  citations` - with every pre-existing assertion green; control B forced dom.js:18 to `if (true)` and only the
  separator rule failed - `2 rendered citations carried 2 separators` - with the entries rule green at 2 == 2;
  both reverted `cmp`-verified (`docs/evidence/iter45-control-fixture-drop-2026-11-19.log.gz`,
  `docs/evidence/iter45-control-separator-regression-2026-11-19.log.gz`). The +14-line helper block re-pointed
  twenty prose sites (eight bare `:N` tokens the guard cannot see) and corrected nine stale dom.js mentions (the
  keying is dom.js:18, the span branch dom.js:23, sourceLinks spans dom.js:13-26). Offline **225/225, 0 skipped
  (36.5 s)** on the final tree (`docs/evidence/iter45-npm-test-2026-11-19.log.gz`); the four-project gate on the
  code-final tree **222 passed, 6 skipped, 0 failed (20.8 m)**, exit 0
  (`docs/evidence/iter45-gate-2026-11-19.log.gz`), with docs and one pest-spec comment landing while it ran. The
  suite also exposed a pre-existing race - `tests/deployment.test.js:7` rebuilds `public/licenses` while the
  citation scanner walks them; one ENOENT crash observed, green on the surrounding runs
  (`docs/evidence/iter45-offline-flake-2026-11-19.log.gz`). Nothing deployed; no NASA portal edit; main untouched
  (`4a54fa3`).

- **19 Nov, same branch: iteration 42 - the Sources panel's number and its list are produced by two different
  rules, and the whole suite was blind to a divergence between them.** Coverage iteration, no source change.
  `chat.js:108` counts the ids the rendered paragraphs cite; `dom.js:13-26` emits an entry only for an id the
  source list can match and `return`s silently for one it cannot, and `dom.js:18` keys the ` · ` separator off the
  id index rather than the entries rendered. Measured first, and the shipped data is clean:
  `artifacts/iter42-source-census.mjs` replays both page-side rules over every corpus and unexpected wording in
  two states (`docs/evidence/pest42-census-wordings-2026-11-19.log.gz`) - **62 of 88 wordings print a panel, 0
  counted an id that renders nothing, 0 would show an orphan separator, 0 rendered a source as text not link** -
  and a throwaway browser print of all five pest wordings (`docs/evidence/pest42-print-browser-2026-11-19.log.gz`,
  spec deleted afterwards) came out `Sources (5)`, `(7)`, `(5)`, `(2)`, `(3)` each with entries equal to the count
  and separators equal to count - 1. The gap was then proven by injection, both patches applied to `public/` and
  restored byte-identical from `artifacts/iter42-chat-context.before.js` / `artifacts/iter42-chat.before.js`.
  Dropping the `nasa-power` citation inside `contextBlocks` is caught today (**offline 220 tests / 218 pass / 2
  fail**, plus `hrefs[1]` in the case now at `tests/e2e/chat-pest-context.spec.js:98`,
  `docs/evidence/pest42-control-contextblocks-2026-11-19.log.gz`); dropping the same citation at the page layer
  after the merge is not - **offline 220/220 and the committed spec 5 passed** on that build
  (`docs/evidence/pest42-blind-offline-2026-11-19.log.gz`,
  `docs/evidence/pest42-blind-browser-2026-11-19.log.gz`), because that id sits past every index the suite reads,
  so the panel printed `Sources (5)` over four citations and nothing moved. `tests/e2e/chat-pest-context.spec.js`
  gains `sourcePanel()` + `paired()` and all five cases now assert the pairing; against the same blind build the
  widened file fails `Sources (5) was printed over 4 rendered citations` at `:98` and `Sources (3) was printed
  over 2 rendered citations` at `:144` while the three wordings that never cite the dropped id pass alone
  (`docs/evidence/pest42-control-patched-2026-11-19.log.gz`) - the serial abort hid them behind the first failure,
  so they were grepped individually exactly as iteration 41 recorded. No count literal was added where the suite
  did not already pin one, because those counts move with whichever paragraphs the live reply produces; the `:98`
  case now enumerates its five citation titles, which closes iteration 41's first open item - `Sources (5)` is two
  ids from the quoted country record, two from the reply's rotation paragraph and one from the weather sentence,
  not an inference. Costs: restored-tree slice **5 passed (18.5 s)**
  (`docs/evidence/pest42-green-slice-2026-11-19.log.gz`), offline **220/220**
  (`docs/evidence/pest42-offline-2026-11-19.log.gz`), `--list` census still **228 tests in 21 files** since no
  case was added; the full four-project gate on this tree came out **222 passed, 6 skipped, 0 failed (25.6 m),
  `GATE EXIT=0`** (`docs/evidence/pest42-gate-2026-11-19.log.gz`) - 222 + 6 is the 228 that `--list` reports, and
  the 6 skips are the three pre-existing worker-transport sites in
  `tests/e2e/chat-evidence-panel.spec.js:82,115,140` running once per static project, the same 6 as iteration 41,
  so nothing was skipped to make this pass. Two comment-only lines then landed in the spec, so the offline suite
  (**220/220**), the pest slice (**5 passed (14.2 s)**) and the census (**228 tests in 21 files**) were re-run
  together on the final tree (`docs/evidence/pest42-final-tree-2026-11-19.log.gz`); the two runs differ only in
  case line numbers, `:96` onward in the gate log against `:98` onward now. What stays open: the divergence is
  detected, not prevented - the honest fix (count only resolvable ids, or render a visible marker) was not made
  because no shipped wording reaches it; the same pairing is not yet applied to the three counts in
  `chat-evidence-panel.spec.js:99,129,150`; the `dom.js:23` span branch and the orphan separator have never been
  seen by a measured render; and the `nasa-power` id collision this run surfaced twice
  (`server/nasa/power.js:85-87` puts the request url under that id, `public/js/lib/chat-context.js:53` the
  `documentationUrl`, `dom.js:16` keeps the first) is the next iteration's measurement. Emulated Chrome only;
  nothing deployed; no NASA portal edit; main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 41 - iteration 40's rule had no browser witness, and this file's serial mode hid a
  second verdict.** Coverage iteration, no source change: two cases land in `tests/e2e/chat-pest-context.spec.js` for the
  two branches only an offline unit case could see. Both were run as **prints first** and their real rendered paragraphs
  read from that log (`docs/evidence/pest41-measure-2026-11-19.log.gz`, **2 passed, 7.1 s**) before a single shape was
  pinned: `What pests affect sweet corn?` in the comparison + watchlist state renders **3** paragraphs (`Sources (7)`)
  whose third is the reply's own `Australia has a … FAOSTAT production record for Green corn (maize).` sentence, and
  `What pests affect sweet corn in Brazil?` renders the wrong-country advisory **first**, spelled with the codes `AU` and
  `BR` rather than display names, then the crop fact and the reply's own evidence gap (`Sources (5)`). `:155` pins those
  three slots by position - closing iteration 40's limit (i), that no browser asserted the filled slot - and `:175` pins
  the advisory iteration 38 added, which had never been rendered in a browser at all. No live number is asserted: the
  `68 historical occurrence records` in that output is GBIF's to move. Negative control with the previous tip's composer
  restored into `public/` (byte-identical to `git show HEAD~1:…` before the swap, restored byte-identical after,
  `dist/client` carrying the window 1 → 0 → 1 across three builds): **both new cases fail on their own**, `:155` and
  `:175` each with `Expected length: 3, Received length: 2` (`docs/evidence/pest41-cap-control-2026-11-19.log.gz`). The
  first control pass reported **1 failed, 3 passed, 1 did not run** because the file is `mode: 'serial'`
  (`tests/e2e/chat-pest-context.spec.js:26`) and a failure aborts the rest of it, so `:175` was re-run alone to get its
  own verdict; nothing was reordered, deselected or skipped to make that cheaper and the masking is now recorded for the
  next person to edit this file. Costs: restored tree **5 passed (15.1 s)**
  (`docs/evidence/pest41-green-slice-2026-11-19.log.gz`), offline **220/220, 0 failed, 0 skipped**
  (`docs/evidence/pest41-offline-2026-11-19.log.gz`), `--list` census **228 tests in 21 files**, eight more than the 220
  subsection 39 recorded (`docs/evidence/pest41-census-2026-11-19.log.gz`). Full gate attempt 1 came out
  **1 failed, 221 passed, 6 skipped (23.5 m), `GATE EXIT=1`**, and the one failure is not this tree: it is the shared
  live mapped-field helper `tests/e2e/live-fields.js:13` giving up after the app's own honest "7 attempts across 3
  services. No fields were invented", with `review-phase-b.spec.js:44` **passing in the other three projects of that same
  run** and passing in **41.2 s** when re-run alone on the unchanged tree
  (`docs/evidence/pest41-gate-1f-livefields-2026-11-19.log.gz`). The retry budget was not raised, nothing was skipped or
  de-grepped to tidy the tally. Attempt 2 on the identical tree came out **222 passed, 6 skipped, 0 failed (21.6 m), `GATE EXIT=0`** with all eight
  new case lines green (`docs/evidence/pest41-gate-green-2026-11-19.log.gz`). What stays open: iteration 40's `Sources (5)` derivation at
  `:73` is still an inference - this iteration measured two other wordings' counts and pinned shapes instead, and
  closing it needs the panel's resolved `sources` array printed for that wording; emulated Chrome only; and the 6
  `chat-evidence-panel.spec.js` worker-transport skips remain the next coverage item. Nothing was deployed, no NASA
  portal edit, main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 40 - the paragraph window was capped at one even when two slots were free, so a
  reply lost its own second sentence.** This closes iteration 39's surviving limit. Measured before any edit from
  `docs/evidence/pest39-budget-2026-11-18.log.gz`: "What pests affect sweet corn?" rendered **2/3 with
  `room_left_unfilled=YES` and the AU FAOSTAT `country context` sentence dropped**, and "What pests affect sweet corn
  in Brazil?" rendered **2/3 with its `evidence gap` sentence dropped** - the reply admitting its own missing data,
  cut by `facts.slice(0, 1)`. `public/js/lib/chat-context.js:138-143` now reserves a caveat slot only when the reply
  actually has a caveat (`Math.max(1, 3 - context.length - (replyCaveats.length ? 1 : 0))`), so a caveat-free reply
  spends the free slot on its own second paragraph while the three-paragraph bound and iteration 39's reservation both
  hold. Re-running the same probe on this tree gives **`rendered=3/3 room_left_unfilled=no dropped=0` for both** rows
  with the other five wordings unchanged (`docs/evidence/pest40-budget-after-2026-11-18.log.gz`). The QA corpus cannot
  show it: **of 88 wording runs, 26 carry 2+ reply paragraphs, 6 attach any context block, 0 meet the widening
  precondition and 0 render differently** (`docs/evidence/pest40-blast-radius-2026-11-18.log.gz`), because all six that
  reach the budget code are `topic=evidence` replies that *do* carry a `limitation` and so take the reserved branch.
  Negative control on `tests/chat-context.test.js` (`docs/evidence/pest40-cap-control-2026-11-18.log.gz`): **19 tests,
  18 passed, 1 failed** against the previous composer (`not ok 9 - a reply paragraph takes the free third slot rather
  than being cut to one`, diff = the missing `country context`) and **19/19** against this one; no assertion pinned the
  old cap, so nothing was rewritten or skipped. Costs: that file is now **19 tests**, the offline suite **220/220, 0
  failed** (`docs/evidence/pest40-offline-2026-11-18.log.gz`), the rebuilt app carries the rule (`grep -n replyFacts
  dist/client/js/lib/chat-context.js` → :138 and :143, `docs/evidence/pest40-build-2026-11-18.log.gz`), the pest-context
  spec alone is **3 passed (9.7 s)** with `Sources (5)` unchanged
  (`docs/evidence/pest40-spec-slice-2026-11-18.log.gz`) and the full gate came out **214 passed, 6 skipped, 0 failed (25.7 m)** - 214 checks + 6 skips
  is the 220-case census exactly, the 6 skips being the same worker-transport evidence-panel cases the previous green gate
  skipped, and no exit code is quoted because this launch omitted the wrapper's `EXIT=` echo
  (`docs/evidence/pest40-gate-green-2026-11-18.log.gz`). Limits that stay open: no browser case asserts the filled
  third slot (the gate is no-regression evidence here, the unit case and probe are the proof), and the reason
  `tests/e2e/chat-pest-context.spec.js:73` keeps `Sources (5)` is inferred from the reserved-caveat branch rather than
  measured in the comparison state. Nothing was deployed, no NASA portal edit, main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 39 - the composer caveat iteration 38 added deleted the reply's own honesty
  sentence, and the red gate is what proved it.** Subsection 37 registered that displacement as an open limit; the gate
  run on that tree answered it in a browser: `tests/e2e/assistant.spec.js:6:1` failed only on Q10, with exactly one check
  left failing (`Explains shared-host or pest-control limits`), and `tests/e2e/help-and-explanations.spec.js:16:33`
  failed with the model off and on with U19 rendered as the pointer alone
  (`docs/evidence/pest38-gate-red-2026-11-18.log.gz`, **12 failed, 6 skipped, 202 passed (24.1 m)**). Attributed before
  any edit (`docs/evidence/pest39-attribution-2026-11-18.log.gz`): **2** corpus checks move across the three composers,
  both `pre-38=PASS iter38=FAIL caveat-rule=PASS`, with **0** cases whose checks were inert offline, so iteration 38
  caused it and it was not pre-existing. Root cause is `public/js/lib/chat-context.js:137-138` - `facts` accepts only a
  non-`limitation` reply paragraph and the reply's `limitation` is dropped whenever the context carries one, so a reply
  built of nothing but limits rendered one paragraph out of three slots. The smaller repair, making the pointer
  conditional, was measured first and rejected: `docs/evidence/pest39-pointer-pin-2026-11-18.log.gz` shows the wording
  `tests/e2e/chat-pest-context.spec.js:105` pins rendering `pointer=true` on the shipped composer and `pointer=false` on
  that one, so it would have bought the fix by deleting the sentence a farmer most needs in that state. The adopted rule
  lets a context caveat and the reply's own caveats share the slots that remain. Blast radius over 88 wordings in three
  context states (`docs/evidence/pest39-blast-radius-2026-11-18.log.gz`): **4 render differently, 84 byte-identical, all
  4 additions** (Q10 2→3, U21 2→3, U19 1→3, U19 loaded 2→3); the first attempt of that harness reported "0 of 88"
  because it handed `contextBlocks`'s `{blocks, sources}` object where an array was expected, which is the false negative
  to remember. Negative control on `tests/chat-context.test.js`
  (`docs/evidence/pest39-rehearsal-2026-11-18.log.gz`): **18 tests, 18 passed** against the corrected composer and
  **17 passed, 1 failed** against the shipped one, the failure being
  `not ok 8 - a context caveat does not evict the reply own limitation while a slot remains`; no existing assertion
  pinned the old rule, so none was rewritten or skipped. Costs: that file is now **18 tests**, the whole offline suite
  **219/219** (`docs/evidence/pest39-offline-2026-11-18.log.gz`), and the rebuilt bundle carries the rule
  (`grep -c "replyCaveats.slice(0, Math.max" dist/client/js/lib/chat-context.js` = **1**,
  `docs/evidence/pest39-build-2026-11-18.log.gz`). The full gate on this tree is **214 passed, 6 skipped, 0 failed
  (28.3 m)**, all 220 case lines present, exit 0 (`docs/evidence/pest39-gate-green-2026-11-18.log.gz`), so the pointer
  case `tests/e2e/chat-pest-context.spec.js:105` passes in all four projects beside the two new ones. Limit that survives: the other half of subsection 37's
  displacement is a non-`limitation` block, so this rule cannot reach it - "What pests affect sweet corn?" still renders
  **2 of 3 with a slot left free and the AU FAOSTAT `country context` sentence dropped**
  (`docs/evidence/pest39-budget-2026-11-18.log.gz`), because `facts.slice(0, 1)` caps the reply at one paragraph.
  Registered as the next candidate. Nothing was deployed, no NASA portal edit, main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 38 — a pest question the app could answer was swallowed by a gate built for a
  different question, so it answered with a clarification and no source.** Measured on `e45fe1d` before any edit, with
  one probe that drives the real `server/api.js` handler and composes paragraphs exactly as
  `public/js/modules/chat.js:96-99` does (`docs/evidence/pest38-before-after-2026-11-18.log.gz`): with the AU
  watchlist loaded, "Do I need to worry about diamondback moth here?", "Which pests should I watch for in this plan?"
  and "Are there pest records for this country?" each rendered **one** paragraph — `deterministic clarification`,
  **Sources (0)** — and "What pests affect sweet corn?" attached **0** evidence blocks to a crop-country reply. The
  cause was the composer's opening `return` on `answer.useSelectedLocation === false`: a *location* refusal, applied
  to a watchlist that is keyed to a country (`server/context/pests.js`) and needs no point. `public/js/lib/chat-context.js`
  now gates only the four field-scoped topics (`:29-30`, the `if (!gated)` block closing at `:76`, order and budget
  unchanged) and decides the pest branch on the country the reply and the loaded records share (`:99-107`): agreement
  quotes `askedPest ?? askedCrop ?? cropPest ?? records[0]`, a mismatch says which country the list covers and quotes
  nothing. The server-side alternative iteration 37 preferred is recorded as retired here, because
  `chat.js:96` posts no pest payload, so `/api/ask` cannot know which country's list the browser holds. **Correction to
  iteration 37's own measurement:** the flag is set at **nine** sites, not eight — re-measuring with a pattern that
  tolerates the unspaced form found `public/js/modules/workflow-assistant.js:164` (the guided layer) beside the eight
  listed in `server/`, and a scratch browser probe of five pest wordings in a country-selected session showed **5 of 5
  issuing exactly one `/api/ask`** (`docs/evidence/pest38-guided-layer-probe-2026-11-18.log.gz`), so no guided reply
  reaches the new branch and no exclusion was invented for it. Coverage: `tests/chat-context.test.js:82` and `:118`
  (the state loads every evidence layer so the weather refusal is still a real refusal, and `PESTS` is reversed so a
  head-of-list fallback cannot pass for crop matching) plus `tests/e2e/chat-pest-context.spec.js:126`, the same
  species question **with no comparison run**, asserting the species, its host sentence, the non-farm-presence
  sentence, `Sources (2)` and both live hrefs while the unasked species stays out. Controls, all measured: composer at
  the previous tip **15 passed, 2 failed**; country guard removed **16 passed, 1 failed**; reply-crop term removed
  **16 passed, 1 failed**; restored **17 passed, 0 failed** (`…-pest38-controls-…`); in the browser, with
  `grep -c askedCrop dist/client/js/lib/chat-context.js` reading **0** before and **2** after a rebuild, the new case
  is **4 failed → 4 passed (15.1 s)** (`…-pest38-control-composer-at-tip-…`). Costs: spec as landed **12 passed
  (31.8 s)** (`…-pest38-spec-…`), offline suite **218/218 (50,732 ms)** (`…-pest38-npm-test-…`), `--list` **220 tests
  in 21 files**; the full four-project gate on that tree came back red - **12 failed, 6 skipped, 202 passed (24.1 m)**,
exit code 1 (`docs/evidence/pest38-gate-red-2026-11-18.log.gz`) - which is how the limit below was measured in a browser
instead of projected from a scratch harness. Honest limit recorded rather than hidden: the mismatch advisory is a `limitation`, and with only
  that block attached `composeAnswerBlocks` keeps it plus one non-`limitation` paragraph of the reply
  (`facts.slice(0, 1)` at :137), so on the Brazil wording it displaces the FAOSTAT "no matching record" sentence and
  the count moves 5 → 4 while the third slot stays empty — re-measured at **2 of 7 probe wordings losing a reply
  paragraph with a slot left free**
  (`docs/evidence/pest38-budget-limit-2026-11-18.log.gz`) and registered as iteration 39
  candidate 1, because the budget drops an answer paragraph even when a third slot is free. Nothing was deployed, no
  NASA portal edit, main untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 37 — the live pest paragraph had never been rendered by a browser, because the
  only reply that carries it needs a comparison first.** Measured on `120461e` before any edit: `grep -rn "load-pests"
  tests/e2e/` and `grep -rn "occurrence/search" tests/e2e/` both returned **0 hits**, and `Fall armyworm in AU: Country
  records found` existed only in `tests/chat-context.test.js:189, 218` against hand-built records with a literal
  `occurrenceCount: 4213` — a unit test with no screenshot. The test could not have caught the gap because it calls
  `contextBlocks(question, state, { topic: 'pest' })`, a shape production never returns: the composer gate
  `public/js/lib/chat-context.js:24` returns early on `answer.useSelectedLocation === false`, and that flag is `false`
  on every route that can answer a pest wording, at eight sites (`server/agronomy/answers.js:72, 80`,
  `conversation.js:45, 68, 74, 121`, `planning-help.js:16, 39`). One shape does leave it unset (`answers.js:84`,
  `deterministic evidence retrieval`), so an 8-wording scan against the live handler with no comparison and nothing
  stubbed measured whether any pest question can reach it: **0 of 8** replies left the gate open
  (`…-pest-gate-open-scan-…`), because a named crop is routed to the country-aware retrieval at
  `conversation.js:120` first. The reply that opens it is `server/api.js:59`, the comparison-backed one, which needs
  `state.inputs` (`public/js/app.js:290`). Three offline probes measured the
  routes, the composition and a real `/api/compare`+`/api/ask` before any test line was written
  (`…-pest-route-ask-…`, `…-pest-route-composition-…` — `context blocks added: 0` on all four pest wordings — and
  `…-pest-route-compare-…`), then a browser probe drove the app itself and recorded three replies
  (`…-pest-browser-probe-…`): "Which pests should I watch for in this plan?" → `Sources (5)` with the occurrence
  paragraph first and a live GBIF query as chip one; "What pests affect sweet corn here?" → `Sources (5)` with family
  and FAOSTAT paragraphs and no occurrence record; "Do I need to worry about diamondback moth here?" →
  `summary=(no details)`, `links=[]`. `tests/e2e/chat-pest-context.spec.js` lands the first and the unloaded-context
  shape as **2 cases × 4 projects, no new skip**, stubbing only the field transport so NASA, FAOSTAT and GBIF stay real
  — which is why no assertion quotes an occurrence count. Controls: composer branch disabled → node-desktop failed
  quoting the two-paragraph reply it produced instead (`…-pest-control-branch-node-…`) and the missing-context case
  failed with "the missing context sentence is absent" (`…-pest-control-branch-unloaded-…`); dropping the `-host`
  citation id → `Expected: "Sources (5)" / Received: "Sources (4)"` (`…-pest-control-citation-…`), the iteration-34
  failure class caught at the panel boundary. **A protocol finding worth keeping:** the first static control was
  meaningless — the static projects preview `dist/client/` (`scripts/static-preview.js:7`), so editing `public/` and
  re-running showed `static-desktop` passing **2 of 2** on a "disabled" build while node-desktop failed; after
  `npm run build` the same control failed as expected (`1 failed, 1 did not run`, `…-pest-control-branch-built-…`), and
  the source and built tree were then restored and verified empty of markers (`…-pest-control-branch-build-…`,
  `…-pest-build-restore-…`, `…-pest-spec-post-restore-…`). One limit is stated, not claimed: removing the `cropIds`
  match (`server/context/pests.js:5-9`) breaks no test because `diamondback-moth` is keyed to `radish` and a scan of all
  **197** countries with recorded crop data found **0** radish choices and **0** radish regional records
  (`…-pest-radish-scan-…`), so the crop-matched record always equals `records[0]` — proven offline, landed and control
  both quoting `["Fall armyworm"]`, `identical: true` (`…-pest-control-cropmatch-…`);
  `tests/chat-context.test.js:189` stays the only guard on the choice. A 6-wording suppression scan
  (`…-pest-suppression-scan-…`) found **2/6** attaching with a comparison and **0/6** without, **4/6** never attaching —
  3 legitimately (rotation-method questions) and 1 which is the next iteration's candidate: a named species or crop gets
  a clarification with no sources while the watchlist sits loaded in the same state, registered as iteration 38
  candidate 1 with both design options and a preference for a server-side answer over dressing a clarification. Costs:
  new spec **8 passed (20.1 s)** (`…-pest-spec-…`), gate **210 passed, 6 skipped, 0 failed (24.0 m)** with `EXIT=0`
  (`…-pest-gate-…`), offline **216/216 (37,578 ms)** unchanged in count because the deliverable is a spec
  (`…-pest-npm-test-…`), `--list` **216 tests in 21 files**, the documentation-guard re-run after this bullet and
  subsection landed **216/216 (36,088 ms)** (`…-pest-npm-test-final-…`), and the spec re-run after its header comment
  was corrected **8 passed (19.1 s)** (`…-pest-spec-comment-edit-…`) — the gate itself ran on the earlier wording, which
  claimed only `server/api.js:59` leaves the composer flag unset; the corrected text is the measured eight sites plus
  `answers.js:84`, unreachable at 0 of 8. No production file changed; recorded in
  `docs/validation.md` subsection 36. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **19 Nov, same branch: iteration 36 — a coordinate copied as bare whole degrees was refused because nothing in it
  looked like a number.** Iteration 30's first recorded limit (`docs/handoff-2026-11-18.md:459-466`) was that
  "what can I grow at 37N 127E" returned no location, so step 1 asked the farmer to repeat coordinates they had just
  typed. `hemi()` reports `part` only for a fraction or a `°` (`public/js/modules/workflow-assistant.js:49-54`) and the
  hemisphere route required `hemiLat.part || hemiLon.part` (`:75`), so a whole degree matched no pattern at all. Corpus
  before: **10 of 27 shapes returned `null`** (`docs/evidence/whole-degree-probe-before-2026-11-18.log.gz`). Dropping
  the requirement outright was measured first and rejected: it invented a pin on **8 of 9** agronomy sentences
  ("blend 4N 15E for the field" → 4, 15, Central African Republic; `…-risk-nogate-…`), and the side-by-side variant that
  refuses only pairs joined by "and" on **8 of 9 as well** while losing "37N and 127E" itself, 26 of 27 corpus shapes
  either way (`…-risk-adjacency-…`, `…-corpus-adjacency-…`, `…-corpus-ungated-…`). What landed is a lead-in gate: a location
  word immediately in front of the pair (`at`, `near`, `around`, `coordinate(s)`, `gps`, `point`, `place`,
  `latitude`/`longitude`/`lat`/`lon`, optional `is`) or nothing in front of it, which is the answer to "enter your farm
  coordinates"; the two older refusals (prose between the tags, "and" between the tags) are untouched. Corpus after
  **27 of 27** as expected, 19 of 27 producing a location against 9 of 27 before (`…-probe-after-…`); agronomy risk
  after **1 of 9** (`…-risk-after-…`). `tests/workflow-assistant.test.js` gains one test with 6 must-resolve and 4
  must-refuse forms and cites the handoff lines it closes: **30 pass, 1 fail** before the module change (`+ null` on
  `the recorded defect: a whole-degree pin returned no location`, `…-guard-before-…`) and **31 pass, 0 fail** after
  (**10,128 ms**, `…-guard-after-…`); with the lead-in line deleted from a scratch copy and the
  assertions untouched the same file still scores **30 pass, 1 fail**, failing at `blend 4N 15E for the field`
  / `+ { latitude: 4, longitude: 15 } - null` (`…-guard-control-ungated-…`, and identically for the adjacency variant,
  `…-guard-control-adjacency-…`) - the refusals are what make the passing case mean something. No assertion was rewritten because the pre-change tree `72f6302` holds **0** bare
  adjacent whole-degree pairs in `tests/` and **0** hemisphere-tagged numbers in `docs/qa`, with a positive control of 2
  degree-mark coordinates the same grep style finds, so no message that worked before changes answer
  (`…-corpus-scan-…`). Two findings recorded rather than smoothed over: iteration 30's own example sentence still parses
  to `null` because "what can I grow …" is not read as a workflow command at all — the `°` and fraction versions of that
  sentence are refused identically while "Help me plan a rotation at 37N 127E in South Korea" resolves to 37, 127 with KR
  — so `docs/validation.md:2312` is annotated with a pointer instead of being claimed fixed, and chat (which
  `workflow-assistant.js:20-21` hands such a sentence to) sends `state.inputs` and never reads a pin out of the question
  (`public/js/modules/chat.js:96`), registered as iteration 37 candidate 3; and a bare pair opening a clause after a
  colon is still read as a point ("Note: 4N 15E blend on the field" → 4, 15), which the new test asserts as measured so
  nobody can later call it fixed. `npm run build` exit 0 with the gate in `dist/client`; `npm test` **216/216, 0 failed
  (32,505 ms)**, one more test than iteration 35's 215, and **216/216, 0 failed (32,541 ms)** re-run after the
  documentation landed so the guard could check its own new evidence paths
  (`docs/evidence/whole-degree-npm-test-final-2026-11-18.log.gz`); `--list` unchanged at **208 tests in 20 files**; `workflow` +
  `chat-only-flow` + `help-and-explanations` slice **60 passed, 0 failed (2.5 m)**; full gate **202 passed, 0 failed, 6 skipped (21.8 m)**, exit 0 (`…-gate-…`), the first clean 208-case run since
  `72f6302`, whose lone `field-terrain` failure re-passed in isolation (subsection 34). Nothing
  was deployed, main is untouched (`4a54fa3`), no NASA portal edit, no dependency added.

- **19 Nov, same branch: iteration 35 — the citation that reproduced a rainfall number was discarded because two
  paragraphs shared its id.** The defect subsection 33 found and left open: the weather paragraph cites
  `nasa-power` and pushes the **assembled POWER request** under it (`public/js/lib/chat-context.js`), the reply's own
  source list carries the same id with the registry's documentation page (`server/agronomy/crops.json:4-7`, filtered
  into the reply at `server/agronomy/rotation.js:218`, `answers.js:72`, `conversation.js:122`),
  `public/js/modules/chat.js:99` appends the context entries *after* the reply's own and `public/js/lib/dom.js:16`
  keeps the first match - so the panel's one chip opened a documentation page that cannot reproduce the number the
  sentence above it quotes, and `chat.js:108` counts *ids*, so nothing on screen hinted a source had been lost.
  Scope measured before choosing: replaying that composition over the recorded payloads for all six context branches
  drops **exactly one** citation (the weather one; `soilgrids`, `abs-irrigation`, `selected-field` and both GBIF pest
  ids resolve as pushed), the 14 catalog and 7 knowledge server-side ids share **0** entries, and of the 16 recorded
  QA replies that render a link list **4** cite "NASA POWER Daily API" and **0** cite a request URL
  (`docs/evidence/citation-shadow-branch-scan-2026-11-18.log.gz`,
  `docs/evidence/citation-shadow-corpus-scan-2026-11-18.log.gz`). `docs/references.md:60-62,71` promises "the exact
  data request attached to each result", and the evidence table has always kept that promise
  (`public/js/modules/data-flow.js:34`) while chat did not. **Two wrong shapes were measured, not argued:** citing
  only a new id rendered a single chip and *removed* the documentation link, because the answer paragraph citing
  `nasa-power` can be cut by the three-paragraph cap while the source list cannot
  (`docs/evidence/citation-shadow-panel-one-id-only-2026-11-18.log.gz`); citing both ids without pushing both broke
  the existing rule that a paragraph never cites a source the panel cannot link. The landed fix cites
  `['nasa-power', 'nasa-power-request']` and pushes both - the request from `data.source.url`, the documentation
  entry from the `documentationUrl` `server/nasa/power.js:87` always sets - which is strictly additive and reuses
  this file's own two-ids-per-paragraph convention (`:91,95`). Two offline guards are new (the id/URL collision class
  over six question shapes against the shipped registry, and the weather paragraph's two citations with the request
  URL differing from the documentation URL so the id can never degrade into a rename): **13 pass / 2 fail before, 15
  pass / 0 fail after** (`docs/evidence/citation-shadow-guard-before-2026-11-18.log.gz`,
  `docs/evidence/citation-shadow-guard-after-2026-11-18.log.gz`). **Superseded, not weakened:** cases 1 and 2 of
  `tests/e2e/chat-evidence-panel.spec.js` had pinned the dropped behaviour on purpose with the mechanism beside them
  and this iteration named as the owner; they now require `Sources (2)` = `[askRain.sources[0].url,
  observations.source.url]` and `Sources (3)` with the request inserted before SoilGrids, case 3 still requires
  `Sources (2)`, and the unit fixture gained the `documentationUrl` field the adapter returns so the guard reads the
  production shape. **Executed:** panel file **6 passed, 0 failed, 6 skipped (7.0 s)** with the chip order the offline
  prediction had derived from the recorded payloads
  (`docs/evidence/citation-shadow-panel-after-2026-11-18.log.gz`,
  `docs/evidence/citation-shadow-link-prediction-2026-11-18.log.gz`); **sensitivity** with only `chat-context.js`
  reverted = **2 failed, 6 skipped, 4 did not run** and the text is the defect verbatim `Expected: "Sources (2)"
  Received: "Sources (1)"` (`docs/evidence/citation-shadow-panel-sensitivity-2026-11-18.log.gz`); `npm run build`
  exit 0 with the new id in the built `dist/client/js/lib/chat-context.js`; `npm test` **215/215, 0 failed, 0 skipped
  (35,606 ms)** (`docs/evidence/citation-shadow-npm-test-2026-11-18.log.gz`), then re-run twice after the documentation
  landed so the documentation guard could check its own new evidence paths: **215/215, 0 failed (30,307 ms)**
  (`docs/evidence/citation-shadow-npm-test-after-docs-2026-11-18.log.gz`) and **215/215, 0 failed (31,190 ms)** on the
  tree as committed (`docs/evidence/citation-shadow-npm-test-final-2026-11-18.log.gz`); `--list` unchanged at **208 tests in 20
  files**; `chat-evidence-panel` + `chat-answer` + `workflow` **18 passed, 0 failed, 6 skipped (27.4 s)**
  (`docs/evidence/citation-shadow-slice-2026-11-18.log.gz`). The full 208-case gate on this tree is **201 passed, 1
  failed, 6 skipped (23.8 m)** (`docs/evidence/citation-shadow-gate-2026-11-18.log.gz`), and the single failure is a
  busy-service failure reported with its cause rather than a pass: `field-terrain.spec.js:4` in `static-mobile`
  exhausted its own retry budget against live Overpass with `real fields were still unavailable after two user
  retries`, while the same case passed in `static-desktop` (48.3 s) and `node-desktop` (1.9 m) inside that run and
  passed in **41.5 s** re-run alone on this tree
  (`docs/evidence/citation-shadow-gate-terrain-isolated-2026-11-18.log.gz`) - no case this iteration touches failed.
  The full 208-case gate that ran on the previous tip
  `02fb867` while this was staged came out **202 passed, 6 skipped, 0 failed (23.2 m)**
  (`docs/evidence/citation-shadow-gate-prev-tip-2026-11-18.log.gz`), which closes the "no full gate exists for this
  tip" line in subsection 33's open list. Still open and unchanged: the panel has no browser case in the shipped
  `worker` build (`server/index.js:62-64` versus `public/js/lib/core-worker-entry.js:3`, which builds
  `createApiHandler()` with none of the eleven injectable providers `server/api.js:24` accepts), no pest browser
  case, and real phones/touch, Safari/WebKit, microphones, read-aloud quality and independent agronomic review.
  Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **19 Nov, same branch: iteration 34 — the farmer's word "rain" could not reach the rainfall paragraph, and the
  panel that renders it had never been opened in a browser.** `contextBlocks` gates the weather branch on
  `TOPIC.weather` (`public/js/lib/chat-context.js:15`) and then picks a series inside it (`:32-36`), and the two
  lists disagreed: the selector handles `rain|rains|rainy` and `freeze|freezing|frosty`, the gate accepted only
  `rainfalls?` and `frost`, so those words produced **no measurement paragraph at all** and the reply fell back to
  the answer's own generic scope sentence, which quotes no value. Measured on the shipped module over 15
  farmer-shaped questions: **6 of 15** reached the evidence before, **15 of 15** after
  (`docs/evidence/rain-gate-before-2026-11-18.log.gz`, `docs/evidence/rain-gate-after-2026-11-18.log.gz`). The fix is
  one added alternation with a `(?!-)` guard and nothing removed, so no question that reached the evidence before can
  stop reaching it; widening was proven in both directions on a scratch copy first — **16 of 16** phrasings that must
  arrive, **11 of 11** neighbours (`farmer training`, `minimum wages`, `freeze-dried`, `rain-fed`, `rainfed`, `drain`)
  that must stay closed, self-checking probe exits 0
  (`docs/evidence/rain-gate-corpus-2026-11-18.log.gz`). The bigger half was the missing test: subsection 32's own open
  list said no browser case loads POWER and SoilGrids into one session, and `grep -rl soilgrids tests/e2e/` returned
  only `gibs.spec.js`, which never opens the chat — so every panel change in subsections 22 to 33 had only unit and
  probe evidence. `tests/e2e/chat-evidence-panel.spec.js` is new (3 cases) against payloads recorded through this
  repository's own adapters and committed under `tests/e2e/fixtures/`, clearly labelled as recorded and trimmed to the
  last 8 daily rows with the full 366-row recording archived for comparison
  (`docs/evidence/rain-gate-raw-recording-2026-11-18.json.gz`): the measurement sentence with its caveat beside it,
  the ISRIC advisory riding immediately after the pH estimate in a mixed question, and `rain-fed` leaving the answer's
  own three paragraphs alone. **Executed:** guard **13/13, 0 failed (50 ms)**
  (`docs/evidence/rain-gate-guard-2026-11-18.log.gz`), `npm run build` exit 0, `npm test` **213/213, 0 failed, 0
  skipped** (`docs/evidence/rain-gate-npm-test-2026-11-18.log.gz`), `--list` **196 → 208 tests in 20 files**, the new
  file **6 passed, 0 failed, 6 skipped (6.4 s)** (`docs/evidence/rain-gate-e2e-panel-2026-11-18.log.gz`), the
  chat/workflow slice **64 passed, 0 failed (2.9 m)** at host load 6
  (`docs/evidence/rain-gate-e2e-slice-2026-11-18.log.gz`). **Sensitivity:** with only the gate line reverted the same
  command reports **2 failed, 6 skipped, 4 did not run** and the failure text is the defect verbatim — `got: POWER
  precipitation for 2024-01-01 to 2024-12-31 is regional historical evidence in mm/day …`
  (`docs/evidence/rain-gate-e2e-sensitivity-2026-11-18.log.gz`). **Two measured limits the test itself found:** the
  three cases run only in `node-desktop`/`node-mobile`, because `server/index.js:62-64` rewrites the transport marker
  to `http` while `dist/client` keeps `worker` and answers `/api` inside `/js/lib/core-worker.bundle.js`, which
  Playwright routes do not reach (stubbing there failed 3/3 with `The external context service could not respond
  (Failed to fetch)`) — the evidence panel in the worker build stays untested; and the weather paragraph's exact POWER
  request URL is dropped by the panel because `public/js/modules/chat.js:99` appends context sources after the
  reply's own and `public/js/lib/dom.js:16` keeps the first match for a duplicated id, which the new spec pins as
  today's behaviour with the rewrite scheduled next. The pest half of the open list also stays open (a recorded GBIF
  payload exists unused). Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **19 Nov, same branch: iteration 33 — two of the four Comparison Priority values could not be reached from chat.**
  `#priority` offers `family | climate | water | short-season` (`public/index.html:122`), `applyPlanning` writes the
  parsed value into that select (`public/js/app.js:181-183`), each value reorders the comparison
  (`server/agronomy/rotation.js:143-147`) and the reply names it back to the farmer (`:214`) — but the parser had two
  regexes, so only `water` and `family` were reachable by prose and, since the select's first option is `family`, an
  unread priority was **substituted, not dropped**. Measured on `4cc6178` with a 26-phrasing corpus: **11 as required**;
  `climate` reached by **0 of 5** phrasings asking for it and `short-season` by **0 of 4**
  (`docs/evidence/wa-priority-baseline-2026-11-18.log.gz`). The rule now reads a value only inside the same clause as
  the noun, up to six words either side, from the message **as typed** — `normalizeName` has already turned every comma
  and period into a space, and the boundary is what stops a neighbour sentence supplying the value — and a message
  naming two values sets nothing (`public/js/modules/workflow-assistant.js:105-116`). **The rehearsal caught two bugs
  in the first version of the fix**, both on a scratch copy while a browser run held `public/`
  (`docs/evidence/wa-priority-rehearsal-copy-2026-11-18.js.gz`): reading normalized `text` reached across sentences
  (`set the priority later, the water is fine here` → water, four such cases in
  `docs/evidence/wa-priority-overreach-window6-2026-11-18.log.gz`), and the bare compound `water priority` set nothing
  — then narrowing the pre-noun window to three words lost `with short season as the priority` (**25 of 26**,
  `docs/evidence/wa-priority-rehearsal-window3-2026-11-18.log.gz`). Six words with a boundary cut gives **26 of 26**
  (`docs/evidence/wa-priority-overreach-after-2026-11-18.log.gz` shows the only messages that set a value are the ones
  that state one). **Executed:** guard **30 tests, 29 pass, 1 fail → 30 pass, 0 fail** over the 48-spelling corpus
  (`docs/evidence/wa-priority-guard-before-2026-11-18.log.gz`,
  `docs/evidence/wa-priority-guard-shipped-2026-11-18.log.gz`); the 26-row probe re-run on the live module reports
  **26 as required, 0 differences** with all four values reachable
  (`docs/evidence/wa-priority-probe-after-2026-11-18.log.gz`); `priority: water`, `priority = climate`,
  `PRIORITY: WATER`, `set priority to water` and `change the priority to climate` all resolve
  (`docs/evidence/wa-priority-separators-shipped-2026-11-18.log.gz`) — that separator allowance exists because the first
  draft silently narrowed them; `npm run build` exit 0, `npm test` **212/212, 0 failed, 0 skipped (29,782 ms)**
  (`docs/evidence/wa-priority-npm-test-shipped-2026-11-18.log.gz`) and the chat/workflow slice **64 passed, 0 failed
  (2.5 m)** (`docs/evidence/wa-priority-e2e-slice-2026-11-18.log.gz`). Still asserted as limits, not fixes:
  `priority. water` and `priority—water` set nothing, `low priority heat pump install near the water` is ambiguous and
  sets nothing, and `I have no priority yet but the water is short` is declined. Nothing was deployed, main is untouched
  (`4a54fa3`), no NASA portal edit.
- **18 Nov, same branch: iteration 32 — one number written with a decimal comma became a farm location.** The pair
  pattern at `public/js/modules/workflow-assistant.js:31` accepted a comma with no space around it, so
  `salinity 3,7 dS/m` → 3, 7 · `organic matter 3,5 %` → 3, 5 · `the soil is 62,5 % sand` → **62, 5, inside ±90 so
  nothing warns** · and because the pattern reported only its first match, `salinity 3,7 dS/m at 18.52, 73.85` kept
  the invention and lost the real pin. A tight `d,d` whose halves carry neither a dot nor a sign is now refused and
  the search **continues to the next candidate pair** instead of returning nothing. It was rehearsed on a scratch copy
  while the gate held `public/` — a rehearsal that caught that the first predicate could never fire, because `.trim()`
  strips whitespace and not the comma — then applied verbatim once nothing was serving the directory.
  **Executed:** guard **29 tests, 28 pass, 1 fail → 29 pass, 0 fail**
  (`docs/evidence/workflow-tight-comma-guard-before-2026-11-18.log.gz`,
  `docs/evidence/workflow-tight-comma-guard-after-2026-11-18.log.gz`, rehearsal
  `docs/evidence/workflow-tight-comma-rehearsal-copy-2026-11-18.log.gz`, patch
  `docs/evidence/workflow-tight-comma-module-patch-2026-11-18.patch.gz`); the two read-only probes re-run unchanged on
  the live module show the eight coordinate spellings intact, the four invented pins gone and the mixed messages
  keeping the real coordinates (`docs/evidence/workflow-tight-comma-probe-after-2026-11-18.log.gz` beside
  `docs/evidence/workflow-tight-comma-baseline-2026-11-18.log.gz`); `npm run build` exit 0 and `npm test` **211/211,
  0 failed, 0 skipped (23,810 ms)** (`docs/evidence/workflow-tight-comma-npm-test-2026-11-18.log.gz`), re-run green
  after the documentation edits (211/211, 27,055 ms,
  `docs/evidence/workflow-tight-comma-npm-test-final-2026-11-18.log.gz`). Two assertions
  that pinned the superseded behaviour were rewritten to the required behaviour, not deleted: `at('salinity 3,7 dS/m')`
  now must yield no location and `at('soil pH 6,2 at 18.52, 73.85')` now must yield 18.52, 73.85. Still asserted as
  limits, not as fixes: `rainfall 1.250,5 mm`, `values 3,5 and 2,1` and `seed rate 3.5 N and 2.1 E per kg`.
  **The 196-case gate launched on `6db7742` never produced a summary** — 79 case lines printed, then the process was
  gone — kept as `docs/evidence/e2e-gate-6db7742-interrupted-2026-11-18.log.gz`, so no full-suite figure is claimed for
  any tip after `acb6c96`; the browser evidence for this commit is the chat/workflow slice — **64 passed, 0 failed
  (2.3 m)** (`docs/evidence/workflow-tight-comma-e2e-slice-2026-11-18.log.gz`). Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **18 Nov, same branch: iteration 31 — a comma-decimal soil test lost its fraction and invented a pin.** The pH
  pattern (`public/js/modules/workflow-assistant.js:78` pre-fix) allowed only a dot, so `soil pH 6,2` was read as
  pH **6** — a legal value the 0-14 check can never question — and the same comma then read as a coordinate
  separator, giving latitude 6, longitude 2 in the Gulf of Guinea for a message that never mentioned one. Worse,
  `soil pH 6,2 at 18.52, 73.85` kept the invented pair and discarded the real one, because the pair pattern only
  reports its first match. The fraction is now accepted behind either separator and the pH is matched before the
  coordinates, so a pair that is really one labelled decimal is refused rather than plotted
  (`:24-25`, applied at `:55-58`, `:82`). Measured and pinned as still open, not hidden: `salinity 3,7 dS/m` invents
  3, 7 because a unit word is not yet a cue to refuse the comma — the guard asserts that wrong answer so a later change
  cannot claim it is fixed — and the mixed pH-plus-pair message now yields no location, which the guard pins as a
  refusal rather than a resolution. **Owed evidence paid at the same time:** the 196-case
  gate on `bb69aee` (iterations 21 to 30) came out **195 passed, 1 failed (28.7 m)**
  (`docs/evidence/e2e-gate-bb69aee-2026-11-18.log.gz`), the failure a `#baseline-1` select-option timeout on
  `static-desktop` in a spec whose other three projects passed, so the clean 196/196 line still belongs to
  `acb6c96`. **Executed for this iteration:** guard **27 pass, 1 fail → 28 pass, 0 fail**
  (`docs/evidence/workflow-ph-decimal-comma-guard-before-2026-11-18.log.gz`,
  `docs/evidence/workflow-ph-decimal-comma-guard-after-2026-11-18.log.gz`), a before/after probe of pH and location
  on the live module (`docs/evidence/workflow-ph-decimal-comma-probe-before-after-2026-11-18.log.gz`), the 64-case
  chat/workflow slice on this tree **64 passed, 0 failed (3.2 m)**, exit 0 — which re-runs and passes the
  `help-and-explanations.spec.js:66` case the `bb69aee` gate lost, on all four projects
  (`docs/evidence/workflow-ph-decimal-comma-e2e-slice-2026-11-18.log.gz`) — `npm run build`
  exit 0 and `npm test` **210/210, 0 failed, 0 skipped (30,000 ms)**
  (`docs/evidence/workflow-ph-decimal-comma-npm-test-2026-11-18.log.gz`). Nothing was deployed, main is untouched
  (`4a54fa3`), no NASA portal edit.

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
