// Brand drift scan: colours and first fonts that are not the tokens', and visible strings that are not the copy's.
// Usage: node audit-assets.mjs <tokens.json> <folder> [--copy <file>] [--allow <text>]... [--json]
// Exit code: 0 when nothing drifts, 1 when something does, 2 for a usage error.
// It reads the SVG, HTML, CSS and script files under the folder (not node_modules or .git) and reports; it never edits.
// It does not see colours inside raster images, values built at run time, or what a person must judge by eye (logo use, imagery, layout).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXT = new Set(['.svg', '.html', '.htm', '.css', '.scss', '.less', '.js', '.mjs', '.jsx', '.ts', '.tsx', '.vue']);
const MARKUP = new Set(['.svg', '.html', '.htm', '.jsx', '.tsx', '.vue']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
const NAMED = {
  white: '#FFFFFF', black: '#000000', red: '#FF0000', green: '#008000', blue: '#0000FF', gray: '#808080', grey: '#808080', orange: '#FFA500',
  yellow: '#FFFF00', purple: '#800080', pink: '#FFC0CB', brown: '#A52A2A', silver: '#C0C0C0', gold: '#FFD700', navy: '#000080', teal: '#008080',
  cyan: '#00FFFF', aqua: '#00FFFF', magenta: '#FF00FF', fuchsia: '#FF00FF', lime: '#00FF00', maroon: '#800000', olive: '#808000',
};
const PROP = '(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|stop-color|caret-color|text-decoration-color|box-shadow|text-shadow)';
const DECL = new RegExp(`(?<![\\w-])${PROP}\\s*[:=]\\s*(?:"([^"]*)"|'([^']*)'|([^;{}"']*))`, 'gi');
const NAMED_WORD = new RegExp(`\\b(${Object.keys(NAMED).join('|')})\\b`, 'gi');
const HEX = /(?<![&\w])#([0-9a-fA-F]{3,8})(?![0-9a-zA-Z_-])/g;
const RGB = /rgba?\(\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/gi;
const HSL = /hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/gi;
const FONT = /(?<![\w-])font-family\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([^;{}]*))/gi;
const TEXT_NODE = /(?<=>)([^<>{}]*[A-Za-z][^<>{}]*)(?=<)/g;

const hex2 = n => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0').toUpperCase();

export function rgbToHex(r, g, b) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export function hslToHex(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.min(5, Math.floor(hp))];
  const m = light - c / 2;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA` to `{ hex, alpha }` (alpha 1 when absent); undefined for any other length. */
function expandHex(digits) {
  if (![3, 4, 6, 8].includes(digits.length)) return undefined;
  const full = digits.length <= 4 ? [...digits].map(c => c + c).join('') : digits;
  const alpha = full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1;
  return { hex: `#${full.slice(0, 6).toUpperCase()}`, alpha };
}

function walkTokens(node, trail, out) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.$value === 'string') {
    const name = trail.join('.');
    const v = node.$value.trim();
    const m = /^#([0-9a-fA-F]{3,8})$/.exec(v);
    if (m && expandHex(m[1])) out.colours.set(expandHex(m[1]).hex, name);
    if (node.$type === 'fontFamily') {
      const first = v.split(',')[0].replace(/["']/g, '').trim();
      out.fonts.add(first.toLowerCase());
      out.fontLabels.push(first);
    }
    return;
  }
  for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walkTokens(v, [...trail, k], out);
}

export function loadTokens(file) {
  const out = { colours: new Map(), fonts: new Set(), fontLabels: [] };
  walkTokens(JSON.parse(fs.readFileSync(file, 'utf8')), [], out);
  return out;
}

function nearest(hex, colours) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = rgb(hex);
  let best;
  for (const [h, name] of colours) {
    const b = rgb(h);
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (!best || d < best.d) best = { name, hex: h, d };
  }
  return best && { name: best.name, hex: best.hex };
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : listFiles(p, base);
    return EXT.has(path.extname(e.name).toLowerCase()) ? [path.relative(base, p).split(path.sep).join('/')] : [];
  }).sort();
}

