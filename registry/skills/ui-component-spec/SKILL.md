---
name: ui-component-spec
description: Production-grade Ui Component Spec playbook for design operations, UX systems, and growth strategy.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Ui Component Spec

## Overview & Purpose
The Ui Component Spec skill provides a deterministic framework for executing ui component spec processes in modern software products.

Following this skill ensures high usability, visual consistency, rapid iteration, and complete cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request to execute Ui Component Spec tasks.
- Auditing existing product assets or workflows.
- Standardizing ui-component-spec procedures across team projects.
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
| Specification Document | `docs/ui-component-spec/spec.md` | Full specification and guidelines document |
| Component / Asset Files | `src/ui-component-spec/*` | Implemented design tokens, components, or campaign assets |
| Audit Report | `reports/ui-component-spec/summary.json` | Health check and audit metric results |

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
1. Author primary specification document at `docs/ui-component-spec/spec.md`.
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
1. Generate execution summary report at `reports/ui-component-spec/summary.md`.
2. Clean up temporary build artifacts and scratch files.
3. Commit generated files to git repository.
   ```bash
   git add docs/ui-component-spec/ reports/ui-component-spec/
   git commit -m "feat(ui-component-spec): implement Ui Component Spec playbook artifacts"
   ```
4. Publish documentation for team review.

## Code & Configuration Exemplars

### Exemplar 1: Ui Component Spec Configuration Specification
```yaml
version: "2.0.0"
metadata:
  skill: "ui-component-spec"
  author: "agents-united"
rules:
  strictValidation: true
  reporting:
    format: "json"
    output: "reports/ui-component-spec/summary.json"
```

### Exemplar 2: Ui Component Spec Helper Module
```typescript
export function runUiComponentSpec(scope: string): boolean {
  console.log('Running Ui Component Spec on:', scope);
  return true;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Ui Component Spec
1. **Diagnosis**: Specification or code asset fails validation rules in ui-component-spec.
2. **Recovery Protocol**:
   - Step 1: Inspect error log at reports directory.
   - Step 2: Correct non-compliant syntax or structure.
   - Step 3: Re-run verification pipeline.

### Scenario B: Missing Resource for Ui Component Spec
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
