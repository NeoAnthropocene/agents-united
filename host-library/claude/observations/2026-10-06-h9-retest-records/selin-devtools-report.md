# DevTools gate: http://localhost:4173/

Date: 2026-10-06. Author: Selin (agency-seo-specialist). Scope: this page only.

## Gate: RED

Reasons: 2 console errors on first load (1 on reload) and 2 HTTP 404 responses on first load (1 on reload). LCP and CLS pass.

## Tool calls used

1. `new_page` url=http://localhost:4173 (page 2)
2. `list_console_messages` and `list_network_requests` (first load)
3. `performance_start_trace` reload=true autoStop=true
4. `evaluate_script` (read-only DOM metadata read)
5. `performance_analyze_insight` RenderBlocking and LCPBreakdown (set NAVIGATION_0)
6. `list_console_messages` and `list_network_requests` (after the trace reload)

## 1. Console

First load:
```
msgid=1 [error] Failed to load resource: the server responded with a status of 404 (File not found)
msgid=2 [issue] A form field element should have an id or name attribute (count: 1)
msgid=3 [error] Failed to load resource: the server responded with a status of 404 (File not found)
```
After reload (trace reload):
```
msgid=4 [error] Failed to load resource: the server responded with a status of 404 (File not found)
msgid=5 [issue] A form field element should have an id or name attribute (count: 1)
```
Sources (matched from the network list): `/missing.js` and `/favicon.ico` (first load only; the favicon request did not recur on reload, likely cached as a failure by the browser).
The tool gives no stack trace or source URL in the console entry itself; the mapping is by the matching 404s below.

Issue (not error): a form field has no `id` or `name`. The tool does not say which element.

## 2. Network

First load:
```
reqid=1 GET http://localhost:4173/ [200]
reqid=2 GET http://localhost:4173/missing.js [404]
reqid=3 GET http://localhost:4173/favicon.ico [404]
```
After reload:
```
reqid=4 GET http://localhost:4173/ [200]
reqid=5 GET http://localhost:4173/missing.js [404]
```
`/missing.js` is a render-blocking script (Priority High, Render-blocking: Yes, 4 ms total, server `SimpleHTTP/0.6 Python/3.13.14`). The trace estimates no savings, but it is a broken resource on every load.

## 3. Performance trace (reload, 1x CPU, no network throttling)

```
LCP: 28 ms, element H1 (text, not fetched from network)
  TTFB: 1 ms; render delay: 26 ms
CLS: 0.00
CrUX field data: n/a (no data for this page)
Insights reported: LCPBreakdown, RenderBlocking
```
- LCPBreakdown: no savings; LCP is text, 94.6 percent render delay (26 ms).
- RenderBlocking: only `/missing.js` (404); no savings estimated.
- Thresholds: LCP 28 ms < 2.5 s PASS; CLS 0.00 < 0.1 PASS. This is a single local lab run, not a 75th-percentile field value. INP was not measured (no interaction in the trace) and is not a gate criterion here.

## 4. Notes from the DOM (not gate criteria)

```
title: "Plan" (4 chars; below the 50-60 target)
meta description: absent
canonical: absent
og:* tags: none
meta viewport: absent
h1 count: 1
html lang: en
scripts: http://localhost:4173/missing.js
```
- Missing viewport meta is a mobile-rendering risk; emre's responsive checks should confirm.
- Title, description, canonical and OG tags are absent; the page is indexable by default (no robots meta found in the read, which did not check headers or robots.txt).

## Recommendations (owner: site/ author, not applied by me)

1. Remove the `<script src="missing.js">` reference or add the file (critical for the gate; clears one console error, one 404 and the render-blocking request).
2. Add a favicon or `<link rel="icon" href="data:,">` (clears the second 404).
3. Give the form field an `id` or `name` (clears the console issue).
4. Add `<meta name="viewport" content="width=device-width, initial-scale=1">`, a 50-60 character title, a 120-155 character description and a self-referential canonical.
5. Re-run this gate after the fixes; the expected result is GREEN.

## Peer messages

None sent, none received.
