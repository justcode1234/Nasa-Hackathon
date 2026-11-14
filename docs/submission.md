# FieldShift — submission copy and handoff

**Project:** FieldShift  
**Team:** Explorer  
**Local event:** Singapore  
**Team page:** https://www.spaceappschallenge.org/2026/find-a-team/explorer36/?tab=details

## Project summary

FieldShift helps people compare crop rotations using real NASA weather evidence while keeping uncertainty visible. Search for a place, explore mapped fields, inspect historical temperature, rain and solar conditions, then compare an existing rotation with two alternatives. Every scenario shows reasons, source evidence, risks and gaps. Published soil estimates, historical irrigation statistics and country pest records add context without inventing farm measurements. A compact experimental language model runs locally in the browser, while sourced answers remain available without it. FieldShift is decision support for local review, not a guarantee of yield, water savings, soil improvement or pest prevention.

## Detailed description

The location path supports country, optional region and town dropdowns without requiring a known place name. A dated GeoNames extract provides 70,036 points across 245 countries/areas, loaded in small country-sized files. Missing rural settlements retain search, map and coordinate paths; a town point is not a farm boundary.

A global map cannot establish what a field grows, how much irrigation it needs or which rotation is right for a farmer. FieldShift builds an explainable evidence workflow instead of claiming a single optimal crop.

The four modules are Geospatial Map, Data Flow, SI Model and Strategy Logic. The map searches named places and displays nearby complete OpenStreetMap farmland polygons. Users select an outline or dropdown entry. Crop/produce tags appear where recorded; missing tags and historical rotations remain unknown. Mapping does not verify ownership, access, available land or current production.

The visible workflow is numbered 01 Find farmland, 02 NASA evidence, 03 Plan crops and 04 Compare, with persistent Next/Back navigation. Crop dropdowns follow the selected country, using 9,238 dated FAOSTAT production records across 197 countries/areas. Crop years, national tonnes, official/estimated flags and citations remain inspectable. Broad commodity categories are qualified proxies for starter rules, never cultivar or farm-suitability proof. Missing coverage stays unknown; countries with fewer than two screened crops cannot generate alternatives. Country changes remove unavailable choices and invalidate old comparisons.

NASA POWER Daily supplies T2M, T2M_MAX, T2M_MIN, PRECTOTCORR and ALLSKY_SFC_SW_DWN for a selected historical year. The app retains actual response units, source product and URL, requested period, latest available day within the request, retrieval time, spatial support and missingness. Daily regional estimated observations support monthly charts and tables. Fill values remain missing rather than becoming zero rainfall. Failed sources show errors; synthetic observations are never substituted.

The sourced starter crop catalog contains bush snap bean, garden pea, sweet corn and radish. Three four-month slots define an equal 12-month horizon for the existing baseline and two distinct allowed alternatives. Deterministic criteria compare family repetition, calendar fit, missing weather, frost exposure, limited heat/pH/drainage rules and historical zero-rain exposure. Farmer priorities order transparent criteria. These are rule counts, not confidence percentages, yield predictions or profitability scores. Unsupported crops remain selectable and unassessed. Grain maize is not assigned sweet-corn rules.

Published data reduce the need to guess. ISRIC SoilGrids provides modelled pH and sand/clay fractions with source prediction quantiles for regional background. ISRIC advises against farm-level use; estimates never auto-fill measured farm pH or drainage. ABS Australian 2020–21 irrigated-area and water-applied totals give reproducible annual ML/ha category ratios. They describe historical national practice, not crop-specific watering schedules, present water availability or irrigation prescriptions, and are not applied to other countries.

The country pest watchlist combines sourced crop-host relationships for fall armyworm and diamondback moth with GBIF historical occurrence queries. It provides inspection leads with dates and source links, not field diagnosis, abundance, infestation probability, official phytosanitary status or pesticide advice.

