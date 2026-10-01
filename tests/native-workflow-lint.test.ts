import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listNativeRoles, listNativeWorkflows, nativeWorkflowSource } from '../src/core/native-package.js';
import { agentTypesUsed, extractMetaLiteral, lintWorkflow } from './helpers/workflow-lint.js';

/**
 * Plan 032 — the lint for Claude dynamic workflows, and every committed native workflow held to it.
 */

const REGISTRY = path.resolve('registry');

const GOOD = `export const meta = {
  name: 'demo-flow',
  description: 'A demo',
  phases: [{ title: 'Find', detail: 'look' }, { title: 'Check' }],
}

phase('Find')
const found = await agent('look', { schema: { type: 'object', properties: {} }, agentType: 'code-reviewer' })
const checked = await pipeline([1, 2], n => agent('check ' + n, { phase: 'Check' }))
return { found, checked: checked.filter(Boolean), when: args && args.when }
`;

describe('lintWorkflow', () => {
  it('accepts a well-formed workflow', () => {
    expect(lintWorkflow(GOOD)).toEqual([]);
  });

  it('finds the meta literal by matching braces, ignoring braces in strings and comments', () => {
    const found = extractMetaLiteral("export const meta = { name: 'a}', description: \"{b\", /* } */ phases: [] }\nconst x = 1");
    expect(found?.literal).toBe("{ name: 'a}', description: \"{b\", /* } */ phases: [] }");
  });

  it.each([
    ['no meta first', "const x = 1\nexport const meta = { name: 'a', description: 'b' }", /first statement/],
    ['meta with a variable', "const n = 'a'\nexport const meta = { name: n, description: 'b' }", /first statement|pure literal/],
    ['meta with a call', "export const meta = { name: 'a', description: String('b') }", /pure literal/],
    ['meta with interpolation', "export const meta = { name: 'a', description: `b ${1}` }", /pure literal/],
    ['meta without a description', "export const meta = { name: 'a' }", /description/],
    ['a bad name', "export const meta = { name: 'Not Valid', description: 'b' }", /meta\.name/],
    ['an import call', "export const meta = { name: 'a', description: 'b' }\nconst m = await import('x')", /import/],
    ['Date.now', "export const meta = { name: 'a', description: 'b' }\nconst t = Date.now()", /Date\.now/],
    ['Math.random', "export const meta = { name: 'a', description: 'b' }\nconst r = Math.random()", /Math\.random/],
    ['new Date()', "export const meta = { name: 'a', description: 'b' }\nconst d = new Date()", /new Date/],
    ['a TypeScript annotation', "export const meta = { name: 'a', description: 'b' }\nconst x: string = 'y'", /plain JavaScript/],
    ['a phase not in meta', "export const meta = { name: 'a', description: 'b' }\nphase('Find')", /not listed in meta\.phases/],
    ['a listed phase never used', "export const meta = { name: 'a', description: 'b', phases: [{ title: 'Find' }] }\nconst x = 1", /no phase\(\) call/],
    ['a second export', "export const meta = { name: 'a', description: 'b' }\nexport const other = 1", /Only `meta`/],
  ])('rejects %s', (_label, source, message) => {
    expect(lintWorkflow(source).join('\n')).toMatch(message);
  });

  it('allows Date methods that take arguments, and mentions in comments', () => {
    const source = "export const meta = { name: 'a', description: 'b' }\n// do not call Date.now() here\nconst d = new Date(args.when)\nreturn d";
    expect(lintWorkflow(source)).toEqual([]);
  });

  it('lists the agent types a script asks for', () => {
    expect(agentTypesUsed(GOOD)).toEqual(['code-reviewer']);
  });
});

describe('the committed native workflows', () => {
  const names = listNativeWorkflows(REGISTRY, 'claude');

  it('include workflow-review, and are named like their file', () => {
    expect(names).toContain('workflow-review');
    for (const name of names) {
      const source = fs.readFileSync(nativeWorkflowSource(REGISTRY, 'claude', name)!, 'utf8');
      expect(source, name).toContain(`name: '${name}'`);
    }
  });

  it.each(names)('%s passes the lint, uses only installed native agent types, and replaces a skill of the same name', name => {
    const source = fs.readFileSync(nativeWorkflowSource(REGISTRY, 'claude', name)!, 'utf8');
    expect(lintWorkflow(source), name).toEqual([]);
    const nativeAgents = listNativeRoles(REGISTRY, 'claude');
    for (const type of agentTypesUsed(source)) expect(nativeAgents, `${name} asks for agentType ${type}`).toContain(type);
    expect(fs.existsSync(path.join(REGISTRY, 'skills', name, 'SKILL.md')), `a skill named ${name} to replace`).toBe(true);
  });
});
