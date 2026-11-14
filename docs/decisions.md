# FieldShift decisions

## Current accepted user decisions — supersede the earlier G0 plan

- **Browser-only on Vercel.** All provider retrieval, normalisation, caching,
  deterministic agronomy and model inference run in local browser workers.
  `npm run build` emits static `dist/client`; no API functions or credentials.
  The Node adapter remains only for tests/development. Device-local IndexedDB
  caches preserve original retrieval dates. Direct CORS-enabled source calls were tested.
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
