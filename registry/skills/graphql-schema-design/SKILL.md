---
name: graphql-schema-design
description: Production-grade GraphQL Schema Design playbook for scalable type
  systems, DataLoader batching, and Apollo Federation.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🕸️
disable-slash-command: true
---

# GraphQL Schema Architecture, Resolvers & Federation

## Overview & Purpose
The GraphQL Schema Architecture, Resolvers & Federation skill provides a deterministic, battle-tested framework for executing graphql-schema-design processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking graphql-schema-design.
- Auditing, implementing, or standardizing graphql-schema-design procedures.
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
| Specification Document | `docs/graphql-schema-design/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/graphql-schema-design/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/graphql-schema-design/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Schema Domain Modeling & Type Architecture
1. Model business domain as strongly-typed GraphQL schema using Schema Definition Language (SDL).
2. Enforce non-nullable fields (!) strictly on guaranteed domain properties.
3. Implement Relay Cursor Connections specification for all paginated list queries.
4. Structure mutations with dedicated Input and Payload types (CreateOrderInput / CreateOrderPayload).
5. Design domain error reporting via union types (union CreateOrderResult = Order | OrderError).

### Phase 2: Apollo Federation & Subgraph Boundary Design
1. Define federation @key directives for entity identification across subgraphs.
2. Mark shared entity references with @external and @requires directives.
3. Design clean subgraph boundaries matching domain bounded contexts.
4. Compose supergraph schema using Rover CLI to verify federation compatibility.
5. Validate schema against breaking change rules with Apollo Studio / GraphQL Inspector.

### Phase 3: Resolver Implementation & DataLoader Batching
1. Implement type resolvers with clean separation between transport and business services.
2. Implement DataLoader instances to batch and cache database lookups, solving N+1 query problem.
3. Enforce authentication and tenant authorization checks inside resolver context.
4. Set query complexity calculation and depth limits to prevent malicious nested queries.
5. Implement field-level telemetry and tracing headers.

### Phase 4: Schema Validation & Contract Testing
1. Run automated schema linting with graphql-eslint to enforce naming conventions.
2. Execute integration tests executing GraphQL queries against in-memory test database.
3. Verify error handling returns structured error extensions with error codes.
4. Benchmark query execution latency under simulated concurrent requests.
5. Confirm backwards-compatibility of newly introduced fields.

### Phase 5: Client Code Generation & Gateway Deployment
1. Generate TypeScript types and React Apollo hooks using @graphql-codegen/cli.
2. Publish updated subgraph schemas to supergraph gateway.
3. Deploy updated GraphQL service to production cluster.
4. Monitor query performance and error rates in gateway analytics dashboard.
5. Update public GraphQL documentation.

## Code & Configuration Exemplars

### Exemplar 1: GraphQL Schema Architecture, Resolvers & Federation Configuration & Specification
```yaml
type Order @key(fields: "id") {
  id: ID!
  customer: Customer!
  items: [OrderItem!]!
  totalCents: Int!
  status: OrderStatus!
  createdAt: String!
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

type Query {
  order(id: ID!): Order
  orders(first: Int = 20, after: String): OrderConnection!
}
```

### Exemplar 2: GraphQL Schema Architecture, Resolvers & Federation TypeScript Type Contract
```typescript
export interface GraphQLResolverContext {
  userId?: string;
  tenantId: string;
  dataLoaders: {
    userLoader: unknown;
    orderLoader: unknown;
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in GraphQL Schema Architecture, Resolvers & Federation
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
