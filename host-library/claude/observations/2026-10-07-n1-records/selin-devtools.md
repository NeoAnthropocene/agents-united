# DevTools console and trace: http://localhost:4173/

Date: 2026-10-07. Tool: chrome-devtools MCP plugin. Page title: "Plan". Server: SimpleHTTP/0.6 Python/3.13.14 (HTTP/1.0).

## Console (initial load, then again after the trace reload)

| Level | Message | Source |
|---|---|---|
| error | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:4173/missing.js (render-blocking script) |
| error | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:4173/favicon.ico (seen on first load only; not repeated after the reload) |
| issue | A form field element should have an id or name attribute (count 1; violatingNodeId 2) | an input or form field in the document; autofill impact only |

Warnings: none. Uncaught exceptions: none. get_console_message gave no stack trace or URL for the 404s; the URLs come from the network list.

## Network

| reqid | Request | Status |
|---|---|---|
| 1 | GET / | 200 |
| 2 | GET /missing.js | 404 |
| 3 | GET /favicon.ico | 404 |

## Performance trace (reload, CPU 1x, no network throttling)

| Metric | Value |
|---|---|
| LCP | 43 ms (element: H1, text, not fetched from the network) |
| LCP TTFB | 1 ms (3.0%) |
| LCP render delay | 42 ms (97.0%) |
| CLS | 0.00 |
| Field data (CrUX) | n/a, no data for this page |
| INP | not measured (no interaction in a load trace) |

Insights:
- LCPBreakdown: estimated savings none.
- RenderBlocking: one blocking request, http://localhost:4173/missing.js. Queued 4 ms, sent 5 ms, complete 8 ms, 4 ms total, status 404, MIME text/html, priority High. Estimated savings none.

Lab numbers are from a localhost server, so they say nothing about production latency.

## Per-check status

| Check | Status | Evidence |
|---|---|---|
| Console errors | FAIL | 2 errors (404 for /missing.js and /favicon.ico) |
| Console warnings | PASS | none |
| Console issues | FAIL (minor) | form field has no id or name |
| LCP (threshold 2.5 s) | PASS | 43 ms |
| CLS (threshold 0.1) | PASS | 0.00 |
| Render-blocking requests | FAIL (minor) | /missing.js is blocking; it is a 404 |
| Trace availability | PASS | trace ran with reload, no errors |

## Recommendations (nothing was changed)

1. Remove the `<script src="/missing.js">` reference, or ship the file (owner: whoever owns site/, with Deniz for the render path). It is the only render-blocking request and it returns a 404.
2. Add a favicon, or a `<link rel="icon" href="data:,">`, to stop the 404 (same owner).
3. Add an `id` or `name` to the form field (same owner).
