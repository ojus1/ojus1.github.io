// Generates the site logo (sun arc over joined hands) as SVG, and renders PNG/ICO exports.
//   node scripts/logo.mjs           -> writes SVGs + PNGs into assets/logo and the favicon set into assets/
// PNG rendering uses Playwright's Chromium (preinstalled in the dev container) and ImageMagick for the .ico.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(root, 'assets', ...p);

export const COLORS = {
  sun: '#e08a2b', // warm saffron, from the reference
  sunDark: '#f0993a', // a touch brighter on near-black
  ink: '#262320',
  inkDark: '#f1eee8',
  paper: '#fbf6ec',
  night: '#0b0b0a',
};

// ---- geometry (design grid: centre x = 160) ----
const CX = 160, CY = 168;
const R_IN = 80, R_OUT = 99, R_TIP = 140;
const f = (n) => +n.toFixed(2);
const pt = (deg, r) => [f(CX + r * Math.cos((deg * Math.PI) / 180)), f(CY - r * Math.sin((deg * Math.PI) / 180))];

function sunPath() {
  const a0 = -17, a1 = 197; // arc dips a little below the horizon on both sides
  const [ox0, oy0] = pt(a0, R_OUT), [ox1, oy1] = pt(a1, R_OUT);
  const [ix1, iy1] = pt(a1, R_IN), [ix0, iy0] = pt(a0, R_IN);
  let d = `M${ox0} ${oy0}A${R_OUT} ${R_OUT} 0 1 0 ${ox1} ${oy1}L${ix1} ${iy1}A${R_IN} ${R_IN} 0 1 1 ${ix0} ${iy0}Z`;
  const rays = [180, 150, 120, 90, 60, 30, 0];
  for (const a of rays) {
    const half = 11.5;
    const len = a === 90 ? R_TIP + 2 : a % 180 === 0 ? R_TIP - 6 : R_TIP;
    const [bx0, by0] = pt(a - half, R_OUT - 3), [bx1, by1] = pt(a + half, R_OUT - 3), [tx, ty] = pt(a, len);
    d += `M${bx0} ${by0}L${tx} ${ty}L${bx1} ${by1}Z`;
  }
  return d;
}

// right hand; the left one is its mirror across x = CX
const HAND = 'M163.2 214V134.5C163.2 127.6 165.6 123.6 169.7 123.6C173.8 123.6 176.2 127.3 177 133.6C179.5 182 206 206 272 221.6C232 228.6 190 228.4 163.2 214Z';

const VIEW = { box: [10, 18, 300, 216], square: [10, -16, 300, 300] };

export function logoSvg({ variant = 'light', view = 'box', bg = false, title = true } = {}) {
  const [x, y, w, h] = VIEW[view];
  let style, sun, ink;
  if (variant === 'adaptive') {
    style = `<style>.s{fill:${COLORS.sun}}.h{fill:${COLORS.ink}}@media(prefers-color-scheme:dark){.s{fill:${COLORS.sunDark}}.h{fill:${COLORS.inkDark}}}</style>`;
    sun = 'class="s"'; ink = 'class="h"';
  } else {
    const dark = variant === 'dark';
    style = '';
    sun = `fill="${dark ? COLORS.sunDark : COLORS.sun}"`;
    ink = `fill="${dark ? COLORS.inkDark : COLORS.ink}"`;
  }
  const bgRect = bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${variant === 'dark' ? COLORS.night : COLORS.paper}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${title ? '<title>Surya Kant Sahu</title>' : ''}${style}${bgRect}<path ${sun} d="${sunPath()}"/><g ${ink}><path d="${HAND}"/><path transform="matrix(-1 0 0 1 ${2 * CX} 0)" d="${HAND}"/></g></svg>\n`;
}

// Inline version for the masthead: colours come from CSS (currentColor + --logo-sun).
export function inlineLogo(cls = 'wordmark__mark') {
  const [x, y, w, h] = VIEW.box;
  return `<svg class="${cls}" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true" focusable="false"><path fill="var(--logo-sun)" d="${sunPath()}"/><g fill="currentColor"><path d="${HAND}"/><path transform="matrix(-1 0 0 1 ${2 * CX} 0)" d="${HAND}"/></g></svg>`;
}

async function render(svg, file, size) {
  const { chromium } = createRequire(import.meta.url)('playwright'); // CJS lookup honours NODE_PATH
  const browser = (render.browser ??= await chromium.launch());
  const [w, h] = size;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const b64 = Buffer.from(svg).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${b64}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
  await page.waitForFunction(() => document.images[0].complete);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await fs.mkdir(out('logo'), { recursive: true });
  const files = {
    'logo.svg': logoSvg({ variant: 'light' }),
    'logo-dark.svg': logoSvg({ variant: 'dark' }),
    'logo-adaptive.svg': logoSvg({ variant: 'adaptive' }),
    'logo-square.svg': logoSvg({ variant: 'light', view: 'square' }),
    'logo-square-dark.svg': logoSvg({ variant: 'dark', view: 'square' }),
    'logo-paper.svg': logoSvg({ variant: 'light', view: 'square', bg: true }),
    'logo-night.svg': logoSvg({ variant: 'dark', view: 'square', bg: true }),
  };
  for (const [n, s] of Object.entries(files)) await fs.writeFile(out('logo', n), s);
  await fs.writeFile(out('favicon.svg'), logoSvg({ variant: 'adaptive', view: 'square', title: false }));

  const ratio = VIEW.box[3] / VIEW.box[2];
  // wide (tight-cropped) marks, transparent
  for (const w of [64, 128, 256, 512, 1024, 2048]) {
    const h = Math.round(w * ratio);
    await render(files['logo.svg'], out('logo', `logo-${w}w.png`), [w, h]);
    await render(files['logo-dark.svg'], out('logo', `logo-dark-${w}w.png`), [w, h]);
  }
  // square icons: transparent, and on paper / night backgrounds
  for (const s of [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024]) {
    await render(files['logo-square.svg'], out('logo', `logo-square-${s}.png`), [s, s]);
    await render(files['logo-square-dark.svg'], out('logo', `logo-square-dark-${s}.png`), [s, s]);
    await render(files['logo-paper.svg'], out('logo', `logo-paper-${s}.png`), [s, s]);
    await render(files['logo-night.svg'], out('logo', `logo-night-${s}.png`), [s, s]);
  }
  await render.browser?.close();

  // favicon / touch icons at the asset root
  await fs.copyFile(out('logo', 'logo-paper-180.png'), out('apple-touch-icon.png'));
  await fs.copyFile(out('logo', 'logo-paper-192.png'), out('icon-192.png'));
  await fs.copyFile(out('logo', 'logo-paper-512.png'), out('icon-512.png'));
  execFileSync('convert', [16, 32, 48].map((s) => out('logo', `logo-square-${s}.png`)).concat(out('favicon.ico')));
  console.log('logo assets written');
}
