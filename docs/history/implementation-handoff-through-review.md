# Historical implementation handoff

Preserved verbatim from AGENTS.md section 10 before the approved merged release.
Later decisions and verified state in AGENTS.md take precedence over older entries.

## 10. Current implementation and cross-device handoff - 2026-11-15

- **Latest user authorization - consolidate and release:** user approved merging
  all repository branches into one `main` branch, and explicitly answered
  "Deploy after all release checks pass". This supersedes the earlier Phase A
  freeze/no-merge decision for this release. Finish three chat starter buttons,
  current assistant gaps and speech/navigation UX, run the complete required gate,
  then merge/push/deploy and verify the public app. Preserve Phase A submission
  artifacts as a dated snapshot; do not edit the NASA portal. Remove the other
  branches only after their histories are integrated safely. Keep the classifier
  unwired and update this handoff with actual results, not intended passes.

- **Repository/submission review (verified, 15 November):** the user requested a
  visitor README, verified references, conservative organization and an accuracy
  report, on a separate branch with no merge/deploy. Created
  `review/submission-accuracy` at `4f9b8b3` in the sibling
  `C:\Users\~\Documents\Life\Coding\github\Nasa-Hackathon-repository-review`.
  The original feature worktree's incomplete assistant/regional-crop changes remain
  untouched and are not included. Root runtime/configuration paths and third-party
  notices stay in place; developer instructions move from README into
  docs/development.md, with docs/README.md as the index. NASA submission copy and
  public submission artifacts are unchanged; proposals go in separate review files.
  Public source checks match main `f4c4fef`; live GitHub and public site return 200
  without authentication. Supplied provider pages return 200 except GBIF homepage
  (403 here; API documentation reachable). ISRIC announces a REST pause. Pinned
  dependencies installed with npm ci --ignore-scripts: 0 audit vulnerabilities.
  `npm.cmd run test:release` completed exit 0: 119/119 offline + 116/116 browser,
  zero skips/flaky/unexpected, 19.8-minute browser phase. All four runtime/viewport
  projects and mandatory real-field checks passed. Separate unauthenticated public
  run: 16/16 cases at 1280/390 px, 32 original QA question executions, zero skips/
  flaky/unexpected. Durable summary, complete compressed report, logs, hashes and
  public results are docs/evidence/repository-review-*. Both test processes ended;
  do not restart them based on the superseded in-progress note. Eleven protected
  submission/package/licence/config files are byte-identical to review base; 14
  public assets match main. Public NASA record at 20:05 UTC+8 has populated reference
  fields but isSubmitted/projectSubmitted false. Source checks: 35/45 direct GETs
  reachable, eight 403 restrictions and two connection/redirect failures; official
  UF/IFAS PDF and UMN maturity table separately retrieved. This review branch's
  automatic Git deployment is disabled. Review changes were committed as 7c2f80f
  and pushed to origin/review/submission-accuracy; README/report are publicly
  accessible without login. A documentation-only publication checkpoint follows
  that commit. Remote main and production HTML remained unchanged after the push;
  see docs/evidence/repository-review-publication.json. No merge,
  deployment or portal edit is authorized/performed. It inherits feature code:
  do not merge it into main merely to adopt docs. Outstanding user reports (AX empty crop/chat explanation,
  Singapore country/region flow, navigation/chat overlap, three chat examples)
  remain product work; do not claim them fixed by documentation changes. Singapore
  region wording reproduced publicly on both widths, with replies/screenshots saved.
  Continue original P0.6 assistant regressions/repairs, then P0.5 legacy suites and
  P1 functional chat/navigation/voice UX, respecting the existing quality handoff.

- **P0.4 source check complete:** live primary-source ranges match tomato/cabbage/onion; new duration-basis and unassessed-variant comparison checks pass. npm test: 119/119. User retained all three field services and requested sourced area crop suggestions, non-overlapping aligned navigation, and three clickable chat starters. These remain part of P0.6/P1. Phase A stays public; classifier unwired.

