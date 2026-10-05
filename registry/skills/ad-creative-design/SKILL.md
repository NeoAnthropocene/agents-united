---
name: ad-creative-design
description: "Use when a brief asks for banner, social or display ad creative, a creative sprint or a creative test; trigger phrases: design the ads for this campaign, what sizes do I need, make ad variants to test, set up the creative test, how should we name the ad assets. Produces a creative brief, the size and safe-zone table for the placements bought (to verify against each platform), a variant matrix of angle by format, a naming convention, contrast checks and the handover for claims review. Skip it for brand identity (use brand-identity), banners the upstream banner-design skill covers (use banner-design) and landing-page design."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🎯
disable-slash-command: true
---

# Ad Creative Design

Ad creative is judged in about a second, on a small screen, next to everything else in a feed. The decisions that matter are few: one message, a clear visual hook, text that survives the crop, and variants that differ on purpose so the result teaches something.

## Overview & Purpose
For the creative designer, who designs in the design tools (`figma`, `stitch` when connected). It does not choose the media plan or budget (the lead and Ava) or what an ad may claim (Defne).

## Execution Triggers
Load it when a brief asks for banner, social or display ad creative, a creative sprint or a creative test. Do not use it for brand identity (`brand-identity`), for banners the upstream banner skill covers (`banner-design`), or for landing-page design.

## Input/Output Requirements
Inputs: the campaign goal and audience; the single message and call to action from the copy owner (Kaan or Jale); brand assets and tokens; the platforms and placements actually bought; any legal text required; what earlier ads taught.

Output: the creative brief; the size and safe-zone table for the chosen placements; the variant matrix; the naming convention; production notes (assets, fonts, contrast); the handover for the claims review. **Evidence to attach**: the brand tokens used, and where the platform specs were read, with the date.

## Step-by-Step Runbook
1. **Write the brief in five lines**: audience, one message (one claim), the call to action, the proof or hook, the tone. If the copy owner has not given the message, ask; never invent copy.
2. **Pick placements from the media plan** and list each size from [references/sizes-and-safe-zones.md](references/sizes-and-safe-zones.md). The sizes there are typical and **must be verified against each platform's current specification before export**, because platforms change them.
3. **Design for the crop.** Key text and the product go inside the safe zone; leave the top and bottom of vertical formats free of text (the platform's interface overlays them); test the smallest size first.
4. **Build the variant matrix**: angle (what we say: outcome, proof, price, objection) crossed with format (static, carousel, short video). Change one thing between variants so a difference in result has one explanation; three to six variants per round is enough to learn from.
5. **Check contrast and legibility.** Text over an image needs a solid or gradient scrim; body text at least 4.5 to 1 against its background, large text at least 3 to 1; nothing below about 24 px in a 1080-wide design.
6. **Name every asset** so results map back to the variant: `<campaign>_<angle>_<format>_<size>_v<n>`, for example `webhook-retries_proof_static_1080x1350_v2`. The same string goes into the ad name and `utm_content`.
7. **Hand off.** Final files and the matrix to the lead and the campaign specialist for the media setup; copy and claims (numbers, comparisons, "best", "free", health, finance, earnings) to Defne before launch; landing-page continuity to Kaan; build or export issues to Deniz.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a campaign with its variant matrix, asset names and claims handover.

Anti-patterns, each with its reason:
- Three messages in one ad: the viewer has one second.
- Text across the area the platform covers: the interface hides it.
- Variants that differ in five ways: no result explains itself.
- A stock photo where the product would prove the point: it proves nothing.
- Exporting with no naming scheme: results cannot be joined to assets.
- A platform size taken from memory: platforms change them.

## Edge Cases & Error Recovery
- **No brand tokens provided**: ask for them; do not guess a palette. If the lead says proceed, mark the palette provisional in the brief.
- **A platform rejects the creative** (too much text, a prohibited claim): record the reason, fix that point and keep the original in the log; do not rework everything.
- **Text is illegible at the smallest size**: shorten the line, not the font.
- **The copy changes after design**: rename the variant (`v2`), retire the old one and repeat the claims review.
- **A claim has no source**: remove it from the creative; never hide it in small print.

## Verification Checklist
- [ ] The brief has one message and one call to action from the copy owner.
- [ ] The sizes and safe zones table names its source and date, and says to verify before export.
- [ ] The variant matrix changes one dimension at a time and every asset has a name in the convention.
- [ ] Contrast ratios and minimum text size are checked and the result is noted.
- [ ] Claims are handed to Defne and the source for each is in the evidence list.
- [ ] Hand-offs name the lead, the campaign specialist, Kaan, Defne and Deniz as needed.
