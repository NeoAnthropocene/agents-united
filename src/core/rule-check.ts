/**
 * ADR 0082: `agents rule-check`, the read-only deterministic QA of one canonical rule file.
 *
 * A canonical rule is `registry/rules/<name>.md`. The Claude projector turns it into `.claude/rules/<name>.md` behind its
 * own managed marker and skips a rule over the line budget, so each check here guards one thing the projector would
 * otherwise do silently or wrongly. The file is data: nothing in it is imported, required, spawned or evaluated.
 * No terminal I/O here; `src/cli.ts` prints the result and sets the exit code.
 *
 * Passing means only the deterministic checks passed. It does not mean the rule is good or live (`quality` stays
 * pending, `live` unverified).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ClaudeProjector, ENTRYPOINT_RULES, MARKER_PREFIX } from './claude-projector.js';
import { errorCode, shortened, unsafeEntryName, validUtf8 } from './skill-check.js';
import type {
  RuleCheckCheckId, RuleCheckCode, RuleCheckFinding, RuleCheckGate, RuleCheckInput, RuleCheckResult, RuleCheckStatus,
} from './types.js';

const CHECK_IDS: readonly RuleCheckCheckId[] = ['name', 'size', 'encoding', 'budget', 'front-matter', 'structure', 'managed-marker', 'claude-render'];
/** A rule is a few dozen lines; the 200-line budget alone allows about 16 KiB at 80 columns, so 64 KiB is generous. */
export const RULE_CHECK_MAX_BYTES = 64 * 1024;
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;
/** A leading `---` line, then (optionally) lines up to a closing `---` line. An unclosed leading rule is not front matter. */
const FRONT_MATTER = /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;
const TITLE = /^# \S/;
const BOM = String.fromCharCode(0xfeff);

const UNAVAILABLE_CODES: ReadonlySet<RuleCheckCode> = new Set<RuleCheckCode>(['USAGE', 'INPUT_UNAVAILABLE']);

export function ruleCheckExitCode(result: RuleCheckResult): 0 | 1 | 2 {
  return result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}

const budgetOf = (): number => ClaudeProjector.CLAUDE_DIALECT.maxRuleLines;
const gate = (id: RuleCheckCheckId, status: RuleCheckGate['status'], reason: string | null, findings: RuleCheckFinding[] = []): RuleCheckGate =>
  ({ id, status, reason, findings });
const idleChecks = (reason: string): RuleCheckGate[] => CHECK_IDS.map(id => gate(id, 'not-run', reason));

function result(artifact: string | null, lines: number | null, checks: RuleCheckGate[], before: RuleCheckFinding[]): RuleCheckResult {
  const findings = [...before, ...checks.flatMap(item => item.findings)];
  const status: RuleCheckStatus = findings.some(item => UNAVAILABLE_CODES.has(item.code))
    ? 'unavailable'
    : checks.some(item => item.status === 'failed') ? 'failed' : 'passed';
  return { version: 1, kind: 'deterministic', status, artifact: shortened(artifact), lines, budget: budgetOf(), checks, findings, quality: 'pending', live: 'unverified' };
}

function unavailable(artifact: string | null, code: 'USAGE' | 'INPUT_UNAVAILABLE', messages: string[], reason: string): RuleCheckResult {
  const where = code === 'INPUT_UNAVAILABLE' ? shortened(artifact) : null;
  return result(artifact, null, idleChecks(reason), messages.map(message => ({ code, path: where, message })));
}

/** A usage result (exit 2) for an invocation problem the caller found before any input was read, e.g. an unknown option. */
export function ruleCheckUsageResult(problems: string[], input: RuleCheckInput = {}): RuleCheckResult {
  return unavailable(typeof input.artifact === 'string' ? input.artifact : null, 'USAGE', problems, 'The invocation was not valid, so no check ran.');
}

type ReadOutcome =
  | { kind: 'unavailable'; message: string }
  | { kind: 'oversize' }
  | { kind: 'ok'; bytes: Buffer };

