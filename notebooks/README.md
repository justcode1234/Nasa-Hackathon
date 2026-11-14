# Jupyter starting points

Start with **[llm_training.ipynb](llm_training.ipynb)**. It inspects the actual trained FieldShift Mini artifacts, hashes, source-linked development corpus, split limitations, free-form failures and measured browser latency. Its optional retraining cell invokes the real browser TensorFlow.js training path. Training and inference remain browser-local; Node is only development automation.

Also included:

- [si_experiments.ipynb](si_experiments.ipynb): a separate guarded TensorFlow/Keras intent-classifier study. A classifier is not a generative LLM.
- [pretrained_llm_finetuning.ipynb](pretrained_llm_finetuning.ipynb): an optional, unexecuted TensorFlow DistilGPT2 study requiring reviewed data and demonstrated export/runtime compatibility. It is not the shipped model.

All default Python code cells executed successfully with Python 3.14.7. They inspect actual artifacts and skip optional unready training. The actual compact-model browser training completed separately; no Python TensorFlow installation or pretrained fine-tuning is claimed.

To open: create an isolated environment, install notebook, and run `python -m notebook notebooks/llm_training.ipynb`. Proposed Python TensorFlow environments inside the optional notebooks require their own compatibility checks. Do not assume the system Python 3.14 supports them or that TF.js, Keras, ONNX and WebLLM artifacts are interchangeable.

Retraining is off by default. Run `node scripts/build-mini-corpus.js` and `node scripts/train-mini-lm.js` to write a separate candidate. Training never promotes weights; an equal reproduction can fail the new-improvement exit gate. Review artifacts/mini-candidate, then explicitly promote, update models/mini-integrity.json and rerun build/QA. Corpus wording is developmental/synthetic, not reviewed farmer data or fabricated NASA observations. `BENCH_NODE=1` runs the compact-model benchmark through the Node frontend; default benchmarking uses the static showcase.

`node scripts/build-notebooks.js` regenerates all three notebooks. Source/data schemas are in data/README.md; [models/README.md](../models/README.md) records actual measurements and limitations.
