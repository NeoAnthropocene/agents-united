# Original User Request

## 2026-08-13T18:34:41Z

Expand all 28 agent markdown definitions, 48 skill playbooks, and 44 workflow templates in the agents-united registry into comprehensive, battle-tested, production-grade specifications inspired by skills.sh and SuperAntigravity.

Working directory: c:\github\agents-united
Integrity mode: development

## Requirements

### R1. Comprehensive Agent Markdown Definitions (28 Agents)
Upgrade all orchestrators (registry/agents/orchestrator-*.md) and subagents (registry/agents/subagent-*.md) with:
- Antigravity 2.0 YAML frontmatter (name, version, type: orchestrator | subagent, description, model, permissionMode: acceptEdits | requestReview | strict, commandExecutionPolicy).
- Extensive system prompts (minimum 40 lines per agent) detailing operational role, step-by-step reasoning protocol, tool selection rules, boundary constraints, and nested subagent delegation rules.
- Explicit lifecycle hooks (PreInvocation, PostInvocation, PreToolUse, PostToolUse).

### R2. Deep Production-Grade Skill Playbooks (48 Skills)
Expand all skill SKILL.md files (registry/skills/*/SKILL.md) with:
- YAML progressive disclosure frontmatter (name, description, metadata: { author, version }).
- Comprehensive step-by-step execution runbooks (minimum 50 lines per skill).
- Clear execution triggers, input/output requirements, edge-case handling, error-recovery procedures, and code/configuration exemplars.

### R3. Deterministic Workflow Templates (44 Workflows)
Enhance all workflow files (registry/workflows/workflow-*.md) with:
- Structured YAML metadata (name, description, bundle, estimatedDuration).
- Phase-by-phase execution flowcharts and phase transition criteria.
- Deterministic verification gates, required tool inputs, validation checkpoints, and automated rollback protocols.

## Acceptance Criteria

### Verification & Quality Bar
- [ ] Agent Frontmatter Schema: All 28 agent markdown files parse cleanly with yaml and include mandatory fields (name, description, model, permissionMode).
- [ ] Skill Playbook Depth: All 48 SKILL.md files contain complete runbooks and code exemplars.
- [ ] Workflow Phase Gates: All 44 workflow files define explicit phase gates and exit criteria.
- [ ] Build & Test Integrity: npm run typecheck && npm test && npm run build passes 100% cleanly (21/21 Vitest tests passing).
- [ ] Workspace Health Doctor: node dist/cli.js doctor returns clean health verification.
