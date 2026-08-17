---
name: marketing-creative-design
description: Production-grade Marketing Creative Design playbook for multi-channel ad creative layouts, visual hierarchy, aspect ratio adaptation, brand asset generation, and export optimization.
metadata:
  author: "agents-united"
  version: "2.0.0"
---

# Marketing Creative Design & Multi-Channel Visual Asset Generation

## Overview & Purpose
The Marketing Creative Design skill provides a deterministic framework for generating high-converting visual advertising creatives, banner layouts, social media visual assets, typography scales, color palettes, and responsive multi-aspect ratio asset packages (1:1 square, 9:16 vertical stories/reels, 16:9 widescreen landscape, 4:5 mobile feed portrait).

Following this skill ensures strict brand guideline adherence, visual hierarchy compliance, WCAG contrast accessibility, and automated multi-channel export optimization (WebP, AVIF, SVG, PNG).

## Execution Triggers & Prerequisites
### Execution Triggers
- Request to design multi-channel ad creative suites (Meta, Google Display, LinkedIn, Twitter/X, TikTok).
- Generating responsive banner ad variants and hero visual graphics.
- Creating standardized brand asset kits and typography/color design tokens for marketing campaigns.
- Exporting, compressing, and formatting creative visual assets for production ad deployment.

### Prerequisites
- Brand identity guidelines (color tokens, font families, logo vector files).
- Campaign messaging, headline copy, value proposition hooks, and primary call-to-action (CTA).
- Asset processing tooling operational (Sharp, Squoosh, Canvas/SVG generators, Figma tokens).
- Clean git working directory.

## Input & Output Requirements
### Inputs
| Parameter | Type | Required | Description |
|---|---|---|---|
| `campaign_name` | String | Yes | Unique campaign or experiment identifier |
| `target_aspect_ratios` | Array<String> | Yes | Target ratios: `['1:1', '9:16', '16:9', '4:5']` |
| `headline_hook` | String | Yes | Primary hook headline text for creative display |
| `cta_text` | String | Yes | Button label (e.g. "Start Free Trial", "Book Demo") |
| `brand_tokens` | Object | Optional | Color hex codes, typography scale, logo paths |
| `output_format` | String | Optional | Desired export format (`webp`, `avif`, `png`, `svg`) |

### Outputs
| Artifact | Path / Format | Description |
|---|---|---|
| Creative Brief Spec | `docs/marketing-creative-design/creative-brief.md` | Full design specification and layout rules |
| Generated Assets | `assets/creatives/<campaign>/*` | Multi-aspect ratio image and vector assets |
| Asset Manifest | `reports/marketing-creative-design/manifest.json` | Dimension, aspect ratio, and file size index |
| Visual Audit Report | `reports/marketing-creative-design/audit.json` | Contrast ratio, safe-zone, and file size checks |

## Step-by-Step Execution Runbook

### Phase 1: Creative Brief Analysis & Visual Architecture
1. Ingest campaign goals, target buyer persona, and core value proposition.
2. Select visual layout archetype (Hero Product Showcase, Split Comparison, Social Proof Badge, Bold Typography Hook).
3. Establish color palette hierarchy: 60% dominant canvas, 30% structural contrast, 10% high-contrast accent for CTA.
4. Verify typography hierarchy (Headline > Subheadline > Benefit Bullets > CTA Button > Microcopy/Legal).
5. Inspect repository asset directories to locate existing brand vectors and font files.
   ```bash
   find assets/ -type f -name "*.svg" -o -name "*.png"
   ```

### Phase 2: Design Token & Aspect Ratio Grid Layout Setup
1. Define aspect ratio canvas dimensions:
   - 1:1 Feed Square: 1080 x 1080 px
   - 9:16 Vertical Stories / Reels / TikTok: 1080 x 1920 px (Safe zone: top 250px, bottom 350px clear)
   - 16:9 Widescreen Display / YouTube: 1920 x 1080 px (or 1200 x 628 px for Google Display)
   - 4:5 Mobile Feed Portrait: 1080 x 1350 px
2. Configure layout grid margins (minimum 64px padding on mobile, 96px on desktop displays).
3. Set up responsive text scaling curves to ensure headline readability across mobile viewports.
4. Establish focal point safe zones to prevent platform UI overlay clipping (profile icons, audio badges, CTA bars).

### Phase 3: Visual Asset Composition & Multi-Variant Generation
1. Compose base vector or canvas layout applying design system tokens.
2. Render headline typography with strict line-height and kerning adjustments.
3. Position primary brand mark/logo in top-left or top-center anchor with minimum clear space.
4. Insert hero imagery or product mockups with calibrated drop shadows and elevation depth.
5. Render high-contrast CTA pill button with accessible foreground/background color combinations.
6. Generate multi-variant creative matrices testing 3 headline angles against 2 background styles (6 variants total).

