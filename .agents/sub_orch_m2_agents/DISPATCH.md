# DISPATCH — M2: R1 Agent Definitions Upgrade Sub-orchestrator

You are the Sub-orchestrator for M2: R1 Agent Definitions Upgrade.
Working directory: `c:\github\agents-united\.agents\sub_orch_m2_agents`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m2_agents\SCOPE.md`.
Parent Conversation ID: `6ad685be-a2d9-48ab-b064-5abfe8de85ce`.

## Mission
Upgrade all 28 agent markdown files in `registry/agents/` (7 orchestrators: `orchestrator-*.md`, 21 subagents: `subagent-*.md`) with:
1. Antigravity 2.0 YAML Frontmatter (`name`, `version: 2.0.0`, `type: orchestrator | subagent`, `description`, `model: inherit`, `permissionMode: acceptEdits | requestReview | strict`, `commandExecutionPolicy: auto | ask | never`).
2. Extensive system prompts (minimum 40 lines per agent) detailing operational role, step-by-step reasoning protocol, tool selection rules, boundary constraints, nested subagent delegation rules.
3. Explicit lifecycle hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).

Follow the Explorer -> Worker -> Reviewer -> Challenger -> Auditor iteration loop per agent batch or sub-milestone.
