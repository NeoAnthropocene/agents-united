/**
 * ADR 0082: `agents workflow-check`, the read-only deterministic QA of one native Claude workflow script.
 *
 * A native Claude workflow is `registry/hosts/claude/workflows/<name>.js`. With the native lane on, the Claude projector
 * installs it at `.claude/workflows/<name>.js` behind its managed marker, and only in place of the Skill
 * `registry/skills/<name>/SKILL.md`. So each check here guards one thing the installer would otherwise do silently or wrongly.
 * The script is parsed (the repository's own workflow lint compiles it as an async function body) and never run: nothing in it
 * is imported, required, spawned or evaluated. No terminal I/O here; `src/cli.ts` prints the result and sets the exit code.
 *
 * Passing means only the deterministic checks passed. It does not mean the workflow is good or live (`quality` stays pending,
 * `live` unverified).
 */
import fs from 'node:fs';
import path from 'node:path';
import { readBoundedFile } from './bounded-file.js';
import { MARKER_PREFIX } from './claude-projector.js';
import { isNativeName, listNativeRoles, renderNativeWorkflow } from './native-package.js';
import { errorCode, shortened, unsafeEntryName, validUtf8 } from './skill-check.js';
import { agentTypesUsed, lintWorkflow, workflowMetaName } from './workflow-lint.js';
import type {
  WorkflowCheckCheckId, WorkflowCheckCode, WorkflowCheckFinding, WorkflowCheckGate, WorkflowCheckInput, WorkflowCheckResult, WorkflowCheckStatus,
} from './types.js';

const CHECK_IDS: readonly WorkflowCheckCheckId[] = ['name', 'size', 'encoding', 'placement', 'lint', 'meta-name', 'skill-pair', 'agent-types', 'render'];
/** The committed workflows are 11 to 16 KB. 128 KiB leaves room for a long one and still stops a file that is not a script. */
export const WORKFLOW_CHECK_MAX_BYTES = 128 * 1024;
const EXTENSION = '.js';
const BOM = String.fromCharCode(0xfeff);

const UNAVAILABLE_CODES: ReadonlySet<WorkflowCheckCode> = new Set<WorkflowCheckCode>(['USAGE', 'INPUT_UNAVAILABLE']);

export function workflowCheckExitCode(result: WorkflowCheckResult): 0 | 1 | 2 {
  return result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}

const gate = (id: WorkflowCheckCheckId, status: WorkflowCheckGate['status'], reason: string | null, findings: WorkflowCheckFinding[] = []): WorkflowCheckGate =>
  ({ id, status, reason, findings });
const idleChecks = (reason: string): WorkflowCheckGate[] => CHECK_IDS.map(id => gate(id, 'not-run', reason));

function result(artifact: string | null, bytes: number | null, checks: WorkflowCheckGate[], before: WorkflowCheckFinding[]): WorkflowCheckResult {
  const findings = [...before, ...checks.flatMap(item => item.findings)];
  const status: WorkflowCheckStatus = findings.some(item => UNAVAILABLE_CODES.has(item.code))
    ? 'unavailable'
    : checks.some(item => item.status === 'failed') ? 'failed' : 'passed';
  return { version: 1, kind: 'deterministic', status, artifact: shortened(artifact), bytes, maxBytes: WORKFLOW_CHECK_MAX_BYTES, checks, findings, quality: 'pending', live: 'unverified' };
}

function unavailable(artifact: string | null, code: 'USAGE' | 'INPUT_UNAVAILABLE', messages: string[], reason: string): WorkflowCheckResult {
  const where = code === 'INPUT_UNAVAILABLE' ? shortened(artifact) : null;
  return result(artifact, null, idleChecks(reason), messages.map(message => ({ code, path: where, message })));
}

/** A usage result (exit 2) for an invocation problem the caller found before any input was read, e.g. an unknown option. */
export function workflowCheckUsageResult(problems: string[], input: WorkflowCheckInput = {}): WorkflowCheckResult {
  return unavailable(typeof input.artifact === 'string' ? input.artifact : null, 'USAGE', problems, 'The invocation was not valid, so no check ran.');
}

/**
 * Why a workflow file name is refused, or null when it is a good one. The pure rule behind the name check, so the Windows
 * device names stay tested on a host whose file system cannot hold them. A name Windows cannot hold is refused by the same
 * rule `skill-check` and `rule-check` use (`unsafeEntryName`); the rest must be a name the native package lists: lower-case
 * kebab-case ending in `.js`. Any other file is never installed.
 */
