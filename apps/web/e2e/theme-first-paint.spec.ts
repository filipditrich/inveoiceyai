import { expect, test } from "@playwright/test";

// A fresh visitor's server-rendered canvas used the light palette until the
// theme script ran, despite the product's defaultTheme being dark.
test.use({ javaScriptEnabled: false });

test("the initial server canvas already uses the default dark palette", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  const colors = await page.locator("body").evaluate((body) => {
    const style = getComputedStyle(body);
    const rgb = (color: string) =>
      color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
    return { canvas: rgb(style.backgroundColor), text: rgb(style.color) };
  });
  expect(colors.canvas).toHaveLength(3);
  expect(colors.text).toHaveLength(3);
  // The base canvas must be dark and the inherited body text must be light,
  // even before hydration or when scripts are blocked.
  for (const channel of colors.canvas) expect(channel).toBeLessThan(64);
  for (const channel of colors.text) expect(channel).toBeGreaterThan(200);
});
