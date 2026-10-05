# Export budgets, formats and ratios

Measure every export; do not estimate. Over budget: compress, reduce dimensions, simplify the image or split it, and do not lower quality until text artefacts appear.

## Size budgets (about)

| Output | Budget |
|---|---|
| Landing hero image | about 200 KB or less |
| Social card | about 300 KB or less |
| Email image | about 100 KB each |
| Icons and logos | SVG, under 10 KB |

A channel with its own limit (for example a story format) gets its own row in the export table, with the budget the channel sets.

## Formats

| Content | Format | Notes |
|---|---|---|
| Anything geometric (logos, icons, shapes, charts) | SVG | outline or embed fonts so it renders the same everywhere |
| Photographs | WebP or AVIF | a PNG or JPEG fallback only where a channel requires it |
| Text that cannot embed a font (a licence limit) | outlines in the exported asset | keep the live text only in the source file |

## Aspect ratios to recompose for

1:1, 4:5, 9:16, 16:9, and 1.91:1 where it is used. Each is recomposed, not scaled: the hook and the call to action inside the safe zone, new line breaks, deliberate crops.

## The export table, per file

```text
| Output | Size | Format | Budget | Measured | Verdict |
```

Alt text is written for each informative image (what it shows and why it is there) and left empty (`alt=""`) for decoration. Every image, font and illustration has a recorded source, licence and any attribution or usage limit.
