# ADR 0006: Installation Scope & Installation Methods Architecture

## Status
Accepted

## Context
Developers working with agentic AI ecosystems require flexibility in where and how AI agents, skills, workflows, and rules are deployed:
1. **Scope Requirements**:
   - **Project Scope (Default)**: Install into project-local directories (`./.agents/`, `./.gemini/`, `./.claude/`, `./.cursor/`) tracked in version control, ensuring team consistency via lockfile manifests (`agents-united.json`).
   - **Global Scope (`-g`, `--global`)**: Install into user home directories (`~/.gemini/config/`, `~/.claude/`, `~/.agents/`), making tools available everywhere on the system without repo pollution.
2. **Installation Method Requirements**:
   - **Symlink Mode (`-s`, `--symlink`, Recommended)**: Creates symbolic links (or junctions on Windows) to a single canonical copy. Allows immediate propagation of package updates across all projects.
   - **Copy Mode (`--copy`)**: Creates independent standalone copies for environments where symlinks are restricted or when custom local modifications are desired.
3. **Multi-Agent Target Host Selection**:
   - Ability to target specific agent hosts (`antigravity`/`gemini`, `claude`, `cursor`, `agents`) simultaneously or via interactive prompts.

## Decision
1. **Dual Scope Model**:
   - Default to `project` scope (`./.agents/` by default).
   - Support `-g` / `--global` flag for user-level global installation (`~/.agents/` by default).
   - In interactive mode, prompt user for scope selection (`project` vs `global`).
2. **Dual Installation Method**:
   - Default to `symlink` method on supported filesystems (with automatic fallback to `copy` on privilege error).
   - Provide explicit `--copy` and `--symlink` flags.
   - Record installation method (`method: "symlink" | "copy"`) in the lockfile manifest.
3. **Agent Host Target Resolver**:
   - Default host target is `agents` (`./.agents/` or `~/.agents/`).
   - Implement `AgentHostAdapter` supporting `agents` (default), `gemini`, `claude`, and `cursor` directories.
   - Support `--target <host...>` flag (e.g. `npx agents-united add software-engineering --target agents,gemini,claude`).

## Consequences
- Clean ergonomics matching standard npm/skills toolchains.
- Instant synchronization with symlink mode while preserving offline standalone flexibility with copy mode.
- Seamless compatibility with Antigravity 2.0, Claude Code, Cursor, and universal agent runtimes.
