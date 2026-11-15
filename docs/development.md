# Development and verification

Visitor introduction: [README](../README.md). Start development by reading
[AGENTS.md](../AGENTS.md), especially section 10, and the [decisions](decisions.md).

## Public release and review branch

The public application is **Phase A**, with `main` at `f4c4fef`: four screening crop
types, 89/197 country/area lists with at least two screened categories, no 3D view or
voice controls. These are coverage counts, not validated agronomic recommendations.

`review/submission-accuracy` starts from `feature/3d-evidence-map` at `4f9b8b3`.
That feature source has seven screening crop types and 166/197 comparable lists,
preview-only 3D/GIBS/terrain and English voice controls. The typed-judgment
classifier is an experiment and is **not used by the application**. Keep these
features out of descriptions of the current public release.

This review uses a separate Git worktree. Incomplete assistant changes in the
original worktree are preserved and excluded from this review. No merge or
deployment is authorized by the review request. The review branch may be pushed
for inspection after checks; automatic Git deployment is
disabled for both the feature branch and this review branch in `vercel.json`.

## Run locally

Requires Node.js 22 or later. Install the pinned dependencies:

```sh
npm ci
npm run start:node       # local Node APIs + frontend, preferred port 3001
npm run start:showcase   # static browser-worker runtime, preferred port 3000
```

Run each runtime in its own terminal if needed. Both share NASA adapters, sourced
crop data and the deterministic strategy engine. The Node mode serves real HTTP
API routes; the static mode runs those handlers in a browser worker. Optional
model inference stays on the device in both. `npm start` retains showcase mode.
`PORT` selects a port; `NO_OPEN=1` suppresses browser opening. On Windows where
PowerShell blocks `npm.ps1`, use `npm.cmd`. `npm run dev:node` watches the Node server.

## Build and release checks

```sh
npm test
npm run test:release
```

The required release gate runs offline tests, builds `dist/client`, then exercises
the static and Node runtimes in installed Chrome at desktop and mobile widths.
No browser download is required. Never replace live service failures with fabricated
data, skip required cases, or report an earlier green run as a fresh result.

Additional checks:

```sh
npm run test:live
npm run test:browser
npm run test:node-browser
npm run test:firefox
npm run test:qa
node scripts/check-sourced-context.js
node scripts/benchmark-mini-lm.js
```

See [Playwright coverage](playwright.md), [original QA prompts](qa-regression.md),
[validation history](validation.md), and the [repository review](submission-accuracy-review.md)
for the exact executed results. Test output and temporary profiles belong under
ignored `artifacts/`; durable, dated evidence belongs under `docs/evidence/`.
Browser emulation does not prove real-phone performance, Safari support, microphone
quality or audible speech quality.

## Architecture and scientific boundaries

There are exactly four product modules: [SI](../public/js/modules/si.js),
[Map](../public/js/modules/map.js), [Data Flow](../public/js/modules/data-flow.js)
and [Strategy](../public/js/modules/strategy.js). Shared scientific logic lives in
`server/`; the [API handler](../server/api.js) supplies both transports.

The assistant first renders retrieved facts and caveats. Its custom 39,274-parameter
word language model has 157,096 bytes of weights and can prioritize a retrieved
paragraph. Raw generated agricultural claims are not displayed. It is not a
general-purpose LLM. The [model card](../models/README.md) records its limited
evaluation, including regressions; development match rates are not agronomic accuracy.
Training notebooks and the unwired classifier remain under `notebooks/` and `models/`.

Crop screening preserves the baseline, checks every sequence of the allowed crops,
and orders alternatives by documented criteria. It does not estimate crop water
demand, nitrogen credits, yield, profit or pest probabilities. SoilGrids values
remain regional context; only farmer-supplied pH/drainage enter the corresponding
screening checks. See [references](references.md) for source-region and timing limits.

## Deployment and submission artifacts

The Vercel project builds with `npm run build`, serves `dist/client`, and requires
no database, API keys, inference server or serverless functions. Keep the checked-in
CSP and attribution files. The [deployment history](deployment.md) includes account,
release and rollback details; verify `justcode1234` before any authorized deployment
and preserve the separate `4chatgptsim` account.

Submission copy and frozen public artifacts are not regenerated during this
documentation review. Proposed wording lives in a separate review file. Changing
the source ZIP, PDF or portal copy requires a deliberate submission/release decision.
This branch inherits the feature branch's unreleased application code. Do not merge
it into Phase A merely to adopt documentation; review the documentation commit
separately if the owner later wants a documentation-only update on main.

## Repository layout

| Location | Purpose |
| --- | --- |
| Root | Visitor README, agent handoff, MIT licence, third-party notices, package/build/deployment/test configuration |
| `docs/` | Developer guides, references, plans, submission copy and dated reports |
| `docs/evidence/` | Durable raw verification results and selected screenshots |
| `public/` | Shipped frontend, country data, model assets, credits and frozen submission artifacts |
| `server/` | Shared data adapters, API validation and scientific decision logic |
| `tests/` | Offline tests, Playwright workflows and QA prompts |
| `scripts/` | Build, local launch, verification and packaging tools |
| `models/`, `notebooks/`, `experiments/` | Model documentation, reproducible experiments and archived candidates |

Application paths and configuration entry points stay in place. Moving them merely
to shorten the root listing would add import/build risk without helping visitors.
