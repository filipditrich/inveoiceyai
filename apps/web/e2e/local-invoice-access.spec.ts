import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.INVOICEY_E2E_LOCAL_QA !== "1",
  "Requires disposable local QA.",
);
test.beforeEach(async ({ baseURL }) => {
  const origin = new URL(baseURL!);
  if (!origin.hostname.endsWith(".localhost") || origin.protocol !== "https:")
    throw new Error("Local HTTPS QA only.");
});

async function createDraft(page: Page, description: string) {
  await page.goto("/invoices/new");
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill(description);
  await page.getByLabel("Price", { exact: true }).first().fill("1250");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+\/edit(?:\?.*)?$/);
  return new URL(page.url()).pathname.replace(/\/edit$/, "");
}

for (const state of ["draft", "issued", "cancelled"] as const) {
  // Regression: invoice detail exposed mutation controls to read-only roles.
  test(`viewer can read a ${state} invoice without unavailable action controls`, async ({
    page,
    browser,
  }, testInfo) => {
    const viewer = process.env.INVOICEY_E2E_VIEWER_AUTH_STATE;
    if (!viewer) throw new Error("Seed the local viewer session first.");
    const description = `Read-only ${state} ${testInfo.project.name}`;
    const path = await createDraft(page, description);
    await page.goto(path);
    if (state !== "draft") {
      await page.getByRole("button", { name: "Issue", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Mark as paid", exact: true }),
      ).toBeVisible();
    }
    if (state === "cancelled") {
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Cancel invoice permanently",
          exact: true,
        })
        .click();
      await expect(
        page.getByText(
          "This invoice remains in the accounting history as cancelled.",
        ),
      ).toBeVisible();
    }
    const context = await browser.newContext({
      ...testInfo.project.use,
      storageState: viewer,
    });
    try {
      const readonly = await context.newPage();
      await readonly.goto(new URL(path, testInfo.project.use.baseURL!).href);
      await expect(
        readonly.getByText(
          "You can view and download this invoice. Your workspace role does not allow changes.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(readonly.locator("main")).toContainText(description);
      for (const action of [
        "Issue",
        "Edit",
        "Duplicate",
        "Repeat",
        "Send by email",
        "Cancel",
        "Delete",
        "Mark as paid",
        "Unmark paid",
      ]) {
        await expect(
          readonly.getByRole("button", { name: action, exact: true }),
        ).toHaveCount(0);
      }
      await expect(readonly.locator(`a[href="${path}/edit"]`)).toHaveCount(0);
      const pdf = await readonly.request.get(`/api${path}/pdf`);
      expect(pdf.status()).toBe(200);
      expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
      if (state === "issued" && testInfo.project.use.isMobile) {
        await testInfo.attach("read-only-invoice", {
          body: await readonly.screenshot(),
          contentType: "image/png",
        });
      }
    } finally {
      await context.close();
    }
  });
}

test("an invoice issuer retains their draft actions but cannot delete or manage payments", async ({
  page,
  browser,
}, testInfo) => {
  const issuer = process.env.INVOICEY_E2E_ISSUER_AUTH_STATE;
  if (!issuer) throw new Error("Seed the local issuer session first.");
  const path = await createDraft(
    page,
    `Issuer access ${testInfo.project.name}`,
  );
  const context = await browser.newContext({
    ...testInfo.project.use,
    storageState: issuer,
  });
  try {
    const subject = await context.newPage();
    await subject.goto(new URL(path, testInfo.project.use.baseURL!).href);
    for (const action of ["Issue", "Edit", "Duplicate", "Repeat"])
      await expect(
        subject.getByRole("button", { name: action, exact: true }),
      ).toBeVisible();
    await expect(
      subject.getByRole("button", { name: "Delete", exact: true }),
    ).toHaveCount(0);
    await subject.getByRole("button", { name: "Issue", exact: true }).click();
    await expect(
      subject.getByRole("button", { name: "Send by email", exact: true }),
    ).toBeVisible();
    await expect(
      subject.getByRole("button", { name: "Mark as paid", exact: true }),
    ).toHaveCount(0);
    await expect(subject.locator("#payment-ledger")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

// An issuer can cancel documents but cannot follow a link to a restricted ledger.
test("an issuer with an allocated payment receives usable cancellation guidance", async ({
  page,
  browser,
}, testInfo) => {
  const issuer = process.env.INVOICEY_E2E_ISSUER_AUTH_STATE;
  if (!issuer) throw new Error("Seed the local issuer session first.");
  const path = await createDraft(
    page,
    `Payment access guidance ${testInfo.project.name}`,
  );
  await page.goto(path);
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark as paid", exact: true }),
  ).toBeVisible();
  const id = path.split("/").at(-1)!;
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
  const context = await browser.newContext({
    ...testInfo.project.use,
    storageState: issuer,
  });
  try {
    const subject = await context.newPage();
    await subject.goto(new URL(path, testInfo.project.use.baseURL!).href);
    await subject.getByRole("button", { name: "Cancel", exact: true }).click();
    const dialog = subject.getByRole("dialog", {
      name: "Cancel this invoice?",
      exact: true,
    });
    await expect(
      dialog.getByText(
        "Ask a teammate with payment access to review and reverse the allocations.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: "Review payment ledger",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", {
        name: "Cancel invoice permanently",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("a member denied invoice reading cannot retrieve detail or document files directly", async ({
  page,
  browser,
}, testInfo) => {
  const deniedState = process.env.INVOICEY_E2E_NO_INVOICE_READ_AUTH_STATE;
  if (!deniedState)
    throw new Error("Seed a local session explicitly denied invoice reading.");
  const description = `Restricted document ${testInfo.project.name}`;
  const path = await createDraft(page, description);
  await page.goto(path);
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark as paid", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    ...testInfo.project.use,
    storageState: deniedState,
  });
  try {
    const subject = await context.newPage();
    for (const extension of ["pdf", "isdoc"]) {
      const response = await subject.request.get(
        new URL(`/api${path}/${extension}`, testInfo.project.use.baseURL!).href,
      );
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden" });
    }
    await subject.goto(new URL(path, testInfo.project.use.baseURL!).href);
    await expect(subject.locator("body")).not.toContainText(description);
    await expect(subject.locator(`a[href="/api${path}/pdf"]`)).toHaveCount(0);
    await expect(subject.getByText("404", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
