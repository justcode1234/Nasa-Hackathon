# Paste-ready Phase A submission fields

Prepared from docs/submission.md on 15 November 2026. These match the currently public Phase A app; update them together with the deck if a different release is approved. No portal changes were made.

## NASA data references

- NASA POWER Daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- POWER source-resolution guidance: https://power.larc.nasa.gov/docs/tutorials/
- Exact validation request URLs, retrieval dates and coverage are recorded in docs/evidence/live-validation.json.

## Other/project references

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

Claude Code (Anthropic) was used on 2026-11-15 to review the app (automated tests, accessibility audit, licence check, source verification) and to write the follow-up plan.

Codex assisted with code, documentation, tests, research organization, model-experiment code and submission preparation. Scientific ranking is deterministic. The custom compact language model was trained on explicitly developmental synthetic question wording and source-linked explanatory continuations; no fabricated NASA observations were used. Its limited evaluation and failures remain public. Only traceable retrieval facts and limitations appear as scientific answers. There is no cloud model inference, autonomous tool execution, generated-code execution or invented-source workflow.

Earlier pretrained SmolLM2 and TinyStories experiments were benchmarked for comparison, not silently shipped as the current model. The smaller TinyStories candidate failed both evidence-following tests and was rejected. Python/Keras intent and pretrained fine-tuning notebooks are separate guarded experiments, not completed training/export claims. The primary notebook documents the actual browser-trained compact model and saved artifacts.
