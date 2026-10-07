# ADR 0046: Local contributor installation

- **Status**: Proposed, 2026-10-07. No dependent installer work is authorized or implemented in Plan 033's foundation slice.
- **Context**: Plan 033 decision 7 requires useful local creation without upstream contribution. `RegistryResolver(customRegistryDir)` supports an internal alternate registry, while `src/cli.ts` constructs the packaged resolver with no local-registry selector. `.agents/` contains managed install outputs on Antigravity/Cline and is not a second authoring registry. Existing native ownership, hash tracking and doctor behavior assume assets resolved from the selected registry; silently mixing unmanaged local drafts would violate that assumption.

## Proposed decision and concrete options

| Option | Source and installation | Required reviewed work | Tradeoff |
| --- | --- | --- | --- |
| A — workspace source registry (recommended) | A user-selected workspace registry holds authored sources; an explicit future CLI selector installs copies into normal host paths. No implicit overlay. | Persist source identity and content hashes; define update/doctor behavior when source is missing; collision refusal with a user-selected rename; migration/removal tests. | Portable, explicit ownership; adds a selector and source-aware state. |
| B — user source registry | A user directory holds sources shared across workspaces; each install records its registry and revision. | The same ownership work plus global/project precedence and privacy boundaries. | Reuse across projects; paths and updates are less portable. |
| C — manual host-native drafts only | Copy reviewed draft artifacts into an unmanaged host directory yourself; the installer does not claim them. | A per-host recipe and a collision check against managed files. | Smallest change; no bundle resolution, managed update or doctor support. |

Until decided, ADR 0045 uses user-chosen draft output only. The user explicitly selects `local` or `upstream`; a local draft does not open a PR. Copied/adapted material still needs licence and attribution, while independent work records inspiration accurately. The output root must not overlap a managed destination. No option makes edits to a managed projection authoritative.

## Consequences and review question

Choose A, B or C before implementing local installation, lockfile source identity or doctor treatment. This choice does not block the foundation contract, the separate catalog-section slice, or an upstream-only realization using the established repository workflow. The recommendation is proposed, not accepted. No security hold or host baseline changes follow from it.
