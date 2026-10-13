import { test, expect } from "@playwright/test";

// Scratch exercise: written against hero.ts and HeroSection.tsx, not run.
test.describe("PetPal hero primary CTA", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the label, link target and a 48x48 touch target", async ({ page }) => {
    const cta = page.getByTestId("hero-primary-cta");

    await expect(cta).toBeVisible();
    await expect(cta).toHaveText("Find a sitter near you");
    await expect(cta).toHaveAttribute("href", "/search");

    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
  });

  test("pushes a cta_click event to the data layer on click", async ({ page }) => {
    const cta = page.getByTestId("hero-primary-cta");
    // Stop the anchor navigating so the data layer survives the click.
    await cta.evaluate((el) => el.addEventListener("click", (e) => e.preventDefault()));
    await cta.click();

    await expect
      .poll(() => page.evaluate(() => window.dataLayer ?? []))
      .toContainEqual({ event: "cta_click", cta: "hero-primary-cta" });
  });
});
