# Worked example (invented brand, for checking your own work)

Brand: primary blue `#1D4ED8`, warm accent `#F59E0B`, body font Inter. The ratios are the WCAG ones, computed with the formula in [../references/contrast-table.md](../references/contrast-table.md) (the `accessibility-audit` helper prints the same numbers).

## The contrast table

| Text | Background | Ratio | Verdict |
|---|---|---|---|
| `#111827` | `#FFFFFF` | 17.74 | pass |
| `#6B7280` | `#FFFFFF` | 4.83 | pass for normal text |
| `#6B7280` | `#F3F4F6` | 4.39 | **fails** for normal text: darken muted on grey surfaces |
| `#1D4ED8` | `#FFFFFF` | 6.70 | pass (links; a white label on a blue button is the same pair) |
| `#F59E0B` | `#FFFFFF` | 2.15 | **fails** as text: use it as a fill with a dark label |
| `#111827` | `#F59E0B` | 8.26 | the label on the amber fill |
| `#B45309` | `#FFFFFF` | 5.02 | the accessible amber for text |

## The token file

```json
{
  "color": {
    "blue": { "700": { "$value": "#1D4ED8", "$type": "color" } },
    "amber": { "500": { "$value": "#F59E0B", "$type": "color" }, "700": { "$value": "#B45309", "$type": "color" } },
    "gray": { "500": { "$value": "#6B7280", "$type": "color" }, "900": { "$value": "#111827", "$type": "color" } },
    "text": {
      "default": { "$value": "{color.gray.900}", "$type": "color" },
      "muted": { "$value": "{color.gray.500}", "$type": "color", "$description": "white surfaces only; use gray.600 on gray.100" }
    },
    "action": { "primary": { "$value": "{color.blue.700}", "$type": "color" } },
    "accent": { "fill": { "$value": "{color.amber.500}", "$type": "color", "$description": "fill only, label with text.default" } }
  }
}
```

The brand colour `#F59E0B` was given and is not altered; `#B45309` is derived, and it is the step that carries amber text.
