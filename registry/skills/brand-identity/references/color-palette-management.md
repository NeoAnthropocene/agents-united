# Color Palette Management

In-house adaptation, credited to
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`).

## Table format `scripts/*.mjs` expect
`docs/brand-guidelines.md` should define colors under `###` headings with a markdown table of
`| Label | #HEX |` rows, e.g.:

```markdown
### Primary Colors
| Label | Hex |
|---|---|
| Primary Blue | #2563EB |
| Primary Blue Dark | #1E3A8A |
| Primary Blue Light | #93C5FD |

### Secondary Colors
| Label | Hex |
|---|---|
| Secondary Purple | #7C3AED |

### Accent Colors
| Label | Hex |
|---|---|
| Accent Green | #22C55E |
```
Row labels containing "dark"/"light" (case-insensitive) are read as that role's dark/light variant;
the first unlabeled row becomes the role's base color. `scripts/sync-brand-to-tokens.mjs` uses base/
dark/light to generate a 50–900 token scale (see its Code exemplar in SKILL.md).

## Compliance checking
`scripts/extract-colors.mjs --palette` prints the full parsed palette; pass an image path to get a
comparison command and the palette to compare against. A color is "compliant" when its Euclidean RGB
distance to the nearest brand color is ≤ 50 (out of a ~441 max) — treat this as a starting threshold,
not a hard law; tighten or loosen per brand.
