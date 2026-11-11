---
title: A language model in this tab
date: 2026-10-21
summary: A small instruction-tuned model running inside the page, on your GPU through WebGPU or on your CPU, with nothing sent to a server.
tags: [inference, webgpu]
draft: true
modules: [/assets/js/llm/llm-client.js]
---

<p class="lede">The box below is a chat with a real language model. When you press Load model, your browser downloads quantised weights once and runs every token on your own machine: on the graphics card through WebGPU when the browser allows it, on the CPU through WebAssembly when it doesn't. There is no API behind it. This is a placeholder post, but the demo is real.</p>

<figure class="fig wide">
<div class="fig__frame" data-llm></div>
<figcaption class="fig__cap"><span class="fig__label">Figure 1</span>Transformers.js and ONNX Runtime Web in a worker thread. The smallest model, SmolLM2 135M, manages around 15 tokens per second on a laptop CPU, and more on a GPU.</figcaption>
</figure>

## What happens when you press Load

1. The page starts a module worker so the model never blocks scrolling or typing.
2. It asks the browser for a WebGPU adapter. If there is one, the worker fetches 4-bit weights (`q4f16` when the GPU has 16-bit float shaders, `q4` when it doesn't).
3. If WebGPU is missing, or the browser's limits are too tight for the kernels,[^limits] the worker switches to WebAssembly with 8-bit weights.
4. Each new token is one forward pass, with the KV cache kept between steps. The weights stay in the browser's Cache Storage, so the next visit starts at once.

The memory needed is roughly the parameter count times the bits per weight:

$$
\text{bytes} \approx N_\text{params} \cdot \frac{b}{8} + \underbrace{2 \cdot L \cdot n_\text{ctx} \cdot d \cdot 2}_{\text{KV cache, fp16}}
$$

For a 135M-parameter model at $b = 8$ that is about 135 MB of weights before overhead, small enough for a phone.

## The worker, in brief

Transformers.js wraps tokenisation, the chat template and generation in one pipeline call, and a streamer hands back text as it is produced:

```javascript title="llm-worker.js"
import { pipeline, TextStreamer } from '@huggingface/transformers';

const generator = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-135M-Instruct', {
  device: 'webgpu',   // or 'wasm'
  dtype: 'q4f16',     // or 'q4', 'q8'
});

const streamer = new TextStreamer(generator.tokenizer, {
  skip_prompt: true,
  callback_function: (text) => self.postMessage({ type: 'token', text }),
});
await generator([{ role: 'user', content: 'Why is the sky blue?' }], { max_new_tokens: 256, streamer });
```

The fallback is a second attempt with `device: 'wasm'` when the first one throws. A one-token warm-up right after loading makes any WebGPU error show up during loading, not in the middle of your first question.

## Models on the menu

| Model | Parameters | Download | Good for |
|---|---:|---:|---|
| SmolLM2 Instruct | 135M | ≈ 130 MB | trying it out, any device |
| SmolLM2 Instruct | 360M | ≈ 300 MB | slightly better answers |
| Qwen2.5 Instruct | 0.5B | ≈ 500 MB | the best replies here |

Small models are often confidently wrong. That is part of the point: it is easier to build intuition for sampling, context length and quantisation when you can watch a model fail up close, on your own machine.[^privacy]

[^limits]: Firefox, for example, allows fewer storage buffers per shader stage than some compiled kernels ask for. That is a limit of the browser's WebGPU, not of the model's size.

[^privacy]: Because the model runs locally, nothing you type leaves your browser. The only network traffic is the one-time weight download and the ONNX Runtime files.
