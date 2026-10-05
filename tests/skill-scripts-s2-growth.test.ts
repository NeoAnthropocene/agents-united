import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 035 S2: the scripts and tables that ship inside a laid-out growth skill agree with that skill's worked
 * examples. These were the second half of the pilot's suite (ab-test-setup); they moved here so that the layout
 * suite (tests/skill-layout.test.ts) is the same file on every branch of the restructure.
 */

const SKILLS = path.resolve('registry/skills');

describe('ab-test-setup scripts, table and examples agree', () => {
  const dir = path.join(SKILLS, 'ab-test-setup');
  const run = (script: string, ...args: string[]): string => execFileSync('node', [path.join(dir, 'scripts', script), ...args], { encoding: 'utf8' });

  it('the scripts have no shebang line: git writes CRLF on a Windows checkout and vitest cannot import a script whose first line ends in one (they are run as `node <path>`, so they need none)', () => {
    for (const s of ['sample-size.mjs', 'srm-check.mjs']) {
      expect(fs.readFileSync(path.join(dir, 'scripts', s), 'utf8').startsWith('#!'), s).toBe(false);
    }
  });

  it('sample-size.mjs reproduces the worked examples: 9,600 per arm and 14 days; 158,400 and not feasible; 1,200', () => {
    const a = run('sample-size.mjs', '--baseline', '0.04', '--lift', '0.20', '--daily', '1500');
    expect(a).toContain('sample per arm: 9600');
    expect(a).toContain('run 14 days (2 whole weeks)');
    const b = run('sample-size.mjs', '--baseline', '0.01', '--lift', '0.10', '--daily', '1500');
    expect(b).toContain('sample per arm: 158400');
    expect(b).toContain('not worth running');
    expect(run('sample-size.mjs', '--baseline', '0.25', '--abs', '0.05')).toContain('sample per arm: 1200');
  });

  it('srm-check.mjs voids 10,300 against 9,700 and passes an even split', () => {
    expect(run('srm-check.mjs', '10300', '9700')).toContain('chi-square 18.00: invalid');
    expect(run('srm-check.mjs', '10010', '9990')).toContain(': ok');
  });

  it('the scripts fail with a usage message and exit code 2 when called without arguments', () => {
    for (const s of ['sample-size.mjs', 'srm-check.mjs']) {
      let code = 0;
      try {
        run(s);
      } catch (e) {
        code = (e as { status: number }).status;
      }
      expect(code).toBe(2);
    }
  });

  it('every cell of the precomputed table equals the formula', () => {
    const table = fs.readFileSync(path.join(dir, 'references', 'sample-size-table.md'), 'utf8');
    const lifts = [0.05, 0.1, 0.2, 0.3, 0.5];
    let cells = 0;
    for (const row of table.matchAll(/^\| (\d+)% \| (.+) \|$/gm)) {
      const p = Number(row[1]) / 100;
      const values = row[2]!.split(' | ').map(v => Number(v.replace(/,/g, '')));
      values.forEach((v, i) => {
        const expected = Math.ceil((16 * p * (1 - p)) / (p * lifts[i]!) ** 2 - 1e-9);
        expect(v, `${p * 100}% at +${lifts[i]! * 100}%`).toBe(expected);
        cells += 1;
      });
    }
    expect(cells).toBe(40);
  });

  it('the worked example and the SKILL.md quote the numbers the scripts print', () => {
    const example = fs.readFileSync(path.join(dir, 'examples', 'worked-example.md'), 'utf8');
    for (const n of ['9,600', '158,400', '10.83', '14 days']) expect(example).toContain(n);
    const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    expect(skill).toContain('${CLAUDE_SKILL_DIR}/scripts/sample-size.mjs');
    expect(skill).toContain('${CLAUDE_SKILL_DIR}/scripts/srm-check.mjs');
  });

  it('the evals ask for the three situations a skill-less run tends to get wrong: a sizing brief, an SRM, an infeasible test', () => {
    const evals = JSON.parse(fs.readFileSync(path.join(dir, 'evals', 'evals.json'), 'utf8')).evals as Array<{ expected_output: string }>;
    const all = evals.map(e => e.expected_output).join('\n');
    expect(all).toMatch(/9,600/);
    expect(all).toMatch(/sample-ratio mismatch/i);
    expect(all).toMatch(/not feasible/i);
  });
});
