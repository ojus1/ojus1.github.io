// LoRA as pixels: ΔW = B·A drawn as three heatmaps. Drag the rank slider.
// Mount: <div data-lora> inside a .fig__frame that has [data-rank] and [data-rank-out].
(function () {
  'use strict';
  const D = 48, K = 48;
  const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
  const g = () => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const RMAX = 16;
  const B = Array.from({ length: D }, () => Array.from({ length: RMAX }, g));
  const A = Array.from({ length: RMAX }, () => Array.from({ length: K }, g));
  const fmt = (n) => n.toLocaleString('en-US');

  function mount(host) {
    const fig = host.closest('.fig__frame');
    const slider = fig.querySelector('[data-rank]');
    const out = fig.querySelector('[data-rank-out]');
    const stats = fig.querySelectorAll('[data-stat]');
    const cv = document.createElement('canvas'); cv.className = 'lora__cv'; cv.setAttribute('role', 'img');
    host.appendChild(cv);
    const { ctx, fit } = window.W.canvas(cv);
    let shown = +slider.value, target = shown, raf = 0;

    function heat(x0, y0, rows, cols, cell, val, hue) {
      const c = window.W.css();
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const v = val(i, j);
        ctx.fillStyle = v >= 0 ? hue : c.series[1];
        ctx.globalAlpha = Math.min(1, Math.abs(v)) * 0.92 + 0.04;
        ctx.fillRect(x0 + j * cell, y0 + i * cell, cell - (cell > 4 ? 1 : 0), cell - (cell > 4 ? 1 : 0));
      }
      ctx.globalAlpha = 1;
    }
    function draw() {
      const { w, h } = fit();
      const c = window.W.css();
      ctx.clearRect(0, 0, w, h);
      const r = Math.max(1, Math.round(shown));
      const gap = Math.max(14, w * 0.035);
      // widths in cells: B is D x r, A is r x K, ΔW is D x K. Fit all three plus operators in w.
      const cell = Math.max(2, Math.floor(Math.min((w - gap * 4 - 40) / (RMAX + K + K), (h - 54) / D)));
      const totalW = cell * (RMAX + K + K) + gap * 4 + 20;
      let x = Math.max(8, (w - totalW) / 2);
      const y = Math.max(8, (h - 40 - cell * D) / 2);
      const mid = y + (cell * D) / 2;
      ctx.font = '11px "Geist Mono", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = c.muted;
      // B (centred in the RMAX slot)
      const bx = x + (cell * (RMAX - r)) / 2;
      heat(bx, y, D, r, cell, (i, j) => B[i][j] * 0.45, c.accent);
      ctx.fillStyle = c.ink; ctx.fillText('B', bx + (cell * r) / 2, y + cell * D + 18);
      ctx.fillStyle = c.muted; ctx.fillText(`${D} × ${r}`, bx + (cell * r) / 2, y + cell * D + 33);
      x += cell * RMAX + gap;
      ctx.fillStyle = c.muted; ctx.fillText('·', x + 5, mid + 4); x += 10 + gap;
      // A (centred vertically)
      const ay = mid - (cell * r) / 2;
      heat(x, ay, r, K, cell, (i, j) => A[i][j] * 0.45, c.accent);
      ctx.fillStyle = c.ink; ctx.fillText('A', x + (cell * K) / 2, y + cell * D + 18);
      ctx.fillStyle = c.muted; ctx.fillText(`${r} × ${K}`, x + (cell * K) / 2, y + cell * D + 33);
      x += cell * K + gap;
      ctx.fillText('=', x + 5, mid + 4); x += 10 + gap;
      heat(x, y, D, K, cell, (i, j) => { let s = 0; for (let k = 0; k < r; k++) s += B[i][k] * A[k][j]; return (s / Math.sqrt(r)) * 0.42; }, c.accent);
      ctx.fillStyle = c.ink; ctx.fillText('ΔW', x + (cell * K) / 2, y + cell * D + 18);
      ctx.fillStyle = c.muted; ctx.fillText(`${D} × ${K} · rank ${r}`, x + (cell * K) / 2, y + cell * D + 33);
      cv.setAttribute('aria-label', `Heatmaps of B (${D} by ${r}), A (${r} by ${K}) and their product, a ${D} by ${K} update of rank ${r}.`);
    }
    function update() {
      const r = +slider.value; out.textContent = r;
      target = r;
      const full = 4096 * 4096, lora = r * 2 * 4096;
      stats.forEach((s) => {
        const k = s.dataset.stat;
        s.textContent = k === 'lora' ? fmt(lora) : k === 'full' ? fmt(full) : k === 'ratio' ? (lora / full * 100).toFixed(lora / full < 0.01 ? 2 : 1) + '%' : '';
      });
      if (window.W.reduce()) { shown = target; draw(); return; }
      if (!raf) raf = requestAnimationFrame(step);
    }
    function step() { shown += (target - shown) * 0.35; if (Math.abs(target - shown) < 0.05) shown = target; draw(); raf = shown !== target ? requestAnimationFrame(step) : 0; }
    slider.addEventListener('input', update);
    update(); draw();
    new ResizeObserver(draw).observe(cv);
    window.W.onTheme(draw);
  }
  window.W.ready(() => document.querySelectorAll('[data-lora]').forEach(mount));
})();
