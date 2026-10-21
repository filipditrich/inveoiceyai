import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Guards against issuance losing line data, broken document routes, and blank phone previews.
// Financial state changes are restricted to the disposable local QA server.
test.skip(
  process.env.INVOICEY_E2E_LOCAL_QA !== "1",
  "Requires disposable local QA.",
);

test("issuing preserves invoice content and delivers readable documents on desktop and phone", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Invoice issuance QA must use local HTTPS.");
  await page.goto("/invoices/new");
  const description = `Issued document QA ${testInfo.project.name}`;
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill(description);
  await page.getByLabel("Price", { exact: true }).first().fill("1250");
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+(?:\?.*)?$/);
  await expect(
    page.getByRole("heading", { name: "Invoice lifecycle", exact: true }),
  ).toBeVisible();
  await expect(
    testInfo.project.name === "mobile-chromium"
      ? page.locator("main li p").filter({ hasText: description })
      : page.getByRole("cell", { name: description, exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.reload();
  await expect(
    testInfo.project.name === "mobile-chromium"
      ? page.locator("main li p").filter({ hasText: description })
      : page.getByRole("cell", { name: description, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Issue", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    ),
  ).toBe(false);
  if (testInfo.project.name === "mobile-chromium") {
    await expect(
      page.locator('[data-slot="pdf-preview-compact"]'),
    ).toBeVisible();
    await expect(page.locator('iframe[data-slot="pdf-frame"]')).toHaveCount(0);
  } else {
    await expect(page.locator('iframe[data-slot="pdf-frame"]')).toBeVisible();
  }
  const pdf = await page.request.get(`/api/invoices/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect(pdf.headers()["content-disposition"]).toMatch(/^attachment;.*\.pdf/);
  expect(pdf.headers()["x-frame-options"]).toBe("DENY");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const inline = await page.request.get(
    `/api/invoices/${id}/pdf?disposition=inline`,
  );
  expect(inline.status()).toBe(200);
  expect(inline.headers()["content-disposition"]).toMatch(/^inline;/);
  expect(inline.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(inline.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'self'",
  );
  const isdoc = await page.request.get(`/api/invoices/${id}/isdoc`);
  expect(isdoc.status()).toBe(200);
  expect(isdoc.headers()["content-disposition"]).toMatch(
    /^attachment;.*\.isdoc/,
  );
  const xml = await isdoc.text();
  expect(xml).toContain(description);
  expect(xml).toContain("Mobile QA Studio");
  expect(xml).toMatch(
    /<TaxInclusiveAmount>1250(?:\.00)?<\/TaxInclusiveAmount>/,
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await testInfo.attach("issued-invoice", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
