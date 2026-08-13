# Handoff Report — Survey Explorer 1

## 1. Observation

- **Registry Scope**: Located 28 agent markdown files in `registry/agents/`:
  - 7 Orchestrator files: `orchestrator-business.md`, `orchestrator-design.md`, `orchestrator-engineering.md`, `orchestrator-marketing.md`, `orchestrator-research.md`, `orchestrator-security.md`, `orchestrator-system-architecture.md`.
  - 21 Subagent files: `subagent-backend-architect.md`, `subagent-business-panel-experts.md`, `subagent-code-reviewer.md`, `subagent-deep-research.md`, `subagent-design-ops-lead.md`, `subagent-design-researcher.md`, `subagent-design-systems-architect.md`, `subagent-designer-toolkit-expert.md`, `subagent-frontend-architect.md`, `subagent-interaction-designer.md`, `subagent-marketing-campaign-specialist.md`, `subagent-marketing-content-strategist.md`, `subagent-marketing-conversion-specialist.md`, `subagent-marketing-growth-strategist.md`, `subagent-prototype-tester.md`, `subagent-repo-index.md`, `subagent-security-engineer.md`, `subagent-socratic-mentor.md`, `subagent-system-architect.md`, `subagent-ui-designer.md`, `subagent-ux-strategist.md`.
- **YAML Frontmatter Analysis**:
  - All 28 files contain `name`, `description`, `model`, `permissionMode: acceptEdits`, `commandExecutionPolicy: auto`.
  - **0 of 28 files** contain `version` or `type: orchestrator | subagent`.
  - Legacy fields `mainAgent: true/false` and `subagent: true` are present across all 28 files.
- **System Prompt Line Counts**:
  - Orchestrator total file line counts range from 25 to 45 lines (prompt text bodies are 10–11 lines).
  - Subagent total file line counts range from 16 to 20 lines (prompt text bodies are 3–5 lines).
  - **0 of 28 files** meet Requirement R1's threshold of minimum 40 lines of system prompt per agent.
- **Lifecycle Hooks**:
  - **24 of 28 files** have 0 lifecycle hooks defined.
  - 4 Orchestrators (`orchestrator-design`, `orchestrator-engineering`, `orchestrator-security`, `orchestrator-system-architecture`) contain partial hooks under `hooks:`.
  - **0 of 28 files** contain all four explicit lifecycle hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).
- **Codebase Validation & Parsing (`src/core/doctor.ts`)**:
  - `DoctorEngine.runDoctor` uses regex `/^---\r?\n([\s\S]+?)\r?\n---/` and `YAML.parse()`.
  - Currently checks for `meta.name` (error if missing), `meta.description` (warning if missing), `meta.model` (warning if missing).

## 2. Logic Chain

1. Observation 1 shows that all 28 expected agent markdown files exist in `registry/agents/`.
2. Observation 2 shows that existing frontmatters lack `version` and `type` fields required by Antigravity 2.0 Agent Specification (R1 & ADR-0002).
3. Observation 3 demonstrates that every single agent prompt body (3 to 11 lines) is well under the 40-line minimum prompt length required by R1.
4. Observation 4 establishes that 24 agents completely lack hooks, and no agent possesses a complete 4-hook set (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).
5. Observation 5 demonstrates how `src/core/doctor.ts` parses agent frontmatter and validates `name`, `description`, and `model`, confirming that upgrading frontmatter schemas in `registry/agents/` will be validated by the CLI doctor without breaking existing regex parsing.

## 3. Caveats

- Investigation focused on `registry/agents/` and core parsing logic in `src/`. Skill playbooks (`registry/skills/`) and workflow templates (`registry/workflows/`) are surveyed by peer agents.
- Assumed standard semver `version: 1.0.0` will be adopted across agents.

## 4. Conclusion

All 28 agent files require frontmatter updates (adding `version: 1.0.0`, `type: orchestrator | subagent`), prompt expansions (to >= 40 lines), and explicit lifecycle hook definitions (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`) to fulfill Requirement R1 and pass production quality standards. Full detail per agent is recorded in `survey_agents.md`.

## 5. Verification Method

- **Files to Inspect**:
  - `c:\github\agents-united\.agents\teamwork_preview_explorer_survey_1\survey_agents.md`
  - `c:\github\agents-united\registry\agents\*.md`
  - `c:\github\agents-united\src\core\doctor.ts`
- **Commands**:
  - `npx vitest run` (or `npm test`): Verifies test suite execution.
  - `node dist/cli.js doctor`: Verifies frontmatter health check.
