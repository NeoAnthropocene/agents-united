---
name: supabase-backend-architecture
description: PostgreSQL database modeling, Row Level Security (RLS) policies,
  Edge Functions (Deno), Auth hooks, and Realtime subscriptions on Supabase.
metadata:
  author: Agents United Backend Group
  version: 1.0.0
  license: MIT
  icon: ⚡
disable-slash-command: true
---

# Supabase Backend Architecture Playbook

## Overview & Purpose
`supabase-backend-architecture` establishes security, performance, and operational best practices for applications built on the Supabase BaaS platform.

## Execution Triggers
- A specialist's Skill Consultation Map names this skill for a task touching Supabase Postgres schemas, Row Level Security, Auth, Realtime, or Edge Functions.
- A migration, policy, or Edge Function must be authored, reviewed, or debugged on a project whose `bundles.json` addon (`backend-distributed-systems`) is installed.

## Input/Output Requirements
- **Input**: the project's `supabase/` directory (migrations, `config.toml`, `seed.sql`), the target schema/table names, and the access pattern (who reads/writes which rows).
- **Output**: SQL migration file(s) with explicit RLS policies, a type-safe client wrapper, and/or a Deno Edge Function — plus the verification commands run.

## Step-by-Step Runbook
1. Inspect existing tables and policies (`supabase db diff`, `view_file` on prior migrations) before writing a new one.
2. Draft the migration with RLS enabled and explicit per-verb policies bound to `auth.uid()`.
3. Wire the typed client (service-role for server-only code, anon/browser client for client code) per `references/backend-frontend-devops-exemplars.md`.
4. Run `supabase db diff` / `supabase start` locally to validate the migration applies cleanly.

## Core Directives & Standards
1. **Row Level Security (RLS) Mandatory** — Enable RLS on every public table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and write explicit granular policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
2. **Database Migration CLI Workflow** — Manage all schema changes through Supabase CLI migrations (`supabase migration new <name>`) and seed scripts (`supabase/seed.sql`).
3. **Edge Functions with Deno** — Author Deno TypeScript Edge Functions for third-party webhook receivers (Stripe, GitHub), secret handling, and background processing.
4. **Auth & Custom JWT Claims** — Utilize Postgres database triggers on `auth.users` to automatically populate public user profile records and assign custom claims/roles.
5. **Realtime Channels & Broadcasts** — Structure Supabase Realtime channel subscriptions with specific filter clauses (`filter: 'room_id=eq.123'`) to prevent unnecessary socket broadcast traffic.

## Code & Config Exemplars
- `references/backend-frontend-devops-exemplars.md` — RLS-enabled migration + service client
  (backend), SSR browser/server client pair (frontend), and a CI preview-branch workflow
  (devops). Extracted per Plan 025 Objective 4; load only when authoring the matching code.

## Edge Cases & Error Recovery
- **RLS blocks a legitimate read/write**: check the policy's `USING`/`WITH CHECK` clause against the actual `auth.uid()` in the failing request before widening a policy — never disable RLS to unblock a bug.
- **Migration conflicts with a concurrent branch**: rebase the migration file with a new timestamp rather than editing an already-applied one; Supabase migrations are append-only.
- **Service role key found in client-reachable code**: treat as a security incident — rotate the key and move the call server-side immediately.

## Verification Checklist
- [ ] Database linter confirms 0 tables with RLS disabled.
- [ ] Supabase local development stack starts cleanly with `supabase start`.
- [ ] Service role key is never exposed to browser clients.
