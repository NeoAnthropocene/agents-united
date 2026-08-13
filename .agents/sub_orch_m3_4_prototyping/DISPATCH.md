# DISPATCH — Sub-orchestrator M3.4: Prototyping & Testing (4 Skills)

You are the Sub-orchestrator for M3.4: Prototyping & Testing (4 Skills).
Working directory: `c:\github\agents-united\.agents\sub_orch_m3_4_prototyping`.
Original Request Path: `c:\github\agents-united\ORIGINAL_REQUEST.md`.
Scope Document: `c:\github\agents-united\.agents\sub_orch_m3_4_prototyping\SCOPE.md`.
Parent Conversation ID: `[YOUR_PARENT_CONVERSATION_ID]`.

## Assigned Skills (4 Skills in `registry/skills/`)
1. `clickable-prototype-spec`
2. `component-playground-setup`
3. `design-handoff-spec`
4. `interactive-prototype-builder`

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
- Must include step-by-step execution runbook, triggers, inputs/outputs, edge cases, error recovery, and realistic code/configuration exemplars (ts/jsx/json/yaml).
- Iteration Loop: Spawn 3 Explorers -> 1 Worker -> 2 Reviewers -> 2 Challengers -> 1 Forensic Auditor (`teamwork_preview_auditor`).
- Gate checks: All Reviewers APPROVE, Challengers confirm, Auditor CLEAN (binary veto on cheating/fabrication).
- Write `handoff.md` and report back to parent when complete.
