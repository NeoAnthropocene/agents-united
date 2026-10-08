# Tonal scales

A scale is one hue in eleven lightness steps, 50 (almost white) to 950 (almost black). Components take steps by job (ground 50, border 200, brand 600, text 700), so the steps must be even to the eye. Mixing a colour with white or black gives uneven steps and a muddy middle, because the mixing happens in sRGB values, which are not perceptually even. OKLCH is: `L` is lightness and moves evenly to the eye, `C` is chroma (how colourful) and `h` is the hue angle.

## The curve

| Step | L (OKLCH lightness) | Share of the in-gamut chroma kept |
|---|---|---|
| 50 | 0.97 | 0.55 |
| 100 | 0.93 | 0.60 |
| 200 | 0.87 | 0.62 |
| 300 | 0.79 | 0.75 |
| 400 | 0.70 | 0.90 |
| 500 | 0.62 | 1.00 |
| 600 | 0.54 | 1.00 |
| 700 | 0.46 | 0.95 |
| 800 | 0.38 | 0.85 |
| 900 | 0.30 | 0.72 |
| 950 | 0.22 | 0.58 |

The steps are about 0.08 apart through the middle and finer at the light end, where small differences show.

## How a scale is built

1. Read the seed in OKLCH: `L`, `C`, `h`. With a shell the script prints them; without one, take the nearest family of [hue-families.md](hue-families.md) by hue angle.
2. Keep the hue `h` for every step.
3. Set each step's lightness from the table.
4. Set each step's chroma: the seed's **relative saturation** (its chroma divided by the largest chroma sRGB can show at its lightness and hue) times the share in the table. The light and dark ends can show less chroma, so they get quieter without a rule per hue.
5. The step nearest the seed's lightness is the brand step. The seed keeps its own hex: it is the brand colour and the scale is built around it. PetPal's clay `#B5451B` (L 0.538) lands on 600, and the scale's own 600 is `#B6451B`, one unit away.

## Which step carries what

For the fifteen families of [hue-families.md](hue-families.md) (a test recomputes every line):

- Step 500 on white clears 3 to 1: large text, icons, boundaries.
- Step 600 on white clears 4.5 to 1: body text.
- Step 700 on white clears 7 to 1, except lime, green, teal and cyan (6.8 to 6.9): take 800 there when AAA is wanted.
- Step 600 on step 50 clears 4.5 to 1, except green and teal (4.42 and 4.46): take 700 on tints.
- Step 700 on step 50 clears 4.5 to 1 for every family (6.2 or more).
- Step 400 on step 950, a light accent on a near-black ground, clears 4.5 to 1 for every family (5.7 or more).

These hold for these scales. A brand-specific scale needs its own check: the script prints each step on white and on black.

## Tinted neutrals

Neutrals take a trace of the brand hue (relative saturation 0.1 or less): a warm brand gets warm greys, a cool brand cool ones. Pure greys beside a coloured brand look dead; strongly tinted greys look dirty. The two neutral rows of the family table are the starting point.

## How many steps

A paid-social set needs four or five: ground (50), tint (200), brand (600), text (900) and one accent step. A product needs all eleven for the brand, the neutral and each semantic hue: hand the scale to `design-system-tokens`, which turns the steps into named tokens.
