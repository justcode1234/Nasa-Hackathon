# FieldShift decisions

## Current accepted user decisions — supersede the earlier G0 plan

- **Improve the assistant and retrain, rather than stop at QA (2026-11-15).**
  The user expanded the earlier tests-only task to fixing the nine exposed gaps
  and improving the optional tiny language model. Scientific capability limits
  and farmer-input checks belong in the shared deterministic answer layer, before
  conversational prose. Read-only questions cannot mutate the planning form.
  Country-wide requests cannot retain point weather; combined place/coordinate
  commands verify country, named region and town proximity before loading NASA.
  Extra synthetic development wording is separate from the sixteen acceptance
  questions. Vocabulary uses training rows only; checkpoints use validation data.
  Candidate artifacts are reviewed in artifacts/mini-candidate before promotion.
  Worse candidates are rejected. Test scores are not agronomic confidence.
  Optional inference can prioritize an existing retrieved paragraph, retaining all
  text and caveats; guarded input/limit answers and workflow actions are unchanged.
- **Ask geographic scope before requesting coordinates (2026-11-15).** Country-only
  planning asks which part of the country or the whole country. Whole-country mode
  presents dated FAOSTAT context, preserves supplied crops and clears any old field
  point/evidence. It does not invent national NASA readings, a uniform calendar or
  local rotation suitability. Specific-area mode accepts sourced state/region names
  and filters the town dropdown before the existing field-comparison flow. The user
  can switch scope without re-entering crops. These are working actions, available
  as both buttons and typed replies, and apply generally across countries.
- **Conversational crop-country answers and guided execution (2026-11-15).** A
  question can name a crop and country independently of the selected map. Named
  sources, broad FAOSTAT categories and their gaps remain separate from the four
  crop screening catalog. Greetings are brief; source-backed replies expose one
  topic at a time with follow-ups. The assistant can also execute the four existing
  steps: select country/place or a currently returned OSM field, enter the farmer's
  three baseline crops and explicit constraints, load real NASA evidence and compare.
  A town is not a farm; field selection or explicit coordinates are needed. Missing
  crops and insufficient screening coverage stop the flow. Coordinate-country
  disagreement stops before retrieval. Fixed, validated action handlers run in both
  runtimes; model outputs cannot invoke code, arbitrary URLs or external actions.
  Assistant-origin form changes preserve chat; manual changes cancel pending steps.
- **Vercel identity/setup.** The user requested justcode1234 for this project and
  explicitly retained the separate 4chatgptsim account. CLI identity is verified
  before release. The checkout is linked to justcode1234s-projects/nasa-hackathon;
  Codex Vercel plugin 0.54.1 and global OAuth MCP configuration are installed.
  Active-session MCP tool discovery still requires a refreshed session. No tokens
  are committed. .vercelignore prevents local artifacts, profiles and credentials
  from being uploaded; inspect a CLI dry run before any source upload.
- **Two runtimes, explicitly requested by the user.** Use Node.js for local backend
  testing and browser-only static files for Vercel showcasing. `npm run start:node`
  serves the frontend and real `/api` routes on preferred port 3001. The command
  `npm run start:showcase` builds/serves `dist/client` on preferred port 3000;
  `npm start` retains that showcase behavior. The Node HTML entry explicitly selects
  HTTP transport; the static entry selects the browser worker. Both use the same
  adapter, normalisation, agronomy and answer modules and source contracts. Optional
  model inference remains in the browser in both. No database, account or paid
  service is added. Node uses in-memory evidence caches; the showcase also has
  device-local IndexedDB caching. Retrieval dates stay intact in either mode.
- **Map-first dark green/cream design**, explicitly selected by the user. Four
  accessible tabs replace page-length module navigation. Named places, real mapped
  fields and crop dropdowns support a non-farmer workflow; unknown field crops stay unknown.
- **Ordered workflow and country crops.** Visible steps are 01 Find farmland →
  02 NASA evidence → 03 Plan crops → 04 Compare, independent of the original
  internal module IDs. Persistent Next/Back controls move between tabs. Crop
  dropdowns and alternative checkboxes use a reproducible FAOSTAT QCL extract:
  positive latest national production records per item in 2020–2024, across
  197 countries/areas. No general crop list substitutes for missing evidence.
  Country changes remove unavailable selections and invalidate comparison.
  Broad commodity-to-starter-rule mappings are disclosed; they do not establish
  cultivar or field suitability. Fewer than two screened crops disables comparison.
  Next validates location and loads NASA evidence, then validates planning inputs
  and runs comparison; tabs still allow direct inspection of each step.
