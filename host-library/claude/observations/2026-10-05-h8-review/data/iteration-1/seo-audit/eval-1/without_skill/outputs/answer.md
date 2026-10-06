# SEO audit: blocked, `example.com` is not your site

I haven't audited your pages. `example.com` is the IANA reserved documentation domain, so the 30% traffic drop can't be diagnosed from it. Nothing here is a finding about your product.

## Evidence (`curl -sIL`, 2026-10-05 ~15:03 GMT, from my location)

| URL | Result |
|---|---|
| `https://example.com/` | 200, body is "This domain is for use in documentation examples…" (title "Example Domain") |
| `/robots.txt`, `/sitemap.xml` | 404 |
| `/docs/webhooks` | 404 |
| `/pricing` | 404 |
| `/blog/webhook-retries` | 404 |
| `/blog/retry-strategies` | 404 |
| `http://example.com/pricing`, `https://www.example.com/pricing` | 404 |

This workspace (`h8-skills`) holds no site source either: there is no `app/` or `public/` folder, so there are no robots, sitemap or metadata files to read.

I'm not scoring the 15-point checklist or recommending fixes from this. Any score would describe a placeholder, not your site.

## What I need

1. **The real domain.** If the site is private, staging-only, or blocks bots, tell me. I won't work around bot protection. I'd ask for allow-listing or exports instead.
2. **Search Console exports.** They matter most for a drop that started after the redesign. Please send:
   - Performance by page, one month before and one month after the redesign, with clicks, impressions, CTR and position.
   - Performance by query for the same two windows, for the four priority pages.
   - Page indexing report: counts by reason (e.g. "Crawled – not indexed", "Duplicate, Google chose different canonical", "Excluded by noindex", "Page with redirect").
   - Sitemaps report and the Crawl stats report.
3. **The redesign date and what changed.** In particular:
   - Did URLs change? For example, `/blog/webhook-retries` may have moved from another path.
   - Is there a redirect map?
   - Did the framework or rendering change, for instance to client-side rendering?
   - Was the CMS or hosting platform changed?
4. **Source access, if available.** A repo path or a staging URL lets me read the robots, sitemap and metadata code.

## Hypotheses to test once I have the real site

These are not findings yet. I'm only listing what the exports and crawl will confirm or rule out:

- **Redirects and canonicals.** Old URLs may redirect in more than one hop, or may 404. Canonicals may point at the old or staging host.
- **Indexing leaks.** A `noindex` or `Disallow: /` carried over from staging, or a sitemap listing the old URLs.
- **Rendering.** Main content or internal links missing from the raw HTML after the redesign.
- **Cannibalisation.** `/blog/webhook-retries` and `/blog/retry-strategies` have overlapping topics. If the redesign changed titles, headings or internal links, they may now compete for the same queries. That is a call for Yavuz, and I'd raise it through the lead.
- **Core Web Vitals regression.** I'd judge it from field data, and use lab data only to find the cause.

Once I have the domain and the exports, I'll run the full 15-point audit and send the report, with the schema and metadata snippets.

**Peer messages received:** none
**Open items:** the real domain (or staging URL), the Search Console exports, the redesign date and URL-change details, and a redirect map if one exists.