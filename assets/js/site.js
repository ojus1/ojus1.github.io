// Site-wide behaviour: theme toggle, copy buttons, margin notes, contents highlighting.
(function () {
  'use strict';
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : mq.matches;
  const announce = () => document.dispatchEvent(new CustomEvent('themechange', { detail: { dark: isDark() } }));
  mq.addEventListener?.('change', () => { if (!root.dataset.theme) announce(); });
  window.siteTheme = { isDark };

  document.addEventListener('DOMContentLoaded', () => {
    // theme
    document.querySelectorAll('.theme-toggle').forEach((b) => {
      const sync = () => b.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
      sync();
      b.addEventListener('click', () => {
        const next = isDark() ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
        sync(); announce();
      });
    });

    // copy buttons
    document.querySelectorAll('.code__copy').forEach((b) => {
      b.addEventListener('click', async () => {
        const pre = b.closest('.code').querySelector('pre');
        try { await navigator.clipboard.writeText(pre.innerText); } catch (e) { return; }
        const label = b.querySelector('span');
        b.classList.add('is-done'); label.textContent = 'Copied';
        setTimeout(() => { b.classList.remove('is-done'); label.textContent = 'Copy'; }, 1400);
      });
    });

    // range inputs: paint the filled part of the track
    const paint = (r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
    document.querySelectorAll('input[type="range"]').forEach((r) => { paint(r); r.addEventListener('input', () => paint(r)); });

    // margin notes: copy each footnote next to its reference on wide screens
    const prose = document.getElementById('prose');
    if (prose) {
      const wide = window.matchMedia('(min-width: 1001px)');
      const notes = [];
      prose.querySelectorAll('.fn-ref a').forEach((a) => {
        const li = document.getElementById(a.getAttribute('href').slice(1));
        if (!li) return;
        const aside = document.createElement('aside');
        aside.className = 'sidenote';
        aside.innerHTML = `<span class="sidenote__n">${a.dataset.fn}</span>` + li.innerHTML.replace(/<a[^>]*class="footnote-backref"[^>]*>.*?<\/a>/g, '');
        aside.setAttribute('aria-hidden', 'true');
        notes.push({ a, aside });
      });
      const place = () => {
        notes.forEach(({ aside }) => aside.remove());
        prose.classList.toggle('has-sidenotes', wide.matches && notes.length > 0);
        if (!wide.matches) return;
        const top0 = prose.getBoundingClientRect().top;
        let floor = 0;
        // wide figures reach into the margin column, so notes must not sit beside them
        const blocks = [...prose.querySelectorAll('.fig.wide')].map((f) => { const r = f.getBoundingClientRect(); return [r.top - top0 - 12, r.bottom - top0 + 12]; });
        notes.forEach(({ a, aside }) => {
          prose.appendChild(aside);
          let y = a.getBoundingClientRect().top - top0 - 4;
          y = Math.max(y, floor);
          for (const [t, b] of blocks) if (y < b && y + aside.offsetHeight > t) y = b;
          aside.style.top = y + 'px';
          floor = y + aside.offsetHeight + 16;
        });
      };
      if (notes.length) {
        place();
        wide.addEventListener?.('change', place);
        let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(place, 120); });
        document.fonts?.ready.then(place);
        window.addEventListener('load', place);
      }

      // contents: mark the section being read
      const links = [...document.querySelectorAll('.toc__item a')];
      const heads = links.map((l) => document.getElementById(decodeURIComponent(l.hash.slice(1)))).filter(Boolean);
      if (heads.length) {
        let raf = 0;
        const spy = () => {
          raf = 0;
          let cur = heads[0];
          for (const h of heads) if (h.getBoundingClientRect().top < window.innerHeight * 0.3) cur = h;
          links.forEach((l) => l.classList.toggle('is-current', decodeURIComponent(l.hash.slice(1)) === cur.id));
        };
        window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
        spy();
      }
    }
  });
})();
