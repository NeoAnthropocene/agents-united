# PetPal

PetPal is a fictional product from a scratch exercise. Every value here is invented, and the tokens come from `docs/pilot/design-tokens.json`. This brand book describes only what that file defines. Voice, iconography and logo were not supplied, so they are not described.

## Colour

Five brand colours plus white, and six roles that point at them. Build with the roles; reach for a brand colour only when no role fits.

| Role | Points at | Value | Use |
|---|---|---|---|
| `text-default` | `cocoa-900` | #2B1D14 | Body text and headlines. |
| `text-muted` | `cocoa-600` | #6B4B35 | Secondary text on cream or sand. Never on clay. |
| `text-on-action` | `white` | #FFFFFF | The label on a primary call-to-action. |
| `surface-base` | `cream-50` | #FFF8F0 | Page ground. |
| `surface-accent` | `sand-300` | #F3D9B1 | Highlighted panels and bands. |
| `cta-primary` | `clay-600` | #B5451B | The fill of the primary call-to-action. |

### Contrast of the pairs that meet

Ratios were calculated by hand from the hex values with the WCAG formula. No tool checked them.

| Text | Ground | Ratio | Passes |
|---|---|---|---|
| `text-default` | `surface-base` | 15.5 : 1 | Normal text |
| `text-default` | `surface-accent` | 11.9 : 1 | Normal text |
| `text-muted` | `surface-base` | 7.4 : 1 | Normal text |
| `text-muted` | `surface-accent` | 5.7 : 1 | Normal text |
| `text-on-action` | `cta-primary` | 5.5 : 1 | Normal text |
| `text-muted` | `cta-primary` | 1.4 : 1 | Fails. This is why muted text never sits on clay. |
| `text-default` | `cta-primary` | 3.0 : 1 | Large text only. Use the white label instead. |

## Type

One family stack, `Helvetica, Arial, sans-serif`, with no font files to load.

| Style | Size | Note |
|---|---|---|
| `headline` | 96px | Sized for canvases 1080px wide. |
| `body` | 36px | |
| `caption` | 28px | |

These sizes suit 1080px social and ad canvases. They are too large for a web page or product screen. Weights and line heights were not supplied.

## Space and shape

Spacing steps: `space-1` 8px, `space-2` 16px, `space-4` 32px, `space-8` 64px. Radii: `radius-md` 12px for panels and buttons, `radius-pill` 999px for tags and pill-shaped buttons.

## Rules

- A button is a `cta-primary` fill with a `text-on-action` label.
- Put `text-muted` on cream or sand only.
- Text and ground come from the roles above, never from raw hex.
