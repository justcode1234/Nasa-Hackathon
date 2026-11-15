# Data sources and references

Reviewed **15 November 2026 (UTC+8)** against the public Phase A release (`main`
`f4c4fef`) and review source `4f9b8b3`. Provider descriptions are separate from what
Field Shift actually uses. [HTTP evidence](evidence/repository-review-public-links.json)
records ordinary unauthenticated requests; a reachable homepage does not prove API
uptime. [Production asset hashes](evidence/repository-review-production-assets.json)
identify the public implementation inspected.

## What is integrated

| Source | Public Phase A use | Limits |
| --- | --- | --- |
| NASA POWER Daily | Retrieved temperature, precipitation and solar radiation; monthly summaries and crop-window exposure indicators | Regional estimated observations, not field sensors or a forecast |
| FAOSTAT QCL | Bundled dated national production extract populating country crop lists | Production categories do not prove cultivar, availability or local suitability |
| ISRIC SoilGrids | Optional REST adapter for regional pH, sand/clay and prediction quantiles | Separate background context; provider currently announces a REST pause |
| OpenStreetMap / Nominatim | Map tiles, place search/reverse lookup and recorded farmland polygons/tags | Community records can be incomplete or old; ownership and current crops unknown |
| GeoNames | Bundled country/region/town gazetteer extract | Town points, not surveyed farms; rural coverage incomplete |
| GBIF + IPPC/UF IFAS | Country occurrence queries for a small two-pest host watchlist | Historical records, not field infestation, outbreak status or pest probabilities |
| Australian Bureau of Statistics | Bundled Australian 2020–21 irrigation totals and annual ratios | National categories, not field water requirements; not applied to other countries |
| Agricultural publications | Factual crop profiles, family, maturity, selected pH/drainage/temperature screening rules | Source-region evidence, not worldwide agronomic validation |

**Preview only:** NASA GIBS imagery (MODIS NDVI/LST, SMAP and IMERG), POWER regional
grid columns, and mixed-source Terrain Tiles including SRTM. These are present in
this branch's 3D map, **not the public Phase A application**. GIBS colours do not feed
crop ranking; imagery values are not extracted. No standalone SMAP, GPM or MODIS
numerical crop-model integration is claimed.

**Research only / not integrated:** Landsat, ECOSTRESS and GRACE/GRACE-FO. Earlier
pretrained language-model candidates and the typed-judgment classifier are separate
experiments, not active decision engines.

## NASA POWER

