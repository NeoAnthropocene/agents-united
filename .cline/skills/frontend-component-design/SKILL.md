---
name: frontend-component-design
description: Production-grade Frontend Component Design playbook for reusable,
  accessible UI primitives in React, Vue, and Web Components.
metadata:
  author: agents-united
  version: 2.0.0
---
<!-- managed-by: agents-united | profile: cline | canonical: skills/frontend-component-design/SKILL.md | do not edit -->

# Frontend Component Architecture, Accessibility & Storybook Playgrounds

## Overview & Purpose
The Frontend Component Architecture, Accessibility & Storybook Playgrounds skill provides a deterministic, battle-tested framework for executing frontend-component-design processes across the Agents United multi-agent ecosystem.

Following this skill ensures high quality, zero-regression execution, rigorous testing gates, and seamless cross-functional team alignment.

## Execution Triggers & Prerequisites
### Execution Triggers
- Direct request or workflow step invoking frontend-component-design.
- Auditing, implementing, or standardizing frontend-component-design procedures.
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
| Specification Document | `docs/frontend-component-design/spec.md` | Full technical specification and architectural plan |
| Implementation Files | `src/frontend-component-design/*` | Production-ready source code, tests, and configurations |
| Execution Report | `reports/frontend-component-design/summary.json` | Verification metrics, test results, and audit summary |

## Step-by-Step Execution Runbook

### Phase 1: Component API Design & Props Interface
1. Define component prop types in TypeScript with strict discrimination unions.
2. Establish single responsibility: separate layout containers from atomic UI primitives.
3. Support composability via asChild / slot patterns or polymorphic as props.
4. Ensure standard HTML attribute passthrough and forwardRef propagation.
5. Avoid boolean prop explosion by using typed union variants (variant="primary").

### Phase 2: Accessibility & Keyboard Navigation Specification
1. Assign appropriate WAI-ARIA roles, states, and properties (aria-expanded, aria-controls).
2. Implement complete keyboard interaction models according to W3C APG guidelines.
3. Ensure explicit, high-contrast :focus-visible styling on all interactive elements.
4. Manage focus trapping and restoration for modal dialogs and flyout menus.
5. Verify screen reader announcements for dynamic state transitions.

### Phase 3: Styling & Design Token Integration
1. Bind component styles strictly to semantic design tokens (var(--color-brand-primary)).
2. Ensure zero hardcoded magic numbers or hex colors in stylesheet.
3. Implement fluid responsiveness using CSS container queries and clamp().
4. Provide seamless dark/light theme adaptation via CSS custom property overrides.
5. Enforce prefers-reduced-motion fallbacks for all transitions and micro-animations.

### Phase 4: Storybook Documentation & Interactive Playground
1. Create Storybook CSF3 story file with interactive Controls (argTypes).
2. Author stories covering all variants, sizes, edge-case text lengths, and error states.
3. Write accessibility regression tests using @storybook/addon-a11y.
4. Include MDX documentation with copy-paste code snippets and UX usage guidelines.
5. Validate visual regression snapshots.

### Phase 5: Automated Testing & Packaging
1. Author unit tests with Testing Library verifying rendering, user events, and accessibility.
2. Verify zero console errors or hydration mismatch warnings.
3. Export component from package entrypoint index.
4. Run typecheck and build validation.
5. Publish component to shared internal UI library.

## Code & Configuration Exemplars

### Exemplar 1: Frontend Component Architecture, Accessibility & Storybook Playgrounds Configuration & Specification
```yaml
import React, { forwardRef } from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || isLoading}
    className={clsx('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
    aria-busy={isLoading}
    {...props}
  >
    {isLoading ? <span className="ui-spinner" aria-hidden="true" /> : children}
  </button>
));
```

### Exemplar 2: Frontend Component Architecture, Accessibility & Storybook Playgrounds TypeScript Type Contract
```typescript
export interface ComponentSpecification {
  name: string;
  variants: string[];
  sizes: string[];
  interactiveStates: ['default', 'hover', 'focus-visible', 'active', 'disabled', 'loading'];
  ariaRoles: string[];
  keyboardInteractions: Record<string, string>;
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Validation Failure in Frontend Component Architecture, Accessibility & Storybook Playgrounds
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
