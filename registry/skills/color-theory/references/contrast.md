# Contrast: thresholds, the formula, and the cases with no single ratio

The agency's gate is WCAG 2.x level AA. The neutral ramp and the token-level pair list are in `design-system-tokens` (`references/contrast-table.md`); Emre measures the built page with the script of `accessibility-audit`. This page is for deciding colours before they are fixed.

## Thresholds

| Use | Ratio needed | Criterion |
|---|---|---|
| Normal text | 4.5 to 1 | 1.4.3 (AA) |
| Large text: 24 px, or 18.66 px (14 pt) bold, and bigger | 3 to 1 | 1.4.3 (AA) |
| Icons that carry meaning, input borders, focus rings, parts of a chart, each against the colour next to it | 3 to 1 | 1.4.11 (AA) |
| Normal text, enhanced | 7 to 1 | 1.4.6 (AAA) |
| Large text, enhanced | 4.5 to 1 | 1.4.6 (AAA) |

Not required: a logotype (text that is part of a logo or a brand name), decorative graphics, a disabled control, incidental text nobody needs to read. Colour never carries a meaning alone (1.4.1): add an icon, a word or a pattern.

Compare the unrounded ratio: 4.499 fails 4.5. `#767676` on white is 4.54, the lightest grey that passes for body text; `#777777` is 4.48 and fails.

## The formula

1. For each channel, c = value / 255. Up to 0.04045, divide by 12.92; above it, take ((c + 0.055) / 1.055) to the power 2.4.
2. L = 0.2126 R + 0.7152 G + 0.0722 B.
3. Ratio = (L lighter + 0.05) / (L darker + 0.05).

Worked: `#2B1D14` is (43, 29, 20), so c = 0.1686, 0.1137, 0.0784, which become 0.0242, 0.0123, 0.0070, and L = 0.0144. `#FFF8F0` is (255, 248, 240), which become 1.0000, 0.9387, 0.8714, so L = 0.9469. The ratio is (0.9469 + 0.05) / (0.0144 + 0.05) = 15.47. Carry five decimals through the arithmetic: with four, the last digit moves.

## When there is no single ratio

- **Text on a photo.** There is no one background. Measure the worst patch behind each line of text, not the average. Where it fails, put a scrim (a gradient that is solid at the text side) or a solid panel behind the text, and measure against the scrim's composited colour. A scrim that only makes the average pass hides the one bright patch.
- **A gradient.** Check both ends and the middle: the text must pass against the worst stop that sits behind it.
- **A translucent colour.** Composite it onto the real ground first (per channel, alpha x top + (1 - alpha) x ground, on the 0 to 255 values), then measure the result.
- **Text with a stroke or a shadow.** Count a stroke only if it is the colour the text is measured against and wide enough to hold the letter; never count a soft shadow.
- **States.** Hover, focus, pressed and visited colours each meet their own pair; a disabled control is exempt.

## Choose the pair, then check it

Start from the text colour the brand needs, then take the ground step that clears the threshold with room to spare: as a rule of thumb, 10 percent above the line, not a hair over, because screens and print shift colours. In the scale of [tonal-scales.md](tonal-scales.md), step 600 on white clears 4.5 to 1 for every family of [hue-families.md](hue-families.md), step 700 on step 50 clears it by a wide margin, and step 500 clears 3 to 1.

## What this does not settle

WCAG 2.x ratios are the gate the agency uses and the one a compliance review checks. The perceptual method in the WCAG 3 drafts (APCA) is not final and is not used here. A ratio does not make text readable: size, weight, spacing and line length decide too. Name the pairs you did not check; "contrast is fine" is not a finding.
