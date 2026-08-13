# Plan 004: TDD Unit and Integration Suite

## Overview
Develop the test suite test-first using Vitest at the agreed seams:
1. `RegistryResolver.test.ts`: Resolving valid and invalid bundles, checking circular dependencies and aliases.
2. `TargetAdapter.test.ts`: Resolving paths for workspace (`.agents/`), global (`~/.gemini/config/`), and cross-platform targets.
3. `InstallEngine.test.ts`: Adding bundles, writing files, updating lockfile manifest, collision handling with `--force`.
4. `UninstallEngine.test.ts`: Removing bundles, removing orphaned skills/workflows, leaving shared dependencies intact, preserving user-modified files unless forced.
5. `CLI.test.ts`: End-to-end testing of CLI command execution, exit codes, and `--json` outputs.

## TDD Loop
- Red: Write failing test at public seam.
- Green: Implement minimal code to pass test.
- Refactor: Clean up architecture.
