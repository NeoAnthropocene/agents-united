# Selin: chrome-devtools-mcp check of http://localhost:4173

Date: 2026-10-06. Scope: this page only (page title "Plan"), no web research, no `site/` edits. Server header: `SimpleHTTP/0.6 Python/3.13.14`.

## Verdict

Not clean. One real defect: the page requests `/missing.js`, which returns 404 and is render-blocking. Core Web Vitals in the lab are fine (LCP 31 ms, CLS 0.00). One minor form-field issue is flagged by Chrome.

## Console messages (list_console_messages, after navigation)

| msgid | type | text | source |
|---|---|---|---|
| 1 | error | Failed to load resource: the server responded with a status of 404 (File not found) | not reported by the tool (0 args, no stack) |
| 2 | issue | A form field element should have an id or name attribute (count: 1) | DevTools Issues panel |
| 3 | error | Failed to load resource: the server responded with a status of 404 (File not found) | not reported by the tool (0 args, no stack) |

Console shows 2 errors and 1 issue; no warnings. The tool gave no URL for the 404s. The network list after the traced reload shows only one 404 (below). I did not identify the URL behind the second 404; it may be the same `/missing.js` from the first load, or a different resource (for example a favicon request). Unconfirmed.

## Network (after reload)

```
reqid=4 GET http://localhost:4173/            [200]
reqid=5 GET http://localhost:4173/missing.js  [404]
```

## Performance trace (performance_start_trace, reload, autoStop; available and worked)

Settings: CPU throttling 1x, network throttling none, localhost, so lab numbers are optimistic. CrUX field data: none for this page.

| Metric | Value | Threshold (p75) | Result |
|---|---|---|---|
| LCP | 31 ms (TTFB 0.9 ms, render delay 30 ms) | 2.5 s | good |
| CLS | 0.00 | 0.1 | good |
| INP | not measured (no interaction performed) | 200 ms | n/a |

Insights returned: LCPBreakdown, RenderBlocking.

RenderBlocking detail (performance_analyze_insight):
- `http://localhost:4173/missing.js`: status 404, MIME text/html, priority High, render-blocking Yes, queued 4 ms, complete 8 ms (4 ms total), initiator `http://localhost:4173/`. Estimated savings: none.

## Findings and recommendations (owner: Deniz, the site/ owner; I made no code changes)

1. Major: `/missing.js` 404 and render-blocking. Remove the `<script src="/missing.js">` reference from the page, or ship the file. If it must stay, add `defer` so it cannot block rendering. Whether this reference is intentional test bait is unknown to me.
2. Minor: a form field has neither `id` nor `name`. This hurts autofill and label association. Add `id`/`name` and a matching `<label for>`. I did not inspect which element it is.
3. Minor: confirm the second 404 source. Add a favicon or `<link rel="icon" href="data:,">` if it is `/favicon.ico`.

## Limits

- Localhost lab run only, one trace; not a 75th-percentile judgment.
- INP not exercised; no throttled run.
- No SEO checks (metadata, canonical, schema) were in scope.
