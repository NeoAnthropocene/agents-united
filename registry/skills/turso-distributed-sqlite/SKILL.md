---
name: turso-distributed-sqlite
description: Edge-distributed SQLite databases with LibSQL, embedded replicas, multi-tenant database-per-user architectures, and low-latency replication on Turso.
metadata:
  author: "Agents United Backend Group"
  version: "1.0.0"
  license: "MIT"
---

# Turso Distributed SQLite Playbook

## Overview & Purpose
`turso-distributed-sqlite` guides developers in leveraging LibSQL and Turso for distributed SQLite architectures with sub-millisecond edge reads and serverless scale.

## Core Directives & Standards
1. **Embedded Replicas for Edge Reads** — Configure `@libsql/client` with local file sync (`syncUrl`, `authToken`) for local microsecond read queries synchronized with remote Turso primary.
2. **Multi-Tenant Database-per-Tenant Pattern** — Use the Turso Platform API to dynamically provision lightweight, isolated SQLite databases per customer organization.
3. **Schema Migrations with Drizzle ORM** — Manage LibSQL migrations using Drizzle ORM (`drizzle-kit generate` & `drizzle-kit push`).
4. **Connection Pooling & Batching** — Use LibSQL batch transactions (`client.batch([...])`) to execute multiple queries in a single HTTP roundtrip.

## Verification Checklist
- [ ] Database authentication tokens configured securely via environment variables.
- [ ] Read replica synchronization verified under concurrent write loads.
