---
name: grill-me
description: Pure Socratic alignment questioning to interrogate requirements, uncover blind spots, and eliminate ambiguity before taking action.
metadata:
  author: "Matt Pocock (mattpocock/skills)"
  version: "1.0.0"
  source: "https://github.com/mattpocock/skills"
---

# Grill Me: Socratic Alignment Interview

## Overview & Purpose
`grill-me` engages the developer in a focused, iterative Q&A session. It prevents premature implementation ("vibe coding") by asking hard, clarifying questions about scope, assumptions, edge cases, and success criteria.

## Execution Triggers & Prerequisites
### Execution Triggers
- Invoked via `/grill-me`.
- User request is high-level, ambiguous, or lacks clear boundaries.

### Prerequisites
- Clear user goal or initial idea prompt.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `goal` | String | Yes | High-level goal or requirement prompt |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Clarified Requirements | Console / Inline | Refined specification and agreed approach |

## Step-by-Step Execution Runbook

### Phase 1 — Problem Framing
1. Read the user's initial prompt and identify open questions or implicit assumptions.
2. Ask 2–4 concise, direct questions focusing on user outcomes and technical constraints.

### Phase 2 — Iterative Grilling
1. Process user responses.
2. If new ambiguities emerge, ask follow-up questions one round at a time.
3. Stop grilling as soon as scope, edge cases, and non-goals are explicit.

### Phase 3 — Summary & Hand-off
1. Present a concise bulleted summary of agreed scope.
2. Offer next steps (e.g. proceed to `/to-spec` or implementation).

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] Grilling questions are targeted and non-redundant.
