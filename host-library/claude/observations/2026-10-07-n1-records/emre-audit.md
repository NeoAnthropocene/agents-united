# QA gate: http://localhost:4173 (Emre)

Date: 2026-10-07. Method: Playwright browser tools only (resize, reload, evaluate, console, network). Nothing installed, nothing fixed.

## Gate: RED

Rule: RED if any overflow > 0 px, any missing label, any contrast failure, any console error, or any request >= 400. Tripped: overflow (D1), missing label (D2), contrast (D3), console errors and a 404 request (D4, D5).

## Viewport matrix

| Viewport | Overflow (scrollWidth - clientWidth) | Widest offender | Screenshot |
|---|---|---|---|
| 375x667 | 333 px (scrollWidth 708) | `table` (right edge 708), `th`/`tr`/`tbody` at 705 | artifacts/h6-375x667.png |
| 768x1024 | 0 px | none | artifacts/h6-768x1024.png |
| 1440x900 | 0 px | none | artifacts/h6-1440x900.png |

## Defects

| ID | Check | Selector / URL | Evidence | Severity |
|---|---|---|---|---|
| D1 | Viewport overflow | `table` (inline `style="width:700px"`) | 375 px viewport: scrollWidth 708 vs clientWidth 375, 333 px horizontal scroll | High |
| D2 | A11y: form control without label | `form > input[type=email]` | No `<label>`, `aria-label`, `aria-labelledby` or `title`; only `placeholder="Work email"` | High |
| D3 | A11y: contrast | `p` ("Start free, upgrade any time.", inline `color:#999999`) | rgb(153,153,153) on rgb(255,255,255) = 2.85:1, needs 4.5:1 (16 px, not large) | High |
| D4 | Console error / network 404 | `http://localhost:4173/missing.js` | Console: "Failed to load resource: 404 (File not found)"; network: GET => 404 | High |
| D5 | Console error / network 404 | `http://localhost:4173/favicon.ico` | Console 404 on first load (browser auto request; not listed in the network log after reload) | Low |

## Check results

- Images without alt: 0 images on the page.
- Buttons and links without a name: 0 (`button[type=submit]` "Start" is named; no links).
- Contrast: 1 failing text node out of all text nodes checked (D3). Computed with WCAG relative luminance, alpha-composited over ancestor backgrounds; large-text threshold 24 px, or 18.66 px bold.
- Console (all levels, whole session): 0 warnings, errors are the 404s in D4 and D5 only. missing.js appears once per load.
- Network (static included): 2 requests, GET / => 200, GET /missing.js => 404. No failed requests other than the 404.

## Not checked / caveats

- Contrast was measured on computed colours only; no images or gradients exist on the page.
- Keyboard order, focus visibility and touch-target size were not in scope for this run. The submit button and email input sizes were not measured.
- The `html` element has no `lang` check in this run; not assessed.
- Form submission behaviour not exercised (no backend scope given).
