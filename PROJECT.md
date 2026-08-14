# Project: agents-united
# Scope: Full Registry Upgrade & Verification (Agents, Skills, Workflows)

## Architecture
- `registry/agents/`: 28 agent markdown definitions (7 orchestrators, 21 subagents) with Antigravity 2.0 YAML frontmatter, 40+ line prompts, and lifecycle hooks.
- `registry/skills/`: 48 skill SKILL.md playbooks with progressive disclosure frontmatter, 50+ line runbooks, triggers, I/O, error recovery, and exemplars.
- `registry/workflows/`: 44 workflow markdown templates with structured metadata, Mermaid flowcharts, verification gates, and rollback protocols.
- Core CLI & Doctor: TypeScript source in `src/`, compiled output in `dist/cli.js`, Vitest suite in `tests/`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | E2E Test Suite Infra & Test Cases | 4-tier requirement-driven E2E test suite for doctor, installer, registry validator | M1 | Dual Track |
| 2 | R1 Agent Definitions Upgrade | 28 Agent markdown files in `registry/agents/` upgraded with AG 2.0 frontmatter, 40+ line prompts, lifecycle hooks | M2 | ORIGINAL_REQUEST §R1 |
| 3 | R2 Skill Playbooks Expansion | 48 SKILL.md playbooks in `registry/skills/*/SKILL.md` expanded with progressive frontmatter, 50+ line runbooks, code exemplars | M3 | ORIGINAL_REQUEST §R2 |
| 4 | R3 Workflow Templates Enhancement | 44 Workflow files in `registry/workflows/workflow-*.md` enhanced with metadata, flowcharts, phase gates, rollback protocols | M4 | ORIGINAL_REQUEST §R3 |
| 5 | Acceptance Verification & Doctor Gate | Full verification (`typecheck`, `test`, `build`, `doctor`) & adversarial hardening | M5 | ORIGINAL_REQUEST §4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | E2E Testing Track | E2E test suite creation (Tiers 1-4) & `TEST_READY.md` publishing | none | DONE |
| M2 | R1 Agent Definitions Upgrade | Upgrade all 28 agent markdown files | none | DONE |
| M3 | R2 Skill Playbooks Expansion | Expand all 48 SKILL.md files | none | DONE |
| M4 | R3 Workflow Templates Enhancement | Enhance all 44 workflow files | none | DONE |
| M5 | Acceptance Verification & Final Gate | Pass 100% E2E tests, build/typecheck/doctor, Tier 5 hardening | M1, M2, M3, M4 | DONE |

## Interface Contracts
### Agent Definition Interface
- Frontmatter: `name`, `version`, `type` (`orchestrator` | `subagent`), `description`, `model`, `permissionMode` (`acceptEdits` | `requestReview` | `strict`), `commandExecutionPolicy` (`auto` | `ask` | `never`).
- System prompt body: >= 40 lines.
- Lifecycle hooks: `PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`.

### Skill Playbook Interface
- Frontmatter: `name`, `description`, `metadata: { author, version }`.
- Runbook body: >= 50 lines.
- Sections: Triggers, Input/Output Requirements, Edge-Case Handling, Error-Recovery Procedures, Code/Config Exemplars.

### Workflow Template Interface
- Frontmatter: `name`, `description`, `bundle`, `estimatedDuration`.
- Sections: Phase-by-Phase Execution Flowchart (Mermaid), Phase Transition Criteria, Deterministic Verification Gates, Required Tool Inputs, Validation Checkpoints, Automated Rollback Protocols.

## Code Layout
- `registry/agents/`: `orchestrator-*.md` (7 files), `subagent-*.md` (21 files)
- `registry/skills/`: 48 skill folders each with `SKILL.md`
- `registry/workflows/`: `workflow-*.md` (44 files)
- `src/`: TypeScript source files (`cli.ts`, `core/doctor.ts`, `core/registry.ts`, `core/installer.ts`, etc.)
- `dist/`: Compiled CLI JS (`dist/cli.js`)
- `tests/`: Vitest test files
