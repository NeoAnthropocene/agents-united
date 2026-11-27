/**
 * ADR 0082: a small lexer for JavaScript, enough to find a property key in code without being fooled by comments, strings,
 * template text or regular expressions. It never evaluates anything and never throws: an unterminated string, comment or
 * template ends at the end of its line or the text.
 *
 * It is a lexer, not a parser. The one ambiguity it settles by a rule is `/`: it starts a regular expression when the token
 * before it cannot end an expression (a punctuator other than `)`, `]`, `}`, `++` or `--`, a keyword such as `return`, or
 * nothing) or is the `)` that closes the header of an `if`, `while`, `for` or `with`, and is a division otherwise. The rule is a
 * heuristic with a stated limit: a `/` after a `}` that closes a block (a statement that starts with a regular expression) is
 * read as a division, and a `/` after a `)` that closes a parenthesised expression that is not such a header is a division. The code inside a template's `${...}` is lexed too, as a list
 * of its own, so a key written there is seen.
 */

export interface JsToken {
  kind: 'ident' | 'string' | 'template' | 'number' | 'regex' | 'punct';
  /** The source text of the token (for a string or template, the text between the quotes, undecoded). */
  text: string;
  /** For a string or template: the text with the standard escapes decoded. For an identifier: the name with `\u` escapes decoded. */
  value: string;
  /** For a template: whether it has a `${...}` interpolation. */
  interpolated: boolean;
  /** 1-based line of the token's start. */
  line: number;
}

/** Keywords after which a `/` starts a regular expression rather than dividing. */
const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
/** Keywords whose parenthesised header is followed by a statement, which may start with a regular expression. */
const HEADER_KEYWORDS = new Set(['if', 'while', 'for', 'with']);
/** Punctuators after which a `/` divides: the closers of a group, an index or a block or object, and the postfix operators. */
const POSTFIX_OR_CLOSE = new Set([']', '}', '++', '--']);
const IDENT_START = /[\p{ID_Start}$_]/u;
const IDENT_PART = /[\p{ID_Continue}$‌‍]/u;
/** Templates nested deeper than this are read as text from the inner `${` on, which stops a recursion bomb. */
const MAX_TEMPLATE_DEPTH = 32;

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const SIMPLE = new Map<string, string>([['n', '\n'], ['r', '\r'], ['t', '\t'], ['b', '\b'], ['f', '\f'], ['v', '\v'], ['0', String.fromCharCode(0)]]);

/** The value of a string body: the standard escapes decoded, anything unknown kept as the character after the backslash. */
function cook(body: string): string {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char !== '\\' || i + 1 >= body.length) { out += char; continue; }
    i++;
    const next = body[i];
    const simple = SIMPLE.get(next);
    if (simple !== undefined) out += simple;
    else if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(body.slice(i + 1, i + 3))) { out += String.fromCharCode(parseInt(body.slice(i + 1, i + 3), 16)); i += 2; }
    else if (next === 'u' && body[i + 1] === '{' && /^\{[0-9a-fA-F]{1,6}\}/.test(body.slice(i + 1))) {
      const close = body.indexOf('}', i);
      const code = parseInt(body.slice(i + 2, close), 16);
      out += code <= 0x10ffff ? String.fromCodePoint(code) : '';
      i = close;
    } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(body.slice(i + 1, i + 5))) { out += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16)); i += 4; }
    else if (next === '\r') { if (body[i + 1] === '\n') i++; }
    else if (next === '\n' || next === LINE_SEPARATOR || next === PARAGRAPH_SEPARATOR) continue;
    else out += next;
  }
  return out;
}

