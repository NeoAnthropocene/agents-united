# ADR 0015: Planner-Orchestrator Mode for Tier-1 Domain Bundles

## Status

Proposed (2026-09-07). Decided via grilling session on branch `fix/domain-bundles-cline-projection-fix`; implementation plan to follow. Extends — does not supersede — [ADR 0014](0014-subagent-first-planning-loop.md), which remains in force for Organization Bundles.

> Records the decision that Tier-1 Domain Bundles adopt a **Planner-Orchestrator Mode** — solo planning with the user (direct skill consultation, no specialist spawns), delegated execution — as the Tier-1 variant of the Subagent-First framework, replacing ADR 0014's deferred "rollout the digital-agency pattern to remaining bundles" intent.

## Context

ADR 0014 made Lead Orchestrators delegate to specialists *by default during planning* and landed the Planning Dialogue Loop (Phase 0 User Alignment → Phase 0.5 Sidekick Clarification → Phase 1 Specialist Council → Phase 2 Delegation Map) on `digital-agency`, explicitly deferring rollout to the remaining domain bundles pending eval and manual testing.

That deferral created a decision point: should the deferred rollout copy the digital-agency pattern verbatim, or should Tier-1 Domain Bundles get a different posture? Architectural analysis (grilling session, 2026-09-07) says the sidekick/council mechanism is **redundant by design** for Tier-1:

1. **Single discipline.** A Tier-1 bundle covers one domain (`software-engineering`, `growth-marketing`, `deep-research`, …). Its Lead Orchestrator *is* the domain expert; the sidekick mechanism exists to inject knowledge the coordinator lacks — cross-discipline knowledge — which a same-discipline specialist cannot add.
2. **Shared skill pool.** Skills in `bundles.json` are bundle-level, not agent-level. The orchestrator draws from exactly the same skill pool as its specialists, and Cline natively discovers the canonical `.agents/skills/` store in every session (ADR 0013) — so the orchestrator can consult any domain skill directly, at planning time, without a specialist spawn.
3. **Lean token footprint.** Tier-1's design goal (CONTEXT.md: Domain Bundle) is a lean, self-contained unit. Council rounds and sidekick spawns spend tokens on dialogue that, in a single-discipline bundle, reproduces what the orchestrator + skills already know.
4. **Small rosters.** Tier-1 bundles carry 2–5 same-discipline specialists whose workflows the orchestrator already coordinates in its own prompt (e.g. `orchestrator-engineering.md` Phase 4).

This is an *architectural judgment*, not a fix for an observed digital-agency failure — the digital-agency manual rounds (Plan 012, Step 8) passed, and that bundle keeps its pattern.

The risk to contain: ADR 0014's root cause analysis showed Flash-class orchestrators drift toward solo **execution** whenever policy language permits it. Allowing solo planning must not reopen solo execution.

## Decision

1. **Mode discriminator.** `BundleDefinition.planningLoop` gains a `mode: 'subagent-first' | 'planner-orchestrator'` field. `digital-agency` migrates to explicit `mode: 'subagent-first'` (no rendering change). All ~30 Tier-1 Domain Bundles adopt `mode: 'planner-orchestrator'`. Excluded bundles: `universal-orchestration`, `universal-skills`, `full`, `mock-organization-under-construction`, `digital-agency`.
2. **Planner-Orchestrator Policy** (rendered into the coordinator rule for planner-orchestrator bundles, replacing the soft self-execution escape hatch):
   - **Phase 0 — User Alignment, solo.** Socratic grilling (`/grill-me`, `/grill-with-docs`) run by the orchestrator alone, consulting bundle skills directly as needed.
   - **No Phase 0.5, no Phase 1.** No Planning Sidekicks, no Specialist Council. The orchestrator composes the delegation map solo from its own domain expertise and skill runbooks.
   - **Phase 2 — Delegation Map, solo-composed**, presented to the user before execution, exactly as in ADR 0014.
   - **Execution delegation is mandatory.** ADR 0014's self-execution rule applies unchanged at execution: the coordinator completes specialist work in the main session only if `subagent_*` tools are genuinely absent or the task is trivial.
3. **Planning Aid Boundary (estimate vs. deliverable).** During planning, the orchestrator may consult skills and reason to give **provisional answers and estimates**; any **concrete deliverable** — data analysis, code, assets, documents — is specialist work, deferred to the delegation map for subagent execution. This boundary is what prevents solo planning from regressing into solo execution.
4. **Schema semantics.** `budget` and `sidekicks` are subagent-first-mode fields: there is no inter-agent planning dialogue to bound in planner-orchestrator mode, so they are not declared and not rendered. Renderer branches on `mode`; `planner-orchestrator` must never emit sidekick, council, or consultation-budget sections.
5. **Renderer purity and regression guarantee.** `renderTeamManifest`, `renderCoordinatorRule`, and `renderConfiguredAgent` stay pure; all values flow from `BundleDefinition`. Bundles without a `planningLoop` block render byte-identical to today (regression tests required, same shape as Plan 012).
6. **Roster prompts unchanged.** Tier-1 roster subagents remain pure executors; their canonical markdown is untouched in this change.
7. **Cross-host honesty (inherited from ADR 0014).** The Planner-Orchestrator Policy is universal prose rendered on every host; the physical dispatch mechanism remains host-specific (`subagent_*` tools on Cline; UI agent switching / host workflows on Antigravity; inert `maxIterations` on hosts that ignore it — documented, not faked).

## Consequences

- ~30 Tier-1 domain bundles' always-active Cline coordinator rules change from the soft escape hatch ("delegate when available … otherwise complete the role in the main session") to the Planner-Orchestrator Policy; solo planning becomes sanctioned, solo execution does not.
- The eval harness gains planner-orchestrator criteria: no specialist spawn during the user planning phase, a delegation map presented before execution, deliverables dispatched to `subagent_*` agents, provisional-not-concrete answers during planning.
- `digital-agency` behavior is unchanged (explicit `subagent-first` mode); regression tests must prove byte-identical rendering for the migration.
- The Consultation Budget and its caps remain meaningful only for subagent-first bundles; planner-orchestrator bundles carry no planning-dialogue budget.
- Two canonical delegation postures now coexist, selected per bundle by mode: **Subagent-First** (Organization Bundles, cross-discipline) and **Planner-Orchestrator** (Tier-1 Domain Bundles, single-discipline). `CONTEXT.md` registers the new ubiquitous terms (Planner-Orchestrator Mode, Planning Aid Boundary) and scopes the Planning Dialogue Loop's Phase 0.5/1 to subagent-first mode.
- Future Organization Bundles (`venture-studio` and successors) default to `subagent-first`; future Tier-1 bundles default to `planner-orchestrator`.
