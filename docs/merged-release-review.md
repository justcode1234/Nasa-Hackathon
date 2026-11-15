# Merged release review — 15 November 2026

The user approved merging all histories into `main`, leaving one branch, and
deploying after all release checks pass. They also chose the installed on-device
English voice for this release. The NASA portal was never edited by this work.
The public record checked at 22:09 UTC+8 reports submission at 21:04:58 today;
[raw status](evidence/merged-release-team-status.json) preserves the observation.

## Changes and their purpose

- Location entry offers places/map or coordinates. Next retrieves evidence;
  named-region filters remain optional. Singapore no longer loops through unnamed
  source region codes. Whole-country context never supplies a farm coordinate.
- Three persistent chat examples demonstrate facts, guided India planning and
  crop-choice help. The assistant explains the current UI blocker, rather than
  giving generic steps when a country lacks crop screening coverage.
- Åland's missing FAOSTAT entries are identified as extract coverage gaps. Five
  separate official ÅSUB 2024 crop categories enable baseline entry and provide
  sourced crop-type context. They do not become suitability rules or ranked crops.
- Temperature, precipitation and solar graphs explain their axes, bands, units
  and missing days. C/F conversion affects display only; raw JSON and calculations
  retain source Celsius values.
- Alternatives default to screened crops from the baseline. Other crops require
  explicit form or chat approval. No sweet corn is silently added. Baseline and
  allowed-crop chat clauses are parsed separately; an invalid mixed list is refused.
- Comparison coverage bars show how many crops can be checked. The expandable
  table explains each criterion. Missing checks are labelled Not assessed and
  incomplete totals Not comparable. Zero is no longer presented as a favorable
  result when no check ran. Apple/apricot tree context is sourced, with a clear
  warning that the annual-slot method cannot compare an established orchard.
- Chat settings are grouped, the mic and Send share a row, and the first speech
  use requires an approximately 70 MB notice before permission/download. Closing
  while permission is pending stops a late microphone grant. Dictation supplies
  an editable unsent draft; read-aloud speaks the grounded answer and can stop.
- Navigation aligns with content edges. Screenshot review found a closed-launcher
  overlap on short screens after the first gate started; that run was deliberately
  interrupted, the launcher was fixed, and its geometry was added to the test.

## Scientific and AI boundaries

Exactly four product modules remain. Seven crop types have screening rules;
166/197 national lists contain at least two screened categories. These are coverage
counts, not validated countries. GIBS imagery and mixed-source terrain are visual
context and do not feed crop ranking. POWER estimates are regional historical
evidence, not field sensors or forecasts. SoilGrids may be unavailable and never
silently supplies measured farm soil.

The optional small word model prioritizes retrieved paragraphs behind relevance
guards; generated scientific claims are not displayed. The typed-judgment classifier
stays unwired. Whisper tiny.en supplies English dictation; installed English TTS
has unverified training-language provenance. No new dependency was added.

## Verification record

128/128 offline tests pass. Additional legacy checks passed: model-enabled Chrome
33, Node Chrome 19, Firefox 18; original QA 16 questions plus six flows passed with
the model disabled and enabled (22/22 each). These runs precede the final small
launcher correction; the complete release gate is being rerun on the final source.
Initial failed/interrupted runs are retained rather than reclassified as passes.
A second run exposed two mobile test-harness failures: manual country selection
was attempted under open chat. The helper now closes chat, makes the manual change
and reopens it. Assertions are unchanged and another full run is in progress.
Their separate review checklist has five passes and two blocked checks: public-origin
CORS is outside a local run, and the suite itself does not inspect the NASA portal.
The independent read-only public NASA observation above is recorded separately.

The current full gate covers 152 browser cases across static/Node and desktop/mobile:
real NASA and field paths, all original QA prompts, 28 new unexpected questions
with the model off/on, approved crops, unsupported evidence, Åland, Singapore,
temperature conversion, original JSON, speech cancellation and actual audio
transcription, TTS state/text, axe and short-screen navigation geometry.
Actual final results and deployment will be appended after execution.

## Visual review

Before/after captures cover all four steps and chat at 1366×768, 1280×1000,
390×844, 844×390 and 683×384. After captures also include open 3D and terrain.
They use actual 2025 POWER data at the York example; the orchard baseline is a
deliberate user-input example. Field transport was deliberately aborted only for
these layout captures; mandatory release field tests still require real discovery.
The existing forest/cream direction is retained. Changes serve controls, explained
data and spacing rather than a theme redesign.

[Selected before/after screenshots and contact sheets](evidence/merged-release-visuals/)
and their [hash manifest](evidence/merged-release-visuals.json) preserve the review.

Real phones, Safari/WebKit, microphone/accent/noise quality, audible speech quality,
exact full-session memory peaks and independent agronomic validation remain
unverified. Browser viewport emulation and synthetic English microphone audio do
not establish those outcomes.

## Submission and repository accuracy

The submitted summary and details were read back from the public page at 22:17
UTC+8; [exact public fields](evidence/merged-release-submitted-fields.json) are saved.
The summary appropriately names regional satellite/model estimates, two alternatives
where coverage permits, missing evidence and no yield guarantee. The details
accurately describe Phase A: four screening crops and 89/197 lists. After the
approved merged release, that coverage passage becomes outdated. It does not
currently describe the optional imagery/terrain or speech features. The separate
AI references field is empty, but the details already disclose all three AI tools.
No missing disclosure is inferred from that empty field alone.

Suggested replacement for the owner's coverage paragraph, if they choose to amend
the portal after deployment:

> The current public release has screening rules for bush snap bean, garden pea,
> sweet corn, radish, tomato, head cabbage and bulb onion. Of 197 country/area
> production lists, 166 contain at least two mapped screened crop categories.
> Radish has no mapped FAOSTAT category, so country lists do not offer it. These
> are prototype coverage counts, not locally validated recommendations. Knowledge
> profiles and national production records do not automatically create screening rules.

Optional source clarification for the owner:

> The optional 3D map also displays dated NASA GIBS imagery and mixed-source Terrain
> Tiles. Imagery is visual context; values are not extracted into crop rankings.
> Terrain includes SRTM and other providers and is not uniformly NASA data.

NASA imagery reference: [NASA GIBS API documentation](https://nasa-gibs.github.io/gibs-api-docs/).
Other terrain reference: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/).
The current release copy gives the full speech and crop-coverage boundaries.

The earlier [accuracy review](submission-accuracy-review.md) retains its findings
and proposed corrections. The current [release copy](submission.md), visitor
README and [references](references.md) distinguish estimates, third-party context,
calculated indicators, assumptions and user inputs. The original Phase A text,
PDF, ZIP and manifest are preserved as a dated snapshot and source tag. Refreshing
current release materials is not a silent NASA description edit.
