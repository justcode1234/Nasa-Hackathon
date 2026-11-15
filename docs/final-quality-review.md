# Final quality review - 15 November 2026

This follows `plans/codex-final-quality-handoff.md`. Production is kept at Phase A
by the user's explicit decision. The typed-judgment classifier remains unwired.

## Starting point and submission support

The checkout was clean at 25e9476 on feature/3d-evidence-map. Local and remote main
were f4c4fef. An unauthenticated public NASA team-page read at 09:55 UTC showed
isSubmitted false, submittedAt null, projectSubmitted false, both reference fields
empty, and savedAt 09:45 UTC. No portal login, edit or submission occurred.
Paste-ready fields matching the public Phase A version are in
`submission-fields-2026-11-15.md`. The user chose to retain all three existing
Overpass services, including maps.mail.ru.

Baseline: npm test passed 117/117; npm run test:release passed 117 offline plus
116/116 Playwright cases, with zero skips, unexpected or flaky results. The browser
run took 21.4 minutes, including real field services and actual speech inference.
Logs and raw results use the prefix evidence/final-quality-baseline-.

## P0.3 scientific wording audit

| Reviewed source | Finding / disposition |
| --- | --- |
| server/agronomy/rotation.js | Historical analogue dates, equal horizons, source IDs, partial rain, rule counts and missingness stay explicit. Ordering is not a crop-success probability or yield/economic forecast. |
| server/agronomy/answers.js | Explicit yield, water-saving, guarantee and confidence limits remain. Additional unanswered questions will be tested in P0.6. |
| server/agronomy/conversation.js | National tonnes carry source year and scope. Other-country weather requires an actual point; crop knowledge is separate from screening eligibility. |
| server/agronomy/crops.json | Regional extension durations/pH/temperature references and establishment-method limits remain. Fresh numeric checks are recorded separately for P0.4. |
| server/agronomy/knowledge.json | Replaced the unsupported phrase "validated rotation-screening catalog" with "sourced rotation-screening catalog". No agronomic validation is claimed. |
| public/js/modules/strategy.js | Derived historical rain/temperature windows, source links, unassessed crops and uncertainty are visible. |
| public/js/modules/data-flow.js | Units, observation periods, retrieval times, source resolution and partial/missing indicators remain; zero and missing are distinct. |
| public/js/modules/map3d.js | Native-cell bounds are explicitly derived, heights are display metres, and exact historical crop windows are not forecasts. |
| public/js/modules/terrain-controls.js | Unexaggerated DEM context, sampling versus source resolution, unknown acquisition dates and field support limits stay explicit; no erosion prediction. |
| public/js/modules/gibs-controls.js | Dated imagery, native product resolution and missing coverage remain explicit; values are not extracted or scored. |

Executed after the wording correction: npm test, 117/117 pass. This review is not
independent agronomic validation. The user's newly reported empty-crop UI/chat
failure is reproduced in evidence/final-quality-aland-before.json and .png; its
fix and new prompt regressions remain next work.

## P0.4 source recheck

The actual catalog URLs for Clemson tomato/cabbage/onion, USU onion and NC State
Allium cepa all returned HTTP 200 to a normal unauthenticated Node fetch. The web
reader separately received 403 from Clemson; no identity spoofing was used.
Observed numeric ranges match the stored references: tomato 52-90 days to first
harvest and pH 6.0-6.5; cabbage 60-80 days after transplanting, pH 5.8-6.5 and
60-65 F; bulb onion 100-120 days (starting method unspecified), pH 6.2-6.5;
Allium cepa family Amaryllidaceae. Source hashes and exact URLs are retained in
evidence/final-quality-crop-source-probes-2026-11-15.json.

The official Statistics Åland table was also visually checked for the user's
new request: Åland in Figures 2025, printed page 11, observations for 2024.
It documents wheat, a combined barley/oats category, rye, table potatoes and onions.
These support local crop-type context, not field suitability or new rotation rules.
Source/provenance: evidence/final-quality-aland-source-2026-11-15.json.
