---
name: marketing-creative-design
description: "Produce a marketing visual asset kit that stays on brand across channels: visual hierarchy, aspect-ratio adaptation from one master, SVG-first assets, an export table with size budgets, contrast and alt text, and a clean hand-over to engineering and the campaign owners."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🖼️
disable-slash-command: true
---

# Marketing Creative Design

## Overview & Purpose
This skill is about the asset system behind a campaign: one master design adapted into the formats the channels need, exported at sizes that load fast, and handed over so nobody rebuilds it. It sits next to `ad-creative-design`. The boundary: **`ad-creative-design` is the paid-ad brief** (one message, the placements, the variant matrix, naming for results); **this skill is the asset kit** (master, adaptations, exports, accessibility, hand-over) that serves ads, social posts, email headers and the landing page alike.

Jamileh designs and produces the SVG or HTML and CSS; this skill does not write copy (Kaan and Jale do) or implement the page (Deniz does).

## Execution Triggers
Load it when a campaign needs a visual set (hero, social cards, email header, banners), when assets must be adapted from one master, or when exported files are too heavy or inconsistent. Do not use it for a logo or identity (use `brand-identity`), for a design system (use `design-system-tokens`) or for a paid creative test (use `ad-creative-design`).

## Input/Output Requirements
Inputs: the campaign message and call to action from the copy owner, brand tokens and fonts, the channel list with formats, photography or illustration assets and their licences, accessibility requirements, and the delivery format engineering expects.

Outputs: the master design; the adaptations (one fenced SVG block per aspect ratio, or the files in the design tool); the export table; alt text for every non-decorative image; the asset list with sources and licences; the hand-over note. **Evidence to attach**: the tokens used, the measured file sizes, and the source and licence of each image.

## Step-by-Step Runbook
1. **Design one master first**, at the largest format you need, with the hierarchy fixed: hook, value statement, proof, call to action. Check that the idea works in one second at thumbnail size before adapting.
2. **Adapt, do not resize.** For each ratio (1:1, 4:5, 9:16, 16:9, and 1.91:1 where used) recompose: move the hook and the call to action inside the safe zone, change line breaks, crop imagery deliberately. A scaled master is a failed adaptation.
3. **Prefer SVG for anything geometric** (logos, icons, shapes, charts) and a modern raster (WebP or AVIF) for photographs, with a PNG or JPEG fallback only where a channel requires it. Outline or embed fonts so the file renders the same everywhere.
4. **Use tokens, never loose values**: colours and type from `design-tokens.json`. A colour that is not a token is raised to the design-system owner.
5. **Set size budgets** in the export table, and measure the exports, do not estimate: a hero image about 200 KB or less, social cards about 300 KB or less, email images about 100 KB each, icons and logos as SVG under 10 KB. If a file is over budget, compress or recompose before accepting it.
6. **Check accessibility**: text contrast of at least 4.5 to 1 (3 to 1 for large text), a scrim behind text over images, no information in colour alone, alt text for each informative image written in the customer's terms (what it shows and why it is there) and `alt=""` for decoration.
7. **Record rights**: where every photo, font and illustration came from, its licence, and any attribution or usage limit. An unlicensed image is removed, not "replaced later".
8. **Hand over.** Export table and files to Deniz for the page, banner sizes to the campaign owner (Jale), ad uses to `ad-creative-design`'s brief, copy fit questions to Kaan; claims in the visuals (numbers on a chart) to Defne.

## Code & Config Exemplars
### Worked example
Campaign: a webhook-retry feature. Master: 1080 x 1350 (4:5): hook "94% of failed webhooks recover" as large text, one chart, call to action button.

| Output | Size | Format | Budget | Measured |
|---|---|---|---|---|
| Landing hero | 1600 x 900 | AVIF (+ WebP fallback) | 200 KB | 142 KB AVIF, 188 KB WebP |
| Social card 1:1 | 1080 x 1080 | WebP | 300 KB | 171 KB |
| Story 9:16 | 1080 x 1920 | PNG for the channel | 400 KB | 512 KB, over budget: flatten the gradient to a solid, re-export |
| Email header | 1200 x 400 | JPEG | 100 KB | 64 KB |
| Chart | scalable | SVG | 10 KB | 6 KB |

Alt text: chart: "Line chart: failed webhook deliveries recovered by retries, 94 percent of 10,000 test events" (the figure comes from the brief's staging test, flagged for Defne). Decorative gradient: `alt=""`. Rights: the illustration is original; the font is the licensed brand font from the tokens.

```svg
<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t">
  <title id="t">94 percent of failed webhooks recover on their own</title>
  <rect width="1080" height="1350" fill="#0B1220"/>
  <text x="80" y="240" font-size="96" font-weight="700" fill="#FFFFFF">94% of failed</text>
  <text x="80" y="350" font-size="96" font-weight="700" fill="#FFFFFF">webhooks recover</text>
</svg>
```

### Anti-patterns
- Scaling one master into every ratio.
- Exporting at design-tool defaults and shipping 1 MB images.
- Fonts left as live text in an SVG that will render with a fallback.
- Text over a busy photo with no scrim.
- A stock photo with no recorded licence.
- Alt text that reads "image of chart".

## Edge Cases & Error Recovery
- **Brand tokens missing or contradictory**: ask the design-system owner; use a provisional palette only if the lead says to proceed, and label it.
- **A channel changes its format**: re-check the specification, keep the master, re-adapt.
- **Over budget after compression**: reduce dimensions, simplify the image, or split it; do not lower quality until text artefacts appear.
- **Fonts cannot be embedded for licence reasons**: convert text to outlines in the exported asset and keep the live text only in the source file.
- **A number in the visual cannot be sourced**: remove it from the visual.

## Verification Checklist
- [ ] One master exists and each adaptation was recomposed, not scaled.
- [ ] Every colour and text style comes from a token; geometric assets are SVG.
- [ ] The export table lists size, format, budget and the measured size for each file; none is over budget.
- [ ] Contrast, scrims and alt text are checked; decorative images have empty alt text.
- [ ] Every image, font and illustration has a recorded source and licence.
- [ ] Hand-offs name Deniz, Jale, Kaan and Defne; the boundary with `ad-creative-design` is respected.
