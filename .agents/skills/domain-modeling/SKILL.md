---
name: domain-modeling
description: Build and sharpen project domain terminology, entity relationships, and ubiquitous language documented in CONTEXT.md.
metadata:
  author: "Matt Pocock (mattpocock/skills)"
  version: "1.0.0"
  source: "https://github.com/mattpocock/skills"
---

# Domain Modeling & Ubiquitous Language

## Overview & Purpose
`domain-modeling` builds a shared vocabulary between human developers and AI orchestrators. By recording domain entities, terminology, and key domain rules in `CONTEXT.md`, agents can communicate with precision, reducing context bloat and misunderstandings.

## Execution Triggers & Prerequisites
### Execution Triggers
- Introduction of new domain concepts, data models, or business logic.
- Agent output using verbose or inconsistent terminology.

### Prerequisites
- Access to `CONTEXT.md` in repository root.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `terms` | Array | Yes | List of terms, entities, or rules to define or refine |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Domain Specification | `CONTEXT.md` | Single source of truth for domain vocabulary |

## Step-by-Step Execution Runbook

### Phase 1 — Term Extraction
1. Extract candidate terms from user prompts, design docs, or existing code.
2. Identify ambiguous words that have multiple meanings across sub-domains.

### Phase 2 — Definition & Boundary Mapping
1. Formulate clear 1-to-2 sentence definitions for each domain primitive.
2. Note explicit terms to avoid (anti-patterns / deprecated jargon).

### Phase 3 — CONTEXT.md Sync
1. Append or update section in `CONTEXT.md`.
2. Verify formatting matches repository conventions.

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] `CONTEXT.md` updated with concise term definitions.
