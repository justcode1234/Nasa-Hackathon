# FieldShift

Browser-only crop-rotation decision support for NASA Space Apps 2026. Team **Explorer**, Singapore. Read [AGENTS.md](AGENTS.md) and the later user decisions in [docs/decisions.md](docs/decisions.md).

## Run

Requires Node.js 22+ for building/local preview; the deployed app has no Node backend.

```sh
npm ci
npm run start
```

The command builds and opens the app in your browser. Re-running it reuses this project's preview and opens it again; an unrelated app keeps its port and FieldShift chooses the next free one. Default: http://localhost:3000. `NO_OPEN=1` disables automatic opening. In PowerShell with npm.ps1 blocked, use `npm.cmd run start`.

## Vercel

```sh
npm run build
```

Import this repository into Vercel: framework **Other**, build **npm run build**, output **dist/client**. The checked-in `vercel.json` contains these settings and security headers. No API keys, environment variables, serverless functions or database are needed. See [deployment status and instructions](docs/deployment.md). No public production URL is claimed without a verified deployment.

## Workflow

1. Search a town/region/country or choose an example region. Find nearby OpenStreetMap farmland and choose a mapped field from the outline or dropdown. Coordinates remain an optional precise input.
2. Load a historical NASA POWER year. Inspect real daily source metadata, monthly charts, missing days and downloadable observations. Regional soil estimates load independently.
3. Choose baseline crops from the selected country's recorded production list, restrict alternatives and set priorities. FAOSTAT supplies 9,238 crop records across 197 countries/areas, using latest positive production records in 2020–2024. Missing coverage stays empty. Only country categories with starter rules can form alternatives; fewer than two disables comparison. Optional measured soil pH/drainage can be supplied; mapped regional estimates never masquerade as a farm soil test. Published Australian irrigation history supplies context where relevant.
4. Compare the existing rotation with two alternatives over the same 12 months. Read individual criteria, risks, sources and gaps. Country pest records provide inspection leads.

Exactly four tabbed modules: **SI Model**, **Geospatial Map**, **Data Flow**, **Strategy Logic**. The approved interface is map-first, dark green and cream, with a compact sidebar and an accessible bottom-right assistant. Long evidence scrolls inside its tab; switching modules never requires scrolling down the page.

Visible workflow numbering follows the user's path: **01 Find farmland → 02 NASA evidence → 03 Plan crops → 04 Compare**. Persistent Next/Back buttons and keyboard-accessible tabs provide navigation.

## Fast local assistant

Chat renders sourced evidence immediately. A custom **29,200-parameter autoregressive word language model** loads in a worker when chat opens. Its trained weights are **116.8 KB**. It is an experimental small language model, not a general-purpose LLM or an agronomic authority. A relevance guard leaves inconclusive answers on deterministic retrieval; raw generated scientific statements are never displayed.

One actual Chrome/WASM run measured about **0.90 s cold load**, **0.65 s warm load**, **84 ms inference**, and **10 ms to the first evidence answer**. Those are development-machine measurements, not device guarantees. The model got 75/90 development selections and only 9/18 free-form selections; those tests are not crop-recommendation accuracy. See [model card](models/README.md), [training notebook](notebooks/llm_training.ipynb) and [recorded validation](docs/validation.md).

The earlier 184 MB SmolLM2 experiment and a 12.5 MB TinyStories candidate were benchmarked. They are not the default assistant: the latter failed both evidence-following checks. No cloud model inference occurs.

## Sources and limits

- **NASA POWER**: actual T2M, T2M_MAX, T2M_MIN, PRECTOTCORR and ALLSKY_SFC_SW_DWN. Temperature/rain support is nominally 0.5° × 0.625°; solar 1° × 1°. A historical year is not a forecast or climate normal. Values retain units, period, retrieval time, source URL and missingness.
- **ISRIC SoilGrids**: modelled pH, sand/clay and prediction intervals at 250 m, 0–5 cm depth. ISRIC advises against farm-level use; these are regional background, never automatically filled as measured farm inputs. There is no single observation year.
- **ABS**: Australian 2020–21 national irrigated-area and water-applied totals. ML/ha ratios are documented annual aggregates, not field irrigation schedules or water requirements. They are not applied to other countries.
- **OpenStreetMap/Nominatim**: community-mapped field outlines, optional crop/produce tags and place names. Missing tags stay unknown. Mapping does not prove ownership, access, available land or current crops. Grain maize is not assigned sweet-corn rules.
- **GBIF + IPPC/UF IFAS**: a small sourced host watchlist and historical country occurrences for fall armyworm/diamondback moth. Country presence is not farm presence, outbreak status or pest probability.
- **FAOSTAT QCL + UN M49**: dated national primary-crop production records drive country lists, not trade/imports or generic climate guesses. Commodity categories are broader than cultivars; green beans/peas/corn provide explicitly qualified starter-rule mappings. Absence is unknown, not proof a crop cannot grow. Full source flags, years, units, source hash, licence and reproducible extraction are included.
- **UMN/Cornell Extension**: the four sourced starter vegetables are bush snap bean, garden pea, sweet corn and radish. Source-region evidence is not worldwide validation.

Comparisons assume one field, three four-month slots, maturity upper bounds plus a disclosed 14-day harvest/turnaround allowance. They screen family repeats, calendar fit, missing evidence, frost exposure, limited heat/pH/drainage rules and rain-free exposure. They do not calculate crop water demand, fertilizer credit, pest prevention, yield gains, soil improvement, profitability or savings. Unsupported crops remain visible and unassessed.

All scientific logic runs in a browser worker. Device-local IndexedDB caches retain original retrieval times; failure never creates substitute readings. External-source availability, fair-use limits and CORS still apply. [Sources](docs/data-sources.md), [challenge fit](docs/challenge-alignment.md), [decisions](docs/decisions.md).

## Validation and development

```sh
npm test                    # offline unit / HTTP-harness / static-build / startup checks
npm run test:live            # real NASA retrieval at three contrasting coordinates
npm run test:browser         # installed Chrome/Chromium/Edge, live sources and UI
node scripts/check-sourced-context.js
node scripts/benchmark-mini-lm.js
```

Browser checks use isolated profiles and built-in Chrome debugging; no browser is downloaded. `CHROME_PATH` can override discovery. Ignored `artifacts/` contains raw reports, screenshots and profiles. The retained Node API adapter is a test harness; production uses static files and browser-worker messages, with no `/api` network requests.

Actual browser training: `node scripts/build-mini-corpus.js` then `node scripts/train-mini-lm.js`. Rebuild afterward. The corpus has explicitly labelled synthetic question wording and source-linked continuations, no fabricated NASA observations. Python/Jupyter inspection and guarded training/reproduction paths are in [notebooks](notebooks/README.md). Pretrained fine-tuning and Keras export are separate, unexecuted experiments.

## Submission

The seven-slide HTML/PDF, submission copy, citations, AI disclosure and source archive are under `public/submission/`; the app footer links to them. [Handoff](docs/submission.md) identifies the Explorer/Singapore team page and final portal steps. A team-account submission and NASA acceptance are never implied by preparing files.

Codex assisted implementation, research organization, tests, documentation, model experiment code and submission preparation. Runtime rules and source facts are deterministic; the compact model supplies guarded evidence assistance. This is an independent prototype, not an official NASA product.
