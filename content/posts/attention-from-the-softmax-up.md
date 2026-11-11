---
title: Attention, from the softmax up
date: 2026-11-04
summary: Scaled dot-product attention one piece at a time, with a temperature dial you can turn to watch a query make up its mind.
tags: [transformers, notes]
draft: true
scripts: [attention]
---

<p class="lede">Every transformer layer asks the same question once per token: of everything I have seen so far, what should I copy from? Attention is the answer, and it fits in one line. This placeholder post walks through that line slowly, so the typography, the math and the margin notes have something real to hold.</p>

## The one line

Given queries $Q \in \mathbb{R}^{n \times d}$, keys $K \in \mathbb{R}^{n \times d}$ and values $V \in \mathbb{R}^{n \times d_v}$, a single head computes

$$
\operatorname{Attention}(Q, K, V) = \operatorname{softmax}\!\left(\frac{QK^\top}{\sqrt{d}} + M\right) V,
$$

where $M$ is the causal mask: $0$ on and below the diagonal, $-\infty$ above it.[^mask] Row $i$ of the softmax is a probability distribution over the positions $j \le i$, and the output for token $i$ is the matching weighted average of value vectors.

The $\sqrt{d}$ is there for variance. If the entries of $q$ and $k$ are independent with zero mean and unit variance, then

$$
\operatorname{Var}(q^\top k) = \sum_{t=1}^{d} \operatorname{Var}(q_t k_t) = d,
$$

so without the scale the logits grow with width and the softmax saturates into a one-hot vector, which has almost no gradient.

## Temperature, by hand

Dividing by $\sqrt{d}$ is a fixed temperature. Turning it by hand shows what it does. Below is one query, the token *was*, scoring the seven tokens before it. Low temperature sharpens the distribution toward the highest score; high temperature flattens it toward uniform.

<figure class="fig">
<div class="fig__frame">
<div class="widget__bar">
<label class="ctrl">τ <input type="range" min="0.15" max="3" step="0.01" value="1" data-temp aria-label="Temperature"> <output data-temp-out>1.00</output></label>
<span class="widget__spacer"></span>
<span>entropy <output data-entropy style="color:var(--ink)">—</output></span>
</div>
<div class="widget__body"><div data-attn></div></div>
</div>
<figcaption class="fig__cap"><span class="fig__label">Figure 1</span>Attention weights for the query “was” at temperature τ. The score for “cat” is highest, so as τ falls the head commits to the subject of the sentence. Tokens after the query are masked.</figcaption>
</figure>

The entropy readout gives the same picture as a number. At $\tau \to 0$ it falls to zero bits (one token gets everything); as $\tau \to \infty$ it approaches $\log_2 7 \approx 2.81$ bits, the uniform distribution over seven visible tokens.

## In code

The whole head is a handful of lines. This version is written for reading, not speed; fused kernels compute the same thing without ever materialising the $n \times n$ matrix.[^flash]

```python title="attention.py"
import math
import torch

def attention(q, k, v, causal=True):
    # q, k: (batch, heads, n, d)   v: (batch, heads, n, d_v)
    d = q.shape[-1]
    scores = q @ k.transpose(-2, -1) / math.sqrt(d)
    if causal:
        n = scores.shape[-1]
        mask = torch.ones(n, n, dtype=torch.bool, device=q.device).triu(1)
        scores = scores.masked_fill(mask, float("-inf"))
    weights = scores.softmax(dim=-1)
    return weights @ v, weights
```

A quick check that it matches the library implementation:

```python title="check.py"
q, k, v = (torch.randn(2, 4, 128, 64) for _ in range(3))
ours, _ = attention(q, k, v)
ref = torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)
print((ours - ref).abs().max())   # ~1e-6
```

## Where to go from here

| Variant | What changes | Memory in $n$ |
|---|---|---|
| Full softmax attention | nothing | $O(n^2)$ |
| Flash attention | tiling, online softmax | $O(n)$ |
| Sliding window | $M_{ij} = -\infty$ if $i - j > w$ | $O(nw)$ |
| Linear attention | kernel feature map $\phi$ | $O(n)$ |

Each row of that table deserves its own post. For now this one exists to show how the site sets an argument: a sentence, an equation, a thing to touch, a margin note, some code.

[^mask]: In practice the mask is applied as a large negative number rather than true $-\infty$, so that a fully masked row does not produce NaNs.

[^flash]: The trick is the online softmax: keep a running maximum and a running sum, and rescale the partial output whenever the maximum changes.
