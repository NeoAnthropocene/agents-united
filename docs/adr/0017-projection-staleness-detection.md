# ADR 0017: Renderer-Backed Projection Staleness Detection in `agents doctor`

## Status

Accepted (2026-09-18). Extends ADR 0008 (universal host projection) and ADR 0013 (Cline native discovery projection); complements the Plan 015c `projectedTo` reconcile pass.

## Context

A real field test (Plan 015 §1) exposed that an installed Cline workspace kept a **stale** coordinator rule: `.cline/rules/agents-united-software-engineering.md` carried the ADR 0015 planning policy but was missing the `### Installed Workflows & Workflow Skills` section the current renderer emits. The session's host agent therefore never learned that `/workflow-*` procedures existed — the reported failure.

`DoctorEngine` could not detect this. Its projection checks were limited to:

1. **Presence** — does a recorded `projectedTo` / `projections` path exist on disk?
2. **Managed-marker integrity** — if the marker is gone, report `user-modified projection`.
3. **Ownership consistency** — do recorded owners exist in `installed.bundles`?

Two defects were therefore structurally undetectable:

- **Content drift** — a managed projection edited *after* installation with the managed marker left intact. The lockfile already records `LockfileProjection.hash` (sha256 of the deployed bytes, refreshed on every projection run) but nothing ever compared it to the file's current bytes.
- **Staleness** — a projection rendered from an *older bundle definition* or renderer. Here the on-disk hash still **equals** the recorded hash, so no stored field can reveal it: the only way to know that a file is outdated is to establish what the current renderer *would* produce.

Plan 015c fixed the adjacent problem of renamed/obsolete projection **paths** (`projectedTo` reconcile). The content-level classes remained open.

## Decision

1. **`agents doctor` becomes renderer-backed for projection verification.** For every bundle that owns recorded compound projections, doctor re-resolves the bundle (`RegistryResolver`) and re-plans its projection set (`ClineProjector.planCompoundProjection`) using the same deterministic renderers the installer uses, then diffs the result against disk. Content comparison normalizes CRLF to LF; projection rendering is byte-stable (verified by the Plan 015/015a suites).
2. **Attribution rule — exactly one warning per projection path**, so causes are never conflated or double-reported:
   | Condition | Warning |
   |---|---|
   | File absent, a superseding projection of the same canonical exists | `Stale projection …` (ADR 0017 / Plan 015e, self-healing) |
   | File absent, no superseding projection | `Missing projection …` (unchanged) |
   | Managed marker absent | `user-modified projection …` (unchanged) |
   | Marker present, on-disk hash **≠** recorded `LockfileProjection.hash` | `Content drift …` — edited after installation |
   | Marker present, on-disk hash **=** recorded hash, content **≠** current render | `Outdated projection …` — stale render |
3. **No lockfile schema change.** The existing `LockfileProjection.hash` covers drift; staleness is established by re-rendering and cannot be replaced by any stored field (a stored "renderer version" gives only coarse, version-level granularity and is strictly weaker). Schema churn and migration risk are avoided.
4. **Diagnostic, not destructive.** Doctor only warns; it never rewrites projections. Every projection warning prints the remedy that actually works — `agents update <bundle> --fanout <host>` (managed projections are refreshed deterministically by the update engine).
5. **Graceful degradation.** When the registry is unavailable, a bundle no longer resolves, or a recorded owner is not a real bundle (`domain:*` pseudo-entries), the renderer-backed check is skipped silently rather than emitting speculative warnings. Projections without a recorded `hash` (legacy lockfiles) skip the drift comparison.
6. **Scope: compound projections.** The Cline lane is the only lane whose projection *content* is derived (workflow slugification, coordination rules, team manifests, projected rules); other lanes are deterministic copies whose staleness is covered by the canonical file hash and the existing `projectedTo` checks.

## Consequences

**Positive**
- The exact failure mode that produced Plan 015 becomes detectable: a stale projection is reported with the fix command, instead of surfacing weeks later as unexplained agent behaviour.
- Content drift in a managed projection is now caught even when the marker is intact, closing a silent-tampering blind spot.
- `agents doctor` becomes a credible CI/compliance gate for Cline workspaces (previously it reported healthy on a demonstrably stale install).
- Zero migration risk: no lockfile schema change, no change to projection bytes, and the check is additive to existing warnings.

**Negative / accepted costs**
- `DoctorEngine` gains a dependency on `RegistryResolver` and `ClineProjector` (previously lockfile + filesystem only). Doctor is no longer testable in complete isolation from the registry — mitigated by graceful degradation (decision 5).
- Doctor performs local rendering proportional to installed bundle count (bounded, in-memory, no network).
- New warning class users must act on (`agents update <bundle> --fanout <host>`); teams gating CI on doctor output will need to refresh projections as part of their update flow — which is the intended behaviour.
- The renderer output is now effectively a **contract**: any future non-deterministic rendering would cause false positives. The Plan 015/015a suites guard this determinism and must keep doing so.
