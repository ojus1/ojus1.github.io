// Responsive line charts drawn with d3. Mount: <div class="chart" data-chart="lr-sweep|curves">.
// The data here is synthetic, shaped like a real sweep, for layout only.
(function () {
  'use strict';
  const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(42);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const DATA = {
    'lr-sweep': () => {
      const ranks = [1, 4, 16, 64, 256];
      const lrs = d3.range(-5, -2.49, 0.125).map((e) => Math.pow(10, e));
      const series = ranks.map((r, i) => {
        const best = Math.log10(4e-4) + 0.02 * Math.log2(r) * 0; // optimum barely moves with rank
        const floor = 1.62 + 0.09 / Math.sqrt(r);
        return { key: 'r = ' + r, values: lrs.map((lr) => { const x = Math.log10(lr) - best; return { x: lr, y: floor + 0.13 * x * x + (x > 0.8 ? 0.6 * (x - 0.8) ** 2 : 0) + gauss() * 0.006 }; }) };
      });
      series.push({ key: 'full FT', dashed: true, values: lrs.map((lr) => { const x = Math.log10(lr) - Math.log10(4e-5); return { x: lr, y: 1.6 + 0.15 * x * x + (x > 0.6 ? 0.9 * (x - 0.6) ** 2 : 0) + gauss() * 0.006 }; }) });
      return { series, x: { log: true, label: 'learning rate', fmt: d3.format('.0e') }, y: { label: 'final loss', fmt: d3.format('.2f'), domain: [1.55, 2.2] } };
    },
    curves: () => {
      const steps = d3.range(0, 2001, 10);
      const mk = (key, a, b, n) => ({ key, raw: steps.map((s) => ({ x: s, y: a + b / Math.sqrt(1 + s / 40) + gauss() * n })) });
      const series = [mk('rank 8', 1.66, 1.4, 0.05), mk('rank 64', 1.62, 1.42, 0.05), mk('full FT', 1.6, 1.45, 0.05)];
      return { series, smooth: true, x: { label: 'step', fmt: d3.format('~s') }, y: { label: 'train loss', fmt: d3.format('.2f'), domain: [1.5, 3.2] } };
    },
  };

  const ema = (vals, a) => { let m = vals[0].y; return vals.map((p) => ({ x: p.x, y: (m = a * m + (1 - a) * p.y) })); };

  function mount(host) {
    const spec = DATA[host.dataset.chart]();
    const fig = host.closest('.fig__frame') || host;
    const chips = fig.querySelector('.chips');
    const smooth = fig.querySelector('[data-smooth]');
    const tip = document.createElement('div'); tip.className = 'tip'; host.appendChild(tip);
    const svg = d3.select(host).append('svg').attr('role', 'img').attr('aria-label', host.dataset.label || 'Line chart');
    const on = new Set(spec.series.map((s) => s.key));
    let solo = null;

    if (chips) {
      spec.series.forEach((s, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'true');
        b.style.setProperty('--c', `var(--series-${(i % 5) + 1})`);
        b.innerHTML = `<i></i>${s.key}`;
        b.addEventListener('click', () => { on.has(s.key) ? on.delete(s.key) : on.add(s.key); if (!on.size) on.add(s.key); b.setAttribute('aria-pressed', on.has(s.key)); draw(); });
        b.addEventListener('mouseenter', () => { solo = s.key; emph(); });
        b.addEventListener('mouseleave', () => { solo = null; emph(); });
        chips.appendChild(b);
      });
    }
    if (smooth) smooth.addEventListener('input', () => { fig.querySelector('[data-smooth-out]').textContent = (+smooth.value).toFixed(2); draw(); });

    function emph() { svg.selectAll('.series').classed('is-dim', (d) => solo && d.key !== solo); }

    function draw() {
      const W = host.clientWidth, H = Math.max(240, Math.min(420, W * 0.56));
      const m = { t: 16, r: 16, b: 44, l: 52 };
      svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
      svg.selectAll('*').remove();
      const series = spec.series.map((s, i) => ({ ...s, i, values: s.raw ? ema(s.raw, smooth ? +smooth.value : 0) : s.values })).filter((s) => on.has(s.key));
      const all = series.flatMap((s) => s.values);
      const x = (spec.x.log ? d3.scaleLog() : d3.scaleLinear()).domain(d3.extent(all, (d) => d.x)).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain(spec.y.domain).range([H - m.b, m.t]).clamp(true);
      const nx = W < 520 ? 4 : 7;
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(''));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(nx, spec.x.log ? '.0e' : undefined).tickSizeOuter(0).tickFormat(spec.x.log ? undefined : spec.x.fmt));
      svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(spec.y.fmt).tickSizeOuter(0));
      svg.append('text').attr('class', 'axis-label').attr('x', W - m.r).attr('y', H - 8).attr('text-anchor', 'end').text(spec.x.label + ' →');
      svg.append('text').attr('class', 'axis-label').attr('x', m.l).attr('y', 10).text('↑ ' + spec.y.label);
      const line = d3.line().x((d) => x(d.x)).y((d) => y(d.y)).curve(d3.curveMonotoneX);
      const paths = svg.append('g').selectAll('path').data(series).join('path').attr('class', 'series').attr('d', (d) => line(d.values))
        .attr('stroke', (d) => `var(--series-${(d.i % 5) + 1})`).attr('stroke-dasharray', (d) => (d.dashed ? '5 4' : null));
      if (!window.W.reduce() && !draw.done) {
        paths.each(function () { const L = this.getTotalLength(); d3.select(this).attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0).on('end', function (d) { d3.select(this).attr('stroke-dasharray', d.dashed ? '5 4' : null); }); });
        draw.done = true;
      }
      emph();
      const cross = svg.append('line').attr('class', 'crosshair').attr('y1', m.t).attr('y2', H - m.b).style('opacity', 0);
      const dots = svg.append('g').selectAll('circle').data(series).join('circle').attr('class', 'dot').attr('r', 3.5).attr('fill', (d) => `var(--series-${(d.i % 5) + 1})`).style('opacity', 0);
      const xs = series[0].values.map((d) => d.x);
      svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
        .on('pointermove', (ev) => {
          const [px] = d3.pointer(ev); const xv = x.invert(px);
          const k = Math.max(0, Math.min(xs.length - 1, d3.bisectCenter(xs, xv)));
          const X = x(xs[k]);
          cross.attr('x1', X).attr('x2', X).style('opacity', 1);
          dots.attr('cx', X).attr('cy', (d) => y(d.values[k].y)).style('opacity', 1);
          tip.innerHTML = `<b>${spec.x.label} ${spec.x.fmt(xs[k])}</b><br>` + series.map((s) => `<i style="--c:var(--series-${(s.i % 5) + 1})"></i>${s.key}  ${spec.y.fmt(s.values[k].y)}`).join('<br>');
          tip.style.left = Math.min(Math.max(X, 90), W - 90) + 'px'; tip.style.top = m.t + 8 + 'px'; tip.classList.add('is-on');
        })
        .on('pointerleave', () => { cross.style('opacity', 0); dots.style('opacity', 0); tip.classList.remove('is-on'); });
    }
    draw();
    let last = host.clientWidth;
    new ResizeObserver(() => { if (host.clientWidth !== last) { last = host.clientWidth; draw(); } }).observe(host);
  }
  window.W.ready(() => document.querySelectorAll('[data-chart]').forEach(mount));
})();
