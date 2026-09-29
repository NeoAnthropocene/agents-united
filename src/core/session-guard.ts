/**
 * Plan 023 Workstream A (owner decisions D1–D2, 2026-09-26) — the plain-session guard.
 *
 * The Plan 022 guard lives in role frontmatter, so it fires only while an agents-united role
 * runs. A plain `claude` session in the same repo is covered only by a settings-level hook.
 * Hook entries MERGE across settings levels (Claude Code hooks reference), so this module adds
 * our two PreToolUse groups to a settings file beside whatever the user already has.
 *
 * This is the first write agents-united makes into a user-owned file, so it is deliberately
 * conservative:
 *   - the file is parsed as strict JSON; anything else (JSONC comments, trailing commas, a
 *     non-object root) is NEVER rewritten — the caller reports `skipped-invalid`;
 *   - every other key and hook entry is preserved in order, and the file's own indent, EOL and
 *     trailing-newline style are reused, so removing our groups restores the user's bytes;
 *   - ownership is recognized by the guard's marker text inside an exec-form `node -e` handler;
 *     the CURRENT guard is recognized by exact handler equality (`guardHandlerHash`).
 */
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import { guardHandler, managedGuardHooks } from './guard.js';

export type SessionGuardVariant = 'project' | 'local' | 'user';
export type MergeStatus = 'created' | 'merged' | 'unchanged' | 'modified' | 'skipped-invalid';
export type RemoveStatus = 'removed' | 'deleted-file' | 'absent' | 'skipped-invalid';
export type InspectStatus = 'wired' | 'missing' | 'modified' | 'skipped-invalid' | 'absent';

interface Handler { type?: string; command?: string; args?: unknown[] }
interface Group { matcher?: string; hooks?: Handler[] }
type Settings = Record<string, unknown> & { hooks?: Record<string, unknown> & { PreToolUse?: Group[] } };

/** Text every version of the guard script carries (ownership marker for older/edited copies). */
const GUARD_MARKER = 'Blocked by agents-united guard';

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

/** Stable hash of the current exec-form handler — recorded in the lockfile as ownership proof. */
export function guardHandlerHash(): string {
  return crypto.createHash('sha256').update(JSON.stringify(guardHandler())).digest('hex').slice(0, 16);
}

/** The snippet a user pastes by hand when their settings file cannot be rewritten safely. */
export function sessionGuardSnippet(): string {
  return JSON.stringify({ hooks: managedGuardHooks() }, null, 2);
}

const isOursAnyVersion = (handler: Handler): boolean =>
  handler.command === 'node' &&
  Array.isArray(handler.args) &&
  handler.args[0] === '-e' &&
  typeof handler.args[1] === 'string' &&
  (handler.args[1] as string).includes(GUARD_MARKER);

const isCurrentGuard = (handler: Handler): boolean =>
  JSON.stringify({ type: handler.type, command: handler.command, args: handler.args }) === JSON.stringify(guardHandler());

const groupIsOurs = (group: Group): boolean => Array.isArray(group.hooks) && group.hooks.some(isOursAnyVersion);

interface Parsed { settings: Settings; indent: string | number; eol: string; trailingNewline: boolean }

async function parse(file: string): Promise<Parsed | 'absent' | 'invalid'> {
  if (!(await fs.pathExists(file))) return 'absent';
  const text = await fs.readFile(file, 'utf8');
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return 'invalid';
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  const hooks = (value as Settings).hooks;
  if (hooks !== undefined && (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks))) return 'invalid';
  if (hooks?.PreToolUse !== undefined && !Array.isArray(hooks.PreToolUse)) return 'invalid';
  const indentMatch = text.match(/\n([ \t]+)"/);
  return {
    settings: value as Settings,
    indent: indentMatch ? indentMatch[1] : 2,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
    trailingNewline: /\r?\n$/.test(text),
  };
}

