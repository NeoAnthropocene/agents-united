---
name: grill-me
description: Pure Socratic alignment questioning to interrogate requirements,
  uncover blind spots, and eliminate ambiguity before taking action.
metadata:
  author: Matt Pocock (mattpocock/skills)
  version: 1.0.0
  source: https://github.com/mattpocock/skills
  icon: 🔥
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
| `goal` | String / Audio (.mp3, .wav, .m4a) | Yes | High-level goal, text prompt, voice note, or audio recording (up to 20MB) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Clarified Requirements | Console / Inline | Refined specification and agreed approach |
| Audio Transcript Notes (if audio attached) | Inline | Key transcription points extracted from audio intake |

## Step-by-Step Execution Runbook

### Phase 1 — Problem Framing & Multimodal Ingestion
1. Ingest the user's initial prompt, voice recording, or audio attachment.
2. If an audio file or `/voice` memo is provided, transcribe key requirements, goals, and constraints before grilling.
3. Identify open questions or implicit assumptions.
4. Ask 2–4 concise, direct questions focusing on user outcomes and technical constraints.

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
- [ ] Audio inputs (voice notes/files) are transcribed and synthesized accurately.
