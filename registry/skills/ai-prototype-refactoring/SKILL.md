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

## Core Directives & Standards
1. **Deconstruct Monolithic Files** — Break large 1000+ line single-file components into atomic design hierarchy (`atoms`, `molecules`, `organisms`, `layouts`).
2. **Strict TypeScript Typing** — Replace all inferred `any` and inline untyped JSON objects with formal TypeScript interfaces and Zod validation schemas.
3. **Design System Token Mapping** — Extract hardcoded arbitrary Tailwind classes (e.g. `bg-[#1a2b3c]`, `p-[17px]`) into semantic Tailwind configuration tokens (e.g. `bg-primary`, `p-4`).
4. **Interactive State & Hook Extraction** — Move inline messy `useState` spaghetti into custom hooks (`useCartState`, `useFilterParams`, `useAuthModal`).
5. **Accessibility (a11y) & Semantic HTML** — Replace unsemantic `div` click handlers with semantic `<button>`, `<nav>`, `<main>`, `<dialog>`, and accessible ARIA attributes.

## Verification Checklist
- [ ] Refactored components pass strict TypeScript compilation (`tsc --noEmit`).
- [ ] Unit and visual regression tests author for critical interaction flows.
- [ ] No hardcoded placeholder mock data remaining in production component code.
