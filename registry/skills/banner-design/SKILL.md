---
name: banner-design
description: Design banners for social covers, display ads, website heroes,
  events, and print. Multi-format platform size specs, safe-zone rules, and
  22 art-direction styles, with a 5-step gather-research-design-export-iterate
  workflow producing exported PNGs at exact target dimensions.
metadata:
  author: nextlevelbuilder (github.com/nextlevelbuilder)
  version: 1.0.0
  source: https://www.ui-skills.com/skills/nextlevelbuilder/banner-design
  license: MIT
  icon: 🖼️
disable-slash-command: true
---

# Banner Design — Multi-Format Creative Banner System

## Overview & Purpose
`banner-design` produces banners for social covers/headers, display ads, website heroes, event
signage, and print — as HTML/CSS compositions exported to PNG at the platform's exact pixel
dimensions. It covers the banner artifact only: no video editing, no full website design, and no
print production beyond generating a print-ready 300 DPI/CMYK/bleed export spec.

**Boundary vs. adjacent skills** (Plan 028 Step 0 overlap check):
- **`ad-creative-design`** and **`marketing-creative-design`** own the *campaign* layer — multi-asset
  ad suites, hook variation strategy, WCAG-contrast copy hierarchy, and export-format optimization
  (WebP/AVIF pipelines) across a full campaign. `banner-design` owns the *single-banner* layer: one
  composition, one platform's exact size and safe zone, one of 22 named art-direction styles. Use
  `ad-creative-design`/`marketing-creative-design` to plan a campaign's creative direction and asset
  matrix first, then use `banner-design` to produce each individual banner artifact inside it.
- It does not duplicate `frontend-component-design` (reusable UI components) or
  `design-system-tokens` (token pipelines) — it consumes brand colors/type as *given inputs*, never
  invents brand rules, and never writes token files.

## Execution Triggers & Prerequisites
### Execution Triggers
- "Design/create/generate a banner" for a social cover, header, display ad, website hero, event, or
  print piece.
- A request naming a platform (Facebook, X/Twitter, LinkedIn, YouTube, Instagram, Google Display) or
  a target pixel size alongside "banner", "cover", or "header".
- Generating multiple art-direction variants of the same banner for review.

### Prerequisites
- The banner's purpose, platform/size, and content (headline, subtext, CTA, logo placement).
- Any existing brand guidelines, logo files, colors, or typography to apply (this skill never
  invents brand rules — see `brand-identity` for that).
- A browser or screenshot capability to export the final HTML/CSS composition to PNG at the target
  viewport. Without one, deliver the HTML/CSS source and mark PNG export as pending rather than
  naming an uninstalled tool.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `purpose` | String | Yes | social cover, ad banner, website hero, print, or creative asset |
| `platform_or_size` | String | Yes | Named platform (e.g. `linkedin-header`) or explicit `WxH` px |
| `content` | Object | Yes | `{ headline, subtext?, cta?, logo_path? }` |
| `brand` | Object | Optional | Existing colors, typography, and logo — applied, never invented |
| `style` | String | Optional | One of the 22 art-direction styles (default: ask, or propose 2-3) |
| `quantity` | Number | Optional | Number of variant options to generate (default: 3) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Banner source | `assets/banners/{campaign}/{style}-{width}x{height}.html` | Editable HTML/CSS composition |
| Exported banner | `assets/banners/{campaign}/{style}-{width}x{height}.png` | Pixel-exact PNG export |
| Rationale note | Inline in the runbook's presentation step | Style choice + how it serves the purpose |

## Step-by-Step Execution Runbook

### Step 1 — Gather requirements
Collect, by asking directly (do not guess): purpose, platform/size, content (headline/subtext/CTA/
logo placement), existing brand assets, style preference (show the style table below if unsure), and
quantity of options (default 3).

### Step 2 — Research & art direction
1. Read `references/banner-sizes-and-styles.md` for the target format's exact size, safe-zone
   percentage, and styles that suit it.
2. If browser research is available and permitted, collect 3–5 outside references for composition
   inspiration; otherwise work from the bundled reference and any examples supplied.
3. Select 2–3 complementary art directions and state, in one line each, how the direction serves the
   banner's stated purpose.

### Step 3 — Design each option
For every selected art direction:
1. **Build in HTML/CSS** at the exact platform dimensions from the size reference. Apply safe-zone
   rules (critical content inside the central 70–80% of the canvas). Use at most 2 typefaces, one
   CTA, and text contrast of at least 4.5:1.
2. **Choose the visual source**: prefer user-supplied or appropriately licensed imagery; otherwise
   build the visual from CSS (gradients, geometric forms, type) for a dependency-free result. Only
   use an authorized image-generation capability if the runtime provides one, and keep any generated
   image prompt free of text/letters/words so on-page copy stays editable and accessible.