/** lstat first (a link is refused, a named pipe is never opened), then a bounded read of the same file. */
function readRule(file: string): ReadOutcome {
  let fd: number | undefined;
  try {
    const last = file[file.length - 1];
    if (last === '/' || (path.sep === '\\' && last === '\\')) return { kind: 'unavailable', message: `The path ends with a path separator, so it does not name a file: ${file}` };
    const entry = fs.lstatSync(file);
    if (entry.isSymbolicLink()) return { kind: 'unavailable', message: `The path is a link, not a regular file; pass the real path of the rule: ${file}` };
    if (!entry.isFile()) return { kind: 'unavailable', message: `The path is not a regular file: ${file}` };
    // O_NOFOLLOW and O_NONBLOCK do not exist on Windows (undefined there); where they do, they close the gap between the lstat and the open.
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const opened = fs.fstatSync(fd);
    if (!opened.isFile()) return { kind: 'unavailable', message: `The path is not a regular file: ${file}` };
    if (opened.size > RULE_CHECK_MAX_BYTES) return { kind: 'oversize' };
    const buffer = Buffer.alloc(RULE_CHECK_MAX_BYTES + 1);
    let length = 0;
    for (;;) {
      const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
      if (length > RULE_CHECK_MAX_BYTES) return { kind: 'oversize' };
    }
    return { kind: 'ok', bytes: Buffer.from(buffer.subarray(0, length)) };
  } catch (error) {
    return { kind: 'unavailable', message: `The rule file cannot be read (${errorCode(error)}): ${file}` };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** The first non-empty line must be a level-1 title, and some non-empty line must follow it. */
function structureProblem(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex(line => line.trim() !== '');
  if (first === -1) return 'The rule is empty: it needs a level-1 title ("# Title") as its first non-empty line, then a body.';
  if (!TITLE.test(lines[first] ?? '')) return `The first non-empty line must be a level-1 title ("# Title"); found ${JSON.stringify((lines[first] ?? '').slice(0, 80))}.`;
  if (!lines.slice(first + 1).some(line => line.trim() !== '')) return 'The rule has a title but no body: add the rule text after the title.';
  return null;
}

const ENTRYPOINT_NAMES_LOWER: ReadonlySet<string> = new Set([...ENTRYPOINT_RULES].map(name => name.toLowerCase()));

/**
 * Why a rule file name is refused, or null when it is a good one. The pure rule behind the name check, so the Windows
 * device names stay tested on a host whose file system cannot hold them. A host entry-point file name is compared without
 * regard to case (on a case-insensitive file system `claude.md` and `CLAUDE.md` are one file); a name Windows cannot hold
 * is refused by the same rule `skill-check` uses (`unsafeEntryName`); the rest must be lower-case kebab-case `.md`.
 */
export function ruleNameProblem(base: string): string | null {
  if (ENTRYPOINT_RULES.has(base)) {
    return `${base} is a host entry-point file name; the projector skips it, so it never becomes a rule. Pick a kebab-case rule name.`;
  }
  if (ENTRYPOINT_NAMES_LOWER.has(base.toLowerCase())) {
    const entry = [...ENTRYPOINT_RULES].find(name => name.toLowerCase() === base.toLowerCase()) ?? base;
    return `${base} differs from the host entry-point file name ${entry} only in case; it is refused so the rule stays portable, because a case-insensitive file system (Windows, macOS) treats the two as the same file. Pick a kebab-case rule name.`;
  }
  const unsafe = unsafeEntryName(base);
  if (unsafe !== null) return `The file name ${JSON.stringify(base)} ${unsafe}; pick a lower-case kebab-case name that every operating system accepts.`;
  if (!NAME_PATTERN.test(base)) {
    return `The file name ${JSON.stringify(base)} must be lower-case kebab-case ending in .md (letters, digits and single hyphens, e.g. my-rule.md).`;
  }
  return null;
}

const quoted = (value: string): string => JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}...` : value);

/**
 * What the Claude rendering of the rule would drop or rewrite beyond the ordinary tool and command vocabulary pass.
 * The losses come from the projector's own rewrite steps (`ClaudeProjector.bodyRewriteLosses`), so this check cannot drift
 * from them; the rendered body must also be non-empty and keep the title line.
 */
function renderProblems(raw: string, base: string): string[] {
  // `renderRule` trims the canonical content before it rewrites it, so the same trim is applied here.
  const body = raw.trim();
  const losses = ClaudeProjector.bodyRewriteLosses(body);
  const problems = [
    ...losses.droppedSections.map(heading => `The Claude rendering would drop the section ${quoted(heading)} and everything under it: its heading names another host's routing. Rename the heading.`),
    ...losses.scrubbedPhrases.map(phrase => `The Claude rendering would replace the phrase ${quoted(phrase)} in the text. Reword it.`),
    ...losses.overriddenSections.map(heading => `The Claude rendering would replace the section ${quoted(heading)} with its own text. Rename the heading.`),
  ];
  if (problems.length > 0) return problems;

  // A backstop for any other way the body could come out empty or without its title.
  // No catch here: a renderer exception is not a clean render, so it reaches runRuleCheck's catch and the result is unavailable (exit 2).
  const rendered = ClaudeProjector.renderRule(raw, `rules/${base}`).content;
  const kept = rendered.split(/\r?\n/).slice(2).filter(line => line.trim() !== '');
  const original = body.split(/\r?\n/).filter(line => line.trim() !== '');
  if (original.length === 0) return []; // an empty rule is the structure check's finding
  if (kept.length === 0) return ['The Claude rendering of the rule would be empty.'];
  const title = ClaudeProjector.rewriteBody(original[0] ?? '').body.trim();
  if (kept[0]?.trim() !== title) return [`The Claude rendering would not keep the title line ${quoted(original[0] ?? '')}.`];
  if (original.length > 1 && kept.length < 2) return ['The Claude rendering would keep the title but none of the rule text under it.'];
  return [];
}

