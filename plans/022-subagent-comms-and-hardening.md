# Plan 022: Subagent Comms & Hardening (proposal C1–C7 / H1–H7 + canonical-store-optional installs)

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: the owner-approved field report
> `2026-09-25-subagent-communication-and-hardening.md` (Claude Code session, Gate 7) and the
> Gate 7 findings round (2026-09-25). Deterministic artifacts only — never LLM-rendered.

## Status

- **State**: AUTHORIZED — product owner 2026-09-25 ("Plan 022 - Yes, author as a plan file")
- **Priority**: P1 · **Effort**: L · **Risk**: HIGH (agent-runtime behavior + installer shapes)
- **Depends on**: plans/019 (canonical prompt correctness), plans/021 (Semantic Core + creation
  engine — the invariants this plan binds), ADR 0022 (canonical-store-optional installs)
- **Category**: core / runtime integration / catalog
- **Branch**: fresh branch from `dev` (e.g. `feat/subagent-comms-and-hardening`)

## Why this exists

Gate 7 live testing proved three defects in the installed workspace: (1) peer messages are
delivered but **read only at the receiver's next step** — two specialists that end their turn
after sending never see each other's tokens; (2) specialists hold an **unrestricted `Agent`**
tool and reviewers run with `acceptEdits` + `Bash`; (3) lifecycle hooks are **prose only** (no
`settings.json` is written), `maxTurns` is unbounded, and orchestrator prompts reference tools
(`TaskCreate(action: …)`, Bash `task-id`) that do not exist on Claude. The proposal's C/H/O
items are the approved remediation; this plan executes C1–C7 and H1–H7, absorbs the sidecar
integrity fix as resolved pre-work, and implements ADR 0022.

## Pre-work (resolved 2026-09-25, verify only)

- **Sidecar integrity (ADR 0017 amendment)**: markerless skill sidecars (`LICENSE.txt`,
  `references/**`) are verified by byte-hash against the lockfile record instead of the managed
  marker (doctor/updater/uninstaller). Landed; B2/B3 removal matrix and doctor lanes green.

## Objective

1. **C1/C3–C5/C7 — comms protocol**: hub-and-spoke by default (peers report to the
   orchestrator), inbox-check discipline (read before you finish), no cross-subagent
   `SendMessage` without orchestrator wakeup, live-session reply allowance, banned
   `SendMessage` to the lead's main thread. Realized as Core invariants + per-host bindings
   (ADR 0021 lanes); the wording pass rides Plan 019.
2. **C2 + C6 — prompt fixes now**: "check your inbox before your final report" and the Report
   section additions (Peer messages received / Open items).
3. **H2/H3 — least privilege**: specialists get a nested-spawn-bounded or zero `Agent` tool;
   reviewers/indexers drop `Bash` and run read-only permission modes; frontend-architect loses
   `TaskCreate`/`CronCreate`; production-deploy exemplars require a human-approval caveat.
4. **H1 — iteration limits**: **scope narrowed by owner decision (2026-09-25)** — iteration
   caps stay **Tier-2-only** (organization-bundle coordinators via
   `planningLoop.budget.maxIterations`; Tier-1 domain agents stay uncapped). The digital-agency
   budget is raised `maxIterations: 8 → 100` as an experiment for bigger projects (not yet
   validated by tests — revisit with real usage data). Only if evidence shows Tier-1 loops
   runaway does the per-agent `maxTurns` question reopen **[verify against current Claude Code
   docs first]**.
5. **H5 — hooks that actually run**: ship a managed `.claude/settings.json` hook wiring
   (block `git push --force`, `.env` writes, `vercel --prod`) **[verify hook events]**; or mark
   hooks advisory in prompts (H7/O9) until then.
6. **H6/O4/O5/O7 — orchestrator correctness**: the specialist runs TDD (the orchestrator checks
   evidence), proportional grilling, installed-type awareness in the delegation map.
7. **ADR 0022 — canonical-store-optional installs**: store-less single-host install shapes +
   lockfile home + doctor/update/uninstall coverage + `--canonical-store` flag + TUI copy.

## Implementation steps (TDD)

**Step 0 — contract spike (delegate: `subagent-repo-index`, read-only).** Inventory every
`SendMessage`/inbox/peer-messaging claim across `registry/agents/**` + the created cores;
classify each as INVARIANT (comms law) / BINDING (host mechanic) / RESIDUE (Plan 019). STOP if
any comms claim is neither.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).**
`tests/subagent-comms.test.ts` (inbox-check invariant present in every specialist core +
created output; spawn-template fields emitted by the orchestrator creation),
`tests/claude-privileges.test.ts` (tool allowlists: no nested `Agent` on specialists, no
`Bash`/`Write`/`Edit` on reviewers, no `TaskCreate`/`CronCreate` on frontend; permission-mode
conformance), `tests/max-turns.test.ts` (**[verify]** field name first),
`tests/store-less-install.test.ts` (ADR 0022 acceptance).

**Step 2 — comms invariants + bindings (delegate: `subagent-backend-architect`).** Extend the
Semantic Core invariants + `HOST_DIALECTS.claude.invariantBindings` + per-role Realization
Layers with C1–C7 mechanics (inbox-check before finish, wake-up pattern, spawn prompt
template); regenerate created goldens (reviewed).

