# QA Gate Report: http://localhost:4173 (Emre)

Date: 2026-10-06. Source: `site/index.html` (one static page).

## 1. Run Summary

**Gate: RED (blocked).**

Rule: red if any of these hold: horizontal overflow > 0 px at a required viewport; any control without an accessible name; text contrast below 4.5:1 (3:1 large); any console error or 4xx/5xx response; any critical/serious axe violation. Anything not run is unverified, never green.

Tool path: `mcp__playwright` and `mcp__chrome-devtools-mcp` were not available (ToolSearch found no deferred browser tools). Fallback per lead: a Node script (built-in `WebSocket`, no install, no download) driving the installed Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`, headless) over local CDP port 9333. Script is in the session scratchpad (`audit.mjs`), not in the project.

Checks: 5 viewport measurements (3 required + 2 extra mobile-emulation), 1 console/network load, 1 accessibility pass. Failed: 4 checks (375 overflow, console, network, contrast). Flaky: 0 observed (single run each; no reruns performed, so flakiness is unassessed). Duration: about 10 s.

## 2. Test Suite Breakdown

| Suite / Journey | Tests | Status | Viewport |
|---|---|---|---|
| Horizontal overflow | 1 | FAIL, 333 px | 375x667 |
| Horizontal overflow | 1 | PASS, 0 px | 768x1024 |
| Horizontal overflow | 1 | PASS, 0 px | 1440x900 |
| Mobile emulation (extra, `mobile:true`, no viewport meta) | 2 | 375: 1 px (layout viewport 980, page renders shrunk); 768: 0 px | 375x667, 768x1024 |
| Console errors | 1 | FAIL, 1 error | 1440x900 |
| Network 4xx/5xx | 1 | FAIL, 1 response | 1440x900 |
| Accessibility: contrast | 1 | FAIL | all |
| Accessibility: labels / names | 1 | PARTIAL (see D4) | all |
| Axe WCAG 2.1 AA audit | 0 | UNVERIFIED: axe-core not available offline | n/a |
| Keyboard / focus order / form submission behaviour | 0 | NOT RUN (outside the requested scope) | n/a |

Overflow in px (scrollWidth minus clientWidth, non-mobile emulation, the primary measure): 375 = 333, 768 = 0, 1440 = 0.

Screenshots (project root `artifacts/`):
- `artifacts/viewport-375x667.png`
- `artifacts/viewport-768x1024.png`
- `artifacts/viewport-1440x900.png`
- extra: `artifacts/viewport-375x667-mobile-emulation.png`, `artifacts/viewport-768x1024-mobile-emulation.png`

## 3. Discovered Issues and Resolutions

| # | Defect | Selector / location | Measured value | Evidence | Severity | Owner | Proposed fix |
|---|---|---|---|---|---|---|---|
| D1 | Horizontal overflow at 375 px | `table` (inline `style="width:700px"`, `site/index.html:7`) | table right edge 708 px vs clientWidth 375; overflow 333 px | `viewport-375x667.png`; offenders: table, tbody, tr, th, td | High (blocks gate) | Deniz | Replace fixed width with `width:100%; max-width:700px`, or wrap in `overflow-x:auto` container |
| D2 | Missing script returns 404, logged as console error | `<script src="/missing.js">` (`site/index.html:3`) | HTTP 404 on `http://localhost:4173/missing.js`; console: "Failed to load resource: the server responded with a status of 404 (File not found)"; request aborted (`net::ERR_ABORTED`) | CDP Log.entryAdded + Network.responseReceived | High (blocks gate) | Deniz | Remove the tag or ship the file |
| D3 | Insufficient text contrast | `p` ("Start free, upgrade any time.", `color:#999999` on white, `site/index.html:6`) | 2.85:1; required 4.5:1 (16 px normal text); WCAG 1.4.3 | computed-style contrast script | High (blocks gate) | Deniz | Use at most `#767676` (4.54:1); darker preferred |
| D4 | Email input has no visible label, name comes from placeholder only | `form > input[type=email]` (`site/index.html:8`) | `labels` = 0, no aria-label/labelledby; AX name "Work email" from placeholder | CDP AX tree nameSources = placeholder | Medium; not counted in the gate because Chrome does expose a name. Fails WCAG 3.3.2 / 1.3.1 best practice, since the hint disappears on input | Deniz | Add `<label for>` or visible label plus `id` on the input |
| D5 | No viewport meta | `<head>` | `meta[name=viewport]` absent; with mobile emulation at 375 the layout viewport is 980 px, so the page renders shrunk | `viewport-375x667-mobile-emulation.png` (innerWidth 981) | Medium | Deniz | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` (note: this makes D1 visible on real phones, so fix D1 first) |
| D6 | Submit button touch target small | `form > button` | 44 x 21 px (guideline 44x44 pt / 48x48 dp), input height 21 px | DOM rects | Medium | Deniz | Pad controls to at least 44 px high |
| D7 | No landmark or table semantics | page | no `<main>`; table has no `<caption>` | DOM query | Low | Deniz | Wrap content in `<main>`, add caption |

Not found: unlabeled button (the button has a name "Start"), `lang` missing (it is `en`), page `<title>` missing (it is "Plan", though a more descriptive title is advisable).

## Resolution status

None applied. This role verifies and does not patch another specialist's code. Re-run the same script after D1 to D3 are fixed; gate turns green only if overflow, console, network and contrast all pass and axe is run (or the lead accepts a labelled partial accessibility check).

## Peer messages received

Lead only: consultation (read-only), then assignment, then the go-ahead to deliver. No peer messages.

## Open items

- Axe audit is unverified: no axe-core available offline and installing was not approved. Provide a local copy of `axe.min.js` (or approve an install) to complete it.
- Keyboard and focus-ring check not run (not in scope); recommend adding.
- Single run only: flakiness not assessed.
- Task #2 status: TaskGet/TaskUpdate were not loaded by me; leaving task status to the lead.
- Selin's console/trace findings should be cross-checked against D2 (relayed by the lead).