The bottom-right assistant works across all tabs. It answers named crop-country questions with brief, source-backed topics and follow-ups. It can also select a country/place or returned field, enter the farmer's three crops, load NASA evidence and run the comparison through step 4. Missing inputs are requested; unsupported crops remain unassessed. Fixed app handlers execute these actions, never generated code. Retrieved crop, weather, soil, water and pest evidence supplies scientific statements. A custom 29,200-parameter word-level autoregressive language-model experiment runs in a browser worker with 116.8 KB of weights. It was trained with next-word prediction, not a topic-classifier output layer. Production topic selection is guarded; source answers render before inference. Inconclusive selections fall back to evidence, and raw generated scientific text is never displayed. It is not a general-purpose LLM or a validated agronomic model.

The Vercel showcase architecture is static HTML/CSS/JavaScript with Leaflet and browser workers. A separate local Node.js testing mode serves the same frontend through real HTTP APIs and the shared data/strategy modules. Showcase retrieval, caching, normalization, agronomy and inference run on the user's device; in local testing, the Node backend supplies data and deterministic results while optional model inference stays in the browser. Vercel needs no serverless functions, database, environment variables, API keys or inference server. Local Node tooling builds, tests and previews static files. Device caches preserve original retrieval dates. The approved visual direction uses a large map, compact sidebar, dark green/cream styling, accessible tabs and mobile layouts.

## What was actually validated

- 74 automated unit, adapter, conversation/action, country-filter, static-build, model-artifact, location-race and startup checks passed.
- 31 browser checks passed in Chrome against the static build, including named crop-country questions, focused follow-ups, guided execution through step 4, pending-location edits, Next/Back navigation, country-dependent choices, real field selection, NASA evidence, timelines, invalidation, model load/unload, failures and seven-page PDF output.
- 17 Node-backed browser checks passed with direct browser NASA access and the data worker blocked, including chat-driven country/location/crop selection, real backend retrieval, comparison and failure/retry.
- 16 separate Firefox 160 workflow checks passed using native BiDi, including crop-country chat, guided execution through step 4, blocked model/NASA requests, model recovery and narrow-viewport keyboard navigation.
- Windows process-tree snapshots measured 607 MB aggregate working set after model load/inference and a maximum sampled 749 MB after the additional developer generation/reload check. Shared pages and missed short-lived processes limit interpretation; the exact session peak and real mobile memory remain unverified.
- A static-only preview with no backend API retrieved real NASA/SoilGrids data and rendered dated ABS ratios; farm pH remained unknown and soil/water chat answers retained source limitations.
- NASA 2025 retrievals at Perth, Minneapolis and Nairobi had all five requested parameters present in those requests and different seasonal temperature evidence.
- A clean browser TensorFlow.js/WASM training run completed. Its synthetic-development wording is explicitly labelled; results were 75/90 development selections and only 9/18 free-form cases. This is not agronomic accuracy.
- One development-machine benchmark measured 903 ms cold model load, 652.6 ms warm load, 84 ms inference and 10 ms to the first evidence answer. These are not device guarantees. WASM heap capacity was 16 MiB; full browser peak memory and real mobile performance remain unmeasured.

## NASA data and resources

- NASA POWER Daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- POWER source-resolution guidance: https://power.larc.nasa.gov/docs/tutorials/
- Exact validation request URLs, retrieval dates and coverage are recorded in docs/evidence/live-validation.json.

## Other sources and credits

