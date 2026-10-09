# ADR 0050: Contributor catalog boundary and unavailable factory shell

- **Status**: Accepted for Plan 033 slice 2, 2026-10-09.
- **Planned at**: `02279368143f7124beecd5c8fd16280847eba9a2`, freshly fetched `origin/dev`. PR #190 is merged at reviewed planning head `f25ba1bb9ccb6940f76404a1bae13718c0ad12e9`. All current ADR numbers and open PRs were checked; open #194 reserves 0049.

## Context

Plan 033 decisions 6–7 put developer tooling in `domain: "contributor"`, visible under **Developers only: contribute to Agents United**, outside ordinary departments, recommendations and `full`. The foundation (#175), Option A and the four-field contract are complete decisions. This slice introduces no authoring skill, native realization or source-aware installer.

Prior art searched: CLI add/list/search/detail actions, `RegistryResolver`, bundle types and manifest, registry/recommendation/Domain Atlas/catalog/lifecycle tests, plans and ADRs, the translation ledger, Claude guides/observations, and open and closed PRs for `agent-factory`, `contributor` and `ADR 0050`. Relevant prior PRs are #39, #120, #138, #175 and #190. `full` is an explicit curated inventory; the list explorer's bundle detail view is the existing inspect surface.

## Decision

1. Keep contributor bundles discoverable in both wizards, static tree, JSON listings, search and detail views. Show the developer label and guidance: author and maintain Agents United artifacts, with optional local drafts and upstream contributions through a reviewed PR to `dev`.
2. **Refuse direct `domain:contributor` batch resolution.** Developers must select a named bundle. This matches the absence of a contributor department-install option and avoids implicitly adding future independent contributor tools. Named bundle discovery remains available.
3. Add `agent-factory` as a Tier-1 Domain Bundle with `domain: "contributor"`, `status: "under-construction"`, no parent/orchestrator and empty agents, skills, workflows and rules. An empty contributor bundle is unavailable regardless of its status or construction/force flags. Resolution fails before the installer writes anything; detail views offer no installation or Operational claim. The baseline host rule does not make an empty shell useful tooling.
4. Preserve `full` as an explicit inventory and fail catalog validation if it declares contributor-exclusive agents, skills, workflows or rules. An exclusive asset is declared by contributor bundles and by no ordinary bundle other than `full`; an asset also declared by an ordinary bundle is shared and remains eligible. Ordinary bundles cannot inherit or recommend contributor bundles, including through aliases. No separate contributor flag or asset classification is introduced.
5. Derive end-user inventory checks from ordinary bundle declarations. Keep shared end-user skills, including `color-theory`, `image-creation` and `brand-consistency-audit`, in `full` and `digital-agency`. Test with populated contributor fixtures so exclusion has observable content before slice 3.

## Consequences and next boundary

Catalog visibility is delivered independently of useful factory tooling. Adding a first skill in slice 3 must satisfy its quality/loading and construction gates; it does not establish native host support. Every shipped non-reference skill needs a loading role, as required by ADR 0045. The empty shell has no such skill or role to claim.

Domain membership deliberately treats an asset explicitly declared by an ordinary bundle as shared. Stronger intent-level asset classification would require separate reviewed schema work. Per-host availability, the Option A source selector/lifecycle, evaluator, contract helper, bundle templates, session-helper distribution and native content remain later scoped work. Preserve Claude → Codex → Antigravity → Cline and distinct deterministic/evaluator/live evidence. No paid host run, R3 rerun or Plan 034–036 change is part of this slice.
