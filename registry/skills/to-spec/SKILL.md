---
name: to-spec
description: Transform raw notes, grilling output, voice memos, or informal user
  feature requests into structured technical specifications and PRDs.
metadata:
  author: Matt Pocock (mattpocock/skills)
  version: 2.0.0
  source: https://github.com/mattpocock/skills
  icon: 📝
---

# Technical Specification & PRD Generator

## Overview & Purpose
`to-spec` converts high-level ideas, notes, voice memos, or grilling interview outcomes into comprehensive, production-ready Product Requirement Documents (PRDs) and technical specs.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `notes` | String / Audio (.mp3, .wav, .m4a) | Yes | Conversation notes, grilling output, voice memos, or customer interview audio (up to 20MB) |
| `spec_dir` | Path | Optional | Output path (default: `docs/specs/`) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| PRD Document | `docs/specs/<feature-name>.md` | Formal technical specification |

## Step-by-Step Execution Runbook

### Phase 1 — Structural Framing & Multimodal Transcription
1. Ingest raw notes, conversation history, voice notes, or interview audio recordings.
2. If audio is provided, extract requirements, user stories, and acceptance criteria.
3. Gather core goals, target personas, technical constraints, and user flows.
4. Outline key components: Problem Statement, Success Metrics, Technical Architecture, Data Schema, Edge Cases, Out of Scope.

### Phase 2 — Specification Drafting
1. Draft detailed spec file using standard markdown template.
2. Include explicit acceptance criteria for each requirement.

### Phase 3 — Review & Refinement
1. Highlight open questions or unresolved dependencies.
2. Store artifact in `docs/specs/<feature-name>.md`.

## Verification & Validation Checklist
- [ ] Frontmatter contains author attribution to Matt Pocock.
- [ ] Spec includes Problem, Architecture, Acceptance Criteria, and Non-Goals.
- [ ] Audio inputs are accurately transcribed and synthesized.
