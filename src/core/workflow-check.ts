/**
 * ADR 0082: `agents workflow-check`, the read-only deterministic QA of one native Claude workflow script.
 *
 * A native Claude workflow is `registry/hosts/claude/workflows/<name>.js`. With the native lane on, the Claude projector
 * installs it at `.claude/workflows/<name>.js` behind its managed marker, and only in place of the Skill
 * `registry/skills/<name>/SKILL.md`. So each check here guards one thing the installer would otherwise do silently or wrongly.
 * The script is parsed and never run: its `meta` is read as data by a strict literal parser and its body is only compiled
 * (the repository's own workflow lint), so nothing in it is imported, required, spawned or evaluated. The checker is stricter
 * than the projector: it passes only a workflow the projector would emit intact, and it does not establish installability
 * (Bundle membership of the Skill and of the agent roles, an unmanaged destination that needs `--force`). No terminal I/O
 * here; `src/cli.ts` prints the result and sets the exit code.
 *
 * Reads stay inside the registry tree the path names: the pure name and placement checks run before any file is touched, then
 * `workflow-check-path.ts` confirms the path is spelled exactly and goes through no link or junction, and the bounded read
 * compares the opened file with the one inspected.
 *
 * Passing means only the deterministic checks passed. It does not mean the workflow is good or live (`quality` stays pending,
 * `live` unverified).
 */
import fs from 'node:fs';
import path from 'node:path';
import { readBoundedFile } from './bounded-file.js';
import { validateHostProfile } from './host-profile.js';
import { resolveWorkflowTree } from './workflow-check-path.js';
import { MARKER_PREFIX } from './claude-projector.js';
import { isNativeName, renderNativeWorkflow } from './native-package.js';
import { errorCode, shortened, unsafeEntryName, validUtf8 } from './skill-check.js';
import { agentTypeRequests, lintWorkflow, workflowMetaName } from './workflow-lint.js';
import type {
  WorkflowCheckCheckId, WorkflowCheckCode, WorkflowCheckFinding, WorkflowCheckGate, WorkflowCheckInput, WorkflowCheckResult, WorkflowCheckStatus,
  WorkflowCheckUnresolvedAgentType,
} from './types.js';

const CHECK_IDS: readonly WorkflowCheckCheckId[] = ['name', 'size', 'encoding', 'placement', 'lint', 'meta-name', 'skill-pair', 'agent-types', 'render'];
/** The committed workflows are 11 to 16 KB. 128 KiB leaves room for a long one and still stops a file that is not a script. */
export const WORKFLOW_CHECK_MAX_BYTES = 128 * 1024;
const EXTENSION = '.js';
const BOM = String.fromCharCode(0xfeff);

/**
 * What a pass does not establish, carried on every result (ADR 0082). The checker is stricter than the projector: it passes only
 * a workflow the projector would emit intact, and it says nothing about whether the workflow is installed in a given workspace.
 */
export const WORKFLOW_CHECK_NOTES: readonly string[] = [
  'agent-types: the agentType requests are found by a lexical scan of the script, not by running it, so literal agent types are verified against the native roles; run-time ones are listed in unresolvedAgentTypes and not verified. A type passed through a spread cannot be seen at all.',
  'agent-types: a native role file in the registry is not the same as an installed role. Whether the role is installed with a given Bundle (the Bundle lists it, and Bundle-specific native names apply) is out of reach of this check.',
  'A pass does not establish installability: whether a Bundle lists the paired Skill, and a destination file in a workspace that is not managed and so needs --force, are not checked.',
];

const UNAVAILABLE_CODES:ReadonlySet<WorkflowCheckCode> = new Set<WorkflowCheckCode>(['USAGE', 'INPUT_UNAVAILABLE']);

export function workflowCheckExitCode(result: WorkflowCheckResult): 0 | 1 | 2 {
  return result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2;
}

const gate = (id: WorkflowCheckCheckId, status: WorkflowCheckGate['status'], reason: string | null, findings: WorkflowCheckFinding[] = []): WorkflowCheckGate =>
  ({ id, status, reason, findings });
const idleChecks = (reason: string): WorkflowCheckGate[] => CHECK_IDS.map(id => gate(id, 'not-run', reason));

