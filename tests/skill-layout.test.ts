import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSkillLayout, laidOutSkills, supportingText } from './helpers/skill-layout.ts';
import { validateRewrittenSkill } from './helpers/skill-contract.ts';

/**
 * Plan 035, the skill layout. The skills are written for the Claude Code skills guidance
 * (https://code.claude.com/docs/en/skills.md): a short SKILL.md, examples and references loaded on demand, scripts
 * that are run and not read, and evals for the with-skill against without-skill comparison. This suite pins the
 * layout for every skill listed in LAID_OUT.
 *
 * LAID_OUT is a directory of empty marker files, one per converted skill (tests/fixtures/laid-out-skills/<skill>),
 * for the reason the allowlist of templated skills is one (ADR 0040, D1): the restructure is five parallel pull
 * requests, and one array that all of them extend would conflict on adjacent lines. A skill joins the list in the
 * commit that converts it, red first; nothing here is edited by a conversion, so the file is identical on every branch.
 */

const SKILLS = path.resolve('registry/skills');
const LAID_OUT = laidOutSkills();

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
const FM = (extra = ''): string => `---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it, show the layout. Skip it when there is nothing to demo."\n${extra}---\n`;
const EVALS = JSON.stringify({ skill_name: 'demo', evals: [
  { id: 1, prompt: 'a realistic prompt long enough to count as one for the demo skill', expected_output: 'a described outcome that is long enough to be a real expectation' },
  { id: 2, prompt: 'another realistic prompt, differently worded, for the demo skill too', expected_output: 'another described outcome that is long enough to be a real expectation' },
] });

describe('the layout checker', () => {
  it('accepts a short SKILL.md with referenced supporting files, a template in assets/, a script run through CLAUDE_SKILL_DIR with its table, and evals', () => {
    const root = tmpSkill({
      'SKILL.md': `${FM()}\n# Demo\nSee [examples/a.md](examples/a.md) and [references/t.md](references/t.md); fill in [assets/w.md](assets/w.md); with a shell run node \${CLAUDE_SKILL_DIR}/scripts/run.mjs.\n`,
      'examples/a.md': 'x', 'references/t.md': 'x', 'assets/w.md': 'x', 'scripts/run.mjs': 'x', 'evals/evals.json': EVALS,
    });
    expect(checkSkillLayout(root, 'demo')).toEqual([]);
  });

  it('holds assets/ to the same rule as references/: a template nobody references, or a link to one that is not there, is rejected', () => {
    const root = tmpSkill({ 'SKILL.md': `${FM()}\nFill in [assets/gone.md](assets/gone.md).\n`, 'assets/orphan.md': 'x', 'evals/evals.json': EVALS });
    const errors = checkSkillLayout(root, 'demo').join('\n');
    expect(errors).toContain('assets/orphan.md is not referenced');
    expect(errors).toContain('links to assets/gone.md which does not exist');
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

  it('rejects a description that says nothing about when to skip the skill', () => {
    const root = tmpSkill({ 'SKILL.md': `---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it."\n---\nbody\n`, 'evals/evals.json': EVALS });
    expect(checkSkillLayout(root, 'demo').join('\n')).toContain('says nothing about when to skip');
  });

  it('rejects a script that is not Node, one that SKILL.md does not run through CLAUDE_SKILL_DIR, and scripts with no references/ table for the roles without a shell', () => {
    const root = tmpSkill({
      'SKILL.md': `${FM()}\nSee scripts/run.sh and scripts/tool.mjs.\n`,
      'scripts/run.sh': 'x', 'scripts/tool.mjs': 'x', 'evals/evals.json': EVALS,
    });
    const errors = checkSkillLayout(root, 'demo').join('\n');
    expect(errors).toContain('scripts/run.sh is not a Node .mjs script');
    expect(errors).toContain('scripts/tool.mjs is not run through ${CLAUDE_SKILL_DIR}');
    expect(errors).toContain('has scripts/ but no references/ file');
  });
});

describe('the list of laid-out skills', () => {
  it('is one empty marker file per skill, sorted, and ignores dot files and folders', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laid-out-'));
    dirs.push(dir);
    for (const n of ['zeta-skill', 'alpha-skill', '.gitkeep']) fs.writeFileSync(path.join(dir, n), '');
    fs.mkdirSync(path.join(dir, 'a-folder'));
    expect(laidOutSkills(dir)).toEqual(['alpha-skill', 'zeta-skill']);
    expect(laidOutSkills(path.join(dir, 'missing'))).toEqual([]);
  });

  it('names only skills that exist in the registry', () => {
    const unknown = LAID_OUT.filter(n => !fs.existsSync(path.join(SKILLS, n, 'SKILL.md')));
    expect(unknown, `tests/fixtures/laid-out-skills names no such skill: ${unknown.join(', ')}`).toEqual([]);
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
