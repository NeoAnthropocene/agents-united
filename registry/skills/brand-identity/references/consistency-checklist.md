# Brand Consistency Checklist

In-house adaptation, credited to
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`).

Run this checklist when auditing existing branded content (a site, a deck, a campaign) for drift
from `docs/brand-guidelines.md`:

- [ ] Colors used match the palette in `docs/brand-guidelines.md` (run
      `scripts/extract-colors.mjs --palette` and compare by eye or via an image-analysis pass).
- [ ] Typography matches the declared font stack — no ad hoc system-font fallbacks in shipped
      assets.
- [ ] Voice matches the personality traits and avoids every prohibited term (run
      `scripts/inject-brand-context.mjs` and check generated/reviewed copy against it).
- [ ] Logo lockups follow `references/logo-usage-rules.md` (correct variant, clear space, minimum
      size).
- [ ] Asset filenames follow `references/asset-organization.md` (run
      `scripts/validate-asset.mjs` per file).
- [ ] Messaging claims trace back to an approved pillar/proof point in
      `references/messaging-framework.md` — flag anything that looks invented.
- [ ] Design tokens (`assets/design-tokens.json`/`.css`, if present) still match the guidelines doc
      — if they've drifted, propose a sync (Step 4 of SKILL.md, confirmation gate applies).

Report findings as a table: location, what's inconsistent, the guideline it violates, and the fix —
do not silently correct anything found during an audit; audits report, they don't edit.