function result(
  artifact: string | null, bytes: number | null, checks: WorkflowCheckGate[], before: WorkflowCheckFinding[], unresolvedAgentTypes: WorkflowCheckUnresolvedAgentType[] = [],
): WorkflowCheckResult {
  const findings = [...before, ...checks.flatMap(item => item.findings)];
  const status: WorkflowCheckStatus = findings.some(item => UNAVAILABLE_CODES.has(item.code))
    ? 'unavailable'
    : checks.some(item => item.status === 'failed') ? 'failed' : 'passed';
  return { version: 1, kind: 'deterministic', status, artifact: shortened(artifact), bytes, maxBytes: WORKFLOW_CHECK_MAX_BYTES, checks, findings, unresolvedAgentTypes, notes: [...WORKFLOW_CHECK_NOTES], quality: 'pending', live: 'unverified' };
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
  const root = path.dirname(hosts);
  if (path.basename(workflows) === 'workflows' && path.basename(claude) === 'claude' && path.basename(hosts) === 'hosts') {
    // The registry is a folder with a name and a parent: a file-system root has neither, so no path below it can be confirmed.
    if (path.dirname(root) === root) return { problem: `The registry cannot be a file-system root (${shortened(root)}); the file must sit at <registry>/hosts/claude/workflows/<name>.js in a registry folder.` };
    return { registry: root };
  }
  return { problem: `The file must sit at <registry>/hosts/claude/workflows/<name>.js (the registry is the folder four levels up); the projector looks nowhere else. It is in ${shortened(workflows)}.` };
}

const EXCERPT_MAX = 120;
/** A source line for the unresolved-agent-type list: trimmed, at most 120 characters, ending in "..." when it was cut. */
const excerptOf = (line: string): string => {
  const trimmed = line.trim();
  return trimmed.length > EXCERPT_MAX ? `${trimmed.slice(0, EXCERPT_MAX - 3)}...` : trimmed;
};

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

    const last = artifact[artifact.length - 1];
    if (last === '/' || (path.sep === '\\' && last === '\\')) {
      return unavailable(artifact, 'INPUT_UNAVAILABLE', [`The path ends with a path separator, so it does not name a file: ${artifact}`], 'The path does not name a file, so no check ran.');
    }

    const shown = shortened(artifact);
    const found = (code: WorkflowCheckCode, message: string): WorkflowCheckFinding => ({ code, path: shown, message });
    const done = (id: WorkflowCheckCheckId, problems: WorkflowCheckFinding[]): WorkflowCheckGate => gate(id, problems.length > 0 ? 'failed' : 'passed', null, problems);

    // The pure checks come first and touch no file: the name (including the Windows device names, which must never be opened) and
    // the spelling of the place. When either fails no file is read, so the checks that need the content are not run.
    const base = path.basename(artifact);
    const stem = path.basename(base, EXTENSION);
    const nameMessage = workflowNameProblem(base);
    const name = done('name', nameMessage === null ? [] : [found('NAME', nameMessage)]);
    const place = registryOf(artifact);
    const placement = done('placement', 'problem' in place ? [found('PLACEMENT', place.problem)] : []);
    if (nameMessage !== null || 'problem' in place) {
      const reason = 'The name or placement check failed, so the file was not read.';
      return result(artifact, null, CHECK_IDS.map(id => (id === 'name' ? name : id === 'placement' ? placement : gate(id, 'not-run', reason))), []);
    }

    const tree = resolveWorkflowTree(artifact);
    if (!tree.ok) return unavailable(artifact, 'INPUT_UNAVAILABLE', [tree.message], 'The path could not be confirmed to lie inside the registry tree, so no file was read.');
    const registry = tree.registry;

    const read = readBoundedFile(tree.file, WORKFLOW_CHECK_MAX_BYTES, 'workflow');
    if (read.kind === 'unavailable') return unavailable(artifact, 'INPUT_UNAVAILABLE', [read.message], 'The workflow file could not be read, so no check ran.');

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

    const lint = done('lint', lintWorkflow(text).map(problem => found('LINT', problem)));

    const metaName = workflowMetaName(text);
    const metaGate = metaName === undefined
      ? gate('meta-name', 'not-run', 'meta.name could not be read as a string from a pure `meta` literal (the lint check says why), so it was not compared with the file name.')
      : done('meta-name', metaName === stem ? [] : [found('META_NAME', `meta.name is ${quoted(metaName)} but the file name is ${quoted(base)}. Claude Code runs a saved workflow as /<name>; make meta.name ${quoted(stem)}.`)]);

    const skillFile = path.join(registry, 'skills', stem, 'SKILL.md');
    let skillGate: WorkflowCheckGate;
    if (!isFile(skillFile)) {
      skillGate = done('skill-pair', [found('SKILL_PAIR', `There is no Skill of the same name: ${path.posix.join('skills', stem, 'SKILL.md')} is missing in the registry. The installer puts a native workflow only in place of that Skill, so this workflow would never be installed.`)]);
    } else {
      // The projector's own list: a Skill the Claude profile marks unsupported is not projected, and neither is the workflow in its place.
      const profile = claudeUnsupportedSkills(registry);
      if ('problem' in profile) return unavailable(artifact, 'INPUT_UNAVAILABLE', [profile.problem], 'The host profile could not be read, so no check ran.');
      skillGate = done('skill-pair', profile.names.has(stem)
        ? [found('SKILL_PAIR', `The Claude host profile lists the Skill ${stem} as unsupported (hosts/claude/profile.json unsupportedSkills), so the projector skips it and this workflow would never be installed.`)]
        : []);
    }

    // Only the requests written as a string literal can be checked. The others are listed, not failed: the scan cannot know what
    // they hold, so they are reported as not verified and the check passes on them.
    const requested = agentTypeRequests(text);
    const roles = claudeRoleNames(registry);
    const agentProblems = requested.literals
      .filter(type => !roles.has(type))
      .map(type => found('AGENT_TYPE', `The script asks for agentType ${quoted(type)}, which is not a native Claude agent: there is no regular file ${path.posix.join('hosts', 'claude', 'agents', `${isNativeName(type) ? type : '<name>'}.md`)} in the registry.`));
    const sourceLines = text.split('\n');
    const unresolvedAgentTypes = requested.unresolved.map((line): WorkflowCheckUnresolvedAgentType => ({
      code: 'AGENT_TYPE_UNRESOLVED', line, excerpt: excerptOf(sourceLines[line - 1] ?? ''),
    }));

    return result(artifact, bytes.length, [
      name, done('size', []), done('encoding', encodingProblems), placement, lint, metaGate,
      skillGate,
      done('agent-types', agentProblems),
      done('render', renderProblems(raw, stem).map(message => found('RENDER', message))),
    ], [], unresolvedAgentTypes);
  } catch (error) {
    return unavailable(artifact, 'INPUT_UNAVAILABLE', [`The workflow check could not run (${errorCode(error)}).`], 'The workflow check hit an unexpected error, so no check ran.');
  }
}