- **Browse places without knowing a name.** Country selection populates an optional
  region filter and a town/city dropdown from a GeoNames cities5000 snapshot. The
  70,036 recorded points span 245 countries/areas; they are location context, not
  agricultural evidence. Per-country files load on demand. Country/region changes
  clear prior coordinates, map marker and evidence; choosing a town sets its source
  point. No country representative point is silently selected. Missing rural places
  retain search/map/coordinate paths, and missing lists show explicit states.
- **Published soil/water context.** SoilGrids modelled properties with quantiles
  are regional background only: ISRIC advises against farm-level use. ABS 2020–21
  national irrigation figures are explicitly historical aggregate practice, not
  farm schedules. Regional estimates never auto-fill measured farm pH/drainage.
- **Fast custom language-model experiment.** The shipped Mini model is a 29,200-
  parameter word-level autoregressive LSTM, trained in browser TensorFlow.js/WASM.
  Its 116.8 KB weights replace the large default download. Actual next-word training,
  saved artifacts, browser inference and developer-only generation were executed.
  It is not a general-purpose LLM or a classifier relabelled as one. Development
  wording/split limitations and weak free-form results remain explicit. Sourced
  answers render before inference; guarded/inconclusive model selections cannot
  create scientific claims or actions. See models/README.md and llm_training.ipynb.
- **Start command.** `npm run start` builds, opens the default browser, reuses this
  project's preview and selects a different port for unrelated applications.
- **Submission.** Explorer / Singapore is confirmed from the supplied public team
  page. Prepare seven slides, sources, source archive, AI disclosure and portal copy.
  Publishing to Vercel requires authenticated account access; no live URL or NASA
  submission is claimed without evidence. Earlier private Sites exploration was
  abandoned, never published, and its adapter/manifest removed.

The historical planning and first-pass notes below are retained as history. They
do not override these later user-approved changes.

## Resumed implementation audit — 2026-11-14

- Preserve the existing static showcase delivery and recorded approved design instead
  of replacing working code with the historical G0 skeleton. No new framework,
  dependency, model download or CSS polishing is introduced by this audit.
- Country identification belongs to a location revision. Only requests within that
  revision may share a pending lookup; old results cannot select the new location's
  country or clear its pending task. A NASA submission waiting on identification
  stops when the user changes inputs.
- Startup tests own temporary static files and verify preview identity by directory.
  They do not rely on another test having built the app. The production default
  directory remains `dist/client`.
- Browser validation builds and uses the static preview, matching the real start
  path and Vercel headers. Separate Node-backed browser validation exercises the
  HTTP frontend as requested in the later dual-runtime decision.
- A second G4 pass added native Firefox/BiDi checks and Windows process-tree memory
  snapshots. The checks exercise the actual static build and optional-model failure
  recovery; no browser, driver or new model is downloaded. Memory bookkeeping has
  offline tests and preserves raw counters beside derived phase totals.
- G4 remains partial for real mobile devices, Safari/WebKit, independent agronomy
  and exact full-session peak memory. G5 publication/account work and any new CSS
  direction remain deferred.
- **Architecture clarification resolved:** the user requested “do both, one for
  testing with node.js and one for showcasing on vercel.” The Node frontend now
  calls the backend instead of silently using the showcase worker. Preview identities
  include runtime type, so starting both or restarting one cannot reuse the wrong mode.
- Unspecified `corn` or `maize` no longer aliases the sweet-corn starter record.
  Baselines preserve these names as unassessed. Questions use shared phrase matching
  for explicit sweet-corn names and explain the catalog gap for other maize types.

## G0 specification — 2026-11-14

The initial checkout contained only AGENTS.md and .gitattributes. Use Node 22+
HTTP, fetch, and node:test; vanilla ES modules; locally served Leaflet 1.9.4.
No credentials, database, remote language model, or browser model download.
Keep exactly four modules and minimal functional CSS. Public deployment and
visual polishing remain later gates under the repository instructions.

### Shared contract, version 1

