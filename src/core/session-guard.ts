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
 *   - ownership is recognised by the guard's marker text inside an exec-form `node -e` handler;
 *     the CURRENT guard is recognised by exact equality, the same four keys with the same values
 *     (an extra key such as `async` or `timeout` makes a handler "modified": reported, never
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
import { EARLIER_GUARD_SCRIPTS, GUARD_OWNERSHIP_MARKER, GUARD_SCRIPT, guardScript, nativeGuardHooks, type FailClosedHandler } from './guard.js';
import type { InstallScope } from './types.js';

/** Where the guard sits: the settings file the user chose. */
export type SessionGuardVariant = 'project' | 'local' | 'user';
/**
 * Whose way-out the guard's script names. `project`: a guard in a workspace settings file (the commands are run from that project).
 * `user`: a guard in the user settings file recorded by a global install (`--global`). `user-project`: a guard in the user settings
 * file recorded by a PROJECT install (`agents add --session-guard user` at project scope): the commands must be run from that project.
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

/** The reach a write into `file` has when the caller does not say: a global install for the user file, else a project. */
const defaultReach = (file: string): SessionGuardReach => (variantOfFile(file) === 'user' ? 'user' : 'project');

/** The reaches whose guard counts as current in `file`: the user file is shared by global and project installs, so either one. */
const reachesOfFile = (file: string): SessionGuardReach[] => (variantOfFile(file) === 'user' ? ['user', 'user-project'] : ['project']);

const ALL_REACHES: readonly SessionGuardReach[] = ['project', 'user', 'user-project'];

/**
 * What the session guard adds to its messages: the two commands, to be run outside the session (its shell calls are blocked). The folder
 * is not in the text: the user file is shared by every project that records a guard in it, and one project's folder would be wrong for
 * the others, so a guard recorded by a project says "the project that installed this guard" and `agents doctor` names the folder.
 */
export function sessionGuardHint(value: SessionGuardVariant | SessionGuardReach): string {
  const { repair, remove } = sessionGuardCommands(value);
  const where = reachOf(value) === 'user-project' ? ', from the folder of the project that installed this guard' : '';
  return `To get out, run one of these in your own terminal, not in this session (this session's shell calls are blocked)${where}: ${repair} (repairs the install) or ${remove} (removes the session guard).`;
}

/**
 * The session guard's script: the generic guard script (one template, one set of patterns) plus the hint on the unreadable-input
 * message and an `uncaughtException` handler, so that an error inside the script blocks with the same hint instead of ending in a
 * bare failure. Only this variant carries the session text; the role guards keep the generic script.
 */
export function sessionGuardScript(value: SessionGuardVariant | SessionGuardReach): string {
  const hint = JSON.stringify(sessionGuardHint(value)).slice(1, -1);
  const failure = JSON.stringify(`Blocked by agents-united guard: the guard failed while reading this tool call. ${sessionGuardHint(value)}\n`).slice(1, -1);
  return `process.on("uncaughtException",()=>{process.stderr.write("${failure}");process.exit(2)});${guardScript(` ${hint}`)}`;
}

/** The session guard's handler for a reach: the same shape as the role handler (`onFailure: 'block'`), the session script. */
export function sessionGuardHandler(value: SessionGuardVariant | SessionGuardReach = 'project'): FailClosedHandler {
  return { type: 'command', command: 'node', args: ['-e', sessionGuardScript(value)], onFailure: 'block' };
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

const isOursAnyVersion = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const handler = value as Handler;
  return (
    handler.command === 'node' &&
    Array.isArray(handler.args) &&
    handler.args[0] === '-e' &&
    typeof handler.args[1] === 'string' &&
    handler.args[1].includes(GUARD_OWNERSHIP_MARKER)
  );
};

const groupIsOurs = (group: unknown): boolean => hooksOf(group).some(isOursAnyVersion);

/** The same keys with the same values: an extra key (`async`, `timeout`, `if`, `shell`) is a different handler, a different key order is not. */
const sameHandler = (handler: Record<string, unknown>, expected: object): boolean => {
  const wanted = expected as Record<string, unknown>;
  const keys = Object.keys(handler).sort();
  const wantedKeys = Object.keys(wanted).sort();
  return keys.length === wantedKeys.length && keys.every((key, index) => key === wantedKeys[index] && JSON.stringify(handler[key]) === JSON.stringify(wanted[key]));
};

const isCurrentGuard = (value: unknown, reaches: readonly SessionGuardReach[]): boolean =>
  isRecord(value) && reaches.some(reach => sameHandler(value, sessionGuardHandler(reach)));

/**
 * An earlier version of our handler, which `agents update` renews. Outdated means: ours, not current, and either (a) exactly one of our
 * earlier forms: `type`, `command` and `args` only, or those plus `onFailure: "block"`, with the script being the generic guard script
 * (the form written before the session guard had its own script), an earlier generic script text, or a session script of another reach;
 * or (b) a handler whose hash is the one recorded in the lockfile for an earlier version. Anything else in our group is hand-edited.
 */
const isOutdatedGuard = (value: unknown, reaches: readonly SessionGuardReach[], recordedHash?: string): boolean => {
  if (!isRecord(value) || !isOursAnyVersion(value) || isCurrentGuard(value, reaches)) return false;
  if (recordedHash !== undefined && hashHandler(value) === recordedHash) return true;
  const handler = value as Handler;
  const keys = Object.keys(value);
  const script = (handler.args as unknown[])[1] as string;
  return (
    keys.every(key => key === 'type' || key === 'command' || key === 'args' || (key === 'onFailure' && handler.onFailure === 'block')) &&
    handler.type === 'command' &&
    (handler.args as unknown[]).length === 2 &&
    (script === GUARD_SCRIPT || EARLIER_GUARD_SCRIPTS.includes(script) || ALL_REACHES.some(reach => script === sessionGuardScript(reach)))
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
 * matcher). `reach` says whose way-out the script names; it defaults to what the file is.
 */
export async function mergeSessionGuard(
  file: string,
  opts: { replaceHash?: string; reach?: SessionGuardReach } = {},
): Promise<{ status: MergeStatus; handlerHash: string }> {
  const reach = opts.reach ?? defaultReach(file);
  const reaches = reachesOfFile(file);
  const wanted = sessionGuardHandler(reach);
  const handlerHash = hashHandler(wanted);
  const parsed = await parse(file);
  if (parsed === 'invalid') return { status: 'skipped-invalid', handlerHash };

  const created = parsed === 'absent';
  const base = created ? { indent: 2, eol: '\n', trailingNewline: true, bom: false } : parsed;
  const settings: Settings = created ? {} : parsed.settings;
  const hooks = (settings.hooks ??= {});
  const pre: unknown[] = (hooks.PreToolUse ??= []);

  let changed = false;
  let modified = false;
  // Our earlier version (recorded hash, or one of our known earlier forms), or a current guard of another reach in the shared user file:
  // the handler is replaced where it stands, so the group keeps its place and every other entry of the file stays as it was. A
  // hand-edited handler is never touched.
  for (const entry of pre) {
    const group = asGroup(entry);
    if (!group || !groupIsOurs(group)) continue;
    group.hooks = hooksOf(group).map(handler => {
      if (!isOursAnyVersion(handler)) return handler;
      const renew = isCurrentGuard(handler, reaches) ? !sameHandler(handler as Record<string, unknown>, wanted) : isOutdatedGuard(handler, reaches, opts.replaceHash);
      if (!renew) return handler;
      changed = true;
      return JSON.parse(JSON.stringify(wanted)) as Handler;
    });
  }

  for (const want of GROUP_MATCHERS) {
    const here = pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.matcher);
    if (here.some(entry => hooksOf(entry).some(handler => isCurrentGuard(handler, reaches)))) continue;
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
      if (!oursHere.every(handler => isCurrentGuard(handler, reaches))) {
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

  if (!changed) return { status: modified ? 'modified' : 'unchanged', handlerHash };
  await write(file, base, settings);
  return { status: created ? 'created' : 'merged', handlerHash };
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
  opts: { createdFile: boolean; recordedHash?: string },
): Promise<{ status: RemoveStatus; left: number }> {
  const parsed = await parse(file);
  if (parsed === 'absent') return { status: 'absent', left: 0 };
  if (parsed === 'invalid') return { status: 'skipped-invalid', left: 0 };
  const { settings } = parsed;
  const pre = settings.hooks?.PreToolUse;
  if (!pre || !pre.some(groupIsOurs)) return { status: 'absent', left: 0 };

  const reaches = reachesOfFile(file);
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
      if (isCurrentGuard(handler, reaches) || isOutdatedGuard(handler, reaches, opts.recordedHash)) {
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
  const reaches = reachesOfFile(file);
  let allCurrent = true;
  let anyModified = false;
  for (const want of GROUP_MATCHERS) {
    const here = pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.matcher);
    if (here.some(entry => hooksOf(entry).some(handler => isCurrentGuard(handler, reaches)))) continue;
    allCurrent = false;
    // Not current: an older version of our handler, or a group with the matcher of an earlier version, is "outdated"; any other difference is a hand edit.
    const earlier = want.earlier === want.matcher ? [] : pre.filter(entry => groupIsOurs(entry) && asGroup(entry)?.matcher === want.earlier);
    const handlers = [...here, ...earlier].flatMap(entry => hooksOf(entry).filter(isOursAnyVersion));
    const renewable = (handler: unknown): boolean => isOutdatedGuard(handler, reaches, recordedHash) || (earlier.some(entry => hooksOf(entry).includes(handler)) && isCurrentGuard(handler, reaches));
    // A matcher with no group of ours (removed, or edited until the marker is gone) while another still has one is also an edit.
    if (handlers.length === 0 || !handlers.every(renewable)) anyModified = true;
  }
  if (allCurrent) return 'wired';
  if (!pre.some(groupIsOurs)) return 'missing';
  return anyModified ? 'modified' : 'outdated';
}
