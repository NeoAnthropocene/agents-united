---
name: vercel-deploy-best-practices
description: Next.js and frontend deployment optimization on Vercel, Edge
  Middleware, Incremental Static Regeneration (ISR), Server Actions, and Preview
  environments.
metadata:
  author: Agents United Frontend Group
  version: 1.0.0
  license: MIT
  icon: ▲
disable-slash-command: true
---

# Vercel Deployment Best Practices Playbook

## Overview & Purpose
`vercel-deploy-best-practices` provides production deployment and configuration guidelines for Next.js, Remix, and static web applications hosted on Vercel.

## Execution Triggers
- A specialist's Skill Consultation Map names this skill for a task touching Vercel Edge Functions/Middleware, preview deployments, ISR caching, or `vercel.json` configuration.
- A project's `bundles.json` addon (`frontend-engineering` or `devops-engineering`) is installed and a Vercel CLI command, GitHub Actions preview workflow, or Edge runtime route needs authoring.

## Input/Output Requirements
- **Input**: the target runtime (Edge vs. Node serverless), the environment tier (Development/Preview/Production), and any existing `vercel.json` / GitHub Actions workflow.
- **Output**: a deploy command sequence or GitHub Actions workflow, an Edge Function/Middleware file, and/or `vercel.json` concurrency settings — plus which step (build, preview deploy, production deploy) actually ran.

## Step-by-Step Runbook
1. Confirm the runtime target (`edge` vs. default Node) before writing the route — Edge has no Node APIs.
2. Build with `vercel build`, then deploy the prebuilt output (`vercel deploy --prebuilt`) to preview first, always.
3. Wire environment variables per tier (`vercel env pull`) rather than hardcoding per-environment values.
4. **Never run the `--prod` promotion yourself** — stop at a verified preview deploy and hand the production command to the orchestrator for explicit user approval (`references/backend-frontend-devops-exemplars.md`).

## Core Directives & Standards
1. **Edge Middleware Routing** — Keep Edge Middleware execution < 25ms by avoiding heavy libraries or un-cached external network calls.
2. **Incremental Static Regeneration (ISR)** — Configure `revalidate` intervals or on-demand revalidation (`revalidatePath`, `revalidateTag`) for dynamic content caching.
3. **Environment Variable Hierarchy** — Separate `Development`, `Preview`, and `Production` environment variables securely with branch-specific overrides.
4. **Vercel Web Analytics & Speed Insights** — Integrate `@vercel/analytics` and `@vercel/speed-insights` for real-user Core Web Vitals monitoring.
5. **Serverless Function Concurrency** — Configure max duration limits and memory allocations in `vercel.json` to prevent billing surprises.

## Code & Config Exemplars
- `references/backend-frontend-devops-exemplars.md` — Edge streaming API route (backend),
  prebuilt deploy commands (frontend), and a full Vercel preview GitHub Actions workflow
  (devops). Extracted per Plan 025 Objective 4.

## Edge Cases & Error Recovery
- **Edge Function needs a Node-only API**: switch the route to the default Node runtime rather than polyfilling; Edge intentionally excludes the Node standard library.
- **Preview deploy succeeds but production promotion is requested**: refuse to run `--prod` directly; hand the exact command to the orchestrator and report that human approval is required.
- **Stale preview after an env var change**: preview deployments do not pick up new env vars automatically — trigger a fresh `vercel deploy --prebuilt` after updating them.

## Verification Checklist
- [ ] Preview deployments generate isolated database branch previews when paired with Neon/Supabase.
- [ ] Zero unhandled Server Action errors in production logs.
