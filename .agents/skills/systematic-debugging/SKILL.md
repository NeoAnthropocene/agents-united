---
name: systematic-debugging
description: Production-grade Systematic Debugging playbook for isolating elusive bugs, root-cause analysis, and regression prevention.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Hypothesis-Driven Systematic Debugging & Root Cause Isolation

## Overview & Purpose
The Hypothesis-Driven Systematic Debugging & Root Cause Isolation skill provides a deterministic, battle-tested framework for executing systematic-debugging processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking systematic-debugging.
- Auditing, implementing, or standardizing systematic-debugging procedures.
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
| Specification Document | `docs/systematic-debugging/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/systematic-debugging/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/systematic-debugging/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Symptom Collection & Defect Reproduction
1. Capture exact error messages, stack traces, HTTP status codes, and user environment details.
2. Identify affected software versions, recent commits, and environment variables.
3. Formulate deterministic reproduction steps in local development environment.
4. Author a minimal failing test case that reliably reproduces the bug 100% of the time.
5. Verify test failure matches reported production symptom exactly.

### Phase 2: Hypothesis Generation & Ranking
1. Formulate 3 to 5 distinct candidate hypotheses for root cause based on system architecture.
2. Rank hypotheses by probability based on error signatures and recent code changes.
3. Identify fault domains: network transport, data serialization, database state, race conditions.
4. Design quick, non-destructive test procedures to validate or falsify each hypothesis.
5. Document hypotheses in debugging log.

### Phase 3: Binary Search Isolation & Root Cause Identification
1. Use git bisect (git bisect start) to isolate the exact commit that introduced the defect.
2. Apply binary search logging: add diagnostic logs at boundary interfaces to halve the search space.
3. Inspect variable states and asynchronous call stacks during step-by-step execution.
4. Falsify invalid hypotheses systematically until the singular root cause is isolated with proof.
5. Document confirmed root cause mechanism.

### Phase 4: Targeted Fix Implementation & Regression Testing
1. Implement minimal, surgical code fix targeting the verified root cause (avoid broad refactoring).
2. Run the minimal reproduction test case to verify that it now passes green.
3. Run full automated test suite to ensure the fix introduces zero secondary regressions.
4. Test edge cases and boundary inputs around the fixed logic.
5. Verify type checking and linting pass cleanly.

### Phase 5: Post-Mortem Documentation & Defect Prevention
1. Permanently commit the reproduction test case to the test suite as a regression safeguard.
2. Document root cause analysis, timeline, and remediation in post-mortem record.
3. Implement preventative measures: improved input validation, lint rules, or type narrowing.
4. Clean up temporary diagnostic log statements.
5. Commit fix and deploy to production.

## Code & Configuration Exemplars

### Exemplar 1: Hypothesis-Driven Systematic Debugging & Root Cause Isolation Configuration & Specification
```yaml
// Minimal reproducible test case exemplar
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
});
```

### Exemplar 2: Hypothesis-Driven Systematic Debugging & Root Cause Isolation TypeScript Type Contract
```typescript
export interface DebugHypothesis {
  hypothesisId: string;
  description: string;
  likelihood: 'high' | 'medium' | 'low';
  testProcedure: string;
  result: 'confirmed' | 'disproven' | 'inconclusive';
  rootCauseEvidence?: string;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Hypothesis-Driven Systematic Debugging & Root Cause Isolation
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