export function audit({ tokensFile, folder, copyFile, allow = [] }) {
  const tokens = loadTokens(tokensFile);
  const copyText = copyFile ? fs.readFileSync(copyFile, 'utf8') : undefined;
  const findings = [];
  const alpha = [];
  const checked = { colours: 0, fonts: 0, strings: 0 };
  const files = listFiles(folder);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const lines = fs.readFileSync(path.join(folder, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
    let skipBlock = false;
    lines.forEach((line, i) => {
      const at = i + 1;
      const found = [];
      const colour = (hex, written, a, index) => found.push({ index, hex, written, alpha: a });
      for (const m of line.matchAll(HEX)) {
        const before = line.slice(Math.max(0, m.index - 16), m.index);
        if (/(?:href|id|for|name|class|src|data-[\w-]+)\s*=\s*["']?$/i.test(before) || /url\(\s*["']?$/i.test(before)) continue;
        const e = expandHex(m[1]);
        if (e) colour(e.hex, m[0], e.alpha, m.index);
      }
      for (const m of line.matchAll(RGB)) {
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        colour(rgbToHex(+m[1], +m[2], +m[3]), m[0], a, m.index);
      }
      for (const m of line.matchAll(HSL)) {
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        colour(hslToHex(+m[1], +m[2], +m[3]), m[0], a, m.index);
      }
      for (const d of line.matchAll(DECL)) {
        const value = d[1] ?? d[2] ?? d[3] ?? '';
        for (const w of value.matchAll(NAMED_WORD)) colour(NAMED[w[1].toLowerCase()], w[1], 1, d.index + d[0].indexOf(w[0]));
      }
      for (const c of found.sort((a, b) => a.index - b.index)) {
        checked.colours += 1;
        if (tokens.colours.has(c.hex)) {
          if (c.alpha < 1) alpha.push({ file, line: at, hex: c.hex });
        } else {
          const f = { file, line: at, type: 'colour', value: c.hex, nearest: nearest(c.hex, tokens.colours) };
          if (c.written.toLowerCase() !== c.hex.toLowerCase()) f.written = c.written;
          findings.push(f);
        }
      }
      for (const m of line.matchAll(FONT)) {
        const first = (m[1] ?? m[2] ?? m[3] ?? '').split(',')[0].replace(/["']/g, '').trim();
        if (first === '' || /^(inherit|initial|unset|var\(.*)$/i.test(first)) continue;
        checked.fonts += 1;
        if (tokens.fonts.size > 0 && !tokens.fonts.has(first.toLowerCase())) findings.push({ file, line: at, type: 'font', value: first, tokenFonts: [...tokens.fonts] });
      }
      if (/<(style|script)\b/i.test(line) && !/<\/(style|script)>/i.test(line)) skipBlock = true;
      if (/<\/(style|script)>/i.test(line)) skipBlock = false;
      if (copyText !== undefined && MARKUP.has(ext) && !skipBlock) {
        for (const m of line.matchAll(TEXT_NODE)) {
          const text = m[1].trim();
          if ((text.match(/[A-Za-z]/g) ?? []).length < 2) continue;
          checked.strings += 1;
          if (!copyText.includes(text) && !allow.some(a => text.includes(a))) findings.push({ file, line: at, type: 'copy', value: text });
        }
      }
    });
  }
  return { scanned: files, checked, findings, alpha };
}

function usage(message) {
  if (message) console.error(message);
  console.error('usage: node audit-assets.mjs <tokens.json> <folder> [--copy <file>] [--allow <text>]... [--json]');
  process.exit(2);
}

function main(argv) {
  const positional = [];
  const allow = [];
  let copyFile;
  let asJson = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') asJson = true;
    else if (a === '--copy') copyFile = argv[++i];
    else if (a === '--allow') allow.push(argv[++i]);
    else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2 || (argv.includes('--copy') && !copyFile)) usage();
  const [tokensFile, folder] = positional;
  let report;
  try {
    if (!fs.statSync(folder).isDirectory()) throw new Error(`${folder} is not a folder`);
    report = audit({ tokensFile, folder, copyFile, allow });
  } catch (e) {
    usage(`cannot read: ${e.message}`);
  }
  const code = report.findings.length > 0 ? 1 : 0;
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(code);
  }
  const tokens = loadTokens(tokensFile);
  const firstFont = tokens.fontLabels[0] ?? 'none';
  for (const f of report.findings) {
    const where = `${f.file}:${f.line}`.padEnd(18);
    if (f.type === 'colour') console.log(`${where}colour  ${f.value}${f.written ? ` (${f.written})` : ''}  not a token${f.nearest ? `; nearest ${f.nearest.name} ${f.nearest.hex}` : ''}`);
    else if (f.type === 'font') console.log(`${where}font  ${f.value}  not a token font; the tokens' first font is ${firstFont}`);
    else console.log(`${where}copy  ${f.value}  not in the copy file`);
  }
  const by = t => report.findings.filter(f => f.type === t).length;
  const kinds = ['colour', 'font', 'copy'].filter(t => by(t) > 0).map(t => `${t} ${by(t)}`).join(', ');
  console.log(`scanned ${report.scanned.length} files: ${report.checked.colours} colours, ${report.checked.fonts} fonts and ${report.checked.strings} strings checked; ${report.findings.length} findings${kinds ? ` (${kinds})` : ''}`);
  if (report.alpha.length > 0) console.log(`info: ${report.alpha.length} token colour${report.alpha.length === 1 ? '' : 's'} used with alpha (${report.alpha.map(a => `${a.file}:${a.line}`).join(', ')}); the ratio is measured on the composite, not on the token`);
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
