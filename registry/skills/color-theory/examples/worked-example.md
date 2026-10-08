# Worked example: a palette proved from one seed

PetPal is a fictional pet-care brand (the Plan 036 fixture, every value invented). The campaign set already runs on five token colours. The brief now adds three things: a booking confirmation with success, warning and error colours, a dark variant of the story, and a call-to-action button that must still read on the dark ground. Seed: the brand clay `#B5451B`. The ratios below are computed (the formula of [../references/contrast.md](../references/contrast.md); `scripts/palette.mjs` for the scale), not estimated.

## 1. The seed and its scale

`palette.mjs #B5451B` reads the seed as OKLCH L 0.538, C 0.155, h 39, relative saturation 0.90, and names step 600 as the nearest (the scale's own 600 is `#B6451B`, a unit away, so the seed is the brand step). The clay scale:

| Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | #FAF3F1 | #F5E4DE | #EDCCC1 | #EBA892 | #EF764E | #DB5523 | #B6451B | #90391A | #6A2E19 | #482215 | #29140D |

## 2. The roles, from the tokens and from the decisions

| Role | Hex | Where |
|---|---|---|
| Ground | `#FFF8F0` (cream 50) | the ad ground |
| Raised ground | `#F3D9B1` (sand 300) | the photo panel |
| Text, muted text | `#2B1D14`, `#6B4B35` (cocoa 900, 600) | headline and body, captions |
| Brand, accent | `#B5451B` (clay 600) | marks, large fills, the call to action only |
| Success | `#1F6836` (green 700) | the confirmation text, with a check icon |
| Warning | `#70521A` (amber 700) | the notice text, with a warning icon |
| Error | `#9E2220` (red 700) | the error text, with an error icon and the word "Error" |
| Dark ground | `#2B1D14` (cocoa 900, a token) | the story variant |

Why red 700 and not red 600 for the error: step 600 of the red family (`#C82525`) sits within 12 degrees of the clay's hue and at the same lightness (0.54), so the error colour and the brand would read as one to many viewers. Step 700 is darker (L 0.46), clears 7 to 1, and always travels with an icon and a word.

## 3. The pairs

| Text | Ground | Ratio | Used for | Verdict |
|---|---|---|---|---|
| #2B1D14 | #FFF8F0 | 15.47 | headline and body on the ground | pass, AAA |
| #6B4B35 | #FFF8F0 | 7.43 | rating line on the ground | pass, AAA |
| #2B1D14 | #F3D9B1 | 11.93 | text on the sand panel | pass, AAA |
| #6B4B35 | #F3D9B1 | 5.73 | caption on the sand panel | pass |
| #FFFFFF | #B5451B | 5.48 | the button label on the brand fill | pass |
| #B5451B | #FFF8F0 | 5.20 | the brand mark on the ground | pass (needs 3) |
| #6B4B35 | #B5451B | 1.43 | muted text on the brand fill | fail: the tokens forbid it, so it is not used |
| #1F6836 | #FFF8F0 | 6.45 | success text | pass |
| #70521A | #FFF8F0 | 6.85 | warning text | pass |
| #9E2220 | #FFF8F0 | 7.37 | error text | pass, AAA |
| #FFF8F0 | #2B1D14 | 15.47 | text on the dark ground | pass, AAA |
| #F3D9B1 | #2B1D14 | 11.93 | muted text on the dark ground | pass, AAA |
| #B5451B | #2B1D14 | 2.97 | the brand fill as a button on the dark ground | fail (needs 3 for the boundary) |
| #EF764E | #2B1D14 | 5.72 | clay 400 as the button on the dark ground | pass |
| #FFFFFF | #EF764E | 2.85 | a white label on clay 400 | fail |
| #2B1D14 | #EF764E | 5.72 | a cocoa label on clay 400 | pass |

Step 600 for the success text would have scored 4.54, which clears 4.5 by a hair; step 700 (6.45) leaves the margin the contrast reference asks for.

## 4. The decisions that were not obvious

- **The dark button.** The brand fill on the dark ground scores 2.97, under the 3 to 1 a boundary needs, so the dark variant takes clay 400. The white label then fails (2.85), so the label turns cocoa (5.72). The pair flips; nothing else on the dark story changes.
- **Complementary or split?** The brief wants one accent that does not fight the clay. A complementary accent (`palette.mjs #B5451B --harmony complementary`, a teal at hue 219) would vibrate beside the clay at the same lightness; the call to action stays clay, so no second accent is added.
- **Not altered.** The clay `#B5451B` is unchanged in every table above.

## 5. The report, as handed to the lead

Palette table and pairs as above, all computed by the formula and the script. **Not checked:** the colours on a calibrated screen; a colour-vision simulation (grey-scale view only: error, success and warning separate by lightness and carry an icon); a print proof; the dark story as rendered (the render ask goes to the lead). **Hand-offs:** the three semantic colours, their light and dark steps and the dark mapping to `design-system-tokens`; Emre measures the built pages.
