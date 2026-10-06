# HookRelay technical SEO audit (static copy only)

I audited the static copy in `site/`. I could not reach the live site: `hookrelay.example` returned nothing from `curl`. Status codes, redirects, headers and Core Web Vitals are therefore not checked. The findings below come from reading the files on 2026-10-05.

## 1. Executive summary

- **Target:** the four pages you named: `/docs/webhooks`, `/pricing`, `/blog/webhook-retries` and `/blog/retry-strategies`.
- **Indexation status:** `/pricing` is **blocked** (`noindex, nofollow`). `/docs/webhooks` tells search engines the staging host is the real page. The two blog posts are indexable but compete with each other.
- **Health score: about 30/100, provisional.** The `seo-audit` skill that defines the scoring rule is not installed, so I used a stand-in. It starts at 100 and deducts 15 per critical finding and 7 per major finding. Treat the number as indicative only.
- **Likely causes of the 30% drop:**
  - Staging URLs leaked into production. This is a plausible explanation, and the evidence is in the files.
  - `/pricing` carries `noindex`.
  - Two near-duplicate blog posts target the same query.
  - I can't tie any of these to the traffic loss without Search Console data.

## 2. 15-point checklist

| # | Check | Severity | Status | Finding and remediation |
|---|---|---|---|---|
| 1 | robots.txt | Major | Fail | `robots.txt:3` declares `Sitemap: https://staging.hookrelay.example/sitemap.xml`. It should point at the production host. The `Disallow` on `/staging-preview/` is harmless. |
| 2 | Sitemap | Critical | Fail | `sitemap.xml:3-6` lists all four key pages on `staging.hookrelay.example`. Line 7 lists `www…/docs/webhook-guide`, which doesn't exist in this copy and may be a stale URL. There is no `lastmod`. Rebuild with production, canonical URLs only. |
| 3 | Status codes | n/a | Not checked | The live site was unreachable from here. |
| 4 | Redirects | n/a | Not checked | Same reason. Check whether staging URLs redirect to www and whether `/docs/webhook-guide` resolves. |
| 5 | Canonical | Critical | Fail | `docs/webhooks.html:7` canonicals to the staging host. `pricing.html:8` canonicals to www, but the page is `noindex`, which is contradictory. The two blog posts are correct and self-referencing. |
| 6 | Indexing directives | Critical | Fail | `pricing.html:7` has `<meta name="robots" content="noindex, nofollow">`. It looks like a staging leftover from the redesign. I could not verify whether the staging host itself is `noindex`. |
| 7 | Title | Minor | Warn | Lengths are 19, 34, 45 and 54 characters. `/pricing` is too short and has no topic keyword. Both blog titles lack the brand suffix. The two blog titles are nearly identical. |
| 8 | Meta description | Major | Warn | `/blog/retry-strategies` has none. The other three are about 86–87 characters, below the 120–155 target. |
| 9 | Social tags | Minor | Fail | No Open Graph or Twitter tags on any page. |
| 10 | Headings | Minor | Warn | Each page has one H1 and the docs page nests H2 correctly. The two blog H1s are near-duplicates, which feeds the cannibalisation issue. |
| 11 | Structured data | Minor | Fail | None present. I have not authored any, because the pages carry no author, date or prices to support the values (see §4). |
| 12 | Core Web Vitals | n/a | Not checked | There is no field data and no live URL. Please send the Search Console CWV report. |
| 13 | Images | Minor | Warn | The one image (`docs/webhooks.html:12`) has dimensions but **no `alt`**. It is PNG and has no lazy-load policy. |
| 14 | Internal links | Major | Fail | None of the four pages contains any link, so each is an orphan in this copy. If the real site has navigation, the export stripped it, so please confirm. |
| 15 | Mobile viewport and rendering | Major | Fail | No `<meta name="viewport">` on any page. Content is in the raw HTML, so rendering is fine. |

## 3. Priority actions

**Immediate**
1. Remove `noindex, nofollow` from `/pricing`. Owner: Deniz.
2. Fix the `/docs/webhooks` canonical so it points at the production host, `https://www.hookrelay.example/docs/webhooks`. Owner: Deniz.
3. Regenerate the sitemap with production URLs only, and point `robots.txt` at it. Owner: Deniz.
4. Confirm that `staging.hookrelay.example` is `noindex` or behind a login, and that staging URLs 301 to www. Owner: Deniz.
5. Check the live site for the same defects. The static copy may not match production.

**Optimisation**
6. Resolve the cannibalisation between `webhook-retries` and `retry-strategies`. Either differentiate them or consolidate with a 301. Owner: Yavuz.
7. Rewrite the `/pricing` title, add the missing meta description on `retry-strategies`, and lengthen the others. Owner: Kaan.
8. Add viewport, Open Graph and image `alt`, and check the internal linking. Owner: Deniz.
9. Report the score to the lead once `seo-audit` is installed.

## 4. Snippets

**robots.txt**
```
User-agent: *
Disallow: /staging-preview/

Sitemap: https://www.hookrelay.example/sitemap.xml
```

**sitemap.xml.** Add `lastmod` from the real publish or edit dates. I did not invent any.
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.hookrelay.example/docs/webhooks</loc></url>
  <url><loc>https://www.hookrelay.example/pricing</loc></url>
  <url><loc>https://www.hookrelay.example/blog/webhook-retries</loc></url>
  <url><loc>https://www.hookrelay.example/blog/retry-strategies</loc></url>
</urlset>
```

**Head fixes**
```html
<!-- all pages -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- /pricing: delete the robots meta tag entirely; indexable is the default -->
<title>Webhook Delivery Pricing: Free, Team, Business | HookRelay</title>

<!-- /docs/webhooks -->
<link rel="canonical" href="https://www.hookrelay.example/docs/webhooks">
<img src="/img/delivery-flow.png" width="640" height="360"
     alt="Diagram of HookRelay delivering a signed event to a customer endpoint">

<!-- /blog/retry-strategies (missing description, 139 characters) -->
<meta name="description" content="Compare three webhook retry strategies: fixed delay, exponential backoff and a dead letter queue, and when each fits your delivery pipeline.">
```

**Open Graph.** Per page, using the `<title>`, description and canonical URL, plus a real image URL that you supply:
```html
<meta property="og:type" content="website">
<meta property="og:title" content="…">
<meta property="og:description" content="…">
<meta property="og:url" content="…canonical…">
<meta name="twitter:card" content="summary_large_image">
```

**Structured data withheld.** Article markup needs a real author and dates. Offer markup for `/pricing` needs real prices. The pages show neither, so adding them would break the rule against unsupported values. Send me those details and I'll author the JSON-LD.

## 5. What I need from you

- **Search Console exports.** Yes, please send them:
  - Performance by page and query, for the 3 months before and after the redesign.
  - The Pages (indexing) report, filtered to "Excluded", and the Core Web Vitals report.
  - The URL Inspection result for `/pricing` and `/docs/webhooks`.
  - Whether `staging.hookrelay.example` is verified as a property.
- **Live-site access.** Allow the live site to be fetched so I can verify status codes, redirects, headers and CWV. Otherwise, send the output of `curl -sI -L` for the four URLs.
- **The redesign's URL changes.** I need to know whether any paths changed and whether redirects were set up.

**Peer messages received:** none.
**Open items:** the `seo-audit` skill isn't installed, so the score is provisional. Checks 3, 4 and 12 are not checked. Questions for Yavuz, the blog cannibalisation, and for Deniz, the staging and canonical fixes, need relaying by the lead.