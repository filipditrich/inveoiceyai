import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("initial results render without a duplicate fetch; search calls the scoped tool", async ({
  page,
}) => {
  await page.goto("/");
  const ui = page.frameLocator("iframe");
  await expect(ui.getByText("Ateliér Forma", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await ui
    .getByPlaceholder("Hledat odběratele nebo číslo faktury")
    .fill("North");
  await ui.getByRole("button", { name: "Hledat", exact: true }).click();
  await expect(ui.getByText("Ateliér Forma", { exact: true })).toHaveCount(0);
  await expect(ui.getByText("North Design", { exact: true })).toBeVisible();
});
test("issuing waits for explicit confirmation and refreshes the persisted invoice", async ({
  page,
}) => {
  await page.goto("/");
  const ui = page.frameLocator("iframe");
  await ui.getByRole("button", { name: /Ateliér Forma/ }).click();
  await ui
    .getByRole("button", { name: "Vystavit fakturu", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      window.calls.filter(
        (call: { name: string }) => call.name === "issue_invoice",
      ),
    ),
  ).toEqual([]);
  await ui.getByRole("button", { name: "Potvrdit", exact: true }).click();
  await expect(ui.getByRole("heading", { name: "20260043" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.calls.filter(
          (call: { name: string }) => call.name === "issue_invoice",
        ).length,
    ),
  ).toBe(1);
});
test("viewer sees no issue control; attach adds a resource without sending a message", async ({
  page,
}) => {
  await page.goto("/?viewer");
  const ui = page.frameLocator("iframe");
  await ui.getByRole("button", { name: /Ateliér Forma/ }).click();
  await expect(
    ui.getByRole("button", { name: "Vystavit fakturu", exact: true }),
  ).toHaveCount(0);
  await ui.getByRole("button", { name: "Použít v konverzaci" }).click();
  await expect
    .poll(() => page.evaluate(() => window.attachedContext))
    .toMatchObject({
      content: [
        {
          type: "resource_link",
          uri: "invoicey://invoices/fa636ada-7b43-4667-8719-f4b0ea73f634",
        },
      ],
    });
  expect(await page.evaluate(() => window.lastMessage)).toBeUndefined();
});
test("failed tool calls retain a retryable screen", async ({ page }) => {
  await page.goto("/?error");
  const ui = page.frameLocator("iframe");
  await ui.getByRole("button", { name: "Obnovit", exact: true }).click();
  await expect(ui.getByRole("alert")).toBeVisible();
  await ui.getByRole("button", { name: "Zkusit znovu" }).click();
  await expect(ui.getByRole("alert")).toHaveCount(0);
});
test("native controls and invoice detail fit a narrow dark host", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?theme=dark&locale=en");
  const ui = page.frameLocator("iframe");
  await ui.getByRole("button", { name: /Ateliér Forma/ }).click();
  await expect(
    ui.getByRole("button", { name: "Issue invoice", exact: true }),
  ).toBeVisible();
  const frame = page.frames().find((frame) => frame.url().endsWith("/widget"))!;
  expect(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "../../docs/audit/screenshots/chatgpt-invoice-mobile-dark.png",
    fullPage: true,
  });
});

test("email sends only the reviewed recipient after confirmation", async ({
  page,
}) => {
  await page.goto("/?locale=en");
  const ui = page.frameLocator("iframe");
  await ui.getByRole("button", { name: /Kavárna Mezi řádky/ }).click();
  await ui.getByRole("button", { name: "Send email", exact: true }).click();
  await ui
    .getByRole("textbox", { name: "Recipient email" })
    .fill("approved@example.test");
  expect(
    await page.evaluate(() =>
      window.calls.filter((call) => call.name === "send_invoice_email"),
    ),
  ).toEqual([]);
  await ui.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.calls.filter((call) => call.name === "send_invoice_email"),
      ),
    )
    .toMatchObject([
      {
        name: "send_invoice_email",
        arguments: {
          id: "11e3a1ba-0610-4cb6-8eae-31d0f1daa8fe",
          to: "approved@example.test",
        },
      },
    ]);
});

test("payment cancellation leaves the invoice unpaid; confirmation refreshes paid status", async ({
  page,
}) => {
  await page.goto("/?locale=en");
  const ui = page.frameLocator("iframe");
  await ui.getByRole("button", { name: /Kavárna Mezi řádky/ }).click();
  await ui.getByRole("button", { name: "Record payment", exact: true }).click();
  await ui.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.calls.filter((call) => call.name === "mark_invoice_paid"),
    ),
  ).toEqual([]);
  await ui.getByRole("button", { name: "Record payment", exact: true }).click();
  await ui.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(ui.getByText("Paid", { exact: true })).toBeVisible();
});

test("invoice workspace fits desktop and has accessible light controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto("/?locale=en");
  const ui = page.frameLocator("iframe");
  await expect(ui.getByText("North Design", { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "../../docs/audit/screenshots/chatgpt-workspace-desktop.png",
    fullPage: true,
  });
});
