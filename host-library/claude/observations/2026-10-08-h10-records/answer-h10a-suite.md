I wrote nine SVGs to `docs/pilot/creative/`: three placements, each with the three hooks. Nothing has been rendered, because I have no shell or renderer here. I re-read the three trust-hook files and grepped the headline lines in all nine; the full text of the other six files was not re-read. The contrast ratios and text widths below are hand-computed estimates.

## Brief
- **Audience:** dog owners booking a sitter.
- **Message:** the headline and subhead come from `hero.ts`. I wrote no copy.
- **Call to action:** "Book now", filled `color.cta.primary` with a `color.text.on-action` label.
- **Hook:** vector paw print on a sand panel with a dot texture. No photography was supplied, so the paw and a plain-text "PetPal" wordmark are placeholders.
- **Tone:** warm and plain, all colours from the tokens. No purple, and no pill badge above the headline.

## Size and safe-zone table
Sizes are the typical ones from the skill reference `sizes-and-safe-zones.md`. I did not check them against any platform's current spec. Verify before export.

| Placement | Canvas | Text safe zone | Notes |
|---|---|---|---|
| 4:5 feed | 1080×1350 | x 108–972, y 135–1215 | Bottom 10% (y > 1215) kept clear for the caption overlay. CTA ends at y 1181. |
| 9:16 story | 1080×1920 | x 108–972, y 250–1670 | Top and bottom 250 px have no text. CTA ends at y 1594. |
| 1.91:1 link | 1200×628 | x 120–1080, y 70–558 | Text on the left, art in a right-hand panel. CTA ends at y 550. |

## Contrast pairs
| Pair (foreground on background) | Ratio | Needed | Result |
|---|---|---|---|
| cocoa-900 on cream-50 (headline, wordmark) | 15.5 | 4.5 | pass |
| cocoa-900 on sand-300 (wordmark on the panel, 4:5 and story) | 11.9 | 4.5 | pass |
| cocoa-600 on cream-50 (subhead, `text.muted`) | 7.4 | 4.5 | pass |
| white on clay-600 (CTA label) | 5.5 | 4.5 | pass |
| clay-600 button on cream-50 | 5.2 | 3 | pass |
| clay-600 paw on sand-300 (graphic only) | 4.0 | 3 | pass |

I avoided these pairs:
- clay text on sand: 4.0, which fails 4.5.
- cocoa-600 on clay: 1.4.
- cocoa-900 on clay: 3.0.

The dot texture is not under any body text, and it only slightly lowers the 11.9 on the wordmark. The smallest type is the 28 px wordmark, above the 24 px floor.

## Hook variants
Only the headline changes between hooks. Subhead, layout and CTA are held constant, so a difference in results has one explanation. The files are `petpal-pilot_<angle>_static_<size>_v1.svg`.

| Angle | Headline |
|---|---|
| trust | Sitters you can trust |
| comfort | Your dog, happy at home |
| proof | 12,000 stays, 4.9 stars |

## SVG per placement (trust hook)
The comfort and proof files are identical apart from the headline lines and the `<title>`/`<desc>`.

