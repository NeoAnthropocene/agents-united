# Contrast: thresholds, the formula and a table for the neutrals

You have no shell, so this holds the arithmetic. Emre has the same numbers from `accessibility-audit` (`scripts/contrast.mjs`), and a pair that is not here is his to measure.

## Thresholds (WCAG 2.1 level AA, the agency's gate)

| Use | Minimum ratio |
|---|---|
| Normal text | 4.5 to 1 |
| Large text (24 px, or 19 px bold), interface boundaries and icons | 3 to 1 |

Level AAA asks for 7 to 1 for normal text and 4.5 to 1 for large text. Compare the unrounded ratio: 4.499 fails.

## The formula

1. For each channel of the colour (red, green, blue): c = value / 255; if c is 0.03928 or less, c / 12.92; otherwise ((c + 0.055) / 1.055) raised to 2.4.
2. Relative luminance L = 0.2126 x R + 0.7152 x G + 0.0722 x B.
3. Ratio = (L of the lighter colour + 0.05) / (L of the darker colour + 0.05).

## The neutral ramp of the worked example, as text on three light surfaces

Computed with the formula; `pass` is 4.5 or more, `large only` is 3 up to 4.5, `fail` is under 3. Steps 50 to 300 are too light to carry text on these surfaces and are left out.

| Step | Hex | on white (#FFFFFF) | on gray 50 (#F9FAFB) | on gray 100 (#F3F4F6) |
|---|---|---|---|---|
| gray 400 | #9CA3AF | 2.54 fail | 2.43 fail | 2.31 fail |
| gray 500 | #6B7280 | 4.83 pass | 4.63 pass | 4.39 large only |
| gray 600 | #4B5563 | 7.56 pass | 7.23 pass | 6.87 pass |
| gray 700 | #374151 | 10.31 pass | 9.86 pass | 9.37 pass |
| gray 800 | #1F2937 | 14.68 pass | 14.05 pass | 13.34 pass |
| gray 900 | #111827 | 17.74 pass | 16.98 pass | 16.12 pass |
| gray 950 | #030712 | 20.13 pass | 19.27 pass | 18.30 pass |

Read it as: gray 500 is a safe muted text on white and on gray 50, and fails for normal text on gray 100, so the muted token on a grey surface moves to gray 600.

## When there is no single ratio

Text over a gradient or an image has no one ratio: require a scrim and measure the worst region, then hand the pair to Emre.
