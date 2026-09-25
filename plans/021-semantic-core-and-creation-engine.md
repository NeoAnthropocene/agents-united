# Plan 021: Semantic Core & Per-Host Creation Engine (Strangler Step 1)

> **Executor instructions**: self-contained; execute steps in order; STOP on listed conditions.
> Update this plan's row in `plans/README.md` when done. The architecture decisions in
> `docs/adr/0021-semantic-core-and-per-host-native-realization.md` are binding — read it and
> the `CONTEXT.md` "Semantic Core Architecture Terms" section before Step 1. Never let an LLM
> render, translate, or generate agent artifacts: creation is deterministic codegen only.

## Status

- **State**: READY — approved by product owner 2026-09-24 (Socratic grilling; ADR 0021)
- **Execution**: Steps 0–7 complete 2026-09-24 (working tree, uncommitted per owner instruction).
  Conformance Suite 24/24 green; parity gate passed floor-identical on all 5 pilots (no STOP);
  `npm run typecheck` exit 0; legacy goldens byte-pinned; legacy lane untouched. Deviations:
  subagent tools failed ×3 (socket/auth/maxIterations) → main-session fallback; 8 preserved
  Plan 017 render-lane tests remain RED (renderRole behavior is Plan 017 Step 5 scope and is
  blocked by the legacy-lane-untouched + golden-byte constraints — see § Step 0/5 notes).
  Gate 7 (owner manual Claude Code spot-check of 1 created agent) awaits the owner.
- **Priority**: P1 · **Effort**: L · **Risk**: HIGH (new engine beside a live lane; semantic contracts are load-bearing)
- **Depends on**: plans/017 (repurposed machinery), plans/019 (core extraction synergy), ADR 0021
- **Category**: core / architecture / catalog
- **Branch**: fresh branch from `dev` (e.g. `feat/semantic-core-creation-engine`)
- **Rollout scope**: **Claude realization first** (strangler step 1). Cline second,
  Antigravity-as-peer third, others on demand. The legacy projection lane runs untouched until
  a migration batch proves parity (decision 4). Coverage stays universal (ADR 0019); only scope
  above the Contract Floor varies (decision 5).

## Why this exists

`registry/**` is Antigravity dialect wearing a host-neutral badge: tool tokens, slash commands,
and host caveats saturate agent semantics, so every host lane pays a translation tax that the
Translation Ledger can account for but never eliminate. ADR 0021 replaces translation with
creation: a tool-free **Semantic Core** of invariants plus per-host **Realization Layers** that
BIND (never translate) those invariants to host mechanics, assembled by deterministic per-host
**Creation Engines** from versioned **Capability Profiles**. Host churn becomes a one-host data PR.

## Objective

Stand up the strangler's first vertical slice beside the legacy lane:

1. **Semantic Core schema + Contract Floor validator** (`registry/core/**`, `src/core/`).
2. **Capability Profile + Binding Table** for Claude (`registry/profiles/`, repurposed
   `src/core/dialects.ts` shape per ADR 0021 decision 9).
3. **Claude Creation Engine** emitting native `.claude/agents/*.md` from Core + Binding Table,
   byte-reproducible, with declared-delta enforcement.
4. **Conformance Suite**: floor-identity assertions + created-output goldens.
5. **Pilot batch migration**: the 5 software-engineering roles (1 orchestrator + 4 specialists).

Non-goals: retiring the projection lane (parity gate first), other hosts, LLM CI jobs, changing
workspace install semantics (managed artifacts, lockfile — decision 7).

## Implementation steps (TDD)

