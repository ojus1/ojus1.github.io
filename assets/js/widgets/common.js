// Shared helpers for the post widgets.
window.W = (function () {
  'use strict';
  const css = () => {
    const s = getComputedStyle(document.documentElement);
    const g = (k) => s.getPropertyValue(k).trim();
    return { bg: g('--bg'), surface: g('--surface'), ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), rule: g('--rule'), ruleStrong: g('--rule-strong'), accent: g('--accent'), series: [1, 2, 3, 4, 5].map((i) => g('--series-' + i)) };
  };
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onTheme = (fn) => document.addEventListener('themechange', fn);
  const canvas = (cv) => {
    const ctx = cv.getContext('2d');
    const fit = () => {
      const r = cv.getBoundingClientRect(); const d = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      return { w: r.width, h: r.height };
    };
    return { ctx, fit };
  };
  // Run a loop only while the element is on screen and the tab is visible.
  const whenVisible = (elem, start, stop) => {
    let on = false;
    const io = new IntersectionObserver(([e]) => { const v = e.isIntersecting && !document.hidden; if (v !== on) { on = v; v ? start() : stop(); } });
    io.observe(elem);
    document.addEventListener('visibilitychange', () => { if (document.hidden && on) { on = false; stop(); } });
  };
  const ready = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  return { css, reduce, onTheme, canvas, whenVisible, ready };
})();
