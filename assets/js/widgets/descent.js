// Gradient descent with momentum on a two-basin surface. Click the plot to drop a new start.
// Mount: <div data-descent> inside a .fig__frame with [data-lr], [data-mom], [data-reset], [data-play].
(function () {
  'use strict';
  // f(x, y): a tilted valley plus a second, shallower basin
  const f = (x, y) => 0.12 * (x - 1) ** 2 + 1.4 * (y - 0.35 * x) ** 2 - 1.2 * Math.exp(-((x + 1.6) ** 2 + (y + 0.9) ** 2) / 0.5) + 0.04 * Math.sin(3 * x) * Math.cos(2 * y);
  const grad = (x, y, h = 1e-4) => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  const X = [-3.2, 3.2], Y = [-2.2, 2.2];

  function mount(host) {
    const fig = host.closest('.fig__frame');
    const lr = fig.querySelector('[data-lr]'), mom = fig.querySelector('[data-mom]');
    const lrOut = fig.querySelector('[data-lr-out]'), momOut = fig.querySelector('[data-mom-out]');
    const play = fig.querySelector('[data-play]'), reset = fig.querySelector('[data-reset]');
    const lossOut = fig.querySelector('[data-loss]'), stepOut = fig.querySelector('[data-step]');
    const cv = document.createElement('canvas'); cv.className = 'descent__cv'; cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Contour plot of a loss surface with the path of gradient descent drawn over it. Click to choose a new starting point.');
    host.appendChild(cv);
    const { ctx, fit } = window.W.canvas(cv);
    let w = 0, h = 0, field = null, start = [2.6, 1.7], p, v, path, n, running = false, raf = 0;

    const sx = (x) => ((x - X[0]) / (X[1] - X[0])) * w;
    const sy = (y) => h - ((y - Y[0]) / (Y[1] - Y[0])) * h;
    function restart() { p = start.slice(); v = [0, 0]; path = [p.slice()]; n = 0; }
    function bake() {
      ({ w, h } = fit());
      const c = window.W.css();
      const off = document.createElement('canvas'); const d = Math.min(devicePixelRatio || 1, 2);
      off.width = Math.round(w * d); off.height = Math.round(h * d);
      const o = off.getContext('2d'); o.setTransform(d, 0, 0, d, 0, 0);
      // contour lines via marching squares on a coarse grid
      const G = 90, R = Math.round(G * h / w);
      const vals = [];
      for (let i = 0; i <= R; i++) { vals.push([]); for (let j = 0; j <= G; j++) vals[i].push(f(X[0] + (j / G) * (X[1] - X[0]), Y[1] - (i / R) * (Y[1] - Y[0]))); }
      const cw = w / G, ch = h / R;
      const levels = []; for (let l = -1.1; l < 3; l += 0.14) levels.push(l);
      levels.forEach((L, li) => {
        o.strokeStyle = li % 5 === 0 ? c.ruleStrong : c.rule; o.lineWidth = 1; o.beginPath();
        for (let i = 0; i < R; i++) for (let j = 0; j < G; j++) {
          const a = vals[i][j], b = vals[i][j + 1], cc = vals[i + 1][j + 1], dd = vals[i + 1][j];
          const pts = [];
          const edge = (v1, v2, x1, y1, x2, y2) => { if ((v1 < L) !== (v2 < L)) { const t = (L - v1) / (v2 - v1); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
          const x0 = j * cw, y0 = i * ch;
          edge(a, b, x0, y0, x0 + cw, y0); edge(b, cc, x0 + cw, y0, x0 + cw, y0 + ch); edge(cc, dd, x0 + cw, y0 + ch, x0, y0 + ch); edge(dd, a, x0, y0 + ch, x0, y0);
          if (pts.length >= 2) { o.moveTo(pts[0][0], pts[0][1]); o.lineTo(pts[1][0], pts[1][1]); }
          if (pts.length === 4) { o.moveTo(pts[2][0], pts[2][1]); o.lineTo(pts[3][0], pts[3][1]); }
        }
        o.stroke();
      });
      field = off;
    }
    function draw() {
      const c = window.W.css();
      ctx.clearRect(0, 0, w, h);
      if (field) ctx.drawImage(field, 0, 0, w, h);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.75; ctx.lineJoin = 'round'; ctx.beginPath();
      path.forEach((q, i) => (i ? ctx.lineTo(sx(q[0]), sy(q[1])) : ctx.moveTo(sx(q[0]), sy(q[1]))));
      ctx.stroke();
      ctx.fillStyle = c.accent;
      path.forEach((q, i) => { if (i % 4 === 0) { ctx.beginPath(); ctx.arc(sx(q[0]), sy(q[1]), 1.6, 0, 7); ctx.fill(); } });
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; const s0 = path[0];
      ctx.strokeRect(sx(s0[0]) - 4, sy(s0[1]) - 4, 8, 8);
      lossOut.textContent = f(p[0], p[1]).toFixed(3); stepOut.textContent = n;
    }
    function step() {
      const eta = +lr.value, beta = +mom.value;
      const [gx, gy] = grad(p[0], p[1]);
      v = [beta * v[0] - eta * gx, beta * v[1] - eta * gy];
      p = [Math.max(X[0], Math.min(X[1], p[0] + v[0])), Math.max(Y[0], Math.min(Y[1], p[1] + v[1]))];
      path.push(p.slice()); n++;
      if (path.length > 600) path.shift();
    }
    function loop() { for (let i = 0; i < 2; i++) step(); draw(); if (n > 1200) setRunning(false); raf = running ? requestAnimationFrame(loop) : 0; }
    function setRunning(on) { running = on; play.textContent = on ? 'Pause' : 'Run'; play.setAttribute('aria-pressed', String(on)); if (on && !raf) raf = requestAnimationFrame(loop); }
    const sync = () => { lrOut.textContent = (+lr.value).toFixed(2); momOut.textContent = (+mom.value).toFixed(2); };
    lr.addEventListener('input', () => { sync(); restart(); draw(); });
    mom.addEventListener('input', () => { sync(); restart(); draw(); });
    reset.addEventListener('click', () => { restart(); draw(); });
    play.addEventListener('click', () => { if (n > 1200) restart(); setRunning(!running); });
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      start = [X[0] + ((e.clientX - r.left) / w) * (X[1] - X[0]), Y[0] + ((h - (e.clientY - r.top)) / h) * (Y[1] - Y[0])];
      restart(); draw(); if (!running) setRunning(true);
    });
    sync(); restart(); bake(); draw();
    new ResizeObserver(() => { bake(); draw(); }).observe(cv);
    window.W.onTheme(() => { bake(); draw(); });
    // start once when first seen; never restart on its own after the user pauses
    let seen = false;
    window.W.whenVisible(cv, () => { if (!seen && !window.W.reduce()) { seen = true; setRunning(true); } }, () => { if (running) { cancelAnimationFrame(raf); raf = 0; running = false; play.textContent = 'Run'; play.setAttribute('aria-pressed', 'false'); } });
  }
  window.W.ready(() => document.querySelectorAll('[data-descent]').forEach(mount));
})();
