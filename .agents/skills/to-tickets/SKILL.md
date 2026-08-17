---
name: to-tickets
description: Decompose technical specifications and PRDs into actionable, prioritized backlog issues and task tickets.
metadata:
  author: "Matt Pocock (mattpocock/skills)"
  version: "1.0.0"
  source: "https://github.com/mattpocock/skills"
---

# Ticket & Work Breakdown Generator

## Overview & Purpose
`to-tickets` takes technical specs or PRDs and breaks them down into atomic, self-contained implementation tickets ready for development.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `spec_file` | Path | Yes | Path to specification or PRD markdown file |
| `target_format` | String | Optional | Format (`github`, `linear`, or `markdown`) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Ticket Breakdown | Inline / Issues | List of structured, actionable tickets |

## Step-by-Step Execution Runbook

### Phase 1 — Work Decomposition
1. Analyze specification dependencies and identify milestone steps.
2. Group tasks into sequential phases (Foundation -> Core Logic -> UI/Integration -> Verification).

### Phase 2 — Ticket Writing
For each task, define:
- Title: Clear, action-oriented verb phrase.
- Context & Motivation.
- Concrete Acceptance Criteria (checkable checkboxes).
- Verification command.

### Phase 3 — Export
1. Format for GitHub CLI (`gh issue create`), Linear, or append to `docs/tickets/`.

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] Tickets are atomic and contain explicit acceptance criteria.
