---
name: postgres-best-practices
description: Postgres performance, schema, and security best practices curated
  from Supabase's operational experience — indexing, query plans, RLS, and
  connection pooling. Use when writing, reviewing, or optimizing Postgres
  queries, schema designs, or database configurations on Supabase or any
  Postgres-compatible database.
metadata:
  author: Supabase / agents-united
  version: 1.0.0
  source: https://github.com/supabase/agent-skills
  commit: 551274ed2fe97c8fea1325f7ceb05803a542f8df
  license: MIT
  icon: 🐘
disable-slash-command: true
---

# Postgres Best Practices (Supabase)

## Overview & Purpose
`postgres-best-practices` packages Supabase's operational guidance for writing
efficient, secure Postgres schemas and queries. It is adapted from the
upstream `supabase-postgres-best-practices` skill (MIT-licensed,
`github.com/supabase/agent-skills`) and applies whether the database runs on
Supabase, RDS, or self-hosted Postgres — the rules are standard Postgres
behavior, not Supabase-proprietary.

### Reference files

Rule documents are in [`references/`](references/), one per rule, named `<category>-<topic>.md` with the category prefixes `query-`, `schema-`, `security-`, `conn-`, `lock-`, `data-`, `monitor-` and `advanced-`. List the folder and read only the file that matches the rule you are applying.

## Execution Triggers & Prerequisites
### Execution Triggers
- Writing or reviewing a new table, migration, or `SELECT`/`JOIN` query.
- A query is slow, an index seems missing, or `EXPLAIN ANALYZE` output needs
  interpreting.
- Designing Row-Level Security (RLS) policies for multi-tenant data.
- Sizing a connection pool (PgBouncer / Supavisor) for a serverless or
  edge-function workload.

### Prerequisites
- `psql` or the Supabase CLI (`supabase db diff`, `supabase migration new`)
  available against the target database.
- Ability to run `EXPLAIN (ANALYZE, BUFFERS)` on representative data volumes —
  never tune against an empty dev database.
- `pg_stat_statements` extension enabled for query-level telemetry, where
  available.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `target_query` / `target_table` | String | Yes | The SQL statement or table under review |
| `explain_output` | Text | Recommended | `EXPLAIN (ANALYZE, BUFFERS)` output for the query |
| `access_pattern` | String | Optional | Read-heavy, write-heavy, or mixed; multi-tenant or single-tenant |
| `expected_row_count` | Integer | Optional | Production-scale row count, used to judge index selectivity |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Index recommendations | Inline SQL (`CREATE INDEX CONCURRENTLY ...`) | Concrete DDL, never applied without confirmation |
| RLS policy set | Inline SQL (`CREATE POLICY ...`) | Policies scoped to `auth.uid()` or equivalent tenant key |
| Migration file | `supabase/migrations/<timestamp>_<name>.sql` | Reviewed, idempotent migration |

## Step-by-Step Execution Runbook

### Phase 1 — Schema & Index Review
1. Confirm every foreign key has a covering index — Postgres does not create
   one automatically, and unindexed FKs are the single most common source of
   lock contention on `DELETE`/`UPDATE` of the parent row.
2. Prefer a single composite index over several single-column indexes when
   queries always filter on the same column set; order composite index
   columns equality-first, then range/sort columns.
3. Use partial indexes (`CREATE INDEX ... WHERE deleted_at IS NULL`) for
   queries that always filter out the same subset of rows — smaller index,
   faster scans.
4. Use `GIN` indexes for `jsonb` containment (`@>`) and full-text search
   (`tsvector`), and `BRIN` indexes for large, naturally-ordered append-only
   columns (timestamps on a time-series table).
5. Prefer `identity` columns (`GENERATED ALWAYS AS IDENTITY`) over `serial`
   for new primary keys.

### Phase 2 — Query Plan Diagnosis
1. Run `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` on the real query against
   production-scale data; never trust a plan from an empty table.
2. Read the plan bottom-up: a `Seq Scan` on a large table where a `Filter`
   removes most rows is the first candidate for an index.
3. Watch for `Rows Removed by Filter` far larger than `Rows`, a sign the
   planner is scanning far more than it returns.
4. A `Nested Loop` with a large outer row count and no index on the inner
   side's join key is O(n×m); add the missing index or restructure the join.
5. Compare `actual time` to `planning time`; if planning dominates, the query
   has too many joins/CTEs for the planner to reason about efficiently —
   simplify or materialize an intermediate result.

### Phase 3 — Row-Level Security & Connection Management
1. Every multi-tenant table gets `ENABLE ROW LEVEL SECURITY` plus explicit
   `CREATE POLICY` statements — a table with RLS enabled and zero policies
   denies all access by default, which is the safe failure mode.
2. Write RLS policies against an indexed column (commonly a `tenant_id` or
   `auth.uid()`-derived owner column); an unindexed policy predicate turns
   every query on that table into a sequential scan.
