/**
 * Plan 023 Workstream A (owner decisions D1 and D2, 2026-09-26): the plain-session guard.
 *
 * The Plan 022 guard lives in role frontmatter, so it fires only while an agents-united role
 * runs. A plain `claude` session in the same repo is covered only by a settings-level hook.
 * Hook entries MERGE across settings levels (Claude Code hooks reference), so this module adds
 * our two PreToolUse groups to a settings file beside whatever the user already has.
 *
 * This is the first write agents-united makes into a user-owned file, so it is deliberately
 * conservative:
 *   - the file is parsed as strict JSON; anything else (JSONC comments, trailing commas, a
 *     non-object root, a `hooks` or `PreToolUse` of the wrong type) is NEVER rewritten: the caller
 *     reports `skipped-invalid`. A file with no content at all (zero bytes, white space, a BOM only)
 *     is not invalid: nothing of the user's is in it, so turning the guard on writes into it;
 *   - the guard's script lives in a FILE beside the settings file (`.claude/hooks/agents-united-session-guard.js`), and the
 *     entries run it with `node <file>`: the Host prints the hook's whole command line in front of every refusal, and the inline
 *     `node -e <script>` form put the script's source in front of every ordinary block (ADR 0068 addendum, finding G6). The script
 *     file is a managed asset: written idempotently, renewed when it holds an earlier text of ours, left when edited by hand, and
 *     removed with the entries (only if it is ours);
 *   - ownership is recognised by the entry naming that file (current form) or by the guard's marker text inside an exec-form
 *     `node -e` handler (the earlier inline forms, which read as outdated); the CURRENT guard is recognised by exact equality, the
 *     same four keys with the same values (an extra key such as `async` or `timeout` makes a handler "modified": reported, never
 *     rewritten, never deleted);
 *   - an element of `hooks` or `PreToolUse` that is not an object (`null`, a number, a string, an
 *     array) is not ours and is left where it is.
 *
 * What a write keeps, and what it does not. The file is read as JSON and written back with
 * `JSON.stringify`, so: KEPT are the indent (spaces or tabs, as the first indented key shows it),
 * the key order, the presence or absence of a trailing newline, the line-ending style (CRLF when
 * the file has any CRLF), a leading BOM, and every entry that is not ours (as a value: the same
 * keys, in the same order, with the same data). NOT kept are the file's spelling of those values
 * (a minified or compact file is reflowed to the indent; string escapes such as `é` and
 * number spellings such as `1.0` or digits beyond double precision are rewritten; a duplicate key
 * collapses to its last value) and mixed line endings (they become one kind). Removing our groups
 * therefore restores the user's bytes when the file was already in that reflowed form, which a
 * file written by this module or by `JSON.stringify` always is.
 */
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { EARLIER_GUARD_SCRIPTS, GUARD_OWNERSHIP_MARKER, GUARD_SCRIPT, nativeGuardHooks, type FailClosedHandler } from './guard.js';
import type { InstallScope } from './types.js';

/** Where the guard sits: the settings file the user chose. */
export type SessionGuardVariant = 'project' | 'local' | 'user';
/**
 * Which install records a guard, and so which commands reach it. `project`: a guard in a workspace settings file (the commands are run
 * from that project). `user`: a guard in the user settings file recorded by a global install (`--global`). `user-project`: a guard in the
 * user settings file recorded by a PROJECT install (`agents add --session-guard user` at project scope): the commands are run from that
 * project, without `--global`. `agents doctor` shows the commands of the reach of the lockfile it reads. The block message of the user
 * file does not depend on the reach: it names both (see `sessionGuardHint`).
 */
export type SessionGuardReach = 'project' | 'user' | 'user-project';
export type MergeStatus = 'created' | 'merged' | 'unchanged' | 'modified' | 'skipped-invalid';
export type RemoveStatus = 'removed' | 'deleted-file' | 'absent' | 'skipped-invalid';
export type InspectStatus = 'wired' | 'missing' | 'modified' | 'outdated' | 'skipped-invalid' | 'absent';

interface Handler { type?: unknown; command?: unknown; args?: unknown; onFailure?: unknown }
interface Group { matcher?: unknown; hooks?: unknown }
type Settings = Record<string, unknown> & { hooks?: Record<string, unknown> & { PreToolUse?: unknown[] } };

/** Workspace-relative settings file for each variant (`user` resolves against the home dir). */
export const SESSION_GUARD_FILES: Record<SessionGuardVariant, string> = {
  project: '.claude/settings.json',
  local: '.claude/settings.local.json',
  user: '.claude/settings.json',
};

