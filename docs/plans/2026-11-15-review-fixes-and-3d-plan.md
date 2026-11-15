# Review fixes and 3D evidence-map plan — 2026-11-15

Written for Codex (and the team) to continue. Source: a Claude Code review of commit
8b53619 (tests, browser walkthrough, accessibility scan, licence check, source
verification). **Phase A is now implemented and verified** (app source 70eafb1):
95 offline tests, 32 local Playwright cases and 16 public cases passed. The review
baseline was 8b53619 with 95/95 tests. B4 licence/credit delivery was pulled forward
to give A6 a working link. Other Phase B/C items remain proposed until built and
verified; see section 10 of AGENTS.md and the phase-a reports in docs/evidence.

## 0. Deadline and order of work

- NASA Space Apps deadline: **Nov 15, 2026, 11:59 PM local time (Singapore, UTC+8)**.
  Only the team owner can submit in the portal; it was unsubmitted at last check.
- Phase A (before the deadline, low risk): section 2 items A1–A8, then
  `npm run test:release`, deploy, public Playwright, owner submits.
- Phase B (after Phase A is deployed): sections 3–5.
- Phase C: the 3D evidence map (section 6), on a branch and a Vercel **preview** URL.
  Keep production equal to the submitted version until judging ends, unless the user
  decides otherwise and the Space Apps rules allow post-deadline changes.
- User decisions already made on 2026-11-15: **MIT licence** for the team's own code
  (copyright holder "Team Explorer"); deploy after the full release suite passes.
  Reconfirm before pushing if the scope has changed since.

## 1. What the review measured (evidence for the tasks below)

| Check | Result |
| --- | --- |
| `npm test` | 95/95 pass |
| `npm run test:e2e` (static/Node × desktop/mobile) | 16/16 pass |
| axe-core 4.10.2, WCAG 2.2 AA + best practice, 10 states (initial, evidence, plan, compare, chat × laptop/phone) | 0 violations |
| Public site vs local build | Identical behaviour, no 4xx/5xx, no script errors |
| Country→region→town dropdowns (Australia → WA → Perth) | Works in both viewports |
| Usable content height at 200% zoom (683×384 / 640×360) | **78 px / 54 px** (20% / 15% of screen) |
| Phone landscape 844×390 | **127 px** (33%) |
| Chat: click Send, then Escape | Focus drops to `<body>`; Escape no longer closes chat |
| Example regions → "Find mapped fields" | Cambridgeshire 23, York WA 4, **Ames 0, Naivasha 0** |
| Countries able to produce a comparison (≥2 screened crops) | **89 of 197**; Singapore, Brazil, Vietnam, Nigeria cannot |
| Deck slide 4 | Shows UK "Sweet corn → Garden pea → Radish", 0 family repeats; **not reproducible** (radish has no FAOSTAT category; UK offers bean + pea only) |
| Overpass probe (±0.02°) | Ames 8 fields, Naivasha 3 (vs 0 today) but 30–36 s; York 504 on overpass-api.de (53 s) and overpass.private.coffee (115 s) |

## 2. Phase A — fix before submitting

A1. **Deck slide 4 must be reproducible.** Change the example in
`scripts/prepare-submission.js` (currently `baseline:['sweet-corn','pea','radish']`
at 52.19, 0.09) to inputs a judge can enter in the current app, e.g. Australia →
Western Australia → a town, baseline Sweet corn → Garden pea → Bush snap bean. Use the
live engine result, rename "day-slots" to "days", regenerate the deck HTML, the
exactly-7-page PDF (`scripts/render-deck.js`), the source ZIP
(`scripts/package-source.py`) and the manifest. Reconcile model timing figures: slide 5
says 3.26 s / 0.16 s cold/warm, submission.md says 903 ms / 652.6 ms. Use one dated
measurement and label it.

A2. **Example regions that find no fields.** `public/index.html` lines 57–60 and the
`countryCode` map in `public/js/app.js` (example-location change handler). Move Ames
and Naivasha to nearby rural points that return ≥3 complete farmland ways with the
current ±0.01° OSM request, verified in both runtimes. Record coordinates and the
retrieval date in docs/data-sources.md. Add a Playwright check (section 5).