export function workflowNameProblem(base: string): string | null {
  const unsafe = unsafeEntryName(base);
  if (unsafe !== null) return `The file name ${JSON.stringify(base)} ${unsafe}; pick a lower-case kebab-case name that every operating system accepts.`;
  if (!base.endsWith(EXTENSION) || !isNativeName(base.slice(0, -EXTENSION.length))) {
    return `The file name ${JSON.stringify(base)} must be lower-case kebab-case ending in .js (letters, digits and single hyphens, e.g. my-flow.js); the native package lists no other file, so it is never installed.`;
  }
  return null;
}

/** The registry four levels up when the file sits at `<registry>/hosts/claude/workflows/<name>.js`, else the reason it does not. */
function registryOf(file: string): { registry: string } | { problem: string } {
  const workflows = path.dirname(file);
  const claude = path.dirname(workflows);
  const hosts = path.dirname(claude);
  if (path.basename(workflows) === 'workflows' && path.basename(claude) === 'claude' && path.basename(hosts) === 'hosts') return { registry: path.dirname(hosts) };
  return { problem: `The file must sit at <registry>/hosts/claude/workflows/<name>.js (the registry is the folder four levels up); the projector looks nowhere else. It is in ${shortened(workflows)}.` };
}

const quoted = (value: string): string => JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}...` : value);

/**
 * What the installed form of the script would get wrong. The installed form is the native package's own rendering
 * (`renderNativeWorkflow`, the function the projector calls): the script's text with line endings normalised and trailing
 * newlines collapsed to one, then the managed marker as one last line. It must not already carry a marker, and when the
 * script passes the lint the rendered form must pass it too.
 */
function renderProblems(raw: string, stem: string): string[] {
  if (raw.includes(MARKER_PREFIX)) {
    return [`The script contains the managed marker text "${MARKER_PREFIX}", which the installer writes itself as the last line; remove it.`];
  }
  // No catch here: a renderer exception is not a clean render, so it reaches runWorkflowCheck's catch and the result is unavailable (exit 2).
  const rendered = renderNativeWorkflow(raw, `skills/${stem}/SKILL.md`);
  const problems: string[] = [];
  const head = raw.replace(/\r\n/g, '\n').replace(/\n*$/, '\n');
  const body = rendered.endsWith('\n') ? rendered.slice(0, -1) : null;
  const cut = body === null ? -1 : body.lastIndexOf('\n');
  const marker = body === null ? null : body.slice(cut + 1);
  if (body === null || marker === null || !marker.startsWith(`// ${MARKER_PREFIX}`) || rendered.slice(0, cut + 1) !== head) {
    problems.push('The installed form would not be the script (line endings normalised, trailing newlines collapsed to one) followed by exactly one managed marker comment line.');
  }
  const unmarked = (text: string): string => (text.startsWith(BOM) ? text.slice(BOM.length) : text);
  if (lintWorkflow(unmarked(raw)).length === 0) {
    for (const problem of lintWorkflow(unmarked(rendered))) problems.push(`The installed form of the script would fail the workflow lint: ${problem}`);
  }
  return problems;
}