/** Absolute settings path for a variant; `user` always means the home directory's settings. */
export function resolveSessionGuardFile(variant: SessionGuardVariant, workspaceRoot: string): string {
  const base = variant === 'user' ? os.homedir() : workspaceRoot;
  return path.join(base, ...SESSION_GUARD_FILES[variant].split('/'));
}

/** Variant a recorded lockfile path stands for (inverse of resolveSessionGuardFile). */
export function variantOfRecordedFile(file: string): SessionGuardVariant {
  if (path.isAbsolute(file)) return 'user';
  return file.endsWith('settings.local.json') ? 'local' : 'project';
}

/** The reach of a guard written by an install of `scope` into the file of `variant`. */
export function sessionGuardReach(variant: SessionGuardVariant, scope: InstallScope): SessionGuardReach {
  if (variant !== 'user') return 'project';
  return scope === 'global' ? 'user' : 'user-project';
}

const reachOf = (value: SessionGuardVariant | SessionGuardReach): SessionGuardReach => (value === 'local' ? 'project' : value);

/**
 * The two commands the session guard names when it blocks because it cannot do its work, and that the doctor shows (the maintainer's
 * decision of 2026-11-17). One place: the block message, the doctor and the tie test against the real CLI definition all read these.
 * A guard recorded by a global install (`user`) needs `--global` to be found by `agents update`; a guard in the user file recorded by a
 * project install is found from that project's folder, so it needs none.
 */
export function sessionGuardCommands(value: SessionGuardVariant | SessionGuardReach): { repair: string; remove: string } {
  const global = reachOf(value) === 'user' ? ' --global' : '';
  return { repair: `agents update --all${global}`, remove: `agents update --all${global} --no-session-guard` };
}

/** The variant of the settings file a guard sits in: `user` only for the home directory's own `.claude/settings.json`. */
export function variantOfFile(file: string): SessionGuardVariant {
  const user = path.resolve(os.homedir(), ...SESSION_GUARD_FILES.user.split('/'));
  return path.resolve(file) === user ? 'user' : 'project';
}

/**
 * Which script a guard carries. Two texts exist: one for the project and local settings files and one for the user settings file. The
 * text of the user file does not depend on which install wrote it (the file is shared by the global install and by every project that
 * records a guard in it, and two installs must not rewrite each other's message), so `user` and `user-project` carry the same script.
 */
type ScriptKind = 'project' | 'user';
const scriptKindOf = (value: SessionGuardVariant | SessionGuardReach): ScriptKind => (value === 'user' || value === 'user-project' ? 'user' : 'project');

/** The kind of script that counts as current in `file`. */
const kindOfFile = (file: string): ScriptKind => (variantOfFile(file) === 'user' ? 'user' : 'project');

const ALL_KINDS: readonly ScriptKind[] = ['project', 'user'];

/**
 * What the user can do with no working CLI, named by kind of file and without an absolute path. One wording with the doctor's route
 * (`sessionGuardManualRoute`) and the README: the entries are found by the script they run, and the script file goes after them.
 */
const MANUAL_ROUTE: Record<ScriptKind, string> = {
  project: 'Without the CLI, delete by hand the hook entries that run agents-united-session-guard.js from .claude/settings.json or .claude/settings.local.json in the project, and then delete the script file .claude/hooks/agents-united-session-guard.js in the project.',
  user: 'Without the CLI, delete by hand the hook entries that run agents-united-session-guard.js from settings.json in the .claude folder of your home directory, and then delete the script file agents-united-session-guard.js in the hooks folder beside it.',
};
/** The sentences of the version before (the entries held the marker text, then): the texts that carry them are earlier texts of ours. */
const EARLIER_MANUAL_ROUTE: Record<ScriptKind, string> = {
  project: "Without the CLI, delete by hand the hook entries that contain 'agents-united guard' from .claude/settings.json or .claude/settings.local.json in the project.",
  user: "Without the CLI, delete by hand the hook entries that contain 'agents-united guard' from settings.json in the .claude folder of your home directory.",
};

/**
 * The command that puts a user-file guard back on purpose, for the lockfile of `scope`: a plain update never re-creates it in the shared
 * user settings file (see the installer), and `agents doctor` and the update output name this command.
 */
export function sessionGuardRestoreCommand(scope: InstallScope): string {
  return `agents update --all${scope === 'global' ? ' --global' : ''} --session-guard user`;
}

/**
 * The manual route for a guard recorded in `file` (shown by `agents doctor`, which can name the files; the script cannot). The entries
 * run the script file, so they are found by its name and not by the marker text, and the script file goes after them. Same wording as
 * the route inside the script (`MANUAL_ROUTE`), with the paths filled in.
 */
