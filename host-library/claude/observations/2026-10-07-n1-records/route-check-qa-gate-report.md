# QA Gate Report: http://localhost:4173/ (Emre, 2026-10-07)

## Run Summary

Gate: **RED (blocked)**. Source under test: `site/index.html` (read only). Tool: Playwright MCP, one tab. Not run: axe-core (see Open items; not installed locally and out of scope to fetch), so the a11y findings below are manual and computed checks.

Checks run: 3 viewports, 1 contrast, 1 label, 1 console, 1 network. Failed: 5 of the 7 checks (overflow at 375, contrast, label, console, network). Flaky: 0.

## Viewport matrix

| Viewport | documentElement overflow (scrollWidth - clientWidth) | body overflow | Status | Screenshot |
|---|---|---|---|---|
| 375x667 | 333 px (scrollWidth 708, clientWidth 375) | 341 px | FAIL | artifacts/vp-375.png |
| 768x1024 | 0 px | 0 px | PASS | artifacts/vp-768.png |
| 1440x900 | 0 px | 0 px | PASS | artifacts/vp-1440.png |

Offending elements at 375: `table` (style width:700px, right edge 708), with its `tbody`, both `tr`, and the `th`/`td` cells in columns Support (right 705) and Seats (right 428).

## Test Suite Breakdown

| Suite | Tests | Status | Viewport |
|---|---|---|---|
| Overflow | 3 | 2 pass, 1 fail | 375 / 768 / 1440 |
| Contrast (computed) | 1 | FAIL | 1440 |
| Form label | 1 | FAIL | 1440 |
| Console errors | 1 | FAIL (2 errors) | 1440 |
| Network 4xx/5xx | 1 | FAIL (1 request) | 1440 |
| axe-core WCAG 2.1 AA | 0 | NOT RUN | n/a |

## Discovered Issues

| ID | Severity | Defect | Selector | Measured | Viewport | Owner |
|---|---|---|---|---|---|---|
| D1 | High | Horizontal overflow; fixed-width table | `table[style*="width:700px"]` | 333 px (doc), 341 px (body) | 375 | Deniz (fix: max-width:100% or an overflow-x wrapper, responsive table) |
| D2 | High | Low contrast text | `p` ("Start free, upgrade any time.") color #999999 on #ffffff, 16px/400 | 2.85:1, needs 4.5:1 (WCAG 1.4.3) | all | Deniz (darken to #767676 or darker) |
| D3 | High | Email input has no accessible name: no label, no aria-label, no id/name; placeholder only | `form > input[type=email]` | labels.length 0 (WCAG 1.3.1, 3.3.2, 4.1.2) | all | Deniz / Kaan (add a visible `<label>`, name, autocomplete="email", required) |
| D4 | High | Failed script request, console error | `<script src="/missing.js">` | GET /missing.js 404 | all | Deniz (remove or restore the script) |
| D5 | Medium | Missing favicon, console error | `/favicon.ico` | 404 (console only; not in the Playwright request list) | all | Deniz / Selin |
| D6 | Medium | No viewport meta | `head` | `meta[name=viewport]` absent | mobile | Deniz (contributes to D1 on real devices) |
| D7 | Medium | No landmarks (`main` etc.); table has no `caption` and `th` have no `scope` | `body`, `table` | 0 landmarks, 4 `th` with scope "" | all | Deniz |
| D8 | Medium | Touch targets under 44x44 | `button` 44x21, `input` 177x21 | height 21 px | all | Deniz |
| D9 | Low | Form has no action or handler, so submit goes nowhere; no validation or error state | `form` | action null | all | Kaan |

Console log (evidence): `.playwright-mcp/console-2026-10-07T09-04-55-541Z.log`.

## Gate

RED: overflow of 333 px at 375 (rule: any overflow > 0), two console errors, one failed request. Axe could not be run, so the "no critical or serious axe violation" criterion is unverified rather than passed. Manual findings D2 and D3 would map to serious axe rules (color-contrast, label).

Re-run after fixes: all three viewports, console, network, then axe.
