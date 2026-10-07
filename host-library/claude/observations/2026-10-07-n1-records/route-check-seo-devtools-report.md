# SEO / DevTools report: http://localhost:4173

Auditor: Selin (agency-seo-specialist). Date: 2026-10-07. Tool: chrome-devtools-mcp (own tab, page id 2), `curl.exe` for headers. Scope: this URL only. Findings only; fixes are recommendations.

## 1. Executive Summary

- Target: http://localhost:4173/ ("Choose a plan" pricing/signup page, Python SimpleHTTP server).
- Indexation status: indexable (no robots meta, no X-Robots-Tag, 200), but lacks canonical, description, social tags, robots.txt and sitemap. This is a local static server, so deployment-level checks are indicative only.
- Health score: not computed under the seo-audit rule (local dev origin, no field data). Indicative: 3 major, 5 minor findings, 0 critical.
- **Pass/fail: FAIL** on console cleanliness (2 console errors, both 404) and on metadata completeness. **PASS** on lab Core Web Vitals (LCP 32 ms, CLS 0.00).

## 2. Console messages (list_console_messages, with navigation to /)

| msgid | type | text | source |
|---|---|---|---|
| 1 | error | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:4173/missing.js (network reqid=2, 404) |
| 2 | issue | A form field element should have an id or name attribute (count: 1) | the email `<input>` in the form (violatingNodeId 2) |
| 3 | error | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:4173/favicon.ico (network reqid=3, 404) |

Source attribution for msgid 1 and 3 comes from the network list (only 3 requests: `/` 200, `/missing.js` 404, `/favicon.ico` 404); the console text itself carries no URL.

## 3. Performance trace (performance_start_trace, reload, 1x CPU, no network throttling)

Raw trace saved at `C:\Users\ozy\AppData\Local\Temp\claude\C--github-scratch-pilot-n1-h9a-route\fc849108-1256-473b-a17e-0ededb782854\scratchpad\trace.json`.

| Metric | Lab value | 75th-percentile threshold | Verdict |
|---|---|---|---|
| LCP | 32 ms (TTFB 1 ms, render delay 31 ms) | 2.5 s | Pass |
| CLS | 0.00 | 0.1 | Pass |
| INP | not measured (no interaction performed) | 200 ms | Not checked |
| Field data (CrUX) | n/a, no data for this page | n/a | Not checked |

Insights offered: LCPBreakdown, RenderBlocking. RenderBlocking detail: `/missing.js` (High priority, render-blocking: Yes, 4 ms total, 404, estimated savings: none). The lab figures are from localhost with no throttling and give no verdict for real users; they show only that nothing in the page itself is slow.

## 4. Findings

| # | Check | Severity | Finding and evidence | Recommendation (owner) |
|---|---|---|---|---|
| 1 | Broken script | major | `<script src="/missing.js">` in `<head>` returns 404 (network reqid=2, console msgid 1) and is flagged render-blocking by the trace. A blocking request to a dead URL delays first render on a real network and signals a broken deployment. | Remove or fix the reference; if kept, add `defer`/`async` (Deniz) |
| 2 | Meta description | major | `document.querySelector('meta[name=description]')` returns null. | Add a 120-155 character description with a value proposition (Kaan copy, Deniz placement) |
| 3 | Canonical | major | No `link[rel=canonical]` present. | Add a self-referential canonical on the production URL (Deniz) |
| 4 | Title | minor | `<title>Plan</title>` is 4 characters; target is 50-60 with primary keyword first and a brand suffix. | Rewrite title (Kaan, Deniz) |
| 5 | Social preview tags | minor | Zero `og:*` or `twitter:*` meta tags. | Add Open Graph and Twitter card tags with a working image URL (Deniz) |
| 6 | robots.txt / sitemap | minor | `curl.exe -sI` on `/robots.txt` and `/sitemap.xml` both return `HTTP/1.0 404 File not found`. | Provide both on the production origin, sitemap declared in robots.txt (Deniz) |
| 7 | Favicon | minor | `/favicon.ico` 404 (console msgid 3). | Add a favicon or `<link rel=icon>` (Deniz) |
| 8 | Form field | minor | Email input has no `id` or `name` (console issue msgid 2); hampers autofill. | Add `name="email"` and `autocomplete="email"` (Deniz) |
| 9 | Structured data | minor | 0 `script[type="application/ld+json"]` blocks. A pricing page could carry Product/Offer or SoftwareApplication markup, but the only visible price is "0" for the Free plan, so nothing should be authored until real plan data exists. | Hold; revisit with real plan data (Selin, `schema-markup-strategy`) |

Passing checks, with evidence: status code 200 on `/` (`curl.exe -sI`); `<html lang="en">`; exactly one H1 ("Choose a plan", no other headings in H1-H4 query); `meta[name=robots]` absent and no noindex header seen, so no indexing block; `meta[name=viewport]` returned no value in the script result (the key was omitted, so absent). That makes viewport a minor finding too: **no `<meta name="viewport">`**, so mobile rendering will use a desktop-width layout (Deniz). The table is fixed at `width:700px`, which compounds this; Emre's viewport audit covers the overflow.

Other items: images, 0 on the page (nothing to check); internal links, 0 (`document.links.length` = 0), so the page has no outbound or internal anchors; this is an orphan-risk and a dead end (Yavuz/Deniz). Rendering: raw HTML from `curl.exe` matches the DOM (static page, nothing client-rendered).

## 5. Priority action items

- Immediate: fix or remove `/missing.js` (Deniz); add canonical, description, viewport meta (Deniz, Kaan for copy).
- Optimisation: title rewrite, OG/Twitter tags, favicon, form field name, robots.txt and sitemap on production, internal links.

## 6. Not checked

INP (no interaction run), field data (none in CrUX), Lighthouse score (not run), contrast and accessibility (Emre's scope), any non-localhost behaviour, redirect chains (none seen: `/` answers 200 directly).

## Peer messages received

none (no message sent to Emre either; the findings above did not require his input).

## Open items

- Confirm the production origin so canonical, robots.txt and sitemap findings can be re-verified there.
- Lead: please mark task #2 status per your records; I set it in_progress and will mark it completed on delivery.
