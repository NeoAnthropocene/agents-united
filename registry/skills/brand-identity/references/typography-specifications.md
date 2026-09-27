# Typography Specifications

In-house adaptation, credited to
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`).

## What to define in `docs/brand-guidelines.md`
```markdown
### Font Stack
- heading: 'Inter'
- body: 'Inter'
- mono: 'JetBrains Mono'
```
or as CSS custom properties (`--font-heading: 'Inter';`) — `scripts/inject-brand-context.mjs` reads
either form.

## A minimal type scale
| Role | Size | Line height | Weight |
|---|---|---|---|
| Display | 48–64px | 1.1 | 700 |
| H1 | 36px | 1.15 | 700 |
| H2 | 28px | 1.2 | 600 |
| H3 | 22px | 1.3 | 600 |
| Body | 16px | 1.5 | 400 |
| Small / caption | 13px | 1.4 | 400 |

Keep to at most 2 font families per brand (heading + body, with an optional mono for code) —
`banner-design` and `marketing-creative-design` both enforce a 2-typeface ceiling per artifact for
the same legibility reason.