export function sessionGuardManualRoute(file: string): string {
  return `Without the CLI, delete by hand the hook entries that run ${SESSION_GUARD_SCRIPT_NAME} from ${file}, and then delete the script file ${sessionGuardScriptPath(file)}.`;
}

/**
 * What the session guard adds to its messages: the two commands, to be run outside the session (its shell calls are blocked), and the
 * manual route that needs no CLI. The user-file text names both possibilities in plain words: `--global` for a guard a global install
 * wrote, and the same commands without it from the project's folder for a guard a project wrote. The folder is not in the text: the user
 * file is shared by every project that records a guard in it, and one project's folder would be wrong for the others, so `agents doctor`
 * names it.
 */
export function sessionGuardHint(value: SessionGuardVariant | SessionGuardReach): string {
  return hintWithRoute(scriptKindOf(value), MANUAL_ROUTE);
}

function hintWithRoute(kind: ScriptKind, routes: Record<ScriptKind, string>): string {
  const { repair, remove } = sessionGuardCommands(kind);
  const alternative = kind === 'user' ? '; if a project installed this guard, run the same commands without --global from that project\'s folder' : '';
  return `To get out, run one of these in your own terminal, not in this session (this session's shell calls are blocked): ${repair} (repairs the install) or ${remove} (removes the session guard)${alternative}. ${routes[kind]}`;
}

/** Builds the session script from a generic script and a hint: the hint after the unreadable-input sentence, and an `uncaughtException` handler with the same hint. */
const UNREADABLE_SENTENCE = 'so the guard cannot tell whether it is safe.';
function composeSessionScript(generic: string, hint: string): string {
  const inScript = JSON.stringify(hint).slice(1, -1);
  const failure = JSON.stringify(`Blocked by agents-united guard: the guard failed while reading this tool call. ${hint}\n`).slice(1, -1);
  return `process.on("uncaughtException",()=>{process.stderr.write("${failure}");process.exit(2)});${generic.replace(UNREADABLE_SENTENCE, () => `${UNREADABLE_SENTENCE} ${inScript}`)}`;
}

/**
 * The session guard's script: the generic guard script (one template, one set of patterns) plus the hint on the unreadable-input
 * message and an `uncaughtException` handler, so that an error inside the script blocks with the same hint instead of ending in a
 * bare failure. Only this variant carries the session text; the role guards keep the generic script.
 */
export function sessionGuardScript(value: SessionGuardVariant | SessionGuardReach): string {
  return composeSessionScript(GUARD_SCRIPT, sessionGuardHint(value));
}

/**
 * The session scripts of the versions before: the generic script of the version before that with the three hints it wrote (project, user
 * recorded globally, user recorded by a project), then the two texts (project, user) that named the old manual route. They are ours and
 * not current, so they read as outdated and `agents update` renews them. A test ties each to its byte-exact hash.
 */
export const EARLIER_SESSION_SCRIPTS: readonly string[] = (() => {
  const stem = "To get out, run one of these in your own terminal, not in this session (this session's shell calls are blocked)";
  const end = '(repairs the install) or';
  const tail = '(removes the session guard).';
  const hints = [
    `${stem}: agents update --all ${end} agents update --all --no-session-guard ${tail}`,
    `${stem}: agents update --all --global ${end} agents update --all --global --no-session-guard ${tail}`,
    `${stem}, from the folder of the project that installed this guard: agents update --all ${end} agents update --all --no-session-guard ${tail}`,
  ];
  // The texts that were current when the script moved into a file: today's generic script with the manual route that named "the hook entries
  // that contain 'agents-united guard'" (project, user). The entries of the file form do not contain that text, so the sentence changed.
  const withEarlierRoute = ALL_KINDS.map(kind => composeSessionScript(GUARD_SCRIPT, hintWithRoute(kind, EARLIER_MANUAL_ROUTE)));
  return [...hints.map(hint => composeSessionScript(EARLIER_GUARD_SCRIPTS[1], hint)), ...withEarlierRoute];
})();

/**
 * The session guard's script is a FILE beside the settings file it serves (ADR 0068, addendum of 2026-11-18, finding G6): Claude Code
 * prints the hook's whole command line in front of every refusal, and an inline `node -e <script>` put the script's source, with the
 * texts of its failure messages, in front of every ordinary block. The entry now names the file, so the notice shows a short path.
 * `project` and `local` settings files share `<project>/.claude/hooks/`, named with `${CLAUDE_PROJECT_DIR}` (the placeholder a
 * project-level hook can use); the user settings file has no such placeholder for the home folder (the hooks reference lists
 * `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` only, and exec form runs no shell to expand `~` or `$HOME`), so the
 * user entry carries the absolute path.
 */
