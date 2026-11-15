// Benchmark-only: smaller real language models are rejected if they cannot follow evidence tasks.
self.onmessage = async () => {
  try {
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
    env.allowLocalModels = false; env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
    const start = performance.now();
    const model = await pipeline('text-generation', 'onnx-community/TinyStories-Instruct-1M-ONNX', { revision: 'f40ef18027182f78bd9cd9a347ff5eadd074fea0', dtype: 'q8', device: 'wasm' });
    const loadMs = performance.now() - start;
    const cases = [
      { prompt: 'Facts:\n1. Peas belong to Fabaceae.\n2. Corn belongs to Poaceae.\nQuestion: Which fact answers what family peas belong to?\nAnswer with the number only:', expected: '1' },
      { prompt: 'Facts:\n1. Country pest records are not field diagnosis.\n2. NASA POWER provides weather estimates.\nQuestion: Which fact explains the NASA data source?\nAnswer with the number only:', expected: '2' }
    ];
    const results = [];
    for (const entry of cases) {
      const begin = performance.now();
      const output = await model(entry.prompt, { max_new_tokens: 8, do_sample: false, return_full_text: false });
      const text = output[0].generated_text;
      results.push({ expected: entry.expected, output: text, passed: text.trim() === entry.expected, inferenceMs: performance.now() - begin });
    }
    self.postMessage({ done: true, loadMs, model: 'TinyStories-Instruct-1M-ONNX', weightBytes: 12518493, results, accepted: results.every(r => r.passed) });
  } catch (error) { self.postMessage({ error: error.message }); }
};