**Step 3 — privilege hardening (delegate: `subagent-backend-architect`).** H2/H3/H4 allowlists
+ permission modes + exemplar caveats in `registry/agents/**` (canonical) and Realization
Layers (created lane); legacy lane changes ride Plan 019's golden regeneration.

**Step 4 — limits + hooks (delegate: `subagent-backend-architect`).** H1 `maxTurns` **[verify]**
+ H5 managed `.claude/settings.json` hooks lane (or H7 advisory downgrade).

**Step 5 — ADR 0022 store-less installs (delegate: `subagent-backend-architect`).** Lockfile
home resolution, `--canonical-store`, doctor/update/uninstall store-less coverage.

**Step 6 — adversarial audit (delegate: `subagent-code-reviewer`).** Privilege escapes, comms
gaps, nondeterminism, legacy-lane regressions. Fix findings.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green; legacy goldens byte-unchanged or
   regenerated **only** under a reviewed Plan 019 pass.
2. Ping/pong without wake-up: two specialists quote each other's tokens on the FIRST report.
3. Missing peer reports failure under Open items and does not hang.
4. Low-turn-budget agent returns a partial report at the limit.
5. Nesting: a reviewer/indexer asked to spawn an agent cannot (no `Agent` tool).
6. Read-only: a reviewer asked to write a file is blocked (tool absence or hook).
7. Hooks: `git push --force`, `.env` writes, `vercel --prod` each blocked with a clear message.
8. Reinstall regression: projected `.claude/agents/*.md` carry the new sections; zero managed
   drift; ADR 0022 store-less install passes its acceptance set.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Comms protocol diverges across hosts | High | invariants in Core, mechanics in Bindings (ADR 0021); per-host conformance |
| R2 | Privilege hardening breaks working delegation | High | gates 2–6; strangler keeps the legacy lane for rollback |
| R3 | `maxTurns` field unverified | Med | **[verify]** gate before Step 4; skip cleanly if unsupported |
| R4 | Store-less install forks the installer state machine | High | ADR 0022 sub-decisions first; doctor/update/uninstall acceptance set |
| R5 | Golden churn hides regressions | Med | goldens regenerated only in reviewed passes; byte-pin suites stay green |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index` | comms-claim inventory |
| Step 1 | `subagent-qa-automation-lead` | RED suites |
| Steps 2–5 | `subagent-backend-architect` | invariants/bindings, privileges, limits/hooks, store-less installs |
| Step 6 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: `2026-09-25-subagent-communication-and-hardening.md` (C1–C7, H1–H7, O1–O10; §5
  acceptance tests — this plan's gates mirror §5).
- Binding: `docs/adr/0021-semantic-core-and-per-host-native-realization.md`,
  `docs/adr/0022-canonical-store-optional-installs.md`, ADR 0017 (sidecar amendment).
- Sibling: plans/019 absorbs O1–O4/O6/O9/O10 wording; plans/021 supplies the Core/Bindings.
## Verification note (V1) — 2026-09-25

Executed on branch `feat/plan-022-comms-and-hardening` (cut from `dev` @ `d9afb15`); each group
owner-reviewed before commit. Scope decisions recorded during execution: the C/H item
definitions are **this plan's** (owner, 2026-09-25 — the field report is not in the repo);
H1 stays **Tier-2-only** (owner, 2026-09-25); **ADR 0022 deferred** to its own plan/PR (owner,
2026-09-25) — Objective 7 / Step 5 / gate 8's store-less clause are NOT delivered here.

| Group | Commit | Evidence |
|---|---|---|
| F1 (Plan 019 Step 5 finding) | `0776d16` | Tier-1 consult step → unconditional MUST-consult gate ×8 + Tier-2 Phase 0.5 mirror; `claude-projection-residue` (e)/(f) |
| C1–C7 comms law | `1bb4899` | 50 specialists + 9 orchestrators (host-neutral); 4 Core invariants bound in `HOST_DIALECTS.claude`; `tests/subagent-comms.test.ts` |
| H1–H7 hardening | `97f6d29` | Tier-2-only cap validation (`tests/max-turns.test.ts`); no `Agent` on specialists, read-only reviewers/indexers, frontend task/timer tools dropped, prod-deploy caveat, created-lane per-role allowlists (`tests/claude-privileges.test.ts`); managed PreToolUse guard executed against real payloads (`tests/claude-hooks.test.ts`) |

**[verify] items resolved** against the Claude Code docs (2026-09-25): `maxTurns`, `hooks`,
`disallowedTools`, `permissionMode: plan` are documented subagent frontmatter; a subagent's
`Agent(type)` list is ignored (omission is the only nesting bound); frontmatter hooks fire for
spawned subagents **and** `--agent` main sessions; PreToolUse exit 2 blocks with stderr as reason.

**Gates**: typecheck exit 0; `npm test` 56 files, 803 passed / 0 failed / 209 skipped (clone
baseline on `dev` was 52 files 766/209, not the 767/208 quoted in the brief). Goldens regenerated
only in reviewed passes; legacy `tests/golden/claude/**` CRLF/LF byte style preserved line-by-line.

**Owner live checks still open (cannot run from a cloud session)**: gates 2–7 on Claude CLI —
F1 consult observed; ping/pong quotes on the first report; missing peer under Open items;
reviewer cannot spawn / cannot write; the three guard blocks. Known gap: a plain `claude` session
without `--agent` is not guarded (would need a managed `.claude/settings.json` lane).
