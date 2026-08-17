---
name: database-design
description: Production-grade Database Design playbook for high-throughput
  transactional schemas, indexing, and migrations.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/database-design/SKILL.md | do not edit -->

# Relational & NoSQL Database Schema Design

## Overview & Purpose
The Relational & NoSQL Database Schema Design skill provides a deterministic, battle-tested framework for executing database-design processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking database-design.
- Auditing, implementing, or standardizing database-design procedures.
- Addressing technical debt, architectural reviews, or production readiness gates.
- Preparing pull requests or automated release validations.

### Prerequisites
- Active project repository workspace with version control configured.
- Operational testing, typechecking, and build toolchains.
- Domain requirements, architectural constraints, or user stories defined.
- Clean git working tree before beginning execution.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `target_scope` | String | Yes | Target module, service, component, or file path |
| `config` | Object | Optional | Specific domain configurations, thresholds, and options |
| `output_dir` | Directory Path | Optional | Destination directory for generated artifacts and reports |
| `strict_mode` | Boolean | Optional | Enforce strict zero-warning validation and high test coverage |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Specification Document | `docs/database-design/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/database-design/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/database-design/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Entity-Relationship Modeling & Normalization
1. Map business entities, cardinality (1:1, 1:N, N:M), and ownership relationships.
2. Normalize relational schema to Third Normal Form (3NF) to eliminate data redundancy.
3. Identify strategic denormalization opportunities for read-heavy query paths.
4. Choose appropriate primary key strategy: UUIDv7 / ULID (distributed) vs BIGINT IDENTITY.
5. Design foreign key constraints with explicit ON DELETE RESTRICT / CASCADE policies.

### Phase 2: Index Strategy & Partitioning Architecture
1. Analyze query access patterns (filter predicates, join columns, order-by clauses).
2. Design composite B-tree indexes following Equality-Range-Sort (ESR) rule.
3. Implement partial/filtered indexes for status flags (WHERE status = 'active').
4. Configure range/hash partitioning on high-volume tables (>10M rows per month).
5. Audit index overhead against write-amplification tradeoffs.

### Phase 3: Migration Script Authoring & Versioning
1. Write deterministic, bidirectional migration scripts (up.sql and down.sql).
2. Wrap DDL operations in atomic transactions where supported by database engine.
3. Use lock-free DDL patterns (e.g. CREATE INDEX CONCURRENTLY in PostgreSQL).
4. Ensure zero-downtime expand-and-contract pattern for schema column renames/drops.
5. Test migration rollback (down) in isolated staging environment.

### Phase 4: Query Optimization & EXPLAIN ANALYZE Verification
1. Execute EXPLAIN (ANALYZE, BUFFERS) on critical path database queries.
2. Verify elimination of sequential table scans on multi-million row datasets.
3. Verify connection pool sizing (HikariCP/pgpool) against database max connections.
4. Set statement timeouts to prevent long-running runaway transactions.
5. Audit query memory consumption during batch processing.

### Phase 5: Data Integrity & Backup Validation
1. Define database checkpointing and Point-In-Time-Recovery (PITR) policies.
2. Implement automated data corruption and constraint integrity checks.
3. Update ORM entity schema mappings (Prisma, TypeORM, Drizzle) and generate typings.
4. Commit schema migrations to version control.
5. Deploy migrations to production database cluster.

## Code & Configuration Exemplars

### Exemplar 1: Relational & NoSQL Database Schema Design Configuration & Specification
```yaml
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id),
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_tenant_status_created ON orders (tenant_id, status, created_at DESC);
```

### Exemplar 2: Relational & NoSQL Database Schema Design TypeScript Type Contract
```typescript
export interface MigrationStep {
  version: number;
  name: string;
  up: string;
  down: string;
  transactional: boolean;
  reversible: boolean;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Relational & NoSQL Database Schema Design
1. **Diagnosis**: Static analysis, typechecking, or unit tests fail validation rules during execution.
2. **Recovery Protocol**:
   - Step 1: Inspect detailed error log output in test/build terminal.
   - Step 2: Formulate targeted hypothesis and isolate failing line or assertion.
   - Step 3: Implement surgical code fix and re-run verification suite.

### Scenario B: Missing or Incompatible Dependency
1. **Diagnosis**: Required toolchain binary or library dependency is missing from the environment.
2. **Recovery Protocol**:
   - Step 1: Verify `package.json` engine requirements and local environment versions.
   - Step 2: Install required peer dependencies cleanly with lockfile sync.
   - Step 3: Resume runbook from Phase 1.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
