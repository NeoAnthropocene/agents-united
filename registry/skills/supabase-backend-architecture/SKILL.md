---
name: supabase-backend-architecture
description: PostgreSQL database modeling, Row Level Security (RLS) policies, Edge Functions (Deno), Auth hooks, and Realtime subscriptions on Supabase.
metadata:
  author: "Agents United Backend Group"
  version: "1.0.0"
  license: "MIT"
---

# Supabase Backend Architecture Playbook

## Overview & Purpose
`supabase-backend-architecture` establishes security, performance, and operational best practices for applications built on the Supabase BaaS platform.

## Core Directives & Standards
1. **Row Level Security (RLS) Mandatory** — Enable RLS on every public table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and write explicit granular policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
2. **Database Migration CLI Workflow** — Manage all schema changes through Supabase CLI migrations (`supabase migration new <name>`) and seed scripts (`supabase/seed.sql`).
3. **Edge Functions with Deno** — Author Deno TypeScript Edge Functions for third-party webhook receivers (Stripe, GitHub), secret handling, and background processing.
4. **Auth & Custom JWT Claims** — Utilize Postgres database triggers on `auth.users` to automatically populate public user profile records and assign custom claims/roles.
5. **Realtime Channels & Broadcasts** — Structure Supabase Realtime channel subscriptions with specific filter clauses (`filter: 'room_id=eq.123'`) to prevent unnecessary socket broadcast traffic.

## Verification Checklist
- [ ] Database linter confirms 0 tables with RLS disabled.
- [ ] Supabase local development stack starts cleanly with `supabase start`.
- [ ] Service role key is never exposed to browser clients.