A3. **Unlabelled uncertainty.** `server/agronomy/rotation.js` sets
`uncertainty: 'High — local agronomic validation…'`, rendered alone by
`public/js/modules/strategy.js`. Make it read "Uncertainty: high — …". Existing
assertions only need `/local agronomic validation.*unavailable/` and
`/uncertainty|High.*local agronomic validation/is`.

A4. **Coverage honesty in the submission text.** State the number: 89 of 197 countries
can produce alternatives today (or the new number after B1). Make sure demos use a
covered country. The submission text and deck also say radish is in the catalog; say
radish has no FAOSTAT category, so country lists never offer it.

A5. **AI disclosure.** Add to docs/submission.md, public/submission/submission-text.txt
and any portal copy: "Claude Code (Anthropic) was used on 2026-11-15 to review the app
(automated tests, accessibility audit, licence check, source verification) and to
write the follow-up plan." Add anything else that is actually used.

A6. **Footer.** `public/js/app.js` line 13 shows "Browser showcase mode" to every
visitor. Replace with plain text such as "Runs in your browser · no account needed".
Keep "Node.js testing mode" for Node (scripts/node-browser-validation.js asserts
`/Node.js testing/`). Add "Not affiliated with or endorsed by NASA." and a
"Licences & credits" link (see B4).

A7. **Chat focus.** In `public/js/modules/chat.js` the submit handler disables `#ask`;
if it had focus, focus falls to `<body>`. Move focus to `#question` before disabling
(or use `aria-disabled`). Escape must close the panel and return focus to
`#chat-toggle` after a mouse send too.

A8. **Short-viewport layout (zoom, phone landscape).** `public/css/app.css` makes
`body` a 100dvh flex column with `overflow:hidden`; header, tabs, step bar and footer
never scroll. Under `@media (max-height: 560px)`: let the page scroll normally
(`body{height:auto;overflow:visible}`, `main{overflow:visible}`), keep
`.workflow-navigation` `position:sticky;bottom:0`, remove `.location-controls`
max-height, and in `public/js/lib/tabs.js` reset window scroll as well as
`main.scrollTop`. Acceptance: at 683×384, 640×360 and 844×390 the area not covered by
fixed/sticky elements is ≥60% of the viewport, Next stays reachable, and there is no
horizontal scroll. This is a functional accessibility fix within the approved design,
not a restyle.

## 3. Phase B — data: widen crop coverage with verified sources

B1. Add **tomato, cabbage and bulb onion** to the screening catalog. Mapping FAO items
388 Tomatoes, 358 Cabbages and 403 Onions and shallots, dry raises comparable countries
from **89 to 166 of 197**. Singapore gains cabbage + tomato; UK, India, Kenya gain five
crops; Brazil (onion, tomato) and Vietnam (cabbage, onion) become comparable. Countries
still below two: AF, BI, CF, CK, ER, FM, FO, GA, GM, GQ, GW, KH, KI, KM, LA, LS, MH, MM,
MO, MR, NC, NU, SB, SC, SS, SZ, TD, TO, TV, VC, WS.

Verified quotes (fetched 2026-11-15 with the WebFetch tool; re-verify before release.
UMN pages return HTTP 403 to automated clients, so do not spoof user agents):

- Clemson HGIC 1323 Tomato, revised 2022-03-02, https://hgic.clemson.edu/factsheet/tomato/ —
  "Depending on the cultivar, it takes 52 to 90 days to reach the first harvest.";
  "maintain a soil pH between 6.0 and 6.5"; "Choose a well-drained site…";
  "grow best at 70 to 80 °F during the day and 60 to 70 °F during the night".
- Clemson HGIC 1303 Cabbage & Chinese Cabbage, updated 2023-01-23,
  https://hgic.clemson.edu/factsheet/cabbage-chinese-cabbage/ — "Cabbage should be ready
  for harvest 60 to 80 days after planting transplants."; "Soil pH should be 5.8 to
  6.5."; "a well-drained sandy loam with high organic matter content is preferred.";
  "They grow best at temperatures of 60 to 65 °F."; "Mature cabbages can withstand
  temperatures as low as 18 to 20 °F."
- Utah State University Extension, How to Grow Onions in Your Garden, May 2020,
  https://extension.usu.edu/yardandgarden/research/onions-in-the-garden — "Bulb onions
  require 100-120 days to mature." (seed/set/transplant basis not stated); soils
  "well drained".
