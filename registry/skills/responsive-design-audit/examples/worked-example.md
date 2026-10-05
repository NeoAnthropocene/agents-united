# Worked example (invented results, for checking your own work)

A pricing page. Run it against the local build: `npx playwright test tests/responsive.spec.ts`.

## The spec

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

## The result

Mobile fails with an overflow of 38 px caused by the comparison table, which has no scroll container; tablet and desktop pass. At 320 px the billing toggle's icon buttons measure 20 by 20.

## The defects

- **D1**, S2, 375 px, `table.compare`, overflow 38 px, owner Deniz: add a scroll container.
- **D2**, S3, 320 px, `button.icon-toggle`, 20x20, owner Deniz (minimum size), with Jamileh to confirm the icon spacing.

Gate: **red** until D1 is fixed and the run repeated.
