import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EVALS_FILE_REQUIRED, checkSkillLayout } from '../src/core/skill-layout.js';
import { SKILL_CHECK_POLICIES } from '../src/core/skill-check.js';

/**
 * Which `skill-check` policies require `evals/evals.json` (the maintainer's decision of 2026-11-17): the original and the
 * private-owner policy do, `adapted-source` does not. One table in `src/core/skill-layout.ts`; the postflight checker
 * `check-skill-return.mjs` cannot import from `src/`, so it carries a literal copy, and this file ties the copy to the table.
 */

describe('the table of policies that require the evals file', () => {
  it('names every skill-check policy once, and exempts only adapted-source', () => {
    expect(Object.keys(EVALS_FILE_REQUIRED).sort()).toEqual([...SKILL_CHECK_POLICIES].sort());
    expect(EVALS_FILE_REQUIRED).toEqual({ 'agents-united-original': true, 'private-owner': true, 'adapted-source': false });
  });
});

describe('checkSkillLayout takes the policy', () => {
  const roots: string[] = [];
  afterEach(() => {
    while (roots.length > 0) fs.rmSync(roots.pop()!, { recursive: true, force: true });
  });
  const FM = '---\nname: demo\ndescription: "Use when you demo the layout; trigger phrases: demo it, show the layout. Skip it when there is nothing to demo."\n---\n';
  const EVALS = JSON.stringify({ skill_name: 'demo', evals: [
    { id: 1, prompt: 'a realistic prompt long enough to count as one for the demo skill', expected_output: 'a described outcome that is long enough to be a real expectation' },
    { id: 2, prompt: 'another realistic prompt, differently worded, for the demo skill too', expected_output: 'another described outcome that is long enough to be a real expectation' },
  ] });
  const skill = (files: Record<string, string>): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-evals-policy-'));
    roots.push(root);
    for (const [rel, text] of Object.entries({ 'SKILL.md': `${FM}\n# Demo\n`, ...files })) {
      fs.mkdirSync(path.dirname(path.join(root, 'demo', rel)), { recursive: true });
      fs.writeFileSync(path.join(root, 'demo', rel), text);
    }
    return root;
  };

  it.each(SKILL_CHECK_POLICIES)('%s: the finding for a missing file is reported exactly where the table requires it', policy => {
    const errors = checkSkillLayout(skill({}), 'demo', policy);
    expect(errors.some(e => e.includes('evals/evals.json is missing'))).toBe(EVALS_FILE_REQUIRED[policy]);
  });

  it.each(SKILL_CHECK_POLICIES)('%s: a present, valid file is accepted', policy => {
    expect(checkSkillLayout(skill({ 'evals/evals.json': EVALS }), 'demo', policy)).toEqual([]);
  });

  it.each(SKILL_CHECK_POLICIES)('%s: a present file is validated even where it is not required', policy => {
    const errors = checkSkillLayout(skill({ 'evals/evals.json': '{not json' }), 'demo', policy);
    expect(errors.join('\n')).toContain('evals/evals.json is not valid JSON');
  });

  it.each([['an unknown name', 'made-up-policy'], ['null', null], ['an empty string', ''], ['an inherited property name', 'toString'], ['a prototype key', '__proto__']])(
    'a policy that is %s reads as required: only a known exemption exempts',
    (_name, policy) => {
      const errors = checkSkillLayout(skill({}), 'demo', policy as never);
      expect(errors.some(e => e.includes('evals/evals.json is missing'))).toBe(true);
    },
  );

  it('without a policy the file is required, as before', () => {
    expect(checkSkillLayout(skill({}), 'demo').join('\n')).toContain('evals/evals.json is missing');
  });
});

describe('the postflight checker carries a literal copy of the table', () => {
  const source = fs.readFileSync(path.resolve('registry/skills/coordinate-artifact/scripts/check-skill-return.mjs'), 'utf8');

  it('copies it on purpose and says so', () => {
    expect(source).toMatch(/copied on purpose[^\n]*skill-layout\.ts/i);
  });

  it('has the same policies and values as src/core/skill-layout.ts', () => {
    const literal = /const EVALS_REQUIRED_BY_POLICY = (\{[^}]*\});/.exec(source);
    expect(literal, 'a literal EVALS_REQUIRED_BY_POLICY table in check-skill-return.mjs').not.toBeNull();
    // The repository's own object literal, evaluated as an expression.
    const copy = new Function(`return ${literal![1]}`)() as Record<string, boolean>;
    expect(copy).toEqual({ ...EVALS_FILE_REQUIRED });
  });

  it('reads an unknown, null or inherited policy as required, and exempts only a known exemption', () => {
    const match = /function evalsRequired\(policy\) \{[\s\S]*?\n\}/.exec(source);
    expect(match, 'a function evalsRequired(policy) in check-skill-return.mjs').not.toBeNull();
    const table = /const EVALS_REQUIRED_BY_POLICY = (\{[^}]*\});/.exec(source)![1];
    const evalsRequired = new Function(`const EVALS_REQUIRED_BY_POLICY = ${table}; ${match![0]}; return evalsRequired;`)() as (policy: unknown) => boolean;
    for (const policy of ['agents-united-original', 'private-owner']) expect(evalsRequired(policy), policy).toBe(true);
    expect(evalsRequired('adapted-source')).toBe(false);
    for (const policy of ['made-up-policy', null, undefined, '', 'toString', '__proto__', 7]) expect(evalsRequired(policy), String(policy)).toBe(true);
  });

  it('lets the task schema name exactly the same policies', () => {
    const schema = JSON.parse(fs.readFileSync(path.resolve('registry/skills/coordinate-artifact/assets/skill-task.schema.json'), 'utf8')) as {
      properties: Record<string, { enum?: string[] }>; required: string[];
    };
    expect([...schema.properties.skillCheckPolicy.enum!].sort()).toEqual([...SKILL_CHECK_POLICIES].sort());
    expect(schema.required).toContain('skillCheckPolicy');
  });
});
