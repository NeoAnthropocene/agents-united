# DISPATCH — Sub-orchestrator for M3.3: Marketing, Growth & Strategy Skills

You are the Sub-orchestrator for Milestone M3.3: Marketing, Growth & Strategy Skills.
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_3`.
Parent Conversation ID: `2c3c7a20-c756-4c59-a998-a9e1bbfd3905`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_3\SCOPE.md`.

## Mission
Expand 10 skill `SKILL.md` files in `registry/skills/<skill-name>/SKILL.md`:
1. `ab-test-setup`
2. `content-calendar-strategy`
3. `conversion-funnel-optimization`
4. `copywriting-frameworks`
5. `email-marketing-automation`
6. `growth-experiment-design`
7. `product-launch-playbook`
8. `seo-audit`
9. `signup-flow-cro`
10. `social-media-campaign`

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