/**
 * The native Claude agents the registry holds, by name: regular `.md` files (not a folder, not a link) with a native name, in a
 * real `hosts/claude/agents/` folder. `listNativeRoles` (the native package's own list, which the projector and other callers
 * use) goes by directory-entry names alone, so a folder named `code-reviewer.md` would count there; its behaviour is unchanged
 * and this check does not use it.
 */
function claudeRoleNames(registry: string): ReadonlySet<string> {
  const dir = path.join(registry, 'hosts', 'claude', 'agents');
  const names = new Set<string>();
  let entries: string[];
  try {
    if (!fs.lstatSync(dir).isDirectory()) return names;
    entries = fs.readdirSync(dir);
  } catch {
    return names;
  }
  for (const entry of entries) {
    const stem = entry.endsWith('.md') ? entry.slice(0, -'.md'.length) : null;
    if (stem === null || !isNativeName(stem)) continue;
    try {
      if (fs.lstatSync(path.join(dir, entry)).isFile()) names.add(stem);
    } catch {
      // A role that cannot be inspected is not a role.
    }
  }
  return names;
}

/** The largest host profile that is read. The committed one is a few KB; this stops a file that is not a profile. */
const PROFILE_MAX_BYTES = 256 * 1024;

/**
 * The Skills the Claude host profile lists as unsupported, read the bounded way (a regular file, no link, at most 256 KiB, the
 * bytes validated by the repository's own profile validator). A registry with no profile lists none, as the projector treats it.
 * A profile that is oversize, not a regular file, a link or not valid is a problem: the Skill pair cannot be judged, so the
 * result is unavailable (exit 2) rather than a pass.
 */
function claudeUnsupportedSkills(registry: string): { names: ReadonlySet<string> } | { problem: string } {
  const file = path.join(registry, 'hosts', 'claude', 'profile.json');
  const read = readBoundedFile(file, PROFILE_MAX_BYTES, 'host profile');
  if (read.kind === 'unavailable') return read.code === 'ENOENT' ? { names: new Set() } : { problem: read.message };
  if (read.kind === 'oversize') return { problem: `The host profile is larger than ${PROFILE_MAX_BYTES / 1024} KiB, so it was not read: ${file}` };
  try {
    const profile = validateHostProfile(JSON.parse(read.bytes.toString('utf8')) as unknown, file);
    return { names: new Set((profile.unsupportedSkills ?? []).map(entry => entry.name)) };
  } catch (error) {
    return { problem: `The host profile is not valid (${(error as Error).message.slice(0, 200)}): ${file}` };
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
