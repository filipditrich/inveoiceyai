import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Real UI actions write synthetic invoice/payment history only in disposable QA.
// Guards against wrong partial balances, unsafe cancellation, and lost reversals.
test.skip(
  process.env.INVOICEY_E2E_LOCAL_QA !== "1",
  "Requires disposable local QA.",
);

test("partial payment, settlement, reversal and cancellation preserve the invoice history", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Payment mutations require local HTTPS QA.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/invoices/new");
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill(`Payment lifecycle ${testInfo.project.name}`);
  await page.getByLabel("Price", { exact: true }).first().fill("1250");
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+(?:\?.*)?$/);
  const path = new URL(page.url()).pathname;
  const id = path.split("/").at(-1)!;
  const number = await page.locator("h1").innerText();

  await page.goto("/payments");
  await page.getByRole("button", { name: "Add payment", exact: true }).click();
  const payment = page.getByRole("dialog", {
    name: "Add a manual payment",
    exact: true,
  });
  await payment.getByLabel("Invoice", { exact: true }).selectOption(id);
  await payment.getByLabel("Amount", { exact: true }).fill("500");
  await payment
    .getByRole("button", { name: "Add payment", exact: true })
    .click();
  await expect(
    page.getByText("Payment recorded", { exact: true }),
  ).toBeVisible();
  await expect(payment).not.toBeVisible();

  await page.goto(path);
  const ledger = page.locator("#payment-ledger");
  const value = (label: string) =>
    ledger
      .locator("dl > div")
      .filter({
        has: page.locator("dt").filter({ hasText: new RegExp(`^${label}$`) }),
      })
      .locator("dd");
  await expect(value("State")).toHaveText("Partially paid");
  await expect(value("Allocated")).toHaveText("CZK 500.00");
  await expect(value("Outstanding")).toHaveText("CZK 750.00");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const cancellation = page.getByRole("dialog", {
    name: "Cancel this invoice?",
    exact: true,
  });
  await expect(
    cancellation.getByText(
      "Payments are allocated to this invoice. Reverse them first before it can be cancelled.",
    ),
  ).toBeVisible();
  await expect(
    cancellation.getByRole("button", {
      name: "Cancel invoice permanently",
      exact: true,
    }),
  ).toHaveCount(0);
  await cancellation
    .getByRole("button", { name: "Review payment ledger", exact: true })
    .click();
  await expect(cancellation).not.toBeVisible();
  await expect(page).toHaveURL(/#payment-ledger$/);

  await page.getByRole("button", { name: "Mark as paid", exact: true }).click();
  await expect(value("State")).toHaveText("Paid");
  await expect(value("Allocated")).toHaveText("CZK 1,250.00");
  await expect(value("Outstanding")).toHaveText("CZK 0.00");
  await expect(
    ledger.getByRole("button", { name: "Reverse", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Unmark paid", exact: true }).click();
  await expect(value("State")).toHaveText("Unpaid");
  await expect(value("Allocated")).toHaveText("CZK 0.00");
  await expect(value("Outstanding")).toHaveText("CZK 1,250.00");
  await expect(ledger.getByText(/Manual payment · Reversed/)).toHaveCount(2);
  await expect(
    ledger.getByRole("button", { name: "Reverse", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await cancellation
    .getByRole("button", { name: "Cancel invoice permanently", exact: true })
    .click();
  await expect(
    page.getByText(
      "This invoice remains in the accounting history as cancelled.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveText(number);
  await expect(
    page.getByRole("button", { name: "Mark as paid", exact: true }),
  ).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.reload();
  await expect(page.locator("h1")).toHaveText(number);
  await expect(
    page.getByText(
      "This invoice remains in the accounting history as cancelled.",
      { exact: true },
    ),
  ).toBeVisible();
});

// Cleaning a one-shot notification must not start an RSC navigation that can
// race the user's next page, as observed immediately after issuing on WebKit.
test("toast cleanup preserves unrelated URL state without fetching the page again", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (!origin.hostname.endsWith(".localhost"))
    throw new Error("Local QA only.");
  const cleanupRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.headers()["rsc"] === "1" &&
      url.pathname === "/dashboard" &&
      url.searchParams.has("keep") &&
      !url.searchParams.has("toast")
    )
      cleanupRequests.push(request.url());
  });
  await page.goto("/dashboard?toast=invoice_paid&keep=1#payment-test");
  await expect(page).toHaveURL(/\/dashboard\?keep=1#payment-test$/);
  expect(cleanupRequests).toEqual([]);
  await page.goto("/payments");
  await expect(page).toHaveURL(/\/payments$/);
  await expect(page.locator("h1")).toHaveText("Matching");
});

for (const role of ["viewer", "payment-reader"] as const) {
  test(`${role} sees only the payment details and controls their permissions allow`, async ({
    browser,
  }, testInfo) => {
    const origin = new URL(testInfo.project.use.baseURL!);
    if (!origin.hostname.endsWith(".localhost"))
      throw new Error("Local QA only.");
    const id = process.env.INVOICEY_E2E_SEEDED_INVOICE_ID;
    const state =
      role === "viewer"
        ? process.env.INVOICEY_E2E_VIEWER_AUTH_STATE
        : process.env.INVOICEY_E2E_PAYMENT_READER_AUTH_STATE;
    if (!id || !state)
      throw new Error(
        "Seed a partial invoice and restricted local sessions first.",
      );
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: state,
    });
    try {
      const page = await context.newPage();
      await page.goto(new URL(`/invoices/${id}`, origin).href);
      await expect(page.locator("h1")).toContainText(/^2026/);
      if (role === "viewer") {
        await expect(page.locator("#payment-ledger")).toHaveCount(0);
      } else {
        await expect(page.locator("#payment-ledger")).toBeVisible();
        await expect(
          page
            .locator("#payment-ledger")
            .getByText("CZK 500.00", { exact: true })
            .first(),
        ).toBeVisible();
      }
      await expect(
        page.getByRole("button", { name: "Mark as paid", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Unmark paid", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Reverse", exact: true }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
