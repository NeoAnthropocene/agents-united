// Plan 036 probe P3 (H10h): measures the three published artboards of the Design canvas against the placement rules
// of ad-creative-design's references/sizes-and-safe-zones.md. Each board is rendered at its own size and the box of
// every text node (a Range over the text, so the glyph line box, not the button around it) is taken from the browser.
// Rules: feed 1080 x 1350, text clear of the bottom 10 percent (y >= 1215); story 1080 x 1920, no text in the top
// 250 px or the bottom 250 px; link ad 1200 x 628, nothing outside the canvas.
// Usage: node measure-boards.mjs <dir holding playwright-core's package.json> <dir holding the three .dc.html boards>
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [toolsDir, boardsDir] = process.argv.slice(2);
const require = createRequire(path.join(toolsDir, 'package.json'));
const { chromium } = require('playwright-core');

const BOARDS = [
  { file: 'Main.dc.html', w: 1080, h: 1350, rule: 'feed: text clear of the bottom 10 percent (y >= 1215)', breach: (b, w, h) => b.y1 > 0.9 * h },
  { file: 'Story.dc.html', w: 1080, h: 1920, rule: 'story: no text in the top 250 px or the bottom 250 px', breach: (b, w, h) => b.y0 < 250 || b.y1 > h - 250 },
  { file: 'Link.dc.html', w: 1200, h: 628, rule: 'link ad: nothing outside the canvas', breach: (b, w, h) => b.x1 > w || b.y1 > h || b.x0 < 0 || b.y0 < 0 },
];

const browser = await chromium.launch();
for (const { file, w, h, rule, breach } of BOARDS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(pathToFileURL(path.join(boardsDir, file)).href);
  const m = await page.evaluate(() => {
    const root = document.querySelector('x-dc > div');
    const rb = root.getBoundingClientRect();
    const texts = [];
    const walker = document.createTreeWalker(document.querySelector('x-dc'), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent || '').trim();
      if (!text) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const b = r.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      texts.push({ text: text.slice(0, 40), x0: Math.round(b.left), x1: Math.round(b.right), y0: Math.round(b.top), y1: Math.round(b.bottom) });
    }
    return { board: [Math.round(rb.width), Math.round(rb.height)], scroll: [root.scrollWidth, root.scrollHeight], texts };
  });
  const breaches = m.texts.filter((b) => breach(b, w, h));
  console.log(`${file}  board ${m.board[0]}x${m.board[1]}  scroll ${m.scroll[0]}x${m.scroll[1]}  text boxes ${m.texts.length}`);
  for (const t of m.texts) console.log(`  y ${String(t.y0).padStart(4)} - ${String(t.y1).padStart(4)}  x ${String(t.x0).padStart(4)} - ${String(t.x1).padStart(4)}  ${t.text}${breaches.includes(t) ? '   <-- breaks the rule' : ''}`);
  console.log(`  rule, ${rule}: ${breaches.length ? breaches.length + ' text box(es) break it: ' + breaches.map((t) => `"${t.text}" y ${t.y0}-${t.y1}`).join('; ') : 'kept'}`);
  await page.close();
}
await browser.close();
