# FieldShift final quality handoff for Codex

Written 15 November 2026, about 17:50 Singapore time (UTC+8), by the Claude Code
session. This is the active next-work plan. It supersedes the "what to do next" parts
of `docs/plans/2026-11-15-review-fixes-and-3d-plan.md`, whose phases A-C are now
implemented. Earlier user decisions stay in force.

**Nothing in sections 3-7 is done yet. Treat every task as proposed until it is
implemented, tested and recorded in AGENTS.md section 10.**

## 0. Hard rules for this handoff

1. **Deadline: 23:59 Singapore time, 15 November 2026.** Submission-critical work
   comes first. Anything that cannot be finished and verified before then waits.
2. **Never merge to `main`, promote, or deploy to production without the user's
   explicit approval in the conversation.** Production is frozen at Phase A.
3. **Do not edit, submit or claim submission of the NASA project.** Only the team
   owner can. Report what the public team page shows.
4. Keep Node.js + vanilla JS + exactly four modules. No new frameworks. No new
   dependency without telling the user why, its licence and its size.
5. Do not wire in the typed-judgment classifier unless a fresh, untouched test set
   shows it beats the existing rules. It currently does not.
6. No invented data, results or test passes. Separate tested, unverified, blocked and
   proposed. A failure caused by a busy public service is still reported as a failure,
   with the cause.
7. Run `npm run test:release` before any release decision and after any behaviour
   change. Do not weaken, skip or delete a test to get a pass.

## 1. Current status and verified facts

### Branches and deployments

| Item | State |
| --- | --- |
| Working branch | `feature/3d-evidence-map` at `638431a`, pushed, clean tree |
| `main` (local and remote) | `f4c4fef`, Phase A, frozen |
| Production | https://nasa-hackathon-three.vercel.app/ serves Phase A |
| Preview | https://nasa-hackathon-crjbv8ur9-justcode1234s-projects.vercel.app, deployment `dpl_GRtYSt2eaYTbQMAhJA4auBiJRPJA`, built from `36e4ce2` plus working tree. Behind Vercel login, so not a public demo link |
| Auto-deploy | Disabled for this branch in `vercel.json` (`git.deploymentEnabled`) |
| Vercel identity | CLI `justcode1234`, project `nasa-hackathon`. Preserve the separate `4chatgptsim` account |

### Verified on 15 November (this machine, installed Chrome via Playwright)

- `npm run test:release` on the feature branch: **117/117 offline, 116/116 browser**, no
  skips or flaky results. Evidence: `docs/evidence/v5-green-release-summary.json`.
- Production, logged out: Phase A suite at `f4c4fef` passed **16/16** desktop and mobile
  cases. App, deck page, 7-page PDF, credits page and source ZIP return 200 without
  login. Evidence: `docs/evidence/public-logged-out-check-2026-11-15.json`.
- Preview: 12 of 14 checked files are byte-identical to the local build; the two HTML
  files differ only by Vercel's injected preview toolbar script.
- `npm audit`: 0 findings.
- **NASA team page (public data, not logged in, about 09:40 UTC): `isSubmitted: false`,
  `submittedAt: null`, last saved 07:53 UTC; data-references and project-references
  fields empty.** The project is a draft.

### What exists on the feature branch but not in production

- Seven screening crops (adds tomato, cabbage, bulb onion); 166 of 197 countries can
  produce a comparison (production: four crops, 89 of 197).
- Results-first step 4 with plain wording and human dates; evidence view with °C, month
  names and charts first.
- 3D evidence map (MapLibre 6.4.1, lazy-loaded): true-size NASA POWER cells, month
  control, dated GIBS imagery, terrain with visible exaggeration, selected field on
  terrain with derived slope/aspect, crop-slot weather-window link.
- Field lookup through three public Overpass services with backoff under a 75 s
  deadline (`server/context/farms.js`).
- Voice input (Whisper tiny.en on device, vendored Transformers.js 4.3.2) and read-aloud
  (on-device English system voice).
- Typed-judgment classifier experiment in `models/judgment/`. Not wired into the app.

### Not verified (do not describe as working)

- Real phones or tablets: layout, 3D performance, memory, microphone, voice.
- Safari/WebKit anywhere. Firefox for 3D, voice and the Phase B/C UI.
- The older scripts `test:browser` (33 Chrome checks), `test:node-browser`, `test:firefox`
  and `test:qa` have **not been run on this branch in the latest session**; they may
  need selector/text updates after the step-4 and evidence rewording.
