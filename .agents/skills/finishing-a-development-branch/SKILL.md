---
name: finishing-a-development-branch
description: Production-grade Branch Finalization playbook for clean git history, squash hygiene, and automated release validation.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Development Branch Finalization, Cleanup & PR Readiness

## Overview & Purpose
The Development Branch Finalization, Cleanup & PR Readiness skill provides a deterministic, battle-tested framework for executing finishing-a-development-branch processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking finishing-a-development-branch.
- Auditing, implementing, or standardizing finishing-a-development-branch procedures.
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
| Specification Document | `docs/finishing-a-development-branch/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/finishing-a-development-branch/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/finishing-a-development-branch/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Working Tree Audit & Temporary File Cleanup
1. Check git working directory status: git status --short.
2. Remove temporary debug files, scratch scripts, and editor artifacts.
3. Search for stray console.log, debugger, and unresolved TODO statements.
4. Verify no sensitive secrets, API keys, or .env files are tracked in git.
5. Ensure all modified files are properly staged.

### Phase 2: Synchronization & Rebase against Target Branch
1. Fetch latest changes from upstream remote: git fetch origin main.
2. Rebase development branch onto latest main: git rebase origin/main.
3. Resolve any merge conflicts cleanly, validating code logic after each resolved chunk.
4. Run interactive rebase (git rebase -i) to squash messy WIP and fixup commits.
5. Ensure all commit messages adhere to Conventional Commits specification.

### Phase 3: Verification & Quality Gate Execution
1. Run complete TypeScript typecheck: npm run typecheck.
2. Execute full test suite: npm test.
3. Execute production build: npm run build.
4. Execute workspace doctor check: node dist/cli.js doctor.
5. Confirm 100% test pass rate with zero lint or build errors.

### Phase 4: Pull Request Description & Documentation Assembly
1. Generate structured PR description covering Summary, Motivation, Changes, and Testing.
2. Attach visual evidence (before/after screenshots or terminal recordings) for UI/CLI changes.
3. Link related issue tickets and architecture decision records.
4. Update project README and documentation files if features or flags were modified.
5. Verify CI workflow requirements and reviewer assignments.

### Phase 5: Push & PR Submission
1. Push clean rebased branch to remote repository: git push -u origin branch-name --force-with-lease.
2. Open Pull Request on GitHub / GitLab.
3. Verify all automated GitHub Actions CI checks pass green.
4. Request code review from designated subagents or human maintainers.
5. Prepare for automated merge upon approval.

## Code & Configuration Exemplars

### Exemplar 1: Development Branch Finalization, Cleanup & PR Readiness Configuration & Specification
```yaml
# Interactive rebase against main branch
git fetch origin main
git rebase -i origin/main
# Ensure all commits follow Conventional Commits standard:
# feat(scope): add feature description
# fix(scope): resolve issue description
```

### Exemplar 2: Development Branch Finalization, Cleanup & PR Readiness TypeScript Type Contract
```typescript
export interface BranchChecklist {
  branchName: string;
  isRebasedOnMain: boolean;
  cleanWorkingTree: boolean;
  testsPassing: boolean;
  typecheckPassing: boolean;
  buildPassing: boolean;
  conventionalCommits: boolean;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Development Branch Finalization, Cleanup & PR Readiness
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
