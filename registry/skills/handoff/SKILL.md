---
name: handoff
description: Capture session progress, active context, decision logs, and remaining tasks to pass context seamlessly between subagents or future sessions.
metadata:
  author: "Matt Pocock (mattpocock/skills)"
  version: "1.0.0"
  source: "https://github.com/mattpocock/skills"
---

# Session Handoff & Context Persistence

## Overview & Purpose
`handoff` creates structured context handoff notes at the end of an agent session or before delegating tasks to subagents. This preserves context momentum and prevents redundant discovery work.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `summary` | String | Yes | Brief description of completed work and current state |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Handoff Document | `docs/handoff/HANDOFF-<date>.md` | Persistent session summary and open task list |

## Step-by-Step Execution Runbook

### Phase 1 — State Capture
1. Summarize key achievements and completed PRs/commits in this session.
2. List modified files and current git branch.

### Phase 2 — Remaining Work & Blockers
1. Highlight open tasks, failing tests, or unmerged branches.
2. Document explicit next steps for the incoming agent.

### Phase 3 — Persistence
1. Save handoff notes to `docs/handoff/` or output directly in session response.

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] Handoff summary includes completed items, open items, and next steps.
