# Plan 006: Sync Agent Structure and Registry Documentation in CONTEXT.md, README.md, and Plan Index

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a5f8fb..HEAD -- CONTEXT.md README.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `8a5f8fb`, 2026-08-14

## Why this matters

The `registry/agents/` catalog contains 38 agent definitions (7 Lead Orchestrators and 31 Sub-Agents) mapped across 13 bundles in `registry/bundles.json`.
However, the user-facing documentation files (`CONTEXT.md`, `README.md`, and `plans/README.md`) have structural gaps:
1. `README.md` lists a subset of sub-agent names in the Ecosystem Matrix table instead of detailing all 38 specialized agents across their respective departments.
2. `CONTEXT.md` defines domain terminology (Orchestrator Agent, Sub-Agent, Bundle, Department Domain), but lacks an explicit Agent Registry Breakdown section mapping all 38 agents to their department domains and inheritance trees.
3. `plans/README.md` omits the 5 sub-team addon bundles (`devops-engineering`, `sysops-sre`, `mobile-development`, `frontend-engineering`, `backend-distributed-systems`, `qa-automation`) from its Architecture Summary.

Synchronizing these documentation files ensures that humans and AI agents consuming `CONTEXT.md` and `README.md` have complete, accurate alignment with `registry/agents/` and `registry/bundles.json`.

## Current state

- `registry/agents/`: Contains 38 files (7 `orchestrator-*.md` and 31 `subagent-*.md`).
- `registry/bundles.json`: Maps all 38 agents into 13 total bundles across 8 department domains.
- `README.md:55-69`: Ecosystem Matrix table lists 13 bundles and 38 agents, but the "Orchestrator & Key Roles" column omits several sub-agents (such as `subagent-backend-architect`, `subagent-code-reviewer`, `subagent-repo-index`, `subagent-cross-platform-specialist`, `subagent-accessibility-lead`, `subagent-data-engineer`, `subagent-e2e-tester`, `subagent-design-systems-architect`, `subagent-design-researcher`, `subagent-design-ops-lead`, `subagent-designer-toolkit-expert`, `subagent-prototype-tester`, `subagent-marketing-conversion-specialist`, `subagent-marketing-campaign-specialist`).
- `CONTEXT.md`: Lacks a dedicated `## Agent Registry & Department Hierarchy` section.
- `plans/README.md:15-60`: Architecture summary only lists 7 primary bundles instead of all 13.

## Commands you will need

| Purpose   | Command     | Expected on success |
|-----------|-------------|---------------------|
| Build     | `npm run build` | exit 0, tsup build success |
| Tests     | `npm test`  | exit 0, 79 passing tests |

## Scope

**In scope**:
- `CONTEXT.md` — Add `## Agent Registry & Department Hierarchy` detailing all 7 orchestrators and 31 sub-agents.
- `README.md` — Update Ecosystem Matrix table to explicitly list all 38 agents across the 13 bundles.
- `plans/README.md` — Add Plan 006 to table index and update Bundles Architecture summary to include all 13 bundles.

**Out of scope**:
- `src/` TS source code
- `registry/agents/*.md` markdown files (already 100% compliant)
- `registry/bundles.json` (authoritative index, read-only for this plan)

## Git workflow

- Branch: `docs/sync-agent-structure-documentation`
- Commit message: `docs: update CONTEXT.md, README.md, and plans index with complete 38 agent registry structure`

## Steps

### Step 1: Update `CONTEXT.md` with Agent Registry & Department Hierarchy

Add a new section `## Agent Registry & Department Hierarchy` under `CONTEXT.md` right after line 53 (`Domain-Level Installation`).
The section must list all 8 Department Domains, all 13 Bundles, and all 38 Agents:

