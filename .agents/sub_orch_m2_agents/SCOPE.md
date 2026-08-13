# Scope: M2 - R1 Agent Definitions Upgrade (28 Agents)

## Target Files
- Orchestrators (7 files):
  1. `registry/agents/orchestrator-business.md`
  2. `registry/agents/orchestrator-engineering.md`
  3. `registry/agents/orchestrator-marketing-growth.md`
  4. `registry/agents/orchestrator-product-design.md`
  5. `registry/agents/orchestrator-research.md`
  6. `registry/agents/orchestrator-system-architecture.md`
  7. `registry/agents/orchestrator-teamwork-preview.md`
- Subagents (21 files):
  1. `registry/agents/subagent-backend-architect.md`
  2. `registry/agents/subagent-business-panel-experts.md`
  3. `registry/agents/subagent-code-reviewer.md`
  4. `registry/agents/subagent-design-ops-lead.md`
  5. `registry/agents/subagent-designer-toolkit-expert.md`
  6. `registry/agents/subagent-frontend-architect.md`
  7. `registry/agents/subagent-interaction-designer.md`
  8. `registry/agents/subagent-marketing-content-strategist.md`
  9. `registry/agents/subagent-marketing-growth-strategist.md`
  10. `registry/agents/subagent-prototype-tester.md`
  11. `registry/agents/subagent-security-engineer.md`
  12. `registry/agents/subagent-socratic-mentor.md`
  13. `registry/agents/subagent-system-architect.md`
  14. `registry/agents/subagent-teamwork-preview-auditor.md`
  15. `registry/agents/subagent-teamwork-preview-challenger.md`
  16. `registry/agents/subagent-teamwork-preview-critic.md`
  17. `registry/agents/subagent-teamwork-preview-explorer.md`
  18. `registry/agents/subagent-teamwork-preview-reviewer.md`
  19. `registry/agents/subagent-teamwork-preview-worker.md`
  20. `registry/agents/subagent-ui-designer.md`
  21. `registry/agents/subagent-ux-strategist.md`

## Specification & Validation
- Frontmatter must include: `name`, `version`, `type`, `description`, `model`, `permissionMode`, `commandExecutionPolicy`.
- System prompt body must be >= 40 lines per agent.
- Lifecycle hooks must define all 4 hooks: `PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`.