- Clemson HGIC 1314 Onion, Leek, Shallot & Garlic, updated 2023-01-20,
  https://hgic.clemson.edu/factsheet/onion/ — "The ideal pH is between 6.2 and 6.5.";
  "A fertile, well-drained, loamy soil … is best"; "Late plantings are more susceptible
  to cold or freeze injury."
- NC State Extension AG-12, 2023-10-06,
  https://content.ces.ncsu.edu/home-vegetable-gardening-a-quick-reference-guide —
  cool-season crops "are cold-hardy … below 70°F" (list includes cabbage, onions, peas,
  radishes); warm-season crops "are frost sensitive … above 70°F" (beans, corn,
  tomatoes).
- Cornell (already cited, updated 2023-12-20) — Nightshade family includes tomato,
  Brassica includes cabbage and radish, Allium includes onion.

Ready-to-apply catalog entries (`server/agronomy/crops.json`; add the five sources with
ids clemson-tomato, clemson-cabbage, clemson-onion, usu-onion, ncsu-seasons):

```json
{ "id": "tomato", "name": "Tomato", "aliases": ["tomatoes"], "family": "Solanaceae",
  "maturityDays": [52, 90], "frostTender": true, "idealAirC": null, "legume": false,
  "soilPhRange": [6, 6.5], "requiresWellDrainedSoil": true,
  "sourceIds": ["clemson-tomato", "ncsu-seasons", "cornell-rotation"],
  "notes": ["Clemson gives 52–90 days to first harvest depending on cultivar, without stating seed or transplant timing; seedling time before transplanting is outside this slot.",
            "Warm-season and frost-sensitive (NC State). Clemson cites best growth at 70–80 °F days and 60–70 °F nights; no daily-mean heat rule is derived from that here."] },
{ "id": "cabbage", "name": "Cabbage", "aliases": ["cabbages", "head cabbage"], "family": "Brassicaceae",
  "maturityDays": [60, 80], "frostTender": false, "idealAirC": [15.5555555556, 18.3333333333], "legume": false,
  "soilPhRange": [5.8, 6.5], "requiresWellDrainedSoil": true,
  "sourceIds": ["clemson-cabbage", "ncsu-seasons", "cornell-rotation"],
  "notes": ["Clemson gives 60–80 days after planting transplants; seedling time before transplanting is outside this slot, and direct-seeded timing is not stated.",
            "Cool-season and cold-hardy (NC State). Clemson cites best growth at 60–65 °F; days above that range indicate heat exposure, not a damage prediction. Cold-induced bolting is not modelled."] },
{ "id": "onion", "name": "Bulb onion", "aliases": ["onion", "onions", "bulb onions", "dry onion", "dry onions"],
  "family": "Amaryllidaceae", "maturityDays": [100, 120], "frostTender": false, "idealAirC": null, "legume": false,
  "soilPhRange": [6.2, 6.5], "requiresWellDrainedSoil": true,
  "sourceIds": ["usu-onion", "clemson-onion", "ncsu-seasons", "cornell-rotation"],
  "notes": ["Utah State gives 100–120 days for bulb onions without stating seed, set or transplant timing; the day-length needs of local cultivars are not modelled.",
            "Cool-season and cold-hardy (NC State). Clemson notes late plantings are more susceptible to cold or freeze injury; winter survival is unassessed."] }
```

Code touch points (a reverted draft confirmed these are sufficient):
- `server/context/crops.js`: add `'388':'tomato','358':'cabbage','403':'onion'`; export
  the map plus a `screeningItemIds(cropId)` helper; update the FAO-proxy notice (cabbage
  type unknown; dry onions include shallots; radish has no FAOSTAT category). Update
  the `scope` string in crops.json.
- `server/agronomy/rotation.js`: the heat rule is already generic over `idealAirC`, but
  it is labelled for peas. Rename `peaDaysAboveIdeal` → `daysAboveIdealAir` (rotation.js,
  strategy.js, tests/rotation.test.js; rebuild the worker bundle). Make the heat risk
  message name the crop and its bound. Generate the heat, cold-tolerance and pH gap
  lists and the "retrieval recognises only …" list from the catalog so they cannot
  drift. Start each scenario's source set from nasa-power, power-resolution and
  cornell-rotation only; crops add their own sources. Rename ranking labels
  ("Days above cited ideal air range").
