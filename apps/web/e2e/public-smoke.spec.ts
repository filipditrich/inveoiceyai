import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/brand",
  "/privacy",
  "/terms",
  "/cookies",
  "/docs",
];

function relativeLuminance(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: number[], background: number[]) {
  const luminance = (rgb: number[]) =>
    0.2126 * relativeLuminance(rgb[0]!) +
    0.7152 * relativeLuminance(rgb[1]!) +
    0.0722 * relativeLuminance(rgb[2]!);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

test.describe("public platform", () => {
  test("a fresh visitor receives the dark Invoicey canvas and geometric mark", async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.removeItem("invoicey-theme");
    });
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("button", { name: /appearance|vzhled/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /invoicey/i }).first(),
    ).toBeVisible();
    await expect(
      page.locator('img[src*="/brand/invoicey-lockup"]').first(),
    ).toBeVisible();
  });

  test("light primary text and actions retain WCAG AA contrast", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => {
      localStorage.setItem("invoicey-theme", "light");
    });
    await page.goto("/");

    const colors = await page.evaluate(() => {
      const toRgb = (value: string) => value.match(/\d+/g)?.map(Number) ?? null;
      const action = Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="button"]'),
      ).find((control) => control.classList.contains("bg-primary"));
      const sample = document.createElement("span");
      sample.className = "text-primary";
      sample.textContent = "Invoicey";
      const card = document.createElement("div");
      card.className = "bg-card";
      card.append(sample);
      document.body.append(card);
      const result = {
        actionBackground: action
          ? toRgb(getComputedStyle(action).backgroundColor)
          : null,
        actionForeground: action ? toRgb(getComputedStyle(action).color) : null,
        canvasBackground: toRgb(
          getComputedStyle(document.body).backgroundColor,
        ),
        cardBackground: toRgb(getComputedStyle(card).backgroundColor),
        textForeground: toRgb(getComputedStyle(sample).color),
      };
      card.remove();

      return result;
    });

    await expect(page.locator("html")).toHaveClass(/light/);
    expect(colors).not.toBeNull();
    expect(colors!.textForeground).not.toBeNull();
    expect(colors!.canvasBackground).not.toBeNull();
    expect(colors!.cardBackground).not.toBeNull();
    expect(colors!.actionForeground).not.toBeNull();
    expect(colors!.actionBackground).not.toBeNull();
    expect(
      contrastRatio(colors!.textForeground!, colors!.canvasBackground!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(colors!.textForeground!, colors!.cardBackground!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(colors!.actionForeground!, colors!.actionBackground!),
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("dark primary actions retain WCAG AA contrast", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      localStorage.setItem("invoicey-theme", "dark");
    });
    await page.goto("/");
    const colors = await page
      .locator('[data-slot="button"]')
      .evaluateAll((controls) => {
        const primary = controls.find(
          (control) =>
            getComputedStyle(control).backgroundColor === "rgb(249, 115, 22)",
        );
        if (!primary) return null;

        const color = getComputedStyle(primary).color.match(/\d+/g);
        const background =
          getComputedStyle(primary).backgroundColor.match(/\d+/g);
        return color && background
          ? { background: background.map(Number), color: color.map(Number) }
          : null;
      });

    expect(colors).not.toBeNull();
    expect(
      contrastRatio(colors!.color, colors!.background),
    ).toBeGreaterThanOrEqual(4.5);
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route} exposes one public landmark without horizontal overflow`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.ok()).toBe(true);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
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

  test("docs chrome links to the marketing homepage and the CLI and Drive guides", async ({
    page,
  }) => {
    await page.goto("/docs");
    await expect(
      page.getByRole("link", { name: "Home", exact: true }),
    ).toHaveAttribute("href", "/");
    await page.goto("/docs/integrations/cli");
    await expect(page.getByRole("heading", { name: "CLI" })).toBeVisible();
    await page.goto("/docs/integrations/invoicey-drive");
    await expect(
      page.getByRole("heading", { name: "Invoicey Drive" }),
    ).toBeVisible();
  });

  test("auth shell pages expose one level-one heading", async ({ page }) => {
    await page.goto("/r/invalid");
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("locale cookie controls document language", async ({
    context,
    page,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (!baseURL) {
      throw new Error("The public test project must provide a base URL.");
    }
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en",
        url: new URL("/", baseURL).toString(),
      },
    ]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("public page has no serious accessibility violations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
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