### Phase 4: Contrast Auditing, File Optimization & Export Encoding
1. Execute automated WCAG AA/AAA contrast check between text elements and background layers (minimum 4.5:1 ratio).
2. Run image compression pipeline targeting optimal delivery sizes:
   - Display Ads: < 150 KB
   - Social Feed Creatives: < 1.5 MB (lossless WebP/PNG)
3. Convert master vector graphics into optimized WebP and high-density 2x PNG assets.
   ```bash
   node scripts/optimize-creatives.js --input assets/creatives/raw --output assets/creatives/dist
   ```
4. Verify image dimensions, color profiles (sRGB), and metadata strip compliance.

### Phase 5: Manifest Compilation & Asset Review Handoff
1. Compile generated creative manifest indexing filenames, dimensions, aspect ratios, file sizes, and checksums.
2. Generate visual review sheet at `docs/marketing-creative-design/creative-brief.md`.
3. Verify zero broken image references or missing aspect ratio variants.
4. Commit validated creative assets to git repository.
   ```bash
   git add assets/creatives/ docs/marketing-creative-design/
   git commit -m "feat(marketing-creative-design): generate multi-channel creative asset suite"
   ```
5. Hand off creative assets to paid acquisition and campaign execution teams.

## Code & Configuration Exemplars

### Exemplar 1: Multi-Aspect Ratio Creative Layout Specification
```yaml
version: "2.0.0"
campaign: "q3-enterprise-saas-launch"
brand:
  colors:
    primary: "#0F172A"
    accent: "#3B82F6"
    cta: "#10B981"
    background: "#F8FAFC"
  typography:
    headlineFont: "Inter, sans-serif"
    weight: 800
variants:
  - ratio: "1:1"
    width: 1080
    height: 1080
    safeZone: { top: 64, bottom: 64, left: 64, right: 64 }
    layout: "center-stacked"
  - ratio: "9:16"
    width: 1080
    height: 1920
    safeZone: { top: 250, bottom: 350, left: 80, right: 80 }
    layout: "vertical-flow"
  - ratio: "16:9"
    width: 1920
    height: 1080
    safeZone: { top: 80, bottom: 80, left: 120, right: 120 }
    layout: "split-horizontal"
```

### Exemplar 2: TypeScript Programmatic Creative Asset Generator
```typescript
export interface CreativeAssetSpec {
  campaign: string;
  variantId: string;
  aspectRatio: '1:1' | '9:16' | '16:9' | '4:5';
  width: number;
  height: number;
  headline: string;
  ctaText: string;
}

export function compileCreativeManifest(specs: CreativeAssetSpec[]): Record<string, any> {
  return {
    generatedAt: new Date().toISOString(),
    totalVariants: specs.length,
    assets: specs.map(spec => ({
      id: `${spec.campaign}-${spec.variantId}-${spec.aspectRatio.replace(':', 'x')}`,
      dimensions: `${spec.width}x${spec.height}`,
      ratio: spec.aspectRatio,
      exportPath: `assets/creatives/${spec.campaign}/${spec.variantId}-${spec.aspectRatio.replace(':', 'x')}.webp`,
    })),
  };
}
```

## Edge Cases & Error Recovery Procedures

### Scenario A: Text Safe-Zone Violation on Vertical 9:16 Assets
1. **Diagnosis**: Headline copy or CTA button overlaps with platform UI overlays (TikTok sound icon, Instagram profile footer).
2. **Recovery Protocol**:
   - Step 1: Detect bounding box coordinates of text and CTA layers against safe-zone boundaries (top 250px, bottom 350px).
   - Step 2: Recalculate vertical flow offset and clamp text positioning inside the 1320px central vertical window.
   - Step 3: Re-render vertical 9:16 asset variant and re-verify bounding box clearance.

### Scenario B: Creative File Size Exceeds Ad Network Limit
1. **Diagnosis**: Exported display creative exceeds network constraint (e.g. Google Display Ad limit of 150 KB).
2. **Recovery Protocol**:
   - Step 1: Analyze image compression parameters and color depth.
   - Step 2: Apply adaptive lossy WebP compression with quality step degradation (85 -> 80 -> 75).
   - Step 3: Strip extraneous EXIF metadata and re-encode to confirm file size <= 150 KB.

## Verification & Validation Checklist
- [ ] Frontmatter conforms strictly to `author: "agents-united"` and `version: "2.0.0"`.
- [ ] All 7 mandatory sections present with explicit headers.
- [ ] Step-by-Step Execution Runbook body contains >= 50 lines.
- [ ] Multi-aspect ratios (1:1, 9:16, 16:9, 4:5) defined with exact pixel grids and safe zones.
- [ ] Code exemplars provided with valid syntax fencing.
- [ ] Zero dummy placeholder strings or unpopulated template markers present.
- [ ] Project build, test suite, and doctor check pass 100% cleanly.
