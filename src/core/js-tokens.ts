/**
 * ADR 0082: a small lexer for JavaScript, enough to find a property key in code without being fooled by comments, strings,
 * template text or regular expressions. It never evaluates anything and never throws: an unterminated string, comment or
 * template ends at the end of its line or the text.
 *
 * It is a lexer, not a parser. The one ambiguity it settles by a rule is `/`: it starts a regular expression when the token
 * before it cannot end an expression (a punctuator other than `)`, `]` or `}`, a keyword such as `return`, or nothing), and is
 * a division otherwise. The code inside a template's `${...}` is lexed too, as a list of its own, so a key written there is seen.
 */

export interface JsToken {
  kind: 'ident' | 'string' | 'template' | 'number' | 'regex' | 'punct';
  /** The source text of the token (for a string or template, the text between the quotes, undecoded). */
  text: string;
  /** For a string or template: the text with the standard escapes decoded. */
  value: string;
  /** For a template: whether it has a `${...}` interpolation. */
  interpolated: boolean;
  /** 1-based line of the token's start. */
  line: number;
}

/** Keywords after which a `/` starts a regular expression rather than dividing. */
const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const IDENT_START = /[\p{ID_Start}$_]/u;
const IDENT_PART = /[\p{ID_Continue}$‌‍]/u;
/** Templates nested deeper than this are read as text from the inner `${` on, which stops a recursion bomb. */
const MAX_TEMPLATE_DEPTH = 32;

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
    else if (next === '\n') continue;
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

  const push = (list: JsToken[], kind: JsToken['kind'], text: string, startLine: number, value = text, interpolated = false): void => {
    list.push({ kind, text, value, interpolated, line: startLine });
  };

  function skipBlockComment(): void {
    const end = source.indexOf('*/', index + 2);
    const stop = end < 0 ? length : end + 2;
    for (let i = index; i < stop; i++) if (source[i] === '\n') line++;
    index = stop;
  }

  function quoted(list: JsToken[], quote: string): void {
    const start = index;
    const startLine = line;
    index++;
    while (index < length && source[index] !== quote && source[index] !== '\n') {
      if (source[index] === '\\' && index + 1 < length) {
        if (source[index + 1] === '\n') line++;
        index++;
      }
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
    while (index < length && source[index] !== '\n') {
      const char = source[index];
      if (char === '\\') { index += 2; continue; }
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
        if (source[index + 1] === '\n') line++;
        text += char + source[index + 1];
        index += 2;
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
      if (char === '\n') line++;
      text += char;
      index++;
    }
    push(list, 'template', text, startLine, cook(text), interpolated);
  }

  /** Lexes into `list` until the end of the text or, when `nested`, the `}` that closes the interpolation. */
  function code(list: JsToken[], nested: boolean, depth: number): void {
    let braces = 0;
    while (index < length) {
      const char = source[index];
      const next = source[index + 1];
      if (char === '\n') { line++; index++; continue; }
      if (char === ' ' || char === '\t' || char === '\r' || char === '\v' || char === '\f' || char === String.fromCharCode(0xa0) || char === String.fromCharCode(0xfeff)) { index++; continue; }
      if (char === '/' && next === '/') {
        while (index < length && source[index] !== '\n') index++;
        continue;
      }
      if (char === '/' && next === '*') { skipBlockComment(); continue; }
      if (IDENT_START.test(char)) {
        const start = index;
        index++;
        while (index < length && IDENT_PART.test(source[index])) index++;
        push(list, 'ident', source.slice(start, index), line);
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
          || (before.kind === 'punct' && !')]}'.includes(before.text))
          || (before.kind === 'ident' && REGEX_AFTER.has(before.text));
        if (startsRegex) { regex(list); continue; }
      }
      push(list, 'punct', char, line);
      index++;
    }
  }

  const main: JsToken[] = [];
  lists.push(main);
  code(main, false, 0);
  return lists;
}
