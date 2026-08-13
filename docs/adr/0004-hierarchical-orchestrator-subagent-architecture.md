# 4. Hierarchical Orchestrator-Subagent Bundle Architecture

We enforce a strict hierarchical architecture across all ecosystem bundles:
1. **Naming Standard**:
   - Orchestrator Agents: `orchestrator-<domain>.md` (e.g. `orchestrator-engineering.md`, `orchestrator-design.md`, `orchestrator-marketing.md`)
   - Sub-Agents: `subagent-<role>.md` (e.g. `subagent-backend-architect.md`, `subagent-ui-designer.md`, `subagent-security-engineer.md`)
   - Workflows: `workflow-<task>.md` (e.g. `workflow-implement.md`, `workflow-brainstorm.md`, `workflow-marketing-audit.md`)
   - General Purpose Orchestrators & Workflows: Shared across bundles (e.g. `orchestrator-brainstorm.md`, `workflow-brainstorm.md`).

2. **Bundle Composition**:
   Every domain bundle (`software-engineering`, `system-architecture`, `product-design`, `growth-marketing`, `security-operations`, `deep-research`, `business-strategy`) contains:
   - 1+ Orchestrator Agent (`mainAgent: true`, `subagent: true`)
   - Cohesive Sub-Agents (`mainAgent: true/false`, `subagent: true`)
   - Specialized Skills (`skills/<skill-name>/SKILL.md`)
   - Procedural Workflows (`workflows/workflow-<name>.md`)

3. **Antigravity 2.0 Integration**:
   Every agent embeds:
   - `model: pro | flash | inherit`
   - `tools: [...]`
   - `permissionMode: acceptEdits`
   - `commandExecutionPolicy: auto | request-review`
   - `hooks:` (nested interceptors with `matcher` on tools like `run_command`, `replace_file_content`, `view_file`)
