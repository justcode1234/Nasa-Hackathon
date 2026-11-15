# FieldShift

Crop-rotation decision support for NASA Space Apps 2026, with a **Node.js testing mode** and a **browser-only Vercel showcase**. Team **Explorer**, Singapore. Read [AGENTS.md](AGENTS.md) and the current user decisions in [docs/decisions.md](docs/decisions.md).

## Run

Before publishing behavior changes, run `npm run test:release` (offline logic tests
and Playwright flows for both runtimes at desktop/mobile widths). See the
[Playwright checks](docs/playwright.md) for coverage, reports and public verification.

Requires Node.js 22+. Both modes use the same NASA adapters, sourced catalog and deterministic rotation engine.

```sh
npm ci
npm run start:node          # Node backend + frontend, default http://localhost:3001
npm run start:showcase      # static browser-only showcase, default http://localhost:3000
```

Run either command in its own terminal to use both at once. Node mode serves source files and real `/api` endpoints; the frontend sends validated planning inputs to the Node backend. Showcase mode builds static files and performs retrieval/calculations in a browser worker. The footer identifies the active mode. Re-running a command reuses only the matching project's runtime; unrelated applications and the other mode keep their ports. `PORT` overrides the preferred port; `NO_OPEN=1` disables automatic browser opening. In PowerShell with npm.ps1 blocked, use `npm.cmd`. `npm start` retains the showcase workflow. `npm run dev:node` watches the Node testing server.

## Vercel

```sh
npm run build
```

