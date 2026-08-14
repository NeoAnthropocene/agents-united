---
name: playwright-best-practices
description: Playwright E2E browser automation standards, Page Object Models, auto-waiting locators, test fixtures, and visual regression.
metadata:
  author: "Currents / Microsoft (currents-dev/playwright-best-practices-skill)"
  version: "1.0.0"
  source: "https://skills.sh/currents-dev/playwright-best-practices-skill/playwright-best-practices"
---

# Playwright E2E Testing Best Practices Playbook

## Overview & Purpose
`playwright-best-practices` provides authoritative guidelines for building fast, stable, and deterministic end-to-end browser tests using Microsoft Playwright.

## Rules & Constraints
1. **Use User-Facing Locators** — Always prefer `page.getByRole()`, `page.getByLabel()`, or `page.getByPlaceholder()` over fragile CSS classes or XPath.
2. **Never Use Hardcoded Sleeps** — Never invoke `page.waitForTimeout()`; use web assertions that auto-wait (`await expect(locator).toBeVisible()`).
3. **Encapsulate with Page Object Models (POM)** — Structure reusable page interactions into dedicated POM classes.
4. **Isolate Test State** — Run tests in independent browser contexts with dedicated user sessions or `test.use({ storageState })`.

## Step-by-Step Execution Runbook

### Phase 1 — Test Configuration
- Configure `playwright.config.ts` with parallel workers, trace recording (`on-first-retry`), and multi-project browser configs.

### Phase 2 — Page Object & Spec Construction
- Author POM classes with explicit methods returning locators or executing user actions.
- Write readable, assertive test specs covering positive and negative edge cases.

### Phase 3 — Verification
- Execute tests headlessly via `npx playwright test` and verify HTML report generation.

## Verification Checklist
- [ ] Tests run deterministically without flakes.
- [ ] Trace viewer and video artifacts saved on failure.
- [ ] No hardcoded sleep timeouts in test code.
