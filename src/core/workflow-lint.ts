import { parseJsLiteral, type JsLiteralObject } from './js-literal.js';
import { tokenizeJs } from './js-tokens.js';

/**
 * Plan 032 — maintainers' lint for a Claude dynamic workflow script, from the host's own rules (host-library/claude/guide/
 * orchestration.md, which cites the bundled /workflow-authoring reference): plain JavaScript, `export const meta` as the first
 * statement and a pure literal, phase titles that match, no module loading, and none of the calls that break resume.
 * Returns the problems found; an empty list means the script is acceptable.
 *
 * ADR 0082: this lint lives in `src/core/` so that `agents workflow-check` applies the one lint the repository already holds
 * its own workflows to. The script is never run: `meta` is parsed as data by the strict literal parser (`js-literal.ts`, nothing
 * in it is evaluated), and the body is only compiled as an async function body. Pure: no terminal I/O.
 */

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => unknown;

/** Names the runtime provides to a script body. */
const RUNTIME_GLOBALS = ['agent', 'pipeline', 'parallel', 'phase', 'log', 'args', 'budget', 'workflow'];

/** The text of the object literal assigned to `meta`, found by matching braces outside strings and comments. */
export function extractMetaLiteral(source: string): { literal: string; end: number } | undefined {
  const head = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*export\s+const\s+meta\s*=\s*/.exec(source);
  if (!head) return undefined;
  const start = head[0].length;
  if (source[start] !== '{') return undefined;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      for (i++; i < source.length && source[i] !== quote; i++) if (source[i] === '\\') i++;
    } else if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (char === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2);
      if (i < 0) return undefined;
      i++;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return { literal: source.slice(start, i + 1), end: i + 1 };
    }
  }
  return undefined;
}

const isObject = (value: unknown): value is JsLiteralObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `meta` read as data (the strict parser in `js-literal.ts`; nothing is evaluated). A text that is not a pure literal gives
 * one problem and an empty meta. The values are plain data with no prototype: they are only ever checked with `typeof`,
 * never coerced, so no getter, `toString` or `valueOf` can exist or run.
 */
function readMeta(literal: string): { meta: JsLiteralObject; problems: string[] } {
  const parsed = parseJsLiteral(literal);
  if (!parsed.ok || !isObject(parsed.value)) {
    const why = parsed.ok ? 'it is not an object' : parsed.message;
    return {
      meta: Object.create(null) as JsLiteralObject,
      problems: [`\`meta\` must be a pure literal (strings, numbers, booleans, null, arrays and objects with plain keys; no variables, calls, spreads, functions, getters or template interpolation): ${why}.`],
    };
  }
  return { meta: parsed.value, problems: [] };
}

/** The titles of well-formed `meta.phases` entries, and whether `phases` was malformed (present but not a list of objects that each have a string title). */
function readPhases(meta: JsLiteralObject): { titles: string[]; malformed: boolean } {
  const phases = meta.phases;
  if (phases === undefined) return { titles: [], malformed: false };
  if (!Array.isArray(phases)) return { titles: [], malformed: true };
  const titles: string[] = [];
  let malformed = false;
  for (const entry of phases) {
    if (isObject(entry) && typeof entry.title === 'string') titles.push(entry.title);
    else malformed = true;
  }
  return { titles, malformed };
}

/**
 * `meta.name` of a script whose `meta` is a pure literal, or `undefined` when there is no `meta` literal, it is not pure
 * (the lint reports that) or `name` is not a string. The script is parsed, never run.
 */
export function workflowMetaName(source: string): string | undefined {
  const found = extractMetaLiteral(source.replace(/\r\n/g, '\n'));
  if (!found) return undefined;
  const read = readMeta(found.literal);
  if (read.problems.length > 0) return undefined;
  return typeof read.meta.name === 'string' ? read.meta.name : undefined;
}

