# Proposed submission wording — owner review only

**Not submitted, uploaded or applied to `docs/submission.md`.** This proposal
responds to the summary/details supplied in chat on 15 November 2026. It describes
the public Phase A application, not preview-only 3D, voice or crop expansion.
See the [accuracy report](submission-accuracy-review.md) for evidence and caveats.

## Summary

Farmers make planting decisions amid a changing climate and uncertain weather.
Useful environmental information is often scattered across datasets and difficult
to interpret without specialised knowledge.

Field Shift is our attempt to bridge that gap. We built a web-based prototype that
helps farmers explore a location, examine historical NASA environmental data, and
compare their existing crop rotation with two alternatives where sufficient crop
coverage is available.

Four connected modules bring together a farming assistant, an interactive map,
environmental data visualisations and transparent crop-rotation comparisons. The
system screens factors such as historical temperature and rainfall exposure,
crop-family repetition, a simplified planting calendar and missing evidence.

We want to explain why a rotation merits further consideration, what trade-offs
are involved and what cannot yet be concluded. Field Shift makes NASA POWER's
regional, satellite- and model-derived estimates easier to explore while keeping
local knowledge and agricultural expertise central to the decision. It does not
predict yields or guarantee future growing conditions.

## Project details

### Why we built Field Shift

NASA provides extensive environmental information. We asked how an ordinary
farmer could explore that evidence when considering what to grow next.
Crop-rotation decisions depend on local calendars, crop requirements, weather,
soil, management and previous crops. We built a prototype that connects historical
environmental estimates with understandable comparisons and makes gaps visible.

### Four connected modules

**1. SI Model — Farming Assistant.** Farmers can ask everyday questions about
crops and countries, or request guided planning. Sourced answers and validated
application actions work independently of the optional experimental browser
language model. That small model can prioritize retrieved information; it does
not independently generate or validate agricultural recommendations.

**2. Geospatial Map.** Country and town selection, optional region filters, search,
map clicks and coordinates provide location context. Where OpenStreetMap records
are available, users can inspect mapped farmland. A town point or mapped outline
does not prove field ownership, current crops or agricultural suitability.

**3. Data Flow — Environmental Evidence.** NASA POWER Daily supplies historical
temperature, corrected precipitation and solar radiation estimates for a selected
point and year. Charts and tables show patterns with source links, units, dates,
spatial support and missing-data notices. These regional satellite- and
model-derived estimates are not farm sensors or weather forecasts.

**4. Strategy Logic — Crop Rotation Comparison.** Farmers supply their existing
three-crop sequence and planning preferences. Where at least two country-listed
crops have screening rules, the system compares the baseline with two alternatives
over the same 12 months, using three four-month slots. Documented criteria screen
crop-family repetition, calendar fit, selected historical temperature/rainfall
exposure, farmer-supplied pH/drainage where rules exist, and missing evidence.
Results show individual reasons, risks, sources and limitations rather than a
claim of a universally optimal crop.

### Data and technology

Field Shift uses JavaScript, HTML and CSS, with Node.js for building, testing and
an optional local API mode. The public application is static and runs its shared
data/strategy logic in browser workers; farmers need no account or installation.

NASA POWER supplies the historical environmental estimates. FAOSTAT supplies
dated national production lists; OpenStreetMap and GeoNames supply geographical
records. Optional SoilGrids, Australian irrigation statistics and a small
GBIF-backed pest watchlist add separately labelled context. Agricultural
publications supply crop facts. External-service availability can limit retrieval;
failed requests do not create substitute observations.

### Limitations and uncertainty

The public release has screening rules for bush snap bean, garden pea, sweet corn
and radish. Of 197 country/area production lists, 89 contain at least two mapped
screened crop categories. Radish has no mapped FAOSTAT category, so country lists
do not offer it. Rice, wheat and other knowledge topics are not automatically
screened rotation crops. Missing country records mean a dataset gap, not that
crops cannot grow there.

POWER values can represent areas much larger than a farm. Historical exposure is
not a forecast or locally validated planting calendar. SoilGrids is a regional
model, not a physical soil test, and ISRIC currently reports a pause of its REST
service. Those estimates do not become measured inputs in the strategy engine.
Crop-variety, starting-method and source-region differences remain important.

The prototype does not estimate exact yield, success probability, water demand,
water savings, profitability, nitrogen credits, soil improvement or pest prevention.
Its rankings are limited screening comparisons for local review, not validated
farming prescriptions or evidence of improved resilience in real farms.

### What we hope to achieve

We want farmers to understand the evidence behind a planting decision, not just
receive an unexplained answer. Field Shift helps people compare alternatives and
identify what additional local evidence is needed, with human judgment at the
centre of the decision.

### Use of artificial intelligence

ChatGPT, Claude (including Claude Code) and OpenAI Codex assisted with brainstorming,
research, software development, debugging, testing and documentation.

We also developed and evaluated a small experimental browser language model.
Agricultural comparisons use documented rules and environmental data; sourced
answers remain available without model inference. Raw generated scientific claims
are not displayed. Development checks and model limitations are documented; these
are not independent agronomic validation. Any additional AI-generated media must
be reviewed and identified before inclusion in a submission.

## Resource fields

The user's NASA POWER and other-source URLs identify the correct providers.
Include the agricultural publications supporting crop rules and the ABS irrigation
publication as well, using the [detailed citations](references.md). GBIF's homepage
returned HTTP 403 here; its [occurrence documentation](https://techdocs.gbif.org/en/openapi/v1/occurrence)
was accessible. This is an access limitation, not proof of a dead canonical URL.
