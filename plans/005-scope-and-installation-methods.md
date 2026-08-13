# Plan 005: Installation Scope & Installation Methods Engine

## Context & Motivation
Adopt the installation paradigms popularized by `skills` on npm:
1. **Installation Scopes**:
   - `project` (default: `./.agents/`)
   - `global` (`-g` / `--global`: `~/.agents/`)
2. **Installation Methods**:
   - `symlink` (`-s` / `--symlink`, default/recommended): Creates symlinks/junctions to canonical registry files.
   - `copy` (`--copy`): Creates independent physical copies of files.
3. **Multi-Agent Target Host Selection**:
   - Default host target is `agents` (`./.agents/` or `~/.agents/`).
   - Optional `--target <agents|gemini|claude|cursor>` or interactive multi-select.
4. **Interactive Prompts via `@clack/prompts`**:
   - When running interactively without explicit flags, ask user for:
     1. Scope (`Project` vs `Global`)
     2. Installation Method (`Symlink (Recommended)` vs `Copy`)
     3. Target Host Environments (`[x] Universal .agents (Default)`, `[ ] Antigravity 2.0 / Gemini`, `[ ] Claude Code`, `[ ] Cursor`)

## Proposed Changes

### 1. `src/core/types.ts`
- Add `InstallScope = 'project' | 'global'`.
- Add `InstallMethod = 'symlink' | 'copy'`.
- Add `AgentHost = 'agents' | 'gemini' | 'claude' | 'cursor'`.
- Extend `InstallOptions` and `LockfileManifest` to track scope, method, and hosts.

### 2. `src/core/adapter.ts`
- Implement `AgentHostAdapter` to map `(scope, host)` to exact directories:
  - `agents` (default -> project: `./.agents`, global: `~/.agents`)
  - `gemini` (project: `./.gemini`, global: `~/.gemini/config`)
  - `claude` (project: `./.claude`, global: `~/.claude`)
  - `cursor` (project: `./.cursor`, global: `~/.cursor`)

### 3. `src/core/installer.ts`
- Add symlink creation (`fs.ensureSymlink` / directory junctions on Windows) with automatic fallback to copy if symlink creation is not permitted by OS.
- Support deploying to multiple target host directories simultaneously.
- Record `method` and `hosts` in `.agents-united.json` lockfile.

### 4. `src/core/uninstaller.ts`
- Support removing symlinks or copies across selected or all installed target hosts.

### 5. `src/cli.ts`
- Add `-s, --symlink` and `--copy` flags to `add` command.
- Add `-t, --target <hosts>` option to `add` and `init` (defaults to `agents`).
- Provide interactive prompts via `@clack/prompts` when flags are omitted in TTY mode.

## Verification Plan
1. **Unit & Integration Tests**:
   - `tests/adapter.test.ts`: Verify path resolution for all hosts and scopes (`project` vs `global`).
   - `tests/installer.test.ts`: Verify symlink vs copy modes, and multi-host deployment with `agents` default.
   - `tests/cli-e2e.test.ts`: Verify `add --symlink`, `add --copy`, `add --target agents,gemini,claude`.
2. **Build Verification**:
   - `npm run typecheck`
   - `npm test` (all 16+ tests passing)
   - `npm run build`
