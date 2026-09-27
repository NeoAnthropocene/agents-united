# Voice, Tone & Terminology Governance

In-house adaptation, credited to
[ui-skills.com/skills/mrstev3n/balise-ux-writing](https://www.ui-skills.com/skills/mrstev3n/balise-ux-writing)
(Apache-2.0 source: `github.com/mrstev3n/balise-skills`).

## Relationship to `brand-identity`
This skill's voice/tone should come from the same source as `brand-identity`'s
`references/voice-framework.md` when both are installed — read `docs/brand-guidelines.md` (via
`brand-identity`'s `scripts/inject-brand-context.mjs` if available) rather than defining a second,
possibly conflicting voice definition for interface copy specifically.

## Terminology governance (harmonize mode)
1. Inventory every term used for the same object/action across the scope (e.g. "workspace" vs.
   "project" vs. "space").
2. Determine the preferred term from evidence: which one is used in the most-trafficked surfaces,
   the API/data model, or existing documentation — not by preference alone.
3. Record the decision (preferred term + rejected variants + why) so future writers don't relitigate
   it.
4. Apply the preferred term at the canonical source first (component library, content schema, or
   design-system text style), then to call sites.

## Tone by moment (not a full voice change)
Keep one voice; let tone shift with the moment — routine, celebratory, error, and high-stakes moments
each read differently in cadence and warmth without changing who the brand is. See
`references/interface-patterns.md` for moment-specific copy patterns.
