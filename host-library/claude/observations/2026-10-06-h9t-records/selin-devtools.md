# DevTools check: http://localhost:4173/

Tool: chrome-devtools-mcp (navigate_page, list_console_messages, get_console_message, list_network_requests, performance_start_trace, performance_analyze_insight). Date of run: 2026-10-06. Page title: "Plan". Server header: `SimpleHTTP/0.6 Python/3.13.14`. Recommendations only; nothing was patched.

## Console messages (3)

| msgid | Type | Text | Source |
|---|---|---|---|
| 1 | error | Failed to load resource: the server responded with a status of 404 (File not found) | `GET /missing.js` (network reqid=2) |
| 2 | issue | A form field element should have an id or name attribute (count: 1) | form field, violatingNodeId=3 |
| 3 | error | Failed to load resource: the server responded with a status of 404 (File not found) | `GET /favicon.ico` (network reqid=3) |

Console warnings: none. The two 404 messages carry no URL in the console text; I matched them to requests by the network list (only two 404s exist: `/missing.js` and `/favicon.ico`). That mapping is an inference from ordering and the request list, not stated by the console.

## Network (3 requests)

- reqid=1 GET `/` 200
- reqid=2 GET `/missing.js` 404
- reqid=3 GET `/favicon.ico` 404

## Performance trace (reload, no CPU or network throttling)

| Metric | Value | Source |
|---|---|---|
| LCP | 41 ms | trace summary, LCP element is the H1 (text, not fetched) |
| LCP TTFB | 1 ms | LCPBreakdown |
| LCP render delay | 39 ms | LCPBreakdown (96.7% of LCP) |
| CLS | 0.00 | trace summary |
| INP | not measured | a load trace records no interaction |
| Field data (CrUX) | n/a | no data for this page |

These are single lab runs on localhost, so they say nothing about the 75th-percentile thresholds. They show no LCP or CLS problem.

Insight RenderBlocking: `/missing.js` was render-blocking (priority High, 404, text/html, protocol http/1.0, download 2 ms, total 4 ms). Estimated savings: none.

## Findings

1. **Broken script reference `/missing.js`. Severity: major.** The page requests a script that returns 404, and it is flagged render-blocking. The cost here is 4 ms, but the reference is dead, and on a real host a slow 404 in the head would delay first paint. Fix: remove the `<script src="/missing.js">` tag, or ship the file. Owner: Deniz (page code).
2. **No favicon, `/favicon.ico` 404. Severity: minor.** Produces a console error on every load and a wasted request. Fix: add a favicon and a `<link rel="icon">`, or an inline data-URI icon. Owner: Deniz.
3. **Form field without `id` or `name`. Severity: minor.** Chrome reports one field (node 3) that may break autofill and label association. Fix: add a unique `id` and `name` (and a matching `<label for>`). Owner: Deniz.
4. **Performance: no issue. Severity: none.** LCP 41 ms and CLS 0.00 on this run; no insight reports savings.

## Not checked

- SEO metadata, robots, sitemap and structured data were outside this task's scope.
- No throttled run and no repeated runs, so no variance is reported.

## Fix order

1. Remove or supply `/missing.js` (clears one console error and the render-blocking flag).
2. Add a favicon (clears the second console error).
3. Add `id`/`name` to the form field (clears the issue message).
