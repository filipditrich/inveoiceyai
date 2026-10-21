import { expect, test } from "@playwright/test";

import { sampleGeneratorDraft } from "../lib/generator/draft";

test.beforeEach(async ({ context }, testInfo) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: testInfo.project.use.baseURL! },
  ]);
});

async function openEditor(page: import("@playwright/test").Page) {
  const edit = page.getByRole("button", { name: "Tap to edit", exact: true });
  if (await edit.isVisible()) await edit.click();
}

// Previously every edit serialized the full invoice into the page URL.
test("legacy draft links import once and remove invoice data from the address bar", async ({
  page,
}) => {
  const draft = sampleGeneratorDraft({
    issuerId: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
    clientId: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
    locale: "en",
  });
  draft.items[0]!.description = "Legacy private design work";
  await page.goto(
    `/free-invoice-generator?d=${encodeURIComponent(JSON.stringify(draft))}`,
  );
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toHaveValue("Legacy private design work");
  await expect
    .poll(() => new URL(page.url()).searchParams.has("d"))
    .toBe(false);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toHaveValue("Legacy private design work");
});

test("private tab recovery survives reload and clears only when reset is confirmed", async ({
  page,
}) => {
  await page.goto("/free-invoice-generator");
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toBeAttached();
  await openEditor(page);
  const description = page.getByRole("textbox", {
    name: "DESCRIPTION",
    exact: true,
  });
  await description.fill("Private autumn design draft");
  await description.blur();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this tab" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("d")).toBe(false);
  await page.reload();
  await expect(description).toHaveValue("Private autumn design draft");
  await page
    .getByRole("button", { name: "Start a new draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(description).toHaveValue("Private autumn design draft");
  await page
    .getByRole("button", { name: "Start a new draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard draft and start again", exact: true })
    .click();
  await expect(description).not.toHaveValue("Private autumn design draft");
  await page.reload();
  await expect(description).not.toHaveValue("Private autumn design draft");
});

test("blocked session storage leaves the editor usable without leaking a draft into the URL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/free-invoice-generator");
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toBeAttached();
  await openEditor(page);
  await page
    .getByRole("textbox", { name: "DESCRIPTION", exact: true })
    .fill("Unsaved private work");
  await expect(
    page.getByRole("status").filter({ hasText: "cannot save drafts" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("d")).toBe(false);
});

test("Czech generator restores edits with localized recovery guidance", async ({
  context,
  page,
}, testInfo) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "cs", url: testInfo.project.use.baseURL! },
  ]);
  await page.goto("/faktura-zdarma");
  const description = page.getByRole("textbox", { name: "POPIS", exact: true });
  await expect(description).toBeAttached();
  const edit = page.getByRole("button", {
    name: "Ťukněte pro úpravy",
    exact: true,
  });
  if (await edit.isVisible()) await edit.click();
  await description.fill("Říjnová grafika");
  await description.blur();
  await expect(
    page.getByRole("status").filter({ hasText: "Uloženo v této kartě" }),
  ).toBeVisible();
  await page.reload();
  await expect(description).toHaveValue("Říjnová grafika");
  await expect(
    page.getByText("Obnovený koncept", { exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("d")).toBe(false);
});

test("invalid legacy draft data is removed without breaking the sample editor", async ({
  page,
}) => {
  await page.goto("/free-invoice-generator?d=not-json");
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toBeAttached();
  await expect
    .poll(() => new URL(page.url()).searchParams.has("d"))
    .toBe(false);
});

test("confirming a fresh draft also clears an earlier issuer-prefill link", async ({
  page,
}) => {
  await page.route("**/api/generator/ares/**", (route) =>
    route.fulfill({ status: 404, json: { ok: false } }),
  );
  await page.goto("/free-invoice-generator?ico=12345678");
  await expect(
    page.getByRole("textbox", { name: "DESCRIPTION", exact: true }),
  ).toBeAttached();
  await page
    .getByRole("button", { name: "Start a new draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard draft and start again", exact: true })
    .click();
  await expect
    .poll(() => new URL(page.url()).searchParams.has("ico"))
    .toBe(false);
});

// Cookie consent remains pending while another modal owns the screen.
test("pending cookie choices never cover the reset dialog and return after cancelling", async ({
  page,
  context,
}) => {
  await context.clearCookies({ name: "c15t-consent" });
  await page.addInitScript(() => localStorage.removeItem("c15t-consent"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/free-invoice-generator");
  const banner = page.getByTestId("consent-banner-root");
  await expect(banner).toBeVisible();
  await page
    .getByRole("button", { name: "Start a new draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Discard draft and start again",
      exact: true,
    }),
  ).toBeVisible();
  await expect(banner).not.toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(banner).toBeVisible();
});
