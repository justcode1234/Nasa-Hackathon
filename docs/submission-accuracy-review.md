# Submission and repository accuracy review

Review date: **15 November 2026 (UTC+8)**. Status: **review and verification complete;
production/submission changes require owner approval**.

## Scope and release boundary

Requested work: compare code with submission claims, simplify the visitor README,
organize documentation conservatively, verify references and run the release suite.
No NASA portal edit, merge or deployment is part of this work. The separate review
branch can be pushed for inspection with automatic deployment disabled.

- Review branch: `review/submission-accuracy`, based on feature source `4f9b8b3`.
- Review worktree: `C:\Users\~\Documents\Life\Coding\github\Nasa-Hackathon-repository-review`.
- Original worktree: `Nasa-Hackathon`, branch `feature/3d-evidence-map`; incomplete
  assistant/regional-crop work is preserved there and excluded here.
- Public application: [Phase A](https://nasa-hackathon-three.vercel.app/), `main`
  `f4c4fef9202d133a4f412973a8a8653fd3d21965`.
- The reviewed source contains preview features absent from production. A local
  release-suite pass cannot be presented as a production feature release.
- This branch inherits those feature commits. Do not merge it into Phase A simply
  to adopt the documentation. A later approved documentation-only main update
  should select the review's documentation changes deliberately.

The public site, GitHub repository, presentation, PDF, credits and submission text
returned 200 without authentication. Public core assets match `main` by SHA-256;
see [public links](evidence/repository-review-public-links.json) and
[asset comparison](evidence/repository-review-production-assets.json).

Review commit `7c2f80f` is pushed to `origin/review/submission-accuracy`. Its README
and report return 200 without login. After pushing, remote main still resolves to
`f4c4fef`, production HTML has the same hash, and the GitHub deployment query for
the review SHA contains no records. The branch's automatic deployment is disabled;
no deploy or merge command was executed. This query is supporting evidence, not a
complete Vercel account inventory. [Publication checkpoint](evidence/repository-review-publication.json).

## Overall assessment of the supplied summary and details

The user's summary/details are broadly consistent with the public prototype and
appropriately reject yield/savings guarantees. Use **screening** rather than
scientific validation, clarify POWER's model contribution, identify the limited
crop/country coverage, and explain which soil inputs actually enter comparison.
The proposed wording is saved [separately](submission-review-proposed.md).

`docs/submission.md`, `public/submission/`, the PDF, source ZIP and NASA account
record are deliberately unchanged. The report does not certify that the current
NASA portal text matches either local copy; portal editing/submission is owner work.

At **20:05 UTC+8** the public team record showed both reference fields populated,
but `isSubmitted: false`, `projectSubmitted: false`, and `submittedAt: null`.
Its last saved timestamp was 19:40 UTC+8. This supersedes the earlier empty-reference
observation and is only a dated public-record status, not owner-account verification.
Evidence: [team status](evidence/repository-review-team-status.json). The earlier
handoff's stated deadline is 23:59 Singapore time on 15 November; only the owner can
complete any required portal submission.

## Four-module implementation audit

| Module | Actual implementation | Evidence and limits |
| --- | --- | --- |
| SI Model | Sourced crop-country answers, deterministic guards, validated guided actions; optional compact word LM reorders retrieved paragraphs | [API](../server/api.js), [answers](../server/agronomy/answers.js), [conversation](../server/agronomy/conversation.js), [chat](../public/js/modules/chat.js), [workflow actions](../public/js/modules/workflow-assistant.js), [model worker](../public/js/modules/mini-lm-worker.js). No free-form generated agronomic claims displayed; not a general-purpose LLM. |
| Geospatial Map | Leaflet, country/optional region/town selection, coordinates/search, OSM field records | [Map module](../public/js/modules/map.js), [location adapter](../server/context/locations.js), [farm/place adapter](../server/context/farms.js). Global map access is not global agronomic validation. Production uses bounded OSM map queries; feature source uses Overpass. |
| Data Flow | Shared POWER retrieval/normalization/caches; daily metadata and monthly charts/tables; separate third-party context | [POWER](../server/nasa/power.js), [UI](../public/js/modules/data-flow.js), [browser transport](../public/js/lib/api.js), [Node entry](../server/index.js). Five real parameters; fill codes/nulls stay missing; unit mismatch stops screening. POWER includes satellite-derived and model/reanalysis information. |
| Strategy Logic | Enumerates allowed three-crop sequences, preserves baseline, orders two distinct alternatives by transparent criteria over 12 months | [Engine](../server/agronomy/rotation.js), [UI](../public/js/modules/strategy.js), [crop registry](../server/agronomy/crops.json). Three four-month slots and 14-day turnaround are assumptions. No water balance, yield, economic or pest-probability model. |

The four workflow screens map onto these same four modules. 3D is part of the map
module on the feature branch; it is not a fifth module or a public Phase A feature.

## Discrepancies and proposed corrections

| Finding | Evidence / implication | Suggested wording or action |
| --- | --- | --- |
| README mixed production with preview and developer setup | It opened with install commands and described 3D, voice, seven crops and local test counts | New README leads with the public link and four features; preview details/setup move to `docs/development.md`. |
| “NASA environmental observations” can sound like direct farm satellite measurements | POWER adapter labels estimated gridded observations and includes model/reanalysis sources | “Historical regional, satellite- and model-derived NASA POWER estimates.” Keep this distinction near the data explanation. |
| “Seasonal suitability” is broader than implemented validation | Same-calendar historical year, selected frost/ideal-air rules and maturity checks; no local planting calendar, forecast or multi-year climate normal | “Simplified calendar fit and selected historical environmental exposure.” |
| “Available soil information” may imply SoilGrids feeds scoring | Strategy uses farmer-supplied pH/drainage; the regional model is displayed separately | “Optional farmer-supplied pH and drainage checks, with separately labelled regional soil context.” |
| SoilGrids availability must be qualified | Official product page announces REST service temporarily paused, no restoration date | “Optional regional SoilGrids context when the provider is available; failures leave soil unknown.” Do not promise always-working soil retrieval. |
| “Lightweight AI assistant” could overstate the model's role | Rules/retrieval produce answers/actions. 39,274-parameter, 157,096-byte word LM selects an existing paragraph behind guards | “Sourced assistant with validated planning actions and an optional experimental browser language model.” Weight size is not total runtime/download size. |
| Crop coverage needs public-release precision | Main has four rules and 89/197 comparable national lists; feature has seven and 166/197 | Name the public count. Neither count represents validated farm recommendations. Rice/wheat knowledge answers do not confer screening support. |
| “Unsupported crops remain selectable” in submission copy needs qualification | UI choices depend on national records or field tags; countries without records have no choices. API accepts unsupported baselines. | “Recorded baseline crops outside the screening catalogue remain unassessed. Missing country coverage can prevent selection/comparison.” |
| Solar is integrated but not a crop-ranking criterion | POWER displays solar radiation; ranking vector uses temperature/rain exposure, calendar/family/soil checks | Say solar is visualized as context. Do not claim a solar-based crop recommendation model. |
| Aspirational resilience is not measured benefit | No field trial, crop outcome study or validated economic/water model | Keep resilience as a goal; do not claim measured improvement, loss prevention or a proven optimal rotation. |
| AI disclosure in saved copy names Claude Code and Codex but not ChatGPT explicitly | User confirms all three assisted; app model is separate | Proposed disclosure names ChatGPT, Claude/Claude Code and OpenAI Codex. Do not imply every AI output or future media has already been reviewed. |
| Historical validation counts are easy to mistake for current scope | `docs/submission.md` has 95 offline / 32 browser and older standalone counts; feature handoffs have later counts | Keep counts dated with exact code, runtime and test coverage. New review results appear below, without rewriting frozen submission claims. |
| Documentation had mutually inconsistent NASA-layer scope | Earlier data-source notes say no SMAP/GPM integration; later preview implements their GIBS imagery | Reference inventory now distinguishes public POWER integration, preview imagery only, and research-only datasets. No standalone SMAP/GPM crop-model claim. |
| Seven slides are available, no demo video identified | Public HTML deck and seven-page PDF return 200 | Link the real deck/PDF; do not invent a video URL. |
| Source list omitted some scientific evidence | Provider homepages alone do not support crop timing, family, pH or irrigation-ratio claims | Detailed references link the actual extension publications, ABS source, scope and attribution. |

## Organization changes

The root already contains essential manifests/configuration, licensing and project
directories, with detailed reports under `docs/`. Avoid unnecessary code moves.
The meaningful cleanup is moving detailed setup/testing/model/preview explanations
out of the visitor README into `docs/development.md`, adding a documentation index,
and consolidating a version-aware source inventory in `docs/references.md`.

Keep `AGENTS.md`, `README.md`, `LICENSE`, `THIRD-PARTY-NOTICES.md`, package files,
`playwright.config.js`, `vercel.json` and ignore/attribute configuration at root.
No imports, application paths, npm script names, package versions, GitHub settings
or build/output paths change. No `.github/` workflow directory exists at the
review baseline; no workflow has been removed. Vercel gains only an explicit
automatic-deployment disable for this review branch. It does not alter main's build.

## Verification

| Check | Actual result | Evidence |
| --- | --- | --- |
| `npm.cmd run test:release` | Exit 0; **119/119 offline + 116/116 browser cases**, 0 skips/flaky/unexpected; browser phase 19.8 minutes | [Summary and all case outcomes](evidence/repository-review-release.json), [log](evidence/repository-review-release.log), [complete original report, gzip](evidence/repository-review-release.raw.json.gz) |
| Unauthenticated public Playwright workflows | Exit 0; **16/16 cases**, desktop 1280×1000 and mobile 390×844; 0 skips/flaky/unexpected, 32 original QA question executions | [Full report](evidence/repository-review-public-playwright.json), [log](evidence/repository-review-public-playwright.log) |
| Documentation local links | All checked inline local links pass after final edits; exact count in report | `node scripts/check-documentation.js`; [final local-link report](evidence/repository-review-local-links.json) |
| External citation GETs | 35/45 reachable; 8 HTTP 403 restrictions, 2 connection/redirect failures; no checked 404/410 | [Direct check](evidence/repository-review-documentation-links.json), [official PDF/web-reader follow-up](evidence/repository-review-reference-followup.json) |
| Production attribution | 14/14 selected public files match main, including model metadata/weights and submission text | [SHA-256 comparison](evidence/repository-review-production-assets.json) |
| Frozen files and scope | 11 protected submission/licence/package/config files byte-identical to review base; coverage recomputed as 4 crops, 89/197 lists, 9,238 records, 70,036 gazetteer points | [Scope and protected hashes](evidence/repository-review-scope.json) |

The local release gate covers both static browser-worker and Node HTTP transports
at desktop/mobile widths, real field discovery, NASA retrieval, exact baseline
preservation and two alternatives, invalidation/retry, accessibility scans,
preview 3D/GIBS/terrain, and existing speech fixtures. No test was skipped, removed,
weakened or edited. The public run intentionally selects the three existing
Phase A-compatible spec files, rather than pretending unreleased controls exist
in production. It covers the submission fixture, every example field region,
Next/Compare recovery, real-data retry, focus/short screens and original QA replies.

Additional executed checks:

- `npm ci --ignore-scripts`: installed pinned lockfile dependencies; 0 reported
  audit vulnerabilities. No new dependency, model or browser download added.
- Ordinary unauthenticated HTTP GETs: public application/GitHub/deck/PDF/credits/
  submission text accessible. Six of seven supplied provider pages returned 200;
  GBIF homepage returned 403 here. Canonical links retained with that caveat.
- Public model paths were resolved from the actual worker (`models/fieldshift-mini`)
  and verified. Initial guessed paths were probe mistakes, not application failures.
- `node --check scripts/check-documentation.js` and `git diff --check` pass. The new link checker
  exits 1 on inaccessible external citations; those failures remain visible.

Reproduction of the public selection in PowerShell:

```powershell
$env:TEST_BASE_URL = 'https://nasa-hackathon-three.vercel.app/'
npx.cmd playwright test workflow.spec.js review-phase-a.spec.js assistant.spec.js
Remove-Item Env:TEST_BASE_URL
```

The executed run used the same existing specs/projects through an isolated
configuration under ignored `artifacts/repository-review/`, with separate report
paths so it could not overwrite the local release report. Browser emulation is
not real-phone verification. No fresh Firefox, Safari or live microphone check
was run as part of this documentation review.

## Modified files

| Files | Change |
| --- | --- |
| `README.md` | Visitor-first public introduction, live link, four features, real deck/PDF, concise limits and references |
| `docs/development.md`, `docs/README.md` | Moved setup/testing/preview detail out of the visitor README; added a documentation index and repository map |
| `docs/references.md`, `docs/data-sources.md` | Detailed citations, licence/attribution, integrated versus preview/research scope, service/access limitations |
| `docs/submission-accuracy-review.md`, `docs/submission-review-proposed.md` | Evidence-based discrepancy report and separately proposed copy; no submitted descriptions overwritten |
| `AGENTS.md`, `docs/decisions.md`, `docs/validation.md` | Current cross-device handoff, actual checks, release boundary and remaining work |
| `scripts/check-documentation.js` | Dependency-free read-only local/external documentation link checker |
| `vercel.json` | Disable automatic deployment for this review branch; existing feature exclusion and production build settings preserved |
| `docs/evidence/repository-review-*` | Raw/summary results, hashes, public status, access failures and Singapore reproduction |

## Remaining product issues and limitations

- User-reported AX crop-selection/assistant explanation and Singapore country/region
  loop are outside this documentation-only change. Preserve the unfinished feature
  work and add targeted regressions before claiming these behaviors fixed.
- A fresh unauthenticated Singapore check at 1280 and 390 px reproduced the
  **Whole Singapore → Choose a region → state/region/town prompt** wording.
  It correctly leaves coordinates blank, but the generic region handoff is
  confusing for this city-state. The gazetteer has region codes without names,
  rather than usable named regions. Prefer a direct town/place/field path when
  named regions are unavailable, while keeping a national overview distinct from
  field weather. [Actual replies and state](evidence/repository-review-singapore.json).
- User-requested chat examples and Back/Next alignment/chat overlap remain pending
  in the feature handoff. Existing release tests are not proof of untested new requests.
- Shared Overpass service failures, SoilGrids REST availability and GBIF access
  restrictions are distinct external limitations; never substitute fabricated results.
- Real phones, Safari/WebKit, real microphone recognition, audible read-aloud,
  exact session memory peaks and independent agronomic validation are unverified.
- Changes are on the separate review branch. Production and the NASA submission stay
  unchanged until the owner explicitly authorizes an appropriate action.
