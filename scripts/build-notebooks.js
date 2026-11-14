// Rebuild the checked-in Jupyter starting points without requiring Jupyter or TensorFlow.
import { writeFile, readFile } from 'node:fs/promises';
const miniEvaluation=JSON.parse(await readFile('public/models/fieldshift-mini/evaluation.json','utf8'));
const md = source => ({ cell_type: 'markdown', metadata: {}, source: source.trim().split('\n').map(s => s + '\n') });
const code = source => ({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: source.trim().split('\n').map(s => s + '\n') });
async function notebook(name, cells) {
  cells.forEach((cell, index) => { cell.id = `cell-${index}`; });
  await writeFile(`notebooks/${name}.ipynb`, JSON.stringify({ cells, metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }, language_info: { name: 'python', version: '3.11' } }, nbformat: 4, nbformat_minor: 5 }, null, 2) + '\n');
}
await notebook('si_experiments', [
  md(`# FieldShift — TensorFlow intent-classification experiment

This notebook trains a small **task classifier**, not a generative LLM. The production assistant already works through sourced retrieval. No training data or weights are fabricated. Running all cells without reviewed examples performs readiness checks and skips training.

Use a separate Python 3.11 environment. Suggested initial compatibility environment: tensorflow==2.16.2, tf-keras==2.16.0, numpy==1.26.4, notebook. These packages are not installed by the app and this training environment has not been executed here. Pin the resolved environment after testing. Do not install into the system Python 3.14 environment.

References: https://www.tensorflow.org/js/guide/conversion and https://www.tensorflow.org/js/guide/platform_environment .`),
  code(`from pathlib import Path
import json, random, hashlib, importlib.util, sys
ROOT = Path.cwd() if (Path.cwd() / "server").exists() else Path.cwd().parent
DATA = ROOT / "notebooks/data/intent_examples.jsonl"
SEED = 42
TRAIN = False
print({"python": sys.version, "dataset_exists": DATA.exists(), "tensorflow_installed": importlib.util.find_spec("tensorflow") is not None})`),
  md(`## Reviewed data contract

Supply JSONL rows with text, label, group_id, source_url, license and reviewed=true. Labels: crop, water, soil, rotation, out_of_scope. group_id must identify a farmer/source/paraphrase group; whole groups go into one split. Have people verify labels and license, include unsupported questions and contrasting regions, and avoid this app's own template outputs as an evaluation target. At least 20 examples per class and 10 distinct groups are required before this experiment trains. This minimum is a guard, not evidence that the dataset is sufficient.`),
  code(`LABELS = ["crop", "water", "soil", "rotation", "out_of_scope"]
rows = [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines() if line.strip()] if DATA.exists() else []
for row in rows:
    assert all(row.get(key) for key in ["text", "label", "group_id", "source_url", "license"])
    assert row["reviewed"] is True and row["label"] in LABELS
groups = sorted({row["group_id"] for row in rows})
random.Random(SEED).shuffle(groups)
split_a, split_b = int(len(groups)*.7), int(len(groups)*.85)
train_groups, val_groups, test_groups = set(groups[:split_a]), set(groups[split_a:split_b]), set(groups[split_b:])
splits = {name: [r for r in rows if r["group_id"] in group] for name, group in [("train", train_groups), ("validation", val_groups), ("test", test_groups)]}
assert not (train_groups & val_groups or train_groups & test_groups or val_groups & test_groups)
ready = len(groups) >= 10 and all(sum(r["label"] == label for r in rows) >= 20 for label in LABELS) and all(splits.values())
print({"ready": ready, "counts": {name: len(values) for name, values in splits.items()}, "training_enabled": TRAIN})`),
  md(`## Train and evaluate only after review

The held-out test is never used for fitting or choosing settings. Record a keyword baseline, macro F1, per-class precision/recall, confusion matrix, abstentions and a manual failure review before accepting the model. No validation metric is claimed until execution. The export below is a Keras artifact, not a verified TF.js or WebLLM model.`),
  code(`if TRAIN and ready:
    import numpy as np
    import tensorflow as tf
    tf.keras.utils.set_random_seed(SEED)
    def arrays(name):
        return np.asarray([r["text"] for r in splits[name]], dtype=str), np.asarray([LABELS.index(r["label"]) for r in splits[name]])
    x_train, y_train = arrays("train")
    x_val, y_val = arrays("validation")
    x_test, y_test = arrays("test")
    vectorizer = tf.keras.layers.TextVectorization(max_tokens=4000, output_sequence_length=48)
    vectorizer.adapt(x_train)
    model = tf.keras.Sequential([tf.keras.Input(shape=(), dtype=tf.string), vectorizer,
        tf.keras.layers.Embedding(4000, 32), tf.keras.layers.GlobalAveragePooling1D(), tf.keras.layers.Dense(len(LABELS), activation="softmax")])
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(x_train, y_train, validation_data=(x_val, y_val), epochs=15, batch_size=16,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=2, restore_best_weights=True)])
    predicted = model.predict(x_test).argmax(axis=1)
    matrix = tf.math.confusion_matrix(y_test, predicted, num_classes=len(LABELS)).numpy()
    print("Held-out confusion matrix", LABELS, matrix, sep="\\n")
    precision = np.diag(matrix) / np.maximum(matrix.sum(axis=0), 1)
    recall = np.diag(matrix) / np.maximum(matrix.sum(axis=1), 1)
    f1 = 2*precision*recall / np.maximum(precision+recall, 1e-9)
    print({"macro_f1": float(f1.mean()), "precision": precision.tolist(), "recall": recall.tolist()})
    output = ROOT / "artifacts/intent-experiment"
    output.mkdir(parents=True, exist_ok=True)
    model.save(output / "intent.keras")
    report = {"seed": SEED, "labels": LABELS, "dataset_sha256": hashlib.sha256(DATA.read_bytes()).hexdigest(), "groups": {"train": sorted(train_groups), "validation": sorted(val_groups), "test": sorted(test_groups)}, "macro_f1": float(f1.mean()), "confusion": matrix.tolist()}
    (output / "evaluation.json").write_text(json.dumps(report, indent=2))
else:
    print("SKIPPED: enable TRAIN only after supplying enough reviewed, licensed, group-split examples.")`),
  md(`## Export acceptance

Verify a supported TF.js conversion route for the installed TensorFlow/Keras versions. Export vocabulary and implement equivalent preprocessing if the browser runtime cannot handle TextVectorization. Compare saved-model and browser logits on held-out cases, record conversion commands and versions, and benchmark assets/memory/latency before app integration. This classifier must never author crop recommendations, NASA readings or citations.`)
]);
await notebook('pretrained_llm_finetuning', [
  md(`# FieldShift — grounded language-model training starting point

An earlier browser experiment used pretrained SmolLM2-135M-Instruct through Transformers.js/ONNX. The current app uses the separate custom Mini word language model documented in llm_training.ipynb. Newly fetched NASA observations remain retrieved evidence, not permanent knowledge in model weights.

This notebook prepares a traceable corpus and provides a guarded TensorFlow fine-tuning experiment for **DistilGPT2**, a different model with TensorFlow support. It is not a substitute export for SmolLM2. No fine-tuning runs by default, and browser deployment remains blocked until this model's training → export → quantization → browser inference path is demonstrated.

Use an isolated Python 3.11 environment with tensorflow==2.16.2, tf-keras==2.16.0, transformers==4.44.2, numpy==1.26.4 and notebook as an initial environment to verify. The app does not install them. Proposed compatibility is not a claim that training or conversion has passed.

Primary references: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct , https://huggingface.co/distilbert/distilgpt2 , https://huggingface.co/docs/transformers.js/v3.8.1/en/custom_usage .`),
  code(`from pathlib import Path
import os, json, sys, hashlib, random, importlib.util
ROOT = Path.cwd() if (Path.cwd() / "server").exists() else Path.cwd().parent
TRAIN = False
EXPORT_RUNTIME_VALIDATED = False
MODEL_ID = "distilbert/distilgpt2"
MODEL_REVISION = None  # Pin a reviewed upstream commit before enabling training.
DATA = ROOT / "notebooks/data/llm_examples.jsonl"
print({"python": sys.version, "tensorflow": importlib.util.find_spec("tensorflow") is not None, "training": TRAIN})`),
  md(`## Prepare source facts without generating training labels

The following records read the actual local crop catalog. They are grounding material, not human-reviewed questions/answers. Add source access dates and crop-region limitations during review. NASA daily records should remain retrieved context, not permanent weather memorization in weights. No source text is fetched or scraped by this cell.`),
  code(`catalog = json.loads((ROOT / "server/agronomy/crops.json").read_text(encoding="utf-8"))
sources = {s["id"]: s for s in catalog["sources"]}
facts = [{"crop_id": c["id"], "family": c["family"], "maturity_days": c["maturityDays"], "notes": c["notes"],
    "sources": [sources[s] for s in c["sourceIds"]], "scope": catalog["scope"], "reviewed": False} for c in catalog["crops"]]
print(json.dumps(facts[0], indent=2))
print(f"Prepared {len(facts)} source-linked fact records in memory. They are not a training dataset.")`),
  md(`## Human-reviewed training data and leakage checks

Create data/llm_examples.jsonl with question, context, answer, source_urls, group_id, license, reviewed=true. Each answer must be entailed by context and retain uncertainty. Include questions that need refusal, unknown crops, missing NASA days, old data and prompt-injection attempts. Group by underlying scenario/location/source so paraphrases cannot leak across train/validation/test. Record counts and the file hash. Never train from raw unverified model output.`),
  code(`rows = [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines() if line.strip()] if DATA.exists() else []
for row in rows:
    assert all(row.get(k) for k in ["question", "context", "answer", "source_urls", "group_id", "license"])
    assert row.get("reviewed") is True
groups = sorted({r["group_id"] for r in rows})
random.Random(42).shuffle(groups)
a, b = int(len(groups)*.7), int(len(groups)*.85)
group_sets = [set(groups[:a]), set(groups[a:b]), set(groups[b:])]
splits = [[r for r in rows if r["group_id"] in g] for g in group_sets]
assert not (group_sets[0] & group_sets[1] or group_sets[0] & group_sets[2] or group_sets[1] & group_sets[2])
ready = len(groups) >= 10 and all(splits) and MODEL_REVISION is not None
print({"reviewed_examples": len(rows), "split_counts": list(map(len, splits)), "corpus_ready": ready, "export_runtime_validated": EXPORT_RUNTIME_VALIDATED})`),
  md(`## Guarded TensorFlow fine-tuning experiment

First prove the pretrained model can export, quantize and generate through the chosen browser runtime, then set EXPORT_RUNTIME_VALIDATED and record that evidence. Training requires licensed reviewed examples, a pinned revision and explicit TRAIN=True. It downloads pretrained weights only when enabled. This is laboratory code and has not trained weights in this repository. Training loss/perplexity cannot establish agronomic correctness or citation fidelity.`),
  code(`if TRAIN and ready and EXPORT_RUNTIME_VALIDATED:
    os.environ["TF_USE_LEGACY_KERAS"] = "1"
    import tensorflow as tf
    import tf_keras as keras
    from transformers import AutoTokenizer, TFAutoModelForCausalLM
    tf.keras.utils.set_random_seed(42)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    tokenizer.pad_token = tokenizer.eos_token
    model = TFAutoModelForCausalLM.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    def dataset(rows, shuffle=False):
        prompts = ["Context: " + r["context"] + "\\nQuestion: " + r["question"] + "\\nAnswer: " + r["answer"] + tokenizer.eos_token for r in rows]
        tokens = tokenizer(prompts, padding="max_length", truncation=True, max_length=256, return_tensors="tf")
        labels = tf.where(tokens["attention_mask"] == 1, tokens["input_ids"], -100)
        ds = tf.data.Dataset.from_tensor_slices({**dict(tokens), "labels": labels})
        if shuffle: ds = ds.shuffle(len(rows), seed=42)
        return ds.batch(2)
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=5e-5))
    model.fit(dataset(splits[0], True), validation_data=dataset(splits[1]), epochs=2)
    print("Held-out language-model loss (not agronomic accuracy):", model.evaluate(dataset(splits[2])))
    output = ROOT / "artifacts/llm-experiment"
    model.save_pretrained(output)
    tokenizer.save_pretrained(output)
    (output / "provenance.json").write_text(json.dumps({"model": MODEL_ID, "revision": MODEL_REVISION, "dataset_sha256": hashlib.sha256(DATA.read_bytes()).hexdigest(), "seed": 42, "groups": [sorted(g) for g in group_sets]}, indent=2))
else:
    print("SKIPPED: training is off, or reviewed corpus / pinned revision / demonstrated browser export is missing.")`),
  md(`## Evaluation and browser handoff

Compare the unmodified pretrained model, the fine-tuned candidate and evidence templates on held-out questions. Manually inspect unsupported facts/numbers, stale NASA dates, source invention, refusal, regional scope and malicious instructions. Preserve actual failures.

The Transformers.js documentation describes ONNX export/quantization; an actual compatible decoder export must be demonstrated rather than assumed. Keras/TF.js conversion is not automatically an ONNX or WebLLM path. A training artifact from this notebook is never copied directly into the app.

Before accepting a browser model: exact model/revision/license and asset hashes; real transferred bytes (target ≤300 MB); peak process/WASM/GPU memory (target about ≤1 GB); cold/warm load and inference latency; browser/device/WebGPU or WASM support; worker responsiveness; fallback; grounding evaluation. Missing measurements remain unmeasured. The app currently uses extractive evidence selection so model-authored scientific claims cannot appear.`)
]);
await notebook('llm_training', [
  md(`# FieldShift Mini — browser language-model training and evaluation

This is the actual compact model used by the current app: a **word-level autoregressive recurrent language model**, trained with next-word cross-entropy. It is not a topic-classifier output layer or a general-purpose large language model. Production only uses its guarded response-topic selection with traceable retrieval. Raw generated words never become scientific advice.

The model has ${miniEvaluation.parameters.toLocaleString('en-US')} parameters and ${miniEvaluation.weightBytes.toLocaleString('en-US')} bytes of float32 weights. Training used browser TensorFlow.js 4.22.0 / WASM, one thread, 100 epochs, seed-controlled initializers and no shuffling. Checkpoint selection used validation matches, then validation loss. Run evidence is inspected below.

Node starts an isolated local test page and browser automation; training and production inference happen in the browser. No Python or Node inference server is deployed on Vercel.`),
  code(`from pathlib import Path
import json, hashlib, subprocess, sys
ROOT = Path.cwd() if (Path.cwd() / "server").exists() else Path.cwd().parent
DIRECTORY = ROOT / "public/models/fieldshift-mini"
corpus = json.loads((DIRECTORY / "corpus.json").read_text(encoding="utf-8"))
evaluation = json.loads((DIRECTORY / "evaluation.json").read_text(encoding="utf-8"))
tokenizer = json.loads((DIRECTORY / "tokenizer.json").read_text(encoding="utf-8"))
topology = json.loads((DIRECTORY / "model.json").read_text(encoding="utf-8"))
weights = (DIRECTORY / "weights.bin").read_bytes()
assert len(weights) == evaluation["weightBytes"]
print({"python": sys.version, "parameters": evaluation["parameters"], "weight_bytes": len(weights), "sha256": hashlib.sha256(weights).hexdigest()})`),
  md(`## Data provenance and split limits

The corpus contains development-only **synthetic question wording**, not agronomist-reviewed farmer data or fabricated NASA observations. Vocabulary uses training rows only; template splits still share topic vocabulary. Accepted results: ${miniEvaluation.correct}/${miniEvaluation.testExamples} overall and ${miniEvaluation.newHoldoutCorrect}/${miniEvaluation.newHoldoutExamples} additional fixed free-form questions, versus ${miniEvaluation.baseline.correct}/${miniEvaluation.baseline.testExamples} and ${miniEvaluation.baseline.newHoldoutCorrect}/${miniEvaluation.baseline.newHoldoutExamples} before. Legacy matches decreased 75/90 to 71/90. Two candidates were evaluated; these are development comparisons, not an independent untouched study or agronomic accuracy.

The full token vocabulary is built from the development corpus, including held-out wording; this is another limitation. A production experiment needs a vocabulary learned only from training data, truly independent farmer questions, region/source grouping, out-of-scope tests and independent review. The app does not treat this experiment as reliable free-form advice.`),
  code(`rows = corpus["rows"]
print(corpus["kind"])
print(corpus["limitation"])
print({name: sum(row["split"] == name for row in rows) for name in ["train", "validation", "test"]})
print({"test_correct": evaluation["correct"], "test_total": evaluation["testExamples"], "freeform_correct": evaluation["freeformCorrect"], "freeform_total": evaluation["freeformExamples"]})
print("Free-form failures:")
for row in evaluation["results"]:
    if row["freeform"] and row["expected"] != row["predicted"]:
        print(row)
print("Corpus SHA-256:", hashlib.sha256((DIRECTORY / "corpus.json").read_bytes()).hexdigest())`),
  md(`## Architecture and objective

Vocabulary embedding (24 dimensions) → LSTM (48 units, sequence output) → Dense softmax over **words**, not topic labels. The model predicts the next word at each timestep; padding is masked in the loss. It can autoregressively generate a continuation, but raw generation is only exercised in developer evaluation.

At runtime, nine source-bound explanatory continuations are scored by answer-word negative log likelihood. An explicit lexical and score-gap guard permits a topic selection only when supported; otherwise retrieval is left unchanged. The evidence answer renders before neural inference completes. This restriction prevents generated NASA readings, crop claims and citations from entering the app.

Artifacts are ordinary TensorFlow.js model topology, weight specs and binary weights. This exact training → saved artifact → browser inference combination was executed. It is separate from the optional, unexecuted Keras/TF.js intent-classifier and pretrained fine-tuning notebooks.`),
  code(`print("Vocabulary:", len(tokenizer["vocabulary"]))
for layer in topology["modelTopology"]["config"]["layers"]:
    config = layer["config"]
    print(layer["class_name"], {k: config[k] for k in ["input_dim", "output_dim", "units", "activation", "recurrent_activation", "return_sequences"] if k in config})
specs = topology["weightsManifest"][0]["weights"]
print("Weight tensors:", [(s["name"], s["shape"], s["dtype"]) for s in specs])`),
  md(`## Reproduce the real browser training run

Requires Node.js 22+, installed Chrome/Chromium/Edge and internet for pinned TensorFlow.js/WASM runtime files. The scripts never download a browser or invoke a cloud model. Training uses the small development corpus, not a pretrained weight download. It takes several minutes on the observed development machine; no hardware-independent guarantee is made.

TF.js WASM lacked UnsortedSegmentSum for embedding gradients; the development-only kernel was added and tested. Retraining writes artifacts/mini-candidate only. The quality gate compares against the current shipped model; an equal reproduction can exit 1 because it is not a new improvement. Review results before separately promoting files and updating integrity hashes. Training is off by default.`),
  code(`RETRAIN = False
if RETRAIN:
    subprocess.run(["node", "scripts/build-mini-corpus.js"], cwd=ROOT, check=True)
    subprocess.run(["node", "scripts/train-mini-lm.js"], cwd=ROOT, check=True)
    print("Inspect artifacts/mini-candidate; shipped weights were not replaced.")
else:
    print("Retraining disabled. Existing trained artifacts and recorded evaluations were inspected only.")`),
  md(`## TensorFlow/Keras reproduction path

An equivalent task can be explored in Python TensorFlow/Keras using Embedding(24), LSTM(48, return_sequences=True), Dense(vocabulary_size, softmax), next-word targets and masked padding loss. Pin the Python/TensorFlow/Keras versions; match token IDs and recurrent activations explicitly. TF.js and Keras defaults can differ, so do not assume saved-weight equivalence or claim a converter passed. The demonstrated shipped path is browser TensorFlow.js training and browser inference.

Use si_experiments.ipynb for a separate Keras intent-classification laboratory, and pretrained_llm_finetuning.ipynb for the guarded DistilGPT2 study. Neither is the shipped compact model or a completed pretrained fine-tune.`),
  md(`## Actual latency, memory and safety evidence

The local benchmark report records first evidence response latency, cold/warm model initialization, neural inference, tensor bytes and WASM heap capacity. It does **not** establish full peak browser/process memory or real mobile performance. Inspect a new run before reporting new figures. Source links and limitations remain attached regardless of model selection.`),
  code(`report = ROOT / "artifacts/mini-lm-benchmark.json"
if report.exists():
    benchmark = json.loads(report.read_text(encoding="utf-8"))
    print(json.dumps(benchmark, indent=2))
else:
    print("Run node scripts/benchmark-mini-lm.js after npm run build to produce a fresh benchmark.")`)
]);
console.log('Wrote llm_training.ipynb, si_experiments.ipynb and pretrained_llm_finetuning.ipynb');
