import { expect, test } from "@playwright/test";

import { GENERATOR_DRAFT_KEY } from "../lib/generator/draft-recovery";

declare global {
  interface Window {
    invoiceyQrCanvasCalls: number;
  }
}

test.beforeEach(async ({ context }, testInfo) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: testInfo.project.use.baseURL! },
  ]);
});

async function prepareEditor(page: import("@playwright/test").Page) {
  await page.route("**/api/generator/ares/**", (route) =>
    route.fulfill({ status: 404, json: { ok: false } }),
  );
  await page.goto("/free-invoice-generator");
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toBeAttached();
  const edit = page.getByRole("button", { name: "Tap to edit", exact: true });
  if (await edit.isVisible()) await edit.click();
}

// Production bug: changes unrelated to payment data re-encoded the same QR
// on every keystroke, adding canvas work and another React update.
test("description edits reuse the payment QR while an amount edit refreshes it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.invoiceyQrCanvasCalls = 0;
    // oxlint-disable-next-line typescript/unbound-method -- apply below supplies the canvas receiver.
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (
      ...args: Parameters<HTMLCanvasElement["toDataURL"]>
    ) {
      window.invoiceyQrCanvasCalls++;
      return toDataURL.apply(this, args);
    };
  });
  await prepareEditor(page);
  const qr = page.locator('[data-look-block="qr"] img');
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/u);
  const originalQr = await qr.getAttribute("src");
  await page.evaluate(() => {
    window.invoiceyQrCanvasCalls = 0;
  });
  const description = page.getByRole("textbox", {
    name: "DESCRIPTION",
    exact: true,
  });
  await description.fill("Measured description");
  await description.pressSequentially(" edit", { delay: 25 });
  await description.blur();
  await expect
    .poll(() =>
      page.evaluate((key) => sessionStorage.getItem(key), GENERATOR_DRAFT_KEY),
    )
    .toContain("Measured description edit");
  expect(await page.evaluate(() => window.invoiceyQrCanvasCalls)).toBe(0);
  expect(await qr.getAttribute("src")).toBe(originalQr);
  await page
    .getByRole("textbox", { name: "UNIT PRICE", exact: true })
    .fill("9000");
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/u);
  await expect.poll(() => qr.getAttribute("src")).not.toBe(originalQr);
  expect(
    await page.evaluate(() => window.invoiceyQrCanvasCalls),
  ).toBeGreaterThan(0);
});

// Production bug: a rejected canvas encoding escaped as an unhandled promise
// rejection, instead of leaving the editable invoice without an optional QR.
test("blocked QR canvas leaves invoice edits usable without a page exception", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.invoiceyQrCanvasCalls = 0;
    HTMLCanvasElement.prototype.toDataURL = function () {
      window.invoiceyQrCanvasCalls++;
      throw new DOMException("Canvas blocked", "SecurityError");
    };
  });
  await prepareEditor(page);
  await expect
    .poll(() => page.evaluate(() => window.invoiceyQrCanvasCalls))
    .toBeGreaterThan(0);
  const description = page.getByRole("textbox", {
    name: "DESCRIPTION",
    exact: true,
  });
  await description.fill("Invoice without a canvas");
  await description.blur();
  await expect
    .poll(() =>
      page.evaluate((key) => sessionStorage.getItem(key), GENERATOR_DRAFT_KEY),
    )
    .toContain("Invoice without a canvas");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(description).toHaveValue("Invoice without a canvas");
  await expect(page.locator('[data-look-block="qr"] img')).toHaveCount(0);
  expect(errors).toEqual([]);
});
