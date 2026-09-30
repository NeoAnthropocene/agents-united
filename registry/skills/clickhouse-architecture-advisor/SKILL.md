---
name: clickhouse-architecture-advisor
description: Prescriptive ClickHouse and ClickHouse Cloud architecture
  guidance — MergeTree engine selection, ORDER BY / partition key design,
  compression codecs, and skip indexes — adapted from ClickHouse's official
  agent-skills. Use when designing a new analytical schema, choosing between
  self-hosted ReplicatedMergeTree and Cloud SharedMergeTree, or diagnosing
  slow ClickHouse queries.
metadata:
  author: ClickHouse / agents-united
  version: 1.0.0
  source: https://github.com/ClickHouse/agent-skills
  commit: 2f6ec4b17a81a435dd116f9ac19d7b45d44dbd61
  license: Apache-2.0
  icon: 🏛️
disable-slash-command: true
---

# ClickHouse Architecture Advisor

## Overview & Purpose
`clickhouse-architecture-advisor` mirrors ClickHouse's own
`clickhouse-architecture-advisor` skill (`ClickHouse/agent-skills`,
Apache-2.0): prescriptive schema and system design guidance for analytical
(OLAP) workloads, covering both self-hosted deployments (`ReplicatedMergeTree`
+ ClickHouse Keeper) and ClickHouse Cloud (`SharedMergeTree`). It focuses on
the decisions that are expensive to change after data has landed: the
`ORDER BY` key, the partition key, and per-column compression.

### Reference files

Read only what the workload needs. [`rules/`](rules/) holds one `decision-<topic>.md` per topic (`ingestion-strategy`, `real-time-preaggregation`, `partitioning-timeseries`, `join-enrichment`, `late-arriving-upserts`); [`examples/`](examples/) has three worked recommendations; [`mappings/doc_links.yaml`](mappings/doc_links.yaml) maps topics to official documentation links; [`schemas/recommendation_schema.yaml`](schemas/recommendation_schema.yaml) gives the recommendation shape.

## Execution Triggers & Prerequisites
### Execution Triggers
- Designing a new ClickHouse table for an analytical/event-log workload.
- Choosing between `ReplicatedMergeTree` (self-hosted) and `SharedMergeTree`
  (Cloud) for a given deployment target.
- A query is scanning far more data than it should (`system.query_log` shows
  high `read_rows`/`read_bytes` for a selective-looking `WHERE`).
- Reviewing table DDL before it goes into production — the `ORDER BY` key
  cannot be changed without rewriting the table.

### Prerequisites
- `clickhouse-client` access to the target cluster, or the Cloud SQL console.
- The primary query patterns for the table (which columns appear in
  `WHERE`/`GROUP BY`/`ORDER BY` most often) — schema design without this is
  guesswork.
- Read access to `system.parts`, `system.query_log`, and
  `system.merge_tree_settings` for diagnosis.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `workload_summary` | Object | Yes | Workload type (event-log, dimensional, time-series), latency target, data shape |
| `primary_query_patterns` | List | Yes | The `WHERE`/`GROUP BY` columns queries actually filter and aggregate on |
| `deployment_target` | String | Yes | `self-hosted` (ReplicatedMergeTree) or `cloud` (SharedMergeTree) |
| `data_volume` | String | Optional | Rows/day and retention window, for partition-key sizing |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Table DDL | Inline SQL (`CREATE TABLE ... ENGINE = ...`) | Engine, `ORDER BY`, `PARTITION BY`, codecs, TTL |
| Recommendation | category (`official`/`derived`/`field`) + confidence + source | Each recommendation states what to do, why, and how it was validated |
| Diagnosis | `system.query_log` / `system.parts` findings | Root cause of a slow query or bloated part count |

## Step-by-Step Execution Runbook

### Phase 1 — Workload Classification
1. Classify the workload: append-only event log, slowly-changing dimension
   table, or time-series with rollups. Each implies a different `ORDER BY`
   and TTL strategy.
2. Identify the 2-3 columns that appear in the most `WHERE` clauses across
   real queries — these are the `ORDER BY` key candidates, not columns that
   merely seem important.
3. Note the retention window (how long data must be queryable) — this drives
   the partition key granularity and TTL policy.

### Phase 2 — Engine & Key Selection
1. Use `ReplicatedMergeTree` for self-hosted clusters needing replication via
   ClickHouse Keeper; use `SharedMergeTree` on ClickHouse Cloud, which
   decouples storage from compute and replicates via object storage instead
   of peer-to-peer part fetching.
2. Order the `ORDER BY` key from lowest to highest cardinality among the
   columns most frequently filtered together — e.g.
   `ORDER BY (tenant_id, event_type, timestamp)`, not the reverse; ClickHouse
   can only skip granules for a prefix of the key that is actually
   constrained by the query.
3. Choose the partition key for *data lifecycle*, not query filtering — a
   monthly `PARTITION BY toYYYYMM(timestamp)` for TTL-based deletion, not a
   high-cardinality key. Too many partitions (thousands) causes merge and
   metadata overhead; the `ORDER BY` key, not the partition key, is what
   should carry query selectivity.
