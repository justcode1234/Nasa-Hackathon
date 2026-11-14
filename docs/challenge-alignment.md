# Challenge alignment review — 2026-11-14

Read the exact user-supplied challenge URL with Node fetch (HTTP 200):
https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/ .
The full readable brief was in the site's public rendered-data stream; no script
code was executed to interpret it. Source snapshots are in ignored artifacts.

The official title is **Field Shift: Adapting Farms with NASA Data**. NASA POWER is
explicitly suggested. Additional sensors, data-fusion approaches and visualizations
are optional considerations. The central fit is explainable decision support that
preserves local judgment and acknowledges evidence gaps.

| Brief focus | Implemented proof | Limit |
| --- | --- | --- |
| NASA environmental evidence | Real dated POWER temperature, rain and solar values; units, resolution, missingness and raw download | Regional historical estimates; not a forecast or climate normal |
| Crops and farmer priorities | Sourced maturity, families, pea temperatures and pH ranges; allowed crops, soil pH/drainage and priorities | Four sourced vegetables; no global crop/soil database |
| Existing rotation + alternatives | Baseline and two distinct allowed scenarios, equal horizons, transparent criteria | Fixed four-month slots and turnaround assumption |
| Soil and water | Family checks, pH/drainage warnings, legume explanations, rain totals and zero-rain runs | No nitrogen credit, predicted soil benefit, water demand or water savings |
| Evidence and risk | Reasons, risks, sources, missingness and visible limitations | No measured yield or profitability outcome; local validation needed |
| Farmer-centered maps | Place search, mapped fields, crop dropdowns and tabs | Community mapping/tags may be absent or outdated |
| Optional SI | Real browser-local evidence selector, deterministic fallback and Jupyter starting points | Not a fine-tuned agronomic LLM; peak memory/mobile behavior unmeasured |

Country pest records are context, not farm diagnosis. Satellite grids are not field
measurements. Present a working, bounded screening prototype rather than a validated
worldwide farming authority.

## Team and event

The user's team page was fetched (HTTP 200); public data confirmed team display
name **Explorer** (slug `explorer36`), the **Field Shift** challenge and the
**Singapore** local event. The record indicated the project was not submitted when
inspected. No member personal details are included in the package.

https://www.spaceappschallenge.org/2026/find-a-team/explorer36/?tab=details

This review does not log into the team account or change its NASA project record.
