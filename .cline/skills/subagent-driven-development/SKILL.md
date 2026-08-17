---
name: subagent-driven-development
description: Production-grade Multi-Agent Orchestration playbook for task
  decomposition, parallel execution, and boundary isolation.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/subagent-driven-development/SKILL.md | do not edit -->

# Subagent-Driven Development & Autonomous Task Orchestration

## Overview & Purpose
The Subagent-Driven Development & Autonomous Task Orchestration skill provides a deterministic, battle-tested framework for executing subagent-driven-development processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking subagent-driven-development.
- Auditing, implementing, or standardizing subagent-driven-development procedures.
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
| Specification Document | `docs/subagent-driven-development/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/subagent-driven-development/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/subagent-driven-development/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Task Decomposition & Workstream Partitioning
1. Analyze parent project request and identify independent, parallelizable workstreams.
2. Partition tasks by architectural layer (e.g. Database -> API -> UI) or vertical domain slices.
3. Identify strict sequential dependencies vs concurrent execution candidates.
4. Ensure subagent workstreams do not concurrently modify the same mutable files to prevent collisions.
5. Formulate master orchestration graph with dependency edges.

### Phase 2: Self-Contained Subagent Prompt Formulation
1. Author explicit, self-contained task prompts for each subagent (zero implicit context assumption).
2. Specify exact file paths to read, modify, or create in prompt metadata.
3. Define required tool privileges (read-only vs acceptEdits vs full terminal access).
4. Include explicit verification commands the subagent must execute before declaring completion.
5. Set strict boundary constraints prohibiting out-of-scope code modifications.

### Phase 3: Parallel Subagent Invocation & Monitoring
1. Dispatch concurrent subagents using invoke_subagent tool calls.
2. Monitor background execution lifecycle and handle reactive wakeups.
3. Inspect intermediate deliverables and log outputs for error conditions.
4. If a subagent encounters rate limits or errors, isolate failure and execute targeted retry.
5. Collect completed subagent artifact deliverables.

### Phase 4: Synthesis, Integration & Conflict Resolution
1. Integrate subagent output deliverables into master branch workspace.
2. Resolve any overlapping interface contracts or import references between workstreams.
3. Run full cross-module integration test suite verifying end-to-end functionality.
4. Perform code review on all generated subagent code to maintain quality standards.
5. Verify zero regression across all integrated components.

### Phase 5: Master Verification & Final Deliverable Reporting
1. Execute full project verification pipeline: npm run typecheck && npm test && npm run build.
2. Run workspace health check: node dist/cli.js doctor.
3. Compile comprehensive orchestration walkthrough summarizing all subagent contributions.
4. Commit all unified changes to git with structured conventional commit message.
5. Present final deliverables to user.

## Code & Configuration Exemplars

### Exemplar 1: Subagent-Driven Development & Autonomous Task Orchestration Configuration & Specification
```yaml
// Subagent dispatch configuration
export interface SubagentTask {
  role: 'Backend Architect' | 'Frontend Architect' | 'Code Reviewer' | 'Security Auditor';
  type: string;
  prompt: string;
  contextFiles: string[];
  expectedDeliverables: string[];
  verificationCommand: string;
}
```

### Exemplar 2: Subagent-Driven Development & Autonomous Task Orchestration TypeScript Type Contract
```typescript
export interface OrchestratorPlan {
  masterTaskId: string;
  workstreams: Array<{
    id: string;
    subagentRole: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    dependencies: string[];
  }>;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Subagent-Driven Development & Autonomous Task Orchestration
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
