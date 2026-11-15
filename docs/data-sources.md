# Sources and scientific scope

## Phase B branch: sourced expansion and read-service migration - 15 November

The local preview branch has seven screening crops and 166/197 comparable countries;
production remains the Phase A four-crop release. Tomato: Clemson 52-90 days to first
harvest, starting method unspecified, pH 6-6.5. Head cabbage: Clemson 60-80 days after
transplanting, pH 5.8-6.5, ideal air 60-65 F. Bulb onion: USU 100-120 days, start basis
unspecified; Clemson Onions/Soil pH 6.2-6.5; NC State Amaryllidaceae taxonomy. These
are regional US reference bounds, not local calendars or globally validated advice.
Napa/Chinese cabbage and green onions are excluded from the new crop aliases.
New sources and live HTTP checks: docs/evidence/phase-b-source-checks.json.

The branch replaces the OSM editing API with bounded Overpass reads (25-second
requests, one fallback, +/-0.02-degree box, one-day cache, complete closed ways only).
Both services failed live probes on this device. Do not treat the historical Phase A
field counts below as successful Overpass verification. The failed live field tests
block a Phase B behavior release; retry remains visible and no fields are substituted.


## Example-region verification — 15 November 2026

The Ames example now uses 42.00°, −93.69° (farmland west of Ames), returning 11
complete mapped fields; Naivasha uses −0.77°, 36.42° (south of town), returning 8.
These are public OSM land-use records, not ownership or available-land claims.
The existing bounded ±0.01° adapter was used. Raw source URLs, retrieval timestamps,
bounds and way IDs are in docs/evidence/phase-a-field-probes.json. Larger discovery
requests hit OSM's 50,000-node limit; no missing fields were fabricated. Browser and
Node verification is recorded in the phase-A Playwright report once executed.
The planned read-service migration to Overpass remains separate from this fix.

The submission example is public/data/submission-example.json: explicitly DEMO
planning inputs for York, Western Australia, and real NASA POWER 2025 observations.
docs/evidence/submission-comparison-current.json records the generated engine
results, observations and source metadata. Radish has no mapped FAOSTAT category;
it is not silently added to any country's alternative choices.

Updated scope: named-place search, actual OSM field polygons/crop tags, GBIF country
pest context, sourced crop pH/drainage checks and an optional browser model are now
integrated. The first-pass notes below describe the NASA layer scope.

## Field, soil, pest and browser-model additions — 2026-11-14

- GeoNames cities5000 and admin1CodesASCII: https://download.geonames.org/export/dump/readme.txt .
  CC BY 4.0, https://www.geonames.org/ . The retained extract has 70,036 real place
  records across 245 countries/areas, with administrative-region labels joined by
  the source country/admin codes. Provider scope is cities over 5,000 population
  or first-order administrative seats; it is not a complete rural-town inventory.
  Names, WGS84 latitude/longitude, IDs and source modification dates are preserved.
  Gazetteer edit dates are not crop/weather observation dates. Town points are not
  surveyed field locations or suitability evidence. The manifest retains source
  URLs, last-modified headers, retrieval time, SHA-256 hashes, licence and per-country
  counts/hashes. `python scripts/build-locations.py` reproduces the extract. The
  4,254,070 bytes of country records are served in country-sized files, with a
  largest file of 453,783 bytes, rather than entering the initial worker bundle.
  Browser showcase and Node testing use the same `/api/locations` data contract.
