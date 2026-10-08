// Plan 036 probe P3: the contrast ratios of the colour pairs the designer used (H10h) or tabulated (H10i), computed
// with the WCAG 2.x formula from the hex values of the PetPal tokens, against the figures she gave (null: none given).
// Usage: node contrast-check.mjs
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

const PAIRS = [
  // [where, foreground, background, the figure she gave]
  ['H10h  text on the cream ground (feed, story, link ad)', '#2B1D14', '#FFF8F0', null],
  ['H10h  label on the clay button', '#FFFFFF', '#B5451B', null],
  ['H10h  muted rating line on cream (link ad)', '#6B4B35', '#FFF8F0', null],
  ['H10h  text on the sand panel', '#2B1D14', '#F3D9B1', null],
  ['H10i  text-default on surface-base', '#2B1D14', '#FFF8F0', 15.5],
  ['H10i  text-default on surface-accent', '#2B1D14', '#F3D9B1', 11.9],
  ['H10i  text-muted on surface-base', '#6B4B35', '#FFF8F0', 7.4],
  ['H10i  text-muted on surface-accent', '#6B4B35', '#F3D9B1', 5.7],
  ['H10i  text-on-action on cta-primary', '#FFFFFF', '#B5451B', 5.5],
  ['H10i  text-muted on cta-primary', '#6B4B35', '#B5451B', 1.4],
  ['H10i  text-default on cta-primary', '#2B1D14', '#B5451B', 3.0],
];
let wrong = 0;
for (const [where, fg, bg, claimed] of PAIRS) {
  const r = ratio(fg, bg);
  const note = claimed === null ? '' : Math.abs(Number(r.toFixed(1)) - claimed) < 0.05 ? `  she says ${claimed}: right to one decimal` : `  she says ${claimed}: WRONG`;
  if (note.includes('WRONG')) wrong += 1;
  console.log(`${where.padEnd(56)} ${fg} on ${bg}  ${r.toFixed(2)} : 1${note}`);
}
console.log(`figures she gave that are wrong to one decimal: ${wrong}`);
