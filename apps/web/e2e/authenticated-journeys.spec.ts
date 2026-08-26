import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The test-only Better Auth/session bootstrap writes this storage state.  It is
// deliberately opt-in so a generic checkout never receives an auth bypass.
const enabled = Boolean(process.env.INVOICEY_E2E_AUTH_STORAGE_STATE);
// Session storage authenticates only; this explicit ID binds the detail test
// to a deterministic, pre-seeded issued invoice without creating any data.
const seededInvoiceId = process.env.INVOICEY_E2E_SEEDED_INVOICE_ID;
const routes = ["/invoices/new", "/payments", "/dashboard"];

async function navigateWithSidebar(
  page: import("@playwright/test").Page,
  href: string,
) {
  const link = page.locator(`a[data-sidebar="menu-button"][href="${href}"]`);
  if (!(await link.isVisible())) {
    await page.locator('[data-sidebar="trigger"]').click();
  }
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href.replace("/", "\\/")}$`));
}

test.describe("authenticated production journeys", () => {
  test.skip(
    !enabled,
    "Set INVOICEY_E2E_AUTH_STORAGE_STATE from the existing test-only session bootstrap.",
  );

  for (const route of routes) {
    test(`${route} has landmarks, one primary heading, and no horizontal overflow`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        ),
      ).toBe(false);
    });
  }

  test("an initialized workspace redirects welcome to the dashboard", async ({
    page,
  }) => {
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("h1")).toHaveCount(1);
  });

  test("sidebar navigation reaches invoices and payments", async ({ page }) => {
    await page.goto("/dashboard");
    await navigateWithSidebar(page, "/invoices");
    await navigateWithSidebar(page, "/payments");
  });

  test("a seeded invoice exposes lifecycle guidance and blocks invalid email without sending", async ({
    page,
  }) => {
    test.skip(
      !seededInvoiceId,
      "Set INVOICEY_E2E_SEEDED_INVOICE_ID to a seeded issued invoice in the authenticated workspace.",
    );

    await page.goto("/invoices");
    const invoiceLink = page
      .locator(`main a[href="/invoices/${seededInvoiceId}"]:visible`)
      .first();
    await expect(invoiceLink).toBeVisible();
    await invoiceLink.click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${seededInvoiceId}$`));
    await expect(
      page.getByRole("heading", {
        name: /invoice lifecycle|životní cyklus faktury/i,
      }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /send by email|odeslat e-mailem/i })
      .click();
    await page
      .getByRole("textbox", { name: /^To$|^Komu$/i })
      .fill("invalid-recipient");
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^send$|^odeslat$/i }),
    ).toBeDisabled();
  });

  test("representative authenticated pages have no serious axe violation", async ({
    page,
  }) => {
    for (const route of ["/invoices/new", "/payments"]) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations.filter(
          (item) => item.impact === "serious" || item.impact === "critical",
        ),
      ).toEqual([]);
    }
  });

  test("structured builder recovery and line controls remain local and non-destructive", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    const description = page.getByLabel(/description|popis/i).first();
    await description.fill("Recovered local line");
    await expect(
      page.getByText(/saved in this browser session|uložený v této relaci/i),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(
        /^Recovered an unsaved local draft\.$|^Obnovili jsme neuložený místní návrh\.$/i,
      ),
    ).toBeVisible();
    await expect(page.getByLabel(/description|popis/i).first()).toHaveValue(
      "Recovered local line",
    );

    await page
      .getByRole("button", { name: /add (line|row)|přidat.*polož/i })
      .click();
    const duplicate = page
      .getByRole("button", { name: /duplicate line|duplikovat položku/i })
      .last();
    await duplicate.click();
    const remove = page
      .getByRole("button", { name: /remove line|odebrat položku/i })
      .last();
    await remove.click();

    await page
      .getByLabel(/description|popis/i)
      .first()
      .fill("");
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+S" : "Control+S",
    );
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/invoices\/new/);
  });
});