export const SESSION_GUARD_SCRIPT_NAME = 'agents-united-session-guard.js';
/** The reference the entries of a project or local settings file carry. */
export const SESSION_GUARD_SCRIPT_REFERENCE = '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-session-guard.js';

/** The script file that serves a settings file: in the `hooks` folder beside it. */
export function sessionGuardScriptPath(settingsFile: string): string {
  return path.join(path.dirname(settingsFile), 'hooks', SESSION_GUARD_SCRIPT_NAME);
}

/** What an entry runs for a kind of settings file: the project placeholder path, or the absolute path of the user file's script. */
function scriptReferenceOf(kind: ScriptKind): string {
  return kind === 'user' ? sessionGuardScriptPath(resolveSessionGuardFile('user', os.homedir())) : SESSION_GUARD_SCRIPT_REFERENCE;
}

/** The session guard's handler for a reach: `node <script file>`, exactly four keys, `onFailure: 'block'`. The script text is `sessionGuardScript`. */
export function sessionGuardHandler(value: SessionGuardVariant | SessionGuardReach = 'project'): FailClosedHandler {
  return { type: 'command', command: 'node', args: [scriptReferenceOf(scriptKindOf(value))], onFailure: 'block' };
}

/** The bytes of the script file for a reach: the session script and one trailing newline. */
export function sessionGuardScriptContent(value: SessionGuardVariant | SessionGuardReach = 'project'): string {
  return `${sessionGuardScript(value)}\n`;
}

/** Line endings and one trailing newline do not count as a change (a project file can be checked out with CRLF). */
const normalizeScript = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\n$/, '');

/** Content hash of a script file as recorded in the lockfile: sha256 of the text with LF endings and one trailing newline. */
export function hashSessionGuardScript(text: string): string {
  return `sha256:${crypto.createHash('sha256').update(`${normalizeScript(text)}\n`).digest('hex')}`;
}

/** Every text of the script that is ours: the current one of each kind of file, and the earlier session and generic texts. */
const KNOWN_SCRIPT_TEXTS: readonly string[] = [sessionGuardScript('project'), sessionGuardScript('user'), GUARD_SCRIPT, ...EARLIER_GUARD_SCRIPTS, ...EARLIER_SESSION_SCRIPTS];

export type SessionGuardScriptState = 'present' | 'missing' | 'outdated' | 'modified';
export type SessionGuardScriptStatus = 'created' | 'renewed' | 'unchanged' | 'modified';

/** `present`: the current text. `outdated`: an earlier text of ours (or one whose hash was recorded). `modified`: anything else. */
function classifyScript(text: string | undefined, kind: ScriptKind, recordedHash?: string): SessionGuardScriptState {
  if (text === undefined) return 'missing';
  const normalized = normalizeScript(text);
  if (normalized === sessionGuardScript(kind)) return 'present';
  if (KNOWN_SCRIPT_TEXTS.includes(normalized) || (recordedHash !== undefined && hashSessionGuardScript(text) === recordedHash)) return 'outdated';
  return 'modified';
}

const readScript = async (target: string): Promise<string | undefined> => ((await fs.pathExists(target)) ? fs.readFile(target, 'utf8') : undefined);

/** Doctor view of the script file that serves `settingsFile`. */
export async function inspectSessionGuardScript(settingsFile: string, recordedScriptHash?: string): Promise<SessionGuardScriptState> {
  return classifyScript(await readScript(sessionGuardScriptPath(settingsFile)), kindOfFile(settingsFile), recordedScriptHash);
}

/** Write the script file: create it, renew an earlier text of ours, leave a file that was edited by hand. Idempotent. */
async function ensureSessionGuardScript(settingsFile: string, recordedScriptHash?: string): Promise<{ status: SessionGuardScriptStatus; hash: string }> {
  const kind = kindOfFile(settingsFile);
  const target = sessionGuardScriptPath(settingsFile);
  const content = sessionGuardScriptContent(kind);
  const hash = hashSessionGuardScript(content);
  const state = classifyScript(await readScript(target), kind, recordedScriptHash);
  if (state === 'present') return { status: 'unchanged', hash };
  if (state === 'modified') return { status: 'modified', hash };
  await fs.ensureDir(path.dirname(target));
  await fs.writeFile(target, content, 'utf8');
  return { status: state === 'missing' ? 'created' : 'renewed', hash };
}

