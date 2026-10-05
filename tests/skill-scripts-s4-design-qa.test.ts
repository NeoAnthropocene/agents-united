import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S4: the contrast helper that ships inside `accessibility-audit`, a skill that Emre loads and Emre has a
 * shell. (`design-system-tokens` carries tables instead, because its only loader, Jamileh, has none: see
 * `skill-tables-s4-design-qa.test.ts`.)
 */

const SKILLS = path.resolve('registry/skills');
const SCRIPT = path.join(SKILLS, 'accessibility-audit', 'scripts', 'contrast.mjs');

interface ContrastModule {
  contrastRatio(foreground: string, background: string): number;
}
const load = async (): Promise<ContrastModule> => (await import(pathToFileURL(SCRIPT).href)) as ContrastModule;
const run = (...args: string[]) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });

describe('accessibility-audit contrast.mjs', () => {
  it('computes the WCAG ratio: black on white is 21, a colour on itself is 1, order does not matter', async () => {
    const { contrastRatio } = await load();
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#6B7280', '#6B7280')).toBeCloseTo(1, 5);
    expect(contrastRatio('#FFFFFF', '#1D4ED8')).toBeCloseTo(contrastRatio('#1D4ED8', '#FFFFFF'), 8);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('reproduces the pairs of the design-system-tokens worked example', async () => {
    const { contrastRatio } = await load();
    const pairs: Array<[string, string, string]> = [
      ['#111827', '#FFFFFF', '17.74'],
      ['#6B7280', '#FFFFFF', '4.83'],
      ['#6B7280', '#F3F4F6', '4.39'],
      ['#1D4ED8', '#FFFFFF', '6.70'],
      ['#F59E0B', '#FFFFFF', '2.15'],
      ['#111827', '#F59E0B', '8.26'],
      ['#B45309', '#FFFFFF', '5.02'],
    ];
    for (const [fg, bg, expected] of pairs) expect(contrastRatio(fg, bg).toFixed(2), `${fg} on ${bg}`).toBe(expected);
  });

  it('prints the ratio and the four verdicts, and exits 1 when the chosen level fails, 0 when it passes', () => {
    const fail = run('#6B7280', '#F3F4F6');
    expect(fail.stdout).toContain('4.39:1');
    expect(fail.stdout).toMatch(/AA normal text \(4\.5\):\s+fail/);
    expect(fail.stdout).toMatch(/AA large text and interface \(3\):\s+pass/);
    expect(fail.status).toBe(1);
    expect(run('#6B7280', '#FFFFFF').status).toBe(0);
    expect(run('#6B7280', '#F3F4F6', '--large').status).toBe(0);
    expect(run('#6B7280', '#FFFFFF', '--level', 'AAA').status).toBe(1);
  });

  it('fails with a usage message and exit code 2 for missing or malformed arguments', () => {
    for (const args of [[], ['#123456'], ['#12345', '#FFFFFF'], ['red', 'blue'], ['#111827', '#FFFFFF', '--level', 'AAAA']]) {
      const r = run(...args);
      expect(r.status, args.join(' ')).toBe(2);
      expect(r.stderr).toContain('usage');
    }
  });

  it('is run by accessibility-audit through CLAUDE_SKILL_DIR', () => {
    const skill = fs.readFileSync(path.join(SKILLS, 'accessibility-audit', 'SKILL.md'), 'utf8');
    expect(skill).toContain('${CLAUDE_SKILL_DIR}/scripts/contrast.mjs');
  });
});