The existing showcase origin is [nasa-hackathon-three.vercel.app](https://nasa-hackathon-three.vercel.app/). See the [deployment record](docs/deployment.md) for release verification. Vercel settings are framework **Other**, build **npm run build**, output **dist/client**; the checked-in `vercel.json` includes security headers. No API keys, environment variables, serverless functions or database are needed. Local testing uses the separate Node command above.

## Workflow

1. Choose a country, optionally filter by region, then choose a town/city without typing a place name. The sourced GeoNames extract includes 70,036 places across 245 countries/areas; it does not include every rural settlement. Search, example regions, map selection and coordinates remain available. Find nearby OpenStreetMap farmland and choose a mapped field from the outline or dropdown.
2. Load a historical NASA POWER year. Inspect real daily source metadata, monthly charts, missing days and downloadable observations. Regional soil estimates load independently.
3. Choose baseline crops from the selected country's recorded production list, restrict alternatives and set priorities. FAOSTAT supplies 9,238 crop records across 197 countries/areas, using latest positive production records in 2020–2024. Missing coverage stays empty. Only country categories with starter rules can form alternatives; fewer than two disables comparison. Optional measured soil pH/drainage can be supplied; mapped regional estimates never masquerade as a farm soil test. Published Australian irrigation history supplies context where relevant.
4. Compare the existing rotation with two alternatives over the same 12 months. Read individual criteria, risks, sources and gaps. Country pest records provide inspection leads.

Exactly four tabbed modules: **SI Model**, **Geospatial Map**, **Data Flow**, **Strategy Logic**. The approved interface is map-first, dark green and cream, with a compact sidebar and an accessible bottom-right assistant. Long evidence scrolls inside its tab; switching modules never requires scrolling down the page.

Visible workflow numbering follows the user's path: **01 Find farmland → 02 NASA evidence → 03 Plan crops → 04 Compare**. Persistent Next/Back buttons and keyboard-accessible tabs provide navigation.

## Fast local assistant

Ask about a crop and country directly: “rice in India”, “wheat in Australia” or
“kai lan in Singapore”. Answers stay short, with separate growing/harvest/country
evidence follow-ups and expandable sources. A country named in chat does not change
the map or borrow weather from another country. Cultivation coverage is limited;
missing crop-country rules remain explicit.

To have chat carry out the workflow, ask “Help me plan a rotation in India. Crops:
rice, wheat, beans.” It asks which part of India or the whole country, with both
choices available. Whole-country mode shows national crop context without inventing
a country-wide weather reading or planting calendar. Specific-area mode accepts a
state/region, then a town, mapped field or explicit coordinates. It retains the
supplied three-crop sequence across these choices, loads historical
NASA evidence, runs the same comparison engine and opens step 4. You can select a
returned field by button, field number or its current OSM way ID. Missing crops are
never filled automatically. Unsupported crops remain unassessed; alternatives use
the allowed screened crops. Manual form edits cancel pending actions; say “continue”
to use the current form. “Cancel” ends guided planning. Actions are fixed app code,
independent of model generation, and use no arbitrary URLs or generated code.

Chat renders sourced evidence immediately. A custom **39,274-parameter autoregressive word language model** loads in a worker when chat opens. Its trained weights are **157.1 KB**. It is experimental, not a general-purpose LLM or agronomic authority. A relevance guard can prioritize existing retrieved evidence; raw generated scientific statements are never displayed. Model-disabled chat uses the same source facts and validated actions.

The retrained model matched **14/36 new free-form development questions**, versus **8/36** before; overall **85/126**, versus **83/126**. Legacy matches decreased from 75/90 to 71/90, so the improvement is modest. One Chrome/WASM run measured **3.26 s cold load**, **0.16 s warm load**, **20 ms inference**, and **4 ms first evidence response**. These are development measurements, not crop-recommendation accuracy or device guarantees. See the [model card](models/README.md), [training notebook](notebooks/llm_training.ipynb) and [validation record](docs/validation.md).

The earlier 184 MB SmolLM2 experiment and a 12.5 MB TinyStories candidate were benchmarked. They are not the default assistant: the latter failed both evidence-following checks. No cloud model inference occurs.

## Optional 3D evidence preview

On `feature/3d-evidence-map`, choose a point and open **3D evidence map** in step 1.
It lazy-loads MapLibre; Leaflet remains the default and WebGL fallback. Native POWER
rain cells and exact tables follow the month control. Dated GIBS layers are visual
context only. Terrain has a visible exaggeration factor and explicit DEM sampling
and missingness. A supported step-4 crop-slot button opens the exact historical
rain window used in its strategy result, rather than its entire four-month slot.

This work has not been deployed. The public submission stays at Phase A, with four
screening crops and 89/197 comparable-country coverage. This feature branch has
seven screening crops and 166/197 coverage, but the real Overpass field-success
release cases still fail. Point planning remains available; that does not prove the
field selection/drape path. See [verification status](docs/3d-validation.md),
[visual review](docs/3d-visual-review.md) and [measured feasibility](docs/3d-feasibility.md).
Automatic Git deployment is disabled for this exact feature branch so it can be
synced across devices while the release gate is red. Main/production is unchanged.

## Sources and limits

- **NASA POWER**: actual T2M, T2M_MAX, T2M_MIN, PRECTOTCORR and ALLSKY_SFC_SW_DWN. Temperature/rain support is nominally 0.5° × 0.625°; solar 1° × 1°. A historical year is not a forecast or climate normal. Values retain units, period, retrieval time, source URL and missingness.
- **ISRIC SoilGrids**: modelled pH, sand/clay and prediction intervals at 250 m, 0–5 cm depth. ISRIC advises against farm-level use; these are regional background, never automatically filled as measured farm inputs. There is no single observation year.
- **ABS**: Australian 2020–21 national irrigated-area and water-applied totals. ML/ha ratios are documented annual aggregates, not field irrigation schedules or water requirements. They are not applied to other countries.
- **OpenStreetMap/Nominatim**: community-mapped field outlines, optional crop/produce tags and place names. Missing tags stay unknown. Mapping does not prove ownership, access, available land or current crops. Grain maize is not assigned sweet-corn rules.
- **GeoNames**: dated, country-sized town lists and administrative-region names, with source hashes and CC BY 4.0 attribution. Country selection clears the old point; town selection sets a gazetteer coordinate, not a farm boundary. Smaller places may need search or map selection. The largest current country file is about 454 KB and loads only when that country is chosen.
- **GBIF + IPPC/UF IFAS**: a small sourced host watchlist and historical country occurrences for fall armyworm/diamondback moth. Country presence is not farm presence, outbreak status or pest probability.
- **FAOSTAT QCL + UN M49**: dated national primary-crop production records drive country lists, not trade/imports or generic climate guesses. Commodity categories are broader than cultivars; green beans/peas/corn provide explicitly qualified starter-rule mappings. Absence is unknown, not proof a crop cannot grow. Full source flags, years, units, source hash, licence and reproducible extraction are included.
- **UMN/Cornell/Clemson/Utah State/NC State Extension**: this branch has screening rules for bush snap bean, garden pea, sweet corn, radish, tomato, cabbage and bulb onion. Commodity/cultivar and timing limitations remain explicit. Source-region evidence is not worldwide validation.

Comparisons assume one field, three four-month slots, maturity upper bounds plus a disclosed 14-day harvest/turnaround allowance. They screen family repeats, calendar fit, missing evidence, frost exposure, limited heat/pH/drainage rules and rain-free exposure. They do not calculate crop water demand, fertilizer credit, pest prevention, yield gains, soil improvement, profitability or savings. Unsupported crops remain visible and unassessed.

In showcase mode scientific logic runs in a browser worker, and device-local IndexedDB caches retain original retrieval times. In Node testing mode the same logic runs on the local server with its in-memory caches. Optional model inference stays browser-local in both. Failure never creates substitute readings. External-source availability and fair-use limits apply to both; browser CORS requirements also apply to the showcase. [Sources](docs/data-sources.md), [challenge fit](docs/challenge-alignment.md), [decisions](docs/decisions.md).

## Validation and development

```sh
npm test                    # offline unit / HTTP-harness / static-build / startup checks
npm run test:live            # real NASA retrieval at three contrasting coordinates
npm run test:browser         # installed Chrome/Chromium/Edge, live sources and UI
npm run test:node-browser    # Node-backed UI, real NASA and injected upstream failure
npm run test:firefox         # installed Firefox, separate engine, real data and failure paths
npm run test:qa              # exact QA-plan prompts, real UI/providers, answer-by-answer report
node scripts/check-sourced-context.js
node scripts/benchmark-mini-lm.js
```

Browser checks use isolated profiles and built-in Chrome debugging; no browser is downloaded. `CHROME_PATH` can override discovery. Ignored `artifacts/` contains raw reports, screenshots and profiles. Static showcase tests verify no `/api` network requests; Node browser tests verify real `/api` calls and no browser-side NASA retrieval or data-worker load.

The supplied [QA plan and automated answers](docs/qa-regression.md) have a separate
acceptance runner. It records every actual reply and condition, and currently exits
1 for nine unmet chatbot expectations. The saved [public report](docs/qa/latest-results.md)
identifies the gaps. Its temporary browser profile is removed after each run.

Firefox checks use native WebDriver BiDi with a separate temporary profile and no downloaded driver; `FIREFOX_PATH` can override discovery. Chrome process-memory snapshots are included in `node scripts/benchmark-mini-lm.js` on Windows. They count the isolated test browser and descendants, with explicit limits for shared pages and missed short-lived processes. See the [validation record](docs/validation.md).

Actual browser training: `node scripts/build-mini-corpus.js` then `node scripts/train-mini-lm.js`. Rebuild afterward. The corpus has explicitly labelled synthetic question wording and source-linked continuations, no fabricated NASA observations. Python/Jupyter inspection and guarded training/reproduction paths are in [notebooks](notebooks/README.md). Pretrained fine-tuning and Keras export are separate, unexecuted experiments.

## Submission

The seven-slide HTML/PDF, submission copy, citations, AI disclosure and source archive are under `public/submission/`; the app footer links to them. [Handoff](docs/submission.md) identifies the Explorer/Singapore team page and final portal steps. A team-account submission and NASA acceptance are never implied by preparing files.

Codex assisted implementation, research organization, tests, documentation, model experiment code and submission preparation. Runtime rules and source facts are deterministic; the compact model supplies guarded evidence assistance. This is an independent prototype, not an official NASA product.
