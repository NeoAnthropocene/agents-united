const fs = require('fs');
const path = require('path');

const skills = [
  {
    name: 'architecture-design',
    title: 'System Architecture Design & ADR Management',
    description: 'Production-grade Architecture Design playbook for microservices, event-driven backends, and C4 domain modeling.',
    codeExemplar1: `title: "ADR-004: Event-Driven Order Processing Architecture"
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
    - Eventual consistency requires asynchronous UI status polling.`,
    codeExemplar2: `export interface ArchitectureDecisionRecord {
  id: string;
  title: string;
  status: 'draft' | 'proposed' | 'accepted' | 'rejected' | 'deprecated';
  context: string;
  decision: string;
  consequences: {
    positive: string[];
    negative: string[];
  };
}`,
    phases: [
      {
        title: 'Phase 1: Domain Decomposition & C4 Model Framing',
        steps: [
          'Deconstruct system requirements into Context, Container, Component, and Code layers.',
          'Define bounded contexts and domain aggregates to prevent leaky domain boundaries.',
          'Chart synchronous vs asynchronous communication channels and latency budgets.',
          'Identify stateful storage requirements and data partitioning strategies.',
          'Draft high-level architecture diagram and component topology.'
        ]
      },
      {
        title: 'Phase 2: Tradeoff Analysis & Non-Functional Requirements (NFRs)',
        steps: [
          'Quantify SLA/SLO requirements: p99 latency (<150ms), availability (99.99%), throughput (10k rps).',
          'Evaluate CAP theorem tradeoffs: Consistency vs Availability during network partitions.',
          'Assess infrastructure cost implications across compute, bandwidth, and managed services.',
          'Perform threat modeling (STRIDE) against network boundaries and data stores.',
          'Document architectural alternatives considered and reasons for rejection.'
        ]
      },
      {
        title: 'Phase 3: ADR Authoring & Interface Contract Definition',
        steps: [
          'Author formal ADR in docs/adr/ADR-XXXX.md following MADR template standards.',
          'Specify OpenAPI / gRPC Protobuf interface contracts for inter-service boundaries.',
          'Define idempotency keys and retry policies for distributed operations.',
          'Define failure domains, circuit breaker thresholds, and fallback degradations.',
          'Submit ADR for peer review by security and system architecture teams.'
        ]
      },
      {
        title: 'Phase 4: Architecture Validation & Prototyping Spike',
        steps: [
          'Build minimal executable spike to validate performance and latency assumptions.',
          'Verify distributed tracing propagation across boundary headers (TraceContext).',
          'Run automated load testing against prototype endpoints using k6 or autocannon.',
          'Validate disaster recovery and failover behavior under simulated node outages.',
          'Review spike results against target SLO metrics.'
        ]
      },
      {
        title: 'Phase 5: Governance & Downstream Implementation Handoff',
        steps: [
          'Publish accepted ADR to repository architecture registry.',
          'Generate service scaffold templates with pre-configured telemetry and lint rules.',
          'Brief backend and infrastructure subagents on architectural constraints.',
          'Create milestone tracking tickets linked directly to ADR acceptance criteria.',
          'Establish quarterly architectural drift review cadence.'
        ]
      }
    ]
  },
  {
    name: 'backend-api-design',
    title: 'Backend API Design & Contract Specification',
    description: 'Production-grade Backend API Design playbook for RESTful, gRPC, and GraphQL enterprise architectures.',
    codeExemplar1: `openapi: 3.1.0
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
              $ref: '#/components/schemas/CreateOrderRequest'`,
    codeExemplar2: `export interface ApiResponse<T> {
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
}`,
    phases: [
      {
        title: 'Phase 1: API Resource & Contract Modeling',
        steps: [
          'Model domain resources with standard pluralized URI paths (/api/v2/resources).',
          'Select communication protocol: RESTful JSON, gRPC Protobuf, or GraphQL based on payload needs.',
          'Define HTTP verb semantics strictly: GET (idempotent/safe), POST (create), PUT (replace), PATCH (partial), DELETE.',
          'Establish unified error response schema matching RFC 7807 Problem Details.',
          'Design pagination schemas supporting cursor-based and offset-based navigation.'
        ]
      },
      {
        title: 'Phase 2: Schema Validation & Security Hardening',
        steps: [
          'Write strict JSON Schema / Zod runtime validation definitions for all input payloads.',
          'Enforce Idempotency-Key headers for all non-idempotent financial/state transitions.',
          'Configure rate-limiting policies (token bucket algorithm) by authenticated tenant.',
          'Implement OAuth2 / JWT bearer token authentication and RBAC scope authorization checks.',
          'Sanitize all headers and query parameters against injection attacks.'
        ]
      },
      {
        title: 'Phase 3: Implementation & Middleware Pipeline Assembly',
        steps: [
          'Assemble Express / Fastify / Koa middleware pipeline: CORS -> Tracing -> Auth -> BodyParser -> RateLimit.',
          'Implement controller handlers with explicit separation between transport and service domains.',
          'Implement database transactions with optimistic locking for concurrent updates.',
          'Wire up structured JSON logging with CorrelationId injected on every log line.',
          'Enforce strict error boundary middleware to prevent uncaught promise rejections.'
        ]
      },
      {
        title: 'Phase 4: Automated Contract Testing & Mock Server Verification',
        steps: [
          'Run contract tests validating OpenAPI specification against live responses (Prism/Dredd).',
          'Execute end-to-end integration tests using Supertest or Vitest.',
          'Verify error code compliance for 400, 401, 403, 404, 409, 422, 429, and 500 scenarios.',
          'Benchmark p95 response time under concurrent simulated load.',
          'Validate backward-compatibility against previous API versions.'
        ]
      },
      {
        title: 'Phase 5: SDK Generation & Documentation Publication',
        steps: [
          'Generate TypeScript / Python client SDKs from OpenAPI definitions via @openapitools/openapi-generator-cli.',
          'Publish interactive Swagger / Redoc documentation endpoint.',
          'Generate changelog highlighting added fields, deprecated routes, and breaking changes.',
          'Commit updated API schemas to version control.',
          'Tag production release candidate.'
        ]
      }
    ]
  },
  {
    name: 'code-refactoring',
    title: 'Systematic Code Refactoring & Tech Debt Remediation',
    description: 'Production-grade Code Refactoring playbook for safely modernizing legacy codebases with zero regressions.',
    codeExemplar1: `// Before: Nested callback anti-pattern with mutation
// After: Pure pipeline with immutable transformations
export function processTransactions(txs: readonly Transaction[]): TransactionReport {
  return txs
    .filter(isValidTransaction)
    .map(normalizeCurrency)
    .reduce(aggregateTotals, initialReport);
}`,
    codeExemplar2: `export interface RefactorPlan {
  targetModule: string;
  codeSmell: 'long-method' | 'god-class' | 'feature-envy' | 'duplicate-logic' | 'primitive-obsession';
  testCoverageBefore: number;
  safetyChecklist: {
    unitTestsPassing: boolean;
    typesEnforced: boolean;
    behaviorPreserved: boolean;
  };
}`,
    phases: [
      {
        title: 'Phase 1: Code Smell Detection & Dependency Mapping',
        steps: [
          'Identify refactoring targets using static analysis: Cyclomatic complexity > 15, file length > 500 lines.',
          'Classify code smells: God objects, shotgun surgery, deep nesting, duplicate logic, primitive obsession.',
          'Map caller graph and downstream consumer dependencies using AST analysis / grep.',
          'Verify existing automated test suite coverage on the target module before touching code.',
          'If coverage is < 80%, author characterization tests to capture current behavior first.'
        ]
      },
      {
        title: 'Phase 2: Refactoring Strategy & Safety Boundary Formulation',
        steps: [
          'Select appropriate Martin Fowler refactoring patterns: Extract Method, Replace Conditional with Polymorphism, Introduce Parameter Object.',
          'Establish the Strangler Fig pattern for large-scale module replacements.',
          'Define clear interface boundaries to encapsulate internal structural changes.',
          'Ensure all operations maintain immutability and eliminate global mutable state.',
          'Create dedicated refactoring branch in git.'
        ]
      },
      {
        title: 'Phase 3: Incremental Micro-Refactoring Execution',
        steps: [
          'Perform micro-transformations in tiny, atomic commits (one refactoring step per commit).',
          'Extract nested helper functions and replace magic strings/numbers with typed enums/constants.',
          'Migrate imperative loops to declarative, strongly-typed pipeline operations.',
          'Inject dependencies explicitly to eliminate hidden hardcoded singleton coupling.',
          'Run unit test suite immediately after each micro-refactor.'
        ]
      },
      {
        title: 'Phase 4: Regression Testing & Performance Benchmark Validation',
        steps: [
          'Run complete test suite (npm test) and typechecker (npm run typecheck).',
          'Run regression benchmark to verify memory allocation and CPU cycles have not degraded.',
          'Perform static linting to ensure no dead code or unreferenced imports remain.',
          'Inspect git diff to confirm only structural refactorings occurred with zero accidental logic shifts.',
          'Verify 100% test pass rate.'
        ]
      },
      {
        title: 'Phase 5: Code Review & Documentation Sync',
        steps: [
          'Document architectural improvements in pull request summary.',
          'Update internal JSDoc comments and module architecture diagrams.',
          'Squash intermediate commits into logical, readable conventional commits.',
          'Merge refactored branch to main.',
          'Monitor application telemetry for regression anomalies.'
        ]
      }
    ]
  },
  {
    name: 'database-design',
    title: 'Relational & NoSQL Database Schema Design',
    description: 'Production-grade Database Design playbook for high-throughput transactional schemas, indexing, and migrations.',
    codeExemplar1: `CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id),
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_tenant_status_created ON orders (tenant_id, status, created_at DESC);`,
    codeExemplar2: `export interface MigrationStep {
  version: number;
  name: string;
  up: string;
  down: string;
  transactional: boolean;
  reversible: boolean;
}`,
    phases: [
      {
        title: 'Phase 1: Entity-Relationship Modeling & Normalization',
        steps: [
          'Map business entities, cardinality (1:1, 1:N, N:M), and ownership relationships.',
          'Normalize relational schema to Third Normal Form (3NF) to eliminate data redundancy.',
          'Identify strategic denormalization opportunities for read-heavy query paths.',
          'Choose appropriate primary key strategy: UUIDv7 / ULID (distributed) vs BIGINT IDENTITY.',
          'Design foreign key constraints with explicit ON DELETE RESTRICT / CASCADE policies.'
        ]
      },
      {
        title: 'Phase 2: Index Strategy & Partitioning Architecture',
        steps: [
          'Analyze query access patterns (filter predicates, join columns, order-by clauses).',
          'Design composite B-tree indexes following Equality-Range-Sort (ESR) rule.',
          "Implement partial/filtered indexes for status flags (WHERE status = 'active').",
          'Configure range/hash partitioning on high-volume tables (>10M rows per month).',
          'Audit index overhead against write-amplification tradeoffs.'
        ]
      },
      {
        title: 'Phase 3: Migration Script Authoring & Versioning',
        steps: [
          'Write deterministic, bidirectional migration scripts (up.sql and down.sql).',
          'Wrap DDL operations in atomic transactions where supported by database engine.',
          'Use lock-free DDL patterns (e.g. CREATE INDEX CONCURRENTLY in PostgreSQL).',
          'Ensure zero-downtime expand-and-contract pattern for schema column renames/drops.',
          'Test migration rollback (down) in isolated staging environment.'
        ]
      },
      {
        title: 'Phase 4: Query Optimization & EXPLAIN ANALYZE Verification',
        steps: [
          'Execute EXPLAIN (ANALYZE, BUFFERS) on critical path database queries.',
          'Verify elimination of sequential table scans on multi-million row datasets.',
          'Verify connection pool sizing (HikariCP/pgpool) against database max connections.',
          'Set statement timeouts to prevent long-running runaway transactions.',
          'Audit query memory consumption during batch processing.'
        ]
      },
      {
        title: 'Phase 5: Data Integrity & Backup Validation',
        steps: [
          'Define database checkpointing and Point-In-Time-Recovery (PITR) policies.',
          'Implement automated data corruption and constraint integrity checks.',
          'Update ORM entity schema mappings (Prisma, TypeORM, Drizzle) and generate typings.',
          'Commit schema migrations to version control.',
          'Deploy migrations to production database cluster.'
        ]
      }
    ]
  },
  {
    name: 'dependency-management',
    title: 'Dependency Management, Vulnerability Auditing & Upgrades',
    description: 'Production-grade Dependency Management playbook for secure supply-chain integrity, semver updates, and lockfile hygiene.',
    codeExemplar1: `// package.json engine and package overrides
{
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=10.0.0"
  },
  "overrides": {
    "glob": "^11.0.0"
  }
}`,
    codeExemplar2: `export interface DependencyAuditResult {
  vulnerabilities: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  outdatedPackages: Array<{
    name: string;
    current: string;
    wanted: string;
    latest: string;
    breaking: boolean;
  }>;
}`,
    phases: [
      {
        title: 'Phase 1: Dependency Supply-Chain Audit',
        steps: [
          'Scan dependency tree for known CVEs using npm audit and Snyk/OSV scanners.',
          'Identify deprecated packages and unmaintained upstream repositories (>2 years inactive).',
          'Check for license compliance (MIT, Apache-2.0, BSD vs restrictive AGPL).',
          'Review direct vs transitive dependency graph depth and duplicate package instances.',
          'Generate dependency inventory report.'
        ]
      },
      {
        title: 'Phase 2: Outdated Package Assessment & Semver Planning',
        steps: [
          'Run npm outdated to list all packages with patch, minor, or major updates available.',
          'Categorize updates: Patch (bug fixes), Minor (features), Major (breaking changes).',
          'Review changelogs and GitHub release notes for breaking API changes and migration guides.',
          'Formulate staged upgrade batching plan (upgrade utility libs first, core frameworks last).',
          'Ensure isolated git branch for dependency updates.'
        ]
      },
      {
        title: 'Phase 3: Staged Upgrade & Lockfile Synchronization',
        steps: [
          'Execute atomic upgrades per package or group using npm install package@version.',
          'Verify package lockfile integrity (package-lock.json or pnpm-lock.yaml).',
          'Apply package overrides / resolutions for transitive security vulnerabilities where needed.',
          'Prune orphan packages using npm prune.',
          'Verify lockfile is strictly deterministic with reproducible builds.'
        ]
      },
      {
        title: 'Phase 4: Full Automated Regression Verification',
        steps: [
          'Run complete TypeScript typecheck (npm run typecheck) to detect API signature breaks.',
          'Run full unit and integration test suite (npm test).',
          'Execute production build (npm run build) and inspect output bundle size delta.',
          'Run end-to-end smoke tests against compiled distribution assets.',
          'Confirm zero build warnings or runtime deprecation notices.'
        ]
      },
      {
        title: 'Phase 5: Release Notes & CI Pipeline Enforcement',
        steps: [
          'Document upgraded package versions and security fixes in commit message.',
          'Configure Dependabot / Renovate automation rules for continuous dependency maintenance.',
          'Enforce CI check rejecting PRs with high/critical security vulnerabilities.',
          'Commit lockfile and package manifest changes.',
          'Merge dependency update pull request.'
        ]
      }
    ]
  },
  {
    name: 'docker-deployment',
    title: 'Containerization, Dockerfile Hardening & Multi-Stage Deployment',
    description: 'Production-grade Docker Deployment playbook for minimal footprint, rootless execution, and multi-stage builds.',
    codeExemplar1: `# Multi-stage hardened Dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]`,
    codeExemplar2: `export interface ContainerSpec {
  imageName: string;
  tag: string;
  baseImage: string;
  multiStage: boolean;
  nonRootUser: boolean;
  exposedPorts: number[];
  healthCheckEndpoint: string;
}`,
    phases: [
      {
        title: 'Phase 1: Application Workload & Architecture Profiling',
        steps: [
          'Analyze application runtime requirements: Node.js version, native C++ bindings, static assets.',
          'Define required environment variables, secret mounts, and volume persistent storage paths.',
          'Establish container memory limits, CPU quotas, and networking port requirements.',
          'Select minimal base image: node:24-alpine or distroless/nodejs24-debian12.',
          'Draft containerization strategy document.'
        ]
      },
      {
        title: 'Phase 2: Multi-Stage Dockerfile Construction & Hardening',
        steps: [
          'Structure multi-stage build separating compile dependencies from final production runtime.',
          'Optimize Docker layer caching: copy package*.json and run npm ci before copying source code.',
          'Implement non-root user execution (USER appuser) to prevent container breakout exploits.',
          'Add .dockerignore file excluding .git, node_modules, .env, and test artifacts.',
          'Configure explicit HEALTHCHECK directive testing HTTP endpoint readiness.'
        ]
      },
      {
        title: 'Phase 3: Image Build, Linting & Vulnerability Scanning',
        steps: [
          'Lint Dockerfile using Hadolint to catch syntax and security anti-patterns.',
          'Build container image: docker build -t app:latest .',
          'Scan image for CVEs using Trivy / Docker Scout: trivy image app:latest.',
          'Assert zero critical or high vulnerabilities in base OS and application packages.',
          'Verify final image size is minimal (<150MB for Node.js workloads).'
        ]
      },
      {
        title: 'Phase 4: Local Container Testing & Compose Verification',
        steps: [
          'Launch container in isolated bridge network using docker run or docker compose up.',
          'Execute HTTP smoke tests against healthcheck and API endpoints.',
          'Verify graceful shutdown handling on SIGTERM and SIGINT signals.',
          'Inspect container stdout/stderr logs to ensure structured JSON output formatting.',
          'Confirm volume mount persistence across container restarts.'
        ]
      },
      {
        title: 'Phase 5: Registry Publishing & Orchestrator Deployment',
        steps: [
          'Tag image with semantic version and git commit SHA: app:v2.0.0-sha123.',
          'Push image to container registry (ECR, GCR, Docker Hub) over TLS.',
          'Update Kubernetes deployment manifests / ECS task definitions with immutable image digest.',
          'Execute rolling deployment with automated rollback on healthcheck failure.',
          'Verify production workload stability.'
        ]
      }
    ]
  },
  {
    name: 'finishing-a-development-branch',
    title: 'Development Branch Finalization, Cleanup & PR Readiness',
    description: 'Production-grade Branch Finalization playbook for clean git history, squash hygiene, and automated release validation.',
    codeExemplar1: `# Interactive rebase against main branch
git fetch origin main
git rebase -i origin/main
# Ensure all commits follow Conventional Commits standard:
# feat(scope): add feature description
# fix(scope): resolve issue description`,
    codeExemplar2: `export interface BranchChecklist {
  branchName: string;
  isRebasedOnMain: boolean;
  cleanWorkingTree: boolean;
  testsPassing: boolean;
  typecheckPassing: boolean;
  buildPassing: boolean;
  conventionalCommits: boolean;
}`,
    phases: [
      {
        title: 'Phase 1: Working Tree Audit & Temporary File Cleanup',
        steps: [
          'Check git working directory status: git status --short.',
          'Remove temporary debug files, scratch scripts, and editor artifacts.',
          'Search for stray console.log, debugger, and unresolved TODO statements.',
          'Verify no sensitive secrets, API keys, or .env files are tracked in git.',
          'Ensure all modified files are properly staged.'
        ]
      },
      {
        title: 'Phase 2: Synchronization & Rebase against Target Branch',
        steps: [
          'Fetch latest changes from upstream remote: git fetch origin main.',
          'Rebase development branch onto latest main: git rebase origin/main.',
          'Resolve any merge conflicts cleanly, validating code logic after each resolved chunk.',
          'Run interactive rebase (git rebase -i) to squash messy WIP and fixup commits.',
          'Ensure all commit messages adhere to Conventional Commits specification.'
        ]
      },
      {
        title: 'Phase 3: Verification & Quality Gate Execution',
        steps: [
          'Run complete TypeScript typecheck: npm run typecheck.',
          'Execute full test suite: npm test.',
          'Execute production build: npm run build.',
          'Execute workspace doctor check: node dist/cli.js doctor.',
          'Confirm 100% test pass rate with zero lint or build errors.'
        ]
      },
      {
        title: 'Phase 4: Pull Request Description & Documentation Assembly',
        steps: [
          'Generate structured PR description covering Summary, Motivation, Changes, and Testing.',
          'Attach visual evidence (before/after screenshots or terminal recordings) for UI/CLI changes.',
          'Link related issue tickets and architecture decision records.',
          'Update project README and documentation files if features or flags were modified.',
          'Verify CI workflow requirements and reviewer assignments.'
        ]
      },
      {
        title: 'Phase 5: Push & PR Submission',
        steps: [
          'Push clean rebased branch to remote repository: git push -u origin branch-name --force-with-lease.',
          'Open Pull Request on GitHub / GitLab.',
          'Verify all automated GitHub Actions CI checks pass green.',
          'Request code review from designated subagents or human maintainers.',
          'Prepare for automated merge upon approval.'
        ]
      }
    ]
  },
  {
    name: 'frontend-component-design',
    title: 'Frontend Component Architecture, Accessibility & Storybook Playgrounds',
    description: 'Production-grade Frontend Component Design playbook for reusable, accessible UI primitives in React, Vue, and Web Components.',
    codeExemplar1: `import React, { forwardRef } from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || isLoading}
    className={clsx('ui-button', \`ui-button--\${variant}\`, \`ui-button--\${size}\`, className)}
    aria-busy={isLoading}
    {...props}
  >
    {isLoading ? <span className="ui-spinner" aria-hidden="true" /> : children}
  </button>
));`,
    codeExemplar2: `export interface ComponentSpecification {
  name: string;
  variants: string[];
  sizes: string[];
  interactiveStates: ['default', 'hover', 'focus-visible', 'active', 'disabled', 'loading'];
  ariaRoles: string[];
  keyboardInteractions: Record<string, string>;
}`,
    phases: [
      {
        title: 'Phase 1: Component API Design & Props Interface',
        steps: [
          'Define component prop types in TypeScript with strict discrimination unions.',
          'Establish single responsibility: separate layout containers from atomic UI primitives.',
          'Support composability via asChild / slot patterns or polymorphic as props.',
          'Ensure standard HTML attribute passthrough and forwardRef propagation.',
          'Avoid boolean prop explosion by using typed union variants (variant="primary").'
        ]
      },
      {
        title: 'Phase 2: Accessibility & Keyboard Navigation Specification',
        steps: [
          'Assign appropriate WAI-ARIA roles, states, and properties (aria-expanded, aria-controls).',
          'Implement complete keyboard interaction models according to W3C APG guidelines.',
          'Ensure explicit, high-contrast :focus-visible styling on all interactive elements.',
          'Manage focus trapping and restoration for modal dialogs and flyout menus.',
          'Verify screen reader announcements for dynamic state transitions.'
        ]
      },
      {
        title: 'Phase 3: Styling & Design Token Integration',
        steps: [
          'Bind component styles strictly to semantic design tokens (var(--color-brand-primary)).',
          'Ensure zero hardcoded magic numbers or hex colors in stylesheet.',
          'Implement fluid responsiveness using CSS container queries and clamp().',
          'Provide seamless dark/light theme adaptation via CSS custom property overrides.',
          'Enforce prefers-reduced-motion fallbacks for all transitions and micro-animations.'
        ]
      },
      {
        title: 'Phase 4: Storybook Documentation & Interactive Playground',
        steps: [
          'Create Storybook CSF3 story file with interactive Controls (argTypes).',
          'Author stories covering all variants, sizes, edge-case text lengths, and error states.',
          'Write accessibility regression tests using @storybook/addon-a11y.',
          'Include MDX documentation with copy-paste code snippets and UX usage guidelines.',
          'Validate visual regression snapshots.'
        ]
      },
      {
        title: 'Phase 5: Automated Testing & Packaging',
        steps: [
          'Author unit tests with Testing Library verifying rendering, user events, and accessibility.',
          'Verify zero console errors or hydration mismatch warnings.',
          'Export component from package entrypoint index.',
          'Run typecheck and build validation.',
          'Publish component to shared internal UI library.'
        ]
      }
    ]
  },
  {
    name: 'graphql-schema-design',
    title: 'GraphQL Schema Architecture, Resolvers & Federation',
    description: 'Production-grade GraphQL Schema Design playbook for scalable type systems, DataLoader batching, and Apollo Federation.',
    codeExemplar1: `type Order @key(fields: "id") {
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
}`,
    codeExemplar2: `export interface GraphQLResolverContext {
  userId?: string;
  tenantId: string;
  dataLoaders: {
    userLoader: unknown;
    orderLoader: unknown;
  };
}`,
    phases: [
      {
        title: 'Phase 1: Schema Domain Modeling & Type Architecture',
        steps: [
          'Model business domain as strongly-typed GraphQL schema using Schema Definition Language (SDL).',
          'Enforce non-nullable fields (!) strictly on guaranteed domain properties.',
          'Implement Relay Cursor Connections specification for all paginated list queries.',
          'Structure mutations with dedicated Input and Payload types (CreateOrderInput / CreateOrderPayload).',
          'Design domain error reporting via union types (union CreateOrderResult = Order | OrderError).'
        ]
      },
      {
        title: 'Phase 2: Apollo Federation & Subgraph Boundary Design',
        steps: [
          'Define federation @key directives for entity identification across subgraphs.',
          'Mark shared entity references with @external and @requires directives.',
          'Design clean subgraph boundaries matching domain bounded contexts.',
          'Compose supergraph schema using Rover CLI to verify federation compatibility.',
          'Validate schema against breaking change rules with Apollo Studio / GraphQL Inspector.'
        ]
      },
      {
        title: 'Phase 3: Resolver Implementation & DataLoader Batching',
        steps: [
          'Implement type resolvers with clean separation between transport and business services.',
          'Implement DataLoader instances to batch and cache database lookups, solving N+1 query problem.',
          'Enforce authentication and tenant authorization checks inside resolver context.',
          'Set query complexity calculation and depth limits to prevent malicious nested queries.',
          'Implement field-level telemetry and tracing headers.'
        ]
      },
      {
        title: 'Phase 4: Schema Validation & Contract Testing',
        steps: [
          'Run automated schema linting with graphql-eslint to enforce naming conventions.',
          'Execute integration tests executing GraphQL queries against in-memory test database.',
          'Verify error handling returns structured error extensions with error codes.',
          'Benchmark query execution latency under simulated concurrent requests.',
          'Confirm backwards-compatibility of newly introduced fields.'
        ]
      },
      {
        title: 'Phase 5: Client Code Generation & Gateway Deployment',
        steps: [
          'Generate TypeScript types and React Apollo hooks using @graphql-codegen/cli.',
          'Publish updated subgraph schemas to supergraph gateway.',
          'Deploy updated GraphQL service to production cluster.',
          'Monitor query performance and error rates in gateway analytics dashboard.',
          'Update public GraphQL documentation.'
        ]
      }
    ]
  },
  {
    name: 'microservices-architecture',
    title: 'Microservices Architecture, Service Mesh & Distributed Systems',
    description: 'Production-grade Microservices Architecture playbook for resilient distributed systems, event choreography, and observability.',
    codeExemplar1: `// Outbox message pattern for reliable event publishing
export interface OutboxEvent {
  id: string;
  aggregateType: 'Order';
  aggregateId: string;
  eventType: 'OrderCreated';
  payload: Record<string, unknown>;
  createdAt: Date;
  publishedAt?: Date;
}`,
    codeExemplar2: `export interface MicroserviceTopology {
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
}`,
    phases: [
      {
        title: 'Phase 1: Bounded Context Decomposition & Service Sizing',
        steps: [
          'Apply Domain-Driven Design (DDD) strategic design to partition monolith into bounded contexts.',
          'Define service ownership boundaries around independent business capabilities.',
          'Ensure microservices own their private datastores to prevent shared-database anti-patterns.',
          'Evaluate asynchronous event choreography vs synchronous gRPC orchestration.',
          'Establish service dependency graph with zero circular dependencies.'
        ]
      },
      {
        title: 'Phase 2: Resiliency & Fault Tolerance Engineering',
        steps: [
          'Implement Circuit Breaker pattern (Cockatiel / Resilience4j) on all inter-service HTTP/gRPC calls.',
          'Configure exponential backoff retry policies with jitter to avoid thundering herds.',
          'Implement Transactional Outbox Pattern to guarantee atomic database updates and event publishing.',
          'Design idempotent event consumers using deduplication tables.',
          'Configure bulkhead isolation to prevent failure cascading across services.'
        ]
      },
      {
        title: 'Phase 3: Distributed Tracing & Observability Instrumentation',
        steps: [
          'Instrument OpenTelemetry (OTel) distributed tracing across all HTTP, gRPC, and messaging headers.',
          'Inject W3C TraceContext headers (traceparent, tracestate) across service boundaries.',
          'Expose standardized Prometheus metrics (/metrics): RED metrics (Rate, Errors, Duration).',
          'Configure structured JSON logging with uniform fields (trace_id, span_id, service_name).',
          'Set up centralized alerting on service latency and error budget consumption.'
        ]
      },
      {
        title: 'Phase 4: Service Mesh & API Gateway Configuration',
        steps: [
          'Configure API Gateway (Kong, Envoy, Traefik) for edge routing, SSL termination, and rate limiting.',
          'Deploy Istio / Linkerd service mesh for mutual TLS (mTLS) zero-trust service communication.',
          'Configure traffic splitting for canary and blue-green zero-downtime deployments.',
          'Run chaos engineering experiments (Chaos Mesh) simulating random network latency and pod kills.',
          'Validate system self-healing and service mesh rerouting.'
        ]
      },
      {
        title: 'Phase 5: CI/CD Pipeline & Contract Testing Deployment',
        steps: [
          'Implement Pact contract testing between consuming and providing services in CI.',
          'Configure independent automated deployment pipelines per microservice.',
          'Deploy canary release to production environment.',
          'Verify distributed trace completion across live traffic.',
          'Promote service version to 100% production traffic.'
        ]
      }
    ]
  },
  {
    name: 'performance-optimization',
    title: 'Full-Stack Performance Profiling & Latency Optimization',
    description: 'Production-grade Performance Optimization playbook for Core Web Vitals, Node.js event-loop tuning, and caching layers.',
    codeExemplar1: `// Redis tiered caching with stale-while-revalidate pattern
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;
  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}`,
    codeExemplar2: `export interface PerformanceBudgets {
  coreWebVitals: {
    lcpMs: number; // < 2500ms
    inpMs: number; // < 200ms
    cls: number;   // < 0.1
  };
  backendSLO: {
    p95LatencyMs: number; // < 100ms
    p99LatencyMs: number; // < 250ms
  };
  bundleSizeKb: number;   // < 200kb gzipped
}`,
    phases: [
      {
        title: 'Phase 1: Baseline Measurement & Bottleneck Profiling',
        steps: [
          'Establish rigorous baseline metrics before applying any optimizations (never guess).',
          'Profile frontend Core Web Vitals using Chrome DevTools, Lighthouse, and Web Vitals SDK.',
          'Profile backend Node.js workloads using Clinic.js (clinic doctor, clinic flame).',
          'Profile database query execution times and identify N+1 queries and full table scans.',
          'Document top 5 performance bottlenecks ranked by latency impact.'
        ]
      },
      {
        title: 'Phase 2: Frontend Asset & Rendering Optimization',
        steps: [
          'Optimize Largest Contentful Paint (LCP): inline critical CSS, preload hero image with fetchpriority="high".',
          'Eliminate Cumulative Layout Shift (CLS): reserve explicit dimensions on images and dynamic embeds.',
          'Optimize Interaction to Next Paint (INP): break long tasks (>50ms) using scheduler.yield().',
          'Implement route-based dynamic code splitting (React.lazy, dynamic import()).',
          'Compress images using modern AVIF / WebP formats and responsive srcset.'
        ]
      },
      {
        title: 'Phase 3: Backend Concurrency & Event Loop Optimization',
        steps: [
          'Eliminate synchronous blocking CPU operations in the Node.js main thread (offload to Worker Threads).',
          'Implement DataLoader batching for database queries to collapse N+1 queries into single IN (...) queries.',
          'Enable HTTP/2 and gzip/brotli compression on web server responses.',
          'Tune Node.js garbage collection parameters (--max-old-space-size, --v8-pool-size).',
          'Optimize memory allocations and eliminate object creation inside tight loops.'
        ]
      },
      {
        title: 'Phase 4: Multi-Tier Caching Architecture',
        steps: [
          'Configure HTTP Cache-Control headers: public, max-age=31536000, immutable for hashed assets.',
          'Implement Redis caching layer for expensive database queries with TTL and cache invalidation hooks.',
          'Deploy Edge CDN caching (Cloudflare / Fastly) with stale-while-revalidate policies.',
          'Implement browser local storage / IndexedDB caching for static client state.',
          'Verify cache hit ratio exceeds 90% under production-like traffic.'
        ]
      },
      {
        title: 'Phase 5: Benchmark Verification & Budget Enforcement',
        steps: [
          'Re-run automated Lighthouse and Clinic.js profiling against optimized code.',
          'Verify Core Web Vitals meet target thresholds: LCP < 2.5s, INP < 200ms, CLS < 0.1.',
          'Verify backend p99 latency meets target SLA.',
          'Configure bundle size limits in CI using bundlesize / size-limit.',
          'Publish performance benchmark comparison report.'
        ]
      }
    ]
  },
  {
    name: 'receiving-code-review',
    title: 'Receiving Code Review Feedback & Constructive Revision',
    description: 'Production-grade Receiving Code Review playbook for processing feedback, addressing revisions, and maintaining codebase standards.',
    codeExemplar1: `// Code review revision workflow
// 1. Acknowledge comment and clarify intent
// 2. Apply requested changes with targeted test coverage
// 3. Reply with commit SHA and re-request review`,
    codeExemplar2: `export interface ReviewFeedbackItem {
  id: string;
  reviewer: string;
  file: string;
  line: number;
  category: 'security' | 'correctness' | 'performance' | 'style' | 'question';
  status: 'pending' | 'addressed' | 'clarification-needed' | 'wont-fix';
  resolutionCommitSha?: string;
}`,
    phases: [
      {
        title: 'Phase 1: Feedback Ingestion & Categorization',
        steps: [
          'Read all pull request review comments completely before writing any code.',
          'Categorize feedback items: Security blockers, correctness issues, performance concerns, stylistic suggestions.',
          'Separate objective bugs and standard violations from subjective design preferences.',
          'Adopt an egoless mindset: focus on code quality, user impact, and team collective ownership.',
          'Create a checklist of actionable changes from review comments.'
        ]
      },
      {
        title: 'Phase 2: Clarification & Constructive Discussion',
        steps: [
          'If a comment is ambiguous, ask specific clarifying questions with proposed alternatives.',
          'If proposing an alternative approach, provide data, benchmarks, or documentation citations.',
          'Keep technical discussions focused on tradeoffs, constraints, and architecture standards.',
          'Reach clear consensus on contentious points before implementing complex refactors.',
          'Document agreed-upon resolution on the PR thread.'
        ]
      },
      {
        title: 'Phase 3: Targeted Implementation & Test Coverage',
        steps: [
          'Implement requested changes incrementally in clean, focused commits.',
          'Write or update automated tests that verify the requested behavior and prevent regression.',
          'Run full local verification: npm run typecheck && npm test && npm run build.',
          'Verify that addressing one comment did not inadvertently break unrelated modules.',
          'Confirm all automated CI tests pass.'
        ]
      },
      {
        title: 'Phase 4: Thread Resolution & Reviewer Notification',
        steps: [
          'Reply to each PR comment thread with a concise summary and reference to the commit SHA.',
          'Mark resolved conversation threads on GitHub / GitLab.',
          'If a suggestion was intentionally omitted, explain the technical rationale respectfully.',
          'Push updated commits to the PR branch.',
          'Re-request review from original reviewers.'
        ]
      },
      {
        title: 'Phase 5: Approval Verification & Merge Finalization',
        steps: [
          'Verify all required reviewer approvals are received.',
          'Ensure branch is up-to-date with base branch without conflicts.',
          'Squash and merge pull request following repository commit conventions.',
          'Delete merged feature branch from remote.',
          'Verify deployment pipeline completes successfully.'
        ]
      }
    ]
  },
  {
    name: 'requesting-code-review',
    title: 'Requesting Code Review & Authoring High-Context Pull Requests',
    description: 'Production-grade Requesting Code Review playbook for authoring high-context PRs, reviewer routing, and accelerating velocity.',
    codeExemplar1: `## Summary of Changes
- Implemented idempotent payment checkout flow using Stripe Webhooks.
- Added transactional outbox pattern to prevent double-charging on network timeout.
- Added comprehensive unit and integration tests with 94% code coverage.

## Verification
\`\`\`bash
npm run typecheck && npm test
\`\`\`
- [x] All 28 automated tests passing.
- [x] Tested against Stripe test environment.`,
    codeExemplar2: `export interface PullRequestMetadata {
  title: string;
  description: string;
  type: 'feat' | 'fix' | 'refactor' | 'perf' | 'docs';
  scope: string;
  breakingChanges: boolean;
  issueReferences: string[];
  reviewers: string[];
}`,
    phases: [
      {
        title: 'Phase 1: Pre-Submission Self-Review & Diff Scrutiny',
        steps: [
          'Perform a thorough self-review of your own pull request diff on GitHub / CLI before requesting peers.',
          'Check for leftover debug logs (console.log), temporary test files, or commented-out code.',
          'Ensure the diff size is manageable (< 400 lines modified) to facilitate thorough review.',
          'Split oversized PRs into smaller, sequential, independently-testable PRs if necessary.',
          'Verify clean branch rebase on latest main.'
        ]
      },
      {
        title: 'Phase 2: High-Context PR Description Authoring',
        steps: [
          'Write concise, informative PR title following Conventional Commits (feat(auth): add OAuth2 refresh token flow).',
          'Document Motivation: Why is this change necessary? Link relevant issue tickets.',
          'Document Approach: How was the problem solved? What architectural decisions were made?',
          'Document Tradeoffs: What alternatives were evaluated and why were they not chosen?',
          'Attach visual proof (screenshots, animated GIFs, or terminal logs) demonstrating functionality.'
        ]
      },
      {
        title: 'Phase 3: Verification Instructions & Test Evidence',
        steps: [
          'Provide clear, copy-pasteable terminal commands for reviewers to verify the changes locally.',
          'Document manual test steps and environment prerequisites.',
          'Include test execution results and code coverage metrics in PR description.',
          'Highlight any database migrations or environment variable changes required.',
          'Confirm all automated CI checks are passing green.'
        ]
      },
      {
        title: 'Phase 4: Reviewer Routing & Context Briefing',
        steps: [
          'Assign code owners and subject-matter experts based on modified file paths (CODEOWNERS).',
          'Add inline comments on complex or non-obvious algorithms explaining the rationale.',
          'Tag security or architecture specialists if sensitive boundaries were touched.',
          'Ping assigned reviewers in team chat with a one-sentence summary and urgency level.',
          'Monitor PR for incoming comments.'
        ]
      },
      {
        title: 'Phase 5: Review Coordination & Handoff',
        steps: [
          'Respond promptly to incoming reviewer questions and feedback.',
          'Keep PR branch updated with main during extended review cycles.',
          'Coordinate final sign-off once all review requirements are satisfied.',
          'Merge PR according to repository merge strategy (Squash and Merge).',
          'Confirm deployment in staging / production.'
        ]
      }
    ]
  },
  {
    name: 'security-audit',
    title: 'Application Security Audit, Threat Modeling & OWASP Top 10',
    description: 'Production-grade Security Audit playbook for vulnerability assessment, SAST scanning, and zero-trust verification.',
    codeExemplar1: `// Path traversal prevention exemplar
import path from 'node:path';

export function resolveSafePath(baseDir: string, userInput: string): string {
  const safePath = path.normalize(path.join(baseDir, userInput));
  if (!safePath.startsWith(path.resolve(baseDir))) {
    throw new Error('SecurityException: Path traversal attempt detected');
  }
  return safePath;
}`,
    codeExemplar2: `export interface SecurityAuditReport {
  timestamp: string;
  scope: string;
  owaspCompliance: Record<string, 'PASS' | 'FAIL' | 'NOT_APPLICABLE'>;
  vulnerabilities: Array<{
    cwe: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    location: string;
    description: string;
    remediation: string;
  }>;
}`,
    phases: [
      {
        title: 'Phase 1: Threat Modeling & Attack Surface Enumeration',
        steps: [
          'Map complete application attack surface: public endpoints, input parameters, headers, file uploads.',
          'Apply STRIDE threat modeling (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege).',
          'Identify high-risk assets: PII data, authentication credentials, payment flows, internal admin tools.',
          'Review trust boundaries between client, gateway, microservices, and third-party APIs.',
          'Establish security audit scope and rules of engagement.'
        ]
      },
      {
        title: 'Phase 2: OWASP Top 10 Vulnerability Assessment',
        steps: [
          'A01 Broken Access Control: Audit authorization checks on all ID-based resource queries (prevent IDOR).',
          'A02 Cryptographic Failures: Verify TLS 1.3 enforcement, strong hashing (Argon2id / bcrypt), and secret management.',
          'A03 Injection: Verify parameterized SQL queries (no string concatenation) and command execution sanitization.',
          'A04 Insecure Design: Audit business logic workflows for race conditions and rate-limiting enforcement.',
          'A05 Security Misconfiguration: Check CORS policies, security headers (CSP, HSTS, X-Frame-Options), and default credentials.'
        ]
      },
      {
        title: 'Phase 3: Automated SAST & Secret Scanning',
        steps: [
          'Run static application security testing (SAST) using Semgrep / SonarQube.',
          'Scan repository history for leaked secrets and API keys using Gitleaks / Trufflehog.',
          'Audit third-party dependencies for known vulnerabilities using npm audit and Snyk.',
          'Verify that no hardcoded credentials exist in source code or docker images.',
          'Document findings in unified vulnerability register.'
        ]
      },
      {
        title: 'Phase 4: Vulnerability Remediation & Hardening',
        steps: [
          'Remediate all Critical and High severity findings immediately.',
          'Implement Content Security Policy (CSP) headers restricting script execution sources.',
          'Enforce strict input validation using schema libraries (Zod / Joi) with rejection of unknown properties.',
          'Implement rate limiting and brute-force protection on authentication routes.',
          'Re-test patched code to verify complete vulnerability closure.'
        ]
      },
      {
        title: 'Phase 5: Security Report Publication & CI Gate Enforcement',
        steps: [
          'Generate comprehensive security audit report with executive summary and technical details.',
          'Configure automated security scans in GitHub Actions CI pipeline.',
          'Set CI build failure thresholds on any newly introduced High or Critical vulnerabilities.',
          'Establish schedule for recurring automated security reviews.',
          'Sign off on security compliance release gate.'
        ]
      }
    ]
  },
  {
    name: 'subagent-driven-development',
    title: 'Subagent-Driven Development & Autonomous Task Orchestration',
    description: 'Production-grade Multi-Agent Orchestration playbook for task decomposition, parallel execution, and boundary isolation.',
    codeExemplar1: `// Subagent dispatch configuration
export interface SubagentTask {
  role: 'Backend Architect' | 'Frontend Architect' | 'Code Reviewer' | 'Security Auditor';
  type: string;
  prompt: string;
  contextFiles: string[];
  expectedDeliverables: string[];
  verificationCommand: string;
}`,
    codeExemplar2: `export interface OrchestratorPlan {
  masterTaskId: string;
  workstreams: Array<{
    id: string;
    subagentRole: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    dependencies: string[];
  }>;
}`,
    phases: [
      {
        title: 'Phase 1: Task Decomposition & Workstream Partitioning',
        steps: [
          'Analyze parent project request and identify independent, parallelizable workstreams.',
          'Partition tasks by architectural layer (e.g. Database -> API -> UI) or vertical domain slices.',
          'Identify strict sequential dependencies vs concurrent execution candidates.',
          'Ensure subagent workstreams do not concurrently modify the same mutable files to prevent collisions.',
          'Formulate master orchestration graph with dependency edges.'
        ]
      },
      {
        title: 'Phase 2: Self-Contained Subagent Prompt Formulation',
        steps: [
          'Author explicit, self-contained task prompts for each subagent (zero implicit context assumption).',
          'Specify exact file paths to read, modify, or create in prompt metadata.',
          'Define required tool privileges (read-only vs acceptEdits vs full terminal access).',
          'Include explicit verification commands the subagent must execute before declaring completion.',
          'Set strict boundary constraints prohibiting out-of-scope code modifications.'
        ]
      },
      {
        title: 'Phase 3: Parallel Subagent Invocation & Monitoring',
        steps: [
          'Dispatch concurrent subagents using invoke_subagent tool calls.',
          'Monitor background execution lifecycle and handle reactive wakeups.',
          'Inspect intermediate deliverables and log outputs for error conditions.',
          'If a subagent encounters rate limits or errors, isolate failure and execute targeted retry.',
          'Collect completed subagent artifact deliverables.'
        ]
      },
      {
        title: 'Phase 4: Synthesis, Integration & Conflict Resolution',
        steps: [
          'Integrate subagent output deliverables into master branch workspace.',
          'Resolve any overlapping interface contracts or import references between workstreams.',
          'Run full cross-module integration test suite verifying end-to-end functionality.',
          'Perform code review on all generated subagent code to maintain quality standards.',
          'Verify zero regression across all integrated components.'
        ]
      },
      {
        title: 'Phase 5: Master Verification & Final Deliverable Reporting',
        steps: [
          'Execute full project verification pipeline: npm run typecheck && npm test && npm run build.',
          'Run workspace health check: node dist/cli.js doctor.',
          'Compile comprehensive orchestration walkthrough summarizing all subagent contributions.',
          'Commit all unified changes to git with structured conventional commit message.',
          'Present final deliverables to user.'
        ]
      }
    ]
  },
  {
    name: 'systematic-debugging',
    title: 'Hypothesis-Driven Systematic Debugging & Root Cause Isolation',
    description: 'Production-grade Systematic Debugging playbook for isolating elusive bugs, root-cause analysis, and regression prevention.',
    codeExemplar1: `// Minimal reproducible test case exemplar
describe('Order Cancellation Bug Isolation', () => {
  it('should not mark order as cancelled when refund webhook fails', async () => {
    // 1. Arrange: setup order in processing state
    const order = await createTestOrder({ status: 'processing' });
    // 2. Act: trigger failed refund event
    const response = await handleRefundWebhook({ orderId: order.id, status: 'failed' });
    // 3. Assert: order status must remain processing, not cancelled
    expect(response.status).toBe(400);
    const updated = await getOrderById(order.id);
    expect(updated.status).toBe('processing');
  });
});`,
    codeExemplar2: `export interface DebugHypothesis {
  hypothesisId: string;
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  testProcedure: string;
  result: 'confirmed' | 'disproven' | 'inconclusive';
  rootCauseEvidence?: string;
}`,
    phases: [
      {
        title: 'Phase 1: Symptom Collection & Defect Reproduction',
        steps: [
          'Capture exact error messages, stack traces, HTTP status codes, and user environment details.',
          'Identify affected software versions, recent commits, and environment variables.',
          'Formulate deterministic reproduction steps in local development environment.',
          'Author a minimal failing test case that reliably reproduces the bug 100% of the time.',
          'Verify test failure matches reported production symptom exactly.'
        ]
      },
      {
        title: 'Phase 2: Hypothesis Generation & Ranking',
        steps: [
          'Formulate 3 to 5 distinct candidate hypotheses for root cause based on system architecture.',
          'Rank hypotheses by probability based on error signatures and recent code changes.',
          'Identify fault domains: network transport, data serialization, database state, race conditions.',
          'Design quick, non-destructive test procedures to validate or falsify each hypothesis.',
          'Document hypotheses in debugging log.'
        ]
      },
      {
        title: 'Phase 3: Binary Search Isolation & Root Cause Identification',
        steps: [
          'Use git bisect (git bisect start) to isolate the exact commit that introduced the defect.',
          'Apply binary search logging: add diagnostic logs at boundary interfaces to halve the search space.',
          'Inspect variable states and asynchronous call stacks during step-by-step execution.',
          'Falsify invalid hypotheses systematically until the singular root cause is isolated with proof.',
          'Document confirmed root cause mechanism.'
        ]
      },
      {
        title: 'Phase 4: Targeted Fix Implementation & Regression Testing',
        steps: [
          'Implement minimal, surgical code fix targeting the verified root cause (avoid broad refactoring).',
          'Run the minimal reproduction test case to verify that it now passes green.',
          'Run full automated test suite to ensure the fix introduces zero secondary regressions.',
          'Test edge cases and boundary inputs around the fixed logic.',
          'Verify type checking and linting pass cleanly.'
        ]
      },
      {
        title: 'Phase 5: Post-Mortem Documentation & Defect Prevention',
        steps: [
          'Permanently commit the reproduction test case to the test suite as a regression safeguard.',
          'Document root cause analysis, timeline, and remediation in post-mortem record.',
          'Implement preventative measures: improved input validation, lint rules, or type narrowing.',
          'Clean up temporary diagnostic log statements.',
          'Commit fix and deploy to production.'
        ]
      }
    ]
  },
  {
    name: 'technical-documentation',
    title: 'Technical Documentation, Architecture Specs & API Reference Authoring',
    description: 'Production-grade Technical Documentation playbook for Diátaxis framework, developer onboarding, and living architecture manuals.',
    codeExemplar1: `# System Architecture Specification
## Component Overview
\`\`\`mermaid
graph TD
  Client[Web Client] --> Gateway[API Gateway]
  Gateway --> AuthService[Auth Service]
  Gateway --> OrderService[Order Service]
  OrderService --> DB[(PostgreSQL)]
\`\`\`
### Communication Contracts
- Edge: HTTPS / RESTful JSON
- Internal: gRPC over HTTP/2 with mTLS`,
    codeExemplar2: `export interface DocumentationArtifact {
  title: string;
  category: 'tutorial' | 'how-to' | 'reference' | 'explanation';
  targetAudience: 'developers' | 'architects' | 'operations' | 'end-users';
  path: string;
  lastReviewed: string;
}`,
    phases: [
      {
        title: 'Phase 1: Audience Profiling & Diátaxis Framework Selection',
        steps: [
          'Identify primary audience: new engineers, API consumers, operations teams, or technical leadership.',
          'Classify documentation mode using Diátaxis framework: Tutorial (learning), How-To (goal-oriented), Reference (information), Explanation (understanding).',
          'Audit existing documentation for outdated diagrams, broken code samples, and missing prerequisites.',
          'Establish documentation style guide: active voice, direct phrasing, clean markdown formatting.',
          'Draft documentation outline.'
        ]
      },
      {
        title: 'Phase 2: Architecture Diagrams & Visual Modeling',
        steps: [
          'Author C4 / sequence diagrams using Mermaid syntax embedded directly in markdown.',
          'Illustrate data flows, authentication handshakes, and component boundary interactions.',
          'Ensure diagram labels are concise, legible, and maintainable as pure text.',
          'Include high-level system topology and deployment infrastructure overviews.',
          'Review diagrams for technical accuracy.'
        ]
      },
      {
        title: 'Phase 3: Code Examples & Copy-Pasteable Runbooks',
        steps: [
          'Author complete, self-contained code samples (avoid non-compiling pseudo-code).',
          'Provide verified terminal commands with explicit prerequisites and expected output.',
          'Document all environment variables, configuration parameters, and default values.',
          'Include comprehensive error code reference table with troubleshooting remedies.',
          'Verify every code example by executing it against a live test environment.'
        ]
      },
      {
        title: 'Phase 4: Review, Accuracy Validation & Link Checking',
        steps: [
          'Run automated markdown linter (markdownlint) to enforce formatting consistency.',
          'Check for dead markdown links and broken anchor references.',
          'Verify that all code blocks specify valid language tags for syntax highlighting.',
          'Perform peer review with a domain engineer to validate factual accuracy.',
          'Ensure zero typos or outdated terminology.'
        ]
      },
      {
        title: 'Phase 5: Publication & Living Documentation Maintenance',
        steps: [
          'Publish documentation to repository docs directory or documentation site (Docusaurus / MkDocs).',
          'Update table of contents and root README index links.',
          'Set up automated doc-testing in CI to prevent code sample bitrot.',
          'Commit documentation changes to version control.',
          'Notify team of published documentation updates.'
        ]
      }
    ]
  },
  {
    name: 'test-driven-development',
    title: 'Test-Driven Development (TDD) Red-Green-Refactor Protocol',
    description: 'Production-grade Test-Driven Development playbook for Red-Green-Refactor discipline, unit testing, and contract assertions.',
    codeExemplar1: `// Step 1 (RED): Write failing test capturing specification
describe('ShoppingCart', () => {
  it('should apply 10% discount when promo code SAVE10 is applied', () => {
    const cart = new ShoppingCart();
    cart.addItem({ name: 'Book', priceCents: 2000 });
    cart.applyPromoCode('SAVE10');
    expect(cart.getTotalCents()).toBe(1800);
  });
});

// Step 2 (GREEN): Minimal implementation to pass
// Step 3 (REFACTOR): Clean up without breaking tests`,
    codeExemplar2: `export interface TddCycleState {
  featureName: string;
  currentPhase: 'RED' | 'GREEN' | 'REFACTOR';
  failingTestName: string;
  testRunnerCommand: string;
  codeCoverageTarget: number;
}`,
    phases: [
      {
        title: 'Phase 1: Specification Ingestion & Test Case Design',
        steps: [
          'Deconstruct user story or requirement into discrete, testable behavioral assertions.',
          'Design test cases following Arrange-Act-Assert (AAA) or Given-When-Then structure.',
          'Name tests expressively: should [expected behavior] when [condition / input].',
          'Identify edge cases: empty inputs, zero/negative values, null pointers, boundary limits.',
          'Verify test runner (npm test / Vitest / Jest) is active in watch mode.'
        ]
      },
      {
        title: 'Phase 2: RED Phase — Author Failing Test First',
        steps: [
          'Author the test case BEFORE writing any production implementation code.',
          'Define clean, intuitive API interfaces directly inside the test invocation.',
          'Run test runner and verify the test fails for the EXACT expected reason (assertion failure, not syntax error).',
          'Confirm that zero production code exists that satisfies the new test.',
          'Record RED status.'
        ]
      },
      {
        title: 'Phase 3: GREEN Phase — Minimal Implementation to Pass',
        steps: [
          'Write the absolute minimum production code required to make the failing test pass.',
          'Resist the temptation to over-engineer, generalize, or implement future requirements prematurely.',
          'Run test runner and confirm the test turns GREEN.',
          'Verify that all previously existing tests continue to pass GREEN without regressions.',
          'Commit working GREEN state to git history.'
        ]
      },
      {
        title: 'Phase 4: REFACTOR Phase — Eliminate Duplication & Optimize',
        steps: [
          'Inspect code for duplication, awkward naming, or structural code smells.',
          'Extract helper utilities, refine class/function abstractions, and improve readability.',
          'Ensure tests remain 100% GREEN throughout every refactoring step.',
          'Optimize algorithmic performance where necessary while preserving exact behavior.',
          'Re-verify all tests pass cleanly.'
        ]
      },
      {
        title: 'Phase 5: Coverage Validation & Suite Finalization',
        steps: [
          'Run test suite with code coverage analysis (npm test -- --coverage).',
          'Verify line and branch coverage targets (>90%) are met on new modules.',
          'Run full project verification: npm run typecheck && npm test && npm run build.',
          'Ensure all test suites execute in under 5 seconds to maintain high development velocity.',
          'Commit completed TDD cycle to version control.'
        ]
      }
    ]
  }
];

