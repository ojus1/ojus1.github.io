# ojus1.github.io

Source and build output for [ojus1.github.io](https://ojus1.github.io). A small Node build turns Markdown posts into static pages; GitHub Pages serves the committed output from the repository root.

## Writing a post

Add `content/posts/<slug>.md`:

```markdown
---
title: A post title
date: 2026-11-11
summary: One sentence for the index, the feed and the post's dek.
tags: [transformers]
draft: true          # shows "Placeholder post" in the kicker
d3: true             # load d3 for charts
scripts: [chart]     # widgets from assets/js/widgets/
modules: []          # ES modules, e.g. /assets/js/llm/llm-client.js
---
```

Markdown supports `$inline$` and `$$display$$` KaTeX, footnotes (shown as margin notes on wide screens), and fenced code with an optional `title="file.py"`. Raw HTML is allowed for figures; see the existing posts for the widget markup.

## Build

```bash
npm ci
npm run build     # writes index.html, posts/, feed.xml, sitemap.xml, vendored assets
npm run serve     # http://localhost:8080
```

Commit the build output along with the source, since Pages serves the repository as is.

## Layout

- `scripts/build.mjs`: Markdown, KaTeX, Shiki, TOC, templates, feed, vendoring
- `assets/css/site.css`: the whole design system (paper and dark themes)
- `assets/js/site.js`: theme toggle, copy buttons, margin notes, contents highlighting
- `assets/js/field.js`: the home page attention matrix
- `assets/js/widgets/`: post widgets (charts, LoRA heatmaps, attention, gradient descent)
- `src/llm-*.js`: Transformers.js (pinned, from jsDelivr) chat client and worker (WebGPU with a CPU fallback), bundled by esbuild into `assets/js/llm/`
