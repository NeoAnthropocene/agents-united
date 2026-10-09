// Plan 036 Sitting K (H10h and H10i re-runs): the contrast ratios of the pairs the designer used or tabulated, computed with the WCAG 2.x
// formula from the hex values of the PetPal tokens, against the figures she gave. Usage: node contrast-k.mjs
const lin = c => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

const COCOA_900 = '#2B1D14';
const COCOA_600 = '#6B4B35';
const CLAY_600 = '#B5451B';
const CREAM_50 = '#FFF8F0';
const SAND_300 = '#F3D9B1';
const WHITE = '#FFFFFF';

const PAIRS = [
  // [run, pair, foreground, background, the figure she gave]
  ['H10h', 'cocoa 900 on cream', COCOA_900, CREAM_50, 15.5],
  ['H10h', 'cocoa 600 on cream', COCOA_600, CREAM_50, 7.4],
  ['H10h', 'cocoa 600 on sand', COCOA_600, SAND_300, 5.7],
  ['H10h', 'white on clay', WHITE, CLAY_600, 5.5],
  ['H10h', 'cocoa 900 on sand', COCOA_900, SAND_300, 11.9],
  ['H10i', 'text-default on surface-base', COCOA_900, CREAM_50, 15.5],
  ['H10i', 'text-default on surface-accent', COCOA_900, SAND_300, 11.9],
  ['H10i', 'text-muted on surface-base', COCOA_600, CREAM_50, 7.4],
  ['H10i', 'text-muted on surface-accent', COCOA_600, SAND_300, 5.7],
  ['H10i', 'text-on-action on cta-primary', WHITE, CLAY_600, 5.5],
  ['H10i', 'text-muted on cta-primary', COCOA_600, CLAY_600, 1.4],
];

let wrong = 0;
for (const [run, name, fg, bg, said] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = Math.round(r * 10) / 10 === said;
  if (!ok) wrong += 1;
  console.log(`${run}  ${name.padEnd(32)} ${fg} on ${bg}  computed ${r.toFixed(2)}  she gave ${said.toFixed(1)}  ${ok ? 'right to one decimal' : 'WRONG'}`);
}
console.log(`${PAIRS.length} figures, ${wrong} wrong`);