- **Final quality handoff underway:** verified clean feature branch 25e9476 and frozen local/remote main f4c4fef. User chose Keep Phase A public and Keep all three field services. Public NASA page at 09:55 UTC remains unsubmitted with empty references; paste-ready Phase A fields are docs/submission-fields-2026-11-15.md. Baseline: 117 offline + 116 browser pass, no skips/flaky results. P0.3 scientific wording audit corrected the unsupported word validated in the kai-lan catalog limit; 117 offline tests pass after it. See docs/final-quality-review.md and evidence/final-quality-*. The user-reported Aland empty-crop/chat issue is reproduced, with official regional crop evidence found; implementation/regressions remain next. Classifier stays unwired; no new dependency or deployment.

- **Release gate GREEN; voice input and typed-judgment experiment added (Claude Code session, 15 Nov):**
  `npm run test:release` passed 117/117 offline and 116/116 browser cases (29 per project,
  zero skips/flaky, no field retries needed). Evidence: docs/evidence/v5-green-release-summary.json
  (+ raw .json.gz and log). Changes since ef11d3a:
  - **Field lookup fixed.** The client gave up after 25 s per service while overpass-api.de
    answered in 26-27 s. Lookup now overlaps three public Overpass services with exponential
    backoff (three attempts each) under one 75 s deadline; nothing is substituted on failure.
    Live field -> terrain drape -> slope passes in all four projects. An intermediate full run
    was 95/96 (one real all-services-busy window, v5-field-fix-release.json); tests now press
    the app's Retry like a user (max twice) via tests/e2e/live-fields.js and still require real
    fields. These are shared volunteer services: a later run can still fail if all are down.
  - **Voice input implemented.** Mic button in chat -> explicit permission -> Whisper tiny.en
    (onnx-community export, revision 794207f, q8; 43.5 MB measured) transcribed on the device
    with vendored Transformers.js 4.3.2 + ONNX Runtime Web (public/vendor/transformers, built
    from node_modules; 26.9 MB WASM). Transcript goes to the editable message box; never
    auto-sent. Unload button, 20 s cap, permission-denied, download-failure and cancel paths
    are tested. Measured on the development desktop: about 3.4 s load, 1.7 s for a 4 s clip.
    The test clip is synthetic Windows-voice English (tests/fixtures/TEST-...wav).
  - **Read aloud implemented with the built-in on-device English voice** (speechSynthesis,
    localService only). KittenTTS was NOT adopted: no stated training data/English-only
    provenance, no official web package, GPL espeak dependency. Details in docs/decisions.md.
  - **Typed-judgment experiment (Jev-inspired, not Jev) trained, NOT wired into the app.**
    33,229 parameters; held-out 95 messages: action 77, unsupported 80, topic 43 vs rules
    75/81/50. See models/judgment/README.md and evaluation.json. Do not present its
    probabilities as agronomic confidence.
  - New dependencies: @huggingface/transformers 4.3.2 (runtime, vendored; 3.8.1 rejected for
    a flagged sharp dependency), @tensorflow/tfjs 4.22.0 (dev only). npm audit: 0 findings.
    CSP connect-src adds huggingface.co, us.aws.cdn.hf.co and maps.mail.ru only.
  - **Unverified:** real phones, real accents/noise, speech memory use, Safari/Firefox voice
    behaviour, audible TTS output, independent label review for the classifier.
  - Branch push and Vercel PREVIEW status are recorded in docs/deployment.md. Production
    stays frozen at Phase A (main f4c4fef).

- **(Superseded by the entry above) New user scope:** implement small English-only STT/TTS with a mic option in chat and investigate/train a local typed classifier inspired by TypeSafe AI Jev. User corrected JEPA/LeJEPA: do not build JEPA. Research/requirements and actual dependency findings are at the end of docs/decisions.md. No speech dependency/model is installed yet. The 3D visuals are approved for preview, but full release still fails: 114 offline pass, 84/92 browser pass; standalone Ames field-terrain additionally fails all four projects at discovery. Current release suite has 96 browser cases. Keep the original field requirements and production freeze.

