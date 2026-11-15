// On-device English speech-to-text. Loaded only after the user clicks the mic.
// Model: OpenAI Whisper tiny.en (English-only training per OpenAI's model card),
// ONNX export pinned by revision. Audio never leaves this device; only the model
// files are downloaded. No telemetry is configured or sent by this worker.
// Runtime: Transformers.js 4.3.2 and ONNX Runtime Web, shipped with this app.
import { pipeline, env } from '/vendor/transformers/transformers.min.js';

const MODEL = 'onnx-community/whisper-tiny.en', REVISION = '794207fec2761281fe63a23a94b7e9f53a4efbc1';
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = '/vendor/transformers/';
env.backends.onnx.wasm.numThreads = 1;
let transcriber = null, loading = null;

async function load() {
  if (transcriber) return transcriber;
  loading ??= (async () => {
    const started = performance.now(), files = new Map();
    const model = await pipeline('automatic-speech-recognition', MODEL, { revision: REVISION, device: 'wasm',
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
      progress_callback: item => {
        if (item.status !== 'progress' || !item.total) return;
        files.set(item.file, [item.loaded, item.total]);
        const loaded = [...files.values()].reduce((sum, [a]) => sum + a, 0), total = [...files.values()].reduce((sum, [, b]) => sum + b, 0);
        self.postMessage({ type: 'progress', loadedBytes: loaded, totalBytes: total });
      } });
    const downloadBytes = [...files.values()].reduce((sum, [, b]) => sum + b, 0);
    self.postMessage({ type: 'ready', metrics: { model: `${MODEL}@${REVISION.slice(0, 7)} (q8)`, loadMs: performance.now() - started, downloadBytes } });
    return model;
  })();
  try { transcriber = await loading; return transcriber; } finally { loading = null; }
}

self.onmessage = async event => {
  const { type, id, audio } = event.data;
  try {
    if (type === 'load') await load();
    else if (type === 'transcribe') {
      const model = await load(), started = performance.now();
      // English-only checkpoint: no language or task token is selectable.
      const result = await model(audio, { chunk_length_s: 30, return_timestamps: false });
      self.postMessage({ type: 'transcript', id, text: String(result.text ?? '').trim(), inferenceMs: performance.now() - started, audioSeconds: audio.length / 16000 });
    } else if (type === 'unload') {
      await transcriber?.dispose?.(); transcriber = null;
      self.postMessage({ type: 'unloaded' });
    }
  } catch (error) { self.postMessage({ type: 'error', id, message: error?.message ?? String(error) }); }
};
