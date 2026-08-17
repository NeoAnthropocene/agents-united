---
name: test-driven-development
description: Production-grade Test-Driven Development playbook for
  Red-Green-Refactor discipline, unit testing, and contract assertions.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/test-driven-development/SKILL.md | do not edit -->

# Test-Driven Development (TDD) Red-Green-Refactor Protocol

## Overview & Purpose
The Test-Driven Development (TDD) Red-Green-Refactor Protocol skill provides a deterministic, battle-tested framework for executing test-driven-development processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking test-driven-development.
- Auditing, implementing, or standardizing test-driven-development procedures.
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
| Specification Document | `docs/test-driven-development/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/test-driven-development/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/test-driven-development/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Specification Ingestion & Test Case Design
1. Deconstruct user story or requirement into discrete, testable behavioral assertions.
2. Design test cases following Arrange-Act-Assert (AAA) or Given-When-Then structure.
3. Name tests expressively: should [expected behavior] when [condition / input].
4. Identify edge cases: empty inputs, zero/negative values, null pointers, boundary limits.
5. Verify test runner (npm test / Vitest / Jest) is active in watch mode.

### Phase 2: RED Phase — Author Failing Test First
1. Author the test case BEFORE writing any production implementation code.
2. Define clean, intuitive API interfaces directly inside the test invocation.
3. Run test runner and verify the test fails for the EXACT expected reason (assertion failure, not syntax error).
4. Confirm that zero production code exists that satisfies the new test.
5. Record RED status.

### Phase 3: GREEN Phase — Minimal Implementation to Pass
1. Write the absolute minimum production code required to make the failing test pass.
2. Resist the temptation to over-engineer, generalize, or implement future requirements prematurely.
3. Run test runner and confirm the test turns GREEN.
4. Verify that all previously existing tests continue to pass GREEN without regressions.
5. Commit working GREEN state to git history.

### Phase 4: REFACTOR Phase — Eliminate Duplication & Optimize
1. Inspect code for duplication, awkward naming, or structural code smells.
2. Extract helper utilities, refine class/function abstractions, and improve readability.
3. Ensure tests remain 100% GREEN throughout every refactoring step.
4. Optimize algorithmic performance where necessary while preserving exact behavior.
5. Re-verify all tests pass cleanly.

### Phase 5: Coverage Validation & Suite Finalization
1. Run test suite with code coverage analysis (npm test -- --coverage).
2. Verify line and branch coverage targets (>90%) are met on new modules.
3. Run full project verification: npm run typecheck && npm test && npm run build.
4. Ensure all test suites execute in under 5 seconds to maintain high development velocity.
5. Commit completed TDD cycle to version control.

## Code & Configuration Exemplars

### Exemplar 1: Test-Driven Development (TDD) Red-Green-Refactor Protocol Configuration & Specification
```yaml
// Step 1 (RED): Write failing test capturing specification
describe('ShoppingCart', () => {
  it('should apply 10% discount when promo code SAVE10 is applied', () => {
    const cart = new ShoppingCart();
    cart.addItem({ name: 'Book', priceCents: 2000 });
    cart.applyPromoCode('SAVE10');
    expect(cart.getTotalCents()).toBe(1800);
  });
});

// Step 2 (GREEN): Minimal implementation to pass
// Step 3 (REFACTOR): Clean up without breaking tests
```

### Exemplar 2: Test-Driven Development (TDD) Red-Green-Refactor Protocol TypeScript Type Contract
```typescript
export interface TddCycleState {
  featureName: string;
  currentPhase: 'RED' | 'GREEN' | 'REFACTOR';
  failingTestName: string;
  testRunnerCommand: string;
  codeCoverageTarget: number;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Test-Driven Development (TDD) Red-Green-Refactor Protocol
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