- **Software Engineering & Delivery** (`engineering`):
  - `orchestrator-engineering.md` (Lead Orchestrator)
  - `software-engineering` (Essentials): `subagent-backend-architect.md`, `subagent-frontend-architect.md`, `subagent-code-reviewer.md`, `subagent-repo-index.md`
  - `devops-engineering`: `subagent-devops-engineer.md`
  - `mobile-development`: `subagent-ios-architect.md`, `subagent-android-architect.md`, `subagent-cross-platform-specialist.md`
  - `frontend-engineering`: `subagent-frontend-architect.md`, `subagent-accessibility-lead.md`
  - `backend-distributed-systems`: `subagent-distributed-systems-architect.md`, `subagent-data-engineer.md`
  - `qa-automation`: `subagent-qa-automation-lead.md`, `subagent-e2e-tester.md`
- **System Architecture & SRE** (`architecture`):
  - `orchestrator-system-architecture.md` (Lead Orchestrator)
  - `system-architecture` (Essentials): `subagent-system-architect.md`, `subagent-backend-architect.md`
  - `sysops-sre`: `subagent-sysops-sre-lead.md`
- **Product Design & UI/UX** (`design`):
  - `orchestrator-design.md` (Lead Orchestrator)
  - `product-design`: `subagent-ui-designer.md`, `subagent-ux-strategist.md`, `subagent-interaction-designer.md`, `subagent-design-systems-architect.md`, `subagent-design-researcher.md`, `subagent-design-ops-lead.md`, `subagent-designer-toolkit-expert.md`, `subagent-prototype-tester.md`
- **Growth & Marketing Operations** (`marketing`):
  - `orchestrator-marketing.md` (Lead Orchestrator)
  - `growth-marketing`: `subagent-marketing-growth-strategist.md`, `subagent-marketing-content-strategist.md`, `subagent-marketing-conversion-specialist.md`, `subagent-marketing-campaign-specialist.md`
- **Security Operations** (`security`):
  - `orchestrator-security.md` (Lead Orchestrator)
  - `security-operations`: `subagent-security-engineer.md`
- **Deep Technical Research** (`research`):
  - `orchestrator-research.md` (Lead Orchestrator)
  - `deep-research`: `subagent-deep-research.md`, `subagent-socratic-mentor.md`, `subagent-repo-index.md`
- **Business Strategy & Economics** (`business`):
  - `orchestrator-business.md` (Lead Orchestrator)
  - `business-strategy`: `subagent-business-panel-experts.md`
- **Universal Autonomous Department** (`universal`):
  - `full`: All 7 Lead Orchestrators + 31 Sub-Agents (38 total)

**Verify**: Check that `CONTEXT.md` contains all 38 agent filenames.

### Step 2: Update `README.md` Ecosystem Matrix Table

In `README.md` (lines 59-68), update the "Orchestrator & Key Roles" column in the Ecosystem Matrix table to explicitly detail all 38 agents across the 8 department rows and 13 bundles so no agents are left out.

**Verify**: `npm test` → 79 tests passing.

### Step 3: Update `plans/README.md` Index & Architecture Summary

1. In `plans/README.md`, add row `006` to the "Execution Order & Status" table:
   `| [006](./006-sync-agent-structure-documentation.md) | Sync Agent Structure & Documentation | Documentation | **READY** | None |`
2. Update `## Summary of Bundles Architecture` to list all 13 bundles explicitly (including `devops-engineering`, `sysops-sre`, `mobile-development`, `frontend-engineering`, `backend-distributed-systems`, `qa-automation`).

**Verify**: `npm test` → 79 tests passing.

## Test plan

- Run `npm test` to ensure all 79 schema validation, inventory, installer, doctor, and CLI tests continue to pass cleanly.

## Done criteria

- [ ] `CONTEXT.md` includes `## Agent Registry & Department Hierarchy` section listing all 7 orchestrators and 31 subagents.
- [ ] `README.md` Ecosystem Matrix table accurately lists all 38 specialized agents across all 13 bundles.
- [ ] `plans/README.md` lists Plan 006 and all 13 bundles in its architecture summary.
- [ ] `npm test` exits 0 with 79 passing tests.
- [ ] No files outside `CONTEXT.md`, `README.md`, and `plans/README.md` are modified.

## STOP conditions

Stop and report back if:
- Any test in `npm test` fails.
- The total agent count in `registry/agents/` changes from 38.
