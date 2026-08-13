# Plan 002: Antigravity 2.0 Schema Porting & Bundles Hierarchy

## Overview
Port and convert all 23 agents, 48 skills, and 40 workflows from `NeoAnthropocene/SuperAntigravity` into the official Antigravity 2.0 Custom Agent specification (Markdown + YAML Frontmatter) with execution symmetry (`mainAgent`, `subagent`), scoped safety policies, tools, and nested lifecycle hooks.

## Scope of Conversion

### 1. Agents Structure (`registry/agents/`)
Every agent converted into Markdown with frontmatter:
```yaml
---
name: orchestrator-engineering # or subagent-*
description: ...
model: pro # or flash
tools:
  - view_file
  - replace_file_content
  - run_command
  - grep_search
mainAgent: true
subagent: true
permissionMode: acceptEdits
commandExecutionPolicy: auto
hooks:
  PreToolUse:
    - matcher: run_command
      hooks:
        - type: command
          command: echo "Checking execution constraints..."
---

# Core Instructions
...
```

### 2. Workflows (`registry/workflows/`)
All workflows prefixed as `workflow-<name>.md` and formatted for slash-command or orchestrator dynamic prompt injection.

### 3. Skills (`registry/skills/<skill-name>/SKILL.md`)
Formatted with standard progressive disclosure metadata (`name`, `description`).

### 4. Bundles Manifest (`registry/bundles.json`)
Explicitly defining:
- `software-engineering`
- `system-architecture`
- `product-design`
- `growth-marketing`
- `security-operations`
- `deep-research`
- `business-strategy`
- `full`

## Verification
Validate that all markdown files pass YAML frontmatter parsing and adhere to Antigravity schema.
