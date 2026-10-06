# SEO audit: hookrelay.example

## 1. Executive summary

- **Scope:** the 4 pages that matter, plus `robots.txt` and `sitemap.xml`, read from the static copy in `site/` on 2026-10-05.
- **Not checked:** I did not request the live site, so there are no live status codes, redirect hops, headers, Core Web Vitals or Search Console data. The `.example` domain can't be fetched.
- **Health score: 24/100.** The rule is 100 minus 15 per critical, 7 per major and 2 per minor finding. This audit has 3 critical, 3 major and 5 minor findings, and the score covers only these 4 pages and the two crawl files.
- **Indexation:**
  - `/pricing` is **blocked**.
  - `/docs/webhooks` is **at risk**, because its canonical points at staging.
  - The two blog pages are **indexable**, but they compete with each other.
- **The 30% drop:** the redesign probably shipped staging configuration to production. Three of the critical findings are the kind of fault that costs organic traffic. I can't tell you how much traffic each one cost without Search Console data, and I can't promise a recovery.

## 2. 15-point checklist

| # | Check | Severity | Status | Finding and remediation |
|---|---|---|---|---|
| 1 | robots.txt | **Critical** | Fail | `Sitemap: https://staging.hookrelay.example/sitemap.xml` (line 3). Production declares the staging sitemap. Replace it with the `www` sitemap. There is no staging-host protection here, so confirm separately that the staging host is blocked or behind a login. |
| 2 | Sitemap | **Critical** | Fail | Four of five `<loc>` entries use `staging.hookrelay.example`, including all four key pages. The fifth, `www…/docs/webhook-guide`, is not in the static copy and is probably an old URL (to verify). List only canonical, 200, `www` URLs. |
| 3 | Status codes | n/a | Not checked | The static copy has no status codes. Run `curl.exe -sI` on the 4 URLs and on `/docs/webhook-guide`. |
| 4 | Redirects | n/a | Not checked | Check whether `/docs/webhook-guide` redirects to `/docs/webhooks`, and confirm each redirect is a single hop. |
| 5 | Canonical | **Critical** | Fail | `docs/webhooks.html` line 7 has `rel=canonical` pointing at `https://staging.hookrelay.example/docs/webhooks`. This tells Google to index the staging copy instead of the real page. Change it to `https://www.hookrelay.example/docs/webhooks`. The other three canonicals are correct and self-referential. |
| 6 | Indexing directives | **Critical** | Fail | `pricing.html` line 7 has `<meta name="robots" content="noindex, nofollow">`. Remove it. `/pricing` is a high-value page, and this removes it from the index. |
| 7 | Title | Minor | Warn | The titles are 19, 34, 45 and 54 characters against a target of 50–60. Pricing (`Pricing \| HookRelay`) and docs are too thin on the primary keyword. |
| 8 | Meta description | **Major** | Fail | `blog/retry-strategies.html` has none. The other three are about 83–86 characters against a 120–155 target. |
| 9 | Social tags | Minor | Fail | No Open Graph or Twitter tags on any page. |
| 10 | Headings | Pass | Pass | One H1 per page, and `docs/webhooks` nests H1 then H2 correctly. Note that the two blog H1s are near-duplicates (see the per-URL table). |
| 11 | Structured data | Minor | Fail | No JSON-LD on any page. See section 4. |
| 12 | Core Web Vitals | n/a | Not checked | This needs field data (Search Console or CrUX) and a lab run on the live site. |
| 13 | Images | Minor | Fail | `docs/webhooks.html` line 12 has `<img src="/img/delivery-flow.png">` with no `alt`. It has width and height, which is good. It is a PNG, so consider WebP or AVIF. |
| 14 | Internal links | Minor | Warn | None of the 4 pages links anywhere, so there is no navigation or in-content linking. The static copy may have stripped it. Confirm on the live site that no page is orphaned. |
| 15 | Rendering / mobile | **Major** | Fail | No `<meta name="viewport">` on any of the 4 pages, which hurts mobile rendering. Raw HTML contains the content, so there is no JS-rendering concern in this copy. |

## 3. Priority actions

**Immediate.** All of these are cheap and need only config or template edits.

