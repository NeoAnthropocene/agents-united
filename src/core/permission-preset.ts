/**
 * Plan 024 Step S4 (owner decisions E2/E4, 2026-09-27) — the opt-in command-permission preset.
 *
 * Field finding: outside auto mode, a background specialist cannot stop to ask for command
 * approval, so `npm test` / `npx tsc` get refused and a specialist can write code but never prove
 * it runs. This module pre-approves a small, fixed set of commands — never a wildcard, never
 * implied by `-y`, and never written to the shared, committed settings file.
 *
 * Security posture (owner asked whether this is a risk — yes, mitigated by design):
 *   - opt-in only;
 *   - written ONLY to the per-user `.claude/settings.local.json`, never `.claude/settings.json`,
 *     regardless of which session-guard variant (Plan 023) is also active;
 *   - `git commit`, `git push`, `rm`, `curl`/`wget`, and any deploy/publish command are excluded
 *     from every tier, unconditionally (`NEVER_PRESET`, also unit-tested against both tiers);
 *   - two tiers: `verify` (default) is fixed read/test commands only; `build` (must be requested
 *     explicitly) additionally allows `npm install` / `npm run` / `npm test`, which execute code
 *     the agent itself can edit (package scripts) — never on by default;
 *   - the managed guard (Plan 022/023) still runs before every allowed command;
 *   - remove-only-ours uninstall, exactly like the session guard (Plan 023) — ownership is the
 *     exact set of entries this merge added, recorded by the caller (installer → lockfile).
 *
 * Host-neutral design: tiers are plain command prefixes, independent of any host's settings
 * syntax. `claudeAllowEntries` is the only renderer today (`Bash(<cmd> *)` in `permissions.allow`);
 * a host without a verified renderer is reported "not supported yet" by the installer rather than
 * guessing that host's file format.
 */
import path from 'node:path';
import fs from 'fs-extra';

export type PermissionTier = 'verify' | 'build';
export type MergeStatus = 'created' | 'merged' | 'unchanged' | 'skipped-invalid';
export type RemoveStatus = 'removed' | 'deleted-file' | 'absent' | 'skipped-invalid';

/** Read-only / fixed-output commands: no side effect a reviewer would need to approve. */
const VERIFY_COMMANDS: readonly string[] = [
  'git status',
  'git diff',
  'git log',
  'npx tsc --noEmit',
  'npx vitest run',
  'npx eslint',
];

/** Adds commands that execute project-defined code (package.json scripts, installs). */
const BUILD_COMMANDS: readonly string[] = [...VERIFY_COMMANDS, 'npm install', 'npm run', 'npm test'];

export const PERMISSION_TIER_COMMANDS: Record<PermissionTier, readonly string[]> = {
  verify: VERIFY_COMMANDS,
  build: BUILD_COMMANDS,
};

/** Defense in depth: neither tier may ever contain these, and this list is itself unit-tested. */
export const NEVER_PRESET: readonly RegExp[] = [
  /\bgit\s+push\b/,
  /\bgit\s+commit\b/,
  /(^|\s)rm(\s|$)/,
  /\bcurl\b/,
  /\bwget\b/,
  /\bvercel\b[^,]*--prod\b/,
  /\bnpm\s+publish\b/,
];

/** Render a tier as Claude `permissions.allow` entries: `Bash(<cmd> *)`. */
export function claudeAllowEntries(tier: PermissionTier): string[] {
  return PERMISSION_TIER_COMMANDS[tier].map(cmd => `Bash(${cmd} *)`);
}

/** Hosts with a verified permission-preset renderer. Any other host is reported unsupported. */
export const SUPPORTED_PERMISSION_PRESET_HOSTS: readonly string[] = ['claude'];

interface Settings extends Record<string, unknown> {
  permissions?: { allow?: unknown[] } & Record<string, unknown>;
}
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
  const permissions = (value as Settings).permissions;
  if (permissions !== undefined && (permissions === null || typeof permissions !== 'object' || Array.isArray(permissions))) return 'invalid';
  if (permissions?.allow !== undefined && !Array.isArray(permissions.allow)) return 'invalid';
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

/** Add every entry the tier requires that isn't already present. Never removes an existing entry. */
export async function mergePermissionPreset(
  file: string,
  tier: PermissionTier,
): Promise<{ status: MergeStatus; entries: string[] }> {
  const wanted = claudeAllowEntries(tier);
  const parsed = await parse(file);
  if (parsed === 'invalid') return { status: 'skipped-invalid', entries: [] };

  const created = parsed === 'absent';
  const base = created ? { indent: 2, eol: '\n', trailingNewline: true } : parsed;
  const settings: Settings = created ? {} : parsed.settings;
  const permissions = (settings.permissions ??= {});
  const allow: unknown[] = (permissions.allow ??= []);

  const added: string[] = [];
  for (const entry of wanted) {
    if (!allow.includes(entry)) {
      allow.push(entry);
      added.push(entry);
    }
  }

  if (added.length === 0) return { status: 'unchanged', entries: wanted };
  await write(file, base, settings);
  return { status: created ? 'created' : 'merged', entries: wanted };
}

/**
 * Remove exactly the recorded entries (never entries the caller didn't add). Empty containers
 * left behind are pruned; the file is deleted only when the caller created it and nothing remains.
 */
export async function removePermissionPreset(
  file: string,
  entries: string[],
  opts: { createdFile: boolean },
): Promise<RemoveStatus> {
  const parsed = await parse(file);
  if (parsed === 'absent') return 'absent';
  if (parsed === 'invalid') return 'skipped-invalid';
  const { settings } = parsed;
  const allow = settings.permissions?.allow;
  if (!Array.isArray(allow)) return 'absent';

  const owned = new Set(entries);
  const kept = allow.filter(e => !(typeof e === 'string' && owned.has(e)));
  if (kept.length > 0) {
    settings.permissions!.allow = kept;
  } else {
    delete settings.permissions!.allow;
    if (Object.keys(settings.permissions!).length === 0) delete settings.permissions;
  }

  if (opts.createdFile && Object.keys(settings).length === 0) {
    await fs.remove(file);
    return 'deleted-file';
  }
  await write(file, parsed, settings);
  return 'removed';
}
