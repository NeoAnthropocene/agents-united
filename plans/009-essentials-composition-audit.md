# Plan 009: Essentials Bundle Composition Audit & Decomposition

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a5f8fb..HEAD -- registry/bundles.json src/cli.ts tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/003-cli-core-engine-and-manifest-tracking.md
- **Category**: tech-debt / architecture
- **Planned at**: commit `8a5f8fb`, 2026-08-17
- **Issue**: None

---

## Why this matters

Agents United adheres to the **Essentials-First Install Model** (`CONTEXT.md`): every department domain must install a minimal viable team containing only core orchestrators and everyday skills. Two bundles currently violate this principle and are tagged `status: "needs-audit"`:

1. **`software-engineering` (26 skills)** — carries 6 universal meta-skills that should live in a shared `universal-skills` baseline, plus 4 addon-specific skills already declared in their proper addons.
2. **`product-design` (8 agents, 21 workflows, 21 skills)** — monolithic dump with zero addon sub-bundles, forcing every design install to load specialized DesignOps, Design Systems, and Research/Prototyping capabilities.

This plan resolves both: creates a `universal-skills` bundle positioned at the top of the TUI as `[Recommended]`, places `universal` at the beginning of the department domain order, slims `software-engineering` to 16 core skills, decomposes `product-design` into Essentials + 2 merged addons, and transitions both to `status: "stable"`.

---

## Current state

### 1. `software-engineering` Forensic Skill Classification (26 skills)

| Classification | Count | Skills |
|---|---|---|
| **Universal Meta-Skills** | 6 | `grill-me`, `grill-with-docs`, `domain-modeling`, `to-spec`, `to-tickets`, `handoff` |
| **Addon Leaks** (already in proper addon) | 4 | `docker-deployment` (in `devops-engineering`), `frontend-component-design` (in `frontend-engineering`), `microservices-architecture` (in `backend-distributed-systems`), `graphql-schema-design` (in `backend-distributed-systems`) |
| **Core Essentials** (keep) | 16 | `architecture-design`, `backend-api-design`, `code-refactoring`, `database-design`, `dependency-management`, `diagnosing-bugs`, `finishing-a-development-branch`, `git-guardrails`, `performance-optimization`, `receiving-code-review`, `requesting-code-review`, `security-audit`, `subagent-driven-development`, `systematic-debugging`, `technical-documentation`, `test-driven-development` |

**Confirmation**: All 4 "addon leak" skills already exist in their destination addon bundles:
- `docker-deployment` → `devops-engineering` (bundles.json:480) ✓
- `frontend-component-design` → `frontend-engineering` (bundles.json:567) ✓
- `microservices-architecture` → `backend-distributed-systems` (bundles.json:594) ✓
- `graphql-schema-design` → `backend-distributed-systems` (bundles.json:595) ✓

### 2. `product-design` Forensic Agent Classification (8 agents)

| Classification | Agents | Rationale |
|---|---|---|
| **Core Essentials** (keep in base) | `subagent-ui-designer`, `subagent-ux-strategist`, `subagent-interaction-designer` | UI design, UX strategy, and interaction design are fundamental to every design task. Interaction design covers micro-interactions, error flows, and state mapping — needed day-to-day. |
| **Design Systems & Ops** (merge into 1 addon) | `subagent-design-systems-architect`, `subagent-design-ops-lead` | Token governance, component libraries, version control, and handoff specs are tightly coupled. A design-systems-architect without ops workflow support is incomplete, and vice versa. |
| **Research & Prototyping** (merge into 1 addon) | `subagent-design-researcher`, `subagent-designer-toolkit-expert`, `subagent-prototype-tester` | Research flows directly into prototyping and testing. The researcher creates test plans, the toolkit expert builds interactive prototypes, and the prototype-tester validates them. These three form a natural discovery-validation pipeline. |

---

## Target Architecture

### A. New Bundle: `universal-skills` (Shared Meta-Skills Baseline — `[Recommended]`)

```json
{
  "name": "universal-skills",
  "domain": "universal",
  "category": "Shared Meta-Skills & Cross-Domain Utilities",
  "aliases": ["meta-skills", "universal-meta", "meta"],
  "description": "Domain-agnostic meta-skills shared across all orchestrators: Socratic grilling, spec generation, handoff, and domain modeling",
  "skills": [
    "grill-me",
    "grill-with-docs",
    "domain-modeling",
    "to-spec",
    "to-tickets",
    "handoff"
  ],
  "version": "1.0.0"
}
```