- FAOSTAT QCL country crop snapshot: https://www.fao.org/faostat/en/#data/QCL .
  FAO. 2025. FAOSTAT: Crops and livestock products. Accessed 14 November 2026.
  Licence: CC-BY-4.0 plus https://www.fao.org/contact-us/terms/db-terms-of-use/en/ .
  Adaptation: latest production record per country/item in 2020–2024, positive
  tonnes only, CPC 01 primary crops. No livestock, processed products, trade
  records or aggregate regions. 9,238 entries / 197 countries and areas. Missing
  entries are unknown, not absence. FAO official/estimated/imputed flags, years,
  units, notes, retrieval time, manifest update and ZIP hash are retained in
  server/context/country-crops.json. National statistics do not establish local
  crop suitability, seed availability or current field crops. No FAO endorsement.
  Green/string bean, green pea and green corn categories are explicitly qualified
  proxies for the corresponding starter rules; cultivar and bush habit are unknown.
  Country codes join FAO M49 to ISO alpha-2 using the UN's primary table:
  https://unstats.un.org/unsd/methodology/m49/overview/ . Reproduction script:
  scripts/build-country-crops.py; source URLs and hashes accompany the snapshot.
  The old Fenix API returned HTTP 521; a verified public bulk download supplies
  this lightweight static extract without adding a runtime API/account dependency.
- OpenStreetMap map API: bounded `https://api.openstreetmap.org/api/0.6/map.json?bbox=`
  responses. Draw complete farmland/orchard/vineyard/nursery ways only; crop/produce
  tags are literal records. ODbL attribution: https://www.openstreetmap.org/copyright .
  Nominatim searches and country lookup obey a per-worker 1-request/second queue
  and bounded device-local cache, without autocomplete or bulk scraping. Browser
  origin/referrer identifies direct requests; the optional Node test adapter uses
  an identifying User-Agent. High-traffic deployment would need a suitable service.
- Crop pH ranges: bean 6–7 (umn-beans), pea 6–7.5 (umn-peas), sweet corn 5.8–7
  (umn-corn). Peas and corn require well-drained soil in those sources. Farmer pH
  and drainage inputs are not NASA observations. No sourced radish pH rule is claimed.
- Rain-free exposure: maximum consecutive exact-zero PRECTOTCORR days inside each
  maturity-upper-bound crop window. Missing rain breaks the run, with missingness
  separately counted. This is a transparent exposure indicator, not water demand,
  irrigation advice, drought probability or measured savings.
- GBIF fixed country/species queries: https://techdocs.gbif.org/en/openapi/v1/occurrence .
  Counts are historical occurrence records, not abundance, infestation or official
  phytosanitary status. Example records retain dataset links, dates and licenses.
  Sourced host watchlist: fall armyworm (IPPC/FAO) and diamondback moth (UF IFAS).
  The watchlist is incomplete; zero records never establishes absence.
- The default assistant now uses the custom compact TensorFlow.js word LM described
  in models/README.md. Earlier SmolLM2/TinyStories comparisons are retained as
  experiments, not current deployment claims. Raw generated scientific claims are not shown.
- ISRIC SoilGrids: pH in water, sand/clay, source 5th/95th quantiles, 250 m support,
  0–5 cm. Unit conversions use the response factor (10); no single observation
  year exists. CC BY 4.0, Poggio et al. (2021):
  https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_04.html . The provider
  advises against farm-level use. Regional values never become measured farm inputs.
- ABS 2020–21 national irrigation tables, released 2022-07-26, checked 2026-11-14:
  https://www.abs.gov.au/statistics/industry/agriculture/water-use-australian-farms/2020-21 .
  Four category ratios use published applied ML divided by irrigated hectares;
  raw numerator/denominator and period are visible. The series ceased, and newer
  Water Account data are not substituted into this matched historical calculation.
  These are not field irrigation schedules and are not applied outside Australia.

Accessed 2026-11-14. Stable IDs below are also returned by the API.

