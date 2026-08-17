# ADR 0007: Package Inventory Discovery, Scope-Aware Removal, and Upstream Update Engine

## Status
Accepted

## Context
1. `agents remove` (uninstall) previously presented all 14 bundles from the central registry regardless of what was physically installed in the user's workspace or global environment. This created friction, visual clutter, and confusion.
2. Users lacked visibility into where packages were physically loaded (project-local `./.agents/`, `./.gemini/`, `./.claude/`, `./.cursor/` vs global `~/.agents/`, `~/.gemini/config/`).
3. There was no mechanism to check for upstream updates, inspect version drift between local lockfiles and canonical registry releases, or perform automated batch or selective package updates.

## Decision
1. **Universal Package Inventory Scanner (`src/core/inventory.ts`)**:
   - Build `InventoryScanner` to audit all candidate project and global host target directories.
   - Parse `agents-united.json` lockfiles and resolve installed bundles and standalone assets into structured `InstalledPackageRecord` models.
   - Standardize visual **Scope Location Badges** (e.g. `[project: ./.agents]` and `[global: ~/.gemini/config]`) across all CLI interactive lists.
2. **Installed-Only Scope-Aware `agents remove`**:
   - `agents remove` without arguments will query `InventoryScanner`.
   - If no packages are installed, display an informative message and exit cleanly.
   - If packages are installed, display only the installed bundles (and standalone assets), annotated with their scope and loaded path.
   - Route uninstallation directly to the corresponding target directory, scope, and host.
3. **Interactive Upstream Update Engine (`src/core/updater.ts`)**:
   - Implement `UpdateEngine` supporting `checkUpdates()` and `update()`.
   - Detect version drift using semantic bundle versions and content hashes.
   - Provide an interactive TUI for `agents update` offering:
     - `⚡ Update All Outdated Packages` (batch)
     - `📦 Selectively Pick Packages to Update` (interactive multi-select)
     - `🔄 Re-sync / Repair All Packages`
   - Incorporate modification safety guardrails: in copy mode, skip locally modified files with a clear warning unless `--force` is supplied.
4. **Manifest & Lockfile Versioning Schema**:
   - Extend `BundleDefinition` in `src/core/types.ts` and `registry/bundles.json` with an optional `version` field (defaulting to `"1.0.0"`).
   - Extend `LockfileManifest` with `bundleVersions?: Record<string, string>` to track installed bundle versions deterministically.

## Consequences
- Clean, transparent UX for discovering and removing installed agent packages.
- Safe, predictable package updates with zero risk of accidentally clobbering local modifications.
- Complete parity across all multi-agent host runtimes (`agents`, `gemini`, `claude`, `cursor`).
