# Worked example (invented results, for checking your own work)

A signup page in three states: empty, validation error, success.

## The automated check

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('signup has no critical or serious axe violations', async ({ page }) => {
  await page.goto('/signup');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
});
```

## The findings

| Id | WCAG | Severity | Location | Evidence | Owner | Fix |
|---|---|---|---|---|---|---|
| A1 | 1.3.1 / 4.1.2 | serious (axe `label`) | `input#company` | axe results, 1 node | Deniz | add a `label`; a placeholder is not a label |
| A2 | 1.4.3 | serious (axe `color-contrast`) | `.helper` text, 3.9 to 1 | axe results, screenshot | Jamileh | use the darker muted token |
| A3 | 2.1.2 | manual: keyboard trap | cookie dialog: Tab cycles inside, Escape does nothing | keyboard path notes | Deniz | Escape closes and returns focus |
| A4 | 3.3.1 | manual: error not announced | the email error appears but there is no live region | recording | Deniz | `role="alert"` on the error container |

Gate: **red** (A1 and A2 are serious).

## What was not checked

The screen reader announcement of the error, the authenticated dashboard, Safari. Defne is told only that a legal-risk question exists if the client sells in a regulated sector.
