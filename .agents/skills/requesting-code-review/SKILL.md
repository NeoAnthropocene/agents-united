---
name: requesting-code-review
description: Production-grade Requesting Code Review playbook for authoring high-context PRs, reviewer routing, and accelerating velocity.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Requesting Code Review & Authoring High-Context Pull Requests

## Overview & Purpose
The Requesting Code Review & Authoring High-Context Pull Requests skill provides a deterministic, battle-tested framework for executing requesting-code-review processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking requesting-code-review.
- Auditing, implementing, or standardizing requesting-code-review procedures.
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
| Specification Document | `docs/requesting-code-review/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/requesting-code-review/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/requesting-code-review/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Pre-Submission Self-Review & Diff Scrutiny
1. Perform a thorough self-review of your own pull request diff on GitHub / CLI before requesting peers.
2. Check for leftover debug logs (console.log), temporary test files, or commented-out code.
3. Ensure the diff size is manageable (< 400 lines modified) to facilitate thorough review.
4. Split oversized PRs into smaller, sequential, independently-testable PRs if necessary.
5. Verify clean branch rebase on latest main.

### Phase 2: High-Context PR Description Authoring
1. Write concise, informative PR title following Conventional Commits (feat(auth): add OAuth2 refresh token flow).
2. Document Motivation: Why is this change necessary? Link relevant issue tickets.
3. Document Approach: How was the problem solved? What architectural decisions were made?
4. Document Tradeoffs: What alternatives were evaluated and why were they not chosen?
5. Attach visual proof (screenshots, animated GIFs, or terminal logs) demonstrating functionality.

### Phase 3: Verification Instructions & Test Evidence
1. Provide clear, copy-pasteable terminal commands for reviewers to verify the changes locally.
2. Document manual test steps and environment prerequisites.
3. Include test execution results and code coverage metrics in PR description.
4. Highlight any database migrations or environment variable changes required.
5. Confirm all automated CI checks are passing green.

### Phase 4: Reviewer Routing & Context Briefing
1. Assign code owners and subject-matter experts based on modified file paths (CODEOWNERS).
2. Add inline comments on complex or non-obvious algorithms explaining the rationale.
3. Tag security or architecture specialists if sensitive boundaries were touched.
4. Ping assigned reviewers in team chat with a one-sentence summary and urgency level.
5. Monitor PR for incoming comments.

### Phase 5: Review Coordination & Handoff
1. Respond promptly to incoming reviewer questions and feedback.
2. Keep PR branch updated with main during extended review cycles.
3. Coordinate final sign-off once all review requirements are satisfied.
4. Merge PR according to repository merge strategy (Squash and Merge).
5. Confirm deployment in staging / production.

## Code & Configuration Exemplars

### Exemplar 1: Requesting Code Review & Authoring High-Context Pull Requests Configuration & Specification
```yaml
## Summary of Changes
- Implemented idempotent payment checkout flow using Stripe Webhooks.
- Added transactional outbox pattern to prevent double-charging on network timeout.
- Added comprehensive unit and integration tests with 94% code coverage.

## Verification
```bash
npm run typecheck && npm test
```
- [x] All 28 automated tests passing.
- [x] Tested against Stripe test environment.
```

### Exemplar 2: Requesting Code Review & Authoring High-Context Pull Requests TypeScript Type Contract
```typescript
export interface PullRequestMetadata {
  title: string;
  description: string;
  type: 'feat' | 'fix' | 'refactor' | 'perf' | 'docs';
  scope: string;
  breakingChanges: boolean;
  issueReferences: string[];
  reviewers: string[];
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Requesting Code Review & Authoring High-Context Pull Requests
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
