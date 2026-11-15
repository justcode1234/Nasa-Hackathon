# FieldShift — current release description

Prepared for the owner to review. Updating this repository and the public demo does
not edit or submit the NASA portal. The original Phase A copy is preserved in
[history](history/phase-a-submission.md) and [public snapshot](../public/submission/phase-a/).

## Project summary

FieldShift helps people explore historical NASA environmental evidence and compare
crop rotations where sufficient crop information is available. Four connected
modules combine a farming assistant, an interactive map, explained environmental
graphs and transparent strategy comparisons. Results show reasons, trade-offs and
missing evidence. This is decision support for local review, not a guarantee of
crop performance, yield, water savings or pest prevention.

## How it works

**Geospatial Map:** choose places or the map, or enter coordinates. Optional region
filters are offered where named regions exist in the source list. A town point or
community-mapped field does not prove ownership, current crops or suitability.
The optional 3D view shows regional POWER cells, dated NASA GIBS imagery and terrain
context with clear scale and sampling limits; it is part of the map module.

**Data Flow:** Next retrieves a completed historical year of NASA POWER temperature,
corrected precipitation and solar radiation estimates. Temperature, rainfall and
solar graphs have explanations and exact tables. Celsius/Fahrenheit is a display
choice; original source values, JSON downloads and screening calculations remain
in Celsius. Dates, units, source URLs, retrieval time, spatial support and missingness
are retained. POWER combines satellite-derived and model/reanalysis products; it
is not a field sensor or a forecast.

**SI Model:** three clickable examples introduce sourced crop-country answers,
guided planning and crop-choice help. Validated application handlers can select
locations, retain the farmer's crops and constraints, load evidence and compare.
Read-only questions do not execute planning actions. A custom 39,274-parameter word
language-model experiment with 157,096 bytes of weights may prioritize a retrieved
paragraph behind relevance checks. Raw generated scientific claims are hidden.
Sourced answers and comparisons work without model inference; this is not a
validated general-purpose LLM.

**Strategy Logic:** the farmer's baseline and two alternative sequences share a
12-month horizon of three four-month slots. Alternatives use screened baseline
crops by default; different crops require explicit approval. The system screens
calendar fit, crop-family repetition, selected historical temperature/rainfall
exposure, supplied pH/drainage where rules exist, and missing evidence. Each table
row explains its meaning. Missing coverage is labelled Not assessed or Not comparable,
not a favourable zero. Counts are not confidence, yield or profitability scores.

## Coverage and scientific limits

Seven crop types have sourced screening entries: bush snap bean, garden pea, sweet
corn, radish, tomato, head cabbage and bulb onion. Of 197 FAOSTAT country/area
lists, 166 have at least two mapped screened categories. Radish has no mapped
FAOSTAT category and is not offered by country lists. Commodity categories do not
validate cultivars or field suitability. Chinese/Napa cabbage and spring onions
do not inherit head-cabbage/bulb-onion timing rules. Grain maize does not inherit
sweet-corn rules.

Recorded crops without screening rules remain in the baseline with an explanation
and next steps. Apple/apricot tree identity and Rosaceae context are sourced, but
an annual-slot planner cannot make a like-for-like orchard comparison or justify
replacing established trees. Separate official ÅSUB 2024 records supply five
unassessed Åland baseline categories; they are not FAOSTAT records or new rotation
rules. Missing country records mean a dataset gap, not that agriculture is absent.

Regional weather is not a forecast or a locally validated planting calendar.
SoilGrids supplies optional regional model context, not a farm soil test, and its
REST provider currently announces a service pause. Only farmer-supplied pH/drainage
feed the corresponding screening checks. ABS irrigation ratios are historical
Australian national aggregates, not field water demand or savings. GBIF country
occurrences are inspection leads, not farm infestations or pest probabilities.

The prototype does not estimate exact yields, crop-success probability, profitability,
water demand, nitrogen credits, soil improvement or pest prevention. Maturity bounds
and the 14-day turnaround are disclosed assumptions. Local agronomic review is needed.

## English voice controls

Whisper tiny.en performs on-device English dictation after an explicit first-use
notice and permission. Initial model/runtime download is about 70 MB. Audio is not
uploaded; the transcript is an editable draft and never auto-sent. Read aloud uses
an installed on-device English voice. Its training-language provenance is unverified;
the user chose this for the release rather than a new downloadable TTS model.
Real microphones, accents/noise, audible output and real phones remain unverified.

## Data and technical information

NASA POWER provides the numeric historical environmental estimates. The optional
map displays GIBS MODIS NDVI/LST, SMAP and IMERG imagery, without extracting values
or feeding map colours into crop rankings. Terrain Tiles is a mixed-source mosaic
including SRTM; it is not uniformly NASA or a current farm survey. Landsat,
ECOSTRESS and GRACE are not integrated.

FAOSTAT, ISRIC, OSM/Nominatim, GeoNames, GBIF, ABS and agricultural publications
supply separately labelled context. Detailed primary citations, source-specific
licences, adaptations and limitations: [references](references.md). Required
[third-party notices](../THIRD-PARTY-NOTICES.md) and shipped credits remain included.

The public app is static vanilla JavaScript/HTML/CSS with browser workers and no
farmer account requirement. A local Node.js mode serves the same data and strategy
modules over HTTP. Exactly four product modules remain. No cloud model inference
or database is required; the experimental classifier is not used by the app.

## Validation and AI disclosure

Current executed results, source hashes, browser scope and known failures are in
[validation](validation.md) and the release evidence. Desktop/mobile viewport tests
are not physical-device verification; there is no independent agronomic validation
or exact session memory guarantee.

ChatGPT, Claude (including Claude Code) and OpenAI Codex assisted brainstorming,
research, implementation, debugging, testing and documentation. The small word
model was trained/evaluated as a development experiment, not on fabricated NASA
observations. Documented rules and sourced facts provide scientific output.
No general certification that every AI output is correct is claimed. The deck uses
text and data visualisations; the synthetic speech clip is labelled as a test fixture.

## Public links and submission responsibility

[Application](https://nasa-hackathon-three.vercel.app/) ·
[Current seven-slide demo](https://nasa-hackathon-three.vercel.app/submission/) ·
[Prepared Phase A snapshot](https://nasa-hackathon-three.vercel.app/submission/phase-a/).
Only the owner can review and submit the project in the NASA portal. A public app,
prepared copy, PDF or source archive is not proof of submission or acceptance.