### B. TUI Ordering & Recommendation Enhancements
1. **Department Domain Selection in `agents add` & `agents list`**:
   - `universal` is moved to the **top** of the department order:
     `['universal', 'engineering', 'architecture', 'design', 'marketing', 'security', 'research', 'business']`
2. **`universal-skills` TUI Badge**:
   - Renders with a prominent `⭐ [Recommended Baseline]` badge in interactive selection and list output.

### C. `software-engineering` → Slim Essentials (Status: `stable`)

**Remove 10 skills** (6 universal + 4 addon leaks). **Retain 16 core skills**:
```
architecture-design, backend-api-design, code-refactoring, database-design,
dependency-management, diagnosing-bugs, finishing-a-development-branch,
git-guardrails, performance-optimization, receiving-code-review,
requesting-code-review, security-audit, subagent-driven-development,
systematic-debugging, technical-documentation, test-driven-development
```

### D. `product-design` → Slim Essentials + 2 Merged Addons

#### `product-design` (Essentials Base — Status: `stable`)
- **Agents (3)**: `subagent-ui-designer.md`, `subagent-ux-strategist.md`, `subagent-interaction-designer.md`
- **Workflows (8)**: `workflow-design-orchestrate.md`, UI design workflows (`color-palette`, `design-screen`, `responsive-audit`, `type-system`), UX strategy `strategize`, and interaction design (`design-interaction`, `error-flow`, `map-states`)
- **Skills (7)**: `ui-component-spec`, `user-flow-mapping`, `mobile-first-design`, `responsive-design-audit`, `interaction-pattern-library`, `micro-interaction-design`, `state-driven-ui-animation`
- **`recommendedAddons`**: `["design-systems-ops", "design-research-testing"]`

#### Addon 1: `design-systems-ops` (`parentBundle: "product-design"`)
- **Agents (2)**: `subagent-design-systems-architect.md`, `subagent-design-ops-lead.md`
- **Workflows (6)**: `workflow-design-systems--audit-system.md`, `workflow-design-systems--create-component.md`, `workflow-design-systems--tokenize.md`, `workflow-design-ops--handoff.md`, `workflow-design-ops--plan-sprint.md`, `workflow-design-ops--setup-workflow.md`
- **Skills (7)**: `design-system-tokens`, `design-tokens-management`, `design-system-governance`, `component-library-management`, `design-ops-workflow`, `design-version-control`, `design-handoff-spec`

#### Addon 2: `design-research-testing` (`parentBundle: "product-design"`)
- **Agents (3)**: `subagent-design-researcher.md`, `subagent-designer-toolkit-expert.md`, `subagent-prototype-tester.md`
- **Workflows (7)**: `workflow-ux-strategy--benchmark.md`, `workflow-ux-strategy--frame-problem.md`, `workflow-prototyping-testing--evaluate.md`, `workflow-prototyping-testing--experiment.md`, `workflow-prototyping-testing--prototype-plan.md`, `workflow-prototyping-testing--test-plan.md`
- **Skills (8)**: `usability-testing-protocol`, `accessibility-audit`, `user-journey-mapping`, `user-flow-mapping`, `interactive-prototype-builder`, `clickable-prototype-spec`, `component-playground-setup`, `ai-prototype-refactoring`

---

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Tests | `npm test` | exit 0, all test suites pass |
| List | `node dist/cli.js list` | Shows updated department structure with Universal at top |

---

## Scope

**In scope**:
- `registry/bundles.json` — Add `universal-skills`, slim `software-engineering` (remove 10 skills, set `stable`), decompose `product-design` into Essentials + 2 addons (set `stable`), add `design-systems-ops` and `design-research-testing`.
- `src/cli.ts` — Put Universal department first in domain order; add `BUNDLE_DISPLAY_NAMES` entries for `universal-skills` (with Recommended badge), `design-systems-ops`, `design-research-testing`.
- `tests/` — Update bundle count, skill count, and addon resolution assertions.
- `README.md`, `PROJECT.md`, `ROADMAP.md`, `CONTEXT.md` — Reflect updated catalog structure and mark Milestone 1 tasks as done.