- `GET /api/crops`: sourced starter records and a source registry.
- `GET /api/observations?latitude=&longitude=&year=`: a single complete historical
  calendar year (2001 through last completed UTC year); selected coordinate,
  requested period, retrieval timestamp, latest available date per parameter,
  provider metadata, units, source resolution, daily values with null missingness,
  monthly derived summaries, source URL, and notices. This is historical evidence,
  not a forecast or a claim that the latest observation globally was requested.
- `POST /api/compare`: latitude, longitude, referenceYear, planningYear, startMonth,
  exactly three baseline crop IDs/names, allowedCrops, previousCrop (optional),
  irrigation (unknown/rainfed/available), soil (unknown/sandy/loam/clay),
  pestHistory (optional free text), priority (climate/family/short-season).
  Coordinates and inputs are validated server-side; the server retrieves evidence
  itself. No client-supplied NASA values or tool URLs are trusted.
- Returns the same observations plus deterministic engine output: baseline,
  two distinct screened alternatives, equal dated timelines, criteria counts,
  crop-window indicators, status, reasons, risks, gaps and source IDs.
- `POST /api/ask`: the same inputs plus question; returns a deterministic answer,
  traceable sources and limitations. The browser retains the last comparison inputs
  and clears them when location or constraints change. No conversational AI is claimed.

### Minimal planning assumptions

One field, 12 months, three equal four-calendar-month slots. A crop starts on the
first day of each slot. Source maturity upper bound plus 14 days for harvest and
turnaround (explicit planning assumption) must fit the slot. Remaining time is
unallocated, not assumed bare fallow. Baseline is never silently altered; names
outside the catalog remain visible and unassessed. Alternatives use only the
farmer's allowed catalog crops; at least two must be allowed to make distinct
comparisons possible. Previous crop adds a family check at the first boundary.

The starter dataset covers four vegetable types with Minnesota extension evidence,
not worldwide crop validation. Temperature and rain screening map each planned
crop day to the same month/day in one historical year, wrapping December/January.
Leap-day lookup uses February 28 and is disclosed. This cannot establish climate
normals, extreme probabilities, local sowing windows, soil temperature, land use,
future weather, profitability, irrigation sufficiency or pest control.

Ranking is lexicographic counts, never a confidence or yield score. Unknown evidence
and calendar/frost concerns are considered before priority tie-breaks. Pea days
above the cited ideal temperature range are an indicator, not proof of failure.
Family repetition counts all earlier occurrences within the horizon, not only
adjacent crops; a one-year family break is not adequate evidence of pest prevention.
The short-season priority compares summed maturity upper bounds, not water savings.
Rainfall and irrigation limitations are shown without calculating water demand:
crop coefficients, ET, soil storage, runoff and irrigation amounts are absent.

### Gate checks

G1: live POWER requests at contrasting coordinates, units and fill handling;
HTTP validation and missing upstream responses. G2: repeatable ranks, equal horizons,
family checks, allowed crops, unknown baselines, calendar and missing evidence.
G3: browser workflow location → observations → comparison → sourced question;
no stale results after edits, honest empty/error states. G4: contrasting climate
and unsupported crop cases, network failures, keyboard/mobile checks. Optional
LLM benchmarks and training are deferred until evidence and suitable labels exist.

## Implementation review — 2026-11-14

- G1 live full-year POWER checks passed at Perth, Minneapolis and Nairobi; all five
  parameters had 365 non-missing values in 2025. Different coordinates produced
  different temperature series. Raw AG units were validated before calculations.
- G2 uses a source-backed four-crop catalog and lexicographic rule counts. Unknown
  baselines are preserved; restrictions constrain alternatives, not the existing
  rotation. Family repeats include non-adjacent slots and the supplied previous crop.
- G3 uses locally served Leaflet and two SVG weather charts plus exact-value tables.
  Evidence download, deterministic question answers and stale-result invalidation
  are functional. No placeholders substitute for upstream failures.
- The Sites skill was used only for its local implementation/preview workflow.
  AGENTS.md's ordinary Node host and later deployment/design gates take precedence
  over the skill's default hosted workflow. No Site was registered or deployed.
- No training corpus exists; defer the training notebook and all model binaries.
  Document experiment readiness and the unmeasured ≤300 MB / ~1 GB model targets.
  Do not add a cosmetic model loader that cannot load a verified model.
- Detailed visual design awaits a separate user-reviewed proposal. Current CSS
  supplies responsive layout, focus, forms and readable data only.