3. Use `SECURITY DEFINER` functions sparingly and only when the policy logic
   cannot be expressed as a `USING`/`WITH CHECK` predicate directly.
4. Size connection pools for the actual workload: serverless/edge functions
   open many short-lived connections, so route them through a transaction-mode
   pooler (Supavisor/PgBouncer transaction pooling) rather than direct
   connections, which exhaust `max_connections` quickly.
5. Use scoped, least-privilege credentials (a scoped Postgres role, or a
   scoped personal access token for the Supabase Management API/CLI/MCP)
   rather than the database owner role for application traffic.

### Phase 4 — Maintenance & Verification
1. Confirm autovacuum is not falling behind on high-churn tables — check
   `pg_stat_user_tables.n_dead_tup` relative to `n_live_tup`; a ratio above
   ~20% on a hot table is worth tuning `autovacuum_vacuum_scale_factor` for.
2. Re-run `EXPLAIN (ANALYZE, BUFFERS)` after adding an index and confirm the
   plan actually uses it (`Index Scan` / `Index Only Scan`, not `Seq Scan`).
3. Use `CREATE INDEX CONCURRENTLY` on any table receiving live writes to avoid
   taking an exclusive lock during index build.
4. Record before/after `actual time` and `Buffers: shared hit/read` in the
   migration's commit message or PR description for future reviewers.

## Code & Configuration Exemplars

### Exemplar 1: Composite Index for a Common Filter + Sort
```sql
-- Query: WHERE tenant_id = $1 AND status = 'open' ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_tenant_status_created
  ON tickets (tenant_id, status, created_at DESC);
```

### Exemplar 2: Row-Level Security Policy Scoped to an Indexed Owner Column
```sql
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets (owner_id);

CREATE POLICY tickets_owner_read ON tickets
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY tickets_owner_write ON tickets
  FOR INSERT WITH CHECK (owner_id = auth.uid());
```

### Exemplar 3: Diagnosing a Slow Query
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at > now() - interval '30 days'
ORDER BY o.created_at DESC
LIMIT 50;
-- Look for: Seq Scan on orders/customers, Rows Removed by Filter,
-- and whether an index on orders(created_at) or customers(id) is used.
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Adding an Index Locks a Hot Table
1. **Diagnosis**: A plain `CREATE INDEX` on a high-write table blocks writers
   for the duration of the build.
2. **Recovery Protocol**:
   - Step 1: Cancel the build if it is still running (`SELECT pg_cancel_backend(pid)`).
   - Step 2: Re-issue as `CREATE INDEX CONCURRENTLY`, which builds without an
     exclusive lock (at the cost of two table scans and no transaction wrap).
   - Step 3: If `CONCURRENTLY` leaves an `INVALID` index after a failure,
     `DROP INDEX` it and retry — it is not usable and will not be picked up
     by the planner.

### Scenario B: RLS Policy Silently Returns Zero Rows
1. **Diagnosis**: A table has RLS enabled but the expected rows do not come
   back for an authenticated caller, and no error is raised (`SELECT` under
   RLS fails closed, not loud).
2. **Recovery Protocol**:
   - Step 1: Run `SET ROLE` or use the CLI's local-role emulation to reproduce
     the exact calling identity, then re-run the query directly.
   - Step 2: Inspect `pg_policies` for the table and confirm a `USING` clause
     exists for the operation being performed (`SELECT`/`INSERT`/`UPDATE`/`DELETE`
     each need their own policy or an `ALL` policy).
   - Step 3: Confirm the policy predicate references a column that is
     actually populated for those rows (a `NULL` owner column never matches
     `owner_id = auth.uid()`).

### Scenario C: Connection Pool Exhaustion Under Load
1. **Diagnosis**: Application errors report "too many connections" or
   timeouts acquiring a connection during traffic spikes.
2. **Recovery Protocol**:
   - Step 1: Check whether traffic is going through a transaction-mode
     pooler; direct-to-Postgres connections from many short-lived functions
     is the usual root cause.
   - Step 2: Lower the application's per-instance pool size and route through
     the pooler's transaction-mode port.
   - Step 3: Audit for connection leaks (a client that opens a transaction and
     never commits/rolls back holds a pool slot indefinitely).

## Verification & Validation Checklist
- [ ] Every foreign key column has a covering index.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` was run against production-scale data
      before and after any index change, and the plan uses the new index.
- [ ] Every table with RLS enabled has an explicit policy per operation it
      needs to support; none rely on an implicit default-allow.
- [ ] RLS predicates reference indexed columns.
- [ ] Application traffic uses a scoped role/token, not the database owner.
- [ ] `CREATE INDEX CONCURRENTLY` was used on any table receiving live writes.
- [ ] `metadata.source`/`license` above still match `github.com/supabase/agent-skills`
      (MIT) — re-verify on update rather than assuming drift-free.