export function runWorkflowCheck(input: WorkflowCheckInput): WorkflowCheckResult {
  const artifact = typeof input?.artifact === 'string' && input.artifact !== '' ? input.artifact : null;
  try {
    if (artifact === null) return workflowCheckUsageResult(['--artifact is required: the absolute path of one native Claude workflow .js file.'], input ?? {});
    if (!path.isAbsolute(artifact)) return workflowCheckUsageResult([`--artifact must be an absolute path; got ${JSON.stringify(shortened(artifact))}.`], input);

    const read = readBoundedFile(artifact, WORKFLOW_CHECK_MAX_BYTES, 'workflow');
    if (read.kind === 'unavailable') return unavailable(artifact, 'INPUT_UNAVAILABLE', [read.message], 'The workflow file could not be read, so no check ran.');

    const shown = shortened(artifact);
    const found = (code: WorkflowCheckCode, message: string): WorkflowCheckFinding => ({ code, path: shown, message });
    const done = (id: WorkflowCheckCheckId, problems: WorkflowCheckFinding[]): WorkflowCheckGate => gate(id, problems.length > 0 ? 'failed' : 'passed', null, problems);

    const base = path.basename(artifact);
    const stem = path.basename(base, EXTENSION);
    const nameMessage = workflowNameProblem(base);
    const name = done('name', nameMessage === null ? [] : [found('NAME', nameMessage)]);

    if (read.kind === 'oversize') {
      const reason = `The file is over ${WORKFLOW_CHECK_MAX_BYTES} bytes, so its content was not read.`;
      const size = done('size', [found('SIZE', `The file is larger than ${WORKFLOW_CHECK_MAX_BYTES} bytes (${WORKFLOW_CHECK_MAX_BYTES / 1024} KiB); a workflow script must be shorter.`)]);
      return result(artifact, null, [name, size, ...CHECK_IDS.slice(2).map(id => gate(id, 'not-run', reason))], []);
    }

    const bytes = read.bytes;
    const raw = bytes.toString('utf8');
    // The encoding check reports a byte order mark, so the other checks judge the text without it.
    const text = raw.startsWith(BOM) ? raw.slice(BOM.length) : raw;

    const encodingProblems: WorkflowCheckFinding[] = [];
    if (!validUtf8(bytes)) encodingProblems.push(found('ENCODING', 'The file is not valid UTF-8 text.'));
    if (raw.startsWith(BOM)) encodingProblems.push(found('ENCODING', 'The file starts with a byte order mark (BOM); save it as UTF-8 without BOM.'));
    if (bytes.includes(0)) encodingProblems.push(found('ENCODING', 'The file contains a NUL byte, so it is not plain text.'));

    const place = registryOf(artifact);
    const placement = done('placement', 'problem' in place ? [found('PLACEMENT', place.problem)] : []);

    const lint = done('lint', lintWorkflow(text).map(problem => found('LINT', problem)));

    const metaName = workflowMetaName(text);
    const metaGate = metaName === undefined
      ? gate('meta-name', 'not-run', 'meta.name could not be read as a string from a pure `meta` literal (the lint check says why), so it was not compared with the file name.')
      : done('meta-name', metaName === stem ? [] : [found('META_NAME', `meta.name is ${quoted(metaName)} but the file name is ${quoted(base)}. Claude Code runs a saved workflow as /<name>; make meta.name ${quoted(stem)}.`)]);

    if ('problem' in place) {
      const reason = 'The placement check failed, so the registry is not known.';
      return result(artifact, bytes.length, [
        name, done('size', []), done('encoding', encodingProblems), placement, lint, metaGate,
        gate('skill-pair', 'not-run', reason), gate('agent-types', 'not-run', reason), gate('render', 'not-run', reason),
      ], []);
    }
    const registry = place.registry;

    const skillFile = path.join(registry, 'skills', stem, 'SKILL.md');
    const skillGate = !isNativeName(stem)
      ? gate('skill-pair', 'not-run', 'The file name is not one the native package lists, so there is no Skill name to look up (the name check says so).')
      : done('skill-pair', isFile(skillFile) ? [] : [found('SKILL_PAIR', `There is no Skill of the same name: ${path.posix.join('skills', stem, 'SKILL.md')} is missing in the registry. The installer puts a native workflow only in place of that Skill, so this workflow would never be installed.`)]);

    const roles = new Set(listNativeRoles(registry, 'claude'));
    const agentProblems = agentTypesUsed(text)
      .filter(type => !roles.has(type))
      .map(type => found('AGENT_TYPE', `The script asks for agentType ${quoted(type)}, which is not a native Claude agent: there is no ${path.posix.join('hosts', 'claude', 'agents', `${isNativeName(type) ? type : '<name>'}.md`)} in the registry.`));

    return result(artifact, bytes.length, [
      name, done('size', []), done('encoding', encodingProblems), placement, lint, metaGate,
      skillGate,
      done('agent-types', agentProblems),
      done('render', renderProblems(raw, stem).map(message => found('RENDER', message))),
    ], []);
  } catch (error) {
    return unavailable(artifact, 'INPUT_UNAVAILABLE', [`The workflow check could not run (${errorCode(error)}).`], 'The workflow check hit an unexpected error, so no check ran.');
  }
}

/** A regular file (a link to one counts, as it does for the projector's own existence test). */
function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
