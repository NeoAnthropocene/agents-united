---
name: microservices-architecture
description: Production-grade Microservices Architecture playbook for resilient
  distributed systems, event choreography, and observability.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/microservices-architecture/SKILL.md | do not edit -->

# Microservices Architecture, Service Mesh & Distributed Systems

## Overview & Purpose
The Microservices Architecture, Service Mesh & Distributed Systems skill provides a deterministic, battle-tested framework for executing microservices-architecture processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking microservices-architecture.
- Auditing, implementing, or standardizing microservices-architecture procedures.
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
| Specification Document | `docs/microservices-architecture/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/microservices-architecture/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/microservices-architecture/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Bounded Context Decomposition & Service Sizing
1. Apply Domain-Driven Design (DDD) strategic design to partition monolith into bounded contexts.
2. Define service ownership boundaries around independent business capabilities.
3. Ensure microservices own their private datastores to prevent shared-database anti-patterns.
4. Evaluate asynchronous event choreography vs synchronous gRPC orchestration.
5. Establish service dependency graph with zero circular dependencies.

### Phase 2: Resiliency & Fault Tolerance Engineering
1. Implement Circuit Breaker pattern (Cockatiel / Resilience4j) on all inter-service HTTP/gRPC calls.
2. Configure exponential backoff retry policies with jitter to avoid thundering herds.
3. Implement Transactional Outbox Pattern to guarantee atomic database updates and event publishing.
4. Design idempotent event consumers using deduplication tables.
5. Configure bulkhead isolation to prevent failure cascading across services.

### Phase 3: Distributed Tracing & Observability Instrumentation
1. Instrument OpenTelemetry (OTel) distributed tracing across all HTTP, gRPC, and messaging headers.
2. Inject W3C TraceContext headers (traceparent, tracestate) across service boundaries.
3. Expose standardized Prometheus metrics (/metrics): RED metrics (Rate, Errors, Duration).
4. Configure structured JSON logging with uniform fields (trace_id, span_id, service_name).
5. Set up centralized alerting on service latency and error budget consumption.

### Phase 4: Service Mesh & API Gateway Configuration
1. Configure API Gateway (Kong, Envoy, Traefik) for edge routing, SSL termination, and rate limiting.
2. Deploy Istio / Linkerd service mesh for mutual TLS (mTLS) zero-trust service communication.
3. Configure traffic splitting for canary and blue-green zero-downtime deployments.
4. Run chaos engineering experiments (Chaos Mesh) simulating random network latency and pod kills.
5. Validate system self-healing and service mesh rerouting.

### Phase 5: CI/CD Pipeline & Contract Testing Deployment
1. Implement Pact contract testing between consuming and providing services in CI.
2. Configure independent automated deployment pipelines per microservice.
3. Deploy canary release to production environment.
4. Verify distributed trace completion across live traffic.
5. Promote service version to 100% production traffic.

## Code & Configuration Exemplars

### Exemplar 1: Microservices Architecture, Service Mesh & Distributed Systems Configuration & Specification
```yaml
// Outbox message pattern for reliable event publishing
export interface OutboxEvent {
  id: string;
  aggregateType: 'Order';
  aggregateId: string;
  eventType: 'OrderCreated';
  payload: Record<string, unknown>;
  createdAt: Date;
  publishedAt?: Date;
}
```

### Exemplar 2: Microservices Architecture, Service Mesh & Distributed Systems TypeScript Type Contract
```typescript
export interface MicroserviceTopology {
  serviceName: string;
  boundedContext: string;
  communication: 'sync-grpc' | 'async-event';
  circuitBreaker: {
    timeoutMs: number;
    errorThresholdPercentage: number;
    resetTimeoutMs: number;
  };
  observability: {
    distributedTracing: boolean;
    metricsEndpoint: string;
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Microservices Architecture, Service Mesh & Distributed Systems
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
