// Scratch: render the designer's SVGs with playwright-core and count text-fit defects by the H10f rule.
// A defect is: a text box with any part outside the canvas; two text boxes that overlap by more than 2 px in both axes;
// a text box (outside the button) that overlaps the button by more than 2 px; a button label whose box leaves its button.
// Boxes are getBBox() boxes in canvas units. Usage: node measure-defects.mjs <pwtools-dir> <out-dir> <svg-dir> [<svg-dir> ...]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [toolsDir, outDir, ...dirs] = process.argv.slice(2);
const require = createRequire(path.join(toolsDir, 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(outDir, { recursive: true });
const TOL = 2;

const browser = await chromium.launch();
const results = [];
for (const dir of dirs) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.svg')).sort()) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(src);
    const W = Number(vb[1]), H = Number(vb[2]);
    const page = await browser.newPage({ viewport: { width: Math.ceil(W), height: Math.ceil(H) } });
    await page.goto(pathToFileURL(path.join(dir, file)).href);
    const info = await page.evaluate(() => {
      const svg = document.documentElement;
      const box = (el) => {
        const b = el.getBBox(); const m = el.getCTM(); const rm = svg.getCTM ? svg.getCTM() : null;
        const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
        return { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) };
      };
      const texts = [...svg.querySelectorAll('text')].map(t => ({ text: t.textContent.trim(), size: Number(getComputedStyle(t).fontSize.replace('px', '')), ...box(t) }));
      const rects = [...svg.querySelectorAll('rect')].map(r => ({ fill: (r.getAttribute('fill') || '').toUpperCase(), ...box(r) }));
      return { texts, rects };
    });
    const canvasArea = W * H;
    const buttons = info.rects.filter(r => r.fill === '#B5451B' && (r.x1 - r.x0) >= 40 && (r.x1 - r.x0) * (r.y1 - r.y0) < 0.4 * canvasArea);
    const inside = (t, r) => t.x0 >= r.x0 - TOL && t.x1 <= r.x1 + TOL && t.y0 >= r.y0 - TOL && t.y1 <= r.y1 + TOL;
    const centre = (t) => [(t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2];
    const inBtn = (t, r) => { const [cx, cy] = centre(t); return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1; };
    const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > TOL && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > TOL;
    const defects = [];
    info.texts.forEach((t, i) => {
      if (!t.text) return;
      if (t.x0 < -0.5 || t.y0 < -0.5 || t.x1 > W + 0.5 || t.y1 > H + 0.5) defects.push({ kind: 'outside-canvas', text: t.text, box: [Math.round(t.x0), Math.round(t.y0), Math.round(t.x1), Math.round(t.y1)] });
      const btn = buttons.find(b => inBtn(t, b));
      if (btn && !inside(t, btn)) defects.push({ kind: 'label-leaves-button', text: t.text, box: [Math.round(t.x0), Math.round(t.y0), Math.round(t.x1), Math.round(t.y1)] });
      if (!btn) for (const b of buttons) if (overlap(t, b)) defects.push({ kind: 'text-overlaps-button', text: t.text });
      info.texts.forEach((u, j) => { if (j > i && u.text && overlap(t, u)) defects.push({ kind: 'text-overlaps-text', a: t.text, b: u.text }); });
    });
    const png = path.join(outDir, path.basename(dir.replace(/[\\/]docs[\\/]pilot[\\/]creative$/, '')) + '__' + file.replace('.svg', '.png'));
    await page.screenshot({ path: png, type: 'png' });
    results.push({ run: path.basename(dir.replace(/[\\/]docs[\\/]pilot[\\/]creative$/, '')), file, canvas: `${W}x${H}`, texts: info.texts.length, buttons: buttons.length, minFont: Math.min(...info.texts.map(t => t.size)), defects });
    await page.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'defects.json'), JSON.stringify(results, null, 1));
for (const r of results) console.log(`${r.run.padEnd(16)} ${r.file.padEnd(46)} ${r.canvas.padEnd(10)} texts=${r.texts} buttons=${r.buttons} minFont=${r.minFont} defects=${r.defects.length}${r.defects.length ? ' ' + JSON.stringify(r.defects).slice(0, 260) : ''}`);
