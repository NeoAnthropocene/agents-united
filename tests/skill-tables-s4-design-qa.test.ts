import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S4: `design-system-tokens` is loaded by Jamileh, who has no shell, so it carries precomputed tables where
 * the skill needs arithmetic (contrast ratios, a type scale) and no script. Every cell is held to the formula: the
 * contrast ratios by the same function the `accessibility-audit` helper prints.
 */

const SKILLS = path.resolve('registry/skills');
const TOKENS = path.join(SKILLS, 'design-system-tokens');
const SCRIPT = path.join(SKILLS, 'accessibility-audit', 'scripts', 'contrast.mjs');

interface ContrastModule {
  contrastRatio(foreground: string, background: string): number;
}
const load = async (): Promise<ContrastModule> => (await import(pathToFileURL(SCRIPT).href)) as ContrastModule;
const verdict = (ratio: number): string => (ratio >= 4.5 ? 'pass' : ratio >= 3 ? 'large only' : 'fail');

describe('design-system-tokens carries tables instead of a script', () => {
  it('has no scripts folder', () => {
    expect(fs.existsSync(path.join(TOKENS, 'scripts'))).toBe(false);
  });

  it('every cell of the neutral ramp table equals the formula, with the right verdict', async () => {
    const { contrastRatio } = await load();
    const table = fs.readFileSync(path.join(TOKENS, 'references', 'contrast-table.md'), 'utf8');
    const backgrounds = ['#FFFFFF', '#F9FAFB', '#F3F4F6'];
    let cells = 0;
    for (const row of table.matchAll(/^\| gray (\d+) \| (#[0-9A-F]{6}) \| (.+) \| (.+) \| (.+) \|$/gm)) {
      [row[3]!, row[4]!, row[5]!].forEach((cell, i) => {
        const ratio = contrastRatio(row[2]!, backgrounds[i]!);
        expect(cell, `gray ${row[1]} on ${backgrounds[i]}`).toBe(`${ratio.toFixed(2)} ${verdict(ratio)}`);
        cells += 1;
      });
    }
    expect(cells).toBe(21);
  });

  it('every row of the type scale table equals 16 x ratio ^ step, rounded to whole pixels', () => {
    const table = fs.readFileSync(path.join(TOKENS, 'references', 'scales.md'), 'utf8');
    let rows = 0;
    for (const row of table.matchAll(/^\| (-?\d+)(?: \(body\))? \| (\d+) \| (\d+) \|$/gm)) {
      const step = Number(row[1]);
      expect(Number(row[2]), `ratio 1.2, step ${step}`).toBe(Math.round(16 * 1.2 ** step));
      expect(Number(row[3]), `ratio 1.25, step ${step}`).toBe(Math.round(16 * 1.25 ** step));
      rows += 1;
    }
    expect(rows).toBe(8);
  });

  it('the worked example quotes the ratios the script prints for its pairs', async () => {
    const { contrastRatio } = await load();
    const example = fs.readFileSync(path.join(TOKENS, 'examples', 'worked-example.md'), 'utf8');
    let pairs = 0;
    for (const row of example.matchAll(/^\| `(#[0-9A-Fa-f]{6})` \| `(#[0-9A-Fa-f]{6})` \| ([\d.]+) \|/gm)) {
      expect(contrastRatio(row[1]!, row[2]!).toFixed(2), `${row[1]} on ${row[2]}`).toBe(row[3]);
      pairs += 1;
    }
    expect(pairs).toBe(7);
  });
});
