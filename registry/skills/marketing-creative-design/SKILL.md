---
name: marketing-creative-design
description: "Use when a campaign needs a visual set (hero, social cards, email header, banners), assets must be adapted from one master, or exported files are too heavy or inconsistent; trigger phrases: make the campaign visuals, adapt this to all the aspect ratios, build the asset kit, why are our images so heavy, export the social cards. Produces the master, one adaptation per ratio, an export table with size budgets and measured sizes, alt text, the asset list with sources and licences, and the hand-over note. Skip it for a logo or identity (use brand-identity), a design system (use design-system-tokens) and a paid creative test (use ad-creative-design)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🖼️
disable-slash-command: true
---

# Marketing Creative Design

The asset system behind a campaign: one master adapted into the formats the channels need, exported at sizes that load fast, handed over so nobody rebuilds it. Boundary with `ad-creative-design`: **that is the paid-ad brief** (one message, placements, variant matrix, naming for results); **this is the asset kit** (master, adaptations, exports, accessibility, hand-over) that serves ads, social posts, email headers and the landing page alike.

## Overview & Purpose
For Jamileh, who designs and produces the SVG or HTML and CSS. It writes no copy (Kaan and Jale) and implements no page (Deniz).

## Execution Triggers
Load it when a campaign needs a visual set (hero, social cards, email header, banners), when assets must be adapted from one master, or when exported files are too heavy or inconsistent. Do not use it for a logo or identity (`brand-identity`), a design system (`design-system-tokens`) or a paid creative test (`ad-creative-design`).

## Input/Output Requirements
Inputs: the campaign message and call to action from the copy owner; brand tokens and fonts; the channel list with formats; photography or illustration assets and their licences; accessibility requirements; the delivery format engineering expects.

Output: the master design; the adaptations (one fenced SVG block per aspect ratio, or the files in the design tool); the export table; alt text for every non-decorative image; the asset list with sources and licences; the hand-over note. **Evidence to attach**: the tokens used, the measured file sizes, and the source and licence of each image.

## Step-by-Step Runbook
1. **Design one master first**, at the largest format needed, with the hierarchy fixed: hook, value statement, proof, call to action. Check that the idea works in one second at thumbnail size before adapting.
2. **Adapt, do not resize.** For each ratio (1:1, 4:5, 9:16, 16:9, and 1.91:1 where used) recompose: hook and call to action inside the safe zone, new line breaks, deliberate crops. A scaled master is a failed adaptation.
3. **Prefer SVG for anything geometric** (logos, icons, shapes, charts) and a modern raster (WebP or AVIF) for photographs, with a PNG or JPEG fallback only where a channel requires it. Outline or embed fonts so the file renders the same everywhere.
4. **Use tokens, never loose values**: colours and type from `design-tokens.json`; a colour that is not a token goes to the design-system owner.
5. **Set size budgets in the export table and measure the exports, never estimate** ([references/export-budgets.md](references/export-budgets.md)). Over budget: compress or recompose before accepting the file.
6. **Check accessibility**: text contrast at least 4.5 to 1 (3 to 1 for large text), a scrim behind text over images, nothing conveyed by colour alone, alt text for informative images in the customer's terms (what it shows and why), `alt=""` for decoration.
7. **Record rights**: the source, licence and any attribution or usage limit of every photo, font and illustration. An unlicensed image is removed, not "replaced later".
8. **Hand over.** The export table and files to Deniz for the page; banner sizes to the campaign owner (Jale); ad uses to `ad-creative-design`'s brief; copy-fit questions to Kaan; claims in the visuals (numbers on a chart) to Defne.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a master adapted into five outputs, with the export table (budget against measured size), alt text, the rights note and an SVG adaptation.

Anti-patterns, each with its reason:
- Scaling one master into every ratio: the hook lands outside the safe zone.
- Exporting at tool defaults, 1 MB images: the page loads slowly.
- Live text in an SVG: it renders with a fallback font on the reader's device.
- Text over a busy photo with no scrim: it cannot be read.
- A stock photo with no recorded licence: it may be pulled after launch.
- Alt text that reads "image of chart": it tells the reader nothing.

## Edge Cases & Error Recovery
- **Brand tokens missing or contradictory**: ask the design-system owner; use a provisional palette only if the lead says to proceed, and label it.
- **A channel changes its format**: re-check the specification, keep the master, re-adapt.
- **Over budget after compression**: reduce dimensions, simplify or split the image; lower quality only until text artefacts appear.
- **Fonts cannot be embedded (licence)**: outline the text in the exported asset; keep live text only in the source file.
- **A number in the visual cannot be sourced**: remove it from the visual.

## Verification Checklist
- [ ] One master exists and each adaptation was recomposed, not scaled.
- [ ] Every colour and text style comes from a token; geometric assets are SVG.
- [ ] The export table lists size, format, budget and measured size per file; none is over budget.
- [ ] Contrast, scrims and alt text are checked; decorative images have empty alt text.
- [ ] Every image, font and illustration has a recorded source and licence.
- [ ] Hand-offs name Deniz, Jale, Kaan and Defne; the boundary with `ad-creative-design` is respected.
