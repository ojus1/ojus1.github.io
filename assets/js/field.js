// Home hero: a causal attention matrix drawn as a pixel grid. Scores drift slowly;
// pointing at a row pins that query and shows where it looks.
(function () {
  'use strict';
  const cv = document.querySelector('[data-field]');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const btn = document.querySelector('.field__pause');
  const label = document.querySelector('.field__label');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 28;
  const toks = 'the model reads every token and decides where to look next before it writes one more'.split(' ');
  let colors = {}, w = 0, h = 0, dpr = 1, t = Math.random() * 100, running = !reduce, hover = -1, raf = 0;

  // fixed random features per token -> scores are dot products of slowly rotating vectors
  const D = 6;
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const q = Array.from({ length: N }, () => Array.from({ length: D }, () => rnd() * 2 - 1));
  const k = Array.from({ length: N }, () => Array.from({ length: D }, () => rnd() * 2 - 1));
  const ph = Array.from({ length: D }, () => rnd() * 6.28);

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    colors = { bg: s.getPropertyValue('--surface').trim(), ink: s.getPropertyValue('--ink').trim(), muted: s.getPropertyValue('--muted').trim(), rule: s.getPropertyValue('--rule').trim(), accent: s.getPropertyValue('--accent').trim() };
  }
  function size() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function weights(tt) {
    const A = [];
    for (let i = 0; i < N; i++) {
      const row = new Float32Array(N); let m = -Infinity;
      for (let j = 0; j <= i; j++) {
        let s = 0;
        for (let d = 0; d < D; d++) s += q[i][d] * k[j][d] * Math.cos(tt * 0.35 + ph[d] + d * 0.4);
        s = s * 2.2 - (i - j) * 0.06; // mild recency bias
        row[j] = s; if (s > m) m = s;
      }
      let z = 0;
      for (let j = 0; j <= i; j++) { row[j] = Math.exp(row[j] - m); z += row[j]; }
      for (let j = 0; j <= i; j++) row[j] /= z;
      A.push(row);
    }
    return A;
  }
  function geom() {
    const pad = Math.max(22, Math.min(w, h) * 0.08);
    const side = Math.min(w - pad * 2, h - pad * 2);
    const cell = Math.floor(side / N);
    const gx = Math.round((w - cell * N) / 2), gy = Math.round((h - cell * N) / 2);
    return { cell, gx, gy };
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const { cell, gx, gy } = geom();
    const A = weights(t);
    const gap = cell > 9 ? 1.5 : 1;
    // dotted ground
    ctx.fillStyle = colors.rule;
    for (let y = 12; y < h; y += 16) for (let x = 12; x < w; x += 16) ctx.fillRect(x, y, 1, 1);
    for (let i = 0; i < N; i++) {
      const dim = hover >= 0 && hover !== i;
      let best = 0; for (let j = 1; j <= i; j++) if (A[i][j] > A[i][best]) best = j;
      for (let j = 0; j < N; j++) {
        const x = gx + j * cell, y = gy + i * cell;
        if (j > i) { ctx.globalAlpha = 1; ctx.fillStyle = colors.bg; ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap); continue; }
        const v = Math.min(1, Math.pow(A[i][j] * (i + 1) / 3.2, 0.8));
        ctx.globalAlpha = (0.06 + 0.94 * v) * (dim ? 0.25 : 1);
        ctx.fillStyle = j === best && i > 0 ? colors.accent : colors.ink;
        if (j === best && i > 0) ctx.globalAlpha = dim ? 0.3 : 1;
        ctx.fillRect(x + gap / 2, y + gap / 2, cell - gap, cell - gap);
      }
    }
    ctx.globalAlpha = 1;
    // frame brackets, mono labels
    ctx.strokeStyle = colors.muted; ctx.lineWidth = 1;
    const L = 8, x0 = gx - 6.5, y0 = gy - 6.5, x1 = gx + cell * N + 6.5, y1 = gy + cell * N + 6.5;
    ctx.beginPath();
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); });
    ctx.stroke();
    ctx.font = '11px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = colors.muted; ctx.textBaseline = 'alphabetic';
    ctx.fillText('keys →', gx, gy - 12);
    ctx.save(); ctx.translate(gx - 12, gy + 44); ctx.rotate(-Math.PI / 2); ctx.fillText('queries →', -40, 0); ctx.restore();
    if (hover >= 0) {
      const row = A[hover]; let best = 0; for (let j = 1; j <= hover; j++) if (row[j] > row[best]) best = j;
      label.textContent = `“${toks[hover % toks.length]}” looks at “${toks[best % toks.length]}” · ${(row[best] * 100).toFixed(0)}%`;
    }
  }
  function loop() { t += 0.006; draw(); raf = running ? requestAnimationFrame(loop) : 0; }
  function setRunning(on) {
    running = on; btn.setAttribute('aria-pressed', String(!on)); btn.textContent = on ? 'Pause' : 'Play';
    if (on && !raf) raf = requestAnimationFrame(loop);
  }

  readColors(); size(); draw();
  if (running) raf = requestAnimationFrame(loop); else { btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'true'); }
  btn.addEventListener('click', () => setRunning(!running));
  new ResizeObserver(() => { size(); draw(); }).observe(cv);
  document.addEventListener('themechange', () => { readColors(); draw(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (running && !raf) raf = requestAnimationFrame(loop); });
  const idle = label.textContent;
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(); const { cell, gy } = geom();
    const i = Math.floor((e.clientY - r.top - gy) / cell);
    hover = i >= 0 && i < N ? i : -1; if (hover < 0) label.textContent = idle; if (!running) draw();
  });
  cv.addEventListener('pointerleave', () => { hover = -1; label.textContent = idle; if (!running) draw(); });
})();