- **(Historical; superseded by the green-gate entry above) V5 visual approval received; full release still fails at fields:** user approved the current visuals for preview. Full release: 114 offline pass; 84/92 browser pass, eight real-field failures, no skips/flaky cases; 44 axe scans pass. All 3D point/data/window/retry cases pass. Node Cambridge returned fields, then York failed: availability is partial. Ames field drape is now a standalone real-discovery test (all four fail at discovery), not gated behind unrelated example failures. Exact branch-only Git deployment suppression permits cross-device sync without creating a release; push verification is pending. Reports: docs/evidence/v5-release*. Production core hashes and remote main still match Phase A.

- **V4 crop-window linkage locally verified; V5 review in progress:** crop slots use the same shared calendar/rain functions as strategy, with exact daily grid/point and strategy-total guards. Leap substitution, December wrapping, missing days and zero-rain runs are covered. Linked windows show maturity-assessment days, not whole four-month slots; input edits clear the link. 114 offline tests and eight focused V4/V5 browser cases passed, including 24 axe state scans, reduced motion and short screens. The review exposed OSM fetches missing from connect-src; both CSPs are fixed and the regression now passes. Actual application + loaded mini-LM measurements: 2.899 s desktop / 1.619 s phone-sized open-to-data, about 60 fps, 846.6 / 762.0 MB max sampled working set. These are desktop Chrome, not real-phone or exact peak guarantees. Full report: docs/evidence/v5-app-benchmark.json. Full release, live-discovered field drape, real-phone measurements (if available), visual signoff and preview delivery remain. Production stays frozen.


- **(Historical; field flow now verified, see top entry) V3 terrain implemented, field browser flow still unverified:** shared PNG/DEM context, hillshade, selected-field drape, x1/x2/x3 display-only exaggeration and explicit sampling/missingness are implemented. 112 offline and eight real-terrain browser cases pass. A separate live Node HTTP check assessed a known Ames polygon (907 gradients); a small Naivasha polygon stayed unassessed (five). These one-object provenance probes are not field-discovery fallbacks. Overpass still blocks the actual browser field-selection/drape success path and full release. Full source/method/limits and raw results: docs/evidence/v3-* and docs/validation.md. V4 strategy linkage and V5 complete validation remain.

- **V2 imagery locally verified:** four NASA GIBS products use current capabilities dates/legends and verified native product resolution. Shared Node/worker metadata adapter rejects gaps, unsafe URLs and unsupported intervals. Imagery is labelled visual context; values are never extracted or sent to scoring. Metadata retry and tile-failure notices are implemented. 107 offline tests and 12 GIBS browser cases pass (four projects, 16 real product selections); V1 retains its 16-case passing report. Reports: docs/evidence/v2-*. V3 terrain/field context, V4 strategy linkage and V5 full validation remain. Production stays frozen; actual-field checks still block release.

- **(Historical; gate now green on feature/3d-evidence-map) Phase B implemented but release blocked on feature/review-phase-b:** seven sourced crops cover 166/197 countries; 99 offline tests pass. Results/evidence wording, archived workers, tighter CSP, arrow semantics, axe licence and pixel-identical CSS cleanup are implemented. Full release: 36/44 Playwright cases pass, with all 8 failures at live Overpass field lookup; zero skips/flaky results. All 20 axe state scans and 12 model-on QA executions pass. Four enhanced transport-failure cases also pass: Retry preserves coordinates, and real NASA evidence still leads to step 4 using the explicit point (phase-b-playwright-field-degradation.json). Fresh browser probes show both Overpass deadlines expiring with no CSP errors; status endpoints also time out from this device. Production core hashes still match Phase A (phase-a-freeze-recheck.json). Production stays at f4c4fef; no Phase B deployment. Raw results: docs/evidence/phase-b-playwright-local.json and phase-b-playwright-retry.json.
- **Phase C preview approved; V1 locally verified on feature/3d-evidence-map:** the user approved preview implementation on 15 November. MapLibre 5.24.0 proved vulnerable to CVE-2026-85061 during installation; patched 6.4.1 is now pinned (zero npm audit findings), with repeated desktop measurements 1.68 s / 60 fps / 672.3 MB max sampled working set; 293 KB gzip modules+CSS. Real-phone and combined-model memory remain unverified. Native rain cells, month control/table equality, missingness, WebGL fallback, provider retry and stale-load cleanup pass 16/16 V1 Playwright cases across four projects; npm test passes 104/104. Metadata and all raw reports are in docs/evidence/v1-* and maplibre-6.4.1-*.json. Node and worker share /api/power-grid. V3-V5 remain. Production stays frozen; live Overpass success cases still block deployment.

