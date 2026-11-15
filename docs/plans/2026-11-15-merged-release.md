# Active merged release work — 15 November 2026

The user explicitly approved **merging all branches into one main branch** and
**deploying after all release checks pass**. These decisions supersede the earlier
Phase A freeze for this release. Do not edit the NASA portal. Keep the classifier
unwired and retain the original Phase A artifacts as a dated snapshot.

Current branch: feature/3d-evidence-map. Review branch 9685ccb was merged at c0690dc
after preserving the unfinished assistant changes at 5647f04. Main is still f4c4fef;
no new deployment yet. The documentation-review worktree is clean on its review
branch; detach it before deleting that branch. Preserve its artifacts. A separate
Kilo worktree is detached already and must not be deleted as part of branch cleanup.

## Implemented, currently being verified

- Three persistent chat starter buttons: kai-lan/Singapore facts, guided India
  tomato/cabbage/onion planning, and current crop-choice help.
- One collapsed Assistant settings block; mic/Send row; first-use ~70 MB speech
  notice with Continue/Cancel before permission/download; late permission cannot
  start recording after chat closes. On-device English system TTS remains distinct
  from an English-only-trained downloadable TTS model (the latter is not implemented).
- Navigation aligns to the main content edges; chat sits above the measured bar.
- Shared planning-help answers explain actual crop coverage. Official ÅSUB 2024
  records add five unassessed Åland baseline choices, not FAOSTAT records or rules.
- 28 new unexpected-answer regressions: economics, forecasts, variants, missing
  data, nonsense, other-country weather, prompt injection and context changes.
- Singapore/no named-region data goes directly to town/map/coordinates; whole-country
  context does not create a farm point.
- User-requested location method switch: places/map versus coordinate inputs;
  Next loads NASA evidence; duplicate Load button is hidden as an internal submit.
- Celsius/Fahrenheit display and three explained weather graphs. Original NASA
  values, JSON downloads and strategy calculations stay in Celsius.
- Alternatives default to the user-selected screened baseline crops; other crops
  require explicit choice. Chat accepts “Allowed crops: …” separately from baseline.
- Step 4 explains each row, uses Not assessed/Not comparable for missing coverage,
  and shows coverage meters. Apple/apricot factual tree/Rosaceae context is sourced
  from NC State; no annual screening rule or orchard prescription was invented.

## Executed checks and current process

128/128 offline tests pass. Focused final static-desktop browser run passed 14/14.
Legacy model-enabled Chrome passed 33 checks, Node Chrome 19 and Firefox 18.
The original QA plan passes 16 questions + six flows with model off and on (22/22
in each); actual answers are saved separately under artifacts/final-quality.
Initial failures and their corrections remain in the earlier logs. A first full
run was deliberately interrupted after screenshot review found the closed Chat
launcher overlapping short-screen navigation. The launcher is fixed; its closed
state is now asserted too. The earlier partial log is preserved, not a passing gate. A second run exposed
two mobile test-harness failures when it tried to change country underneath open
chat. The helper now closes chat, changes country and reopens it; no assertion was
removed or forced. The failure log/context is retained; this is another fresh full run.

Full `npm run test:release` is running as session **6649**, log
`artifacts/final-quality/merged-release.log`, with **152 browser cases** across
static/Node and desktop/mobile. It includes the new Aland regression, 28 unexpected
questions with the model off/on in every project, live fields, actual STT and TTS
state checks. Do not restart a live handle or claim a final pass until it ends.

Read-aloud decision: user explicitly chose the installed English voice for this
release. Its training-language provenance remains unverified; no separate English-only
TTS model is claimed. The public NASA record at 22:09 UTC+8 reports submission at
21:04:58 today; no portal action was performed. See merged-release-team-status.json.

## Remaining before merge/deploy

1. Focused verification is complete; finish the full release gate and fix any failures. Update old selectors
   for the new entry method, settings and Next. Preserve every original QA prompt;
   add an explicit allowed-crop reply when the existing rice/wheat/bean example
   needs new alternative crops. Do not silently approve corn.
2. Add/verify missing meaningful cases: Åland baseline options, late microphone
   permission cancellation, axe while recording/reading, conversion/missing-data
   display and approved-crop subsets. Save current replies, not just pass counts.
3. Run all four Playwright runtime/viewport projects and the legacy Chrome, Node,
   Firefox and QA suites; record real service failures. No weakened/skipped tests.
4. Screenshot review is complete at all five sizes: four steps, chat, 3D and
   terrain. Selected images/contact sheets are in docs/evidence/merged-release-visuals.
   Re-shoot if any further layout change is needed.
5. Reconcile README/references/current release docs and demo with seven screened
   crops, 166/197 coverage, preview features becoming public. Keep original Phase A
   submission artifacts visibly dated rather than silently rewriting portal claims.
6. Full npm run test:release after final behavior changes; save raw/compressed
   evidence. Commit, merge all histories into main, verify Vercel identity/project,
   deploy only the tested source, and verify the public app and assets.
7. Only after successful integration, remove the other local/remote branches with
   normal merged-branch deletion. Leave one main branch. Preserve history/tags and
   detached worktree files. Update AGENTS.md, decisions and validation with actual
   commit/deployment/results and any limits.

No dependency was added. Real phones, real microphone/accent/noise quality,
audible read-aloud, Safari and independent agronomic validation remain unverified.

## Continuation checkpoint - 15 November 2026, about 23:05 UTC+8 (Claude Code session)

- **Final gate result:** the full run started as session 6649 finished at 22:48 with
  **128/128 offline and 152/152 browser cases**, 38 per project, 0 skipped, 0 flaky.
  Evidence: docs/evidence/merged-release-final-gate-summary.json (+ raw .json.gz and
  .log.gz). All 60 files in merged-release-application-source.json were re-hashed after
  the run and match. `npm test` was re-run afterwards: 128/128.
- **Authorisation checked:** the Codex session log holds the user's messages "just
  merge all and i should have just 1 branch now" and "Deploy after all release checks
  pass".
- **Merged locally, NOT pushed:** local `main` is merge commit b094f40 (feature branch
  949d4c7 merged with --no-ff; identical content). `origin/main` is still f4c4fef and
  production still serves Phase A. `git push origin main` was refused by the Claude
  Code permission check because that approval was not given in that session. No
  workaround was attempted.
- **To finish (needs the user's go-ahead in the active session):**
  1. `vercel whoami` = justcode1234; project nasa-hackathon (verified 23:00).
  2. `git push origin main`; wait for the production deployment to be Ready.
  3. From main: `TEST_BASE_URL=https://nasa-hackathon-three.vercel.app npx playwright
     test`; check the app, /submission/, /submission/phase-a/, the PDF and credits
     logged out; compare public asset hashes with `dist/client`.
  4. Record deployment id and results in docs/deployment.md, AGENTS.md section 10,
     decisions and validation.
  5. Only then delete merged branches (local and remote feature/3d-evidence-map,
     feature/review-phase-b, review/submission-accuracy). Detach the review worktree
     first; leave the Kilo worktree alone; keep tag phase-a-submission-2026-11-15.
- **Rollback target:** production deployment nasa-hackathon-e5zj96p3p (Phase A),
  recorded in artifacts/final-quality/vercel-production-before.json; then revert the
  merge on main with `git revert -m 1 b094f40`.
