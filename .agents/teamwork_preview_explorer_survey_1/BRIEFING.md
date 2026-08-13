# BRIEFING — 2026-08-13T16:36:25Z

## Mission
Survey all 28 agent markdown files in registry/agents/ and investigate how agent frontmatter/properties are parsed or validated in src/, dist/, and test files.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Survey Explorer 1
- Working directory: c:\github\agents-united\.agents\teamwork_preview_explorer_survey_1
- Original parent: 6ad685be-a2d9-48ab-b064-5abfe8de85ce
- Milestone: Agent Registry Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Write reports only to working directory

## Current Parent
- Conversation ID: 6ad685be-a2d9-48ab-b064-5abfe8de85ce
- Updated: 2026-08-13T16:36:25Z

## Investigation State
- **Explored paths**: registry/agents/ (28 markdown files), src/core/doctor.ts, src/core/registry.ts, src/core/types.ts, src/core/adapter.ts, tests/doctor.test.ts, tests/registry.test.ts, docs/adr/
- **Key findings**:
  - 0/28 agents have `version` or `type: orchestrator | subagent` fields in YAML frontmatter.
  - 0/28 agents meet the 40-line minimum system prompt body requirement (orchestrator prompt bodies: 10-11 lines; subagent prompt bodies: 3-5 lines).
  - 24/28 agents have zero lifecycle hooks; 4 orchestrators have partial hooks; 0/28 have all four hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).
  - Parsing mechanism in `src/core/doctor.ts` extracts YAML via regex `/^---\r?\n([\s\S]+?)\r?\n---/` and checks `name`, `description`, and `model`.
- **Unexplored areas**: None (investigation complete).

## Key Decisions Made
- Completed full audit of all 28 agent files.
- Written comprehensive survey report to `survey_agents.md`.
- Authored self-contained 5-component handoff report to `handoff.md`.

## Artifact Index
- DISPATCH.md — Dispatch log
- BRIEFING.md — Working memory index
- progress.md — Liveness heartbeat progress log
- survey_agents.md — Comprehensive survey report of 28 agents
- handoff.md — 5-component handoff report
