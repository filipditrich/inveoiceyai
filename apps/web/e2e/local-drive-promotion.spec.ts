import { expect, test } from "@playwright/test";

// A failed optional dismissal preference must never crash an issued invoice page.
test.skip(
  process.env.INVOICEY_E2E_LOCAL_QA !== "1",
  "Requires disposable local QA.",
);
const invoiceId = process.env.INVOICEY_E2E_SEEDED_INVOICE_ID;
test.beforeEach(async ({ baseURL }) => {
  const origin = new URL(baseURL!);
  if (!origin.hostname.endsWith(".localhost") || origin.protocol !== "https:")
    throw new Error("Local HTTPS QA only.");
  if (!invoiceId) throw new Error("Seed an issued local invoice first.");
});

for (const failure of ["getter", "read", "write"] as const) {
  test(`issued invoice remains usable when local preference storage fails at ${failure}`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((mode) => {
      const key = "invoicey-drive-banner-dismissed";
      if (mode === "getter") {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
      } else if (mode === "read") {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the original storage receiver below.
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (name) {
          if (name === key) throw new DOMException("Blocked", "SecurityError");
          return getItem.call(this, name);
        };
      } else {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the original storage receiver below.
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key)
            throw new DOMException("Full", "QuotaExceededError");
          return setItem.call(this, name, value);
        };
      }
    }, failure);
    await page.goto(`/invoices/${invoiceId}`);
    await expect(
      page.getByRole("heading", { name: "Invoice lifecycle", exact: true }),
    ).toBeVisible();
    const promotion = page
      .locator('[role="note"]')
      .filter({ hasText: "Keep a Finder copy on your Mac" });
    if (testInfo.project.name === "mobile-chromium") {
      await expect(promotion).toHaveCount(1);
      await expect(promotion).not.toBeVisible();
    } else {
      await expect(promotion).toBeVisible();
      await promotion
        .getByRole("button", { name: "Dismiss", exact: true })
        .click();
      await expect(promotion).not.toBeVisible();
    }
    await expect(
      page.locator(`a[href="/api/invoices/${invoiceId}/pdf"]`),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Invoice lifecycle", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("desktop dismissal persists across reload while phones keep the invoice first", async ({
  page,
}, testInfo) => {
  await page.goto(`/invoices/${invoiceId}`);
  const promotion = page
    .locator('[role="note"]')
    .filter({ hasText: "Keep a Finder copy on your Mac" });
  if (testInfo.project.name === "mobile-chromium") {
    await expect(promotion).toHaveCount(1);
    await expect(promotion).not.toBeVisible();
    await testInfo.attach("invoice-without-desktop-promotion", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  } else {
    await expect(promotion).toBeVisible();
    await promotion
      .getByRole("button", { name: "Dismiss", exact: true })
      .click();
    await expect(promotion).not.toBeVisible();
    expect(
      await page.evaluate(() =>
        window.localStorage.getItem("invoicey-drive-banner-dismissed"),
      ),
    ).toBe("1");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(promotion).not.toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Invoice lifecycle", exact: true }),
  ).toBeVisible();
});