- `server/agronomy/conversation.js`: replace the hard-coded
  `{ 'bush-bean': ['414','423'], … radish: [] }` map with `screeningItemIds`; push the
  profile "screening limit" block only when `screeningEligible === false`; remove
  "four-crop".
- `server/agronomy/knowledge.json`: the tomato profile becomes `screeningEligible: true`,
  and its harvest text cites the Clemson 52–90 days.
- `server/agronomy/answers.js`: generate the catalog guidance crop list.
- `server/agronomy/catalog.js` `mentionedCrops`: ignore "Chinese/Napa cabbage", "bok
  choy/pak choi", "green/spring/Welsh/bunching onion" and "scallion" so they never
  inherit cabbage or bulb-onion rules.
- Tests: `tests/qa-contracts.test.js` line 86 (`/Pea days/`); add tests for the new
  entries' sources, the FAO mapping, the coverage count (166) and the exclusions.
  Re-check the QA graders for Q07/F02: India now has five screened crops.
  `tests/e2e/workflow.spec.js` uses Singapore as the zero-coverage country; move it to
  a country that still has zero screened crops but has FAO records and GeoNames points
  (e.g. KH, verify first).
- Docs: data-sources.md, submission.md (catalog size, coverage), deck.

## 4. Phase B — UX, compliance and cleanup

B2. **Step 4 information order and wording** (`public/js/modules/strategy.js`). Show the
comparison table and the three timelines first, with the ranking method inside a
`<details>`. Use plain words: "Every possible sequence of your allowed crops was
checked; fewer is better on the first criterion, ties go to the next" instead of
"Lexicographic counts… crop-ID tie-break". Show human dates ("Jan–Apr 2027") instead of
"2027-01-01 → 2027-05-01 (end excluded)", and replace "day-slots".

B3. **Evidence wording** (`public/js/modules/data-flow.js`). Display "°C" when POWER
returns unit "C" (keep raw units in the JSON download). Use month names on chart axes
and "Jan 2025" in the monthly table. Lead with the charts; keep the metadata table
below.

B4. **Licences.** Add `LICENSE` (MIT, "Copyright (c) 2026 Team Explorer (FieldShift)").
Add `THIRD-PARTY-NOTICES.md` and a shipped credits page linked from the footer:
- Leaflet BSD-2: copy `node_modules/leaflet/LICENSE` next to the vendored files in
  `scripts/build-browser.js`. Only the one-line header ships today; BSD-2 expects the
  full text.
- TensorFlow.js/WASM (Apache-2.0, loaded from jsDelivr at runtime).
- Build and test tooling.
- Data licences (GeoNames CC BY 4.0, OSM ODbL, FAOSTAT CC BY 4.0 + terms, ISRIC CC BY
  4.0, ABS, GBIF per record, extension sources).

B5. **OpenStreetMap read path.** Field outlines come from
`https://api.openstreetmap.org/api/0.6/map.json` (`server/context/farms.js`). OSM's API
usage policy reserves that API for editing and names data-viewing apps as forbidden
heavy use. Move to Overpass:
- Query: `way["landuse"~"^(farmland|orchard|vineyard|plant_nursery)$"](S,W,N,E);out meta geom;`.
  `normalizeFarms` already accepts `way.geometry`.
- Use a ±0.02° box, a 25 s timeout, and one fallback endpoint.
- Add the Overpass hosts to the CSP `connect-src` in vercel.json.
- Update `tests/context.test.js` line 32.

Today's probe showed slow responses and 504s (section 1), so do this after the
submission and show a clear retry state. Never substitute fields.

B6. **Unused code and CSP.** `public/js/modules/llm-worker.js` and `candidate-worker.js`
load `@huggingface/transformers` but nothing references them. Remove them from the
shipped build (or document them as dev-only) and drop the Hugging Face hosts from CSP.

B7. **Small accessibility items.** Wrap the "→"/"←" glyphs in Next/Back (set in
`tabs.js`) in `<span aria-hidden="true">`. Add a favicon (an inline SVG data URI avoids
the current `/favicon.ico` 404).

B8. **CSS hygiene.** Line 1 of `app.css` still says the design awaits review, which
contradicts the recorded approval. Merge the three override layers into one sheet with
tokens. Compare screenshots before and after at 1366×768, 1280×1000 and 390×844; no
visual change is intended.

