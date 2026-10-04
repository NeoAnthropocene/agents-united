---
name: technical-seo-audit
description: "Run the fifteen technical SEO checks (robots, sitemaps, canonical, status codes, redirects, metadata, headings, structured data, Core Web Vitals, images, internal links, rendering, indexation leaks) with how to verify each from a shell, thresholds, and findings by severity."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ⚙️
disable-slash-command: true
---

# Technical SEO Audit

## Overview & Purpose
Technical SEO decides whether a search engine can fetch, render, understand and index a page at all. These checks are binary or measurable, which makes them the cheapest part of an audit to do well and the most expensive to skip. This skill lists the fifteen checks Selin's report carries, how to verify each, the threshold, and what a finding looks like.

It is the depth behind `seo-audit`. It reports; fixes to application code are recommendations for Deniz, and structured-data snippets Selin authors are deliverables.

## Execution Triggers
Load it for a site audit, a launch or migration check, a sudden drop in indexed pages, or after a platform or CMS change. Do not use it for keyword or content strategy (Yavuz), or for fixing code.

## Input/Output Requirements
Inputs: the domain and key URLs, whether a staging site exists and its address, the sitemap location if known, access to Search Console exports if supplied, and any recent migration. Nothing is crawled beyond the client's own site and nothing is fetched aggressively: keep the request rate low.

Outputs: the 15-point table (check, severity, status, finding and remediation), the health score by the `seo-audit` rule, priority actions with owners, and authored snippets. **Evidence to attach**: for each check, the command or tool, the URL, the raw output line (status code, header, tag) and the date.

## Step-by-Step Runbook
Verify from a shell with `curl`. In PowerShell use `curl.exe` (the plain `curl` is an alias for `Invoke-WebRequest` and behaves differently). Examples: `curl -sI -L https://example.com/page` follows redirects and shows each hop's status; `curl -s https://example.com/robots.txt`.

1. **robots.txt**: exists at the root, returns 200, allows important paths, blocks only low-value or private ones, declares sitemaps, and has no `Disallow: /` left over from staging.
2. **Sitemap**: every file under 50,000 URLs and 50 MB uncompressed, listed in robots.txt, contains only canonical, indexable, 200 URLs with accurate `lastmod`.
3. **Status codes**: key URLs return 200; removed pages return 404 or 410, not a soft 200 "not found" page; no 5xx on crawl.
4. **Redirects**: one hop at most; any redirect chain longer than one hop and any loop is a finding; use 301 or 308 for permanent moves.
5. **Canonical**: every indexable page has one canonical, self-referencing on originals; canonicals point to a 200, indexable URL, not to a redirect or a `noindex` page.
6. **Indexing directives**: no `noindex` (meta tag or `X-Robots-Tag` header) on a page that should rank; every staging and admin route is blocked or `noindex` and requires login where possible, and a staging site must not be indexable.
7. **Title**: unique per page, about 50 to 60 characters, primary topic first, brand last.
8. **Meta description**: unique, about 120 to 155 characters, honest, with the value proposition.
9. **Social preview tags**: Open Graph and Twitter card tags with a working image URL at the recommended size.
10. **Headings**: one H1, a hierarchy that mirrors the content, no headings used only for styling.
11. **Structured data**: valid JSON-LD for the page type, matching what is visible; see `schema-markup-strategy`.
12. **Core Web Vitals** at the 75th percentile: LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1 ("needs improvement" up to 4.0 s, 500 ms and 0.25). Use **field data** (real users, for example from the Chrome UX Report or the client's analytics) to decide whether there is a problem and **lab data** (a Lighthouse or DevTools run via `chrome-devtools-mcp`) to find the cause. A lab number alone is not a verdict.
13. **Images**: dimensions set, modern format, descriptive alt text, lazy-loading below the fold but not for the main image, no oversize files.
14. **Internal links**: important pages within about three clicks of the home page, descriptive anchors, no orphan pages (pages in the sitemap with no internal links), no links to redirected or broken URLs.
15. **Rendering**: the main content and links exist in the raw HTML or are reliably rendered; compare `curl -s URL` with the rendered DOM; content that appears only after user interaction is not indexed reliably.

Then hand off: code and server fixes to Deniz, copy for titles and descriptions to Kaan, content and cannibalisation to Yavuz, and the health score to the lead.

## Code & Config Exemplars
### Worked example
Site audit on 2026-10-01 (invented output), key URL `https://example.com/docs/webhooks`.

```text
$ curl -sI -L https://example.com/docs/webhooks
HTTP/2 301  location: https://example.com/docs/webhooks/
HTTP/2 301  location: https://www.example.com/docs/webhooks/
HTTP/2 200  x-robots-tag: noindex
```

Findings: check 4 **major**, a two-hop redirect chain (slash, then www); check 6 **critical**, `X-Robots-Tag: noindex` on a documentation page, probably inherited from a staging rule (evidence above). Remediation (Deniz): redirect straight to the final URL in one hop and remove the header on production.

```text
check  severity  status  finding and remediation
 4     major     fail    chain /docs/webhooks -> /docs/webhooks/ -> www: 2 hops; redirect directly (Deniz)
 6     critical  fail    X-Robots-Tag: noindex on /docs/webhooks; remove on production (Deniz)
12     major     fail    LCP 3.4 s at p75 in field data (client's export, last 28 days); lab trace shows a 1.9 MB hero image (see debug-optimize-lcp)
```

### Anti-patterns
- Judging Core Web Vitals from one Lighthouse run.
- A sitemap that lists redirected, noindexed or non-canonical URLs.
- Blocking a path in robots.txt to hide it from search results (it prevents crawling, not indexing).
- Treating a soft 200 "page not found" as fine.
- Crawling a client's site at high speed.
- Changing production directives from this role.

## Edge Cases & Error Recovery
- **The site blocks your requests** (bot protection, region): do not work around it; report which checks could not be done and ask the lead for allow-listing or exports.
- **Behind a login or paywall**: audit the public surface and what search engines see; say what you could not check.
- **A CDN serves different headers per region**: note the location of the check and repeat from a second if the finding matters.
- **JavaScript framework with client-side routing**: check that each route has its own URL, title, canonical and status; a single-page shell returning 200 for every URL needs a rendering fix.
- **Search Console data not available**: do not infer index coverage; list it as not checked.

## Verification Checklist
- [ ] All fifteen checks have a status and evidence (command, URL, raw output, date), or are listed as not checked with the reason.
- [ ] Redirect chains, canonicals and indexing directives were verified on the final URL, not the first.
- [ ] Core Web Vitals use field data for the verdict and lab data only for the cause.
- [ ] Severity is assigned and the health score follows the stated rule.
- [ ] Nothing was changed on the client's site, and the crawl was gentle.
- [ ] Hand-offs name Deniz, Kaan, Yavuz and the lead.
