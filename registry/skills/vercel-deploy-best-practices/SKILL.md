---
name: vercel-deploy-best-practices
description: Next.js and frontend deployment optimization on Vercel, Edge Middleware, Incremental Static Regeneration (ISR), Server Actions, and Preview environments.
metadata:
  author: "Agents United Frontend Group"
  version: "1.0.0"
  license: "MIT"
---

# Vercel Deployment Best Practices Playbook

## Overview & Purpose
`vercel-deploy-best-practices` provides production deployment and configuration guidelines for Next.js, Remix, and static web applications hosted on Vercel.

## Core Directives & Standards
1. **Edge Middleware Routing** — Keep Edge Middleware execution < 25ms by avoiding heavy libraries or un-cached external network calls.
2. **Incremental Static Regeneration (ISR)** — Configure `revalidate` intervals or on-demand revalidation (`revalidatePath`, `revalidateTag`) for dynamic content caching.
3. **Environment Variable Hierarchy** — Separate `Development`, `Preview`, and `Production` environment variables securely with branch-specific overrides.
4. **Vercel Web Analytics & Speed Insights** — Integrate `@vercel/analytics` and `@vercel/speed-insights` for real-user Core Web Vitals monitoring.
5. **Serverless Function Concurrency** — Configure max duration limits and memory allocations in `vercel.json` to prevent billing surprises.

## Verification Checklist
- [ ] Preview deployments generate isolated database branch previews when paired with Neon/Supabase.
- [ ] Zero unhandled Server Action errors in production logs.