- Audible read-aloud output (tests check text, voice choice and Stop only).
- Real accents, noise and real microphones for dictation (fixture is synthetic speech).
- Memory use of the speech model; combined peak memory with 3D and the mini LM.
- Any Playwright run against a public URL of the feature branch.
- Independent agronomic review of crop rules; independent review of classifier labels.

## 2. Known bugs, limitations and risks

| # | Item | Severity |
| --- | --- | --- |
| R1 | NASA project unsubmitted; references fields empty in the saved draft | P0, owner action |
| R2 | Production and submission text describe Phase A; the feature branch differs (crops, coverage, 3D, voice). Any release must update deck, submission text and README together | P0 if releasing |
| R3 | Field lookup depends on shared volunteer Overpass servers. One full run was 95/96 when all three were busy for 75 s. Tests press Retry like a user (max twice) | P0 risk for demos; cannot be fully removed |
| R4 | First voice use downloads about 43.5 MB model + 26.9 MB WASM. Slow on mobile data; no size warning before the download starts | P1 |
| R5 | `maps.mail.ru` is one of the three lookup hosts and is in the CSP. The user has not been asked whether that host is acceptable | Decision |
| R6 | Speech model is fetched from huggingface.co at run time (pinned revision). An outage there disables dictation only; typed chat is unaffected | P2 |
| R7 | Chat panel now holds two status lines, two `<details>` blocks, the model controls and voice controls. It is crowded, especially at 390 px | P1 |
| R8 | `public/css/app.css` (139 lines) grew by appended blocks for 3D, terrain, GIBS and voice. Spacing and control sizes are not yet one system | P1 |
| R9 | Read-aloud depends on installed OS voices; some devices have no on-device English voice. The app says so, but this is untested off Windows | P2 |
| R10 | Step 4 compares only three 4-month slots with a 14-day turnaround assumption; heat rules exist for pea and cabbage only | Known scientific limit; keep visible |
| R11 | `AGENTS.md` section 10 is long and mixes current and historical entries (historical ones are labelled). Sections 1-9 still say "planning stage" in the header | P2 docs |
| R12 | `docs/submission.md`, `public/submission/*` and the deck still describe Phase A numbers. Correct for production today; wrong if the branch is released | Tied to R2 |

## 3. Prioritised tasks

### P0 - correctness, science, broken flows, submission risk

- **P0.1 Submission support (do first, 15 minutes).** Re-read the public team page and
  report `isSubmitted`. Give the user ready-to-paste text for the empty fields from
  `docs/submission.md` (NASA data, other references, AI disclosure including Codex and
  Claude Code). Do not log in or submit.
- **P0.2 Release decision package.** Present the user with the two options in section 8
  and wait. Default: production stays Phase A until after submission.
- **P0.3 Scientific wording audit of every user-visible string** on the branch. Files:
  `server/agronomy/rotation.js`, `answers.js`, `conversation.js`, `crops.json`,
  `knowledge.json`, `public/js/modules/strategy.js`, `data-flow.js`, `map3d.js`,
  `terrain-controls.js`, `gibs-controls.js`. Check: no guarantee, yield, savings,
  probability or "best crop" claims; every number has units, date, source, resolution;
  imagery is labelled imagery; slope is context, not an erosion prediction; missing is
  never zero. Fix wording only where a claim is unsupported.
- **P0.4 Re-verify the three new crops against their sources** (quotes are in the old
  plan, section 3). Confirm `crops.json` values equal the quoted numbers and that
  Chinese cabbage, bok choy, spring/green onion and scallion do not inherit cabbage or
  bulb-onion rules (`server/agronomy/catalog.js`).
- **P0.5 Run the legacy suites on this branch** and repair them without weakening:
  `npm run test:browser`, `test:node-browser`, `test:firefox`, `test:qa`. Record real
  results. If a script fails only because wording changed, update the assertion to the
  new wording and say so.
- **P0.6 Unexpected-question sweep for the assistant.** Add 25-30 new prompts (not the 16
  acceptance prompts) to a new spec: unsupported crops, other countries' weather,
  yield/profit/guarantee requests, prompt-injection ("ignore your sources"), nonsense,
  mixed-language, very long input, follow-ups after a country change. Each must give a
  sourced answer, an explicit gap, or a clarification; none may run an action from a
  read-only question. Fix failures in `answers.js` / `conversation.js` /
  `public/js/lib/chat-intent.js` / `workflow-assistant.js`.