| ID | Primary source | Use |
| --- | --- | --- |
| nasa-power | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ | Daily point API, LST, native source resolution, requested dates |
| power-resolution | https://power.larc.nasa.gov/docs/tutorials/ | Meteorology 0.5° latitude × 0.625° longitude; solar 1° × 1° |
| umn-duration | https://extension.umn.edu/agriculture/specialty-crops/vegetable-farming/climate-resilience-resources-for-vegetable-growers-in-minnesota | Bush beans 45–65, peas 50–80, radishes 30–60, sweet corn 60–100 days to maturity; frost sensitivity |
| umn-families | https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/living-soil-healthy-garden | Families and qualitative rotation/soil considerations |
| umn-peas | https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-peas | Ideal air temperatures 55–65°F (12.8–18.3°C), drainage and fertility considerations |
| umn-beans | https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-beans | Cold soil and frost limitations; symbiotic nitrogen fixation |
| umn-corn | https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-sweet-corn | Warm soil, drought stress and fertility requirements |
| cornell-rotation | https://allegany.cce.cornell.edu/gardening/food-gardening/vegetable-garden/rotating-vegetables-by-family | Shared pest/disease problems within crop families; rotation cannot guarantee protection |

## Observations

### Crop-country conversation references (checked 2026-11-15)

Knowledge profiles are separate from rotation-screening eligibility. The small
profile set does not imply validated growing advice for all FAOSTAT crops/countries.

| Source | Use and scope |
| --- | --- |
| [NParks: Growing Five Leafy Vegetables](https://www.nparks.gov.sg/publications-resources/articles/growing-five-leafy-vegetables) | Kai lan identity, qualitative conditions and 21–55-day harvest reference; published 2025-02-04, Singapore gardening context, cultivar/farm timing unknown |
| [NParks: Tips On Growing Brassica Edibles](https://www.nparks.gov.sg/publications-resources/articles/tips-on-growing-barssica-edibles) | Brassica gardening context; published 2026-10-14, not a global farm prescription |
| [IRRI: Plant establishment](https://www.knowledgebank.irri.org/images/docs/planting-establishment.pdf) | Rice direct seeding/transplanting and dependence on local variety, water and timing; no universal duration or irrigation amount |
| [UMN: Spring wheat growth and development](https://extension.umn.edu/agriculture/crop-production/small-grains/spring-wheat-growth-and-development-guide) | Spring/winter developmental distinction; Minnesota reference, not another region's planting calendar |
| [UMN: Growing tomatoes](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-tomatoes) | Warm-season, sun, growth-habit and family-rotation context; reviewed 2024, Minnesota home gardening |

The named country selects dated national FAOSTAT evidence. National production is
not a local recommendation or field yield. Fine-grained kai lan has no commodity
total assigned: broccoli/cabbage aggregates are not silently substituted.

Fixed upstream host: `https://power.larc.nasa.gov/api/temporal/daily/point`.
Parameters: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN;
community AG, JSON, explicit LST. Source grids are regional support, not farm
boundaries or sensor readings. POWER combines model/reanalysis and satellite-derived
products; values are labelled estimated gridded observations, not in-field measurements.
Parameter labels and units come from the actual response and are validated against
the known contract. Fill codes and absent dates become null. Monthly precipitation
is a partial sum when days are missing; averages report valid and expected counts.
Solar values in the live AG response were MJ/m²/day, not kWh/m²/day.

One historical year is a seasonal analogue only. No forecasts, climatological
confidence, field-level precision or inferred soil moisture. Other NASA layers
(SMAP, GPM, Landsat, ECOSTRESS, GRACE) are not integrated or selectable.
The map's coverage rectangles communicate nominal grid dimensions centered on the
selected point; they are explicitly illustrative, not recovered native pixel edges.
OpenStreetMap tiles supply geographic context only, with attribution; no NASA overlay
is claimed. Coordinates continue working if tiles fail.

## Rules and assumptions

Family identity and maturity ranges are sourced crop facts. Applying a 0°C daily
minimum warning to frost-tender crops is a conservative screening rule (air at 2 m
does not measure canopy frost). Pea upper ideal bound is (65−32)×5/9 °C; counts
above it show historical exposure, not damage probability. Other crop heat thresholds
are deliberately absent. No rainfall sufficiency or excess-water threshold is invented.
Legumes may fix nitrogen with compatible rhizobia; harvested biomass and management
affect any subsequent benefit. No nitrogen credits, soil improvement, pest reductions,
yield, water savings or economic estimates are computed.
