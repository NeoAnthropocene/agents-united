# DISPATCH — Sub-orchestrator M3.1: Software Engineering & Architecture (18 Skills)

You are the Sub-orchestrator for M3.1: Software Engineering & Architecture (18 Skills).
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_1_swe`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_1_swe\SCOPE.md`.
Parent Conversation ID: `[YOUR_PARENT_CONVERSATION_ID]`.

## Assigned Skills (18 Skills in `registry/skills/`)
1. `architecture-design`
2. `backend-api-design`
3. `code-refactoring`
4. `database-design`
5. `dependency-management` (Missing - MUST CREATE)
6. `docker-deployment`
7. `finishing-a-development-branch` (Missing - MUST CREATE)
8. `frontend-component-design`
9. `graphql-schema-design`
10. `microservices-architecture`
11. `performance-optimization` (Missing - MUST CREATE)
12. `receiving-code-review` (Missing - MUST CREATE)
13. `requesting-code-review` (Missing - MUST CREATE)
14. `security-audit`
15. `subagent-driven-development` (Missing - MUST CREATE)
16. `systematic-debugging` (Missing - MUST CREATE)
17. `technical-documentation`
18. `test-driven-development` (Missing - MUST CREATE)

## Requirements & Specifications
- Frontmatter:
  ```yaml
  ---
  name: <skill-name>
  description: <description>
  metadata:
    author: "agents-united"
    version: "2.0.0"
  ---
  ```
- Runbook length: Minimum 50 lines per SKILL.md.
- Must include step-by-step execution runbook, triggers, inputs/outputs, edge cases, error recovery, and realistic code/configuration exemplars (bash/ts/json/yaml).
- Iteration Loop: Spawn 3 Explorers -> 1 Worker -> 2 Reviewers -> 2 Challengers -> 1 Forensic Auditor (`teamwork_preview_auditor`).
- Gate checks: All Reviewers APPROVE, Challengers confirm, Auditor CLEAN (binary veto on cheating/fabrication).
- Write `handoff.md` and report back to parent when complete.
