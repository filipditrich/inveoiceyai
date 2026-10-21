import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`mobile docs shield navigation from scrolled text in ${theme} mode`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Sticky docs navigation is shown on phones.");
    await page.addInitScript((value) => {
      localStorage.setItem("invoicey-theme", value);
    }, theme);
    await page.goto("/docs/guides/issuers");
    await expect(page.locator("html")).toHaveClass(
      new RegExp(`\\b${theme}\\b`),
    );
    const consent = page.getByTestId("consent-banner-reject-button");
    await expect(consent).toBeVisible();
    await consent.click();
    await expect(consent).toBeHidden();
    await page
      .getByRole("heading", { name: /Logos, stamps and signatures/ })
      .scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(300);

    // A translucent sticky surface lets article text compete with its controls.
    const surfaces = page.locator("#nd-subnav, [data-toc-popover] > header");
    await expect(surfaces).toHaveCount(2);
    await expect
      .poll(() =>
        surfaces.evaluateAll((nodes) =>
          nodes.map((node) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d");
            if (!context) return null;
            context.fillStyle = getComputedStyle(node).backgroundColor;
            context.fillRect(0, 0, 1, 1);
            return context.getImageData(0, 0, 1, 1).data[3];
          }),
        ),
      )
      .toEqual([255, 255]);

    const contents = page.locator("[data-toc-popover-trigger]");
    await contents.click();
    await expect(contents).toHaveAttribute("aria-expanded", "true");
    await page
      .locator("[data-toc-popover-content]")
      .getByRole("link", { name: "Bank account", exact: true })
      .click();
    await expect(page).toHaveURL(/#bank-account$/);
    await expect(contents).toHaveAttribute("aria-expanded", "false");
  });
}
