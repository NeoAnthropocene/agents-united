# Comprehensive Survey Report: Agent Markdown Definitions (28 Agents)

## Executive Summary

An exhaustive investigation of all 28 agent markdown files (7 orchestrators and 21 subagents) in `registry/agents/` and the codebase validation engine (`src/core/doctor.ts`, `src/core/registry.ts`) was conducted. 

Key Findings:
1. **Frontmatter Schema Coverage**: All 28 files contain basic YAML frontmatter (`name`, `description`, `model`, `permissionMode: acceptEdits`, `commandExecutionPolicy: auto`). However, **0 out of 28 files** include `version` or explicit `type: orchestrator | subagent` fields (currently using legacy `mainAgent: true/false`, `subagent: true`).
2. **System Prompt Depth Deficit**: **0 out of 28 agents** meet the Requirement R1 specification of a minimum 40 lines of system prompt. Orchestrator prompts range from 10 to 11 lines of body text (25 to 45 total file lines), while Subagent prompts range from 3 to 5 lines of body text (16 to 20 total file lines).
3. **Lifecycle Hook Gaps**: **24 out of 28 agents** (100% of subagents and 3 orchestrators) contain **zero lifecycle hooks**. Only 4 orchestrators contain partial hooks (`PreInvocation`, `PreToolUse`, `PostToolUse`), and **0 out of 28 agents** possess all 4 explicit lifecycle hooks (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).
4. **Parsing & Validation Mechanism**: `src/core/doctor.ts` parses YAML frontmatter using regex `/^---\r?\n([\s\S]+?)\r?\n---/` and `YAML.parse()`. It currently validates `name` (required), `description` (warning if missing), and `model` (warning if missing).

---

## Detailed Frontmatter & Property Parsing Analysis

### Frontmatter Parser (`src/core/doctor.ts`, lines 42–63)
- **Regex Extraction**: `/^---\r?\n([\s\S]+?)\r?\n---/`
- **Parsing Library**: `yaml` (`YAML.parse`)
- **Current Checks**:
  - `meta.name`: If missing, adds issue `Agent ${file} missing 'name' in frontmatter.`
  - `meta.description`: If missing, adds warning `Agent ${file} missing 'description'.`
  - `meta.model`: If missing, adds warning `Agent ${file} missing 'model' definition.`
- **Missing Validation Capabilities**: The current `doctor` implementation does not validate:
  - `version` schema presence or semver format.
  - `type` (`orchestrator` | `subagent`) matching the filename prefix.
  - `permissionMode` enum compliance (`acceptEdits` | `requestReview` | `strict`).
  - `commandExecutionPolicy` enum compliance (`auto` | `ask` | `strict`).
  - System prompt line count thresholds (e.g. >= 40 lines).
  - Structure or presence of `hooks` (`PreInvocation`, `PostInvocation`, `PreToolUse`, `PostToolUse`).

---

## Inventory & Categorized Audit of All 28 Agents

### 1. Orchestrators (7 Files)

| File Name | Frontmatter Fields Present | Missing Required Fields | Total Lines | Prompt Body Lines | PreInvocation | PostInvocation | PreToolUse | PostToolUse |
|---|---|---|---|---|---|---|---|---|
| `orchestrator-business.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 25 | 10 | No | No | No | No |
| `orchestrator-design.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy`, `hooks` | `version`, `type` | 31 | 10 | No | No | Partial (`generate_image`) | No |
| `orchestrator-engineering.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy`, `hooks` | `version`, `type` | 45 | 11 | Yes (`git status`) | No | Yes (`run_command`) | Yes (`replace_file_content`) |
| `orchestrator-marketing.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 25 | 10 | No | No | No | No |
| `orchestrator-research.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 25 | 10 | No | No | No | No |
| `orchestrator-security.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy`, `hooks` | `version`, `type` | 30 | 10 | Yes (echo) | No | No | No |
| `orchestrator-system-architecture.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy`, `hooks` | `version`, `type` | 30 | 10 | Yes (echo) | No | No | No |

---

### 2. Subagents (21 Files)

| File Name | Frontmatter Fields Present | Missing Required Fields | Total Lines | Prompt Body Lines | PreInvocation | PostInvocation | PreToolUse | PostToolUse |
|---|---|---|---|---|---|---|---|---|
| `subagent-backend-architect.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 20 | 5 | No | No | No | No |
| `subagent-business-panel-experts.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-code-reviewer.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 18 | 5 | No | No | No | No |
| `subagent-deep-research.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 18 | 5 | No | No | No | No |
| `subagent-design-ops-lead.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-design-researcher.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-design-systems-architect.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 18 | 5 | No | No | No | No |
| `subagent-designer-toolkit-expert.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-frontend-architect.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 20 | 5 | No | No | No | No |
| `subagent-interaction-designer.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-marketing-campaign-specialist.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-marketing-content-strategist.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-marketing-conversion-specialist.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-marketing-growth-strategist.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-prototype-tester.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |
| `subagent-repo-index.md` | `name`, `description`, `model` (flash), `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 18 | 5 | No | No | No | No |
| `subagent-security-engineer.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 18 | 5 | No | No | No | No |
| `subagent-socratic-mentor.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 16 | 5 | No | No | No | No |
| `subagent-system-architect.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 19 | 5 | No | No | No | No |
| `subagent-ui-designer.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 18 | 5 | No | No | No | No |
| `subagent-ux-strategist.md` | `name`, `description`, `model`, `tools`, `mainAgent`, `subagent`, `permissionMode`, `commandExecutionPolicy` | `version`, `type` | 17 | 5 | No | No | No | No |

---

## Metric Deficit Summary & Upgrade Recommendations

### 1. Frontmatter Upgrades Needed
- Add `version: 1.0.0` to all 28 frontmatters.
- Add `type: orchestrator` to all 7 orchestrators and `type: subagent` to all 21 subagents.
- Retain `permissionMode: acceptEdits` and `commandExecutionPolicy: auto` (or upgrade per role requirements).

### 2. System Prompt Expansion Needed
- Expand all system prompts to **minimum 40 lines** of detailed content per agent.
- Include structured sections in each agent prompt:
  1. **Operational Role & Philosophy**
  2. **Step-by-Step Reasoning Protocol**
  3. **Tool Selection & Usage Rules**
  4. **Boundary & Safety Constraints**
  5. **Subagent Delegation Rules & Workflows** (for orchestrators) / **Inter-agent Handoff Rules** (for subagents).

### 3. Lifecycle Hooks Standardization Needed
- Add standard explicit lifecycle hooks to `hooks:` in all 28 frontmatters:
  - `PreInvocation`: Task entry environment check / initialization logging.
  - `PostInvocation`: Verification / completion reporting.
  - `PreToolUse`: Safety gate for file mutations or command execution.
  - `PostToolUse`: Post-action audit / syntax verification / build status check.
