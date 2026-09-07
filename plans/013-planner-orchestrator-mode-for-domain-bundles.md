# Plan 013: Planner-Orchestrator Mode for Tier-1 Domain Bundles (ADR 0015)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **USER GATE**: **APPROVED** and being executed (2026-09-07 on branch
> `fix/domain-bundles-cline-projection-fix`). ADR 0015 flipped to *Accepted*
> during execution. Steps 1–6 complete (types + validation → renderer +
> byte-identical regression tests → catalog → orchestrator prompts → eval
> gatekeeper); Step 7 documentation/commit pending.
>
> **Drift check (run first)**:
> `git diff --stat a7c912e..HEAD -- src/core/cline-projector.ts src/core/types.ts src/core/registry.ts registry/bundles.json registry/agents/orchestrator-*.md tests/cline-projector.test.ts tests/registry.test.ts tests/e2e-evals/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M/L (renderer mode-branching, 31 `bundles.json` entries, 7 orchestrator prompts, eval criteria)
- **Risk**: MEDIUM (touches the always-active coordinator rule renderer used by every bundle; contained by mode branching plus byte-identical regression tests on **both** the unflagged path and the subagent-first path)
- **Depends on**: plans/012 (DONE), ADR 0014, ADR 0015, ADR 0013
- **Category**: runtime integration / catalog / evals
- **Planned at**: commit `a7c912e`, 2026-09-07 (branch `fix/domain-bundles-cline-projection-fix`)
- **Issue**: None
- **Decision**: ADR 0015 (grilling session 2026-09-07) — Planner-Orchestrator Mode: solo planning with direct skill consultation, delegated execution

---

## Why this matters

ADR 0014 fixed the Flash-model solo-execution disease for `digital-agency`
with the Subagent-First Planning Dialogue Loop and deferred rollout to the
remaining domain bundles "as a follow-up plan." That follow-up is this plan —
but the grilling session (2026-09-07) concluded the digital-agency pattern
does **not** transfer verbatim: for single-discipline Tier-1 bundles the
sidekick/council mechanism is redundant by design (the orchestrator *is* the
domain expert, skills are bundle-level and natively discovered by Cline from
`.agents/skills/`, and Tier-1's design goal is a lean token footprint).

ADR 0015 therefore introduces a second delegation posture:
**Planner-Orchestrator Mode** — the orchestrator plans **solo** with the user
(Socratic alignment + direct skill consultation under the **Planning Aid
Boundary**: provisional answers allowed, concrete deliverables deferred) and
orchestrates **execution** by mandatory delegation to `subagent_*` agents via
a solo-composed **Delegation Map**. No Planning Sidekicks, no Specialist
Council, no Consultation Budget (there is no inter-agent planning dialogue to
bound). Planning is solo; execution is not — the boundary is what prevents
solo planning from regressing into the pre-0014 solo-execution disease.

---

## Scope: the 30 Tier-1 domain bundles (exact enumeration)

All bundles below gain `"planningLoop": { "enabled": true, "mode": "planner-orchestrator" }`.

| Orchestrator (shared) | Bundles |
|---|---|
| `orchestrator-engineering.md` | `software-engineering`, `devops-engineering`, `mobile-development`, `frontend-engineering`, `backend-distributed-systems`, `qa-automation`, `ai-ml-engineering` (7) |
| `orchestrator-system-architecture.md` | `system-architecture`, `sysops-sre`, `system-architecture-cloud`, `system-architecture-data`, `system-architecture-finops` (5) |
| `orchestrator-design.md` | `product-design`, `design-systems-ops`, `design-research-testing` (3) |
| `orchestrator-marketing.md` | `growth-marketing`, `seo-content-marketing`, `performance-paid-acquisition`, `product-led-growth`, `lifecycle-email-marketing` (5) |
| `orchestrator-security.md` | `security-operations`, `secops-cloud-security`, `secops-application-security`, `secops-compliance-grc` (4) |
| `orchestrator-business.md` | `business-strategy`, `business-financial-modeling`, `business-market-intelligence`, `business-operations-legal` (4) |
| `orchestrator-research.md` | `deep-research`, `deep-research-analytics` (2) |

**Total: 30.** Plus 1 migration: `digital-agency` gains explicit `"mode": "subagent-first"`.

**Excluded (render byte-identical legacy output)**: `universal-orchestration`,
`universal-skills`, `full`, `mock-organization-under-construction`,
`digital-agency` (subagent-first, unchanged bytes).


---

## Current state (verified at `a7c912e`)

### 1. The renderer has a single planning-loop branch, hardcoded subagent-first

`src/core/cline-projector.ts` `renderCoordinatorRule` (~lines 245–284):
`planning = bundle.planningLoop?.enabled === true ? bundle.planningLoop : undefined`
is the only discriminator. When set, it renders the ADR 0014
"Subagent-First Planning Dialogue Loop" section (Phases 0/0.5/1/2 +
Consultation Budget) and the strong delegation step; when unset, the legacy
soft escape hatch ("delegate … when available … otherwise complete the role in
the main session") plus the `runtimeNote` hedge (line 31). There is no notion
of *mode*.

### 2. Types carry no mode

`PlanningLoopConfig` (`src/core/types.ts:59-63`): `{ enabled, budget?, sidekicks? }`.
`ClineTeamManifest` reuses it wholesale (`manifest.planningLoop = bundle.planningLoop`
in `renderTeamManifest`), so a mode field flows into the manifest automatically
once added.

### 3. `bundles.json`: exactly one flagged bundle, no mode anywhere

`digital-agency`: `planningLoop: { enabled: true, budget: {…}, sidekicks: { max: 2 } }`
+ `personaAliases`. The 30 Tier-1 bundles are unflagged → they render the
legacy escape-hatch rule today.

### 4. ⚠ Shared-orchestrator conflict (the plan's central prompt problem)

`orchestrator-marketing.md` is the coordinator for **`digital-agency` AND the
5 marketing domain bundles**. Plan 012 Step 4 baked Phase 0.5 (Sidekick
Clarification) and Phase 1 (Specialist Council) into that canonical file. If
the 5 marketing bundles turn on planner-orchestrator, their projected
coordinator *rule* would forbid planning spawns while their coordinator *role
prompt* (`.agents/agents/orchestrator-marketing.md`, read at session start per
Activation Protocol step 1) mandates them — contradictory instructions on
every host, not just Cline. The same file is installed per-bundle, so it
cannot hardcode a mode. **Resolution (Step 5): mode-conditional prose** — the
canonical prompt keeps the universal skeleton (Phase 0 solo alignment +
Planning Aid Boundary + Phase 2 delegation map + self-execution rule) and
gates Phases 0.5/1 behind "only when your active bundle declares
subagent-first planning (Team Manifest `planningLoop.mode` / Coordinator
Rule); otherwise plan solo."

### 5. Marketing roster files already carry Planning Consultation Mode

Plan 012 added Planning Consultation Mode + Peer Clarification Protocol to
the marketing roster (shared by `digital-agency` and the marketing Tier-1
bundles). In planner-orchestrator bundles this text is **inert** (roster
prompts load only on spawn, and the coordinator rule forbids planning-time
spawns). Per ADR 0015 decision 6, roster files are **untouched** in this
change — the inert text costs tokens only per spawned execution, not per
session.

### 6. `maxIterations` default flows only from `budget`

`planCompoundProjection` (~line 352) passes
`bundle.planningLoop.budget?.maxIterations` as the configured-agent default
only when `planningLoop.enabled`. Planner-orchestrator bundles declare no
budget ⇒ `undefined` ⇒ key absent from `.yml` (backward-compatible; canonical
frontmatter `maxIterations` still wins if present).

### 7. Eval harness assumes subagent-first

`tests/e2e-evals/schemas.ts:49-57` (`PlanningLoopCriteriaSchema`:
`delegation_first`, `sidekick_used_when_ambiguous`,
`council_scope_statements_present`, `budget_respected`,
`delegation_map_before_execution`) and `judge.ts:200+`
(`PlanningLoopGatekeeper`, stage-1 deterministic). A planner-orchestrator
session would *fail* the subagent-first gatekeeper **by design** — a parallel
criteria set and gatekeeper are needed.

### 8. `tests/registry.test.ts:178-182` pins the opt-in set

"no bundle other than digital-agency declares it" — must be rewritten to the
new 31-bundle reality.

---

## Design (ADR 0015)

### Mode resolution (one line, backward compatible)

```ts
const planning = bundle.planningLoop?.enabled === true ? bundle.planningLoop : undefined;
const mode = planning?.mode ?? 'subagent-first'; // absent ⇒ ADR 0014 semantics
```

`mode?: 'subagent-first' | 'planner-orchestrator'` on `PlanningLoopConfig`
(`src/core/types.ts`). Absent mode + `enabled: true` keeps byte-identical ADR
0014 rendering, making the `digital-agency` explicit-mode migration provably
a no-op (regression test in Step 3).

### Rendering matrix

| Bundle state | Coordinator rule (`.cline/rules/`) | Team Manifest | Configured agents |
|---|---|---|---|
| no `planningLoop` | legacy escape hatch — **byte-identical** (regression test) | no `planningLoop` key | no default `maxIterations` |
| `enabled` + `subagent-first` (explicit or defaulted) | ADR 0014 Subagent-First section — **byte-identical** to today's output (regression test) | `planningLoop: {enabled, mode, budget, sidekicks}` + `personas` | `budget.maxIterations` default |
| `enabled` + `planner-orchestrator` | **new** ADR 0015 Planner-Orchestrator Policy section | `planningLoop: {enabled, mode}` only | no default `maxIterations` |

The Activation Protocol delegation step (step 2) uses the strong ADR 0014
mandate text for **both** modes (it is mode-agnostic: self-execution only on
tool absence or triviality); only the planning section differs. The soft
escape hatch disappears for all 31 flagged bundles and remains only for the 5
unflagged ones.

### New rendered section (drafted once, rendered for all 30)

```markdown
## Planner-Orchestrator Policy (ADR 0015)
You plan solo; you execute through your team. Run this loop BEFORE any
substantive execution on a non-trivial task.

