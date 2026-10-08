import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S16, `brand-consistency-audit`: the skill's one script scans a folder of SVG, HTML, CSS and script files for the values
 * that drift from the tokens (colours, first fonts) and, given the copy file, for visible strings that are not the copy's. It is
 * what the executor did by hand on the Sitting K artifacts (check-rerun.mjs): a role without a shell does the same with `Grep`
 * (references/scanning-without-a-shell.md); the script is for the roles that have one. The fixtures plant the drifts, so the
 * expected findings are known before the script runs: tests/fixtures/brand-audit/README.md says which.
 */

const SCRIPT = path.resolve('registry/skills/brand-consistency-audit/scripts/audit-assets.mjs');
const TOKENS = path.resolve('tests/fixtures/designer/design-tokens.json');
const COPY = path.resolve('tests/fixtures/designer/hero.ts');
const FLAWED = path.resolve('tests/fixtures/brand-audit/flawed-set');
const CLEAN = path.resolve('tests/fixtures/brand-audit/clean-set');
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

type Finding = { file: string; line: number; type: string; value: string; written?: string; nearest?: { name: string; hex: string } };
type Report = { scanned: string[]; checked: { colours: number; fonts: number; strings: number }; findings: Finding[]; alpha: Array<{ file: string; line: number; hex: string }> };
const json = (...args: string[]): { status: number | null; report: Report } => {
  const r = run(...args, '--json');
  return { status: r.status, report: JSON.parse(r.stdout) as Report };
};
const brief = (f: Finding): string => `${f.file}:${f.line} ${f.type} ${f.value}`;

describe('the planted drifts of the flawed set are found, and nothing else', () => {
  it('finds two colours, a font and a label in the SVG and the HTML, in file and line order, and exits 1', () => {
    const { status, report } = json(TOKENS, FLAWED, '--copy', COPY);
    expect(status).toBe(1);
    expect(report.findings.map(brief)).toEqual([
      'feed.svg:3 colour #C2410C',
      'feed.svg:4 font Impact',
      'feed.svg:6 copy Book now!',
      'story.html:5 colour #333333',
      'story.html:6 colour #FFD1A9',
      'story.html:6 colour #FF0000',
    ]);
  });

  it('says how a colour was written when that differs (a short hex, a named colour) and which token is nearest', () => {
    const { report } = json(TOKENS, FLAWED, '--copy', COPY);
    const by = (v: string): Finding => report.findings.find(f => f.value === v)!;
    expect(by('#333333').written).toBe('#333');
    expect(by('#FF0000').written).toBe('red');
    expect(by('#C2410C').nearest!.name).toBe('color.clay.600');
    expect(by('#333333').nearest!.name).toBe('color.cocoa.900');
    expect(by('#FFD1A9').nearest!.name).toBe('color.sand.300');
  });

  it('counts what it looked at, so the report can say 16 colours, 5 fonts and 6 strings were checked and not only what failed', () => {
    const { report } = json(TOKENS, FLAWED, '--copy', COPY);
    expect(report.scanned).toEqual(['brand.css', 'feed.svg', 'story.html']);
    expect(report.checked).toEqual({ colours: 16, fonts: 5, strings: 6 });
  });

  it('accepts a token written another way: lower-case hex, rgb(), a translucent token, a quoted first font; and lists the translucent use', () => {
    const { report } = json(TOKENS, FLAWED, '--copy', COPY);
    expect(report.findings.some(f => f.file === 'brand.css')).toBe(false);
    expect(report.findings.some(f => f.value === '#F3D9B1')).toBe(false);
    expect(report.alpha).toEqual([{ file: 'story.html', line: 7, hex: '#2B1D14' }]);
  });

  it('does not take a link target for a colour: href="#add" is no finding', () => {
    const { report } = json(TOKENS, FLAWED, '--copy', COPY);
    expect(report.findings.some(f => /AADD|#ADD/i.test(f.value))).toBe(false);
    expect(report.checked.colours).toBe(16);
  });

  it('checks no strings without a copy file, and lets an allowed string through', () => {
    expect(json(TOKENS, FLAWED).report.findings.map(f => f.type)).not.toContain('copy');
    expect(json(TOKENS, FLAWED).report.checked.strings).toBe(0);
    const allowed = json(TOKENS, FLAWED, '--copy', COPY, '--allow', 'Book now!');
    expect(allowed.report.findings.map(f => f.type)).not.toContain('copy');
  });
});

describe('a clean set', () => {
  it('has no finding and exits 0: a three-digit white, an hsl() of the cream, a translucent cocoa and transparent are all fine', () => {
    const { status, report } = json(TOKENS, CLEAN);
    expect(status).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.checked).toEqual({ colours: 6, fonts: 1, strings: 0 });
  });
});

describe('the command line and the colour maths', () => {
  it('prints one line per finding, then what was checked, and the translucent uses as information', () => {
    const r = run(TOKENS, FLAWED, '--copy', COPY);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^feed\.svg:3 +colour +#C2410C +not a token; nearest color\.clay\.600 #B5451B/m);
    expect(r.stdout).toMatch(/^feed\.svg:4 +font +Impact +not a token font; the tokens' first font is Helvetica/m);
    expect(r.stdout).toMatch(/^feed\.svg:6 +copy +Book now! +not in the copy file/m);
    expect(r.stdout).toMatch(/^story\.html:6 +colour +#FF0000 \(red\)/m);
    expect(r.stdout).toMatch(/scanned 3 files: 16 colours, 5 fonts and 6 strings checked; 6 findings \(colour 4, font 1, copy 1\)/);
    expect(r.stdout).toMatch(/info: 1 token colour used with alpha \(story\.html:7\)/);
  });

  it('converts rgb() and hsl() to the hex they stand for', async () => {
    const lib = (await import(pathToFileURL(SCRIPT).href)) as { rgbToHex: (r: number, g: number, b: number) => string; hslToHex: (h: number, s: number, l: number) => string };
    expect(lib.rgbToHex(243, 217, 177)).toBe('#F3D9B1');
    expect(lib.hslToHex(33, 100, 97)).toBe('#FFF8F0');
    expect(lib.hslToHex(0, 0, 100)).toBe('#FFFFFF');
    expect(lib.hslToHex(0, 100, 50)).toBe('#FF0000');
  });

  it('exits 2 with a usage line for a missing argument, a folder that is not there, tokens that are not JSON and an unknown option', () => {
    for (const args of [[], [TOKENS], [TOKENS, path.resolve('tests/fixtures/brand-audit/nope')], [COPY, FLAWED], [TOKENS, FLAWED, '--frobnicate']]) {
      const r = run(...args);
      expect(r.status, JSON.stringify(args)).toBe(2);
      expect(r.stderr, JSON.stringify(args)).toMatch(/usage: node audit-assets\.mjs|cannot read/);
    }
  });
});
