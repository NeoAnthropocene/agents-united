---
name: backend-api-design
description: Production-grade Backend API Design playbook for RESTful, gRPC, and
  GraphQL enterprise architectures.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/backend-api-design/SKILL.md | do not edit -->

# Backend API Design & Contract Specification

## Overview & Purpose
The Backend API Design & Contract Specification skill provides a deterministic, battle-tested framework for executing backend-api-design processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking backend-api-design.
- Auditing, implementing, or standardizing backend-api-design procedures.
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
| Specification Document | `docs/backend-api-design/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/backend-api-design/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/backend-api-design/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: API Resource & Contract Modeling
1. Model domain resources with standard pluralized URI paths (/api/v2/resources).
2. Select communication protocol: RESTful JSON, gRPC Protobuf, or GraphQL based on payload needs.
3. Define HTTP verb semantics strictly: GET (idempotent/safe), POST (create), PUT (replace), PATCH (partial), DELETE.
4. Establish unified error response schema matching RFC 7807 Problem Details.
5. Design pagination schemas supporting cursor-based and offset-based navigation.

### Phase 2: Schema Validation & Security Hardening
1. Write strict JSON Schema / Zod runtime validation definitions for all input payloads.
2. Enforce Idempotency-Key headers for all non-idempotent financial/state transitions.
3. Configure rate-limiting policies (token bucket algorithm) by authenticated tenant.
4. Implement OAuth2 / JWT bearer token authentication and RBAC scope authorization checks.
5. Sanitize all headers and query parameters against injection attacks.

### Phase 3: Implementation & Middleware Pipeline Assembly
1. Assemble Express / Fastify / Koa middleware pipeline: CORS -> Tracing -> Auth -> BodyParser -> RateLimit.
2. Implement controller handlers with explicit separation between transport and service domains.
3. Implement database transactions with optimistic locking for concurrent updates.
4. Wire up structured JSON logging with CorrelationId injected on every log line.
5. Enforce strict error boundary middleware to prevent uncaught promise rejections.

### Phase 4: Automated Contract Testing & Mock Server Verification
1. Run contract tests validating OpenAPI specification against live responses (Prism/Dredd).
2. Execute end-to-end integration tests using Supertest or Vitest.
3. Verify error code compliance for 400, 401, 403, 404, 409, 422, 429, and 500 scenarios.
4. Benchmark p95 response time under concurrent simulated load.
5. Validate backward-compatibility against previous API versions.

### Phase 5: SDK Generation & Documentation Publication
1. Generate TypeScript / Python client SDKs from OpenAPI definitions via @openapitools/openapi-generator-cli.
2. Publish interactive Swagger / Redoc documentation endpoint.
3. Generate changelog highlighting added fields, deprecated routes, and breaking changes.
4. Commit updated API schemas to version control.
5. Tag production release candidate.

## Code & Configuration Exemplars

### Exemplar 1: Backend API Design & Contract Specification Configuration & Specification
```yaml
openapi: 3.1.0
info:
  title: Enterprise Order Management API
  version: 2.0.0
paths:
  /api/v2/orders:
    post:
      summary: Create idempotent purchase order
      parameters:
        - in: header
          name: Idempotency-Key
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
```

### Exemplar 2: Backend API Design & Contract Specification TypeScript Type Contract
```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata: {
    requestId: string;
    timestamp: string;
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Backend API Design & Contract Specification
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