1. **Remove `noindex, nofollow` from `/pricing`.** Owner: Deniz.
2. **Fix the `/docs/webhooks` canonical** so it points at the `www` URL. Owner: Deniz.
3. **Rebuild `sitemap.xml` and the `robots.txt` Sitemap line** on the `www` host. Remove or redirect `/docs/webhook-guide`. Owner: Deniz.
4. **Check how the redesign build picks its host and robots settings.** The staging canonical, staging sitemap and `noindex` all look like staging environment values leaking into production. Owner: Deniz.
5. **Add the viewport meta tag** to the shared template. Owner: Deniz.
6. **Confirm the staging host is blocked or behind a login.** Owner: Deniz.
7. **Resubmit the sitemap in Search Console** after the fixes ship. Owner: lead.

**Optimisation.**

8. **Resolve the cannibalisation between the two retry posts.** Owner: Yavuz.
   - `/blog/webhook-retries` and `/blog/retry-strategies` both target "how to retry failed webhooks". Their titles and H1s overlap almost word for word.
   - The sensible options are to re-target one (for example, the strategies post to "retry strategies: fixed delay, backoff, dead letter queue") or to merge and 301 one into the other.
9. **Rewrite titles and descriptions** to the length targets. `/pricing` and `/docs/webhooks` should lead with their primary keyword. Owner: Kaan for copy.
10. **Add a description to `retry-strategies`**, plus OG/Twitter tags and `alt` text on the diagram. Owners: Kaan for copy, Deniz for the template.
11. **Check internal links** from docs, blog and pricing. Owner: Yavuz.

**Access needed (lead):**
- The Search Console exports you offered: Performance by page and query, Pages/Indexing report, and a before/after redesign comparison.
- Access to run `curl` against the live site.
- CrUX or field Core Web Vitals data.

## Per-URL table

| URL | Primary intent | Issue | Fix | Owner |
|---|---|---|---|---|
| `/pricing` | Commercial | `noindex, nofollow`; thin title and description | Remove `noindex`; lengthen the title and description | Deniz, Kaan |
| `/docs/webhooks` | Informational (how webhooks work) | Staging canonical; image has no `alt` | Self-referential `www` canonical; add `alt` | Deniz |
| `/blog/webhook-retries` | Informational (how to retry) | Overlaps `retry-strategies` | Keep as the main page for "webhook retries" | Yavuz |
| `/blog/retry-strategies` | Informational (which strategy to pick) | No meta description; same title and H1 pattern as the other post | Re-target to the strategy comparison, or merge | Yavuz, Kaan |

## 4. Snippets

**robots.txt**
```
User-agent: *
Disallow: /staging-preview/
Sitemap: https://www.hookrelay.example/sitemap.xml
```

**sitemap.xml**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.hookrelay.example/docs/webhooks</loc></url>
  <url><loc>https://www.hookrelay.example/pricing</loc></url>
  <url><loc>https://www.hookrelay.example/blog/webhook-retries</loc></url>
  <url><loc>https://www.hookrelay.example/blog/retry-strategies</loc></url>
</urlset>
```
`/docs/webhook-guide` is removed. Re-add it only if it returns 200 and is a canonical page.

**Head fixes**
```html
<!-- all pages -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- /docs/webhooks -->
<link rel="canonical" href="https://www.hookrelay.example/docs/webhooks">

<!-- /pricing: delete the robots meta tag entirely -->

<!-- /blog/retry-strategies (draft; edit to match the final re-targeting) -->
<meta name="description" content="Compare webhook retry strategies: fixed delay, exponential backoff and a dead letter queue, and when each one fits your delivery needs.">
```
That description is about 148 characters, and its claims match the visible page copy.

**Structured data (Article, for the two blog posts).** I haven't authored final JSON-LD. Article markup needs a real author, publish date and image, and none of those are on the pages. I won't invent them. Send me those values, or have the template fill them from the CMS, and I'll write the block. `/pricing` should get Product or Offer markup only after you give me real plan prices.

## Peer messages received
None.

## Open items
- Search Console exports and live access, as listed above. I can then confirm whether the traffic loss lines up with the dates the `noindex` and the staging canonical went live.
- Is the staging host indexable? The static copy can't tell me.
- Is `/docs/webhook-guide` a retired URL? If it is, it needs a 301.
- Core Web Vitals, status codes and redirect chains are not checked.
- I made no changes to files in `site/`.