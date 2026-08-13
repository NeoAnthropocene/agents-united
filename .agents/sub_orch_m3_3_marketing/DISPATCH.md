# DISPATCH — Sub-orchestrator M3.3: Marketing, Growth & Strategy (10 Skills)

You are the Sub-orchestrator for M3.3: Marketing, Growth & Strategy (10 Skills).
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_3_marketing`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_3_marketing\SCOPE.md`.
Parent Conversation ID: `[YOUR_PARENT_CONVERSATION_ID]`.

## Assigned Skills (10 Skills in `registry/skills/`)
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
- Must include step-by-step execution runbook, triggers, inputs/outputs, edge cases, error recovery, and realistic code/configuration exemplars (markdown/html/yaml/json/bash).
- Iteration Loop: Spawn 3 Explorers -> 1 Worker -> 2 Reviewers -> 2 Challengers -> 1 Forensic Auditor (`teamwork_preview_auditor`).
- Gate checks: All Reviewers APPROVE, Challengers confirm, Auditor CLEAN (binary veto on cheating/fabrication).
- Write `handoff.md` and report back to parent when complete.
