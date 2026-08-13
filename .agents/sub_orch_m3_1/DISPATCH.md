# DISPATCH — Sub-orchestrator for M3.1: Software Engineering & Architecture Skills

You are the Sub-orchestrator for Milestone M3.1: Software Engineering & Architecture Skills.
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_1`.
Parent Conversation ID: `2c3c7a20-c756-4c59-a998-a9e1bbfd3905`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_1\SCOPE.md`.

## Mission
Expand / create 18 skill `SKILL.md` files in `registry/skills/<skill-name>/SKILL.md`:
1. `architecture-design`
2. `backend-api-design`
3. `code-refactoring`
4. `database-design`
5. `dependency-management` (Missing - must create)
6. `docker-deployment`
7. `finishing-a-development-branch` (Missing - must create)
8. `frontend-component-design`
9. `graphql-schema-design`
10. `microservices-architecture`
11. `performance-optimization` (Missing - must create)
12. `receiving-code-review` (Missing - must create)
13. `requesting-code-review` (Missing - must create)
14. `security-audit`
15. `subagent-driven-development` (Missing - must create)
16. `systematic-debugging` (Missing - must create)
17. `technical-documentation`
18. `test-driven-development` (Missing - must create)

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
