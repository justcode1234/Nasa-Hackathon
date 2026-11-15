# Playwright workflow regression checks

Current branch result (15 November review work): **99 offline pass; full browser
run 36/44 pass, 8 fail**. Every failure is a real Overpass field lookup in the
example or human path. Four subsequently added field failure/retry UI cases pass
in a separate run. The suite now enumerates **48 local cases**; a complete green
48-case run is still required before release. There are no skips or hidden retries.
Reports: [full run](evidence/phase-b-playwright-local.json),
[failure/retry/point-comparison cases](evidence/phase-b-playwright-field-degradation.json),
[actual browser network failure](evidence/phase-b-field-network-diagnostic.json).

Phase A remains the public submission: 95 offline +32 local Playwright and 16
public cases passed before freezing production. Earlier Next/Compare source 0fe50ce
and its [before-fix regression](evidence/playwright-before-fix.json) are historical.

The blocked Next/Compare report exposed a coverage gap in our tests: checking that
Compare is disabled does not prove that the farmer understands the reason or can
recover. The new regression first clicks Next in that state and asserts a useful
destination and focus, then checks the explanation and preserved inputs. It failed
against the previous public release because step 01 stayed hidden after the click.

Run `npm run test:release` before publishing behavior changes. It runs the offline
logic/engine tests, builds the app and runs Playwright. `npm run test:e2e` runs only
the browser suite. Tests use the installed Google Chrome through Playwright 1.65.1;
no browser download is required here. Use `PLAYWRIGHT_CHANNEL=msedge` for installed
Edge, or install Chrome on another development machine. The dependency is for
development only and adds no browser runtime/framework to the app.

| Projects | Viewport | Transport |
| --- | --- | --- |
| static-desktop / static-mobile | 1280×1000 / 390×844 | Real browser worker |
| node-desktop / node-mobile | 1280×1000 / 390×844 | Real Node HTTP APIs |

Phase B adds semantic country/region/town, place-search, map-click and actual field
selection checks, new-crop comparisons, all four example regions, 20 axe-core
4.10.2 state scans across the four projects, model-on Q01/Q03/Q16 with actual worker
inference, short-height/landscape coverage and mouse-Send/Escape focus. Cambodia
is the zero-coverage fixture; Singapore now has cabbage/tomato screening coverage.

The suite tests zero screening coverage, actionable Next recovery, farmer-input
preservation, a fully visible blocker on mobile, missing coordinates/evidence,
zero/one/two selected alternatives, required baseline fields, successful Next and
Compare submission, three scenarios/nine slots, changed-input/country invalidation,
network failure and retry. It also executes all sixteen original QA questions with
their original semantic graders and captures actual answers as report attachments.
NASA success paths use actual observations; deliberate transport failures never
return synthetic NASA measurements. Tests run serially to limit provider traffic.
Failed expectations fail the command, without retries that hide a first failure.
A disabled Compare assertion alone never establishes a working human flow.

Reports, screenshots and failure traces are under `artifacts/playwright/`. Open the
HTML report with `npx playwright show-report artifacts/playwright/report`. Only
failed tests retain traces; browser profiles are temporary. No successful-run video
or persistent profile is recorded. Archived summaries under docs/evidence identify
the run and source revision; screenshots/traces remain local test artifacts.

To verify an already published release, set `TEST_BASE_URL` to its HTTPS origin and
run `npx playwright test`. This runs public-desktop and public-mobile and does not
start local servers. Reset that variable before local tests. For a focused check:
`npx playwright test --project=static-mobile --grep "zero coverage"`.

Provider outages are real test failures and must be distinguished from app defects
using the retained trace. These cases do not guarantee every possible flow is
bug-free, real-device usability, Safari support or scientific agronomic validity.

For a small real-browser field diagnosis, run `node scripts/diagnose-fields.js`.
It builds current sources, captures network failures and the actual UI status,
and exits nonzero while the York example returns fewer than three fields.

## Optional 3D preview release coverage

The feature branch adds actual POWER native-cell rendering/equality, real GIBS
metadata and imagery limits, DEM/terrain failure and retry, crop-window equality,
WebGL fallback, stale-load cleanup, and 3D axe/reduced-motion/short-screen/CSP checks.
These run in both delivery modes and both viewport sizes with the normal release
command. The example-region test additionally requires a live-returned Ames field
to render on terrain and produce derived context. Its field-discovery prerequisite
is not replaced by a recorded outline. Three-dimensional tests unrelated to fields
abort that transport deliberately to avoid unnecessary Overpass requests; the
separate real-field release cases stay mandatory. See docs/3d-validation.md for
scope, raw evidence and remaining gates. Do not run the feature branch's 3D specs
against the frozen Phase A origin and treat missing preview features as regressions;
public Phase A has its own retained release report.
