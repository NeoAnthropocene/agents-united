# PetPal

PetPal is a fictional pet-care product. This scratch system holds its design tokens, converted from `docs/pilot/design-tokens.json`. Every value is invented for the exercise.

## What the source states

- Palette: cocoa 900 `#2B1D14` and 600 `#6B4B35`, clay 600 `#B5451B`, cream 50 `#FFF8F0`, sand 300 `#F3D9B1`, white.
- Roles: `text-default`, `text-muted`, `text-on-action`, `surface-base`, `surface-accent`, `cta-primary`. Each is an alias of a palette colour.
- Type: one family, Helvetica, Arial, sans-serif. Three sizes: headline 96px (for 1080 px wide canvases), body 36px, caption 28px.
- Spacing: 8, 16, 32 and 64px. Radius: 12px and a pill (999px).
- One theme only (light). No dark theme, weights, line heights or font files are given.

## Rules the source gives

- `text-muted` goes on cream or sand, never on clay.
- `cta-primary` is a fill. Its label is `text-on-action` (white).

## Contrast of the pairs that meet

Computed by hand from the hex values (WCAG relative luminance), not with a tool. Recheck before relying on them.

| Text on ground | Ratio | Result |
|---|---|---|
| text-default on surface-base | 15.5 : 1 | passes 4.5 |
| text-default on surface-accent | 11.9 : 1 | passes 4.5 |
| text-muted on surface-base | 7.4 : 1 | passes 4.5 |
| text-muted on surface-accent | 5.7 : 1 | passes 4.5 |
| text-on-action on cta-primary | 5.5 : 1 | passes 4.5 |
| text-muted on cta-primary | 1.4 : 1 | fails, which is why the source forbids it |

## Not in the source

Voice and copy, iconography, imagery, a logo, components, shadows and a dark theme. None of them was made up. Two things on the cover are not from the source: the tagline "Everyday care for pets and the people who feed them." is a placeholder written for the cover, and the pill and disc pattern is inferred from the radius tokens. The cover's colours and radii are the source's. Most tokens have no usage note because the source gives only three; they are listed as open items for the owner.
