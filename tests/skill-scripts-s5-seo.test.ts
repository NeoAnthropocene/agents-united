import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S5: the health-score helper that ships with `seo-audit` for Selin (who has a shell). `seo-audit` is also
 * loaded by Yavuz, who has none, so the score rule comes with a precomputed table; every cell is held to the rule.
 * The redirect-chain reader of `technical-seo-audit` is tested in `skill-scripts-s5-technical-seo.test.ts`.
 */

const SKILLS = path.resolve('registry/skills');
const HEALTH = path.join(SKILLS, 'seo-audit', 'scripts', 'health-score.mjs');

interface HealthModule {
  healthScore(counts: { critical: number; major: number; minor: number }): number;
}
const loadHealth = async (): Promise<HealthModule> => (await import(pathToFileURL(HEALTH).href)) as HealthModule;
const health = (...args: string[]) => spawnSync('node', [HEALTH, ...args], { encoding: 'utf8' });

describe('seo-audit health-score.mjs', () => {
  it('has no shebang line: git writes CRLF on a Windows checkout and vitest cannot import a script whose first line ends in one (the script is run as `node <path>`, so it needs none)', () => {
    expect(fs.readFileSync(HEALTH, 'utf8').startsWith('#!')).toBe(false);
  });

  it('applies the rule: 100 minus 15 per critical, 7 per major, 2 per minor, never below 0', async () => {
    const { healthScore } = await loadHealth();
    expect(healthScore({ critical: 1, major: 2, minor: 1 })).toBe(69);
    expect(healthScore({ critical: 0, major: 0, minor: 0 })).toBe(100);
    expect(healthScore({ critical: 7, major: 0, minor: 0 })).toBe(0);
    expect(healthScore({ critical: 0, major: 0, minor: 60 })).toBe(0);
  });

  it('prints the arithmetic and says the score is a summary of this audit, not an industry metric', () => {
    const r = health('--critical', '1', '--major', '2', '--minor', '1');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('critical 1 x 15 = 15');
    expect(r.stdout).toContain('major 2 x 7 = 14');
    expect(r.stdout).toContain('minor 1 x 2 = 2');
    expect(r.stdout).toContain('health score: 69');
    expect(r.stdout).toMatch(/not an industry metric/);
  });

  it('counts the severity column of a findings table: the worked example scores 69', () => {
    const r = health(path.join(SKILLS, 'seo-audit', 'examples', 'worked-example.md'));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('critical 1');
    expect(r.stdout).toContain('major 2');
    expect(r.stdout).toContain('minor 1');
    expect(r.stdout).toContain('health score: 69');
  });

  it('exits 2 with a usage message for no input, a negative or non-numeric count, or a missing file', () => {
    for (const args of [[], ['--critical', '-1'], ['--major', 'many'], [path.join(SKILLS, 'seo-audit', 'no-such-file.md')]]) {
      const r = health(...args);
      expect(r.status, args.join(' ')).toBe(2);
      expect(r.stderr).toContain('usage');
    }
  });

  it('the precomputed table for the roles without a shell equals the rule in every cell', async () => {
    const { healthScore } = await loadHealth();
    const table = fs.readFileSync(path.join(SKILLS, 'seo-audit', 'references', 'health-score.md'), 'utf8');
    let cells = 0;
    for (const row of table.matchAll(/^\| (\d+) criticals? \| (.+) \|$/gm)) {
      const critical = Number(row[1]);
      row[2]!.split(' | ').forEach((cell, major) => {
        expect(Number(cell), `${critical} criticals, ${major} majors`).toBe(healthScore({ critical, major, minor: 0 }));
        cells += 1;
      });
    }
    expect(cells).toBe(42);
  });

  it('is run by seo-audit through CLAUDE_SKILL_DIR', () => {
    expect(fs.readFileSync(path.join(SKILLS, 'seo-audit', 'SKILL.md'), 'utf8')).toContain('${CLAUDE_SKILL_DIR}/scripts/health-score.mjs');
  });
});