/**
 * `project` and `local` settings files share one script. The other settings file of the same `.claude` folder that still has an entry
 * running it (current, outdated in the file form, or hand-edited), or that cannot be read and so may have one; undefined when none does.
 * The user file has a script of its own under the home folder and has no sibling.
 */
async function siblingUsingScript(settingsFile: string): Promise<string | undefined> {
  if (kindOfFile(settingsFile) === 'user') return undefined;
  for (const name of ['settings.json', 'settings.local.json']) {
    const other = path.join(path.dirname(settingsFile), name);
    if (path.resolve(other) === path.resolve(settingsFile)) continue;
    const parsed = await parse(other);
    if (parsed === 'absent') continue;
    if (parsed === 'invalid') return other;
    const groups = parsed.settings.hooks?.PreToolUse ?? [];
    if (groups.some(group => hooksOf(group).some(handler => isRecord(handler) && namesScriptFile(handler as Handler)))) return other;
  }
  return undefined;
}

export type SessionGuardScriptRemoval = { script: 'removed' | 'left-edited' | 'kept-shared'; sharedWith?: string };

/**
 * Remove the script file when it is ours or an earlier text of ours, and its folder when that is empty. A file edited by hand is left, and
 * so is a file that the other settings file of the folder (project and local share it) still runs.
 */
async function removeSessionGuardScript(settingsFile: string, recordedScriptHash?: string): Promise<SessionGuardScriptRemoval | undefined> {
  const target = sessionGuardScriptPath(settingsFile);
  const state = classifyScript(await readScript(target), kindOfFile(settingsFile), recordedScriptHash);
  if (state === 'missing') return undefined;
  const sharedWith = await siblingUsingScript(settingsFile);
  if (sharedWith !== undefined) return { script: 'kept-shared', sharedWith };
  if (state === 'modified') return { script: 'left-edited' };
  await fs.remove(target);
  // Role guards live in the same folder: it goes only when nothing else is in it.
  await fs.rmdir(path.dirname(target)).catch(() => undefined);
  return { script: 'removed' };
}

/** A path as the user reads it in the output: workspace-relative with forward slashes when it sits inside the workspace, else absolute. */
export function displaySessionGuardPath(absolute: string, workspaceRoot: string): string {
  const relative = path.relative(workspaceRoot, absolute);
  return relative === '' || relative.startsWith('..') || path.isAbsolute(relative) ? absolute : relative.replace(/\\/g, '/');
}

/** What was left of the script file, as a sentence for the install, update and uninstall output; undefined when nothing was left. `display` names a path as the user reads it. */
export function sessionGuardScriptLeftNote(
  settingsFile: string,
  outcome: { script?: 'removed' | 'left-edited' | 'kept-shared'; scriptSharedWith?: string },
  display: (absolute: string) => string,
): string | undefined {
  const label = display(sessionGuardScriptPath(settingsFile));
  if (outcome.script === 'left-edited') return `Session guard script ${label} was edited by hand, so it was left in place; remove it by hand.`;
  if (outcome.script === 'kept-shared' && outcome.scriptSharedWith !== undefined) {
    return `Session guard script ${label} was kept: ${display(outcome.scriptSharedWith)} still has hook entries that run it. It goes when the guard is removed from that file too.`;
  }
  return undefined;
}

/** The matchers the role guards carry (`nativeGuardHooks`, the one source), and the matchers this guard wrote before it matched the same tools. */
const GROUP_MATCHERS: ReadonlyArray<{ matcher: string; earlier: string }> = (() => {
  const earlier: Record<string, string> = { 'Bash|PowerShell': 'Bash', 'Write|Edit|MultiEdit|NotebookEdit': 'Write|Edit|NotebookEdit' };
  return nativeGuardHooks().PreToolUse.map(group => ({ matcher: group.matcher, earlier: earlier[group.matcher] ?? group.matcher }));
})();

/** The PreToolUse groups the session guard writes: the matchers of the role guards (shells including PowerShell, file writers including MultiEdit). */
export function sessionGuardHooks(value: SessionGuardVariant | SessionGuardReach = 'project'): { PreToolUse: Array<{ matcher: string; hooks: FailClosedHandler[] }> } {
  return { PreToolUse: GROUP_MATCHERS.map(group => ({ matcher: group.matcher, hooks: [sessionGuardHandler(value)] })) };
}

const hashHandler = (handler: object): string => crypto.createHash('sha256').update(JSON.stringify(handler)).digest('hex').slice(0, 16);

/** Stable hash of the current exec-form handler, recorded in the lockfile as ownership proof. */
export function guardHandlerHash(value: SessionGuardVariant | SessionGuardReach = 'project'): string {
  return hashHandler(sessionGuardHandler(value));
}