Update this section and docs/decisions.md / docs/validation.md after each substantive
implementation change. Record what changed, actual checks, remaining work and deployment
state. Do not leave another device relying on an earlier planning assumption.

- **Review plan execution, Phase A released:** submission example now uses
  enterable York/Australia baseline and allowed crops, with saved real NASA/engine
  output. New rural Ames and Naivasha points returned 11 and 8 complete OSM fields
  in Node probes. Chat Send focus, labelled uncertainty, readable runtime/footer,
  credits/licence delivery and short-height document scrolling are implemented.
  `npm run test:release` passed 95 offline and 32 Playwright cases, exit 0, across
  both runtimes and viewports. All four examples return at least 3 complete fields;
  the fixture's exact sequences match the live UI. At 683×384, 640×360 and 844×390,
  measured usable height is 73.0%, 65.7% and 68.8%, with no horizontal overflow.
  Seven-slide layout/PDF checks pass. Public app source 70eafb1 passed 16
  desktop/mobile Playwright cases, exit 0; all 21 checked public app, licence,
  model and submission assets match the build. Reports: phase-a-playwright-local,
  phase-a-playwright-public and phase-a-public-assets under docs/evidence.
  MIT/third-party delivery (B4) is pulled forward because A6 needs a real credits
  link. This Phase A release is the submission candidate. Freeze production after
  this checkpoint; Phase B/C work belongs on feature branches and Vercel previews.
  Only the owner submits through NASA's portal; portal submission is unverified.

- **Current goal: Next/Compare fix and Playwright flow tests (verified release).** The user
  reproduced a blocked step-3 screen. Earlier coverage tests checked that Compare
  was disabled but missed the unusable Next/recovery experience. The new Playwright
  test failed against the previous public app on the actual Next click (step 01
  stayed hidden). New UI distinguishes absent country rules from unchecked crops,
  keeps a visible reason beside navigation, and routes Next to country selection,
  evidence loading or allowed-crop selection without clearing entered values.
  NASA request errors now open the visible evidence panel with Retry.
  Playwright 1.65.1 is an explicitly requested development dependency; it uses the
  installed Chrome, with no browser/model download. Four projects exercise static
  and Node frontends at 1280px and 390px. Tests use real NASA data, with deliberate
  transport failure followed by real retry; they never fabricate readings.
  `npm run test:release` is required before future behavior releases. It runs
  unit/logic tests plus Playwright: 95 offline + 16 Playwright tests pass locally,
  including all sixteen original QA prompts in every project (64 executions).
  The existing 33 Chrome and 18 Firefox checks also pass on this UI fix.
  Public verification passes all 8 desktop/mobile Playwright cases (32 original
  QA question executions), with no skips/flaky/unexpected results. App source
  0fe50ce is deployed at the existing origin, deployment
  dpl_uzcTt6tDRGxXKXwBVHHE2kz1fhnX. Fourteen public assets match the build. Source
  and test hashes, raw answers and results are under docs/evidence/playwright-*.json;
  docs/playwright.md explains the release command and coverage. A disabled Compare
  assertion alone is not a flow test. Both Next and Compare must preserve the exact
  baseline and render two distinct alternatives; the browser tests assert this.

- **Current user goal — resolve QA gaps and improve the tiny LM (verified release):**
  fix all nine failed prompts in shared grounded answers and validated action
  parsing; retrain/evaluate the optional small word LM using additional development
  wording and a fixed held-out set, without training on the 16 acceptance prompts.
  Require 16/16 prompts and 6/6 flows locally and on Vercel, model-on/model-off
  verification, variant regressions, existing checks, and an honest model comparison.
  Preserve scientific uncertainty and source limits. Do not label these checks
  perfection or agronomic accuracy. The earlier foundation objective is complete;
  the goal tool now tracks this explicit assistant/retraining/release objective.

