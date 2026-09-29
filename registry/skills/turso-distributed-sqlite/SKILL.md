---
name: turso-distributed-sqlite
description: Edge-distributed SQLite databases with LibSQL, embedded replicas,
  multi-tenant database-per-user architectures, and low-latency replication on
  Turso.
metadata:
  author: Agents United Backend Group
  version: 1.0.0
  license: MIT
  icon: 🪶
disable-slash-command: true
---

# Turso Distributed SQLite Playbook

## Overview & Purpose
`turso-distributed-sqlite` guides developers in leveraging LibSQL and Turso for distributed SQLite architectures with sub-millisecond edge reads and serverless scale.

## Execution Triggers
- A specialist's Skill Consultation Map names this skill for a task requiring sub-10ms edge reads, multi-tenant database-per-tenant isolation, or a Turso/LibSQL branch workflow.
- A project's `bundles.json` addon (`backend-distributed-systems`) is installed and a Turso client, migration, or CI branch needs authoring or review.

## Input/Output Requirements
- **Input**: the target read-latency budget, tenancy model (shared DB vs. database-per-tenant), and any existing `@libsql/client` configuration.
- **Output**: a configured LibSQL client (embedded replica or edge-direct), a Drizzle migration, and/or a CI branch-provisioning step — plus the sync/latency verification performed.

## Step-by-Step Runbook
1. Confirm the latency requirement actually needs an embedded replica (vs. a direct edge connection) before adding sync complexity.
2. Configure the client with `syncUrl`/`authToken` and an explicit `syncInterval`; call `.sync()` before latency-critical reads that cannot tolerate staleness.
3. For CI, provision an isolated database branch per feature/PR and tear it down after merge (`references/backend-frontend-devops-exemplars.md`).
4. Verify replica synchronization under a concurrent write load before treating the setup as production-ready.

## Core Directives & Standards
1. **Embedded Replicas for Edge Reads** — Configure `@libsql/client` with local file sync (`syncUrl`, `authToken`) for local microsecond read queries synchronized with remote Turso primary.
2. **Multi-Tenant Database-per-Tenant Pattern** — Use the Turso Platform API to dynamically provision lightweight, isolated SQLite databases per customer organization.
3. **Schema Migrations with Drizzle ORM** — Manage LibSQL migrations using Drizzle ORM (`drizzle-kit generate` & `drizzle-kit push`).
4. **Connection Pooling & Batching** — Use LibSQL batch transactions (`client.batch([...])`) to execute multiple queries in a single HTTP roundtrip.

## Code & Config Exemplars
- `references/backend-frontend-devops-exemplars.md` — embedded-replica client with tenant query
  (backend), Edge route handler reading a Turso replica (frontend), and a per-feature-branch CI
  provisioning script (devops). Extracted per Plan 025 Objective 4.

## Edge Cases & Error Recovery
- **Stale read after a write**: call `.sync()` before the read, or route latency-tolerant reads to the replica and freshness-critical reads to the primary directly.
- **Branch left running after PR merge/close**: CI must always run the `turso db destroy` cleanup step, even on a failed job — treat an orphaned branch as a cost leak, not a no-op.
- **Sync conflict under concurrent writes**: Turso/LibSQL embedded replicas are read-replicas; route all writes through the primary and never write directly to a synced local file.

## Verification Checklist
- [ ] Database authentication tokens configured securely via environment variables.
- [ ] Read replica synchronization verified under concurrent write loads.
