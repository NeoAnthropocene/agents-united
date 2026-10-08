import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 036 S15, `color-theory`: the one script of the skill builds a tonal scale and the harmony hexes of a seed colour in OKLCH, with each
 * step's contrast on white and on black, for the roles that have a shell (the roles without one read references/tonal-scales.md and
 * references/hue-families.md, which the script generates). The maths is held to canonical values, not to its own output: OKLCH red is
 * oklch(62.8% 0.2577 29.23) (Ottosson), #767676 on white is the lightest grey that passes 4.5 to 1 (4.54), #777777 is 4.48.
 */

const SCRIPT = path.resolve('registry/skills/color-theory/scripts/palette.mjs');
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
type Lib = {
  hexToOklch: (hex: string) => { L: number; C: number; h: number };
  oklchToHex: (L: number, h: number, s: number) => string;
  relativeSaturation: (hex: string) => number;
  contrastRatio: (a: string, b: string) => number;
  buildScale: (seed: string) => { scale: Array<{ step: number; hex: string; L: number; C: number; onWhite: number; onBlack: number }>; nearest: number };
  harmony: (seed: string, scheme: string) => Array<{ offset: number; hue: number; hex: string }>;
  familiesTable: () => string;
  STEPS: number[];
};
const lib = async (): Promise<Lib> => (await import(pathToFileURL(SCRIPT).href)) as Lib;
const channels = (hex: string): number[] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hueGap = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

describe('the maths, held to canonical values', () => {
  it('converts sRGB to OKLCH: red, white and black', async () => {
    const { hexToOklch } = await lib();
    const red = hexToOklch('#FF0000');
    expect(red.L).toBeCloseTo(0.628, 3);
    expect(red.C).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    expect(hexToOklch('#FFFFFF').L).toBeCloseTo(1, 4);
    expect(hexToOklch('#FFFFFF').C).toBeLessThan(1e-4);
    expect(hexToOklch('#000000').L).toBe(0);
  });

  it('gives the WCAG ratios that every checker agrees on, and compares the unrounded value', async () => {
    const { contrastRatio } = await lib();
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
    expect(contrastRatio('#2B1D14', '#FFF8F0').toFixed(2)).toBe('15.47');
    expect(contrastRatio('#FFFFFF', '#B5451B').toFixed(2)).toBe('5.48');
  });

  it('turns a colour back into itself through its lightness, hue and relative saturation', async () => {
    const { hexToOklch, oklchToHex, relativeSaturation } = await lib();
    for (const hex of ['#B5451B', '#2B1D14', '#F3D9B1', '#4F8CFF', '#00FF7F', '#808080']) {
      const { L, h } = hexToOklch(hex);
      expect(oklchToHex(L, h, relativeSaturation(hex)), hex).toBe(hex);
    }
  });
});

