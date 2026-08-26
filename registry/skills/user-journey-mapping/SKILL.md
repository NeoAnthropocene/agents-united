---
name: user-journey-mapping
description: Production-grade User Journey Mapping playbook for design
  operations, UX systems, and growth strategy.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🧭
disable-slash-command: true
---

# User Journey Mapping

## Overview & Purpose
The User Journey Mapping skill provides a deterministic framework for executing user journey mapping processes in modern software products.

Following this skill ensures high usability, visual consistency, rapid iteration, and complete cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request to execute User Journey Mapping tasks.
- Auditing existing product assets or workflows.
- Standardizing user-journey-mapping procedures across team projects.
- Preparing design handoffs or growth campaign launches.

### Prerequisites
- Project workspace configured with design system tokens or component libraries.
- Target UI design specification or growth experiment hypothesis.
- Testing and linting tools operational.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `target_scope` | String | Yes | Target UI component, page, or campaign scope |
| `config` | Object | Optional | Specific parameters and threshold configurations |
| `output_dir` | Directory Path | Optional | Destination directory for generated artifacts |
| `strict_mode` | Boolean | Optional | Enforce strict zero-warning validation |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Specification Document | `docs/user-journey-mapping/spec.md` | Full specification and guidelines document |
| Component / Asset Files | `src/user-journey-mapping/*` | Implemented design tokens, components, or campaign assets |
| Audit Report | `reports/user-journey-mapping/summary.json` | Health check and audit metric results |

## Step-by-Step Execution Runbook

### Phase 1: Pre-Execution Discovery & Workspace Analysis
1. Inspect workspace repository to locate relevant UI components, tokens, or campaign assets.
   ```bash
   find src/ docs/ -maxdepth 3 -type f
   ```
2. Analyze domain requirements and classify core UI elements, interaction flows, or growth metrics.
3. Establish baseline quality metrics and target benchmarks.
4. Verify working tree status to ensure clean git workspace.
   ```bash
   git status --short
   ```
5. Formulate initial execution plan.

### Phase 2: Input Contract Validation & Strategy Selection
1. Validate input parameters against technical feasibility and design system guidelines.
2. Select implementation pattern matching component or campaign architecture.
3. Establish verification rules and accessibility / conversion thresholds.
4. Formulate atomic step-by-step execution sequence.
5. Create temporary working directory if needed.

### Phase 3: Core Step-by-Step Implementation Execution
1. Author primary specification document at `docs/user-journey-mapping/spec.md`.
2. Generate code, token, or layout implementation files.
   ```bash
   npm run typecheck
   ```
3. Apply automated formatting and linting tools.
4. Execute unit or visual regression tests.
   ```bash
   npm test
   ```
5. Refactor asset structure for optimal performance and maintainability.

### Phase 4: Verification, Testing & Quality Gate Checking
1. Run full project verification suite.
   ```bash
   npm run typecheck && npm test && npm run build
   ```
2. Verify zero lint errors, type warnings, or broken references.
3. Execute CLI health doctor check.
   ```bash
   node dist/cli.js doctor
   ```
4. Assert all acceptance criteria are satisfied.

### Phase 5: Post-Execution Cleanup & Artifact Generation
1. Generate execution summary report at `reports/user-journey-mapping/summary.md`.
2. Clean up temporary build artifacts and scratch files.
3. Commit generated files to git repository.
   ```bash
   git add docs/user-journey-mapping/ reports/user-journey-mapping/
   git commit -m "feat(user-journey-mapping): implement User Journey Mapping playbook artifacts"
   ```
4. Publish documentation for team review.

## Code & Configuration Exemplars

### Exemplar 1: User Journey Mapping Configuration Specification
```yaml
version: "2.0.0"
metadata:
  skill: "user-journey-mapping"
  author: "agents-united"
rules:
  strictValidation: true
  reporting:
    format: "json"
    output: "reports/user-journey-mapping/summary.json"
```

### Exemplar 2: User Journey Mapping Helper Module
```typescript
export function runUserJourneyMapping(scope: string): boolean {
  console.log('Running User Journey Mapping on:', scope);
  return true;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in User Journey Mapping
1. **Diagnosis**: Specification or code asset fails validation rules in user-journey-mapping.
2. **Recovery Protocol**:
   - Step 1: Inspect error log at reports directory.
   - Step 2: Correct non-compliant syntax or structure.
   - Step 3: Re-run verification pipeline.

### Scenario B: Missing Resource for User Journey Mapping
1. **Diagnosis**: Target design token or configuration asset missing from workspace.
2. **Recovery Protocol**:
   - Step 1: Generate baseline resource file from standard template.
   - Step 2: Update configuration references.
   - Step 3: Resume runbook execution.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
