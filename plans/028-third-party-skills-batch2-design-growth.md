# Plan 028: Third-Party Skill Ingestion — Batch 2 (Design, UX Writing, Growth/Brand, Digital Agency)

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: the three owner-supplied `ui-skills.com`
> pages, read 2026-09-27. Runs in parallel with Plans 025/026/027. Files touched: new
> `registry/skills/<name>/**` (with their reference docs and scripts), the `skills` arrays of
> `growth-marketing`, `product-design`, `digital-agency` and `full` in `registry/bundles.json`,
> the specialists named below, pinned skill counts, README Credits.

## Status

- **State**: AUTHORIZED — owner approved 2026-09-27 (via project thread): rename `brand` →
  `brand-identity` and `balise-ux-writing` → `ux-writing`; add `ux-writing` to `digital-agency`
  in addition to `product-design`. Step 0's upstream/licence verification and the `brand` script
  audit still run before authoring.
- **Priority**: P2 · **Effort**: M · **Risk**: Low–Medium (additive; `brand` ships scripts)
- **Depends on**: none. Uses the same intake checklist as Plan 027 (published later by Plan 026
  as `docs/skill-intake.md`). Plan 025's Skill Consultation Map gets the rows if it has landed.
- **Category**: catalog / skills
- **Branch**: `feat/third-party-skills-batch-2` (cut fresh from `dev` when authorized)

## Why this exists

The owner picked three skills to add. They need adaptation, placement in the right domain and
organization bundles, and overlap checks against skills the catalog already has.

## Shortlist

| # | Source skill | Author | Scope | Proposed name | Bundles | Specialist wired |
|---|---|---|---|---|---|---|
| 1 | `banner-design` | nextlevelbuilder | Banners for social, ads, web hero, print; ~13 art-direction styles; platform size specs; 5-step workflow + size/style reference | `banner-design` | `growth-marketing`, `digital-agency` | `marketing-creative-designer` (Jamileh in the agency) |
| 2 | `brand` | nextlevelbuilder | Brand voice, identity, messaging, asset consistency, brand→token sync; 4 scripts, 10 reference docs, starter template | `brand-identity` (the bare name `brand` is too generic to trigger reliably) | `growth-marketing`, `digital-agency` | `marketing-creative-designer`, `marketing-content-strategist` |
| 3 | `balise-ux-writing` | mrstev3n | Interface copy: review/rewrite/generate/harmonize/implement modes, severity triage, 5 reference docs | `ux-writing` | `product-design`, `digital-agency` (owner-approved 2026-09-27) | `ux-strategist`, `ui-designer` (agency: `marketing-conversion-specialist`) |

`digital-agency` is included for all three skills: the owner asked for placement across domain
**and** organization packages, and its creative designer, content and conversion roles are the
direct users of #1, #2 and #3.

**Overlap checks Step 0 must settle** (state the boundary in each skill's Overview):
#1 vs `ad-creative-design`, `marketing-creative-design`; #2 vs `design-system-tokens` and the
agency's `workflow-agency-brand-design-system`; #3 vs `copywriting-frameworks`.

## Intake checklist (same as Plan 027)

Upstream repo + commit SHA in `metadata.source` · licence permits redistribution (else link,
don't vendor) · name passes Claude/Cline rules and equals the directory name · PROJECT.md §7.2
sections with long material in `references/` · scripts run on Windows and POSIX (Node or
Python, no bash-only syntax) and never write files without a confirmation step · no invented
commands · bundles + `full` + specialist wiring · README Credits · catalog counts.

## Objective

1. Verify the three upstreams (existence, licence, SHA) and the overlaps; owner confirms names
   and whether #3 also goes to `digital-agency`.
2. Audit `brand`'s scripts (`inject-brand-context`, `sync-brand-to-tokens`, `validate-asset`,
   `extract-colors`): what each reads and writes, runtime (Node/Python/bash), Windows behaviour.
   Any write-capable script is run only from a runbook step that asks for confirmation first.
   A bash-only script is ported to Node or dropped.
3. Author the three skills with their reference material intact (internal links preserved).
4. Wire bundles, `full`, specialists; add Credits for nextlevelbuilder and mrstev3n; derive or
   bump the skill count (same approach as Plan 027 Objective 4).

## Implementation steps (TDD)

**Step 0 — verification (delegate: `subagent-repo-index` for upstream/licence; `subagent-
security-engineer` for the script audit; `subagent-marketing-creative-designer` for overlaps).**
STOP if a licence forbids redistribution, a script touches credentials or the network without a
gate, or an overlap leaves a candidate with nothing new.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** The three skills exist with
attribution, licence and SHA; names portable; every write-capable script is referenced only from
a runbook step with an explicit confirmation; bundle membership as approved.

**Step 2 — author skills (delegate: `subagent-marketing-creative-designer` for #1 and #2,
`subagent-ux-strategist` for #3).**

**Step 3 — wiring (delegate: `subagent-marketing-creative-designer`).** Bundles, `full`,
specialists, Credits, counts.

**Step 4 — adversarial audit (delegate: `subagent-code-reviewer`).** Overlap boundaries stated;
scripts gated and runnable on Windows; only approved bundles changed.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` green.
2. Three skills pass the intake checklist; reference material and scripts present.
3. Only `growth-marketing`, `product-design`, `digital-agency` (as approved) and `full` changed.
4. No write-capable script runs without a confirmation step; all scripts run on Windows.
5. **Owner manual check (Windows)**: install `digital-agency` with `--fanout claude,cline`; on
   Claude Code, Antigravity and Cline ask for a 3-size social banner set for a sample brand.
   Pass = `banner-design` and `brand-identity` are loaded (visible skill reads), sizes match the
   reference, and no file is written by a brand script without the owner confirming.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | `brand` scripts overwrite design tokens silently | High | Step 0 audit; confirmation gate enforced by test |
| R2 | Scripts are bash-only and fail on the owner's Windows setup | Med | checklist: Node/Python only; port or drop |
| R3 | New skills duplicate existing creative/token/copy skills | Med | Step 0 overlap check; boundary in each Overview |
| R4 | Licence forbids vendoring | Med | link to upstream instead |
| R5 | Conflict with Plan 027 on `full` and counts | Low | derived count; append-only `full` edit |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-repo-index`, `subagent-security-engineer`, `subagent-marketing-creative-designer` | upstream/licence, script audit, overlaps |
| Step 1 | `subagent-qa-automation-lead` | RED tests |
| Step 2 | `subagent-marketing-creative-designer`, `subagent-ux-strategist` | authoring |
| Step 3 | `subagent-marketing-creative-designer` | wiring, credits, counts |
| Step 4 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: `ui-skills.com/skills/nextlevelbuilder/banner-design`,
  `ui-skills.com/skills/nextlevelbuilder/brand`, `ui-skills.com/skills/mrstev3n/balise-ux-writing`
  (read 2026-09-27).
- Convention: README "Skill & Agent Contribution Standard" and "Built-in Safety & Git
  Guardrails"; Plan 026 (intake doc, host matrix); Plan 025 (Skill Consultation Map).
