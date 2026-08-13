import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/privacy", "/terms", "/cookies", "/docs"];

test.describe("public platform", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.ok()).toBe(true);
      await expect(page.locator("body")).toBeVisible();
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows).toBe(false);
    });
  }

  test("English docs expose an English main landmark", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator('main[lang="en"]')).toHaveCount(1);
  });

  test("auth shell pages expose one level-one heading", async ({ page }) => {
    await page.goto("/r/invalid");
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("locale cookie controls document language", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: "http://localhost:3000" },
    ]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("public page has no serious accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious).toEqual([]);
  });

  test("responses carry baseline browser hardening headers", async ({
    request,
  }) => {
    const response = await request.get("/");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["content-security-policy-report-only"]).toContain(
      "default-src 'self'",
    );
  });
});
