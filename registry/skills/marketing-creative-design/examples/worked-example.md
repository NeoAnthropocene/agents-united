# Worked example (invented sizes, for checking your own work)

Campaign: a webhook-retry feature. Master: 1080 x 1350 (4:5): the hook "94% of failed webhooks recover" as large text, one chart, a call to action button.

## The export table

| Output | Size | Format | Budget | Measured |
|---|---|---|---|---|
| Landing hero | 1600 x 900 | AVIF (+ WebP fallback) | 200 KB | 142 KB AVIF, 188 KB WebP |
| Social card 1:1 | 1080 x 1080 | WebP | 300 KB | 171 KB |
| Story 9:16 | 1080 x 1920 | PNG for the channel | 400 KB | 512 KB, over budget: flatten the gradient to a solid, re-export |
| Email header | 1200 x 400 | JPEG | 100 KB | 64 KB |
| Chart | scalable | SVG | 10 KB | 6 KB |

## Alt text and rights

Chart: "Line chart: failed webhook deliveries recovered by retries, 94 percent of 10,000 test events" (the figure comes from the brief's staging test, flagged for Defne). The decorative gradient: `alt=""`. Rights: the illustration is original; the font is the licensed brand font from the tokens.

## One adaptation, as SVG

```svg
<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t">
  <title id="t">94 percent of failed webhooks recover on their own</title>
  <rect width="1080" height="1350" fill="#0B1220"/>
  <text x="80" y="240" font-size="96" font-weight="700" fill="#FFFFFF">94% of failed</text>
  <text x="80" y="350" font-size="96" font-weight="700" fill="#FFFFFF">webhooks recover</text>
</svg>
```
