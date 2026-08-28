---
name: dependency-management
description: Production-grade Dependency Management playbook for secure
  supply-chain integrity, semver updates, and lockfile hygiene.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 📦
disable-slash-command: true
---

# Dependency Management, Vulnerability Auditing & Upgrades

## Overview & Purpose
The Dependency Management, Vulnerability Auditing & Upgrades skill provides a deterministic, battle-tested framework for executing dependency-management processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking dependency-management.
- Auditing, implementing, or standardizing dependency-management procedures.
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
| Specification Document | `docs/dependency-management/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/dependency-management/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/dependency-management/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Dependency Supply-Chain Audit
1. Scan dependency tree for known CVEs using npm audit and Snyk/OSV scanners.
2. Identify deprecated packages and unmaintained upstream repositories (>2 years inactive).
3. Check for license compliance (MIT, Apache-2.0, BSD vs restrictive AGPL).
4. Review direct vs transitive dependency graph depth and duplicate package instances.
5. Generate dependency inventory report.

### Phase 2: Outdated Package Assessment & Semver Planning
1. Run npm outdated to list all packages with patch, minor, or major updates available.
2. Categorize updates: Patch (bug fixes), Minor (features), Major (breaking changes).
3. Review changelogs and GitHub release notes for breaking API changes and migration guides.
4. Formulate staged upgrade batching plan (upgrade utility libs first, core frameworks last).
5. Ensure isolated git branch for dependency updates.

### Phase 3: Staged Upgrade & Lockfile Synchronization
1. Execute atomic upgrades per package or group using npm install package@version.
2. Verify package lockfile integrity (package-lock.json or pnpm-lock.yaml).
3. Apply package overrides / resolutions for transitive security vulnerabilities where needed.
4. Prune orphan packages using npm prune.
5. Verify lockfile is strictly deterministic with reproducible builds.

### Phase 4: Full Automated Regression Verification
1. Run complete TypeScript typecheck (npm run typecheck) to detect API signature breaks.
2. Run full unit and integration test suite (npm test).
3. Execute production build (npm run build) and inspect output bundle size delta.
4. Run end-to-end smoke tests against compiled distribution assets.
5. Confirm zero build warnings or runtime deprecation notices.

### Phase 5: Release Notes & CI Pipeline Enforcement
1. Document upgraded package versions and security fixes in commit message.
2. Configure Dependabot / Renovate automation rules for continuous dependency maintenance.
3. Enforce CI check rejecting PRs with high/critical security vulnerabilities.
4. Commit lockfile and package manifest changes.
5. Merge dependency update pull request.

## Code & Configuration Exemplars

### Exemplar 1: Dependency Management, Vulnerability Auditing & Upgrades Configuration & Specification
```yaml
// package.json engine and package overrides
{
  "engines": {
    "node": ">=24.0.0",
    "npm": ">=10.0.0"
  },
  "overrides": {
    "glob": "^11.0.0"
  }
}
```

### Exemplar 2: Dependency Management, Vulnerability Auditing & Upgrades TypeScript Type Contract
```typescript
export interface DependencyAuditResult {
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
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Dependency Management, Vulnerability Auditing & Upgrades
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
