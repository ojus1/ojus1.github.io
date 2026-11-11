---
title: A language model in this tab
date: 2026-10-21
summary: A small instruction-tuned model running on your GPU through WebGPU, inside the page, with nothing sent to a server.
tags: [inference, webgpu]
draft: true
modules: [/assets/js/llm/llm-client.js]
---

<p class="lede">The box below is a chat with a real language model. When you press Load model, your browser downloads quantised weights once, compiles a handful of WebGPU kernels and runs every token on your own graphics card. There is no API behind it. This is a placeholder post, but the demo is real.</p>

<figure class="fig wide">
<div class="fig__frame" data-llm></div>
<figcaption class="fig__cap"><span class="fig__label">Figure 1</span>WebLLM running in a worker thread. Speed depends on your GPU; a recent laptop manages tens of tokens per second on the smallest model.</figcaption>
</figure>

## What happens when you press Load

1. The page starts a module worker so the model never blocks scrolling or typing.
2. The worker fetches the weights in 4-bit groups (`q4f16_1`: 4-bit weights, 16-bit activations) and stores them in the browser's Cache Storage.
3. It loads a precompiled WebAssembly module that holds the model's compute kernels as WGSL shaders.
4. Each new token is one forward pass on the GPU, with the KV cache kept in GPU memory between steps.

The memory needed is roughly the parameter count times the bits per weight:

$$
\text{bytes} \approx N_\text{params} \cdot \frac{b}{8} + \underbrace{2 \cdot L \cdot n_\text{ctx} \cdot d \cdot 2}_{\text{KV cache, fp16}}
$$

For a 360M-parameter model at $b = 4$ that is about 180 MB of weights before overhead, which is why it fits on almost anything with a GPU.

## The client, in brief

The page talks to the worker through an OpenAI-shaped API, so streaming looks familiar:[^api]

```javascript title="llm-client.js"
import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm';

const worker = new Worker('/assets/js/llm-worker.js', { type: 'module' });
const engine = await CreateWebWorkerMLCEngine(worker, 'SmolLM2-360M-Instruct-q4f16_1-MLC', {
  initProgressCallback: (r) => (bar.style.width = `${r.progress * 100}%`),
});

const stream = await engine.chat.completions.create({
  messages: [{ role: 'user', content: 'Why is the sky blue?' }],
  stream: true,
});
for await (const chunk of stream) out.textContent += chunk.choices[0]?.delta?.content ?? '';
```

And the worker is three lines:

```javascript title="llm-worker.js"
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
```

## Models on the menu

| Model | Parameters | Download | Good for |
|---|---:|---:|---|
| SmolLM2 Instruct | 360M | ≈ 270 MB | trying it out |
| Qwen2.5 Instruct | 0.5B | ≈ 280 MB | short answers, some code |
| Llama 3.2 Instruct | 1.2B | ≈ 880 MB | the best replies here |

Small models are confidently wrong often. That is part of the point: it is easier to build intuition for sampling, context length and quantisation when you can watch a model fail up close, on your own machine.[^privacy]

[^api]: The engine follows the shape of the OpenAI chat completions API, including streaming chunks and `max_tokens`.

[^privacy]: Because the model runs locally, nothing you type leaves your browser. The only network traffic is the one-time weight download.