## 5. Phase B — test flow gaps

Add to `tests/e2e/` (all run by `npm run test:release`). Use `getByRole`/`getByLabel`
in new tests so broken labels fail tests:
1. **Human path:**
   - Country → region → town dropdowns.
   - Example region → mapped fields (≥1) → select a field → details shown.
   - One place search per run (Nominatim policy: ≤1 request/s, no autocomplete).
   - Map click sets coordinates.
   - Finish with a comparison that includes a new crop.
2. **Accessibility:** add `axe-core` 4.10.2 as a pinned devDependency (MPL-2.0,
   test-only; tell the user). Scan initial, evidence, plan, compare and chat in all four
   projects and require zero violations.
3. **Zoom/landscape:** viewports 683×384, 640×360 and 844×390, with the A8 acceptance
   checks.
4. **Chat focus:** click Send → focus stays in `#question`; Escape closes the panel and
   focus returns to `#chat-toggle`.
5. **Model on:** the release suite unloads the model in every QA case. Add one case
   that loads it (jsDelivr) and runs Q01, Q03 and Q16 with the existing graders.
6. **Examples:** each example region returns ≥3 fields (after A2/B5).

## 6. Phase C — 3D evidence map ("globe to field")

### Purpose

Make scale and evidence visible in a way judges and farmers remember, without
decoration. The story the view must tell: **one NASA POWER value describes a 0.5° ×
0.625° area (1° × 1° for solar); here is that area on Earth, its terrain, the
neighbouring cells, and the field inside it.** Every visual encodes real data with a
legend, units, date, resolution and source.

### Fit with AGENTS.md rules

- **Placement:** it lives inside module 02 Geospatial Map, linked to 03 Data Flow and
  04 Strategy. It is **not** a fifth module.
- **Fallback:** Leaflet 2D remains the default and the fallback. 3D loads only when the
  user opens it.
- **New dependency:** propose **MapLibre GL JS** (BSD-3-Clause; supports globe
  projection, terrain from `raster-dem`, `fill-extrusion` and raster overlays). Pin an
  exact 5.x version at least two weeks old, vendor it through `scripts/build-browser.js`
  like Leaflet, and lazy-load it. Rule 7 says to get the user's approval of the
  dependency with measured size and memory at gate V0.
- **Rejected options:** CesiumJS (size; default terrain needs an ion account), deck.gl
  (extra layer and size) and raw Three.js (more custom code). Revisit only with a
  written reason.
- **No fake data:** no interpolation or smoothing between cells unless the resampling
  is documented and labelled as derived. Imagery layers are labelled as imagery, not
  measurements.

### Layers (each must carry `{id, product, units, period/date, spatialResolution, retrievedAt, kind: estimated|imagery|derived, missingness, attribution, url}`)

1. **Globe and basemap.**
   - Use NASA GIBS imagery (e.g. Blue Marble or MODIS corrected reflectance) at globe
     and regional zoom, and OSM raster tiles at field zoom.
   - GIBS WMTS needs no key.
   - Verify layer IDs, maximum zoom and dates from GetCapabilities before relying on
     them.
2. **NASA POWER grid cells as true-size columns.**
   - Show the selected cell and, if the POWER regional API supports it, its 3×3
     neighbourhood. Verify bounding-box limits, endpoints, parameters and rate guidance
     live.
   - If regional retrieval is unsuitable, show only the selected cell. Never fabricate
     neighbours.
   - Height and a colour-blind-safe sequential colour encode one metric (monthly rain
     mm, mean T2M °C or solar MJ/m²/day), from a zero baseline with a labelled scale.
   - Missing values: no column plus a hatched outline. Never treat missing as zero.
   - A month slider (native `<input type="range">` with a visible value) drives the
     columns and the existing monthly table together.
3. **Terrain.**
   - Use an SRTM-derived DEM. Candidate: AWS Open Data Terrain Tiles (terrarium encoding,
     keyless; verify the licence and attribution text, which credit SRTM/NASA among
     others).
   - Add hillshade.
   - Vertical exaggeration control defaults to ×1, with the current factor always
     visible.
   - The challenge brief lists SRTM, so this is a NASA-data fit.
