# Worked example (invented findings, for checking your own work)

A developer-tools site, audit of 12 key URLs on 2026-10-01.

## The findings

| # | Sev | URL | Observation (evidence) | Fix | Owner |
|---|---|---|---|---|---|
| 1 | critical | `/docs/webhooks` | `<meta name="robots" content="noindex">` present (page source) | remove the tag; it was copied from staging | Deniz |
| 2 | major | `/blog/webhook-retries` and `/blog/retry-strategies` | both target "webhook retry strategy"; both rank on page 2 (Search Console export from the client) | merge into the stronger URL, 301 the other, keep the better sections | Yavuz decides, Deniz redirects |
| 3 | major | `/pricing` | the title is "Pricing" (7 characters) | "Pricing: free plan and paid plans for webhook delivery" (54) | Kaan |
| 4 | minor | 9 images | no alt text | write descriptive alt text | Yavuz and Jamileh |

## The score

100 - 15 - 7 - 7 - 2 = **69** for this scope. Check it: `node scripts/health-score.mjs examples/worked-example.md` prints critical 1, major 2, minor 1 and `health score: 69`.

Indexation status: one important page is blocked (finding 1).
