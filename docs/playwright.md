# Playwright workflow regression checks

Latest local result: 95 offline tests and 16 Playwright tests passed across all
four projects, including 64 executions of the original QA questions. Zero skips,
unexpected failures or flaky outcomes. Public verification of this UI fix follows
deployment; the pre-fix public test deliberately failed on the reported Next bug.

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

The suite tests zero screening coverage, actionable Next recovery, farmer-input
preservation, a fully visible blocker on mobile, missing coordinates/evidence,
zero/one/two selected alternatives, required baseline fields, successful Next and
Compare submission, three scenarios/nine slots, changed-input/country invalidation,
network failure and retry. It also executes all sixteen original QA questions with
their original semantic graders and captures actual answers as report attachments.
NASA success paths use actual observations; deliberate transport failures never
return synthetic NASA measurements. Tests run serially to limit provider traffic.
Failed expectations fail the command, without retries that hide a first failure.

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