/** The snippet a user pastes by hand when their settings file cannot be rewritten safely. */
export function sessionGuardSnippet(value: SessionGuardVariant | SessionGuardReach = 'project'): string {
  return JSON.stringify({ hooks: sessionGuardHooks(value) }, null, 2);
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const asGroup = (value: unknown): Group | undefined => (isRecord(value) ? (value as Group) : undefined);
/** The hooks of a group, or none when the group is not an object or its `hooks` is not a list. */
const hooksOf = (group: unknown): unknown[] => {
  const hooks = asGroup(group)?.hooks;
  return Array.isArray(hooks) ? hooks : [];
};

/** An entry that runs our script file: its first argument ends in `.claude/hooks/agents-united-session-guard.js`, with either kind of slash. */
const namesScriptFile = (handler: Handler): boolean =>
  Array.isArray(handler.args) && typeof handler.args[0] === 'string' && handler.args[0].replace(/\\/g, '/').endsWith(`/.claude/hooks/${SESSION_GUARD_SCRIPT_NAME}`);

/** Ours in any version: the file form (the entry names our script file), or an inline `node -e` handler whose script carries the marker. */
const isOursAnyVersion = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const handler = value as Handler;
  if (handler.command !== 'node' || !Array.isArray(handler.args)) return false;
  if (namesScriptFile(handler)) return true;
  return handler.args[0] === '-e' && typeof handler.args[1] === 'string' && handler.args[1].includes(GUARD_OWNERSHIP_MARKER);
};

const groupIsOurs = (group: unknown): boolean => hooksOf(group).some(isOursAnyVersion);

/** The same keys with the same values: an extra key (`async`, `timeout`, `if`, `shell`) is a different handler, a different key order is not. */
const sameHandler = (handler: Record<string, unknown>, expected: object): boolean => {
  const wanted = expected as Record<string, unknown>;
  const keys = Object.keys(handler).sort();
  const wantedKeys = Object.keys(wanted).sort();
  return keys.length === wantedKeys.length && keys.every((key, index) => key === wantedKeys[index] && JSON.stringify(handler[key]) === JSON.stringify(wanted[key]));
};

const isCurrentGuard = (value: unknown, kind: ScriptKind): boolean => isRecord(value) && sameHandler(value, sessionGuardHandler(kind));

/**
 * An earlier version of our handler, which `agents update` renews. Outdated means: ours, not current, and either (a) exactly one of our
 * earlier INLINE forms (`node -e <script>`; the current form names a script file): `type`, `command` and `args` only, or those plus
 * `onFailure: "block"`, with the script being the generic guard script (the form written before the session guard had its own script),
 * an earlier generic script text, a session script of the version before (`EARLIER_SESSION_SCRIPTS`, which includes every earlier
 * user-file text), or the session script of either kind of file as the inline form carried it until the script moved into a file;
 * or (b) a handler whose hash is the one recorded in the lockfile for an earlier version. Anything else in our group is hand-edited.
 */
const isOutdatedGuard = (value: unknown, kind: ScriptKind, recordedHash?: string): boolean => {
  if (!isRecord(value) || !isOursAnyVersion(value) || isCurrentGuard(value, kind)) return false;
  if (recordedHash !== undefined && hashHandler(value) === recordedHash) return true;
  const handler = value as Handler;
  const keys = Object.keys(value);
  const script = (handler.args as unknown[])[1] as string;
  return (
    keys.every(key => key === 'type' || key === 'command' || key === 'args' || (key === 'onFailure' && handler.onFailure === 'block')) &&
    handler.type === 'command' &&
    (handler.args as unknown[]).length === 2 &&
    (handler.args as unknown[])[0] === '-e' &&
    (script === GUARD_SCRIPT || EARLIER_GUARD_SCRIPTS.includes(script) || EARLIER_SESSION_SCRIPTS.includes(script) || ALL_KINDS.some(other => script === sessionGuardScript(other)))
  );
};

interface Parsed { settings: Settings; indent: string | number; eol: string; trailingNewline: boolean; bom: boolean }

async function parse(file: string): Promise<Parsed | 'absent' | 'invalid'> {
  if (!(await fs.pathExists(file))) return 'absent';
  const raw = await fs.readFile(file, 'utf8');
  const bom = raw.charCodeAt(0) === 0xfeff;
  const text = bom ? raw.slice(1) : raw;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  // A file with no content holds nothing of the user's: it reads as an empty settings object.
  if (text.trim() === '') return { settings: {}, indent: 2, eol, trailingNewline: true, bom };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return 'invalid';
  }
  if (!isRecord(value)) return 'invalid';
  const hooks = (value as Settings).hooks;
  if (hooks !== undefined && !isRecord(hooks)) return 'invalid';
  if (hooks?.PreToolUse !== undefined && !Array.isArray(hooks.PreToolUse)) return 'invalid';
  const indentMatch = text.match(/\n([ \t]+)"/);
  return {
    settings: value as Settings,
    indent: indentMatch ? indentMatch[1] : 2,
    eol,
    trailingNewline: /\r?\n$/.test(text),
    bom,
  };
}

