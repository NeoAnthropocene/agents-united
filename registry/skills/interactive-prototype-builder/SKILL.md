---
name: interactive-prototype-builder
description: Production-grade Interactive Prototype Builder playbook with live
  URL preview cards, Storybook/Vite sandboxes, and visual side-by-side diffing.
metadata:
  author: agents-united
  version: 2.0.0
  icon: 🛠️
disable-slash-command: true
---

# Interactive Prototype Builder

## Overview & Purpose
The Interactive Prototype Builder skill provides a deterministic framework for constructing, previewing, and verifying high-fidelity interactive UI prototypes with live browser preview cards, state-driven interaction models, and visual side-by-side diffing.

Following this skill ensures high usability, visual consistency, rapid iteration, and complete cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request to build or refine interactive UI prototypes.
- Creating clickable mockups or Storybook sandboxes for stakeholder review.
- Standardizing interactive prototype workflows across design and engineering teams.
- Preparing design handoffs with live in-app preview cards.

### Prerequisites
- Project workspace configured with design system tokens or component libraries.
- Target UI design specification or wireframe spec.
- Testing, linting, and bundler/dev server tools operational.
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `target_scope` | String | Yes | Target UI component, page, or interaction scope |
| `config` | Object | Optional | Specific parameters and threshold configurations |
| `output_dir` | Directory Path | Optional | Destination directory for generated artifacts |
| `strict_mode` | Boolean | Optional | Enforce strict zero-warning validation |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Specification Document | `docs/interactive-prototype-builder/spec.md` | Full specification and guidelines document |
| Component / Asset Files | `src/components/*` | Implemented design tokens, components, or interactive assets |
| Live Preview URL Card | Markdown Block | In-app live preview link (`http://localhost:6006` or `http://localhost:5173`) |
| Visual Diff Report | `reports/interactive-prototype-builder/visual-diff.md` | Side-by-side visual diffs and region selection analysis |

## Step-by-Step Execution Runbook

### Phase 1: Pre-Execution Discovery & Workspace Analysis
1. Inspect workspace repository to locate relevant UI components, tokens, or campaign assets.
   ```bash
   find src/ docs/ -maxdepth 3 -type f
   ```
2. Analyze domain requirements and classify core UI elements, interaction flows, and reactive state transitions.
3. Establish baseline quality metrics, accessibility standards (WCAG 2.2 AA), and responsiveness targets.
4. Verify working tree status to ensure clean git workspace.
   ```bash
   git status --short
   ```
5. Formulate initial execution plan.

### Phase 2: Input Contract Validation & Strategy Selection
1. Validate input parameters against technical feasibility and design system guidelines.
2. Select implementation pattern matching component architecture (e.g. Radix UI primitives, Tailwind styling, Framer Motion transitions).
3. Establish verification rules and accessibility / conversion thresholds.
4. Formulate atomic step-by-step execution sequence.
5. Create temporary working directory if needed.

### Phase 3: Core Implementation & Live Preview Execution
1. Author primary specification document at `docs/interactive-prototype-builder/spec.md`.
2. Generate code, token, SVG, or interactive React/HTML component files.
3. Launch local development or Storybook server in background task (`manage_task`):
   ```bash
   npm run storybook -- --ci --port 6006
   ```
4. Emit Live Preview URL Card for Desktop preview pane:
   ```markdown
   > [!TIP]
   > **Interactive Component Preview**: [Open Storybook Live Canvas](http://localhost:6006)
   ```
5. Apply automated formatting and linting tools.
6. Execute visual regression tests and capture side-by-side SVG/image diffs.

### Phase 4: Verification, Visual Diffing & Quality Gate Checking
1. Perform side-by-side visual diff comparisons between baseline and generated component states.
2. Ingest region-selection feedback (bounding box coordinates and cropped image previews) to iteratively refine UI layout.
3. Run full project verification suite:
   ```bash
   npm run typecheck && npm test && npm run build
   ```
4. Verify zero accessibility violations (WCAG 2.2 AA) and zero broken layout references.
5. Execute CLI health doctor check.
   ```bash
   node dist/cli.js doctor
   ```

### Phase 5: Post-Execution Cleanup & Artifact Generation
1. Generate execution summary report at `reports/interactive-prototype-builder/summary.md`.
2. Clean up temporary build artifacts and scratch files.
3. Commit generated files to git repository.
   ```bash
   git add docs/interactive-prototype-builder/ reports/interactive-prototype-builder/
   git commit -m "feat(interactive-prototype-builder): implement Interactive Prototype Builder playbook artifacts"
   ```
4. Publish documentation for team review.

## Code & Configuration Exemplars

### Exemplar 1: Interactive Prototype Builder Configuration Specification
```yaml
version: "2.0.0"
metadata:
  skill: "interactive-prototype-builder"
  author: "agents-united"
rules:
  strictValidation: true
  livePreview:
    port: 6006
    urlPattern: "http://localhost:6006"
  reporting:
    format: "json"
    output: "reports/interactive-prototype-builder/summary.json"
```

### Exemplar 2: Interactive Prototype Builder Helper Module
```typescript
export function runInteractivePrototypeBuilder(scope: string): boolean {
  console.log('Running Interactive Prototype Builder on:', scope);
  return true;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Port Collision on Live Preview Server
1. **Diagnosis**: Storybook/Vite server fails to bind to target port (e.g. 6006 already in use).
2. **Recovery Protocol**:
   - Step 1: Detect collision and allocate next ephemeral port (`6007`+).
   - Step 2: Update Live Preview URL Card link in the orchestration report.
   - Step 3: Verify preview health endpoint responds with HTTP 200.

### Scenario B: Visual Regression Diff Exceeds Threshold
1. **Diagnosis**: Generated component rendering differs from baseline beyond allowable pixel delta (>0.5%).
2. **Recovery Protocol**:
   - Step 1: Inspect region-selection bounding box coordinates in the visual diff artifact.
   - Step 2: Adjust CSS layout tokens, typography, or padding to match design spec.
   - Step 3: Re-capture snapshot and assert zero visual regression.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Live preview URL card format and visual diffing steps documented.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
