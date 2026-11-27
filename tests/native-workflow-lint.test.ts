import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listNativeRoles, listNativeWorkflows, nativeWorkflowSource } from '../src/core/native-package.js';
import { agentTypeRequests, workflowMetaName } from '../src/core/workflow-lint.js';
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

// ADR 0082: the agent types are found by a tokenizer that skips comments, strings, template text and regular expressions.
describe('agentTypeRequests', () => {
  it('lists the string-literal types, sorted once each, and the lines of values it cannot resolve', () => {
    const source = [
      "const a = await agent('x', { agentType: 'zeta' })",
      'const b = await agent(\'y\', { "agentType": kind })',
      "const c = await agent('z', { 'agentType': `alpha`, phase: 'P' })",
      "const d = await agent('w', { agentType: 'zeta' })",
      'const e = await agent(\'v\', { agentType })',
    ].join('\n');
    expect(agentTypeRequests(source)).toEqual({ literals: ['alpha', 'zeta'], unresolved: [2, 5] });
    expect(agentTypesUsed(source)).toEqual(['alpha', 'zeta']);
  });

  it('skips comments, strings, template text and regular expressions, and reads a template interpolation as code', () => {
    const source = [
      "// { agentType: 'one' }",
      "/* { agentType: 'two' } */",
      "const s = \"{ agentType: 'three' }\"",
      "const t = `{ agentType: 'four' } ${await agent('q', { agentType: 'five' })}`",
      "const r = /{ agentType: 'six' }/",
      "const u = ok ? o.agentType : 'seven'",
    ].join('\n');
    expect(agentTypeRequests(source)).toEqual({ literals: ['five'], unresolved: [] });
  });

  it('finds nothing in an empty or unterminated script, and never throws', () => {
    for (const source of ['', "const s = 'unterminated", 'const t = `open ${', '/* open', "{ agentType: ", "{ agentType: 'a"]) {
      expect(() => agentTypeRequests(source), source).not.toThrow();
    }
    expect(agentTypeRequests('')).toEqual({ literals: [], unresolved: [] });
  });
});

// Codex round 2, blocker 3: valid JavaScript that spells the key another way must still be seen as a request.
describe('agentTypeRequests: escaped identifiers and a computed template key', () => {
  // The source text holds a real backslash: '\\u0054' in this file is the six characters T in the script.
  it.each([
    ['a four-digit escape', "{ agent\\u0054ype: 'ghost' }"],
    ['a braced escape', "{ agent\\u{54}ype: 'ghost' }"],
    ['a braced escape with leading zeros', "{ agent\\u{000054}ype: 'ghost' }"],
    ['an escape in the first letter', "{ \\u0061gentType: 'ghost' }"],
    ['an escape of every letter', "{ \\u0061\\u0067\\u0065\\u006e\\u0074\\u0054\\u0079\\u0070\\u0065: 'ghost' }"],
    ['a computed template key with no substitution', "{ [`agentType`]: 'ghost' }"],
    ['a computed template key with an escape in its text', "{ [`agent\\u0054ype`]: 'ghost' }"],
    ['a computed key in single quotes with an escape', "{ ['agent\\u0054ype']: 'ghost' }"],
  ])('finds the literal request written with %s', (_label, call) => {
    expect(agentTypeRequests(`const a = await agent('x', ${call})`)).toEqual({ literals: ['ghost'], unresolved: [] });
  });

  it.each([
    ['an escaped bare key', '{ agent\\u0054ype: kind }'],
    ['a braced escaped bare key', '{ agent\\u{54}ype: kind }'],
    ['an escaped shorthand', '{ agent\\u0054ype }'],
    ['a computed template key', '{ [`agentType`]: kind }'],
  ])('lists the unresolved request written with %s', (_label, call) => {
    expect(agentTypeRequests(`const a = await agent('x', ${call})`)).toEqual({ literals: [], unresolved: [1] });
  });

  it.each([
    ['a different escaped name', "{ agent\\u0054yp: 'ghost' }"],
    ['a template key with a substitution', "{ [`agent${'Type'}`]: 'ghost' }"],
    ['a template key with more text', "{ [`agentTypes`]: 'ghost' }"],
    ['an escape that is not a letter of the name', "{ agent\\u0055ype: 'ghost' }"],
  ])('does not take %s for the key', (_label, call) => {
    expect(agentTypeRequests(`const a = await agent('x', ${call})`)).toEqual({ literals: [], unresolved: [] });
  });

  it('reads an escaped identifier as one name, so the code after it keeps its place', () => {
    const source = "const valu\\u0065 = 4 / 2\nconst b = { agentType: 'seen' }";
    expect(agentTypeRequests(source)).toEqual({ literals: ['seen'], unresolved: [] });
  });
});

