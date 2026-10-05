---
name: responsive-design-audit
description: "Use when layout, navigation, images, tables or typography change, before sign-off of a page, or when a user reports it is broken on their phone; trigger phrases: test the page on mobile, is it responsive, check the viewports, horizontal scroll on phone, touch targets too small, broken on my phone. Produces a viewport-by-result table, a screenshot per viewport, defects with viewport, selector, measured value, severity and owner, and the gate status. Skip it for visual taste (a design review) and for performance (use debug-optimize-lcp)."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📱
disable-slash-command: true
---

# Responsive Design Audit

A page can look right at the width the designer used and break at the widths people actually use. This is a short, repeatable check across the viewport matrix, with evidence a developer can act on.

## Overview & Purpose
The QA lead's check. It verifies and reports; it does not patch another specialist's layout (the role contract: report a defect through the lead).

## Execution Triggers
Load it for any change to layout, navigation, images, tables or typography, before sign-off of a page, and when a user reports "broken on my phone". Do not use it for visual taste (a design review) or for performance (`debug-optimize-lcp`).

## Input/Output Requirements
Inputs: the URL or route and how to start the app; the design frames to compare; the breakpoints the product uses; the key journeys on the page; whether an authenticated state is needed (credentials are the lead's to provide; never invent or request real secrets).

Output: a table of viewport against result; a screenshot per viewport; the defects, each with viewport, selector or region, measured value, severity and owner; the gate status. **Evidence to attach**: screenshots under `artifacts/`, the measured overflow in pixels, the failing selectors, the Playwright run output.

## Step-by-Step Runbook
1. **Fix the matrix**: mobile 375 by 667, tablet 768 by 1024, desktop 1440 by 900, a 320 px reflow check, and the product's own breakpoints (just below and above each). Detail: [references/viewport-matrix.md](references/viewport-matrix.md).
2. **Run the horizontal-scroll check at each width**: `document.documentElement.scrollWidth` must not exceed `window.innerWidth`. A fixed-width table or image is the usual cause; content that must be wide (a data table) scrolls inside its own container.
3. **Check reflow at 320 CSS pixels** (400 percent zoom on a 1280 px screen): one column and no two-dimensional scrolling, apart from content that needs it (maps, data tables).
4. **Check touch targets** on the narrower viewports: at least 44 by 44 CSS pixels; below 24 by 24 fails the WCAG AA target-size criterion unless spacing compensates. Report the measured size.
5. **Check text and zoom**: at 200 percent text size nothing clips or overlaps; no fixed heights on text containers.
6. **Check layout stability**: reserve space for images and embeds (width and height or an aspect ratio) and look for content that jumps as it loads.
7. **Operate the key journeys** at mobile width with the touch viewport: open the menu, fill the form, submit, reach the confirmation. A layout that looks right but cannot be operated fails.
8. **Collect evidence and hand off.** A screenshot of every viewport. Layout and component defects to Deniz; a design that cannot work at a width to Jamileh; copy that overflows its container to Kaan. Do not fix them yourself; report through the lead.

## Code & Config Exemplars
Load [examples/worked-example.md](examples/worked-example.md) for a Playwright spec (matrix, overflow and target checks, screenshots) and the defect list it produced on a pricing page.

Anti-patterns, each with its reason:
- Resizing the desktop window by hand and calling it a mobile test: nothing was measured.
- Only the three standard widths, never 320: reflow failures hide there.
- A pass from the DevTools toolbar with no saved evidence: nobody can check it.
- Fixing the CSS yourself and reporting green: the report is no longer independent.
- Fixed sleeps instead of waiting for the page to settle: the result is flaky.
- Judging a layout without operating the key journey: it may look right and not work.

## Edge Cases & Error Recovery
- **The app will not start, or the route needs a login you lack**: stop, report the exact blocker and what you did not test; use no real credentials and work around nothing.
- **Intentional horizontal scroll inside a component**: allowed if contained, keyboard operable and announced; record it as an exception.
- **A flaky measurement** (late fonts or images): wait for the load state and fonts, re-run once, report both results if they differ.
- **Cannot reproduce a user's report**: ask for their device, browser and zoom; test that exact configuration.
- **A headless browser is not a real phone** (virtual keyboard, safe areas): say so; claim no mobile pass beyond what was measured.

## Verification Checklist
- [ ] The matrix includes 375, 768, 1440 and a 320 px reflow check, plus the product's breakpoints.
- [ ] Horizontal overflow was measured in pixels at every width.
- [ ] Touch target sizes were measured and the failures listed with their selectors.
- [ ] A screenshot per viewport is saved and referenced.
- [ ] Each defect has a severity, an owner and a proposed fix; none was patched by this role.
- [ ] The report states what was not tested (devices, authenticated states, real browsers).
