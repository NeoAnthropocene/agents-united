# Semantic Core and the retired creation engine (ADR 0021, ADR 0037)

> Status: **the creation engine is retired.** `src/core/creation/claude.ts` (`createRole`), its created goldens, the
> realization files and the old Claude capability profile were removed on 2026-10-04, after every assertion that was
> still true had been ported to the native and legacy files (ADR 0037). The Semantic Core stays.

## What stays

| Artifact | Where | Edited by |
|---|---|---|
| **Semantic Core** (tool-free: identity, mission, scope boundaries, output contract, safety, invariants, capability classes) | `registry/core/<role>.core.md` | humans, via PR |
| **Contract Floor** in every native role: generated from the core, verbatim | the block between the floor markers of `registry/hosts/<host>/agents/<role>.md` (`UPDATE_NATIVE=1`) | the test run, reviewed in the PR |
| **Declared-Delta Registry** (legacy tool and command tokens) | `registry/translation-ledger.json` | humans, via PR |
| **Native declared deltas** (an invariant a native role does not bind on purpose) | `registry/hosts/claude/deltas.json` | humans, via PR |

`src/core/semantic-core.ts` still guards the boundary: `validateCoreSchema` and the 25-entry forbidden-token corpus keep the core
tool-free, `validateContractFloor` checks the floor verbatim, and `validateDeclaredDeltas` rejects an invariant that is neither
bound nor declared.

## What replaced the engine

A native role is authored (from the core and the host library, by the `realize-for-host` skill) and committed under
`registry/hosts/<host>/`; install copies it verbatim behind a managed marker. Nothing generates a native file at install time.
Conformance is asserted on the committed files:

1. **Floor identity**: `tests/native-claude-agents.test.ts` (generated block, class-derived tools, guard) and `tests/native-conformance.test.ts`
   (floor honored by the native files and the legacy projections; one seeded mutation fails one assertion).
2. **Invariant coverage**: `tests/native-invariant-coverage.test.ts`. Every invariant a native role's core states is evidenced in the file
   (`tests/helpers/native-invariant-evidence.ts`) or declared in `registry/hosts/claude/deltas.json`. Silence fails.
3. **Least privilege**: `tests/claude-privileges.test.ts` and the class-derived grants of `tests/host-profile.test.ts`.
4. **The comms law**: `tests/subagent-comms.test.ts`, `tests/helpers/comms-law.ts`, `tests/native-claude-tier2.test.ts`.

## What did not go

The legacy projection lane (`src/core/claude-projector.ts`, `src/core/cline-projector.ts`, `FEATURE_LEDGER`) still renders 54 of the 59
agents and keeps its golden snapshots (`tests/golden/claude/**`, regenerated only by a maintainer `UPDATE_GOLDEN=1` run). It retires
per bundle, when its roles are native.