async function write(file: string, parsed: Omit<Parsed, 'settings'>, settings: Settings): Promise<void> {
  let text = JSON.stringify(settings, null, parsed.indent);
  if (parsed.eol === '\r\n') text = text.replace(/\n/g, '\r\n');
  if (parsed.trailingNewline) text += parsed.eol;
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, text, 'utf8');
}

/**
 * Add the guard's two PreToolUse groups. A group whose guard handler was hand-edited is left
 * alone (`modified` — never auto-repaired); an older guard version recorded by `replaceHash`
 * is replaced by the current one.
 */
export async function mergeSessionGuard(
  file: string,
  opts: { replaceHash?: string } = {},
): Promise<{ status: MergeStatus; handlerHash: string }> {
  const handlerHash = guardHandlerHash();
  const parsed = await parse(file);
  if (parsed === 'invalid') return { status: 'skipped-invalid', handlerHash };

  const created = parsed === 'absent';
  const base = created ? { indent: 2, eol: '\n', trailingNewline: true } : parsed;
  const settings: Settings = created ? {} : parsed.settings;
  const hooks = (settings.hooks ??= {});
  let pre: Group[] = (hooks.PreToolUse ??= []);

  if (opts.replaceHash && opts.replaceHash !== handlerHash) {
    // Our previous version: drop it so the current handler takes its place.
    pre = hooks.PreToolUse = pre.filter(group => !(groupIsOurs(group) && !group.hooks!.some(isCurrentGuard)));
  }

  let changed = false;
  let modified = false;
  for (const wanted of managedGuardHooks().PreToolUse) {
    const sameMatcher = pre.filter(group => group.matcher === wanted.matcher && groupIsOurs(group));
    if (sameMatcher.some(group => group.hooks!.some(isCurrentGuard))) continue;
    if (sameMatcher.length > 0) {
      modified = true;
      continue;
    }
    pre.push(JSON.parse(JSON.stringify(wanted)) as Group);
    changed = true;
  }

  if (!changed) return { status: modified ? 'modified' : 'unchanged', handlerHash };
  await write(file, base, settings);
  return { status: created ? 'created' : 'merged', handlerHash };
}

/**
 * Remove every agents-united guard group (any version). Empty containers our removal left behind
 * are pruned; the file itself is deleted only when agents-united created it and nothing remains.
 */
export async function removeSessionGuard(file: string, opts: { createdFile: boolean }): Promise<RemoveStatus> {
  const parsed = await parse(file);
  if (parsed === 'absent') return 'absent';
  if (parsed === 'invalid') return 'skipped-invalid';
  const { settings } = parsed;
  const pre = settings.hooks?.PreToolUse;
  if (!pre || !pre.some(groupIsOurs)) return 'absent';

  const kept = pre.filter(group => !groupIsOurs(group));
  if (kept.length > 0) {
    settings.hooks!.PreToolUse = kept;
  } else {
    delete settings.hooks!.PreToolUse;
    if (Object.keys(settings.hooks!).length === 0) delete settings.hooks;
  }

  if (opts.createdFile && Object.keys(settings).length === 0) {
    await fs.remove(file);
    return 'deleted-file';
  }
  await write(file, parsed, settings);
  return 'removed';
}

/** Doctor view: is the current guard wired in this file? */
export async function inspectSessionGuard(file: string): Promise<InspectStatus> {
  const parsed = await parse(file);
  if (parsed === 'absent' || parsed === 'invalid') return parsed === 'absent' ? 'absent' : 'skipped-invalid';
  const pre = parsed.settings.hooks?.PreToolUse ?? [];
  let allCurrent = true;
  let anyOurs = false;
  for (const wanted of managedGuardHooks().PreToolUse) {
    const ours = pre.filter(group => group.matcher === wanted.matcher && groupIsOurs(group));
    if (ours.length > 0) anyOurs = true;
    if (!ours.some(group => group.hooks!.some(isCurrentGuard))) allCurrent = false;
  }
  if (allCurrent) return 'wired';
  return anyOurs ? 'modified' : 'missing';
}
