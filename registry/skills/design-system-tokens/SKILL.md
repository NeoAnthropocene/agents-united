---
name: design-system-tokens
description: "Use when writing or extending design-tokens.json, when a campaign palette must also work in a product, or when engineering reports hardcoded values; trigger phrases: define our design tokens, build a token set, set up dark mode tokens, developers are hardcoding colours. Produces design-tokens.json in three tiers, a contrast table for every text and background pair, the scale rules used, a usage note per semantic token and a migration list. Skip it for a one-off banner (use ad-creative-design) and when the client already has a token set (audit it, do not replace it)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🎨
disable-slash-command: true
---

# Design System Tokens

A token is a named decision: this is our primary action colour, this is the gap between a label and its field. A good set lets a developer build every screen without choosing a colour or a pixel value, and lets a brand change in one place.

## Overview & Purpose
For the creative designer: the structure, the rules that generate the scales, the checks that keep it accessible and the file engineering expects. It builds no components or Tailwind theme (Deniz) and chooses no brand (the brief and `brand-identity`).

## Execution Triggers
Load it when you write or extend `design-tokens.json`, when a campaign needs a palette that must also work in a product, or when engineering reports hardcoded values. Do not use it for a one-off banner (`ad-creative-design`) or when the client already has a token set (audit it, do not replace it).

## Input/Output Requirements
Inputs: brand colours and fonts as given (hex, font files or families); the surfaces (marketing site, product, email); whether a dark theme is required; target platforms; any existing tokens or Tailwind config.

Output: `design-tokens.json` in three tiers; a contrast table for every text and background pair; the scale rules used; a usage note per semantic token; a migration list if hardcoded values exist. **Evidence to attach**: the computed contrast ratio of each pair, and which brand values were given versus derived.

## Step-by-Step Runbook
1. **Take the brand inputs as given and flag what you derive.** Never alter the brand colour to pass a contrast test: derive a darker or lighter step beside it and say which carries text.
2. **Tier 1, primitives**: raw values with no meaning (ramps of 9 to 11 steps per hue, 50 to 950; type, spacing, radius, shadow, duration).
3. **Generate the scales by rule, not by eye**: spacing on a 4 px base; type on a fixed ratio (1.2 for dense product UI, 1.25 for marketing pages) from a 16 px body, whole pixels. Line heights and computed values: [references/scales.md](references/scales.md).
4. **Tier 2, semantic tokens**: names for jobs that point at primitives (`color.text.default`, `color.action.primary`, `color.feedback.error`). Components use only this tier; a name for the value (`blue-button`) breaks at the first rebrand.
5. **Tier 3, component tokens** only where a component needs an override (`button.primary.background`); each one adds maintenance, so none by default.
6. **Check contrast for every pair that will meet**: normal text 4.5 to 1; large text (24 px, or 19 px bold), interface boundaries and icons 3 to 1. Record the ratio (neutrals in [references/contrast-table.md](references/contrast-table.md); Emre measures any other pair). A brand colour that fails as text on white is a fill with a dark label, or a darker step carries the text.
7. **Define the dark theme by remapping** semantic tokens to other primitives (surface to a near-black step, text to a light step), not by inverting colours; re-check every pair.
8. **Write `design-tokens.json`** in the community token format (`$value`, `$type`, aliases in braces); every reference is an alias, never raw hex in a component token.
9. **Hand off.** The file, contrast table and usage notes to Deniz for the theme extension; Emre runs the contrast check in the built page; token documentation copy to Kaan only if asked. A one-off value is an open question, never an invented token.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a brand with seven checked pairs and the matching `design-tokens.json`.

Anti-patterns, each with its reason:
- Changing the client's brand colour to make a ratio pass: it is not yours to change.
- Semantic tokens named for the value: the name lies after the first rebrand.
- Components referencing primitives: one palette change touches every component.
- A dark theme made by inverting colours: it breaks the pairs already checked.
- A type scale chosen by eye: no ratio, so it cannot be extended.
- Tokens without the contrast table: nobody can tell which pairs are safe.

## Edge Cases & Error Recovery
- **No brand colours supplied**: ask; if told to propose, label the palette provisional and keep it neutral.
- **A brand pair fails and cannot change**: document the exception (large text only, or a fill with a label); tell Deniz where it must not be text.
- **Gradients and images behind text**: contrast is not one ratio; require a scrim, check the worst region, hand to Emre.
- **Existing tokens conflict with the new set**: map old to new; keep the old names until Deniz confirms migration.
- **A required token has no value** (an unspecified font weight): mark it open; never guess a licensed font.

## Verification Checklist
- [ ] Three tiers exist; components reference semantic tokens only; no raw hex in component tokens.
- [ ] Scales follow stated rules (4 px spacing base, a named type ratio).
- [ ] Every text and boundary pair has a computed ratio, and failures have a stated remedy.
- [ ] The dark theme is a remapping with its pairs re-checked, or its absence is stated.
- [ ] `design-tokens.json` parses and every alias resolves.
- [ ] Hand-offs name Deniz and Emre with what each must do.
