# Agents United - Implementation Plan Index

This directory contains self-contained implementation plans for building the **`agents-united`** ecosystem CLI, Antigravity 2.0 custom agent definitions, registry bundles, test suite (TDD), and automated CI/CD npm publishing pipeline.

## Execution Order & Status

| Plan | Title | Category | Status | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| [001](./001-project-setup-and-ci-release.md) | Project Scaffolding & Semantic Release CI | Tooling / CI | **READY** | None |
| [002](./002-antigravity-2-agent-skills-workflows-porting.md) | Antigravity 2.0 Schema Porting & Bundles Hierarchy | Core / Architecture | **READY** | 001 |
| [003](./003-cli-core-engine-and-manifest-tracking.md) | CLI Command Engine & Lockfile Manifest Manager | Core Engine | **READY** | 001, 002 |
| [004](./004-tdd-unit-and-integration-suite.md) | TDD Test Suite (Unit & E2E) | Testing (TDD) | **READY** | 001, 003 |
| [005](./005-scope-and-installation-methods.md) | Installation Scope & Methods | CLI / Scope | **READY** | 001, 003 |
| [006](./006-sync-agent-structure-documentation.md) | Sync Agent Structure & Documentation | Documentation | **DONE** | None |
| [007](./007-universal-multi-agent-host-projection.md) | Universal Multi-Agent Host Projection (`.agents/` → Claude/Cursor/Cline/OpenCode/Codex) | Core / Architecture | **DONE** | 003, 005 |
| [008](./008-cline-native-projection-and-team-activation.md) | Cline-Native Compound Projection & Smart Team Activation | Core / Runtime Integration | **DONE** | 007 |
| [009](./009-essentials-composition-audit.md) | Essentials Bundle Composition Audit & Decomposition (`software-engineering` & `product-design`) | Tech Debt / Architecture | **DONE** | 003 |
| [010](./010-antigravity-august-features-and-department-expansion.md) | Antigravity August 2026 Features Adoption & Department Subagent Ecosystem Expansion | Core / Architecture | **DONE** | 002, 007, 009 |
| [011](./011-cline-plugins-projection-migration.md) | Migrate Cline Projection to Native Plugins (v4.0.0+) | Core / Runtime Integration | **DONE** | 008 |
| [012](./012-subagent-first-planning-loop.md) | Subagent-First Orchestration & Bounded Planning Dialogue (`digital-agency` first) | Runtime Integration / Catalog / Evals | **DONE** (Cline + Antigravity manual rounds complete; desktop `invoke_subagent` harness limitation documented in ADR 0009) | 008 |
| [013](./013-planner-orchestrator-mode-for-domain-bundles.md) | Planner-Orchestrator Mode for Tier-1 Domain Bundles (ADR 0015) | Runtime Integration / Catalog / Evals | **DONE** (Cline manual rounds complete; subagent auth errors are a Cline account issue, not a code defect) | 012 |
| [014](./014-workflows-to-skills-migration.md) | Workflows to Skills Complete Cutover & Ecosystem Migration (ADR 0016) | Core / Catalog / Migration | **DONE** | 013 |
| [015](./015-workflow-runtime-enforcement-and-rules-projection.md) | Workflow Runtime Enforcement, Dynamic Rules Resolution & Cross-Client Projection Hardening | Core / Runtime Integration / Catalog | **DONE — all open items closed** (peer-reviewed; C1–C9 applied; Steps 1–6a; 015c `projectedTo` reconcile; 015d doctor workflow-skill counting; 015e catalog portability + stale-vs-missing classification; 015b renderer-backed staleness detection — **ADR 0017**). Suite: `doctor` 17/17, catalog guards 31/31, regressions 120/120 + 51/51; `tsc` clean, tsup build success; both real workspaces 0 warnings. **Live-Cline multi-file rule loading empirically confirmed** via canary probe (Cline 3.0.62, `toolCallCount: 0` invariant) | 014, 008 |
| [016](./016-claude-code-projection.md) | Claude Code Projection Architecture — Compound Lane, Launcher Parity & Opt-In Extras (ADR 0018) | Core / Runtime Integration | **READY — approved, not started** (planned at `b9f9a78`; amended 2026-09-21 at `dcbba4b`: dialect-codex-ready `CLAUDE_DIALECT` constant, deterministic body-tool rewrite + lint, Translation Ledger emission; **v1 rollout: Claude only** — see § Plan 016/017 execution order) | 007, 008, 013, 015 |
| [017](./017-host-dialect-codex-and-translation-ledger.md) | Host Dialect Codex, Declarative Overlays, Translation Ledger & Projection-Conformance CI (ADR 0019) | Core / Architecture / CI | **READY — approved, not started** (Option C approved 2026-09-21; **v1 = Claude dialect only**: canonical single-source retained, deterministic renderers stay translators of record — LLM is CI advisor/judge only, never install-time; Cline next on its own branch only after the verification gate; kimi/cursor/opencode/codex deferred) | 016 (Step 4 requires 016 DONE; Steps 0–3 may run in parallel) |