### Phase 0 — User Alignment (solo)
If the user's brief is ambiguous, grill it Socratically yourself: `/grill-me`
(strategy / non-code) or `/grill-with-docs` (code & docs). Consult the
bundle's skills directly whenever they help you plan — you have the same
skill access as your specialists. Do NOT spawn specialists during planning.

### Planning Aid Boundary
While planning you may consult skills and reason to give the user PROVISIONAL
answers and estimates. A concrete deliverable — data analysis, code, assets,
documents — is specialist work: defer it to the delegation map, never produce
it yourself during planning.

### Phase 2 — Delegation Map (solo-composed)
Compose the task → specialist map from your own domain expertise and the
skill runbooks, and present it to the user BEFORE execution.

### Execution
Delegate every deliverable to the configured `subagent_*` agent tools
(projected under `.cline/agents/`), assigning non-overlapping scopes. Complete
specialist work in the main session ONLY if the subagent tools are genuinely
absent from this runtime or the task is trivial (single-file read, one-line
answer, formatting) — never as a convenience or speed choice.
```

### Manifest semantics

`renderTeamManifest` keeps `manifest.planningLoop = bundle.planningLoop` —
for planner-orchestrator bundles the loader-level validation (below)
guarantees `budget`/`sidekicks` are absent, so the emitted YAML is naturally
`{enabled, mode}`. `renderConfiguredAgent` and `runtimeNote` are unchanged.

### Validation (fail fast at the source)

Registry loader (wherever `bundles.json` is parsed into `BundleDefinition`,
`src/core/registry.ts`): reject with a clear error when
`planningLoop.mode === 'planner-orchestrator'` and (`budget` or `sidekicks`)
is present. Unit test covers accept/reject cases.

### Canonical prompt strategy (cross-host layer, Step 5)

All 7 shared orchestrator files gain the universal planner-orchestrator
skeleton: Phase 0 solo alignment (with the Planning Aid Boundary) + Phase 2
delegation map + the self-execution rule, token-lean.
`orchestrator-marketing.md` additionally reframes its existing Plan 012
Phases 0.5/1 as conditional: "Run Phases 0.5 and 1 ONLY when your active
bundle declares subagent-first planning (Team Manifest `planningLoop.mode` /
Coordinator Rule); in planner-orchestrator bundles plan solo per the
Planner-Orchestrator Policy." When no mode declaration is reachable (bare
`.agents/` hosts), default to solo planning + delegated execution — matching
the Tier-1 default and pre-existing behavior.


---

## Steps

### Step 1: Baseline & drift check

1. Run the drift check at the top of this plan; on any in-scope diff, compare
   "Current state" excerpts against live code (STOP on mismatch).
2. Baseline snapshots for the byte-identical guarantees:
   ```bash
   npm run build
   node dist/cli.js add digital-agency --mode limited-operational -y --copy --dry-run > /tmp/da-before.txt
   node dist/cli.js add software-engineering -y --copy --dry-run > /tmp/se-before.txt
   ```
   (Windows scratch dir: `%TEMP%`.) These are pre-change artifacts for the
   Step 8 comparison.

### Step 2: Schema — `src/core/types.ts` + registry validation

1. `PlanningLoopConfig` gains `mode?: 'subagent-first' | 'planner-orchestrator'`
   (comment: ADR 0015; absent ⇒ `'subagent-first'` for ADR 0014 backward
   compatibility). `ClineTeamManifest` needs no edit (reuses the type).
2. Registry loader: reject `planningLoop` where
   `mode === 'planner-orchestrator'` and (`budget` || `sidekicks`) present;
   reject unknown `mode` values; `enabled: false` ignores the rest.
3. Tests (`tests/registry.test.ts`): acceptance case (30× planner-orchestrator
   without budget), rejection cases (planner-orchestrator + budget;
   planner-orchestrator + sidekicks; `mode: 'bogus'`).

**Verify**: `npm run typecheck && npm test -- tests/registry.test.ts` → pass.

### Step 3: Renderer — `src/core/cline-projector.ts`

1. `renderCoordinatorRule`: resolve `mode` per the Design snippet. Branch:
   - `subagent-first` → existing ADR 0014 section, byte-identical.
   - `planner-orchestrator` → the new Planner-Orchestrator Policy section
     (Design draft, verbatim); **never** emits sidekick/council/budget text;
     keeps the strong delegation step 2 text.
2. `renderTeamManifest`: no logic change needed (wholesale assignment stays);
   add the mode to the emitted YAML via the shared type. Guard: if a
   planner-orchestrator bundle somehow carries `budget`/`sidekicks`, omit them
   (defense in depth behind the loader validation).
3. `planCompoundProjection`: `maxIterations` default expression already
   yields `undefined` without budget — add a comment tying it to ADR 0015.

Tests (`tests/cline-projector.test.ts`, new `describe('Planner-Orchestrator rendering (Plan 013 / ADR 0015)')`):
- renders the Planner-Orchestrator Policy, Planning Aid Boundary, and
  delegation map for a planner-orchestrator bundle;
- does NOT contain "Sidekick", "Specialist Council", "Consultation Budget",
  or "maxIterations: ";
- removes the soft escape hatch ("when available") for planner-orchestrator
  bundles;
- **migration regression**: `renderCoordinatorRule({...planningBundle, mode:
  'subagent-first'})` === output with mode absent (byte-identical);
- unflagged bundle rule byte-identical (existing test stays green);
- manifest emits `planningLoop: {enabled: true, mode: 'planner-orchestrator'}`
  and no `budget`/`sidekicks` keys;
- configured-agent `.yml` for planner-orchestrator bundle: no `maxIterations`
  default; canonical frontmatter value still wins.

**Verify**: `npm run typecheck && npm test -- tests/cline-projector.test.ts` → pass.

### Step 4: Catalog — `registry/bundles.json`

1. Add `"planningLoop": { "enabled": true, "mode": "planner-orchestrator" }`
   to the 30 bundles enumerated in Scope (scripted edit or careful manual —
   verify count 30 afterward).
2. `digital-agency`: add `"mode": "subagent-first"` inside its existing
   `planningLoop` block (budget/sidekicks/personaAliases untouched).
3. Rewrite `tests/registry.test.ts:178-182`: the 30 Tier-1 bundles declare
   planner-orchestrator; `digital-agency` declares subagent-first with its
   budget intact; the 5 excluded bundles declare nothing.

**Verify**: `npm test -- tests/registry.test.ts tests/e2e-bundles*.test.ts` → pass
(plus whichever catalog-completeness suites enumerate bundles — run the full
suite if unsure).

### Step 5: Canonical orchestrator prompts — `registry/agents/orchestrator-*.md`

1. The 6 non-marketing orchestrators (`engineering`, `system-architecture`,
   `design`, `security`, `business`, `research`): insert a token-lean
   **Planner-Orchestrator Policy** section — Phase 0 solo user alignment
   (`/grill-me` / `/grill-with-docs` triggers) + Planning Aid Boundary +
   solo-composed delegation map presented before execution + the
   self-execution rule (tools absent or trivial only). Renumber existing
   phases where inserted.
2. `orchestrator-marketing.md`: keep the Plan 012 phases but gate them —
   Phase 0 and Phase 2 become the universal skeleton; Phases 0.5 and 1 gain
   the conditional header from the Design section ("ONLY when your active
   bundle declares subagent-first planning …").
3. Roster subagent markdown: **no edits** (ADR 0015 decision 6).

**Verify**: `npm test -- tests/e2e-agents-prompts.test.ts tests/e2e-workflows-gates.test.ts tests/e2e-agents-schema.test.ts` → pass; adjust only assertions that
pin exact phase numbering, never the policy semantics.


### Step 6: Virtual evaluation — `tests/e2e-evals/`

1. `schemas.ts`: add `PlannerOrchestratorCriteriaSchema` (zod):
   `solo_planning` (no specialist spawn before the delegation map),
   `planning_aid_boundary_respected` (provisional answers only during
   planning; no deliverable produced in-session during planning),
   `delegation_map_before_execution`, `execution_delegation_first` (first
   substantive action after the map is a `subagent_*` spawn). Add
   `PlannerOrchestratorVerdictSchema` mirroring the PlanningLoop verdict
   shape. Extend `DagNodeTrace.skill_used` union if a planning-aid skill
   marker is needed (`'planning-aid'`).
2. `judge.ts`: add `PlannerOrchestratorGatekeeper` (stage-1 deterministic,
   0ms): no `subagent_spawn`/`send_message` to specialists before the
   delegation-map event; a spawn-after-map must exist on non-trivial briefs;
   a deliverable-shaped tool call (file write / analysis output) before the
   map fails `planning_aid_boundary_respected`. Keep the existing
   `PlanningLoopGatekeeper` untouched (it still gates subagent-first
   scenarios).
3. `e2e-stream-evals.test.ts`: add scenarios —
   - ambiguous Tier-1 brief ⇒ grill (solo) ⇒ delegation map ⇒ subagent
     dispatch (all criteria true, score 10);
   - adversarial: brief that begs for an immediate concrete analysis during
     planning ("give me the real CAC number now") ⇒ must stay provisional,
     defer the deliverable to the map (gatekeeper trips if the model
     self-executes);
   - adversarial: solo-execution regression (model skips delegation after
     the map) ⇒ `execution_delegation_first` false.

**Verify**: `npm test -- tests/e2e-evals/e2e-stream-evals.test.ts` → pass.

### Step 7: Documentation & bookkeeping

1. `PROJECT.md`: feature-inventory rows (planner-orchestrator mode + eval
   gatekeeper), ADR index row 0015, plans index row 013.
2. `README.md`: short "Planner-Orchestrator Mode" paragraph in the Domain
   Bundles section (solo planning + delegated execution + Planning Aid
   Boundary); note the two coexisting postures (Tier-1 vs Organization).
3. `ROADMAP.md`: convert the Plan 012 "rollout to other bundles" future
   milestone into this plan's execution record.
4. `docs/adr/0015-*.md`: flip Status from *Proposed* to *Accepted* (dated,
   referencing this plan) once the maintainer approves execution.
5. `plans/README.md`: set this plan's status row to DONE at the end.

**Verify**: `npm run typecheck && npm run build && npm test` → 100% pass.

### Step 8: Live artifact inspection (dry-run + scratch install)

```bash
# byte-identical migrations (compare against Step 1 baselines)
node dist/cli.js add digital-agency --mode limited-operational -y --copy --dry-run
node dist/cli.js add software-engineering -y --copy --dry-run   # planner-orchestrator now — diff vs baseline is EXPECTED and must show only the new policy section

