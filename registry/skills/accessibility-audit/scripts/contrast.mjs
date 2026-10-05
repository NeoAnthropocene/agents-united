#!/usr/bin/env node
// WCAG 2.x contrast ratio of two sRGB colours, with the four verdicts.
// Usage: node contrast.mjs <foreground hex> <background hex> [--large] [--level AA|AAA]
// Exit code: 0 when the chosen requirement passes, 1 when it fails, 2 for a usage error.
// The ratio is (L1 + 0.05) / (L2 + 0.05) with L the relative luminance; the verdicts compare the unrounded ratio.
// It measures two flat colours: text over an image or a gradient needs a scrim and the worst region measured.
import { pathToFileURL } from 'node:url';

export function parseHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!m) throw new Error(`not a hex colour: ${value} (use #RGB or #RRGGBB)`);
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const THRESHOLDS = { AA: { normal: 4.5, large: 3 }, AAA: { normal: 7, large: 4.5 } };

function usage() {
  console.error('usage: node contrast.mjs <foreground hex> <background hex> [--large] [--level AA|AAA]');
  process.exit(2);
}

function main(argv) {
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--level');
  const li = argv.indexOf('--level');
  const level = li === -1 ? 'AA' : argv[li + 1];
  const large = argv.includes('--large');
  if (positional.length !== 2 || !THRESHOLDS[level]) usage();
  let ratio;
  try {
    ratio = contrastRatio(positional[0], positional[1]);
  } catch (e) {
    console.error(`${e.message}`);
    usage();
  }
  const row = (label, min) => `${label} (${min}):`.padEnd(36) + (ratio >= min ? 'pass' : 'fail');
  console.log(`${ratio.toFixed(2)}:1  (${positional[0]} on ${positional[1]})`);
  console.log(row('AA normal text', 4.5));
  console.log(row('AA large text and interface', 3));
  console.log(row('AAA normal text', 7));
  console.log(row('AAA large text', 4.5));
  const need = THRESHOLDS[level][large ? 'large' : 'normal'];
  const ok = ratio >= need;
  if (!ok && ratio.toFixed(2) === need.toFixed(2)) console.log(`note: the ratio rounds to ${need.toFixed(2)} but is below it; the verdict uses the unrounded value`);
  console.log(`verdict for ${level} ${large ? 'large text' : 'normal text'}: ${ok ? 'pass' : 'fail'} (needs ${need})`);
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