```svg
<svg viewBox="0 0 1080 1350" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <!-- 4:5 Feed Ad, petpal-pilot_trust_static_1080x1350_v1.svg -->
  <title id="t">PetPal 4:5 feed ad, trust hook</title>
  <desc id="d">Clay paw print on a sand panel above the headline "Sitters you can trust", the line "Background-checked, reviewed by neighbours, insured up to $1M." and a clay Book now button. Scratch exercise: PetPal and every figure are fictional.</desc>
  <defs>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="3" fill="#6B4B35" opacity=".14"/></pattern>
    <g id="paw" fill="#B5451B"><ellipse cx="0" cy="40" rx="78" ry="64"/><ellipse cx="-88" cy="-48" rx="28" ry="38" transform="rotate(-22 -88 -48)"/><ellipse cx="-32" cy="-92" rx="30" ry="40" transform="rotate(-8 -32 -92)"/><ellipse cx="32" cy="-92" rx="30" ry="40" transform="rotate(8 32 -92)"/><ellipse cx="88" cy="-48" rx="28" ry="38" transform="rotate(22 88 -48)"/></g>
  </defs>
  <rect width="1080" height="1350" fill="#FFF8F0"/>
  <rect width="1080" height="640" fill="#F3D9B1"/>
  <rect width="1080" height="640" fill="url(#dots)"/>
  <circle cx="540" cy="370" r="240" fill="#FFF8F0" opacity=".7"/>
  <use href="#paw" transform="translate(540 370) scale(2)" aria-hidden="true"/>
  <g font-family="Helvetica, Arial, sans-serif">
    <text x="108" y="190" font-size="28" font-weight="700" fill="#2B1D14">PetPal</text>
    <g font-size="96" font-weight="700" fill="#2B1D14"><text x="108" y="800">Sitters you</text><text x="108" y="910">can trust</text></g>
    <g font-size="36" fill="#6B4B35"><text x="108" y="990">Background-checked, reviewed by</text><text x="108" y="1040">neighbours, insured up to $1M.</text></g>
    <rect id="cta" x="108" y="1085" width="300" height="96" rx="12" fill="#B5451B"/>
    <text x="258" y="1146" font-size="36" font-weight="700" fill="#FFFFFF" text-anchor="middle">Book now</text>
  </g>
</svg>
```
```svg
<svg viewBox="0 0 1080 1920" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <!-- 9:16 Story, petpal-pilot_trust_static_1080x1920_v1.svg -->
  <title id="t">PetPal 9:16 story ad, trust hook</title>
  <desc id="d">Clay paw print on a sand panel above the headline "Sitters you can trust", the line "Background-checked, reviewed by neighbours, insured up to $1M." and a clay Book now button. Scratch exercise: PetPal and every figure are fictional.</desc>
  <defs>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="3" fill="#6B4B35" opacity=".14"/></pattern>
    <g id="paw" fill="#B5451B"><ellipse cx="0" cy="40" rx="78" ry="64"/><ellipse cx="-88" cy="-48" rx="28" ry="38" transform="rotate(-22 -88 -48)"/><ellipse cx="-32" cy="-92" rx="30" ry="40" transform="rotate(-8 -32 -92)"/><ellipse cx="32" cy="-92" rx="30" ry="40" transform="rotate(8 32 -92)"/><ellipse cx="88" cy="-48" rx="28" ry="38" transform="rotate(22 88 -48)"/></g>
  </defs>
  <rect width="1080" height="1920" fill="#FFF8F0"/>
  <rect width="1080" height="980" fill="#F3D9B1"/>
  <rect width="1080" height="980" fill="url(#dots)"/>
  <circle cx="540" cy="620" r="330" fill="#FFF8F0" opacity=".7"/>
  <use href="#paw" transform="translate(540 640) scale(2.6)" aria-hidden="true"/>
  <g font-family="Helvetica, Arial, sans-serif">
    <text x="108" y="330" font-size="28" font-weight="700" fill="#2B1D14">PetPal</text>
    <g font-size="96" font-weight="700" fill="#2B1D14"><text x="108" y="1190">Sitters you</text><text x="108" y="1300">can trust</text></g>
    <g font-size="36" fill="#6B4B35"><text x="108" y="1390">Background-checked, reviewed by</text><text x="108" y="1440">neighbours, insured up to $1M.</text></g>
    <rect id="cta" x="108" y="1490" width="340" height="104" rx="12" fill="#B5451B"/>
    <text x="278" y="1555" font-size="36" font-weight="700" fill="#FFFFFF" text-anchor="middle">Book now</text>
  </g>
</svg>
```
```svg
<svg viewBox="0 0 1200 628" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <!-- 1.91:1 Link Ad, petpal-pilot_trust_static_1200x628_v1.svg -->
  <title id="t">PetPal 1.91:1 link ad, trust hook</title>
  <desc id="d">Headline "Sitters you can trust", the line "Background-checked, reviewed by neighbours, insured up to $1M." and a clay Book now button on cream, with a clay paw print on a sand panel at right. Scratch exercise: PetPal and every figure are fictional.</desc>
  <defs>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="3" fill="#6B4B35" opacity=".14"/></pattern>
    <g id="paw" fill="#B5451B"><ellipse cx="0" cy="40" rx="78" ry="64"/><ellipse cx="-88" cy="-48" rx="28" ry="38" transform="rotate(-22 -88 -48)"/><ellipse cx="-32" cy="-92" rx="30" ry="40" transform="rotate(-8 -32 -92)"/><ellipse cx="32" cy="-92" rx="30" ry="40" transform="rotate(8 32 -92)"/><ellipse cx="88" cy="-48" rx="28" ry="38" transform="rotate(22 88 -48)"/></g>
  </defs>
  <rect width="1200" height="628" fill="#FFF8F0"/>
  <rect x="840" width="360" height="628" fill="#F3D9B1"/>
  <rect x="840" width="360" height="628" fill="url(#dots)"/>
  <circle cx="1020" cy="314" r="150" fill="#FFF8F0" opacity=".7"/>
  <use href="#paw" transform="translate(1020 330)" aria-hidden="true"/>
  <g font-family="Helvetica, Arial, sans-serif">
    <text x="120" y="110" font-size="28" font-weight="700" fill="#2B1D14">PetPal</text>
    <g font-size="80" font-weight="700" fill="#2B1D14"><text x="120" y="230">Sitters you</text><text x="120" y="316">can trust</text></g>
    <g font-size="36" fill="#6B4B35"><text x="120" y="392">Background-checked, reviewed</text><text x="120" y="438">by neighbours, insured up to $1M.</text></g>
    <rect id="cta" x="120" y="474" width="240" height="76" rx="12" fill="#B5451B"/>
    <text x="240" y="523" font-size="36" font-weight="700" fill="#FFFFFF" text-anchor="middle">Book now</text>
  </g>
</svg>
```

