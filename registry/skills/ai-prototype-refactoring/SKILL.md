---
name: ai-prototype-refactoring
description: Refactoring rapid AI-generated prototypes from Lovable, v0, and
  Bolt into production-ready modular React components, typed design tokens, and
  clean architectures.
metadata:
  author: Agents United Frontend Group
  version: 1.0.0
  license: MIT
  icon: 🧩
disable-slash-command: true
---

# AI Prototype Refactoring Playbook (Lovable / v0 / Bolt)

## Overview & Purpose
`ai-prototype-refactoring` standardizes the ingestion and transformation of single-file AI prototype exports (from Lovable.dev, v0.dev, Bolt.new) into enterprise-grade modular React/TypeScript codebases.

## Execution Triggers
- A specialist's Skill Consultation Map names this skill for a task migrating a Lovable/v0/Bolt export into the production codebase (mock data → real repository, monolithic file → atomic components).
- A project's `bundles.json` addon (`frontend-engineering` or `devops-engineering`) is installed and a prototype needs its environment promoted from mock to real infrastructure.

## Input/Output Requirements
- **Input**: the exported prototype file(s), the target production data source (e.g. Supabase table), and the design tokens the codebase already uses.
- **Output**: decomposed atomic components with typed props, a typed repository/API client replacing the mock array, and/or a CI promotion workflow — plus the type-check and test results.

## Step-by-Step Runbook
1. Identify every hardcoded mock array, inline style, and untyped prop in the exported file.
2. Decompose the monolith into atoms/molecules/organisms and re-anchor styling to design tokens.
3. Replace the mock data layer with a typed repository/API client against the real backend (`references/backend-frontend-devops-exemplars.md`).
4. When promoting to staging, inject real environment variables in place of the mock stubs via the project's CI pipeline, never by hand-editing the deployed environment.

## Core Directives & Standards
1. **Deconstruct Monolithic Files** — Break large 1000+ line single-file components into atomic design hierarchy (`atoms`, `molecules`, `organisms`, `layouts`).
2. **Strict TypeScript Typing** — Replace all inferred `any` and inline untyped JSON objects with formal TypeScript interfaces and Zod validation schemas.
3. **Design System Token Mapping** — Extract hardcoded arbitrary Tailwind classes (e.g. `bg-[#1a2b3c]`, `p-[17px]`) into semantic Tailwind configuration tokens (e.g. `bg-primary`, `p-4`).
4. **Interactive State & Hook Extraction** — Move inline messy `useState` spaghetti into custom hooks (`useCartState`, `useFilterParams`, `useAuthModal`).
5. **Accessibility (a11y) & Semantic HTML** — Replace unsemantic `div` click handlers with semantic `<button>`, `<nav>`, `<main>`, `<dialog>`, and accessible ARIA attributes.

## Code & Config Exemplars
- `references/backend-frontend-devops-exemplars.md` — mock-array-to-typed-repository migration
  (backend), atomic decomposition of a monolithic prototype component (frontend), and a
  mock-to-staging environment promotion workflow (devops). Extracted per Plan 025 Objective 4.

## Edge Cases & Error Recovery
- **Prototype has no discernible data boundary** (mock data inlined throughout render logic): extract the shape into a typed interface first, then swap the source, so the diff shows a clean before/after.
- **Design tokens the prototype invented don't exist in the codebase's theme**: reconcile with the existing `tailwind.config.ts` token set rather than adding parallel one-off tokens.
- **Promotion pipeline has no staging environment configured**: report the gap to the orchestrator instead of promoting directly to production.

## Verification Checklist
- [ ] Refactored components pass strict TypeScript compilation (`tsc --noEmit`).
- [ ] Unit and visual regression tests author for critical interaction flows.
- [ ] No hardcoded placeholder mock data remaining in production component code.
