---
name: code-refactoring
description: Production-grade Code Refactoring playbook for safely modernizing
  legacy codebases with zero regressions.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/code-refactoring/SKILL.md | do not edit -->

# Systematic Code Refactoring & Tech Debt Remediation

## Overview & Purpose
The Systematic Code Refactoring & Tech Debt Remediation skill provides a deterministic, battle-tested framework for executing code-refactoring processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking code-refactoring.
- Auditing, implementing, or standardizing code-refactoring procedures.
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
| Specification Document | `docs/code-refactoring/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/code-refactoring/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/code-refactoring/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Code Smell Detection & Dependency Mapping
1. Identify refactoring targets using static analysis: Cyclomatic complexity > 15, file length > 500 lines.
2. Classify code smells: God objects, shotgun surgery, deep nesting, duplicate logic, primitive obsession.
3. Map caller graph and downstream consumer dependencies using AST analysis / grep.
4. Verify existing automated test suite coverage on the target module before touching code.
5. If coverage is < 80%, author characterization tests to capture current behavior first.

### Phase 2: Refactoring Strategy & Safety Boundary Formulation
1. Select appropriate Martin Fowler refactoring patterns: Extract Method, Replace Conditional with Polymorphism, Introduce Parameter Object.
2. Establish the Strangler Fig pattern for large-scale module replacements.
3. Define clear interface boundaries to encapsulate internal structural changes.
4. Ensure all operations maintain immutability and eliminate global mutable state.
5. Create dedicated refactoring branch in git.

### Phase 3: Incremental Micro-Refactoring Execution
1. Perform micro-transformations in tiny, atomic commits (one refactoring step per commit).
2. Extract nested helper functions and replace magic strings/numbers with typed enums/constants.
3. Migrate imperative loops to declarative, strongly-typed pipeline operations.
4. Inject dependencies explicitly to eliminate hidden hardcoded singleton coupling.
5. Run unit test suite immediately after each micro-refactor.

### Phase 4: Regression Testing & Performance Benchmark Validation
1. Run complete test suite (npm test) and typechecker (npm run typecheck).
2. Run regression benchmark to verify memory allocation and CPU cycles have not degraded.
3. Perform static linting to ensure no dead code or unreferenced imports remain.
4. Inspect git diff to confirm only structural refactorings occurred with zero accidental logic shifts.
5. Verify 100% test pass rate.

### Phase 5: Code Review & Documentation Sync
1. Document architectural improvements in pull request summary.
2. Update internal JSDoc comments and module architecture diagrams.
3. Squash intermediate commits into logical, readable conventional commits.
4. Merge refactored branch to main.
5. Monitor application telemetry for regression anomalies.

## Code & Configuration Exemplars

### Exemplar 1: Systematic Code Refactoring & Tech Debt Remediation Configuration & Specification
```yaml
// Before: Nested callback anti-pattern with mutation
// After: Pure pipeline with immutable transformations
export function processTransactions(txs: readonly Transaction[]): TransactionReport {
  return txs
    .filter(isValidTransaction)
    .map(normalizeCurrency)
    .reduce(aggregateTotals, initialReport);
}
```

### Exemplar 2: Systematic Code Refactoring & Tech Debt Remediation TypeScript Type Contract
```typescript
export interface RefactorPlan {
  targetModule: string;
  codeSmell: 'long-method' | 'god-class' | 'feature-envy' | 'duplicate-logic' | 'primitive-obsession';
  testCoverageBefore: number;
  safetyChecklist: {
    unitTestsPassing: boolean;
    typesEnforced: boolean;
    behaviorPreserved: boolean;
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Systematic Code Refactoring & Tech Debt Remediation
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
