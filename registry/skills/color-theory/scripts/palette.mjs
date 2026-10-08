// Tonal scale and harmony of a seed colour, built in OKLCH (equal lightness steps, in-gamut chroma), with each step's contrast on white and on black.
// Usage: node palette.mjs <seed hex> [--harmony complementary|split|triadic|analogous|tetradic] [--json]
//        node palette.mjs --families        prints the hue-family table of references/hue-families.md
// Exit code: 0 when it printed, 2 for a usage error. The seed is never changed: the scale is built around it and the nearest step is named.
// OKLab: Bjorn Ottosson's matrices (public domain). Contrast: WCAG 2.x relative luminance, compared unrounded.
import { pathToFileURL } from 'node:url';

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
/** Target OKLCH lightness per step: nearly equal 0.08 steps in the middle, finer at the light end. */
export const LIGHTNESS = { 50: 0.97, 100: 0.93, 200: 0.87, 300: 0.79, 400: 0.70, 500: 0.62, 600: 0.54, 700: 0.46, 800: 0.38, 900: 0.30, 950: 0.22 };
/** The share of the in-gamut chroma each step keeps: light tints and deep shades are quieter than the middle, as in every working UI scale. */
export const TAPER = { 50: 0.55, 100: 0.6, 200: 0.62, 300: 0.75, 400: 0.9, 500: 1, 600: 1, 700: 0.95, 800: 0.85, 900: 0.72, 950: 0.58 };
export const SCHEMES = {
  complementary: [180],
  split: [150, 210],
  triadic: [120, 240],
  analogous: [-30, 30],
  tetradic: [90, 180, 270],
};
/** Hue anchors (OKLCH hue angle, relative saturation) for references/hue-families.md. */
export const FAMILIES = [
  { name: 'red', h: 27, s: 0.9 }, { name: 'orange', h: 55, s: 0.9 }, { name: 'amber', h: 80, s: 0.9 }, { name: 'yellow', h: 100, s: 0.9 },
  { name: 'lime', h: 125, s: 0.9 }, { name: 'green', h: 150, s: 0.9 }, { name: 'teal', h: 185, s: 0.9 }, { name: 'cyan', h: 215, s: 0.9 },
  { name: 'blue', h: 260, s: 0.9 }, { name: 'indigo', h: 280, s: 0.9 }, { name: 'violet', h: 300, s: 0.9 }, { name: 'magenta', h: 330, s: 0.9 },
  { name: 'pink', h: 355, s: 0.9 }, { name: 'warm neutral', h: 60, s: 0.1 }, { name: 'cool neutral', h: 250, s: 0.1 },
];

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function parseHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!m) throw new Error(`not a hex colour: ${value} (use #RGB or #RRGGBB)`);
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export function toHex(linear) {
  return '#' + linear.map(c => Math.round(Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, c))))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

/** `{ L, C, h }` of a hex colour; h is 0 for a grey. */
export function hexToOklch(hex) {
  const [L, a, b] = linearToOklab(parseHex(hex).map(v => toLinear(v / 255)));
  const C = Math.hypot(a, b);
  const h = C < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
}

function oklchToLinear(L, C, h) {
  const r = (h * Math.PI) / 180;
  return oklabToLinear([L, C * Math.cos(r), C * Math.sin(r)]);
}

const inGamut = linear => linear.every(c => c >= -1e-6 && c <= 1 + 1e-6);

/** The largest chroma that stays inside sRGB at this lightness and hue. */
export function maxChroma(L, h) {
  if (L <= 0 || L >= 1) return 0;
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear(L, mid, h))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** A hex colour at this lightness and hue, with the share `s` (0 to 1) of the largest in-gamut chroma. */
export function oklchToHex(L, h, s) {
  return toHex(oklchToLinear(L, s * maxChroma(L, h), h));
}

