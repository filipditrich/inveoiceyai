import { expect, test } from "@playwright/test";

// Explicitly opt into synthetic drafts in the disposable local QA workspace.
test.skip(
  process.env.INVOICEY_E2E_LOCAL_QA !== "1",
  "Requires disposable local QA.",
);

test.beforeEach(async ({ context }, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Storage QA requires local HTTPS.");
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: origin.origin },
  ]);
});

for (const failure of ["getter", "read", "write"] as const) {
  test(`${failure} failure leaves the invoice editable and permits explicit saving`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((failure) => {
      if (failure === "getter") {
        Object.defineProperty(window, "sessionStorage", {
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
      } else if (failure === "read") {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the original receiver below.
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (this === window.sessionStorage)
            throw new DOMException("Blocked", "SecurityError");
          return getItem.call(this, key);
        };
      } else {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the original receiver below.
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === window.sessionStorage)
            throw new DOMException("Full", "QuotaExceededError");
          return setItem.call(this, key, value);
        };
      }
    }, failure);
    await page.goto("/invoices/new");
    const description = page.getByLabel("Description", { exact: true }).first();
    const work = `Storage QA ${failure} ${testInfo.project.name}`;
    await description.fill(work);
    await page.getByLabel("Price", { exact: true }).first().fill("1250");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Local draft recovery is unavailable" }),
    ).toBeVisible();
    await expect(description).toHaveValue(work);
    if (failure === "getter") {
      await page
        .getByRole("status")
        .filter({ hasText: "Local draft recovery is unavailable" })
        .scrollIntoViewIfNeeded();
      await testInfo.attach("recovery-unavailable", {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    }
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+\/edit/);
    await expect
      .poll(() => new URL(page.url()).searchParams.has("toast"))
      .toBe(false);
    await expect
      .poll(() => new URL(page.url()).searchParams.has("recoveryAttempt"))
      .toBe(false);
    await page.reload();
    await expect(description).toHaveValue(work);
    expect(errors).toEqual([]);
  });
}

test("a refused recovery deletion does not discard the visible invoice", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/invoices/new");
  const description = page.getByLabel("Description", { exact: true }).first();
  await description.fill("Keep this recovered work");
  await expect(
    page.getByText("Unsaved draft saved in this browser session.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Recovered an unsaved local draft.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the original receiver below.
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (this === window.sessionStorage)
        throw new DOMException("Blocked", "SecurityError");
      return removeItem.call(this, key);
    };
  });
  await page
    .getByRole("button", { name: "Discard recovered draft", exact: true })
    .click();
  await expect(description).toHaveValue("Keep this recovered work");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Local draft recovery is unavailable" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Czech recovery guidance keeps the editor usable when storage is blocked", async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "cs", url: testInfo.project.use.baseURL! },
  ]);
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/invoices/new");
  const description = page.getByLabel("Popis", { exact: true }).first();
  await description.fill("Práce bez místního obnovení");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Místní obnovení konceptu není" }),
  ).toBeVisible();
  await expect(description).toHaveValue("Práce bez místního obnovení");
});
