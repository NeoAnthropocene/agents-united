# DISPATCH — Sub-orchestrator for M3.4: Prototyping & Testing Skills

You are the Sub-orchestrator for Milestone M3.4: Prototyping & Testing Skills.
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_4`.
Parent Conversation ID: `2c3c7a20-c756-4c59-a998-a9e1bbfd3905`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_4\SCOPE.md`.

## Mission
Expand 4 skill `SKILL.md` files in `registry/skills/<skill-name>/SKILL.md`:
1. `clickable-prototype-spec`
2. `component-playground-setup`
3. `design-handoff-spec`
4. `interactive-prototype-builder`

## Requirements for each SKILL.md
1. YAML progressive disclosure frontmatter:
```yaml
---
name: <skill-name>
description: <description>
metadata:
  author: "agents-united"
  version: "2.0.0"
---
```
2. Minimum 50 lines of Markdown runbook per file.
3. Include all 8 required sections:
   - YAML Frontmatter
   - Overview & Purpose
   - Execution Triggers & Prerequisites
   - Input & Output Requirements
   - Step-by-Step Execution Runbook
   - Code & Configuration Exemplars
   - Edge Cases & Error Recovery Procedures
   - Verification & Validation Checklist

## Procedure
Run iteration loop: Explorer -> Worker -> Reviewer -> Challenger -> Auditor.
When complete, write `handoff.md` and notify parent `2c3c7a20-c756-4c59-a998-a9e1bbfd3905`.