- GeoNames, CC BY 4.0: https://www.geonames.org/ ; extract format and scope: https://download.geonames.org/export/dump/readme.txt
- OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
- Nominatim search policy: https://operations.osmfoundation.org/policies/nominatim/
- ISRIC SoilGrids, CC BY 4.0; Poggio et al. (2021): https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html
- SoilGrids properties, units and quantiles: https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html
- ABS Water Use on Australian Farms 2020–21: https://www.abs.gov.au/statistics/industry/agriculture/water-use-australian-farms/2020-21
- GBIF occurrence API: https://techdocs.gbif.org/en/openapi/v1/occurrence ; dataset attribution and licenses remain linked per example record.
- FAO. 2025. FAOSTAT: Crops and livestock products. Accessed 14 November 2026. https://www.fao.org/faostat/en/#data/QCL . Licence: CC-BY-4.0 plus https://www.fao.org/contact-us/terms/db-terms-of-use/en/ . Adapted to a dated national crop-presence list; no FAO endorsement. UN M49/ISO country-code join: https://unstats.un.org/unsd/methodology/m49/overview/ .
- UMN Extension crop records and Cornell Extension family-rotation guidance: full per-record source registry in docs/data-sources.md and the app.
- NParks Singapore kai lan guidance: https://www.nparks.gov.sg/publications-resources/articles/growing-five-leafy-vegetables and https://www.nparks.gov.sg/publications-resources/articles/tips-on-growing-barssica-edibles . Gardening references, not global farm validation.
- IRRI rice establishment: https://www.knowledgebank.irri.org/images/docs/planting-establishment.pdf ; wheat/tomato UMN knowledge profiles and source-region limits: docs/data-sources.md.
- Fall armyworm hosts, IPPC/FAO: https://ippc.int/en/the-global-action-for-fall-armyworm-control/about-fall-armyworm/
- Diamondback moth hosts, UF IFAS: https://ask.ifas.ufl.edu/publication/IN276
- Leaflet 1.9.4, BSD-2-Clause; TensorFlow.js/WASM 4.22.0, Apache-2.0; esbuild build tooling. Third-party licenses remain applicable.

## SI / AI disclosure

Codex assisted with code, documentation, tests, research organization, model-experiment code and submission preparation. Scientific ranking is deterministic. The custom compact language model was trained on explicitly developmental synthetic question wording and source-linked explanatory continuations; no fabricated NASA observations were used. Its limited evaluation and failures remain public. Only traceable retrieval facts and limitations appear as scientific answers. There is no cloud model inference, autonomous tool execution, generated-code execution or invented-source workflow.

Earlier pretrained SmolLM2 and TinyStories experiments were benchmarked for comparison, not silently shipped as the current model. The smaller TinyStories candidate failed both evidence-following tests and was rejected. Python/Keras intent and pretrained fine-tuning notebooks are separate guarded experiments, not completed training/export claims. The primary notebook documents the actual browser-trained compact model and saved artifacts.

## Limits and next work

Global map access is not worldwide agronomic validation. Four crop types and two pest-host entries are a deliberately small starting point. Crop maturity bounds and 14-day harvest/turnaround are assumptions. One historical year's same-calendar weather is not a forecast. Quantitative thermal coverage differs across crops; unknown risk is not zero risk. Soil tests, crop water balances, local calendars, multi-year pest history, economics and commercial suitability still need local evidence. No yield gains, savings, soil improvements, nitrogen credits or pest reductions were measured or predicted.

The compact model's vocabulary and template splits are optimistic development choices. Its 9/18 free-form result is weak; it remains an experiment behind relevance checks and retrieval fallback. Independent farmer questions, better train-only vocabulary/splits, real mobile/other browsers and full peak-memory measurements are required before expanding its role.

## Submission links and portal steps

The prepared demo is a seven-slide HTML presentation and an exactly seven-page PDF in public/submission/. Source, source archive, citations, validation reports and this copy accompany it. The public demo is https://nasa-hackathon-three.vercel.app/ ; all 31 production browser checks passed, including guided chat through step 4. Use docs/deployment.md for release attribution and settings.

The official challenge brief was read at the user's exact URL and explicitly lists NASA POWER. See docs/challenge-alignment.md. NASA's official discussion confirms up to seven slides OR a video of at most 30 seconds, English project text and AI disclosure: https://github.com/nasa/spaceapps/discussions/1973 . It states November 15, 2026, 11:59 PM local time. Explorer is registered under Singapore (UTC+8); confirm any event-specific portal exception before the deadline. The full current guide page was unavailable during retrieval, so no additional form limits are invented.

The team owner must review the copy, supply any required participant/eligibility declarations and submit through the NASA team account. Preparing, hosting or linking these artifacts does not mean NASA submission or acceptance. The public team record was unsubmitted when inspected; this task does not change that account record.
