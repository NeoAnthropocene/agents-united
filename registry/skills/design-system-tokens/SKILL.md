---
name: design-system-tokens
description: "Define a design token set that engineering can ingest: primitive, semantic and component tiers, type and spacing scales by rule, contrast-checked colour pairs, a dark theme, a design-tokens.json file, and the hand-off to the front-end architect."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🎨
disable-slash-command: true
---

# Design System Tokens

## Overview & Purpose
A token is a named decision: this is our primary action colour, this is the gap between a label and its field. A good set lets a developer build every screen without choosing a colour or a pixel value, and lets a brand change in one place. This skill gives the creative designer the structure, the rules that generate the scales, the checks that keep it accessible, and the file engineering expects.

It produces the token file and its rationale. It does not build the components or the Tailwind theme (Deniz does) and it does not choose the brand itself (the brief and `brand-identity` do).

## Execution Triggers
Load it when you write or extend `design-tokens.json`, when a campaign needs a palette that must also work in a product, or when engineering reports hardcoded values. Do not use it for a one-off banner (use `ad-creative-design`) or when the client already has a token set (audit it, do not replace it).

## Input/Output Requirements
Inputs: brand colours and fonts as given (hex, font files or families), the surfaces (marketing site, product, email), whether a dark theme is required, the target platforms, and any existing tokens or Tailwind config.

Outputs: `design-tokens.json` in three tiers; a contrast table for every text and background pair; the scale rules used; a usage note per semantic token; a migration list if hardcoded values exist. **Evidence to attach**: the computed contrast ratio of each pair, and which brand values were given versus derived.

## Step-by-Step Runbook
1. **Take the brand inputs as given and flag what you derive.** Do not alter the brand colour to pass a contrast test; derive a darker or lighter step beside it and say which one carries text.
2. **Tier 1, primitives**: raw values with no meaning. A colour ramp of 9 to 11 steps per hue (50 to 950), a type scale, a spacing scale, radii, shadows, durations.
3. **Generate the scales by rule, not by eye.** Spacing on a 4 px base (4, 8, 12, 16, 24, 32, 48, 64). Type scale on a fixed ratio (1.2 for dense product UI, 1.25 for marketing pages) from a 16 px body size, rounded to whole pixels, with line height about 1.5 for body and 1.2 for headings.
4. **Tier 2, semantic tokens**: names for jobs, pointing at primitives: `color.text.default`, `color.text.muted`, `color.surface.default`, `color.action.primary`, `color.border.subtle`, `color.feedback.error`. Components use only this tier.
5. **Tier 3, component tokens** only where a component needs an override (`button.primary.background`). Do not create one per component by default; each adds maintenance.
6. **Check contrast for every pair that will meet**: normal text needs at least 4.5 to 1, large text (24 px, or 19 px bold) and interface boundaries and icons at least 3 to 1. Record the ratio. A brand colour that fails as text on white is allowed as a fill with a dark label, or a darker step is used for text.
7. **Define the dark theme** by remapping semantic tokens to different primitives (surface to a near-black step, text to a light step), not by inverting colours; re-check every pair.
8. **Write `design-tokens.json`** in the community token format (`$value`, `$type`, aliases in braces). Never put raw hex in component tokens; every reference is an alias.
9. **Hand off.** The file, the contrast table and the usage notes to Deniz, who turns them into the theme extension; ask Emre to run the contrast check in the built page; copy for any token documentation to Kaan only if asked. Raise any value that cannot be a token (a one-off) as an open question rather than inventing one.

## Code & Config Exemplars
### Worked example
Brand: primary blue `#1D4ED8`, warm accent `#F59E0B`, body font Inter. Computed contrast ratios (WCAG relative luminance):

| Pair | Ratio | Verdict |
|---|---|---|
| `#111827` text on white | 17.74 | pass |
| `#6B7280` muted text on white | 4.83 | pass for normal text |
| `#6B7280` muted text on `#F3F4F6` | 4.39 | **fails** for normal text: darken muted on grey surfaces |
| `#1D4ED8` on white | 6.70 | pass (links, primary button text white on blue also 6.70) |
| `#F59E0B` on white | 2.15 | **fails** as text; use as fill with `#111827` label (8.26) |
| `#B45309` on white | 5.02 | the accessible amber for text |

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

### Anti-patterns
- Changing the client's brand colour to make a ratio pass.
- Semantic tokens named for the value (`blue-button`), not the job.
- Components referencing primitives directly.
- A dark theme made by inverting every colour.
- A type scale chosen by eye, with sizes that match no ratio.
- Tokens delivered without the contrast table.

## Edge Cases & Error Recovery
- **No brand colours supplied**: ask; if told to propose, label the palette provisional and keep it neutral.
- **Brand pair fails and cannot change**: document the exception (large text only, or fill with a label) and tell Deniz where it must not be used as text.
- **Gradients and images behind text**: contrast cannot be a single ratio; require a scrim and check the worst region, then hand to Emre.
- **Existing tokens conflict with the new set**: produce a mapping table old to new; do not delete the old names until Deniz confirms migration.
- **A required token has no value** (an unspecified brand font weight): mark it open; do not guess a licensed font.

## Verification Checklist
- [ ] Three tiers exist; components reference semantic tokens only; no raw hex in component tokens.
- [ ] Scales follow stated rules (4 px spacing base, a named type ratio).
- [ ] Every text and boundary pair has a computed ratio recorded, and the failures have a stated remedy.
- [ ] A dark theme is defined by remapping, and its pairs are re-checked, or its absence is stated.
- [ ] `design-tokens.json` parses and every alias resolves.
- [ ] Hand-offs name Deniz and Emre with what each must do.
