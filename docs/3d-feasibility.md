# 3D evidence map: V0 measurements, 15 November 2026

V0 is an isolated experiment, **not an application dependency or released feature**.
The submitted app remains Leaflet 2D. V1–V5 require the plan's dependency approval;
no crop columns, science-overlay controls, field slope or strategy links are built.

Reproduce locally: `node scripts/3d-v0-spike.js`, then open
http://127.0.0.1:4175. It downloads the exact pinned npm package into ignored
`artifacts/3d-v0/vendor`, checks its SHA-512 integrity, and serves only an explicit
file allowlist. Run `node scripts/benchmark-3d-v0.js` for the desktop load/pan/process-memory
measurement. Nothing is copied into `public` or the application build. No account,
key, model download or package.json runtime dependency is involved.

## Renderer decision

Candidate: **MapLibre GL JS 5.24.0**, published 23 April 2026, BSD-3-Clause plus the
package's bundled notices. It meets the plan's two-week release-age requirement.
The full package licence is served beside the experiment. If approved, vendor only
the JS, CSS and complete licence; load them only after the user opts in.

| Observed desktop result | Measurement |
| --- | --- |
| Lazy JS | 1,056,837 bytes raw; 276,839 bytes gzip |
| Lazy CSS | 70,024 bytes raw; 10,092 bytes gzip |
| Renderer requests before clicking Open | 0 |
| Open to MapLibre load/interactive event, cold isolated profile | 1,729 ms |
| Two-second pan, terrain active | 60.0 frames/s; 16.8 ms 95th-percentile frame interval |
| Browser working set before renderer | 433.5 MB |
| Largest sampled browser working set | 620.5 MB |
| Largest sampled private bytes | 539.2 MB |
| Browser errors / failed observed source responses | 0 / 0 |

Measured with headless installed Chrome at 1280×1000 on an NVIDIA RTX 5060 Ti using
ANGLE/D3D11. These are **one desktop run**, not a phone benchmark or guarantee.
Process-tree working sets can double-count shared pages; phase samples do not
measure the exact simultaneous full-session peak. `preserveDrawingBuffer` was
enabled for screenshots. Combined 3D + mini-LM memory is unmeasured.

[Raw benchmark](evidence/3d-v0-benchmark.json),
[package hashes and sizes](evidence/3d-v0-package-size.json),
[globe screenshot](evidence/3d-v0-globe.png),
[terrain screenshot](evidence/3d-v0-terrain.png).
Both canvas crops have nonzero colour variance; screenshots were also inspected.
The camera has no idle animation. Buttons use instant jumps, including reduced
motion. A 390×844 WebGL-disabled run displayed an explicit fallback with a link to
the submitted 2D app and no horizontal overflow:
[fallback evidence](evidence/3d-v0-fallback.json).
A separate 390x844 reduced-motion render had zero axe violations, no horizontal
overflow and no CSP violations after fixing MapLibre attribution-link underlining:
[mobile audit](evidence/3d-v0-mobile.json), [screenshot](evidence/3d-v0-mobile.png).
The initial audit failure is retained as 3d-v0-mobile-before-link-fix.json.

## POWER: native grid verified, boundaries must stay honest

The [daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
limits regional requests to one parameter. Live testing rejected a 1.5° box with
HTTP 422: this API requires **at least 2° in each direction**. A 2° box, T2M,
1–31 January 2025, LST, succeeded with 15 native points:

- Latitudes −33, −32.5, −32, −31.5, −31.
- Longitudes 116.25, 116.875, 117.5 (0.625° spacing).
- Header: MERRA2, native-resolution daily data, °C, missing code −999.
- The nearest point to the York fixture is 116.875°, −32°. All 31 T2M values
  exactly equal the existing point API's values requested at 116.77°, −31.89°.

The request was:
`/api/temporal/daily/regional?parameters=T2M&community=AG&latitude-min=-33&latitude-max=-31&longitude-min=116&longitude-max=118&start=20250101&end=20250131&format=JSON&time-standard=LST`.
See [regional response](evidence/3d-v0-power-region-2deg.json) and
[point response](evidence/3d-v0-power-point-month.json).
The API returns point centres, not boundary polygons. Before V1, document the
native-grid origin/edge convention and test antimeridian/pole handling. Never centre
a supposed exact pixel on the user's arbitrary coordinate. Solar's distinct grid
still needs its own live check before showing solar columns. Neighbours must come
from actual returned points; their values cannot be copied from the selected point.

## Terrain: source and licence verified for the fixture

[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) is keyless; its
[provider attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
requires credits for the contributing datasets. Global tiles are a mosaic, not all
SRTM. The live fixture tile
`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/12/3376/2431.png`
returned 200 and `x-amz-meta-x-imagery-sources: srtm/S32E116.tif`.
The experiment displays full provider attribution and uses ×1 exaggeration.

At this latitude, a zoom-12 256-pixel Web Mercator tile samples roughly 32.45 m per
pixel. Sampling spacing is distinct from source resolution/accuracy. Terrain
elevation queried by MapLibre was 177.5 m; it is regional historical elevation
context, not a surveyed farm height. No slope/aspect or erosion prediction is shown.
V3 still needs exact per-tile source handling, missing pixels, polygon pixel masks,
DEM decoding and synthetic slope tests.

## GIBS: live capabilities, not invented layer identifiers

The [EPSG:3857 capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)
returned 200 on 15 November. Verified identifiers:

| Layer | Maximum matrix zoom |
| --- | --- |
| BlueMarble_ShadedRelief_Bathymetry | 8 |
| MODIS_Terra_NDVI_8Day | 9 |
| SMAP_L4_Analyzed_Surface_Soil_Moisture | 6 |
| IMERG_Precipitation_Rate | 6 |
| MODIS_Terra_Land_Surface_Temp_Day | 7 |

[Saved metadata](evidence/3d-v0-gibs-layers.json) retains the exact available date
intervals, default dates, templates, colormaps and legends. Blue Marble is static
and has no time dimension; the experiment labels it a composite. V2 must restrict
date controls to the actual intervals, retain native product resolution separately
from tile zoom, validate units/legends and label overlays **imagery; values not
extracted**. No science overlay values are read from map colours.

## Remaining gates

Approval is required before adding MapLibre to the app and proceeding to V1. Keep
Leaflet default, mobile opt-in, WebGL fallback and preview-only delivery. V1 adds
honest POWER cells/slider/table equality; V2 dated imagery; V3 field terrain context;
V4 identical strategy weather windows; V5 complete release, accessibility, hardware
and visual review. Production stays frozen at f4c4fef until a separate decision.

Phase B's live Overpass field flow is currently failing and independently blocks a
behavior release. This experiment does not bypass that release gate.
