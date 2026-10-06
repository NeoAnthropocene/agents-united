# QA Gate Report: http://localhost:4173 (Emre)

Gate: **RED (blocked)**

## Run Summary
Target: http://localhost:4173/ (title "Plan", lang="en"). Tooling: Playwright MCP only. Date: 2026-10-06.
Checks: overflow (3 viewports), a11y/contrast, console, network. Failed checks: overflow @375, contrast, form label, console, network. Passed: overflow @768 and @1440, h1/heading order, alt (no images). No flaky tests (no test suite; live-page inspection).

## Viewport results
| Viewport | scrollWidth | clientWidth | Overflow px | Offenders | Screenshot |
|---|---|---|---|---|---|
| 375x667 | 708 | 375 | **333** | table (700px wide, right edge 708), tbody, tr, th/td | artifacts/emre-375x667.png |
| 768x1024 | 768 | 768 | 0 | none | artifacts/emre-768x1024.png |
| 1440x900 | 1440 | 1440 | 0 | none | artifacts/emre-1440x900.png |

All three screenshot files exist (10712, 14450, 15962 bytes).

## Defects
| ID | Viewport | Selector | Measured | WCAG | Severity | Owner | Evidence |
|---|---|---|---|---|---|---|---|
| D1 | 375x667 | `table[style="width:700px"]` | 333px horizontal overflow; table 700px in 375px viewport | 1.4.10 Reflow (AA) | High | Deniz (frontend) | evaluate output; emre-375x667.png |
| D2 | all | `p[style="color:#999999"]` ("Start free, upgrade any time.") | contrast 2.85:1 on #fff, 16px normal text, needs 4.5:1 | 1.4.3 Contrast (AA) | High | Deniz | computed styles |
| D3 | all | `form > input[type=email]` | no label, no aria-label, no id; only placeholder "Work email" | 1.3.1, 3.3.2, 4.1.2 (A/AA) | High | Deniz / Kaan (form) | ctrls audit: hasLabel=false |
| D4 | all | `GET /missing.js` | HTTP 404; console error | n/a | High | Deniz | network list; console log |
| D5 | all | `GET /favicon.ico` | HTTP 404; console error (not in the network list, present in console) | n/a | Low | Deniz | console log |
| D6 | all | document structure | no landmarks (no main/header/nav/footer, no role); content not in `<main>` | 1.3.1 / best practice (bypass blocks 2.4.1 relevant) | Medium | Deniz | landmarks list empty |
| D7 | 375x667 | `<head>` | no `meta[name=viewport]` found (query returned undefined); a real mobile device would render at desktop width | 1.4.4/1.4.10 related | Medium | Deniz | evaluate output. Caveat: not reproducible in desktop Chromium emulation |
| D8 | all | `table` | no `<caption>`, header cells lack `scope`; layout also uses inline `width:700px` | 1.3.1 | Low | Deniz | page HTML |

Passing: single h1 "Choose a plan", no heading skips; zero images (no alt issues); button "Start" has an accessible name; h1, table, and button text contrast 18.4:1 to 21:1. Not verified: keyboard focus ring visibility, touch target sizes (44px), screen reader behaviour, axe-core run (not available through these tools).

## Console and network
- Console: 2 errors (404 missing.js, 404 favicon.ico), 0 warnings.
- Network: 2 requests; `/` 200, `/missing.js` 404.

## Tool calls used (Playwright MCP)
browser_navigate, browser_console_messages, browser_network_requests, browser_resize (x3), browser_evaluate (x3: overflow, overflow, overflow+a11y+contrast), browser_take_screenshot (x3). No npx or shell browser.

## Gate decision
RED. Criteria for GREEN are zero overflow at all viewports (failed at 375: 333px), no AA failures (D2, D3 fail), no console errors (2), no 4xx (404 missing.js).

## Next Actions / Risks
- Deniz to fix D1 (responsive table or max-width:100%/overflow-x wrapper), D2 (colour at least #767676 on white), D3 (add label), D4 (remove or fix missing.js reference), D6, D7, D8. Re-run the gate after fixes.
- Run an axe-core pass once available; this audit was manual and not exhaustive.

## Peer messages received
none (no message sent to Selin; carried on independently. Console 404s may be cross-checked against docs/h6/selin-devtools-report.md).

## Open items
- Task #1 status: set to completed by me after this report (task tools available).
- Confirm D7 against the served HTML source, since the evaluate result omitted the viewport meta rather than showing null.
