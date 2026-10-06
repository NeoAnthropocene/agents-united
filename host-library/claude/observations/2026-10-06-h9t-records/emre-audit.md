# QA Gate Report: http://localhost:4173/ (page title "Plan")

Auditor: Emre (QA automation lead). Tool used: `mcp__playwright__browser_*` (headless Chromium via Playwright MCP). chrome-devtools-mcp was not used. Verify-only: no page code was changed.

## Run Summary

- Target: `http://localhost:4173/` (single static page: h1, paragraph, 4-column pricing table, email input + Start button)
- Gate: **RED (blocked)**
- Rule used: any horizontal overflow at a required viewport (375x667, 768x1024, 1440x900), any failed 4xx/5xx request, any console error, or any WCAG 2.1 AA failure measured on the page blocks the gate. Four defects hit that rule directly (D1 overflow, D2 404 plus console error, D3 contrast, D4 missing label); D5 to D8 are non-blocking on their own.
- No automated test suite was run (no Playwright spec exists for this page); all results are live-page measurements. No flakiness check was possible with a single pass.

## Viewport matrix (overflow = documentElement.scrollWidth - clientWidth)

| Viewport | scrollWidth | clientWidth | Overflow (px) | Result | Screenshot |
|---|---|---|---|---|---|
| 375x667 | 708 | 375 | **333** | FAIL | `artifacts/viewport-375x667.png` |
| 768x1024 | 768 | 768 | 0 | pass | `artifacts/viewport-768x1024.png` |
| 1440x900 | 1440 | 1440 | 0 | pass | `artifacts/viewport-1440x900.png` |
| 320x640 (reflow check) | 708 | 320 | **388** | FAIL | none saved |

Cause (measured): the `table` is 700 px wide, its parent has `overflow-x: visible`, so it is not contained. At 768 the table (700) fits, which is why tablet passes.

## Accessibility (measured at 375x667)

| Check | Measured | Result |
|---|---|---|
| Text contrast, h1, th, td (black on white) | 21:1 | pass |
| Text contrast, `<p>` "Start free, upgrade any time." | rgb(153,153,153) on rgb(255,255,255), 16px: **2.85:1** (needs 4.5:1) | FAIL |
| Contrast, button label | rgb(0,0,0) on rgb(240,240,240): 18.43:1 | pass |
| Email input label | `labels.length` = 0, no `aria-label`; accessible name comes from `placeholder="Work email"` only | FAIL (no visible label) |
| Touch target, email input | 177 x 21 px | FAIL (below 44x44; also below the 24x24 minimum on height) |
| Touch target, Start button | 44.2 x 21 px | FAIL (same) |
| Keyboard order | Tab 1 = INPUT[type=email], Tab 2 = BUTTON[type=submit]; logical | pass |
| Focus indicator | both: `:focus-visible` true, `outline: auto 1px rgb(16,16,16)` (browser default, no custom style; the page has no `<style>` element). Present but thin; I did not measure its contrast against the page. | pass with note |
| Landmarks | no `<main>` element in the document | FAIL (project rule requires semantic HTML5) |
| `<html lang>` | `en` | pass |
| `meta[name=viewport]` | none (`null`) | FAIL (see D5) |

Not run: axe-core audit (not loaded on the page, and I did not inject third-party script), zoom at 200 percent, form submission (no form action or endpoint observed, not exercised), real mobile devices.

## Console and network

- Console (all levels, whole session): 2 errors, 0 warnings.
  - `Failed to load resource: the server responded with a status of 404 (File not found) @ http://localhost:4173/missing.js`
  - `Failed to load resource: the server responded with a status of 404 (File not found) @ http://localhost:4173/favicon.ico`
- Network (static resources included): 2 requests listed, `GET /` => 200, `GET /missing.js` => 404. The favicon 404 appears in the console but not in the network list. Playwright did not report timings, so no slow-request statement can be made.

## Discovered Issues and Resolutions

| ID | Severity | Location / selector | Evidence | Owner | Recommended fix |
|---|---|---|---|---|---|
| D1 | Critical (blocks) | `table` (700 px wide, parent `overflow-x: visible`) | 333 px horizontal overflow at 375, 388 px at 320 | Deniz (frontend) | Wrap the table in a container with `overflow-x: auto` (keyboard-focusable, labelled), or reflow to stacked rows below ~700 px |
| D2 | High (blocks) | `/missing.js` referenced by the page | 404 in network list and console | Deniz | Remove the reference or ship the file |
| D3 | High (blocks) | `<p>` "Start free, upgrade any time." | color rgb(153,153,153) on white = 2.85:1 | Deniz (colour), Jamileh (design token if the grey is a design value) | Darken to at least #767676 (4.54:1 on white) |
| D4 | High (blocks) | `input[type=email]` | no label, placeholder only (`labels.length` 0) | Deniz; Kaan for label copy | Add a visible `<label for>` "Work email" and an `id` on the input |
| D5 | Medium | `<head>` | no `meta[name=viewport]`; real phones will render at a ~980 px layout width, so the overflow in D1 is only measured under the emulated width here | Deniz | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| D6 | Medium | `input`, `button` | 177x21 and 44.2x21 px | Deniz | Min 44x44 px for both (padding or `min-height`) |
| D7 | Low | `/favicon.ico` | 404 console error | Deniz | Add a favicon or `<link rel="icon" href="data:,">` |
| D8 | Low | document | no `<main>` landmark | Deniz | Wrap content in `<main>` |

Note on D2: the absent network entry for the favicon and the 404 console entry come from the same tool session; I report both as observed.

## File Modifications

- Created `C:\github\scratch-pilot\h9t-provision\artifacts\viewport-375x667.png`
- Created `C:\github\scratch-pilot\h9t-provision\artifacts\viewport-768x1024.png`
- Created `C:\github\scratch-pilot\h9t-provision\artifacts\viewport-1440x900.png`
- Created `C:\github\scratch-pilot\h9t-provision\docs\h6\emre-audit.md`
- Playwright MCP also wrote snapshot and console logs under `.playwright-mcp\` (tool side effect, not mine to clean under my scope; flagged for the lead).

## Next Actions / Risks

- Deniz to fix D1 to D8, then I re-run the matrix. The gate stays red until D1 to D4 are closed.
- Risk: no automated spec exists; recommend a Playwright spec under `tests/e2e/` covering overflow at the three viewports plus 320, console-error and 404 checks, and an axe run at WCAG 2.1 AA. I will write it on the lead's go-ahead.
- Not verified: submit behaviour, axe results, zoom, real devices.

## Peer messages received

none

## Open items

- Lead to relay the defect list to Deniz (and D3 colour source to Jamileh, D4 label copy to Kaan).
- Lead decides whether `.playwright-mcp\` output should be cleaned or git-ignored (the working tree should stay clean).
- Lead to confirm whether I should write the Playwright regression spec.