4. Avoid partitioning by a column with more than a few hundred distinct
   values per table — this is the most common ClickHouse anti-pattern and
   causes "too many parts" errors under insert load.

### Phase 3 — Compression & Skip Indexes
1. Apply `ZSTD(1)` as the default column codec for most workloads; reserve
   `LZ4` for columns needing the fastest decompression at the cost of ratio.
2. Use `Delta` or `DoubleDelta` codecs for monotonically increasing columns
   (auto-increment IDs, timestamps) before general compression — codecs
   compose: `CODEC(Delta, ZSTD)`.
3. Use `T64` for integer columns with a narrow value range relative to their
   type width.
4. Add a skip index (`minmax`, `set`, or `bloom_filter`) on columns that are
   filtered often but are *not* a prefix of the `ORDER BY` key — this lets
   ClickHouse skip whole granules without a full index rebuild of the primary
   key.

### Phase 4 — Verification & Query Diagnosis
1. After creating the table and loading representative data, run the target
   queries and check `system.query_log` for `read_rows` vs the table's total
   row count — a selective query reading a large fraction of the table
   indicates the `ORDER BY` key or skip indexes are wrong for that access
   pattern.
2. Check `system.parts` for part count and size distribution; a large number
   of small parts indicates either too granular a partition key or an insert
   pattern that needs batching (avoid single-row inserts; batch writes).
3. Validate TTL behavior (`system.merge_tree_settings`, `OPTIMIZE TABLE ...
   FINAL` in a test environment) before relying on it to enforce retention.

## Code & Configuration Exemplars

### Exemplar 1: Event-Log Table (Self-Hosted, Replicated)
```sql
CREATE TABLE events ON CLUSTER '{cluster}'
(
    tenant_id   UInt32,
    event_type  LowCardinality(String),
    timestamp   DateTime CODEC(Delta, ZSTD),
    user_id     UInt64,
    payload     String CODEC(ZSTD(3))
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/events', '{replica}')
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, event_type, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;
```

### Exemplar 2: ClickHouse Cloud (SharedMergeTree)
```sql
CREATE TABLE events
(
    tenant_id   UInt32,
    event_type  LowCardinality(String),
    timestamp   DateTime CODEC(Delta, ZSTD),
    user_id     UInt64
)
ENGINE = SharedMergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, event_type, timestamp);
```

### Exemplar 3: Skip Index for a Non-Key Filter Column
```sql
ALTER TABLE events
  ADD INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 4;
```

## Edge Cases & Error Recovery Procedures

### Scenario A: "Too Many Parts" Insert Errors
1. **Diagnosis**: `system.parts` shows a high count of small parts; inserts
   are happening one row (or a few rows) at a time instead of in batches.
2. **Recovery Protocol**:
   - Step 1: Batch inserts client-side (hundreds to low thousands of rows per
     insert) rather than per-event inserts.
   - Step 2: Re-check the partition key cardinality — if it's too fine-
     grained, widen it (e.g. daily → monthly).
   - Step 3: As a last resort, tune `max_insert_block_size` /
     `min_insert_block_size_rows`, not as a substitute for batching.

### Scenario B: Query Reads Far More Rows Than Expected
1. **Diagnosis**: `system.query_log.read_rows` for a filtered query is close
   to the table's total row count.
2. **Recovery Protocol**:
   - Step 1: Confirm the filtered column is a prefix of `ORDER BY`; a filter
     on a non-prefix column gets no primary-key pruning.
   - Step 2: If the column cannot be part of the `ORDER BY` key (workload
     already needs a different key for other queries), add a skip index on
     it instead.

### Scenario C: Choosing Between ReplicatedMergeTree and SharedMergeTree Mid-Migration
1. **Diagnosis**: A table is being migrated from self-hosted to Cloud, and
   the DDL was copied verbatim.
2. **Recovery Protocol**:
   - Step 1: Swap the engine clause only (`ReplicatedMergeTree(...)` →
     `SharedMergeTree`); `ORDER BY`/`PARTITION BY`/codecs transfer unchanged.
   - Step 2: Re-validate part/merge behavior post-migration — Cloud's
     storage-compute separation changes merge cost characteristics.

## Verification & Validation Checklist
- [ ] The `ORDER BY` key's column order matches the actual query filter
      order (equality/low-cardinality columns first).
- [ ] The partition key is chosen for lifecycle/TTL, not query filtering, and
      has low-to-moderate cardinality (not thousands of partitions).
- [ ] Monotonic columns use `Delta`/`DoubleDelta` codecs before general
      compression.
- [ ] Skip indexes exist for frequently-filtered columns that are not an
      `ORDER BY` prefix.
- [ ] `system.query_log` was checked after schema changes to confirm
      `read_rows` dropped for the target queries.
- [ ] Inserts are batched; no single-row insert pattern in production.
