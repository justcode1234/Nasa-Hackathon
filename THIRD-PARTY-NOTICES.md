# FieldShift third-party notices

Team Explorer's original code is MIT licensed; this does not relicense third-party
software, source data, logos or extension publications. No NASA affiliation or
endorsement is claimed. The deployed [credits page](public/credits.html) links
licences, source attribution and the exact runtime package versions.

- Leaflet 1.9.4: BSD-2-Clause, Volodymyr Agafonkin, CloudMade and contributors. Its complete
  installed-package licence ships at public/vendor/leaflet/LICENSE.txt.
- MapLibre GL JS 6.4.1: BSD-3-Clause and bundled notices. Full package licence
  ships beside lazy-loaded ES modules at public/vendor/maplibre/LICENSE.txt.
- TensorFlow.js and WASM backend 4.22.0: Apache-2.0, TensorFlow/Google contributors.
  Loaded on demand from pinned jsDelivr URLs. Full licence is shipped under
  public/licenses/tensorflow-apache-2.0.txt, copied from the matching source tag.
- esbuild 0.28.2: MIT; build tooling. Installed-package licence is included under
  public/licenses/esbuild-mit.txt.
- Playwright, Playwright Core and @playwright/test 1.65.1: Apache-2.0, Microsoft
  Corporation; development/test tooling, not an application browser framework.
  Their licence and installed NOTICE files are included under public/licenses.
- axe-core 4.10.2: MPL-2.0, Deque Systems; test-only accessibility tooling.
  Its full installed-package licence is included under public/licenses.
- NASA POWER: NASA data attribution and the exact request/product metadata remain
  attached to observations. NASA names and logos are not licensed by our MIT text.
- GeoNames: CC BY 4.0; adapted, dated city extract. OpenStreetMap contributors:
  ODbL; source geometry and record attribution remain linked. Nominatim follows
  the OSMF search-service usage policy.
- FAOSTAT: CC BY 4.0 plus FAO database terms. Adapted dated national production
  extract; flags, dates and scope remain visible; no FAO endorsement.
- ISRIC SoilGrids: CC BY 4.0; Poggio et al. (2021), regional model context.
- ABS: © Commonwealth of Australia, CC BY 4.0 for the cited statistics, subject to
  published exceptions. Adapted 2020–21 totals/ratios; no ABS endorsement.
- GBIF: attribution and licence vary by supplying dataset. Follow the dataset and
  occurrence links; the aggregate count is not a relicensing of underlying records.
- UMN, Cornell, Clemson, Utah State, NC State, NParks, IRRI, UF IFAS and IPPC/FAO publications retain their own
  copyright and terms. FieldShift paraphrases factual references and links sources;
  they are not covered by Team Explorer's MIT licence.

See docs/data-sources.md and each app source link for provenance and limitations.
Pinned package versions and transitive dependencies are recorded in package-lock.json.