### P1 - usability, CSS, responsive behaviour, accessibility

- **P1.1 Screenshot review** (section 7) at 1366x768, 1280x1000, 390x844, 844x390 and
  683x384, every step plus chat open, 3D open, terrain open and step 4 with results.
- **P1.2 Chat panel declutter.** Group model controls and voice controls into one
  collapsed "Assistant settings" `<details>`; keep one visible status line; keep the mic
  and Send on one row at 390 px. Files: `public/index.html`, `public/css/app.css`,
  `public/js/modules/chat.js`, `speech.js`. Keep ids used by tests or update tests.
- **P1.3 Voice download notice.** Before the first download, show the size (about 70 MB
  in total) in the status line and let the user cancel. `speech.js`.
- **P1.4 CSS consolidation.** One spacing scale, one control height, one secondary
  button style across forms, 3D controls, GIBS, terrain and voice. No visual redesign;
  compare screenshots before and after.
- **P1.5 Accessibility pass on new UI.** Extend the axe scans to: chat with mic
  recording, read-aloud active, 3D open with GIBS and terrain panels. Check focus order,
  `aria-pressed` names, live-region noise (there are many `role="status"` elements), and
  contrast of `.mic.recording`.
- **P1.6 Farmer-language pass** on steps 2-4 and the 3D panel: explain "native cell",
  "hillshade", "exaggeration", "analogue year" in one short line each, on the page, not
  in tooltips.

### P2 - performance and worthwhile enhancements

- P2.1 Measure and record: initial page weight, time to interactive, 3D open-to-data,
  speech load and memory (`scripts/browser-memory.js`, `benchmark-3d-app.js`). Report
  as measurements, not guarantees.
- P2.2 Cache headers for `/vendor/transformers/*` and `/vendor/maplibre/*` in
  `vercel.json` (immutable, versioned by package).
- P2.3 Field lookup: show which service answered and how long it took in the status
  line; keep Retry prominent.
- P2.4 Real-phone session if a device is available: Chrome Android and Safari iOS, the
  full four-step flow, 3D, dictation, read-aloud. Record device, OS, browser.
- P2.5 Shorten `AGENTS.md` section 10 into "current state" plus a linked history file,
  without dropping decisions.

### P3 - optional, must not delay release

- P3.1 Classifier: collect reviewed real questions, build a new untouched test set,
  retrain, compare. Keep it unwired unless it wins.
- P3.2 A downloadable English-only TTS model, only with verified training provenance,
  a permissive phonemizer licence and a working browser runtime.
- P3.3 More sourced crops or NASA layers (SMAP/IMERG values, not only imagery).

## 4. Files and modules to inspect, by product module

| Module | Frontend | Shared/server logic | Tests |
| --- | --- | --- | --- |
| 01 SI Model | `public/js/modules/chat.js`, `workflow-assistant.js`, `si.js`, `mini-lm-worker.js`, `speech.js`, `stt-worker.js`, `public/js/lib/chat-intent.js` | `server/agronomy/answers.js`, `conversation.js`, `catalog.js`, `knowledge.json` | `tests/conversation.test.js`, `workflow-assistant.test.js`, `answer-boundaries.test.js`, `qa-contracts.test.js`, `tests/e2e/assistant.spec.js`, `speech*.spec.js` |
| 02 Geospatial Map | `map.js`, `map3d.js`, `terrain-controls.js`, `gibs-controls.js`, `location-picker.js`, `context.js` | `server/context/farms.js`, `locations.js`, `terrain.js`, `terrain-math.js`, `gibs.js` | `tests/context.test.js`, `locations.test.js`, `tests/e2e/map3d*.spec.js`, `terrain.spec.js`, `field-terrain.spec.js`, `gibs.spec.js`, `live-fields.js` |
| 03 Data Flow | `data-flow.js`, `public/js/lib/power-columns.js`, `weather-window.js`, `api.js` | `server/nasa/power.js`, `power-grid.js`, `server/context/client.js`, `soil.js`, `water.js`, `pests.js` | `tests/nasa.test.js`, `weather-window.test.js`, `api-transport.test.js`, `tests/e2e/workflow.spec.js`, `weather-window.spec.js` |
| 04 Strategy Logic | `strategy.js`, `public/js/lib/comparison-readiness.js`, `tabs.js`, `app.js` | `server/agronomy/rotation.js`, `crops.json`, `server/context/crops.js`, `country-crops.json` | `tests/rotation.test.js`, `comparison-readiness.test.js`, `country-crops.test.js`, `integration.test.js`, `tests/e2e/review-phase-*.spec.js` |
| Shell, CSS, delivery | `public/index.html`, `public/css/app.css`, `public/credits.html` | `server/index.js`, `server/api.js` (CSP), `vercel.json` (CSP, deploy flag), `scripts/build-browser.js`, `scripts/static-preview.js` | `tests/deployment.test.js`, `start.test.js` |

