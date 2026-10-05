---
name: technical-seo-audit
description: "Use when running a site audit, a launch or migration check, investigating a sudden drop in indexed pages, or after a platform or CMS change; trigger phrases: run a technical SEO audit, why are our pages not indexed, check robots and sitemap, are there redirect chains, is the canonical right. Produces the 15-point table (check, severity, status, finding, fix), the health score by the seo-audit rule, owned priority actions and snippets, each with evidence (command, URL, raw output, date). Skip it for keyword or content strategy (Yavuz) and for fixing code (recommend to Deniz)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: ⚙️
disable-slash-command: true
---

# Technical SEO Audit

Technical SEO decides whether a search engine can fetch, render, understand and index a page at all. The checks are binary or measurable, so they are the cheapest part of an audit to do well and the most expensive to skip.

## Overview & Purpose
The depth behind `seo-audit`: the fifteen checks Selin's report carries, how to verify each and the threshold. It reports; fixes to application code are recommendations for Deniz, and structured-data snippets Selin authors are deliverables.

## Execution Triggers
Load it for a site audit, a launch or migration check, a sudden drop in indexed pages, or after a platform or CMS change. Do not use it for keyword or content strategy (Yavuz) or for fixing code.

## Input/Output Requirements
Inputs: the domain and key URLs; a staging address if one exists; the sitemap location if known; Search Console exports if supplied; any recent migration. Crawl only the client's own site, gently.

Output: the 15-point table (check, severity, status, finding, remediation); the health score by the `seo-audit` rule; priority actions with owners; authored snippets. **Evidence to attach**: per check, the command or tool, the URL, the raw output line (status code, header, tag) and the date.

## Step-by-Step Runbook
Verify from a shell with `curl`; in PowerShell use `curl.exe` (plain `curl` is an alias for `Invoke-WebRequest` and behaves differently). `curl -sI -L <url>` shows each hop; pipe it to `node ${CLAUDE_SKILL_DIR}/scripts/redirect-chain.mjs` to count hops and catch a loop or a noindex. How to verify each check: [references/fifteen-checks.md](references/fifteen-checks.md).

1. **robots.txt**: root, 200, allows important paths, declares sitemaps, no `Disallow: /` left from staging.
2. **Sitemap**: files under 50,000 URLs and 50 MB uncompressed, in robots.txt, only canonical, indexable 200 URLs.
3. **Status codes**: key URLs 200; removed pages 404 or 410, never a soft 200; no 5xx.
4. **Redirects**: one hop at most, no loop, 301 or 308 for permanent moves; a longer redirect chain is a finding.
5. **Canonical**: one per indexable page, to a 200 indexable URL, never a redirect or a `noindex` page.
6. **Indexing directives**: no `noindex` (meta or `X-Robots-Tag`) on a page that should rank; staging and admin blocked, `noindex` or behind a login.
7. **Title**: unique, about 50 to 60 characters, topic first.
8. **Meta description**: unique, about 120 to 155 characters, honest.
9. **Social preview tags**: Open Graph and Twitter card, working image URL.
10. **Headings**: one H1, a hierarchy that mirrors the content.
11. **Structured data**: valid JSON-LD matching what is visible (`schema-markup-strategy`).
12. **Core Web Vitals** at the 75th percentile: LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1; **field data** decides, **lab data** finds the cause.
13. **Images**: dimensions, modern format, alt text, lazy-load below the fold but not the main image, no oversize files.
14. **Internal links**: important pages within about three clicks, descriptive anchors, no orphans, no links to redirected or broken URLs.
15. **Rendering**: main content and links in the raw HTML or reliably rendered; compare `curl -s URL` with the DOM.

Hand off: code and server fixes to Deniz, title and description copy to Kaan, content and cannibalisation to Yavuz, the score to the lead.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a redirect chain with a noindex, as `curl -sI -L` prints it, and its findings table.

Anti-patterns, each with its reason:
- Core Web Vitals from one Lighthouse run: lab data finds causes, it gives no verdict.
- A sitemap listing redirected, noindexed or non-canonical URLs: it sends crawlers to dead ends.
- Blocking a path in robots.txt to hide it: that stops crawling, not indexing.
- A soft 200 "page not found" treated as fine: search engines index it.
- Crawling a client's site at high speed: it can take the site down.
- Changing production directives: this role reports, it does not edit.

## Edge Cases & Error Recovery
- **The site blocks your requests** (bot protection, region): do not work around it; report which checks could not be done and ask the lead for allow-listing or exports.
- **Behind a login or paywall**: audit the public surface and what search engines see; say what you could not check.
- **A CDN serves different headers per region**: note where you checked; repeat from a second place if the finding matters.
- **Client-side routing**: each route needs its own URL, title, canonical and status; a shell returning 200 for every URL needs a rendering fix.
- **No Search Console data**: infer no index coverage; list it as not checked.

## Verification Checklist
- [ ] All fifteen checks have a status and evidence (command, URL, raw output, date), or are listed as not checked.
- [ ] Redirects, canonicals and indexing directives were verified on the final URL, not the first.
- [ ] Core Web Vitals use field data for the verdict and lab data only for the cause.
- [ ] Severity is assigned and the health score follows the stated rule.
- [ ] Nothing was changed on the client's site, and the crawl was gentle.
- [ ] Hand-offs name Deniz, Kaan, Yavuz and the lead.
