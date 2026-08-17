---
name: docker-deployment
description: Production-grade Docker Deployment playbook for minimal footprint,
  rootless execution, and multi-stage builds.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/docker-deployment/SKILL.md | do not edit -->

# Containerization, Dockerfile Hardening & Multi-Stage Deployment

## Overview & Purpose
The Containerization, Dockerfile Hardening & Multi-Stage Deployment skill provides a deterministic, battle-tested framework for executing docker-deployment processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking docker-deployment.
- Auditing, implementing, or standardizing docker-deployment procedures.
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
| Specification Document | `docs/docker-deployment/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/docker-deployment/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/docker-deployment/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Application Workload & Architecture Profiling
1. Analyze application runtime requirements: Node.js version, native C++ bindings, static assets.
2. Define required environment variables, secret mounts, and volume persistent storage paths.
3. Establish container memory limits, CPU quotas, and networking port requirements.
4. Select minimal base image: node:24-alpine or distroless/nodejs24-debian12.
5. Draft containerization strategy document.

### Phase 2: Multi-Stage Dockerfile Construction & Hardening
1. Structure multi-stage build separating compile dependencies from final production runtime.
2. Optimize Docker layer caching: copy package*.json and run npm ci before copying source code.
3. Implement non-root user execution (USER appuser) to prevent container breakout exploits.
4. Add .dockerignore file excluding .git, node_modules, .env, and test artifacts.
5. Configure explicit HEALTHCHECK directive testing HTTP endpoint readiness.

### Phase 3: Image Build, Linting & Vulnerability Scanning
1. Lint Dockerfile using Hadolint to catch syntax and security anti-patterns.
2. Build container image: docker build -t app:latest .
3. Scan image for CVEs using Trivy / Docker Scout: trivy image app:latest.
4. Assert zero critical or high vulnerabilities in base OS and application packages.
5. Verify final image size is minimal (<150MB for Node.js workloads).

### Phase 4: Local Container Testing & Compose Verification
1. Launch container in isolated bridge network using docker run or docker compose up.
2. Execute HTTP smoke tests against healthcheck and API endpoints.
3. Verify graceful shutdown handling on SIGTERM and SIGINT signals.
4. Inspect container stdout/stderr logs to ensure structured JSON output formatting.
5. Confirm volume mount persistence across container restarts.

### Phase 5: Registry Publishing & Orchestrator Deployment
1. Tag image with semantic version and git commit SHA: app:v2.0.0-sha123.
2. Push image to container registry (ECR, GCR, Docker Hub) over TLS.
3. Update Kubernetes deployment manifests / ECS task definitions with immutable image digest.
4. Execute rolling deployment with automated rollback on healthcheck failure.
5. Verify production workload stability.

## Code & Configuration Exemplars

### Exemplar 1: Containerization, Dockerfile Hardening & Multi-Stage Deployment Configuration & Specification
```yaml
# Multi-stage hardened Dockerfile
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
CMD ["node", "dist/index.js"]
```

### Exemplar 2: Containerization, Dockerfile Hardening & Multi-Stage Deployment TypeScript Type Contract
```typescript
export interface ContainerSpec {
  imageName: string;
  tag: string;
  baseImage: string;
  multiStage: boolean;
  nonRootUser: boolean;
  exposedPorts: number[];
  healthCheckEndpoint: string;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Containerization, Dockerfile Hardening & Multi-Stage Deployment
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
