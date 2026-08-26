---
name: react-best-practices
description: Modern React 19 and Next.js App Router performance patterns, Server
  Components, streaming SSR, and client state boundaries.
metadata:
  author: Vercel Engineering (vercel-labs/agent-skills)
  version: 1.0.0
  source: https://skills.sh/vercel-labs/agent-skills/react-best-practices
  icon: ⚛️
disable-slash-command: true
---

# React & Next.js Best Practices Playbook

## Overview & Purpose
`react-best-practices` enforces state-of-the-art frontend development standards for React and Next.js applications, prioritizing Core Web Vitals, minimal client bundle sizes, and clean architectural separation.

## Rules & Constraints
1. **Server Components by Default** — Keep components as Server Components unless interactive hooks (`useState`, `useEffect`, event handlers) are strictly required (`"use client"`).
2. **Push Client Boundaries Down** — Isolate `"use client"` directives to the smallest interactive leaf nodes to minimize JavaScript shipped to browsers.
3. **Suspense & Streaming SSR** — Wrap asynchronous data-fetching components in `<Suspense fallback={<Skeleton />}>` for progressive rendering.
4. **Optimized Image & Font Loading** — Always use `next/image` with explicit aspect ratios and `next/font` for zero layout shift (CLS: 0).

## Step-by-Step Execution Runbook

### Phase 1 — Component Architecture Review
- Audit component tree to identify opportunities to hoist data fetching into Server Components.
- Eliminate client-side `useEffect` waterfall fetching patterns in favor of direct server async/await.

### Phase 2 — State Management & Transitions
- Use React 19 `useActionState` and `useOptimistic` for form mutations.
- Wrap non-urgent state updates in `startTransition` to maintain responsive user input (INP < 100ms).

### Phase 3 — Verification
- Audit Next.js production build bundle sizes with `@next/bundle-analyzer`.

## Verification Checklist
- [ ] Minimal client-side JavaScript bundle footprint.
- [ ] No layout shift (CLS = 0) during page load.
- [ ] Fast Interaction to Next Paint (INP < 100ms).
