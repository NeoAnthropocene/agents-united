/**
 * Plan 032 Phase 8 / ADR 0032 — MCP servers in the workspace file `.agents/mcp_config.json`.
 *
 * The file is a single `mcpServers` object shared with the user's own servers, so this module only MERGES named keys, as
 * conservatively as the guard hook merge (`antigravity-hooks.ts`):
 *   - the file is parsed as strict JSON; anything else (comments, trailing commas, a root or an `mcpServers` that is not an object)
 *     is never rewritten and the caller reports `skipped-invalid`;
 *   - every other key stays in order, and the file's own indent, line endings and final newline are reused, so removing our keys
 *     restores the user's bytes;
 *   - a key is OURS only when the lockfile records it. A server of the same name the user already has is theirs and is never
 *     touched, claimed or removed; an entry of ours the user edited is left alone and reported;
 *   - ownership is compared through a canonical hash that ignores the `disabled` switch, which is the user's to flip (`agy mcp
 *     enable|disable`), so switching a server on or off is never drift and a re-install never undoes it;
 *   - no secret is ever written: the packaged entries carry no `env`, `headers` or `oauth`.
 * A server is kept while any bundle that declares it is installed (owners are refcounted, like the native projections).
 */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import type { AntigravityMcpRecord } from './types.js';

/** Workspace-relative path of the file the lane merges into (documented, `.agents/mcp_config.json`). */
export const ANTIGRAVITY_MCP_FILE = '.agents/mcp_config.json';

export type McpEntry = Record<string, unknown>;
export interface McpCatalogServer {
  entry: McpEntry;
  /** Variables the server needs a value for; the package never writes them. */
  requiresEnv: string[];
  optionalEnv: string[];
}
export type McpCatalog = Record<string, McpCatalogServer>;

export type McpSyncOutcome = 'added' | 'replaced' | 'unchanged' | 'modified' | 'user-owned' | 'removed' | 'left-edited' | 'released' | 'absent';
export type McpInspectStatus = 'wired' | 'missing' | 'disabled' | 'modified' | 'stale';

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The packaged server entries of `registry/hosts/antigravity/mcp/servers.json`, validated. */
export function loadMcpCatalog(registryDir: string): McpCatalog {
  const file = path.join(registryDir, 'hosts', 'antigravity', 'mcp', 'servers.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { servers?: unknown };
  if (!isObject(parsed.servers)) throw new Error(`${file} has no "servers" object.`);
  const catalog: McpCatalog = {};
  for (const [name, raw] of Object.entries(parsed.servers)) {
    if (!isObject(raw) || !isObject(raw.entry)) throw new Error(`${file}: server "${name}" has no "entry" object.`);
    const list = (key: string): string[] => {
      const value = raw[key];
      if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new Error(`${file}: server "${name}" needs a string array "${key}".`);
      return value as string[];
    };
    catalog[name] = { entry: raw.entry, requiresEnv: list('requiresEnv'), optionalEnv: list('optionalEnv') };
  }
  return catalog;
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
};

/** Stable hash of a server entry, independent of key order, white space and the `disabled` switch; recorded in the lockfile as ownership proof. */
export function mcpEntryHash(entry: unknown): string {
  const body = isObject(entry) ? Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'disabled')) : entry;
  return crypto.createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex').slice(0, 16);
}

interface Style { indent: string | number; eol: string; trailingNewline: boolean }
interface Parsed extends Style { root: Record<string, unknown>; servers: Record<string, unknown> | undefined }

async function parse(file: string): Promise<Parsed | 'absent' | 'invalid'> {
  if (!(await fs.pathExists(file))) return 'absent';
  const text = await fs.readFile(file, 'utf8');
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return 'invalid';
  }
  if (!isObject(value)) return 'invalid';
  if ('mcpServers' in value && !isObject(value.mcpServers)) return 'invalid';
  const indentMatch = text.match(/\n([ \t]+)"/);
  return {
    root: value,
    servers: value.mcpServers as Record<string, unknown> | undefined,
    indent: indentMatch ? indentMatch[1] : 2,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
    trailingNewline: /\r?\n$/.test(text),
  };
}