- **Assistant improvement checkpoint:** shared capability-limit/pH/family/grain
  handlers and read-only intent guards close the nine baseline QA gaps locally.
  Region/point checks handle the combined Maharashtra/Pune coordinate command.
  Local model-off and model-on QA both pass 16 questions + 6 flows; 93 offline
  tests pass. Accepted LM v2: 39,274 parameters / 157,096 bytes, 346-word vocabulary,
  48-token context. New fixed development questions improved 8/36 to 14/36;
  overall 83/126 to 85/126, but legacy matches fell 75/90 to 71/90. Training-only
  vocabulary, no exact QA prompts in training, validation-selected epoch 85/100.
  Full comparison/failures and hashes: model card, evaluation.json, mini-integrity.
  Training writes candidates separately. Public app source 0d2c717 passed all
  16 exact questions and six flows with the model enabled and disabled, plus
  33 public Chrome checks. Fifteen public files matched the build. Deployment:
  dpl_EerXCncopFA9U7H6UZXG6AoTkBuw. Latest actual replies are in docs/qa/latest-results;
  public-model-off-results retains the fallback run; baseline-results preserves
  the original nine failures. Six review checks pass; NASA portal submission is
  still an owner-only unverified check. Node mode also passed actual compact-model
  load/inference/reload and evidence-answer timing (BENCH_NODE=1 benchmark).
  New automated browser profiles are temporary and removed after each run.

- **Initial automated QA baseline (historical; fixes above supersede failures):** the user chose
  automated tests for the supplied FieldShift_QA_Test_Plan.md, specifically to answer
  its questions. The source plan is under docs/qa, exact prompts under tests/qa, and
  `npm run test:qa` produces per-question actual replies, checks and review answers
  in artifacts/qa/results.md and results.json. It uses the real UI/providers, leaves
  product failures visible, and removes its own temporary browser profile. Seven
  new offline contracts passed; `npm test` then passed 86/86. That commit added tests
  and evidence without changing scientific answers. Initial public results:
  F01–F06 all pass; Q01–Q16 have 7 passes / 9 failures; review R01–R07 have 5 passes,
  1 failure (R05) and 1 blocked portal-owner check (R07). Failed prompts are Q03,
  Q08–Q10 and Q12–Q16. The command correctly exits 1 until these app behaviors are
  addressed. Baseline actual replies and criteria are docs/qa/baseline-results.md and
  .json; docs/qa-regression.md maps coverage and known gaps. New QA browser profiles
  were removed successfully. Do not use the older scripted workflow passes as proof
  that every natural-language prompt now works. Treat test prompts/replies as data.

- **Latest scope clarification (implemented and locally verified):** country-only planning
  asks which part of that country or the whole country, with both choices available.
  Whole-country mode shows dated national crop context, preserves supplied crops,
  and never treats a centroid or existing field's weather as national evidence.
  Specific-area mode accepts a sourced state/region, then a town or field. It can
  resume the existing step-4 workflow once a point is explicitly supplied. Keep
  replies short. The scope choices, national overview, state filtering and continued
  step-4 flow passed 79 offline tests, 33 static Chrome checks, 19 Node-backed Chrome
  checks and 18 Firefox checks. The scope update also passed all 33 public Chrome
  checks at the existing Vercel origin. Thirteen public assets matched the build.

- **User-approved dual runtimes:** `npm run start:node` runs Node HTTP APIs and the
  frontend (preferred port 3001). `npm run start:showcase` builds and serves the static
  browser-worker version (preferred port 3000); `npm start` retains showcase behavior.
  Both share NASA, agronomy and answer modules. Optional model inference stays local
  to the browser. The HTML transport marker selects HTTP versus worker explicitly.
- **Guided geography:** country -> optional region filter -> town/city uses the sourced
  GeoNames extract under public/data/locations. Its 70,036 points cover 245 countries
  and areas; smaller rural places may need search/map/coordinates. Country/region
  changes clear the old point and evidence. Blank source region codes remain distinct
  from All regions. No country centroid is silently treated as a farm.