Both CSPs (`vercel.json` and `server/api.js`) must change together.

## 5. Execution order

1. `git status`, `git log -3`, confirm branch `feature/3d-evidence-map` at or after
   `638431a` and `main` at `f4c4fef`. Read AGENTS.md sections 10-12 and this file.
2. P0.1: team-page status and paste-ready submission fields. Report to the user.
3. P0.2: ask the release question (section 8). Continue with steps 4-6 while waiting,
   on the feature branch only.
4. Baseline: `npm test`, then `npm run test:release`. Save results under
   `docs/evidence/` with a new name. If field cases fail, check
   `https://overpass-api.de/api/status` and report the cause; do not edit tests.
5. P0.3, P0.4, P0.6 (small, testable commits). Re-run `npm test` after each.
6. P0.5 legacy suites.
7. P1.1 screenshots, then P1.2-P1.6 in that order. Show before/after screenshots to
   the user before large CSS changes (AGENTS.md design gate).
8. Full `npm run test:release`. Update AGENTS.md section 10, `docs/decisions.md`,
   `docs/validation.md`, README.
9. If, and only if, the user approved a release: follow section 8.
10. P2, then P3, as time allows.

## 6. Test plan, commands and acceptance criteria

| Layer | Command | Pass means |
| --- | --- | --- |
| Offline logic | `npm test` | All pass (117 today). New logic gets new tests |
| Release gate | `npm run test:release` | All offline + all Playwright cases, 0 skipped, 0 flaky, in static/Node x desktop/mobile |
| Focused browser | `npx playwright test tests/e2e/<file> --project=static-mobile` | Used while iterating; never a substitute for the gate |
| Public URL | `TEST_BASE_URL=https://<origin> npx playwright test` | Run from the commit that the URL serves. Must be HTTPS |
| Real NASA at three climates | `npm run test:live` | All five parameters present, coordinates differ |
| Legacy Chrome / Node / Firefox / QA | `npm run test:browser`, `test:node-browser`, `test:firefox`, `test:qa` | Real results recorded; wording-only assertion updates are stated |
| Source context | `node scripts/check-sourced-context.js` | Pass |
| Dependency safety | `npm audit` | 0 findings, or each finding explained |

Coverage to add or confirm (end-to-end, real data):

- **Farmer workflows:** dropdown path, search path, map-click path, field path, chat-driven
  path; each to three scenarios with nine slots and distinct alternatives.
- **Countries and climates:** at least one tropical (Kenya or Thailand), one temperate
  (UK or France), one arid/Mediterranean (Australia WA), one cold-winter (US Midwest),
  plus one country with fewer than two screened crops to prove the coverage block.
  Assert different evidence and at least one differing risk between climates.
- **Crop types:** each of the seven screened crops appears in at least one comparison;
  frost, heat (pea, cabbage), pH and drainage rules each fire at least once.
- **Assistant:** P0.6 prompt sweep; model on and model off.
- **Failure and slowness:** abort and delay NASA, Overpass, Nominatim, GIBS, terrain,
  SoilGrids, GBIF and the speech model. Expect a visible message, a working Retry and
  no substituted data. Add one throttled-network case (Playwright CDP) for first load.
- **Accessibility:** axe on all states (0 violations), keyboard-only full flow, 200%
  zoom and landscape sizes with 60% usable height, reduced motion.
- **Browsers:** Chrome (gate). Firefox via `test:firefox` and
  `PLAYWRIGHT_CHANNEL=msedge` for Edge. Safari/WebKit: only if a Mac or
  `npx playwright install webkit` is approved by the user (browser download); otherwise
  report as an environmental limit, not a pass.
- **Performance:** record page weight, 3D open-to-data, fps while panning, speech load,
  sampled memory. State device and that samples are not guarantees.

