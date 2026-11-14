# FieldShift Mini — model card

## Current shipped experiment — retrained 2026-11-15

Word-level autoregressive LM: **346-word vocabulary → Embedding(24) → LSTM(48) →
Dense(346-word softmax)**; 48-token context, **39,274 parameters / 157,096 weight
bytes (157.1 KB)**. It remains an experimental language model, not a general-purpose
LLM or validated agronomic model. An accepted topic selection can prioritize an
existing retrieved paragraph without changing words or removing caveats. Input
checks, capability limits and actions are deterministic. Raw generation is hidden.

Corpus v2: **746 rows — 530 train, 90 validation, 126 test**. Vocabulary uses training
rows only. One exact legacy cross-split duplicate was removed, retaining its test
row. The 36 added free-form test questions were fixed before training; the sixteen
QA acceptance questions are absent from training. Synthetic wording is not reviewed
farmer data. Template vocabulary still overlaps across splits. Two candidates used
this development test set; it is not an untouched independent study.

| Same continuation-selection questions | Previous model | Accepted model |
| --- | --- | --- |
| New free-form development holdout | 8/36 | 14/36 |
| All development tests | 83/126 | 85/126 |
| All free-form tests | 17/54 | 23/54 |
| Legacy tests alone | 75/90 | 71/90 |

The modest overall improvement includes four fewer legacy matches. Errors remain
in evaluation.json. An answer-token-only candidate scored 54/126 and was rejected.
Accepted training restores full question/answer next-word loss, with padding masked.
It runs 100 epochs, choosing epoch **85** by validation matches (58/90), then
validation loss, checked every five epochs. Adam 0.004, seeds 42/43/44/45, batch 32,
no shuffle, TF.js 4.22.0 CPU WASM, one thread. Training/evaluation took 309,147.6 ms.
No external model weights or new dependency were downloaded.

[mini-integrity.json](mini-integrity.json) records all five artifact hashes. Tests
verify these, train-only vocabulary, split separation and QA prompt exclusion.
Current weight SHA-256:
`719822007d383409dcb223461cdc54019736f48dbeefdd33277ae69c983f33c6`.

The new local benchmark measured 3,256 ms cold load, 155 ms warm load, 19.8 ms
inference and 3.8 ms first evidence response. Largest sampled aggregate working set:
754,790,400 bytes; summed observed process lifetime peaks: 808,001,536 bytes. Shared
pages and non-simultaneous peaks limit interpretation; these are not exact browser
peaks or mobile guarantees. See [current benchmark](../docs/evidence/mini-lm-benchmark-current.json).

Training writes only `artifacts/mini-candidate`, never shipped files. Its exit gate
requires better new-holdout matches and no loss overall against the currently
shipped model. Reproducing an already-shipped candidate can therefore exit 1 with
equal results. Review its saved evaluation before separately promoting files,
updating integrity hashes and repeating build/browser QA.

## Previous v1 experiment — historical measurements below

A real small autoregressive **word language model**, not a classifier output layer or a general-purpose LLM. Architecture: 208-word vocabulary → Embedding(24) → LSTM(48, sequence output; tanh/hard-sigmoid) → Dense(208-word softmax). Next-word cross-entropy masks padding. It has **29,200 parameters**, **116,800 bytes** of float32 weights and a 40-token context. No pretrained weights are used by this model.

Training was executed in browser TensorFlow.js 4.22.0, WASM, one thread, 50 epochs, Adam 0.004, deterministic initializer seeds and no shuffle. The completed clean run took 169,038.5 ms including evaluation on this machine. A development-only missing UnsortedSegmentSum embedding-gradient kernel sums rows by segment ID; forward inference uses stock WASM kernels.

## Artifacts and integrity

`public/models/fieldshift-mini/` includes model.json, tokenizer.json, weights.bin, corpus.json and the full evaluation.json.

- Weights SHA-256: `87311c8b2e155102c8992e2894ba3c2c58a8de98603a479ce3ccbabd430484d2`
- Corpus SHA-256: `bb51fe54d4a5d8c8f0ca3d07db63b6b09d60346ecbdbc13ee74e390c09505c92`
- Model topology: `1fac00ad8b01829edaa50a2ea337805414b74fff9a982471a34b2bcc1ae194f8`
- Tokenizer: `5d2f908797211736c802e1e30aa5256c690b0bff2e24f3afc25955f5ddc3be65`

TensorFlow.js/WASM runtime files are loaded from pinned 4.22.0 CDN URLs only when chat/model use is requested. Model assets are local static files and browser-cached. No inference server, cloud model, arbitrary tool URL or generated code execution exists.

## Corpus and actual failures

