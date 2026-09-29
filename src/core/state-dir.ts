/**
 * Plan 023 Workstream B (ADR 0022, owner decisions D3–D4) — the STATE DIR abstraction.
 *
 * The whole install state machine (installer, doctor, updater, uninstaller, inventory, launchers)
 * is keyed on one directory holding both the canonical copies and the lockfile
 * `agents-united.json`, with lockfile `files` keys relative to that directory and `projections`
 * keys relative to the workspace root. Two shapes exist:
 *
 *   - store   (`<root>/.agents/`)                — the canonical store, as before;
 *   - sidecar (`<root>/.claude/.agents-united/`) — a hidden, machine-owned snapshot + lockfile for
 *     a store-less Claude-only install (ADR 0022). Claude Code never loads from this path.
 *
 * Only state-dir DISCOVERY and WORKSPACE-ROOT derivation differ between them (B0 inventory:
 * every root derivation was `dirname(stateDir)`, which `workspaceRootOf` generalizes).
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import type { InstallScope } from './types.js';

/** The store-less sidecar, relative to the workspace root (POSIX form). */
export const SIDECAR_DIR = '.claude/.agents-united';
const STORE_DIR = '.agents';
const LOCKFILE = 'agents-united.json';

export type StoreShape = 'store' | 'sidecar';

/** True when `stateDir` is a sidecar (`…/.claude/.agents-united`). */
export function isSidecarDir(stateDir: string): boolean {
  const resolved = path.resolve(stateDir);
  return path.basename(resolved) === '.agents-united' && path.basename(path.dirname(resolved)) === '.claude';
}

/** The workspace (or, for global installs, home) root that projections are relative to. */
export function workspaceRootOf(stateDir: string): string {
  const resolved = path.resolve(stateDir);
  return isSidecarDir(resolved) ? path.dirname(path.dirname(resolved)) : path.dirname(resolved);
}

/** The state dir of a given shape under a root. */
export function stateDirFor(root: string, shape: StoreShape): string {
  return shape === 'sidecar' ? path.join(root, ...SIDECAR_DIR.split('/')) : path.join(root, STORE_DIR);
}

/**
 * Discover the state dir. Order: explicit override → an existing store (`.agents/` lockfile) → an
 * existing sidecar lockfile → the default for `preferShape` (store unless a caller asks for the
 * sidecar shape). An existing store always wins, so a workspace that has both (a half-finished
 * upgrade move) resolves to the store and the next install completes the move.
 */
export function resolveStateDir(
  scope: InstallScope = 'project',
  overrideDir?: string,
  opts: { cwd?: string; home?: string; preferShape?: StoreShape } = {},
): string {
  if (overrideDir) return path.resolve(overrideDir);
  const root = scope === 'global' ? opts.home ?? os.homedir() : opts.cwd ?? process.cwd();
  const store = stateDirFor(root, 'store');
  if (fs.existsSync(path.join(store, LOCKFILE))) return store;
  const sidecar = stateDirFor(root, 'sidecar');
  if (fs.existsSync(path.join(sidecar, LOCKFILE))) return sidecar;
  return opts.preferShape === 'sidecar' ? sidecar : store;
}