// Codex round 2, blocker 3: where a `/` starts a regular expression and where it divides.
describe('agentTypeRequests: regular expression or division', () => {
  const EXAMPLE = "{ agentType: 'inside' }";

  it.each([
    ['an if header', "if (ok) /{ agentType: 'inside' }/.test(text)"],
    ['an if header with a nested call', "if (check(a, (b) => b)) /{ agentType: 'inside' }/.test(text)"],
    ['a while header', "while (more()) /{ agentType: 'inside' }/.test(text)"],
    ['a for header', "for (let i = 0; i < 3; i++) /{ agentType: 'inside' }/.test(text)"],
    ['a for-of header', "for (const item of list) /{ agentType: 'inside' }/.test(item)"],
    ['a for await header', "for await (const item of list) /{ agentType: 'inside' }/.test(item)"],
    ['an else-if chain', "if (a) x(); else if (b) /{ agentType: 'inside' }/.test(text)"],
  ])('starts a regular expression after the ) that closes %s, so its text is not code', (_label, statement) => {
    const source = `${statement}\nconst c = ${EXAMPLE.replace('inside', 'seen')}`;
    expect(agentTypeRequests(source)).toEqual({ literals: ['seen'], unresolved: [] });
  });

  it.each([
    ['a postfix ++', 'n++ / 2'],
    ['a postfix --', 'n-- / 2'],
    ['a postfix ++ on a member', 'this.count++ / 2'],
    ['a postfix ++ with a space', 'n ++ / 2'],
  ])('divides after %s, so a request later on the line is still seen', (_label, expression) => {
    const source = `const v = ${expression}, w = agent('x', { agentType: 'ghost' })`;
    expect(agentTypeRequests(source)).toEqual({ literals: ['ghost'], unresolved: [] });
  });

  it('still divides after a ) that does not close a header, and after ] and }', () => {
    const source = [
      "const a = (b + c) / 2, d = agent('x', { agentType: 'one' })",
      "const e = f(g) / 2, h = agent('x', { agentType: 'two' })",
      "const i = j[0] / 2, k = agent('x', { agentType: 'three' })",
      "const l = { m: 1 }.m / 2, n = agent('x', { agentType: 'four' })",
    ].join('\n');
    expect(agentTypeRequests(source).literals).toEqual(['four', 'one', 'three', 'two']);
  });

  it('still starts a regular expression after an operator, a keyword and the start of a statement', () => {
    const source = [
      `/${EXAMPLE}/.test(x)`,
      `const a = b || /${EXAMPLE}/`,
      `const c = d ? /${EXAMPLE}/ : 1`,
      `function f() { return /${EXAMPLE}/ }`,
    ].join('\n');
    expect(agentTypeRequests(source)).toEqual({ literals: [], unresolved: [] });
  });
});

// Codex round 2, blocker 3: a lone CR, U+2028 and U+2029 end a line like LF does; CRLF is one line end.
describe('agentTypeRequests: line terminators', () => {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const terminators: Array<[string, string]> = [['a lone CR', '\r'], ['U+2028', LS], ['U+2029', PS], ['CRLF', '\r\n'], ['LF', '\n']];

  it.each(terminators)('ends a // comment at %s, so the code after it is seen', (_label, end) => {
    const source = `const a = 1 // { agentType: 'inside' }${end}const b = { agentType: 'seen' }`;
    expect(agentTypeRequests(source)).toEqual({ literals: ['seen'], unresolved: [] });
  });

  it.each(terminators)('counts %s as one line in the line numbers of unresolved requests', (_label, end) => {
    const source = ['const a = 1', 'const b = 2', "// note: { agentType: 'inside' }", 'const d = await agent(\'x\', { agentType: kind })'].join(end);
    expect(agentTypeRequests(source)).toEqual({ literals: [], unresolved: [4] });
  });

  it('counts every kind of line end, mixed, once each', () => {
    const source = `a\rb${LS}c${PS}d\r\ne\nf\r\n\r\n{ agentType: kind }`;
    // a, b, c, d, e, f, the empty line and the request: line 8.
    expect(agentTypeRequests(source)).toEqual({ literals: [], unresolved: [8] });
  });

  it('counts the line ends inside a block comment, a string continuation and a template', () => {
    const source = [
      `/* one\rtwo${LS}three${PS}four\r\nfive */`,
      `const s = 'a\\\r\nb\\\rc\\${LS}d'`,
      `const t = \`x\ry${LS}z${PS}w\r\nv\``,
      `{ agentType: kind }`,
    ].join('\n');
    // The comment spans lines 1 to 5, the string 6 to 9, the template 10 to 14 and the request is on line 15.
    expect(agentTypeRequests(source)).toEqual({ literals: [], unresolved: [15] });
  });

  it.each([
    ['CRLF', '\r\n'], ['a lone CR', '\r'], ['U+2028', LS], ['U+2029', PS], ['LF', '\n'],
  ])('joins a string across a backslash and %s (a line continuation) into one value', (_label, end) => {
    const source = `const a = await agent('x', { agentType: 'code-\\${end}reviewer' })\nconst b = { agentType: kind }`;
    expect(agentTypeRequests(source)).toEqual({ literals: ['code-reviewer'], unresolved: [3] });
  });

  it('ends an unterminated string at a lone CR, as at LF', () => {
    const source = "const s = 'open\r{ agentType: 'ghost' }";
    expect(agentTypeRequests(source)).toEqual({ literals: ['ghost'], unresolved: [] });
  });

  it('ends a regular expression at a lone CR, so the code on the next line is seen', () => {
    const source = "const r = /open\r{ agentType: 'ghost' }";
    expect(agentTypeRequests(source)).toEqual({ literals: ['ghost'], unresolved: [] });
  });
});

