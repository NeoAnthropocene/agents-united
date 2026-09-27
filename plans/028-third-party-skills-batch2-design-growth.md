# Plan 028: Third-Party Skill Ingestion — Batch 2 (Design, UX Writing, Growth/Brand)

> **Executor instructions**: self-contained; TDD; STOP on listed conditions; update this plan's
> row in `plans/README.md` when done. Source evidence: owner-supplied `ui-skills.com` pages,
> read in full 2026-09-27 (see § Evidence). Runs independently of Plans 025/026/027; touches
> only new `registry/skills/<name>/SKILL.md` directories (plus their bundled reference files/
> scripts where the source skill ships them), the `skills` arrays of `growth-marketing` and
> `product-design` in `registry/bundles.json`, and README.md's Credits section.

## Status

- **State**: PROPOSED — awaiting owner approval
- **Priority**: P2 · **Effort**: M · **Risk**: Low (additive; three well-scoped skills, two
  bundles touched)
- **Depends on**: none (independent of 025/026/027)
- **Category**: catalog / skills
- **Branch**: `feat/third-party-skills-batch-2` (cut fresh from `dev` when authorized)

## Why this exists

The owner supplied three specific skill pages from `ui-skills.com` to evaluate for inclusion.
Unlike Plan 027's source (a large aggregator needing heavy triage), these three are already a
short, pre-selected list — the work here is adaptation and bundle placement, not further
curation.

## Evidence / Shortlist

| # | Skill (source name) | Author | One-line | Target bundle | Shape |
|---|---|---|---|---|---|
| 1 | `banner-design` | nextlevelbuilder | Multi-format creative banner design (social, ads, web hero, print) across ~13 art-direction styles with platform size specs | `growth-marketing` | Full methodology: 5-step workflow (requirements → art direction → design/generate → export → present/iterate) + a bundled size/style reference file + concrete design rules (safe zones, contrast, CTA placement) |
| 2 | `brand` | nextlevelbuilder | Brand voice, visual identity, messaging framework, and asset-consistency management; syncs brand guidelines into design tokens | `growth-marketing` | Heavier "system" than #1: ships 4 helper scripts (`inject-brand-context`, `sync-brand-to-tokens`, `validate-asset`, `extract-colors`), 10 reference docs (voice, visual identity, messaging, color, typography, logo usage), and a starter template |
| 3 | `balise-ux-writing` | mrstev3n | Context-aware UX writer/content designer: reviews, rewrites, generates, and harmonizes interface copy (buttons, errors, onboarding, consent) preserving product behavior, terminology, accessibility, and localization constraints | `product-design` | Full methodology: 5 operating modes (review/rewrite/generate/harmonize/implement), a 6-step workflow, an evidence-surface framework, severity triage, 5 topical reference docs |

All three are genuine multi-file methodologies, not single techniques — each should ship with
its bundled reference docs/scripts intact (per the shared skill progressive-disclosure model
confirmed in Plan 026's host research: scripts execute with only their output entering context,
identically across Claude Code, Antigravity, and Cline).

## Objective

1. Adapt each of the three source skills into `registry/skills/<name>/SKILL.md` conforming to
   PROJECT.md §7.2's 7 mandatory sections (or Plan 025's Skill Consultation Map-compatible shape
   if that plan has landed first), preserving the source's bundled reference files (`brand`'s 4
   scripts + 10 reference docs; `banner-design`'s size/style reference; `balise-ux-writing`'s 5
   reference docs) under the skill's own directory, with attribution per README.md §5.
2. `brand`'s bundled scripts (`inject-brand-context`, `sync-brand-to-tokens`, `validate-asset`,
   `extract-colors`) must be reviewed for what they actually do (read tokens/assets from the
   project vs. write/modify them) before being carried over verbatim — a script that mutates
   design-token files needs the same "protected branch / no destructive default" posture the
   rest of this catalog already enforces (README.md "Built-in Safety & Git Guardrails"). If a
   script writes files without confirmation, gate it behind an explicit opt-in step in the
   skill's runbook rather than silently porting an auto-write behavior into this ecosystem.
3. Add `banner-design` and `brand` to `growth-marketing.skills`; add `balise-ux-writing` to
   `product-design.skills` — only those two bundles' arrays.
4. Add a `## Credits & Acknowledgments` entry for `nextlevelbuilder` and `mrstev3n` in
   README.md, matching the existing format (e.g. the `Currents & Microsoft Playwright
   Community` or `tovimx` entries, which credit a single external author/repo).
5. Cross-check for overlap with existing `growth-marketing`/`product-design` skills before
   wiring in: `growth-marketing` already has `ad-creative-design`, `marketing-creative-design`,
   `design-system-tokens`, `frontend-design`, `stitch-design-taste`; `product-design` already
   has `design-system-tokens`, `frontend-design`, `stitch-design-taste`. Step 0 must confirm
   `banner-design`/`brand`/`balise-ux-writing` are additive, not duplicative, and note the
   boundary in each new skill's Overview section (e.g. `brand` vs. `design-system-tokens`: the
   former owns voice/identity/asset governance, the latter owns the token schema itself).