**Out of scope**:
- Individual markdown agent prompts (`registry/agents/*.md`) or skill runbook files (`registry/skills/**/*.md`).
- The `full` bundle — it aggregates everything dynamically and does not need manual adjustment.

---

## Steps

### Step 1: Add `universal-skills` bundle to `registry/bundles.json`
Add a new bundle definition for `universal-skills` in the `universal` domain containing the 6 meta-skills.

**Verify**: `npm test -- tests/registry.test.ts` → all pass.

### Step 2: Slim `software-engineering` in `registry/bundles.json`
1. Remove the 6 universal meta-skills and 4 addon-leak skills from `bundles["software-engineering"].skills`.
2. Set `bundles["software-engineering"].status = "stable"`.
3. The remaining 16 skills are the lean core.

**Verify**: `npm test -- tests/registry.test.ts` → all pass. Confirm skill count is 16.

### Step 3: Decompose `product-design` into Essentials + 2 Addons
1. Update `bundles["product-design"]`:
   - Keep 3 core agents: `subagent-ui-designer.md`, `subagent-ux-strategist.md`, `subagent-interaction-designer.md`.
   - Keep 8 core workflows.
   - Keep 7 core skills.
   - Add `recommendedAddons: ["design-systems-ops", "design-research-testing"]`.
   - Set `status: "stable"`.
2. Add `design-systems-ops` addon (2 agents, 6 workflows, 7 skills, `parentBundle: "product-design"`).
3. Add `design-research-testing` addon (3 agents, 7 workflows, 8 skills, `parentBundle: "product-design"`).

**Verify**: `npm test -- tests/registry.test.ts` → all pass. `node dist/cli.js list` shows Product Design with 1 Essentials + 2 addons.

### Step 4: Register Display Metadata & TUI Ordering in `src/cli.ts`
1. Move `universal` to the beginning of `domainMeta` and `domainOrder`.
2. Add `BUNDLE_DISPLAY_NAMES` entries for:
   - `universal-skills`: "Universal Meta-Skills ⭐ [Recommended]", summary: "Domain-agnostic Socratic grilling, spec generation, handoff, and domain modeling"
   - `design-systems-ops`: "Design Systems & Ops Team", summary: "Token governance, component libraries, version control & handoff workflows"
   - `design-research-testing`: "Design Research & Testing Team", summary: "Usability testing, user journey mapping, interactive prototypes & AI prototype refactoring"

**Verify**: `node dist/cli.js list` → renders Universal at the top, showing Recommended badge.

### Step 5: Update Documentation & Roadmap
1. `ROADMAP.md` — Mark Milestone 1 Part A tasks as done. Add `universal-skills` extraction to completed items.
2. `README.md` — Update department catalog to show Product Design with 2 addons and Universal Department with `universal-skills`.
3. `PROJECT.md` — Update catalog tree and feature inventory.
4. `CONTEXT.md` — Add `Universal Meta-Skills Bundle` entry to ubiquitous dictionary.

**Verify**: `npm run build && npm test` → 100% pass across all test files.

---

## Done criteria

- [ ] `universal-skills` bundle exists with 6 meta-skills, no agents, no orchestrator.
- [ ] `universal` department appears first in interactive wizard and `agents list` output.
- [ ] `universal-skills` is tagged as `[Recommended]` in the TUI.
- [ ] `software-engineering` has `status: "stable"` with exactly 16 skills (no universal, no addon leaks).
- [ ] `product-design` has `status: "stable"` with 3 core agents and `recommendedAddons: ["design-systems-ops", "design-research-testing"]`.
- [ ] `design-systems-ops` exists with 2 agents and 7 skills.
- [ ] `design-research-testing` exists with 3 agents and 8 skills.
- [ ] All test suites pass (`npm test`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If removing skills from `software-engineering` causes `tests/e2e-skills-depth.test.ts` to fail because it asserts on the total skill count across the Essentials bundle, update the assertion to match the new 16-skill count.
- If adding 3 new bundles causes `tests/registry.test.ts` to fail on total bundle count assertions, update them to the new count.
- If the `full` bundle dynamically aggregates and any skill appears orphaned, trace whether it was correctly migrated to an addon or `universal-skills`.
