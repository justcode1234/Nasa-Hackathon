# Field Shift

Field Shift helps farmers explore historical NASA weather evidence and compare crop rotations. Built by Team Explorer for NASA Space Apps 2026, it explains the reasons, trade-offs and missing information behind each comparison.

**[Try Field Shift →](https://nasa-hackathon-three.vercel.app/)**

No installation or account is required.

## How to use

Select a location → Explore NASA data → Enter your crops → Compare rotations → Ask the assistant.

Choose a country and a town, search the map, or enter coordinates. Load a historical year, enter your existing three-crop sequence and constraints, then compare it with two alternatives where crop coverage permits. Start with an example farming region if you want to explore the workflow.

## Four connected features

- **SI Model — farming assistant:** short, sourced crop answers and guided planning. An optional, small experimental language model helps order retrieved information; documented rules produce the comparisons.
- **Geospatial Map:** location selection and community-mapped farmland, where records are available. A map outline does not establish ownership or current crops.
- **Data Flow:** historical NASA POWER temperature, rainfall and solar radiation, with charts, dates, sources and missing-data notices.
- **Strategy Logic:** your baseline and two alternatives over the same 12 months, showing crop-family repetition, calendar fit, environmental exposure and evidence gaps.

[View the seven-slide demonstration](https://nasa-hackathon-three.vercel.app/submission/) · [Download the slides as a PDF](https://nasa-hackathon-three.vercel.app/submission/fieldshift-deck.pdf)

## Data Sources & References

[NASA POWER](https://power.larc.nasa.gov/) and its [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) supply regional, satellite- and model-derived environmental estimates. Additional context comes from [FAOSTAT](https://www.fao.org/faostat/en/#data/QCL), [ISRIC SoilGrids](https://isric.org/explore/soilgrids/), [OpenStreetMap](https://www.openstreetmap.org/copyright), [GeoNames](https://www.geonames.org/export/), [GBIF](https://www.gbif.org/), Australian irrigation statistics and cited agricultural publications.

Historical weather is not a forecast or a farm measurement. National production records do not prove local suitability; regional soil estimates do not replace a soil test. External services can be unavailable: ISRIC currently reports a pause of its SoilGrids REST service, and field lookups depend on shared mapping services.

The public prototype has screening rules for **four crop types**; **89 of 197** country/area lists contain enough screened categories for alternatives. Unsupported crops remain unassessed. Comparisons assume three four-month slots and do not predict yields, profitability, water savings, pest prevention or soil improvement. Local agricultural review is needed.

## References and technical information

- [Detailed references, licences and scientific scope](docs/references.md)
- [Submission accuracy review and proposed corrections](docs/submission-accuracy-review.md)
- [Development, testing and unreleased work](docs/development.md) · [Documentation index](docs/README.md)
- [Licences and credits](https://nasa-hackathon-three.vercel.app/credits.html) · [Third-party notices](THIRD-PARTY-NOTICES.md)

ChatGPT, Claude and OpenAI Codex assisted with development, research, tests and documentation. The optional browser model is experimental; sourced answers and deterministic comparisons remain available without it. See the [AI disclosure](docs/references.md#ai-assistance).

This README describes the public Phase A application. The 3D map, expanded crop catalogue and voice controls on development branches are unreleased. Field Shift is not affiliated with or endorsed by NASA.
