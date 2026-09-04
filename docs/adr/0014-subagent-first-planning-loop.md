# ADR 0014: Subagent-First Orchestration & Bounded Planning Dialogue

## Status

Accepted (2026-09-04). Implementation follows [plans/012-subagent-first-planning-loop.md](../../plans/012-subagent-first-planning-loop.md).

> Records the decision to make Lead Orchestrators delegate to their bundle's specialist subagents **by default during planning** (not only during execution), and to bound inter-specialist discussion with a declarative Consultation Budget plus a host-enforced hard cap. Maintainer-approved as "Option B: Declarative Manifest Budget → Rendered Protocol + Host Hard-Cap Layer" (2026-09-04). Initial scope: the `digital-agency` bundle only (opt-in flag); rollout to other domain bundles is a follow-up plan after virtual (eval) and manual testing.

## Context

Orchestration agents — especially on Flash-class models — have a strong tendency to operate solo: they plan and execute specialist work themselves instead of using the bundle's subagents. This defeats the hierarchical orchestrator-subagent architecture (ADR 0004) and the Cline Native Activation model (ADR 0013), where specialist roles are projected as spawnable `subagent_*` tools precisely so the coordinator uses them. Root causes verified at commit `55e7593`:

1. **The escape hatch lives in the always-active rule.** `ClineProjector.renderCoordinatorRule` (`src/core/cline-projector.ts:236-243`) renders the Activation Protocol into `.cline/rules/agents-united-<bundle>.md` — the only prompt loaded in *every* Cline session — and says to delegate "when available … otherwise complete the role in the main session." The same hedge appears in the projected configured-agent `runtimeNote` (line 31). On Flash models the path of least resistance is always self-execution.
2. **Delegation happens after planning, never during.** In `registry/agents/orchestrator-marketing.md` (the digital-agency coordinator), Phases 1–2 (discovery + strategy) are performed entirely by the orchestrator; specialists first appear in "Phase 3: Subagent Delegation & Campaign Execution". Subagents never participate in forming the plan.
3. **Subagents are pure executors.** Roster agents (e.g. `subagent-marketing-growth-strategist.md`) have fixed executor protocols with no planning-consultation mode, no peer-addressing protocol, and no dependency declaration on other specialists' outputs.
4. **No budget of any kind exists.** Neither the canonical prompts, the `ClineTeamManifest` schema (`types.ts:101-114`), nor `renderConfiguredAgent` carry any discussion caps. Cline's configured-agent frontmatter supports `maxIterations` (ADR 0013) — a real host-enforced per-invocation cap — which we never emit.
5. **Persona/tool mismatch.** The 6 `workflow-agency-*.md` files address personas (`chris-director`, `ava-manager`, `kaan-copy`, `jamileh-design`, `yavuz-content`, `jale-social`), but `bundles.json` installs the generic roster (`subagent-marketing-growth-strategist`, …). A Flash orchestrator following a workflow is told to message agents that do not exist as spawnable tools.

Constraints: a literal cross-host token counter is impossible (hosts do not expose token accounting for subagent tool calls), so caps must be *structural* plus the one true hard cap the verified host (Cline 3.0.61) provides. All behavior must be rendered from the canonical store — never hand-edited in generated projections (ADR 0008).

## Decision

1. **Opt-in per-bundle flag.** `BundleDefinition` gains an optional `planningLoop` block (`enabled`, `budget`, `sidekicks`) and an optional `personaAliases` map. Only `digital-agency` enables it in this change. Bundles without the flag render **byte-identical** coordinator rules, team manifests, and configured-agent `.yml` files to today (regression guarantee).
2. **Three enforcement layers, one canonical source:**
   - **Declarative Consultation Budget** (`bundles.json` → rendered into the coordinator rule, team manifest, and subagent prompts) — persuasive structural caps on every host: `maxPlanningRounds`, `maxPeerExchangesPerPair`, `summaryWordCap`.
   - **Host hard cap** — `maxIterations` (default 8) rendered into configured-agent `.yml` frontmatter for planning-loop bundles. On Cline this bounds each specialist's per-invocation run; on hosts that ignore it, it is documented as inert (ADR 0008 graceful degradation — documented, not faked).
   - **Canonical prompt protocol** — the Planning Dialogue Loop authored in the orchestrator and roster subagent markdown, cross-host.
3. **Planning Dialogue Loop** (mandatory, replacing the soft escape hatch for planning-loop bundles): Phase 0 User Alignment (`/grill-me` for strategy, `/grill-with-docs` for code/docs), Phase 0.5 Sidekick Clarification (spawn ≤ `sidekicks.max` relevant specialists *into* the planning conversation; they advise the orchestrator, who relays to the user), Phase 1 Specialist Council (every relevant specialist returns a bounded Scope-of-Work Statement: scope, peer inputs needed, deliverable per its own workflows, ≤2 open questions), Phase 2 Delegation Map (task→specialist map synthesized and presented to the user before execution).
4. **Self-execution rule.** The coordinator completes specialist work in the main session only if (a) the `subagent_*` tools are genuinely absent from the runtime, or (b) the task is trivial (single-file read, one-line answer, formatting). Never as a convenience or speed choice.
5. **Persona alias map.** Declared in `bundles.json` (`personaAliases`), rendered into the coordinator rule as a "Persona → spawnable tool" table, so agency workflows keep their AstrolabsAI branding while spawn targets stay canonical. Workflow texts are also updated to pair canonical tool names with personas in parentheses.
6. **Renderer purity.** `renderTeamManifest`, `renderCoordinatorRule`, and `renderConfiguredAgent` remain pure functions; all values flow in via `BundleDefinition`. The Team Manifest keeps `schemaVersion: 1` (new fields optional).

## Consequences

- Digital-agency sessions start with a team roster presentation and a delegation-first promise; the always-active Cline rule now mandates the Planning Dialogue Loop instead of offering an unconditional self-execution fallback.
- Inter-specialist chatter is bounded two ways: the rendered Consultation Budget (all hosts) and `maxIterations` (Cline hard cap). Budget numbers are tunable in one place (`bundles.json`) without prompt edits.
- Specialists gain a Planning Consultation Mode (bounded Scope-of-Work Statements, ≤2 open questions) and a Peer Clarification Protocol (≤1 directed question to ≤1 peer per round); their executor protocols are unchanged otherwise.
- Non-planning-loop bundles are unaffected by construction, verified by byte-identical regression tests in `tests/cline-projector.test.ts`.
- The Stream-JSON eval harness gains planning-loop criteria (delegation-first, budget compliance, council scope statements, delegation map before execution) in the Two-Stage Hybrid Evaluator; budget-overflow adversarial scenarios gate regressions.
- Cross-host honesty: on Antigravity, Claude Code, Cursor, OpenCode, and Codex, `maxIterations` and any Cline-specific team mechanics do not execute; the rendered prose protocol and budget still apply. `CONTEXT.md` registers the new ubiquitous terms (Subagent-First Delegation Policy, Planning Dialogue Loop, Planning Sidekick, Specialist Council, Scope-of-Work Statement, Consultation Budget).
- Rollout to the remaining 25 bundles is intentionally deferred to a follow-up plan gated on virtual (eval) and maintainer manual test results.
