// Runs a small chat model with Transformers.js (ONNX Runtime Web) off the main thread.
// WebGPU when the browser allows it, WebAssembly on the CPU otherwise.
// Loaded from jsDelivr, pinned, rather than bundled: the library is large and the
// minified bundle trips GitHub's secret scanner on model names like "Mistral".
import { pipeline, TextStreamer, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';

env.allowLocalModels = false;
let generator = null;

self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    const files = new Map();
    try {
      generator = null;
      generator = await pipeline('text-generation', data.model, {
        device: data.device,
        dtype: data.dtype,
        progress_callback: (p) => {
          if (p.status !== 'progress' || !p.total) return;
          files.set(p.file, [p.loaded, p.total]);
          let a = 0, b = 0; for (const [l, t] of files.values()) { a += l; b += t; }
          self.postMessage({ type: 'progress', loaded: a, total: b, file: p.file });
        },
      });
      // one tiny generation so kernel or limit errors surface now, not on the first question
      await generator([{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'Say hello and name one colour.' }], { max_new_tokens: 8 });
      self.postMessage({ type: 'ready' });
    } catch (e) {
      generator = null;
      self.postMessage({ type: 'error', message: String(e?.message || e) });
    }
  } else if (data.type === 'generate') {
    if (!generator) return;
    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => self.postMessage({ type: 'token', text }),
      });
      await generator(data.messages, { max_new_tokens: 256, do_sample: true, temperature: 0.6, top_p: 0.9, repetition_penalty: 1.1, streamer });
      self.postMessage({ type: 'done' });
    } catch (e) {
      self.postMessage({ type: 'error', message: String(e?.message || e), during: 'generate' });
    }
  }
};
