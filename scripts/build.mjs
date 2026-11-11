// Builds the static site: Markdown posts in content/posts -> posts/<slug>/index.html,
// plus the home page, 404, RSS feed and vendored assets. Run with `npm run build`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import anchor from 'markdown-it-anchor';
import mdKatex from '@vscode/markdown-it-katex';
import { createHighlighter } from 'shiki';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = {
  title: 'Surya Kant Sahu',
  url: 'https://ojus1.github.io',
  description: 'Notes on machine learning: transformers, learning theory, audio, and running models in places they were not built for.',
  author: 'Surya Kant Sahu',
  github: 'https://github.com/ojus1',
};

const r = (...p) => path.join(ROOT, ...p);
const write = async (p, s) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, s); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d) => d.toISOString().slice(0, 10);
const longDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- vendor assets ----------
async function vendor() {
  const copy = async (from, to) => { await fs.mkdir(path.dirname(r(to)), { recursive: true }); await fs.cp(r(from), r(to), { recursive: true }); };
  const nr = 'node_modules/@fontsource-variable/newsreader/files/';
  await copy(nr + 'newsreader-latin-opsz-normal.woff2', 'assets/fonts/newsreader-opsz.woff2');
  await copy(nr + 'newsreader-latin-opsz-italic.woff2', 'assets/fonts/newsreader-opsz-italic.woff2');
  const gm = 'node_modules/@fontsource/geist-mono/files/';
  await copy(gm + 'geist-mono-latin-400-normal.woff2', 'assets/fonts/geist-mono-400.woff2');
  await copy(gm + 'geist-mono-latin-500-normal.woff2', 'assets/fonts/geist-mono-500.woff2');
  await copy('node_modules/katex/dist/katex.min.css', 'assets/vendor/katex/katex.min.css');
  const kf = await fs.readdir(r('node_modules/katex/dist/fonts'));
  for (const f of kf.filter((f) => f.endsWith('.woff2'))) await copy('node_modules/katex/dist/fonts/' + f, 'assets/vendor/katex/fonts/' + f);
  await copy('node_modules/d3/dist/d3.min.js', 'assets/vendor/d3.min.js');
  // WebLLM: bundle the engine into a module worker so inference never blocks the page.
  await esbuild.build({ entryPoints: [r('src/llm-worker.js')], bundle: true, format: 'esm', minify: true, outfile: r('assets/js/llm-worker.js'), logLevel: 'warning' });
  await fs.rm(r('assets/js/llm'), { recursive: true, force: true });
  await esbuild.build({ entryPoints: [r('src/llm-client.js')], bundle: true, splitting: true, format: 'esm', minify: true, outdir: r('assets/js/llm'), chunkNames: 'chunk-[hash]', logLevel: 'warning' });
}

// ---------- markdown ----------
const highlighter = await createHighlighter({
  themes: ['github-light', 'vitesse-dark'],
  langs: ['python', 'javascript', 'typescript', 'bash', 'json', 'html', 'css', 'text'],
});