async function write(file: string, style: Style, root: Record<string, unknown>): Promise<void> {
  let text = JSON.stringify(root, null, style.indent);
  if (style.eol === '\r\n') text = text.replace(/\n/g, '\r\n');
  if (style.trailingNewline) text += style.eol;
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, text, 'utf8');
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface McpSyncResult {
  status: 'ok' | 'skipped-invalid';
  servers: Record<string, McpSyncOutcome>;
  /** The record to keep in the lockfile; `undefined` when no server of ours remains. */
  record: AntigravityMcpRecord | undefined;
  changed: boolean;
  deletedFile: boolean;
}

/**
 * Bring the file in step with one bundle's wishes. `desired` is the servers `bundle` declares (name → shipped entry); the bundle is
 * dropped from the owners of every recorded server it no longer declares, and a server nobody owns any more is removed (unless the
 * user edited it). `dropAll` is the lane being off: every recorded server goes, whoever owns it.
 */
export async function syncAntigravityMcp(
  file: string,
  args: { desired: Record<string, McpEntry>; bundle: string; record?: AntigravityMcpRecord; dropAll?: boolean },
): Promise<McpSyncResult> {
  const { desired, bundle, record, dropAll } = args;
  const parsed = await parse(file);
  const outcomes: Record<string, McpSyncOutcome> = {};
  if (parsed === 'invalid') return { status: 'skipped-invalid', servers: outcomes, record: dropAll ? undefined : record, changed: false, deletedFile: false };

  const absent = parsed === 'absent';
  const style: Style = absent ? { indent: 2, eol: '\n', trailingNewline: true } : parsed;
  const root: Record<string, unknown> = absent ? {} : parsed.root;
  const hadKey = !absent && parsed.servers !== undefined;
  const map: Record<string, unknown> = hadKey ? (parsed as Parsed).servers! : {};
  const kept: Record<string, { entryHash: string; owners: string[] }> = {};
  let changed = false;

  for (const [name, rec] of Object.entries(record?.servers ?? {})) {
    const wanted = !dropAll && name in desired;
    const owners = dropAll ? [] : wanted ? Array.from(new Set([...rec.owners, bundle])) : rec.owners.filter(owner => owner !== bundle);
    const present = name in map ? map[name] : undefined;

    if (owners.length === 0) {
      if (present === undefined) outcomes[name] = 'absent';
      else if (mcpEntryHash(present) === rec.entryHash) {
        delete map[name];
        changed = true;
        outcomes[name] = 'removed';
      } else outcomes[name] = 'left-edited';
      continue;
    }
    if (!wanted) {
      kept[name] = { entryHash: rec.entryHash, owners };
      outcomes[name] = 'released';
      continue;
    }

    const shipped = desired[name];
    const shippedHash = mcpEntryHash(shipped);
    if (present === undefined) {
      map[name] = clone(shipped);
      kept[name] = { entryHash: shippedHash, owners };
      changed = true;
      outcomes[name] = 'added';
    } else if (mcpEntryHash(present) === shippedHash) {
      kept[name] = { entryHash: shippedHash, owners };
      outcomes[name] = 'unchanged';
    } else if (mcpEntryHash(present) === rec.entryHash) {
      const next = clone(shipped);
      // The switch is the user's: keep what they left, whatever the new release ships.
      if (isObject(present) && 'disabled' in present) next.disabled = present.disabled;
      else delete next.disabled;
      map[name] = next;
      kept[name] = { entryHash: shippedHash, owners };
      changed = true;
      outcomes[name] = 'replaced';
    } else {
      kept[name] = { entryHash: rec.entryHash, owners };
      outcomes[name] = 'modified';
    }
  }

  if (!dropAll) {
    for (const [name, shipped] of Object.entries(desired)) {
      if (record?.servers[name]) continue;
      if (name in map) {
        outcomes[name] = 'user-owned';
        continue;
      }
      map[name] = clone(shipped);
      kept[name] = { entryHash: mcpEntryHash(shipped), owners: [bundle] };
      changed = true;
      outcomes[name] = 'added';
    }
  }

  const remaining = Object.keys(kept).length;
  let nextRecord: AntigravityMcpRecord | undefined;
  if (remaining > 0) {
    nextRecord = {
      file: record?.file ?? ANTIGRAVITY_MCP_FILE,
      // A file or an object we find missing again is one we create again, so removal may take it away once more.
      createdFile: absent ? true : (record?.createdFile ?? false),
      createdKey: absent || !hadKey ? true : (record?.createdKey ?? false),
      servers: kept,
    };
    if (changed) {
      root.mcpServers = map;
      await write(file, style, root);
    }
    return { status: 'ok', servers: outcomes, record: nextRecord, changed, deletedFile: false };
  }

  let deletedFile = false;
  if (changed && !absent) {
    if (record?.createdKey && Object.keys(map).length === 0) delete root.mcpServers;
    else root.mcpServers = map;
    if (record?.createdFile && Object.keys(root).length === 0) {
      await fs.remove(file);
      deletedFile = true;
    } else await write(file, style, root);
  }
  return { status: 'ok', servers: outcomes, record: undefined, changed, deletedFile };
}