export function runRuleCheck(input: RuleCheckInput): RuleCheckResult {
  const artifact = typeof input?.artifact === 'string' && input.artifact !== '' ? input.artifact : null;
  try {
    if (artifact === null) return ruleCheckUsageResult(['--artifact is required: the absolute path of one canonical rule .md file.'], input ?? {});
    if (!path.isAbsolute(artifact)) return ruleCheckUsageResult([`--artifact must be an absolute path; got ${JSON.stringify(shortened(artifact))}.`], input);

    const read = readRule(artifact);
    if (read.kind === 'unavailable') return unavailable(artifact, 'INPUT_UNAVAILABLE', [read.message], 'The rule file could not be read, so no check ran.');

    const shown = shortened(artifact);
    const found = (code: RuleCheckCode, message: string): RuleCheckFinding => ({ code, path: shown, message });
    const done = (id: RuleCheckCheckId, problems: RuleCheckFinding[]): RuleCheckGate => gate(id, problems.length > 0 ? 'failed' : 'passed', null, problems);

    const base = path.basename(artifact);
    const nameMessage = ruleNameProblem(base);
    const name = done('name', nameMessage === null ? [] : [found('NAME', nameMessage)]);

    if (read.kind === 'oversize') {
      const reason = `The file is over ${RULE_CHECK_MAX_BYTES} bytes, so its content was not read.`;
      const size = done('size', [found('SIZE', `The file is larger than ${RULE_CHECK_MAX_BYTES} bytes (${RULE_CHECK_MAX_BYTES / 1024} KiB); a rule must be short.`)]);
      return result(artifact, null, [name, size, ...CHECK_IDS.slice(2).map(id => gate(id, 'not-run', reason))], []);
    }

    const bytes = read.bytes;
    const raw = bytes.toString('utf8');
    // The projector's own count, on the raw text: a final newline adds one, and CRLF counts like LF.
    const lines = raw.split(/\r?\n/).length;
    const text = raw.startsWith(BOM) ? raw.slice(BOM.length) : raw;

    const encodingProblems: RuleCheckFinding[] = [];
    if (!validUtf8(bytes)) encodingProblems.push(found('ENCODING', 'The file is not valid UTF-8 text.'));
    if (raw.startsWith(BOM)) encodingProblems.push(found('ENCODING', 'The file starts with a byte order mark (BOM); save it as UTF-8 without BOM.'));
    if (bytes.includes(0)) encodingProblems.push(found('ENCODING', 'The file contains a NUL byte, so it is not plain text.'));

    const budgetProblems: RuleCheckFinding[] = [];
    if (lines > budgetOf()) {
      budgetProblems.push(found('BUDGET', `The rule has ${lines} lines, over the ${budgetOf()}-line Claude budget counted as the projector counts (a final newline adds one line); the projector would skip it.`));
    }

    const frontMatter = FRONT_MATTER.exec(text);
    const frontMatterProblems: RuleCheckFinding[] = frontMatter === null ? [] : [found('FRONT_MATTER', 'The rule starts with a front-matter block. A canonical rule carries none (ADR 0082 decision 10): the projector writes its own marker first and would leave the block after it.')];

    // Judged on the text after any front-matter block, so one mistake gives one finding.
    const problem = structureProblem(frontMatter === null ? text : text.slice(frontMatter[0].length));
    const structureProblems = problem === null ? [] : [found('STRUCTURE', problem)];

    const markerProblems: RuleCheckFinding[] = text.includes(MARKER_PREFIX)
      ? [found('MANAGED_MARKER', `The rule contains the managed marker text "${MARKER_PREFIX}", which the projector writes itself; remove it.`)]
      : [];

    return result(artifact, lines, [
      name,
      done('size', []),
      done('encoding', encodingProblems),
      done('budget', budgetProblems),
      done('front-matter', frontMatterProblems),
      done('structure', structureProblems),
      done('managed-marker', markerProblems),
      lines > budgetOf()
        ? gate('claude-render', 'not-run', 'The rule is over the Claude budget, so the projector skips it and renders nothing.')
        : done('claude-render', renderProblems(raw, base).map(message => found('RENDER_CHANGE', message))),
    ], []);
  } catch (error) {
    return unavailable(artifact, 'INPUT_UNAVAILABLE', [`The rule check could not run (${errorCode(error)}).`], 'The rule check hit an unexpected error, so no check ran.');
  }
}