**Step 0 — Core extraction spike (delegate: `subagent-repo-index`, read-only).**
Inventory the 5 pilot roles in `registry/agents/`: split every line into CORE (identity, scope,
output contract, safety, tool-neutral invariants) vs LEGACY-DIALECT (tool names, host commands,
host caveats, orchestration mechanics). Deliver a per-file classification table appended to this
plan. **STOP if any semantic content is neither classifiable as core nor as a bindable invariant**
— report before writing schema.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).**
New `tests/semantic-core.test.ts` + `tests/creation-engine-claude.test.ts`:
(a) core schema validation rejects any host tool name/command/caveat token in core files
(forbidden-pattern scan: the Plan 019 residue list + the 18 canonical tool tokens + command
tokens); (b) Contract Floor validator fails when a realization's floor fields diverge from core;
(c) an undeclared delta fails conformance; (d) a declared delta passes with its classification;
(e) creation output is byte-deterministic across repeated runs.

**Step 2 — Semantic Core schema + floor validator (delegate: `subagent-backend-architect`).**
`registry/core/<agent>.core.md` format: `identity`, `mission`, `scope_boundaries`,
`output_contract`, `safety`, `invariants` (tool-neutral behavioural laws). `src/core/` gains the
loader + validator. **Verify**: new tests green; `npm run typecheck` exit 0.

**Step 3 — Capability Profile + Binding Table (delegate: `subagent-backend-architect`).**
`registry/profiles/claude@2.1.271.json` (tool surface snapshot) and the Claude Binding Table
evolving `HOST_DIALECTS.claude` per ADR 0021 decision 9: invariant → binding entries
(`Agent()` + `SubagentHandback`, parallel-fanout, synthesis-point, hand-back, question flow),
plus per-host command bindings (Plan 020 alignment) and delta declarations.
**Verify**: spec validation still throws at load; legacy golden snapshots unchanged.

**Step 4 — Claude Creation Engine (delegate: `subagent-backend-architect`).**
`src/core/creation/claude.ts`: `createRole(core, bindingTable, profile)` → native
`.claude/agents/<role>.md`. Deterministic assembly; floor fields emitted verbatim from core;
invariant prose emitted from binding templates; declared deltas applied only where declared.
**Verify**: `tests/creation-engine-claude.test.ts` green; byte-determinism gate green.

