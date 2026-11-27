/**
 * ADR 0082: a strict parser for a JavaScript literal, used to read a workflow's `export const meta = { ... }` as data.
 *
 * Nothing here evaluates anything. The text is parsed character by character into plain data: objects with quoted
 * (`'a'`, `"a"`) or bare identifier keys, arrays, strings (single, double or backtick quotes, the standard escapes, a
 * backtick string without `${`), numbers, `true`, `false` and `null`, with comments and trailing commas allowed.
 * Everything else is a parse failure: an identifier as a value, a call, a spread, a getter, a setter, a method, a shorthand
 * or computed key, a numeric key, a `__proto__` key, a template interpolation, an array hole, a nesting deeper than any
 * workflow needs. Objects come back with no prototype, so no inherited key can be found and no coercion (`toString`,
 * `valueOf`) can exist on a value. Pure: no terminal I/O, no file system.
 */

export type JsLiteral = null | boolean | number | string | JsLiteral[] | JsLiteralObject;
/** An object read from a literal. It has no prototype (`Object.create(null)`). */
export interface JsLiteralObject { [key: string]: JsLiteral }

export type JsLiteralResult = { ok: true; value: JsLiteral } | { ok: false; message: string };

/** A workflow `meta` is two levels deep (`phases[].title`); this leaves ample room and stops a recursion bomb. */
const MAX_DEPTH = 32;
const WHITESPACE = new Set([' ', '\t', '\n', '\r', '\v', '\f', String.fromCharCode(0xa0), String.fromCharCode(0xfeff), String.fromCharCode(0x2028), String.fromCharCode(0x2029)]);
const LINE_ENDS = new Set(['\n', '\r', String.fromCharCode(0x2028), String.fromCharCode(0x2029)]);
const IDENT_START = /[\p{ID_Start}$_]/u;
const IDENT_PART = /[\p{ID_Continue}$‌‍]/u;
const NUMBER = /(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
const SINGLE_ESCAPES = new Map<string, string>([['n', '\n'], ['r', '\r'], ['t', '\t'], ['b', '\b'], ['f', '\f'], ['v', '\v']]);

class LiteralError extends Error {}

class Reader {
  private index = 0;
  constructor(private readonly text: string) {}

  /** The line (1-based) of a position, for messages. */
  private lineAt(position: number): number {
    let line = 1;
    for (let i = 0; i < position && i < this.text.length; i++) if (this.text[i] === '\n') line++;
    return line;
  }

  private fail(message: string, at: number = this.index): never {
    throw new LiteralError(`${message} (line ${this.lineAt(at)})`);
  }

  private peek(): string | undefined { return this.text[this.index]; }

  private skipTrivia(): void {
    for (;;) {
      const char = this.text[this.index];
      if (char !== undefined && WHITESPACE.has(char)) { this.index++; continue; }
      if (char === '/' && this.text[this.index + 1] === '/') {
        while (this.index < this.text.length && !LINE_ENDS.has(this.text[this.index])) this.index++;
        continue;
      }
      if (char === '/' && this.text[this.index + 1] === '*') {
        const start = this.index;
        const end = this.text.indexOf('*/', this.index + 2);
        if (end < 0) this.fail('unterminated comment', start);
        this.index = end + 2;
        continue;
      }
      return;
    }
  }

  parseAll(): JsLiteral {
    this.skipTrivia();
    if (this.index >= this.text.length) this.fail('expected a value, found the end of the text');
    const value = this.value(0);
    this.skipTrivia();
    if (this.index < this.text.length) this.fail(`unexpected ${this.describeHere()} after the literal`);
    return value;
  }

  private describeHere(): string {
    const rest = this.text.slice(this.index, this.index + 20).replace(/\s+/g, ' ');
    return JSON.stringify(rest.length < 20 ? rest : `${rest}...`);
  }

  private value(depth: number): JsLiteral {
    if (depth > MAX_DEPTH) this.fail(`the literal is nested more than ${MAX_DEPTH} levels deep`);
    this.skipTrivia();
    const char = this.peek();
    if (char === undefined) this.fail('expected a value, found the end of the text');
    if (char === '{') return this.object(depth);
    if (char === '[') return this.array(depth);
    if (char === "'" || char === '"') return this.quoted(char);
    if (char === '`') return this.template();
    if (char === '-' || char === '+' || char === '.' || (char >= '0' && char <= '9')) return this.number();
    if (IDENT_START.test(char)) {
      const word = this.identifier();
      if (word === 'true') return true;
      if (word === 'false') return false;
      if (word === 'null') return null;
      return this.fail(`${JSON.stringify(word)} is not a literal value (no variables, calls, spreads or functions)`, this.index - word.length);
    }
    return this.fail(`unexpected ${this.describeHere()}; expected a literal value`);
  }

  private identifier(): string {
    const start = this.index;
    this.index++;
    while (this.index < this.text.length && IDENT_PART.test(this.text[this.index])) this.index++;
    return this.text.slice(start, this.index);
  }

  private number(): number {
    const start = this.index;
    let sign = 1;
    if (this.text[this.index] === '-' || this.text[this.index] === '+') {
      sign = this.text[this.index] === '-' ? -1 : 1;
      this.index++;
    }
    NUMBER.lastIndex = this.index;
    const match = NUMBER.exec(this.text);
    if (!match) return this.fail(`${JSON.stringify(this.text.slice(start, start + 12))} is not a number`, start);
    this.index += match[0].length;
    const next = this.text[this.index];
    if (next !== undefined && (IDENT_PART.test(next) || next === '.')) this.fail(`${JSON.stringify(this.text.slice(start, this.index + 1))} is not a number`, start);
    const value = sign * Number(match[0]);
    if (!Number.isFinite(value)) this.fail(`${JSON.stringify(match[0])} is not a finite number`, start);
    return value;
  }

  private array(depth: number): JsLiteral[] {
    const items: JsLiteral[] = [];
    this.index++;
    for (;;) {
      this.skipTrivia();
      const char = this.peek();
      if (char === undefined) this.fail('unterminated array');
      if (char === ']') { this.index++; return items; }
      if (char === ',') this.fail('an array hole (a missing element) is not allowed');
      items.push(this.value(depth + 1));
      this.skipTrivia();
      const after = this.peek();
      if (after === ',') { this.index++; continue; }
      if (after === ']') { this.index++; return items; }
      this.fail(after === undefined ? 'unterminated array' : `unexpected ${this.describeHere()} in an array; expected "," or "]"`);
    }
  }

  private object(depth: number): JsLiteralObject {
    const result: JsLiteralObject = Object.create(null) as JsLiteralObject;
    this.index++;
    for (;;) {
      this.skipTrivia();
      const char = this.peek();
      if (char === undefined) this.fail('unterminated object');
      if (char === '}') { this.index++; return result; }
      const keyAt = this.index;
      const key = this.key();
      this.skipTrivia();
      if (this.peek() !== ':') {
        this.fail(`the key ${JSON.stringify(key)} is not followed by ":"; only \`key: value\` pairs are allowed (no getters, setters, methods or shorthand properties)`, keyAt);
      }
      this.index++;
      result[key] = this.value(depth + 1);
      this.skipTrivia();
      const after = this.peek();
      if (after === ',') { this.index++; continue; }
      if (after === '}') { this.index++; return result; }
      this.fail(after === undefined ? 'unterminated object' : `unexpected ${this.describeHere()} in an object; expected "," or "}"`);
    }
  }

  private key(): string {
    const char = this.peek() as string;
    const at = this.index;
    let key: string;
    if (char === "'" || char === '"') key = this.quoted(char);
    else if (IDENT_START.test(char)) key = this.identifier();
    else return this.fail(`unexpected ${this.describeHere()}; a key must be a bare identifier or a quoted string (no computed, numeric or spread keys)`);
    if (key === '__proto__') this.fail('the key "__proto__" is not allowed', at);
    return key;
  }

  private quoted(quote: string): string {
    const start = this.index;
    this.index++;
    let out = '';
    for (;;) {
      const char = this.text[this.index];
      if (char === undefined || char === '\n' || char === '\r') this.fail('unterminated string', start);
      this.index++;
      if (char === quote) return out;
      out += char === '\\' ? this.escape(start) : char;
    }
  }

  private template(): string {
    const start = this.index;
    this.index++;
    let out = '';
    for (;;) {
      const char = this.text[this.index];
      if (char === undefined) this.fail('unterminated template string', start);
      this.index++;
      if (char === '`') return out;
      if (char === '$' && this.text[this.index] === '{') this.fail('a template string with ${...} interpolation is not a literal', this.index - 1);
      out += char === '\\' ? this.escape(start) : char;
    }
  }

  /** Reads what follows a backslash (the backslash is consumed) and returns the characters it stands for. */
  private escape(stringStart: number): string {
    const char = this.text[this.index];
    if (char === undefined) this.fail('unterminated string', stringStart);
    this.index++;
    const single = SINGLE_ESCAPES.get(char);
    if (single !== undefined) return single;
    if (char === '\r') {
      if (this.text[this.index] === '\n') this.index++;
      return '';
    }
    if (LINE_ENDS.has(char)) return '';
    if (char === '0') {
      const next = this.text[this.index];
      if (next !== undefined && next >= '0' && next <= '9') this.fail('a legacy octal escape is not allowed');
      return String.fromCharCode(0);
    }
    if (char >= '1' && char <= '9') this.fail('a legacy octal escape is not allowed');
    if (char === 'x') return String.fromCharCode(this.hex(2));
    if (char === 'u') {
      if (this.text[this.index] === '{') {
        const close = this.text.indexOf('}', this.index);
        const digits = close < 0 ? '' : this.text.slice(this.index + 1, close);
        if (!/^[0-9a-fA-F]{1,6}$/.test(digits) || parseInt(digits, 16) > 0x10ffff) this.fail('a bad \\u{...} escape');
        this.index = close + 1;
        return String.fromCodePoint(parseInt(digits, 16));
      }
      return String.fromCharCode(this.hex(4));
    }
    return char;
  }

  private hex(count: number): number {
    const digits = this.text.slice(this.index, this.index + count);
    if (digits.length !== count || !/^[0-9a-fA-F]+$/.test(digits)) this.fail(`a bad escape: expected ${count} hexadecimal digits`);
    this.index += count;
    return parseInt(digits, 16);
  }
}

/** Parses `text` as one literal. Never evaluates it; a failure carries a message with the line number. */
export function parseJsLiteral(text: string): JsLiteralResult {
  try {
    return { ok: true, value: new Reader(text).parseAll() };
  } catch (error) {
    if (error instanceof LiteralError) return { ok: false, message: error.message };
    throw error;
  }
}