async function write(file: string, parsed: Omit<Parsed, 'settings'>, settings: Settings): Promise<void> {
  let text = JSON.stringify(settings, null, parsed.indent);
  if (parsed.eol === '\r\n') text = text.replace(/\n/g, '\r\n');
  if (parsed.trailingNewline) text += parsed.eol;
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, (parsed.bom ? '﻿' : '') + text, 'utf8');
}

/**
 * Add the guard's two PreToolUse groups. A group whose guard handler was hand-edited is left alone (`modified`, never auto-repaired);
 * an older guard version (recorded by `replaceHash`, or one of our known earlier forms) is replaced where it stands, and a group that
 * carries the earlier matchers moves to the matchers of today (a group that also holds the user's own hooks keeps them under the old
 * matcher). The script is the one of the file's kind (project and local files, or the user file), whoever installs.
 */
export async function mergeSessionGuard(
  file: string,
  opts: { replaceHash?: string; recordedScriptHash?: string } = {},
): Promise<{ status: MergeStatus; handlerHash: string; script: { status: SessionGuardScriptStatus; hash: string } }> {
  const kind = kindOfFile(file);
  const wanted = sessionGuardHandler(kind);
  const handlerHash = hashHandler(wanted);
  // The script file first, so that an entry never names a file that is not there yet. It is written also when the settings file cannot be
  // rewritten (invalid JSON), so the entry the user pastes by hand works.
  const script = await ensureSessionGuardScript(file, opts.recordedScriptHash);
  const parsed = await parse(file);
  if (parsed === 'invalid') return { status: 'skipped-invalid', handlerHash, script };

  const created = parsed === 'absent';
  const base = created ? { indent: 2, eol: '\n', trailingNewline: true, bom: false } : parsed;
  const settings: Settings = created ? {} : parsed.settings;
  const hooks = (settings.hooks ??= {});
  const pre: unknown[] = (hooks.PreToolUse ??= []);

  let changed = false;
  let modified = false;
  // Our earlier version (recorded hash, or one of our known earlier forms): the handler is replaced where it stands, so the group keeps
  // its place and every other entry of the file stays as it was. A hand-edited handler is never touched.
  for (const entry of pre) {
    const group = asGroup(entry);
    if (!group || !groupIsOurs(group)) continue;
    group.hooks = hooksOf(group).map(handler => {
      if (!isOursAnyVersion(handler)) return handler;
      if (!isOutdatedGuard(handler, kind, opts.replaceHash)) return handler;
      changed = true;
      return JSON.parse(JSON.stringify(wanted)) as Handler;
    });
  }

  for (const want of GROUP_MATCHERS) {
    const here = pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.matcher);
    if (here.some(entry => hooksOf(entry).some(handler => isCurrentGuard(handler, kind)))) continue;
    if (here.length > 0) {
      modified = true;
      continue;
    }
    // A group written with the matcher of an earlier version: move it to today's matcher when everything of ours in it is renewable.
    const earlier = want.earlier === want.matcher ? [] : pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.earlier);
    let placed = false;
    for (const entry of earlier) {
      const group = asGroup(entry)!;
      const oursHere = hooksOf(group).filter(isOursAnyVersion);
      if (!oursHere.every(handler => isCurrentGuard(handler, kind))) {
        modified = true;
        placed = true;
        continue;
      }
      if (hooksOf(group).every(isOursAnyVersion)) {
        group.matcher = want.matcher;
        placed = true;
        changed = true;
        break;
      }
      group.hooks = hooksOf(group).filter(handler => !isOursAnyVersion(handler));
    }
    if (placed) continue;
    pre.push({ matcher: want.matcher, hooks: [JSON.parse(JSON.stringify(wanted)) as Handler] });
    changed = true;
  }

  if (!changed) return { status: modified ? 'modified' : 'unchanged', handlerHash, script };
  await write(file, base, settings);
  return { status: created ? 'created' : 'merged', handlerHash, script };
}

