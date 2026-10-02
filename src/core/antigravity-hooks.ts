/**
 * Plan 032 Phase 8 / ADR 0031 addendum — the Antigravity guard hook in `.agents/hooks.json`.
 *
 * `hooks.json` maps a hook name to its events and is shared with the user's own hooks, so this module only MERGES one key,
 * `agents-united-guard`. It is deliberately as conservative as the Claude session guard (`session-guard.ts`):
 *   - the file is parsed as strict JSON; anything else (comments, trailing commas, a non-object root) is never rewritten, the caller
 *     reports `skipped-invalid`;
 *   - every other key stays in order, and the file's own indent, line endings and final newline are reused, so removing our key
 *     restores the user's bytes;
 *   - ownership is the key's NAME, and its content is compared canonically (key order and white space do not matter): an entry
 *     the user edited, or switched off with `enabled: false`, is `modified` and is never repaired automatically; an older entry of
 *     ours is recognised by the hash the lockfile recorded and replaced.
 * Whether the hook is in effect is judged by our key alone, so a hook the user adds is never drift.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';

export const ANTIGRAVITY_HOOK_NAME = 'agents-united-guard';
/** Workspace-relative paths of the registered hooks file and of the script it runs (the hook's working directory is `.agents/`, observed). */
export const ANTIGRAVITY_HOOKS_FILE = '.agents/hooks.json';
export const ANTIGRAVITY_GUARD_SCRIPT = '.agents/hooks/agents-united-guard.js';

export type HookEntry = Record<string, unknown>;
export type HookMergeStatus = 'created' | 'merged' | 'unchanged' | 'modified' | 'skipped-invalid';
export type HookRemoveStatus = 'removed' | 'deleted-file' | 'absent' | 'skipped-invalid';
export type HookInspectStatus = 'wired' | 'disabled' | 'modified' | 'missing' | 'absent' | 'skipped-invalid';

/** The entry the package ships: the one key of `registry/hosts/antigravity/hooks/hooks.json`. */
export function loadGuardHookEntry(registryDir: string): HookEntry {
  const file = path.join(registryDir, 'hosts', 'antigravity', 'hooks', 'hooks.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, HookEntry>;
  const entry = parsed[ANTIGRAVITY_HOOK_NAME];
  if (!entry || typeof entry !== 'object') throw new Error(`${file} has no "${ANTIGRAVITY_HOOK_NAME}" hook.`);
  return entry;
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
};

/** Stable hash of an entry, independent of key order and white space; recorded in the lockfile as ownership proof. */
export function hookEntryHash(entry: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(entry))).digest('hex').slice(0, 16);
}

interface Parsed { hooks: Record<string, unknown>; indent: string | number; eol: string; trailingNewline: boolean }

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
  const indentMatch = text.match(/\n([ \t]+)"/);
  return {
    hooks: value as Record<string, unknown>,
    indent: indentMatch ? indentMatch[1] : 2,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
    trailingNewline: /\r?\n$/.test(text),
  };
}

async function write(file: string, style: Omit<Parsed, 'hooks'>, hooks: Record<string, unknown>): Promise<void> {
  let text = JSON.stringify(hooks, null, style.indent);
  if (style.eol === '\r\n') text = text.replace(/\n/g, '\r\n');
  if (style.trailingNewline) text += style.eol;
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, text, 'utf8');
}

/**
 * Add our key. An entry of ours that matches is `unchanged`; one the lockfile recorded under `replaceHash` (an older version) is
 * replaced; anything else under our name is `modified` and left alone.
 */
export async function mergeAntigravityHook(
  file: string,
  entry: HookEntry,
  opts: { replaceHash?: string } = {},
): Promise<{ status: HookMergeStatus; entryHash: string }> {
  const entryHash = hookEntryHash(entry);
  const parsed = await parse(file);
  if (parsed === 'invalid') return { status: 'skipped-invalid', entryHash };

  const created = parsed === 'absent';
  const style = created ? { indent: 2, eol: '\n', trailingNewline: true } : parsed;
  const hooks: Record<string, unknown> = created ? {} : parsed.hooks;

  if (ANTIGRAVITY_HOOK_NAME in hooks) {
    const existingHash = hookEntryHash(hooks[ANTIGRAVITY_HOOK_NAME]);
    if (existingHash === entryHash) return { status: 'unchanged', entryHash };
    if (!opts.replaceHash || existingHash !== opts.replaceHash) return { status: 'modified', entryHash };
  }
  hooks[ANTIGRAVITY_HOOK_NAME] = JSON.parse(JSON.stringify(entry)) as HookEntry;
  await write(file, style, hooks);
  return { status: created ? 'created' : 'merged', entryHash };
}

/** Remove our key and nothing else. The file itself is deleted only when agents-united created it and nothing remains. */
export async function removeAntigravityHook(file: string, opts: { createdFile: boolean }): Promise<HookRemoveStatus> {
  const parsed = await parse(file);
  if (parsed === 'absent') return 'absent';
  if (parsed === 'invalid') return 'skipped-invalid';
  if (!(ANTIGRAVITY_HOOK_NAME in parsed.hooks)) return 'absent';
  delete parsed.hooks[ANTIGRAVITY_HOOK_NAME];
  if (opts.createdFile && Object.keys(parsed.hooks).length === 0) {
    await fs.remove(file);
    return 'deleted-file';
  }
  await write(file, parsed, parsed.hooks);
  return 'removed';
}

/** Doctor view: is our guard hook in this file, as shipped and switched on? Other keys are not looked at. */
export async function inspectAntigravityHook(file: string, entry: HookEntry): Promise<HookInspectStatus> {
  const parsed = await parse(file);
  if (parsed === 'absent') return 'absent';
  if (parsed === 'invalid') return 'skipped-invalid';
  if (!(ANTIGRAVITY_HOOK_NAME in parsed.hooks)) return 'missing';
  const present = parsed.hooks[ANTIGRAVITY_HOOK_NAME];
  if (hookEntryHash(present) === hookEntryHash(entry)) return 'wired';
  if (present !== null && typeof present === 'object' && (present as HookEntry).enabled === false) return 'disabled';
  return 'modified';
}