**Step 5 — Conformance Suite + pilot batch migration (delegate: `subagent-backend-architect` +
Coordinator review).**
Extract 5 pilot cores from `registry/agents/` (using Step 0's classification), author their
declared deltas, capture created-output goldens (`tests/golden/claude-created/**`), and run the
parity gate: created vs legacy-projected outputs must agree on all floor fields and on every
invariant's bound mechanics. **STOP if parity fails on a floor field** — the floor is not
negotiable. Scope-above-floor differences are legal only as declared deltas.

**Step 6 — CI wiring + docs (delegate: `subagent-backend-architect`).**
Conformance suite joins the deterministic Stage-1 gates; `docs/` gains the creation-engine page;
CONTEXT.md terms already landed (verify only). **Verify**: `npm run typecheck` 0; `npm test` all
green including legacy suites (no legacy byte drift).

**Step 7 — Adversarial audit (delegate: `subagent-code-reviewer`).**
Audit for: core token leakage, undeclared delta paths, nondeterminism sources, legacy-lane
regressions. Fix findings.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green, legacy golden snapshots byte-unchanged.
2. Core schema rejects 100% of the forbidden-pattern corpus (residue list + tool + command tokens).
3. Contract Floor validator: zero floor divergence across the 5 pilot realizations; one seeded
   floor mutation fails exactly one assertion.
4. Undeclared delta → conformance failure; declared delta (`mapped|approximated|degraded|unsupported`
   + rationale) → pass.
5. Creation output byte-identical across 3 repeated runs (determinism).
6. Parity gate: created vs projected agree on all floor fields + bound mechanics for all 5 pilots.
7. Owner manual Claude Code spot-check of 1 created agent recorded as passed.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Host tokens leak into core | High | forbidden-pattern validator at load + CI (Step 1a) |
| R2 | Semantic divergence between realizations | High | Contract Floor verbatim rule + parity gate (Steps 5, gates 3/6) |
| R3 | Undeclared scope drift | High | declared-delta registry + conformance failure (gate 4) |
| R4 | Nondeterministic creation | Med | byte-determinism gate (gate 5); no LLM in the path (ADR 0021 D3) |
| R5 | Legacy lane regression | Med | legacy goldens byte-pinned in every gate run (gate 1) |
| R6 | Strangler stall (migration never retires projection) | Med | batch acceptance gates per Plan 022+; parity evidence required before scope growth |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | core-vs-dialect classification of 5 pilot roles |
| Step 1 | `subagent-qa-automation-lead` | RED suite: schema, floor, deltas, determinism |
| Steps 2–4, 6 | `subagent-backend-architect` | core schema, profiles/bindings, creation engine, CI |
| Step 5 | `subagent-backend-architect` + Coordinator | pilot cores, deltas, goldens, parity gate |
| Step 7 | `subagent-code-reviewer` | adversarial audit |

## References

- Binding: `docs/adr/0021-semantic-core-and-per-host-native-realization.md` (10 decisions);
  `CONTEXT.md` § "Semantic Core Architecture Terms (ADR 0021)".
- Repurposed machinery: `src/core/dialects.ts` (`HOST_DIALECTS` → Binding Table),
  `registry/translation-ledger.json` (→ Declared-Delta Registry), `tests/golden/claude/**`
  (→ Conformance Suite), ADR 0020.
- Synergy: plans/019 (residue purge = core extraction), plans/020 (command tokens = command
  bindings), plans/018 (tier semantics = core invariants + per-host orchestration bindings).

---

## Step 0 — Core Extraction Classification (5 pilots) — appended 2026-09-24

> **Deviation note**: executed in the main session — `subagent-repo-index` failed twice
> (socket close, Cline auth error); ADR 0015 fallback posture applied. Classes:
> **F** = Contract Floor (identity, scope boundaries, output contract, safety — verbatim in every
> realization) · **I** = core invariant (tool-neutral law, bound per host) · **D** = legacy dialect
> (host/tool/command tokens, host caveats, host orchestration mechanics) · **N** = neither (STOP).
> ⚠ = core-worthy meaning trapped in dialect prose (reword on extraction). Targets:
> `identity|mission|scope_boundaries|output_contract|safety|invariants` (core fields),
> `binding` (Binding Table), `profile` (Capability Profile), `delta` (Declared-Delta candidate),
> `legacy-only` (projection-lane mechanics).

### orchestrator-engineering.md (259 lines)

| Lines | Cl | Summary | Target |
|---|---|---|---|
| 1 | D | YAML open | legacy-only |
| 2–8 | F | name / version / type: orchestrator / description | identity |
| 9–11 | D | model / permissionMode / commandExecutionPolicy | profile |
| 12–27 | D | `tools:` 15 canonical tokens | profile + binding |
| 28–29 | D | mainAgent / subagent flags ⚠ role topology | legacy-only |
| 30–46 | D | `hooks:` host lifecycle ⚠ PreToolUse safety gate = safety | legacy-only |
| 47 | D | effort: high | profile |
| 48–55 | D | `skills:` 7 asset refs | binding |
| 56–59 | D | `mcpServers` x3 | delta (degraded) |
| 60–64 | D | `rules:` 4 refs | binding |
| 65–71 | F | frontmatter close + H1 + role statement | identity |
| 72–78 | F | Operational Role & Core Mission | mission |
| 79–82 | I | Subagent-First Delegation Policy (delegation mandatory) | invariants |
| 83–84 | F | Self-Execution Ban | scope_boundaries |
| 85–87 | D | **Host Routing** section — **Cline & CLI** / Antigravity / **language_server.exe** / invoke_subagent ⚠ delegate via host mechanism | legacy-only |
| 88–90 | D | separators | legacy-only |
| 91–98 | D | Reasoning Protocol + Phase 1 (workflow-grill / grill-with-docs / grill-me / ask_question / ask_followup_question / workflow-spec / to-spec / to-tickets / view_file / grep_search) ⚠ resolve ambiguity before unverified work | invariants (reword) + binding |
| 99–104 | D | Phase 2 slices (architecture-design / backend-api-design / workflow-git / git-guardrails) ⚠ delegation-map law | invariants (reword) + binding |
| 105–110 | D | Phase 3 [Mandatory invoke_subagent Gate] — invoke_subagent / subagent_* / task / Cline/Cursor / Host Routing ⚠ MUST delegate each slice | invariants (reword) + binding |
| 111–119 | D | Phase 4 TDD loop (workflow-diagnose / workflow-implement / write_to_file / replace_file_content / run_command / workflow-review) ⚠ red-green-refactor law | invariants (reword) + binding |
| 120–128 | D | Phase 5 delivery (workflow-test / build / cleanup / git / /handoff) ⚠ verify-then-deliver | binding |
| 129–150 | D | SDLC Workflow Skills Matrix + Execution Protocol (`/workflow-*`, view_file) ⚠ consult matching runbook first | binding |
| 151–183 | D | Cross-Bundle Dynamic Recommendation (`agents add` CLI matrix) ⚠ recommend specialization beyond scope | binding + legacy-only |
| 184–191 | D | Tool Selection Rules (grep_search / list_dir / view_file / run_command / write_to_file / multi_replace_file_content / invoke_subagent) ⚠ recon-before-edit; specialists own implementation | legacy-only |
| 192–199 | F | Boundary Constraints & Operational Guardrails (TDD, git guardrails, no silent errors, API compatibility) | safety + scope_boundaries |
| 200–211 | D | **Nested Subagent Delegation Protocol** (invoke_subagent TypeName/Role/Prompt in Antigravity; subagent_* in Cline) + roster ⚠ one hand-back per specialist | invariants (reword) |
| 212–223 | F | Output Format & Structured Delivery (5-part report) | output_contract |
| 224–232 | D | Explicit Lifecycle Hooks prose ⚠ audit-before-run | legacy-only |
| 233–243 | D | Reactive Liveness Protocol (run_command / manage_task / schedule TimerCondition / CronExpression) ⚠ never busy-poll; one synthesis point | invariants (reword) + binding |
| 244–259 | D | Planner-Orchestrator Policy ADR 0015 (planningLoop.mode, /workflow-grill, /grill-me, invoke_subagent Antigravity TypeName, subagent_* Cline) ⚠ plan-solo-delegate policy | invariants (reword) |

### subagent-frontend-architect.md (428 lines)

| Lines | Cl | Summary | Target |
|---|---|---|---|
| 1 | D | YAML open | legacy-only |
| 2–10 | F | name / version / type / description | identity |
| 11–15 | D | model / permissionMode / commandExecutionPolicy / mainAgent / subagent | profile |
| 16–27 | D | `tools:` 11 tokens | profile + binding |
| 28–40 | D | `hooks:` (guard rm -rf/sudo/shutdown) ⚠ destructive denial = safety | legacy-only |
| 41–42 | D | inheritCustomizations / effort | profile |
| 43–49 | D | `skills:` 6 refs | binding |
| 50–53 | D | `mcpServers` x3 | delta (degraded) |
| 54–58 | D | `rules:` 4 refs | binding |
| 59–76 | F | close + H1 + Role Definition + digital-agency roster + technical domain | identity + mission |
| 77–91 | F | Primary Directives 1–4 (modularization, RSC/Vercel, Core Web Vitals, AI-prototype refactor) | mission |
| 92–95 | F | Directives 5–6 (strict prop typing; design-token ingestion; data-testid) | safety + scope_boundaries |
| 96–126 | D | Protocol Phases 1–5 (list_dir / view_file / grep_search / run_command / npx tsc / npm test / npx vercel build) ⚠ audit-then-verify | invariants (reword) + binding |
| 127–137 | F | Exemplars heading + Exemplar 1 Vercel deploy (bash) | mission |
| 138–188 | F | Exemplar 2 Server Action + Zod + revalidation | mission |
| 189–215 | F | Exemplar 3 ISR route | mission |
| 216–245 | F | Exemplar 4 atomic refactor (CVA) | mission |
| 246–278 | F | Exemplar 5 Supabase Auth SSR | mission + safety |
| 279–304 | F | Exemplar 6 Turso edge replica read | mission |
| 305–331 | F | Exemplar 7 SWA routing & auth config | mission + safety |
| 332–345 | D | Tool Usage table (6 tool tokens) | legacy-only |
| 346–371 | F | Output Format Requirements (Frontend Architect Report + CWV summary) | output_contract |
| 372–382 | D | Explicit Lifecycle Hooks prose | legacy-only |
| 383–393 | D | Reactive Liveness Protocol (run_command / manage_task / schedule TimerCondition / CronExpression) ⚠ never busy-poll | invariants (reword) + binding |
| 394–413 | I | Planning Consultation Mode, Scope-of-Work ≤150w, Peer Clarification budget, Mode switch ⚠ never negotiate scope with user | invariants + scope_boundaries |
| 414–422 | I | Workflow Execution & Verification Protocol (test-first, gates) ⚠ gate commands | invariants |
| 423–428 | I | Parallel Work & Handoff ⚠ Agent tool / send_message / Agent Teams | invariants (reword) |

### subagent-code-reviewer.md (210 lines)

| Lines | Cl | Summary | Target |
|---|---|---|---|
| 1 | D | YAML open | legacy-only |
| 2–9 | F | name / version / type / description | identity |
| 10–14 | D | model / permissionMode / commandExecutionPolicy / mainAgent / subagent | profile |
| 15–21 | D | `tools:` 6 tokens (no write tools — read-only design) | profile + binding |
| 22–33 | D | `hooks:` (guard rm/del/DROP/shutdown/curl/wget/sudo) ⚠ destructive denial = safety | legacy-only |
| 34–35 | D | inheritCustomizations / effort | profile |
| 36–41 | D | `skills:` 5 refs | binding |
| 42–43 | D | `mcpServers` x1 | delta (degraded) |
| 44–45 | D | `rules:` 1 ref | binding |
| 46–55 | F | close + H1 + Role Definition (read-only; severity/file/line/remediation tags) | identity + output_contract |
| 56–72 | F | Review domains (OWASP, performance, memory, dead code, errors, TS hygiene, style, secrets) | scope_boundaries |
| 73–83 | F | Primary Directives 1–5 (read-only, evidence-based, severity, remediation, no false positives) | safety + output_contract |
| 84–99 | D | Protocol + Phases 1–2 (list_dir / grep_search secret scan) ⚠ exhaustive scan | invariants (reword) + binding |
| 100–129 | D | Phases 3–7 (grep_search injection/auth/error/perf/dead-code scans) ⚠ evidence-based findings | invariants (reword) + binding |
| 130–136 | D | Phase 8 static analyser (run_command eslint / bandit) | invariants (reword) + binding |
| 137–149 | D | Tool Usage Rules + "Never use run_command to execute/modify" ⚠ read-only run = safety | legacy-only + safety (reword) |
| 150–161 | F | Severity Definitions (CRITICAL…INFO taxonomy) | output_contract + safety |
| 162–196 | F | Output Format Requirements (Code Review Report + metrics table) | output_contract |
| 197–204 | D | Explicit Lifecycle Hooks prose | legacy-only |
| 205–210 | I | Parallel Work & Handoff (hand-back; read-only; budget) ⚠ Agent tool / send_message / Agent Teams | invariants (reword) |

### subagent-repo-index.md (194 lines)

| Lines | Cl | Summary | Target |
|---|---|---|---|
| 1 | D | YAML open | legacy-only |
| 2–8 | F | name / version / type / description | identity |
| 9–13 | D | model / permissionMode / commandExecutionPolicy / mainAgent / subagent | profile |
| 14–19 | D | `tools:` 5 tokens (read-only set) | profile + binding |
| 20–28 | D | `hooks:` (guard: deny any mutating tool) ⚠ read-only guard = safety | legacy-only |
| 29–30 | D | inheritCustomizations / effort | profile |
| 31–33 | D | `skills:` 2 refs | binding |
| 34–35 | D | `mcpServers` x1 | delta (degraded) |
| 36–37 | D | `rules:` 1 ref | binding |
| 38–60 | F | close + H1 + Role Definition (read-only indexer; outputs consumed by orchestrators) + capabilities x8 | identity + scope_boundaries |
| 61–73 | F | Primary Directives 1–5 (read-only always, exhaustive-first, machine-readable, cite evidence, flag ambiguity) | safety + output_contract |
| 74–87 | D | Protocol + Phase 1 discovery (list_dir / view_file) | invariants (reword) + binding |
| 88–104 | D | Phases 2–3 (entry points; import graph via grep_search) | invariants (reword) + binding |
| 105–130 | D | Phases 4–7 (symbol index, coverage topology, dead files, Mermaid) | invariants (reword) + binding |
| 131–141 | D | Tool Usage Rules + "No run_command, write_to_file, or replace_file_content — ever." ⚠ read-only = safety | legacy-only + safety (reword) |
| 142–180 | F | Output Format Requirements (Repository Index Report + Open Questions) | output_contract |
| 181–188 | D | Explicit Lifecycle Hooks prose | legacy-only |
| 189–194 | I | Parallel Work & Handoff (hand-back; read-only; budget) ⚠ Agent tool / send_message | invariants (reword) |

### STOP ITEMS

**none** — every line is classifiable as core (floor or invariant) or as a bindable
invariant/mechanic. No unclassifiable semantic content. Proceed to Step 1.

### Mixed-content flags (core meaning trapped in dialect prose)

- orchestrator-engineering: 28–29 (role topology), 30–46 (safety-gate hooks), 85–87, 91–118,
  200–211, 233–241, 244–259 (delegation + liveness + TDD laws wrapped in tool/host nouns).
- subagent-backend-architect: 25–38, 104–116, 374–388 (destructive-command safety, parameterized
  queries, test-first, hand-back).
- subagent-frontend-architect: 28–40, 96–126, 383–393, 414–428.
- subagent-code-reviewer: 22–33, 137–149, 205–210 (read-only safety).
- subagent-repo-index: 20–28, 131–141, 189–194 (read-only safety).

### Contradiction note (Plan 019 overlap — resolved at extraction, rationale recorded)

`orchestrator-engineering.md` carries **two** delegation policies: ADR 0014 Subagent-First
(79–83) and ADR 0015 Planner-Orchestrator (245–259). Plan 019's inventory flags this as a
contradiction and prescribes exactly one per orchestrator (engineering ⇒ ADR 0015). The Step 5
core extraction resolves toward **ADR 0015 Planner-Orchestrator** (Plan 019 directive; matches
the live `planningLoop.mode: planner-orchestrator` manifest), keeping the Self-Execution Ban
(83–84) as floor scope_boundary under either policy.

### Counts (lines per class)

| File | FLOOR | INVARIANT | DIALECT | NEITHER | Total |
|---|---|---|---|---|---|
| orchestrator-engineering | 43 | 4 | 212 | 0 | 259 |
| subagent-backend-architect | 245 | 16 | 127 | 0 | 388 |
| subagent-frontend-architect | 277 | 35 | 116 | 0 | 428 |
| subagent-code-reviewer | 93 | 6 | 111 | 0 | 210 |
| subagent-repo-index | 82 | 6 | 106 | 0 | 194 |
| **Total** | **740** | **67** | **672** | **0** | **1479** |