### Plan 008 execution order

Plan 008 corrects and extends only the Cline branch of Plan 007. Execute its milestones in order:
compatibility spike/ADR correction → typed compound projection → lifecycle migration → capability
probe/launcher → CLI/TUI → addon consent → doctor/docs. Do not start launcher work before compound
projection ownership and migration tests are green.

### Plan 016/017 execution order

Land **016 first** (the Claude compound lane). **017 second** — its Step 4 Claude-lane
refactor consumes 016's `CLAUDE_DIALECT` and must stay **byte-identical** to pre-refactor
output, pinned by golden snapshots captured before the refactor. 017 Steps 0–3
(Claude-lane inventory, ADR 0019, Red tests, dialect/ledger core) may proceed in parallel
with 016 execution; do not start 017 Step 4 until 016 is DONE.

**Rollout is Claude-only for v1.** Nothing outside the Claude lane may be touched on this
branch. The gate that unlocks Cline work is the § Rollout scope checklist in Plan 017:
automated suite green **plus** owner manual verification in Claude Code. Every other
provider (cursor, opencode, codex, kimi) gets its own branch and plan.

## Summary of Bundles Architecture

1. **`software-engineering`**:
   - Orchestrator: `orchestrator-engineering`
   - Subagents: `subagent-backend-architect`, `subagent-frontend-architect`, `subagent-code-reviewer`, `subagent-repo-index`
   - Workflows: `workflow-implement`, `workflow-test`, `workflow-review`, `workflow-build`, `workflow-cleanup`, `workflow-git`
   - Skills: `test-driven-development`, `systematic-debugging`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `finishing-a-development-branch`, `dependency-management`, `performance-optimization`

2. **`system-architecture`**:
   - Orchestrator: `orchestrator-system-architecture`
   - Subagents: `subagent-system-architect`, `subagent-backend-architect`
   - Workflows: `workflow-plan`, `workflow-design-code`, `workflow-estimate`, `workflow-spec-panel`
   - Skills: `architecture-design`, `writing-plans`, `executing-plans`, `confidence-check`

3. **`product-design`**:
   - Orchestrator: `orchestrator-design`
   - Subagents: `subagent-ui-designer`, `subagent-ux-strategist`, `subagent-interaction-designer`, `subagent-design-systems-architect`, `subagent-design-researcher`, `subagent-design-ops-lead`, `subagent-designer-toolkit-expert`, `subagent-prototype-tester`
   - Workflows: `workflow-design-orchestrate`, `workflow-ui-design--*`, `workflow-ux-strategy--*`, `workflow-interaction-design--*`, `workflow-design-systems--*`, `workflow-design-ops--*`, `workflow-prototyping-testing--*`
   - Skills: `ui-design`, `ux-strategy`, `interaction-design`, `design-systems`, `design-research`, `design-ops`, `designer-toolkit`, `prototyping-testing`

4. **`growth-marketing`**:
   - Orchestrator: `orchestrator-marketing`
   - Subagents: `subagent-marketing-growth-strategist`, `subagent-marketing-content-strategist`, `subagent-marketing-conversion-specialist`, `subagent-marketing-campaign-specialist`
   - Workflows: `workflow-marketing-panel`, `workflow-marketing-audit`, `workflow-marketing-campaign-builder`, `workflow-marketing-content-pipeline`, `workflow-marketing-growth-experiment`, `workflow-marketing-launch`
   - Skills: `campaign-strategy`, `copywriting`, `copy-editing`, `marketing-ideas`, `marketing-psychology`, `launch-strategy`, `pricing-strategy`, `page-cro`, `onboarding-cro`, `signup-flow-cro`, `popup-cro`, `paywall-upgrade-cro`, `form-cro`, `ab-test-setup`, `analytics-tracking`, `paid-ads`, `programmatic-seo`, `seo-audit`, `schema-markup`, `email-sequence`, `social-content`, `referral-program`, `competitor-alternatives`, `free-tool-strategy`

5. **`security-operations`**:
   - Orchestrator: `orchestrator-security`
   - Subagents: `subagent-security-engineer`
   - Workflows: `workflow-troubleshoot`, `workflow-analyze`
   - Skills: `security-review`, `confidence-check`

6. **`deep-research`**:
   - Orchestrator: `orchestrator-research`
   - Subagents: `subagent-deep-research`, `subagent-socratic-mentor`, `subagent-repo-index`
   - Workflows: `workflow-research`, `workflow-brainstorm`, `workflow-explain`
   - Skills: `deep-research`, `brainstorming`, `browser-agent`

7. **`business-strategy`**:
   - Orchestrator: `orchestrator-business`
   - Subagents: `subagent-business-panel-experts`
   - Workflows: `workflow-business-panel`, `workflow-spec-panel`, `workflow-recommend`, `workflow-estimate`
   - Skills: `writing-plans`, `confidence-check`

8. **`full` / `all`**: Complete unified suite of all orchestrators, subagents, workflows, and skills.

