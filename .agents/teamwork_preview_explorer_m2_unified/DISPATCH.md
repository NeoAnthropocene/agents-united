## 2026-08-13T16:41:20Z
<USER_REQUEST>
You are the Unified Explorer for Milestone M2: R1 Agent Definitions Upgrade.
Your working directory: c:\github\agents-united\.agents\teamwork_preview_explorer_m2_unified
Original Request Path: c:\github\agents-united\ORIGINAL_REQUEST.md
Scope Document: c:\github\agents-united\.agents\sub_orch_m2_agents\SCOPE.md

Tasks:
1. Read ORIGINAL_REQUEST.md and SCOPE.md.
2. Inspect all 28 agent definition markdown files in `registry/agents/` (7 orchestrators: `orchestrator-*.md`, 21 subagents: `subagent-*.md`).
3. Formulate a comprehensive plan for updating all 28 files:
   - Antigravity 2.0 YAML Frontmatter (`name`, `version: 2.0.0`, `type: orchestrator | subagent`, `description`, `model: inherit`, `permissionMode: acceptEdits | requestReview | strict`, `commandExecutionPolicy: auto | ask | never`).
   - Extensive System Prompts (minimum 40 lines per agent) detailing operational role, step-by-step reasoning protocol, tool selection rules, boundary constraints, nested subagent delegation rules.
   - Explicit Lifecycle Hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).
4. Write full analysis and worker execution guidelines in `c:\github\agents-united\.agents\teamwork_preview_explorer_m2_unified\analysis.md` and `handoff.md`.
5. Send a message to parent when complete.
</USER_REQUEST>