/** Doctor view of the servers of ours the lockfile records. Servers the user added, and the file's other keys, are not looked at. */
export async function inspectAntigravityMcp(
  file: string,
  record: AntigravityMcpRecord,
  catalog: McpCatalog,
): Promise<{ file: 'absent' | 'skipped-invalid' | 'ok'; servers: Record<string, McpInspectStatus> }> {
  const parsed = await parse(file);
  if (parsed === 'absent') return { file: 'absent', servers: {} };
  if (parsed === 'invalid') return { file: 'skipped-invalid', servers: {} };
  const servers: Record<string, McpInspectStatus> = {};
  for (const [name, rec] of Object.entries(record.servers)) {
    const shipped = catalog[name]?.entry;
    if (!shipped) continue;
    const present = parsed.servers?.[name];
    if (present === undefined) servers[name] = 'missing';
    else if (mcpEntryHash(present) === mcpEntryHash(shipped)) servers[name] = isObject(present) && present.disabled === true && shipped.disabled !== true ? 'disabled' : 'wired';
    else servers[name] = mcpEntryHash(present) === rec.entryHash ? 'stale' : 'modified';
  }
  return { file: 'ok', servers };
}

/**
 * The lines an install prints about what it did to the file: which switched-off servers need which variable (the file holds none),
 * which names were already the user's, which entries were edited, and, when the file cannot be merged, the entries to add by hand.
 */
export function describeMcpOutcomes(
  result: McpSyncResult,
  catalog: McpCatalog,
  desired: Record<string, McpEntry>,
  file: string = ANTIGRAVITY_MCP_FILE,
): string[] {
  const lines: string[] = [];
  if (result.status === 'skipped-invalid') {
    lines.push(`MCP servers not wired: ${file} is not valid JSON (comments or trailing commas?). It was left untouched — add these entries to its "mcpServers" object by hand:\n${JSON.stringify(desired, null, 2)}`);
    return lines;
  }
  for (const [name, outcome] of Object.entries(result.servers)) {
    if (outcome === 'added' && (catalog[name]?.requiresEnv.length ?? 0) > 0) {
      lines.push(`MCP server "${name}" is written switched off (disabled) because it needs ${catalog[name].requiresEnv.join(', ')}; ${file} holds no secret. Set it in the environment agy starts from, then run: agy mcp enable ${name}`);
    } else if (outcome === 'user-owned') {
      lines.push(`MCP server "${name}" is already in ${file}, kept as yours (agents-united did not write it).`);
    } else if (outcome === 'modified') {
      lines.push(`MCP server "${name}" in ${file} was edited by hand; left as-is.`);
    } else if (outcome === 'left-edited') {
      lines.push(`MCP server "${name}" in ${file} was edited by hand, so it was not removed.`);
    }
  }
  return lines;
}
