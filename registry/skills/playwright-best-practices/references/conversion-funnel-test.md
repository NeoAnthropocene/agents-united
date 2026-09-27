# Production Playwright Test Exemplar — Conversion Funnel

> Extracted verbatim from `registry/agents/subagent-qa-automation-lead.md` per Plan 025
> Objective 4 (code exemplars live in the skill, not the specialist body). Consulted by
> `subagent-qa-automation-lead` via its Skill Consultation Map.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Marketing Campaign Conversion Funnel & Attribution E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Inject dataLayer spy before page scripts load
    await page.addInitScript(() => {
      window.dataLayer = window.dataLayer || [];
    });
  });

  test('should complete lead capture funnel and dispatch tracking events', async ({ page }) => {
    // 1. Navigate to campaign landing page
    await page.goto('/campaign/launch');
    await expect(page).toHaveTitle(/Acme AI/i);

    // 2. Assert hero headline and CTA visibility
    const heroCta = page.getByRole('button', { name: /Claim Early Access/i });
    await expect(heroCta).toBeVisible();

    // 3. Click Hero CTA to scroll or open lead modal
    await heroCta.click();

    // 4. Validate form input rejection on invalid data
    const emailInput = page.getByLabel(/Business Email/i);
    const submitBtn = page.getByRole('button', { name: /Get Started/i });

    await emailInput.fill('invalid-email-format');
    await submitBtn.click();
    await expect(page.getByText(/Please enter a valid business email/i)).toBeVisible();

    // 5. Fill valid lead data
    await emailInput.fill('lead@example.com');
    const nameInput = page.getByLabel(/Full Name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('Alex Rivera');
    }

    // Intercept conversion API endpoint
    await page.route('**/api/leads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, leadId: 'test-lead-123' }),
      });
    });

    // 6. Submit lead form
    await submitBtn.click();

    // 7. Assert success state
    await expect(page.getByText(/Thank you! Your invite is on its way/i)).toBeVisible();

    // 8. Assert analytics event dispatch on dataLayer
    const dataLayerEvents = await page.evaluate(() => window.dataLayer);
    const leadEvent = dataLayerEvents.find((evt: any) => evt.event === 'generate_lead');
    expect(leadEvent).toBeDefined();
    expect(leadEvent).toMatchObject({
      event: 'generate_lead',
      form_id: 'campaign-launch-hero',
    });
  });

  test('responsive viewport checks — mobile menu and CTA', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/campaign/launch');

    // Assert mobile navigation and sticky CTA
    const stickyCta = page.getByTestId('mobile-sticky-cta');
    await expect(stickyCta).toBeVisible();
  });
});
```
