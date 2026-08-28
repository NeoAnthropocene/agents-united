---
name: architecture-design
description: Production-grade Architecture Design playbook for microservices,
  event-driven backends, and C4 domain modeling.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 📐
---

# System Architecture Design & ADR Management

## Overview & Purpose
The System Architecture Design & ADR Management skill provides a deterministic, battle-tested framework for executing architecture-design processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking architecture-design.
- Auditing, implementing, or standardizing architecture-design procedures.
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
| Specification Document | `docs/architecture-design/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/architecture-design/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/architecture-design/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Domain Decomposition & C4 Model Framing
1. Deconstruct system requirements into Context, Container, Component, and Code layers.
2. Define bounded contexts and domain aggregates to prevent leaky domain boundaries.
3. Chart synchronous vs asynchronous communication channels and latency budgets.
4. Identify stateful storage requirements and data partitioning strategies.
5. Draft high-level architecture diagram and component topology.

### Phase 2: Tradeoff Analysis & Non-Functional Requirements (NFRs)
1. Quantify SLA/SLO requirements: p99 latency (<150ms), availability (99.99%), throughput (10k rps).
2. Evaluate CAP theorem tradeoffs: Consistency vs Availability during network partitions.
3. Assess infrastructure cost implications across compute, bandwidth, and managed services.
4. Perform threat modeling (STRIDE) against network boundaries and data stores.
5. Document architectural alternatives considered and reasons for rejection.

### Phase 3: ADR Authoring & Interface Contract Definition
1. Author formal ADR in docs/adr/ADR-XXXX.md following MADR template standards.
2. Specify OpenAPI / gRPC Protobuf interface contracts for inter-service boundaries.
3. Define idempotency keys and retry policies for distributed operations.
4. Define failure domains, circuit breaker thresholds, and fallback degradations.
5. Submit ADR for peer review by security and system architecture teams.

### Phase 4: Architecture Validation & Prototyping Spike
1. Build minimal executable spike to validate performance and latency assumptions.
2. Verify distributed tracing propagation across boundary headers (TraceContext).
3. Run automated load testing against prototype endpoints using k6 or autocannon.
4. Validate disaster recovery and failover behavior under simulated node outages.
5. Review spike results against target SLO metrics.

### Phase 5: Governance & Downstream Implementation Handoff
1. Publish accepted ADR to repository architecture registry.
2. Generate service scaffold templates with pre-configured telemetry and lint rules.
3. Brief backend and infrastructure subagents on architectural constraints.
4. Create milestone tracking tickets linked directly to ADR acceptance criteria.
5. Establish quarterly architectural drift review cadence.

## Code & Configuration Exemplars

### Exemplar 1: System Architecture Design & ADR Management Configuration & Specification
```yaml
title: "ADR-004: Event-Driven Order Processing Architecture"
status: "accepted"
date: "2026-08-14"
deciders: ["System Architect", "Backend Lead"]
context: |
  Synchronous REST calls between Checkout and Inventory services caused cascading latency spikes during peak loads.
decision: |
  We will adopt an event-driven architecture using Apache Kafka with transactional outbox patterns.
consequences:
  positive:
    - Decouples checkout service latency from inventory processing.
    - Guarantees at-least-once message delivery via transactional outbox.
  negative:
    - Eventual consistency requires asynchronous UI status polling.
```

### Exemplar 2: System Architecture Design & ADR Management TypeScript Type Contract
```typescript
export interface ArchitectureDecisionRecord {
  id: string;
  title: string;
  status: 'draft' | 'proposed' | 'accepted' | 'rejected' | 'deprecated';
  context: string;
  decision: string;
  consequences: {
    positive: string[];
    negative: string[];
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in System Architecture Design & ADR Management
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