4. **Field on terrain.**
   - Drape the OSM field polygon.
   - Compute slope and aspect for the selected field from DEM pixels inside it, as a
     derived indicator, with the actual DEM resolution at that zoom.
   - Show it as context (e.g. "steeper slopes need local erosion review"), never an
     erosion prediction.
5. **NASA GIBS overlays.**
   - Candidates: MODIS NDVI, SMAP L4 surface soil moisture, IMERG precipitation, MODIS
     land-surface temperature.
   - Use the GIBS colormap legend and a date selector limited to available dates.
   - Show the resolution label and "imagery for visual context; values not extracted"
     unless a real value service is integrated and tested.
6. **Link to step 4.**
   - Clicking a crop slot in a scenario timeline sets the 3D month range to that slot's
     historical analogue window.
   - The columns show the same numbers the strategy result used. Assert equality in
     tests.

### Architecture

- **Frontend:** `public/js/modules/map3d.js` (lazy-loaded) plus small pure helpers for
  cell bounds (antimeridian-safe), DEM decoding (terrarium: `R*256 + G + B/256 − 32768`)
  and slope.
- **Shared adapters** (used by both the Node API and the browser worker, as the dual
  runtime requires): e.g. `server/nasa/power-regional.js`, `server/context/terrain.js`,
  `server/context/gibs.js`. These cover caching, dates and validation.
- **CSP** (`vercel.json`): add only verified hosts (GIBS, terrain tiles).
- **Delivery:** branch `feature/3d-evidence-map`; deploy to a Vercel preview URL.

### Rules against AI slop for 3D

- No auto-rotating globe, starfield, glow, bloom, particles or idle animation.
- The camera moves only on user action.
- With `prefers-reduced-motion`, use instant jumps instead of fly-tos.
- Keep the approved dark green/cream system.
- Show the design to the user (screenshots) before any styling pass.

### Accessibility and performance

- The canvas gets an `aria-label`. A synchronised text summary and table carry every
  value shown.
- All controls are native, labelled HTML. MapLibre keyboard handlers stay enabled.
- If WebGL is unavailable, show a message and the 2D map.
- On small screens, default to 2D with an opt-in.
- Measure, don't claim:
  - lazy chunk size;
  - time from opening 3D to interactive;
  - frame rate while panning;
  - peak memory, on the development machine and on one real phone if available.

### Tests (Playwright + node:test)

- **Rendering:** opening 3D renders a non-blank canvas (pixel variance). Legend and table
  values equal the evidence values for the selected month. The slider changes column
  heights; expose rendered feature properties for tests.
- **Fallbacks:** if WebGL is disabled (override `getContext` or Chromium flags), the 2D
  map and a message appear. If terrain or GIBS tile requests are aborted, a visible
  notice appears and the rest keeps working.
- **Accessibility and policy:** reduced motion is respected; axe passes on the controls;
  there are no CSP violations.
- **Unit tests:** cell bounds, including near ±180°; DEM decoding; slope on a synthetic
  grid.

### Gates

| Gate | Build | Must pass |
| --- | --- | --- |
| V0 spike (½ day) | Vendored, lazy-loaded MapLibre; globe + OSM raster + terrain at one fixture; verify POWER regional, GIBS IDs/dates and terrain licence | docs/3d-feasibility.md with measured size, memory and fps; user approves dependency and direction |
| V1 | POWER cell columns + month slider + legend + table sync | Values equal evidence table; missing shown as missing |
| V2 | GIBS overlays with dates, legends, resolution | Dates come from GetCapabilities; imagery labelled |
| V3 | Field drape + derived slope/aspect | Unit tests; DEM resolution shown |
| V4 | Step-4 slot ↔ month-range link | Same numbers as the strategy result |
| V5 | Accessibility, performance, mobile, docs, design review | Full `npm run test:release` + new 3D specs; user signs off on visuals; then preview → production decision |

## 7. Handoff rules

- Update AGENTS.md section 10, docs/decisions.md and docs/validation.md after each
  substantive change, with the commands actually run and their results.
- Keep "proposed", "tested", "unverified" and "blocked" separate. Do not mark this plan
  complete until each item is implemented and verified.
- The scratch audit scripts used in this review (axe scan, zoom metrics, field probes)
  lived outside the repository. Recreate them as Playwright specs per section 5.
