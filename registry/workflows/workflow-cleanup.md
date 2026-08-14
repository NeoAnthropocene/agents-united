---
name: "Code Hygiene & Refactoring Cleanup"
description: "Systematic workflow for removing dead code, unused dependencies, formatting files, and normalizing code style."
bundle: "software-engineering"
estimatedDuration: "15-30m"
---

# Workflow: Code Hygiene & Refactoring Cleanup

## Overview & Scope
The Cleanup workflow streamlines codebase maintenance by identifying and eliminating orphaned code, unused npm packages, formatting inconsistencies, and stale comments across the project.

## Execution Flowchart
```mermaid
graph TD
    Start([Start Workflow]) --> P1[Phase 1: Context & Reconnaissance]
    P1 --> InputCheck{"Prerequisites & Tools Valid?"}
    InputCheck -->|No| Abort1[Abort & Request Inputs]
    InputCheck -->|Yes| P2[Phase 2: Execution & Orchestration]
    P2 --> Gate1{"Verification Gate: Automated Checks Pass?"}
    Gate1 -->|Fail| Rollback[Execute Automated Rollback Protocol]
    Rollback --> P2
    Gate1 -->|Pass| P3[Phase 3: Verification & Closure]
    P3 --> Gate2{"Final Acceptance Gate Passed?"}
    Gate2 -->|Fail| P3Fix[Remediate Documentation / Artifacts]
    P3Fix --> P3
    Gate2 -->|Pass| Done([Workflow Complete & Logged])
```

## Required Tool Inputs & Context
- Linter and formatter configurations (`.eslintrc`, `.prettierrc`)
- Unused dependency scanner (`depcheck` / `knip`)
- Repository file index & source directories

## Phase 1: Context & Reconnaissance
- Scan codebase for unreferenced export declarations, orphaned files, and dead code paths.
- Audit `package.json` against actual import usages to find unused dependencies.
- Check code formatting consistency across all source and test directories.

## Phase 2: Execution & Orchestration
- Safe removal of confirmed unused files, unused variables, and unreferenced functions.
- Run automated code formatters (`prettier --write .`) and linter auto-fixes (`eslint --fix`).
- Remove outdated or commented-out code blocks while preserving documentation comments.

## Phase 3: Verification & Closure
- Run full test suite and type-checker to ensure no functional code was inadvertently broken.
- Verify clean git diff to confirm only intended refactor/cleanup edits were made.
- Document total lines of code removed, dependencies pruned, and formatting changes applied.

## Phase Transition Criteria & Deterministic Verification Gates
| Transition | Prerequisites | Verification Command / Gate | Success Criteria |
|---|---|---|---|
| Phase 1 -> Phase 2 | Tool inputs verified & environment ready | `node dist/cli.js doctor` | Doctor health check succeeds with 0 errors |
| Phase 2 -> Phase 3 | Execution steps complete | `npm run lint` | 0 lint errors and 0 warnings remaining post-cleanup |
| Phase 3 -> Completion | Verification complete & artifacts signed off | `npm test && npm run typecheck` | 100% pass rate on test suite and static type check after code removal |

## Validation Checkpoints & Automated Rollback Protocols
- **Validation Checkpoint 1**: Unused dependencies and unreferenced exports verified with static analysis before removal.
- **Validation Checkpoint 2**: Working tree formatted cleanly with zero style deviations.
- **Automated Rollback Protocol**: Revert uncommitted file removals using `git checkout -- .` if cleanup causes test regressions.
