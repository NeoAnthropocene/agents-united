# Asset Organization & Naming

In-house adaptation, credited to
[ui-skills.com/skills/nextlevelbuilder/brand](https://www.ui-skills.com/skills/nextlevelbuilder/brand)
(MIT source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`). This is the rule set that
`scripts/validate-asset.mjs` checks against.

## Naming convention
```
{type}_{campaign}_{description}_{YYYYMMDD}[_variant].{ext}
```
- `type`: one of `banner`, `logo`, `design`, `video`, `infographic`, `icon`, `photo`.
- `campaign` / `description`: kebab-case.
- `YYYYMMDD`: the date the asset was finalized.
- `variant` (optional): e.g. `dark`, `es`, `v2`.

Examples: `banner_claude-launch_hero-image_20251209.png`,
`logo_brand-refresh_horizontal_20251209_dark.svg`.

## File-size ceilings
| Category | Max | Recommended |
|---|---|---|
| Raster image (png/jpg/webp/gif) | 5 MB | 1 MB |
| SVG | 500 KB | 100 KB |
| Video | 100 MB | 50 MB |

## Manifest
Register produced assets in `.assets/manifest.json` (an array of `{ path, ... }` objects) so
`scripts/validate-asset.mjs` can flag anything shipped without a manifest entry. Not registering an
asset is a warning, not a hard failure.
