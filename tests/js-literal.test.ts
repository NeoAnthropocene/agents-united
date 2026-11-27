/**
 * ADR 0082: the strict literal parser that reads a workflow's `meta` as data. It must accept exactly the plain data a
 * `meta` literal holds and must never evaluate anything: a getter, a method, a call or a coercion hook is a parse failure.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { parseJsLiteral } from '../src/core/js-literal.js';

const PROBE = '__jsLiteralRan';
const probe = (): unknown => (globalThis as Record<string, unknown>)[PROBE];
afterEach(() => { delete (globalThis as Record<string, unknown>)[PROBE]; });

const parsed = (text: string): unknown => {
  const result = parseJsLiteral(text);
  if (!result.ok) throw new Error(`expected a literal, got: ${result.message}`);
  return result.value;
};
const failure = (text: string): string => {
  const result = parseJsLiteral(text);
  if (result.ok) throw new Error(`expected a parse failure for ${text}`);
  return result.message;
};

describe('parseJsLiteral: what it accepts', () => {
  it('reads objects with bare and quoted keys, arrays, strings of every quote, numbers, booleans and null', () => {
    expect(parsed(`{ name: 'a', "description": "b", 'k-2': \`c\`, list: [1, -2, 3.5, .5, 1e3, 0x1f, true, false, null], nested: { deep: [] } }`)).toEqual({
      name: 'a', description: 'b', 'k-2': 'c', list: [1, -2, 3.5, 0.5, 1000, 31, true, false, null], nested: { deep: [] },
    });
  });

  it('allows comments, trailing commas and keywords or $ and _ as bare keys', () => {
    expect(parsed(`{ // one\n  if: 1, /* two */ $x: 2, _y: [1, 2,],\n}`)).toEqual({ if: 1, $x: 2, _y: [1, 2] });
  });

  it('decodes the standard string escapes and a line continuation', () => {
    const value = parsed(`{ s: 'a\\nb\\t\\x41\\u0042\\u{1F600}\\'\\\\\\q', t: "x\\\ny", u: \`l1\nl2\` }`) as Record<string, string>;
    expect(value.s).toBe(`a\nb\tAB${String.fromCodePoint(0x1f600)}'\\q`);
    expect(value.t).toBe('xy');
    expect(value.u).toBe('l1\nl2');
  });

  it('returns objects with no prototype, so no coercion or inherited key can run', () => {
    const value = parsed(`{ toString: 'x', valueOf: 'y', constructor: 1, hasOwnProperty: 2, nested: { a: 1 } }`) as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.getPrototypeOf(value.nested)).toBeNull();
    expect(value.toString).toBe('x');
    expect(value.constructor).toBe(1);
    expect(Object.keys(value)).toEqual(['toString', 'valueOf', 'constructor', 'hasOwnProperty', 'nested']);
  });

  it('lets a later duplicate key win, as an object literal does', () => {
    expect(parsed(`{ a: 1, a: 2 }`)).toEqual({ a: 2 });
  });
});

describe('parseJsLiteral: what it refuses, and it never runs anything', () => {
  it.each([
    ['an identifier value', `{ name: foo }`],
    ['undefined', `{ name: undefined }`],
    ['NaN', `{ n: NaN }`],
    ['Infinity', `{ n: Infinity }`],
    ['a call', `{ name: String('x') }`],
    ['a method call on a literal', `{ name: ['a', 'b'].join('-') }`],
    ['new', `{ name: new String('x') }`],
    ['a spread', `{ ...other }`],
    ['an array spread', `{ list: [...other] }`],
    ['a getter', `{ get name() { return 'x' } }`],
    ['a setter', `{ set name(v) {} }`],
    ['a method', `{ name() { return 1 } }`],
    ['an async method', `{ async name() {} }`],
    ['a generator method', `{ *name() {} }`],
    ['a shorthand property', `{ name }`],
    ['a computed key', `{ [key]: 1 }`],
    ['a computed string key', `{ ['name']: 1 }`],
    ['a numeric key', `{ 1: 'a' }`],
    ['a bare __proto__ key', `{ __proto__: { phases: 5 } }`],
    ['a quoted __proto__ key', `{ '__proto__': {} }`],
    ['a template with interpolation', '{ name: `a ${b}` }'],
    ['an arrow function', `{ run: () => 1 }`],
    ['a function expression', `{ run: function () {} }`],
    ['a regular expression', `{ re: /x/ }`],
    ['an expression', `{ n: 1 + 1 }`],
    ['a unary expression', `{ n: !0 }`],
    ['a ternary', `{ n: true ? 1 : 2 }`],
    ['an array hole', `{ list: [1, , 2] }`],
    ['a missing value', `{ a: }`],
    ['a missing colon', `{ a 1 }`],
    ['an unterminated string', `{ a: 'x }`],
    ['a raw newline in a quoted string', `{ a: 'x\ny' }`],
    ['an unterminated comment', `{ a: 1 /* }`],
    ['an unterminated object', `{ a: 1`],
    ['text after the literal', `{ a: 1 } x`],
    ['an empty text', ``],
    ['a legacy octal escape', `{ a: '\\1' }`],
    ['a bad unicode escape', `{ a: '\\u12' }`],
    ['a number glued to an identifier', `{ a: 1abc }`],
  ])('fails %s', (_label, text) => {
    expect(failure(text)).not.toBe('');
  });

  it('fails an input nested deeper than any workflow needs, without overflowing the stack', () => {
    expect(failure(`${'['.repeat(5000)}${']'.repeat(5000)}`)).toMatch(/nest/i);
  });

  it('never runs a getter, a method or a coercion hook', () => {
    for (const text of [
      `{ get x() { globalThis.${PROBE} = true; return 1 } }`,
      `{ x: { toString() { globalThis.${PROBE} = true; return 'a' }, valueOf() { globalThis.${PROBE} = true } } }`,
      `{ x: (globalThis.${PROBE} = true) }`,
      `{ x: globalThis.${PROBE} = true }`,
      `{ [globalThis.${PROBE} = true]: 1 }`,
    ]) {
      expect(parseJsLiteral(text).ok, text).toBe(false);
      expect(probe(), text).toBeUndefined();
    }
  });

  it('names the problem and where it is', () => {
    expect(failure(`{ name: foo }`)).toMatch(/foo/);
    expect(failure(`{\n  get name() {}\n}`)).toMatch(/line 2/);
  });
});
