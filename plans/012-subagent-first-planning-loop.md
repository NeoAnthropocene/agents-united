# Plan 012: Subagent-First Orchestration & Bounded Planning Dialogue (`digital-agency` first)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **USER GATE**: **LIFTED 2026-09-04** — the maintainer approved execution (Option B) and
> Steps 1–7 are implemented and verified (full suite 430 passed | 0 failures). Step 8
> (maintainer manual round) is partially complete: **Cline manual test passed**;
> Antigravity manual round pending.
>
> **Drift check (run first)**:
> `git diff --stat 55e7593..HEAD -- src/core/cline-projector.ts src/core/types.ts registry/bundles.json registry/agents/orchestrator-marketing.md tests/e2e-evals/ tests/cline-projector.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M/L
- **Risk**: MEDIUM (touches the always-active coordinator rule renderer used by every bundle; regression risk is contained by the opt-in flag and dedicated regression tests)
- **Depends on**: plans/008-cline-native-projection-and-team-activation.md, ADR 0013
- **Category**: runtime integration / catalog / evals
- **Planned at**: commit `55e7593`, 2026-09-04 (branch `feat/digital-agency-subagent-planning-loop`)
- **Issue**: None
- **Decision**: Option B (Declarative Manifest Budget → Rendered Protocol + Host Hard-Cap Layer), maintainer-approved 2026-09-04

---

## Why this matters

Orchestration agents — especially when running on Flash-class models — have a
strong tendency to **operate solo**: they plan and execute specialist work
themselves instead of delegating to the bundle's subagents. This defeats the
entire hierarchical orchestrator-subagent architecture (ADR 0004) and the
Cline Native Activation model (ADR 0013), where specialist roles are projected
as spawnable `subagent_*` tools precisely so the coordinator uses them.

The goal of this plan is a **closed planning-and-execution loop**:

1. **Plan with the user** — the orchestrator runs Socratic alignment
   (`/grill-me` or `/grill-with-docs`) on ambiguous briefs.
2. **Plan with the team** — the orchestrator spawns 1–2 relevant specialists
   as **Planning Sidekicks** to clarify ambiguity *during* planning, then runs
   a bounded **Specialist Council** in which every relevant specialist states
   what it will do (per its own workflows) before any execution starts.
3. **Execute by delegation** — the orchestrator synthesizes a delegation map
   and hands each specialist its scope.
4. **Bound the chatter** — inter-specialist discussion is capped by a
   declarative **Consultation Budget** (structural caps) plus a host-enforced
   hard cap (Cline `maxIterations`), so specialists can never converse
   indefinitely.

Scope is deliberately limited to the `digital-agency` bundle (opt-in flag);
after virtual (eval) and manual (maintainer) testing, a follow-up plan rolls
the pattern out to other domain bundles.

---

## Current state (verified at `55e7593`)

### 1. The escape hatch lives in the always-active rule

`src/core/cline-projector.ts:236-243` (`renderCoordinatorRule`) renders the
Activation Protocol into `.cline/rules/agents-united-<bundle>.md` — the only
prompt that is **always loaded in every Cline session**. It currently says:

> "2. Delegate specialist tasks using the configured `subagent_*` agent tools
> (projected under `.cline/agents/`) **when available**, assigning
> non-overlapping scopes; fall back to Agent Teams (`team_spawn_teammate`) or
> session subagents as needed. … otherwise complete the role in the main
> session." *(escape hatch also in `runtimeNote`, line 31)*

On Flash models the path of least resistance is always "not needed → I'll do
it myself". **This is the primary fix target.**

### 2. Delegation happens after planning, never during

`registry/agents/orchestrator-marketing.md` (the digital-agency coordinator):
Phases 1–2 (discovery + strategy) are performed entirely by the orchestrator;
subagents first appear in "Phase 3: Subagent Delegation & Campaign Execution".
Subagents never participate in forming the plan.

### 3. Subagents are pure executors

E.g. `registry/agents/subagent-marketing-growth-strategist.md`: fixed 4-phase
protocol with a rigid output format, and **no protocol** for (a)
planning-mode consultation, (b) addressing a peer, or (c) declaring
dependencies on another specialist's output. Same pattern across the
digital-agency roster.

### 4. No budget of any kind exists

Neither the canonical prompts, the Team Manifest schema
(`ClineTeamManifest`, `src/core/types.ts:101-114`), nor
`renderConfiguredAgent` (`cline-projector.ts:55-83`) carry any discussion
caps. Cline's configured-agent frontmatter supports **`maxIterations`**
(ADR 0013) — a real host-enforced per-invocation cap — which we never emit.

### 5. First-turn contract is tool-focused, not team-focused

`<mandatory_first_turn_response>` in `orchestrator-marketing.md:55-96`
spends its tokens on MCP inventory only; it never presents the team roster or
a delegation-first promise.

### 6. Persona/tool mismatch in the agency workflows

The 6 `registry/workflows/workflow-agency-*.md` files address personas
(`chris-director`, `ava-manager`, `kaan-copy`, `jamileh-design`,
`yavuz-content`, `jale-social`), but `registry/bundles.json` installs the
generic roster (`subagent-marketing-growth-strategist`, …,
`subagent-compliance-grc-specialist`). A Flash orchestrator following a
workflow is told to message agents that **do not exist as spawnable tools** —
a plausible extra reason it gives up and self-executes.

### 7. Schemas that must change

- `BundleDefinition` (`types.ts:51-68`) — no `planningLoop`, no persona map.
- `ClineTeamManifest` (`types.ts:101-114`) — no `planningLoop`, no personas.
- `bundles.json` `digital-agency` entry — orchestrator
  `orchestrator-marketing.md`, 9 agents, 6 workflows, 8 skills, no
  `planningLoop`, no `personaAliases`.

---

## Design (approved Option B)

Three enforcement layers, all rendered from one canonical source:

| Layer | Mechanism | Where enforced |
|---|---|---|
| **Declarative Consultation Budget** | `planningLoop.budget` in `bundles.json` → rendered into coordinator rule, team manifest, and subagent prompts | Every host (persuasive, structural caps) |
| **Host hard cap** | `maxIterations` in configured-agent `.yml` (default 8) | Cline 3.x only (per-invocation run bound; documented as ignored elsewhere, per ADR 0008/0013 graceful degradation) |
| **Canonical prompt protocol** | Planning Dialogue Loop (Phases 0 / 0.5 / 1) in orchestrator + subagent markdown | Every host |

**Approved defaults** (tunable in one place — `bundles.json`):

```jsonc
"planningLoop": {
  "enabled": true,
  "budget": {
    "maxPlanningRounds": 2,        // orchestrator↔council cycles per task
    "maxPeerExchangesPerPair": 2,  // directed questions per specialist pair
    "summaryWordCap": 150,        // per specialist scope statement
    "maxIterations": 8            // → configured-agent .yml hard cap
  },
  "sidekicks": { "max": 2 }
}
```

**Persona alias map** (approach (a) from grilling — branding preserved, tools
stay canonical), declared in `bundles.json` and rendered into the coordinator
rule as a "Persona → spawnable tool" table:

```jsonc
"personaAliases": {
  "chris-director": "orchestrator-marketing",
  "ava-manager": "subagent-marketing-growth-strategist",
  "kaan-copy": "subagent-marketing-conversion-specialist",
  "jamileh-design": "subagent-marketing-creative-designer",
  "yavuz-content": "subagent-marketing-content-strategist",
  "jale-social": "subagent-marketing-campaign-specialist"
}
```

**Planning Dialogue Loop** (inserted before current Phase 1 of the
coordinator; subagent-first is *mandatory*, not advisory):

- **Phase 0 — User Alignment**: ambiguous brief ⇒ run `/grill-me` (strategy)
  or `/grill-with-docs` (code/docs) with the user.
- **Phase 0.5 — Sidekick Clarification**: spawn ≤ `sidekicks.max` relevant
  specialists into the planning conversation to resolve remaining ambiguity;
  they advise the orchestrator, who relays to the user.
- **Phase 1 — Specialist Council**: every relevant specialist returns a
  bounded **Scope-of-Work Statement** (≤ `summaryWordCap` words): (1) my scope,
  (2) inputs I need from peers, (3) my deliverable per my workflow, (4) open
  questions (≤2). Peers may direct ≤ `maxPeerExchangesPerPair` questions to
  each other per pair per round.
- **Phase 2 — Delegation Map**: orchestrator synthesizes the council output
  into a task→specialist map presented to the user **before execution**.
- **Self-execution rule**: the coordinator may complete specialist work in the
  main session **only if** (a) the `subagent_*` tools are genuinely absent
  from the runtime, or (b) the task is trivial (single-file read, one-line
  answer, formatting). Never as a convenience or speed choice.

---

## Implementation steps

### Step 0: Confirm scope with the maintainer (USER GATE)

Execution starts only on explicit go-ahead. Defaults above apply unless the
maintainer amended them.

### Step 1: ADR 0014 + CONTEXT.md ubiquitous terms

1. Author `docs/adr/0014-subagent-first-planning-loop.md` — records the
   Option B decision: declarative Consultation Budget rendered into the
   always-active rule; `maxIterations` host hard-cap layer (Cline-only,
   gracefully degraded elsewhere); opt-in per-bundle `planningLoop` flag;
   persona alias map; canonical prompt protocol. Status: Accepted.
2. Add CONTEXT.md terms (domain dictionary): **Subagent-First Delegation
   Policy**, **Planning Dialogue Loop**, **Planning Sidekick**,
   **Specialist Council**, **Scope-of-Work Statement**,
   **Consultation Budget** (each with an `_Avoid_` line, per house style).
3. Register ADR 0014 in the `PROJECT.md` ADR index table and the plans index.

**Verify**: `npm test -- tests/domain-atlas-contract.test.ts` → all pass (no
Atlas impact).

### Step 2: Schema layer — `src/core/types.ts` + `registry/bundles.json`

1. `types.ts` — add:

   ```ts
   export interface ConsultationBudget {
     maxPlanningRounds: number;
     maxPeerExchangesPerPair: number;
     summaryWordCap: number;
     maxIterations: number;
   }
   export interface PlanningLoopConfig {
     enabled: boolean;
     budget?: ConsultationBudget;
     sidekicks?: { max: number };
   }
   ```

   - `BundleDefinition`: `planningLoop?: PlanningLoopConfig;`
     `personaAliases?: Record<string, string>;`
   - `ClineTeamManifest`: `planningLoop?: PlanningLoopConfig;`
     `personas?: Array<{ persona: string; role: string }>;`
     (keep `schemaVersion: 1` — fields are optional).

2. `bundles.json` — add the `planningLoop` block and `personaAliases` map
   (above) to the `digital-agency` entry only. **No other bundle changes.**

3. Write failing tests first (TDD): `tests/registry.test.ts` — planningLoop
   schema validation for `digital-agency`; every persona alias target exists
   in the bundle roster; `tests/cline-projector.test.ts` — manifest/rule
   rendering assertions (Step 3) authored red before renderer changes.

**Verify**: `npm test -- tests/registry.test.ts` → red first, then green after
Step 3.

### Step 3: Renderer layer — `src/core/cline-projector.ts`

1. `renderTeamManifest`: when `bundle.planningLoop?.enabled`, emit the
   `planningLoop` block and `personas` array into the YAML.
2. `renderCoordinatorRule`: when enabled, replace the soft escape hatch with
   the **Subagent-First Delegation Policy & Planning Dialogue Loop** section
   (Phases 0/0.5/1/2, self-execution rule, budget caps, persona → tool table).
   When **not** enabled, output must remain byte-identical to today
   (regression guarantee for the other 25 bundles).
3. `renderConfiguredAgent`: pass through canonical frontmatter `maxIterations`
   when present; for planning-loop bundles, default `maxIterations: 8` (or
   budget override) into the `.yml` frontmatter. Canonical agent markdown
   remains the single source of truth — bundle-level default only when the
   frontmatter omits it.
4. Keep both renderers pure (no I/O) — all values flow in via
   `BundleDefinition`.

**Verify**: `npm test -- tests/cline-projector.test.ts tests/projection-lifecycle.test.ts tests/recommendation-contract.test.ts` → all pass, including new assertions:
- planning-loop bundle rule contains `Subagent-First`, budget numbers, persona table;
- non-planning bundle rule unchanged (regression);
- configured-agent `.yml` contains `maxIterations: 8` for digital-agency roster.

### Step 4: Canonical prompts — `registry/agents/*.md`

1. `orchestrator-marketing.md`:
   - Insert **Phase 0 — User Alignment** (`/grill-me` / `/grill-with-docs`
     triggers), **Phase 0.5 — Sidekick Clarification** (≤2 sidekicks), and
     **Phase 1 — Specialist Council** (bounded Scope-of-Work Statements);
     renumber existing phases.
   - Add a **Subagent-First Delegation Policy** mandate section mirroring the
     coordinator rule (self-execution only on tool absence or triviality).
   - Extend `<mandatory_first_turn_response>` with a compact roster line +
     one-sentence delegation promise (token-cheap).
2. The 9 digital-agency roster subagents: add a **Planning Consultation
   Mode** section (Scope-of-Work Statement format, ≤2 open questions) and a
   **Peer Clarification Protocol** (≤1 directed question to ≤1 peer per
   round, budget-bound, never open-ended).
3. The 6 `workflow-agency-*.md` files: reference canonical tool names with
   personas in parentheses (e.g. `subagent_marketing_growth_strategist`
   (Ava)), and prepend a short planning phase (council before execution)
   consistent with the loop.

**Verify**: `npm test -- tests/e2e-agents-prompts.test.ts tests/e2e-workflows-gates.test.ts tests/e2e-agents-schema.test.ts` → all pass.

### Step 5: Virtual evaluation — `tests/e2e-evals/`

1. `schemas.ts`: add `PlanningLoopCriteriaSchema` (zod):
   `delegation_first`, `sidekick_used_when_ambiguous`,
   `council_scope_statements_present`, `budget_respected`,
   `delegation_map_before_execution`; extend `DagNodeTrace.skill_used` union
   with `'planning-consultation'`.
2. `judge.ts`: extend the Two-Stage Hybrid Evaluator — stage 1
   (deterministic gatekeeper, 0ms): first substantive `tool_call` after the
   user brief is a `subagent_*` spawn or `send_message`; peer-exchange count
   ≤ `maxPeerExchangesPerPair`; stage 2 (LLM judge): the new schema rubric.
3. `runner.ts` + `e2e-stream-evals.test.ts`: add multi-hop DAG scenarios —
   ambiguous brief ⇒ grill → sidekick spawn → council → delegation map; and a
   budget-overflow adversarial scenario (peer chatter must trip the
   gatekeeper).

**Verify**: `npm test -- tests/e2e-evals/e2e-stream-evals.test.ts` → all pass.

### Step 6: Documentation & bookkeeping

1. `PROJECT.md`: add feature-inventory rows (planning loop + evals), update
   catalog tree note for `digital-agency` (Planning Dialogue Loop badge), ADR
   index row 0014, plans index row 012.
2. `README.md`: extend the Organization Bundles section with a short
   "Subagent-First Planning Dialogue Loop" paragraph + budget table.
3. `ROADMAP.md`: track rollout-to-other-bundles as a future milestone
   (explicitly out of scope here).
4. `plans/README.md`: set this plan's status row to DONE at the end.

**Verify**: `npm run typecheck && npm run build && npm test` → 100% pass.

### Step 7: Live artifact inspection (dry-run)

```bash
node dist/cli.js add digital-agency --mode limited-operational -y --copy --dry-run
node dist/cli.js add digital-agency --mode limited-operational -y --copy   # in a scratch workspace
```

Inspect generated `.cline/rules/agents-united-digital-agency.md`,
`.cline/agents/*.yml` (maxIterations), and the team manifest.

### Step 8: Maintainer manual test round

Maintainer runs real sessions on the scratch workspace (Flash model
recommended) with: (a) an ambiguous brief, (b) a concrete campaign brief,
(c) an adversarial "discuss forever" brief. Tuning outcomes (budget numbers)
are applied to `bundles.json` only.

---

## Done criteria

- [x] ADR 0014 accepted & indexed; 6 CONTEXT.md terms registered.
- [x] `planningLoop` + `personaAliases` in `bundles.json` (digital-agency only) with typed schema in `types.ts`.
- [x] Coordinator rule for `digital-agency` contains the Subagent-First Delegation Policy, Planning Dialogue Loop, Consultation Budget, and persona → tool table.
- [x] Coordinator rules for all other bundles byte-identical to pre-change render (regression test).
- [x] Configured-agent `.yml` for the digital-agency roster carries `maxIterations`.
- [x] Orchestrator + 9 subagents + 6 workflows carry the planning-loop protocol.
- [x] Eval harness asserts delegation-first, budget compliance, council scope statements, and gates budget overflow.
- [x] `npm run typecheck && npm test && npm run build` → 100% pass.
- [x] Dry-run artifacts inspected (scratch workspace `au-scratch-digital-agency`: coordinator rule, 10× `.yml` with `maxIterations: 8`, team manifest).
- [ ] Manual test round: **Cline passed** (maintainer, 2026-09-04); Antigravity round pending.

## STOP conditions

- If Cline 3.0.61's `maxIterations` semantics cannot be confirmed (per ADR
  0013 source verification), still render the field (harmless if ignored) but
  document the unverified semantics in ADR 0014 and rely on the structural
  budget — do not invent enforcement claims.
- If `tests/e2e-sed-bundle-lifecycle.test.ts` asserts generated projection
  content that changes, update the assertions to the new expected render —
  never weaken the lifecycle guarantees themselves.
- If the `full` suite aggregation surfaces conflicts from new optional
  fields, fix `RegistryResolver` typing; do **not** strip `planningLoop` from
  `full`.
- If the persona alias target for any workflow persona is missing from the
  bundle roster, stop and reconcile the roster in `bundles.json` first.
- If eval-runner changes break the existing Tri-Tier evaluation scenarios,
  restore them before adding planning-loop scenarios (no net regression).