# scratch workspace (two-bundle install to exercise the shared-orchestrator path)
node dist/cli.js add growth-marketing -t agents --fanout cline -y --copy   # scratch workspace
```

Inspect in the scratch workspace: `.cline/rules/agents-united-growth-marketing.md`
(Planner-Orchestrator Policy; no sidekick/council/budget; no "when available"
hedge), the team manifest (`planningLoop: {enabled, mode}` only),
`.cline/agents/*.yml` (no `maxIterations`), and `.agents/agents/orchestrator-marketing.md`
(mode-conditional phases). Re-run `agents remove` for lockfile/refcount sanity.

### Step 9: Maintainer manual test round

Real Cline sessions on the scratch workspace (Flash model recommended):
(a) ambiguous software-engineering brief — expect solo grill + delegation map
before any spawn; (b) growth-marketing brief that begs an immediate concrete
deliverable — expect a provisional estimate and the deliverable deferred to
the map; (c) adversarial "just do it all yourself" brief — expect delegation
anyway. Antigravity spot check for the mode-conditional orchestrator prompt.
Tuning outcomes land in `bundles.json` / renderer text only — never in
generated projections (ADR 0008).

---

## STOP conditions

- Any drift-check mismatch on in-scope files (Step 1).
- The unflagged-bundle or subagent-first byte-identical regression tests fail
  (renderer purity broken — do not "fix" by relaxing the tests).
- The registry loader validation cannot reject planner-orchestrator +
  budget/sidekicks cleanly (schema design flaw — back to the maintainer).
- Prompt-suite failures that would require weakening policy semantics
  (phase-renumber assertions may be updated; semantics may not).
- Any eval gatekeeper change that alters existing subagent-first verdicts
  (the PlanningLoopGatekeeper must stay untouched).
- Cline manual round shows planning-time specialist spawns or in-session
  deliverables despite the rendered policy (policy text insufficient —
  report before iterating).