/**
 * Remove only the handlers that are ours and not hand-edited (current, or an earlier form that `agents update` would renew): the way out
 * of a session guard that blocks, and what an uninstall does. A handler that carries our marker but was changed is left in place and
 * counted in `left`, never deleted silently. A group that held only our handlers goes; a group that also holds the user's own hooks keeps
 * them. Everything else in the file stays, and the file's indent, line endings and BOM are reused. The file is deleted only when
 * agents-united created it and nothing remains.
 */
export async function removeOwnedSessionGuard(
  file: string,
  opts: { createdFile: boolean; recordedHash?: string; recordedScriptHash?: string },
): Promise<{ status: RemoveStatus; left: number; script?: 'removed' | 'left-edited' | 'kept-shared'; scriptSharedWith?: string }> {
  const outcome = await removeOwnedHandlers(file, opts);
  // The script file goes with the entries, but only while no entry of ours is left behind that may still name it (a hand-edited entry), and
  // never when the settings file could not be read. Entries the user deleted by hand leave the script orphaned: it goes too.
  if (outcome.status === 'skipped-invalid' || outcome.left > 0) return outcome;
  const removal = await removeSessionGuardScript(file, opts.recordedScriptHash);
  return removal === undefined ? outcome : { ...outcome, script: removal.script, ...(removal.sharedWith !== undefined ? { scriptSharedWith: removal.sharedWith } : {}) };
}

async function removeOwnedHandlers(
  file: string,
  opts: { createdFile: boolean; recordedHash?: string },
): Promise<{ status: RemoveStatus; left: number }> {
  const parsed = await parse(file);
  if (parsed === 'absent') return { status: 'absent', left: 0 };
  if (parsed === 'invalid') return { status: 'skipped-invalid', left: 0 };
  const { settings } = parsed;
  const pre = settings.hooks?.PreToolUse;
  if (!pre || !pre.some(groupIsOurs)) return { status: 'absent', left: 0 };

  const kind = kindOfFile(file);
  let removed = 0;
  let left = 0;
  const kept: unknown[] = [];
  for (const entry of pre) {
    if (!groupIsOurs(entry)) {
      kept.push(entry);
      continue;
    }
    const group = asGroup(entry)!;
    const hooksBefore = hooksOf(group);
    const remaining = hooksBefore.filter(handler => {
      if (!isOursAnyVersion(handler)) return true;
      if (isCurrentGuard(handler, kind) || isOutdatedGuard(handler, kind, opts.recordedHash)) {
        removed++;
        return false;
      }
      left++;
      return true;
    });
    if (remaining.length === hooksBefore.length) kept.push(entry);
    else if (remaining.length > 0) kept.push({ ...group, hooks: remaining });
  }
  if (removed === 0) return { status: 'absent', left };

  if (kept.length > 0) {
    settings.hooks!.PreToolUse = kept;
  } else {
    delete settings.hooks!.PreToolUse;
    if (Object.keys(settings.hooks!).length === 0) delete settings.hooks;
  }
  if (opts.createdFile && Object.keys(settings).length === 0) {
    await fs.remove(file);
    return { status: 'deleted-file', left };
  }
  await write(file, parsed, settings);
  return { status: 'removed', left };
}

/** Doctor view: is the current guard wired in this file? */
export async function inspectSessionGuard(file: string, recordedHash?: string): Promise<InspectStatus> {
  const parsed = await parse(file);
  if (parsed === 'absent' || parsed === 'invalid') return parsed === 'absent' ? 'absent' : 'skipped-invalid';
  const pre = parsed.settings.hooks?.PreToolUse ?? [];
  const kind = kindOfFile(file);
  let allCurrent = true;
  let anyModified = false;
  for (const want of GROUP_MATCHERS) {
    const here = pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.matcher);
    if (here.some(entry => hooksOf(entry).some(handler => isCurrentGuard(handler, kind)))) continue;
    allCurrent = false;
    // Not current: an older version of our handler, or a group with the matcher of an earlier version, is "outdated"; any other difference is a hand edit.
    const earlier = want.earlier === want.matcher ? [] : pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.earlier);
    const handlers = [...here, ...earlier].flatMap(entry => hooksOf(entry).filter(isOursAnyVersion));
    const renewable = (handler: unknown): boolean => isOutdatedGuard(handler, kind, recordedHash) || (earlier.some(entry => hooksOf(entry).includes(handler)) && isCurrentGuard(handler, kind));
    // A matcher with no group of ours (removed, or edited until the marker is gone) while another still has one is also an edit.
    if (handlers.length === 0 || !handlers.every(renewable)) anyModified = true;
  }
  if (allCurrent) return 'wired';
  if (!pre.some(groupIsOurs)) return 'missing';
  return anyModified ? 'modified' : 'outdated';
}
