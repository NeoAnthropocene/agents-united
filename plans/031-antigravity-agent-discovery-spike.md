# Plan 031: Antigravity Agent Discovery Spike (agy 1.2.13 workspace layout)

> **Executor instructions**: read-only spike, no implementation until the decision matrix resolves.
> Owner field evidence 2026-09-29 + maintainer machine probes the same day.
> Depends on: Plan 029 gate 6(c)/Step 0(d) questions.

## Status

- **State**: PROPOSED — 2026-09-29 (spike; awaiting owner approval to run the probes).
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

## Objective

Replace the hypothesis with a verdict. For **each layout** (flat `.md`, directory
`<name>/agent.md`) on **agy 1.2.13**, in a scratch workspace installed with the Plan 029
branch build:

1. `agy agents` — is the fixture listed? Quote the output.
2. `agy --agent <fixture> --prompt-interactive "<identity probe asking for name +
   marker>"` from a real terminal — does the session inject the fixture prompt?
3. If loaded: `invoke_subagent` the sibling fixture by name — does by-name reach work?

## Decisions (mutually exclusive)

- **Outcome A (directory form loads):** Plan 029 follow-up implements an agy-specific agent
  projection (both layouts or directory-only). Scope: new installer/projection work; the
  flat-only `agents` lane stays untouched. Requires a new plan + owner approval.
- **Outcome B (neither loads):** Step 0(d) resolves **NO**; the host-matrix unverified note
  and the fail-closed verbatim rule stay the final answer; Plan 029 gate 6(c) is
  blocked-by-vendor with the desktop route as the supported path.
- **Outcome C (both load):** file the remaining difference (if any) and keep the flat layout,
  removing the interim tolerance only if the vendor documents directory-only.

## Acceptance gates

1. Verdict A/B/C recorded with quoted command evidence.
2. If A: follow-up plan proposed with scope. If B: matrix wording already correct, no code.
3. No implementation lands inside this spike.

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Probes | owner (real terminal required; `-i` blocks headless) | three probes × two layouts |
| Record | `orchestrator-engineering` | verdict into Plan 029 Step 0(d) |

## References

- Plan 029 gate 6(c), Step 0(d); `docs/host-primitive-matrix.md` §2 (explicitly unverified).
- `advisor-plans/004-findings.md` §§4–7 (1.1.14/1.1.15 headless verdicts).
- `agy changelog` 1.2.11 (custom-agent discovery fix), 1.2.12/1.2.13 (installed here).
