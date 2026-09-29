# Visual Identity Standards

In-house adaptation, credited to
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`).

## What belongs in a visual identity standard
1. **Logo system** — primary mark, horizontal/stacked lockups, icon-only mark, minimum clear space,
   minimum size. See `references/logo-usage-rules.md`.
2. **Color system** — primary/secondary/accent/neutral/semantic roles with hex values. See
   `references/color-palette-management.md`.
3. **Typography** — heading/body/mono font stacks and a type scale. See
   `references/typography-specifications.md`.
4. **Imagery style** — photography treatment, illustration style, iconography style, and any AI
   image-generation base prompt/keywords/mood/don'ts (only if the brand actually uses generated
   imagery — never invent this section).
5. **Layout principles** — grid, spacing scale, and any signature compositional device (e.g. always
   left-align headlines, always 24px corner radius).

## Where this lives
All of the above lives in `docs/brand-guidelines.md`, organized under `##`/`###` headings matching
the names above so `scripts/inject-brand-context.mjs` and `scripts/extract-colors.mjs` can parse it.
Use `references/brand-guideline-template.md` as the starting skeleton for a brand-new brand.
