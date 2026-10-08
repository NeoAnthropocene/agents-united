I wrote both SVGs and re-read them from disk. I haven't rendered them. Line wraps are my estimates for Helvetica bold, so please check them in a browser first.

## Brief
- **Audience and message:** pet owners; the headline you supplied is the one claim.
- **Headline:** used whole on both placements, unchanged, with line breaks only. I also put it in each file's `<desc>`.
- **Call to action:** not drawn. You gave me no CTA copy and I won't invent any, so both placements rely on the platform's native button.
- **Hook:** typographic, because no photography was supplied. A sand panel carries a decorative paw mark that screen readers skip.

## Placements
| Placement | Canvas | Safe zone (80%) | Headline | File |
|---|---|---|---|---|
| 4:5 feed | 1080×1350 | x 108–972, y 135–1215 | 72px bold, 6 lines | `docs/pilot/creative/petpal_trust_static_1080x1350_v1.svg` |
| 1.91:1 link | 1200×628 | x 120–1080, y 63–565 | 48px bold, 6 lines | `docs/pilot/creative/petpal_trust_static_1200x628_v1.svg` |

The sizes are typical values from memory. I did not read them from a platform spec, so verify them against Meta's current specification before export.

## Token use
The colours come from `design-tokens.json`: `surface.base` for the background, `surface.accent` for the panel, `text.default` for text, and `cta.primary` for the clay accent rule on the 4:5 and the clay edge strip on the 1.91:1. The font family is the token's Helvetica, Arial, sans-serif.

**Token deviation:** the 96px `font.size.headline` token can't hold a 107-character headline. It would need about 8 lines on the 4:5 and would overflow the 1.91:1. I used 72px and 48px instead and did not add new tokens. Please confirm the deviation, or I can add scale tokens for long headlines.

## Contrast
These are my calculations from the hex values, not a tool run.
- `text.default` on `surface.base`: about 15:1.
- `text.default` on `surface.accent`: about 11:1. No text sits on the sand panel; only the decorative paw does.
- The wordmark and headline are all above 24px.

The clay `cta.primary` fill is used only as a non-text accent, so no label contrast is at stake.

## SVG blocks
```svg
<svg viewBox="0 0 1080 1350" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <title id="t">PetPal 4:5 feed ad</title>
  <desc id="d">Background-checked sitters, reviewed by your neighbours and insured up to $1M, for dogs, cats and small pets</desc>
  <rect width="1080" height="1350" fill="#FFF8F0"/>
  <text x="108" y="190" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="#2B1D14">PetPal</text>
  <rect x="108" y="250" width="96" height="12" fill="#B5451B"/>
  <text font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="700" fill="#2B1D14">
    <tspan x="108" y="350">Background-checked</tspan>
    <tspan x="108" y="430">sitters, reviewed</tspan>
    <tspan x="108" y="510">by your neighbours</tspan>
    <tspan x="108" y="590">and insured up to</tspan>
    <tspan x="108" y="670">$1M, for dogs, cats</tspan>
    <tspan x="108" y="750">and small pets</tspan>
  </text>
  <rect x="0" y="840" width="1080" height="510" fill="#F3D9B1"/>
  <g aria-hidden="true" fill="#2B1D14">
    <ellipse cx="540" cy="1110" rx="130" ry="100"/>
    <ellipse cx="390" cy="990" rx="40" ry="55" transform="rotate(-20 390 990)"/>
    <ellipse cx="480" cy="930" rx="42" ry="58"/>
    <ellipse cx="600" cy="930" rx="42" ry="58"/>
    <ellipse cx="690" cy="990" rx="40" ry="55" transform="rotate(20 690 990)"/>
  </g>
</svg>
```
```svg
<svg viewBox="0 0 1200 628" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <title id="t">PetPal 1.91:1 link ad</title>
  <desc id="d">Background-checked sitters, reviewed by your neighbours and insured up to $1M, for dogs, cats and small pets</desc>
  <rect width="1200" height="628" fill="#FFF8F0"/>
  <text x="120" y="110" font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="700" fill="#2B1D14">PetPal</text>
  <text font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="700" fill="#2B1D14">
    <tspan x="120" y="190">Background-checked</tspan>
    <tspan x="120" y="248">sitters, reviewed by</tspan>
    <tspan x="120" y="306">your neighbours and</tspan>
    <tspan x="120" y="364">insured up to $1M,</tspan>
    <tspan x="120" y="422">for dogs, cats and</tspan>
    <tspan x="120" y="480">small pets</tspan>
  </text>
  <rect x="840" y="0" width="360" height="628" fill="#F3D9B1"/>
  <rect x="840" y="0" width="12" height="628" fill="#B5451B"/>
  <g aria-hidden="true" fill="#2B1D14" transform="translate(1026 314) scale(0.8) translate(-540 -1040)">
    <ellipse cx="540" cy="1110" rx="130" ry="100"/>
    <ellipse cx="390" cy="990" rx="40" ry="55" transform="rotate(-20 390 990)"/>
    <ellipse cx="480" cy="930" rx="42" ry="58"/>
    <ellipse cx="600" cy="930" rx="42" ry="58"/>
    <ellipse cx="690" cy="990" rx="40" ry="55" transform="rotate(20 690 990)"/>
  </g>
</svg>
```

## Open items
- **Claims review (Defne):** "Background-checked", "insured up to $1M" and "reviewed by your neighbours" are claims that need a source. PetPal is fictional here, so none has been checked.
- **CTA label (Kaan/Jale):** I need the copy if you want a button drawn into the creative.
- **Render check:** I have no shell here, so someone should open both files to confirm the wraps. The paw on the 1.91:1 extends to about x=1118, just past the safe zone. It is decorative only.
- **Naming:** files follow `<campaign>_<angle>_<format>_<size>_v<n>`. I chose the angle "trust" myself. Rename it if you prefer another.
- **Variants:** you asked for one concept per placement, so I made no A/B hook variations. I can add them if you want a test round.
- **Peer messages received:** none.
