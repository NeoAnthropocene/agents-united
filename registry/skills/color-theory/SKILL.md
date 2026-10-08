---
name: color-theory
description: "Use when a palette, colour pair, gradient, photo overlay or colour role needs a decision or a check: a palette from a brand seed, tonal scales, harmony, text that passes contrast, call-to-action and semantic colours, dark-mode and print variants; trigger phrases: colour palette, colour scheme, colour theory, accessible colours, contrast ratio, tints and shades, complementary colours, CTA colour, dark mode colours. Produces a palette table with roles, computed ratios and the reason for each choice. Skip it when the tokens already fix every colour (use design-system-tokens), for chart palettes, logos and brand guidelines (use brand-identity) and photo retouching."
metadata:
  author: agents-united
  version: 1.0.0
  icon: 🎨
disable-slash-command: true
---

# Colour Theory

A colour decision is a promise about contrast, meaning and consistency. Decide from the brand's seed and the job (an ad seen for a second, an interface used for minutes), say why, and prove every text pair with a ratio you computed.

## Overview & Purpose
For the creative designer and the front-end architect: palettes (roles, tonal scales, harmony, accessible pairs) and their variants (dark mode, print, text over a photo). It does not choose the brand (`brand-identity`), write the tokens file (`design-system-tokens`) or run the accessibility gate (`accessibility-audit`, Emre).

## Execution Triggers
Load it when a brief needs a palette or a colour pair decided, a design may fail contrast, a gradient or overlay sits on a photo, or a palette must work in another mode. Skip it for chart colours, retouching, and when the tokens already fix every colour (apply them).

## Input/Output Requirements
Inputs: the brand seed (a hex, a logo, a photo or the tokens), the job and the surfaces, the modes (light, dark, print), the text sizes in use.

Output: a palette table (role, hex, where used), every text and icon pair with its ratio, the harmony and its reason, filled from [assets/palette-worksheet.md](assets/palette-worksheet.md). **Evidence to attach**: each ratio with its two hexes and how it was computed (script or by hand), and the pairs not checked.

## Step-by-Step Runbook
1. **Fix the seed and the job.** One brand colour, or the supplied tokens; with neither, ask the lead for a seed rather than guess. Never change the seed: build around it.
2. **Name the roles before the hues**: ground, text, muted text, brand, accent (the call to action), semantic (success, warning, error, information), overlay. An ad needs about six colours, an interface about ten; a colour with no role is decoration. [references/roles-and-harmony.md](references/roles-and-harmony.md).
3. **Pick the harmony by intent**: analogous to calm, complementary for one loud accent, split-complementary when the accent must not vibrate against the brand. Weight it 60 ground, 30 brand, 10 accent (same reference).
4. **Build the tonal scale by equal lightness steps in OKLCH**, not by mixing with white or black: [references/tonal-scales.md](references/tonal-scales.md), and fifteen starting scales in [references/hue-families.md](references/hue-families.md). With a shell: `node ${CLAUDE_SKILL_DIR}/scripts/palette.mjs <seed>` prints the scale, the nearest step and each step's contrast; add `--harmony split` for the accent hexes.
5. **Prove every pair that will meet**: text 4.5 to 1, large text (24 px, or 19 px bold), icons and interface boundaries 3 to 1; thresholds, formula and exemptions: [references/contrast.md](references/contrast.md). With a shell, `accessibility-audit` has the script; without one, compute by the formula, write "by hand" beside the figure and put the check to the lead.
6. **Check where colour breaks**: text on a photo (measure the worst patch, add a scrim), a gradient (both ends and the middle), dark mode (not an inversion), print, readers who cannot tell red from green: [references/modes-and-media.md](references/modes-and-media.md).
7. **Report.** The palette table, each ratio with its source, the reason for each choice, what was not checked, and the hand-offs: tokens to `design-system-tokens`, the contrast gate to Emre.

## Code & Config Exemplars
[examples/worked-example.md](examples/worked-example.md) builds and proves a palette for a pet-care brand from one seed.

Anti-patterns, each with its reason:
- Pure `#000` text on pure `#fff`: glare; use the darkest brand neutral on a tinted white.
- Two high-chroma complements side by side: the edge vibrates; put a neutral between.
- Muted grey text on a coloured ground: it loses contrast twice; compute it.
- Meaning by hue alone (red and green states): one man in twelve reads them alike; add an icon or a word.
- One accent for the call to action and for decoration: the button stops being the loudest thing.
- A scale made by mixing with white: uneven steps, a muddy middle.
- A figure without a source ("about 5 to 1"): the reader trusts it.

## Edge Cases & Error Recovery
- **The brand colour fails as text**: keep it for fills and marks, take a darker step for text and say which; do not alter the brand colour.
- **The tokens hold a pair that fails**: report the pair, its ratio and the nearest passing step; the fix is a token change, so hand off to `design-system-tokens`.
- **A colour sampled from a logo or a photo**: write it as sampled; do not round it to a nicer one.
- **No shell and a long palette**: compute only the pairs that will meet; list the rest as not checked.
- **Print**: screens show colours CMYK cannot; give CMYK only if the brand supplies it, and ask for a proof.

## Verification Checklist
- [ ] Seed and job stated; every colour has a role; the seed unchanged.
- [ ] Every text, icon and boundary pair has a ratio, its two hexes and its source.
- [ ] Gradients, overlays, dark mode and print checked, or listed as not checked.
- [ ] Meaning never rests on colour alone.
- [ ] The report says what was not checked and hands tokens to `design-system-tokens`.
