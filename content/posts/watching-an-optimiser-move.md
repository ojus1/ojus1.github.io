---
title: Watching an optimiser move
date: 2026-09-23
summary: Gradient descent with momentum on a surface you can click, and a short film of a diffusion model turning noise into a spiral.
tags: [optimisation, diffusion]
draft: true
scripts: [descent]
---

<p class="lede">Most of what is hard about training is invisible: a number goes down, or it doesn't. Two dimensions are enough to see the dynamics directly. This placeholder post has an optimiser you can push around and a short video, so the site has somewhere to show both kinds of motion.</p>

## Momentum

Plain gradient descent takes a step against the gradient. Heavy-ball momentum keeps a running velocity:

$$
v_{t+1} = \beta v_t - \eta \nabla f(\theta_t), \qquad \theta_{t+1} = \theta_t + v_{t+1}.
$$

With $\beta = 0$ this is ordinary gradient descent. As $\beta \to 1$ the optimiser remembers more of its past, which carries it along narrow valleys and, sometimes, straight past the minimum.[^nesterov]

<figure class="fig wide">
<div class="fig__frame">
<div class="widget__bar">
<label class="ctrl">η <input type="range" min="0.01" max="0.4" step="0.01" value="0.12" data-lr aria-label="Learning rate"> <output data-lr-out>0.12</output></label>
<label class="ctrl">β <input type="range" min="0" max="0.98" step="0.01" value="0.85" data-mom aria-label="Momentum"> <output data-mom-out>0.85</output></label>
<span class="widget__spacer"></span>
<button class="widget__btn" type="button" data-reset>Reset</button>
<button class="widget__btn" type="button" data-play aria-pressed="false">Run</button>
</div>
<div class="widget__body descent"><div data-descent></div></div>
<div class="stats">
<div class="stat"><span class="stat__k">step</span><span class="stat__v" data-step>0</span></div>
<div class="stat"><span class="stat__k">loss f(θ)</span><span class="stat__v" data-loss>—</span></div>
</div>
</div>
<figcaption class="fig__cap"><span class="fig__label">Figure 1</span>Contours of a surface with a long valley and a second, deeper basin to the lower left. Click anywhere to start from there. High momentum can carry the path over the ridge into the other basin.</figcaption>
</figure>

The surface is

$$
\begin{aligned}
f(x, y) ={}& 0.12(x-1)^2 + 1.4(y - 0.35x)^2 \\
&- 1.2\, \exp\!\left(-\tfrac{(x+1.6)^2 + (y+0.9)^2}{0.5}\right) + \epsilon(x, y),
\end{aligned}
$$

a tilted quadratic valley with a Gaussian well cut into it and a little ripple $\epsilon$ to make it less polite.

## Noise to structure

A diffusion model learns to undo the process that turns data into noise. Run backwards from pure Gaussian noise, the sample is pulled step by step onto the data distribution. The film below shows that for a two-dimensional point cloud whose data is a spiral.

<figure class="fig wide">
<div class="fig__frame">
<video class="video" controls autoplay muted loop playsinline preload="metadata" poster="/assets/media/diffusion-poster.jpg" aria-label="Points start as Gaussian noise and gather into a two-armed spiral over nine seconds.">
<source src="/assets/media/diffusion.mp4" type="video/mp4">
</video>
</div>
<figcaption class="fig__cap"><span class="fig__label">Video 1</span>Closed-form reverse trajectory, $x_t = \sqrt{\bar\alpha_t}\, x_0 + \sqrt{1 - \bar\alpha_t}\, \varepsilon$, from $t = 1000$ to $0$ with a linear $\beta$ schedule. Rendered with NumPy and ffmpeg.</figcaption>
</figure>

The video uses the closed form rather than a trained network, so every point lands exactly on the spiral. A real model gets close; how close is the whole game.

```python title="render.py"
betas = np.linspace(1e-4, 0.02, 1000)
alpha_bar = np.cumprod(1 - betas)

for t in reversed(range(1000)):
    a = alpha_bar[t]
    x_t = np.sqrt(a) * x0 + np.sqrt(1 - a) * noise
    draw(x_t)
```

[^nesterov]: Nesterov's variant evaluates the gradient at the look-ahead point $\theta_t + \beta v_t$, which damps the overshoot.