Classify every failure as: product defect, test defect, or environment (name the
service and what it returned). Never mark an unexecuted check as passed.

## 7. CSS and UX improvement plan

Method: take real screenshots first (extend `scripts/capture-3d-review.js` or a new
Playwright script that writes to `artifacts/`), list concrete problems with the
screenshot name, fix, re-shoot, compare. Keep the user-approved direction: map-first,
compact sidebar, dark green and cream, no decoration.

Check each screen against this list and fix what is found:

- **Hierarchy:** one clear primary action per step; results before method; warnings near
  the thing they qualify.
- **Density:** step 1 sidebar, step 3 form with the soil/irrigation aside, step 4 slot
  cards, and the chat panel are the crowded areas. Prefer collapsing secondary material
  into labelled `<details>` over shrinking text.
- **Consistency:** one spacing scale (4/8/12/16/24 px), one control height (44 px
  primary, 36 px secondary), one border colour set from the existing CSS variables, one
  heading scale. Remove one-off values.
- **Charts and 3D legends:** axis titles with units, month names, a visible zero
  baseline, colour-blind-safe scale, missing data shown as missing, legend next to the
  chart. Text never below 12 px.
- **Mobile:** no horizontal scroll at 320 px; tap targets at least 44 px (24 px minimum
  for inline links); the step bar and chat launcher must not cover form buttons; 3D
  defaults to 2D with an explicit opt-in.
- **Motion:** none beyond what the map libraries need; honour reduced motion.
- **AI-slop audit:** no gradients, glass, glow, emoji, decorative icons, hype copy,
  fake metrics or dead controls. Remove any element whose purpose cannot be stated.
- **Plain language:** every term a farmer may not know is explained in one visible line.

Acceptance: axe 0 violations; no layout shift between static and Node modes; before
and after screenshots stored under `docs/evidence/`; the user has seen the changed
screens. Do not trade readability or tap-target size for looks.

## 8. Deployment and rollback

**Default: do nothing to production.** Options to put to the user:

- **A. Keep Phase A public (recommended until the NASA project is submitted).** The
  submission text, deck and public site already agree and are verified logged out.
- **B. Release the feature branch.** Only after explicit approval. Steps:
  1. Update `docs/submission.md`, `public/submission/*` (deck, PDF, ZIP, manifest via
     `scripts/prepare-submission.js`, `render-deck.js`, `package-source.py`), README and
     credits so every public number matches the branch (seven crops, 166/197, 3D,
     voice). Add Claude Code and all tools to the AI disclosure.
  2. `npm run test:release` green on the exact commit.
  3. `vercel whoami` is `justcode1234`; project is `nasa-hackathon`.
  4. Record the current production deployment id from `vercel ls` (rollback target).
  5. Merge `feature/3d-evidence-map` into `main` with a merge commit; remove the
     branch-specific `git.deploymentEnabled` entry only if needed; push `main`.
  6. Wait for Ready; run `TEST_BASE_URL=https://nasa-hackathon-three.vercel.app npx
     playwright test` from that commit; check the app, deck, PDF and credits logged out.
  7. Record deployment id, hashes and results in `docs/deployment.md`.
- **C. Public preview only.** Ask the user whether to disable Vercel Deployment
  Protection for previews or create a bypass link. That changes project settings, so it
  needs approval. Until then the preview is private.

**Rollback (for B):** `vercel rollback <previous-deployment-url>` or promote the
recorded Phase A deployment in the Vercel dashboard; then `git revert -m 1 <merge>` on
`main` and push. Verify production serves Phase A again with the 16-case public suite
at `f4c4fef`. Do not force-push `main`.

Do not change the NASA portal entry in any option. If B happens after the owner has
submitted, check with the user that post-submission changes to the demo are allowed.

## 9. Unfinished items and decisions needed from the user

1. **Submit the NASA project** (owner only) and fill the empty references fields.
2. **Release choice:** A, B or C in section 8.
3. **`maps.mail.ru`** as the third field-lookup host: keep or remove (two hosts remain).
4. **Read-aloud approach:** keep the on-device system voice, or look for a
   downloadable English-only model with verified provenance (P3.2).
5. **Safari/WebKit testing:** allow a Playwright WebKit download, or provide a device.
6. **Real phone testing:** who tests, on which devices.
7. **Classifier:** stays an experiment unless the user wants P3.1 funded with reviewed
   real questions.