3. **Compose**: overlay headline, supporting copy, CTA, and logo in HTML/CSS; verify hierarchy, safe
   zones, contrast, and crop behavior at the exact target size before moving on.

### Step 4 — Export to image
1. Preview each banner in an available browser at the exact target viewport.
2. Capture the banner element as PNG with the runtime's standard browser/screenshot capability. If
   capture is unavailable, hand off the HTML/CSS source and say explicitly that PNG export is
   pending — never claim a tool ran that didn't.
3. Verify exported pixel dimensions, safe-zone crop, font loading, and image quality.
4. If a file exceeds a platform's size limit, use an available image optimizer or reduce quality/
   dimensions within spec — never silently violate the platform's own limit.

**Output path convention** — kebab-case, one folder per campaign:
```
assets/banners/{campaign}/
├── minimalist-1500x500.png
├── gradient-1500x500.png
├── bold-type-1500x500.png
└── minimalist-1080x1080.png    # if multi-size requested
```
Use a `{YYMMDD}-{style}-{size}.png` date prefix for time-sensitive campaigns.

### Step 5 — Present & iterate
Show every exported option side by side: style name, PNG (or HTML/CSS preview if capture was
unavailable), one-line design rationale, and file path/dimensions. Iterate on feedback until the
requester approves; do not treat the first pass as final.

## Code & Config Exemplars

### Banner size quick reference
| Platform | Type | Size (px) | Aspect ratio |
|---|---|---|---|
| Facebook | Cover | 820 × 312 | ~2.6:1 |
| X / Twitter | Header | 1500 × 500 | 3:1 |
| LinkedIn | Personal header | 1584 × 396 | 4:1 |
| YouTube | Channel art | 2560 × 1440 | 16:9 |
| Instagram | Story | 1080 × 1920 | 9:16 |
| Instagram | Post | 1080 × 1080 | 1:1 |
| Google Ads | Medium rectangle | 300 × 250 | 6:5 |
| Google Ads | Leaderboard | 728 × 90 | 8:1 |
| Website | Hero | 1920 × 600–1080 | ~3:1 |

Full reference (22 styles, print specs, safe zones): `references/banner-sizes-and-styles.md`.

### Minimal HTML/CSS scaffold (LinkedIn header example)
```html
<div class="banner" style="width:1584px;height:396px;position:relative;overflow:hidden;background:linear-gradient(135deg,#0F172A,#1E3A8A);">
  <div class="safe-zone" style="position:absolute;inset:10% 12%;display:flex;flex-direction:column;justify-content:center;">
    <h1 style="font:700 48px/1.1 Inter,sans-serif;color:#fff;margin:0 0 12px;">Headline goes here</h1>
    <p style="font:400 20px/1.4 Inter,sans-serif;color:#CBD5E1;margin:0 0 20px;">One-line supporting copy.</p>
    <a style="align-self:flex-start;padding:12px 24px;border-radius:8px;background:#22D3EE;color:#0F172A;font:700 16px/1 Inter,sans-serif;text-decoration:none;">Call to action</a>
  </div>
</div>
```

## Edge Cases & Error Recovery
- **No browser/screenshot capability available**: deliver the HTML/CSS source, state plainly that
  PNG export could not be produced, and name what the requester needs to run it themselves. Never
  invent a tool name to imply the export happened.
- **No brand assets supplied**: use CSS-built visuals (gradients, geometric shapes, type) and
  neutral color choices; do not invent a "brand" palette or claim it is the requester's brand.
- **Exported file exceeds a platform's size limit**: reduce dimensions/quality within the platform
  spec or use an available optimizer; report the final size against the limit.
- **Requested style doesn't suit the platform** (e.g. dense editorial grid on an 8:1 leaderboard):
  say so and propose the 2–3 styles from `references/banner-sizes-and-styles.md` that do fit the
  aspect ratio, rather than forcing a poor fit.
- **User-supplied image is unlicensed or of unclear rights**: ask before using it; do not silently
  substitute a generated image without saying so.

## Verification Checklist
- [ ] Exported PNG matches the platform's exact pixel dimensions (see size reference table).
- [ ] Critical content (headline, CTA, logo) sits inside the central 70–80% safe zone.
- [ ] Text contrast is at least 4.5:1; at most 2 typefaces used; exactly one CTA present.
- [ ] Text covers under 20% of the banner area (ad platforms penalize heavy text).
- [ ] Print exports specify 300 DPI, CMYK, and 3–5mm bleed.
- [ ] Only supplied/verified brand colors, type, and logo were applied — none invented.
- [ ] File saved under `assets/banners/{campaign}/{style}-{width}x{height}.png` in kebab-case.
- [ ] Every generated image prompt (if any) was kept free of text/letters so copy stays editable.
