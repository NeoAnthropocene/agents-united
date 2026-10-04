---
name: ad-creative-design
description: "Specify paid ad creative that can be produced and tested: a brief with one message, a size and safe-zone table to verify against each platform, a variant matrix of angle by format, naming for attribution, contrast checks and a claims review."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 🎯
disable-slash-command: true
---

# Ad Creative Design

## Overview & Purpose
Ad creative is judged in about a second, on a small screen, next to everything else in a feed. The design decisions that matter are few: one message, a clear visual hook, text that survives the crop, and a set of variants that differ on purpose so the result teaches something. This skill gives the creative designer the brief, the specifications and the naming that make that possible.

Jamileh designs in the design tools (`figma`, `stitch` when connected). This skill does not choose the media plan or the budget (the lead and Ava do) and does not decide what an ad may claim (Defne does).

## Execution Triggers
Load it when a brief asks for banner, social or display ad creative, a creative sprint, or a creative test. Do not use it for brand identity (use `brand-identity`), for banners where the upstream banner skill covers the formats you need (use `banner-design`), or for landing-page design.

## Input/Output Requirements
Inputs: the campaign goal and audience, the single message and call to action from the copy owner (Kaan or Jale), brand assets and tokens, the platforms and placements actually bought, any legal text required, and what was learned from earlier ads.

Outputs: the creative brief; the size and safe-zone table for the chosen placements; the variant matrix; the naming convention; the production notes (assets, fonts, contrast); and the handover for the claims review. **Evidence to attach**: the brand tokens used and where the platform specs were read, with the date.

## Step-by-Step Runbook
1. **Write the brief in five lines**: audience, one message (one claim), the call to action, the proof or hook, the tone. If the copy owner has not given the message, ask; do not invent copy.
2. **Pick placements from the media plan** and list each size. The sizes below are typical and **must be verified against each platform's current specification before export**, because platforms change them.
3. **Design for the crop.** Put key text and the product inside the safe zone, leave the top and bottom of vertical formats free of text (platform interface elements overlay them), and test the smallest size first.
4. **Build the variant matrix**: angle (what we say: outcome, proof, price, objection) crossed with format (static, carousel, short video). Change one thing between variants so a difference in result has one explanation; three to six variants per round is enough to learn from.
5. **Check contrast and legibility.** Text over an image needs a solid or gradient scrim; body text at least 4.5 to 1 contrast against its background and large text at least 3 to 1; nothing below about 24 px in a 1080-wide design.
6. **Name every asset** so results map back to the variant: `<campaign>_<angle>_<format>_<size>_v<n>`, for example `webhook-retries_proof_static_1080x1350_v2`. The same string goes into the ad name and `utm_content`.
7. **Hand off.** Final files and the matrix to the lead and the campaign specialist for the media setup; copy and claims to Defne (numbers, comparisons, "best", "free", health, finance, earnings claims) before launch; the landing page continuity to Kaan; build or export issues to Deniz.

## Code & Config Exemplars
### Worked example
Campaign: a webhook-retry feature, goal 400 connections, audience backend developers. Placements bought: a feed ad on a professional network and a vertical story format on another network.

Typical sizes to verify:

| Placement | Size | Safe zone and notes |
|---|---|---|
| Feed, square | 1080 x 1080 | keep text inside the central 80 percent |
| Feed, portrait | 1080 x 1350 | keep text clear of the bottom 10 percent for the caption overlay |
| Story or vertical video | 1080 x 1920 | no text in the top 250 px or bottom 250 px |
| Professional network single image | 1200 x 628 | main text left of centre, logo small |
| Display banners | 300 x 250, 728 x 90, 160 x 600 | one line of text, large call to action |

Variant matrix (message: "Failed webhooks now recover on their own"):

| | static | short video |
|---|---|---|
| outcome | A: "94% of failed events recovered" over a clean chart | C: 10 s screen recording of an event retrying |
| objection | B: "No code on your side" with a before and after | D: skipped this round |

Names: `webhook-retries_outcome_static_1080x1350_v1` (A), `webhook-retries_objection_static_1080x1350_v1` (B), `webhook-retries_outcome_video_1080x1920_v1` (C). Handover: Defne reviews "94% of failed events recovered" (its source is the staging test noted in the brief) before launch.

### Anti-patterns
- Three messages in one ad.
- Text across the area the platform covers with its interface.
- Variants that differ in five ways, so no result explains itself.
- A stock photo where the product itself would prove the point.
- Exporting with no naming scheme, then being unable to join results to assets.
- Using a platform size from memory without checking it.

## Edge Cases & Error Recovery
- **No brand tokens provided**: ask for them; do not guess a palette. If the lead says proceed, mark the palette as provisional in the brief.
- **A platform rejects the creative** (too much text, a prohibited claim): record the reason, fix the specific point and keep the original in the log; do not rework everything.
- **Text is illegible at the smallest size**: shorten the line, not the font.
- **The copy changes after design**: the variant is renamed (`v2`), the old one retired, and the claims review repeated.
- **A claim has no source**: remove it from the creative; do not ask the design to hide it in small print.

## Verification Checklist
- [ ] The brief has one message and one call to action from the copy owner.
- [ ] The sizes and safe zones table names its source and the date, and says to verify before export.
- [ ] The variant matrix changes one dimension at a time and every asset has a name in the convention.
- [ ] Contrast ratios and minimum text size are checked and the result is noted.
- [ ] Claims are handed to Defne and the source for each is in the evidence list.
- [ ] Hand-offs name the lead, the campaign specialist, Kaan, Defne and Deniz as needed.