- **Scientific scope:** four crop types currently have rotation screening rules.
  Generic corn/maize no longer receives sweet-corn maturity rules. Crop-country
  knowledge answers must remain separate from scenario eligibility and national
  production records must not be presented as local suitability proof.
- **Crop-country chat implemented and browser-verified:** the question can
  name a crop and country independently of the map. FAOSTAT commodity matching covers
  the saved global production extract; sourced cultivation profiles cover kai lan,
  rice, wheat, tomato and the four screening crops. NParks, IRRI and UMN references
  retain their scope limits. These extra knowledge profiles do not become ranked crops.
  Greetings get one short reply; answers have at most three paragraphs and three
  follow-up buttons. Sources are expandable, with scientific caveats still visible.
  Typed follow-ups retain crop/country context. Another country's question cannot
  reuse the selected location's NASA weather. Unknown crops or missing local rules
  produce an explicit gap. No cloud model or new dependency was added. Focused
  source-backed questions and follow-ups passed in Chrome and Firefox.
- **Chat can carry out the four-step workflow (implemented and tested).** Use a
  finite set of validated app actions: choose country/place or
  a returned field, enter the farmer's three crops and explicit constraints, load
  NASA observations, then run comparison and open step 4. Never choose an arbitrary
  farm, invent missing crops, infer field ownership, or execute generated code/URLs.
  The same app functions serve chat and forms. Manual edits cancel pending chat
  actions; assistant-origin changes preserve the conversation. Keep ordinary crop
  knowledge questions read-only. Offline coverage includes action order, missing
  inputs, coordinate-country disagreement, explicit field selection, unsupported
  alternatives, provider failure and manual cancellation. Both delivery modes and
  Firefox completed an India coordinate + farmer-crops flow using real NASA data
  through step 4; rice/wheat baseline slots stayed unassessed. No CSS was changed.
- **Vercel setup:** CLI 65.16.0 is installed; current CLI identity was verified as
  justcode1234. This checkout is linked to justcode1234s-projects/nasa-hackathon.
  Global Codex Vercel plugin 0.54.1 is enabled; the shared MCP URL is
  https://mcp.vercel.com. Current connector tools are available, but list_teams
  returned no teams and the known project deployment returned a scoped-access
  403. The existing CLI login works as justcode1234 and is used for release checks.
  Connector team consent remains separate. Preserve the user's 4chatgptsim account;
  do not alter unrelated MCP entries, logins or approval settings.
  Recheck `vercel whoami` and linked project before deploying; never store credentials
  in this repository. The CLI-created .env.local and .vercel directory are ignored.
- **Deployment:** existing public origin is https://nasa-hackathon-three.vercel.app/ .
  Source is pushed to main and Git integration deploys it automatically. The complete
  33-check public workflow passed on commit 05a66cc, including model load/inference,
  geographic scope choices and guided India planning through step 4. Thirteen public assets matched the local
  build hashes. Checkpoint reports are docs/evidence/public-*-validation.json;
  docs/deployment.md records the deployment ID. Pull main before continuing elsewhere.
  Public checks caught an unanchored models/ ignore rule excluding public/models;
  it is now /models/. Require the three model-loading files in every upload dry run.
  An earlier deployment
  dry run initially included local browser artifacts, so .vercelignore now excludes
  those, local dependencies, credentials and generated output. Build inputs and
  public showcase files remain included. Verify the dry-run file list before upload.
- **Latest executed checks:** 95 offline tests, 16 local Playwright cases across
  four runtime/viewport projects, 8 public desktop/mobile Playwright cases,
  33 static Chrome checks,
  19 Node-backed Chrome checks, 18 Firefox checks and 83 JavaScript syntax checks
  passed. Seven-slide PDF and source ZIP are regenerated before publishing.
  The public origin also passed all 33 Chrome checks, including the new scope flow.
  Reports live under docs/evidence; transient profiles/logs are ignored in artifacts.
  Rerun checks appropriate to future changes and record their actual results here.
- **Still deferred/unverified:** CSS polishing, real mobile hardware, Safari/WebKit,
  exact full-session memory peaks, independent agronomic validation and NASA portal
  submission. Keep these distinct from the tested prototype behavior.

