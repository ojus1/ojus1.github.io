---
title: Low-rank updates, plotted
date: 2026-10-08
summary: What LoRA's rank actually buys you, as pixels and as curves. A sketch of a sweep, with charts you can hover, filter and smooth.
tags: [fine-tuning, lora]
draft: true
d3: true
scripts: [matrix, chart]
---

<p class="lede">LoRA freezes a weight matrix and learns a correction that is the product of two thin matrices. The rank of that product is the only real knob, and it is tempting to turn it up. This placeholder post sketches what turning it does, with synthetic numbers shaped like a real sweep.</p>

## The update as pixels

For a frozen weight $W_0 \in \mathbb{R}^{d \times k}$, LoRA trains

$$
\begin{gathered}
W = W_0 + \frac{\alpha}{r} B A, \\
B \in \mathbb{R}^{d \times r},\quad A \in \mathbb{R}^{r \times k},\quad r \ll \min(d, k).
\end{gathered}
$$

$B$ starts at zero, so training begins exactly at the pretrained model.[^init] Drag the rank and watch the product gain structure.

<figure class="fig wide">
<div class="fig__frame">
<div class="widget__bar">
<label class="ctrl">rank <input type="range" min="1" max="16" step="1" value="4" data-rank aria-label="LoRA rank"> <output data-rank-out>4</output></label>
</div>
<div class="widget__body lora"><div data-lora></div></div>
<div class="stats">
<div class="stat"><span class="stat__k">trainable, one 4096² layer</span><span class="stat__v" data-stat="lora">—</span></div>
<div class="stat"><span class="stat__k">full fine-tune</span><span class="stat__v" data-stat="full">—</span></div>
<div class="stat"><span class="stat__k">fraction</span><span class="stat__v" data-stat="ratio">—</span></div>
</div>
</div>
<figcaption class="fig__cap"><span class="fig__label">Figure 1</span>Random $B$ and $A$ and their product. Orange cells are positive, blue negative. At rank 1 every row of $\Delta W$ is a multiple of the same vector; by rank 16 the pattern looks like noise.</figcaption>
</figure>

## Learning rate against rank

The useful question is not which rank wins but whether the best learning rate moves with it. With the $\alpha / r$ scaling, it mostly does not.[^scale] Hover the chart to read values; use the chips to hide or isolate a series.

<figure class="fig wide">
<div class="fig__frame">
<div class="widget__bar"><div class="chips" role="group" aria-label="Series"></div></div>
<div class="widget__body"><div class="chart" data-chart="lr-sweep" data-label="Final loss against learning rate for five LoRA ranks and full fine-tuning"></div></div>
</div>
<figcaption class="fig__cap"><span class="fig__label">Figure 2</span>Final loss against learning rate, log scale. Synthetic data. The LoRA curves share one optimum near $4 \times 10^{-4}$; full fine-tuning prefers a learning rate about ten times smaller.</figcaption>
</figure>

## Training curves

Raw loss is noisy. An exponential moving average with factor $\beta$ shows the trend:

$$
\bar{\ell}_t = \beta\, \bar{\ell}_{t-1} + (1 - \beta)\, \ell_t .
$$

<figure class="fig wide">
<div class="fig__frame">
<div class="widget__bar">
<div class="chips" role="group" aria-label="Series"></div>
<span class="widget__spacer"></span>
<label class="ctrl">β <input type="range" min="0" max="0.98" step="0.01" value="0.8" data-smooth aria-label="Smoothing"> <output data-smooth-out>0.80</output></label>
</div>
<div class="widget__body"><div class="chart" data-chart="curves" data-label="Training loss over 2000 steps for two LoRA ranks and full fine-tuning"></div></div>
</div>
<figcaption class="fig__cap"><span class="fig__label">Figure 3</span>Training loss over 2,000 steps. Synthetic data. Slide β to zero to see the raw noise.</figcaption>
</figure>

## Applying it

With Hugging Face PEFT the whole setup is a config:

```python title="lora.py"
from peft import LoraConfig, get_peft_model

config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.0,
)
model = get_peft_model(model, config)
model.print_trainable_parameters()
```

Targeting the MLP layers as well as attention matters more than the rank in most small sweeps. That claim is the subject of a real post, later.

[^init]: $A$ is initialised randomly and $B$ at zero. The reverse also works, but one of the two must be zero for $\Delta W = 0$ at step one.

[^scale]: Dividing by $r$ keeps the size of the update roughly constant as the rank changes, so the same learning rate keeps working.
