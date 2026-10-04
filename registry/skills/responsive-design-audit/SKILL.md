---
name: responsive-design-audit
description: "Verify that a page holds across the viewport matrix: no horizontal scroll, reflow at 320 px, touch targets, text that survives zoom, stable layout shift, with a Playwright check, screenshots as evidence, and defects routed to their owners."
metadata:
  author: agents-united
  version: 3.0.0
  icon: 📱
disable-slash-command: true
---

# Responsive Design Audit

## Overview & Purpose
A page can look right at the width the designer used and break at the three widths people actually use. This skill gives the QA lead a short, repeatable check across the viewport matrix, with evidence a developer can act on. It verifies and reports; it does not patch another specialist's layout (the role contract says to report a defect through the lead).

## Execution Triggers
Load it for any change to layout, navigation, images, tables or typography, before sign-off of a page, and when a user reports "broken on my phone". Do not use it for visual taste (that is a design review) or for performance (use `debug-optimize-lcp`).

## Input/Output Requirements
Inputs: the URL or route and how to start the app, the design frames for comparison, the breakpoints the product uses, the list of the key journeys on the page, and whether an authenticated state is needed (credentials are the lead's to provide; never invent or request real secrets).

Outputs: a table of viewport against result; a screenshot per viewport; the list of defects, each with the viewport, the selector or region, the measured value, severity and owner; and the gate status. **Evidence to attach**: screenshots saved under `artifacts/`, the measured overflow in pixels, the failing selectors, and the Playwright run output.

## Step-by-Step Runbook
1. **Fix the matrix.** Mobile 375 by 667, tablet 768 by 1024, desktop 1440 by 900 (the role's standard), plus a 320 px wide check for reflow. Add the product's own breakpoints (just below and just above each) when they exist.
2. **Run the horizontal-scroll check at each width.** The page must not scroll sideways: `document.documentElement.scrollWidth` must not exceed `window.innerWidth`. A fixed-width table or image wider than the viewport is the usual cause; content that must be wide (a data table) scrolls inside its own container.
3. **Check reflow at 320 CSS pixels** (equivalent to 400 percent zoom on a 1280 px screen): content reads in one column with no two-dimensional scrolling, apart from content that needs it such as maps and data tables.
4. **Check touch targets** on the narrower viewports. Interactive elements should measure at least 44 by 44 CSS pixels; below 24 by 24 is a failure of the current WCAG level AA target-size criterion unless spacing compensates. Report the measured size.
5. **Check text and zoom.** Increase browser text size to 200 percent: nothing may be clipped or overlap; do not rely on fixed heights for text containers.
6. **Check layout stability.** Reserve space for images and embeds (width and height or an aspect ratio); look for content that jumps as it loads.
7. **Check the key journeys** at mobile width with the touch viewport: open the menu, fill the form, submit, reach the confirmation. A layout that looks right but cannot be operated fails.
8. **Collect evidence and hand off the defects.** Screenshot every viewport. Layout and component defects go to Deniz; a design that cannot work at a width goes to Jamileh; copy that overflows its container goes to Kaan. Do not fix them yourself. Report through the lead.

## Code & Config Exemplars
### Worked example
A pricing page (invented results). Run: `npx playwright test tests/responsive.spec.ts` against the local build.

```ts
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'reflow-320', width: 320, height: 640 },
];

for (const v of viewports) {
  test(`no horizontal scroll and usable targets at ${v.name}`, async ({ page }) => {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.goto('/pricing');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow at ${v.name}`).toBeLessThanOrEqual(0);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')]
        .map((el) => ({ el: el.tagName + (el.id ? '#' + el.id : ''), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
        .map(({ el, r }) => `${el} ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(small, `targets under 24x24 at ${v.name}`).toEqual([]);
    await page.screenshot({ path: `artifacts/pricing-${v.name}.png`, fullPage: true });
  });
}
```

Result: mobile fails with an overflow of 38 px caused by the comparison table (no scroll container) and tablet and desktop pass; at 320 px the billing toggle's icon buttons measure 20 by 20. Defects: D1, S2, 375 px, `table.compare`, overflow 38 px, owner Deniz (add a scroll container); D2, S3, 320 px, `button.icon-toggle`, 20x20, owner Deniz (min size) with Jamileh to confirm the icon spacing. Gate: **red** until D1 is fixed and the run repeated.

### Anti-patterns
- Resizing the desktop browser by hand and calling it a mobile test.
- Testing only the three standard widths and never 320.
- A pass reported from the DevTools device toolbar alone with no saved evidence.
- Fixing the CSS yourself and reporting green.
- Fixed sleeps instead of waiting for the page to settle.
- Judging a layout without operating the key journey.

## Edge Cases & Error Recovery
- **The app cannot start or the route needs a login you do not have**: stop, report the exact blocker and what you did not test; do not use real credentials or work around the login.
- **Intentional horizontal scroll inside a component**: allowed if it is contained, keyboard operable and announced; record it as an exception.
- **A flaky layout measurement** (late-loading fonts or images): wait for the page's load state and fonts, re-run once, and report both results if they differ.
- **Cannot reproduce a user's report**: ask for their device, browser and zoom; test that exact configuration.
- **A headless browser cannot represent a real phone** (virtual keyboard, safe areas): say so; do not claim a mobile pass beyond what was measured.

## Verification Checklist
- [ ] The matrix includes 375, 768, 1440 and a 320 px reflow check, plus the product's breakpoints.
- [ ] Horizontal overflow was measured in pixels at every width.
- [ ] Touch target sizes were measured and the failures listed with their selectors.
- [ ] A screenshot per viewport is saved and referenced.
- [ ] Each defect has a severity, an owner and a proposed fix; none was patched by this role.
- [ ] The report states what was not tested (devices, authenticated states, real browsers).