function makeMd() {
  const md = new MarkdownIt({ html: true, typographer: true, linkify: false });
  md.use(mdKatex.default ?? mdKatex, { throwOnError: true, enableMathBlockInHtml: true, enableMathInlineInHtml: true });
  md.use(footnote);
  md.use(anchor, { level: [2, 3], slugify: (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') });
  // Code fences: ```python title="train.py"
  md.renderer.rules.fence = (tokens, idx) => {
    const t = tokens[idx];
    const [lang = 'text', ...rest] = t.info.trim().split(/\s+/);
    const title = (rest.join(' ').match(/title="([^"]+)"/) || [])[1];
    const html = highlighter.codeToHtml(t.content.replace(/\n$/, ''), { lang, themes: { light: 'github-light', dark: 'vitesse-dark' }, defaultColor: false });
    return `<figure class="code" data-lang="${esc(lang)}"><figcaption class="code__bar"><span class="code__name">${esc(title || lang)}</span><button class="code__copy" type="button" aria-label="Copy code"><span>Copy</span></button></figcaption>${html}</figure>\n`;
  };
  // Footnotes become margin notes on wide screens (see assets/js/site.js); keep the list as the fallback.
  md.renderer.rules.footnote_ref = (tokens, idx, _o, env, slf) => {
    const id = slf.rules.footnote_anchor_name(tokens, idx, _o, env, slf);
    const n = Number(tokens[idx].meta.id + 1);
    let refid = id; if (tokens[idx].meta.subId > 0) refid += ':' + tokens[idx].meta.subId;
    return `<sup class="fn-ref"><a href="#fn${id}" id="fnref${refid}" data-fn="${n}">${n}</a></sup>`;
  };
  md.renderer.rules.footnote_block_open = () => '<section class="footnotes" aria-label="Notes"><h2 class="footnotes__title">Notes</h2><ol class="footnotes__list">\n';
  md.renderer.rules.footnote_caption = (tokens, idx) => String(Number(tokens[idx].meta.id + 1));
  return md;
}
const md = makeMd();

function toc(html) {
  const items = [...html.matchAll(/<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map(([, l, id, inner]) => ({ l: +l, id, text: inner.replace(/<[^>]+>/g, '') }));
  if (!items.length) return '';
  let n = 0;
  return `<ol class="toc__list">${items.map((i) => `<li class="toc__item toc__item--h${i.l}"><a href="#${i.id}">${i.l === 2 ? `<span class="toc__n">${String(++n).padStart(2, '0')}</span>` : ''}<span>${esc(i.text)}</span></a></li>`).join('')}</ol>`;
}

// ---------- templates ----------
const themeBoot = `<script>(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}})()</script>`;

function head({ title, description, url, extra = '', type = 'website' }) {
  const full = title === SITE.title ? title : `${title} · ${SITE.title}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(SITE.author)}">
<meta name="theme-color" content="#fbf6ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0b0a" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.title)}" href="/feed.xml">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/newsreader-opsz.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/geist-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
${extra}${themeBoot}
<script src="/assets/js/site.js" defer></script>
</head>`;
}

const header = (current) => `<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="masthead__inner">
    <a class="wordmark" href="/" aria-label="Surya Kant Sahu, home"><span class="wordmark__mark" aria-hidden="true"></span><span>Surya Kant Sahu</span></a>
    <nav class="nav" aria-label="Main">
      <a href="/#writing"${current === 'writing' ? ' aria-current="page"' : ''}>Writing</a>
      <a href="/#about">About</a>
      <a href="${SITE.github}" rel="me">GitHub</a>
      <button class="theme-toggle" type="button" aria-label="Switch colour theme"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.25"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg></button>
    </nav>
  </div>
</header>`;

const footer = () => `<footer class="colophon">
  <div class="colophon__inner">
    <span>© ${new Date().getUTCFullYear()} Surya Kant Sahu</span>
    <nav aria-label="Elsewhere"><a href="${SITE.github}">GitHub</a><a href="/feed.xml">RSS</a><a href="https://github.com/ojus1/ojus1.github.io">Source</a></nav>
  </div>
</footer>`;

function postPage(p, prev, next) {
  const libs = [];
  if (p.math) libs.push('<link rel="stylesheet" href="/assets/vendor/katex/katex.min.css">');
  if (p.d3) libs.push('<script src="/assets/vendor/d3.min.js" defer></script>');
  if (p.scripts?.length) libs.push('<script src="/assets/js/widgets/common.js" defer></script>');
  for (const s of p.scripts || []) libs.push(`<script src="/assets/js/widgets/${s}.js" defer></script>`);
  for (const s of p.modules || []) libs.push(`<script type="module" src="${s}"></script>`);
  const bib = `@article{sahu${p.date.getUTCFullYear()}${p.slug.split('-')[0]},
  author = {Surya Kant Sahu},
  title  = {${p.title}},
  year   = {${p.date.getUTCFullYear()}},
  url    = {${SITE.url}/posts/${p.slug}/}
}`;
  const bibHtml = highlighter.codeToHtml(bib, { lang: 'text', themes: { light: 'github-light', dark: 'vitesse-dark' }, defaultColor: false });
  return `${head({ title: p.title, description: p.summary, url: `${SITE.url}/posts/${p.slug}/`, extra: libs.join('\n') + '\n', type: 'article' })}
<body class="page-post">
${header('writing')}
<main id="main">
  <article class="post">
    <header class="post__head">
      <p class="kicker"><span class="kicker__tag">${p.draft ? 'Placeholder post' : 'Essay'}</span><span>${p.minutes} min read</span></p>
      <h1 class="post__title">${esc(p.title)}</h1>
      <p class="post__dek">${esc(p.summary)}</p>
      <dl class="byline">
        <div><dt>Author</dt><dd>${esc(SITE.author)}</dd></div>
        <div><dt>Published</dt><dd><time datetime="${fmtDate(p.date)}">${longDate(p.date)}</time></dd></div>
        <div><dt>Topics</dt><dd>${p.tags.map(esc).join(', ')}</dd></div>
      </dl>
    </header>
    <div class="post__grid">
      <nav class="toc" aria-label="Contents">
        <details class="toc__details" open>
          <summary class="toc__title">Contents</summary>
          ${p.toc}
        </details>
      </nav>
      <div class="prose" id="prose">
${p.html}
        <section class="cite" aria-labelledby="cite-h">
          <h2 id="cite-h" class="cite__title">Cite this post</h2>
          <figure class="code" data-lang="bibtex"><figcaption class="code__bar"><span class="code__name">BibTeX</span><button class="code__copy" type="button" aria-label="Copy citation"><span>Copy</span></button></figcaption>${bibHtml}</figure>
        </section>
      </div>
    </div>
    <nav class="pager" aria-label="More writing">
      ${prev ? `<a class="pager__link" href="/posts/${prev.slug}/"><span class="pager__dir">Older</span><span class="pager__title">${esc(prev.title)}</span></a>` : '<span></span>'}
      ${next ? `<a class="pager__link pager__link--next" href="/posts/${next.slug}/"><span class="pager__dir">Newer</span><span class="pager__title">${esc(next.title)}</span></a>` : '<span></span>'}
    </nav>
  </article>
</main>
${footer()}
</body>
</html>
`;
}

function homePage(posts) {
  const rows = posts.map((p, i) => `
      <li class="index__row">
        <a class="index__link" href="/posts/${p.slug}/">
          <span class="index__n">${String(posts.length - i).padStart(3, '0')}</span>
          <span class="index__body">
            <span class="index__title">${esc(p.title)}</span>
            <span class="index__sum">${esc(p.summary)}</span>
          </span>
          <span class="index__meta"><time datetime="${fmtDate(p.date)}">${fmtDate(p.date)}</time><span>${p.tags.map(esc).join(' · ')}</span></span>
        </a>
      </li>`).join('');
  return `${head({ title: SITE.title, description: SITE.description, url: SITE.url + '/' })}
<body class="page-home">
${header('home')}
<main id="main">
  <section class="hero" aria-labelledby="hero-h" data-enter>
    <div class="hero__text">
      <p class="kicker"><span class="kicker__tag">Writing</span><span>Machine learning, mostly</span></p>
      <h1 id="hero-h" class="hero__title">Notes on how models learn, and how to make them run anywhere.</h1>
      <p class="hero__lead">I'm Surya. I write long-form, interactive notes on transformers, learning theory and machine learning for audio, with the math, the code and a demo you can poke at in each one.</p>
      <p class="hero__actions"><a class="btn" href="#writing">Read the latest</a><a class="link" href="${SITE.github}">GitHub</a></p>
    </div>
    <figure class="hero__field" aria-label="An animated causal attention matrix drawn as a pixel grid">
      <canvas class="field" data-field width="640" height="480" aria-hidden="true"></canvas>
      <figcaption class="field__bar"><span class="field__label">attention · 28 tokens · live</span><button class="field__pause" type="button" aria-pressed="false">Pause</button></figcaption>
    </figure>
  </section>

  <section class="section" id="writing" aria-labelledby="writing-h">
    <header class="section__head">
      <h2 id="writing-h" class="section__title">Writing</h2>
      <p class="section__note">${posts.length} posts · newest first</p>
    </header>
    <ol class="index" reversed>${rows}
    </ol>
  </section>

  <section class="section about" id="about" aria-labelledby="about-h">
    <header class="section__head">
      <h2 id="about-h" class="section__title">About</h2>
    </header>
    <div class="about__grid">
      <div class="about__text measure">
        <p>I'm Surya Kant Sahu. I'm impatient with slow programs, so I tend to end up with a pile of second-hand machines, a local network and NCCL, and a job that runs faster than it did yesterday.</p>
        <p>I'm interested in transformers, learning theory, reinforcement learning and machine learning for audio and music. I work mostly in Python and C++, with PyTorch, ONNX, Numba and Cython.</p>
      </div>
      <dl class="facts">
        <div><dt>Paper</dt><dd>On the Connection of Benford's Law and Neural Networks (2021), with A. Java and A. Shaikh</dd></div>
        <div><dt>Code</dt><dd><a class="link" href="${SITE.github}">github.com/ojus1</a></dd></div>
        <div><dt>Feed</dt><dd><a class="link" href="/feed.xml">RSS</a></dd></div>
      </dl>
    </div>
  </section>
</main>
${footer()}
<script src="/assets/js/field.js" defer></script>
</body>
</html>
`;
}

function notFound() {
  return `${head({ title: 'Page not found', description: 'This page does not exist.', url: SITE.url + '/404.html' })}
<body class="page-404">
${header('')}
<main id="main" class="missing">
  <p class="kicker"><span class="kicker__tag">404</span><span>Not found</span></p>
  <h1 class="missing__title">This page isn't here.</h1>
  <p class="missing__lead">It may have moved when the site was rebuilt. The writing index has everything that's current.</p>
  <p><a class="btn" href="/#writing">Go to the writing index</a></p>
</main>
${footer()}
</body>
</html>
`;
}

function feed(posts) {
  const items = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${SITE.url}/posts/${p.slug}/</link><guid>${SITE.url}/posts/${p.slug}/</guid><pubDate>${p.date.toUTCString()}</pubDate><description>${esc(p.summary)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(SITE.title)}</title><link>${SITE.url}/</link><description>${esc(SITE.description)}</description>${items}</channel></rss>\n`;
}

// ---------- run ----------
await vendor();
const dir = r('content/posts');
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md'));
const posts = [];
for (const f of files) {
  const { data, content } = matter(await fs.readFile(path.join(dir, f), 'utf8'));
  const html = md.render(content);
  const words = content.replace(/<[^>]+>/g, ' ').split(/\s+/).length;
  posts.push({ ...data, slug: f.replace(/\.md$/, ''), date: new Date(data.date), html, toc: toc(html), minutes: Math.max(1, Math.round(words / 230)), math: /class="katex/.test(html) });
}
posts.sort((a, b) => b.date - a.date);
await fs.rm(r('posts'), { recursive: true, force: true });
for (let i = 0; i < posts.length; i++) await write(r('posts', posts[i].slug, 'index.html'), postPage(posts[i], posts[i + 1], posts[i - 1]));
await write(r('index.html'), homePage(posts));
await write(r('404.html'), notFound());
await write(r('feed.xml'), feed(posts));
await write(r('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE.url}/</loc></url>${posts.map((p) => `<url><loc>${SITE.url}/posts/${p.slug}/</loc><lastmod>${fmtDate(p.date)}</lastmod></url>`).join('')}</urlset>\n`);
await write(r('.nojekyll'), '');
console.log(`built ${posts.length} posts`);
