import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSkillLayout, supportingText } from './helpers/skill-layout.ts';
import { validateRewrittenSkill } from './helpers/skill-contract.ts';

/**
 * Plan 035, the skill layout (pilot: ab-test-setup). The skills are written for the Claude Code skills guidance
 * (https://code.claude.com/docs/en/skills.md): a short SKILL.md, examples and references loaded on demand, scripts
 * that are run and not read, and evals for the with-skill against without-skill comparison. This suite pins the
 * layout for every skill listed in LAID_OUT and proves the pilot's scripts and tables agree with its worked examples.
 */

const SKILLS = path.resolve('registry/skills');
/** Skills already converted to the layout. The restructure pull requests extend this list, one skill at a time. */
export const LAID_OUT = ['ab-test-setup'] as const;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
function tmpSkill(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-layout-'));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, 'demo', rel)), { recursive: true });
    fs.writeFileSync(path.join(root, 'demo', rel), text);
  }
  return root;
}
const FM = (extra = ''): string => `---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it, show the layout."\n${extra}---\n`;
const EVALS = JSON.stringify({ skill_name: 'demo', evals: [
  { id: 1, prompt: 'a realistic prompt long enough to count as one for the demo skill', expected_output: 'a described outcome that is long enough to be a real expectation' },
  { id: 2, prompt: 'another realistic prompt, differently worded, for the demo skill too', expected_output: 'another described outcome that is long enough to be a real expectation' },
] });

describe('the layout checker', () => {
  it('accepts a short SKILL.md with referenced supporting files and evals', () => {
    const root = tmpSkill({ 'SKILL.md': `${FM()}\n# Demo\nSee [examples/a.md](examples/a.md) and run scripts/run.mjs.\n`, 'examples/a.md': 'x', 'scripts/run.mjs': 'x', 'evals/evals.json': EVALS });
    expect(checkSkillLayout(root, 'demo')).toEqual([]);
  });

  it('rejects an over-long SKILL.md, an unknown key, a description that does not lead with the use case, no when_to_use, and "!" injection', () => {
    const long = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
    const root = tmpSkill({ 'SKILL.md': `---\nname: demo\ndescription: "Does a thing."\ndisable-model-invokation: true\n---\n${long}\n!\`git status\`\n`, 'evals/evals.json': EVALS });
    const errors = checkSkillLayout(root, 'demo').join('\n');
    expect(errors).toContain('lines (max 90)');
    expect(errors).toContain('unknown front matter key "disable-model-invokation"');
    expect(errors).toContain('must lead with the key use case');
    expect(errors).toContain('lists no trigger phrases');
    expect(errors).toContain('command injection');
  });

  it('rejects a supporting file nobody references, a link to nothing, missing or weak evals, and a listing over the cap', () => {
    const root = tmpSkill({ 'SKILL.md': `---\nname: demo\ndescription: "Use when ${'x'.repeat(1500)}"\nwhen_to_use: "Trigger phrases: use it."\n---\nSee [references/gone.md](references/gone.md).\n`, 'references/orphan.md': 'x', 'evals/evals.json': JSON.stringify({ skill_name: 'other', evals: [{ id: 1, prompt: 'short', expected_output: '' }] }) });
    const errors = checkSkillLayout(root, 'demo').join('\n');
    expect(errors).toContain('references/orphan.md is not referenced');
    expect(errors).toContain('links to references/gone.md which does not exist');
    expect(errors).toContain('cap 1024');
    expect(errors).toContain('do not use when_to_use yet');
    expect(errors).toContain('evals skill_name is other');
    expect(errors).toContain('1 evals (want 2 to 5)');
    expect(errors).toContain('prompt is too short');
    const none = tmpSkill({ 'SKILL.md': `${FM()}\nbody\n` });
    expect(checkSkillLayout(none, 'demo').join('\n')).toContain('evals/evals.json is missing');
  });
});

describe('every skill converted to the layout', () => {
  for (const name of LAID_OUT) {
    it(`${name} follows the layout and still meets the rewrite contract (read together with its supporting files)`, () => {
      expect(checkSkillLayout(SKILLS, name)).toEqual([]);
      const dir = path.join(SKILLS, name);
      const content = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
      expect(validateRewrittenSkill(name, content, supportingText(dir))).toEqual([]);
      expect(fs.existsSync(path.resolve('tests/fixtures/templated-skills', name))).toBe(false);
    });
  }
});

describe('pilot: ab-test-setup scripts, table and examples agree', () => {
  const dir = path.join(SKILLS, 'ab-test-setup');
  const run = (script: string, ...args: string[]): string => execFileSync('node', [path.join(dir, 'scripts', script), ...args], { encoding: 'utf8' });

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
