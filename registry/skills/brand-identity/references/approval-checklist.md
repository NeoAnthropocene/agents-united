# Brand Approval Checklist

In-house adaptation, credited to
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`).

Before an asset or piece of copy is marked "approved" and shipped:

- [ ] Passed `references/consistency-checklist.md`.
- [ ] `scripts/validate-asset.mjs` exits 0 for every new asset file.
- [ ] No prohibited term (see `references/voice-framework.md`) present in shipped copy.
- [ ] Every claim traces to `references/messaging-framework.md`'s value pillars/proof points.
- [ ] If design tokens were touched, `scripts/sync-brand-to-tokens.mjs --dry-run` was reviewed and
      the write, if any, went through the confirmation gate in SKILL.md Step 4 — never approve a
      token change that bypassed the gate.
- [ ] A named human owner signed off (record who, and when, in the campaign/asset's own tracking —
      this skill does not maintain an approval log itself).
