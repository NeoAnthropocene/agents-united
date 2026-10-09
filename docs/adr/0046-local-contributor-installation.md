# ADR 0046: Local contributor installation

- **Status**: Option A accepted by the maintainer, 2026-10-08; originally proposed 2026-10-07. No dependent installer work is authorized or implemented in Plan 033's foundation slice.
- **Context**: Plan 033 decision 7 requires useful local creation without upstream contribution. `RegistryResolver(customRegistryDir)` supports an internal alternate registry, while `src/cli.ts` constructs the packaged resolver with no local-registry selector. `.agents/` contains managed install outputs on Antigravity/Cline and is not a second authoring registry. Existing native ownership, hash tracking and doctor behavior assume assets resolved from the selected registry; silently mixing unmanaged local drafts would violate that assumption.

## Decision and considered options

**Maintainer decision, 2026-10-08:** choose **A — workspace source registry**. Authored sources live in a user-selected workspace registry, separate from managed install outputs. A future explicit selector installs copies into normal host paths and records source identity and hashes. This keeps local creation portable and its ownership explicit; upstream contribution remains optional.

| Option | Source and installation | Required reviewed work | Tradeoff |
| --- | --- | --- | --- |
| A — workspace source registry (accepted) | A user-selected workspace registry holds authored sources; an explicit future CLI selector installs copies into normal host paths. No implicit overlay. | Persist source identity and content hashes; define update/doctor behavior when source is missing; collision refusal with a user-selected rename; migration/removal tests. | Portable, explicit ownership; adds a selector and source-aware state. |
| B — user source registry | A user directory holds sources shared across workspaces; each install records its registry and revision. | The same ownership work plus global/project precedence and privacy boundaries. | Reuse across projects; paths and updates are less portable. |
| C — manual host-native drafts only | Copy reviewed draft artifacts into an unmanaged host directory yourself; the installer does not claim them. | A per-host recipe and a collision check against managed files. | Smallest change; no bundle resolution, managed update or doctor support. |

Until the accepted model is implemented, ADR 0045 continues to use user-chosen draft output only. The user explicitly selects `local` or `upstream`; a local draft does not open a PR. Copied/adapted material still needs licence and attribution, while independent work records inspiration accurately. The output root must not overlap a managed destination. Edits to a managed projection do not become authoritative authored sources.

## Contribution scope and host availability

Option A selects the local source and installation model. The upstream route remains a contribution branch and reviewed PR targeting `dev`, with its intended hosts/surfaces and evidence declared in the artifact template. A proposed native realization can be scoped to one host; this does not establish support for other hosts or waive an artifact's applicable acceptance criteria.

Showing only the hosts for which a particular bundle is available, and refusing installation on other hosts, requires a separate catalog/installer availability contract. Option A does not select or implement that policy. The current `BundleDefinition` has no per-bundle host-availability declaration; the existing host availability status is product-wide. Approval/merge alone does not create this filtering behavior. **Sequence amendment, 2026-10-08:** ADR 0048 now selects independent factory stages in Claude → Codex → Antigravity → Cline order, replacing the earlier simultaneous three-host criterion. That sequence still does not implement availability filtering.

## Consequences and implementation boundary

The source-model choice is resolved. Implementing its selector, lockfile source identity, collision handling, update/removal and doctor treatment requires separately authorized and reviewed work. This decision does not block the foundation contract, the separate catalog-section slice, or an upstream-only realization using the established repository workflow. No later slice, security hold or host baseline change is authorized by accepting A.
