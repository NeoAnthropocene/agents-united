---
name: grill-with-docs
description: Interactive alignment grilling session that asks deep probing
  questions before coding, establishes ubiquitous domain vocabulary
  (CONTEXT.md), and records architectural decisions (ADRs).
metadata:
  author: Matt Pocock (mattpocock/skills)
  version: 1.0.0
  source: https://github.com/mattpocock/skills
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/grill-with-docs/SKILL.md | do not edit -->

# Grill With Docs: Socratic Alignment & Domain Documentation

## Overview & Purpose
`grill-with-docs` bridges the alignment gap between developers and AI orchestrators before implementation begins. It uses structured Socratic questioning to uncover hidden assumptions, update the shared domain language in `CONTEXT.md`, and record architectural decisions as formal ADRs (`docs/adr/*.md`).

## Execution Triggers & Prerequisites
### Execution Triggers
- Starting a new feature, module, or complex refactor.
- Ambiguous requirements or conflicting design preferences.
- Directly running `/grill-with-docs` or initiating interactive orchestration.

### Prerequisites
- Accessible project root with `CONTEXT.md` (or permissions to create one).
- Working directory initialized with version control.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `topic` | String | Yes | Feature, task, or architectural change to align on |
| `issue_tracker` | String | Optional | Target tracker (`github`, `linear`, or `local`) |
| `doc_path` | String | Optional | Path for documentation output (default: `docs/adr/`) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Domain Dictionary | `CONTEXT.md` | Ubiquitous vocabulary and domain model mapping |
| Architectural Decision Record | `docs/adr/ADR-XXXX-<title>.md` | Formal decision log documenting problem, context, and choice |

## Step-by-Step Execution Runbook

### Phase 1 — Socratic Alignment Interview
1. Ask 3–5 probing, targeted questions about the requested feature (e.g., boundaries, data flow, edge cases, failure modes).
2. Wait for developer responses before proceeding.
3. Challenge ambiguous assumptions or underspecified constraints.

### Phase 2 — Ubiquitous Language & Domain Modeling
1. Identify new domain concepts, entity names, or system jargon surfaced during grilling.
2. Update or create `CONTEXT.md` at the project root with clear, concise term definitions.
3. Ensure orchestrators and developer use consistent terminology across code and documentation.

### Phase 3 — Architectural Decision Record (ADR) Generation
1. Format agreed architectural choices into an ADR stored under `docs/adr/`.
2. Include Title, Status (Proposed/Accepted), Context, Decision, and Consequences.
3. Summarize key takeaways and hand off to implementation workflows.

## Code & Configuration Exemplars

### Exemplar 1: ADR Structure
```markdown
# ADR-0001: Adopt Scoped Safety Policies for Sub-Agent Execution

## Status
Accepted

## Context
Sub-agents require predictable execution boundaries without prompting the user for every shell tool call.

## Decision
Implement `permissionMode: acceptEdits` and `commandExecutionPolicy` headers in sub-agent frontmatter.

## Consequences
Reduces human-in-the-loop overhead while keeping security constraints explicit.
```

## Verification & Validation Checklist
- [ ] Frontmatter includes `author: "Matt Pocock (mattpocock/skills)"`.
- [ ] `CONTEXT.md` updated with any newly introduced domain terms.
- [ ] ADR document saved with proper sequence number under `docs/adr/`.
