# Typed chat-judgment experiment (development only, not used by the app)

A small classifier that answers three fixed questions about one chat message. It was
built to test an idea from TypeSafe AI's public description of their "System One"
model Jev: unstructured text in, typed answers with probabilities out, with ordinary
code making the decision ("Jev makes judgments, code makes decisions").

**This is not Jev.** Jev is a proprietary, API-only model with its own architecture and
training method (RLCD). Nothing here uses, reproduces or approximates its weights,
architecture or training. No speed-up over the existing rules is claimed; the rules
are faster. Sources read on 2026-11-15:
https://typesafe.ai/blog/introducing-system-one-models-and-jev and
https://typesafe.ai/blog/dont-call-it-a-decision-model . The user-supplied
https://jevtypesafe.org/ is an unofficial third-party host and was not relied on.

## Fixed output schema

| Question | Options (defined in advance) |
| --- | --- |
| `action` | `read_only`, `app_action` (the user wants the app to select, set, load or compare) |
| `unsupported` | `answerable_or_other`, `unsupported_claim` (exact yield, savings, forecast, probability, guarantee, profit) |
| `topic` | `greeting`, `crops`, `weather`, `soil`, `water`, `pests`, `comparison`, `location`, `other` |

Every answer is one of these options, with a temperature-calibrated probability. Below
a per-question threshold the model abstains. These probabilities describe message
classification only. **They are not crop-success, yield or agronomic confidence.**

## Model and data

- TensorFlow.js 4.22.0 Layers API (the Keras API in JavaScript), trained in Node on the
  pure-JS CPU backend. Python TensorFlow is not installed on the development machine.
- Hashed word, word-pair and character-trigram features (1,024) → Dropout 0.2 →
  Dense 32 (ReLU, L2) → Dropout 0.5 → three linear heads. 33,229 parameters, 132,916
  bytes. Fixed seed.
- 521 training and 121 validation rows from wording templates, **split by template**.
  95 held-out rows are separate hand-written wording (`holdout.json`). The 16
  acceptance prompts in `tests/qa/prompts.json` are excluded from every split; a test
  enforces this.
- Labels were authored for this prototype with AI assistance and were not
  independently reviewed. The same author wrote development and held-out wording, so
  this is not an independent study.
- Model selection, temperatures and abstention thresholds use validation rows only.

## Held-out results (95 messages)

| Question | Classifier | Existing rules | Always guess most common | Calibration error (ECE) | Above threshold: correct / answered |
| --- | --- | --- | --- | --- | --- |
| action | 77 | 75 | 73 | 0.070 | 54 / 57 (38 abstained) |
| unsupported | 80 | 81 | 78 | 0.067 | 3 / 3 (92 abstained) |
| topic | 43 | 50 | 22 | 0.145 | 11 / 13 (82 abstained) |

Topic on the 72 rows the existing tiny language model can express: classifier 35,
tiny LM 10 (its relevance guard accepted 3, all correct). Time per message on the
development machine: classifier 0.42 ms, rules 0.05 ms, tiny LM 107 ms (pure-JS
backend here; the app runs it on WASM).

**This is the second evaluation on the held-out set.** The first run (324 training
rows, loss-selected) scored 73, 78 and 31, at or below the majority-class rate. More
template variety, stronger dropout and accuracy-based selection were then chosen from
validation behaviour, but the held-out set is no longer untouched.

## Conclusion

The classifier does not beat the existing validated rules, so it is **not wired into
the app**. Its useful property is abstention: on `action`, the 57 confident answers
were 95% correct. A reasonable next step, if wanted, is reviewed real user questions
as training and test data. Until then the rules stay in charge of routing, and
validated code keeps all actions and scientific calculations.

## Reproduce

```
node scripts/build-judgment-data.js
node scripts/train-judgment-model.js
node scripts/benchmark-judgment-vs-mini-lm.js
```

`evaluation.json` holds every held-out failure, the calibration values, weight hash and
latency. `@tensorflow/tfjs` 4.22.0 is a development-only dependency (Apache-2.0).