function generateSkillMarkdown(skill) {
  let content = `---
name: ${skill.name}
description: ${skill.description}
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# ${skill.title}

## Overview & Purpose
The ${skill.title} skill provides a deterministic, battle-tested framework for executing ${skill.name} processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking ${skill.name}.
- Auditing, implementing, or standardizing ${skill.name} procedures.
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
| \`target_scope\` | String | Yes | Target module, service, component, or file path |
| \`config\` | Object | Optional | Specific domain configurations, thresholds, and options |
| \`output_dir\` | Directory Path | Optional | Destination directory for generated artifacts and reports |
| \`strict_mode\` | Boolean | Optional | Enforce strict zero-warning validation and high test coverage |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Specification Document | \`docs/${skill.name}/spec.md\` | Full technical specification and architectural plan |
| Implementation Files | \`src/${skill.name}/*\` | Production-ready source code, tests, and configurations |
| Execution Report | \`reports/${skill.name}/summary.json\` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook
`;

  for (const phase of skill.phases) {
    content += `\n### ${phase.title}\n`;
    for (let i = 0; i < phase.steps.length; i++) {
      content += `${i + 1}. ${phase.steps[i]}\n`;
    }
  }

  content += `
## Code & Configuration Exemplars

### Exemplar 1: ${skill.title} Configuration & Specification
\`\`\`yaml
${skill.codeExemplar1}
\`\`\`

### Exemplar 2: ${skill.title} TypeScript Type Contract
\`\`\`typescript
${skill.codeExemplar2}
\`\`\`

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in ${skill.title}
1. **Diagnosis**: Static analysis, typechecking, or unit tests fail validation rules during execution.
2. **Recovery Protocol**:
   - Step 1: Inspect detailed error log output in test/build terminal.
   - Step 2: Formulate targeted hypothesis and isolate failing line or assertion.
   - Step 3: Implement surgical code fix and re-run verification suite.

### Scenario B: Missing or Incompatible Dependency
1. **Diagnosis**: Required toolchain binary or library dependency is missing from the environment.
2. **Recovery Protocol**:
   - Step 1: Verify \`package.json\` engine requirements and local environment versions.
   - Step 2: Install required peer dependencies cleanly with lockfile sync.
   - Step 3: Resume runbook from Phase 1.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to \`author: "agents-united"\` and \`version: "2.0.0"\`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
`;

  return content;
}

const rootDir = path.resolve(__dirname, '..');
for (const skill of skills) {
  const dirPath = path.join(rootDir, 'registry', 'skills', skill.name);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, 'SKILL.md');
  const content = generateSkillMarkdown(skill);
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Regenerated all 18 skills in registry/skills successfully!');
