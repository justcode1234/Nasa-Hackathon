# 3D preview verification status — 15 November 2026

The user story is: select a real point or returned field → open optional 3D →
retrieve actual POWER/GIBS/DEM evidence through the shared Node/worker adapters →
inspect dated values and gaps → open the exact rain window used by a crop scenario.
Leaflet remains the default. Production is frozen at the verified Phase A release.

| Plan requirement | Current evidence | Status |
| --- | --- | --- |
| V0 measurement and explicit renderer approval | User approved preview implementation; [feasibility](3d-feasibility.md) records the security-fixed 6.4.1 pin and original/repeated measurements | Verified |
| V1 native centres, bounded real neighbours, antimeridian, missing versus zero | power-grid unit tests; [16 browser cases](evidence/v1-playwright-complete.json); live NASA grid fixture | Verified locally |
| V1 month slider and exact evidence equality | Monthly table/feature equality; V4 strengthens this to every daily rain value before linking a crop window | Verified locally |
| V2 four real GIBS products, advertised dates, legends, resolution, imagery limits | [12 browser cases](evidence/v2-playwright-complete.json); saved capabilities; product metadata/source URLs | Verified locally |
| V3 DEM decoding, field masks, unexaggerated slope/aspect, resolution and small-field gaps | Offline tests; [eight point-terrain browser cases](evidence/v3-playwright-complete.json); separate actual Ames/Naivasha HTTP/DEM probes | Verified within the stated scope |
| V3 live field discovery → selection → rendered drape and slope context | Required standalone Ames field-terrain Playwright case; no saved outline can satisfy discovery | Verified locally on 15 November: 4/4 in the final release run ([summary](evidence/v5-green-release-summary.json)). The [earlier four attempts](evidence/v5-field-terrain.json) failed at discovery before the lookup fix |
| V4 exact crop-window/strategy equality | Shared calendar/rain code; [focused four-project browser report](evidence/v4-v5-playwright-focused.json), raw engine slots and features in attachments; leap/wrap/missing unit cases | Verified locally |
| V5 controls, text/table equivalents, focus, reduced motion, short viewports, CSP | Same focused report: 24 axe scans and keyboard/focus/layout/policy assertions | Verified locally, and again in the green full release |
| V5 actual application size, load, pan, combined model memory | [Full app benchmark](evidence/v5-app-benchmark.json); 293,319 bytes gzip renderer; 2.899/1.619 s open-to-data; about 60 fps; 846.6/762.0 MB max sampled working set | Measured on desktop Chrome at two viewport sizes |
| V5 real-phone memory/performance | No real phone measurement is available in this environment | Unverified; desktop emulation is not phone evidence |
| V5 complete release command | Latest: 117 offline and 116/116 browser cases passed, no skips or flaky results ([summary](evidence/v5-green-release-summary.json)). History: [84/92](evidence/v5-release-summary.json), then [95/96](evidence/v5-field-fix-release.json) | Passed on 15 November; depends on public Overpass availability at run time |
| V5 visual signoff | [Actual renders and dated legends](3d-visual-review.md), explicitly approved by the user for preview on 15 November | Approved for preview |
| Preview URL and external verification | Branch pushed; login-protected preview dpl_GRtYSt2eaYTbQMAhJA4auBiJRPJA verified by asset hashes through the Vercel CLI ([deployment notes](deployment.md)) | Preview only. Not publicly reachable; no browser suite run against it |
| Production/submission preservation | Main remains Phase A; all later work is on feature/3d-evidence-map | Preserved |

The field-provider failure remains visible and recoverable. Point planning can
still retrieve actual NASA data and reach step 4. That degradation does not count
as passing the separate successful-field requirement. Neither known OSM object
probes nor synthetic unit fixtures replace a live user-selected field flow.

All memory figures are sampled isolated process-tree working sets and can
double-count shared pages. They are not exact simultaneous session peaks or
guarantees. The mini-LM actually ran; its proposed topic was rejected by the answer
guard in this measurement. No crop accuracy claim follows from these benchmarks.


## Update - 15 November 2026 (release gate passed)

The live field-selection -> terrain drape -> derived slope/aspect path now passes in
both runtimes and both viewport sizes (field-terrain.spec.js, 4/4), and the complete
release suite passed 117 offline + 116 browser cases. The earlier failures were a
client deadline shorter than the real service response time, fixed by overlapping
services with backoff under a 75 s deadline. Evidence:
docs/evidence/v5-green-release-summary.json. Real-phone performance and memory remain
unverified. Preview/push status: docs/deployment.md.