## Implementation steps (TDD)

**Step 0 — overlap check + script safety review (delegate: `subagent-marketing-creative-
designer` for the overlap check; `subagent-security-engineer` for the `brand` scripts audit).**
Confirm no duplicate scope against the existing skills named in Objective 5. Read the actual
`inject-brand-context`/`sync-brand-to-tokens`/`validate-asset`/`extract-colors` script sources
from `ui-skills.com/skills/nextlevelbuilder/brand` and classify each as read-only or
write-capable. STOP and ask the owner if any script performs a destructive or credential-
touching action with no visible opt-in gate.

**Step 1 — RED tests (delegate: `subagent-qa-automation-lead`).** Extend the skill-schema test
(shared with Plan 027, or authored here if 027 hasn't landed yet) to assert: `banner-design`,
`brand`, `balise-ux-writing` exist with all 7 sections and real attribution metadata; any
write-capable script bundled with `brand` is referenced from a runbook step that names an
explicit confirmation gate, not an unconditional auto-run instruction.

**Step 2 — author skills (delegate: `subagent-marketing-creative-designer` for `banner-design`
and `brand`; `subagent-ux-strategist` or `subagent-design-ops-lead` for `balise-ux-writing`).**
Port each source skill's methodology into the 7-section SKILL.md shape, preserving reference
docs/scripts under the skill directory, adding the confirmation gate from Step 0 where needed.

**Step 3 — bundle wiring + credits (delegate: `subagent-marketing-creative-designer`).** Add
the two `growth-marketing` skills and the one `product-design` skill to their respective
`skills` arrays in `registry/bundles.json`; add the two README.md credit entries.

**Step 4 — adversarial audit (delegate: `subagent-code-reviewer`).** Confirm the overlap
boundaries from Objective 5 are stated explicitly in each new skill's Overview section, confirm
no write-capable script from `brand` runs without an explicit gate, confirm `agents doctor` and
`agents list` show correct bundle attribution.

## Acceptance gates

1. `npm run typecheck` exit 0 · `npm test` fully green including the extended skill-schema
   assertions.
2. `banner-design`, `brand`, `balise-ux-writing` exist under `registry/skills/` with real
   attribution metadata, all 7 PROJECT.md sections, and their bundled reference material intact.
3. `banner-design` and `brand` appear in `growth-marketing.skills`; `balise-ux-writing` appears
   in `product-design.skills`; no other bundle's `skills` array changed.
4. Each new skill's Overview section states its boundary against the pre-existing overlapping
   skill named in Objective 5.
5. Every write-capable script ported from `brand` is gated behind an explicit confirmation step
   in the skill's runbook — none auto-runs.
6. README.md Credits section has two new entries (`nextlevelbuilder`, `mrstev3n`) matching the
   existing format.

## Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | `brand`'s bundled scripts silently write/overwrite project design-token files | High | Step 0 script audit; Step 1 test asserts an explicit confirmation gate exists before any write-capable script's runbook step |
| R2 | New skills duplicate existing `design-system-tokens`/`frontend-design`/`stitch-design-taste` scope, causing orchestrator confusion about which skill to consult | Med | Objective 5 boundary statement, verified in Step 4 |
| R3 | Porting a large multi-file skill (10 reference docs for `brand`) loses fidelity or breaks internal cross-references between its own docs | Low | Step 2 preserves the source's internal structure/links as-is under the new skill directory rather than summarizing |
| R4 | `registry/bundles.json` edit collides with a parallel plan's edit to the same file | Low | Step 3 touches only `growth-marketing`/`product-design` arrays; rebase against `dev` if 025/026/027 land first |

## Delegation map (ADR 0015 planner-orchestrator posture)

| Phase | Specialist | Scope |
|---|---|---|
| Step 0 | `subagent-marketing-creative-designer`, `subagent-security-engineer` | overlap check + script safety audit |
| Step 1 | `subagent-qa-automation-lead` | RED schema + script-gate tests |
| Step 2 | `subagent-marketing-creative-designer`, `subagent-ux-strategist` | skill authoring |
| Step 3 | `subagent-marketing-creative-designer` | bundle wiring + README credits |
| Step 4 | `subagent-code-reviewer` | adversarial audit |

## References

- Evidence: `ui-skills.com/skills/nextlevelbuilder/banner-design`,
  `ui-skills.com/skills/nextlevelbuilder/brand`, `ui-skills.com/skills/mrstev3n/balise-ux-writing`,
  read 2026-09-27 (this session).
- Convention: README.md §"Skill & Agent Contribution Standard"; README.md "Built-in Safety &
  Git Guardrails" (no destructive default behavior).
- Sibling: Plan 025's Skill Consultation Map convention, if landed first, should be used to wire
  `subagent-marketing-creative-designer`/`subagent-ux-strategist`/`subagent-design-ops-lead` to
  these new skills explicitly rather than relying solely on the flat `skills:` array.
