// Softmax temperature, one query at a time. Mount: <div data-attn> inside a .fig__frame
// with a [data-temp] range input and a [data-temp-out] output.
(function () {
  'use strict';
  const toks = ['The', 'cat', 'that', 'the', 'dog', 'chased', 'was', 'tired'];
  // raw scores q·k/√d for the query "was" (it should find its subject, "cat")
  const scores = [0.4, 2.6, 0.2, 0.1, 1.1, 1.6, 0.9, -0.3];

  function mount(host) {
    const fig = host.closest('.fig__frame');
    const temp = fig.querySelector('[data-temp]');
    const out = fig.querySelector('[data-temp-out]');
    const ent = fig.querySelector('[data-entropy]');
    const qi = 6;
    host.innerHTML = '';
    host.className += ' attn';
    const rows = toks.map((t, j) => {
      const row = document.createElement('div'); row.className = 'attn__row' + (j === qi ? ' is-query' : '') + (j > qi ? ' is-masked' : '');
      row.innerHTML = `<span class="attn__tok">${t}</span><span class="attn__bar"><i></i></span><span class="attn__v">0.00</span>`;
      host.appendChild(row);
      return { bar: row.querySelector('i'), v: row.querySelector('.attn__v') };
    });
    function update() {
      const T = +temp.value; out.textContent = T.toFixed(2);
      const s = scores.map((x, j) => (j > qi ? -Infinity : x / T));
      const m = Math.max(...s.filter(isFinite));
      const e = s.map((x) => (isFinite(x) ? Math.exp(x - m) : 0));
      const z = e.reduce((a, b) => a + b, 0);
      const p = e.map((x) => x / z);
      let H = 0;
      p.forEach((x, j) => {
        rows[j].bar.style.transform = `scaleX(${x})`;
        rows[j].v.textContent = j > qi ? 'mask' : x.toFixed(2);
        if (x > 0) H -= x * Math.log2(x);
      });
      if (ent) ent.textContent = H.toFixed(2) + ' bits';
    }
    temp.addEventListener('input', update);
    update();
  }
  window.W.ready(() => document.querySelectorAll('[data-attn]').forEach(mount));
})();
