# Plan 031: Antigravity Agent Discovery Spike (agy 1.2.13 workspace layout)

> **Executor instructions**: read-only spike, no implementation until the decision matrix resolves.
> Owner field evidence 2026-09-29 + maintainer machine probes the same day.
> Depends on: Plan 029 gate 6(c)/Step 0(d) questions.

## Status

- **State**: EXECUTED — probes run 2026-09-29 by the owner on agy 1.2.13 (Windows 11,
  real terminal). Verdict **Outcome B** (neither layout loads); see § Findings.
- **Priority**: P1 (blocks the Plan 029 gate-6(c) verdict) · **Effort**: S · **Risk**: Low.
- **Category**: host conformance / discovery.

## Why this exists

Plan 029's launch path assumed flat workspace agents:

- `agy --agent orchestrator-engineering` names `.agents/agents/orchestrator-engineering.md`.
- `runAntigravityStart` refused to spawn unless that flat file existed.
- Step 0(d) ("can an Antigravity orchestrator `invoke_subagent` a workspace agent by name?")
  was explicitly left unverified.

Owner evidence 2026-09-29 on **agy 1.2.13** changes both premises:

1. A plain launch **did not start with `orchestrator-engineering`**; the reporter points at the
   last five `agy changelog` entries and Antigravity docs.
2. The reporter observes custom agents now list under a **directory layout**:
   `{workspace}/.agents/agents/{agent_name}/agent.md`, not the flat
   `{workspace}/.agents/agents/{agent_name}.md` files this repo installs.
3. `agy agents` inside a folder-scope workspace does not surface the orchestrator agent.

Supporting maintainer evidence on the same box 1.2.13: a scratch workspace containing
*both* `probe-agent/agent.md` (directory form) and `flat-agent.md` (flat form) returned
**empty `agy agents` output**. Historical record: `advisor-plans/004-findings.md`
(agy 1.1.14/1.1.15) accepted `--agent` unvalidated with no persona injected
(marker `NOT_FOUND`) in headless/stream-json modes. Separately, the 1.2.11 changelog
reworked project custom agents "not being found or selectable ... under execution with
`--agent`", so a discovery-location change in 1.2.12/1.2.13 is plausible, not proven.

**Interim hardening already shipped on the feature branch** (not the answer, only tolerance):
`runAntigravityStart` accepts either the flat file or the directory entry before spawning.

## Findings (owner probes, agy 1.2.13, quoted verbatim)

- `agy agents` → **empty output** (neither fixture listed).
- `agy --agent flat-probe -i "<identity probe>"` → `(1) Name: Antigravity / (2) NOT_FOUND`
  (directory-layout fixture also answered `NOT_FOUND` + "no frontmatter present" — i.e. the
  stock agent ran, neither fixture prompt was injected).

**Interpretation.** The empty listing alone would be weak (a listing bug, not a load proof),
but the two identity sessions ran the *stock* Antigravity agent in place of the named
fixture — the same failure signature as the 1.1.14/1.1.15 headless verdicts, now reproduced
in interactive-equal (`-i`) sessions. `--agent` accepts the name but resolves no workspace
roster in either layout. The `NOT_FOUND` from the directory fixture additionally shows the
stock agent sees no fixture frontmatter at all.

## Objective — RESOLVED as Outcome B

- **Outcome B (neither loads):** Step 0(d) resolves **NO**; the host-matrix unverified note
  and the fail-closed verbatim rule stay the final answer; Plan 029 gate 6(c) is
  blocked-by-vendor with the desktop route as the supported path.
- Outcomes A/C are closed: neither layout injects, so there is no layout to prefer.

## Decisions (record)

- No agy-specific projection work is authorized by this spike. If a future agy release
  restores workspace discovery, re-run the three probes (listing + per-layout identity)
  before touching the installer.
- The interim flat-or-directory tolerance in `runAntigravityStart` stays (harmless,
  two-path `pathExists` check, covered by unit tests).

## Acceptance gates

1. Verdict B recorded with quoted command evidence — DONE (above).
2. Matrix wording already correct (explicitly unverified), no code — DONE.
3. No implementation lands inside this spike — DONE (tolerance predates the spike).

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Probes | owner (real terminal required; `-i` blocks headless) | three probes × two layouts — DONE |
| Record | `orchestrator-engineering` | verdict into Plan 029 Step 0(d) — DONE |

## References

- Plan 029 gate 6(c), Step 0(d); `docs/host-primitive-matrix.md` §2 (explicitly unverified).
- `advisor-plans/004-findings.md` §§4–7 (1.1.14/1.1.15 headless verdicts).
- `agy changelog` 1.2.11 (custom-agent discovery fix), 1.2.12/1.2.13 (installed here).
