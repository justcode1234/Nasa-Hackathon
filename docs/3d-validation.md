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
| V3 live field discovery → selection → rendered drape and slope context | Required standalone Ames field-terrain Playwright case; no saved outline can satisfy discovery | [Four standalone attempts](evidence/v5-field-terrain.json) fail at live discovery; field drape remains unverified |
| V4 exact crop-window/strategy equality | Shared calendar/rain code; [focused four-project browser report](evidence/v4-v5-playwright-focused.json), raw engine slots and features in attachments; leap/wrap/missing unit cases | Verified locally |
| V5 controls, text/table equivalents, focus, reduced motion, short viewports, CSP | Same focused report: 24 axe scans and keyboard/focus/layout/policy assertions | Verified locally; full release still required |
| V5 actual application size, load, pan, combined model memory | [Full app benchmark](evidence/v5-app-benchmark.json); 293,319 bytes gzip renderer; 2.899/1.619 s open-to-data; about 60 fps; 846.6/762.0 MB max sampled working set | Measured on desktop Chrome at two viewport sizes |
| V5 real-phone memory/performance | No real phone measurement is available in this environment | Unverified; desktop emulation is not phone evidence |
| V5 complete release command | 114 offline passed; 84/92 browser cases passed, all eight failures at real field lookup; [report](evidence/v5-release-summary.json) | Failed, release blocked |
| V5 visual signoff | [Actual renders and dated legends](3d-visual-review.md), explicitly approved by the user for preview on 15 November | Approved for preview |
| Preview URL and external verification | No Phase B/C push/deploy while the required release gate fails | Pending release gate |
| Production/submission preservation | Main remains Phase A; all later work is on feature/3d-evidence-map | Preserved |

The field-provider failure remains visible and recoverable. Point planning can
still retrieve actual NASA data and reach step 4. That degradation does not count
as passing the separate successful-field requirement. Neither known OSM object
probes nor synthetic unit fixtures replace a live user-selected field flow.

All memory figures are sampled isolated process-tree working sets and can
double-count shared pages. They are not exact simultaneous session peaks or
guarantees. The mini-LM actually ran; its proposed topic was rejected by the answer
guard in this measurement. No crop accuracy claim follows from these benchmarks.