## Files
All under `docs/pilot/creative/`, with the trust, comfort and proof variants for each size:
- `petpal-pilot_{trust,comfort,proof}_static_1080x1350_v1.svg`
- `petpal-pilot_{trust,comfort,proof}_static_1080x1920_v1.svg`
- `petpal-pilot_{trust,comfort,proof}_static_1200x628_v1.svg`

Each file is 21 lines (Grep count). The same string should go into the ad name and `utm_content`. Colours are the token hex values copied in by hand, so the SVGs do not read `design-tokens.json`.

## Caveats
- **Link ad headline size:** it is 80 px instead of the token's 96 px. The token is defined for 1080-wide canvases, and 96 px would not fit the 628 px height beside the art. The 4:5 and 9:16 files use 96 px.
- **Text fit is estimated:** the files use no `textLength`. The fallback font changes widths, so check the render for clipping on "happy at home" and "12,000 stays,". Helvetica or Arial is assumed to be installed.
- **The in-image "Book now" button:** it is a drawn label, not a control. Keep the platform's real CTA button as the click target. Defne should confirm that an in-image button does not read as a fake UI element.
- **Claims:** the 4.9 rating, 12,000 stays, "background-checked" and "insured up to $1M" are all fictional and unsubstantiated. The subhead carries three claims in every variant, which strains the one-message rule. The copy owner decides whether to trim it. Defne needs to review all of it before any real use.

## Peer messages received
None.

## Open items
1. Run a render and a contrast check (a command, which I can't run) to confirm text fit and the hand-computed ratios.
2. Verify the three sizes and safe zones against each platform's current spec. Nothing was checked online.
3. Claims review by Defne, plus the in-image button question above.
4. Copy owner: keep the three-claim subhead, or give a single-claim line?
5. I had no task tools loaded, so I did not claim or update a task. The lead owns task status.
