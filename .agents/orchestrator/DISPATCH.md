# DISPATCH — 2026-08-13T18:34:53+02:00

## 2026-08-13T18:34:53+02:00
You are the Project Orchestrator for agents-united.
Your task is defined in `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Working directory: `c:\github\agents-united`.

Please execute the complete request:
1. R1: Upgrade all 28 agent markdown definitions in `registry/agents/` (orchestrator-*.md and subagent-*.md) with:
   - Antigravity 2.0 YAML frontmatter (name, version, type: orchestrator | subagent, description, model, permissionMode: acceptEdits | requestReview | strict, commandExecutionPolicy).
   - Extensive system prompts (minimum 40 lines per agent) detailing operational role, step-by-step reasoning protocol, tool selection rules, boundary constraints, and nested subagent delegation rules.
   - Explicit lifecycle hooks (PreInvocation, PostInvocation, PreToolUse, PostToolUse).

2. R2: Expand all 48 skill SKILL.md files in `registry/skills/*/SKILL.md` with:
   - YAML progressive disclosure frontmatter (name, description, metadata: { author, version }).
   - Comprehensive step-by-step execution runbooks (minimum 50 lines per skill).
   - Clear execution triggers, input/output requirements, edge-case handling, error-recovery procedures, and code/configuration exemplars.

3. R3: Enhance all 44 workflow files in `registry/workflows/workflow-*.md` with:
   - Structured YAML metadata (name, description, bundle, estimatedDuration).
   - Phase-by-phase execution flowcharts and phase transition criteria.
   - Deterministic verification gates, required tool inputs, validation checkpoints, and automated rollback protocols.

4. Verify Acceptance Criteria:
   - Agent Frontmatter Schema: All 28 agent markdown files parse cleanly with yaml and include mandatory fields (name, description, model, permissionMode).
   - Skill Playbook Depth: All 48 SKILL.md files contain complete runbooks and code exemplars.
   - Workflow Phase Gates: All 44 workflow files define explicit phase gates and exit criteria.
   - Build & Test Integrity: `npm run typecheck && npm test && npm run build` passes 100% cleanly (21/21 Vitest tests passing).
   - Workspace Health Doctor: `node dist/cli.js doctor` returns clean health verification.

Maintain `.agents/orchestrator/progress.md` and `.agents/orchestrator/BRIEFING.md`. When complete, report victory back to parent.
