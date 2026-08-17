---
name: receiving-code-review
description: Production-grade Receiving Code Review playbook for processing
  feedback, addressing revisions, and maintaining codebase standards.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/receiving-code-review/SKILL.md | do not edit -->

# Receiving Code Review Feedback & Constructive Revision

## Overview & Purpose
The Receiving Code Review Feedback & Constructive Revision skill provides a deterministic, battle-tested framework for executing receiving-code-review processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking receiving-code-review.
- Auditing, implementing, or standardizing receiving-code-review procedures.
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
| Specification Document | `docs/receiving-code-review/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/receiving-code-review/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/receiving-code-review/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Feedback Ingestion & Categorization
1. Read all pull request review comments completely before writing any code.
2. Categorize feedback items: Security blockers, correctness issues, performance concerns, stylistic suggestions.
3. Separate objective bugs and standard violations from subjective design preferences.
4. Adopt an egoless mindset: focus on code quality, user impact, and team collective ownership.
5. Create a checklist of actionable changes from review comments.

### Phase 2: Clarification & Constructive Discussion
1. If a comment is ambiguous, ask specific clarifying questions with proposed alternatives.
2. If proposing an alternative approach, provide data, benchmarks, or documentation citations.
3. Keep technical discussions focused on tradeoffs, constraints, and architecture standards.
4. Reach clear consensus on contentious points before implementing complex refactors.
5. Document agreed-upon resolution on the PR thread.

### Phase 3: Targeted Implementation & Test Coverage
1. Implement requested changes incrementally in clean, focused commits.
2. Write or update automated tests that verify the requested behavior and prevent regression.
3. Run full local verification: npm run typecheck && npm test && npm run build.
4. Verify that addressing one comment did not inadvertently break unrelated modules.
5. Confirm all automated CI tests pass.

### Phase 4: Thread Resolution & Reviewer Notification
1. Reply to each PR comment thread with a concise summary and reference to the commit SHA.
2. Mark resolved conversation threads on GitHub / GitLab.
3. If a suggestion was intentionally omitted, explain the technical rationale respectfully.
4. Push updated commits to the PR branch.
5. Re-request review from original reviewers.

### Phase 5: Approval Verification & Merge Finalization
1. Verify all required reviewer approvals are received.
2. Ensure branch is up-to-date with base branch without conflicts.
3. Squash and merge pull request following repository commit conventions.
4. Delete merged feature branch from remote.
5. Verify deployment pipeline completes successfully.

## Code & Configuration Exemplars

### Exemplar 1: Receiving Code Review Feedback & Constructive Revision Configuration & Specification
```yaml
// Code review revision workflow
// 1. Acknowledge comment and clarify intent
// 2. Apply requested changes with targeted test coverage
// 3. Reply with commit SHA and re-request review
```

### Exemplar 2: Receiving Code Review Feedback & Constructive Revision TypeScript Type Contract
```typescript
export interface ReviewFeedbackItem {
  id: string;
  reviewer: string;
  file: string;
  line: number;
  category: 'security' | 'correctness' | 'performance' | 'style' | 'question';
  status: 'pending' | 'addressed' | 'clarification-needed' | 'wont-fix';
  resolutionCommitSha?: string;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Receiving Code Review Feedback & Constructive Revision
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
