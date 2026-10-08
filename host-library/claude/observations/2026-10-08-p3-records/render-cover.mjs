// Plan 036 probe P3 (H10i): renders the designer's published cover (components/Cover/preview.html) at 960 x 288 with a
// tokens.css compiled by the rules of the Design System type's own format.md (a colour or other token becomes --<name>,
// an alias {x} becomes var(--x), a type family becomes --font-<key>), and prints the boxes of the name, the tagline and
// the blocks, so the cover rules (everything but the text right of x = 480, the text zone at most 440 px wide) can be read off.
// Usage: node render-cover.mjs <dir holding playwright-core's package.json> <dir holding the published project files> <out.png>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [toolsDir, projectDir, outPng] = process.argv.slice(2);
const require = createRequire(path.join(toolsDir, 'package.json'));
const { chromium } = require('playwright-core');

const tokens = JSON.parse(fs.readFileSync(path.join(projectDir, 'tokens.json'), 'utf8'));
const val = (v) => (/^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
const decls = [];
for (const t of tokens.color.tokens) decls.push(`--${t.name}: ${val(t.value)};`);
for (const f of ['spacing', 'radius']) for (const t of tokens[f].tokens) decls.push(`--${t.name}: ${t.value};`);
for (const [k, stack] of Object.entries(tokens.type.families)) decls.push(`--font-${k}: ${stack};`);
const css = `:root, [data-theme="${tokens.color.themes[0].id}"] { ${decls.join(' ')} }`;
console.log('tokens.css as compiled:', css);

const html = fs.readFileSync(path.join(projectDir, 'components/Cover/preview.html'), 'utf8').replace('</head>', `<style>${css}</style></head>`);
const tmp = outPng.replace(/\.png$/, '.html');
fs.writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 288 } });
await page.goto(pathToFileURL(tmp).href);
const m = await page.evaluate(() => {
  const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x0: Math.round(b.left), x1: Math.round(b.right), y0: Math.round(b.top), y1: Math.round(b.bottom) }; };
  const rects = [...document.querySelectorAll('svg rect')].map((e) => { const b = e.getBoundingClientRect(); return { cls: e.getAttribute('class'), x0: Math.round(b.left), x1: Math.round(b.right), y0: Math.round(b.top), y1: Math.round(b.bottom), rx: getComputedStyle(e).rx }; });
  return { name: r('.name'), tagline: r('.tag'), rects, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
});
console.log(JSON.stringify(m));
await page.screenshot({ path: outPng, type: 'png' });
await browser.close();