// ADR 0082: `meta` is read as data. The lint never evaluates it, and a malformed shape is a lint problem, never an exception.
describe('lintWorkflow reads meta as data', () => {
  const PROBE = '__workflowLintMetaRan';
  const probe = (): unknown => (globalThis as Record<string, unknown>)[PROBE];
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>)[PROBE];
  });
  const withMeta = (meta: string): string => `export const meta = ${meta}\n\nreturn 1\n`;

  it.each([
    ['phases that is an empty object', "{ name: 'a', description: 'b', phases: {} }"],
    ['phases that is a string', "{ name: 'a', description: 'b', phases: 'Find' }"],
    ['phases that is null', "{ name: 'a', description: 'b', phases: null }"],
    ['a null phase entry', "{ name: 'a', description: 'b', phases: [null] }"],
    ['a phase entry that is not an object', "{ name: 'a', description: 'b', phases: ['Find'] }"],
    ['a phase entry without a title', "{ name: 'a', description: 'b', phases: [{}] }"],
    ['a phase title that is not a string', "{ name: 'a', description: 'b', phases: [{ title: 1 }] }"],
  ])('reports %s as a problem and does not throw', (_label, meta) => {
    const problems = lintWorkflow(withMeta(meta));
    expect(problems.join('\n')).toMatch(/meta\.phases/);
  });

  it.each([
    ['a getter', `{ name: 'a', description: 'b', get phases() { globalThis.${PROBE} = true; throw new Error('boom') } }`],
    ['a toString and valueOf trap', `{ name: 'a', description: 'b', phases: [{ title: { toString() { globalThis.${PROBE} = true; throw new Error('boom') }, valueOf() { throw new Error('boom') } } }] }`],
    ['a non-literal value', `{ name: ['a', 'b'].join('-'), description: 'b' }`],
    ['an identifier value', `{ name: 'a', description: undefined }`],
    ['a __proto__ key', `{ name: 'a', description: 'b', __proto__: { phases: 5 } }`],
    ['a quoted __proto__ key', `{ name: 'a', description: 'b', '__proto__': { phases: 5 } }`],
    ['a method', `{ name: 'a', description: 'b', phases() { return [] } }`],
    ['a spread', `{ name: 'a', ...globalThis }`],
    ['a computed key', `{ name: 'a', description: 'b', ['x' + 'y']: 1 }`],
  ])('reports %s as a pure-literal problem, never evaluates it and does not throw', (_label, meta) => {
    const spy = vi.spyOn(vm, 'runInNewContext');
    const problems = lintWorkflow(withMeta(meta));
    expect(problems.join('\n')).toMatch(/pure literal/);
    expect(spy).not.toHaveBeenCalled();
    expect(probe()).toBeUndefined();
    expect(workflowMetaName(withMeta(meta))).toBeUndefined();
  });

  it('does not evaluate a well-formed meta either', () => {
    const spy = vi.spyOn(vm, 'runInNewContext');
    expect(lintWorkflow(GOOD)).toEqual([]);
    expect(workflowMetaName(GOOD)).toBe('demo-flow');
    expect(spy).not.toHaveBeenCalled();
  });

  it('accepts a meta with quoted keys, comments, trailing commas and a backtick string', () => {
    const meta = "{ 'name': \"a\", // the name\n  description: `b`, /* phases */ phases: [{ 'title': 'Find', },], }";
    expect(lintWorkflow(`export const meta = ${meta}\nphase('Find')\n`)).toEqual([]);
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
