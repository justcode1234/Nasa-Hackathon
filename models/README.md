# FieldShift Mini — model card

## Current shipped experiment

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

Raw local report: artifacts/mini-lm-benchmark.json. `node scripts/benchmark-mini-lm.js` reproduces load, answer, inference, raw developer continuation and unload/reload checks after building.

## Compared and rejected alternatives

- Earlier SmolLM2-135M-Instruct q4: ~184.18 MB model/tokenizer; 26.66 s load and 6.33 s one inference in the earlier WASM run. Source: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct , Apache-2.0, revision 12fd25f77366fa6b3b4b768ec3050bf629380bac. It is not the current UI model.
- TinyStories-Instruct-1M ONNX q8: 12,518,493 weight bytes; ~5.23 s load and 0.18–0.37 s short generations, but failed both evidence-following checks. It was rejected. It is not silently substituted as useful instruction-following chat.
- An early CPU Mini training run was interrupted during a backend switch; it produced no accepted artifact. The clean WASM run above is the accepted experiment. Training loss alone did not establish agronomic reliability.

The user goal is responsive browser assistance with current retrieved facts. This small experiment meets measured size/latency targets on the tested machine, while the hard grounding/fallback boundary remains necessary. A wider independent dataset, reviewed farmer questions, stronger held-out design and real-device evaluation are required before expanding its role.