describe('the scale', () => {
  it('has eleven steps from 50 to 950 with falling lightness, hues that stay on the seed\'s, and no channel outside sRGB', async () => {
    const { buildScale, hexToOklch, STEPS } = await lib();
    const seed = '#B5451B';
    const { scale } = buildScale(seed);
    expect(scale.map(s => s.step)).toEqual(STEPS);
    expect(STEPS).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    for (let i = 1; i < scale.length; i += 1) expect(scale[i]!.L, `step ${scale[i]!.step}`).toBeLessThan(scale[i - 1]!.L);
    for (const s of scale) {
      expect(s.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(hueGap(hexToOklch(s.hex).h, hexToOklch(seed).h), `hue of step ${s.step}`).toBeLessThan(6);
    }
  });

  it('names the step nearest the seed and keeps the seed as given: PetPal\'s clay lands on 600, within a unit of its own hex', async () => {
    const { buildScale } = await lib();
    const { scale, nearest } = buildScale('#B5451B');
    expect(nearest).toBe(600);
    const near = channels(scale.find(s => s.step === 600)!.hex);
    channels('#B5451B').forEach((c, i) => expect(Math.abs(c - near[i]!)).toBeLessThanOrEqual(2));
  });

  it('gives the contrast on white and on black of every step, and the curve behaves for this seed: 500 clears 3, 600 clears 4.5, 700 clears 7', async () => {
    const { buildScale, contrastRatio } = await lib();
    const { scale } = buildScale('#B5451B');
    for (const s of scale) {
      expect(s.onWhite).toBeCloseTo(contrastRatio(s.hex, '#FFFFFF'), 2);
      expect(s.onBlack).toBeCloseTo(contrastRatio(s.hex, '#000000'), 2);
    }
    const at = (step: number) => scale.find(s => s.step === step)!;
    expect(at(500).onWhite).toBeGreaterThanOrEqual(3);
    expect(at(600).onWhite).toBeGreaterThanOrEqual(4.5);
    expect(at(700).onWhite).toBeGreaterThanOrEqual(7);
  });

  it('builds a grey from a grey: every step has equal channels', async () => {
    const { buildScale } = await lib();
    for (const s of buildScale('#808080').scale) expect(new Set(channels(s.hex)).size, s.hex).toBe(1);
  });
});

describe('the rules of references/tonal-scales.md hold for every family of references/hue-families.md', () => {
  it('step 500 on white clears 3, 600 clears 4.5, 700 clears 7 except lime, green, teal and cyan, 700 on step 50 clears 4.5, 400 on step 950 clears 4.5', async () => {
    const lib2 = (await lib()) as Lib & { FAMILIES: Array<{ name: string; h: number; s: number }>; LIGHTNESS: Record<number, number>; TAPER: Record<number, number> };
    const hex = (f: { h: number; s: number }, step: number): string => lib2.oklchToHex(lib2.LIGHTNESS[step]!, f.h, f.s * lib2.TAPER[step]!);
    const under7: string[] = [];
    const under45on50: string[] = [];
    for (const f of lib2.FAMILIES) {
      expect(lib2.contrastRatio(hex(f, 500), '#FFFFFF'), `${f.name} 500 on white`).toBeGreaterThanOrEqual(3);
      expect(lib2.contrastRatio(hex(f, 600), '#FFFFFF'), `${f.name} 600 on white`).toBeGreaterThanOrEqual(4.5);
      if (lib2.contrastRatio(hex(f, 700), '#FFFFFF') < 7) under7.push(f.name);
      if (lib2.contrastRatio(hex(f, 600), hex(f, 50)) < 4.5) under45on50.push(f.name);
      expect(lib2.contrastRatio(hex(f, 700), hex(f, 50)), `${f.name} 700 on 50`).toBeGreaterThanOrEqual(6.2);
      expect(lib2.contrastRatio(hex(f, 400), hex(f, 950)), `${f.name} 400 on 950`).toBeGreaterThanOrEqual(5.7);
    }
    expect(under7.sort()).toEqual(['cyan', 'green', 'lime', 'teal']);
    expect(under45on50.sort()).toEqual(['green', 'teal']);
  });

  it('keeps the curve table of the reference equal to the curve of the script', async () => {
    const lib2 = (await lib()) as Lib & { LIGHTNESS: Record<number, number>; TAPER: Record<number, number> };
    const page = fs.readFileSync(path.resolve('registry/skills/color-theory/references/tonal-scales.md'), 'utf8').replace(/\r\n/g, '\n');
    for (const step of lib2.STEPS) expect(page, `step ${step}`).toContain(`| ${step} | ${lib2.LIGHTNESS[step]!.toFixed(2)} | ${lib2.TAPER[step]!.toFixed(2)} |`);
  });
});

describe('the harmony', () => {
  it('shifts the hue by the scheme\'s offsets and keeps the seed\'s lightness: complementary +180, split +150 and +210, triadic, analogous, tetradic', async () => {
    const { harmony, hexToOklch } = await lib();
    const seed = '#B5451B';
    const base = hexToOklch(seed);
    const expected: Record<string, number[]> = { complementary: [180], split: [150, 210], triadic: [120, 240], analogous: [-30, 30], tetradic: [90, 180, 270] };
    for (const [scheme, offsets] of Object.entries(expected)) {
      const out = harmony(seed, scheme);
      expect(out.map(o => o.offset), scheme).toEqual(offsets);
      out.forEach(o => {
        const got = hexToOklch(o.hex);
        expect(hueGap(got.h, base.h + o.offset), `${scheme} ${o.offset}`).toBeLessThan(6);
        expect(Math.abs(got.L - base.L), `${scheme} ${o.offset} lightness`).toBeLessThan(0.02);
      });
    }
  });

  it('refuses a scheme it does not know', async () => {
    const { harmony } = await lib();
    expect(() => harmony('#B5451B', 'rainbow')).toThrow(/unknown scheme/);
  });
});

describe('the command line', () => {
  it('prints the seed, the scale with the nearest step, and the contrast columns', () => {
    const r = run('#B5451B');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^seed #B5451B +oklch\(0\.538 0\.155 39\)/);
    expect(r.stdout).toMatch(/step +L +C +hex +on white +on black/);
    expect(r.stdout.split('\n').filter(l => /^\d+ +0\./.test(l))).toHaveLength(11);
    expect(r.stdout).toMatch(/nearest step to the seed: 600/);
  });

  it('prints the harmony hexes for a scheme', () => {
    const r = run('#B5451B', '--harmony', 'split');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/split \+150° +hue 189 +#[0-9A-F]{6}/);
    expect(r.stdout).toMatch(/split \+210° +hue 249 +#[0-9A-F]{6}/);
  });

  it('prints JSON that a role can read', () => {
    const j = JSON.parse(run('#B5451B', '--json').stdout) as { seed: { hex: string; relativeSaturation: number }; scale: unknown[]; nearest: number };
    expect(j.seed.hex).toBe('#B5451B');
    expect(j.scale).toHaveLength(11);
    expect(j.nearest).toBe(600);
  });

  it('accepts a seed without the hash and a three-digit seed', () => {
    expect(run('B5451B').status).toBe(0);
    expect(run('#FA0').status).toBe(0);
  });

  it('exits 2 with a usage line for no seed, a bad seed, or an unknown scheme', () => {
    for (const args of [[], ['#GGGGGG'], ['#B5451B', '--harmony', 'rainbow'], ['#B5451B', '#FFFFFF']]) {
      const r = run(...args);
      expect(r.status, JSON.stringify(args)).toBe(2);
      expect(r.stderr, JSON.stringify(args)).toMatch(/usage: node palette\.mjs/);
    }
  });

  it('prints the family table that references/hue-families.md carries, so the page cannot drift from the script', () => {
    const table = run('--families').stdout.trim();
    expect(table.split('\n')).toHaveLength(2 + 15);
    const page = fs.readFileSync(path.resolve('registry/skills/color-theory/references/hue-families.md'), 'utf8').replace(/\r\n/g, '\n');
    expect(page).toContain(table);
  });
});