621 development rows: **459 train, 72 validation, 90 test**. Question wording is synthetic/development-only and not agronomist-reviewed. Continuations describe source/app boundaries; no synthetic NASA readings are included. Topic vocabulary overlaps template splits, and vocabulary construction included all development wording. Those choices make template results optimistic and are explicitly not a production-quality evaluation design.

The saved run selected the expected topic in **75/90** development cases, but only **9/18** free-form cases. Examples it failed include asking about mapped clay, insect crop hosts, temperature sources, rotation timelines and choosing fields. Full failures are preserved in evaluation.json and the notebook. These counts are not scientific accuracy, crop suitability, confidence or farmer-outcome metrics. The model is not reliable unrestricted agronomic chat.

## Runtime boundary

The model scores next-word likelihood for nine source-bound explanatory continuations. Its production topic selection requires an explicit lexical and score-gap guard. The source-linked evidence answer renders first and remains available if the model is unloaded, unsupported, fails or is inconclusive. Only retrieved facts and limitations are shown. Raw generated scientific text is never displayed or used to rank rotations.

A developer-only generation check produced `regional soil estimates are not farm measurements . a local soil test` from a soil question. This demonstrates autoregressive continuation, not correctness over arbitrary questions. The app never exposes that raw-generation path as farming advice.

## Actual first compact-model benchmark — 2026-11-14

Chrome 157 on this Windows development machine, headless, GPU disabled, CPU WASM, one thread. One run, not a performance promise.

| Measurement | Observed |
| --- | --- |
| First source-evidence answer | 10 ms; does not wait for model inference |
| Cold model initialization including runtime/network | 903 ms |
| Warm initialization | 652.6 ms |
| One guarded topic inference | 84 ms |
| Trained weight bytes | 116800 |
| Resident tensor bytes after initialization | 116800 |
| WASM allocated heap capacity | 16777216 bytes (16 MiB) |
| Full peak browser/process memory | Unmeasured |
| Real mobile / non-Chromium behavior | Unverified; deterministic fallback remains |

Original raw report: docs/evidence/mini-lm-benchmark-initial.json. `node scripts/benchmark-mini-lm.js` writes the latest report to artifacts/mini-lm-benchmark.json and reproduces load, answer, inference, raw developer continuation and unload/reload checks after building.

## Process-memory assessment — resumed G4 check

The latest Windows/Chrome run adds three snapshots of the isolated browser and its descendants using .NET `WorkingSet64`, `PrivateMemorySize64` and `PeakWorkingSet64` counters. It does not inspect model tensors as a substitute for browser memory. Raw per-process counters, phase totals and timings are retained in `docs/evidence/mini-lm-benchmark-latest.json`.

| Phase | Aggregate working set | Aggregate private memory |
| --- | --- | --- |
| Before model loading | 556,417,024 bytes | 226,488,320 bytes |
| After model loading and one inference | 607,367,168 bytes | 278,147,072 bytes |
| After extra developer generation and app model reload | 748,978,176 bytes | 354,177,024 bytes |

The sum of observed process lifetime peak working sets was 798,654,464 bytes across 14 observed process identities. Peaks need not occur together, and working sets can double-count shared pages. Processes that start and exit entirely between snapshots can be missed. These observations are below the approximate 1 GB target on this machine, but do not prove an exact session peak, incremental model cost or real mobile memory use. The final phase includes the developer-only generation check.

Counter definitions: [Microsoft working-set peak](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.peakworkingset64) and [private memory](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.privatememorysize64). Firefox 160 also passed model load, WASM inference, unload and unavailable-runtime fallback in the separate browser workflow; its memory was not measured.

## Compared and rejected alternatives

- Earlier SmolLM2-135M-Instruct q4: ~184.18 MB model/tokenizer; 26.66 s load and 6.33 s one inference in the earlier WASM run. Source: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct , Apache-2.0, revision 12fd25f77366fa6b3b4b768ec3050bf629380bac. It is not the current UI model.
- TinyStories-Instruct-1M ONNX q8: 12,518,493 weight bytes; ~5.23 s load and 0.18–0.37 s short generations, but failed both evidence-following checks. It was rejected. It is not silently substituted as useful instruction-following chat.
- An early CPU Mini training run was interrupted during a backend switch; it produced no accepted artifact. The clean WASM run above is the accepted experiment. Training loss alone did not establish agronomic reliability.

The user goal is responsive browser assistance with current retrieved facts. This small experiment meets measured size/latency targets on the tested machine, while the hard grounding/fallback boundary remains necessary. A wider independent dataset, reviewed farmer questions, stronger held-out design and real-device evaluation are required before expanding its role.