export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map(v => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The share of the largest in-gamut chroma that the seed uses (0 for a grey). */
export function relativeSaturation(seed) {
  const { L, C, h } = hexToOklch(seed);
  const max = maxChroma(L, h);
  return max === 0 ? 0 : Math.min(1, C / max);
}

export function buildScale(seed) {
  const { L: seedL, h } = hexToOklch(seed);
  const s = relativeSaturation(seed);
  const scale = STEPS.map(step => {
    const L = LIGHTNESS[step];
    const hex = oklchToHex(L, h, s * TAPER[step]);
    const o = hexToOklch(hex);
    return { step, hex, L: Number(o.L.toFixed(3)), C: Number(o.C.toFixed(3)), onWhite: Number(contrastRatio(hex, '#FFFFFF').toFixed(2)), onBlack: Number(contrastRatio(hex, '#000000').toFixed(2)) };
  });
  const nearest = STEPS.reduce((best, step) => (Math.abs(LIGHTNESS[step] - seedL) < Math.abs(LIGHTNESS[best] - seedL) ? step : best), STEPS[0]);
  return { scale, nearest };
}

export function harmony(seed, scheme) {
  const offsets = SCHEMES[scheme];
  if (!offsets) throw new Error(`unknown scheme: ${scheme} (use ${Object.keys(SCHEMES).join(', ')})`);
  const { L, h } = hexToOklch(seed);
  const s = relativeSaturation(seed);
  return offsets.map(offset => {
    const hue = (h + offset + 360) % 360;
    return { offset, hue: Number(hue.toFixed(1)), hex: oklchToHex(L, hue, s) };
  });
}

export function familiesTable() {
  const rows = FAMILIES.map(f => `| ${f.name} (h ${f.h}) | ${STEPS.map(step => oklchToHex(LIGHTNESS[step], f.h, f.s * TAPER[step])).join(' | ')} |`);
  return [`| Family | ${STEPS.join(' | ')} |`, `|---|${STEPS.map(() => '---').join('|')}|`, ...rows].join('\n');
}

function usage() {
  console.error(`usage: node palette.mjs <seed hex> [--harmony ${Object.keys(SCHEMES).join('|')}] [--json]\n       node palette.mjs --families`);
  process.exit(2);
}

function main(argv) {
  if (argv.includes('--families')) {
    console.log(familiesTable());
    return;
  }
  const hi = argv.indexOf('--harmony');
  const scheme = hi === -1 ? undefined : argv[hi + 1];
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--harmony');
  if (positional.length !== 1 || (hi !== -1 && !SCHEMES[scheme])) usage();
  const seed = positional[0];
  let o;
  try {
    o = hexToOklch(seed);
  } catch (e) {
    console.error(e.message);
    usage();
  }
  const sat = relativeSaturation(seed);
  const head = { hex: seed.toUpperCase().startsWith('#') ? seed.toUpperCase() : `#${seed.toUpperCase()}`, L: Number(o.L.toFixed(3)), C: Number(o.C.toFixed(3)), h: Number(o.h.toFixed(1)), relativeSaturation: Number(sat.toFixed(2)) };
  const out = scheme ? { seed: head, scheme, harmony: harmony(seed, scheme) } : { seed: head, ...buildScale(seed) };
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  console.log(`seed ${head.hex}  oklch(${head.L} ${head.C} ${head.h})  relative saturation ${head.relativeSaturation}`);
  if (scheme) {
    for (const x of out.harmony) console.log(`${scheme} ${x.offset > 0 ? '+' : ''}${x.offset}°  hue ${x.hue}  ${x.hex}`);
    return;
  }
  console.log('step   L      C      hex      on white  on black');
  for (const x of out.scale) console.log(`${String(x.step).padEnd(5)}  ${x.L.toFixed(3)}  ${x.C.toFixed(3)}  ${x.hex}  ${String(x.onWhite.toFixed(2)).padEnd(8)}  ${x.onBlack.toFixed(2)}`);
  console.log(`nearest step to the seed: ${out.nearest} (the seed itself is kept as given)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
