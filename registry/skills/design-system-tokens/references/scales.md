# Scales, computed

You have no shell, so the arithmetic is here. Every value follows from the rule; none is chosen by eye.

## Spacing

A 4 px base: 4, 8, 12, 16, 24, 32, 48, 64 (px).

## Type: a fixed ratio from a 16 px body, rounded to whole pixels

Size at step n = 16 x ratio ^ n. Use 1.2 for dense product UI and 1.25 for marketing pages.

| Step | Ratio 1.2 (product UI) | Ratio 1.25 (marketing) |
|---|---|---|
| -1 | 13 | 13 |
| 0 (body) | 16 | 16 |
| 1 | 19 | 20 |
| 2 | 23 | 25 |
| 3 | 28 | 31 |
| 4 | 33 | 39 |
| 5 | 40 | 49 |
| 6 | 48 | 61 |

Line height: about 1.5 for body text and 1.2 for headings.

## Colour ramps

9 to 11 steps per hue, named 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 and 950. They are primitives (tier 1): they carry no meaning, and the semantic tier (tier 2) points at them.

## Tiers and naming

| Tier | Holds | Used by |
|---|---|---|
| 1 primitives | raw values: colour ramps, the type, spacing, radius, shadow and duration scales | semantic tokens only |
| 2 semantic | names for jobs: `color.text.default`, `color.text.muted`, `color.surface.default`, `color.action.primary`, `color.border.subtle`, `color.feedback.error` | components |
| 3 component | an override a component really needs, such as `button.primary.background` | that component |

A name describes the job, never the value: `blue-button` is wrong, `color.action.primary` is right.