NASA Langley Research Center. *Prediction Of Worldwide Energy Resources (POWER)*.
[Project](https://power.larc.nasa.gov/) ·
[Daily API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) ·
[Methodology](https://power.larc.nasa.gov/docs/methodology/) ·
[Tutorials](https://power.larc.nasa.gov/docs/tutorials/). Access checked 15 November 2026.

The [shared adapter](../server/nasa/power.js) requests a complete historical year,
community AG, JSON, explicit Local Solar Time, at
`https://power.larc.nasa.gov/api/temporal/daily/point`:

| Parameter | Meaning | Response units expected by the app |
| --- | --- | --- |
| `T2M` | Daily mean air temperature at 2 m | `C` |
| `T2M_MAX`, `T2M_MIN` | Daily maximum/minimum air temperature at 2 m | `C` |
| `PRECTOTCORR` | Corrected precipitation | `mm/day` |
| `ALLSKY_SFC_SW_DWN` | All-sky surface downward shortwave radiation | `MJ/m^2/day` |

POWER combines satellite-derived and model/reanalysis products. The app records
source product, units, exact request URL, retrieval date, requested observation
period, latest valid day and missingness. Its nominal source support is 0.5° latitude
× 0.625° longitude for meteorology and 1° × 1° for solar; this is not the apparent
resolution obtained by zooming a map. Fill/absent values become missing, not zero.
Unit/schema changes stop calculations. Daily/monthly aggregations and exposure
counts are Field Shift calculations, not additional NASA measurements.

Credit NASA POWER and the underlying products in returned metadata. The team's
MIT licence does not license NASA names, logos, endorsement or third-party source
material. See NASA's [image and media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/)
and the exact data request attached to each result.

## FAOSTAT and country codes

FAO. 2025. *FAOSTAT: Crops and livestock products (QCL)*. Accessed 14 November 2026.
[Dataset](https://www.fao.org/faostat/en/#data/QCL).
Licence: **CC BY 4.0**, supplemented by the
[FAO Statistical Database Terms of Use](https://www.fao.org/contact-us/terms/db-terms-of-use/en/)
and any third-party metadata exceptions. No FAO endorsement is implied.

The [saved extract](../server/context/country-crops.json) contains 9,238 positive
production records in tonnes across 197 countries/areas: latest available item
record within 2020–2024, primary crops only. It retains official/estimated/imputed
flags, notes, years, retrieval time and archive SHA-256. Reproduction:
[build-country-crops.py](../scripts/build-country-crops.py). Country-code joins use
the UN Statistics Division's [M49/ISO table](https://unstats.un.org/unsd/methodology/m49/overview/).

Production records are evidence of reported national production, not proof that
an individual farm can grow a crop. Commodity-to-screening mappings are disclosed
proxies. Absence means missing extract coverage, not that nothing grows there.
Public Phase A has four screening crop types and 89/197 lists with two or more
screened categories; this branch has seven and 166/197. Radish has no mapped FAOSTAT
category, so it is not offered by country lists. Never describe these counts as
validated countries or recommendation accuracy.

## ISRIC SoilGrids

Poggio, L., de Sousa, L. M., Batjes, N. H., Heuvelink, G. B. M., Kempen, B.,
Ribeiro, E., and Rossiter, D. (2021). *SoilGrids 2.0: producing soil information
for the globe with quantified spatial uncertainty*. SOIL, 7, 217–240.
[DOI](https://doi.org/10.5194/soil-7-217-2021).
[Product and service notice](https://isric.org/explore/soilgrids/) ·
[FAQ, citation and licence](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html).
Licence: **CC BY 4.0**.

The [adapter](../server/context/soil.js) requests pH in water, sand and clay for
0–5 cm, mean and 5th/95th prediction quantiles from the 250 m global model. Unit
factors come from the response. There is no single observation year; retrieval
time is not sampling time. ISRIC advises against local/farm-level use.

**Availability checked 15 November:** the product page announces a temporary REST
service pause with no restoration date. Integration code exists; successful new
retrieval is not guaranteed. Failures leave soil unknown. Regional estimates do
not auto-fill farm inputs or enter strategy pH checks as measurements.

## OpenStreetMap, Nominatim and GeoNames

© OpenStreetMap contributors. [Copyright and licence](https://www.openstreetmap.org/copyright).
Database: **ODbL**; map tiles have their own attribution and service-use conditions.
Display contributor attribution and licence links. Read the
[tile policy](https://operations.osmfoundation.org/policies/tiles/) and
[Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

Public Phase A retrieves bounded field geometry through the OSM map API. This
branch uses three fixed public Overpass services: `overpass-api.de`,
`overpass.private.coffee`, `maps.mail.ru`, with staggered requests, bounded retries
and a shared deadline. The user elected to retain all three. These are transport
services for OSM data, not independent crop authorities. Place searches use
Nominatim with a queue and cache; no autocomplete or bulk search. Polygons and
literal crop tags do not establish ownership, access, cultivation date or rotation
history. See [farms.js](../server/context/farms.js).

GeoNames. *cities5000 and administrative-region names*, retrieved 14 November 2026.
[Export](https://www.geonames.org/export/) ·
[Format, scope and licence](https://download.geonames.org/export/dump/readme.txt).
Licence: **CC BY 4.0**. Attribution: GeoNames. The adapted extract has 70,036 points
across 245 countries/areas, loaded in country-sized files; it is not every village
or farm. Source edit dates are not environmental observation dates. Hashes and
input URLs: [manifest](../public/data/locations/manifest.json). Reproduction:
[build-locations.py](../scripts/build-locations.py).

## GBIF and pest-host references

GBIF.org. [Portal](https://www.gbif.org/) ·
[Occurrence API](https://techdocs.gbif.org/en/openapi/v1/occurrence).
The [adapter](../server/context/pests.js) queries `api.gbif.org/v1/occurrence/search`
for two fixed species by country, retaining a count, source query and example
record/dataset/date/licence. **Licences depend on each contributing dataset**;
follow its link and attribution. Do not apply the code's MIT licence to occurrences.

Host evidence: IPPC/FAO, [fall armyworm](https://ippc.int/en/the-global-action-for-fall-armyworm-control/about-fall-armyworm/);
University of Florida IFAS, [diamondback moth, EENY-119 / IN276](https://ask.ifas.ufl.edu/publication/IN276)
([official PDF alternative](https://edis.ifas.ufl.edu/publication/IN276/pdf)).
Publications retain their own copyright. Country occurrence counts are historical
records, not abundance, current outbreaks or farm infestation probabilities.
Zero records cannot establish absence; the watchlist is incomplete.

**Link check:** GBIF's homepage returned HTTP 403 to both ordinary fetch and the
web reader in this environment. Its technical documentation returned 200. The
canonical homepage is retained; no claim is made that it is universally broken.

The broader direct-GET citation check also flagged seven UMN pages (403), IRRI
(connection failure/timeout) and the UF/IFAS HTML page (connection/redirect failure).
The web reader independently retrieved UMN's maturity table and the official
UF/IFAS PDF; IRRI remained unavailable. These are explicitly recorded access
limitations, not silent passes or invented replacement sources. See the
[detailed link report](evidence/repository-review-documentation-links.json).

## Australian irrigation context

Australian Bureau of Statistics (2022), *Water Use on Australian Farms, 2020–21*,
released 26 July 2022.
[Publication](https://www.abs.gov.au/statistics/industry/agriculture/water-use-australian-farms/2020-21).
© Commonwealth of Australia; **CC BY 4.0**, subject to
[ABS copyright exceptions](https://www.abs.gov.au/website-privacy-copyright-and-disclaimer).
The [adapter](../server/context/water.js) contains a small attributed extract.
Applied megalitres divided by irrigated hectares gives annual ML/ha by broad
national category. It is a derived ratio, not daily irrigation, crop water demand,
efficiency or savings. Only Australian context uses it; the ceased series is not
silently replaced with unmatched newer tables.

## Agricultural claims and their evidence

Publications below supply factual references; their text, images and terms remain
with their publishers. Field Shift paraphrases facts and links sources. The team's
MIT licence does not relicense these publications. Regional gardening/extension
references are not worldwide farm prescriptions.

| Claim used | Primary evidence | Boundary |
| --- | --- | --- |
| Bush bean 45–65, pea 50–80, radish 30–60, sweet corn 60–100 days | [UMN climate resilience and maturity table](https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/climate-resilience-resources-for-vegetable-growers-in-minnesota) | Variety and establishment assumptions limit transfer |
| Crop families, qualitative soil/rotation considerations | [UMN soil and plant families](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/living-soil-healthy-garden), [Cornell rotation by family](https://allegany.cce.cornell.edu/gardening/food-gardening/vegetable-garden/rotating-vegetables-by-family) | Family changes do not guarantee pest/disease breaks |
| Pea air-temperature reference, pH and drainage | [UMN peas](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-peas) | Days above an ideal range are exposure, not damage probability |
| Bean pH, cold limitations and rhizobia | [UMN beans](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-beans) | No subsequent nitrogen credit is calculated |
| Sweet-corn pH, drainage, warm soil and drought context | [UMN sweet corn](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-sweet-corn) | No grain-maize maturity or irrigation requirement inferred |
| Kai lan identity, growing/harvest context | [NParks leafy vegetables](https://www.nparks.gov.sg/publications-resources/articles/growing-five-leafy-vegetables), [NParks Brassica edibles](https://www.nparks.gov.sg/publications-resources/articles/tips-on-growing-barssica-edibles) | Knowledge profile, not a screened rotation crop |
| Rice establishment | [IRRI establishment guide](https://www.knowledgebank.irri.org/images/docs/planting-establishment.pdf) | No universal crop duration or watering amount |
| Wheat development, tomato cultivation | [UMN spring wheat](https://extension.umn.edu/agriculture/crop-production/small-grains/spring-wheat-growth-and-development-guide), [UMN tomatoes](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-tomatoes) | Knowledge profiles do not make rice/wheat screened crops |
| Preview tomato 52–90 days to first harvest, pH 6–6.5 | [Clemson HGIC tomato](https://hgic.clemson.edu/factsheet/tomato/) | Source does not specify seed/transplant timing |
| Preview head cabbage 60–80 days after transplants, pH 5.8–6.5, best growth 60–65°F | [Clemson HGIC cabbage](https://hgic.clemson.edu/factsheet/cabbage-chinese-cabbage/) | No inheritance by Chinese/Napa cabbage or bok choy |
| Preview bulb onion 100–120 days, pH 6.2–6.5 and family | [Utah State onions](https://extension.usu.edu/yardandgarden/research/onions-in-the-garden), [Clemson alliums](https://hgic.clemson.edu/factsheet/onion-leek-shallot-garlic/), [NC State Allium cepa](https://plants.ces.ncsu.edu/plants/allium-cepa/) | Day length and starting method unmodelled; green/spring onions excluded |
| Preview warm/cool seasonal groups | [NC State vegetable gardening](https://content.ces.ncsu.edu/home-vegetable-gardening-a-quick-reference-guide) | Qualitative grouping does not validate winter survival |

The [crop registry](../server/agronomy/crops.json) and
[knowledge registry](../server/agronomy/knowledge.json) retain source IDs.
[Range verification](evidence/final-quality-crop-source-probes-2026-11-15.json)
and [unit evidence](evidence/final-quality-p04-unit-final.log) record the source
check, duration bases and unsupported-variant comparisons.

## Observations, estimates, rules and user information

- **Provider estimates/records:** POWER gridded estimates, SoilGrids model predictions,
  national FAOSTAT/ABS statistics, OSM/GeoNames records and GBIF occurrences.
- **Calculated indicators:** monthly summaries, crop-window frost/heat/zero-rain
  exposure, family-repeat counts and ABS ratios. They are not probability or yield models.
- **Rules and assumptions:** three four-month slots over 12 months, maturity upper
  bounds plus an assumed 14-day turnaround, transparent ordering of alternatives.
  Missing or unequal evidence can limit that ordering.
- **User-provided:** baseline crops, previous crop, planting year/month, priorities,
  irrigation availability, reported soil, optional soil-test pH/drainage and pest history.
  These are not NASA observations; no field measurements are inferred from a map.

## Preview imagery and terrain attribution

[NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) supplies dated, advertised
WMTS imagery through a fixed product allowlist in [gibs.js](../server/context/gibs.js).
The preview displays MODIS NDVI (250 m), MODIS daytime LST (1 km), SMAP L4
model-derived top-5-cm moisture (9 km), and IMERG precipitation rate (0.1° source
grid). Units, dates, legends and missing coverage are labelled; tile zoom is not
native resolution. These layers are not present in Phase A and never drive screening.

[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) supply the preview's
Terrarium DEM mosaic. Credits include USGS SRTM, NED/3DEP, GMTED, Geoscience Australia
and others; the mosaic is not uniformly NASA. Full attribution:
[terrain-attribution.txt](../public/licenses/terrain-attribution.txt).
Derived slope/aspect use unexaggerated elevations and disclose sampling/missingness;
they are not surveyed farm measurements or erosion/yield estimates.

## Software attribution

Original Team Explorer code: [MIT](../LICENSE). Preserve
[THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md), [shipped licences](../public/licenses/)
and [credits](../public/credits.html). Leaflet is BSD-2-Clause; preview MapLibre is
BSD-3-Clause; TensorFlow.js and Transformers.js are Apache-2.0; ONNX Runtime is MIT.
Pinned versions and test/build dependency notices are in the lockfile and notices.
No new dependency or experimental model is activated by this documentation review.

## AI assistance

ChatGPT, Claude (including Claude Code), and OpenAI Codex assisted with brainstorming,
research, software development, debugging, testing and documentation. Development
assistance is distinct from the model that runs in the app.

The optional browser experiment is a custom 39,274-parameter autoregressive word
language model with 157,096 bytes of weights. It can prioritize existing retrieved
paragraphs behind relevance checks; raw generated scientific claims are hidden.
Documented rules and environmental data produce comparisons. Sourced answers,
forms and comparisons work without model inference. Its development evaluations
are not scientific recommendation accuracy; see the [model card](../models/README.md).

Only claim that AI-assisted outputs were reviewed to the extent supported by
recorded checks. No blanket certification is implied. No generated visual media
was identified in the reviewed seven-slide deck; the synthetic English test audio
is labelled as a test fixture, not a farmer recording or submission narration.
If other media are added, review and disclose their actual origin before submission.
