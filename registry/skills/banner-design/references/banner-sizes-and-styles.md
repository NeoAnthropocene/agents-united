# Banner Sizes, Safe Zones & Art-Direction Styles

Adapted in-house from the size table and style catalog documented at
[ui-skills.com/skills/nextlevelbuilder/banner-design](https://www.ui-skills.com/skills/nextlevelbuilder/banner-design)
(MIT-licensed source: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`). Attribution retained per
the license; this file paraphrases and extends the reference rather than reproducing it verbatim.

## Platform size table

| Platform | Type | Size (px) | Aspect ratio | Safe zone |
|---|---|---|---|---|
| Facebook | Cover | 820 × 312 | ~2.6:1 | Central 70% (avoid profile-photo overlap, bottom-left) |
| X / Twitter | Header | 1500 × 500 | 3:1 | Central 75% |
| LinkedIn | Personal header | 1584 × 396 | 4:1 | Central 70% (avoid profile-photo overlap, bottom-left) |
| LinkedIn | Company cover | 1128 × 191 | ~5.9:1 | Central 80% |
| YouTube | Channel art | 2560 × 1440 | 16:9 | Central "TV-safe" 1546 × 423 (device-crop safe) |
| Instagram | Story | 1080 × 1920 | 9:16 | Central 80% (top/bottom ~250px reserved for UI chrome) |
| Instagram | Post | 1080 × 1080 | 1:1 | Central 80% |
| Google Display | Medium rectangle | 300 × 250 | 6:5 | Central 85% |
| Google Display | Leaderboard | 728 × 90 | 8:1 | Central 90% (very little vertical room) |
| Google Display | Large rectangle | 336 × 280 | 6:5 | Central 85% |
| Website | Hero (desktop) | 1920 × 600–1080 | ~2–3:1 | Central 75%, mind mobile crop to ~4:5 |
| Print | Event banner (small) | 3 × 6 ft @ 300 DPI | 1:2 | 3–5mm bleed, CMYK, vector logo |
| Print | Event banner (large) | 4 × 8 ft @ 150 DPI (viewing distance > 3m) | 1:2 | 5mm bleed, CMYK |

General rule: keep headline, CTA, and logo inside the "safe zone" percentage of the canvas — the
rest is margin that platform UI chrome, cropping, or device variance may obscure.

## Art-direction styles (22)

| Style | Best for | Key elements |
|---|---|---|
| Minimalist | SaaS, tech | White space, 1–2 colors, clean type |
| Bold typography | Announcements | Oversized type as the hero element |
| Gradient | Modern brands | Mesh gradients, chromatic blends |
| Photo-based | Lifestyle, e-commerce | Full-bleed photo + text overlay |
| Illustrated | Consumer, playful brands | Custom or licensed illustration style |
| Geometric | Tech, fintech | Shapes, grids, abstract patterns |
| Retro / vintage | Food & beverage, craft | Distressed textures, muted palette |
| Glassmorphism | SaaS, apps | Frosted glass, blur, glow borders |
| 3D / sculptural | Product, tech | Rendered objects, depth, soft shadows |
| Neon / cyberpunk | Gaming, events | Dark background, glowing neon accents |
| Duotone | Editorial, tech | Two-color image treatment |
| Editorial | Media, luxury | Grid layout, pull-quote typography |
| Collage | Culture, music, youth brands | Layered cutouts, mixed textures |
| Flat design | Product marketing | Solid colors, no gradients/shadows |
| Brutalist | Design-forward tech | Raw grid, monospace type, high contrast |
| Line art | Wellness, lifestyle | Thin single-weight illustration |
| Isometric | B2B SaaS, dev tools | Isometric icon/scene illustration |
| Halftone | Print, streetwear | Dot-pattern texture over color |
| Monochrome | Premium, luxury | Single hue, tonal variation only |
| Kinetic type | Social, motion-adjacent statics | Type treated as the dominant graphic |
| Paper / craft | Handmade, DTC brands | Texture, shadow, cut-paper look |
| Data-driven | B2B, analytics products | Chart/metric motif as the visual hook |

## Design rules
- **Safe zones**: critical content inside the central 70–90% of the canvas (see table above for
  platform-specific percentages).
- **CTA**: exactly one per banner, action-verb label, minimum 44px tap height on interactive
  placements.
- **Typography**: at most 2 fonts; minimum 16px body size; headline at least 32px.
- **Text ratio**: keep text under ~20% of the banner area for ad placements — heavier text ratios
  get penalized by ad-delivery algorithms on Meta and similar platforms.
- **Print**: 300 DPI (150 DPI acceptable only for large-format viewed from >3m), CMYK color mode,
  3–5mm bleed on every edge.
- **Brand**: apply only supplied, verified brand colors/type/logo — never invent brand rules.
