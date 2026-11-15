# FieldShift decisions

## Current accepted user decisions — supersede the earlier G0 plan

- **Review-plan Phase A (2026-11-15, in verification).** Use a country-validated
  York/Australia submission fixture, with real NASA observations and matching deck
  and app outputs. Keep one dated model benchmark across submission materials.
  Fix Send/Escape focus and short-viewport document scrolling within the approved
  design. Ship the selected MIT code licence and third-party notices/credits early
  because the Phase A footer needs a working credits link. Verify and deploy A,
  then keep production fixed and use preview branches for B/C until the owner
  decides otherwise. MapLibre V0 approval is still a separate measured gate.
- **Playwright release checks and actionable blocked navigation (2026-11-15).**
  The user reported Next/Compare stalling with no supported alternatives and
  explicitly required Playwright flow/logic coverage. Use the installed browser,
  real production data paths and development-only @playwright/test. Every behavior
  release must pass `npm run test:release`, including both runtimes, desktop/mobile,
  failed prerequisites, recovery and the sixteen existing QA questions. A disabled
  button alone is insufficient acceptance. Distinguish unavailable source coverage
  from missing selections, retain farmer inputs during navigation, keep blockers
  visible beside Next and show source failures with a working retry. Do not invent
  unsupported crop rules to make the form proceed. docs/playwright.md records the
  current matrix and reproduction commands.
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

## Review plan and user decisions — 2026-11-15 (proposed, not implemented)

- The user chose the **MIT licence** for the team's own code (holder "Team Explorer").
  Third-party code and data keep their own licences (see the plan, B4).
- The user asked for a **3D data-visualization plan** and handed implementation to
  Codex. Proposal: a "globe to field" 3D evidence map inside module 02 (not a new
  module), using MapLibre GL JS behind a lazy toggle, with Leaflet 2D kept as default and
  fallback. Adding the dependency still needs user approval after the V0 measurements
  (AGENTS.md rule 7).
- Widening crop coverage (tomato, cabbage, bulb onion) is proposed only with the
  verified extension quotes recorded in docs/plans/2026-11-15-review-fixes-and-3d-plan.md.
  No crop fact may be added without a source.
- A partial implementation draft was reverted so main stays green. The plan file is
  the authoritative specification.

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


## Cross-device branch sync without deployment

The preview implementation remains on feature/3d-evidence-map. Its vercel.json now
sets git.deploymentEnabled to false for that exact branch only. Vercel documents
this as preventing automatic deployments for matching branch commits:
https://vercel.com/docs/project-configuration/git-configuration . This lets the
feature source/handoff be pushed for another device without bypassing the user's
green-release requirement. Main remains enabled by its existing configuration;
no production branch or alias setting is changed. A future preview still requires
the complete release gate, then deliberate deployment/re-enablement. CLI identity
was rechecked as justcode1234; linked project and team IDs match the established
nasa-hackathon project. Preserve the separate 4chatgptsim account. No credentials
were read or stored. The push and post-push deployment check are pending here.


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


## Field lookup, voice and typed-judgment decisions - 15 November 2026 (Claude Code session)

**Field lookup.** Diagnosis: overpass-api.de was returning correct fields in about
26-27 s while the client abandoned each service after 25 s, in sequence; its status
endpoint also returned "at capacity ... retry using exponential backoff". The lookup
now overlaps three public Overpass services (overpass-api.de, overpass.private.coffee,
maps.mail.ru/osm/tools/overpass), gives each up to three attempts with exponential
backoff, and shares one 75 s deadline. The first complete real response wins. Nothing
is substituted when every service fails; the app shows Retry. maps.mail.ru is a
long-standing public Overpass instance listed by the OSM community; it was added to
both CSPs. These are shared volunteer services, so availability is still not
guaranteed. Browser tests press the app's Retry button like a user (at most twice),
record the number of retries, and still require real fields.

**Voice input (speech to text).** Whisper tiny.en, ONNX export
onnx-community/whisper-tiny.en pinned at revision 794207f, q8 files (43.5 MB measured
download). OpenAI's model card states the .en checkpoints are English-only. Runtime:
Transformers.js 4.3.2 with ONNX Runtime Web, shipped from this origin under
public/vendor/transformers (587 KB script, 53 KB loader, 26.9 MB WASM) and fetched
only after the mic is pressed. 3.8.1 was rejected because npm audit flags its sharp
dependency (high severity); 4.3.2 audits clean. A cross-origin import inside the
module worker was blocked by the CSP, which is why the runtime is vendored. CSP adds
only https://huggingface.co and https://us.aws.cdn.hf.co (the observed redirect host)
to connect-src. No telemetry is configured. The microphone is requested only after
an explicit click; audio is decoded and transcribed on the device; the transcript is
appended to the editable message box and never sent or executed automatically.

**Read aloud (text to speech).** KittenTTS was evaluated and not adopted: its model
card states no training data or English-only training, the advertised @kittentts/web
package still returns 404 (only an unofficial port exists), and its documented
pipeline depends on the GPL-licensed espeak phonemizer. Read aloud therefore uses
the browser's built-in speech engine, restricted to English voices with
`localService === true`, so text is not sent to a remote voice service and nothing is
downloaded. If no on-device English voice exists the app says so. It speaks the
visible answer paragraphs, including limits. There is no TTS model to unload; the
Unload button applies to the speech-to-text model. Limitation: the produced audio
cannot be captured in automated tests; tests verify the exact text, the chosen
on-device English voice and Stop. If a downloadable English-only TTS with verified
provenance and a permissive phonemizer is found later, it can replace this.

**Typed-judgment experiment (Jev-inspired, not Jev).** See models/judgment/README.md.
A 33,229-parameter TensorFlow.js Layers classifier answers three fixed questions
(app action, unsupported claim, topic) with calibrated probabilities and abstention.
On 95 held-out messages it scored 77/80/43 against 75/81/50 for the existing rules,
so it is not wired into the app. The held-out set was evaluated twice; this is
recorded. @tensorflow/tfjs 4.22.0 was added as a development-only dependency for
training in Node. Python TensorFlow is not installed on this machine, so the
notebook-based Keras route in section 5 was not used for this experiment.
