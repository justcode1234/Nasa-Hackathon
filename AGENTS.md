# AGENTS.md — FieldShift (NASA Space Apps Challenge 2026)

> Instructions for Codex. Read this file before writing code. Preserve user decisions, inspect the actual implementation, and distinguish verified behavior from proposed work.

> **Start here:** section 13 is the current goal, limits, tools and ordered backlog.
> Section 10 and **docs/handoff-2026-11-18.md** hold dated evidence; verify current code.
> Work and push only to **fix/chat-flow-and-answers**. Never main, merge or deploy.
> Preserve other worktrees and dated Phase A materials; never edit the NASA portal.
> Older release permissions and sections 11-12 are historical, not current authority.

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
  a new `regionRecovery()` ([public/js/modules/workflow-assistant.js:521-527, where `regionRecovery()` opens on `areaPrompt()`'s rows](public/js/modules/workflow-assistant.js#L521)) reuses that prompt's region rows and caveat,
  says the level that is missing and that nothing was selected, and always keeps `Whole <country>`
  tappable. The fallthrough ([public/js/modules/workflow-assistant.js:671-672, where `scope` picks `regionRecovery()` over `placeRecovery()`](public/js/modules/workflow-assistant.js#L671)) now chooses by the pending question and leaves
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
  (`public/js/modules/workflow-assistant.js:75-77`), while a base verb still requires the preposition so
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
  pattern at `public/js/modules/workflow-assistant.js:39` (pre-fix) allowed a dot inside each number and used a
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
  written next to each other (`public/js/modules/workflow-assistant.js:51-66`, precedence `:51-55`). **The first
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
  and the worker-transport half open. (Repaired in iteration 44: that `nasa-power` sentence was stale, and that
  repair carried a claim iteration 57 disproved - the superseded spec held no `state.inputs`, never called
  `addInitScript` and ran no comparison, so the browser measurement it said was already standing there had never
  run, and this bullet's open list repeated it.) What stays open: within-file line drift is
  still a reader's problem because
  the guard cannot prefer `:98` over `:96`; `docs/history` and files over 300 KB are outside the scan; a citation
  to an existing but unscanned target passes without a line check; the pairing is not yet applied to the three
  paragraph counts in `chat-evidence-panel.spec.js` (the three line numbers this bullet named are dropped rather than
  re-pointed: iteration 57 replaced that spec); and the `nasa-power` ledger sentence, which iteration 44
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
  stayed open as six skips in `chat-evidence-panel.spec.js` until iteration 57 deleted them, and pairing that
  spec's three paragraph-count assertions stayed queued (both line-number sets this bullet carried are dropped,
  not re-pointed, because iteration 57 rewrote that file). Executed offline only; nothing deployed; no NASA portal
  edit; main
  untouched (`4a54fa3`).
- **19 Nov, same branch: iteration 51 - one upstream failure was five different farmer-facing sentences, and the
  reason now goes to the log instead of the screen.** `server/context/client.js:36` at `9607565` wrapped every
  upstream failure in a sentence that interpolated `error.message`, and `server/index.js:71` forwards that text
  verbatim for a 502, so what the farmer read was whatever the runtime calls its own transport failure. Measured
  first with `artifacts/iter51-error-shape-probe.mjs` against the real `createCachedJson`: five shapes of one
  condition produced 5 distinct sentences, one per shape, each interpolating the runtime's own wording - `(fetch
  failed)`, `(signal timed out)`, `(Load failed)`, `(HTTP 503)` and a parser fragment - and the probe counted 4 of
  the 5 as a detail no farmer can act on; the exception is `(HTTP 503)`, a status the service answered, which
  `tests/context.test.js:223` keeps as machine-readable `answered` data instead of as text, while
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
  sentence across four of the shapes plus `slow`/`answered`/`cause`; `tests/terrain.test.js:49-52`'s `/remain
  unknown/` - which the leaky text satisfied too - is rewritten to the exact sentence, a superseded assertion made
  stricter. Ten controls, three archives (`docs/evidence/iter51-controls-2026-11-19.log.gz`,
  `docs/evidence/iter51-power-controls-2026-11-19.log.gz`,
  `docs/evidence/iter51-anchor-controls-2026-11-19.log.gz`): product files reverted -> 2 of 17 red and exactly the
  two cases written here; clean sentence with no `cause` -> red on the two `cause` assertions only, so the sink is
  load-bearing; `error.name` interpolated -> red on one assertion, and the re-run captured it: 1 of 12 in the
  context file, the exact sentence against `...could not respond (TypeError). No records were invented. Try again
  later.`, and the case aborts at `tests/context.test.js:213` before the sentence count at `:218`; log line alone
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

- **19 Nov, same branch: iteration 52 - a dropped request read as the runtime's own words, and one rule at the
  page boundary now answers for both transports.** `tests/context.test.js:214` already bans a transport detail
  inside farmer-facing text and `tests/nasa.test.js:66` bans it for POWER, but both guards stop at the provider
  layer. `artifacts/iter52-farms-status.mjs` then performed one real action in Chromium on both builds - the
  mapped-field search with its upstreams aborted - and the worker transport rendered the authored 502 sentence
  while the Node transport rendered "Failed to fetch You can continue with the selected map point or coordinates
  without field outlines.". Three censuses came back before any edit: every non-`AppError` throw site in
  `server/` either surfaces as an `AppError` with identical text on both transports or stays inside the payload;
  130 route cases through `createApiHandler` with nine stubbed providers produced 76 raw throws and every
  message was the stub's own; 497 adversarial bodies through the pure code produced none. So the fix is the
  rule, not a per-string patch: `public/js/lib/api.js:48` answers a status-less failure with one sentence and
  keeps the reason on `cause` and in the console, applied at the two places a request can end
  (`public/js/lib/api.js:9` and `:25`), and `public/js/lib/api.js:54` passed an `AbortError` through while four
  callers branched on that name until iteration 56; `public/js/lib/core-worker-entry.js:9` forwards `status`, holds
  ten lines, and the worker's `error.code` still has no consumer. The queue had aimed the rule at the worker
  exit; measurement moved it, because a Node-side fetch rejection never reaches the worker.
  `tests/e2e/api-exit-parity.spec.js` drives one failing action on both transports for one expected string, five
  new cases take the offline suite to 245/245, and `tests/e2e/review-phase-b.spec.js:30` is rewritten stricter
  rather than deleted: it used to accept `Failed to fetch|fetch failed|NetworkError`, three runtime spellings
  for one condition. The four-project gate on these bytes executed 229 passed, 1 failed and 6 skipped in
  24.9 m (`docs/evidence/iter52-gate-2026-11-19.log.gz`), and the red case is not this change: the
  `tests/e2e/field-terrain.spec.js:4` case gave up inside the shared field helper at
  `tests/e2e/live-fields.js:13` after two user retries. Its trace
  (`docs/evidence/iter52-trace-census-2026-11-19.log.gz`) holds 83 network events over five hosts, 24 of them
  Overpass calls across three mirrors and no terrain request at all - overpass-api.de answered HTTP 502 eight
  times, maps.mail.ru HTTP 504 eight times, overpass.private.coffee never answered (6 aborts) - while the panel
  showed the app's own "8 attempts across 3 services. No fields were invented." Retrying the field search is the
  recovery the status line offered, and the helper is what took it. The same case run alone on the same bytes at
  load 3.65 passed in 32.6 s (1 passed, 36.1 s, `docs/evidence/iter52-gate-isolated-rerun-2026-11-19.log.gz`), so
  the services had recovered; the gate stays recorded as one red case and an isolation re-pass does not replace it.
  Controls A-D each remove one part, and the counts reproduce
  (`docs/evidence/iter52-controls-2026-11-19.log.gz`); a second harness re-ran A, C, D and the restored tree with
  full transcripts (`docs/evidence/iter52-controls-named-2026-11-19.log.gz`), where control D shows
  `tests/e2e/api-exit-parity.spec.js:20` failing because the authored 400 sentence is replaced by the generic one -
  the guard catches the meaning, not the source token. Left unverified: the new sentence is copy this agent wrote
  and no farmer has read, one sentence now covers both a dead local server and a bug in this repository,
  `public/js/modules/map3d.js:36` still composes `${error.message}` from throws that never pass through the
  page's request layer, and Safari/WebKit and real phones stay untested. Next, measured: the rate limit at
  `server/context/soil.js:28` made 0 fetches while `server/context/client.js:40` told the farmer the service "could
  not respond" - iteration 53 below is the pass that changed both lines and re-ran the census against them.

- **19 Nov, same branch: iteration 53 - a soil lookup that sent no request blamed ISRIC, and the wait it named
  was a constant.** `artifacts/iter53-soil-throttle-probe.mjs` drove five lookups through the real
  `createSoilClient` with a `fetchImpl` that counts its own calls: the refused lookup made **0 upstream
  requests** and still answered `502` / `CONTEXT_UNAVAILABLE` / "The external context service could not
  respond…", because its `cause` was a plain `Error("Soil service rate limit: retry after 13 seconds")` and
  `server/context/client.js:44` wraps anything that arrives without a status. The spacing was right - 12100 ms
  measured 4.96 requests a minute against the five ISRIC publishes - and the wait was wrong: 6203 ms into a
  window the sentence said 13 seconds with 5897 ms left
  (`docs/evidence/iter53-soil-throttle-2026-11-19.log.gz`). Two single-statement edits, spacing untouched. The
  refusal is a 429 `SOIL_FAIR_USE` `AppError` that names the limit, says nothing was sent and quotes the
  computed wait beside a control that really exists: "Load regional soil estimates" is `public/index.html:131`,
  which `public/js/modules/context.js:115` re-enables on the same failure. The wrapper now throws an authored
  `AppError` unchanged. Window state became a deadline instead of a last-started stamp with `0` meaning "never",
  because once a caller injects a clock epoch 0 refuses a fresh client's first lookup - the bug my own first
  draft shipped and the new test caught. That `client.js` edit replaces a line rather than adding one: nine
  citations name `server/context/client.js:40` and `:43`, and control 5 measured that inserting one line above
  them turns `tests/documentation-citation-anchors.test.js` red. The first draft did exactly that and its
  `npm test` archived 248 tests / 246 pass / 2 fail in 38.6 s
  (`docs/evidence/iter53-line-shift-guard-2026-11-19.log.gz`); neither guard was relaxed. Three new cases -
  the injected-clock walk, the identity passthrough and the HTTP end-to-end pair - take the offline suite to
  **248 tests / 248 pass / 0 fail / 0 skipped, exit 0**, re-measured on the shipped tree after the wording above landed and no duration claimed. Six negative controls each broke one claimed property
  (passthrough 3 failures, constant wait 2, future deadline 2, dropped spacing 2, citation drift 1 and test-file
  pin drift 1) and every restore hashed to its baseline (`docs/evidence/iter53-negative-control-2026-11-19.log.gz`,
  `docs/evidence/iter53-pin-control-2026-11-19.log.gz`). The insertion that added the three cases moved seven
  statements out from under twelve prose lines, so all twelve are re-pointed and the anchor guard grew from 13 pins
  to 16 and covers test files now. `npm run build` put the same compiled expression
  in the worker bundle: `u instanceof g ? u : d`, `SOIL_FAIR_USE` once, the old sentence zero times. Browser:
  68 passed / 0 failed / 0 skipped in 3.0 m, 17 in each of the four local projects. Left unverified: no browser
  case drives the refusal through the service worker, no farmer has read the copy, and the live ISRIC limit was not
  re-measured - the arithmetic and the sentence are what is tested here. Next, measured: P2 stands.
  `server/context/client.js:42-43` still infers `answered` and `slow` from what a runtime calls its own failure, and
  `server/nasa/power.js:116` still puts a status number in farmer-facing text.

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
  the 6 skips are the three pre-existing worker-transport sites of
  `tests/e2e/chat-evidence-panel.spec.js` running once per static project, the same 6 as iteration 41, so nothing
  was skipped to make this pass. The three line numbers this bullet quoted named those `test.skip` guards; they are
  dropped rather than re-pointed, because iteration 57 deleted all three and a pointer into a rewritten spec reads
  as a live one. Two comment-only lines then landed in the spec, so the offline suite
  (**220/220**), the pest slice (**5 passed (14.2 s)**) and the census (**228 tests in 21 files**) were re-run
  together on the final tree (`docs/evidence/pest42-final-tree-2026-11-19.log.gz`); the two runs differ only in
  case line numbers, `:96` onward in the gate log against `:98` onward now. What stays open: the divergence is
  detected, not prevented - the honest fix (count only resolvable ids, or render a visible marker) was not made
  because no shipped wording reaches it; the same pairing is not yet applied to the three paragraph counts in
  `chat-evidence-panel.spec.js` (the three numbers this bullet carried are dropped, not re-pointed: subsection 57
  replaced that spec); the `dom.js:23` span branch and the orphan separator have never been
  seen by a measured render; and the `nasa-power` id collision this run surfaced twice
  (`server/nasa/power.js:85-87` puts the request url under that id, `public/js/lib/chat-context.js:57` the
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
  cut by `facts.slice(0, 1)`. `public/js/lib/chat-context.js:142-147` now reserves a caveat slot only when the reply
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
  caused it and it was not pre-existing. Root cause is `public/js/lib/chat-context.js:141-142` - `facts` accepts only a
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
  tolerates the unspaced form found `public/js/modules/workflow-assistant.js:186` (the guided layer) beside the eight
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
  `conversation.js:45, 68, 74, 121`, `planning-help.js:16, 39`). One shape does leave it unset (`answers.js:88`,
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
  `answers.js:88`, unreachable at 0 of 8. No production file changed; recorded in
  `docs/validation.md` subsection 36. Nothing was deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **19 Nov, same branch: iteration 36 — a coordinate copied as bare whole degrees was refused because nothing in it
  looked like a number.** Iteration 30's first recorded limit (`docs/handoff-2026-11-18.md:459-466`) was that
  "what can I grow at 37N 127E" returned no location, so step 1 asked the farmer to repeat coordinates they had just
  typed. `hemi()` reports `part` only for a fraction or a `°` (`public/js/modules/workflow-assistant.js:66-71`) and the
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
  `workflow-assistant.js:36-37` hands such a sentence to) sends `state.inputs` and never reads a pin out of the question
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
  to `http` while `dist/client` keeps `worker` and answers `/api` inside `/js/lib/core-worker.bundle.js`, where no
  `/api` request exists for a route to match (stubbing there failed 3/3 with `The external context service could not
  respond (Failed to fetch)`) — the panel stayed untested until iteration 55; and the weather paragraph's exact POWER
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
  naming two values sets nothing (`public/js/modules/workflow-assistant.js:122-137`). **The rehearsal caught two bugs
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
  pattern at `public/js/modules/workflow-assistant.js:48` accepted a comma with no space around it, so
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
  pattern (`public/js/modules/workflow-assistant.js:95` pre-fix) allowed only a dot, so `soil pH 6,2` was read as
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

- **19 Nov, same branch: iteration 54 - the retry ladder decided from the words around a failure, not the facts.**
  P2 of the programme. `server/context/client.js:43` set `slow` by matching /abort|timed?\s?out/i over
  `error.name` plus `error.message`, and `answered` came from `Boolean(error?.answered)`, so the vocabulary a
  runtime happens to use for its own failure chose whether the hedge asked again. Measured before the change
  (`docs/evidence/iter54-failure-taxonomy-2026-11-19.log.gz`): a body the client could not read and a host it
  never reached both arrived as `answered=false, slow=false`, although only the second had gone unanswered - the
  first lost its retry and reported "1 attempts across 1 services" in 0 ms. And a service that read the request
  and declined it with HTTP 400 cost 3 requests and 9.0 s, then reached the farmer as "busy or unavailable"
  (`docs/evidence/iter54-refusal-cost-2026-11-19.log.gz`). Four line-neutral edits: the client now records
  `answered` and `responseStatus` from the response it actually got and takes `slow` only from this request's own
  `AbortSignal` (`server/context/client.js:43`); one predicate `isPermanentRefusal(status)` at
  `server/errors.js:12` ends a ladder the service already closed (`server/context/farms.js:78`) and swaps POWER's
  promise for the truth (`server/nasa/power.js:116`); `server/context/farms.js:89` authors the two sentences from
  those flags. The same taxonomy re-run after the change reads the refusal as 1 request in 0 ms with "refused this
  request (HTTP 400, 1 attempts across 1 services)", and 408/429/5xx still buy the ladder. Three new cases
  (`tests/context.test.js:234`, `:277` and `tests/nasa.test.js:88`) went red first - 3 tests / 0 pass / 3 fail in
  377 ms (`docs/evidence/iter54-red-baseline-2026-11-19.log.gz`) - and the focused pair came out 23 pass / 0 fail
  in 1677 ms (`docs/evidence/iter54-focused-run-2026-11-19.log.gz`). Eight negative controls each broke exactly
  one claimed property and every restore hashed byte-identical
  (`docs/evidence/iter54-negative-controls-2026-11-19.log.gz`); the first focused attempt stalled three cases on
  an unref'd `AbortSignal.timeout()` timer and is kept, with its root cause, as
  `docs/evidence/iter54-focused-harness-cancel-2026-11-19.log.gz` instead of deleted. `npm run build` exited 0 and
  all four changes are in the worker bundle, so the static transport carries them too; the browser slice on the
  path that changed was **8 passed, 0 failed in 1.5 m**, exit 0, and `npm test` on the shipped tree is
  **251 tests / 251 pass / 0 fail / 0 skipped**, exit 0, with the citation pin table grown from 16 to 22 so the
  six lines this bullet names cannot move in silence (`docs/evidence/iter54-offline-suite-2026-11-19.log.gz`).
  Left unverified: no case drives a real 400 through either transport, the two flags have exactly one consumer and
  never reach the page, and no farmer has read the wording. Next, measured: P3 stands - the 6 skips in
  `tests/e2e/chat-evidence-panel.spec.js` still run on the node projects only.

- **19 Nov, same branch: iteration 55 - a farmer who loaded evidence for their own field was shown a decline alone.**
  Found by replaying upstream bytes in the shipped artifact, not by the audit list. With POWER and SoilGrids answered
  from raw captures, `#evidence-status` reads `Historical evidence loaded` and the question "How much rain fell here
  last year?" renders only "I could not match that request…" with no `Sources` line at all.
  `server/agronomy/answers.js:80` sets `useSelectedLocation: false` for the unmatched clarification - right for a reply
  about another country, wrong for one naming no place - and `public/js/lib/chat-context.js:33` hid every loaded block
  behind that single flag. The fix splits the two facts: `locationScope: 'unmatched'` at `answers.js:84`, read by the
  gate at `chat-context.js:33`. Four lines per file - the first line-inserting fix since iteration 50 - and 22 ledger
  citation lines moved, which is what it costs. The control ran on the artifact itself: revert plus rebuild leaves
  `locationScope` at 0/0 in `dist/client` and the replay red (`Expected length: 1, Received length: 0`); restore
  byte-identical plus rebuild gives 2/1 and **1 passed**, with the reading, its coordinates and `Sources (2)` on screen
  while a crop question still keeps its own reply (`docs/evidence/iter55-shipped-build-green-2026-11-19.log.gz` and
  `docs/evidence/iter55-shipped-build-control-red-2026-11-19.log.gz`). The same replay falsified the excuse these skips
  have carried since iteration 33: in the worker build `/api` is a `worker.postMessage`
  (`public/js/lib/api.js:18`), so 51 outbound requests contained no `/api/` at all while `context.route` answered the
  worker's own POWER and SoilGrids fetches (`docs/evidence/iter55-egress-measure-2026-11-19.log.gz`). P3 therefore
  needs two committed fixtures, not a new interception point, and the false claim is corrected in six places, each of
  them line-neutral. `npm test` reads **254 tests / 254 pass / 0 fail / 0 skipped**, exit 0, and the focused
  four-project slice **26 passed, 6 skipped, exit 0 in 48.6 s**
  (`docs/evidence/iter55-offline-suite-2026-11-19.log.gz`, `docs/evidence/iter55-focused-browser-2026-11-19.log.gz`).
  Left unverified: the browser witness is a gitignored scratch spec, so no committed case covers the worker transport
  yet and the 6 skips stand until iteration 56; the decline sentence still offers no next step; Safari/WebKit, real
  phones, microphones, audio quality and independent agronomy stay UNVERIFIED. The offline control an earlier draft of
  this bullet reported as not run has since been run on reverted bytes - `git show HEAD:` of the consumer, which has no
  imports so a copy behaves as the shipped file does, plus two generated copies of the new test that differ from it
  only in three relative specifiers: **3 tests, 1 pass, 2 fail, exit 1** against the pre-fix bytes versus **3 pass, 0
  fail** against the shipped ones (`docs/evidence/iter55-offline-control-2026-11-19.log.gz`). Building it exposed a
  provenance hole: the documented prefix `PATH="/opt/homebrew/bin:$PWD/artifacts/toolchains/node-v22.23.5-darwin-arm64/bin:$PATH"`
  resolves `node` to `/opt/homebrew/Cellar/node/26.13.1_2/bin/node`, **v26.13.1** rather than the pinned v22.23.5, and
  no archived suite log names its interpreter. The gate then answered it from the process table instead of from `PATH`:
  its Playwright driver, started in the gate's own first second, executes that Homebrew binary, and the `dist/client`
  build it launched prints as complete at the head of `docs/evidence/iter55-gate-2026-11-19.log.gz`. That gate executed
  **230 passed, 0 failed, 6 skipped in 26.4 m** - iteration 52's red case green in all four projects, and a real
  upstream 502 on the field lookups survived inside the same helper's retry budget in another case, which is capacity
  rather than a repair. Iteration 55's numbers are therefore v26.13.1's and `docs/validation.md:1526` no longer
  describes this device, while `docs/validation.md:1522` and the interpreter behind iterations 53-54 stay inferred until
  a log carries its own version. Next, measured: iteration 56 prints `process.version` and `process.execPath` into each
  log it trusts, repairs those two ledger lines, replaces the browser's four `error.name === 'AbortError'` branches with
  a fact set where this app cancels its own request, then runs P3 proper - commit `tests/e2e/fixtures/raw/`, make the
  panel spec transport-aware and delete the three `test.skip` lines.

- **19 Nov, same branch: iteration 56 - a cancellation nobody asked for, and four surfaces that believed it.**
  Every log this iteration trusts prints its own interpreter first: `INTERPRETER v26.13.1
  /opt/homebrew/Cellar/node/26.13.1_2/bin/node`, recorded on HEAD `92d6cfe`, which is what the queued step asked
  for and what lets the two falsified ledger lines be repaired instead of argued about. The defect was P2's last
  browser-side instance: `public/js/lib/api.js:54` decided a failed request was a cancellation by reading
  `reason?.name === 'AbortError'`, and four consumers (`public/js/app.js:236`, `public/js/app.js:296`,
  `public/js/modules/chat.js:154`, `public/js/modules/workflow-assistant.js:538`) made the same test, so any
  `AbortError` the runtime raised on its own - a dropped frame, an abort the page never requested - silenced the
  evidence status, hid `#retry-evidence`, and left the farmer with no sentence and no next step. The fix is one
  structured fact: `cancellation()` at `public/js/lib/api.js:49` sets `cancelled = true` where this app asked for
  the stop, and `public/js/lib/api.js:56` reads the caller's own `signal.aborted` instead of a name. The case that
  used to cover this asserted the name and so asserted the bug; it is replaced by four stricter cases
  (`tests/api-transport.test.js:88`, `:98`, `:106`, `:114`, the last of which greps the four page modules for
  the old comparison), and one Playwright case drives the same seam on both transports
  (`tests/e2e/api-exit-parity.spec.js:28`). Executed on these bytes: focused **11 of 11, exit 0**; the
  reproducing run **4 failed / 7 passed, exit 1** on `git show HEAD:` bytes with `shasum -c` proving the restore,
  after an earlier control was measured, invalidated and kept because its zsh loop never word-split
  (`docs/evidence/iter56-negative-control-invalid-wordsplit-2026-11-19.log.gz`); browser parity **8 passed, exit
  0** on four projects, whose own control went red on the two node projects only, because the static projects
  read `dist/client` - so the worker half rests on the Node control, not on that run. The gate then went red for a
  reason this iteration did not cause and that this loop has now seen twice: **3 failed / 231 passed / 6 skipped
  in 23.7 m**, all three optional-model cases stopped by `net::ERR_NAME_NOT_RESOLVED` on `cdn.jsdelivr.net`
  after 32.7 s inside the browser, while the same URL answered `http_code=200` in 48 ms seventeen minutes later
  and an isolated re-run of exactly those three titles gave **6 passed in 38.3 s**. That re-pass is recorded and
  not accepted: a second whole four-project gate executed **234 passed / 6 skipped / 0 failed in 22.9 m**, exit 0
  (`docs/evidence/iter56b-gate-2026-11-19.log.gz`), with all three titles green in every project. Offline
  **254 / 254 pass on the bytes before the change, then 257 tests / 255 pass / 2 fail while the evidence index
  lagged its own new archives - both failures the index guard, no other case moved - and 257 / 257, exit 0, after
  the regeneration, a tally that re-ran identically once this bullet and the ledger prose had landed
  (`docs/evidence/iter56-confirm-suite-2026-11-19.log.gz`)**. Two findings the outage made concrete and did not
  cause: `public/js/modules/chat.js:63`
  throws away the `message` the model worker posts at `public/js/modules/mini-lm-worker.js:59` and substitutes
  "Model could not start on this device", which blamed this device for a hostname that did not resolve; and three
  gate cases depend on a third-party CDN at load time (`public/js/modules/mini-lm-worker.js:32`). P3 proper had not
  run as this bullet was written: the spec then held three `test.skip` lines, and subsection 57 of
  `docs/validation.md` replaced them, so this bullet names no line in that file. Safari/WebKit,
  real phones, microphones, audio quality and independent agronomy stay UNVERIFIED. Next, measured: P3 proper on
  the bytes this iteration leaves behind, then the model-load sentence above, which is a farmer-facing lie about
  its own cause.

- **20 Nov, same branch: iteration 57 - six announced-but-unrun panel cases became twenty that execute, and the
  interception rule that excused them was wrong in both directions.**
  The queue asked for P3 proper: make the six skipped `chat-evidence-panel.spec.js` cases deterministic while the live
  checks stay. The census on these bytes reads `Total: 248 tests in 23 files`
  (`docs/evidence/iter57-census-after-2026-11-20.log.gz`), every gate prints `Running 248 tests using 1 worker`, and a
  recursive grep for `test.skip` and `testFixme` under `tests/e2e/` returns nothing, so this is the first gate in the
  loop's history whose 248 contains no skip. The old excuse - that Playwright's `context.route` cannot intercept a
  dedicated worker's `fetch` - was refuted by a probe on the real build: one POWER call and one SoilGrids call counted
  inside the worker (`PROBE_COUNTS {"power":1,"soil":1}`,
  `docs/evidence/iter57-worker-route-probe-2026-11-20.log.gz`). The cause was registration order, not transport:
  `node_modules/playwright-core/lib/coreBundle.js:63783` unshifts route handlers, so the *last* registered match wins
  and the spec's wildcard `/api/` catch-all, registered last, had been seizing the five stubbed endpoints too. Both
  wrong orders were run rather than reasoned about, and both are archived: a bare catch-all registered after the stubs
  turned ten node cases red while ten static ones passed
  (`docs/evidence/iter57-panel-api-seizure-2026-11-20.log.gz`), and catch-all-last with the pinned pattern aborted
  every case it reached - 7 `✘` lines, no tally and no exit status, because that run was killed to free the port
  (`docs/evidence/iter57-panel-catchall-last-partial-2026-11-20.log.gz`). The second archive is why the spec comment
  claiming "ten failed" for the 23:42 run was rewritten instead of re-pointed: the run it described never completed, so
  the count it was quoted for does not exist. The endpoints now replay from two committed raw captures under
  `tests/e2e/fixtures/raw/` (31,080 bytes sha256 `66bd857a…315584`, 866 bytes sha256 `c131235e…d17224`), so a live
  upstream is not the thing the panel spec tests.
  A count belonging to a run that never finished is the class of bug, so a new guard case reads the numbers subsection
  57 quotes out of the gzip bytes instead of out of the paragraph quoting them
  (`tests/documentation-evidence-index.test.js`, sixteen archives): each must print its own tally lines, contain the
  farmer-facing sentences attributed to it, carry the `✘` count claimed, and for the partial one contain no tally at
  all. Two mechanisms came out of controls rather than the design: an exact red-set assertion, because a weaker
  "contains a failure line" check stayed green when the entry was repointed at a different run, and an absence
  assertion on `SPEC_SHA256` for the two gates that carry no stamp. The suite's own offline tally does have a row now,
  and the run that produced it carried fourteen rows rather than sixteen, so that row's first real check is the next
  offline run; the row's power to fail is shown by the controls below instead.
  The guard then got negative controls of its own, eight cases on the first pass
  (`docs/evidence/iter57-tallyguard-controls-2026-11-20.log.gz`) and twelve on the second, after the table grew
  (`docs/evidence/iter57-tallyguard-controls-2-2026-11-20.log.gz`): a wrong tally line, a `-partial-` entry repointed at
  a completed run, an off-by-one `✘` count, a red-set short by one, four `absent` needles the archive really prints, a
  corrupted guard sha and an off-by-one `ℹ pass` in the offline row, and one `phrases` needle no archive prints. The
  first pass printed seven detections and one `GREEN - CONTROL FAILED`, and the miss was in the control - its anchor
  hit the entry above, where the needle legitimately never appears - so the case was split per entry, the second pass
  added a `SKIP` line for an anchor that matches nothing, and all twelve detections came back red with the guard sha
  identical before and after and a post-restore run that has to be green before the script reports anything.
  Separately: the index generator hard-coded its own
  `Generated 19 Nov 2026` header, so every regeneration since dated the index to a run that had not happened; it now
  stamps its own UTC clock.
  Executed numbers. `tests/e2e/chat-evidence-panel.spec.js` is 298 lines at sha256
  `4eef52d3e776b42078914fc5493a3715ae32014ef060d9b98018658d300ec59b`, and on those bytes the focused spec ran
  **20 passed / 0 failed / 0 skipped** twice, exit 0, in 16.2 s and 16.3 s
  (`docs/evidence/iter57-panel-focused-final-2026-11-20.log.gz`, whose header stamps that sha, and
  `docs/evidence/iter57-panel-focused-tripwire-green-2026-11-20.log.gz`). The four-project gate ran three times and all
  three tallies are recorded: **248 passed / 0 failed / 0 skipped in 24.8 m**
  (`docs/evidence/iter57-gate-1-2026-11-20.log.gz`), the same count in 22.1 m
  (`docs/evidence/iter57-gate-2-2026-11-20.log.gz`) and the same count in 22.1 m again on the shipped bytes
  (`docs/evidence/iter57-gate-3-2026-11-20.log.gz`, which prints that sha and `HEAD_COMMIT a6f9bf6`), all exit 0. Only
  the third can be certified against that sha: attempts 1 and 2 predate the comment rewrite - attempt 2's own banner
  names the pre-correction spec `ba6f5bc2` - so their 248 is the same twenty executed cases on bytes differing in no
  assertion, pattern or line count. Offline `npm test` counts **258 tests**, iteration 56's 257 plus the tally case,
  and its first run against these documents was red at **254 passed / 4 failed**, exit 1, on exactly the four
  publication guards that require every archive named in prose to exist and the generated index to match the shelf
  (`docs/evidence/iter57-offline-tallybootstrap-red-2026-11-20.log.gz`) - the tally guard reading logs that had not been
  written yet, kept as evidence instead of being quietly re-run. The same command on the same 258 cases then came back
  **258 passed / 0 failed / 0 skipped**, exit 0, 31.3 s
  (`docs/evidence/iter57-offline-final-2026-11-20.log.gz`), whose header prints the guard and spec shas it ran against,
  and the confirming run on the published tree - every archive and tally row in place before it ran, this sentence added
  after - is **258 passed / 0 failed / 0 skipped**, exit 0, 30.5 s, archived as
  `docs/evidence/iter57-offline-shipped-2026-11-20.log.gz` with `TALLY_ROWS 16` and the shipped panel-spec sha in its
  header; it is the one archive here with no row of its own, because a row reading it would be read by the run writing it.
  P0 split into what is measurable and what is not. The queued literal `GATESENTENCE` at `AGENTS.md:1060` is in no
  commit on any ref (`git log --all -S'GATESENTENCE'` empty) and a count reads 0 in the working tree, at `HEAD` and at
  `HEAD~1`, so what the goal called a standing literal was 19 Nov scratch text; the line the queue means is
  `AGENTS.md:1057`, which the anchors guard pins now. The 19 Nov field-discovery red is **not** diagnosed by this pass
  and this bullet does not pretend otherwise: all three green gates printed live upstream trouble without failing -
  `The field lookup services are busy or unavailable (7 attempts across 3 services)` in each of them and the same
  sentence at 8 attempts in attempt 2, thrown at `server/context/farms.js:89` with `code: 'CONTEXT_UNAVAILABLE'` -
  which is evidence of intermittent load, not of a cause. `tests/e2e/live-fields.js:13` still fails after two presses
  when nothing upstream is stubbed, which is exactly why panel coverage now replays fixtures.
  Still open and named: `public/js/modules/chat.js:62` drops the `message` that
  `public/js/modules/mini-lm-worker.js:59` posts, `public/js/lib/api.js:13` ignores a posted `error.code`, no case
  cancels during `response.json()`, three gate cases still need `cdn.jsdelivr.net`, and P1 and P2 remain untouched code
  at `server/context/soil.js:26`, `server/context/client.js:40` and `server/nasa/power.js:116`. P4's journey audit was
  not attempted. Safari/WebKit, real phones, microphones, audio quality and independent agronomy stay UNVERIFIED, and
  the fixtures prove the wiring replays rather than that the agronomy inside them is right. Next: P4 with the same
  reproduce-then-assert discipline, and the tally guard as the standard for what this ledger may write down as verified.

- **20 Nov, same branch: iteration 58 - a field lookup that never completed was reported as a field count of zero.** The
  farmer journey was audited at the point where it says something about the world, and the sentence it said was
  `0 mapped fields were returned.` A refused lookup and an empty area produce the same words, so the app told a farmer
  that no mapped fields exist near their point on the strength of a request that never answered. Root cause is two
  layers of swallowed state: `public/js/modules/context.js` returned an empty list on every failure path, and
  `public/js/modules/workflow-assistant.js:414` mapped any resolution at all onto its `done` branch. The fix makes the
  outcome structured rather than inferred - `public/js/modules/context.js:123` returns `reason: 'no-location'`,
  `:130` `superseded`, `:138` `{ ok: true, count }` and `:144` `lookup-failed`, and only `ok === false` reaches
  `fieldsFailed` at `public/js/modules/workflow-assistant.js:428`, which both chat and the guided panel route through
  (`:476` and `:527`). The replacement sentence names the failure, keeps the selected point and offers the retry:
  `The community field lookup did not complete, so this app cannot say whether any mapped fields exist near this point.`
  **Executed numbers.** `tests/e2e/field-service-failure.spec.js:21` reproduces it: on the pre-fix bytes
  **4 failed / 0 passed** in all four projects with the defective sentence printed
  (`docs/evidence/iter58-focused-red-2026-11-20.log.gz`), after the fix **4 passed / 0 failed / 0 skipped**
  (`docs/evidence/iter58-focused-green-2026-11-20.log.gz`, raw report `docs/evidence/iter58-focused-green-json-2026-11-20.log.gz`
  with `expected=4 unexpected=0 flaky=0`). The refusal phases have to run before the answered phase because the first
  successful lookup is cached for 24 h (`tests/e2e/field-service-failure.spec.js:55-60`). One case is worth stealing:
  the two `static-*` projects serve `dist/client`, a build of `public/`, so a source-only patch is invisible to them:
  the source-only control run reports the two node projects only
  (`docs/evidence/iter58-focused-controls-source-only-2026-11-20.log.gz`, `MISSED static-desktop static-mobile`), while
  the rebuilt run (`docs/evidence/iter58-focused-controls-2026-11-20.log.gz`) detects four of four half-fixes.
  The four superseded neighbour assertions were rewritten stricter rather than deleted; their pre-fix reading is
  `8 failed / 12 passed (3.8m)` (`docs/evidence/iter58-neighbours-superseded-2026-11-20.log.gz`). The four-project gate
  is **252 passed / 0 failed / 0 skipped (27.6 m)**, exit 0, with the new case executed once per transport
  (`docs/evidence/iter58-gate-2026-11-20.log.gz`), and it absorbed two live
  `server/context/farms.js:89` `code: 'CONTEXT_UNAVAILABLE'` refusals without calling them passes. The census on these
  bytes reads `Total: 252 tests in 24 files` with no skip anywhere under `tests/e2e`
  (`docs/evidence/iter58-census-2026-11-20.log.gz`), so iteration 57's 248 in 23 gained four cases in one new spec
  file. `tests/workflow-place-choices.test.js:627` adds the offline half, and the tally guard now also reads the
  census, the controls runs, the provenance snapshot and the green pre-final offline suite out of the gzip bytes. The
  controls harness ran six times and all six readings ship. Pass five is the one that reported its own gap:
  `CONTROL_ROWS_IN_TABLE 33 ATTACKED 30 UNATTACKED 3` names the three earlier controls archives it had never attacked
  (`docs/evidence/iter58-tally-controls-pass5-2026-11-20.log.gz`), and pass six closed it with
  `CONTROL_ROWS_IN_TABLE 35 ATTACKED 35 UNATTACKED 0` above `CONTROLS_DONE 53 cases, 53 detections aimed` and nothing
  skipped (`docs/evidence/iter58-tally-controls-pass6-2026-11-20.log.gz`). Pass four's
  `CONTROL_ROWS_IN_TABLE 29 ATTACKED 29 UNATTACKED 0`
  (`docs/evidence/iter58-tally-controls-final-2026-11-20.log.gz`) stayed true only of the rows that existed when it
  read them, and the pass before it printed `CONTROLS_DONE 30 cases, 29 detections aimed, 0 red-but-unaimed,
  0 invalid patches, 0 green controls, 1 skipped anchors` because the needle it aimed at is pinned by three rows, so
  the harness refused the patch rather than attacking a neighbour
  (`docs/evidence/iter58-tally-controls-run1-skipped-2026-11-20.log.gz`). The last two archives of this iteration -
  the shipped `npm test` on the finished tree at **259 passed / 0 failed** under `TALLY_ROWS 32`
  (`docs/evidence/iter58-offline-2026-11-20.log.gz`) and the five documentation guard files re-run after it at
  **24 passed / 0 failed** under `GUARD_TABLE_ROWS 34`
  (`docs/evidence/iter58-docsguards-final-2026-11-20.log.gz`) - each carry a tally row, and the one row no pass can
  attack is pass six's own, which subsection 58 states. Two of this iteration's findings are about the instruments,
  not the product:
  `docs/evidence/iter58-offline-index-red-2026-11-20.log.gz` is a **258 passed / 1 failed** run red on exactly the
  index-header case, because shelving archives before regenerating `docs/evidence-index.md` is its own defect, and
  the P0 queue wording itself was wrong - `tests/e2e/live-fields.js:13` is a frame in a helper module that three specs
  import, never a case line, so no gate log can ever print it; the 19 Nov field-discovery red stays undiagnosed and
  intermittent. P1 is untouched: `server/context/soil.js` still builds the 429 refusal and
  `server/context/client.js:44` still rethrows it unwrapped. Still open and now named by line, the
  `public/js/modules/chat.js:91` composer clear that runs before `workflow.respond` at `:94` while `:149` announces
  `error.message`, so a failed ask loses the question instead of making it retryable - iteration 59's target.
  Safari/WebKit, real phones, microphones, audio quality and independent agronomy stay UNVERIFIED. Nothing was
  deployed, main is untouched (`4a54fa3`), no NASA portal edit.
- **20 Nov, same branch: iteration 59 - a refused ask deleted the sentence the farmer had just typed.** P4 caught it in
  the chat leg of the journey: `public/js/modules/chat.js:91` empties the composer before `:94` and `:96` await the
  guided-plan or evidence reply, and the catch at `:149` only writes `error.message` into the status line at `:155`
  before `finally` at `:159` re-enables Send. The typed question then survives solely as the farmer's own
  `<article>` further up the history - a node with no control on it - while the status line that explains why nothing
  came back is the element the next message overwrites. On a phone, retrying meant retyping. The fix is one statement:
  inside the guard that already ignores cancellations and stale replies at `:154`, `:156` writes the question back when
  - and only when - the composer is still empty, because dictation and typing both land in that box while a request is
  in flight. **How it was found was a rule-out, not a guess**: three archived probes
  (`docs/evidence/iter59-probes-2026-11-20.log.gz`) show a catalogue question is answered from bundled data at
  `server/api.js:55` with zero network requests, the 400 at `server/api.js:46` is unreachable by typing because the
  composer's own `maxlength="500"` agrees with the handler's 1-500 rule, and an evidence question with every external
  host cut issues no request at all until a place is selected. What a farmer actually hits is the guided plan that
  names its own coordinates: `public/js/modules/workflow-assistant.js:557` awaits the reverse lookup with no branch
  around it, so a refusal there rejects straight out of `workflow.respond`. **Executed numbers.**
  `tests/e2e/chat-refused-ask-keeps-question.spec.js:26` reproduces it and then re-sends *without retyping*;
  `:76` types a different sentence into the composer while a lookup is held open for 2.5 s. Against the previous
  commit's bytes the spec reports **4 failed / 4 passed (19.6s)**, every failure at `spec.js:26:1` on the composer
  assertion (`docs/evidence/iter59-red-2026-11-20.log.gz`, which stamps that `chat.js` as `be315867…`); with the fix
  **8 passed / 0 failed / 0 skipped (19.6s)** on `103dede5…`
  (`docs/evidence/iter59-green-2026-11-20.log.gz`). The two paired attacks aim at different assertions, so neither
  case can pass for the wrong reason: deleting the restore statement gives **4 failed / 4 passed (19.5s)** on
  `ad3caf58…` (`docs/evidence/iter59-attackA-2026-11-20.log.gz`), and dropping only the empty-composer guard gives
  **4 failed / 4 passed (20.3s)** on `5086a0ed…` with the *other* message,
  `the refused message must not overwrite what the farmer wrote next`
  (`docs/evidence/iter59-attackB-2026-11-20.log.gz`). The nine chat-adjacent browser specs are **88 passed / 0 failed
  (2.1m)** on the shipped bytes (`docs/evidence/iter59-focused-2026-11-20.log.gz`) and an interim offline run read
  **259 tests / 259 pass / 0 fail / 0 skipped** (`docs/evidence/iter59-offline-2026-11-20.log.gz`) before the guard
  files grew. A first ladder and
  a first gate were thrown away rather than published: both ran against a spec copy whose header was one line shorter,
  so every case sat one line lower and the archived failure would have named `spec.js:25` where the committed file
  declares `:26`. The ladder was re-executed against the bytes being committed, driven by
  `docs/evidence/iter59-ladder-script-2026-11-20.py.gz`, which stamps the sha256 of the product file at every step and
  refuses to continue unless a mutation applies exactly once; the stopped gate attempt survives as
  `docs/evidence/iter59-gate-attempt1-interrupted-2026-11-20.log.gz` with 35 completed cases in `static-desktop`, no
  summary line and therefore no tally drawn from it. The gate re-launched against the committed spec is
  **260 passed / 0 failed / 0 skipped (21.0m)**, exit 0, printing `Running 260 tests using 1 worker` beside the two
  hashes it built (`103dede5…` for `chat.js`, `d173167e…` for the spec), and `npx playwright test --list` agrees with
  that run rather than with arithmetic: **`Total: 260 tests in 25 files`**, exit 0, all eight new entries present and no
  `(skipped)` marker anywhere (`docs/evidence/iter59-gate-2026-11-20.log.gz`,
  `docs/evidence/iter59-census-2026-11-20.log.gz`). It met no live field refusal at all - `CONTEXT_UNAVAILABLE` appears
  zero times in that raw log, which is 348 lines by `wc -l`, where iteration 58's gate absorbed two, so the run is
  evidence about this app and nothing about upstream load. The offline suite finished at **260 tests / 260 pass / 0
  fail / 0 skipped**, exit 0, and the run immediately before it is kept as the bootstrap red it was: **258 pass / 2
  fail**, exit 1, red on exactly the two index cases that noticed two new archives were not yet carried
  (`docs/evidence/iter59-offline-final-2026-11-20.log.gz`,
  `docs/evidence/iter59-offline-index-red-2026-11-20.log.gz`). Two instruments were strengthened on the way. The citation-anchors
  guard gained a fourth case that shifts the line a pin names by ±1 in memory and fails if the pin still matches, i.e.
  if it cannot report a one-line drift; run against the then-current 88 pins it found one real offender,
  `public/js/modules/workflow-assistant.js:650`, whose quote was a fragment shared with the line above it, and that pin
  now quotes text unique to its own line
  (`tests/documentation-citation-anchors.test.js`). The evidence-index guard can now cite a run that stopped before its
  tally: the new `noTally` shape requires the stop-shaped basename, evidence that a run actually started and zero tally
  lines, and its reverse rule rejects any stop-shaped archive whose row claims neither `partial` nor `noTally` - both
  directions were proved red with throwaway copies before the shipped file was touched, and the floor moved to
  **50** with the table itself at **51** rows - 45 → 48 for the gate, the census and the bootstrap index red, 49 when
  the offline summary that follows that red joined it, 50 when the guard run just named joined it and 51 when that
  run's provenance snapshot joined it. The five documentation guard files then read **25 tests / 25 pass / 0 fail** on
  this tree, and what runs them is now `scripts/docs-guards.mjs` instead of a hand-typed list: a list with two names
  that do not exist ran 15 of the 25 cases, printed `ℹ tests 15` with nothing failing and gave no sign of the gap, so
  the runner refuses to start unless all five paths are on disk and exits with the child's status. What is still
  broken is upstream of that: the ledger tells a reader to run `artifacts/iter47-index-generator.mjs`, and
  `artifacts/` is gitignored with 108 distinct paths under it named in tracked prose, so a fresh clone cannot rebuild
  the index the guards read - promoting those instruments into `scripts/`, as iteration 58 promoted
  `scripts/citation-drift.mjs`, and failing a documented command that points at ignored scratch, is the next pass's
  first job. Still open
  and now named: `pendingChoice`, consumed at `public/js/modules/chat.js:93`, is not restored with the sentence, so a
  refused guided-plan step returns the words but not the level the farmer tapped; `server/context/client.js:44` still
  rethrows the local SoilGrids throttle as an upstream failure (P1 untouched); the P0 19 Nov field-discovery red stays
  undiagnosed and intermittent. Safari/WebKit, real phones, microphones, audio quality, whether restoring the composer
  is the right behaviour for every farmer and independent agronomy stay UNVERIFIED. Nothing was deployed, main is
  untouched (`4a54fa3`), no NASA portal edit.
- **20 Nov, same branch: iteration 60 - three instruments the ledger told a reader to run sat in a gitignored
  directory, and the guard that should have caught it read only fenced blocks.** Of the 67 runnable command mentions in
  tracked prose, **56 were never examined** by any guard
  (`docs/evidence/iter60-negative-controls-2026-11-20.log.gz`, whose split copy prints
  `{"files":34,"fence":11,"inline":56,"total":67}`), and the commands guard's inventory at
  `tests/documentation-commands.test.js:30` accepts only `scripts/`, `tests/`, `server/` and `notebooks/` while its
  `SKIP_DIRS` at `tests/documentation-commands.test.js:13` drops `artifacts` from the walk, so a sentence naming a
  script there was invisible twice over. `scripts/evidence-index-generator.mjs`, `scripts/ledger-census.py` and
  `scripts/chat-coordinate-probe.mjs` are tracked now, the generator answers `--stdout` so a case can compare the
  committed `docs/evidence-index.md` with a fresh scan instead of trusting it, and
  `tests/documentation-commands.test.js:136` rejects a documented command whose target sits under a prefix read out of
  `.gitignore:4` - even while its bytes are on this machine - with its two injected-fake exemptions guarded at
  `tests/documentation-commands.test.js:165` and `tests/documentation-commands.test.js:168`. Three findings came from
  the instruments rather than the intent. The first version of that case checked disk presence and went green with all
  three unshipped instruments standing
  (`docs/evidence/iter60-red-invalid-guard-checked-disk-not-ship-2026-11-20.log.gz`, `ℹ pass 13` / `ℹ fail 1`, the one
  red being the index case that could not start while its generator lived in scratch). The widened scan then rejected
  two sentences this pass had itself written - **26 pass / 1 fail** at 05:43Z
  (`docs/evidence/iter60-guard-caught-its-own-author-2026-11-20.log.gz`) - so a dated bullet above had its wording
  edited to name the old path without an interpreter, which is recorded in `docs/validation.md` subsection 60 rather
  than left in the diff. And bundling the Python control ladder into the log its own tally row judges put a forbidden
  string inside the bytes being judged, which went red at **6 pass / 1 fail**, exit 1
  (`docs/evidence/iter60-bundle-red-2026-11-20.log.gz`); the ladder ships separately as
  `docs/evidence/iter60-tally-controls-ladder-2026-11-20.py.gz`. Controls: four detections in
  `docs/evidence/iter60-negative-controls-2026-11-20.log.gz` and five in
  `docs/evidence/iter60-tally-controls-2026-11-20.log.gz` (`CONTROLS_RAN 5 CONTROLS_DETECTED 5 CONTROLS_RED 5`), which
  put `tests/documentation-evidence-index.test.js` back byte-identically as at the head of that log
  (`RESTORE_CHECK before=60cd2bd207442eb5 now=60cd2bd207442eb5`) and re-runs green. No application byte moved, so this
  pass's costs are documentation and tooling and the gate re-runs to confirm the branch rather than to test a fix:
  **260 passed / 0 failed / 0 skipped (20.1 m)**, exit 0, `Running 260 tests using 1 worker` on HEAD `e3982cd` with
  neither `CONTEXT_UNAVAILABLE` nor `cdn.jsdelivr.net` anywhere in the log
  (`docs/evidence/iter60-gate-2026-11-20.log.gz`); `npm test` **262 / 262 pass / 0 fail / 0 skipped**
  (`docs/evidence/iter60-offline-shipped-2026-11-20.log.gz`); the five guard files **27 pass / 0 fail**
  (`docs/evidence/iter60-docsguards-final-2026-11-20.log.gz`); and the archived-tally table rose from 51 rows to 63
  with its floor. What stays UNVERIFIED is the limit of the new case: it proves a named command is *shipped*, not that
  it still does what the sentence says it does, and the guard run that confirms the reprinted index is quoted here
  rather than archived, because reprinting changes the tree the archive certifies. Behaviour is untouched and still
  open: `pendingChoice`, consumed at `public/js/modules/chat.js:93`, is not restored with the sentence by the catch at
  `public/js/modules/chat.js:156`, while `public/js/modules/chat.js:129` sets it and writes the tapped sentence into
  the composer, so the retry silently takes the free-text path; `public/js/lib/api.js:13` keeps only
  `data?.error?.message` from a posted error body and discards its `code`; `server/context/client.js:44` still rethrows
  the local SoilGrids throttle as an upstream failure (P1 untouched); the P0 19 Nov field-discovery red stays
  undiagnosed. Safari/WebKit, real phones, microphones, audio quality and independent agronomy stay UNVERIFIED. Nothing
  was deployed, main is untouched, no NASA portal edit.

- **20 Nov, same branch: iteration 61 - a refused place list answered "no towns are listed", and the recovery that
  sentence promised died on a stale dropdown** (subsection 61 of `docs/validation.md` carries the measurements).
  `catch { listed = null; }` in HEAD became `{ regions: [], places: [] }` one line later, so a country whose
  saved rows were unreachable was described to the farmer as a country with no towns, the region filter kept its
  `List unavailable` placeholder, and the same bare catch answered a cancellation as data for a session the
  farmer had left. `placeListFailure` now splits the three classes on the status and code goal 2 preserved, an
  unreadable schema says asking again cannot change a source format, a read that did not come back offers a
  retry, and the read rethrows a cancellation. The retry the sentence names was then proved pressable rather
  than assumed: `public/js/modules/context.js` asks the picker for the country's rows before validating a tapped
  region, which is the half a browser run found and reading the code did not. The shipped spec
  `tests/e2e/place-list-refused.spec.js` covers two cases in each of the four projects and fails on each
  repair individually (`FIXED` / `ORIGINAL_DEFECT` / `NO_IDENTITY` / `NO_REREAD` / `RESTORE_OK`).
  The census is `Total: 268 tests in 26 files`, `npm test` reads 269 / 269 pass and the guard set 28 / 28;
  the pin table grew 88 to 106, the drift instrument read 53 stale pointers and 32 were re-pointed, and a sixth
  case in `tests/documentation-citations.test.js` now refuses a deep link whose `#LNNN` anchor falls outside the
  band its own label names - a defect this pass's own repair created. **The four-project gate on this tree is
  red and is archived as red**: `5 failed` / `263 passed (25.4m)` / `GATE_EXIT=1`, all five in
  `[static-desktop]`, one NASA POWER request open for 25 010 ms then `net::ERR_ABORTED`, three GIBS cases a
  minute and the Ames field case refusing twice. One isolated re-run of exactly those three files on exactly
  those bytes - no widened timeout, no re-run inside the gate, no skipped case - reads `24 passed (3.8m)`, so
  the branch has no case that has not passed and iteration 61 does not claim a green gate. Still open and now
  named: `pendingChoice`, consumed at `public/js/modules/chat.js:93`, is not restored with the sentence, and
  this pass's own re-read makes a tapped region button able to throw, so the next pass measures that before
  touching it; `server/context/client.js:44` still rethrows the local SoilGrids throttle as an upstream failure;
  the P0 19 Nov field-discovery red stays undiagnosed. Safari/WebKit, real phones, microphones, audio quality
  and independent agronomy stay UNVERIFIED. Nothing was deployed, main is untouched, no NASA portal edit.

- **20 Nov, same branch: iteration 62 - goal 6 was measured rather than assumed, and the sentence that blamed the
  farmer for a read the app itself made was replaced.** `scripts/place-choice-loss-census.mjs` (`npm run
  test:choice-loss`) and `scripts/place-tap-rejection-probe.mjs` (`npm run test:tap-rejection`) left
  `artifacts/` and are listed in `docs/development.md`. The census prints `TAPS_MEASURED 2338 | region 655 |
  town 1683` with `DIVERGENT 27`, every one of them at the town stage, and the probe cannot make a tapped town
  reject on either transport, so goal 6's restore-the-armed-identity half is NOT shipped - no reachable
  rejection can exercise it - and goal 7 now says why. What the probe did reach: on the Node transport a tapped
  region's form-side re-read (`public/js/modules/context.js:248`) can refuse, and the ask died with `Choose a
  region from the current country list.` - a sentence about the farmer's aim, for a lookup that never answered.
  `public/js/modules/location-picker.js:33` and `public/js/modules/location-picker.js:50` now report `{ ok }`
  from `setCountry` (8 lines changed, DOM behaviour untouched) and `public/js/modules/context.js:249` throws the
  sentence naming the failed read (6 changed), keeping `public/js/modules/context.js:250` for a code a list that
  answered really does not hold. A tapped region still fails when the read genuinely refuses: the composer keeps
  the sentence, Send stays live and the retry re-selects it, while on the static build the armed refusal never
  reached the read at all (`B_REQUESTS_DURING_TAP 0`, answered from a cache the probe cannot see), so whether the
  two transports really differ here is unmeasured - the transport-parity item this pass did not close. Coverage
  is one case at `tests/e2e/place-list-refused.spec.js:154` (71 lines) that settles
  on structure instead of wording - its first version timed out for 60 s waiting for an answered ask while the
  tap was failing, and the probe had the same class of flaw as a sentence whitelist that read
  `region_tap_rejects=false` after the fix made the sentence honest - plus
  `tests/workflow-place-choices.test.js:737` (the last block in that file). Both go red on their own control: reverting
  `context.js` prints `1 failed` naming the blamed sentence, and removing the cached-list short-circuit from
  `public/js/modules/workflow-assistant.js` prints `ℹ tests 31` / `ℹ fail 1` with `actual: 3` against
  `expected: 2`. The spec reads `3 passed` in each of the four projects, the offline suite is `ℹ tests 270` /
  `ℹ pass 270` / `ℹ fail 0` in 24.3 s and the guard set `DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0`. Moving
  those two lines re-pointed four citations over three documents and both pins in
  `tests/documentation-citation-anchors.test.js` that name them. The four-project gate on the delivered bytes
  opens `Running 272 tests using 1 worker` and closes `272 passed (17.9m)`, exit 0, with no `✘` line and no skip
  anywhere: the new case ran in all four projects at positions 45, 113, 181 and 249
  (`docs/evidence/iter62-gate-2026-11-20.log.gz`), and the one live-service event in those bytes is a
  field-lookup refusal (`CONTEXT_UNAVAILABLE`, 8 attempts across 3 services, `server/context/farms.js:89`) that
  the retry inside another case absorbed; `cdn.jsdelivr.net` and `did not run` appear nowhere in it.
  Safari/WebKit, real phones, microphones and independent agronomy stay UNVERIFIED.

- **20 Nov, same branch: iteration 63 - a POWER year made entirely of fill codes stopped counting as evidence and
  stopped being cached as if it were.** This is backlog goal 6 and the two `docs/handoff-2026-11-18.md` §7 entries about
  the zero-valid-evidence visibility and the all-fill payload's 6 h TTL. `server/nasa/power.js:48-52` maps the source's
  fill value to null, so an empty year arrives as five parameters with `validDays: 0`, `latestAvailableDate: null` and
  one notice each. `server/agronomy/rotation.js:102` counts exactly those null days into `missingEvidenceDays`,
  accumulated beside `maturityUpperDays` at `:99`, so over a full-year request the two are equal for every scenario and
  `evidenceLimited` at `server/agronomy/rotation.js:173` is the third ordering key. Two offline probes established that
  before any byte changed: `docs/evidence/iter63-synthetic-ranking-probe-2026-11-20.log.gz` prints
  `C_MISSING_EQ MATURITY` with every scenario `equal:true` and the ranking itself flipping between sparse and filled
  evidence, and `docs/evidence/iter63-all-fill-derivation-2026-11-20.log.gz` derives the payload from the shipped 2024
  capture - 1,830 cells replaced by the source's own `-999`, metadata untouched - and reproduces `validDays: 0` three
  times. The fix states the fact instead of promoting anything on the strength of an absence:
  `server/agronomy/rotation.js:175` builds `evidenceLimitation`, it reaches the comparison summary at `:207` and the
  visible strategy notice at `public/js/modules/strategy.js:28`, and the ordering of the criteria is unchanged. The cache
  half: `server/nasa/power.js:127` persists only when `carriesNoReadings` at `server/nasa/power.js:139` is false, where
  before an empty year was stored for 21,600 s and served back as though it were a result. Nine mutation controls each
  went red and were restored by digest - seven offline
  (`docs/evidence/iter63-offline-controls-2026-11-20.log.gz`, and the pass whose sixth control proved nothing is kept as
  `docs/evidence/iter63-offline-controls-run1-2026-11-20.log.gz`) and two in the browser
  (`docs/evidence/iter63-control-renderer-2026-11-20.log.gz`,
  `docs/evidence/iter63-control-devicecache-2026-11-20.log.gz`). The new spec
  `tests/e2e/zero-evidence-parity.spec.js` went red 12 of 12 on its own first execution because three of its assertions
  were wrong about the app (`docs/evidence/iter63-spec-first-run-2026-11-20.log.gz`); both repairs and the finished
  twenty are archived (`docs/evidence/iter63-spec-repaired-12-2026-11-20.log.gz`,
  `docs/evidence/iter63-spec-focused-2026-11-20.log.gz`). The four-project gate on the delivered bytes opens
  `Running 292 tests using 1 worker` and closes `292 passed (21.1m)`, exit 0, with no failed case, no unexecuted case and
  no CDN-name failure (`docs/evidence/iter63-gate-2026-11-20.log.gz`), and `npx playwright test --list` counts the same
  292 in 27 files (`docs/evidence/iter63-census-playwright-2026-11-20.log.gz`). The offline suite reads `ℹ tests 274` /
  `ℹ pass 274` / `ℹ fail 0` and the guard set `DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0`
  (`docs/evidence/iter63-offline-final-2026-11-20.log.gz`, `docs/evidence/iter63-docsguards-final-2026-11-20.log.gz`).
  This pass also kept its own bookkeeping error on the shelf: a provenance header that spelled the strings its tally row
  declared absent, red twice over (`docs/evidence/iter63-offline-absent-claim-red-2026-11-20.log.gz`,
  `docs/evidence/iter63-docsguards-absent-claim-red-2026-11-20.log.gz`). Full account in subsection 63 of
  `docs/validation.md`. The all-fill payload the browser cases serve is a derived fixture, so a live station-year that
  really arrives wholly filled stays UNVERIFIED, as do Safari/WebKit, real phones, microphones, audio quality and
  independent agronomy. Nothing was deployed, `main` is untouched, no NASA portal edit.

- **20 Nov, same branch: iteration 64 - a saved place list that refused stopped answering "that name is not from
  here"**, and on that answer the plan had already changed country. `workflow-assistant.js:415` ended in a bare
  `.catch(() => null)`, so a read that failed and a read that genuinely found nothing both told the switch guard "not
  local", and `docs/evidence/iter64-country-switch-probe-2026-11-20.log.gz` measures what that cost: "Inner Mongolia", a
  Chinese province that parses as the country Mongolia, left `country=MN region=null place=null evidence=null` - the
  point and its readings gone - where the same sentence with a readable list selects region 22 and moves nothing. The
  refusal now gets its own reply (`switchListUnreadable`, `workflow-assistant.js:847-862`): the read that could not be
  done, the two readings it cannot separate, `Nothing was changed`, a replay, and the explicit switch that still works.
  Six offline cases carry it, red before the guard (`docs/evidence/iter64-offline-cases-red-4-2026-11-20.log.gz`), red
  after the first draft of it (`docs/evidence/iter64-offline-cases-red-3-2026-11-20.log.gz`) and green at 37
  (`docs/evidence/iter64-offline-cases-green-37-2026-11-20.log.gz`); seven mutation controls take 3/2/1/1/1/1/2 of them
  back out with `restore_ok=true` on each (`docs/evidence/iter64-offline-controls-2026-11-20.log.gz`), and the earlier
  controls pass whose sixth mutation proved nothing stayed on the shelf as
  `docs/evidence/iter64-offline-controls-superseded-2026-11-20.log.gz`. The browser case survived two instrument
  failures (`docs/evidence/iter64-browser-red-form-built-plan-2026-11-20.log.gz`,
  `docs/evidence/iter64-browser-red-worker-cache-2026-11-20.log.gz`) before it counted the refusal on both transports
  (`docs/evidence/iter64-browser-focused-green-2026-11-20.log.gz`), and reverting the shipped clause made it bite:
  `4 failed` / `12 passed (14.3s)` (`docs/evidence/iter64-browser-control-2026-11-20.log.gz`) and green again on the
  delivered bytes (`docs/evidence/iter64-browser-restore-green-2026-11-20.log.gz`). The gate opens
  `Running 296 tests using 1 worker` and closes `296 passed (23.4m)`, exit 0
  (`docs/evidence/iter64-gate-2026-11-20.log.gz`), with `tests/e2e/place-list-refused.spec.js:224:3` green in all four
  projects and the census reading `Total: 296 tests in 27 files` (`docs/evidence/iter64-census-2026-11-20.log.gz`); two
  live field refusals inside it (`CONTEXT_UNAVAILABLE`, 8 attempts across 3 services, `server/context/farms.js:89`) are
  upstream capacity rather than a repair. The spec's one post-gate edit was a comment re-pointed at the shelf,
  `16 passed (11.4s)` on the final bytes (`docs/evidence/iter64-spec-comment-shelf-repoint-2026-11-20.log.gz`). The
  offline suite reads `ℹ tests 280 / ℹ pass 280 / ℹ fail 0`
  (`docs/evidence/iter64-offline-final-full-2026-11-20.log.gz`, all 280 case lines; its filtered companion
  `docs/evidence/iter64-offline-final-2026-11-20.log.gz` carries the run banner and the tally). Five findings this pass
  left alone: F1 a place name typed while no chat plan is open never reaches the guard at all -
  `docs/evidence/iter64-bare-name-crop-misanswer-2026-11-20.log.gz` prints
  `active_before=false active_after=false asked=[]` over an answer with no text and no offers; F2 the worker-side list
  cache (`server/context/locations.js:9-34`) makes page-side request counters blind on the static transport; F3 the
  replay that new reply offers re-selects the region and leaves the town unselected, so one thing does change after
  "nothing was changed"; F4, the line `workflow-assistant.js:329` held on that tree (and `e32ec0a` shipped at `:279`),
  which swallowed a refusal inside `exactPlaceRow` and closed as F4 in iteration 67; F5 a coordinate
  sentence reads `/api/locations` outside any try/catch at `workflow-assistant.js:530` as `e32ec0a` shipped it, and
  `docs/evidence/iter64-coord-list-refused-probe-2026-11-20.log.gz` shows `respond()` throwing after the country had
  already moved. Full account in subsection 64 of `docs/validation.md`. Every refusal in these runs is simulated by
  route interception or a stub - no live GeoNames outage was reproduced and none is claimed - and real phones,
  Safari/WebKit, microphones, audio quality and independent agronomy stay UNVERIFIED. Nothing was deployed, `main` is
  untouched, no NASA portal edit.

- **20 Nov, same branch: iteration 65 - a coordinate sentence asked the saved place list a second time, outside
  any guard, and its refusal escaped the assistant.** Queue item F5 closes as VERIFIED FIX. The duplicate read was
  reachable only as a retry of a refusal, because the module's list cache keeps a successful read
  (`public/js/modules/workflow-assistant.js:734`), and it threw `Error: The saved place list could not load.` out
  of `respond()` after `chooseCountry` had already moved the plan: three requests where two belonged
  (`/api/locationsIN`, `/api/places` and the duplicate `/api/locationsIN`), `calls=["country"]`,
  `state={"country":"IN","location":null}` (`docs/evidence/iter65-f5-coord-refused-recheck-2026-11-20.log.gz`,
  whose `SOURCE_MD5` is the module as `e32ec0a` shipped it). The second read is deleted rather than wrapped, and
  the refusal the guarded read already carried answers through `coordinateListUnreadable`
  (`public/js/modules/workflow-assistant.js:260`, reached at `public/js/modules/workflow-assistant.js:564`): it
  states the failed read, quotes the point, keeps the country the sentence moved, offers the replay and the
  whole-country overview, claims nothing about regions or towns, and says something different when the list
  arrived in an unreadable shape. Six offline cases (`tests/workflow-place-choices.test.js:791`, `:843`, `:869`
  among them) went **42 tests / 39 pass / 3 fail** before the fix
  (`docs/evidence/iter65-offline-cases-red-3-2026-11-20.log.gz`, each red on the `respond` frame at the pre-fix
  `:455`) and **43 / 43** after on the delivered bytes
  (`docs/evidence/iter65-offline-cases-green-43-2026-11-20.log.gz`); reverting the module turns four of them red
  by themselves (`docs/evidence/iter65-offline-revert-delivered-2026-11-20.log.gz`), and five mutants of the fix -
  keep the guard but leave the duplicate read, delete the guard and default to an empty list, copy the area path's
  "nothing was selected" sentence into this reply, drop the unreadable-shape branch, swallow the cancellation -
  fail 4 / 4 / 1 / 1 / 1 of the six with `restore_ok=true` every time
  (`docs/evidence/iter65-offline-controls-2026-11-20.log.gz`). The page case is
  `tests/e2e/chat-refused-ask-keeps-question.spec.js:113`, and the control that proves it bites is witnessed per
  transport (`docs/evidence/iter65-browser-controls-restore-2026-11-20.log.gz` prints the module digest, the
  `dist` digest and `coordinateListUnreadable` occurrences `=0` reverted against `=2` delivered before each run):
  reverted, node fails the case in about a second on the page's own catch-all sentence while static waits out the
  sixty-second readiness helper holding the *earlier* switch refusal in `#answer-status`, and both read `1 passed
  (1.3s)` once the delivered bytes are back. The gate runs on those bytes with the tree frozen and stamped -
  `assistant=166c93504f3d0bc817c02ccb3cd8c6a6`, `spec=92d37f54fa118cdca30d31f1867647d8`,
  `placetest=a8ec8622d9f61ed295285e251cf5cd63`, `dist=2` - and opens `Running 300 tests using 1 worker`, closes
  `300 passed (26.2m)`, exit 0 (`docs/evidence/iter65-gate-2026-11-20.log.gz`), census `Total: 300 tests in 27
  files` (`docs/evidence/iter65-census-2026-11-20.log.gz`), the new case green in all four projects and one live
  `CONTEXT_UNAVAILABLE` refusal inside `tests/e2e/review-phase-a.spec.js:34`, on node-desktop, still passed. The
  module's line count moved, so the ledger moved with it: the script re-pointed 18 sites on 18 prose lines
  (`docs/evidence/iter65-docs-repoint-sites-2026-11-20.log.gz`), the guard caught 2 more, and the pin table moved
  13 re-pointed and 9 added with its floor at 115 (`docs/evidence/iter65-offline-pins-red-2026-11-20.log.gz` is the guard red on the delivered bytes before
  that repair, **286 / 282 / 4**, all four publication guards) and the final offline suite green at **286 / 286 / 0**
  (`docs/evidence/iter65-offline-final-2026-11-20.log.gz`, whose banner and the guard set's
  `docs/evidence/iter65-docguards-final-2026-11-20.log.gz` both stamp the 153-row tally table, and
  `docs/evidence/iter65-docs-drift-final-2026-11-20.log.gz` reads the finished ledger at
  `TREE CITED_LINES_CHECKED 242 DRIFTED 0 INSIDE_DIFF_HUNKS 18`, the 18 skipped pointers itemised in subsection 65).
  Findings this pass leaves: F1, first now, a bare place
  name typed while no chat plan is open still never reaches the switch guard; F2 the worker-side list cache
  (`server/context/locations.js:9-34`) keeps page-side request counters blind on the static transport; F3 the
  replay a refusal offers re-selects the region and leaves the town unselected; F4 `exactPlaceRow` still swallows a
  refusal inside it; F6 `scripts/citation-drift.mjs:76-78` compares trimmed bytes and continues when they are equal,
  so a pair that is blank on both sides or absent on both
  (a pointer past the end of a file that shrank) passes without comparing any text, and its bare-`:NNN` continuation
  at `scripts/citation-drift.mjs:65` credits every colon-number on a line to the last `public|server|tests` path on
  that line - measured 21 Nov over the six files it reads: of 1,828 cited target lines, 15 come from clock times
  (`docs/validation.md:4239` reads `16:14:59Z` as line 59 of `server/context/client.js`, a 51-line file) and 13
  from `file:line:col` triples (the trailing column of
  `tests/e2e/place-list-refused.spec.js:224:3` is read as line 3 of that spec, which is blank), while
  1,800 of the 1,828 sit in files the pass did not modify and so were never opened at all - which is how two stale
  sites survived a `DRIFTED 0` reading that the citations guard then caught; F7 the
  scripted re-point only matches `public/`-`server/`-`tests/`-prefixed cites, so bare-basename pointers moved
  silently and are now reworded to name the revision they describe. Full account in subsection 65 of
  `docs/validation.md`. Every refusal in these runs is simulated by route interception or a stub - no live
  GeoNames outage was reproduced and none is claimed - and real phones, Safari/WebKit, microphones, audio quality
  and independent agronomy stay UNVERIFIED. Nothing was deployed, `main` is untouched, no NASA portal edit.

- **20 Nov, same branch: iteration 66 - a place name typed with no plan open was answered as a crop question, and a
  typed stop word threw on the way to its own reply.** Queue item F1 closes as VERIFIED FIX. The cancellation was not
  on the queue: the page case that proved F1 read `Cannot read properties of undefined (reading 'length')` out of
  `#answer-status` on both transports, so both are fixed and tested in one commit. What the harm was, measured on the
  bytes HEAD ships rather than asserted: four sentences typed into the chat with a country open were rendered on a
  served static build of `166c93504f3d0bc817c02ccb3cd8c6a6` with the fix marker absent
  (`docs/evidence/iter66-f1-page-probe-2026-11-20.log.gz`, `marker_served=0`), and each came back as a crop refusal or
  the generic one with `buttons=[]` - `Inner Mongolia` with China open was answered as a crop question about
  `Mongolia`, a country nobody had chosen. On the delivered bytes
  (`docs/evidence/iter66-f1-page-probe-fixed-2026-11-20.log.gz`, `1dce9746a1260ba70822e044a81730e9`,
  `marker_served=2`) the same page selects the region (`GA`, and `20` for the Chinese row), offers
  `Acworth / Adel / Albany` and `Baotou / Bayan Hot / Bayan Nur` and names the next step; the no-country and
  duplicate-name sentences answer exactly as before, which is F8 and F9 below. Offline, the new
  `tests/workflow-bare-place-name.test.js` (nine cases) went red clause by clause before the code changed -
  **6 / 5 / 1**, then **7 / 6 / 1**, then **7 / 7 / 0** with its neighbours at **72 / 72 / 0**
  (`docs/evidence/iter66-f1-redfirst-2026-11-20.log.gz`) - and four mutants of its four clauses each go red on their
  own with `restored_identical=True`: the whole place gate back to active-plan-only (4 red), the stop-word veto (2),
  the point guard (1), the cancellation short-circuit (1, and that run prints `CONFIRMED the TypeError the cancel
  branch used to raise`), closing `CONTROLS OK` on a **9 / 9 / 0** baseline and restore
  (`docs/evidence/iter66-f1-offline-controls-2026-11-20.log.gz`). The page spec was then driven reverted and restored
  on both desktop transports with a build witness per run - `fix_marker=0/0` gives `3 failed`, `fix_marker=2/2` gives
  `3 passed (3.5s)` on node and `3 passed (13.7s)` on static
  (`docs/evidence/iter66-f1-browser-controls-2026-11-20.log.gz`) - and once per project, green in all four
  (`docs/evidence/iter66-f1-spec-4projects-2026-11-20.log.gz`). The module grew, so the ledger moved: 98 pointer sites
  over 56 targets with 0 unmapped and 0 inside a replaced hunk
  (`docs/evidence/iter66-docs-repoint-sites-2026-11-20.log.gz`), then the 20 range endpoints the first pass had
  rewritten only at their start, whose second pass reads `lines changed: 0`
  (`docs/evidence/iter66-docs-repoint-ranges-2026-11-20.log.gz`), and the two fixture literals inside the tally guard
  that a sweep must never re-point (`docs/evidence/iter66-docs-fixture-literals-2026-11-20.log.gz`). Re-scouting the
  §13 "next in this family, unfixed" paragraph before building on it found the defect it describes had shipped fixed
  in iteration 64 (commit e32ec0a), so that paragraph is retired in this pass rather than acted on. Two
  instruments were wrong before they measured anything and are archived as failures rather than deleted: both probe
  arms at `PROBE_EXIT=1` on a `readFile` path resolved against the process CWD, and an `lsof | sed` guard whose `&&`
  tested sed's status, so it refused every run while nothing held the port
  (`docs/evidence/iter66-instrument-failures-2026-11-20.log.gz`).
  A third fault was in this pass's own shelving tool: the cross-check that matches the archives the ledger cites
  against the ones it can write split each doc on whitespace and stripped backticks, dots, commas and parentheses
  from the end of the token, and this bullet writes the F4 citation before a semicolon, so the tool reported 10
  archives for 11 real citations - blind to the one archive its own check existed to police. The committed guard
  (`tests/documentation-commands.test.js:34`) matches a character class and never went blind, so no number of
  this pass was wrong; the fix copies the guard (`docs/evidence/iter66-instrument-failures-2-2026-11-20.log.gz`).
  Findings this pass leaves: F2 the worker-side list cache (`server/context/locations.js:9-34`) keeps page-side request
  counters blind on the static transport; F3 the replay a refusal offers re-selects the region and leaves the town
  unselected; F4 is now measured rather than read off the source, on the delivered bytes: with the saved list refusing
  (`status 503`, `code LOCATIONS_UNAVAILABLE`) the bare place name asks once, throws nothing and returns `null`, so the
  farmer is answered by the read-only fall-through - the crop sentence - with nothing selected and no plan opened, while
  the same harness with the list answering selects `GA` and says so
  (`docs/evidence/iter66-f4-refusal-fallthrough-2026-11-20.log.gz`; the swallow was the `.catch(() => null)` that
  `public/js/modules/workflow-assistant.js:329` held on that tree, which this pass widened to the no-plan path and
  iteration 67 closed (subsection 67)); F6 `scripts/citation-drift.mjs:76-78` still passes any pair whose trimmed
  bytes match, blank-to-blank and past-the-end-to-past-the-end included, and its continuation rule reads every
  `:NNN` on a line as a pointer - the itemised counts are in iteration 65's queue line above - which is why the
  re-point here was checked by content and not by
  `DRIFTED 0`; F7 the scripted re-point only matches `public/`-`server/`-`tests/`-prefixed cites, so bare-basename
  pointers still move silently; F8 was a bare name typed with no country selected answered as a crop question that
  named the place as a country, because `exactPlaceRow` returns null when no country is set
  (`public/js/modules/workflow-assistant.js:743`) and the read-only path kept the sentence; iteration 68 closed it (subsection 68); F9 `Athens`, which
  `public/data/locations/US.json` lists in five regions (GA, OH, TN, TX, AL among 7,558 rows), was declined with the
  generic sentence although the module could already ask "Several listed towns match … Which one do you mean?"; iteration 69
  closed it (subsection 69, which names the deciding statements by their text rather than by a line number); F10 and F15 close in this
  pass: the three deep links at `docs/validation.md:1007, :1021 and :1035` now carry the repo-relative target plus a
  `#L` anchor inside their own bands; F15 is that the guard checking those anchors read only `file:///` URLs, so the
  repair blinded it (subsection 67); F11 was found by re-reading, not by
  running it - `tests/workflow-bare-place-name.test.js:146` is titled "asks for the country instead of guessing one"
  while its assertions hold that `respond` returns `null` and nothing is selected, which is the fall-through that
  produces F8's crop sentence and not a question about a country, so the title over-claimed what the case proves and was
  renamed to the assertion it carries (`a bare place name with no country chosen selects nothing and costs no saved-list
  read`) - after the gate, because the gate's frozen tree stamps this file's digest. That rename and the ledger pin that
  quotes it are measured by their own green/red pair rather than asserted: `ℹ tests 13 / pass 13 / fail 0`, then
  `ℹ tests 4 / pass 3 / fail 1` with the pin's own mismatch printed and the restore proved by digest
  (`docs/evidence/iter66-f11-pin-control-2026-11-20.log.gz`). The gate ran on the pre-rename bytes and closed at
  **312 passed (23.5 m)** with `GATE_EXIT=0` - `Running 312 tests using 1 worker`, 394 lines, no `✘` case line
  (`docs/evidence/iter66-gate-2026-11-20.log.gz`) - and the five closing readings on the renamed tree are
  **295 passed / 0 failed / 0 skipped** offline, `DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0`,
  `TREE CITED_LINES_CHECKED 295 DRIFTED 0 INSIDE_DIFF_HUNKS 12` and `Total: 312 tests in 28 files`; a sixth leg re-ran
  the first three with every closing archive already on the shelf and printed the same three readings with
  `DRIFT_UNCHANGED=yes` (`docs/evidence/iter66-confirm-final-2026-11-20.log.gz`, whose own header stamps the tally table
  at 171 rows while the row that archives it is the 172nd). Full account in subsection 66 of `docs/validation.md`. Every refusal in these
  runs is simulated by route interception or a stub - no live GeoNames outage was reproduced and none is claimed - and
  real phones, Safari/WebKit, microphones, audio quality and independent agronomy stay UNVERIFIED. Nothing was
  deployed, `main` is untouched, no NASA portal edit.
- **20 Nov, same branch: iteration 67 - the place-list refusal answered sentences that were not about a place, and the
  pass broke the guard that archives it.** F4 is closed on measurement: the refusal at
  `public/js/modules/workflow-assistant.js:346` is now gated on the sentence the farmer typed, so "How much rain fell
  last year?" while the saved list is down keeps its own answer instead of inheriting the place complaint. The offline
  file grew to eight cases and ran on three different module bytes - 6 tests / 5 fail on what HEAD ships, 6 / 1 fail on
  a fix bounded only by the refusal (the later-sentence case red, which is how that draft was caught) and 8 / 0 on the
  delivered bytes - and both controls were re-run so their digest stamps sit inside the archives rather than only on the
  console: deleting the bound leaves 6 / 2 offline and one red case on each desktop transport, replacing the module with
  HEAD's leaves 8 / 3 offline and two red
  (`docs/evidence/iter67-f4-offline-redfirst-2026-11-20.log.gz`,
  `docs/evidence/iter67-f4-offline-controls-2026-11-20.log.gz`,
  `docs/evidence/iter67-f4-browser-controls-2026-11-20.log.gz`, and
  `docs/evidence/iter67-f4-spec-4projects-2026-11-20.log.gz` for the same three cases green in all four projects). Its
  limit is stated and queued, not hidden: a saved row whose name folds past the module's 60-character place-shape test
  still falls through while the list refuses, which is F12. Re-pointing the ledger around the 771 → 788-line module
  moved 73 citations and refused 13, and the sweep died once on its own report before the pass that finished it; the
  anchor pin table went 139 → 160 entries and the guard's self-pin inside it moved 443 → 482
  (`docs/evidence/iter67-docs-repoint-2026-11-20.log.gz`, `docs/evidence/iter67-instruments-2026-11-20.log.gz`). Two
  instrument findings came out of that sweep: `scripts/citation-drift.mjs` walks only files `git diff` lists, so
  `DRIFTED 0` says nothing about the pointers in a file this pass added. The reason this pass first gave for F7 did
  not stand - `dist/…` is no basename ambiguity, because `tests/documentation-citations.test.js:16` skips `dist`, so
  `:75` resolves a bare name - and F7 stays subsection 66's finding: prefixed-only re-pointing leaves bare cites behind.
  The pass then damaged its own evidence layer: six tally rows appended to `tests/documentation-evidence-index.test.js`
  left one needle split between two adjacent string literals, which is a `SyntaxError` at import, and the guard set
  reported that file as one test instead of its seven - `DOCSGUARDS_SUMMARY tests 22 | pass 21 | fail 1 | skipped 0`
  where the finished tree reads 28 | 28 | 0. A tally table that cannot load has no rows and still exits with a number,
  so only the total moving said so. The guard that did load was then attacked instead of trusted: one needle per
  assertion layer was broken and the file restored byte-for-byte between each, and `lines:`, `phrases:`, `absent:`,
  `marks:`, `onlyReds:` and the table floor each come back red with a message naming the layer
  (`docs/evidence/iter67-tally-controls-2026-11-20.log.gz`, whose driver records inside the archive that it ran in the
  foreground). That driver is gitignored scratch, and the guard that refuses to document a command no clone has caught
  this ledger naming it: shipping each iteration's control drivers is F13. Repairing F10's three dead links during the
  gate touched nothing the browser reads, and the capture that counts them 3-then-0 opened two findings of its own. F14:
  those labels never named the rules their sentences describe - four instruments look at a deep link on this branch (the
  citations guard, the drift scout, the anchor case at `tests/documentation-citations.test.js:139` and the anchors pin
  table) and not one of them reads what a label promises, so the strongest wording the ledger protects is a pin on the
  numbers themselves. F15: `ANCHORED` at `tests/documentation-citations.test.js:137` matched only `file:///` targets, so
  the links it had been certifying were the unreadable Windows paths and making them followable left the guard with
  nothing to compare - `the anchor scan saw 0 labelled deep links` inside wave 1's
  `ℹ tests 303 ℹ pass 300 ℹ fail 3` (`docs/evidence/iter67-anchor-scan-starved-2026-11-20.log.gz`), reported by the
  `checked >= 3` floor rather than by any mismatch, because a scan of nothing returns the same clean list as a scan of
  three. The pattern now takes any markdown link target ending in `#LNNN`: the F10 capture measures that as
  `pattern=file_scheme_only head=3 tree=0` becoming `pattern=any_markdown_target head=3 tree=3`, and
  `docs/evidence/iter67-anchor-controls-2026-11-20.log.gz` breaks the case four ways - floor raised to 4 printing
  `saw 3`, an anchor moved to `#L300` printing the `docs/validation.md:1007` mismatch, the pre-repair pattern and the
  naive widening that leaves brackets in the class each printing `saw 0` - and restores it byte-for-byte. F10 and F15
  close here; F14 stayed open after this pass, because its labels and its pins had to move in one change and a pin was a
  test file that pass froze - it closed in iteration 75, and F18 was found on the way. The four-project gate ran on the stamped tree and the five closing readings after
  it, on the bytes this branch ships: `ITER67_GATE_START 2026-11-20T20:00:51Z
  HEAD=6c3091f370fa9f7dd1eb2a3fe992b2a08f3d00bf NODE=v26.13.1 pgid=87040`, `Running 324 tests using 1 worker`,
  `324 passed (26.4m)`, `GATE_EXIT=0`, `ITER67_GATE_DONE 2026-11-20T20:27:13Z`; then
  `ℹ tests 303 ℹ pass 303 ℹ fail 0` offline, `DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0 | skipped 0`,
  `TREE CITED_LINES_CHECKED 264 DRIFTED 0 INSIDE_DIFF_HUNKS 10` and a census of the same 324 in 29 files
  (`docs/evidence/iter67-gate-2026-11-20.log.gz` plus the four closing archives subsection 67 names). Those readings
  carry one number a gate cannot freeze: the tally guard is the ledger's own table, so the digest the gate stamped
  (`dc26456e8ea55ee7a37ef77d5b2c4aff`) names a row count that file no longer has and no capture records. What is measured
  is the ladder pair - the first floor break printed `the table carries 178 archives`, the second printed 187 - and the
  delivered file, which counts 189 rows on digest `753c0fb64f0f01f4e030fe4bade1ccdf` where the commit this pass started
  from counted 172. The rows that arrived after the stamp were attacked rather than
  trusted by a second ladder (`docs/evidence/iter67-tally8-controls-2026-11-20.log.gz`): six breaks on rows this pass
  wrote, six reds naming their own layer, `TARGET` and `RESTORED` digests equal, and the ladder's first casualty was its
  own row - it declared `ABORT` absent in an archive of a driver that prints every needle it applies, which is the
  `absent:` layer working, not the ladder failing. F2, F3, F6, F7, F9, F12, F13 and F14 stayed open after that pass
  (F8 closed in subsection 68); `main` is
  untouched and nothing was deployed.
- **21 Nov, same branch: iteration 68 - a country name typed with step 1 empty was answered as a crop question about
  that country, and every country the tables publish reached that sentence.** F8 is closed on measurement. The farmer
  who has not chosen a country and types `Georgia` was told `I could not match that crop to a sourced entry for
  Georgia.` with nothing to tap, because the sentence that reports an unmatched crop is also the only place a bare
  country name arrives when `exactPlaceRow` legitimately declines (it reads a saved list only once a country is held,
  and `tests/workflow-bare-place-name.test.js:146` still pins that limit and its zero reads). The repair is in
  `server/agronomy/conversation.js`, one handler behind both transports: a message that is nothing but a recognised
  country spelling is now answered as a place (`mode: deterministic country-name clarification`), says what the wording
  actually is, and offers `Plan a rotation in <name>`, whose sentence the guided assistant already answers.
  `docs/evidence/iter68-f8-probe-2026-11-21.log.gz` holds both arms of one driver on one set of sentences: on HEAD's
  bytes `CENSUS spellings=302 cropSentence=302 withNoButton=302` - every spelling, not the two the page probe found by
  hand - against `cropSentence=0 withNoButton=0` on the delivered bytes, with the same file's
  `currentPredicateCatches=266 misses=36` recording why the whole-message predicate already in that file (`countryOnly`
  at `server/agronomy/conversation.js:60`) was not reused: it misses `uae`, `uk`, `cabo verde`, `czech republic` and 32
  more published forms, so the check compares the message against every form `countryNameForms` returns. The controls
  are in the same archive's unchanged lines - `cassava in Ghana` keeps its dated FAOSTAT record with `sources=1`,
  `Tell me about moonfruit in Canada` keeps the crop sentence, and `GUIDED q="Georgia" answered=no` in both arms - and
  `docs/evidence/iter68-f8-offline-controls-2026-11-21.log.gz` runs five mutants over the new cases: dropping the
  branch leaves 3 red, removing the button 2, making the button send the bare name 2, matching Intl's own spelling only
  2, and the narrowness control - letting any sentence that names a country count as a place - is red on exactly one
  case, the pre-existing crop-sentence control, each restore proved by digest.
  `docs/evidence/iter68-f8-browser-controls-2026-11-21.log.gz` is the same green/red/green ladder on the page: the new
  case passes on both transports, fails on the reverted file with the page quoting the crop sentence back, and passes
  again on the restored bytes, with the bundle digest moving `3ec88085 → 7434ebb3 → 3ec88085` so a static arm reading a
  stale build would be visible. Four offline cases (`tests/conversation.test.js`, 13 in the file) and one page case
  (`tests/e2e/chat-bare-place-name.spec.js:105`) carry it forward; the page case taps the offered button and asserts
  `#pest-country` becomes `GE`, so the recovery is proven rather than asserted. The pass closed on the four-project gate
  at `328 passed (20.3m)` with `GATE_EXIT=0` and its two digest banners equal, the offline suite at 307 passed and 0
  failed with `OFFLINE_TESTS=307`, the five guard files at 28 and 0, the census at 328 in 29 files with the new spec
  listed four times in each of the four projects, and the tally table at 199 rows - the five closing captures pinned
  under a control ladder that ends `LAYERS_BITTEN 5/5 ALL`, which is what stops an unapplied mutant reading as a pass.
  Full account in subsection 68 of `docs/validation.md`.
- **21 Nov, same branch: iteration 69 - a town name the saved list carries more than once answered nothing, so
  typing `Athens` got the generic refusal.** F9 is closed on measurement. With a country held and no plan open,
  `exactPlaceRow` (`public/js/modules/workflow-assistant.js`) returned a row only when exactly one town row or one
  region row claimed the folded spelling, so `Athens` - five rows in `public/data/locations/US.json`, GA, OH, TN, TX
  and AL - fell out of `respond()` as `null` and the page handed the sentence to the read-only answer, which said
  `I could not match that request to a supported question or planning step.` with nothing to tap. Argentina's
  `San Vicente` (three rows) and Angola's `Calandula` (two) did the same, while a name one region row claims still
  selected that region: the hole is the multi-row shape, not the place switch. The fix is one statement -
  `if (towns.length > 1) return { type: 'towns', ids: … };` between the region rule and the `return null` - reusing
  the selector the guided branch already renders (`Several listed towns match, showing 3 of 5`, one button per row,
  nothing selected until a tap). Ten offline cases in `tests/workflow-ambiguous-place-name.test.js` and two page cases
  in `tests/e2e/chat-ambiguous-place-name.spec.js` carry it: five offline cases fail on the defect bytes and five are
  the controls that must not (one row still selects silently, a region collision still selects the region, a longer
  row containing the name is still one row, an unlisted name still reaches the read-only answer, a chosen point
  survives an ambiguous name at the cost of no saved-list read). Two things this pass records against itself rather
  than smoothing over. Its mutation ladder is archived in both rounds: round 1 printed `MUT NOGUARD verdict=MISSED`
  with `LAYERS_BITTEN 3/4 INCOMPLETE` because the region-precedence condition it attacked had no observable effect, so
  the condition was deleted, the ordering rule was written into the comment where the next reader meets it, and round
  2 ran on the delivered bytes with `RAN=6 of 6 SCORED=4 DOCUMENTED_BLIND=1 MISSED=0 LAYERS_BITTEN 4/4 ALL`. And its
  first page ladder lied: the static projects are served from `dist/client`, which `npm run build` refreshes
  (`scripts/build-browser.js:33-34`), so an arm that mutates `public/` without rebuilding measures the previous pass's
  bytes - `43c133a152fee4fa5b15dee6dff8e0e0`, iteration 68's module - and reads a transport difference that is an
  instrument error; every arm in `docs/evidence/iter69-f9-spec-4projects-2026-11-21.log.gz` prints the digest it
  served before it asserts anything, beside `docs/evidence/iter69-f9-offline-redfirst-2026-11-21.log.gz` and
  `docs/evidence/iter69-f9-offline-controls-2026-11-21.log.gz`. The closing captures are
  `docs/evidence/iter69-gate-2026-11-21.log.gz` at `336 passed (21.2m)` with `GATE_EXIT=0` and both ten-digest banners
  equal, `docs/evidence/iter69-offline-final-2026-11-21.log.gz` at `ℹ tests 317` with `ℹ fail 0` and
  `OFFLINE_EXIT=0`, `docs/evidence/iter69-docguards-final-2026-11-21.log.gz` at
  `DOCSGUARDS_SUMMARY tests 28 | pass 28 | fail 0`, `docs/evidence/iter69-census-final-2026-11-21.log.gz` counting
  `Total: 336 tests in 30 files` with the new spec listed twice in each of the four projects, and
  `docs/evidence/iter69-drift-final-2026-11-21.log.gz` reading `TREE CITED_LINES_CHECKED 252 DRIFTED 0` against the
  working copy. The row ladder `docs/evidence/iter69-tally-controls-2026-11-21.log.gz` ends `LAYERS_BITTEN 5/5 ALL`
  and prints `ROWS_ON_TREE 205` - the table as it stood while the ladder ran, since a row cannot pin a count the run
  it describes did not print - and the three rows that arrived after it are pinned instead by the offline suite and
  the guard set as those two read with all nine rows on the tree. F3 (the `Ask that again` offer re-selects a region
  and leaves the town unset), F2 (the worker-side list cache that makes page-side request counters blind on the static
  transport), F6, F7, F12, F13 and F14 stay open; `main` is untouched and nothing was deployed. Full account in
  subsection 69 of `docs/validation.md`.
- **2026-11-21 (iteration 70, F3 closed as VERIFIED FIX, F2 corrected and still open):** F3 was the refused-switch
  replay: on the bytes iteration 69 shipped, asking the assistant to repeat a plan whose region switch had been
  refused re-selected the region and dropped the town point, so the answer quoted a place the farmer never chose. The
  delivered module states the point it keeps instead, and `tests/e2e/chat-region-repeat-keeps-point.spec.js` now
  measures both halves on all four projects - three cases each, 12 lines - printing to stdout which side of the branch
  the transport took, because Playwright keeps attachments only for failed tests and a green run would otherwise
  archive no witness. `docs/evidence/iter70-f3-replay-probe-2026-11-21.log.gz` is that replay on the two module
  revisions (the 798-line shipped file against the 812-line delivered one, each arm printing the digest it imported),
  `docs/evidence/iter70-f3-spec-controls-2026-11-21.log.gz` is the four-arm ladder that shows the new cases go red for
  the state assertions and not the wording ones, and
  `docs/evidence/iter70-f3-page-harm-2026-11-21.log.gz` measures the same defect through a real page: the delivered
  bytes keep town 2038432 at 40.6516, 109.84389 across a repeat while the shipped ones empty both fields. F2 is
  corrected rather than closed: the static page answers a place-list read from a client-side cache in
  `public/js/modules/location-picker.js` that the assistant's own list cache does not share, and
  `docs/evidence/iter70-f2-list-cache-blind-2026-11-21.log.gz` counts a place-list request per transport to show that
  the page never re-reads one - so a staleness fix has to name which of the three caches (that picker cache, the
  assistant's, and the node-side one in `server/context/locations.js`) it touches, and must not pay for the offline
  benefit it removes. Closing legs: `docs/evidence/iter70-gate-2026-11-21.log.gz` (four projects, one worker, `348
  passed (22.7m)`, exit 0, module and served-bundle digests equal, 348 passed-case lines and no red, skipped or flaky
  line), `docs/evidence/iter70-census-final-2026-11-21.log.gz` (`--list` planning the same `Total: 348 tests in 31
  files`), `docs/evidence/iter70-offline-final-2026-11-21.log.gz` (322 unit cases, none failed, none skipped, beside
  the earlier reading that went red on three index cases this pass had disturbed),
  `docs/evidence/iter70-docguards-final-2026-11-21.log.gz` (five documentation guard files, 28 cases) and
  `docs/evidence/iter70-tally-controls-2-2026-11-21.log.gz`, the ladder that breaks those four rows' assertion shapes -
  6 of 6 layers biting only on its third attempt, the first two refused by anchors that matched no row and then seven
  rows, and `docs/evidence/iter70-drift-final-2026-11-21.log.gz`, the citation scout run last because it counts the
  pointers this bullet and the subsection add: 263 cited source lines checked against the working copy with none
  drifted, 262 against `--head` with none drifted, the two pointers it skips sitting inside this pass's own diff hunks
  and covered instead by the citation guard in the documentation set. The re-run that stands behind the commit, not archived because no
  capture can pin the row naming it, reads 265 pointers with none drifted - the two extra are this pass's own closing rows - with 28
  documentation cases and 322 unit cases green at `OFFLINE_EXIT=0`, after a first pass that was red on the two index cases because shelving
  the drift capture left `docs/evidence-index.md` one file behind the shelf and the generator had to run again. The tally table goes from
  214 rows to 220. One
  archive on this pass's shelf needed a correction rather than a quiet replacement: the docguards capture's own header
  called itself a reading of the ledger "as this pass leaves it" when it ran three rows earlier, so its header lines
  were rewritten with a `HEADER_CORRECTION` banner and a digest proving the embedded output is byte-identical to the
  first shelving. Real phones, Safari/WebKit, microphones, audio quality and
  independent agronomy stay UNVERIFIED; `main` is untouched and nothing was deployed. Full account in subsection 70 of
  `docs/validation.md`.

- **2026-11-21 (iteration 71, F2 closed as VERIFIED SOUND, no application byte moved):** F2 asked which of the three place-list caches
  answers a read on which transport, and `scripts/place-list-cache-layers.mjs` (tracked) now measures it: it walks a refused sentence, a
  successful retry and a tapped region, stamping every list-shaped request with the step that caused it. The static column ends
  `TAP_OBSERVED 0 []` with `LAYER_VERDICT static tap_answered=true tap_reads=0`, the node column `TAP_OBSERVED 1 [tap /api/locations?country=BM]`
  with `LAYER_VERDICT node tap_answered=false tap_reads=1`. Three manifest reads inside one sentence step rule out a worker-level HTTP
  response cache, which leaves the location client bundled into the static service worker (`server/context/locations.js:9`) as the blind
  layer - and because that bundled `Map` answers a country once the worker has resolved it, a page-side route cannot make a later read fail
  there, so the queue's `static region_tap_rejects` item is unreachable by construction rather than unreproduced. Closed sound rather than
  fixed: the static tap refills step 1 (`value="03"`, nine parishes) and the node tap refuses honestly with `Nothing was selected`, so both
  transports keep the farmer's state, and trusting a cached body at `public/js/modules/context.js:248` would buy a silent success on the
  transport that can still fail. The pass's real product was instrument trustworthiness: both scripts had authored their own refusal sentence
  (`Place list is busy or unavailable.`, which `server/context/locations.js:20` does not write) and now derive it from the adapter with a
  guard that aborts unless it comes back `503`/`LOCATIONS_UNAVAILABLE`, and section B's witness had been printing a count with an empty
  bracket for four days because its recording line was missing. Six mutations in
  `docs/evidence/iter71-instrument-hardening-2026-11-21.log.gz` reproduce both defects - CTL6 the empty bracket on demand, CTL3 the false
  zero that makes the two columns agree when only one can see, CTL2/CTL4 the abort line, CTL5 the loose pre-21-Nov guard arming the wrong
  outage and reporting nothing - and CTL1 is disclosed as having hit section A instead of section B. Each prints `mutation_lines` before it
  runs, because a control whose regex matches nothing silently becomes a clean run. The census is
  `docs/evidence/iter71-f2-layer-census-2026-11-21.log.gz`, the ladder over the three new tally rows is
  `docs/evidence/iter71-tally-ladder-2026-11-21.log.gz` (five needle mutants red with three lines each naming the archive they falsify, the
  row-deletion mutant caught by the coverage case rather than the floor with nine, and the guard green again at the digest it started from);
  the table goes 220 -> 223 for those three rows and 224 with the citation leg. No four-project gate ran because none was owed: the leg
  stamps carry `MODULE_MD5=6a23d42a807c8f7243077a67fb43c24b` and `SERVED_MD5=6a23d42a807c8f7243077a67fb43c24b`, equal to each other and to
  the pair iteration 70 gated. The legs that did run: `--list` census `Total: 348 tests in 31 files`, 322 unit cases with none failed or
  skipped, 28 documentation cases, 795 evidence files on the shelf (the number the generator prints, not the 783 a non-recursive `ls`
  reports - this driver printed that wrong twice and the corrected stamp is what the ledger quotes), and the citation scout last because its
  own rows cannot pin the capture that precedes it. That leg found a gap rather than closing one, and it is queued as F15: the scout compares
  the bytes at a cited line only for files the working copy modifies, so on a pass that edits nothing outside the guard it opens one pointer
  and prints a true, nearly free `CITED_LINES_CHECKED 1 DRIFTED 0` while the source lines the ledger quotes bytes about go unexamined -
  `tests/documentation-citations.test.js` proves those pointers land on a real non-blank line, never that the line still says what the pass
  claims. The eight lines were read by hand and their text archived (`docs/evidence/iter71-drift-final-2026-11-21.log.gz`, whose row pins the
  `QUOTE` lines), which is coverage for one pass and not a guard for the next. Still unestablished, and stated so the zero is not over-read:
  whether the worker's `Map` or
  `location-picker.js:6` absorbs the static tap read, and whether a stale list survives a *country change* on static - the second is the
  half that would touch a farmer. Real phones, Safari/WebKit, microphones, audio quality and independent agronomy stay UNVERIFIED; `main` is
  untouched, nothing was deployed, no test was weakened. Full account in subsection 71 of `docs/validation.md`.
- **21 Nov, same branch: iteration 72 - the optional-model failure sentence blamed the farmer's hardware for five different observed
  facts, and the page case that should have caught it agreed with the wording.** `public/js/modules/chat.js:63` and `:66` both ended a failed
  model start with `Model could not start on this device. Evidence chat still works.` Iteration 50 chose those words to stop the worker's raw
  text reaching the panel and that suppression still holds; the noun is what was wrong. A probe armed eight ways a start can fail on both
  transports (`docs/evidence/iter72-capture-static-2026-11-21.log.gz`, `docs/evidence/iter72-capture-node-2026-11-21.log.gz`) and the six
  failure arms post five distinct texts - a runtime that did not arrive, a model or tokenizer file that did not arrive, a file that arrived
  unreadable, and an `onerror` whose message, filename and lineno are all null - every one of which rendered that identical sentence. A new
  pure classifier, `public/js/lib/model-failure.js`, names the cause from an ordered table and returns no cause when nothing was observed;
  no branch echoes its input, which is what keeps the CDN host and the internal API name out of the panel. `chat.js` calls it at both sites,
  line-neutrally at 3 added / 3 removed on a 179-line file, and the page case at `tests/e2e/chat-model-egress.spec.js:17` now requires the
  whole sentence and forbids `on this device`, the host, the API name and any URL. Nine offline cases (`tests/model-failure.test.js`), a
  six-leg unit ladder and a four-leg page ladder (`docs/evidence/iter72-unit-controls-2026-11-21.log.gz`,
  `docs/evidence/iter72-page-controls-2026-11-21.log.gz`) that reproduces iteration 50's leak through the current code path - the control the
  ledger never had - then a four-project gate: `348 passed (26.1m)`, exit 0, red lines 0, the egress case green in all four projects, opening
  and closing digest stamps identical (`docs/evidence/iter72-gate-2026-11-21.log.gz`). Two instruments in this pass were wrong before they
  were right, and both are recorded rather than quietly fixed: the gate driver's spec counter printed `GATE_SPECS 0` because its pattern
  could not match a path containing a slash while 31 spec files ran, and the row-discrimination matrix found the static capture's row passing
  unchanged against the node capture's archive - true parity, but a row that cannot say which log it read - so each capture row now pins its
  own `CMD` line and 20 of 20 foreign pairs reject. `Failed to fetch` still means two things, so the cause clause says only "a model file did
  not arrive"; the null arm claims no cause; and the same shape survived at `public/js/modules/speech.js:72` and `:74`, which this pass
  queued as F16 rather than widening into a gated change and iteration 73 repaired. Real phones, Safari/WebKit, microphones, audio quality
  and independent agronomy stay UNVERIFIED; `main` is
  untouched, nothing was deployed, no test was weakened. Full account in subsection 72 of `docs/validation.md`.
- **21 Nov, same day: iteration 73 (F16 closed as VERIFIED FIX) - the dictation panel printed a runtime's internals at the farmer,
  and the two defects iteration 72 removed from the chat panel were still live on it.** `public/js/modules/speech.js:72` interpolated the
  worker's own text and `:74` answered an `ErrorEvent` whose message, filename and lineno are all null with
  `The speech model could not start on this device.` A seven-arm capture on both transports
  (`docs/evidence/iter73-capture-static-pre-2026-11-21.log.gz`, `docs/evidence/iter73-capture-node-pre-2026-11-21.log.gz`) printed
  `leaking=2 device_blame=2 raw_echo=4 doubled_period=2 settled=7` - an ORT WASM URL, an ONNX `ERROR_CODE: 7` with the word `protobuf`, and
  a hardware claim on a page whose hardware was fine. The fix generalised iteration 72's classifier instead of duplicating it:
  `SPEECH_FRAME` and `SPEECH_RECOVERY` beside `CHAT_FRAME` and `CHAT_RECOVERY` in `public/js/lib/model-failure.js`, one ordered cause
  table and one `classify(message, frame, recovery)`, so no sentence can both echo and reword. Post-fix capture on both transports reads
  `leaking=0 device_blame=0 raw_echo=0 doubled_period=0` with the same seven arms and `none` still transcribing. The ordering is asserted
  apart from the wording - a corrupt model file also matches the missing-runtime pattern, so the unreadable-file clause has to be tried
  first - and the unit ladder proves both bites: swapping the two clauses reddens 2 of 15 cases, echoing the argument reddens 9. The page
  ladder's middle leg writes `speech.js` back to the bytes HEAD ships, rebuilds, and the served digest moves: 4 failed / 8 passed across
  four projects, receiving the leak itself as the sentence under test. Iteration 72's announced-but-unshipped `chat.js` import reflow
  shipped here, line-neutral at 2 added / 2 removed on a 179-line file. The four-project gate ran twice and both runs ship: the first was
  stopped by this host after case 235 of the 348 it announced with zero red lines, and its truncated output is archived with the table's
  only `noTally` row; the relaunch stamped the same ten digests and the same freeze banner and closed `348 passed (25.7m)`, exit 0,
  `GATE_RED_LINES 0`. Census 348 in 31 files, offline suite 337 (+6 over iteration 72's 331, all six in
  `tests/model-failure.test.js`), documentation guards 28, citation scout `DRIFTED 0`. The pass then closed its own last mile: an archive
  that grades the delivered tree cannot exist before the runs it grades finish, so the four legs and the interrupted launch were shelved
  over their placeholders, the offline suite was re-run on the tree this iteration ships (`TALLY_ROWS=246 PINS=191 SHELF=818` against the
  `TALLY_ROWS=240 SHELF=811` the legs themselves stamped), and a row/archive matrix asks every iteration-73 row about every iteration-73
  archive but its own - `MATRIX self_ok=13/13 cross_rejected=156/156 cross_accepted=0` - because a matrix that only ever asks a row about
  its own archive cannot tell a discriminating needle from a vacuous one. Shipped table: 248 rows over 819 files. Two instrument defects
  surfaced on the way and both are stated rather than buried: a helper meant to hide self-referential needles was joining its parts with a
  space, which builds a string no bytes can contain (the F17 class wearing a guard's clothing, now refused automatically by
  `FORBID_SELFREFERENCE`), and the row installer anchored on a needle's text rather than a row key, so it wrote the interrupted run's
  `noTally` flag onto the matrix row - caught by the ledger's own reverse rule, not by review. Real phones, Safari/WebKit, microphones,
  audio quality and independent agronomy stay UNVERIFIED; `main` is untouched, nothing was deployed, no test was weakened. Full account in
  subsection 73 of `docs/validation.md`.
- 21 Nov, iteration 74 (`docs/validation.md` subsection 74): the chat's superseded-reply contract is now pinned by a
  browser case rather than by reading, and the guard the ledger credited with it is measured inert. `revision` has one
  writer outside its declaration and `messageSerial` has one too, and each aborts the in-flight request in the same
  motion (`public/js/modules/chat.js:166`, `:82` then `:85`), so every route that can reach `:100` has already rejected
  on the way - `public/js/lib/api.js:8` over HTTP, `:35` on the worker, `workflow-assistant.js:359` on the guided turn -
  so deleting `chat.js:100` leaves the new spec 16 of 16 green on all four projects. Two controls say that is a reading
  and not an empty harness: loosening `:159`'s `finally`
  condition reddens 4 of 16 naming a count (`unlocked the composer 20 time(s)`), and releasing the spec's own turn holds
  - a mutation of the test, not the app - reddens 4 of 16 at `chat-stale-reply-superseded.spec.js:186`. `:163` returns
  above `:166`, so an assistant-side invalidation moves neither counter and `:100` is unreachable there rather than
  merely redundant; **UNVERIFIED: any user-reachable sequence** that puts a plain `/api/ask` reply across one. The
  spec holds its turn open on the place read, not on `/api/ask`, because on the static transport that request never
  reaches the wire (`public/js/lib/api.js:40` posts to the worker bundle) - which is what makes all four projects real
  arms of the same contract instead of two. The ladder restores both mutated files by digest and prints the served
  `chat.js` digest per arm, because the static projects serve `dist/client` and an arm that edited without rebuilding
  would grade the old build. Offline suite 337 pass / 0 fail on the delivered tree, documentation guards 28, citation
  scout `DRIFTED 0`, shipped table 255 rows over 826 files, row/archive matrix 7 of 7 self-accept and 42 of 42
  cross-refuse - the shelved matrix archive itself says 6 of 6 and 30 of 30, because a run cannot grade the row for an
  archive it is about to create. Evidence, each one now a full path so the archived-evidence existence rule can actually
  check it rather than skip a bare basename: `docs/evidence/iter74-spec-2026-11-21.log.gz`,
  `docs/evidence/iter74-page-controls-2026-11-21.log.gz`, `docs/evidence/iter74-offline-2026-11-21.log.gz`,
  `docs/evidence/iter74-docguards-2026-11-21.log.gz`, `docs/evidence/iter74-drift-2026-11-21.log.gz`,
  `docs/evidence/iter74-offline-final-2026-11-21.log.gz`, `docs/evidence/iter74-row-matrix-2026-11-21.log.gz`.
  Real phones, Safari/WebKit,
  microphones, audio quality and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed, no test
  weakened, no timeout raised. Full account in subsection 74 of `docs/validation.md`.
- 22 Nov, iteration 75 (`docs/validation.md` subsection 75): F14 closes and F18 opens, and the pass changes no application
  file. `tests/documentation-citation-anchors.test.js` grows from 543 lines to 731 with a `DEEP_LINKS` band table that grades eight
  clickable pointers, and the reason it needed grading is in the ledger's own HEAD: `git show HEAD:docs/validation.md` carried
  three links whose labels repeated the coordinate and whose bands sat 146, 160 and 162 lines from the rules their sentences
  named, while a guard compared each anchor to its own label and called that a check. The three plain citations this pass
  repaired (`docs/validation.md:1555`, `AGENTS.md:605`, `AGENTS.md:607`, all naming `workflow-assistant.js` lines that no longer
  hold what was said about them) became rows too, and the last two rows point back at the guard's own scanner and judgement with
  the rule that a band may never contain the row quoting it. Measured on the tree, not carried over: the citation survey reads
  `citations=1204`, `SPAN_PAIRED 219` and 55 candidates; the offline suite reads `ℹ tests 340 ℹ pass 340 ℹ fail 0`; the docs guards read
  `pass 31 | fail 0`; the drift scout reads
  `TREE CITED_LINES_CHECKED 12 DRIFTED 0 INSIDE_DIFF_HUNKS 37`. Archived as `docs/evidence/iter75-controls-2026-11-22.log.gz`,
  `docs/evidence/iter75-instruments-2026-11-22.log.gz`, `docs/evidence/iter75-offline-2026-11-22.log.gz`, `docs/evidence/iter75-docguards-2026-11-22.log.gz` and
  `docs/evidence/iter75-drift-2026-11-22.log.gz`. **Not run, and therefore not claimed:** no row-matrix record and no `TALLIES` needle rows for
  these five archives, because the close was cut short on 22 Nov at the user's instruction; the shelf therefore carries archives
  that no row grades, which is the exposure iteration 71 sized and F17's rule still describes. Real phones, Safari/WebKit,
  microphones, audio quality and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed, no test weakened, no
  timeout raised.
- 25 Nov, iteration 76 (`docs/validation.md` subsection 76): the five iteration-75 archives now have `TALLIES` rows, and the
  row/archive matrix that grades them is archived as `docs/evidence/iter76-row-matrix-2026-11-25.log.gz`. The table moves from
  255 to 261 rows and the shelf from 831 to 832 files. The shelved matrix read five archives and five rows -
  `self_ok=5/5 cross_rejected=20/20 cross_accepted=0` - because the row for its own bytes could not exist yet; after that row
  landed, the same driver read six of each and printed `self_ok=6/6 cross_rejected=30/30 cross_accepted=0`, deliberately
  unshelved to avoid an infinite archive-embedding chain. Every positive needle is a unique rendered line; the matrix row's
  negatives are raw signatures from other legs, measured absent from its own bytes. No application, e2e, configuration or
  generated asset changed, so no browser leg was owed. F17 remains open because the shipped guard still defaults missing
  needle lists to empty; F18's 55 candidates and F13's scratch instruments remain queued. Real phones, Safari/WebKit,
  microphones, audio quality and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed, no test weakened,
  no timeout raised. The prose-final self-check read documentation guards `31/31`, offline `340/340`, and both drift modes
  `CITED_LINES_CHECKED 1 DRIFTED 0`; those outputs are unarchived by design and carry no tally rows.
- 25 Nov, iteration 77 (`docs/validation.md` subsection 77): all 55 F18 span-paired citation candidates were read against
  their target bytes. Twelve stale or misleading prose coordinates were repaired across thirteen candidate rows; the census
  moves from 1,204 citations / 219 span-paired / 55 candidates to 1,203 / 218 / 48, so seven candidates left the heuristic
  list. The remaining 48 are historical references, broad function or test locations, or false span pairings; no confirmed
  stale pointer remains in the original 55. This is a manual triage, not a proximity rule and not a guard over the remaining
  plain citations, so F18 stays open. The complete before/after census and every verdict are archived as
  `docs/evidence/iter77-f18-triage-2026-11-25.log.gz`. No application, e2e, configuration or generated asset changed, so no
  browser leg was owed. The prose-final self-check read documentation guards `31/31`, offline `340/340`, and both drift modes
  `CITED_LINES_CHECKED 1 DRIFTED 0`; the final census summary stayed 1,203 / 218 / 48. F17 is next; real phones, Safari/WebKit,
  microphones, audio quality and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed, no test weakened,
  no timeout raised.
- 25 Nov, iteration 78 (`docs/validation.md` subsection 78): F17 closes in the shipped guard. Every `TALLIES` row now
  needs at least one positive `lines`, `phrases` or `onlyReds` needle; the one content-vacuous partial row gained bytes from
  its own archive, and four count-shaped-only rows gained run-specific stamps. The shape census moves from 262 rows with
  one no-positive row and four count-shaped-only rows to 262 / zero / zero. A global negative-liveness rule was measured
  and rejected: 52 of 474 negatives are live in no other archived run, across 36 rows, so enforcing it would rewrite other
  passes' evidence rather than tighten this defect. The two-directional control is green at 7/7, red at 6/7 with
  `ROW_SHAPE_BAD` naming the partial archive after its positives are stripped, and green again at 7/7 after a byte-identical
  restore. Evidence is `docs/evidence/iter78-f17-shape-2026-11-25.log.gz`. No application, e2e, configuration or generated
  asset changed; F13 is next, while F18's broader plain-citation exposure remains open. The prose-final self-check read
  documentation guards `31/31`, offline `340/340`, delivered-tree drift `CITED_LINES_CHECKED 1 DRIFTED 0`, and HEAD-mode
  drift `CITED_LINES_CHECKED 1 DRIFTED 1`, the expected pre-repair witness. Real phones, Safari/WebKit, microphones, audio
  quality and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed, no test weakened, no timeout raised.
- 25 Nov, iteration 79 (`docs/validation.md` subsection 79): F13 closes. Six instruments now ship under `scripts/` -
  `citation-band.mjs`, `tally-shape.mjs`, `exact-mutate.mjs`, `controls-deep-links.sh`, `evidence-needle-probe.mjs` and
  `evidence-source.mjs` - with npm entry points `test:citations`, `test:tally-shape` and `test:deep-link-controls`. The
  tracked-prose census of scratch-script paths moves from 28 to zero; historical one-pass drivers are cited through the
  evidence archives that embed them or described without a runnable scratch path. A new documentation-command case rejects
  any scratch script named in tracked prose and is proved green 8/8, red 7/8 after an injected path, then green 8/8 after a
  byte-identical restore. The shipped deep-link ladder runs 11 legs with zero failures and restores both files identically.
  Evidence is `docs/evidence/iter79-f13-instruments-2026-11-25.log.gz`. No application, e2e, configuration or generated
  asset changed; F6/F7/F12 are next, while F18's broader plain-citation exposure remains open. The prose-final self-check
  read documentation guards `32/32`, offline `341/341`, both drift modes `CITED_LINES_CHECKED 26 DRIFTED 0`, and the
  scratch-script census `references=0`. Real phones, Safari/WebKit, microphones, audio quality and independent agronomy stay
  UNVERIFIED; `main` untouched, nothing deployed, no test weakened, no timeout raised.
- 25 Nov, iteration 80 (`docs/validation.md` subsection 80): F6 closes and F7 retires as VERIFIED SOUND; F12 is BLOCKED
  with an explicit unblock condition. The drift scout now treats a blank or missing pair as `UNREADABLE` and exits nonzero,
  strips clock times and URL ports before reading bare `:NNN` continuations, and removes `file:line:column` triples before
  they can donate their column as a citation. Three unit cases are green 3/3; removing the clock filter, triple filter or
  blank-pair check makes the relevant case red at 2/3, and the byte-identical restore returns 3/3. F7's historical
  re-point script no longer ships, the current tree has zero re-point tools and zero scratch-script references, so the
  prefixed-only defect is not reachable in the current workflow. F12 remains: a folded name over 60 characters still falls
  through to the read-only answer during a cold list refusal, because no safe wording test can distinguish a long row name
  from a long evidence question without the list. The existing focused file passes 8/8 with that limit pinned. Unblock F12
  only with a product-approved discriminator or a cached known-row inventory. Evidence is
  `docs/evidence/iter80-f6-f7-f12-2026-11-25.log.gz`. No application, e2e, configuration or generated asset changed; next is
  a fresh scout of §13.1 items 9-20. The prose-final self-check read documentation guards `32/32`, offline `344/344`, and
  both drift modes `CITED_LINES_CHECKED 1 DRIFTED 0 UNREADABLE 0`. Real phones, Safari/WebKit, microphones, audio quality
  and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed, no test weakened, no timeout raised.
- 25 Nov, iteration 81 (`docs/validation.md` subsection 81): §13.1 item 11 closes. The HTTP body-read catch now checks
  the caller's own signal before naming an unreadable response, while an unexpected `AbortError` remains an unreadable
  response with its cause. The one-line api.js repair is line-neutral. The offline transport file went from 15 pass /
  1 fail on the original bytes to 16 / 16; the focused browser spec passed 12/12 across all four projects. Reverting only
  api.js and rebuilding made the two Node projects fail the new case while both static projects stayed green; a
  byte-identical restore and rebuild returned 12/12. The full four-project gate on the frozen tree passed 368/368 in
  26.2 minutes, exit 0. The post-gate drift check also closed a continuation flaw: bare line tokens no longer inherit a
  path across sentences or past bare filenames, five mutation controls pass, and the delivered-tree scout reads 70 checked /
  0 unreadable. Evidence is `docs/evidence/iter81-http-body-cancel-2026-11-25.log.gz`. No dependency, timeout, retry or assertion was weakened;
  next is §13.1 item 12. Real phones, Safari/WebKit, microphones, audio quality and independent agronomy stay UNVERIFIED;
  `main` untouched, nothing deployed.
- 26 Nov, iteration 82 (`docs/validation.md` subsection 82): §13.1 items 12 and 15 close as VERIFIED SOUND, and item 14
  closes as VERIFIED FIX. A cancelled worker request now has a committed late-reply/fresh-request case, and worker
  `onerror` crash/restart has a committed recovery case. Two line-neutral api.js guards make synchronous worker
  constructor and `postMessage` failures reject with the authored no-answer sentence, clear pending work, terminate the
  broken worker and let the next request create a fresh one. The transport file went from 18 pass / 2 fail on the original
  bytes to 20 / 20; the focused browser spec passed 16/16 across all four projects. Reverting both guards and rebuilding
  failed the new case, and a byte-identical restore plus rebuild returned 16/16. Full-gate attempts are disclosed rather
  than called green: SIGTERM interrupted the first at case 136/372; the second finished 371/372 on an external terrain DNS
  failure and its unchanged case passed 1/1 on rerun; the final run finished 362 passed / 6 failed / 4 not run on live NASA
  POWER TLS resets in node-desktop, and the five affected files passed 22/22 unchanged after a direct HTTP 200 check. No
  single full-gate pass is claimed. Evidence is `docs/evidence/iter82-worker-recovery-2026-11-26.log.gz`. No dependency,
  timeout, retry or assertion was weakened; next is a fresh scout of §13.1 items 16-20. Real phones, Safari/WebKit,
  microphones, audio quality and independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed.
- 26 Nov, iteration 83 (`docs/validation.md` subsection 83): the primary UI↔chat parity audit closes. Previous crop,
  drainage, pest history, temperature unit, regional soil, country pests, 3D open/close, back navigation, global place search
  and every returned mapped field now have equivalent chat text or button paths. The new unit file passes 6/6, the
  workflow/chat-context files 131/131, the focused browser spec 8/8 on all four projects, and the corrected full gate
  380/380 in 22.4 minutes with exit 0. Five mutation controls fail as intended and the byte-identical restore returns 8/8.
  The first gate was stopped during diff review for a missing-country search-row crash; its failing control and repair are
  archived. Citation repair moved 114 prose pointers, 26 quote-based pins and 25 coverage tuples; the final guard passes
  22/22. Evidence is `docs/evidence/iter83-ui-chat-parity-2026-11-26.log.gz`. Advanced 3D layer, terrain, imagery and
  month-slider manipulation remains outside this primary-journey audit and is not claimed covered. No dependency, timeout,
  retry or assertion was weakened; next is §13.1 items 16-20. Real phones, Safari/WebKit, microphones, audio quality and
  independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed.
- 27 Nov, iteration 84 (`docs/validation.md` subsection 84): §13.1 items 16-20 close as VERIFIED SOUND. Five browser
  cases hold older country, region/town/search, field, evidence and comparison responses at the fetch/worker boundary,
  perform a newer action, release the old response and require the newer state to remain. No application byte changed.
  Focused browser checks pass 20/20 across four projects; country, search, fields, comparison and combined evidence
  controls each redden 4/4, the evidence app-only half-fix reddens 2/4 while worker cancellation protects static, and the
  byte-identical restore returns 20/20. The pre-documentation offline suite passes 357/357. The first full gate was
  stopped by the 600000 ms tool deadline after 147 completed cases with no failure or tally; the relaunched frozen tree
  passed 400/400 in 20.2 minutes, exit 0. Evidence is
  `docs/evidence/iter84-stale-selection-parity-2026-11-27.log.gz`. No dependency, timeout, retry or assertion was weakened;
  next is §13.1 item 21. Real phones, Safari/WebKit, microphones, audio quality and independent agronomy stay UNVERIFIED;
  `main` untouched, nothing deployed.
- 28 Nov, iteration 85 (`docs/validation.md` subsection 85): §13.1 item 21 closes as VERIFIED FIX. Dropdown, global
  search, coordinates, map click and chat selections now retain one exact point and region identity. Chat points no
  longer inherit an older region filter, and unnamed source region codes never become a filter; a same-name town in
  two regions asks instead of silently selecting the old point. The focused location spec passes 24/24, the location
  plus city-state batch 32/32, related chat/whole-country specs 28/28, and offline 358/358. The app-side control reddens
  8/8; the assistant-side control reddens 12/12 including Singapore; the byte-identical restore returns 24/24 and
  city-state 8/8. The first full gate was stopped by the user at case 253 with three Singapore failures and no tally;
  the corrected frozen tree passed 424/424 in 20.9 minutes, exit 0. Evidence is
  `docs/evidence/iter85-location-path-consistency-2026-11-27.log.gz`. No dependency, timeout, retry or assertion was
  weakened; next is §13.1 item 22. Real phones, Safari/WebKit, microphones, audio quality and independent agronomy stay
  UNVERIFIED; `main` untouched, nothing deployed.
- 28 Nov, iteration 86 (`docs/validation.md` subsection 86): §13.1 item 22 closes as VERIFIED SOUND. Two deterministic
  browser cases change town and mapped field inside one country after loaded NASA evidence, then require all baseline,
  previous and allowed crop choices to stay exact while older evidence clears and comparison is disabled. No application
  byte changed. The focused spec passes 8/8, related specs 28/28, offline 358/358, and the frozen four-project gate passes
  432/432 in 24.1 minutes, exit 0. Controls redden crop preservation 8/8 and field evidence invalidation 4/4; the town-only
  half-fix stays green because point selection also invalidates, while removing both town invalidators reddens 8/8.
  Byte-identical restoration returns 8/8. Two harness-red attempts are retained for checkbox order and hidden step
  controls. Evidence is `docs/evidence/iter86-same-country-input-integrity-2026-11-28.log.gz`. No dependency, timeout,
  retry or assertion was weakened; next is §13.1 item 23. Real phones, Safari/WebKit, microphones, audio quality and
  independent agronomy stay UNVERIFIED; `main` untouched, nothing deployed.

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

## 13. Standing goal, the tools that prove it, and what counts as achieved (set 20 Nov 2026)

This section states the goal an autonomous agent is working to on `fix/chat-flow-and-answers`,
the commands that constitute proof here, and the line between verified and unverified. It
overrides any older sentence in this file that permits a release, a second branch or a
deployment. The original programme brief is outside the clone in the parent workspace;
its starting-state paragraph is historical. This section is the repository-local restart
contract. A review request pauses implementation, commits and pushes until the user restarts it.

**The goal, in one sentence.** A reproducibly verified branch where the farmer journey —
place, constraints, evidence, compared rotations, and the chat that drives them — behaves the
same over the static-worker and Node-HTTP transports; where a failure says what actually
happened, keeps the farmer's inputs and offers a recovery that works; where cancellation,
stale responses, caching, rate limits and optional-model failures cannot silently corrupt a
result; where a regression test detects what it claims to detect; and where every reported
number traces to an executed run and its source revision.

**What "achieved" means — seven checks a reader can run, not a feeling.**

1. A clone of the branch tip passes `npm test` with no skip, and `npm run test:e2e` passes in
   all four projects (static-desktop, static-mobile, node-desktop, node-mobile).
2. For each transport-dependent claim there is a case that executes on *both* transports, so
   "parity" is measured rather than asserted. The six panel cases that used to skip on the
   static builds are the precedent for how that is done.
3. For every failure family a test separates three facts: the service refused, the service
   answered with nothing, and the answer arrived after the farmer had moved on. A refusal may
   never be worded as a finding about the data.
4. Every failure path preserves what the farmer typed or tapped, and the recovery it names
   exists as a control they can press.
5. No number in `docs/validation.md`, `AGENTS.md` or `docs/handoff-2026-11-18.md` is quoted
   without an archive under `docs/evidence/` that prints it, and a red run is kept as a red run.
6. The blockers and the UNVERIFIED list below are stated in the same place as the successes.
7. Every farmer task reachable through the UI is also reachable through chat text or chat buttons, and those
   controls perform the same state transition rather than merely describing it. The audit covers place selection,
   constraints, evidence loading, comparison, navigation, retry/recovery and optional model/speech controls.

**Repository verification tools.** Read `package.json` before using a command; run from the
repository root, one browser suite at a time. A command's existence is not proof it passed.

| Command | Scope and limitation |
| --- | --- |
| `npm test` | Offline server, agronomy, transport, chat and docs cases; includes a static build |
| `npm run build` | Builds the worker bundle and `dist/client`; does not exercise the UI |
| `npm run test:e2e` | Four Chrome projects, both transports; includes live-service dependencies |
| `npm run test:release` | Runs offline then browser suites; despite its name, deploys nothing |
| `node scripts/docs-guards.mjs` | Runs the complete documentation guard set; checks its file inventory |
| `node scripts/citation-drift.mjs` | Compares cited lines in changed source files; not a semantic audit |
| `node scripts/evidence-index-generator.mjs` | Regenerates the evidence index; `--stdout` prints without writing |
| `npm run test:chat-matrix` | Browser walk over supported country/place flows |
| `npm run test:place-audit` | Deep offline place-matching audit |
| `npx playwright test --list` | Discovers cases without running them; census only |
| `npm run start` / `npm run start:node` | Local static-worker / Node-HTTP previews for browser checks |

Historical baseline, not a fresh review gate: iteration 60 archived 262 offline passes in
27.3 s at `docs/evidence/iter60-offline-shipped-2026-11-20.log.gz`, and 260 browser passes,
zero failures/skips in 20.1 min at `docs/evidence/iter60-gate-2026-11-20.log.gz`.
The gate header names e3982cd plus that iteration's work; the review tip is 92fdf2c, with no
application or e2e-file difference between them. Re-measure counts rather than freezing them
as targets. There is no `.github/workflows` directory on this tip; CI has not been set up.

**Agent tools exposed in this session, not promises about a future host.**

- `Read`, `Grep`, `Glob`, `Edit`, `Write`: inspect and change local files; prefer targeted reads.
- `Bash`: git, Node/npm, local probes, gzip archives and process inspection. Long runs use its
  supported background mode, their own logs and preserved exit status, not an untracked shell job.
- `SearchWorkspace`: cross-file discovery when needed; validate its findings against source.
- `mcp_list`, `mcp_get`, `mcp_call`: discover and inspect actual MCP schemas before invocation.
  Prefer the exposed `remote-browser-use` connector for interactive browser work. Repository
  Playwright uses the installed local Chrome; a remote browser cannot be assumed to see localhost.
- `Skill`: load applicable, actually listed guidance. A skill's presence proves no device or
  runtime worked. Do not install extensions, browsers or packages merely because a skill names them.
- `GetGoal`, `CreateGoal`, `UpdateGoal`: inspect/register/complete an explicitly requested goal.
  Do not create a duplicate or resume execution during a review. A stopped goal needs user restart.
- `gh` and git: read remote state and publish only when authorised. Never print tokens, alter git
  configuration, force-push or bypass a denied tool. No subagent delegation; keep progress in prose
  when task tools are unavailable or blocked. Do not switch mechanisms to evade a hook denial.

Probe measurements may enter the ledger too, but only with the executed command, archived
source/output, runtime and source hashes. Tool summaries and completion notifications alone
are not evidence. No independent subagent review is claimed.

**Hard limits, restated because they are the ones an agent is tempted to cross.** Work and push
only to `fix/chat-flow-and-answers`; never `main`, never merge, never deploy, never touch the
NASA portal, never edit the frozen `public/submission/phase-a` or another worktree. Add no
dependencies and do not re-architect. Never invent data, confidence, yields or savings. Never
weaken, skip or narrow a test to get green, and never raise a timeout or add a retry to hide a
failure — rewrite a superseded assertion stronger and say why. If docs checks fail, fix the
prose, not the guard. If an external service blocks a full gate, report *local verification
complete; live integration blocked* rather than a pass. A newer human request to pause, review
or plan takes precedence over any standing goal.

**UNVERIFIED, stated rather than inferred.** Real phones and tablets, Safari and any WebKit
build (the suite runs the installed Chrome channel only; no Firefox or Gecko engine is
installed on this machine either, so `npm run test:firefox` cannot run here), physical
microphones and the audible quality of read-aloud, and any independent agronomic review of the
rotation advice. These stay UNVERIFIED until separately authorised and actually tested; a green
gate does not cover them.

**Reconciled starting state, 20 Nov 2026, review tip 92fdf2c.** Later queue bullets are not
necessarily more accurate than earlier code or logs. The original P0-P3 must not be re-opened
merely because stale prose repeats them:

- P0's failed gate remains failed: 229 passed, one failed, six skipped, 24.9 min in
  `docs/evidence/iter52-gate-2026-11-19.log.gz`. The trace census records Overpass HTTP
  502/504 responses and unanswered requests, with no terrain request; it does not prove why
  those remote services failed. The isolated re-pass is separate evidence, not a repaired gate.
  Read `docs/evidence/iter52-trace-census-2026-11-19.log.gz` and
  `docs/evidence/iter52-gate-isolated-rerun-2026-11-19.log.gz`. The reconciliation exists;
  remote-service reliability remains outside this app's guarantee. Do not call capacity proven.
- P1's local-throttle wording fix landed in iteration 53: `server/context/soil.js:28` creates
  `SOIL_FAIR_USE`, and `server/context/client.js:44` passes that AppError through unchanged.
  Later prose saying the wrapper still converts it to an upstream failure is stale. Browser
  coverage of the distinction is a remaining task, not another reason to rewrite the same fix.
- P2's provider classification landed in iteration 54, and caller-owned cancellation in 56.
  Metadata preservation at the page boundary and cancellation during body reading remain open.
- P3's six skipped panel executions were replaced in iteration 57. Preserve those deterministic
  cases and the live checks; do not describe the old skips as current.

**Closed 20 Nov: the refused saved list (goals 2-5).** The bare catch that turned a refusal into "No towns are
listed" is gone from `public/js/modules/workflow-assistant.js:463`, which now rethrows a cancellation and leaves the
read a failure; `public/js/modules/workflow-assistant.js:248` (its third argument came from iteration 67) answers an unavailable read and an unreadable source
shape with the two different sentences their recovery needs, and no layer caches a failed read, so the retry re-asks.
The offline probe that first measured it is still
`docs/evidence/review-goals-place-list-2026-11-20.log.gz` and
`docs/evidence/review-goals-place-list-2026-11-20.mjs.gz`; extract the source and run it with
Node from the repository root; its imports resolve from that working directory. Reproduced since in both transports by
`tests/e2e/place-list-refused.spec.js`, with validation.md subsection 61 carrying the gate, the single-file revert
controls and the second defect the browser run exposed at `public/js/modules/context.js:248`: the region the refusal
tells the farmer to pick was validated against a step-1 dropdown still holding the older failure.
Goal 2's half is shipped too — `public/js/lib/api.js:13` and `public/js/lib/api.js:70` carry the status and code each
transport reported beside the sentence, and `public/js/lib/api.js:54` keeps a runtime exception with no status behind it
from borrowing an authored identity. Raw runtime exceptions are never displayed.

**Retired as stale, 20 Nov iteration 66.** This paragraph described a live defect until iteration 64 shipped its fix
and nobody re-read it: `public/js/modules/workflow-assistant.js:447` now answers an unreadable saved list through
`switchListUnreadable` (helper at `:777`) *before* the local-name check at `:391`, so a town spelled inside another
country's name can no longer move the plan on a read that never answered. Commit e32ec0a carries the guard and
`tests/e2e/place-list-refused.spec.js:224` holds it on both transports; `server/context/locations.js:20` and `:27`
still keep a failed read apart from an answered empty list, which `tests/matrix-coverage.test.js:65` asserts.

The pending-choice loss is a candidate with narrower reach than the old queue suggests:
`public/js/modules/chat.js:93` consumes it, while `public/js/modules/chat.js:156` restores
only text. The reviewed location/field actions normally resolve; the missing-catalog throw
at `public/js/app.js:174` needs a real UI reproduction before changing retry state. Restoring
an old town choice after a country change would itself be a wrong-location defect.

The optional-model error branch that dropped the worker's message and blamed the device is closed: as of iteration 72
`public/js/modules/chat.js:63` and `:66` route through `public/js/lib/model-failure.js`, which states an observed cause or
none, and `tests/e2e/chat-model-egress.spec.js:17` requires the whole sentence. Two rules from that queue item survive the fix
and are what its regression tests enforce: give only an observed, safe reason, and do not restore the raw-error leak. The
earlier CDN interruption and recovery stay archived in `docs/evidence/iter56-dns-trace-census-2026-11-19.log.gz`; deterministic
failure coverage and live model-loading coverage must remain distinct. The same shape one module over was queued as F16 -
`public/js/modules/speech.js:72` interpolating the raw worker text into the panel and `:74` blaming the device - and iteration 73 closed
it on the shared classifier, both panels now reading one cause table, with subsection 73 of `docs/validation.md` as its evidence.
Superseded evidence replies and body-read cancellation are candidates to reproduce, not already-proven defects. F17, from the same pass: the
tally guard at `tests/documentation-evidence-index.test.js` defaults a row's needle lists to empty, so a row written without needles passes by
reading nothing. Measured on the 240-row table iteration 73 started from: one row pins no bytes at all - the iteration-57 partial capture, held
only by a `partial` shape flag and a `marks` count - while a rule demanding all three needle kinds would redden 81 legacy rows, so the
enforceable rule is at least one positive content needle (`lines`, `phrases` or `onlyReds`). The candidate verifier refuses the shape; the
shipped guard should too, and its first run must be the single row the survey found rather than a table-wide rewrite. Iteration 73 found the
same class one step along: a negative can be well-formed, present in the row and still pin no bytes, because the needle it builds joined its
parts with a space and no archive can contain the result. The verifier now cross-checks every negative against the text of the verifier and
driver embedded in the very archive it grades (`FORBID_SELFREFERENCE`), which is the half of F17 that is automated; the shipped guard
had neither rule, and both lived in gitignored `artifacts/scratch`. Iteration 76 added six non-vacuous rows and a
row/archive matrix for the iteration-75 debt, but that proves these rows read bytes; it does not close F17's missing-shape rule.
Iteration 78 closes the shipped half: every row now needs a positive `lines`, `phrases` or `onlyReds` needle, the one
content-vacuous partial row and four count-shaped-only rows were repaired, and a green/red/green control proves the rule
fails on the original shape. The broader negative-liveness rule was measured and rejected rather than imposed on 36 legacy
rows.

F17 grew the other half in iteration 74, while the row that grades the row-matrix archive was being written: an archive whose bytes embed the
tools that produced it contains every failure string those tools print, so a must-not-occur needle copied from a leg's intention rejects the
evidence it certifies. `✖ `, `ℹ fail 1`, `SELF_REJECTED` and `MATRIX74_FAILED` each appear in exactly one of the seven iteration-74 archives,
and the one that carries them is the matrix record, because it embeds `matrix74.sh` and `verify-row74.mjs` verbatim. The rule is therefore not
"build negatives from parts" but "measure every negative against the archive before installing it", which is what
`scripts/evidence-needle-probe.mjs` prints: whole-line and substring counts per candidate, plus the names of the archives carrying each, so a
needle that is live nowhere and a needle that is poisoned sit in the same report. The same pass removed the defect iteration 73's matrix
carried unknowingly: its driver filtered `iter74-row-matrix-*` out of the shelf, which guarantees the archive the run produces is never asked
about, so `matrix74.sh` now reads every `iter74-*.log.gz` and refuses before comparing a needle unless `archives == rows`. The shelved record
prints `archives=6 rows=6` and `self_ok=6/6 cross_rejected=30/30`, and the re-run that grades the row written after it prints
`archives=7 rows=7` and `self_ok=7/7 cross_rejected=42/42`; the re-run is not shelved, for the circularity named in subsection 74.

F14 closed in iteration 75, and the closure is a table rather than a rule. Three clickable deep links were graded against their own
labels and nothing else, all three pointed 146 to 162 lines from the code their sentences named, and the layer that ships now reads
each band's bytes, requires the anchor line to carry an identifier the label spells, requires the label to say more than the
coordinate, and requires the set of links and the set of rows to be equal in both directions - then proves each of those four
properties with its own mutation leg. F18 is what the same pass found on the way and could not fix: the identical drift in the
*plain* citations, which are 1,204 of this ledger's pointers and are covered by neither the pin table (191 statements iteration 58
chose to quote) nor `scripts/citation-drift.mjs`, because the scout is differential - it compares a cited ordinal in HEAD against the
working copy, so a pointer that slid 162 lines across five commits never reads as drift to anything.
`scripts/citation-band.mjs` sizes that population (67 citations whose target cannot be resolved at all, 219 whose
coordinate has a code span beside it, 55 where that symbol is neither on the cited line nor within three of it) and states no verdict
on purpose: two of the three genuine misses this pass repaired were in that list and the third was found by reading the paragraph,
because proximity is not a decidable property of English prose. Protection therefore stays table-driven - PINS for quoted statements,
`DEEP_LINKS` for clickable ones - and F18 is a standing exposure with a measured denominator, not a task a heuristic can finish.
Iteration 77 read all 55 candidates against their target bytes, repaired twelve prose sites and found no confirmed stale pointer
left in that set; the remaining 48 are historical, broad or false-paired. F18 stays open because the other plain citations
still have no semantic guard. F13 closed in iteration 79: the current census, tally-shape, mutation, deep-link control,
needle-probe and evidence-source instruments ship under `scripts/`, and tracked prose names zero scratch scripts. F6 closed
in iteration 80: blank/missing pairs are unreadable and clock/URL/column tokens cannot become citations. F7 is VERIFIED
SOUND because no re-point tool ships in the current workflow. F12 is BLOCKED: a cold refused list provides no safe way to
distinguish a folded name over 60 characters from a long evidence question; it needs a product-approved discriminator or a
cached known-row inventory.

### 13.1. Next 50 goals, in priority order

This is a proposed execution backlog, not 50 discovered bugs or 50 mandatory code changes.
Start with 1-5, then select the highest-impact unblocked item. A goal closes as VERIFIED FIX,
VERIFIED SOUND or BLOCKED with evidence and an unblock condition; do not manufacture a change
when existing behaviour is sound. No goal is marked executed merely by appearing here.

**Cross-cutting UI↔chat parity requirement (26 Nov).** Before the programme can finish, inventory the farmer-facing
UI controls and prove each task has an equivalent chat text or button path that performs the same transition. Cover
place, constraints, evidence, comparison, navigation, retry/recovery and optional model/speech controls; record any
UI-only task as a defect with a reproducing case, and any chat-only convenience as additive rather than parity. The
primary-journey audit closed 26 Nov in iteration 83; advanced 3D layer, terrain, imagery and month-slider manipulation
remains open and is not claimed covered.

**Failure truthfulness and recovery**

1. Reconcile current handoff summaries with the closed P0-P3 work; preserve dated red records. CLOSED 20 Nov:
   the reconciliation entry is the last block of `docs/handoff-2026-11-18.md` §7, and this pass kept its own red run
   (`docs/evidence/iter61-browser-red-2026-11-20.log.gz`) rather than archiving only the green one.
2. Preserve authored error status/code across HTTP and worker transports without leaking internals. CLOSED 20 Nov
   as VERIFIED FIX: `tests/e2e/place-list-refused.spec.js` could not classify either failure class until it shipped, and
   `docs/evidence/iter61-controls-2026-11-20.log.gz` shows the spec going red when `public/js/lib/api.js` is reverted.
3. Reproduce the saved-list refusal in both browser transports; replace false empty-data claims. CLOSED 20 Nov as
   VERIFIED FIX: validation.md subsection 61, `tests/e2e/place-list-refused.spec.js:36`, 8/8 in four projects.
4. Separate invalid saved-list schema, unavailable reads and genuinely empty lists in recovery tests. CLOSED 20 Nov
   as VERIFIED FIX: `public/js/modules/workflow-assistant.js:249` branches on the code, `:374` rethrows a cancellation,
   and `tests/e2e/place-list-refused.spec.js:100` plus the three cases in `tests/workflow-place-choices.test.js` hold the
   three classes apart.
5. Exercise list retry after recovery; keep the country and never cache a failed read as an empty list. CLOSED 20 Nov
   as VERIFIED FIX: the case refuses twice, counts the re-ask, then taps a recovered region; that tap found the second
   defect (`public/js/modules/context.js:248`) and is asserted at `tests/e2e/place-list-refused.spec.js:92`.
6. Reproduce pending-choice loss through a reachable UI failure, or close the candidate as sound. CLOSED 20 Nov on
   both halves: the census prints `TAPS_MEASURED 2338` / `DIVERGENT 27` / `DIVERGENT_BY_STAGE town=27`, and the probe
   cannot make a tapped town reject on either transport (`town_tap_rejects=false` twice), so the loss is latent and the
   candidate closes as VERIFIED SOUND. What the probe did reach is a tapped *region* whose form-side re-read refuses:
   it rejected with `Choose a region from the current country list.`, and that half closes as VERIFIED FIX
   (`docs/validation.md` subsection 62, `docs/evidence/iter62-tap-rejection-before-fix-2026-11-20.log.gz`).
7. If reachable, retain the exact tapped identity on retry without overwriting a newer typed draft. NOT SHIPPED 20 Nov:
   its "if reachable" precondition was measured and is not met (goal 6), so there is no rejection that could exercise
   a restored identity, and no test could hold one. Re-open only with a reachable failure.
8. Invalidate retained choices after location changes, cancellation or a different message. CLOSED 21 Nov as
   VERIFIED SOUND for the stale-reply half, where a premise carried here since 20 Nov is now measured; the
   cancellation half was already held (`tests/e2e/chat-bare-place-name.spec.js:76`, `:93`;
   `tests/workflow-bare-place-name.test.js:132`). New: `tests/e2e/chat-stale-reply-superseded.spec.js`, 4 cases in
   each of the 4 projects, holds a turn open on the place read rather than on `/api/ask` - which is what arms it on
   the worker transport - supersedes it from a reply button, and pins that the late answer never lands and only the
   newest turn unlocks the composer. The seven-arm ladder at
   the close driver embedded in `docs/evidence/iter74-page-controls-2026-11-21.log.gz` finds
   deleting `public/js/modules/chat.js:100` still 16 of 16 green, and the reason is structural: `revision`'s only
   writer `:166` aborts the request in the same statement and `messageSerial`'s writer `:82` aborts at `:85`, so every
   route that reaches `:100` has already rejected - the `fetch` signal at `public/js/lib/api.js:8` over HTTP,
   `public/js/lib/api.js:35` on the worker, `workflow-assistant.js:359` on the guided turn. Loosening `:159` reddens 4
   of 16 naming a count (`unlocked the composer 20 time(s)`) and releasing the spec's own holds reddens 4 of 16 at
   `:186`, which is what stops that green reading as an empty harness; `:163` returns above `:166`, so an
   assistant-side invalidation moves neither counter - **UNVERIFIED: any user-reachable sequence** across that return.
9. Replace unsupported device blame on model-load failure with safe, observable failure wording.
10. Prove model refusal/unload/reload leaves deterministic chat and planning usable, with no fake success.

**Cancellation, late replies and worker lifecycle**

11. Test caller cancellation while HTTP response JSON is still being read.
12. Test cancelled worker requests and late replies without claiming upstream work was cancelled.
13. Verify unexpected AbortError failures still surface instead of being treated as user cancellation.
14. Verify worker-start and synchronous postMessage failures settle callers and allow recovery.
15. Verify worker crash/restart clears pending work and prevents duplicate or stale answers.
16. Reverse response order for successive countries; old crop/town lists must never win. CLOSED 27 Nov as VERIFIED
   SOUND: `tests/e2e/stale-selection-parity.spec.js:35` holds the older crop/town responses on both transports and passes
   all four projects; removing the country/picker version guards reddens 4/4.
17. Reverse order for successive regions, towns and place searches; selection stays with the latest action. CLOSED 27 Nov
   as VERIFIED SOUND: `tests/e2e/stale-selection-parity.spec.js:62` releases the newer search first and retains its exact
   row on all four projects; removing the search version guard reddens 4/4.
18. Change location during a field lookup; old outlines and field counts must not attach to the new point. CLOSED 27 Nov
   as VERIFIED SOUND: `tests/e2e/stale-selection-parity.spec.js:99` passes all four projects; removing the field-lookup
   version guard reddens 4/4.
19. Change location during evidence loading; supersession must not appear as a NASA service failure. CLOSED 27 Nov as
   VERIFIED SOUND: `tests/e2e/stale-selection-parity.spec.js:122` passes all four projects. The app-only control reddens
   2/4 because worker cancellation still protects static; removing both guards reddens 4/4.
20. Edit constraints during comparison; results and chat must not describe the abandoned plan as current. CLOSED 27 Nov
   as VERIFIED SOUND: `tests/e2e/comparison-superseded.spec.js:29` passes all four projects; removing both the revision
   and worker-cancellation guards reddens 4/4. Evidence for items 16-20 is
   `docs/evidence/iter84-stale-selection-parity-2026-11-27.log.gz`; the byte-identical restore returns 20/20.

**Location and farmer-input integrity**

21. Cross-check dropdown, map, search, coordinate and chat selections for the same stored location. CLOSED 28 Nov as
   VERIFIED FIX: `tests/e2e/location-path-consistency.spec.js:96` covers all five input paths plus two chat follow-ups;
   chat points clear stale region filters, unnamed codes never narrow a search, and same-name towns in two regions ask
   for the exact row. The app control reddens 8/8, the assistant control reddens 12/12 including Singapore, and the
   byte-identical restore returns 24/24 plus city-state 8/8. Evidence is
   `docs/evidence/iter85-location-path-consistency-2026-11-27.log.gz`.
22. Verify same-country town/field changes preserve valid crop choices without reusing stale evidence. CLOSED 28 Nov as
   VERIFIED SOUND: `tests/e2e/same-country-input-integrity.spec.js:92` and `:115` pass all four projects after loaded
   evidence; crop controls redden 8/8, field invalidation 4/4, both town invalidators 8/8, and byte-identical restore returns
   8/8. Evidence is `docs/evidence/iter86-same-country-input-integrity-2026-11-28.log.gz`.
23. Verify cross-country changes clear incompatible choices explicitly, never silently substituting crops.
24. Check duplicate town names select the exact offered row, including same-name/same-region collisions.
25. Recheck country-name, region-less and list-less flows against the existing full-matrix invariants.
26. Audit decimal commas, hemisphere tags and agronomy numbers for unintended coordinate selection.
27. Verify unknown soil/irrigation remains unknown and never becomes an inferred farm measurement.
28. Verify planting month, year and priority survive retries and back/forward workflow navigation.
29. Verify unsupported crops and insufficient coverage explain the block while preserving farmer inputs.
30. Test keyboard focus, visible error/retry controls and small viewports for the newly changed paths.

**Evidence and comparison integrity**

31. Verify source date, retrieval date, units and spatial support stay attached to displayed measurements.
32. Verify missing values and incomplete periods cannot become zero rainfall or false complete coverage.
33. Check chat, tables and charts agree on the same measured series, location and aggregation period.
34. Verify temperature-unit switches and crop-window selection do not alter underlying scientific inputs.
35. Check country pest records cannot be presented as current field presence or the wrong country's evidence.
36. Check regional soil estimates remain separate from user-supplied soil and carry their uncertainty notice.
37. Recheck citation identity, source count and link targets after composition and paragraph truncation.
38. Verify comparisons retain the farmer's baseline and use equal horizons and explicit screening criteria.
39. Check alternatives honour allowed crops, explicit approval and stated constraints without invented benefits.
40. Preserve clarification, missing-evidence and limitation sentences when richer context is composed into chat.

**Reproducibility and sustainable execution**

41. Complete browser coverage of local SoilGrids refusal versus upstream failure; count actual upstream calls.
42. Audit cache keys, expiry and in-flight deduplication across locations and failed/cancelled requests.
43. Cover optional-model startup deterministically without removing the existing live CDN/model checks.
44. Add or strengthen deterministic field-service failure coverage while retaining real-field integration checks.
45. Prove interceptors matched; add unhandled-egress checks and guard against cached or stale-build false greens.
46. Make each new regression fail on the original defect and plausible half-fixes; verify byte restoration.
47. Keep one concise current queue and one run record per execution; avoid recursive evidence-only iterations.
48. Re-run shipped setup and verification commands from an isolated clean branch copy without touching worktrees.
49. Run final offline and four-project browser gates on identified frozen bytes; retain every failed attempt.
50. Deliver the branch-only handoff: coverage, limits, blocker/unblock conditions and exact next action.

### 13.2. Execution cycle, setbacks and finish criteria

For a confirmed defect: reproduce before fixing, make the smallest change, challenge the test,
restore byte-identically, rebuild the static output, run focused/offline/browser checks and
review the diff. Archive commands, source hashes, interpreter, actual results and failures.
Update `docs/validation.md`, the dated section-10 entry, the current handoff and evidence index
for executed iterations. This review itself is documentation/research, not a shipped iteration.

Keep the control set finite and tied to a claimed behaviour: baseline plus relevant half-fixes
and a verified restore. If the harness is faulty, invalidate affected results and repair it;
do not start an endless sequence whose sole purpose is to archive its predecessor. Keep the
last confirmation's provenance explicit without claiming it validated its own later-written log.

Use one browser suite at a time. During it, freeze application files, e2e specs, configuration
and generated assets. Both `npm test` and `npm run build` rewrite served output; never run them
mid-gate. Use a unique log/output directory and record the child's real exit code. Wait for
background completion, then read the log itself; no busy polling or notification-only verdicts.

On a quiet run, inspect the owned process, active case, elapsed time and load before declaring
it stuck. Never kill another workload. On a live outage, preserve the trace/status and run one
informative isolated check, not repeated full gates seeking green. Continue independent work
or record a precise unblock condition. A permission denial stops that operation; it is not a
reason to switch tools, identities or channels. Never raise timeouts or retries to hide a fault.

The offline suite is `node --test tests/*.test.js`. A bare `node --test` globs the repository
root, which on this tree includes gitignored control copies under `artifacts/`; measured on the
iteration-73 tree it reported 461 tests with 25 failures, every one of them inside a shelved
baseline or scratch copy, and none in the shipped suite. Re-run scoped before believing a red
that arrives in under two milliseconds with a source-text assertion.

After the prose for an iteration is final, re-run the documentation guards, the citation scout
(both passes: `--head` is a separate invocation) and the scoped offline suite to prove the
write-up broke no pin. Those re-runs are a self-check, not evidence: no ledger row is written
for output that was not archived, because a row pins bytes in an archive and inventing one is
the defect the row exists to catch.

When review/implementation is resumed explicitly, inspect existing changes and running jobs
before touching them. Commit only the reviewed work when authorised, stage explicit paths,
exclude unrelated licence normalization, and verify remote main with `git ls-remote` before
any authorised push. Push only the named feature branch, never force. Preserve verified local
work if publication is blocked. Do not commit or push as part of this review request.

The local milestone is achieved when all applicable backlog goals have evidence-backed
outcomes, no known high-impact input-loss/wrong-location/unsupported-claim defect remains,
regressions are sensitive to the defects they cover, and offline plus both-transport browser
verification and evidence reconciliation pass on the delivered bytes. Blocked required live
checks mean partial completion, never overall success. External devices/audio/agronomy retain
their explicit UNVERIFIED status. Do not inflate scope or invent fifty changes to stay busy;
continue only with demonstrated improvements, and always obey a newer pause or review request.
