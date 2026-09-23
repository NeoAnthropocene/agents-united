# ADR 0019 — Universal Coverage Rule for Asset Survival

**Status:** Accepted · **Date:** 2026-09-22 · **Scope:** install/remove lifecycle (all hosts)

## Context

Agents United bundles nest: `software-engineering` ⊂ `domain:engineering`, and addon bundles
extend an essentials base via `parentBundle`. Assets therefore routinely serve more than one
installed identifier. Removal semantics were driven by **owner refcounts** with one path-based
carve-out (`.agents/plugins/<bundle>/` artifacts were "per-bundle distribution, owned by the
shipping bundle alone").

The operator disproved that carve-out: `agents add domain:engineering` → `agents add
software-engineering` → `agents remove software-engineering` deleted 28 files
(`.agents/plugins/software-engineering/**`) while `domain:engineering` — a strict superset —
still stood. Those 28 are not packaging: they contain the **Team Manifest**
(`CONTEXT.md`: "The authoritative YAML document … declaring team membership, role descriptions,
required skills"), which coordinator rules cite as their deterministic phase gate, plus the
Claude Plugin Lane payload (`.claude-plugin/plugin.json` + `agents/`) and the plugin's skill
mirrors. Deleting them degrades the surviving domain.

The carve-out's original rationale ("otherwise removing the domain deletes the member's package")
was a false dilemma: refcounting already answers that direction.

## Decision

**Universal Coverage Rule (survival).** An artifact is deleted on removal **iff no surviving
installed identifier covers its source** — and for bundle-derived artifacts (`.agents/plugins/<b>/…`
— team manifest, plugin.json, coordinator rule, plugin skill mirrors) the source is **the bundle
itself**: a survivor covers it when what it **declares** is a superset of `<b>`'s declared assets.

Declaration is deliberately *not* resolution, and ownership is deliberately *not* survival:

- **Ownership (A6, ADR 0006 — unchanged):** each bundle's package is owned by the shipping bundle
  alone, and canonical ownership follows the Declared Asset Set. An addon (`parentBundle`) shares
  skills but ships its **own** mirror, so it does not keep the parent's package alive — and the
  parent-only surface dies with the parent. The conformance suites pin this.
- **Survival (this ADR):** a **domain** pseudo-bundle's declaration *is* its expansion (the union
  of its members), so `domain:engineering` declares a superset of `software-engineering` and its
  package — including the **Team Manifest** that coordinator rules cite as their deterministic
  phase gate — must survive `remove software-engineering`. On survival, the coverers become the
  artifact's owners.

Zero recorded owners is therefore not the end of the story; coverage is consulted before deletion,
and surviving coverers become the artifact's owners. Path-based exclusions are removed
(`installer.ts` projection owner seeding, `uninstaller.ts` `projectionOwners`).

## Consequences

- Removing a subset under a superset deletes **nothing** (`removed` = `[]`), and the summary names
  the surviving owner. Removing the last coverer deletes everything — zero orphans preserved.
- Symmetric in both directions: removing the domain keeps the member's package (the old concern),
  removing the member keeps it under the domain (the reported bug).
- Same rule mechanically covers the `parentBundle` addon case (removing a parent an addon still
  inherits keeps the parent's surface).
- Legacy lockfiles self-heal: coverage is computed from the registry at removal time, not from
  stale owner lists.
- Write-time ownership still follows the Declared Asset Set (ADR 0006/A6 contract unchanged);
  this ADR governs **survival**, not authorship.

## Evidence

`tests/ownership-refcount.test.ts` T7/T8/T9 (the reported sequences, both orders, with the
subset-over-superset expectation `removed = []`), plus the full lifecycle suites.