/** The tokens of `source`: the main list first, then one list for each template interpolation, in the order they occur. */
export function tokenizeJs(source: string): JsToken[][] {
  const lists: JsToken[][] = [];
  const length = source.length;
  let index = 0;
  let line = 1;

  /** The length of the line terminator at `at`: 2 for CRLF, 1 for LF, a lone CR, U+2028 or U+2029, else 0. */
  const eolAt = (at: number): number => {
    const char = source[at];
    if (char === '\n' || char === LINE_SEPARATOR || char === PARAGRAPH_SEPARATOR) return 1;
    if (char === '\r') return source[at + 1] === '\n' ? 2 : 1;
    return 0;
  };

  const push = (list: JsToken[], kind: JsToken['kind'], text: string, startLine: number, value = text, interpolated = false): void => {
    list.push({ kind, text, value, interpolated, line: startLine });
  };

  function skipBlockComment(): void {
    const end = source.indexOf('*/', index + 2);
    const stop = end < 0 ? length : end + 2;
    for (let i = index; i < stop;) {
      const size = eolAt(i);
      if (size > 0) line++;
      i += size > 0 ? size : 1;
    }
    index = stop;
  }

  /**
   * An identifier starting at `index`, as its source text and its name with `\uXXXX` and `\u{...}` escapes decoded, or undefined
   * when none starts here. Moves `index` past it. A code point above U+FFFF is one character (an astral identifier).
   */
  function readIdentifier(): { raw: string; name: string } | undefined {
    let at = index;
    let name = '';
    while (at < length) {
      let part: string;
      let size: number;
      if (source[at] === '\\') {
        if (source[at + 1] !== 'u') break;
        const braced = source[at + 2] === '{';
        const close = braced ? source.indexOf('}', at + 3) : at + 6;
        const digits = braced ? source.slice(at + 3, close < 0 ? at + 3 : close) : source.slice(at + 2, at + 6);
        if (!/^[0-9a-fA-F]+$/.test(digits) || (braced ? digits.length > 10 || close < 0 : digits.length !== 4)) break;
        const code = parseInt(digits, 16);
        if (code > 0x10ffff) break;
        part = String.fromCodePoint(code);
        size = braced ? close + 1 - at : 6;
      } else {
        part = String.fromCodePoint(source.codePointAt(at) as number);
        size = part.length;
      }
      if (!(at === index ? IDENT_START : IDENT_PART).test(part)) break;
      name += part;
      at += size;
    }
    if (at === index) return undefined;
    const raw = source.slice(index, at);
    index = at;
    return { raw, name };
  }

  function quoted(list: JsToken[], quote: string): void {
    const start = index;
    const startLine = line;
    index++;
    while (index < length && source[index] !== quote && source[index] !== '\n' && source[index] !== '\r') {
      if (source[index] === '\\' && index + 1 < length) {
        // A backslash before a line end is a line continuation (CRLF is one); before anything else it escapes that one character.
        const size = eolAt(index + 1);
        if (size > 0) line++;
        index += 1 + (size > 0 ? size : 1);
        continue;
      }
      if (eolAt(index) > 0) line++;
      index++;
    }
    const body = source.slice(start + 1, index);
    if (source[index] === quote) index++;
    push(list, 'string', body, startLine, cook(body));
  }

  function regex(list: JsToken[]): void {
    const start = index;
    index++;
    let inClass = false;
    while (index < length && eolAt(index) === 0) {
      const char = source[index];
      if (char === '\\') {
        if (eolAt(index + 1) > 0) break;
        index += 2;
        continue;
      }
      if (char === '[') inClass = true;
      else if (char === ']') inClass = false;
      else if (char === '/' && !inClass) { index++; break; }
      index++;
    }
    while (index < length && IDENT_PART.test(source[index])) index++;
    push(list, 'regex', source.slice(start, index), line);
  }

  function template(list: JsToken[], depth: number): void {
    const startLine = line;
    index++;
    let text = '';
    let interpolated = false;
    while (index < length) {
      const char = source[index];
      if (char === '`') { index++; break; }
      if (char === '\\' && index + 1 < length) {
        const size = eolAt(index + 1);
        if (size > 0) line++;
        const taken = size > 0 ? size : 1;
        text += source.slice(index, index + 1 + taken);
        index += 1 + taken;
        continue;
      }
      if (char === '$' && source[index + 1] === '{' && depth < MAX_TEMPLATE_DEPTH) {
        interpolated = true;
        index += 2;
        const inner: JsToken[] = [];
        lists.push(inner);
        code(inner, true, depth + 1);
        continue;
      }
      const size = eolAt(index);
      if (size > 0) line++;
      text += source.slice(index, index + Math.max(size, 1));
      index += Math.max(size, 1);
    }
    push(list, 'template', text, startLine, cook(text), interpolated);
  }

  /** Lexes into `list` until the end of the text or, when `nested`, the `}` that closes the interpolation. */
  function code(list: JsToken[], nested: boolean, depth: number): void {
    let braces = 0;
    /** One entry per open `(`: whether it opens the header of an `if`, `while`, `for` or `with`. */
    const parens: boolean[] = [];
    /** The `)` tokens that close such a header: a `/` after one starts a regular expression, not a division. */
    const headerCloses = new Set<JsToken>();
    while (index < length) {
      const char = source[index];
      const next = source[index + 1];
      const lineEnd = eolAt(index);
      if (lineEnd > 0) { line++; index += lineEnd; continue; }
      if (char === ' ' || char === '\t' || char === '\v' || char === '\f' || char === String.fromCharCode(0xa0) || char === String.fromCharCode(0xfeff)) { index++; continue; }
      if (char === '/' && next === '/') {
        while (index < length && eolAt(index) === 0) index++;
        continue;
      }
      if (char === '/' && next === '*') { skipBlockComment(); continue; }
      const ident = readIdentifier();
      if (ident !== undefined) {
        push(list, 'ident', ident.raw, line, ident.name);
        continue;
      }
      if (char >= '0' && char <= '9') {
        const start = index;
        while (index < length && /[\w.]/.test(source[index])) index++;
        push(list, 'number', source.slice(start, index), line);
        continue;
      }
      if (char === "'" || char === '"') { quoted(list, char); continue; }
      if (char === '`') { template(list, depth); continue; }
      if (char === '{') braces++;
      if (char === '}') {
        if (nested && braces === 0) { index++; return; }
        braces--;
      }
      if (char === '/') {
        const before = list[list.length - 1];
        const startsRegex = before === undefined
          || (before.kind === 'punct' && (before.text === ')' ? headerCloses.has(before) : !POSTFIX_OR_CLOSE.has(before.text)))
          || (before.kind === 'ident' && REGEX_AFTER.has(before.value));
        if (startsRegex) { regex(list); continue; }
      }
      if ((char === '+' || char === '-') && next === char) {
        // `++` and `--` are one token, so a `/` after one is a division (`n++ / 2`): a postfix operator ends an expression.
        push(list, 'punct', char + char, line);
        index += 2;
        continue;
      }
      push(list, 'punct', char, line);
      if (char === '(') {
        const before = list[list.length - 2];
        const beforeThat = list[list.length - 3];
        const property = before !== undefined && beforeThat?.kind === 'punct' && beforeThat.text === '.';
        const keyword = before?.kind === 'ident' && !property && HEADER_KEYWORDS.has(before.value);
        const forAwait = before?.kind === 'ident' && before.value === 'await' && beforeThat?.kind === 'ident' && beforeThat.value === 'for';
        parens.push(keyword || forAwait);
      } else if (char === ')') {
        if (parens.pop() === true) headerCloses.add(list[list.length - 1]);
      }
      index++;
    }
  }

  const main: JsToken[] = [];
  lists.push(main);
  code(main, false, 0);
  return lists;
}
