# Semantic Core & Per-Host Creation Engine (ADR 0021)

> Status: **strangler step 1 live** — the Claude realization runs beside the legacy projection
> lane, which stays untouched until a migration batch proves parity (ADR 0021 decision 4).
> Deterministic codegen only: an LLM never renders, translates, or generates agent artifacts.

## The four artifacts

| Artifact | Where | Edited by |
|---|---|---|
| **Semantic Core** (tool-free: identity, mission, scope boundaries, output contract, safety, invariants) | `registry/core/<role>.core.md` | humans, via PR |
| **Capability Profile** (versioned tool-surface snapshot) | `registry/profiles/<host>@<version>.json` | humans, one-host data PRs |
| **Binding Table + Realization Layer** (invariant → host mechanic bindings, command bindings, declared deltas) | `src/core/dialects.ts` (`HOST_DIALECTS`) + `registry/realizations/claude/<role>.json` | humans, via PR |
| **Declared-Delta Registry** (every above-floor divergence, classified `mapped\|approximated\|degraded\|unsupported` + rationale) | `registry/translation-ledger.json` | humans, via PR |

## The engine

`src/core/creation/claude.ts` — `createRole(core, bindingTable, profile)` assembles a native
`.claude/agents/<role>.md` file. Contract Floor fields are emitted **verbatim** (decision 6);
invariants are emitted **bound** to host mechanics (decision 2), never translated. The function
is pure (no clock, no randomness, no I/O): the same inputs return byte-identical output
(acceptance gate 5).

`src/core/semantic-core.ts` guards the boundary:

- `scanCoreForHostTokens` / `validateCoreSchema` — the Semantic Core is tool-free; a 25-entry
  corpus (18 canonical tool tokens + 3 command tokens + 4 residue patterns) is rejected at load.
- `validateContractFloor` — every realization honors identity, scope boundaries, output
  contract, and safety verbatim (whitespace-normalized).
- `validateDeclaredDeltas` — divergence above the floor is legal only when declared; undeclared
  divergence is a conformance failure (decision 6).

## Conformance Suite

`tests/semantic-conformance.test.ts` + `tests/helpers/created-golden.ts` pin:

1. created-output goldens (`tests/golden/claude-created/**`) — byte-identical, 3× deterministic;
2. Contract Floor identity across the 5 pilot realizations (created **and** legacy-projected);
3. declared-delta conformance;
4. the parity gate: created vs legacy-projected outputs agree on all floor fields and on every
   invariant's bound mechanics (mechanic divergences require a live delta entry).

Golden regeneration is an explicit maintainer act — `UPDATE_GOLDEN=1 npx vitest run
tests/semantic-conformance.test.ts` — reviewed in the PR diff. The **legacy** goldens
(`tests/golden/claude/**`) are frozen: they are never regenerated here.

## Host churn = one-host data PR

A host release change touches exactly one Capability Profile (`registry/profiles/`) plus that
host's Binding Table/Realization data and its conformance suite. Runtime detection or
adaptation at creation time is forbidden (decision 8). Coverage stays universal (ADR 0019):
every agent exists on every migrated host; only scope above the Contract Floor varies, and it
varies only where a delta declares it.

## Migration posture (strangler)

The legacy projection lane (`src/core/claude-projector.ts` and the fanout/installer paths) runs
untouched. Pilot batch: the 5 software-engineering roles (1 orchestrator + 4 specialists).
Projection retirement requires proven parity per batch (Plan 022+); until then both lanes run.