export function lintWorkflow(source: string): string[] {
  const problems: string[] = [];
  const text = source.replace(/\r\n/g, '\n');

  const found = extractMetaLiteral(text);
  if (!found) {
    problems.push('The first statement must be `export const meta = { ... }` with an object literal.');
    return problems;
  }

  const read = readMeta(found.literal);
  const meta = read.meta;
  problems.push(...read.problems);
  if (typeof meta.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(meta.name)) problems.push('`meta.name` must be a lowercase-hyphen string.');
  if (typeof meta.description !== 'string' || meta.description.trim() === '') problems.push('`meta.description` must be a non-empty string.');
  const phases = readPhases(meta);
  if (phases.malformed) problems.push('`meta.phases`, when present, must be an array of objects that each have a string `title`.');

  const body = text.slice(found.end);
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  if (/\bimport\s*\(/.test(code) || /^\s*import\s/m.test(code)) problems.push('A workflow cannot load modules: no `import`.');
  if (/\bDate\.now\s*\(/.test(code)) problems.push('`Date.now()` throws inside a workflow; pass a timestamp through `args`.');
  if (/\bMath\.random\s*\(/.test(code)) problems.push('`Math.random()` throws inside a workflow; vary the prompt or label by index.');
  if (/\bnew\s+Date\s*\(\s*\)/.test(code)) problems.push('`new Date()` without arguments throws inside a workflow; pass a timestamp through `args`.');
  if (/^\s*export\s/m.test(code)) problems.push('Only `meta` may be exported.');

  // Phase titles used by phase() and by `phase:` options must be listed in meta.phases, and the reverse.
  const used = new Set<string>();
  for (const match of code.matchAll(/\bphase\(\s*(['"`])((?:(?!\1).)*)\1\s*\)/g)) used.add(match[2]);
  for (const match of code.matchAll(/\bphase\s*:\s*(['"`])((?:(?!\1).)*)\1/g)) used.add(match[2]);
  const listed = new Set(phases.titles);
  for (const title of used) if (!listed.has(title)) problems.push(`Phase "${title}" is used but not listed in meta.phases.`);
  for (const title of listed) if (!used.has(title)) problems.push(`meta.phases lists "${title}" but no phase() call or phase option uses it.`);

  // Syntax: compile the body as an async function body (top-level await and return are allowed), never run it.
  try {
    new AsyncFunction(...RUNTIME_GLOBALS, 'meta', body);
  } catch (error) {
    problems.push(`The script does not parse as plain JavaScript: ${(error as Error).message}`);
  }
  return problems;
}

/** What a script asks for as `agentType`: the string-literal names, and the lines (1-based) of requests whose value is not a string literal. */
export interface AgentTypeRequests {
  literals: string[];
  unresolved: number[];
}

/**
 * Every `agentType` request in the script, found by a tokenizer (`js-tokens.ts`) that skips comments, strings, template text and
 * regular expressions, so an example in any of them is not a request. A request is the key `agentType`, bare or quoted
 * (`'agentType'`, `"agentType"`, `['agentType']`), after `{` or `,`, followed by `:`; or the shorthand `{ agentType }`. The value is
 * a literal only when it is one string (single, double or backtick quotes, no `${`) and nothing more before the next `,` or `}`.
 * Any other value, a shorthand included, is unresolved: the lexical scan cannot know what it holds.
 */
export function agentTypeRequests(source: string): AgentTypeRequests {
  const literals = new Set<string>();
  const unresolved: number[] = [];
  for (const tokens of tokenizeJs(source)) {
    for (let at = 0; at < tokens.length; at++) {
      const head = tokens[at];
      const bareOrQuoted = (head.kind === 'ident' && head.text === 'agentType') || (head.kind === 'string' && head.value === 'agentType');
      const computed = head.kind === 'punct' && head.text === '[' && tokens[at + 1]?.kind === 'string' && tokens[at + 1].value === 'agentType'
        && tokens[at + 2]?.kind === 'punct' && tokens[at + 2].text === ']';
      if (!bareOrQuoted && !computed) continue;
      const before = tokens[at - 1];
      if (before === undefined || before.kind !== 'punct' || (before.text !== '{' && before.text !== ',')) continue;
      const colon = tokens[at + (computed ? 3 : 1)];
      if (colon?.kind === 'punct' && colon.text === ':') {
        const value = tokens[at + (computed ? 4 : 2)];
        const after = tokens[at + (computed ? 5 : 3)];
        const closes = after === undefined || (after.kind === 'punct' && (after.text === ',' || after.text === '}'));
        if (value !== undefined && closes && (value.kind === 'string' || (value.kind === 'template' && !value.interpolated))) literals.add(value.value);
        else unresolved.push(head.line);
      } else if (head.kind === 'ident' && colon?.kind === 'punct' && (colon.text === ',' || colon.text === '}')) {
        unresolved.push(head.line);
      }
    }
  }
  return { literals: [...literals].sort(), unresolved: unresolved.sort((a, b) => a - b) };
}

/** Every `agentType` the script asks for as a string literal, sorted once each. */
export function agentTypesUsed(source: string): string[] {
  return agentTypeRequests(source).literals;
}
