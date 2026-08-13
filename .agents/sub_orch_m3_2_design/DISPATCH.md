# DISPATCH — Sub-orchestrator M3.2: Design Operations, Systems, & UX/UI (16 Skills)

You are the Sub-orchestrator for M3.2: Design Operations, Systems, & UX/UI (16 Skills).
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_2_design`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_2_design\SCOPE.md`.
Parent Conversation ID: `[YOUR_PARENT_CONVERSATION_ID]`.

## Assigned Skills (16 Skills in `registry/skills/`)
1. `accessibility-audit`
2. `component-library-management`
3. `design-system-governance`
4. `design-system-tokens`
5. `design-tokens-management`
6. `design-version-control`
7. `design-ops-workflow`
8. `interaction-pattern-library`
9. `micro-interaction-design`
10. `mobile-first-design`
11. `responsive-design-audit`
12. `state-driven-ui-animation`
13. `ui-component-spec`
14. `user-flow-mapping`
15. `user-journey-mapping`
16. `usability-testing-protocol`

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
- Must include step-by-step execution runbook, triggers, inputs/outputs, edge cases, error recovery, and realistic code/configuration exemplars (css/ts/json/yaml).
- Iteration Loop: Spawn 3 Explorers -> 1 Worker -> 2 Reviewers -> 2 Challengers -> 1 Forensic Auditor (`teamwork_preview_auditor`).
- Gate checks: All Reviewers APPROVE, Challengers confirm, Auditor CLEAN (binary veto on cheating/fabrication).
- Write `handoff.md` and report back to parent when complete.
