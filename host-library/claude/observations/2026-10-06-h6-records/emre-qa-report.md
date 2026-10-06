# Emre QA report: http://localhost:4173

Gate: **RED (blocked)**

Tool: Playwright (headless Chromium) via MCP, plus curl for status codes. Source of the page (full DOM, 367 bytes body): `<h1>`, `<p style="color:#999999">`, `<table style="width:700px">` (1 data row), `<form><input type="email" placeholder="Work email"><button>Start</button></form>`, `<script src="/missing.js">`.

## Viewport matrix

| Viewport | scrollWidth | clientWidth | Overflow (px) | Result | Screenshot |
|---|---|---|---|---|---|
| 375x667 | 708 | 375 | **333** | FAIL | artifacts/emre-375x667-2026-10-06T09-23-23-318Z.png |
| 768x1024 | 768 | 768 | 0 | pass | artifacts/emre-768x1024-2026-10-06T09-23-33-174Z.png |
| 1440x900 | 1440 | 1440 | 0 | pass | artifacts/emre-1440x900-2026-10-06T09-23-37-895Z.png |

## Defects

| ID | Sev | Selector | Measured | Evidence | Owner |
|---|---|---|---|---|---|
| D1 | High | `table` (inline `style="width:700px"`) | width 700px in a 375px viewport; page overflows 333px (right edge 708). Widest children: `th`/`td` right edge 705 | scrollWidth 708 vs clientWidth 375; screenshot 375 | Deniz (layout) |
| D2 | High | `<head>` (no `meta[name=viewport]`) | `viewportMeta: false` | DOM query | Deniz |
| D3 | High | `input[type=email]` | no `<label>`, no `aria-label`/`aria-labelledby` (labels: 0, aria-label: null); placeholder is the only name. WCAG 1.3.1, 3.3.2, 4.1.2 | DOM query | Deniz / Kaan (form) |
| D4 | High | `p` ("Start free, upgrade any time.") | color rgb(153,153,153) on white (body bg transparent, canvas white), 16px normal weight: contrast **2.85:1**, needs 4.5:1. WCAG 1.4.3. Computed by hand from the sRGB formula, not by an axe run | computed style | Deniz / design |
| D5 | Medium | `input`, `button` | input 177x21px, button 44x21px. Height 21px is below the 24x24 WCAG 2.2 minimum (2.5.8) and the 44px project rule. Same at all viewports | getBoundingClientRect | Deniz |
| D6 | Medium | document, no `main`/`nav`/`header`/`footer` | landmarks: 0; no `<main>`. WCAG 1.3.1 / best practice (bypass blocks 2.4.1) | DOM query | Deniz |
| D7 | Medium | `script[src="/missing.js"]` | GET /missing.js returns 404; console error "Failed to load resource: 404 (File not found)" | console log; `curl` status 404 | Deniz |
| D8 | Low | `table` | no `<caption>`, no `th[scope]` (thScope: 0) | DOM query | Deniz |
| D9 | Low | `<title>` | "Plan" is vague and does not describe the page ("Choose a plan") | DOM | Selin / Kaan |
| D10 | Low | `/favicon.ico` | 404 from direct curl; not requested in the page console log, informational | curl | Deniz |

## Other checks

- Focus: the input shows the browser default outline (`auto 1px`), so a focus indicator exists. Tab order was not exercised beyond that.
- `lang="en"` present. One `h1`, no heading skips.
- Alt text: no `img` elements, not applicable.
- Console: 1 error (the 404 from D7), 0 exceptions, 0 warnings.
- Network: `/` 200, `/missing.js` 404 (the only failure). No 5xx.

## Not tested

- 320px reflow check, 200% text zoom, real mobile devices or virtual keyboard.
- Form submission: the form has no `action` and no handler; a submit was not attempted, and there is no confirmation path to assert.
- Full axe-core audit (contrast was computed manually; other rules checked by DOM query only).
- Non-Chromium browsers. Selin's chrome-devtools-mcp results were not read (no reply awaited).

## Gate reasoning

RED: horizontal overflow of 333px at 375px, an unlabelled email field, 2.85:1 text contrast, a 404 console error, and no viewport meta. Verification only; no site code was changed, `site/` untouched.
