# Persistent Rule: Domain Modeling & Architecture Decision Records (ADRs)

## Purpose & Scope
This rule establishes rigorous standards for maintaining a shared ubiquitous language, documenting architectural decisions, and conducting Socratic requirement clarification across all projects.

---

## 1. Ubiquitous Language & Domain Dictionary (`CONTEXT.md`)
- **Shared Terminology**: Maintain a persistent `CONTEXT.md` defining core domain concepts, entities, and bounded contexts.
- **Terminology Alignment**: All agents, prompts, APIs, and documentation must use identical terms for domain concepts (e.g. `Bundle`, `Skill`, `Workflow`, `Host`, `Scope`).

---

## 2. Architecture Decision Records (`docs/adr/`)
Whenever a significant architectural, structural, or strategic decision is made, author an ADR in `docs/adr/`:
- **File Naming**: `docs/adr/YYYY-MM-DD-<slug>.md` (e.g. `2026-08-14-devops-vs-sysops-separation.md`).
- **Standard Structure**:
  - **Status**: Proposed / Accepted / Superseded
  - **Context**: Problem statement, constraints, and business context.
  - **Decision**: The selected architectural approach and rationale.
  - **Consequences**: Positive tradeoffs, limitations, and future implications.

---

## 3. Socratic Requirements Clarification (`/grill-with-docs`)
- **Probe Ambiguity First**: Before commencing large architectural changes or complex implementations, probe underspecified requirements with structured multiple-choice questions.
- **Continuous Documentation**: Capture clarified decisions directly into ADRs or domain models during the requirements alignment phase.
